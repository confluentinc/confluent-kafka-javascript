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
 * CEL bindings for the `variant(...)` constructor and the `variants.*` accessor functions -
 * the JS counterpart of Java's `rules/cel/builtin` variant glue.
 *
 * In-CEL representation: a Variant flows as a `ReflectMessage` of `confluent.type.Variant`
 * (the same wire form used by Avro logical types and Confluent's Protobuf Variant), mirroring
 * how the decimal functions use a `ReflectMessage` of `confluent.type.Decimal` - `@bufbuild/cel`
 * has no opaque type. Navigation returns a sub-variant re-wrapped as
 * `confluent.type.Variant{ metadata, value: value.subarray(pos) }`; the reader ignores trailing
 * bytes, so no length computation is needed.
 *
 * Null model (matching the Java reference / Spark Variant semantics): CEL null (JS `null`) =
 * absent (miss / out-of-bounds / type-mismatch / non-Variant); a Variant whose top type is NULL
 * = present-but-variant-null. Distinguish with `result == null` vs `variants.isNull(result)`.
 */

import { celFunc, CelScalar, objectType, type CelFunc } from "@bufbuild/cel";
import { create } from "@bufbuild/protobuf";
import { isReflectMessage, reflect, type ReflectMessage } from "@bufbuild/protobuf/reflect";
import { TimestampSchema } from "@bufbuild/protobuf/wkt";
import {
  VariantSchema,
  type Variant as ProtoVariant,
} from "../../confluent/types/variant_pb";
import { DecimalSchema } from "../../confluent/types/decimal_pb";
import { bigIntToTwosComplementBytes } from "../../confluent/types/decimal-utils";
import { Variant, VariantType, parseJson } from "../../confluent/types/variant-utils";
import { walk } from "./variant-path";

const { DYN, STRING, BOOL, INT, BYTES } = CelScalar;
const VARIANT = objectType(VariantSchema);

const VARIANT_PROTO_NAME = "confluent.type.Variant";
const INT32_MAX = 2147483647n;

// VariantType -> the coarse label variants.type returns, matching Java variantTypeName.
const TYPE_LABELS: Record<VariantType, string> = {
  [VariantType.OBJECT]: "object",
  [VariantType.ARRAY]: "array",
  [VariantType.NULL]: "null",
  [VariantType.BOOLEAN]: "boolean",
  [VariantType.BYTE]: "int",
  [VariantType.SHORT]: "int",
  [VariantType.INT]: "int",
  [VariantType.LONG]: "int",
  [VariantType.FLOAT]: "double",
  [VariantType.DOUBLE]: "double",
  [VariantType.DECIMAL4]: "decimal",
  [VariantType.DECIMAL8]: "decimal",
  [VariantType.DECIMAL16]: "decimal",
  [VariantType.DATE]: "date",
  [VariantType.TIME]: "time",
  [VariantType.TIMESTAMP_TZ]: "timestamp",
  [VariantType.TIMESTAMP_NTZ]: "timestamp",
  [VariantType.TIMESTAMP_NANOS_TZ]: "timestamp",
  [VariantType.TIMESTAMP_NANOS_NTZ]: "timestamp",
  [VariantType.STRING]: "string",
  [VariantType.BINARY]: "bytes",
  [VariantType.UUID]: "uuid",
};

const INT_TYPES = new Set([
  VariantType.BYTE, VariantType.SHORT, VariantType.INT, VariantType.LONG]);
const DECIMAL_TYPES = new Set([
  VariantType.DECIMAL4, VariantType.DECIMAL8, VariantType.DECIMAL16]);
const TIMESTAMP_TYPES = new Set([
  VariantType.TIMESTAMP_TZ, VariantType.TIMESTAMP_NTZ,
  VariantType.TIMESTAMP_NANOS_TZ, VariantType.TIMESTAMP_NANOS_NTZ]);
const MICROS_TIMESTAMP_TYPES = new Set([
  VariantType.TIMESTAMP_TZ, VariantType.TIMESTAMP_NTZ]);

function coerceBytes(v: unknown, field: string): Uint8Array {
  if (v instanceof Uint8Array) return v;
  throw new Error(`variant: expected bytes for '${field}', got ${typeof v}`);
}

/** A reader over a CEL value that is a confluent.type.Variant, or null if it is not one. */
function tryReader(v: unknown): Variant | null {
  if (v === null || v === undefined) return null;
  // Already a Variant (e.g. produced by the Avro variant logical type).
  if (v instanceof Variant) return v;
  if (isReflectMessage(v, VariantSchema)) {
    const m = v.message as ProtoVariant;
    return new Variant(m.value, m.metadata);
  }
  const any = v as { $typeName?: string; value?: unknown; metadata?: unknown };
  if (typeof v === "object" && any.$typeName === VARIANT_PROTO_NAME) {
    return new Variant(any.value as Uint8Array, any.metadata as Uint8Array);
  }
  return null;
}

/** A navigation argument: CEL null passes through as null; a real Variant yields a reader;
 * anything else is a hard error (the DYN signature lets a misused non-Variant reach here). */
function requireReaderOrNull(v: unknown, fn: string): Variant | null {
  if (v === null || v === undefined) return null;
  const r = tryReader(v);
  if (r === null) throw new Error(`${fn}: expected Variant, got ${typeof v}`);
  return r;
}

/** Wrap a (sub-)reader back into a CEL Variant. A sub-value's bytes run from its position to
 * the end of the parent buffer; the reader ignores the trailing bytes. */
function wrapReader(r: Variant): ReflectMessage {
  const value = r.pos === 0 ? r.value : r.value.subarray(r.pos);
  return reflect(VariantSchema, create(VariantSchema, { metadata: r.metadata, value }));
}

/**
 * Convert a {@link Variant} (e.g. produced by the Avro variant logical type) into the CEL
 * value form - a `ReflectMessage` of confluent.type.Variant - so it can be bound to `this`.
 * cel-es cannot bind a bare Variant object directly.
 */
export function variantToCel(v: Variant): ReflectMessage {
  return wrapReader(v);
}

function toVariantMessage(v: unknown): ReflectMessage {
  if (v === null || v === undefined) {
    throw new Error("variant: cannot convert null to Variant");
  }
  // Already a Variant (e.g. produced by the Avro variant logical type).
  if (v instanceof Variant) return wrapReader(v);
  if (isReflectMessage(v, VariantSchema)) return v;
  const any = v as { $typeName?: string; value?: unknown; metadata?: unknown };
  if (typeof v === "object" && any.$typeName === VARIANT_PROTO_NAME) {
    return reflect(VariantSchema, v as ProtoVariant);
  }
  // An Avro variant-logical field reaches CEL as an object with {metadata, value} bytes.
  if (typeof v === "object" && "metadata" in any && "value" in any) {
    return reflect(VariantSchema, create(VariantSchema, {
      metadata: coerceBytes(any.metadata, "metadata"),
      value: coerceBytes(any.value, "value"),
    }));
  }
  if (typeof v === "string") {
    throw new Error(
      "variant: cannot convert string to Variant; use variants.parseJson(s) for strict " +
      "JSON parsing or variants.tryParseJson(s) for soft mode");
  }
  throw new Error(`variant: cannot convert ${typeof v} to Variant`);
}

function floorDivMod(n: bigint, d: bigint): [bigint, bigint] {
  let q = n / d;
  let r = n % d;
  if (r !== 0n && r < 0n !== d < 0n) {
    q -= 1n;
    r += d;
  }
  return [q, r];
}

function decimalToCel(r: Variant): ReflectMessage {
  // Build the confluent.type.Decimal directly from the variant's unscaled+scale so the scale
  // is preserved (decimal.js would normalize trailing zeros). value is big-endian.
  const { unscaled, scale } = r.getDecimalParts();
  return reflect(DecimalSchema, create(DecimalSchema, {
    value: bigIntToTwosComplementBytes(unscaled),
    scale,
    precision: 0,
  }));
}

function timestampToCel(r: Variant): ReflectMessage {
  const raw = r.getLong();
  const totalNanos = MICROS_TIMESTAMP_TYPES.has(r.getType()) ? raw * 1000n : raw;
  const [seconds, nanos] = floorDivMod(totalNanos, 1_000_000_000n);
  return reflect(TimestampSchema, create(TimestampSchema, { seconds, nanos: Number(nanos) }));
}

type CelValueOut = string | bigint | number | boolean | Uint8Array | ReflectMessage | null;

function variantAs(v: unknown, typeStr: string, nullOnError: boolean): CelValueOut {
  const r = requireReaderOrNull(v, nullOnError ? "variants.tryAs" : "variants.as");
  if (r === null) return null;
  const t = r.getType();
  switch (typeStr) {
    case "string":
      if (t === VariantType.STRING) return r.getString();
      break;
    case "int":
      if (INT_TYPES.has(t)) return r.getLong();
      break;
    case "double":
      if (t === VariantType.FLOAT) return r.getFloat();
      if (t === VariantType.DOUBLE) return r.getDouble();
      break;
    case "boolean":
      if (t === VariantType.BOOLEAN) return r.getBoolean();
      break;
    case "decimal":
      if (DECIMAL_TYPES.has(t)) return decimalToCel(r);
      break;
    case "timestamp":
      if (TIMESTAMP_TYPES.has(t)) return timestampToCel(r);
      break;
    case "bytes":
      if (t === VariantType.BINARY) return r.getBinary();
      break;
    case "object":
    case "array":
    case "null":
    case "date":
    case "time":
    case "uuid":
      // Not extractable as a CEL scalar - always an error, even in the soft form.
      throw new Error(
        `variants.as: type '${typeStr}' is not supported for extraction ` +
        "(use variants.type/variants.path/variants.field/variants.index instead)");
    default:
      if (nullOnError) return null;
      throw new Error(
        `variants.as: unknown type '${typeStr}' (expected one of: string, int, double, ` +
        "boolean, decimal, timestamp, bytes)");
  }
  if (nullOnError) return null;
  throw new Error(`variants.as: variant is not ${typeStr}-typed (type=${t})`);
}

export const VARIANT_FUNCS: CelFunc[] = [
  // ---- constructor ----
  celFunc("variant", [DYN], VARIANT, (v) => toVariantMessage(v)),
  // variant(value, metadata) - value first, matching the Java/Spark convention.
  celFunc("variant", [BYTES, BYTES], VARIANT, (value, metadata) =>
    reflect(VariantSchema, create(VariantSchema, {
      value: value as Uint8Array,
      metadata: metadata as Uint8Array,
    }))),

  // ---- JSON parsing ----
  celFunc("variants.parseJson", [STRING], VARIANT, (s) => {
    try {
      return wrapReader(parseJson(s as string));
    } catch (e) {
      throw new Error(`variants.parseJson: ${(e as Error).message}`);
    }
  }),
  celFunc("variants.tryParseJson", [STRING], DYN, (s) => {
    try {
      return wrapReader(parseJson(s as string));
    } catch {
      return null;
    }
  }),

  // ---- type inspection ----
  celFunc("variants.type", [DYN], DYN, (v) => {
    if (v === null || v === undefined) return null;
    const r = tryReader(v);
    if (r === null) throw new Error(`variants.type: expected Variant, got ${typeof v}`);
    return TYPE_LABELS[r.getType()];
  }),
  celFunc("variants.isNull", [DYN], BOOL, (v) => {
    const r = tryReader(v);
    return r !== null && r.getType() === VariantType.NULL;
  }),

  // ---- navigation ----
  celFunc("variants.path", [DYN, STRING], DYN, (v, path) => {
    const r = requireReaderOrNull(v, "variants.path");
    if (r === null) return null;
    let sub: Variant | null;
    try {
      sub = walk(r, path as string);
    } catch (e) {
      throw new Error(`variants.path: ${(e as Error).message}`);
    }
    return sub === null ? null : wrapReader(sub);
  }),
  celFunc("variants.field", [DYN, STRING], DYN, (v, key) => {
    const r = requireReaderOrNull(v, "variants.field");
    if (r === null || r.getType() !== VariantType.OBJECT) return null;
    const sub = r.getFieldByKey(key as string);
    return sub === null ? null : wrapReader(sub);
  }),
  celFunc("variants.index", [DYN, INT], DYN, (v, idx) => {
    const r = requireReaderOrNull(v, "variants.index");
    if (r === null || r.getType() !== VariantType.ARRAY) return null;
    const i = idx as bigint;
    if (i < 0n || i > INT32_MAX) return null;
    const sub = r.getElementAtIndex(Number(i));
    return sub === null ? null : wrapReader(sub);
  }),

  // ---- typed extraction ----
  celFunc("variants.as", [DYN, STRING], DYN, (v, t) => variantAs(v, t as string, false)),
  celFunc("variants.tryAs", [DYN, STRING], DYN, (v, t) => variantAs(v, t as string, true)),

  // ---- JSON serialization ----
  celFunc("variants.toJson", [DYN], DYN, (v) => {
    if (v === null || v === undefined) return null;
    const r = tryReader(v);
    if (r === null) throw new Error(`variants.toJson: expected Variant, got ${typeof v}`);
    return r.toJson();
  }),
];
