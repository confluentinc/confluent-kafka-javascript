import {KmsClient} from "../kms-registry";
import {GcpCredentials, GcpKmsDriver} from "./gcp-driver";
import {KeyManagementServiceClient} from "@google-cloud/kms";

export class GcpKmsClient implements KmsClient {

  private kmsClient: KeyManagementServiceClient
  private keyUri: string
  private keyId: string

  constructor(keyUri: string, creds?: GcpCredentials) {
    if (!keyUri.startsWith(GcpKmsDriver.PREFIX)) {
      throw new Error(`key uri must start with ${GcpKmsDriver.PREFIX}`)
    }
    this.keyUri = keyUri
    this.keyId = keyUri.substring(GcpKmsDriver.PREFIX.length)
    this.kmsClient = creds != null
      ? new KeyManagementServiceClient({credentials: creds})
      : new KeyManagementServiceClient()
  }

  supported(keyUri: string): boolean {
    return this.keyUri === keyUri
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    const [result] = await this.kmsClient.encrypt({
      name: this.keyId,
      plaintext: plaintext
    })
    return Buffer.from(result.ciphertext as string)
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    const [result] = await this.kmsClient.decrypt({
      name: this.keyId,
      ciphertext: ciphertext
    })
    return Buffer.from(result.plaintext as string)
  }
}
