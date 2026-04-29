// H2 — interface declarations only. No runtime code.
// H3 fills in: validateConfig, applyDefaults, AwsStsTokenProvider class.

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
