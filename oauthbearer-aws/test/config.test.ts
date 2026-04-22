import { validateConfig, applyDefaults, AwsOAuthBearerConfig } from '../provider';

const baseValidConfig: AwsOAuthBearerConfig = {
  region: 'eu-north-1',
  audience: 'https://api.example.com',
};

describe('validateConfig — required fields', () => {
  it('accepts a minimal valid config', () => {
    expect(() => validateConfig(baseValidConfig)).not.toThrow();
  });

  it('rejects a null/undefined config', () => {
    expect(() => validateConfig(null as unknown as AwsOAuthBearerConfig))
      .toThrow(/must be an object/);
    expect(() => validateConfig(undefined as unknown as AwsOAuthBearerConfig))
      .toThrow(/must be an object/);
  });

  it('rejects a missing region', () => {
    const cfg = { ...baseValidConfig, region: undefined as unknown as string };
    expect(() => validateConfig(cfg)).toThrow(/region/);
  });

  it('rejects an empty region', () => {
    expect(() => validateConfig({ ...baseValidConfig, region: '' }))
      .toThrow(/region/);
  });

  it('rejects a non-string region', () => {
    const cfg = { ...baseValidConfig, region: 123 as unknown as string };
    expect(() => validateConfig(cfg)).toThrow(/region/);
  });

  it('rejects a missing audience', () => {
    const cfg = { ...baseValidConfig, audience: undefined as unknown as string };
    expect(() => validateConfig(cfg)).toThrow(/audience/);
  });

  it('rejects an empty audience', () => {
    expect(() => validateConfig({ ...baseValidConfig, audience: '' }))
      .toThrow(/audience/);
  });
});

describe('validateConfig — signingAlgorithm', () => {
  it('accepts undefined', () => {
    expect(() => validateConfig(baseValidConfig)).not.toThrow();
  });

  it('accepts ES384', () => {
    expect(() => validateConfig({ ...baseValidConfig, signingAlgorithm: 'ES384' }))
      .not.toThrow();
  });

  it('accepts RS256', () => {
    expect(() => validateConfig({ ...baseValidConfig, signingAlgorithm: 'RS256' }))
      .not.toThrow();
  });

  it('rejects any other string (e.g. HS256)', () => {
    const cfg = {
      ...baseValidConfig,
      signingAlgorithm: 'HS256' as unknown as 'ES384' | 'RS256',
    };
    expect(() => validateConfig(cfg)).toThrow(/signingAlgorithm/);
  });
});

describe('validateConfig — durationSeconds', () => {
  it('accepts undefined', () => {
    expect(() => validateConfig(baseValidConfig)).not.toThrow();
  });

  it.each([60, 300, 900, 3600])('accepts %d (boundary/common values)', (seconds) => {
    expect(() => validateConfig({ ...baseValidConfig, durationSeconds: seconds }))
      .not.toThrow();
  });

  it.each([0, 30, 59, 3601, 7200, -1])('rejects out-of-range %d', (seconds) => {
    expect(() => validateConfig({ ...baseValidConfig, durationSeconds: seconds }))
      .toThrow(/durationSeconds/);
  });

  it('rejects non-integer values', () => {
    expect(() => validateConfig({ ...baseValidConfig, durationSeconds: 300.5 }))
      .toThrow(/durationSeconds/);
  });

  it('rejects NaN', () => {
    expect(() => validateConfig({ ...baseValidConfig, durationSeconds: NaN }))
      .toThrow(/durationSeconds/);
  });

  it('rejects non-number values', () => {
    const cfg = { ...baseValidConfig, durationSeconds: '300' as unknown as number };
    expect(() => validateConfig(cfg)).toThrow(/durationSeconds/);
  });
});

