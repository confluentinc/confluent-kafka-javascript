import {KmsClient, KmsDriver, registerKmsDriver} from "../kms-registry";
import {AwsKmsClient} from "./aws-client";
import {AwsCredentialIdentity, AwsCredentialIdentityProvider} from "@smithy/types";
import {fromTemporaryCredentials} from '@aws-sdk/credential-providers'

export class AwsKmsDriver implements KmsDriver {

  static PREFIX = 'aws-kms://'
  static ACCESS_KEY_ID = 'access.key.id'
  static SECRET_ACCESS_KEY = 'secret.access.key'
  static ROLE_ARN = 'role.arn'
  static ROLE_SESSION_NAME = 'role.session.name'
  static ROLE_EXTERNAL_ID = 'role.external.id'

  /**
   * Register the AWS KMS driver with the KMS registry.
   */
  static register(): void {
    registerKmsDriver(new AwsKmsDriver())
  }

  getKeyUrlPrefix(): string {
    return AwsKmsDriver.PREFIX
  }

  newKmsClient(config: Map<string, string>, keyUrl?: string): KmsClient {
    const uriPrefix = keyUrl != null ? keyUrl : AwsKmsDriver.PREFIX
    const key = config.get(AwsKmsDriver.ACCESS_KEY_ID)
    const secret = config.get(AwsKmsDriver.SECRET_ACCESS_KEY)
    const roleArn = config.get(AwsKmsDriver.ROLE_ARN)
    const roleSessionName = config.get(AwsKmsDriver.ROLE_SESSION_NAME)
    const roleExternalId = config.get(AwsKmsDriver.ROLE_EXTERNAL_ID)
    let creds: AwsCredentialIdentity | AwsCredentialIdentityProvider | undefined
    if (key != null && secret != null) {
      creds = {accessKeyId: key, secretAccessKey: secret}
    }
    if (roleArn != null) {
      let keyId = uriPrefix.substring(AwsKmsDriver.PREFIX.length)
      const tokens = keyId.split(':')
      if (tokens.length < 4) {
        throw new Error(`invalid key uri ${keyId}`)
      }
      const regionName = tokens[3]
      creds = fromTemporaryCredentials({
        masterCredentials: creds,
        params: {
          RoleArn: roleArn,
          RoleSessionName: roleSessionName ?? "confluent-encrypt",
          ExternalId: roleExternalId,
        },
        clientConfig: { region: regionName },
      })
    }
    return new AwsKmsClient(uriPrefix, creds)
  }
}
