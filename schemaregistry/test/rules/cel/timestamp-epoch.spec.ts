import { describe, expect, it } from '@jest/globals';
import { create } from '@bufbuild/protobuf';
import { TimestampSchema } from '@bufbuild/protobuf/wkt';
import { timestampToEpoch } from '../../../rules/cel/timestamp-funcs';

function ts(seconds: bigint, nanos: number) {
  return create(TimestampSchema, { seconds, nanos })
}

// The reference keeps an Instant and lets Avro's conversion produce an exact long. A JS number
// cannot, so this computes in BigInt and refuses anything outside the safe range rather than
// rounding - the rounded value used to reach avsc, which rejected it as `invalid "long"` while
// naming a number the rule never produced.
describe('timestampToEpoch', () => {
  const seconds = 1788000000n
  const nanos = 123456789

  it('is exact for millis, micros and seconds', () => {
    expect(timestampToEpoch(ts(seconds, nanos), 'millis')).toBe(1788000000123)
    expect(timestampToEpoch(ts(seconds, nanos), 'micros')).toBe(1788000000123456)
    expect(timestampToEpoch(ts(seconds, nanos), 'seconds')).toBe(1788000000)
  })

  it('truncates sub-unit nanos rather than rounding', () => {
    expect(timestampToEpoch(ts(0n, 999999999), 'millis')).toBe(999)
    expect(timestampToEpoch(ts(0n, 999999999), 'micros')).toBe(999999)
    expect(timestampToEpoch(ts(0n, 1), 'millis')).toBe(0)
  })

  it('refuses a nanos epoch it cannot represent exactly', () => {
    expect(() => timestampToEpoch(ts(seconds, nanos), 'nanos'))
      .toThrow('nanos epoch 1788000000123456789 exceeds the safe integer range')
  })

  it('still answers for a nanos epoch inside the safe range', () => {
    // 2^53-1 ns after the epoch is 1970-04-15; anything later cannot be a JS number.
    expect(timestampToEpoch(ts(9007199n, 254740991), 'nanos')).toBe(Number.MAX_SAFE_INTEGER)
    expect(timestampToEpoch(ts(0n, 0), 'nanos')).toBe(0)
  })

  it('rejects an unknown unit', () => {
    expect(() => timestampToEpoch(ts(0n, 0), 'weeks')).toThrow("unknown unit 'weeks'")
  })
})
