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
  // preserve the sign on the high bit.
  const bits = (negative ? -n : n).toString(2).length;
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
export function decimalToUnscaled(d: Decimal, scale: number): bigint {
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
  // Build exactly from the plain string; `.mul` would round unscaled values above 20 digits.
  return new Decimal(decimalPlainString(unscaled, scale));
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
    precision: 0,
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
  // Unscaled integer = d * 10^scale. For a negative scale this divides (e.g. 1200 * 10^-2 = 12),
  // which is exact because the caller rounded d to a multiple of 10^-scale. Computed from d's
  // exact digits so a >20-digit value is not rounded to global precision.
  const unscaled = decimalToUnscaled(d, scale);
  return create(ProtoDecimalSchema, {
    value: bigIntToTwosComplementBytes(unscaled),
    scale,
    precision: 0,
  });
}
