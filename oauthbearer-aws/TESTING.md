# Testing `@confluentinc/kafka-javascript-oauthbearer-aws`

Two tiers.

## Unit tests (default)

Fast, network-free, run on every PR.

```bash
cd oauthbearer-aws
make test
```

Expect **89 tests, 4 suites, 100% coverage, < 2s**. No AWS calls, no AWS
credentials required. [`aws-sdk-client-mock`](https://github.com/m-radzikowski/aws-sdk-client-mock)
intercepts every `STSClient.send(...)`.

## Real-AWS integration tests (opt-in)

Gated behind `RUN_AWS_STS_REAL=1` so a developer who forgets the env var
never accidentally hits the network. The e2e file lives at
[`e2e/provider-real.e2e.ts`](e2e/provider-real.e2e.ts) and has its own
`jest.config.js` so `make test` can never discover it.

### Prerequisites

1. **AWS credentials reachable by the default credential chain.** Any of:
   env vars (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`),
   shared config profile, IMDSv2 (EC2), ECS task role, EKS IRSA, EKS Pod
   Identity, SSO session.
2. **`sts:GetWebIdentityToken` permission** on the caller's identity.
3. **Account-level Outbound Web Identity Federation enabled:** an admin has
   run `aws iam enable-outbound-web-identity-federation` **once per AWS
   account**. Without this, STS returns
   `OutboundWebIdentityFederationNotEnabledException` (the test asserts
   the negative error surface in a unit test; here we just expect success).

### The shared test box

Cross-language validation (Go, .NET, librdkafka) uses:

- EC2 role `ktrue-iam-sts-test-role`
- Region `eu-north-1`
- Account `708975691912`
- Amazon Linux 2023

That role already has `sts:GetWebIdentityToken` and the account has
federation enabled. Using the same box lets us compare the JWT shape
cross-language (all three clients observed a 1256-char JWT with
principal `arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role`).

### Run

```bash
RUN_AWS_STS_REAL=1 AWS_REGION=eu-north-1 AUDIENCE=https://api.example.com \
  make -C oauthbearer-aws e2e
```

Expected: 3 tests pass inside the real-AWS describe block (JWT shape,
length-band consistency with cross-language observations, no internal
caching between calls).

### What this does NOT verify

The e2e test only verifies we **mint** a valid token. It does not verify
that the minted token is **accepted** by a Kafka broker — that requires
Confluent Cloud OIDC trust configuration (admin action, outside this
implementation's scope). Broker-side acceptance is a separate manual
step tracked with the owner.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `CredentialsProviderError: Could not load credentials from any providers` | No credentials reachable. Set `AWS_REGION`, or configure `AWS_PROFILE`, or run on an instance with a role attached. |
| `AccessDeniedException: ...is not authorized to perform: sts:GetWebIdentityToken` | Calling identity lacks the permission. Attach the action in the role's policy. |
| `OutboundWebIdentityFederationNotEnabledException` | Admin has not run `aws iam enable-outbound-web-identity-federation` on the account. |
| Test times out at 20s | Network egress to STS regional endpoint (`sts.<region>.amazonaws.com`) is blocked. For VPC-bound runners, configure an STS VPC endpoint and set `stsEndpoint` in the config. |
| `DescribeReal` skipped | `RUN_AWS_STS_REAL` is not exactly `"1"`. Check the shell has exported it. |
| `TypeError: A dynamic import callback was invoked without --experimental-vm-modules` | Jest's CJS VM rejects the dynamic `import()` inside `@aws-sdk/credential-provider-node`. The `make e2e` target sets `NODE_OPTIONS='--experimental-vm-modules'` to enable it. If you invoke jest directly, export that env var first. |

### CloudTrail footprint

Each successful run records one `sts:GetWebIdentityToken` event per test
case (3 per invocation). Failed/skipped runs leave no trail.