describe('validateConfig — stsEndpoint', () => {
  it('accepts undefined', () => {
    expect(() => validateConfig(baseValidConfig)).not.toThrow();
  });

  it('accepts a valid https URL', () => {
    expect(() => validateConfig({
      ...baseValidConfig,
      stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',
    })).not.toThrow();
  });

  it('rejects an http (insecure) URL', () => {
    expect(() => validateConfig({
      ...baseValidConfig,
      stsEndpoint: 'http://insecure.example.com',
    })).toThrow(/stsEndpoint/);
  });

  it('rejects an empty string', () => {
    expect(() => validateConfig({ ...baseValidConfig, stsEndpoint: '' }))
      .toThrow(/stsEndpoint/);
  });
});

describe('validateConfig — credentials', () => {
  it('accepts undefined', () => {
    expect(() => validateConfig(baseValidConfig)).not.toThrow();
  });

  it('accepts an AwsCredentialIdentity object', () => {
    expect(() => validateConfig({
      ...baseValidConfig,
      credentials: { accessKeyId: 'AKIA...', secretAccessKey: 'secret' },
    })).not.toThrow();
  });

  it('accepts an async credential provider function', () => {
    expect(() => validateConfig({
      ...baseValidConfig,
      credentials: async () => ({ accessKeyId: 'AKIA...', secretAccessKey: 'secret' }),
    })).not.toThrow();
  });

  it('rejects an object missing accessKeyId', () => {
    const cfg = {
      ...baseValidConfig,
      credentials: { secretAccessKey: 'secret' } as { accessKeyId: string; secretAccessKey: string },
    };
    expect(() => validateConfig(cfg)).toThrow(/credentials/);
  });

  it('rejects an object missing secretAccessKey', () => {
    const cfg = {
      ...baseValidConfig,
      credentials: { accessKeyId: 'AKIA...' } as { accessKeyId: string; secretAccessKey: string },
    };
    expect(() => validateConfig(cfg)).toThrow(/credentials/);
  });

  it('rejects non-object, non-function values', () => {
    const cfg = {
      ...baseValidConfig,
      credentials: 'not-a-credential' as unknown as AwsOAuthBearerConfig['credentials'],
    };
    expect(() => validateConfig(cfg)).toThrow(/credentials/);
  });
});

describe('applyDefaults', () => {
  it('defaults signingAlgorithm to ES384 when unset', () => {
    const out = applyDefaults(baseValidConfig);
    expect(out.signingAlgorithm).toBe('ES384');
  });

  it('defaults durationSeconds to 300 when unset', () => {
    const out = applyDefaults(baseValidConfig);
    expect(out.durationSeconds).toBe(300);
  });

  it('preserves explicit signingAlgorithm', () => {
    const out = applyDefaults({ ...baseValidConfig, signingAlgorithm: 'RS256' });
    expect(out.signingAlgorithm).toBe('RS256');
  });

  it('preserves explicit durationSeconds', () => {
    const out = applyDefaults({ ...baseValidConfig, durationSeconds: 900 });
    expect(out.durationSeconds).toBe(900);
  });

  it('preserves required fields', () => {
    const out = applyDefaults(baseValidConfig);
    expect(out.region).toBe('eu-north-1');
    expect(out.audience).toBe('https://api.example.com');
  });

  it('preserves optional stsEndpoint and credentials when set', () => {
    const creds = { accessKeyId: 'AKIA...', secretAccessKey: 'secret' };
    const out = applyDefaults({
      ...baseValidConfig,
      stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',
      credentials: creds,
    });
    expect(out.stsEndpoint).toBe('https://sts-fips.us-east-1.amazonaws.com');
    expect(out.credentials).toBe(creds);
  });

  it('leaves optional stsEndpoint and credentials undefined when unset', () => {
    const out = applyDefaults(baseValidConfig);
    expect(out.stsEndpoint).toBeUndefined();
    expect(out.credentials).toBeUndefined();
  });

  it('does not mutate the input config', () => {
    const input: AwsOAuthBearerConfig = { ...baseValidConfig };
    const snapshot = JSON.stringify(input);
    applyDefaults(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
