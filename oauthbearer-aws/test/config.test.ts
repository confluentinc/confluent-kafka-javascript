import { applyDefaults, validateConfig, type AwsOAuthBearerConfig } from '../provider';

/** Minimum valid config for happy-path tests. */
function ok(): AwsOAuthBearerConfig {
  return { region: 'eu-north-1', audience: 'https://confluent.cloud/oidc' };
}

describe('validateConfig', () => {
  describe('happy path', () => {
    it('accepts the minimum valid config (region + audience only)', () => {
      expect(() => validateConfig(ok())).not.toThrow();
    });

    it('accepts every optional field at boundary values', () => {
      expect(() => validateConfig({
        region: 'us-east-1',
        audience: 'https://api.example.com',
        signingAlgorithm: 'ES384',
        durationSeconds: 60,           // lower bound
        stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',
        principalName: 'svc-account',
        extensions: { logicalCluster: 'lkc-abc' },
      })).not.toThrow();

      expect(() => validateConfig({
        region: 'us-east-1',
        audience: 'https://api.example.com',
        signingAlgorithm: 'RS256',
        durationSeconds: 3600,         // upper bound
      })).not.toThrow();
    });
  });

  describe('input shape', () => {
    it('rejects null', () => {
      expect(() => validateConfig(null as unknown as AwsOAuthBearerConfig))
        .toThrow(/config must be an object/);
    });

    it('rejects undefined', () => {
      expect(() => validateConfig(undefined as unknown as AwsOAuthBearerConfig))
        .toThrow(/config must be an object/);
    });

    it('rejects a primitive', () => {
      expect(() => validateConfig('region=x' as unknown as AwsOAuthBearerConfig))
        .toThrow(/config must be an object/);
    });
  });

  describe('region', () => {
    it('rejects missing region', () => {
      expect(() => validateConfig({ audience: 'https://x' } as AwsOAuthBearerConfig))
        .toThrow(/region is required/);
    });

    it('rejects empty region', () => {
      expect(() => validateConfig({ region: '', audience: 'https://x' }))
        .toThrow(/region is required/);
    });

    it('rejects non-string region', () => {
      expect(() => validateConfig({
        region: 42 as unknown as string,
        audience: 'https://x',
      })).toThrow(/region is required/);
    });
  });

  describe('audience', () => {
    it('rejects missing audience', () => {
      expect(() => validateConfig({ region: 'us-east-1' } as AwsOAuthBearerConfig))
        .toThrow(/audience is required/);
    });

    it('rejects empty audience', () => {
      expect(() => validateConfig({ region: 'us-east-1', audience: '' }))
        .toThrow(/audience is required/);
    });
  });

  describe('signingAlgorithm', () => {
    it('rejects unknown algorithm', () => {
      expect(() => validateConfig({
        ...ok(),
        signingAlgorithm: 'HS256' as 'ES384',
      })).toThrow(/signingAlgorithm must be 'ES384' or 'RS256'/);
    });

    it('rejects unknown algorithm — value from config-string-parser pass-through', () => {
      // Reproduces the parser's "let through" behaviour from the H2 test:
      // `signing_algorithm=garbage` parses to { signingAlgorithm: 'garbage' }
      // which validateConfig must reject.
      expect(() => validateConfig({
        ...ok(),
        signingAlgorithm: 'garbage' as 'ES384',
      })).toThrow(/signingAlgorithm must be 'ES384' or 'RS256'/);
    });
  });

  describe('durationSeconds', () => {
    it('rejects below minimum (60)', () => {
      expect(() => validateConfig({ ...ok(), durationSeconds: 59 }))
        .toThrow(/durationSeconds must be an integer in \[60, 3600\]/);
    });

    it('rejects below minimum — H2 parser pass-through case (10)', () => {
      // The parser deliberately doesn't range-check. validateConfig must.
      expect(() => validateConfig({ ...ok(), durationSeconds: 10 }))
        .toThrow(/durationSeconds must be an integer in \[60, 3600\]/);
    });

    it('rejects above maximum (3600)', () => {
      expect(() => validateConfig({ ...ok(), durationSeconds: 3601 }))
        .toThrow(/durationSeconds must be an integer/);
    });

    it('rejects floating-point', () => {
      expect(() => validateConfig({ ...ok(), durationSeconds: 300.5 }))
        .toThrow(/durationSeconds must be an integer/);
    });

    it('rejects NaN', () => {
      expect(() => validateConfig({ ...ok(), durationSeconds: NaN }))
        .toThrow(/durationSeconds must be an integer/);
    });

    it('rejects non-number', () => {
      expect(() => validateConfig({
        ...ok(),
        durationSeconds: '300' as unknown as number,
      })).toThrow(/durationSeconds must be an integer/);
    });
  });

  describe('stsEndpoint', () => {
    it('rejects http:// (must be https)', () => {
      expect(() => validateConfig({
        ...ok(),
        stsEndpoint: 'http://insecure.example.com',
      })).toThrow(/stsEndpoint must be a non-empty https:\/\/ URL/);
    });

    it('rejects empty string', () => {
      expect(() => validateConfig({ ...ok(), stsEndpoint: '' }))
        .toThrow(/stsEndpoint must be a non-empty https:\/\/ URL/);
    });

    it('rejects bare domain (no scheme)', () => {
      expect(() => validateConfig({
        ...ok(),
        stsEndpoint: 'sts.amazonaws.com',
      })).toThrow(/stsEndpoint must be a non-empty https:\/\/ URL/);
    });
  });

  describe('principalName', () => {
    it('rejects empty string when set', () => {
      expect(() => validateConfig({ ...ok(), principalName: '' }))
        .toThrow(/principalName, when set, must be a non-empty string/);
    });

    it('accepts undefined (treated as "extract from JWT")', () => {
      expect(() => validateConfig(ok())).not.toThrow();
    });
  });

  describe('extensions', () => {
    it('rejects an array (must be a plain object)', () => {
      expect(() => validateConfig({
        ...ok(),
        extensions: ['foo', 'bar'] as unknown as Record<string, string>,
      })).toThrow(/extensions, when set, must be a plain object/);
    });

    it('rejects null', () => {
      expect(() => validateConfig({
        ...ok(),
        extensions: null as unknown as Record<string, string>,
      })).toThrow(/extensions, when set, must be a plain object/);
    });

    it('rejects an extension with empty value', () => {
      expect(() => validateConfig({
        ...ok(),
        extensions: { logicalCluster: '' },
      })).toThrow(/extension 'logicalCluster' must have a non-empty string value/);
    });

    it('rejects an extension with non-string value', () => {
      expect(() => validateConfig({
        ...ok(),
        extensions: { logicalCluster: 42 as unknown as string },
      })).toThrow(/extension 'logicalCluster' must have a non-empty string value/);
    });
  });
});

