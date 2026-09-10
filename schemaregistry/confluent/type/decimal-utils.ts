// Copyright 2026 Confluent Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Conversions between decimal.js `Decimal` and the `confluent.type.Decimal` proto message - the
 * JS counterpart of Java's `io.confluent.protobuf.type.utils.DecimalUtils` (BigDecimal) and C#'s
 * `DecimalExtensions` (System.Decimal). Independent of CEL: the Protobuf serde uses these for
 * `confluent.type.Decimal` fields, and the CEL layer reuses them.
 */

import { Decimal } from "decimal.js";
import { create } from "@bufbuild/protobuf";
import {
  DecimalSchema as ProtoDecimalSchema,
  type Decimal as ProtoDecimal,
} from "./decimal_pb";

/** Decodes big-endian two's-complement bytes to a signed bigint. */
export function bytesToBigIntSigned(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n;
  let result = 0n;
  for (const b of bytes) {
    result = (result << 8n) | BigInt(b);
  }
  if (bytes[0] & 0x80) {
    result -= 1n << BigInt(bytes.length * 8);
  }
  return result;
}

/** Encodes a signed bigint to the minimal big-endian two's-complement byte array. */
export function bigIntToTwosComplementBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([0]);
  const negative = n < 0n;
  // Convert to an unsigned representation, then truncate to the minimal number of bytes that
  // preserve the sign on the high bit. A negative value's magnitude comes from `~n`, which is
  // one less than `-n`: deriving the width from `-n` over-allocates a byte at every exact
  // signed boundary, emitting ff80 for -128 where BigInteger.toByteArray gives 80.
  const bits = (negative ? ~n : n).toString(2).length;
  let byteLen = Math.ceil((bits + 1) / 8);
  if (byteLen === 0) byteLen = 1;
  let v = negative ? (1n << BigInt(byteLen * 8)) + n : n;
  const out = new Uint8Array(byteLen);
  for (let i = byteLen - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Exact fixed-point string for `unscaled * 10^-scale`, never scientific, matching Java
 * `BigDecimal.toPlainString`. A negative scale renders an integer with trailing zeros (unscaled
 * 12 at scale -2 -> "1200"). Building a decimal.js value from this string is lossless for any
 * number of digits, unlike `new Decimal(unscaled).mul(10^-scale)`, whose `.mul` rounds the result
 * to decimal.js's global 20-significant-digit precision.
 */
export function decimalPlainString(unscaled: bigint, scale: number): string {
  const negative = unscaled < 0n;
  let digits = (negative ? -unscaled : unscaled).toString();
  const sign = negative ? "-" : "";
  if (scale === 0) return sign + digits;
  if (scale < 0) return sign + digits + "0".repeat(-scale);
  if (digits.length <= scale) {
    digits = "0".repeat(scale - digits.length + 1) + digits;
  }
  const point = digits.length - scale;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * Exact unscaled integer for `d` at `scale` (i.e. `d * 10^scale`), computed from `d`'s exact
 * fixed-point digits rather than `d.times(10^scale)`, whose multiply rounds to decimal.js's global
 * 20-significant-digit precision. The caller must have already rounded `d` so `d * 10^scale` is an
 * integer (for a negative scale the division below is then exact); {@link toProtoDecimal} passes
 * `d.decimalPlaces()`, which always satisfies this.
 */
/**
 * The digit count of an unscaled value, which is what `BigDecimal.precision()` reports and what
 * the JVM writes into `confluent.type.Decimal.precision`. Zero has precision 1 there.
 *
 * Derived from the unscaled value actually being written rather than from the operand's own
 * digits: the two differ whenever a scale is applied (12.34 at scale 4 is written as 123400,
 * and BigDecimal("12.34").setScale(4).precision() is 6, not 4). Understating it would make a
 * reader that treats precision as a MathContext -- Java and Python both do -- round the value
 * and shift its scale.
 */
export function unscaledPrecision(unscaled: bigint): number {
  const digits = (unscaled < 0n ? -unscaled : unscaled).toString().length;
  return digits === 0 ? 1 : digits;
}

/**
 * The width ceiling for a computation, in decimal digits.
 *
 * Deliberately *not* BigDecimal's - BigInteger tops out at Integer.MAX_VALUE bits, which is
 * 646456993 digits, and reproducing that bound across six decimal libraries is neither
 * achievable nor the point. This is a round number chosen so no single rule evaluation can
 * exhaust memory. It matters more here than anywhere else in the family: a width failure in
 * this client is *process death*, not an exception -
 * `new Decimal.clone({precision:1e9})('1e2147483647').toFixed()` exits 134 on a V8 heap OOM and
 * the surrounding try/catch never runs, so there is nothing to turn into a rule error after
 * the fact.
 */
export const SANE_WIDTH = 10_000_000;

/**
 * A far tighter ceiling on what can be *encoded*, which bounds a different resource.
 *
 * `confluent.type.Decimal.value` is the unscaled integer in base 256, and decimal <-> binary
 * radix conversion is quadratic in every client. 4300 is CPython's own `int_max_str_digits`,
 * the cap it puts on str <-> int conversion for exactly this reason; the Python and C++
 * clients both adopt it, so all three agree on which decimals can be written. CEL's documented
 * decimal precision is 38 digits, so this leaves two orders of headroom over anything a rule
 * is meant to produce.
 */
export const SANE_COEFFICIENT = 4300;

/** A decimal.js value's `(exponent, significant digits)`, without rendering it. */
function shapeOf(d: Decimal): { exponent: number; digits: number } {
  const digits = d.isZero() ? 1 : d.sd();
  // decimal.js's `e` is the exponent of the *first* significant digit, i.e. the adjusted
  // exponent, so the trailing exponent is e - digits + 1.
  return { exponent: d.e - digits + 1, digits };
}

/**
 * Digits in the coefficient `d` would have at `targetScale`.
 *
 * Only *expanding* a scale costs anything - the coefficient grows by the difference.
 * Coarsening one is free at any distance and yields a single digit, so an
 * `abs(shift) + digits` estimate refuses it wrongly: `BigDecimal("1.23").setScale(-100000000)`
 * is precision 1, and measured on libmpdec the same rescale is instant.
 */
export function rescaledDigits(targetScale: number, d: Decimal): number {
  // A zero is one digit at any target scale: rescaling it appends nothing, and the reference
  // agrees (`new BigDecimal(BigInteger.ZERO, 2147483647)` is precision 1). Without this the
  // *carried* scale drove the estimate - `decimal("0E+9000000")` keeps its literal scale on
  // the proto while decimal.js normalises the value itself to e=0 - so encoding a zero was
  // refused for needing 9000001 digits when the coefficient it writes is `0`.
  if (d.isZero()) return 1;
  const { exponent, digits } = shapeOf(d);
  return Math.max(1, digits + targetScale + exponent);
}

/**
 * Characters in `d`'s plain (non-scientific) rendering, to within a couple.
 *
 * Unlike a rescale this pays for the exponent in *both* directions: a positive exponent writes
 * that many trailing zeros and a negative one that many leading zeros, so a one-digit
 * coefficient at an extreme scale still renders enormous.
 */
export function plainFormLength(d: Decimal): number {
  const { exponent, digits } = shapeOf(d);
  return digits + Math.abs(exponent);
}

/**
 * Refuses a positional form too wide to build.
 *
 * Three unrelated-looking things reduce to this one quantity, because each has to materialise a
 * value in positional form: aligning two exponents (`add`, `sub`; `mod` is the same family but
 * bounded by its integral quotient), rescaling (the rounding family), and rendering
 * (`toFixed`, which is also how the wire encoder reads the coefficient).
 *
 * `mul`, `div`, comparison, negation and `abs` are absent deliberately - none of them aligns,
 * and each is measurably cheap at any width. Measured on the shared libmpdec in the Python
 * client, peak RSS on operands 1e2147483647 and 3: mul, div, `<`, `==`, `min`, `neg`, `abs` all
 * 13 MB; add 1738 MB, sub 1738 MB, remainder 1733 MB; and add(1e2147483647, 1e-2147483647)
 * 3125 MB. So the guard follows *alignment*, not arithmetic.
 */
export function requireSaneWidth(
  needed: number,
  fn: string,
  what: string,
  limit: number = SANE_WIDTH,
): void {
  if (needed > limit) {
    throw new Error(
      `${fn}: ${what} needs ${needed} digits, past this client's ${limit}-digit limit`,
    );
  }
}

/**
 * Digits `d` needs once expanded to `targetScale`.
 *
 * A **zero** contributes one digit whatever the distance, because expanding a zero appends
 * none - and that decides several cases outright, since alignment expands only the operand
 * whose scale is coarser. Measured on libmpdec in the Python sibling, with the JDK agreeing on
 * every row: `0E+2e9 + 0E-2e9`, `0E+2e9 + 1` and `0E+2e9 mod 1E-2e9` are all free at one
 * digit, while `0E-2e9 + 1` is 1601 MB and 2e9+1 digits (`ArithmeticException` on the JVM).
 * Only the last must be refused, and the difference is purely which operand expands.
 */
export function operandWidth(targetScale: number, d: Decimal, scale: number): number {
  if (d.isZero()) return 1;
  return d.sd() + (targetScale - scale);
}

/**
 * Guard on the frame `add`/`sub` align their operands in.
 *
 * The scales are passed in rather than read off the `Decimal`s, because decimal.js does not
 * carry a BigDecimal scale: it normalises `1.50` to `1.5` and - the case that matters here -
 * normalises *every* zero to `e = 0`, whatever scale it was built with. So a zero operand's
 * distance from the other one is invisible in the value and has to come from the proto, which
 * is what `scaleOf` reads. Measuring the decimal.js exponents instead made this guard a no-op
 * for a zero operand: `1 + 0E-20000000` aligned to scale 0 as far as the guard could see.
 */
export function requireAlignable(
  a: Decimal, scaleA: number, b: Decimal, scaleB: number, fn: string,
): void {
  const targetScale = Math.max(scaleA, scaleB);
  const needed = Math.max(operandWidth(targetScale, a, scaleA),
    operandWidth(targetScale, b, scaleB)) + 1;
  requireSaneWidth(needed, fn, "aligning the operands");
}

export function decimalToUnscaled(d: Decimal, scale: number): bigint {
  // Every encode funnels through here - the CEL write-back and the serde alike - so this is the
  // one place the coefficient has to be bounded. `toFixed()` below builds the whole positional
  // form and `BigInt(...)` then converts it out of base 10, and neither has a bound of its own:
  // on a value with an extreme exponent the render alone is a V8 heap OOM that kills the
  // process rather than throwing.
  requireSaneWidth(plainFormLength(d), "confluent.type.Decimal", "the plain form");
  requireSaneWidth(rescaledDigits(scale, d), "confluent.type.Decimal", "the coefficient",
    SANE_COEFFICIENT);
  // Zero short-circuits, and this is what makes the guards' zero exemption honest rather than
  // a lie: the multiply at the end of this function builds `10n ** shift` regardless of what
  // it is multiplying, so a zero still paid for the power. Measured: 0.221 s and 49 MB at
  // scale 10^7, and `RangeError: Maximum BigInt size exceeded` at 2^31 - for a value the
  // reference holds at precision 1 (`new BigDecimal(BigInteger.ZERO, 2147483647)`). Same
  // correction the C# client needed in Rescale/SetScale.
  if (d.isZero()) return 0n;
  // `toFixed()` (no argument) yields the exact value in plain notation, unaffected by precision.
  const plain = d.toFixed();
  const negative = plain.startsWith("-");
  const unsigned = negative ? plain.slice(1) : plain;
  const dot = unsigned.indexOf(".");
  const intPart = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const fracPart = dot === -1 ? "" : unsigned.slice(dot + 1);
  let value = BigInt(intPart + fracPart); // digits interpreted at scale = fracPart.length
  const shift = scale - fracPart.length;
  value = shift >= 0 ? value * 10n ** BigInt(shift) : value / 10n ** BigInt(-shift);
  return negative ? -value : value;
}

/** Converts a `confluent.type.Decimal` message to a decimal.js `Decimal`. */
export function fromProtoDecimal(p: ProtoDecimal): Decimal {
  const scale = p.scale ?? 0;
  const unscaled = p.value && p.value.length > 0 ? bytesToBigIntSigned(p.value) : 0n;
  // Exponent notation, not `decimalPlainString`. Both are exact - the point of neither is
  // `.mul`, which would round an unscaled value above 20 significant digits - but the plain
  // form expands the scale into digits *eagerly*, and `scale` here is a producer-controlled
  // int32 arriving off the wire. Measured: scale 3e8 allocates a 300000002-character string
  // (301 MB) before any width guard runs, and past V8's maximum string length it throws
  // `RangeError: Invalid string length`. Exponent notation is O(1) - decimal.js stores digits
  // plus an exponent - so an extreme scale stays cheap here and is refused later by the
  // guards on rendering and encoding, where the digits are actually needed.
  return new Decimal(`${unscaled}e${-scale}`);
}

/**
 * Converts a decimal.js `Decimal` to a `confluent.type.Decimal` message. The scale is taken from
 * `decimalPlaces()`; decimal.js normalizes trailing zeros, so (unlike Java `BigDecimal.scale()`)
 * this does not preserve a trailing-zero scale such as `1.50`.
 */
export function toProtoDecimal(d: Decimal): ProtoDecimal {
  const scale = d.decimalPlaces();
  // Unscaled integer = d * 10^scale, exact since decimalPlaces is the smallest scale that makes
  // d an integer. Computed from d's exact digits so a >20-digit value is not rounded.
  const unscaled = decimalToUnscaled(d, scale);
  return create(ProtoDecimalSchema, {
    value: bigIntToTwosComplementBytes(unscaled),
    scale,
    precision: unscaledPrecision(unscaled),
  });
}

/**
 * Converts a decimal.js `Decimal` to a `confluent.type.Decimal` message at an explicit `scale`,
 * the JS counterpart of Java `BigDecimal.setScale`/`new BigDecimal(unscaled, scale)`. Unlike
 * {@link toProtoDecimal}, this preserves a caller-chosen scale rather than deriving it from
 * `decimalPlaces()`, so a Java-style trailing-zero scale (e.g. `12.34` at scale 2) or a negative
 * scale (e.g. `1200` at scale -2, unscaled `12`) survives round-trip.
 *
 * The caller must have already rounded `d` so it has no more fractional digits than `scale`
 * permits; `d * 10^scale` must be an integer. `decimals.round`/`decimals.trunc` and the
 * `decimal(bytes, scale)` constructor satisfy this.
 */
export function toProtoDecimalWithScale(d: Decimal, scale: number): ProtoDecimal {
  // `scale` is an int32 on the wire, and protobuf-es stores an out-of-range number verbatim
  // rather than refusing it - the failure then surfaces at *serialization* as "cannot encode
  // field confluent.type.Decimal.scale", naming the field rather than the rule.
  //
  // Guarded here rather than at each call site because two paths reach this out of range, and
  // both do so only for **zero** - the plain-form width ceiling below caps a non-zero scale at
  // 9999999, and zero is exempt from it:
  //   decimal("0E-2147483648")                       -> scale 2147483648
  //   decimals.mul(0E-2000000000, 0E-2000000000)     -> scale 4000000000 (the operand scales sum)
  // C++ and Rust already bound the scale at their encoders for the same reason
  // ("decimal scale does not fit the confluent.type.Decimal int32 scale field" /
  // "decimal scale out of int range"), so this makes the seven agree on refusing it.
  //
  // The reference is narrower still on the first case - `new BigDecimal("0E-2147483648")`
  // raises NumberFormatException("Scale out of range.") - and on the second it *saturates* to
  // Integer.MAX_VALUE rather than refusing, because BigDecimal.checkScale saturates when the
  // value is zero and only throws otherwise. Refusing both matches C++ and Rust; the
  // saturation corner is recorded in decimals.md rather than reproduced.
  if (!Number.isInteger(scale) || scale < -2147483648 || scale > 2147483647) {
    throw new RangeError(
      `confluent.type.Decimal: scale ${scale} does not fit the int32 scale field`);
  }
  // Unscaled integer = d * 10^scale. For a negative scale this divides (e.g. 1200 * 10^-2 = 12),
  // which is exact because the caller rounded d to a multiple of 10^-scale. Computed from d's
  // exact digits so a >20-digit value is not rounded to global precision.
  const unscaled = decimalToUnscaled(d, scale);
  return create(ProtoDecimalSchema, {
    value: bigIntToTwosComplementBytes(unscaled),
    scale,
    precision: unscaledPrecision(unscaled),
  });
}
