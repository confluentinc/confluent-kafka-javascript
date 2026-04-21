# Design: AWS STS `GetWebIdentityToken` OAUTHBEARER Provider — JavaScript

**Status:** Draft — pending AWS SDK floor verification and first implementation
**Owner:** prashah@confluent.io
**Last updated:** 2026-04-21

## 1. Context

AWS shipped **IAM Outbound Identity Federation** (GA 2025-11-19), exposing a new STS API, `GetWebIdentityToken`. AWS principals mint short-lived OIDC JWTs that external OIDC-compatible services (e.g. Confluent Cloud) verify against an AWS-hosted JWKS. AWS is the OIDC IdP; the external service is the relying party.

Confluent customers running Kafka clients on AWS (EC2, EKS, ECS/Fargate, Lambda) want to authenticate to OIDC-gated Kafka endpoints using their AWS identity, without long-lived secrets.

A parallel effort in librdkafka implements this in C (reachable from every Confluent Kafka client). This document describes the **complementary JavaScript-managed integration** — a new optional npm package — that lets users ship today without upgrading the bundled librdkafka, and that leverages the AWS SDK for JavaScript v3's mature credential chain (env / shared config / IMDSv2 / ECS / EKS IRSA / EKS Pod Identity / SSO).

Sibling designs live at:

- [confluent-kafka-go/DESIGN_AWS_OAUTHBEARER.md](../confluent-kafka-go/DESIGN_AWS_OAUTHBEARER.md) — separate Go submodule
- [confluent-kafka-dotnet/DESIGN_AWS_OAUTHBEARER.md](../confluent-kafka-dotnet/DESIGN_AWS_OAUTHBEARER.md) — separate NuGet
- [confluent-kafka-python/DESIGN_AWS_OAUTHBEARER.md](../confluent-kafka-python/DESIGN_AWS_OAUTHBEARER.md) — PyPI extra on the single distribution

This JS doc mirrors Go/.NET (separate publishable unit); Python's "extras inside one dist" shape does not translate to npm.

## 2. Decision

Add a new **optional, separately-published npm package** as a third workspace in this monorepo:

```
oauthbearer-aws/    →    npm: @confluentinc/kafka-javascript-oauthbearer-aws
```

It wraps `@aws-sdk/client-sts` to call `sts:GetWebIdentityToken` and returns a token shaped for the existing OAUTHBEARER refresh hook. Users plug it into their `Producer` / `KafkaConsumer` / `AdminClient` (node-rdkafka style) or `kafka.producer()` / `.consumer()` (KafkaJS style) with one line.

The new package declares `@aws-sdk/client-sts` and `@aws-sdk/credential-providers` as direct dependencies, and declares `@confluentinc/kafka-javascript` as a **peerDependency** — it reuses the Kafka core the user already has installed rather than bundling a second copy.

**Users who never install this package see zero change to the `@confluentinc/kafka-javascript` dependency graph.** The root [package.json](package.json) is not modified.

This mirrors the separate-package shape already in the repo for [schemaregistry/](schemaregistry/) (`@confluentinc/schemaregistry`), refined in two ways:

1. **Per-cloud**, not a cloud monolith. `schemaregistry` bundles `@aws-sdk/client-kms` + `@azure/*` + `@google-cloud/kms` + `node-vault` as hard deps — the same monolithic shape the Python team has flagged as legacy. OAUTHBEARER does not inherit that.
2. **peerDependency** on core instead of soft coupling. `schemaregistry` is Kafka-agnostic (core is only in `devDependencies` for e2e); this package by definition needs the Kafka client at runtime, so it declares it as a peer.

## 3. Rejected alternatives

### 3a. Add `@aws-sdk/client-sts` as a dependency of `@confluentinc/kafka-javascript`

