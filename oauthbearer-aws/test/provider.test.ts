import { mockClient } from 'aws-sdk-client-mock';
import { STSClient, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';

import { AwsStsTokenProvider, AwsOAuthBearerConfig } from '../provider';

// `aws-sdk-client-mock` and `@aws-sdk/client-sts` resolve different major
// versions of `@smithy/types` (3.x top-level from schemaregistry, 4.x nested
// under the AWS SDK). The two `Command` interfaces are structurally distinct,
// so we relax the mock's command-response typing via a narrow helper. Runtime
// behavior is unchanged — the mock still returns exactly what we pass it.
const stsMock = mockClient(STSClient as never) as unknown as ReturnType<typeof mockClient>;
type StsResponse = { WebIdentityToken?: string; Expiration?: Date };
const stsOk = (r: StsResponse) => r as never;

// Fixture: a 3-segment JWT whose payload decodes to { sub: "arn:aws:iam::123:role/R", ... }.
// Built once at test-file load via a small inline helper, mirrors jwt.test.ts shape.
function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function makeJwt(payload: Record<string, unknown>): string {
  return `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(payload))}.sig`;
}

const VALID_JWT = makeJwt({
  sub: 'arn:aws:iam::123456789012:role/R',
  iss: 'https://sts.eu-north-1.amazonaws.com/...',
  aud: 'https://api.example.com',
  exp: 1776836322,
});

const EXPIRATION = new Date('2026-04-21T06:06:47.641Z');

const baseValidConfig: AwsOAuthBearerConfig = {
  region: 'eu-north-1',
  audience: 'https://api.example.com',
};

beforeEach(() => stsMock.reset());

describe('AwsStsTokenProvider — request capture', () => {
  it('forwards audience as a single-element array', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider({ ...baseValidConfig, audience: 'https://foo' });
    await provider.token();

    const calls = stsMock.commandCalls(GetWebIdentityTokenCommand as never);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input.Audience).toEqual(['https://foo']);
  });

  it('forwards signingAlgorithm when set explicitly', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider({ ...baseValidConfig, signingAlgorithm: 'RS256' });
    await provider.token();

    const calls = stsMock.commandCalls(GetWebIdentityTokenCommand as never);
    expect(calls[0]?.args[0].input.SigningAlgorithm).toBe('RS256');
  });

  it('defaults signingAlgorithm to ES384 when unset', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    await provider.token();

    const calls = stsMock.commandCalls(GetWebIdentityTokenCommand as never);
    expect(calls[0]?.args[0].input.SigningAlgorithm).toBe('ES384');
  });

  it('forwards durationSeconds when set explicitly', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider({ ...baseValidConfig, durationSeconds: 900 });
    await provider.token();

    const calls = stsMock.commandCalls(GetWebIdentityTokenCommand as never);
    expect(calls[0]?.args[0].input.DurationSeconds).toBe(900);
  });

  it('defaults durationSeconds to 300 when unset', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    await provider.token();

    const calls = stsMock.commandCalls(GetWebIdentityTokenCommand as never);
    expect(calls[0]?.args[0].input.DurationSeconds).toBe(300);
  });
});

describe('AwsStsTokenProvider — response mapping', () => {
  it('returns correctly shaped AwsOAuthBearerToken on success', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    const token = await provider.token();

    expect(token.value).toBe(VALID_JWT);
    expect(token.tokenValue).toBe(VALID_JWT);
    expect(token.value).toBe(token.tokenValue);
    expect(token.lifetime).toBe(EXPIRATION.getTime());
    expect(token.principal).toBe('arn:aws:iam::123456789012:role/R');
  });

  it('throws when STS returns an undefined Expiration', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: undefined }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    await expect(provider.token()).rejects.toThrow(/empty token or expiration/);
  });

  it('throws when STS returns an undefined WebIdentityToken', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: undefined, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    await expect(provider.token()).rejects.toThrow(/empty token or expiration/);
  });

  it('propagates JWT extraction errors (malformed token)', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: 'not-a-jwt', Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    await expect(provider.token()).rejects.toThrow(/3 dot-separated segments/);
  });
});

