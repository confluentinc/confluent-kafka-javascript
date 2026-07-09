import {KmsClient, KmsDriver, registerKmsDriver} from "../kms-registry";
import {ClientSecretCredential, DefaultAzureCredential, TokenCredential} from '@azure/identity'
import {KeyClient} from '@azure/keyvault-keys'
import {SecurityException} from "../tink/exception/security_exception";
import {AzureKmsClient} from "./azure-client";

interface AzureKeyId {
  vaultUrl: string
  name: string
  version?: string
}

export class AzureKmsDriver implements KmsDriver {

  static PREFIX = 'azure-kms://'
  static TENANT_ID = 'tenant.id'
  static CLIENT_ID = 'client.id'
  static CLIENT_SECRET = 'client.secret'

  /**
   * Enables making a DEK's encrypted key material self-describing with respect to which exact
   * Azure Key Vault key version wrapped it (see AzureKmsClient), matching the same
   * self-description property AWS KMS and GCP KMS ciphertext already provide natively. Set as a
   * kek kmsProps entry.
   */
  static ENCRYPT_AZURE_KEY_VERSION_SAVE = 'encrypt.azure.key.version.save'

  /**
   * Register the Azure KMS driver with the KMS registry.
   */
  static register(): void {
    registerKmsDriver(new AzureKmsDriver())
  }

  getKeyUrlPrefix(): string {
    return AzureKmsDriver.PREFIX
  }

  newKmsClient(config: Map<string, string>, keyUrl?: string): KmsClient {
    const uriPrefix = keyUrl != null ? keyUrl : AzureKmsDriver.PREFIX
    const creds = AzureKmsDriver.getCredentials(config)
    return new AzureKmsClient(uriPrefix, creds, config)
  }

  static getCredentials(config: Map<string, string>): TokenCredential {
    const tenantId = config.get(AzureKmsDriver.TENANT_ID)
    const clientId = config.get(AzureKmsDriver.CLIENT_ID)
    const clientSecret = config.get(AzureKmsDriver.CLIENT_SECRET)
    if (tenantId != null && clientId != null && clientSecret != null) {
      return new ClientSecretCredential(tenantId, clientId, clientSecret)
    }
    return new DefaultAzureCredential()
  }

  /**
   * Returns true if kmsKeyId has no explicit version segment. Used to warn when
   * ENCRYPT_AZURE_KEY_VERSION_SAVE is not enabled for a versionless key, without performing any
   * actual resolution (no KeyClient call).
   */
  static isVersionless(kmsKeyId: string): boolean {
    return AzureKmsDriver.parse(kmsKeyId).version == null
  }

  /**
   * Combines kmsKeyId (versionless or versioned; only the vault and key name are used) with an
   * explicit version, returning the full versioned key identifier. Used to reconstruct a target
   * for a version extracted from an already-wrapped DEK, which may differ from whatever
   * getVersionedKeyId currently resolves to (e.g. after a rotation).
   */
  static withVersion(kmsKeyId: string, version: string): string {
    const parsed = AzureKmsDriver.parse(kmsKeyId)
    return `${parsed.vaultUrl}/keys/${parsed.name}/${version}`
  }

  /**
   * Resolves a possibly-versionless Azure Key Vault key identifier (e.g.
   * "https://vault.vault.azure.net/keys/name") into the concrete, currently-enabled version (e.g.
   * "https://vault.vault.azure.net/keys/name/<version>"). If kmsKeyId already includes a version
   * segment, it is returned unchanged and no call is made.
   *
   * This exists because, unlike AWS KMS and GCP KMS, Azure Key Vault's wrap/unwrap operations
   * address an explicit key version and do not embed that version in the returned ciphertext, so
   * a caller that only ever uses a versionless reference has no way to know which version
   * encrypted a given DEK once the key has been rotated.
   */
  static async getVersionedKeyId(config: Map<string, string>, kmsKeyId: string): Promise<string> {
    const parsed = AzureKmsDriver.parse(kmsKeyId)
    if (parsed.version != null) {
      // Already versioned; respect the explicitly pinned config as-is.
      return kmsKeyId
    }
    const client = new KeyClient(parsed.vaultUrl, AzureKmsDriver.getCredentials(config))
    let key
    try {
      key = await client.getKey(parsed.name)
    } catch (e) {
      const details = e instanceof Error ? e.message : String(e)
      throw new SecurityException(
        `Failed to resolve Azure Key Vault key id for key name '${parsed.name}' in vault ${parsed.vaultUrl}: ${details}`)
    }
    if (key == null || key.id == null) {
      throw new SecurityException(
        `Failed to resolve Azure Key Vault key id for key name '${parsed.name}' in vault ${parsed.vaultUrl}`)
    }
    const resolvedId = key.id
    if (AzureKmsDriver.parse(resolvedId).version == null) {
      throw new SecurityException(`Resolved Azure Key Vault key id is missing a version segment: ${resolvedId}`)
    }
    return resolvedId
  }

  private static parse(kmsKeyId: string): AzureKeyId {
    let url: URL
    try {
      url = new URL(kmsKeyId)
    } catch {
      throw new SecurityException(`Invalid Azure Key Vault key id: ${kmsKeyId}`)
    }
    const segments = url.pathname.split('/').filter(s => s.length > 0)
    if (segments.length < 2 || segments.length > 3 || segments[0] !== 'keys') {
      throw new SecurityException(`Invalid Azure Key Vault key id: ${kmsKeyId}`)
    }
    const vaultUrl = `${url.protocol}//${url.host}`
    return {vaultUrl, name: segments[1], version: segments.length === 3 ? segments[2] : undefined}
  }
}
