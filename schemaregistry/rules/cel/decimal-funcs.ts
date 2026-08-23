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
  bigIntToTwosComplementBytes,
  bytesToBigIntSigned,
  decimalPlainString,
  fromProtoDecimal,
  toProtoDecimal,
  toProtoDecimalWithScale,
} from "../../confluent/types/decimal-utils";

const { DYN, INT, BOOL, STRING, BYTES, DOUBLE } = CelScalar;
const DECIMAL_TYPE = objectType(ProtoDecimalSchema);

// 38-digit HALF_UP context for division, matching Flink / Java BigDecimal.
const DivDecimal = Decimal.clone({ precision: 38, rounding: Decimal.ROUND_HALF_UP });

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
  const s = typeof scale === "bigint" ? Number(scale) : (scale as number);
  // Preserve the requested scale (matching Java `new BigDecimal(unscaled, scale)`): decimal.js
  // normalizes trailing zeros, so encoding via decimalPlaces() would drop a trailing-zero scale
  // (e.g. unscaled 1990 at scale 2 = 19.90, not 19.9). See decimalToCelScaled.
  // Build the decimal.js value exactly from the unscaled+scale plain string; `.mul(10^-s)` would
  // round an unscaled value above 20 significant digits to decimal.js's global precision.
  const unscaled = value.length === 0 ? 0n : bytesToBigIntSigned(value);
  return decimalToCelScaled(new Decimal(decimalPlainString(unscaled, s)), s);
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
  const d = toDecimal(value);
  const unscaled = BigInt(
    d.mul(new Decimal(10).pow(scale)).toFixed(0, Decimal.ROUND_HALF_UP),
  );
  return bigIntToTwosComplementBytes(unscaled);
}

function fromConstructorArg(v: unknown): ReflectMessage {
  return decimalToCel(toDecimal(v));
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
    return fromProtoDecimal(p).toFixed(scale > 0 ? scale : 0);
  }
  if (v instanceof Decimal) return v.toFixed();
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
  celFunc("decimals.add", [DYN, DYN], DECIMAL_TYPE, (a, b) => decimalToCel(toDecimal(a).plus(toDecimal(b)))),
  celFunc("decimals.sub", [DYN, DYN], DECIMAL_TYPE, (a, b) => decimalToCel(toDecimal(a).minus(toDecimal(b)))),
  celFunc("decimals.mul", [DYN, DYN], DECIMAL_TYPE, (a, b) => decimalToCel(toDecimal(a).times(toDecimal(b)))),
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
    return decimalToCel(new DivDecimal(toDecimal(a).toString()).mod(bd.toString()));
  }),

  // ---- selection ----
  // greatest/least return the larger/smaller operand (no rounding).
  celFunc("decimals.greatest", [DYN, DYN], DECIMAL_TYPE,
    (a, b) => decimalToCel(Decimal.max(toDecimal(a), toDecimal(b)))),
  celFunc("decimals.least", [DYN, DYN], DECIMAL_TYPE,
    (a, b) => decimalToCel(Decimal.min(toDecimal(a), toDecimal(b)))),

  // ---- square root ----
  // 38-digit HALF_UP precision (same context as div). decimal.js's sqrt()
  // returns NaN on a negative value, so guard explicitly and throw the
  // canonical message instead. Zero (and -0) pass through to sqrt(0) = 0.
  celFunc("decimals.sqrt", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    if (d.lt(0)) throw new Error("decimals.sqrt: square root of negative number");
    return decimalToCel(new DivDecimal(d.toString()).sqrt());
  }),

  // ---- unary ----
  celFunc("decimals.neg", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).negated())),
  celFunc("decimals.abs", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).abs())),
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
  celFunc("decimals.round", [DYN], DECIMAL_TYPE, (a) =>
    decimalToCelScaled(toDecimal(a).toDP(0, Decimal.ROUND_HALF_UP), 0),
  ),
  celFunc("decimals.round", [DYN, INT], DECIMAL_TYPE, (a, scale) => {
    const d = toDecimal(a);
    const n = Number(scale);
    const rounded = n >= 0
      ? d.toDP(n, Decimal.ROUND_HALF_UP)
      : d.toNearest(new Decimal(10).pow(-n), Decimal.ROUND_HALF_UP);
    return decimalToCelScaled(rounded, n);
  }),
  // Flink's TRUNCATE early-returns when the target scale is at-or-finer than
  // the current scale — it's a no-op there, so the result keeps the input's
  // representation. Without this guard, toDP(n>=cur, DOWN) would zero-pad and
  // string(trunc(x, n>=cur)) would diverge from Flink.
  celFunc("decimals.trunc", [DYN], DECIMAL_TYPE, (a) => {
    const d = toDecimal(a);
    return decimalToCel(d.decimalPlaces() <= 0 ? d : d.toDP(0, Decimal.ROUND_DOWN));
  }),
  celFunc("decimals.trunc", [DYN, INT], DECIMAL_TYPE, (a, scale) => {
    const d = toDecimal(a);
    const target = Number(scale);
    // Negative scale truncates left of the decimal point toward zero (trunc(1234.5, -2) -> 1200),
    // matching Java setScale(target, DOWN); toDP rejects it, so use toNearest with ROUND_DOWN.
    if (target < 0) {
      return decimalToCelScaled(d.toNearest(new Decimal(10).pow(-target), Decimal.ROUND_DOWN), target);
    }
    return decimalToCel(target >= d.decimalPlaces() ? d : d.toDP(target, Decimal.ROUND_DOWN));
  }),
  celFunc("decimals.floor", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).toDP(0, Decimal.ROUND_FLOOR))),
  celFunc("decimals.ceil", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).toDP(0, Decimal.ROUND_CEIL))),

  // ---- string(Decimal) — extends stdlib string() with a Decimal arm ----
  celFunc("string", [DYN], STRING, (v) => stringExt(v)),

  // ---- double(Decimal) — extends stdlib double() with a Decimal arm ----
  celFunc("double", [DYN], DOUBLE, (v) => doubleExt(v)),
];
