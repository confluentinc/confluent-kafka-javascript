// H2 — declared the AwsOAuthBearerConfig and AwsOAuthBearerToken interfaces.
// H3 — added validateConfig, applyDefaults, AwsStsTokenProvider class.

import { STSClient, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';

import { subFromJwt } from './jwt';

/**
 * Configuration for the AWS IAM OAUTHBEARER token provider.
 *
 * `region` and `audience` are required and have no default. Other fields have
 * sensible defaults applied by `applyDefaults` (added in H3). The wire grammar
 * (parsed by `parseConfigString` in `config-string-parser.ts`) populates this
 * shape from the `sasl.oauthbearer.config` librdkafka string.
 */
export interface AwsOAuthBearerConfig {
  /** AWS region used for STS calls. No silent default — must be explicit. */
  region: string;

  /** OIDC `aud` claim written into the minted JWT. Required. */
  audience: string;

  /**
   * JWT signing algorithm. AWS currently supports these two values.
   * Defaults to `'ES384'` via {@link applyDefaults}.
   */
  signingAlgorithm?: 'ES384' | 'RS256';

  /**
   * Token lifetime in seconds. AWS enforces `[60, 3600]`.
   * Defaults to `300` (5 minutes) via {@link applyDefaults}.
   */
  durationSeconds?: number;

  /**
   * Optional override for the STS endpoint URL — e.g. FIPS
   * (`https://sts-fips.us-east-1.amazonaws.com`) or a VPC interface endpoint.
   * Must start with `https://`.
   */
  stsEndpoint?: string;

  /**
   * Overrides the principal name written to {@link AwsOAuthBearerToken.principal}.
   * If unset, the principal is derived from the JWT's `sub` claim (the bare
   * role ARN that AWS minted the token for).
   */
  principalName?: string;

  /**
   * SASL extensions propagated to librdkafka via the OAUTHBEARER token. Keys
   * must conform to RFC 7628 §3.1 (no whitespace, no `=`); values must not
   * contain whitespace. The wire grammar `extension_<NAME>=<VALUE>` populates
   * this map.
   */
  extensions?: Record<string, string>;
}

/**
 * Token returned by `AwsStsTokenProvider.token()` (added in H3) and by
 * `awsAutoWire.createHandler`'s returned function (added in H4). This is the
 * cross-package contract shape that `@confluentinc/kafka-javascript` core
 * consumes via `oauthbearer_token_refresh_cb`.
 *
 * Field name `tokenValue` matches what node-rdkafka's
 * `setOAuthBearerToken(tokenValue, lifetime, principal, extensions)` expects.
 */
export interface AwsOAuthBearerToken {
  /** The minted JWT. */
  tokenValue: string;
  /** Unix epoch milliseconds at which the JWT expires. */
  lifetime: number;
  /** The principal — JWT `sub` claim, or `cfg.principalName` if set. */
  principal: string;
  /** Optional SASL extensions, populated from `cfg.extensions`. */
  extensions?: Record<string, string>;
}

// ────────────────────────────────────────────────────────────────────────────
// Defaults and ranges (matches .NET hybrid for cross-language consistency).
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_SIGNING_ALGORITHM = 'ES384' as const;
const DEFAULT_DURATION_SECONDS = 300;
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 3600;

/**
 * Result of {@link applyDefaults}: same shape as {@link AwsOAuthBearerConfig}
 * but with the defaultable fields promoted to required. Internal type used by
 * {@link AwsStsTokenProvider}; not exported.
 */
type NormalizedAwsOAuthBearerConfig =
  Required<Pick<AwsOAuthBearerConfig, 'region' | 'audience' | 'signingAlgorithm' | 'durationSeconds'>>
  & Pick<AwsOAuthBearerConfig, 'stsEndpoint' | 'principalName' | 'extensions'>;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Validates an {@link AwsOAuthBearerConfig} synchronously. Throws `TypeError`
 * with a message naming the offending field on failure.
 *
 * The wire-grammar parser ({@link parseConfigString} in `config-string-parser.ts`)
 * deliberately doesn't enforce range or enum constraints — that's this
 * function's job. Two-stage validation gives users one coherent error path
 * (`validateConfig` owns "is the value sensible?", parser owns "is the syntax
 * sensible?") rather than two error sources for the same field.
 *
 * Path A users hit this via `awsAutoWire.createHandler` (H4); Path B users
 * (deferred to H8) would hit it via the typed factory call site.
 *
 * @throws TypeError on every malformed-input path.
 */
export function validateConfig(cfg: AwsOAuthBearerConfig): void {
  if (!cfg || typeof cfg !== 'object') {
    throw new TypeError('AwsOAuthBearerConfig: config must be an object');
  }
  if (!isNonEmptyString(cfg.region)) {
    throw new TypeError(
      'AwsOAuthBearerConfig: region is required and must be a non-empty string',
    );
  }
  if (!isNonEmptyString(cfg.audience)) {
    throw new TypeError(
      'AwsOAuthBearerConfig: audience is required and must be a non-empty string',
    );
  }
  if (cfg.signingAlgorithm !== undefined
      && cfg.signingAlgorithm !== 'ES384'
      && cfg.signingAlgorithm !== 'RS256') {
    throw new TypeError(
      `AwsOAuthBearerConfig: signingAlgorithm must be 'ES384' or 'RS256', ` +
      `got ${JSON.stringify(cfg.signingAlgorithm)}`,
    );
  }
  if (cfg.durationSeconds !== undefined) {
    if (typeof cfg.durationSeconds !== 'number'
        || !Number.isInteger(cfg.durationSeconds)
        || cfg.durationSeconds < MIN_DURATION_SECONDS
        || cfg.durationSeconds > MAX_DURATION_SECONDS) {
      throw new TypeError(
        `AwsOAuthBearerConfig: durationSeconds must be an integer in ` +
        `[${MIN_DURATION_SECONDS}, ${MAX_DURATION_SECONDS}], got ${cfg.durationSeconds}`,
      );
    }
  }
  if (cfg.stsEndpoint !== undefined) {
    if (!isNonEmptyString(cfg.stsEndpoint) || !cfg.stsEndpoint.startsWith('https://')) {
      throw new TypeError(
        `AwsOAuthBearerConfig: stsEndpoint must be a non-empty https:// URL, ` +
        `got ${JSON.stringify(cfg.stsEndpoint)}`,
      );
    }
  }
  if (cfg.principalName !== undefined && !isNonEmptyString(cfg.principalName)) {
    throw new TypeError(
      'AwsOAuthBearerConfig: principalName, when set, must be a non-empty string',
    );
  }
  if (cfg.extensions !== undefined) {
    if (typeof cfg.extensions !== 'object'
        || cfg.extensions === null
        || Array.isArray(cfg.extensions)) {
      throw new TypeError(
        'AwsOAuthBearerConfig: extensions, when set, must be a plain object',
      );
    }
    for (const [k, v] of Object.entries(cfg.extensions)) {
      if (!isNonEmptyString(k)) {
        throw new TypeError(
          'AwsOAuthBearerConfig: extension key must be a non-empty string',
        );
      }
      if (!isNonEmptyString(v)) {
        throw new TypeError(
          `AwsOAuthBearerConfig: extension '${k}' must have a non-empty string value`,
        );
      }
    }
  }
}

/**
 * Returns a new config object with {@link DEFAULT_SIGNING_ALGORITHM} and
 * {@link DEFAULT_DURATION_SECONDS} applied where unset. Does NOT mutate the
 * input. Does NOT validate — call {@link validateConfig} first.
 */
export function applyDefaults(cfg: AwsOAuthBearerConfig): NormalizedAwsOAuthBearerConfig {
  return {
    region: cfg.region,
    audience: cfg.audience,
    signingAlgorithm: cfg.signingAlgorithm ?? DEFAULT_SIGNING_ALGORITHM,
    durationSeconds: cfg.durationSeconds ?? DEFAULT_DURATION_SECONDS,
    ...(cfg.stsEndpoint !== undefined && { stsEndpoint: cfg.stsEndpoint }),
    ...(cfg.principalName !== undefined && { principalName: cfg.principalName }),
    ...(cfg.extensions !== undefined && { extensions: cfg.extensions }),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// AwsStsTokenProvider — wraps STSClient + GetWebIdentityTokenCommand. First
// place AWS SDK calls actually happen at runtime.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Wraps `@aws-sdk/client-sts`'s `GetWebIdentityTokenCommand` and exposes a
 * single {@link token} method that mints an {@link AwsOAuthBearerToken}.
 *
 * Lifecycle:
 *  - Constructor runs `validateConfig` eagerly — bad config fails at startup.
 *  - Constructor builds an `STSClient` but does NOT touch the credential
 *    chain; the chain (env → shared config → IMDS → ECS → IRSA → SSO) runs
 *    on first `token()` call.
 *  - `token()` calls AWS once per invocation. No internal caching: librdkafka
 *    drives refresh cadence based on `lifetime`.
 *
 * Concurrency: `STSClient` is concurrent-safe per AWS SDK docs, so multiple
 * `token()` calls in flight at once are fine.
 *
 * @example
 * ```ts
 * const provider = new AwsStsTokenProvider({
 *   region: 'eu-north-1',
 *   audience: 'https://confluent.cloud/oidc',
 * });
 * const t = await provider.token();
 * console.log(t.tokenValue);   // the JWT
 * console.log(t.principal);    // e.g. arn:aws:iam::123:role/my-role
 * ```
 */
export class AwsStsTokenProvider {
  private readonly cfg: NormalizedAwsOAuthBearerConfig;
  private readonly sts: STSClient;

  /**
   * @param config  Validated eagerly; throws `TypeError` on bad input.
   * @param stsClient  Optional pre-constructed STS client. **Test-only** —
   *   production callers should omit this so the provider builds its own
   *   client from the config. Tests use it to inject a mocked STSClient
   *   (typically via `aws-sdk-client-mock`).
   */
  constructor(config: AwsOAuthBearerConfig, stsClient?: STSClient) {
    validateConfig(config);
    this.cfg = applyDefaults(config);
    this.sts = stsClient ?? new STSClient({
      region: this.cfg.region,
      ...(this.cfg.stsEndpoint !== undefined && { endpoint: this.cfg.stsEndpoint }),
    });
  }

  /**
   * Mints a fresh JWT via `sts:GetWebIdentityToken`. Each call hits AWS — no
   * caching. AWS SDK errors (e.g. `AccessDeniedException`,
   * `OutboundWebIdentityFederationNotEnabled`) propagate unchanged.
   *
   * @param _oauthbearerConfig  Ignored. Accepted as a parameter so the method
   *   can be used directly as a node-rdkafka-style callback (the caller
   *   passes the verbatim `sasl.oauthbearer.config` string here, but our
   *   wire grammar is parsed at construction time, not per-call).
   *
   * @throws Error when the response is missing `WebIdentityToken` or
   *   `Expiration` (AWS contract violation; should not happen in practice).
   * @throws TypeError when the JWT is malformed (propagated from `subFromJwt`).
   * @throws Whatever the AWS SDK throws on the wire — `AccessDeniedException`,
   *   `OutboundWebIdentityFederationNotEnabled`, network errors, etc.
   */
  async token(_oauthbearerConfig?: string): Promise<AwsOAuthBearerToken> {
    const out = await this.sts.send(new GetWebIdentityTokenCommand({
      Audience: [this.cfg.audience],
      SigningAlgorithm: this.cfg.signingAlgorithm,
      DurationSeconds: this.cfg.durationSeconds,
    }));

    if (!out.WebIdentityToken || !out.Expiration) {
      throw new Error(
        'sts:GetWebIdentityToken returned empty token or expiration',
      );
    }

    // Use the override if set; otherwise extract `sub` from the JWT.
    // The override-path skips JWT parsing entirely.
    const principal = this.cfg.principalName ?? subFromJwt(out.WebIdentityToken);

    return {
      tokenValue: out.WebIdentityToken,
      lifetime: out.Expiration.getTime(),
      principal,
      ...(this.cfg.extensions !== undefined && { extensions: this.cfg.extensions }),
    };
  }
}
