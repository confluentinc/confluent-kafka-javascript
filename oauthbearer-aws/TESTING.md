# Testing — `@confluentinc/kafka-javascript-oauthbearer-aws`

Two test layers:

| Layer | Run with | What it covers |
|---|---|---|
| **Unit** | `make test` (or `npm test`) | jwt extractor, wire-grammar parser, config validation, `AwsStsTokenProvider` (mock STS), `awsAutoWire.createHandler` end-to-end (mock STS), frozen-signature contract |
| **Real-AWS e2e** | `make e2e` (gated on `RUN_AWS_STS_REAL=1`) | Mints a real JWT against `sts:GetWebIdentityToken` to verify wire-format end-to-end |

Default `make test` does **not** invoke real AWS — the e2e file lives under `e2e/` and is excluded from the default `testRegex`. Two layers of safety:
1. `jest.config.js` `testRegex` only matches `test/*.test.ts`
2. The e2e file's `RUN_AWS_STS_REAL=1` gate makes every real-AWS describe block a `describe.skip` when the env var is absent

## Running the unit suite

```bash
npm test -w @confluentinc/kafka-javascript-oauthbearer-aws
# or
make -C oauthbearer-aws test
```

No prerequisites. Runs offline, no credentials needed.

## Running the real-AWS e2e suite

### Prerequisites

- An AWS principal with permission to call `sts:GetWebIdentityToken`.
- Outbound web identity federation enabled on the AWS account (one-time admin action: `aws iam enable-outbound-web-identity-federation`).
- Credentials reachable via the AWS SDK's default chain. On EC2 with an instance role, IMDSv2 handles this transparently. On a developer laptop, `aws configure sso` or `~/.aws/credentials` is sufficient.

### EC2 (cross-language test box)

The shared test environment is `ktrue-iam-sts-test-role` in `eu-north-1`, account `708975691912`. Same role used by Go, .NET, librdkafka, and the 21-April JS branch — minted JWT length is `1256` bytes, principal is `arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role`.

```bash
ssh ec2-user@<box>
cd ~ && git clone https://github.com/confluentinc/confluent-kafka-javascript.git || true
cd confluent-kafka-javascript
git fetch origin && git checkout dev_prashah_oauthbearer_hybrid_autowire && git pull --ff-only

npm install
RUN_AWS_STS_REAL=1 \
  AWS_REGION=eu-north-1 \
  AUDIENCE=https://api.example.com \
  make -C oauthbearer-aws e2e
```

### Expected output (success on EC2)

```
PASS e2e/auto-wire-real.e2e.ts
  AWS IAM OAUTHBEARER autowire — real STS
    ✓ describe-skip gate works when RUN_AWS_STS_REAL is unset
    via awsAutoWire.createHandler (the cross-package contract)
      ✓ mints a JWT against real STS with the expected shape
      ✓ honours duration_seconds=600 (10 min instead of default 5)
    via the dispatcher (full Path A flow as core would invoke it)
      ✓ applyAwsOAuthBearerAutowire installs an autowired callback that mints a JWT
  e2e file gate sentinel
    ✓ real-AWS suite is enabled (RUN_AWS_STS_REAL=1)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

The first test logs diagnostic JSON: `{ scenario, jwtLength, principal, expiresInSec }`. On the shared EC2 box, `jwtLength` is `1256` and `principal` matches `arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role`.

### Expected output when env var is unset

```
PASS e2e/auto-wire-real.e2e.ts
  AWS IAM OAUTHBEARER autowire — real STS
    ○ skipped describe-skip gate works when RUN_AWS_STS_REAL is unset
    [...4 more skipped...]
  e2e file gate sentinel
    ✓ skips real-AWS suite (set RUN_AWS_STS_REAL=1 to enable)

Tests:       4 skipped, 1 passed, 5 total
```

The sentinel test's name is the human-readable signal: "you forgot the env var, that's why nothing is running."

### CloudTrail entries

Each successful e2e run records 3 `sts:GetWebIdentityToken` events in CloudTrail:
- 1 from `awsAutoWire.createHandler` happy path
- 1 from `duration_seconds=600` test
- 1 from the dispatcher path

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `TypeError: A dynamic import callback was invoked without --experimental-vm-modules` | Forgot the `NODE_OPTIONS` flag (only happens if running `jest` directly, not via `make e2e`) | Use `make -C oauthbearer-aws e2e` (Makefile bakes the flag in), or set `NODE_OPTIONS='--experimental-vm-modules'` manually |
| `CredentialsProviderError: Could not load credentials from any providers` | AWS SDK can't find creds via the default chain | On EC2 verify the instance role is attached; locally try `aws sts get-caller-identity` first |
| `OutboundWebIdentityFederationNotEnabledException` | Federation not enabled on the AWS account | Run `aws iam enable-outbound-web-identity-federation` once as an account admin |
| JWT length wildly off the 1256-byte range | Audience override changed the payload size | Expected if `AUDIENCE` is overridden — the `[1100, 1500]` range tolerates audiences within ~100 bytes of the default |
