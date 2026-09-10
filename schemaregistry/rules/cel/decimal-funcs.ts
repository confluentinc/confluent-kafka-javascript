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
 * CEL bindings for the `decimal` constructor and `decimals.*` operators.
 *
 * In-CEL representation: each Decimal value flows as a `ReflectMessage`
 * wrapping a `confluent.type.Decimal` proto (the same wire form used by
 * Avro logical types and Confluent's Protobuf Decimal). `@bufbuild/cel`'s
 * `toCel` accepts ReflectMessages, so passing them through `decimal(...)`
 * and `decimals.*` operators works without registry registration.
 *
 * Division uses a 38-digit precision context with ROUND_HALF_UP to match
 * Flink's MC_DIVIDE / Java BigDecimal reference. Add/sub/mul use exact
 * arithmetic on `decimal.js`.
 */

import { Decimal } from "decimal.js";
import {
  celFunc,
  CelScalar,
  isCelList,
  isCelMap,
  isCelType,
  isCelUint,
  listType,
  objectType,
  type CelFunc,
} from "@bufbuild/cel";
import { equals as equalsMessage } from "@bufbuild/protobuf";
import { isReflectMessage, reflect, type ReflectMessage } from "@bufbuild/protobuf/reflect";
import {
  DecimalSchema as ProtoDecimalSchema,
  type Decimal as ProtoDecimal,
} from "../../confluent/types/decimal_pb";
import {
  SANE_COEFFICIENT,
  bytesToBigIntSigned,
  fromProtoDecimal,
  plainFormLength,
  requireAlignable,
  requireSaneWidth,
  rescaledDigits,
  toProtoDecimal,
  toProtoDecimalWithScale,
} from "../../confluent/types/decimal-utils";

const { DYN, INT, BOOL, STRING, BYTES, DOUBLE } = CelScalar;
const DECIMAL_TYPE = objectType(ProtoDecimalSchema);
const VARIANT_TYPE_NAME = "confluent.type.Variant";

// 38-digit HALF_UP context for division, matching Flink / Java BigDecimal.
const DivDecimal = Decimal.clone({ precision: 38, rounding: Decimal.ROUND_HALF_UP });

// Unbounded context for the operations Java computes exactly: add, sub, mul and mod all use
// java.math.BigDecimal's exact arithmetic, with no precision cap. decimal.js's *global* precision
// is 20 significant digits and it rounds every operation to it, so without this the arithmetic
// silently lost digits above 20 - `decimal("1E38") + decimal("1")` came back as 1E38, and
// multiplying two 20-digit values dropped the low half of the product. 1e9 is decimal.js's maximum
// precision, so this is "effectively unbounded" in the same way BigDecimal is; it carries the same
// exposure to a pathological expression, which is precisely the Java behaviour being matched.
//
// Division and sqrt deliberately keep DivDecimal: Java caps those at 38 digits (see DIV_MC in the
// JVM client), so an unbounded context there would diverge in the other direction.
const ExactDecimal = Decimal.clone({ precision: 1e9 });

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

/**
 * A scale argument as a number, mirroring Java's `requireIntScale`.
 *
 * Java declares every scale parameter as `long` and narrows it with `Math.toIntExact`, so an
 * out-of-int-range value is an error rather than a wildly wrong Decimal; Go, C#, C++, Rust and
 * Python all carry the same check. Without it a wide scale surfaced as a leaked decimal.js
 * `[DecimalError]`, or - for `decimals.trunc` - was swallowed by the no-op early return.
 *
 * A *negative* scale is legitimate (`BigDecimal.setScale(-2)` rounds to hundreds), so only the
 * width is constrained here. The CEL declarations are `[DYN, INT]`, which already rejects a
 * non-integer argument as "no matching overload", exactly as Java's typing does.
 */
function requireIntScale(scale: unknown, fn: string): number {
  const n = typeof scale === "bigint" ? scale : BigInt(Math.trunc(Number(scale)));
  if (n < BigInt(INT32_MIN) || n > BigInt(INT32_MAX)) {
    throw new Error(`${fn}: scale out of int range: ${n}`);
  }
  return Number(n);
}

/**
 * Guard on a rescale: only *expanding* a scale costs anything, and the cost is the resulting
 * coefficient. Coarsening one is free at any distance - `BigDecimal("1.23").setScale(-100000000)`
 * is precision 1 - so `rescaledDigits` returns 1 there and this never fires.
 *
 * Zero is exempt: rescaling it never expands anything and its result stays compact, which
 * BigDecimal agrees with (`new BigDecimal(BigInteger.ZERO, 2147483647)` is precision 1).
 */
/**
 * A zero at `targetScale`, without going through decimal.js's rounding at all.
 *
 * Rescaling a zero is exact at any target - the reference holds it at precision 1 - but
 * decimal.js cannot express the operation: `toDP` rejects a scale above 1e9 outright
 * (`[DecimalError] Invalid argument: 2147483647`) and the negative-target path builds
 * `10^-target` for `toNearest`. Since the answer is just zero at the requested scale, take it
 * directly.
 */
function zeroAtScale(d: Decimal, scale: number): ReflectMessage {
  return decimalToCelScaled(d, scale);
}

function requireRescalable(d: Decimal, targetScale: number, fn: string): void {
  // A negative target does not go through toDP - decimal.js rejects a negative argument there -
  // but through `toNearest(10^-target)`, which *materialises that power of ten*. So unlike
  // libmpdec's rescale, coarsening is not free here: it costs `-targetScale` digits regardless
  // of the operand. Measured, `round(decimal("1.23"), -1000000000)` leaked decimal.js's
  // "Maximum BigInt size exceeded". The cost is the wider of the two.
  const cost = targetScale < 0
    ? Math.max(rescaledDigits(targetScale, d), -targetScale)
    : rescaledDigits(targetScale, d);
  // Zero is exempt from the *rescale* half - rescaling it never expands anything and its result
  // stays compact, as `new BigDecimal(BigInteger.ZERO, n)` does - but not from the multiplier,
  // which is built either way.
  if (d.isZero() && targetScale >= 0) return;
  requireSaneWidth(cost, fn, `a scale of ${targetScale}`);
}

/** An operand in the exact (uncapped) context, so the operation below is not rounded. */
function exact(v: unknown): Decimal {
  return new ExactDecimal(toDecimal(v).toString());
}

function decimalToCel(d: Decimal): ReflectMessage {
  return reflect(ProtoDecimalSchema, toProtoDecimal(d));
}

/**
 * Encodes a decimal.js value at an explicit `scale` (matching Java `BigDecimal.setScale`), rather
 * than the value's normalized `decimalPlaces()`. Used by `decimals.round`/`decimals.trunc` — where
 * the requested scale is the contract (including negative scales, which decimal.js's `toDP` rejects
 * and which round left of the decimal point) — and by the `decimal(bytes, scale)` constructor.
 */
function decimalToCelScaled(d: Decimal, scale: number): ReflectMessage {
  return reflect(ProtoDecimalSchema, toProtoDecimalWithScale(d, scale));
}

/**
 * The BigDecimal *scale* an operand carries, which decimal.js cannot represent.
 *
 * decimal.js normalizes on construction - `new Decimal("2.00")` is indistinguishable from
 * `new Decimal("2")` - so every result encoded through `decimalPlaces()` lost its trailing zeros
 * and `string(decimal("2.00"))` came back as "2" where Java gives "2.00". Scale therefore has to
 * be recovered from the *input* and carried through each operation explicitly (see the scale rules
 * on the `decimals.*` bindings below), then encoded with {@link decimalToCelScaled}.
 *
 * A CEL Decimal already stores its scale on the proto, so a chained expression composes: the
 * result of one operation is read back at the scale that operation assigned it.
 */
function scaleOf(v: unknown): number {
  if (isReflectMessage(v, ProtoDecimalSchema)) return (v.message as ProtoDecimal).scale ?? 0;
  if (v instanceof Decimal) return v.decimalPlaces();
  // uint and int are integral: Java's BigDecimal.valueOf(long) / new BigDecimal(BigInteger).
  if (isCelUint(v) || typeof v === "bigint") return 0;
  if (typeof v === "number") return literalScale(String(v), true);
  if (typeof v === "string") return literalScale(v, false);
  if (typeof v === "object" && v !== null) {
    const anyV = v as any;
    if (anyV.$typeName === "confluent.type.Decimal") return anyV.scale ?? 0;
  }
  return 0;
}

/**
 * The scale of a numeric literal: fractional digits minus the exponent, so `"2.00"` is 2,
 * `"1e-5"` is 5 and `"1E+3"` is -3 (all matching `new BigDecimal(String)`).
 *
 * `fromDouble` reproduces *one* rule of `BigDecimal.valueOf(double)`, which routes through
 * `Double.toString`: that always emits at least one fractional digit ("5.0", "1.0E30"). So
 * `decimal(5.0)` is scale 1 in Java, where JS's own `String(5)` would suggest 0. A double
 * literal therefore never has scale 0, while the string `decimal("5")` correctly does.
 *
 * It does **not** reproduce `Double.toString`'s other rule - plain notation only for
 * 1e-3 <= |d| < 1e7 - so the digits still come from JS's own formatter and the scale can
 * differ from Java's above 1e7: `decimal(1e7)` is scale 1 here against Java's -6, and
 * `decimal(123456789.0)` scale 1 against 0. Byte-identical float/double rendering across the
 * clients was designed, implemented in all seven and then deliberately backed out on cost, so
 * each client keeps its native digits; do not "fix" this toward Java without revisiting that.
 */
function literalScale(text: string, fromDouble: boolean): number {
  const m = /^[+-]?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (m === null) return 0;
  let fractionDigits = m[2] !== undefined ? m[2].length : 0;
  if (fromDouble && fractionDigits === 0) fractionDigits = 1;
  const exponent = m[3] !== undefined ? Number.parseInt(m[3], 10) : 0;
  return fractionDigits - exponent;
}

function toDecimal(v: unknown): Decimal {
  if (v === null || v === undefined) {
    throw new Error("decimal: cannot convert null to Decimal");
  }
  // CEL passes proto messages as ReflectMessage.
  if (isReflectMessage(v, ProtoDecimalSchema)) {
    return fromProtoDecimal(v.message as ProtoDecimal);
  }
  if (v instanceof Decimal) return v;
  if (typeof v === "boolean") {
    throw new Error("decimal: cannot convert bool to Decimal");
  }
  // CEL surfaces `uint` (proto uint32/uint64 fields, uint literals) as a CelUint wrapper
  // carrying an unsigned bigint on `.value` — distinct from `int`, which arrives as a bare
  // bigint. Unwrap to that bigint so the full unsigned range converts exactly (a uint64 above
  // 2^63 must not wrap negative). Mirrors Java's UnsignedLong -> BigInteger -> BigDecimal arm.
  if (isCelUint(v)) {
    return new Decimal(v.value.toString());
  }
  if (typeof v === "bigint" || typeof v === "number" || typeof v === "string") {
    try {
      return new Decimal(v as Decimal.Value);
    } catch (e) {
      throw new Error(`decimal: invalid number '${v}'`);
    }
  }
  if (typeof v === "object" && v !== null) {
    const anyV = v as any;
    // Bare confluent.type.Decimal proto message (not yet wrapped in Reflect).
    if (anyV.$typeName === "confluent.type.Decimal") {
      return fromProtoDecimal(anyV as ProtoDecimal);
    }
    if (v instanceof Uint8Array) {
      throw new Error(
        "decimal: raw bytes need a scale; use decimal(bytes, scale)",
      );
    }
  }
  throw new Error(`decimal: cannot convert ${typeof v} to Decimal`);
}

export function decimalFromBytesScale(value: unknown, scale: unknown): ReflectMessage {
  if (!(value instanceof Uint8Array)) {
    throw new Error(
      `decimal: expected bytes for the (bytes, scale) overload, got ${typeof value}`,
    );
  }
  const s = requireIntScale(scale, "decimal(bytes, scale)");
  // Preserve the requested scale (matching Java `new BigDecimal(unscaled, scale)`): decimal.js
  // normalizes trailing zeros, so encoding via decimalPlaces() would drop a trailing-zero scale
  // (e.g. unscaled 1990 at scale 2 = 19.90, not 19.9). See decimalToCelScaled.
  // Build the decimal.js value exactly, via exponent notation; `.mul(10^-s)` would round an
  // unscaled value above 20 significant digits to decimal.js's global precision, and the plain
  // form would expand the scale into digits eagerly - a scale of 3e8 is a 301 MB string.
  // Exponent notation is O(1) and just as exact.
  // The coefficient is the width risk on this path; the scale is not, since it only shifts the
  // exponent. Checked from the byte count before bytesToBigIntSigned builds the integer - one
  // byte carries about 2.41 decimal digits - and against the *encodable* ceiling, since a
  // coefficient this client cannot write back is not worth reading in.
  requireSaneWidth(Math.trunc(value.length * 2.408) + 1, "decimal(bytes, scale)",
    "the coefficient", SANE_COEFFICIENT);
  const unscaled = value.length === 0 ? 0n : bytesToBigIntSigned(value);
  return decimalToCelScaled(new Decimal(`${unscaled}e${-s}`), s);
}

/** Whether a CEL value is a Decimal this module can encode back to Avro. */
export function isCelDecimal(value: unknown): boolean {
  return isReflectMessage(value, ProtoDecimalSchema) || value instanceof Decimal;
}

/**
 * Encodes a CEL Decimal to Avro's unscaled two's-complement bytes at the field's `scale`
 * (HALF_UP), the inverse of {@link decimalFromBytesScale}. A value whose scale differs from the
 * schema (e.g. after a multiply) is re-quantized to the schema scale, matching the other clients.
 */
export function decimalToAvroBytes(value: unknown, scale: number): Uint8Array {
  // Round to the schema scale first, then take the unscaled digits exactly. Multiplying by
  // 10^scale in the default context applied decimal.js's global 20-digit precision and
  // silently truncated anything wider - the same trap ExactDecimal exists to avoid above.
  const d = toDecimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
  return toProtoDecimalWithScale(d, scale).value;
}

function fromConstructorArg(v: unknown): ReflectMessage {
  return decimalToCelScaled(toDecimal(v), scaleOf(v));
}

/**
 * greatest/least return one of the *operands* rather than a recomputed value, so the result keeps
 * that operand's scale - Java's `BigDecimal.max`/`min` return `this` or `val` unchanged. A tie
 * returns the first argument, matching `compareTo(val) >= 0 ? this : val`, which is why
 * `greatest(decimal("2.00"), decimal("2.0"))` is "2.00" but `greatest(decimal("2.0"),
 * decimal("2.00"))` is "2.0".
 */
function selectDecimal(a: unknown, b: unknown, greatest: boolean): ReflectMessage {
  const cmp = toDecimal(a).cmp(toDecimal(b));
  const chosen = (greatest ? cmp >= 0 : cmp <= 0) ? a : b;
  return decimalToCelScaled(toDecimal(chosen), scaleOf(chosen));
}

/**
 * Extension of CEL stdlib `string(...)` with a Decimal arm.
 *
 * For ReflectMessages of confluent.type.Decimal, returns plain decimal
 * notation (no scientific form). Otherwise delegates to stdlib semantics.
 */
function stringExt(v: unknown): string {
  if (isReflectMessage(v, ProtoDecimalSchema)) {
    // Render at the proto's stored scale so a Java-style trailing-zero scale survives (e.g.
    // scale 2 -> "12.30", not "12.3"), matching BigDecimal.toPlainString. A negative scale
    // means an integer value, so render with no fractional digits.
    const p = v.message as ProtoDecimal;
    const scale = p.scale ?? 0;
    const d = fromProtoDecimal(p);
    // `toFixed` writes every digit of the positional form, and that form can be enormous for a
    // value that was cheap to compute: `div` holds its coefficient to 38 digits while its
    // exponent runs free. In this client an over-wide render is a V8 heap OOM, so it has to be
    // refused rather than attempted. No zero shortcut - a zero at an extreme scale renders as
    // that many zeros.
    requireSaneWidth(plainFormLength(d), "string", "the plain form");
    return d.toFixed(scale > 0 ? scale : 0);
  }
  if (v instanceof Decimal) {
    requireSaneWidth(plainFormLength(v), "string", "the plain form");
    return v.toFixed();
  }
  // Fall through to stdlib semantics for the non-Decimal case.
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return v.toString();
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  return String(v);
}

/**
 * Extension of CEL stdlib `double(...)` with a Decimal arm.
 *
 * For ReflectMessages of confluent.type.Decimal (and decimal.js values),
 * returns the narrowed 64-bit double (may lose precision; out-of-range
 * magnitudes become ±Infinity). Otherwise delegates to stdlib semantics.
 */
function doubleExt(v: unknown): number {
  if (isReflectMessage(v, ProtoDecimalSchema)) {
    return fromProtoDecimal(v.message as ProtoDecimal).toNumber();
  }
  if (v instanceof Decimal) return v.toNumber();
  // Fall through to stdlib semantics for the non-Decimal case.
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  return Number(v as Decimal.Value);
}

function equalsBytes(lhs: Uint8Array, rhs: Uint8Array): boolean {
  if (lhs.length !== rhs.length) return false;
  for (let i = 0; i < lhs.length; i++) {
    if (lhs[i] !== rhs[i]) return false;
  }
  return true;
}

// Both container helpers recurse through celEqualsWithDecimal, NOT celEquals, so a Decimal nested
// in a list/map gets the same numeric (scale-insensitive) treatment as a top-level one. cel-es
// recurses into its own `equals`, which would compare nested Decimals field-by-field (unscaled
// bytes + scale) and call `[decimal(b"\x14", 1)] == [decimal(b"\x00\xc8", 2)]` (2.0 vs 2.00) false.
//
// The mutual recursion terminates: celEqualsWithDecimal short-circuits on a Decimal pair before
// delegating to celEquals, and celEquals reaches these helpers only for list/map operands, so every
// cycle descends one level into a (finite, acyclic) container. Non-Decimal pairs are unaffected —
// celEqualsWithDecimal falls straight through to celEquals for them.
function equalsCelList(lhs: any, rhs: any): boolean {
  if (lhs.size !== rhs.size) return false;
  for (let i = 0; i < lhs.size; i++) {
    if (!celEqualsWithDecimal(lhs.get(i), rhs.get(i))) return false;
  }
  return true;
}

function equalsCelMap(lhs: any, rhs: any): boolean {
  if (lhs.size !== rhs.size) return false;
  for (const [k, v] of lhs) {
    const rv = rhs.get(k);
    if (rv === undefined || !celEqualsWithDecimal(v, rv)) return false;
  }
  return true;
}

/**
 * Faithful port of @bufbuild/cel's internal `equals` (its `_==_` [dyn, dyn] impl), which is not
 * exported. Numeric int/uint/double compare across types; bytes/list/map/type/message compare by
 * value with matching types. Kept in sync so replacing the stdlib `_==_` overload (see
 * {@link celEqualsWithDecimal}) does not change equality for any non-Decimal operand. The one
 * deliberate divergence from cel-es: list/map recursion goes through
 * {@link celEqualsWithDecimal} (see {@link equalsCelList}), so nested Decimals compare numerically.
 */
function celEquals(lhs: unknown, rhs: unknown): boolean {
  if (lhs === rhs) return true;
  let l: unknown = lhs;
  let r: unknown = rhs;
  if (isCelUint(l)) l = l.value;
  if (isCelUint(r)) r = r.value;
  if (
    (typeof l === "number" || typeof l === "bigint") &&
    (typeof r === "number" || typeof r === "bigint")
  ) {
    return l == r; // cross-type numeric equality (loose, so 1n == 1)
  }
  if (l instanceof Uint8Array) return r instanceof Uint8Array && equalsBytes(l, r);
  if (isCelList(l)) return isCelList(r) && equalsCelList(l, r);
  if (isCelMap(l)) return isCelMap(r) && equalsCelMap(l, r);
  if (isCelType(l)) return isCelType(r) && l.kind === r.kind && l.name === r.name;
  if (isReflectMessage(l)) {
    if (!isReflectMessage(r)) return false;
    if (l.desc.typeName !== r.desc.typeName) return false;
    // Variant is compared by identity, not structurally, which the `lhs === rhs` fast path
    // above has already settled - so two distinct Variants are unequal however alike their
    // bytes. That is the reference behaviour, measured: io.confluent...type.Variant declares no
    // equals(), so cel-java falls back to Object.equals and
    //   variants.parseJson("1") == variants.parseJson("1")   -> false
    //   variant(this)           == variant(this)             -> false
    //   variants.parseJson("1") != variants.parseJson("1")   -> true
    // Structural comparison here made the first two true, because this client carries a
    // Variant as a proto *message* where Java carries a plain object - so cel-es's message
    // equality applied where Java's reference equality does. The docstring on
    // celEqualsWithDecimal already claimed identity; only the code disagreed.
    if (l.desc.typeName === VARIANT_TYPE_NAME) return false;
    return equalsMessage(l.desc, l.message, r.message, {
      unpackAny: true,
      unknown: true,
      extensions: true,
    } as any);
  }
  return false;
}

/**
 * Replacement for the CEL stdlib `_==_`/`_!=_` [dyn, dyn] overload that makes `==` on two Decimals
 * NUMERIC (value-equal, scale-insensitive), matching `decimals.eq`. cel-es compares two
 * confluent.type.Decimal messages field-by-field (unscaled bytes + scale), so a scale-preserving
 * `decimal(bytes, 1)` for 2.0 (scale 1) would not equal `decimal("2.0")` (scale 0) despite being
 * numerically equal. Registering this with the same [dyn, dyn] signature as the stdlib overload
 * makes @bufbuild/cel's group dedup (by func id) replace the stdlib one with this. Every
 * non-Decimal operand pair falls through to {@link celEquals}, preserving stdlib semantics
 * (including message-identity `==` for Variant, which is intentionally unchanged).
 *
 * This is also the entry point for nested comparisons: {@link equalsCelList}/{@link equalsCelMap}
 * recurse here, so Decimals inside lists/maps (at any depth) are numeric too.
 */
function celEqualsWithDecimal(lhs: unknown, rhs: unknown): boolean {
  if (
    isReflectMessage(lhs, ProtoDecimalSchema) &&
    isReflectMessage(rhs, ProtoDecimalSchema)
  ) {
    return (
      fromProtoDecimal(lhs.message as ProtoDecimal).cmp(
        fromProtoDecimal(rhs.message as ProtoDecimal),
      ) === 0
    );
  }
  return celEquals(lhs, rhs);
}

export const DECIMAL_FUNCS: CelFunc[] = [
  // ---- equality (numeric for Decimals; stdlib semantics otherwise) ----
  // Same [DYN, DYN] signature as the stdlib `_==_`/`_!=_`, so @bufbuild/cel's func-group dedup
  // replaces the stdlib overload with these (a Decimal-specific overload would not win: the
  // stdlib [DYN, DYN] matches first). See celEqualsWithDecimal.
  celFunc("_==_", [DYN, DYN], BOOL, (a, b) => celEqualsWithDecimal(a, b)),
  celFunc("_!=_", [DYN, DYN], BOOL, (a, b) => !celEqualsWithDecimal(a, b)),

  // `in` over a list is a SEPARATE stdlib overload (`@in(dyn,list)`), whose impl calls cel-es's
  // internal `equals` directly — it never consults the `_==_` override above, so
  // `decimal(b"\x14", 1) in [decimal(b"\x00\xc8", 2)]` (2.0 in [2.00]) was false while `==` on the
  // same pair was true. Re-implement it over celEqualsWithDecimal so membership is numeric for
  // Decimals (including Decimals nested inside the list's elements) and byte-for-byte stdlib
  // semantics for everything else. The [DYN, list(dyn)] signature reproduces the stdlib id exactly,
  // so the func-group dedup replaces that overload. The `@in(<scalar>,map)` overloads are
  // deliberately left alone — a Decimal is not a valid CEL map key.
  celFunc("@in", [DYN, listType(DYN)], BOOL, (value, list) => {
    for (const v of list) {
      if (celEqualsWithDecimal(v, value)) return true;
    }
    return false;
  }),

  // ---- constructor ----
  celFunc("decimal", [DYN], DECIMAL_TYPE, (v) => fromConstructorArg(v)),
  celFunc("decimal", [BYTES, INT], DECIMAL_TYPE, (bytes, scale) =>
    decimalFromBytesScale(bytes, scale),
  ),

  // ---- comparison (no `.ne` — rules use `!decimals.eq(...)`) ----
  celFunc("decimals.eq", [DYN, DYN], BOOL, (a, b) => toDecimal(a).cmp(toDecimal(b)) === 0),
  celFunc("decimals.lt", [DYN, DYN], BOOL, (a, b) => toDecimal(a).cmp(toDecimal(b)) < 0),
  celFunc("decimals.le", [DYN, DYN], BOOL, (a, b) => toDecimal(a).cmp(toDecimal(b)) <= 0),
  celFunc("decimals.gt", [DYN, DYN], BOOL, (a, b) => toDecimal(a).cmp(toDecimal(b)) > 0),
  celFunc("decimals.ge", [DYN, DYN], BOOL, (a, b) => toDecimal(a).cmp(toDecimal(b)) >= 0),

  // ---- arithmetic ----
  // Result scales follow java.math.BigDecimal exactly: add/sub take max(s1, s2), mul takes
  // s1 + s2. The exact result never needs more fractional digits than that, so encoding at the
  // derived scale only ever pads with the trailing zeros decimal.js dropped.
  // add/sub align their operands, so the aligned frame has to be built before a single digit is
  // computed. ExactDecimal's precision is 1e9, so nothing below this bounds it, and in this
  // client an over-wide alignment is a V8 heap OOM that kills the process rather than throwing.
  celFunc("decimals.add", [DYN, DYN], DECIMAL_TYPE, (a, b) => {
    const [x, y] = [exact(a), exact(b)];
    requireAlignable(x, scaleOf(a), y, scaleOf(b), "decimals.add");
    return decimalToCelScaled(x.plus(y), Math.max(scaleOf(a), scaleOf(b)));
  }),
  celFunc("decimals.sub", [DYN, DYN], DECIMAL_TYPE, (a, b) => {
    const [x, y] = [exact(a), exact(b)];
    requireAlignable(x, scaleOf(a), y, scaleOf(b), "decimals.sub");
    return decimalToCelScaled(x.minus(y), Math.max(scaleOf(a), scaleOf(b)));
  }),
  // mul is unguarded at any width: it adds the exponents and multiplies the coefficients, so
  // the result is as compact as its operands. Measured at 13 MB where add costs 1738 MB.
  celFunc("decimals.mul", [DYN, DYN], DECIMAL_TYPE, (a, b) =>
    decimalToCelScaled(exact(a).times(exact(b)), scaleOf(a) + scaleOf(b)),
  ),
  // div is the one arithmetic operation with no derived scale: BigDecimal.divide(MathContext)
  // yields the exact quotient's own scale, or 38 significant digits when it does not terminate
  // (`10.0/2.0` is "5", not "5.0"). That is what decimal.js produces natively, so it stays on
  // decimalToCel.
  celFunc("decimals.div", [DYN, DYN], DECIMAL_TYPE, (a, b) => {
    const bd = toDecimal(b);
    if (bd.isZero()) throw new Error("decimals.div: division by zero");
    return decimalToCel(new DivDecimal(toDecimal(a).toString()).div(bd.toString()));
  }),
  // Modulo: remainder with the sign of the dividend (default modulo mode
  // ROUND_DOWN), matching Java BigDecimal.remainder and SQL MOD. Throws on a
  // zero divisor.
  celFunc("decimals.mod", [DYN, DYN], DECIMAL_TYPE, (a, b) => {
    const bd = toDecimal(b);
    if (bd.isZero()) throw new Error("decimals.mod: division by zero");
    // Exact, not DivDecimal: BigDecimal.remainder is exact. A remainder is smaller than the
    // divisor so the 38-digit cap was almost always enough, but "almost" is not the contract.
    // Scale is max(s1, s2), as for add/sub.
    //
    // The remainder itself is small, but the *integral quotient* has to be produced to get
    // there, and that is the width. Not the aligned frame add/sub use: the quotient is narrow
    // whenever the magnitudes are close or the dividend is the smaller, and measured on the
    // shared libmpdec `1e-2147483647 mod 1e2147483647` and `1e2147483647 mod 1e2147483000` are
    // both free while the frame for each is 4.3e9 digits.
    const [x, y] = [exact(a), exact(b)];
    // A zero dividend has a quotient of zero whatever the scales, and its adjusted exponent
    // says nothing useful - a zero keeps the scale it was built with. Free everywhere it was
    // measured, and the JDK returns 0 at precision 1.
    requireSaneWidth(x.isZero() ? 1 : Math.max(0, x.e - y.e) + 1,
      "decimals.mod", "the integral quotient");
    return decimalToCelScaled(x.mod(y), Math.max(scaleOf(a), scaleOf(b)));
  }),

  // ---- selection ----
  // greatest/least return the larger/smaller operand (no rounding), keeping its scale.
  celFunc("decimals.greatest", [DYN, DYN], DECIMAL_TYPE, (a, b) => selectDecimal(a, b, true)),
  celFunc("decimals.least", [DYN, DYN], DECIMAL_TYPE, (a, b) => selectDecimal(a, b, false)),

  // ---- square root ----
  // 38-digit HALF_UP precision (same context as div). decimal.js's sqrt()
  // returns NaN on a negative value, so guard explicitly and throw the
  // canonical message instead. Zero (and -0) pass through to sqrt(0) = 0.
  celFunc("decimals.sqrt", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    if (d.lt(0)) throw new Error("decimals.sqrt: square root of negative number");
    const root = new DivDecimal(d.toString()).sqrt();
    // BigDecimal.sqrt's preferred scale is scale/2, applied only when the root is exact:
    // sqrt(9.0000) is "3.00" and sqrt(100.000) is "10.0", but sqrt(2) keeps all 38 digits. The
    // squaring is done in the exact context so a rounded root cannot masquerade as exact.
    const exactRoot = new ExactDecimal(root.toString()).pow(2).eq(d);
    const scale = exactRoot
      ? Math.max(Math.trunc(scaleOf(a) / 2), root.decimalPlaces())
      : root.decimalPlaces();
    return decimalToCelScaled(root, scale);
  }),

  // ---- unary ----
  // Negation and absolute value leave the scale untouched (BigDecimal.negate/abs).
  celFunc("decimals.neg", [DYN], DECIMAL_TYPE, (a) =>
    decimalToCelScaled(toDecimal(a).negated(), scaleOf(a)),
  ),
  celFunc("decimals.abs", [DYN], DECIMAL_TYPE, (a) =>
    decimalToCelScaled(toDecimal(a).abs(), scaleOf(a)),
  ),
  celFunc("decimals.sign", [DYN], INT, (a) => {
    const d = toDecimal(a);
    if (d.isZero()) return 0n;
    return d.isNegative() ? -1n : 1n;
  }),

  // ---- rounding family ----
  // round matches Java BigDecimal.setScale(scale, HALF_UP): the result always carries exactly the
  // requested scale (so round(2.5, 2) -> "2.50"). A negative scale rounds left of the decimal
  // point (round(1234.5, -2) -> 1200). decimal.js's toDP rejects a negative scale, so route those
  // through toNearest(10^-scale), which rounds to the nearest multiple.
  celFunc("decimals.round", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    requireRescalable(d, 0, "decimals.round");
    return decimalToCelScaled(d.toDP(0, Decimal.ROUND_HALF_UP), 0);
  }),
  celFunc("decimals.round", [DYN, INT], DECIMAL_TYPE, (a, scale) => {
    const d = toDecimal(a);
    const n = requireIntScale(scale, "decimals.round");
    if (d.isZero()) return zeroAtScale(d, n);
    requireRescalable(d, n, "decimals.round");
    const rounded = n >= 0
      ? d.toDP(n, Decimal.ROUND_HALF_UP)
      : d.toNearest(new Decimal(10).pow(-n), Decimal.ROUND_HALF_UP);
    return decimalToCelScaled(rounded, n);
  }),
  // Flink's TRUNCATE early-returns when the target scale is at-or-finer than
  // the current scale — it's a no-op there, so the result keeps the input's
  // representation. Without this guard, toDP(n>=cur, DOWN) would zero-pad and
  // string(trunc(x, n>=cur)) would diverge from Flink.
  // The no-op comparison is against the operand's *scale*, not decimal.js's normalized
  // decimalPlaces(): trunc(decimal("1.50"), 4) must stay "1.50", and reading 1 rather than 2
  // there would have re-encoded it as "1.5".
  celFunc("decimals.trunc", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    const current = scaleOf(a);
    if (current <= 0) return decimalToCelScaled(d, current);
    requireRescalable(d, 0, "decimals.trunc");
    return decimalToCelScaled(d.toDP(0, Decimal.ROUND_DOWN), 0);
  }),
  celFunc("decimals.trunc", [DYN, INT], DECIMAL_TYPE, (a, scale) => {
    const d = toDecimal(a);
    const target = requireIntScale(scale, "decimals.trunc");
    // Negative scale truncates left of the decimal point toward zero (trunc(1234.5, -2) -> 1200),
    // matching Java setScale(target, DOWN); toDP rejects it, so use toNearest with ROUND_DOWN.
    if (d.isZero()) return zeroAtScale(d, target);
    requireRescalable(d, target, "decimals.trunc");
    if (target < 0) {
      return decimalToCelScaled(d.toNearest(new Decimal(10).pow(-target), Decimal.ROUND_DOWN), target);
    }
    const current = scaleOf(a);
    if (target >= current) return decimalToCelScaled(d, current);
    return decimalToCelScaled(d.toDP(target, Decimal.ROUND_DOWN), target);
  }),
  // floor/ceil target scale 0 without going through the round/trunc bindings, so they carry
  // the same bound. Reachable from a rule that names no scale at all.
  celFunc("decimals.floor", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    requireRescalable(d, 0, "decimals.floor");
    return decimalToCel(d.toDP(0, Decimal.ROUND_FLOOR));
  }),
  celFunc("decimals.ceil", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    requireRescalable(d, 0, "decimals.ceil");
    return decimalToCel(d.toDP(0, Decimal.ROUND_CEIL));
  }),

  // ---- string(Decimal) — extends stdlib string() with a Decimal arm ----
  celFunc("string", [DYN], STRING, (v) => stringExt(v)),

  // ---- double(Decimal) — extends stdlib double() with a Decimal arm ----
  celFunc("double", [DYN], DOUBLE, (v) => doubleExt(v)),
];
