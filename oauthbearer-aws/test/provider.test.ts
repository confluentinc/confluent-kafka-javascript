import { mockClient } from 'aws-sdk-client-mock';
import {
  STSClient,
  GetWebIdentityTokenCommand,
  type GetWebIdentityTokenCommandOutput,
} from '@aws-sdk/client-sts';

import { AwsStsTokenProvider, type AwsOAuthBearerConfig } from '../provider';

/** Builds a signature-irrelevant JWT carrying the given payload. */
function makeJwt(payload: object): string {
  const h = Buffer.from(JSON.stringify({ alg: 'ES384', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${h}.${p}.signature-placeholder`;
}

/** Real-AWS-shaped JWT for the cross-language EC2 role (1256-byte invariant). */
const ROLE_ARN = 'arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role';

/** Minimum valid config — used as the base for all happy-path tests. */
const okConfig: AwsOAuthBearerConfig = {
  region: 'eu-north-1',
  audience: 'https://confluent.cloud/oidc',
};

/** A canned successful STS response. */
function okStsResponse(
  overrides: Partial<GetWebIdentityTokenCommandOutput> = {},
): GetWebIdentityTokenCommandOutput {
  return {
    $metadata: { httpStatusCode: 200 },
    WebIdentityToken: makeJwt({ sub: ROLE_ARN, aud: 'https://confluent.cloud/oidc' }),
    Expiration: new Date(Date.now() + 300 * 1000),
    ...overrides,
  };
}

describe('AwsStsTokenProvider', () => {
  // Per-instance mock pattern: each test constructs its own stsMock + STSClient.
  // No global state to reset between tests.

  describe('constructor — eager validation', () => {
    it('throws synchronously on missing region (no STS call)', () => {
      const stsMock = mockClient(new STSClient({ region: 'unused' }));
      expect(() => new AwsStsTokenProvider(
        { audience: 'https://x' } as AwsOAuthBearerConfig,
        stsMock as unknown as STSClient,
      )).toThrow(/region is required/);
    });

    it('throws synchronously on out-of-range durationSeconds (no STS call)', () => {
      const stsMock = mockClient(new STSClient({ region: 'unused' }));
      expect(() => new AwsStsTokenProvider(
        { ...okConfig, durationSeconds: 10 },
        stsMock as unknown as STSClient,
      )).toThrow(/durationSeconds must be an integer/);
    });

    it('does NOT touch the credential chain at construction time', () => {
      // Constructor builds an STSClient internally (no test-only override).
      // If construction were eagerly resolving credentials, this would throw
      // on a host without an AWS environment. It must not.
      expect(() => new AwsStsTokenProvider(okConfig)).not.toThrow();
    });
  });

  describe('token() — request shape sent to AWS', () => {
    it('sends Audience as a single-element array', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      await new AwsStsTokenProvider(
        { ...okConfig, audience: 'https://my.example.com' },
        sts,
      ).token();

      const call = mock.commandCalls(GetWebIdentityTokenCommand)[0];
      expect(call?.args[0]?.input.Audience).toEqual(['https://my.example.com']);
      expect(call?.args[0]?.input.Audience?.length).toBe(1);
    });

    it("defaults SigningAlgorithm to 'ES384' when not configured", async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      await new AwsStsTokenProvider(okConfig, sts).token();

      const call = mock.commandCalls(GetWebIdentityTokenCommand)[0];
      expect(call?.args[0]?.input.SigningAlgorithm).toBe('ES384');
    });

    it('passes through SigningAlgorithm when configured', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      await new AwsStsTokenProvider(
        { ...okConfig, signingAlgorithm: 'RS256' },
        sts,
      ).token();

      const call = mock.commandCalls(GetWebIdentityTokenCommand)[0];
      expect(call?.args[0]?.input.SigningAlgorithm).toBe('RS256');
    });

    it('defaults DurationSeconds to 300 when not configured', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      await new AwsStsTokenProvider(okConfig, sts).token();

      const call = mock.commandCalls(GetWebIdentityTokenCommand)[0];
      expect(call?.args[0]?.input.DurationSeconds).toBe(300);
    });

    it('passes through DurationSeconds when configured', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      await new AwsStsTokenProvider(
        { ...okConfig, durationSeconds: 1800 },
        sts,
      ).token();

      const call = mock.commandCalls(GetWebIdentityTokenCommand)[0];
      expect(call?.args[0]?.input.DurationSeconds).toBe(1800);
    });
  });

  describe('token() — response mapping', () => {
    it('maps WebIdentityToken → tokenValue', async () => {
      const jwt = makeJwt({ sub: ROLE_ARN });
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(
        okStsResponse({ WebIdentityToken: jwt }),
      );

      const t = await new AwsStsTokenProvider(okConfig, sts).token();
      expect(t.tokenValue).toBe(jwt);
    });

    it('maps Expiration (Date) → lifetime (ms epoch)', async () => {
      const exp = new Date('2026-04-29T12:00:00Z');
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse({ Expiration: exp }));

      const t = await new AwsStsTokenProvider(okConfig, sts).token();
      expect(t.lifetime).toBe(exp.getTime());
    });

    it('extracts principal from JWT sub claim', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(
        okStsResponse({ WebIdentityToken: makeJwt({ sub: ROLE_ARN }) }),
      );

      const t = await new AwsStsTokenProvider(okConfig, sts).token();
      expect(t.principal).toBe(ROLE_ARN);
    });

    it('uses cfg.principalName override when set (skips JWT parse)', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      // Returns a JWT with a different sub claim than principalName.
      mock.on(GetWebIdentityTokenCommand).resolves(
        okStsResponse({ WebIdentityToken: makeJwt({ sub: 'arn:aws:iam::000:role/other' }) }),
      );

      const t = await new AwsStsTokenProvider(
        { ...okConfig, principalName: 'overridden-principal' },
        sts,
      ).token();

      expect(t.principal).toBe('overridden-principal');
    });

    it('uses cfg.principalName override even with a malformed JWT (skips parse)', async () => {
      // If `principalName` is set, `subFromJwt` is NEVER called, so a
      // malformed JWT is fine. Verifies the short-circuit.
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse({ WebIdentityToken: 'not-a-jwt' }));

      const t = await new AwsStsTokenProvider(
        { ...okConfig, principalName: 'svc' },
        sts,
      ).token();

      expect(t.principal).toBe('svc');
    });

    it('propagates extensions onto the token when configured', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      const t = await new AwsStsTokenProvider(
        { ...okConfig, extensions: { logicalCluster: 'lkc-abc' } },
        sts,
      ).token();

      expect(t.extensions).toEqual({ logicalCluster: 'lkc-abc' });
    });

    it('omits extensions field when not configured', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      const t = await new AwsStsTokenProvider(okConfig, sts).token();
      expect(Object.hasOwn(t, 'extensions')).toBe(false);
    });

    it('forwards the oauthbearer_config runtime arg without using it', async () => {
      // We accept the second arg for librdkafka interface compatibility.
      // Calling token('foo') vs token() must produce the same result.
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      const provider = new AwsStsTokenProvider(okConfig, sts);
      const a = await provider.token('verbatim-config-string');
      const b = await provider.token();

      expect(a.tokenValue).toBe(b.tokenValue);
    });
  });

  describe('token() — AWS contract violations', () => {
    it('throws when WebIdentityToken is missing', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(
        okStsResponse({ WebIdentityToken: undefined }),
      );

      await expect(new AwsStsTokenProvider(okConfig, sts).token())
        .rejects.toThrow(/empty token or expiration/);
    });

    it('throws when Expiration is missing', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(
        okStsResponse({ Expiration: undefined }),
      );

      await expect(new AwsStsTokenProvider(okConfig, sts).token())
        .rejects.toThrow(/empty token or expiration/);
    });

    it('propagates malformed-JWT errors from subFromJwt', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(
        okStsResponse({ WebIdentityToken: 'not-a-valid-jwt' }),
      );

      // No principalName override → subFromJwt runs → throws TypeError.
      await expect(new AwsStsTokenProvider(okConfig, sts).token())
        .rejects.toThrow(/3 dot-separated segments/);
    });
  });

  describe('token() — AWS error passthrough', () => {
    it('lets AccessDeniedException bubble unchanged', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      const accessDenied = Object.assign(new Error('User is not authorized'), {
        name: 'AccessDeniedException',
      });
      mock.on(GetWebIdentityTokenCommand).rejects(accessDenied);

      const promise = new AwsStsTokenProvider(okConfig, sts).token();
      await expect(promise).rejects.toThrow(/User is not authorized/);
      await promise.catch((e) => {
        expect(e.name).toBe('AccessDeniedException');
      });
    });

    it('lets OutboundWebIdentityFederationNotEnabled bubble unchanged', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      const notEnabled = Object.assign(new Error('Outbound federation is not enabled'), {
        name: 'OutboundWebIdentityFederationNotEnabled',
      });
      mock.on(GetWebIdentityTokenCommand).rejects(notEnabled);

      const promise = new AwsStsTokenProvider(okConfig, sts).token();
      await expect(promise).rejects.toThrow(/Outbound federation is not enabled/);
      await promise.catch((e) => {
        expect(e.name).toBe('OutboundWebIdentityFederationNotEnabled');
      });
    });
  });

  describe('concurrent calls', () => {
    it('allows multiple in-flight token() calls (no internal lock)', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      const provider = new AwsStsTokenProvider(okConfig, sts);
      const results = await Promise.all([
        provider.token(), provider.token(), provider.token(),
      ]);
      expect(results).toHaveLength(3);
      expect(mock.commandCalls(GetWebIdentityTokenCommand)).toHaveLength(3);
    });

    it('does NOT cache (each call hits AWS)', async () => {
      const sts = new STSClient({ region: 'us-east-1' });
      const mock = mockClient(sts);
      mock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

      const provider = new AwsStsTokenProvider(okConfig, sts);
      await provider.token();
      await provider.token();
      await provider.token();

      expect(mock.commandCalls(GetWebIdentityTokenCommand)).toHaveLength(3);
    });
  });
});
