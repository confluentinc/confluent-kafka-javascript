import type { AwsOAuthBearerConfig } from './provider';

/**
 * Recognised top-level keys (excluding `extension_<NAME>`, which is
 * prefix-matched separately). Used for whitelist validation and for
 * building the error message when an unknown key is encountered.
 */
const RECOGNISED_KEYS = new Set([
  'region',
  'audience',
  'signing_algorithm',
  'duration_seconds',
  'sts_endpoint',
  'principal_name',
]);

const EXTENSION_PREFIX = 'extension_';

/**
 * Parses the verbatim `sasl.oauthbearer.config` string into a typed
 * AwsOAuthBearerConfig. The grammar is:
 *
 * ```
 * region=eu-north-1 audience=https://x duration_seconds=600 extension_a=1
 * ```
 *
 *  - Tokens are separated by whitespace (one or more `\s` characters).
 *  - Each token is `key=value`, split on the FIRST `=` (so values may
 *    contain `=`, e.g. `audience=https://example.com/path?a=b`).
 *  - Recognised keys: `region`, `audience`, `signing_algorithm`,
 *    `duration_seconds`, `sts_endpoint`, `principal_name`,
 *    `extension_<NAME>`.
 *  - Unknown keys throw TypeError with the list of valid keys.
 *  - Repeated keys (including the same `extension_<NAME>`) throw TypeError.
 *  - Empty values throw TypeError.
 *  - Values containing whitespace cannot occur (whitespace is the token
 *    separator); quoted values are NOT supported.
 *
 * The parser owns *grammar*; range and semantic validation are delegated
 * to {@link AwsOAuthBearerConfig}'s `validateConfig` (added at H3).
 *
 * @throws TypeError on every malformed-input path. Messages name the
 *   offending field where possible to give users an actionable signal.
 */
export function parseConfigString(s: string): AwsOAuthBearerConfig {
  if (typeof s !== 'string') {
    throw new TypeError(
      `parseConfigString: input must be a string, got ${typeof s}`,
    );
  }
  const trimmed = s.trim();
  if (trimmed.length === 0) {
    throw new TypeError('parseConfigString: input is empty');
  }

  // We accumulate into `result` incrementally; throw-on-duplicate so users
  // never silently overwrite their own keys.
  const result: {
    region?: string;
    audience?: string;
    signingAlgorithm?: 'ES384' | 'RS256';
    durationSeconds?: number;
    stsEndpoint?: string;
    principalName?: string;
    extensions?: Record<string, string>;
  } = {};

  const seen = new Set<string>();

  for (const token of trimmed.split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq < 0) {
      throw new TypeError(
        `parseConfigString: token '${token}' is missing '='`,
      );
    }
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);

    if (key.length === 0) {
      throw new TypeError(`parseConfigString: token '${token}' has empty key`);
    }
    if (value.length === 0) {
      throw new TypeError(
        `parseConfigString: key '${key}' has empty value`,
      );
    }

    // Extension keys: prefix match, accumulate.
    if (key.startsWith(EXTENSION_PREFIX)) {
      const extName = key.slice(EXTENSION_PREFIX.length);
      if (extName.length === 0) {
        throw new TypeError(
          `parseConfigString: 'extension_' prefix without a name`,
        );
      }
      if (seen.has(key)) {
        throw new TypeError(
          `parseConfigString: duplicate key '${key}'`,
        );
      }
      seen.add(key);
      if (!result.extensions) result.extensions = {};
      result.extensions[extName] = value;
      continue;
    }

    if (!RECOGNISED_KEYS.has(key)) {
      throw new TypeError(
        `parseConfigString: unknown key '${key}'. Valid keys: ` +
        `${[...RECOGNISED_KEYS, 'extension_<NAME>'].join(', ')}`,
      );
    }
    if (seen.has(key)) {
      throw new TypeError(`parseConfigString: duplicate key '${key}'`);
    }
    seen.add(key);

    // Map snake-case wire keys to camelCase JS fields. Inline switch is
    // clearer than a Map<string, keyof AwsOAuthBearerConfig> for six entries.
    switch (key) {
      case 'region':
        result.region = value;
        break;
      case 'audience':
        result.audience = value;
        break;
      case 'signing_algorithm':
        // We let through any string value here; H3's validateConfig
        // enforces the {ES384, RS256} whitelist with a clearer message.
        result.signingAlgorithm = value as 'ES384' | 'RS256';
        break;
      case 'duration_seconds': {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || String(n) !== value) {
          throw new TypeError(
            `parseConfigString: duration_seconds must be an integer, got '${value}'`,
          );
        }
        result.durationSeconds = n;
        break;
      }
      case 'sts_endpoint':
        result.stsEndpoint = value;
        break;
      case 'principal_name':
        result.principalName = value;
        break;
    }
  }

  // Required-key check. Range/format validation happens in
  // validateConfig (H3) — we intentionally do *not* duplicate it here.
  if (result.region === undefined) {
    throw new TypeError("parseConfigString: missing required key 'region'");
  }
  if (result.audience === undefined) {
    throw new TypeError("parseConfigString: missing required key 'audience'");
  }

  return result as AwsOAuthBearerConfig;
}
