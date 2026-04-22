// Real-AWS integration test — gated behind `RUN_AWS_STS_REAL=1` so the
// unit-test default never accidentally hits the network.
//
// Prereqs (see TESTING.md):
//   1. AWS identity resolvable by the default credential chain (EC2 role,
//      IRSA, SSO, profile, etc.) with `sts:GetWebIdentityToken` permission.
//   2. Account-level `iam:EnableOutboundWebIdentityFederation` executed once
//      by an admin.
//   3. AWS_REGION + AUDIENCE env vars (or defaults matching the shared EC2
//      test box used by Go / .NET / librdkafka).

import { AwsStsTokenProvider } from '../provider';

const runReal = process.env['RUN_AWS_STS_REAL'] === '1';
const describeReal = runReal ? describe : describe.skip;

describeReal('AwsStsTokenProvider — real AWS STS', () => {
  const region = process.env['AWS_REGION'] ?? 'eu-north-1';
  const audience = process.env['AUDIENCE'] ?? 'https://api.example.com';

  it('mints a valid JWT', async () => {
    const provider = new AwsStsTokenProvider({
      region,
      audience,
      durationSeconds: 300,
    });

    const t = await provider.token('');

    // 3-segment base64url JWT.
    expect(t.value).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);

    // KafkaJS and node-rdkafka aliases both populated and identical.
    expect(t.tokenValue).toBe(t.value);

    // Principal is a bare role ARN (direct) or assumed-role ARN.
    expect(t.principal).toMatch(/^arn:aws:(iam|sts)::\d+:(role|assumed-role)\/.+$/);

    // Expiration is in the future and within the ~10-min ceiling
    // (durationSeconds=300 + some slack).
    const now = Date.now();
    expect(t.lifetime).toBeGreaterThan(now);
    expect(t.lifetime).toBeLessThan(now + 10 * 60 * 1000);
  });

  it('produces a JWT whose length matches cross-language observation', async () => {
    // The Go, .NET, and librdkafka post-implementation validations against
    // the shared EC2 role (ktrue-iam-sts-test-role in eu-north-1) all
    // observed a 1256-char JWT. If this drifts significantly it likely
    // means the test role changed, not the client — but worth surfacing.
    const provider = new AwsStsTokenProvider({ region, audience });
    const t = await provider.token('');

    // Loose band — AWS reserves the right to add claims. Tight enough to
    // catch a gross misconfiguration (e.g. wrong endpoint returning HTML).
    expect(t.value.length).toBeGreaterThan(800);
    expect(t.value.length).toBeLessThan(2000);
  });

  it('re-invoking token() hits STS each time (no internal caching)', async () => {
    const provider = new AwsStsTokenProvider({ region, audience });
    const t1 = await provider.token('');
    const t2 = await provider.token('');

    // Each STS call mints a new JWT, even back-to-back; the values differ
    // (different `iat`/`jti`). If they match, either STS cached (unlikely)
    // or we accidentally cached locally.
    expect(t1.value).not.toBe(t2.value);
  });
});

// Provide a single always-runnable placeholder so jest doesn't emit
// "no tests found" when the gate is off.
describe('provider-real.e2e — gate', () => {
  it('skips real-AWS tests unless RUN_AWS_STS_REAL=1', () => {
    expect([true, false]).toContain(runReal);
  });
});
