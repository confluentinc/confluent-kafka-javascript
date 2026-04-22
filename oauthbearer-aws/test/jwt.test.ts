import { subFromJwt } from '../jwt';

// Helpers for building test JWTs. We never verify signatures in our code,
// so the signature segment can be any base64url-shaped string.

function b64url(s: string, { padded = false } = {}): string {
  let b64 = Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  if (!padded) {
    b64 = b64.replace(/=+$/g, '');
  }
  return b64;
}

function makeJwt(
  payload: unknown,
  { padded = false, header = '{"alg":"none"}' } = {},
): string {
  const h = b64url(header, { padded });
  const p = b64url(typeof payload === 'string' ? payload : JSON.stringify(payload), { padded });
  const sig = 'sig';
  return `${h}.${p}.${sig}`;
}

describe('subFromJwt', () => {
  it('extracts a role ARN sub claim', () => {
    const jwt = makeJwt({ sub: 'arn:aws:iam::123456789012:role/MyRole', iss: 'aws' });
    expect(subFromJwt(jwt)).toBe('arn:aws:iam::123456789012:role/MyRole');
  });

  it('extracts an assumed-role ARN sub claim', () => {
    const jwt = makeJwt({
      sub: 'arn:aws:sts::123456789012:assumed-role/MyRole/session-name',
    });
    expect(subFromJwt(jwt)).toBe(
      'arn:aws:sts::123456789012:assumed-role/MyRole/session-name',
    );
  });

  it('throws when the sub claim is missing', () => {
    const jwt = makeJwt({ iss: 'aws', aud: 'x' });
    expect(() => subFromJwt(jwt)).toThrow(/sub/);
  });

  it('throws when the sub claim is an empty string', () => {
    const jwt = makeJwt({ sub: '' });
    expect(() => subFromJwt(jwt)).toThrow(/sub/);
  });

  it('throws when the sub claim is not a string', () => {
    const jwt = makeJwt({ sub: 12345 });
    expect(() => subFromJwt(jwt)).toThrow(/sub/);
  });

  it('throws for a token with fewer than 3 segments', () => {
    expect(() => subFromJwt('onlyone.twoparts')).toThrow(/3 dot-separated segments/);
  });

  it('throws for a token with more than 3 segments', () => {
    expect(() => subFromJwt('a.b.c.d')).toThrow(/3 dot-separated segments/);
  });

  it('throws for malformed base64url in the payload segment', () => {
    // '!!!' is not a valid base64url character set
    expect(() => subFromJwt('header.!!!!!!.sig')).toThrow(/base64url/);
  });

  it('throws for malformed JSON in the decoded payload', () => {
    // A base64url-valid segment that decodes to non-JSON bytes.
    const junkPayload = b64url('not-json-just-a-string-{');
    expect(() => subFromJwt(`header.${junkPayload}.sig`)).toThrow(/malformed JSON/);
  });

  it('throws when the payload decodes to a non-object (array)', () => {
    const arrayPayload = b64url(JSON.stringify(['not', 'an', 'object']));
    expect(() => subFromJwt(`header.${arrayPayload}.sig`)).toThrow(/not a JSON object/);
  });

  it('throws when the payload decodes to a non-object (string)', () => {
    const stringPayload = b64url(JSON.stringify('just a string'));
    expect(() => subFromJwt(`header.${stringPayload}.sig`)).toThrow(/not a JSON object/);
  });

  it('throws for an empty string', () => {
    expect(() => subFromJwt('')).toThrow(/empty/);
  });

  it('throws for non-string input', () => {
    // Deliberately violating the type contract to cover the runtime guard.
    expect(() => subFromJwt(null as unknown as string)).toThrow(/empty or non-string/);
    expect(() => subFromJwt(undefined as unknown as string)).toThrow(/empty or non-string/);
  });

  it('rejects oversized tokens (> 8 KB)', () => {
    const oversized = 'a'.repeat(8 * 1024 + 1);
    expect(() => subFromJwt(oversized)).toThrow(/exceeds maximum size/);
  });

  it('accepts a token near but under the 8 KB ceiling', () => {
    // Build a JWT whose total length is just under 8 KB.
    // Pad the "sub" value to consume most of the budget; header is tiny.
    const pad = 'x'.repeat(5000);
    const jwt = makeJwt({ sub: `arn:aws:iam::1:role/${pad}` });
    expect(jwt.length).toBeLessThan(8 * 1024);
    expect(subFromJwt(jwt)).toBe(`arn:aws:iam::1:role/${pad}`);
  });

  it('decodes both padded and unpadded base64url payloads', () => {
    // Pick a payload whose base64 representation requires padding
    // (string length % 3 != 0 → base64 output has trailing '=').
    const payload = { sub: 'arn:aws:iam::1:role/R' }; // JSON length is such that b64 needs padding
    const unpadded = makeJwt(payload, { padded: false });
    const padded = makeJwt(payload, { padded: true });
    expect(unpadded).not.toBe(padded); // sanity: the two forms really differ
    expect(subFromJwt(unpadded)).toBe('arn:aws:iam::1:role/R');
    expect(subFromJwt(padded)).toBe('arn:aws:iam::1:role/R');
  });

  it('matches the expected AWS STS principal ARN regex on a realistic fixture', () => {
    // Sample payload shape per live STS GetWebIdentityToken responses
    // (cross-referenced with Go/.NET/librdkafka probe captures).
    const jwt = makeJwt({
      sub: 'arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role',
      iss: 'https://sts.eu-north-1.amazonaws.com/...',
      aud: 'https://api.example.com',
      exp: 1776836322,
      iat: 1776836022,
    });
    const principal = subFromJwt(jwt);
    expect(principal).toMatch(/^arn:aws:iam::\d+:role\/.+$/);
  });
});
