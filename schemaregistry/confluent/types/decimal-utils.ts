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

/** Converts a `confluent.type.Decimal` message to a decimal.js `Decimal`. */
export function fromProtoDecimal(p: ProtoDecimal): Decimal {
  const value = p.value;
  const scale = p.scale ?? 0;
  if (!value || value.length === 0) {
    return new Decimal(0).mul(new Decimal(10).pow(-scale));
  }
  return new Decimal(bytesToBigIntSigned(value).toString()).mul(
    new Decimal(10).pow(-scale),
  );
}

/**
 * Converts a decimal.js `Decimal` to a `confluent.type.Decimal` message. The scale is taken from
 * `decimalPlaces()`; decimal.js normalizes trailing zeros, so (unlike Java `BigDecimal.scale()`)
 * this does not preserve a trailing-zero scale such as `1.50`.
 */
export function toProtoDecimal(d: Decimal): ProtoDecimal {
  const scale = d.decimalPlaces();
  // Unscaled integer = d * 10^scale, exact since decimalPlaces is the smallest scale that makes
  // d an integer.
  const unscaled = BigInt(d.times(new Decimal(10).pow(scale)).toFixed(0));
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
  // which is exact because the caller rounded d to a multiple of 10^-scale.
  const unscaled = BigInt(d.times(new Decimal(10).pow(scale)).toFixed(0));
  return create(ProtoDecimalSchema, {
    value: bigIntToTwosComplementBytes(unscaled),
    scale,
    precision: 0,
  });
}
