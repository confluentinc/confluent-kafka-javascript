import { mockClient } from 'aws-sdk-client-mock';
import {
  STSClient,
  GetWebIdentityTokenCommand,
  type GetWebIdentityTokenCommandOutput,
} from '@aws-sdk/client-sts';

import { awsAutoWire } from '../index';

/**
 * Module-level STS mock. Unlike provider.test.ts which uses a per-instance
 * mock (because tests construct STSClient explicitly via the test-only
 * constructor parameter), here `awsAutoWire.createHandler` constructs its
 * own STSClient internally — so the only available mock pattern is to
 * intercept STSClient construction globally.
 */
const stsMock = mockClient(STSClient);
beforeEach(() => stsMock.reset());

function makeJwt(payload: object): string {
  const h = Buffer.from(JSON.stringify({ alg: 'ES384' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${h}.${p}.signature`;
}

const ROLE_ARN = 'arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role';

function okStsResponse(): GetWebIdentityTokenCommandOutput {
  return {
    $metadata: { httpStatusCode: 200 },
    WebIdentityToken: makeJwt({ sub: ROLE_ARN }),
    Expiration: new Date(Date.now() + 300 * 1000),
  };
}

const validConfig = 'region=eu-north-1 audience=https://confluent.cloud/oidc';

describe('awsAutoWire.createHandler — happy path', () => {
  it('parses the wire grammar, mints a token via mock STS', async () => {
    stsMock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

    const handler = awsAutoWire.createHandler({
      'sasl.oauthbearer.config': validConfig,
    });

    const token = await handler('verbatim-config-string');
    expect(token.tokenValue).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
    expect(token.principal).toBe(ROLE_ARN);
    expect(typeof token.lifetime).toBe('number');
  });

  it('builds the AWS request from parsed wire grammar', async () => {
    stsMock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

    const handler = awsAutoWire.createHandler({
      'sasl.oauthbearer.config':
        'region=us-east-1 audience=https://api.example.com ' +
        'duration_seconds=1800 signing_algorithm=RS256',
    });
    await handler('');

    const call = stsMock.commandCalls(GetWebIdentityTokenCommand)[0];
    expect(call?.args[0]?.input.Audience).toEqual(['https://api.example.com']);
    expect(call?.args[0]?.input.DurationSeconds).toBe(1800);
    expect(call?.args[0]?.input.SigningAlgorithm).toBe('RS256');
  });
});

describe('awsAutoWire.createHandler — config-shape errors at construction', () => {
  it("throws TypeError when 'sasl.oauthbearer.config' is missing", () => {
    expect(() => awsAutoWire.createHandler({})).toThrow(
      /'sasl.oauthbearer.config' is required and must be a string, got undefined/,
    );
  });

  it("throws TypeError when 'sasl.oauthbearer.config' is empty", () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': '',
    })).toThrow(/'sasl.oauthbearer.config' is empty/);
  });

  it("throws TypeError when 'sasl.oauthbearer.config' is a number", () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': 42,
    })).toThrow(/must be a string, got number/);
  });

  it("throws TypeError when 'sasl.oauthbearer.config' is an object", () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': { region: 'us-east-1' },
    })).toThrow(/must be a string, got object/);
  });
});

describe('awsAutoWire.createHandler — error propagation from H2/H3 layers', () => {
  it('propagates parser grammar errors (unknown wire-grammar key)', () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': 'region=us-east-1 audience=https://x foo=bar',
    })).toThrow(/unknown key 'foo'/);
  });

  it('propagates parser missing-required-key errors', () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': 'audience=https://x',   // no region
    })).toThrow(/missing required key 'region'/);
  });

  it('propagates validateConfig range errors (out-of-range duration_seconds)', () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': `${validConfig} duration_seconds=10`,
    })).toThrow(/durationSeconds must be an integer in \[60, 3600\]/);
  });

  it('propagates validateConfig enum errors (bogus signing_algorithm)', () => {
    expect(() => awsAutoWire.createHandler({
      'sasl.oauthbearer.config': `${validConfig} signing_algorithm=garbage`,
    })).toThrow(/signingAlgorithm must be 'ES384' or 'RS256'/);
  });
});

describe('awsAutoWire.createHandler — runtime AWS errors propagate', () => {
  it('AWS error from STS bubbles unchanged from the returned closure', async () => {
    const accessDenied = Object.assign(new Error('User is not authorized'), {
      name: 'AccessDeniedException',
    });
    stsMock.on(GetWebIdentityTokenCommand).rejects(accessDenied);

    const handler = awsAutoWire.createHandler({
      'sasl.oauthbearer.config': validConfig,
    });

    const promise = handler('');
    await expect(promise).rejects.toThrow(/User is not authorized/);
    await promise.catch((e) => expect(e.name).toBe('AccessDeniedException'));
  });
});

describe('awsAutoWire.createHandler — extensions + per-call interface', () => {
  it('forwards extensions from the wire grammar onto the minted token', async () => {
    stsMock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

    const handler = awsAutoWire.createHandler({
      'sasl.oauthbearer.config':
        `${validConfig} extension_logicalCluster=lkc-abc extension_identityPoolId=pool-xyz`,
    });
    const token = await handler('');

    expect(token.extensions).toEqual({
      logicalCluster: 'lkc-abc',
      identityPoolId: 'pool-xyz',
    });
  });

  it("uses cfg.principalName override (skips JWT 'sub' parse)", async () => {
    stsMock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

    const handler = awsAutoWire.createHandler({
      'sasl.oauthbearer.config':
        `${validConfig} principal_name=service-account`,
    });
    const token = await handler('');

    expect(token.principal).toBe('service-account');
  });
});

describe('awsAutoWire.createHandler — provider re-use (no per-call work)', () => {
  it('parses + constructs once per createHandler call (5 invocations → 5 STS calls)', async () => {
    stsMock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

    const handler = awsAutoWire.createHandler({
      'sasl.oauthbearer.config': validConfig,
    });
    await handler('');
    await handler('');
    await handler('');
    await handler('');
    await handler('');

    expect(stsMock.commandCalls(GetWebIdentityTokenCommand)).toHaveLength(5);
  });

  it('two separate createHandler calls produce independent providers', async () => {
    stsMock.on(GetWebIdentityTokenCommand).resolves(okStsResponse());

    const h1 = awsAutoWire.createHandler({ 'sasl.oauthbearer.config': validConfig });
    const h2 = awsAutoWire.createHandler({ 'sasl.oauthbearer.config': validConfig });

    expect(h1).not.toBe(h2);
    await h1('');
    await h2('');
    expect(stsMock.commandCalls(GetWebIdentityTokenCommand)).toHaveLength(2);
  });
});
