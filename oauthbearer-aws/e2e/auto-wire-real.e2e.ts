/**
 * Real-AWS integration test for the AWS IAM OAUTHBEARER autowire path.
 *
 * GATED on the env var `RUN_AWS_STS_REAL=1`. Default `npm test` does NOT
 * run this file (jest.config.js's testRegex excludes `e2e/*`). The Makefile's
 * `e2e` target sets the env var and points jest at `e2e/jest.config.js`.
 *
 * Run on EC2 (cross-language test box):
 *   ssh ec2-user@<box>
 *   cd confluent-kafka-javascript
 *   git checkout dev_prashah_oauthbearer_hybrid_autowire
 *   npm install
 *   RUN_AWS_STS_REAL=1 \
 *     AWS_REGION=eu-north-1 \
 *     AUDIENCE=https://api.example.com \
 *     make -C oauthbearer-aws e2e
 *
 * The shared test box (`ktrue-iam-sts-test-role`, `eu-north-1`, account
 * `708975691912`) has the IAM role + outbound web identity federation
 * enabled. Cross-language invariant: a 1256-byte JWT is minted on this
 * role + audience by Go, .NET, librdkafka, and the 21-April JS branch.
 *
 * Locally (developer's laptop) this can run against any AWS credentials
 * with sts:GetWebIdentityToken permission and federation enabled — the
 * 1256-byte invariant relaxes to a length range, the principal regex
 * matches any role ARN.
 */

import { awsAutoWire } from '../index';
import { applyAwsOAuthBearerAutowire } from '../../lib/auto-wire-aws';

const RUN_REAL = process.env['RUN_AWS_STS_REAL'] === '1';
const describeReal = RUN_REAL ? describe : describe.skip;

const REGION = process.env['AWS_REGION'] ?? 'eu-north-1';
const AUDIENCE = process.env['AUDIENCE'] ?? 'https://api.example.com';

const ARN_PATTERN = /^arn:aws:(?:iam|sts)::\d+:[^/]+\/.+$/;
const JWT_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

// Cross-language invariant: 1256 bytes on the shared test role + audience.
// Allow ±100 bytes for variation across audiences (URL length affects the
// payload size). This is the same range the .NET hybrid plan and 21-April
// plan use — it catches order-of-magnitude bugs without flaking on tiny
// audience-string changes.
const JWT_LENGTH_MIN = 1100;
const JWT_LENGTH_MAX = 1500;

describeReal('AWS IAM OAUTHBEARER autowire — real STS', () => {

  it('describe-skip gate works when RUN_AWS_STS_REAL is unset', () => {
    // This test runs ONLY when RUN_REAL is true, which means the gate worked
    // (we got past `describe.skip`). Lets us read green output as positive
    // confirmation rather than absence of output.
    expect(RUN_REAL).toBe(true);
  });

  describe('via awsAutoWire.createHandler (the cross-package contract)', () => {

    it('mints a JWT against real STS with the expected shape', async () => {
      const handler = awsAutoWire.createHandler({
        'sasl.oauthbearer.config': `region=${REGION} audience=${AUDIENCE}`,
      });

      const token = await handler('');

      expect(token.tokenValue).toMatch(JWT_PATTERN);
      expect(token.tokenValue.length).toBeGreaterThan(JWT_LENGTH_MIN);
      expect(token.tokenValue.length).toBeLessThan(JWT_LENGTH_MAX);
      expect(token.principal).toMatch(ARN_PATTERN);
      expect(token.lifetime).toBeGreaterThan(Date.now());
      expect(token.lifetime).toBeLessThan(Date.now() + 10 * 60 * 1000);

      // Diagnostic output captured in the e2e log; useful for the owner
      // to verify cross-language match.
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        scenario: 'createHandler',
        jwtLength: token.tokenValue.length,
        principal: token.principal,
        expiresInSec: Math.round((token.lifetime - Date.now()) / 1000),
      }, null, 2));
    });

    it('honours duration_seconds=600 (10 min instead of default 5)', async () => {
      const handler = awsAutoWire.createHandler({
        'sasl.oauthbearer.config':
          `region=${REGION} audience=${AUDIENCE} duration_seconds=600`,
      });

      const token = await handler('');
      const expiresInSec = Math.round((token.lifetime - Date.now()) / 1000);

      // 600 ± 30s tolerance — STS clock skew + test-runtime drift
      expect(expiresInSec).toBeGreaterThan(570);
      expect(expiresInSec).toBeLessThan(630);
    });
  });

  describe('via the dispatcher (full Path A flow as core would invoke it)', () => {

    it('applyAwsOAuthBearerAutowire installs an autowired callback that mints a JWT',
      async () => {
        const globalConf: Record<string, unknown> = {
          'sasl.oauthbearer.metadata.authentication.type': 'aws_iam',
          'sasl.oauthbearer.config': `region=${REGION} audience=${AUDIENCE}`,
        };

        applyAwsOAuthBearerAutowire(globalConf);

        // Marker stripped, callback installed.
        expect(globalConf['sasl.oauthbearer.metadata.authentication.type'])
          .toBeUndefined();
        const cb = globalConf['oauthbearer_token_refresh_cb'];
        expect(typeof cb).toBe('function');

        // Invoke the autowired callback directly. We DO NOT go through the
        // L135 wrapper because that calls `setOAuthBearerToken` on a native
        // client we haven't constructed. The point of this test is the AWS
        // SDK round-trip via the dispatcher path, not the native binding.
        const callable = cb as (s: string) => Promise<{
          tokenValue: string; principal: string; lifetime: number;
        }>;
        const token = await callable('');

        expect(token.tokenValue).toMatch(JWT_PATTERN);
        expect(token.tokenValue.length).toBeGreaterThan(JWT_LENGTH_MIN);
        expect(token.principal).toMatch(ARN_PATTERN);
      });
  });
});

// Always-running gate sentinel — confirms the test file was discovered
// regardless of RUN_AWS_STS_REAL. Without this, a developer who forgets
// the env var sees `0 tests, 0 passed` and might mistake it for success.
describe('e2e file gate sentinel', () => {
  it(RUN_REAL
    ? 'real-AWS suite is enabled (RUN_AWS_STS_REAL=1)'
    : 'skips real-AWS suite (set RUN_AWS_STS_REAL=1 to enable)', () => {
    expect(typeof RUN_REAL).toBe('boolean');
  });
});
