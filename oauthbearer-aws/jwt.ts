/**
 * Maximum accepted JWT size, in bytes. AWS-minted JWTs from
 * sts:GetWebIdentityToken are ~1.4 KB in practice (1256 bytes observed
 * cross-language with Go / .NET / librdkafka on the same role+audience).
 * 8 KB gives ~5.7x headroom and bounds the cost of attacker-controlled
 * input that a caller might pass to {@link subFromJwt} unchecked.
 */
const MAX_JWT_BYTES = 8 * 1024;

/**
 * Extracts the `sub` claim from an unverified JWT payload.
 *
 * AWS already signed this token via the authenticated `sts:GetWebIdentityToken`
 * call we made; client-side cryptographic verification is unnecessary and would
 * add a `jose` / `jsonwebtoken` dependency for no security gain — the principal
 * is used only for log identification on `AwsOAuthBearerToken.principal`.
 *
 * Accepts both padded and unpadded base64url payload segments. AWS emits
 * unpadded; the JWS spec (RFC 7515 §2) permits either.
 *
 * @throws TypeError on every malformed-input path:
 *   - input is not a string
 *   - input exceeds {@link MAX_JWT_BYTES} (DOS guard)
 *   - JWT does not have exactly three dot-separated segments
 *   - middle segment is not valid base64url
 *   - decoded payload is not valid JSON
 *   - decoded payload has no `sub` field, or `sub` is not a string
 */
export function subFromJwt(jwt: string): string {
  if (typeof jwt !== 'string') {
    throw new TypeError(`subFromJwt: input must be a string, got ${typeof jwt}`);
  }
  if (jwt.length === 0) {
    throw new TypeError('subFromJwt: input is empty');
  }
  if (jwt.length > MAX_JWT_BYTES) {
    throw new TypeError(
      `subFromJwt: input exceeds ${MAX_JWT_BYTES} bytes ` +
      `(got ${jwt.length}); refusing to parse`,
    );
  }

  const segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new TypeError(
      `subFromJwt: expected 3 dot-separated segments (header.payload.signature), got ${segments.length}`,
    );
  }

  const payloadB64Url = segments[1]!;
  if (payloadB64Url.length === 0) {
    throw new TypeError('subFromJwt: payload segment is empty');
  }

  // base64url → base64: '-' → '+', '_' → '/', then pad to multiple of 4 with '='.
  const b64 = payloadB64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(padLen);

  let json: string;
  try {
    // The 'base64' encoding in Node tolerates extra padding; what we guard
    // against is *invalid* base64 characters via a strict pre-check.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded)) {
      throw new Error('not valid base64url');
    }
    json = Buffer.from(padded, 'base64').toString('utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TypeError(`subFromJwt: payload is not valid base64url (${msg})`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TypeError(`subFromJwt: decoded payload is not valid JSON (${msg})`);
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new TypeError('subFromJwt: decoded payload is not a JSON object');
  }

  const sub = (payload as Record<string, unknown>)['sub'];
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new TypeError(
      "subFromJwt: payload has no 'sub' claim, or 'sub' is not a non-empty string",
    );
  }

  return sub;
}
