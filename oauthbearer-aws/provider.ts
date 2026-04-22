import { STSClient, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@smithy/types';

import { subFromJwt } from './jwt';

/**
 * Configuration for the AWS IAM OAUTHBEARER token provider.
 *
 * All fields map directly to STS `GetWebIdentityToken` parameters or AWS SDK
 * client options. `region` and `audience` are required and have no default.
 */
export interface AwsOAuthBearerConfig {
  /** AWS region used for STS calls. No silent default — must be explicit. */
  region: string;

  /** OIDC `aud` claim written into the minted JWT. Required. */
  audience: string;

  /**
   * JWT signing algorithm. AWS currently supports these two.
   * Defaults to `'ES384'`.
   */
  signingAlgorithm?: 'ES384' | 'RS256';

  /**
   * Token lifetime in seconds. AWS enforces `[60, 3600]`.
   * Defaults to `300` (5 minutes).
   */
  durationSeconds?: number;

  /**
   * Optional override for the STS endpoint URL — e.g. FIPS
   * (`https://sts-fips.us-east-1.amazonaws.com`) or a VPC interface endpoint.
   * Must be `https://`.
   */
  stsEndpoint?: string;

  /**
   * Explicit credentials, or a credential provider function. If unset, the
   * AWS SDK's default credential chain is used — env → shared config → web
   * identity → ECS → IMDSv2 → EKS IRSA / Pod Identity → SSO → profile.
   */
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
}

/**
 * Token returned by {@link AwsStsTokenProvider.token}. Exposes both the
 * KafkaJS field name (`value`) and the node-rdkafka field name (`tokenValue`);
 * they always hold the same string. The convenience factories
 * {@link awsOAuthBearerProvider} and {@link awsOAuthBearerTokenRefreshCb}
 * project this type onto the shape each API expects.
 */
export interface AwsOAuthBearerToken {
  /** The JWT (KafkaJS shape). */
  value: string;
  /** The JWT (node-rdkafka shape). Same string as `value`. */
  tokenValue: string;
  /** Unix epoch milliseconds at which the JWT expires. */
  lifetime: number;
  /** The JWT `sub` claim — typically a bare AWS role or assumed-role ARN. */
  principal: string;
  /** Optional SASL extensions. Not populated by this provider today. */
  extensions?: Record<string, string>;
}

const DEFAULT_SIGNING_ALGORITHM: 'ES384' = 'ES384';
const DEFAULT_DURATION_SECONDS = 300;
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 3600;

type NormalizedConfig = Required<
  Pick<AwsOAuthBearerConfig, 'region' | 'audience' | 'signingAlgorithm' | 'durationSeconds'>
> & Pick<AwsOAuthBearerConfig, 'stsEndpoint' | 'credentials'>;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Validates an {@link AwsOAuthBearerConfig} synchronously. Throws `TypeError`
 * with a message naming the offending field. Exported for advanced callers;
 * most users won't call this directly — the {@link AwsStsTokenProvider}
 * constructor and the two factory functions run validation themselves.
 */
export function validateConfig(cfg: AwsOAuthBearerConfig): void {
  if (!cfg || typeof cfg !== 'object') {
    throw new TypeError('AwsOAuthBearerConfig: config must be an object');
  }
  if (!isNonEmptyString(cfg.region)) {
    throw new TypeError('AwsOAuthBearerConfig: region is required and must be a non-empty string');
  }
  if (!isNonEmptyString(cfg.audience)) {
    throw new TypeError('AwsOAuthBearerConfig: audience is required and must be a non-empty string');
  }
  if (cfg.signingAlgorithm !== undefined &&
      cfg.signingAlgorithm !== 'ES384' &&
      cfg.signingAlgorithm !== 'RS256') {
    throw new TypeError(
      `AwsOAuthBearerConfig: signingAlgorithm must be 'ES384' or 'RS256', got ${JSON.stringify(cfg.signingAlgorithm)}`,
    );
  }
  if (cfg.durationSeconds !== undefined) {
    if (typeof cfg.durationSeconds !== 'number' ||
        !Number.isInteger(cfg.durationSeconds) ||
        cfg.durationSeconds < MIN_DURATION_SECONDS ||
        cfg.durationSeconds > MAX_DURATION_SECONDS) {
      throw new TypeError(
        `AwsOAuthBearerConfig: durationSeconds must be an integer in [${MIN_DURATION_SECONDS}, ${MAX_DURATION_SECONDS}], got ${cfg.durationSeconds}`,
      );
    }
  }
  if (cfg.stsEndpoint !== undefined) {
    if (!isNonEmptyString(cfg.stsEndpoint) || !cfg.stsEndpoint.startsWith('https://')) {
      throw new TypeError(
        `AwsOAuthBearerConfig: stsEndpoint must be a non-empty https:// URL, got ${JSON.stringify(cfg.stsEndpoint)}`,
      );
    }
  }
  if (cfg.credentials !== undefined) {
    const c = cfg.credentials;
    const isProvider = typeof c === 'function';
    const isIdentity = typeof c === 'object' && c !== null &&
      isNonEmptyString((c as AwsCredentialIdentity).accessKeyId) &&
      isNonEmptyString((c as AwsCredentialIdentity).secretAccessKey);
    if (!isProvider && !isIdentity) {
      throw new TypeError(
        'AwsOAuthBearerConfig: credentials must be an AwsCredentialIdentity ({accessKeyId, secretAccessKey}) or an AwsCredentialIdentityProvider function',
      );
    }
  }
}

/**
 * Returns a new config object with defaults applied. Does not mutate the
 * input. Exported for advanced callers; most users won't call this directly.
 */
export function applyDefaults(cfg: AwsOAuthBearerConfig): NormalizedConfig {
  return {
    region: cfg.region,
    audience: cfg.audience,
    signingAlgorithm: cfg.signingAlgorithm ?? DEFAULT_SIGNING_ALGORITHM,
    durationSeconds: cfg.durationSeconds ?? DEFAULT_DURATION_SECONDS,
    stsEndpoint: cfg.stsEndpoint,
    credentials: cfg.credentials,
  };
}

/**
 * Low-level token provider. Wraps an {@link STSClient} and exposes a single
 * {@link AwsStsTokenProvider.token | `token()`} method that calls
 * `sts:GetWebIdentityToken` and shapes the result into an
 * {@link AwsOAuthBearerToken}.
 *
 * Most users should prefer the convenience factories
 * {@link awsOAuthBearerProvider} (KafkaJS API) or
 * {@link awsOAuthBearerTokenRefreshCb} (node-rdkafka API), which wrap this
 * class with the exact shape the Kafka client expects.
 *
 * Credential resolution is lazy — the constructor does not invoke the
 * credential chain. First `token()` call triggers it, so configuration errors
 * surface on first refresh (not at startup).
 *
 * @example
 * ```ts
 * const provider = new AwsStsTokenProvider({
 *   region: 'eu-north-1',
 *   audience: 'https://api.example.com',
 * });
 * const t = await provider.token();
 * console.log(t.value);       // the JWT
 * console.log(t.principal);   // e.g. arn:aws:iam::123:role/my-role
 * ```
 */
export class AwsStsTokenProvider {
  private readonly cfg: NormalizedConfig;
  private readonly sts: STSClient;

  /**
   * @param config  Validated eagerly; throws `TypeError` on bad input.
   * @param stsClient  Optional pre-constructed STS client. Primarily for
   *   tests; production callers should omit this so the provider builds
   *   its own client from {@link AwsOAuthBearerConfig}.
   */
  constructor(config: AwsOAuthBearerConfig, stsClient?: STSClient) {
    validateConfig(config);
    this.cfg = applyDefaults(config);
    this.sts = stsClient ?? new STSClient({
      region: this.cfg.region,
      ...(this.cfg.stsEndpoint !== undefined && { endpoint: this.cfg.stsEndpoint }),
      ...(this.cfg.credentials !== undefined && { credentials: this.cfg.credentials }),
    });
  }

  /**
   * Mints a fresh JWT via `sts:GetWebIdentityToken`. Safe for concurrent use;
   * does not cache (librdkafka drives refresh cadence).
   *
   * @param _oauthbearerConfig  Ignored; accepted so this method can be used
   *   directly as a KafkaJS `oauthBearerProvider` without a wrapper.
   */
  async token(_oauthbearerConfig?: string): Promise<AwsOAuthBearerToken> {
    const out = await this.sts.send(new GetWebIdentityTokenCommand({
      Audience: [this.cfg.audience],
      SigningAlgorithm: this.cfg.signingAlgorithm,
      DurationSeconds: this.cfg.durationSeconds,
    }));

    if (!out.WebIdentityToken || !out.Expiration) {
      throw new Error('sts:GetWebIdentityToken returned empty token or expiration');
    }

    const principal = subFromJwt(out.WebIdentityToken);
    const lifetime = out.Expiration.getTime();

    return {
      value: out.WebIdentityToken,
      tokenValue: out.WebIdentityToken,
      lifetime,
      principal,
    };
  }
}

/**
 * Token shape expected by the KafkaJS-compatible `sasl.oauthBearerProvider`
 * hook (see `lib/kafkajs/_common.js` in the Kafka client). Uses the
 * KafkaJS-native field name `value`.
 */
export interface KafkaJsOAuthToken {
  value: string;
  lifetime: number;
  principal: string;
  extensions?: Record<string, string>;
}

/**
 * Token shape expected by the node-rdkafka-compatible
 * `oauthbearer_token_refresh_cb` hook (see `lib/client.js` in the Kafka
 * client). Uses the node-rdkafka-native field name `tokenValue`.
 */
export interface NodeRdKafkaOAuthToken {
  tokenValue: string;
  lifetime: number;
  principal: string;
  extensions?: Record<string, string>;
}

/**
 * KafkaJS-style factory. Returns an async function suitable for passing
 * directly to `sasl.oauthBearerProvider`.
 *
 * @example
 * ```ts
 * const producer = kafka.producer({
 *   kafkaJS: {
 *     brokers: ['...'],
 *     ssl: true,
 *     sasl: {
 *       mechanism: 'oauthbearer',
 *       oauthBearerProvider: awsOAuthBearerProvider({
 *         region: 'eu-north-1',
 *         audience: 'https://api.example.com',
 *       }),
 *     },
 *   },
 * });
 * ```
 */
export function awsOAuthBearerProvider(
  cfg: AwsOAuthBearerConfig,
): (oauthbearerConfig: string) => Promise<KafkaJsOAuthToken> {
  const provider = new AwsStsTokenProvider(cfg);
  return async (oauthbearerConfig: string) => {
    const t = await provider.token(oauthbearerConfig);
    return {
      value: t.value,
      lifetime: t.lifetime,
      principal: t.principal,
    };
  };
}

/**
 * node-rdkafka-style factory. Returns an async function suitable for passing
 * directly to the `oauthbearer_token_refresh_cb` config property.
 *
 * @example
 * ```ts
 * const producer = new Kafka.Producer({
 *   'metadata.broker.list': '...',
 *   'security.protocol': 'SASL_SSL',
 *   'sasl.mechanisms': 'OAUTHBEARER',
 *   'oauthbearer_token_refresh_cb': awsOAuthBearerTokenRefreshCb({
 *     region: 'eu-north-1',
 *     audience: 'https://api.example.com',
 *   }),
 * });
 * ```
 */
export function awsOAuthBearerTokenRefreshCb(
  cfg: AwsOAuthBearerConfig,
): (oauthbearerConfig: string) => Promise<NodeRdKafkaOAuthToken> {
  const provider = new AwsStsTokenProvider(cfg);
  return async (oauthbearerConfig: string) => {
    const t = await provider.token(oauthbearerConfig);
    return {
      tokenValue: t.tokenValue,
      lifetime: t.lifetime,
      principal: t.principal,
    };
  };
}