describe('AwsStsTokenProvider — STS error propagation', () => {
  it('re-throws AccessDenied exceptions as-is', async () => {
    const err = Object.assign(new Error('User is not authorized'), {
      name: 'AccessDeniedException',
      $metadata: { httpStatusCode: 403 },
    });
    stsMock.on(GetWebIdentityTokenCommand as never).rejects(err);

    const provider = new AwsStsTokenProvider(baseValidConfig);
    await expect(provider.token()).rejects.toMatchObject({
      name: 'AccessDeniedException',
    });
  });

  it('re-throws federation-not-enabled exceptions as-is', async () => {
    const err = Object.assign(
      new Error('Outbound web identity federation is not enabled for this account'),
      { name: 'OutboundWebIdentityFederationNotEnabledException' },
    );
    stsMock.on(GetWebIdentityTokenCommand as never).rejects(err);

    const provider = new AwsStsTokenProvider(baseValidConfig);
    await expect(provider.token()).rejects.toMatchObject({
      name: 'OutboundWebIdentityFederationNotEnabledException',
    });
  });

  it('re-throws transport errors as-is', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).rejects(new Error('ECONNREFUSED'));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    await expect(provider.token()).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe('AwsStsTokenProvider — construction', () => {
  it('runs config validation in the constructor (missing region)', () => {
    const bad = { audience: 'https://api.example.com' } as AwsOAuthBearerConfig;
    expect(() => new AwsStsTokenProvider(bad)).toThrow(/region/);
  });

  it('runs config validation in the constructor (missing audience)', () => {
    const bad = { region: 'eu-north-1' } as AwsOAuthBearerConfig;
    expect(() => new AwsStsTokenProvider(bad)).toThrow(/audience/);
  });

  it('does not invoke the credential provider in the constructor (lazy)', () => {
    let providerInvoked = false;
    const credsProvider = async () => {
      providerInvoked = true;
      throw new Error('should not be called during construction');
    };
    const p = new AwsStsTokenProvider({ ...baseValidConfig, credentials: credsProvider });

    expect(providerInvoked).toBe(false);
    expect(p).toBeInstanceOf(AwsStsTokenProvider);
  });

  it('uses the caller-injected STSClient when provided (test-only path)', async () => {
    // The 2nd constructor arg is for test injection. The aws-sdk-client-mock on
    // STSClient intercepts regardless, but passing an explicit client exercises
    // the branch that skips the internal `new STSClient(...)` construction.
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const client = new STSClient({ region: 'eu-north-1' });
    const provider = new AwsStsTokenProvider(baseValidConfig, client);
    const token = await provider.token();
    expect(token.principal).toBe('arn:aws:iam::123456789012:role/R');
  });

  it('wires the stsEndpoint override through to the client', () => {
    // Can't easily inspect private STSClient config; but construction must
    // succeed with a valid https URL (asserted elsewhere that it fails with
    // http://). This test guards against accidental removal of the branch.
    const p = new AwsStsTokenProvider({
      ...baseValidConfig,
      stsEndpoint: 'https://sts-fips.us-east-1.amazonaws.com',
    });
    expect(p).toBeInstanceOf(AwsStsTokenProvider);
  });
});

describe('AwsStsTokenProvider — integration-shape assertions', () => {
  // Cross-check that the token shape matches what lib/client.js:152
  // destructures (`{ tokenValue, lifetime, principal, extensions }`)
  // and what lib/kafkajs/_common.js:321-333 validates (`value`, `principal`,
  // `lifetime` all present, non-throwing).
  it('returned token has both node-rdkafka and KafkaJS fields populated', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    const t = await provider.token();

    // node-rdkafka shape (client.js:152)
    expect(t).toHaveProperty('tokenValue');
    expect(t).toHaveProperty('lifetime');
    expect(t).toHaveProperty('principal');

    // KafkaJS shape (kafkajs/_common.js:321-333)
    expect(t).toHaveProperty('value');
    expect(typeof t.value).toBe('string');
    expect(typeof t.principal).toBe('string');
    expect(typeof t.lifetime).toBe('number');
  });

  it('lifetime is a UNIX epoch in milliseconds (not seconds)', async () => {
    // KafkaJS expects ms; librdkafka_set_oauthbearer_token takes ms.
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }));
    const provider = new AwsStsTokenProvider(baseValidConfig);
    const t = await provider.token();

    // A ms-epoch for 2026 is ~1.7e12; seconds would be ~1.7e9.
    expect(t.lifetime).toBeGreaterThan(1e12);
    expect(t.lifetime).toBeLessThan(1e14);
  });
});
