import { subFromJwt } from '../jwt';

/**
 * Builds a fake JWT with the given payload object. Header and signature are
 * placeholders — `subFromJwt` doesn't verify, so they don't need to be real.
 *
 * @param padded  If true, payload uses padded base64; if false (default), uses
 *   unpadded base64url (matching what AWS emits in real STS responses).
 */
function makeJwt(payload: object, padded = false): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES384', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = padded
    ? Buffer.from(JSON.stringify(payload)).toString('base64')
    : Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'signature-placeholder';
  return `${header}.${payloadEncoded}.${signature}`;
}

describe('subFromJwt', () => {
  describe('happy path', () => {
    it('extracts sub claim — bare role ARN (matches real AWS STS output)', () => {
      const jwt = makeJwt({ sub: 'arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role' });
      expect(subFromJwt(jwt)).toBe('arn:aws:iam::708975691912:role/ktrue-iam-sts-test-role');
    });

    it('extracts sub claim — assumed-role ARN', () => {
      const jwt = makeJwt({ sub: 'arn:aws:sts::123456789012:assumed-role/MyRole/SessionName' });
      expect(subFromJwt(jwt)).toBe('arn:aws:sts::123456789012:assumed-role/MyRole/SessionName');
    });

    it('decodes unpadded base64url payload (AWS emits unpadded)', () => {
      // Payload that will produce a base64url string requiring padding to be
      // valid base64. {"sub":"x"} → eyJzdWIiOiJ4In0 (15 chars; needs '=' to be base64).
      const jwt = makeJwt({ sub: 'x' });
      expect(subFromJwt(jwt)).toBe('x');
    });

    it('decodes padded base64 payload (spec allows either)', () => {
      const jwt = makeJwt({ sub: 'x' }, /* padded */ true);
      expect(subFromJwt(jwt)).toBe('x');
    });

    it('handles payloads with extra claims alongside sub', () => {
      const jwt = makeJwt({
        sub: 'arn:aws:iam::123:role/R',
        iss: 'https://sts.amazonaws.com',
        aud: 'https://confluent.cloud/oidc',
        iat: 1700000000,
        exp: 1700003600,
      });
      expect(subFromJwt(jwt)).toBe('arn:aws:iam::123:role/R');
    });
  });

  describe('input validation', () => {
    it('rejects non-string input', () => {
      expect(() => subFromJwt(undefined as unknown as string)).toThrow(/must be a string/);
      expect(() => subFromJwt(null as unknown as string)).toThrow(/must be a string/);
      expect(() => subFromJwt(42 as unknown as string)).toThrow(/must be a string/);
      expect(() => subFromJwt({} as unknown as string)).toThrow(/must be a string/);
    });

    it('rejects empty string', () => {
      expect(() => subFromJwt('')).toThrow(/empty/);
    });

    it('rejects oversized input (>8 KB) as a DOS guard', () => {
      const oversized = 'x'.repeat(8 * 1024 + 1);
      expect(() => subFromJwt(oversized)).toThrow(/exceeds 8192 bytes/);
    });
  });

  describe('JWT structural malformations', () => {
    it('rejects fewer than 3 segments', () => {
      expect(() => subFromJwt('header.payload')).toThrow(/got 2/);
      expect(() => subFromJwt('only-one-segment')).toThrow(/got 1/);
    });

    it('rejects more than 3 segments', () => {
      expect(() => subFromJwt('a.b.c.d')).toThrow(/got 4/);
    });

    it('rejects empty payload segment', () => {
      // header..signature — three segments, but middle is empty.
      expect(() => subFromJwt('header..signature')).toThrow(/payload segment is empty/);
    });

    it('rejects payload that is not valid base64url', () => {
      // '@' and '!' are outside base64url's alphabet [A-Za-z0-9-_]
      expect(() => subFromJwt('header.@invalid!.signature')).toThrow(/not valid base64url/);
    });
  });

  describe('decoded-payload validation', () => {
    it('rejects payload that decodes to non-JSON', () => {
      // Encode arbitrary text that isn't JSON.
      const notJson = Buffer.from('not-a-json-document').toString('base64url');
      expect(() => subFromJwt(`header.${notJson}.sig`)).toThrow(/not valid JSON/);
    });

    it('rejects payload that decodes to a JSON array (not an object)', () => {
      const arrayPayload = Buffer.from(JSON.stringify(['arr'])).toString('base64url');
      expect(() => subFromJwt(`header.${arrayPayload}.sig`)).toThrow(/not a JSON object/);
    });

    it('rejects payload that decodes to a JSON primitive (not an object)', () => {
      const stringPayload = Buffer.from(JSON.stringify('just-a-string')).toString('base64url');
      expect(() => subFromJwt(`header.${stringPayload}.sig`)).toThrow(/not a JSON object/);
    });

    it("rejects payload missing 'sub' claim", () => {
      const jwt = makeJwt({ iss: 'aws', aud: 'confluent' });   // no sub
      expect(() => subFromJwt(jwt)).toThrow(/no 'sub' claim/);
    });

    it("rejects payload where 'sub' is not a string", () => {
      const jwt = makeJwt({ sub: 12345 });
      expect(() => subFromJwt(jwt)).toThrow(/no 'sub' claim, or 'sub' is not a non-empty string/);
    });

    it("rejects payload where 'sub' is the empty string", () => {
      const jwt = makeJwt({ sub: '' });
      expect(() => subFromJwt(jwt)).toThrow(/no 'sub' claim, or 'sub' is not a non-empty string/);
    });
  });
});
