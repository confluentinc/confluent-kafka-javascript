import { parseConfigString } from '../config-string-parser';

describe('parseConfigString', () => {
  describe('happy path — minimum valid config', () => {
    it('parses just region + audience (the two required keys)', () => {
      const cfg = parseConfigString('region=eu-north-1 audience=https://confluent.cloud/oidc');
      expect(cfg).toEqual({
        region: 'eu-north-1',
        audience: 'https://confluent.cloud/oidc',
      });
    });
  });

  describe('happy path — all recognised keys', () => {
    it('parses every recognised key + extensions', () => {
      const cfg = parseConfigString(
        'region=us-east-1 ' +
          'audience=https://api.example.com ' +
          'signing_algorithm=RS256 ' +
          'duration_seconds=600 ' +
          'sts_endpoint=https://sts-fips.us-east-1.amazonaws.com ' +
          'principal_name=service-account ' +
          'extension_logicalCluster=lkc-abc ' +
          'extension_identityPoolId=pool-xyz',
      );
      expect(cfg).toEqual({
        region: 'us-east-1',
        audience: 'https://api.example.com',
        signingAlgorithm: 'RS256',
        durationSeconds: 600,
        stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',
        principalName: 'service-account',
        extensions: {
          logicalCluster: 'lkc-abc',
          identityPoolId: 'pool-xyz',
        },
      });
    });
  });

  describe('snake-to-camel mapping', () => {
    it('signing_algorithm → signingAlgorithm', () => {
      const cfg = parseConfigString('region=x audience=y signing_algorithm=ES384');
      expect(cfg.signingAlgorithm).toBe('ES384');
    });

    it('duration_seconds → durationSeconds (parsed as integer)', () => {
      const cfg = parseConfigString('region=x audience=y duration_seconds=1800');
      expect(cfg.durationSeconds).toBe(1800);
      expect(typeof cfg.durationSeconds).toBe('number');
    });

    it('sts_endpoint → stsEndpoint', () => {
      const cfg = parseConfigString('region=x audience=y sts_endpoint=https://x');
      expect(cfg.stsEndpoint).toBe('https://x');
    });

    it('principal_name → principalName', () => {
      const cfg = parseConfigString('region=x audience=y principal_name=svc');
      expect(cfg.principalName).toBe('svc');
    });
  });

  describe('extension accumulation', () => {
    it('multiple extensions accumulate into a single object', () => {
      const cfg = parseConfigString('region=x audience=y extension_a=1 extension_b=2');
      expect(cfg.extensions).toEqual({ a: '1', b: '2' });
    });

    it("extensions field is undefined when no extension_<NAME> present", () => {
      const cfg = parseConfigString('region=x audience=y');
      expect(cfg.extensions).toBeUndefined();
    });

    it('extension names containing underscores work', () => {
      // 'extension_' is the prefix; everything after is the name.
      const cfg = parseConfigString('region=x audience=y extension_logical_cluster=lkc-abc');
      expect(cfg.extensions).toEqual({ logical_cluster: 'lkc-abc' });
    });

    it("'extension_' with no name throws", () => {
      expect(() => parseConfigString('region=x audience=y extension_=value'))
        .toThrow(/'extension_' prefix without a name/);
    });
  });

  describe('whitespace handling', () => {
    it('handles tabs and multiple spaces between tokens', () => {
      const cfg = parseConfigString('region=x\t\taudience=y    duration_seconds=300');
      expect(cfg).toEqual({
        region: 'x',
        audience: 'y',
        durationSeconds: 300,
      });
    });

    it('handles leading and trailing whitespace', () => {
      const cfg = parseConfigString('  region=x audience=y  ');
      expect(cfg).toEqual({ region: 'x', audience: 'y' });
    });

    it('handles newlines as token separators', () => {
      const cfg = parseConfigString('region=x\naudience=y');
      expect(cfg).toEqual({ region: 'x', audience: 'y' });
    });
  });

  describe('values containing reserved characters', () => {
    it('values may contain "=" (split on first equals only)', () => {
      // audience is a URL with embedded '='
      const cfg = parseConfigString(
        'region=x audience=https://example.com/path?a=b&c=d',
      );
      expect(cfg.audience).toBe('https://example.com/path?a=b&c=d');
    });

    it('values may contain other URL-special chars (?, &, /, :)', () => {
      const cfg = parseConfigString(
        'region=us-east-1 audience=https://example.com:8443/oidc?env=prod',
      );
      expect(cfg.audience).toBe('https://example.com:8443/oidc?env=prod');
    });
  });

  describe('input validation', () => {
    it('rejects non-string input', () => {
      expect(() => parseConfigString(undefined as unknown as string))
        .toThrow(/must be a string/);
      expect(() => parseConfigString(42 as unknown as string))
        .toThrow(/must be a string/);
    });

    it('rejects empty string', () => {
      expect(() => parseConfigString('')).toThrow(/empty/);
    });

    it('rejects whitespace-only string', () => {
      expect(() => parseConfigString('   \t\n  ')).toThrow(/empty/);
    });
  });

  describe('grammar errors', () => {
    it("rejects token without '='", () => {
      expect(() => parseConfigString('region=x audience'))
        .toThrow(/token 'audience' is missing '='/);
    });

    it('rejects token with empty key', () => {
      expect(() => parseConfigString('region=x =value'))
        .toThrow(/empty key/);
    });

    it('rejects key with empty value', () => {
      expect(() => parseConfigString('region=x audience='))
        .toThrow(/key 'audience' has empty value/);
    });
  });

  describe('whitelist errors', () => {
    it('rejects unknown key with a list of valid keys', () => {
      expect(() => parseConfigString('region=x audience=y foo=bar'))
        .toThrow(/unknown key 'foo'/);
      expect(() => parseConfigString('region=x audience=y foo=bar'))
        .toThrow(/region, audience, signing_algorithm, duration_seconds, sts_endpoint, principal_name, extension_<NAME>/);
    });

    it('rejects misspelled keys (regression: "audiance" instead of "audience")', () => {
      expect(() => parseConfigString('region=x audiance=y'))
        .toThrow(/unknown key 'audiance'/);
    });
  });

  describe('duplicate keys', () => {
    it('rejects duplicate top-level key', () => {
      expect(() => parseConfigString('region=a region=b audience=y'))
        .toThrow(/duplicate key 'region'/);
    });

    it('rejects duplicate extension key', () => {
      expect(() => parseConfigString('region=x audience=y extension_a=1 extension_a=2'))
        .toThrow(/duplicate key 'extension_a'/);
    });
  });

  describe('required-key errors', () => {
    it("rejects missing 'region'", () => {
      expect(() => parseConfigString('audience=https://x'))
        .toThrow(/missing required key 'region'/);
    });

    it("rejects missing 'audience'", () => {
      expect(() => parseConfigString('region=us-east-1'))
        .toThrow(/missing required key 'audience'/);
    });
  });

  describe('integer-format guarding for duration_seconds', () => {
    it("rejects floating-point: 'duration_seconds=3.5'", () => {
      expect(() => parseConfigString('region=x audience=y duration_seconds=3.5'))
        .toThrow(/duration_seconds must be an integer/);
    });

    it("rejects mixed alphanumeric: 'duration_seconds=300abc'", () => {
      expect(() => parseConfigString('region=x audience=y duration_seconds=300abc'))
        .toThrow(/duration_seconds must be an integer/);
    });

    it("rejects leading +: 'duration_seconds=+300'", () => {
      expect(() => parseConfigString('region=x audience=y duration_seconds=+300'))
        .toThrow(/duration_seconds must be an integer/);
    });

    it("rejects hex-literal: 'duration_seconds=0x10'", () => {
      expect(() => parseConfigString('region=x audience=y duration_seconds=0x10'))
        .toThrow(/duration_seconds must be an integer/);
    });

    it('does NOT range-validate (that is H3 validateConfig job)', () => {
      // Out-of-range values parse fine; H3 will catch them.
      const cfg = parseConfigString('region=x audience=y duration_seconds=10');
      expect(cfg.durationSeconds).toBe(10);
    });

    it('does NOT enum-validate signing_algorithm (that is H3 validateConfig job)', () => {
      const cfg = parseConfigString('region=x audience=y signing_algorithm=garbage');
      expect(cfg.signingAlgorithm).toBe('garbage');
    });
  });
});
