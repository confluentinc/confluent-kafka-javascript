// H4 — the cross-package contract called by @confluentinc/kafka-javascript
// core via require() + property access.

import { AwsStsTokenProvider, type AwsOAuthBearerToken } from './provider';
import { parseConfigString } from './config-string-parser';

const SASL_OAUTHBEARER_CONFIG_KEY = 'sasl.oauthbearer.config';

/**
 * Builds an OAUTHBEARER refresh handler from the user's Kafka config dictionary.
 * Called by `@confluentinc/kafka-javascript` core at client construction time
 * via `require('@confluentinc/kafka-javascript-oauthbearer-aws').awsAutoWire.createHandler(...)`.
 *
 * **Signature is FROZEN.** Any change to the parameter or return shape is a
 * breaking change to the cross-package contract and requires a major version
 * bump on this package. The frozen-signature test in `test/contract.test.ts`
 * guards against accidental changes.
 *
 * Construction-time work:
 *   1. Reads `kafkaConfig['sasl.oauthbearer.config']` (must be a non-empty
 *      string; throws TypeError otherwise).
 *   2. Parses the wire-grammar string into a typed AwsOAuthBearerConfig
 *      ({@link parseConfigString}).
 *   3. Constructs an {@link AwsStsTokenProvider} (which calls
 *      {@link validateConfig} + {@link applyDefaults} eagerly).
 *
 * Returned closure:
 *   - Captures the provider instance (one provider per `createHandler` call).
 *   - Each invocation calls `provider.token()` and returns the resulting
 *     {@link AwsOAuthBearerToken}.
 *   - Forwards the librdkafka-supplied per-call `oauthbearerConfig` string to
 *     `provider.token()` for interface completeness, even though the
 *     provider currently does not use it (the wire-grammar string is parsed
 *     once at construction time, not per-call).
 *
 * @param kafkaConfig  The full client config dictionary. Loose
 *   `Record<string, unknown>` typing because JS Kafka configs hold mixed
 *   types (strings, booleans, numbers, functions). This function only reads
 *   the `sasl.oauthbearer.config` key.
 * @returns An async function suitable for installation as
 *   `oauthbearer_token_refresh_cb`. Resolves to {@link AwsOAuthBearerToken}.
 *
 * @throws TypeError on `sasl.oauthbearer.config` shape errors (missing,
 *   empty, wrong type) or grammar errors (from {@link parseConfigString})
 *   or semantic errors (from {@link validateConfig}).
 * @throws Error on AWS SDK reachability or initialisation failures.
 */
export function createHandler(
  kafkaConfig: Record<string, unknown>,
): (oauthbearerConfig: string) => Promise<AwsOAuthBearerToken> {
  const raw = kafkaConfig[SASL_OAUTHBEARER_CONFIG_KEY];
  if (typeof raw !== 'string') {
    throw new TypeError(
      `awsAutoWire.createHandler: '${SASL_OAUTHBEARER_CONFIG_KEY}' is required ` +
      `and must be a string, got ${typeof raw}`,
    );
  }
  if (raw.length === 0) {
    throw new TypeError(
      `awsAutoWire.createHandler: '${SASL_OAUTHBEARER_CONFIG_KEY}' is empty`,
    );
  }

  // Parse + validate at construction time. Errors surface here, not on the
  // first token refresh — gives users a clear startup failure rather than a
  // delayed-error mystery.
  const cfg = parseConfigString(raw);
  const provider = new AwsStsTokenProvider(cfg);

  return (oauthbearerConfig: string) => provider.token(oauthbearerConfig);
}
