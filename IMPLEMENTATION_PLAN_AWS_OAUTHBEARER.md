# Implementation Plan: AWS OAUTHBEARER npm Package

**Companion document to** [DESIGN_AWS_OAUTHBEARER.md](DESIGN_AWS_OAUTHBEARER.md).
**Status:** Draft — ready to execute. No code written yet.
**Last updated:** 2026-04-22.

This document describes the execution path. For design rationale, public API shape, and rejected alternatives, see the design doc.

## Locked decisions

| Decision | Value |
|---|---|
| npm package name | `@confluentinc/kafka-javascript-oauthbearer-aws` |
| Workspace directory | [oauthbearer-aws/](oauthbearer-aws/) |
| Test directory | `oauthbearer-aws/test/` (unit, jest) + `oauthbearer-aws/e2e/` (real-AWS, opt-in) |
| Source language | TypeScript → `dist/` via `tsc -p tsconfig-build.json`. Matches [schemaregistry/](schemaregistry/) build shape. |
| Node targets | `>=18.0.0` (matches root [package.json:60-62](package.json#L60-L62)) |
| AWS SDK line | v3. `@aws-sdk/client-sts` + `@aws-sdk/credential-providers`. |
| AWS SDK floor | `@aws-sdk/client-sts >= 3.975.0` — same major as [schemaregistry/package.json:32-33](schemaregistry/package.json#L32-L33). Exact floor with `GetWebIdentityTokenCommand` bisected at M1 (see gate below). |
| Credential resolution | **Lazy** — construct `STSClient` cheaply, resolve on first `token()` call. Matches AWS SDK convention across .NET / Go / Python / JS. |
| Dependency on core | `peerDependencies` (not `dependencies`) — reuses the user's `@confluentinc/kafka-javascript` install rather than bundling a second copy. `devDependencies: "@confluentinc/kafka-javascript": "file:.."` for local dev (same shape as [schemaregistry/package.json:14](schemaregistry/package.json#L14)). |
| Versioning | Lockstep with root `version` field in [package.json:3](package.json#L3). Manual bump at each release, matching how `schemaregistry` tracks root today (both `1.9.0`). |
| Public API | `AwsStsTokenProvider` class + two convenience factories (`awsOAuthBearerProvider` for KafkaJS, `awsOAuthBearerTokenRefreshCb` for node-rdkafka). See design §5c. |
| STS mocking lib | `aws-sdk-client-mock` — standard JS-ecosystem mock for `@aws-sdk/client-*`, devDep only. |
| Release target | Deferred — picked at M8. Implementation is unblocked until then. |
| Branch | `dev_prashah_IAM_Javascript_POC` (current). |

## Critical path

```
M1 ──┬─→ M3 ──→ M4 ──→ M5 ──┬─→ M7 ──→ M8
     │                      │
     └─→ M2 (parallel)      └─→ M6 (parallel)
```

**Total effort:** ~4–6 engineer-days. Deliverable in one working week solo, or split between a pair as M1+M2 and M3–M5.

## Non-negotiable gates enforced at every step

1. **Zero-cost-for-non-opt-in preserved.** After every PR, run the dep-graph check (M1 and appendix) against a minimal `@confluentinc/kafka-javascript`-only consumer:
   ```bash
   npm ls --parseable 2>/dev/null | grep -Ei '/@aws-sdk/' && echo LEAKED || echo OK
   find node_modules/@aws-sdk -maxdepth 1 -type d 2>/dev/null | grep -q . && echo LEAKED || echo OK
   ```
   Both must print `OK`. If either prints `LEAKED`, the packaging has regressed — roll the PR back.

2. **No new entry in root [package.json](package.json) `dependencies`.** The new AWS SDK deps live only in [oauthbearer-aws/package.json](oauthbearer-aws/package.json). Touching root `dependencies` invalidates the whole pattern.

3. **Lockstep release discipline.** `@confluentinc/kafka-javascript v1.X.Y` → `@confluentinc/kafka-javascript-oauthbearer-aws v1.X.Y`, always. Enforced by M8 [ci/prepublish.js](ci/prepublish.js) audit and manual `version` bumping in both `package.json` files.

4. **No runtime `try { require('@aws-sdk/...') }` guards anywhere.** Repo convention — see [schemaregistry/rules/encryption/awskms/aws-driver.ts:1-4](schemaregistry/rules/encryption/awskms/aws-driver.ts#L1-L4) — is unconditional top-level imports. A missing peer dep must fail at import time, not hide behind a runtime branch.

5. **Do NOT set `sasl.oauthbearer.method`** anywhere in the new package's code, examples, or docs. That selects the librdkafka-native path and bypasses the callback. Universal rule across all four language siblings — calling it out in the README is mandatory (M6).

---

## M1 — Scaffolding, workspace wiring, and AWS SDK floor bisection

**Estimated effort:** 3–4 hours
**Parallelizable with:** M2
**Blocks:** M3, M4, M5

### Deliverables

- New directory [oauthbearer-aws/](oauthbearer-aws/) with placeholder files (compile-only, no logic):
  - `package.json` per design §5b.
  - `tsconfig.json` — copy of [schemaregistry/tsconfig.json](schemaregistry/tsconfig.json), adjust `include` paths.
  - `tsconfig-build.json` — copy of [schemaregistry/tsconfig-build.json](schemaregistry/tsconfig-build.json).
  - `Makefile` — `lint`, `test`, `build` targets copied from [schemaregistry/Makefile](schemaregistry/Makefile).
  - `LICENSE.txt` — copy of [schemaregistry/LICENSE.txt](schemaregistry/LICENSE.txt).
  - `jest.config.js` — copy of [schemaregistry/jest.config.js](schemaregistry/jest.config.js).
  - `index.ts` — empty, just `export {};`.
  - `provider.ts` — namespace placeholders only (empty `AwsStsTokenProvider` class, empty `awsOAuthBearerProvider`, empty `awsOAuthBearerTokenRefreshCb`).
  - `jwt.ts` — empty `subFromJwt` function.
  - `test/placeholder.test.ts` — one `it.todo(...)` so jest has a target.

- [package.json](package.json) — one-line change: add `"oauthbearer-aws"` to the `workspaces` array.

- [eslint.config.js](eslint.config.js) — verify the new workspace is in scope; extend if needed (check how `schemaregistry` is handled today).

### AWS SDK floor bisection (new, required)

Design §11.1 calls for bisecting `aws/aws-sdk-js-v3` to find the first `@aws-sdk/client-sts` version that ships `GetWebIdentityTokenCommand`. Do it at M1 so we know the exact floor before writing provider code:

```bash
# Find the commit that added GetWebIdentityTokenCommand
gh api repos/aws/aws-sdk-js-v3/commits --paginate \
  --jq '.[] | select(.commit.message | contains("GetWebIdentityToken")) | .sha + " " + .commit.committer.date' \
  | head -20

# Read sdk-versions.json at that commit
gh api 'repos/aws/aws-sdk-js-v3/contents/clients/client-sts/package.json?ref=<SHA>' \
  --jq '.content' | base64 -d | jq '.version'
```

Update [oauthbearer-aws/package.json](oauthbearer-aws/package.json) `dependencies` with the exact floor. If the floor is below `3.975.0` (the schemaregistry pin), still use `^3.975.0` as the effective floor to avoid peer-dep fan-out for users installing both packages. Record the bisection result in [DESIGN_AWS_OAUTHBEARER.md](DESIGN_AWS_OAUTHBEARER.md) §4d (new subsection).

### Dep-graph invariant proof (new, required)

Create a throwaway consumer project **outside** the repo referencing **only** `@confluentinc/kafka-javascript` (via workspace link for now; via published version after M8):

```bash
mkdir /tmp/ckjs-depcheck && cd /tmp/ckjs-depcheck
npm init -y
npm install /path/to/confluent-kafka-javascript  # installs via file: link
echo "const k = require('@confluentinc/kafka-javascript'); console.log('ok');" > test.js
node test.js
```

Run the two-line check:

```bash
npm ls --parseable 2>/dev/null | grep -Ei '/@aws-sdk/' && echo LEAKED || echo OK
find node_modules/@aws-sdk -maxdepth 1 -type d 2>/dev/null | grep -q . && echo LEAKED || echo OK
```

Both must print `OK`. Record the exact terminal output in [DESIGN_AWS_OAUTHBEARER.md](DESIGN_AWS_OAUTHBEARER.md) §4 as new subsection `4e`, dated, alongside the existing evidence.

Repeat with a consumer that also installs `@confluentinc/kafka-javascript-oauthbearer-aws` — both greps **must** print `LEAKED`. Asymmetry is the invariant.

### Exit criteria

- `npm install` at repo root completes cleanly, installs the new workspace as a symlink.
- `npm run build -w @confluentinc/kafka-javascript-oauthbearer-aws` produces `oauthbearer-aws/dist/` with an empty `index.js`.
- `npm test -w @confluentinc/kafka-javascript-oauthbearer-aws` runs (zero real tests, one `it.todo`).
- AWS SDK floor bisected and committed to the design doc §4d.
- Dep-graph invariant proof recorded in design doc §4e.
- `npm pack -w @confluentinc/kafka-javascript-oauthbearer-aws --dry-run` lists only `dist/` + `LICENSE.txt` + `package.json` in the tarball preview.

---

## M2 — JWT `sub` extractor

**Estimated effort:** 2–3 hours
**Parallelizable with:** M1 (fully independent — zero deps beyond Node stdlib)
**Blocks:** M4

### Deliverables

- `oauthbearer-aws/jwt.ts`:
  ```ts
  // Extract the "sub" claim from an unverified JWT payload.
  // AWS already signed this token; verification isn't our job — we just
  // need the claim for OAuthBearerToken.principal.
  export function subFromJwt(jwt: string): string;
  ```
  Implementation: split on `.`, base64url-decode the middle segment (replace `-`/`_` → `+`/`/`, pad with `=` to a multiple of 4, `Buffer.from(..., 'base64').toString('utf8')`), `JSON.parse`, return the `sub` field. Throw `TypeError` with a descriptive message on malformed input or missing claim. Stdlib only — no `jsonwebtoken` / `jose` dep.

- `oauthbearer-aws/test/jwt.test.ts` (jest) covering:
  - Valid role ARN — `arn:aws:iam::123456789012:role/MyRole`.
  - Valid assumed-role ARN — different ARN shape.
  - Missing `sub` claim → throws with actionable message containing `"sub"`.
  - Token with fewer than 3 dot-separated segments → throws.
  - Token with more than 3 segments → throws.
  - Malformed base64url in payload segment → throws.
  - Malformed JSON in decoded payload → throws.
  - Empty string input → throws.
  - Oversized input guard — reject tokens > ~8 KB. Live AWS tokens are ~1.4 KB per the cross-language validation (Go and .NET both observed 1256 bytes); 8 KB is a generous ceiling to bound attacker-controlled allocation.
  - Padded vs unpadded base64url — both decode correctly (AWS emits unpadded; spec allows either).

### Exit criteria

- `npm test -w @confluentinc/kafka-javascript-oauthbearer-aws` green, covering all cases above.
- `subFromJwt` is exported from `jwt.ts` but **not** re-exported from `index.ts` (internal helper; not part of the public API).
- Zero new `dependencies` added.

---

## M3 — `AwsOAuthBearerConfig` + validation

**Estimated effort:** 3–4 hours
**Depends on:** M1
**Blocks:** M4

### Deliverables

- `oauthbearer-aws/provider.ts` — `AwsOAuthBearerConfig` interface per design §5c.
- Internal `validateConfig(cfg)` function (called by `AwsStsTokenProvider` constructor):
  - `region` required (non-null, non-empty string) — no silent default, no IMDS sniffing.
  - `audience` required (non-null, non-empty string).
  - `signingAlgorithm` must be `undefined`, `'ES384'`, or `'RS256'`. Undefined → `'ES384'` via `applyDefaults`.
  - `durationSeconds` — either `undefined` (→ 300 via `applyDefaults`) or in `[60, 3600]`.
  - `stsEndpoint` — if set, must be a non-empty string starting with `https://`.
  - `credentials` — if set, must be either an `AwsCredentialIdentity` object (with `accessKeyId` + `secretAccessKey`) or a function (credential provider). Typed at compile time via imports from `@aws-sdk/types` / `@smithy/types`.
  - Throws `TypeError` with a clear message naming the bad field.
- Internal `applyDefaults(cfg)` — returns a new config object with defaults filled. Leaves input untouched (functional style).
- No network, no AWS SDK calls in this module outside the constructor path.

### Tests (`oauthbearer-aws/test/config.test.ts`)

- Validation failures:
  - Missing `region` → `TypeError` containing `"region"`.
  - Empty `region` → same.
  - Missing `audience` → `TypeError` containing `"audience"`.
  - `signingAlgorithm: 'HS256'` → rejected.
  - `durationSeconds: 30` → rejected.
  - `durationSeconds: 7200` → rejected.
  - `stsEndpoint: 'http://insecure.example.com'` → rejected (must be `https://`).
- Defaults applied:
  - Unset `signingAlgorithm` after `applyDefaults` → `'ES384'`.
  - Unset `durationSeconds` after `applyDefaults` → `300`.

### Exit criteria

- All tests pass.
- Validation throws synchronously; no async, no network.
- TypeScript strict mode clean — `npm run build` produces no errors or warnings.

---

## M4 — `AwsStsTokenProvider` + STS mocking

**Estimated effort:** 1–1.5 engineer-days
**Depends on:** M2, M3
**Blocks:** M5, M7

### Deliverables

- `oauthbearer-aws/provider.ts` — `AwsStsTokenProvider` class per design §5c/§5d:
  ```ts
  import { STSClient, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';
  import { subFromJwt } from './jwt';

  export class AwsStsTokenProvider {
    private readonly cfg: Required<AwsOAuthBearerConfig>;
    private readonly sts: STSClient;

    constructor(config: AwsOAuthBearerConfig) {
      validateConfig(config);
      this.cfg = applyDefaults(config);
      this.sts = new STSClient({
        region: this.cfg.region,
        endpoint: this.cfg.stsEndpoint,
        credentials: this.cfg.credentials,
      });
    }

    async token(_oauthbearerConfig?: string): Promise<AwsOAuthBearerToken> {
      const out = await this.sts.send(new GetWebIdentityTokenCommand({
        Audience:         [this.cfg.audience],
        SigningAlgorithm: this.cfg.signingAlgorithm,
        DurationSeconds:  this.cfg.durationSeconds,
      }));

      if (!out.WebIdentityToken || !out.Expiration) {
        throw new Error('sts:GetWebIdentityToken returned empty token or expiration');
      }

      const principal = subFromJwt(out.WebIdentityToken);
      const lifetime  = out.Expiration.getTime();

      return {
        value:      out.WebIdentityToken,
        tokenValue: out.WebIdentityToken,
        lifetime,
        principal,
      };
    }

    // No explicit close() — @aws-sdk/client-sts clients are GC-safe; no persistent sockets.
  }
  ```
- **No eager credential resolution.** `STSClient` constructor does not invoke the credential chain; first `token()` call triggers it. Matches Go/.NET lazy decision.

### Tests (`oauthbearer-aws/test/provider.test.ts`) — with `aws-sdk-client-mock`

Add `aws-sdk-client-mock` and `aws-sdk-client-mock-jest` to `oauthbearer-aws/package.json` `devDependencies`.

Pattern:
```ts
import { mockClient } from 'aws-sdk-client-mock';
import { STSClient, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';
const stsMock = mockClient(STSClient);
beforeEach(() => stsMock.reset());
```

Request-capture cases — assert the outgoing `GetWebIdentityTokenCommand` input:

- **Audience passthrough:** `cfg.audience = 'https://foo'` → captured input `Audience[0] === 'https://foo'`, `Audience.length === 1`.
- **SigningAlgorithm passthrough:** `cfg.signingAlgorithm = 'RS256'` → captured input `SigningAlgorithm === 'RS256'`.
- **Default SigningAlgorithm:** unset → captured input `SigningAlgorithm === 'ES384'`.
- **DurationSeconds passthrough:** `cfg.durationSeconds = 900` → captured input `DurationSeconds === 900`.
- **Default DurationSeconds:** unset → captured input `DurationSeconds === 300`.

Response-mapping cases — assert the returned `AwsOAuthBearerToken`:

- **Happy path:** mock returns `WebIdentityToken: <valid 3-segment JWT with sub=arn:aws:iam::123:role/R>`, `Expiration: new Date('2026-04-21T06:06:47.641Z')`. Assert:
  - `value` === the JWT string.
  - `tokenValue` === `value` (same string).
  - `lifetime` === `Date.parse('2026-04-21T06:06:47.641Z')`.
  - `principal` === `'arn:aws:iam::123:role/R'`.
- **Null `Expiration`:** mock returns `Expiration: undefined` → `Error` mentioning "empty token or expiration".
- **Null `WebIdentityToken`:** same.
- **Malformed JWT:** `WebIdentityToken: 'not-a-jwt'` → `TypeError` from `subFromJwt` propagates (provider does not swallow; the shim layer in M5 does — that's where `setOAuthBearerTokenFailure` is called).
- **STS exception (AccessDenied):** mock rejects with an error having `name: 'AccessDeniedException'`. Provider re-throws as-is. Test asserts `error.name === 'AccessDeniedException'`.
- **STS exception (OutboundWebIdentityFederationNotEnabled):** same pattern; distinct error name. Asserts full error-name string reaches the caller.

Construction cases:

- **Lazy creds:** construct provider with `credentials: async () => { throw new Error('should not be called'); }`. Assert construction succeeds and the provider function is not invoked. First `token()` call would trigger it.
- **Config validation runs in constructor:** `new AwsStsTokenProvider({ audience: '...' })` (missing `region`) → `TypeError`, before any `STSClient` instantiation.

### Exit criteria

- All tests pass.
- No real AWS calls anywhere in `oauthbearer-aws/test/`.
- TypeScript strict build green.
- Outgoing `GetWebIdentityTokenCommand` input shape matches AWS wire expectations per the cross-language probe work (`Audience`/`SigningAlgorithm`/`DurationSeconds` named fields — SDK marshals to the AWS query form).

---

## M5 — Convenience factories + client-shim behavior

**Estimated effort:** 3–4 hours
**Depends on:** M4
**Blocks:** M7

### Deliverables

- `oauthbearer-aws/provider.ts` — two named exports:
  ```ts
  // KafkaJS-style. Drops into `sasl.oauthBearerProvider`.
  export function awsOAuthBearerProvider(
    cfg: AwsOAuthBearerConfig,
  ): (oauthbearerConfig: string) => Promise<{
    value: string;
    lifetime: number;
    principal: string;
    extensions?: Record<string, string>;
  }> {
    const provider = new AwsStsTokenProvider(cfg);
    return async (oauthbearerConfig: string) => {
      const t = await provider.token(oauthbearerConfig);
      return {
        value:     t.value,
        lifetime:  t.lifetime,
        principal: t.principal,
      };
    };
  }

  // node-rdkafka-style. Drops into `oauthbearer_token_refresh_cb`.
  // Returns an async function (no callback arg) — client.js:174 detects
  // the returned Promise and handles both the success and error path.
  export function awsOAuthBearerTokenRefreshCb(
    cfg: AwsOAuthBearerConfig,
  ): (oauthbearerConfig: string) => Promise<{
    tokenValue: string;
    lifetime: number;
    principal: string;
    extensions?: Record<string, string>;
  }> {
    const provider = new AwsStsTokenProvider(cfg);
    return async (oauthbearerConfig: string) => {
      const t = await provider.token(oauthbearerConfig);
      return {
        tokenValue: t.tokenValue,
        lifetime:   t.lifetime,
        principal:  t.principal,
      };
    };
  }
  ```

- `oauthbearer-aws/index.ts` — public surface:
  ```ts
  export {
    AwsOAuthBearerConfig,
    AwsStsTokenProvider,
    AwsOAuthBearerToken,
    awsOAuthBearerProvider,
    awsOAuthBearerTokenRefreshCb,
  } from './provider';
  ```

### Tests (`oauthbearer-aws/test/factories.test.ts`)

- **KafkaJS factory — happy path:** `aws-sdk-client-mock` returns canned JWT; invoke the returned function with a fake `oauthbearerConfig` string; assert the resolved value has `value` (not `tokenValue`) and the correct `principal`/`lifetime`.
- **node-rdkafka factory — happy path:** same mock; assert the resolved value has `tokenValue` (not `value`).
- **Factory error propagation:** mock rejects with a mock STS error. Assert the returned function's promise rejects, not resolves. The core [lib/client.js:177-179](lib/client.js#L177-L179) handles the rejection and calls `setOAuthBearerTokenFailure` — the factory's job is just to bubble the error.
- **Integration-shape sanity:** the object shape returned by `awsOAuthBearerProvider` matches what [lib/kafkajs/_common.js:321-333](lib/kafkajs/_common.js#L321-L333) validates — `value`, `principal`, `lifetime` all present, no throws.
- **Provider reuse:** one factory call → one `AwsStsTokenProvider` → one `STSClient`. Calling the returned function 5 times hits the mock 5 times (regression guard — we do not accidentally create a new provider per invocation).

### Exit criteria

- All tests pass.
- Public API surface matches design §5c exactly.
- `tsc --declaration` produces `dist/index.d.ts` with the named exports and correct types.

---

## M6 — Examples + package README

**Estimated effort:** 2–3 hours
**Depends on:** M5
**Parallelizable with:** M7

### Deliverables

- [examples/node-rdkafka/oauthbearer_aws_iam/](examples/node-rdkafka/oauthbearer_aws_iam/) — mirrors [examples/node-rdkafka/oauthbearer_callback_authentication/](examples/node-rdkafka/oauthbearer_callback_authentication/) but replaces the hand-rolled JWT with `awsOAuthBearerTokenRefreshCb(...)`:
  - `oauthbearer_aws_iam.js` (CommonJS, matches existing oauth example).
  - `package.json` declaring the runtime dep on `@confluentinc/kafka-javascript-oauthbearer-aws`.
  - Short `README.md` with the prerequisites (region + audience env vars; IAM role with `sts:GetWebIdentityToken`; account-level federation enabled).
- [examples/kafkajs/oauthbearer_aws_iam/](examples/kafkajs/oauthbearer_aws_iam/) — same pattern, mirrors [examples/kafkajs/oauthbearer_calback_authentication/](examples/kafkajs/oauthbearer_calback_authentication/) but uses `awsOAuthBearerProvider(...)`. Async/await idiom.
- `oauthbearer-aws/README.md` (packed into the npm tarball via the `files` field):
  - Two-paragraph overview.
  - Minimum AWS SDK version note (from M1 bisection).
  - One-line install: `npm install @confluentinc/kafka-javascript @confluentinc/kafka-javascript-oauthbearer-aws`.
  - Integration snippet for **both** node-rdkafka and KafkaJS APIs (mirrors design §6b and §6c).
  - The **"do NOT set `sasl.oauthbearer.method`"** warning (design §2 and universal rule across all four language siblings).
  - IAM prerequisite: `aws iam enable-outbound-web-identity-federation` run once per account by an admin (design §10).
  - Pointer to [DESIGN_AWS_OAUTHBEARER.md](DESIGN_AWS_OAUTHBEARER.md) and [IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md](IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md).
- JSDoc / TSDoc on every exported type, function, and class. Verify by opening `dist/index.d.ts` after `npm run build` and confirming the comments appear on each declaration.

### Exit criteria

- Both examples run green against real AWS when prerequisites are satisfied (manually validated during M7 reproduction steps — don't duplicate the run, just share the EC2 box output).
- `npm run build -w @confluentinc/kafka-javascript-oauthbearer-aws` passes with zero warnings.
- `npm pack -w @confluentinc/kafka-javascript-oauthbearer-aws --dry-run` includes `dist/`, `README.md`, `LICENSE.txt`, `package.json` in the tarball preview. Nothing else.
- Extract the packed tarball manually and render `README.md` through a markdown viewer to confirm it looks right on npmjs.com preview.

---

## M7 — Real-AWS integration test (scaffold for manual E2E)

**Estimated effort:** 3–4 hours (test code + one validation run)
**Depends on:** M4
**Parallelizable with:** M6

### Deliverables

- `oauthbearer-aws/e2e/provider-real.e2e.ts`:
  ```ts
  const runReal = process.env['RUN_AWS_STS_REAL'] === '1';
  const describeReal = runReal ? describe : describe.skip;

  describeReal('AwsStsTokenProvider — real AWS', () => {
    it('mints a valid JWT against real STS', async () => {
      const provider = new AwsStsTokenProvider({
        region:   process.env['AWS_REGION']  ?? 'eu-north-1',
        audience: process.env['AUDIENCE']    ?? 'https://api.example.com',
        durationSeconds: 300,
      });

      const t = await provider.token('');

      expect(t.value).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
      expect(t.lifetime).toBeGreaterThan(Date.now());
      expect(t.lifetime).toBeLessThan(Date.now() + 10 * 60 * 1000);
      expect(t.principal).toMatch(/^arn:aws:iam::\d+:role\/.+$/);
    }, 20_000);
  });
  ```
- `oauthbearer-aws/e2e/jest.config.js` — copy unit config, point `testRegex` at `e2e/.*\.e2e\.ts`.
- `oauthbearer-aws/Makefile` — add `e2e` target: `RUN_AWS_STS_REAL=1 npx jest --config e2e/jest.config.js`.
- `oauthbearer-aws/TESTING.md`:
  - Required env vars (`RUN_AWS_STS_REAL=1`, optionally `AWS_REGION`, `AUDIENCE`).
  - EC2 role prerequisites: `sts:GetWebIdentityToken` permission; account-level `EnableOutboundWebIdentityFederation` executed.
  - Run command:
    ```bash
    RUN_AWS_STS_REAL=1 AWS_REGION=eu-north-1 AUDIENCE=https://api.example.com \
      make -C oauthbearer-aws e2e
    ```
  - Reference the EC2 test box (`ktrue-iam-sts-test-role` in `eu-north-1`, account `708975691912`) shared with the Go and .NET M7 runs — same role, same account, same prerequisites already satisfied. Byte-identical 1256-char JWT expected (see .NET plan post-implementation validation and Go plan Scenario 1).

### Scope boundary

This milestone verifies the package MINTS a valid token. It does **not** verify the token is accepted by a Kafka broker — that requires Confluent Cloud OIDC trust configuration, an admin action outside this implementation's scope. Broker-side acceptance is a manual E2E step the owner drives separately.

### Exit criteria

- Default `npm test -w @confluentinc/kafka-javascript-oauthbearer-aws` **does not** run the e2e test (proven by running it locally with `RUN_AWS_STS_REAL` unset).
- Owner runs `make -C oauthbearer-aws e2e` on the EC2 box with the env vars set and reports green. Attach test output to the PR.
- JWT length matches cross-language observation (1256 chars on the shared test role).

---

## M8 — Release wiring

**Estimated effort:** 3–4 hours
**Depends on:** M1–M7 all complete

### Deliverables

1. **[ci/prepublish.js](ci/prepublish.js)** — audit. Currently handles the root `@confluentinc/kafka-javascript` binary publish via node-pre-gyp. Verify that `schemaregistry` is published via a separate CI step (likely outside `prepublish.js`) and clone that pattern for the new workspace. If `prepublish.js` needs a new branch for the new workspace, add it with the minimum viable logic.

2. **Root [package.json](package.json) `version` field (currently `1.9.0`) coupling:** document in `oauthbearer-aws/package.json` — comment or a constant — that the submodule version must match root. At release time, both bump together.

3. **[README.md](README.md)** — add an **"Optional integrations"** section (if none exists) or extend the existing introduction:
   ```markdown
   ## Optional integrations

   - **[@confluentinc/kafka-javascript-oauthbearer-aws](oauthbearer-aws/)** —
     AWS STS `GetWebIdentityToken` OAUTHBEARER token provider. Opt-in; users
     not installing it see zero change in their `@confluentinc/kafka-javascript`
     dependency graph. See [DESIGN_AWS_OAUTHBEARER.md](DESIGN_AWS_OAUTHBEARER.md).
   ```

4. **[CHANGELOG.md](CHANGELOG.md)** — add under the next version header:
   ```markdown
   ## JavaScript Client

   ### Enhancements

   - Added optional npm package `@confluentinc/kafka-javascript-oauthbearer-aws`
     — AWS STS `GetWebIdentityToken` OAUTHBEARER token provider. Opt-in;
     users not installing it see zero change in their
     `@confluentinc/kafka-javascript` dependency graph.
     See `DESIGN_AWS_OAUTHBEARER.md` and
     `IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md` for details.
   ```

5. **[MIGRATION.md](MIGRATION.md)** — short note pointing at the new package under a "New optional integrations" heading. No migration is required for existing users.

6. **Verify repo-wide tooling**:
   - `npm install` at root symlinks the new workspace correctly.
   - `npm run build --workspaces --if-present` includes the new workspace.
   - `npm test --workspaces --if-present` runs the new unit tests (not e2e).
   - [jsdoc.conf](jsdoc.conf) — verify whether the new workspace needs to be added to generate API docs. If yes, add.

7. **Release rehearsal** (local):
   - Bump root `version` `1.9.0 → 1.10.0-rc.0` and `oauthbearer-aws/package.json` `version` to match.
   - Bump `peerDependencies["@confluentinc/kafka-javascript"]` range in `oauthbearer-aws/package.json` to `^1.10.0-rc.0` (or keep `^1.9.0` if semver-compatible).
   - `npm run build -w @confluentinc/kafka-javascript-oauthbearer-aws` → inspect `oauthbearer-aws/dist/` contents.
   - `npm pack -w @confluentinc/kafka-javascript-oauthbearer-aws` → produces `.tgz`. Inspect with `tar -tzf` — confirm `package/dist/index.js`, `package/dist/index.d.ts`, `package/README.md`, `package/LICENSE.txt`, `package/package.json` all present. Confirm `package/package.json` has the correct `version`, `peerDependencies`, and `dependencies` entries.
   - Create a scratch project in `/tmp/`, run `npm install /path/to/confluentinc-kafka-javascript-oauthbearer-aws-1.10.0-rc.0.tgz /path/to/confluentinc-kafka-javascript-1.10.0-rc.0.tgz`, write a two-line Node script that calls `awsOAuthBearerProvider({...})`, run it.
   - Roll back the version bumps (do not commit).

### Exit criteria

- All CI targets green.
- Rehearsal resolution confirmed (packed tarball installs and runs in a scratch project).
- Release checklist updated.
- Both `package.json` `version` fields ready to bump in lockstep at the target release tag.

---

## Post-implementation validation — to be executed after M8

To be filled in by the owner after the real validation run on the EC2 box (`ktrue-iam-sts-test-role` in `eu-north-1`, account `708975691912` — same box used by the Go and .NET post-implementation validations). Template below; measurements live in subsections 1a/1b/2a/2b.

### Phase 0 — Prep

Two scratch consumer projects in `/tmp/` outside the repo, each running `npm install` against tarballs produced by `npm pack` off branch `dev_prashah_IAM_Javascript_POC`. Tarball-based (not workspace-link) install is what users actually experience.

**0a. SSH to the EC2 box and clone (or update) the repo**

```bash
ssh ec2-user@<your-ec2-box>
cd ~
git clone https://github.com/confluentinc/confluent-kafka-javascript.git
cd confluent-kafka-javascript
git checkout dev_prashah_IAM_Javascript_POC
git pull --ff-only
```

**0b. Verify Node 18+ and npm are available**

```bash
node --version   # expect v18.x+
npm --version
```

**0c. Build and pack both workspaces**

```bash
npm install
npm run build -w @confluentinc/kafka-javascript-oauthbearer-aws
npm pack -w @confluentinc/kafka-javascript-oauthbearer-aws
npm pack     # root package — the core tarball
# Two .tgz files are now in the repo root.
REPO=$HOME/confluent-kafka-javascript
```

**0d. Confirm AWS prerequisites** — already satisfied on the shared test box, but smoke-test for drift:

```bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Expect: ktrue-iam-sts-test-role

aws sts get-web-identity-token \
  --audience https://api.example.com \
  --signing-algorithm RS256 \
  --region eu-north-1 > /dev/null && echo OK
```

**0e. Wipe any prior scratch dirs**

```bash
cd /tmp && rm -rf aws-consumer no-aws-consumer
```

### Phase 1 — Scenario 1 (OPTS IN, with AWS)

**1a. Create project and install both tarballs**

```bash
cd /tmp && mkdir aws-consumer && cd aws-consumer
npm init -y
npm install $REPO/confluentinc-kafka-javascript-*.tgz \
            $REPO/confluentinc-kafka-javascript-oauthbearer-aws-*.tgz
```

**1b. Write `index.js` — minimal program that mints a real JWT**

```js
const { AwsStsTokenProvider } = require('@confluentinc/kafka-javascript-oauthbearer-aws');

(async () => {
  const provider = new AwsStsTokenProvider({
    region:   process.env.AWS_REGION  ?? 'eu-north-1',
    audience: process.env.AUDIENCE    ?? 'https://api.example.com',
    durationSeconds: 300,
  });
  const t = await provider.token('');

  console.log(`JWT length     : ${t.value.length} chars`);
  console.log(`Principal      : ${t.principal}`);
  console.log(`Expiry (msUTC) : ${t.lifetime}`);
  console.log(`Expires in     : ${Math.round((t.lifetime - Date.now()) / 1000)}s`);
})();
```

**1c. Measure**

```bash
echo "node_modules size:" ; du -sh node_modules ; du -sb node_modules
echo "@aws-sdk packages:" ; ls node_modules/@aws-sdk
echo "Transitive deps:"   ; npm ls --parseable | grep -Ei '/@aws-sdk/' | wc -l
```

**1d. Runtime proof** — actually mint a JWT:

```bash
AWS_REGION=eu-north-1 AUDIENCE=https://api.example.com node index.js
```

Expected output (matches Go / .NET / librdkafka cross-language observation):

```
JWT length     : 1256 chars
Principal      : arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role
Expiry (msUTC) : <unix-ms>
Expires in     : 299s
```

### Phase 2 — Scenario 2 (OPTS OUT, no AWS)

**2a. Create project with only the core tarball**

```bash
cd /tmp && mkdir no-aws-consumer && cd no-aws-consumer
npm init -y
npm install $REPO/confluentinc-kafka-javascript-*.tgz
# NOTE: no install of the oauthbearer-aws tarball.
```

**2b. Write `index.js` — proves the core loads without any AWS SDK**

```js
const Kafka = require('@confluentinc/kafka-javascript');

const producer = new Kafka.Producer({
  'metadata.broker.list': 'localhost:9092',
});
console.log('Confluent Kafka loaded; no AWS SDK in this process.');
console.log(`Producer ctor type: ${typeof producer}`);
```

**2c. Measure — these numbers prove the invariant**

```bash
echo "node_modules size:" ; du -sh node_modules ; du -sb node_modules
echo "@aws-sdk packages:" ; ls node_modules/@aws-sdk 2>/dev/null | wc -l
echo "Transitive check:"  ; npm ls --parseable | grep -Ei '/@aws-sdk/' && echo LEAKED || echo OK
```

Expected: `@aws-sdk packages: 0`, `Transitive check: OK`.

**2d. Runtime proof** — core still works without AWS SDK:

```bash
node index.js
```

### Phase 3 — Cleanup

```bash
rm -rf /tmp/aws-consumer /tmp/no-aws-consumer
rm -f $REPO/confluentinc-kafka-javascript-*.tgz \
      $REPO/confluentinc-kafka-javascript-oauthbearer-aws-*.tgz
```

One `sts:GetWebIdentityToken` call recorded in CloudTrail per Scenario 1 run.

### The zero-cost property, quantified (template)

| Metric | Scenario 1 (opt-in) | Scenario 2 (opt-out) | Delta |
|---|---|---|---|
| `node_modules` size | TBD | TBD | TBD |
| `@aws-sdk/*` package count | TBD | **0** | TBD |
| `npm ls` @aws-sdk entries | TBD | **0** | TBD |
| Real JWT minted at runtime | TBD (expect 1256 chars, principal `arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role`) | n/a | — |

The AWS SDK delta will be the pure cost of the opt-in — `@aws-sdk/client-sts` + `@aws-sdk/credential-providers` + their `@smithy/*` transitives. Everything else (core bindings, `nan`, `node-pre-gyp`, the prebuilt librdkafka binary) is byte-identical between the two.

### Cross-language mint consistency

The 1256-byte JWT length should reproduce exactly what the Go, .NET, and librdkafka-native clients have observed on this same EC2 box / role / audience. AWS STS is the single source of truth; every client's glue layer is verified by convergence on this number. Cross-references:

- Go plan post-implementation, Scenario 1: "1256-byte JWT via IMDS credentials on each invocation"
- .NET plan post-implementation, Scenario 1: "JWT length : 1256 chars"
- librdkafka project memory, Probe A / M7: "1256-byte JWT minted"
- This test, Scenario 1: (to be filled in)

---

## Open items for later (not blocking implementation)

1. **Release target version** — pick at tag time. Leaning toward whatever minor version is cut after implementation merges (likely `1.10.0`).
2. **Additional token providers** — `@confluentinc/kafka-javascript-oauthbearer-azure`, `-gcp`. The workspace + peerDependency pattern reserves space for these; implementations are independent future work.
3. **AWS SDK v3 floor bump cadence** — `schemaregistry` currently pins `^3.975.0`. If that bumps, the new package should bump in step to keep the peer-dep graph clean.
4. **Logging hook** — users wanting to plug in their own logger for `@aws-sdk/client-sts` diagnostics. Defer until first real request.
5. **ESM vs CJS consumers** — the build emits CJS today (matches `schemaregistry`). Revisit if ESM demand appears; `@aws-sdk/client-sts` supports both.
6. **`confluent_kafka.aio`-equivalent** — N/A for JS; the existing Promise-returning callback path in [lib/client.js:174](lib/client.js#L174) already covers async consumers.

## References

- [DESIGN_AWS_OAUTHBEARER.md](DESIGN_AWS_OAUTHBEARER.md) — full design doc.
- Go plan (template): `IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md` in `confluent-kafka-go`.
- .NET plan (template): `IMPLEMENTATION_PLAN_AWS_OAUTHBEARER.md` in `confluent-kafka-dotnet`.
- Existing optional-package precedent: [schemaregistry/](schemaregistry/) workspace.
- OAUTHBEARER hook wiring: [lib/client.js:135-182](lib/client.js#L135-L182), [lib/kafkajs/_common.js:310-351](lib/kafkajs/_common.js#L310-L351).
- Existing managed-path examples: [examples/node-rdkafka/oauthbearer_callback_authentication/oauthbearer_callback_authentication.js](examples/node-rdkafka/oauthbearer_callback_authentication/oauthbearer_callback_authentication.js), [examples/kafkajs/oauthbearer_calback_authentication/oauthbearer_callback_authentication.js](examples/kafkajs/oauthbearer_calback_authentication/oauthbearer_callback_authentication.js).
- AWS SDK v3 precedent in repo: [schemaregistry/rules/encryption/awskms/aws-driver.ts](schemaregistry/rules/encryption/awskms/aws-driver.ts).
