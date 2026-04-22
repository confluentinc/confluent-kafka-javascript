# @confluentinc/kafka-javascript-oauthbearer-aws

AWS IAM OAUTHBEARER token provider for
[`@confluentinc/kafka-javascript`](https://www.npmjs.com/package/@confluentinc/kafka-javascript).

Wraps the AWS STS `GetWebIdentityToken` operation (AWS IAM Outbound Identity
Federation, GA 2025-11-19) and feeds the resulting JWT into the Kafka client's
existing OAUTHBEARER refresh hook. Works with both the node-rdkafka-style API
(`oauthbearer_token_refresh_cb`) and the KafkaJS-style API
(`sasl.oauthBearerProvider`).

This package is **opt-in**. A user who installs only
`@confluentinc/kafka-javascript` sees zero `@aws-sdk/*` in `node_modules`.
Install both packages to enable AWS IAM auth.

## Install

```bash
npm install @confluentinc/kafka-javascript \
            @confluentinc/kafka-javascript-oauthbearer-aws
```

Peer dependency: `@confluentinc/kafka-javascript >= 1.9.0`.
Minimum AWS SDK: `@aws-sdk/client-sts >= 3.935.0` (first npm release shipping
`GetWebIdentityTokenCommand`, 2025-11-19). This package pins `^3.975.0` for
alignment with `@confluentinc/schemaregistry`.

## Usage

### KafkaJS-style API

```js
const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;
const { awsOAuthBearerProvider } =
  require('@confluentinc/kafka-javascript-oauthbearer-aws');

const kafka = new Kafka({});
const producer = kafka.producer({
  kafkaJS: {
    brokers: ['broker:9093'],
    ssl: true,
    sasl: {
      mechanism: 'oauthbearer',
      oauthBearerProvider: awsOAuthBearerProvider({
        region: 'eu-north-1',
        audience: 'https://api.example.com',
      }),
    },
  },
});

await producer.connect();
```

### node-rdkafka-style API

```js
const Kafka = require('@confluentinc/kafka-javascript');
const { awsOAuthBearerTokenRefreshCb } =
  require('@confluentinc/kafka-javascript-oauthbearer-aws');

const producer = new Kafka.Producer({
  'metadata.broker.list': 'broker:9093',
  'security.protocol': 'SASL_SSL',
  'sasl.mechanisms': 'OAUTHBEARER',
  'oauthbearer_token_refresh_cb': awsOAuthBearerTokenRefreshCb({
    region: 'eu-north-1',
    audience: 'https://api.example.com',
  }),
});
```

### Full control

If you need direct access to the token (for testing, logging, or custom
event-loop integrations), use the class form:

```js
const { AwsStsTokenProvider } =
  require('@confluentinc/kafka-javascript-oauthbearer-aws');

const provider = new AwsStsTokenProvider({
  region: 'eu-north-1',
  audience: 'https://api.example.com',
});
const token = await provider.token();
// { value, tokenValue, lifetime, principal }
```

## Configuration

| Field | Required | Type | Default | Notes |
|---|---|---|---|---|
| `region` | ✓ | `string` | — | No silent default. Must be explicit. |
| `audience` | ✓ | `string` | — | OIDC audience. Must match the relying party's expected value. |
| `signingAlgorithm` | | `'ES384'` \| `'RS256'` | `'ES384'` | |
| `durationSeconds` | | `number` | `300` | AWS-enforced bounds: `[60, 3600]`. |
| `stsEndpoint` | | `string` | | HTTPS URL override (FIPS / VPC endpoint). |
| `credentials` | | `AwsCredentialIdentity` \| `AwsCredentialIdentityProvider` | default chain | Usually leave unset — the AWS SDK resolves credentials from env / shared config / IMDSv2 / ECS / EKS IRSA / EKS Pod Identity / SSO / profile automatically. |

## IAM prerequisites

1. Account admin runs `aws iam enable-outbound-web-identity-federation` once
   per AWS account. Until this is done, `sts:GetWebIdentityToken` returns a
   dedicated `OutboundWebIdentityFederationNotEnabledException` error.
2. The calling principal (EC2 role, ECS task role, EKS IRSA / Pod Identity,
   SSO, profile, etc.) has `sts:GetWebIdentityToken` permission.
3. The relying party (Confluent Cloud, custom OIDC service) trusts the
   STS-published JWKS for the chosen region.

## Important — do not set `sasl.oauthbearer.method`

This package uses the Kafka client's managed callback path. Setting
`sasl.oauthbearer.method=oidc` (or any other value) selects an alternative
librdkafka-native path and **bypasses this package entirely**. Leave the
property unset.

## How refresh works

librdkafka drives the refresh cadence based on the token's `lifetime`:

- On first connect, it invokes the callback to mint a token.
- Near expiration, it invokes the callback again for a fresh token.
- On failure, it retries after a short backoff.

No `setInterval` / timer logic is required in user code. The refresh hook
runs on librdkafka's background thread, not the Node event loop; `async`
callbacks work transparently.

## See also

- [`DESIGN_AWS_OAUTHBEARER.md`](../DESIGN_AWS_OAUTHBEARER.md) — full design rationale, rejected alternatives, cross-language references.
- [`IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md`](../IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md) — execution path and milestones.
- Runnable examples: [`examples/node-rdkafka/oauthbearer_aws_iam/`](../examples/node-rdkafka/oauthbearer_aws_iam/), [`examples/kafkajs/oauthbearer_aws_iam/`](../examples/kafkajs/oauthbearer_aws_iam/).

## License

MIT
