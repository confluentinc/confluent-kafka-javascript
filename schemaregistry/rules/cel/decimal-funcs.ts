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
import { celFunc, CelScalar, objectType, type CelFunc } from "@bufbuild/cel";
import { create } from "@bufbuild/protobuf";
import { isReflectMessage, reflect, type ReflectMessage } from "@bufbuild/protobuf/reflect";
import {
  DecimalSchema as ProtoDecimalSchema,
  type Decimal as ProtoDecimal,
} from "../../confluent/types/decimal_pb";

const { DYN, INT, BOOL, STRING, BYTES, DOUBLE } = CelScalar;
const DECIMAL_TYPE = objectType(ProtoDecimalSchema);

// 38-digit HALF_UP context for division, matching Flink / Java BigDecimal.
const DivDecimal = Decimal.clone({ precision: 38, rounding: Decimal.ROUND_HALF_UP });

function bytesToBigIntSigned(bytes: Uint8Array): bigint {
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

function bigIntToTwosComplementBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([0]);
  const negative = n < 0n;
  // Convert to an unsigned representation, then truncate the minimal number
  // of bytes that preserve sign on the high bit.
  let bits = (negative ? -n : n).toString(2).length;
  // For positive numbers, ensure the top bit is 0.
  // For negative numbers, ensure the top bit is 1.
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

function protoToDecimal(p: ProtoDecimal): Decimal {
  const value = p.value;
  const scale = p.scale ?? 0;
  if (!value || value.length === 0) {
    return new Decimal(0).mul(new Decimal(10).pow(-scale));
  }
  return new Decimal(bytesToBigIntSigned(value).toString()).mul(
    new Decimal(10).pow(-scale),
  );
}

function decimalToProto(d: Decimal): ProtoDecimal {
  const scale = d.decimalPlaces();
  // Unscaled integer = d * 10^scale, exact (since decimalPlaces is the
  // smallest scale that makes d an integer).
  const unscaled = BigInt(d.times(new Decimal(10).pow(scale)).toFixed(0));
  return create(ProtoDecimalSchema, {
    value: bigIntToTwosComplementBytes(unscaled),
    scale,
    precision: 0,
  });
}

function decimalToCel(d: Decimal): ReflectMessage {
  return reflect(ProtoDecimalSchema, decimalToProto(d));
}

function toDecimal(v: unknown): Decimal {
  if (v === null || v === undefined) {
    throw new Error("decimal: cannot convert null to Decimal");
  }
  // CEL passes proto messages as ReflectMessage.
  if (isReflectMessage(v, ProtoDecimalSchema)) {
    return protoToDecimal(v.message as ProtoDecimal);
  }
  if (v instanceof Decimal) return v;
  if (typeof v === "boolean") {
    throw new Error("decimal: cannot convert bool to Decimal");
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
      return protoToDecimal(anyV as ProtoDecimal);
    }
    if (v instanceof Uint8Array) {
      throw new Error(
        "decimal: raw bytes need a scale; use decimal(bytes, scale)",
      );
    }
  }
  throw new Error(`decimal: cannot convert ${typeof v} to Decimal`);
}

function decimalFromBytesScale(value: unknown, scale: unknown): ReflectMessage {
  if (!(value instanceof Uint8Array)) {
    throw new Error(
      `decimal: expected bytes for the (bytes, scale) overload, got ${typeof value}`,
    );
  }
  const s = typeof scale === "bigint" ? Number(scale) : (scale as number);
  if (value.length === 0) {
    return decimalToCel(new Decimal(0).mul(new Decimal(10).pow(-s)));
  }
  return decimalToCel(
    new Decimal(bytesToBigIntSigned(value).toString()).mul(
      new Decimal(10).pow(-s),
    ),
  );
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
    return protoToDecimal(v.message as ProtoDecimal).toFixed();
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
    return protoToDecimal(v.message as ProtoDecimal).toNumber();
  }
  if (v instanceof Decimal) return v.toNumber();
  // Fall through to stdlib semantics for the non-Decimal case.
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  return Number(v as Decimal.Value);
}

export const DECIMAL_FUNCS: CelFunc[] = [
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
  celFunc("decimals.round", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).toDP(0, Decimal.ROUND_HALF_UP))),
  celFunc("decimals.round", [DYN, INT], DECIMAL_TYPE, (a, scale) =>
    decimalToCel(toDecimal(a).toDP(Number(scale), Decimal.ROUND_HALF_UP)),
  ),
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
    return decimalToCel(target >= d.decimalPlaces() ? d : d.toDP(target, Decimal.ROUND_DOWN));
  }),
  celFunc("decimals.floor", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).toDP(0, Decimal.ROUND_FLOOR))),
  celFunc("decimals.ceil", [DYN], DECIMAL_TYPE, (a) => decimalToCel(toDecimal(a).toDP(0, Decimal.ROUND_CEIL))),

  // ---- string(Decimal) — extends stdlib string() with a Decimal arm ----
  celFunc("string", [DYN], STRING, (v) => stringExt(v)),

  // ---- double(Decimal) — extends stdlib double() with a Decimal arm ----
  celFunc("double", [DYN], DOUBLE, (v) => doubleExt(v)),
];
