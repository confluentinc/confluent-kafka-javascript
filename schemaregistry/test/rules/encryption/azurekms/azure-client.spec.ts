import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AzureKmsClient } from '../../../../rules/encryption/azurekms/azure-client';
import { AzureKmsDriver } from '../../../../rules/encryption/azurekms/azure-driver';
import { SecurityException } from '../../../../rules/encryption/tink/exception/security_exception';
import { CryptographyClient, KeyClient } from '@azure/keyvault-keys';
import { TokenCredential } from '@azure/identity';

jest.mock('@azure/keyvault-keys');
jest.mock('@azure/identity');

const KEY_URI = 'azure-kms://https://yokota1.vault.azure.net/keys/key1';
const VERSION_A = 'a'.repeat(32);
const VERSION_B = 'b'.repeat(32);
const CREDS = {} as TokenCredential;

const MockedCryptographyClient = CryptographyClient as jest.MockedClass<typeof CryptographyClient>;
const MockedKeyClient = KeyClient as jest.MockedClass<typeof KeyClient>;

describe('AzureKmsClient', () => {
  beforeEach(() => {
    MockedCryptographyClient.mockClear();
    MockedKeyClient.mockClear();
  });

  it('encrypt returns raw ciphertext when the toggle is off', async () => {
    MockedCryptographyClient.prototype.encrypt = jest.fn(async () => ({ result: Buffer.from('raw-ciphertext') } as any));

    const client = new AzureKmsClient(KEY_URI, CREDS, new Map());
    const result = await client.encrypt(Buffer.from('plaintext'));

    expect(result).toEqual(Buffer.from('raw-ciphertext'));
  });

  it('encrypt prefixes with the resolved version without double-encoding when the toggle is on', async () => {
    MockedKeyClient.prototype.getKey = jest.fn(async () => (
      { name: 'key1', id: `https://yokota1.vault.azure.net/keys/key1/${VERSION_A}` } as any
    ));
    MockedCryptographyClient.prototype.encrypt = jest.fn(async () => ({ result: Buffer.from('wrapped-bytes') } as any));

    const config = new Map([[AzureKmsDriver.ENCRYPT_AZURE_KEY_VERSION_SAVE, 'true']]);
    const client = new AzureKmsClient(KEY_URI, CREDS, config);
    const result = await client.encrypt(Buffer.from('plaintext'));

    expect(result).toEqual(Buffer.concat([
      Buffer.from('azure:v1:', 'ascii'), Buffer.from(VERSION_A, 'ascii'), Buffer.from(':'), Buffer.from('wrapped-bytes'),
    ]));
  });

  it('decrypt uses the embedded version to build a versioned client', async () => {
    MockedCryptographyClient.prototype.decrypt = jest.fn(async () => ({ result: Buffer.from('correct-plaintext') } as any));

    const client = new AzureKmsClient(KEY_URI, CREDS, new Map());
    const ciphertext = Buffer.concat([
      Buffer.from('azure:v1:', 'ascii'), Buffer.from(VERSION_A, 'ascii'), Buffer.from(':'), Buffer.from('wrapped-bytes'),
    ]);

    const result = await client.decrypt(ciphertext);

    expect(result).toEqual(Buffer.from('correct-plaintext'));
    // The default client (built from the versionless key id) plus one more for the embedded
    // version.
    expect(MockedCryptographyClient).toHaveBeenCalledTimes(2);
    expect(MockedCryptographyClient.mock.calls[1][0]).toBe(`https://yokota1.vault.azure.net/keys/key1/${VERSION_A}`);
  });

  it('decrypt falls back to the default client for legacy unprefixed ciphertext', async () => {
    MockedCryptographyClient.prototype.decrypt = jest.fn(async () => ({ result: Buffer.from('legacy-plaintext') } as any));

    const client = new AzureKmsClient(KEY_URI, CREDS, new Map());
    const result = await client.decrypt(Buffer.from('legacy-unprefixed-ciphertext'));

    expect(result).toEqual(Buffer.from('legacy-plaintext'));
    // Only the default client was ever constructed -- no version-specific client was needed.
    expect(MockedCryptographyClient).toHaveBeenCalledTimes(1);
  });

  it('decrypt remains possible after the toggle is turned back off', async () => {
    // A DEK wrapped while ENCRYPT_AZURE_KEY_VERSION_SAVE was on must stay decryptable even once
    // the toggle is turned back off: decrypt() must not depend on the toggle at all.
    MockedCryptographyClient.prototype.decrypt = jest.fn(async () => ({ result: Buffer.from('still-decryptable') } as any));

    const config = new Map([[AzureKmsDriver.ENCRYPT_AZURE_KEY_VERSION_SAVE, 'false']]);
    const client = new AzureKmsClient(KEY_URI, CREDS, config);
    const ciphertext = Buffer.concat([
      Buffer.from('azure:v1:', 'ascii'), Buffer.from(VERSION_B, 'ascii'), Buffer.from(':'), Buffer.from('wrapped-bytes'),
    ]);

    const result = await client.decrypt(ciphertext);

    expect(result).toEqual(Buffer.from('still-decryptable'));
  });

  it('decrypt throws for a non-hex embedded version', async () => {
    const client = new AzureKmsClient(KEY_URI, CREDS, new Map());
    const nonHexVersion = 'g'.repeat(32);
    const ciphertext = Buffer.concat([
      Buffer.from('azure:v1:', 'ascii'), Buffer.from(nonHexVersion, 'ascii'), Buffer.from(':'), Buffer.from('wrapped-bytes'),
    ]);

    await expect(client.decrypt(ciphertext)).rejects.toThrow(SecurityException);
  });

  it('encrypt throws when the resolved version is not fixed-width hex', async () => {
    MockedKeyClient.prototype.getKey = jest.fn(async () => (
      { name: 'key1', id: 'https://yokota1.vault.azure.net/keys/key1/not-32-chars' } as any
    ));

    const config = new Map([[AzureKmsDriver.ENCRYPT_AZURE_KEY_VERSION_SAVE, 'true']]);
    const client = new AzureKmsClient(KEY_URI, CREDS, config);

    await expect(client.encrypt(Buffer.from('plaintext'))).rejects.toThrow(SecurityException);
  });
});
