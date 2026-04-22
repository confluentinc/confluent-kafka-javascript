import { mockClient } from 'aws-sdk-client-mock';
import { STSClient, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';

import {
  awsOAuthBearerProvider,
  awsOAuthBearerTokenRefreshCb,
  AwsOAuthBearerConfig,
} from '../provider';

const stsMock = mockClient(STSClient as never) as unknown as ReturnType<typeof mockClient>;
type StsResponse = { WebIdentityToken?: string; Expiration?: Date };
const stsOk = (r: StsResponse) => r as never;

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function makeJwt(payload: Record<string, unknown>): string {
  return `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(payload))}.sig`;
}

const VALID_JWT = makeJwt({ sub: 'arn:aws:iam::123456789012:role/R' });
const EXPIRATION = new Date('2026-04-21T06:06:47.641Z');

const baseValidConfig: AwsOAuthBearerConfig = {
  region: 'eu-north-1',
  audience: 'https://api.example.com',
};

beforeEach(() => stsMock.reset());

describe('awsOAuthBearerProvider (KafkaJS shape)', () => {
  it('returns a function that resolves to a KafkaJS-shaped token', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(
      stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }),
    );

    const refresh = awsOAuthBearerProvider(baseValidConfig);
    const token = await refresh('someConfigString');

    // KafkaJS expects `value`, not `tokenValue` — matches lib/kafkajs/_common.js:321-333.
    expect(token).toHaveProperty('value');
    expect(token.value).toBe(VALID_JWT);
    expect(token.principal).toBe('arn:aws:iam::123456789012:role/R');
    expect(token.lifetime).toBe(EXPIRATION.getTime());

    // It deliberately does NOT expose the node-rdkafka alias at this boundary.
    expect(token).not.toHaveProperty('tokenValue');
  });

  it('validates config eagerly in the factory (throws on missing region)', () => {
    const bad = { audience: 'https://api.example.com' } as AwsOAuthBearerConfig;
    expect(() => awsOAuthBearerProvider(bad)).toThrow(/region/);
  });

  it('propagates STS errors through the returned function', async () => {
    const err = Object.assign(new Error('no perms'), { name: 'AccessDeniedException' });
    stsMock.on(GetWebIdentityTokenCommand as never).rejects(err);

    const refresh = awsOAuthBearerProvider(baseValidConfig);
    await expect(refresh('')).rejects.toMatchObject({ name: 'AccessDeniedException' });
  });

  it('matches the shape lib/kafkajs/_common.js validates (value/principal/lifetime)', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(
      stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }),
    );

    const refresh = awsOAuthBearerProvider(baseValidConfig);
    const token = await refresh('');

    // Mirror the runtime checks at _common.js:321-333.
    expect('value' in token).toBe(true);
    expect('principal' in token).toBe(true);
    expect('lifetime' in token).toBe(true);
    expect(typeof token.value).toBe('string');
    expect(typeof token.principal).toBe('string');
    expect(typeof token.lifetime).toBe('number');
  });
});

describe('awsOAuthBearerTokenRefreshCb (node-rdkafka shape)', () => {
  it('returns a function that resolves to a node-rdkafka-shaped token', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(
      stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }),
    );

    const refresh = awsOAuthBearerTokenRefreshCb(baseValidConfig);
    const token = await refresh('someConfigString');

    // node-rdkafka destructures `tokenValue` at lib/client.js:152.
    expect(token).toHaveProperty('tokenValue');
    expect(token.tokenValue).toBe(VALID_JWT);
    expect(token.principal).toBe('arn:aws:iam::123456789012:role/R');
    expect(token.lifetime).toBe(EXPIRATION.getTime());

    // Not the KafkaJS alias at this boundary.
    expect(token).not.toHaveProperty('value');
  });

  it('validates config eagerly in the factory (throws on missing audience)', () => {
    const bad = { region: 'eu-north-1' } as AwsOAuthBearerConfig;
    expect(() => awsOAuthBearerTokenRefreshCb(bad)).toThrow(/audience/);
  });

  it('propagates STS errors through the returned function', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).rejects(new Error('ECONNREFUSED'));

    const refresh = awsOAuthBearerTokenRefreshCb(baseValidConfig);
    await expect(refresh('')).rejects.toThrow(/ECONNREFUSED/);
  });

  it('matches the shape lib/client.js:152 destructures (tokenValue/lifetime/principal)', async () => {
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(
      stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }),
    );

    const refresh = awsOAuthBearerTokenRefreshCb(baseValidConfig);
    const token = await refresh('');

    expect('tokenValue' in token).toBe(true);
    expect('principal' in token).toBe(true);
    expect('lifetime' in token).toBe(true);
  });
});

describe('factory — provider reuse / lifetime', () => {
  it('each call to the returned function triggers a fresh STS request (no internal caching)', async () => {
    // librdkafka drives refresh cadence; caching inside the provider would
    // create staleness hazards. Verify we hit STS once per invocation.
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(
      stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }),
    );

    const refresh = awsOAuthBearerProvider(baseValidConfig);
    await refresh('');
    await refresh('');
    await refresh('');
    await refresh('');
    await refresh('');

    expect(stsMock.commandCalls(GetWebIdentityTokenCommand as never)).toHaveLength(5);
  });

  it('two factory calls create two independent providers', async () => {
    // Regression guard: a hypothetical shared-state bug inside the factory
    // would let one invocation affect the other. They should be isolated.
    stsMock.on(GetWebIdentityTokenCommand as never).resolves(
      stsOk({ WebIdentityToken: VALID_JWT, Expiration: EXPIRATION }),
    );

    const refreshA = awsOAuthBearerProvider({ ...baseValidConfig, audience: 'aud-a' });
    const refreshB = awsOAuthBearerProvider({ ...baseValidConfig, audience: 'aud-b' });

    await refreshA('');
    await refreshB('');

    const calls = stsMock.commandCalls(GetWebIdentityTokenCommand as never);
    expect(calls).toHaveLength(2);
    expect((calls[0] as { args: [{ input: { Audience: string[] } }] }).args[0].input.Audience).toEqual(['aud-a']);
    expect((calls[1] as { args: [{ input: { Audience: string[] } }] }).args[0].input.Audience).toEqual(['aud-b']);
  });
});
