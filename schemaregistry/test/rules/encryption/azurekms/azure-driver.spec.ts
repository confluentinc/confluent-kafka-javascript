import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AzureKmsDriver } from '../../../../rules/encryption/azurekms/azure-driver';
import { SecurityException } from '../../../../rules/encryption/tink/exception/security_exception';
import { KeyClient } from '@azure/keyvault-keys';

jest.mock('@azure/keyvault-keys');
jest.mock('@azure/identity');

const VERSION_A = 'a'.repeat(32);
const VERSIONLESS_KEY_ID = 'https://yokota1.vault.azure.net/keys/key1';
const VERSIONED_KEY_ID = `${VERSIONLESS_KEY_ID}/${VERSION_A}`;

const MockedKeyClient = KeyClient as jest.MockedClass<typeof KeyClient>;

describe('AzureKmsDriver', () => {
  beforeEach(() => {
    MockedKeyClient.mockClear();
  });

  it('isVersionless is true for a versionless id', () => {
    expect(AzureKmsDriver.isVersionless(VERSIONLESS_KEY_ID)).toBe(true);
  });

  it('isVersionless is false for a versioned id', () => {
    expect(AzureKmsDriver.isVersionless(VERSIONED_KEY_ID)).toBe(false);
  });

  it('isVersionless throws for a malformed id', () => {
    expect(() => AzureKmsDriver.isVersionless('https://yokota1.vault.azure.net/notkeys/key1'))
      .toThrow(SecurityException);
  });

  it('withVersion combines a versionless id with an explicit version', () => {
    expect(AzureKmsDriver.withVersion(VERSIONLESS_KEY_ID, VERSION_A)).toBe(VERSIONED_KEY_ID);
  });

  it('withVersion ignores any existing version segment', () => {
    // Only the vault and key name are used; any existing version is discarded in favor of the
    // explicit version argument.
    const otherVersion = 'b'.repeat(32);
    expect(AzureKmsDriver.withVersion(VERSIONED_KEY_ID, otherVersion))
      .toBe(`${VERSIONLESS_KEY_ID}/${otherVersion}`);
  });

  it('getVersionedKeyId returns unchanged when already versioned', async () => {
    const result = await AzureKmsDriver.getVersionedKeyId(new Map(), VERSIONED_KEY_ID);

    expect(result).toBe(VERSIONED_KEY_ID);
    expect(MockedKeyClient).not.toHaveBeenCalled();
  });

  it('getVersionedKeyId resolves a versionless id', async () => {
    MockedKeyClient.prototype.getKey = jest.fn(async () => ({ name: 'key1', id: VERSIONED_KEY_ID } as any));

    const result = await AzureKmsDriver.getVersionedKeyId(new Map(), VERSIONLESS_KEY_ID);

    expect(result).toBe(VERSIONED_KEY_ID);
    expect(MockedKeyClient.prototype.getKey).toHaveBeenCalledWith('key1');
  });

  it('getVersionedKeyId throws for a malformed key id', async () => {
    await expect(AzureKmsDriver.getVersionedKeyId(new Map(), 'https://yokota1.vault.azure.net/notkeys/key1'))
      .rejects.toThrow(SecurityException);
  });

  it('getVersionedKeyId throws for an invalid uri', async () => {
    await expect(AzureKmsDriver.getVersionedKeyId(new Map(), '::not a uri::'))
      .rejects.toThrow(SecurityException);
  });

  it('getVersionedKeyId wraps an exception from the resolver', async () => {
    MockedKeyClient.prototype.getKey = jest.fn(async () => {
      throw new Error('simulated RestError');
    });

    await expect(AzureKmsDriver.getVersionedKeyId(new Map(), VERSIONLESS_KEY_ID))
      .rejects.toThrow(SecurityException);
  });

  it('getVersionedKeyId throws when the resolver returns null', async () => {
    MockedKeyClient.prototype.getKey = jest.fn(async () => null as any);

    await expect(AzureKmsDriver.getVersionedKeyId(new Map(), VERSIONLESS_KEY_ID))
      .rejects.toThrow(SecurityException);
  });

  it('getVersionedKeyId throws when the resolved key id has no id', async () => {
    MockedKeyClient.prototype.getKey = jest.fn(async () => ({ name: 'key1', id: undefined } as any));

    await expect(AzureKmsDriver.getVersionedKeyId(new Map(), VERSIONLESS_KEY_ID))
      .rejects.toThrow(SecurityException);
  });

  it('getVersionedKeyId throws when the resolved key id is still versionless', async () => {
    // Resolver misconfiguration: returns the same versionless id it was asked to resolve.
    MockedKeyClient.prototype.getKey = jest.fn(async () => ({ name: 'key1', id: VERSIONLESS_KEY_ID } as any));

    await expect(AzureKmsDriver.getVersionedKeyId(new Map(), VERSIONLESS_KEY_ID))
      .rejects.toThrow(SecurityException);
  });
});