describe('applyDefaults', () => {
  it("fills signingAlgorithm: 'ES384' when unset", () => {
    const result = applyDefaults(ok());
    expect(result.signingAlgorithm).toBe('ES384');
  });

  it('fills durationSeconds: 300 when unset', () => {
    const result = applyDefaults(ok());
    expect(result.durationSeconds).toBe(300);
  });

  it('preserves explicit signingAlgorithm', () => {
    const result = applyDefaults({ ...ok(), signingAlgorithm: 'RS256' });
    expect(result.signingAlgorithm).toBe('RS256');
  });

  it('preserves explicit durationSeconds', () => {
    const result = applyDefaults({ ...ok(), durationSeconds: 1800 });
    expect(result.durationSeconds).toBe(1800);
  });

  it('does not mutate the input', () => {
    const input = ok();
    const before = JSON.stringify(input);
    applyDefaults(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('preserves region and audience', () => {
    const result = applyDefaults(ok());
    expect(result.region).toBe('eu-north-1');
    expect(result.audience).toBe('https://confluent.cloud/oidc');
  });

  it('preserves all optional fields when set', () => {
    const result = applyDefaults({
      region: 'us-east-1',
      audience: 'https://x',
      stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',
      principalName: 'svc',
      extensions: { logicalCluster: 'lkc-abc' },
    });
    expect(result.stsEndpoint).toBe('https://sts-fips.us-east-1.amazonaws.com');
    expect(result.principalName).toBe('svc');
    expect(result.extensions).toEqual({ logicalCluster: 'lkc-abc' });
  });

  it('omits optional fields when unset (does not include keys with undefined)', () => {
    const result = applyDefaults(ok());
    expect(Object.hasOwn(result, 'stsEndpoint')).toBe(false);
    expect(Object.hasOwn(result, 'principalName')).toBe(false);
    expect(Object.hasOwn(result, 'extensions')).toBe(false);
  });
});
