const MAX_JWT_BYTES = 8 * 1024;
const BASE64URL_RE = /^[A-Za-z0-9_\-=]*$/;

// Extract the "sub" claim from an unverified JWT payload.
// AWS already signed this token; verification isn't our job — we just need
// the claim for OAuthBearerToken.principal.
export function subFromJwt(jwt: string): string {
  if (typeof jwt !== 'string' || jwt.length === 0) {
    throw new TypeError('jwt: empty or non-string input');
  }
  if (jwt.length > MAX_JWT_BYTES) {
    throw new TypeError(
      `jwt: token exceeds maximum size of ${MAX_JWT_BYTES} bytes (got ${jwt.length})`,
    );
  }

  const segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new TypeError(
      `jwt: expected 3 dot-separated segments, got ${segments.length}`,
    );
  }

  const payloadSegment = segments[1];
  if (!payloadSegment || !BASE64URL_RE.test(payloadSegment)) {
    throw new TypeError('jwt: payload segment is empty or not base64url');
  }

  const b64 =
    payloadSegment.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (payloadSegment.length % 4)) % 4);
  const decoded = Buffer.from(b64, 'base64').toString('utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch (e) {
    throw new TypeError(`jwt: malformed JSON in payload: ${(e as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('jwt: payload is not a JSON object');
  }

  const sub = (parsed as Record<string, unknown>)['sub'];
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new TypeError('jwt: missing or invalid "sub" claim');
  }

  return sub;
}