Would force the AWS SDK into every downstream user's `node_modules`, `package-lock.json`, and SBOM. The current property — a bare `npm i @confluentinc/kafka-javascript` installs zero `@aws-sdk/*` — is worth preserving. Matches the Go `go mod why` and .NET `packages.lock.json` rationale in the sibling docs.

### 3b. Bundle into `@confluentinc/schemaregistry`

`schemaregistry` already carries every cloud KMS SDK as hard deps. Adding STS would deepen the monolith. OAUTHBEARER is orthogonal to serde/SR — users want one without the other.

### 3c. Soft opt-in via `peerDependenciesMeta.optional: true` + runtime `require('@aws-sdk/...')` guard

Keep everything in core; only load the AWS SDK if the user configures AWS OAUTHBEARER. Rejected:

- Fails at **runtime** (first token refresh) instead of **install time**. A missing peer dep is easy to miss in CI.
- Requires defensive `try { require(...) } catch` blocks in core — convention in this repo (see [schemaregistry/rules/encryption/awskms/aws-driver.ts:4](schemaregistry/rules/encryption/awskms/aws-driver.ts#L4)) is unconditional top-level imports.
- Doesn't reduce install-time footprint anyway; npm resolves optional peers unless explicitly skipped.

### 3d. librdkafka-native path only

Relies on the parallel librdkafka C work (`sasl.oauthbearer.method=aws_sts_web_identity`) landing and users bumping the bundled librdkafka (currently `2.14.0`, per `librdkafka` field in [package.json:5](package.json#L5)). Users who can't bump, or who want the AWS SDK's credential chain (role chaining, SSO), get nothing. Both paths should coexist — this doc covers the managed one.

## 4. Verification performed (2026-04-21)

### 4a. Existing OAUTHBEARER refresh hook is sufficient

Both APIs (node-rdkafka style and KafkaJS style) converge on the same internal plumbing in [lib/client.js:135-182](lib/client.js#L135-L182). The callback handler:

- Accepts a sync-callback style `(config, cb) => cb(err, token)`, OR
- A Promise-returning async function `(config) => Promise<token>` — detected at [lib/client.js:174](lib/client.js#L174).

An `async` provider works in both cases. The token shape expected is `{ tokenValue, lifetime, principal, extensions? }` at the node-rdkafka boundary; the KafkaJS wrapper at [lib/kafkajs/_common.js:318-350](lib/kafkajs/_common.js#L318-L350) translates from `{ value, ... }` to `{ tokenValue, ... }`.

All three client classes (`Producer`, `KafkaConsumer`, `AdminClient`) accept `oauthbearer_token_refresh_cb` via the common `Client` base, so a single provider works for all three.

Existing hand-rolled examples to mirror:

- [examples/node-rdkafka/oauthbearer_callback_authentication/oauthbearer_callback_authentication.js](examples/node-rdkafka/oauthbearer_callback_authentication/oauthbearer_callback_authentication.js)
- [examples/kafkajs/oauthbearer_calback_authentication/oauthbearer_callback_authentication.js](examples/kafkajs/oauthbearer_calback_authentication/oauthbearer_callback_authentication.js)

### 4b. AWS SDK v3 precedent already in repo

`schemaregistry` is on `@aws-sdk/client-kms ^3.975.0` and `@aws-sdk/credential-providers ^3.975.0` (see [schemaregistry/package.json:32-33](schemaregistry/package.json#L32-L33)). `fromIni` / `fromTemporaryCredentials` usage at [schemaregistry/rules/encryption/awskms/aws-driver.ts:1-4](schemaregistry/rules/encryption/awskms/aws-driver.ts#L1-L4). New package should pin the same major to avoid peer-dep fan-out when users install both.

### 4c. Workspace precedent

[package.json:63-67](package.json#L63-L67) already declares `workspaces: [".", "schemaregistry", "schemaregistry-examples"]`. Adding a fourth workspace entry is a one-line change; no root-level tooling changes required.

### 4d. `GetWebIdentityTokenCommand` in AWS SDK JS v3 — **pending verification**

`@aws-sdk/client-sts` is the v3 service client. The operation went GA 2025-11-19 across AWS SDKs; Python confirmed `boto3>=1.42.25` (2026-01-12), Go confirmed `aws-sdk-go-v2/service/sts >= v1.41.0`, .NET confirmed `AWSSDK.SecurityToken >= 3.7.503.2` (all same-day-or-later ship). The JS v3 floor needs the same bisection against `aws/aws-sdk-js-v3` — likely a client-sts release from late November 2025 or later. Since `schemaregistry` already floors at `^3.975.0` (Feb 2026), any reasonable floor is comfortably below the existing pin; confirming at implementation time is low-risk. See §11 open item 1.

## 5. Architecture

### 5a. Directory layout

```
confluent-kafka-javascript/
├── package.json                    ← add "oauthbearer-aws" to workspaces
├── lib/                            ← unchanged; existing hooks consumed as-is
├── schemaregistry/                 ← unchanged
└── oauthbearer-aws/                ← NEW workspace
    ├── package.json                ← new; see §5b
    ├── tsconfig.json
    ├── tsconfig-build.json         ← mirror schemaregistry pattern
    ├── Makefile                    ← lint + test targets
    ├── README.md
    ├── LICENSE.txt
    ├── index.ts                    ← public re-exports
    ├── provider.ts                 ← AwsStsTokenProvider, awsOAuthBearerProvider
    ├── jwt.ts                      ← ~15-LoC sub-claim extractor
    ├── test/
    │   ├── provider.test.ts        ← unit; mocked STS client
    │   └── jwt.test.ts
    └── e2e/
        └── provider-real.e2e.ts    ← opt-in (RUN_AWS_STS_REAL=1)
```

### 5b. `oauthbearer-aws/package.json`

```jsonc
{
  "name": "@confluentinc/kafka-javascript-oauthbearer-aws",
  "version": "1.9.0",                     // lockstep with root
  "description": "AWS IAM OAUTHBEARER provider for @confluentinc/kafka-javascript",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["LICENSE.txt", "dist/"],
  "peerDependencies": {
    "@confluentinc/kafka-javascript": "^1.9.0"
  },
  "dependencies": {
    "@aws-sdk/client-sts": "^3.975.0",        // floor TBD (§11.1)
    "@aws-sdk/credential-providers": "^3.975.0"
  },
  "devDependencies": {
    "@confluentinc/kafka-javascript": "file:..",
    "@types/node": "^20.16.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.9.2"
  },
  "scripts": {
    "lint": "make lint",
    "test": "make test",
    "build": "rm -rf ./dist && tsc -p tsconfig-build.json"
  },
  "keywords": ["kafka", "oauthbearer", "aws", "iam", "sts"],
  "repository": {
    "type": "git",
    "url": "git@github.com:confluentinc/confluent-kafka-javascript.git"
  },
  "license": "MIT"
}
```

### 5c. Public API surface (TypeScript)

```ts
// index.ts
export {
  AwsOAuthBearerConfig,
  AwsStsTokenProvider,
  AwsOAuthBearerToken,
  awsOAuthBearerProvider,
  awsOAuthBearerTokenRefreshCb,
} from './provider';
```

```ts
// provider.ts
export interface AwsOAuthBearerConfig {
  region: string;                      // required; no default — fail loudly
  audience: string;                    // required
  signingAlgorithm?: 'ES384' | 'RS256'; // default 'ES384'
  durationSeconds?: number;            // 60-3600; default 300
  stsEndpoint?: string;                // optional override (FIPS, VPC endpoint)

  // Optional credential injection. If absent, the AWS SDK's default credential
  // provider chain is used (env → shared config → web identity → ECS → IMDS).
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
}

// Token returned to the refresh hook. Both shapes exist only because
// node-rdkafka expects `tokenValue` and KafkaJS expects `value`.
export interface AwsOAuthBearerToken {
  value: string;
  tokenValue: string;   // alias of value for node-rdkafka callers
  lifetime: number;     // ms since epoch
  principal: string;    // JWT 'sub' claim (bare role ARN)
  extensions?: Record<string, string>;
}

// Full-control provider. Safe for concurrent use.
export class AwsStsTokenProvider {
  constructor(cfg: AwsOAuthBearerConfig);
  token(oauthbearer_config?: string): Promise<AwsOAuthBearerToken>;
}

// Convenience: KafkaJS-shape provider. Drops directly into `sasl.oauthBearerProvider`.
export function awsOAuthBearerProvider(
  cfg: AwsOAuthBearerConfig,
): (oauthbearer_config: string) => Promise<{
  value: string;
  lifetime: number;
  principal: string;
  extensions?: Record<string, string>;
}>;

// Convenience: node-rdkafka-shape provider. Drops directly into
// `oauthbearer_token_refresh_cb`.
export function awsOAuthBearerTokenRefreshCb(
  cfg: AwsOAuthBearerConfig,
): (oauthbearer_config: string) => Promise<{
  tokenValue: string;
  lifetime: number;
  principal: string;
  extensions?: Record<string, string>;
}>;
```

API shape deliberately mirrors the Go / .NET / Python siblings so cross-language docs stay small and users translating from one to another have no surprises.

### 5d. `AwsStsTokenProvider.token()` internal flow

```ts
async token(_: string): Promise<AwsOAuthBearerToken> {
  const out = await this.sts.send(new GetWebIdentityTokenCommand({
    Audience: [this.cfg.audience],
    SigningAlgorithm: this.cfg.signingAlgorithm ?? 'ES384',
    DurationSeconds: this.cfg.durationSeconds ?? 300,
  }));

  if (!out.WebIdentityToken || !out.Expiration) {
    throw new Error('sts:GetWebIdentityToken returned empty token');
  }

  const principal = subFromJwt(out.WebIdentityToken);   // ~15 LoC, no new dep
  const lifetime  = out.Expiration.getTime();           // SDK parses RFC3339

  return {
    value: out.WebIdentityToken,
    tokenValue: out.WebIdentityToken,
    lifetime,
    principal,
  };
}
```

All heavy lifting — SigV4 signing, credential chain resolution, XML protocol, retries — delegates to `@aws-sdk/client-sts`. The provider itself is <100 LoC.

### 5e. JWT handling

`sub` claim (bare role ARN per live STS responses) is used for `principal`. Extraction is a small base64url + `JSON.parse` helper in `jwt.ts`; no `jsonwebtoken` / `jose` dep. Verification is unnecessary — AWS signed it, and `principal` is only used client-side for log identification.

## 6. User-side integration

### 6a. Install

```bash
npm install @confluentinc/kafka-javascript @confluentinc/kafka-javascript-oauthbearer-aws
```

(Users who install only `@confluentinc/kafka-javascript` get zero AWS SDK in their `node_modules`.)

### 6b. node-rdkafka style

```js
const Kafka = require('@confluentinc/kafka-javascript');
const { awsOAuthBearerTokenRefreshCb }
  = require('@confluentinc/kafka-javascript-oauthbearer-aws');

const producer = new Kafka.Producer({
  'metadata.broker.list': 'broker:9093',
  'security.protocol':    'SASL_SSL',
  'sasl.mechanisms':      'OAUTHBEARER',
  'oauthbearer_token_refresh_cb': awsOAuthBearerTokenRefreshCb({
    region:   'eu-north-1',
    audience: 'https://confluent.cloud/oidc',
  }),
});

producer.connect();
```

### 6c. KafkaJS style

```js
const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;
const { awsOAuthBearerProvider }
  = require('@confluentinc/kafka-javascript-oauthbearer-aws');

const kafka    = new Kafka({});
const producer = kafka.producer({
  kafkaJS: {
    brokers: ['broker:9093'],
    sasl: {
      mechanism:          'oauthbearer',
      oauthBearerProvider: awsOAuthBearerProvider({
        region:   'eu-north-1',
        audience: 'https://confluent.cloud/oidc',
      }),
    },
    ssl: true,
  },
});

await producer.connect();
```

librdkafka drives the refresh cadence: it invokes the callback based on token expiration, and on failure re-invokes after a short backoff. No `setInterval` or timer logic in user code.

## 7. Local development — npm workspaces

Root [package.json:63-67](package.json#L63-L67) already uses npm workspaces. One change:

```jsonc
"workspaces": [
  ".",
  "schemaregistry",
  "schemaregistry-examples",
  "oauthbearer-aws"             // NEW
]
```

From the repo root, `npm install` symlinks `oauthbearer-aws/node_modules/@confluentinc/kafka-javascript` to the local root package (identical to how `schemaregistry` resolves core today via `"@confluentinc/kafka-javascript": "file:.."` in its `devDependencies`). Local changes to `lib/` are visible in the submodule's tests immediately.

At publish time, the workspace symlink is replaced by the real `peerDependency` resolution — consumers install `@confluentinc/kafka-javascript@^1.9.0` from the registry. npm handles this transparently; no `replace`-directive equivalent needed.

## 8. Release and versioning policy

**Policy:** lockstep version with the root package.

- Root bumps `1.9.0 → 1.10.0` → submodule bumps `1.9.0 → 1.10.0` in the same PR.
- `peerDependencies` constraint in submodule's package.json updates to `^1.10.0`.
- `schemaregistry` already follows this pattern (currently `1.9.0`, matching root `1.9.0`) — copy its release-script handling.
- Users always know which pair is compatible without a compatibility matrix.

[ci/prepublish.js](ci/prepublish.js) and the existing npm publish flow should be updated to publish the new package alongside the others at release time. See §11 open item 4.

Independent semver (e.g. submodule at `0.1.0` while core is `1.9.0`) was considered and rejected — consistency with `schemaregistry` outweighs submodule autonomy.

## 9. Testing strategy

Three layers, mirroring Go/.NET/Python:

1. **Unit** (`test/provider.test.ts`) — mock `STSClient.prototype.send` via `jest.spyOn` or inject a mocked client through `AwsOAuthBearerConfig.credentials` + a test-only STS client constructor arg. Assert request shape (`Audience`, `SigningAlgorithm`, `DurationSeconds`) and token transformation (WebIdentityToken → `value`/`tokenValue`, Expiration → `lifetime` ms).
2. **JWT extractor** (`test/jwt.test.ts`) — fixtures for role ARN, assumed-role ARN, missing `sub`, malformed base64, oversized tokens.
3. **Integration (opt-in)** (`e2e/provider-real.e2e.ts`) — gated on `RUN_AWS_STS_REAL=1`, runs against real STS with whatever credentials the default chain finds. Off by default in CI; runs on the same EC2 box used by the Go integration test.

The existing repo-wide test harness ([jest.config.js](jest.config.js)) already iterates workspaces — the new workspace's tests are picked up automatically once added.

## 10. Operational notes

- **Region must be explicit.** No silent default, no IMDS sniffing. Misconfigured region is a startup error. (Matches the librdkafka-side decision and the Go/.NET/Python siblings.)
- **`durationSeconds` bounds:** 60–3600 (AWS-enforced). Default 300.
- **Enablement prerequisite:** the AWS account must have called `iam:EnableOutboundWebIdentityFederation` once. First `GetWebIdentityToken` on an un-enabled account returns a distinct error — surfaced verbatim to `setOAuthBearerTokenFailure` and then as an `'error'` event (see [lib/client.js:165-166](lib/client.js#L165-L166)).
- **FIPS / VPC endpoints:** supported via `AwsOAuthBearerConfig.stsEndpoint`.
- **Lambda:** default credential chain picks up Lambda's injected env vars. Execution role needs `sts:GetWebIdentityToken`. VPC-bound Lambdas need egress to the STS regional endpoint.
- **Do not set `sasl.oauthbearer.method`** in user config. That selects the librdkafka-native path and bypasses this callback entirely. README + examples must call this out (universal rule across all four language docs).
- **Async cold-start.** First `token()` call resolves credentials via the SDK chain — on IMDS-only hosts, expect ~50–300 ms. librdkafka calls the refresh hook on its own thread, not the main event loop, so this does not block user code.

## 11. Open items

1. **AWS SDK JS v3 floor for `GetWebIdentityTokenCommand`.** Bisect against `aws/aws-sdk-js-v3` to find the first `@aws-sdk/client-sts` version shipping the command. Likely a late-November 2025 release; since [schemaregistry/package.json](schemaregistry/package.json) already floors at `^3.975.0` (Feb 2026), keeping the new package at the same floor is safe and avoids peer-dep fan-out for users installing both.
2. **Package naming.** Current proposal: `@confluentinc/kafka-javascript-oauthbearer-aws`. Alternatives: `@confluentinc/kafka-javascript-aws-iam`, `@confluentinc/kafka-oauthbearer-aws`. Naming is locked by first publish — decide before v1. Leaning on the current proposal for symmetry with `@confluentinc/schemaregistry`.
3. **Eager vs lazy credential resolution in the constructor.** Eager surfaces misconfiguration at startup; lazy avoids a cold-start cost until first refresh. Go/.NET/Python all lean eager. Align.
4. **Release automation.** [ci/prepublish.js](ci/prepublish.js) and downstream npm publish tasks need to know about the new package. Audit and update.
5. **CHANGELOG + README + MIGRATION.md updates.** New top-level "Optional integrations" section pointing at the npm package, and a `CHANGELOG.md` entry at first release.
6. **TypeScript `exports` map.** Decide whether to expose the provider via a single default export, a named export, or both. Matches the ergonomics question already settled in `schemaregistry`.

## 12. References

- AWS IAM Outbound Identity Federation announcement (2025-11-19).
- AWS SDK for JavaScript v3 — `@aws-sdk/client-sts`.
- Go-side design: `confluent-kafka-go/DESIGN_AWS_OAUTHBEARER.md`.
- .NET-side design: `confluent-kafka-dotnet/DESIGN_AWS_OAUTHBEARER.md`.
- Python-side design: `confluent-kafka-python/DESIGN_AWS_OAUTHBEARER.md`.
- librdkafka-native design: `librdkafka` repo, `DESIGN_AWS_OAUTHBEARER_V1.md`.
- [lib/client.js:135-182](lib/client.js#L135-L182) — existing OAUTHBEARER hook wrapping for node-rdkafka API.
- [lib/kafkajs/_common.js:310-351](lib/kafkajs/_common.js#L310-L351) — KafkaJS → node-rdkafka translation for `oauthBearerProvider`.
- [examples/node-rdkafka/oauthbearer_callback_authentication/oauthbearer_callback_authentication.js](examples/node-rdkafka/oauthbearer_callback_authentication/oauthbearer_callback_authentication.js) — existing hand-rolled oauth example (node-rdkafka API).
- [examples/kafkajs/oauthbearer_calback_authentication/oauthbearer_callback_authentication.js](examples/kafkajs/oauthbearer_calback_authentication/oauthbearer_callback_authentication.js) — existing hand-rolled oauth example (KafkaJS API).
- [schemaregistry/package.json](schemaregistry/package.json), [schemaregistry/rules/encryption/awskms/aws-driver.ts](schemaregistry/rules/encryption/awskms/aws-driver.ts) — in-repo AWS SDK v3 precedent.
