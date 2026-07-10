import {KmsClient} from "../kms-registry";
import {AzureKmsDriver} from "./azure-driver";
import {TokenCredential} from "@azure/identity";
import {CryptographyClient, EncryptionAlgorithm} from "@azure/keyvault-keys";
import {SecurityException} from "../tink/exception/security_exception";

const PREFIX = Buffer.from('azure:v1:', 'ascii')
const VERSION_LENGTH = 32
const HEADER_LENGTH = PREFIX.length + VERSION_LENGTH + 1 // +1 for ':'
const HEX_VERSION_RE = /^[0-9a-fA-F]+$/

function isValidVersion(value: string | null | undefined): boolean {
  return value != null && value.length === VERSION_LENGTH && HEX_VERSION_RE.test(value)
}

/**
 * Returns the embedded version if ciphertext carries the azure:v1: prefix (see class doc), or
 * null if it does not (e.g. a legacy DEK wrapped before ENCRYPT_AZURE_KEY_VERSION_SAVE was
 * enabled on its KEK, or the toggle is not set). Returning null rather than throwing is
 * deliberate: the toggle can be flipped on/off over a KEK's lifetime, and old, un-prefixed
 * ciphertext must remain decryptable.
 */
function extractVersion(ciphertext: Buffer): string | null {
  if (
    ciphertext.length < HEADER_LENGTH ||
    !ciphertext.subarray(0, PREFIX.length).equals(PREFIX) ||
    ciphertext[HEADER_LENGTH - 1] !== 0x3a // ':'
  ) {
    return null
  }
  return ciphertext.subarray(PREFIX.length, PREFIX.length + VERSION_LENGTH).toString('ascii')
}

/**
 * Basic Azure client for encryption/decryption.
 *
 * Unlike AWS KMS and GCP KMS, Azure Key Vault addresses wrap/unwrap by an explicit key version
 * and does not embed that version in the ciphertext it returns. When
 * AzureKmsDriver.ENCRYPT_AZURE_KEY_VERSION_SAVE is enabled, encrypt() makes its output
 * self-describing by prepending the exact version that produced it:
 * `azure:v1:` + 32-character key version + `:` + raw ciphertext bytes.
 *
 * decrypt() always checks for this prefix regardless of the current toggle value, since a DEK
 * wrapped while the toggle was on must remain decryptable even after it is turned back off.
 */
export class AzureKmsClient implements KmsClient {
  private static ALGORITHM: EncryptionAlgorithm = 'RSA-OAEP-256'

  private readonly defaultClient: CryptographyClient
  private readonly keyUri: string
  private readonly keyId: string
  private readonly credentials: TokenCredential
  private readonly config: Map<string, string>

  constructor(keyUri: string, creds: TokenCredential, config: Map<string, string> = new Map()) {
    if (!keyUri.startsWith(AzureKmsDriver.PREFIX)) {
      throw new Error(`key uri must start with ${AzureKmsDriver.PREFIX}`)
    }
    this.keyUri = keyUri
    this.keyId = keyUri.substring(AzureKmsDriver.PREFIX.length)
    this.credentials = creds
    this.config = config
    // Cheap to build eagerly: the constructor does not itself make a network call (the Azure SDK
    // resolves lazily on the first actual encrypt/decrypt call), and it is used directly whenever
    // the toggle is off, and as decrypt()'s fallback for legacy ciphertext with no embedded
    // version.
    this.defaultClient = new CryptographyClient(this.keyId, creds)
  }

  supported(keyUri: string): boolean {
    return this.keyUri === keyUri
  }

  private saveVersion(): boolean {
    const value = this.config.get(AzureKmsDriver.ENCRYPT_AZURE_KEY_VERSION_SAVE)
    return value != null && value.toLowerCase() === 'true'
  }

  /**
   * Builds a CryptographyClient for an explicit version. Used both by encrypt() (once it has
   * resolved the current version) and decrypt() (to target whichever version is embedded in
   * already-wrapped ciphertext) -- there is only one place that knows how to turn a version into
   * a client.
   */
  private clientForVersion(version: string): CryptographyClient {
    const versionedKeyUri = AzureKmsDriver.withVersion(this.keyId, version)
    return new CryptographyClient(versionedKeyUri, this.credentials)
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    if (!this.saveVersion()) {
      const result = await this.defaultClient.encrypt(AzureKmsClient.ALGORITHM, plaintext)
      return Buffer.from(result.result)
    }
    const resolvedKeyUri = await AzureKmsDriver.getVersionedKeyId(this.config, this.keyId)
    const version = resolvedKeyUri.substring(resolvedKeyUri.lastIndexOf('/') + 1)
    if (!isValidVersion(version)) {
      // Mirrors decrypt()'s own validation: a DEK this method wraps must always be one this same
      // class can later unwrap.
      throw new SecurityException(
        `kms key version '${version}' must be a ${VERSION_LENGTH}-character hex string; cannot ` +
        'be embedded in a fixed-width azure:v1: prefix')
    }
    const client = this.clientForVersion(version)
    const result = await client.encrypt(AzureKmsClient.ALGORITHM, plaintext)
    return Buffer.concat([PREFIX, Buffer.from(version, 'ascii'), Buffer.from(':'), Buffer.from(result.result)])
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    let client = this.defaultClient
    let wrapped = ciphertext
    const version = extractVersion(ciphertext)
    if (version != null) {
      if (!isValidVersion(version)) {
        // Encrypted key material is unauthenticated at this layer, so a corrupted or tampered
        // value could otherwise smuggle arbitrary characters (e.g. '/') into the key identifier
        // URL built from it below.
        throw new SecurityException(`ciphertext carries an invalid azure:v1: key version: '${version}'`)
      }
      client = this.clientForVersion(version)
      wrapped = ciphertext.subarray(HEADER_LENGTH)
    }
    const result = await client.decrypt(AzureKmsClient.ALGORITHM, wrapped)
    return Buffer.from(result.result)
  }
}
