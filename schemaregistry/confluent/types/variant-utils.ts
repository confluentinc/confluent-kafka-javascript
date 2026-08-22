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
 * Codec for the Spark/Parquet Variant binary type (a metadata key-dictionary plus a
 * self-describing value stream) - the JS counterpart of Java's
 * `io.confluent.kafka.schemaregistry.type` Variant / VariantFormat / VariantUtils, and a
 * direct port of the Python `variant_utils` module.
 *
 * The decode/encode follows Apache Spark's Variant format, extended with the Parquet
 * additions Spark lacks: TIME (17), TIMESTAMP_NANOS tz/ntz (18/19), and UUID (20).
 *
 * Two behaviors match the Confluent Java/Python reference rather than any JS default:
 * `toJson` renders temporal types as ISO-8601 with `T`/`Z` and the seconds field always
 * present (0/3/6/9-digit fractional grouping); `parseJson` follows the Java number handling
 * (a fractional JSON number becomes a DOUBLE). Two JS-inherent caveats on `parseJson`:
 * `JSON.parse` cannot distinguish `1` from `1.0` (an integer-valued literal encodes as an
 * int) and loses precision on integer literals larger than 2^53.
 */

import { Decimal } from "decimal.js";

// --- format constants (see VariantFormat.java) ---
export const BASIC_TYPE_BITS = 2;
export const BASIC_TYPE_MASK = 0x3;
export const TYPE_INFO_MASK = 0x3f;
export const MAX_SHORT_STR_SIZE = 0x3f;

// basic types (low 2 bits)
export const PRIMITIVE = 0;
export const SHORT_STR = 1;
export const OBJECT = 2;
export const ARRAY = 3;

// primitive type codes (upper 6 bits when basic type == PRIMITIVE)
export const NULL = 0;
export const TRUE = 1;
export const FALSE = 2;
export const INT1 = 3;
export const INT2 = 4;
export const INT4 = 5;
export const INT8 = 6;
export const DOUBLE = 7;
export const DECIMAL4 = 8;
export const DECIMAL8 = 9;
export const DECIMAL16 = 10;
export const DATE = 11;
export const TIMESTAMP = 12;
export const TIMESTAMP_NTZ = 13;
export const FLOAT = 14;
export const BINARY = 15;
export const LONG_STR = 16;
export const TIME = 17;
export const TIMESTAMP_NANOS = 18;
export const TIMESTAMP_NANOS_NTZ = 19;
export const UUID = 20;

export const VERSION = 1;
export const VERSION_MASK = 0x0f;

const U8_MAX = 0xff;
const U16_MAX = 0xffff;
const U24_SIZE = 3;
const U24_MAX = 0xffffff;
const U32_SIZE = 4;

const I8_MIN = -0x80n;
const I8_MAX = 0x7fn;
const I16_MIN = -0x8000n;
const I16_MAX = 0x7fffn;
const I32_MIN = -0x80000000n;
const I32_MAX = 0x7fffffffn;
const I64_MIN = -0x8000000000000000n;
const I64_MAX = 0x7fffffffffffffffn;

const MAX_DECIMAL4_PRECISION = 9;
const MAX_DECIMAL8_PRECISION = 18;
const MAX_DECIMAL16_PRECISION = 38;

export enum VariantType {
  OBJECT = "OBJECT",
  ARRAY = "ARRAY",
  NULL = "NULL",
  BOOLEAN = "BOOLEAN",
  BYTE = "BYTE",
  SHORT = "SHORT",
  INT = "INT",
  LONG = "LONG",
  STRING = "STRING",
  DOUBLE = "DOUBLE",
  DECIMAL4 = "DECIMAL4",
  DECIMAL8 = "DECIMAL8",
  DECIMAL16 = "DECIMAL16",
  DATE = "DATE",
  TIMESTAMP_TZ = "TIMESTAMP_TZ",
  TIMESTAMP_NTZ = "TIMESTAMP_NTZ",
  FLOAT = "FLOAT",
  BINARY = "BINARY",
  TIME = "TIME",
  TIMESTAMP_NANOS_TZ = "TIMESTAMP_NANOS_TZ",
  TIMESTAMP_NANOS_NTZ = "TIMESTAMP_NANOS_NTZ",
  UUID = "UUID",
}

export class VariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariantError";
  }
}

// --- low-level byte helpers ---

function checkIndex(pos: number, length: number): void {
  if (pos < 0 || pos >= length) {
    throw new VariantError("malformed variant: index out of bounds");
  }
}

/** Little-endian unsigned integer, 1-4 bytes (offsets / sizes / field ids). */
function readUnsignedLE(data: Uint8Array, pos: number, numBytes: number): number {
  checkIndex(pos, data.length);
  checkIndex(pos + numBytes - 1, data.length);
  let result = 0;
  for (let i = numBytes - 1; i >= 0; i--) {
    result = result * 256 + data[pos + i];
  }
  return result;
}

/** Little-endian two's-complement signed integer of arbitrary width, as a bigint. */
function readSignedLE(data: Uint8Array, pos: number, width: number): bigint {
  checkIndex(pos, data.length);
  checkIndex(pos + width - 1, data.length);
  let result = 0n;
  for (let i = width - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(data[pos + i]);
  }
  if (data[pos + width - 1] & 0x80) {
    result -= 1n << BigInt(width * 8);
  }
  return result;
}

function getTypeInfo(value: Uint8Array, pos: number): [number, number] {
  const basicType = value[pos] & BASIC_TYPE_MASK;
  const typeInfo = (value[pos] >> BASIC_TYPE_BITS) & TYPE_INFO_MASK;
  return [basicType, typeInfo];
}

function getMetadataKey(metadata: Uint8Array, id: number): string {
  checkIndex(0, metadata.length);
  const offsetSize = ((metadata[0] >> 6) & 0x3) + 1;
  const dictSize = readUnsignedLE(metadata, 1, offsetSize);
  if (id >= dictSize) {
    throw new VariantError("malformed variant: field id out of range");
  }
  const stringStart = 1 + (dictSize + 2) * offsetSize;
  const offset = readUnsignedLE(metadata, 1 + (id + 1) * offsetSize, offsetSize);
  const nextOffset = readUnsignedLE(metadata, 1 + (id + 2) * offsetSize, offsetSize);
  if (offset > nextOffset) {
    throw new VariantError("malformed variant: non-monotonic metadata offsets");
  }
  checkIndex(stringStart + nextOffset - 1, metadata.length);
  return TEXT_DECODER.decode(metadata.subarray(stringStart + offset, stringStart + nextOffset));
}

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

// --- cross-language JSON temporal formatting ---
//
// ISO-8601 with a 0/3/6/9-digit fractional-second grouping (as in Java Instant.toString())
// and the seconds field ALWAYS present. UTC instants append 'Z'; NTZ/time forms omit the
// zone. This intentionally deviates from LocalDateTime/LocalTime.toString() (seconds omitted
// when zero); the Java reference is aligned to always emit seconds.

function pad(n: number | bigint, width: number): string {
  return n.toString().padStart(width, "0");
}

function fracNanos(nanos: bigint): string {
  if (nanos === 0n) return "";
  if (nanos % 1_000_000n === 0n) return "." + pad(nanos / 1_000_000n, 3);
  if (nanos % 1_000n === 0n) return "." + pad(nanos / 1_000n, 6);
  return "." + pad(nanos, 9);
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

function ymd(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function formatInstant(totalNanos: bigint): string {
  const [sec, nano] = floorDivMod(totalNanos, 1_000_000_000n);
  const date = new Date(Number(sec) * 1000);
  return `${ymd(date)}T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:` +
    `${pad(date.getUTCSeconds(), 2)}${fracNanos(nano)}Z`;
}

function formatLocalDateTime(totalNanos: bigint): string {
  const [sec, nano] = floorDivMod(totalNanos, 1_000_000_000n);
  const date = new Date(Number(sec) * 1000);
  return `${ymd(date)}T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:` +
    `${pad(date.getUTCSeconds(), 2)}${fracNanos(nano)}`;
}

function formatLocalTime(micros: bigint): string {
  const [secs, nano] = floorDivMod(micros * 1000n, 1_000_000_000n);
  const hour = secs / 3600n;
  const rem = secs % 3600n;
  return `${pad(hour, 2)}:${pad(rem / 60n, 2)}:${pad(rem % 60n, 2)}${fracNanos(nano)}`;
}

function formatDate(days: number): string {
  return ymd(new Date(days * 86_400_000));
}

/** Exact fixed-point string for unscaled*10^-scale (never scientific), matching toPlainString. */
function decimalPlainString(unscaled: bigint, scale: number): string {
  const negative = unscaled < 0n;
  let digits = (negative ? -unscaled : unscaled).toString();
  const sign = negative ? "-" : "";
  if (scale === 0) return sign + digits;
  if (digits.length <= scale) {
    digits = "0".repeat(scale - digits.length + 1) + digits;
  }
  const point = digits.length - scale;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** A JSON number rendering of a double: integral values as `N.0`, else JS shortest repr.
 * (Java Float/Double.toString scientific-notation edge cases are a known minor divergence.) */
function doubleToJson(d: number): string {
  if (!Number.isFinite(d)) {
    throw new VariantError("cannot render non-finite double as JSON");
  }
  if (Number.isInteger(d) && Math.abs(d) < 1e16) {
    return `${d}.0`;
  }
  return String(d);
}

/** A JSON number rendering of a 32-bit float: the shortest decimal that round-trips to the
 * SAME float32 (via `Math.fround`), matching Java `Float.toString` / Apache Arrow rather than
 * the f64-shortest string produced by widening then formatting as a double. */
function floatToJson(f: number): string {
  if (!Number.isFinite(f)) {
    throw new VariantError("cannot render non-finite float as JSON");
  }
  if (Number.isInteger(f) && Math.abs(f) < 1e16) {
    return `${f}.0`;
  }
  for (let p = 1; p <= 9; p++) {
    const s = f.toPrecision(p);
    if (Math.fround(Number(s)) === f) return String(Number(s));
  }
  return String(f);
}

function formatUuid(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (const b of bytes) hex.push(b.toString(16).padStart(2, "0"));
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function checkDecimal(unscaled: bigint, precision: number): void {
  const digits = (unscaled < 0n ? -unscaled : unscaled).toString().length;
  if (digits > precision) {
    throw new VariantError("malformed variant: decimal out of range");
  }
}

// --- Variant reader ---

const BINARY_SEARCH_THRESHOLD = 32;

const TYPE_MAP: Record<number, VariantType> = {
  [NULL]: VariantType.NULL,
  [TRUE]: VariantType.BOOLEAN,
  [FALSE]: VariantType.BOOLEAN,
  [INT1]: VariantType.BYTE,
  [INT2]: VariantType.SHORT,
  [INT4]: VariantType.INT,
  [INT8]: VariantType.LONG,
  [DOUBLE]: VariantType.DOUBLE,
  [DECIMAL4]: VariantType.DECIMAL4,
  [DECIMAL8]: VariantType.DECIMAL8,
  [DECIMAL16]: VariantType.DECIMAL16,
  [DATE]: VariantType.DATE,
  [TIMESTAMP]: VariantType.TIMESTAMP_TZ,
  [TIMESTAMP_NTZ]: VariantType.TIMESTAMP_NTZ,
  [FLOAT]: VariantType.FLOAT,
  [BINARY]: VariantType.BINARY,
  [LONG_STR]: VariantType.STRING,
  [TIME]: VariantType.TIME,
  [TIMESTAMP_NANOS]: VariantType.TIMESTAMP_NANOS_TZ,
  [TIMESTAMP_NANOS_NTZ]: VariantType.TIMESTAMP_NANOS_NTZ,
  [UUID]: VariantType.UUID,
};

/**
 * A read-only view over a Variant (value + metadata) at a byte position. Navigation
 * (`getFieldByKey` / `getElementAtIndex`) returns a sub-`Variant` sharing the same buffers.
 */
export class Variant {
  readonly value: Uint8Array;
  readonly metadata: Uint8Array;
  readonly pos: number;
  private readonly view: DataView;

  constructor(value: Uint8Array, metadata: Uint8Array, pos = 0) {
    this.value = value;
    this.metadata = metadata;
    this.pos = pos;
    checkIndex(0, metadata.length);
    if ((metadata[0] & VERSION_MASK) !== VERSION) {
      throw new VariantError(
        `unsupported variant metadata version: ${metadata[0] & VERSION_MASK}`);
    }
    this.view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  }

  getType(): VariantType {
    checkIndex(this.pos, this.value.length);
    const [basicType, typeInfo] = getTypeInfo(this.value, this.pos);
    if (basicType === SHORT_STR) return VariantType.STRING;
    if (basicType === OBJECT) return VariantType.OBJECT;
    if (basicType === ARRAY) return VariantType.ARRAY;
    const t = TYPE_MAP[typeInfo];
    if (t === undefined) {
      throw new VariantError(`unknown variant primitive type: ${typeInfo}`);
    }
    return t;
  }

  private primitiveInfo(): number {
    checkIndex(this.pos, this.value.length);
    const [basicType, typeInfo] = getTypeInfo(this.value, this.pos);
    if (basicType !== PRIMITIVE) {
      throw new VariantError("expected a primitive variant value");
    }
    return typeInfo;
  }

  getBoolean(): boolean {
    const ti = this.primitiveInfo();
    if (ti !== TRUE && ti !== FALSE) throw new VariantError("variant is not a boolean");
    return ti === TRUE;
  }

  /** 8-bit integer (`INT1` only) - mirrors Java `getByte`. Wider integer widths throw;
   * use `getShort`/`getInt`/`getLong` for those. */
  getByte(): number {
    const ti = this.primitiveInfo();
    if (ti === INT1) {
      checkIndex(this.pos + 1, this.value.length);
      return this.view.getInt8(this.pos + 1);
    }
    throw new VariantError("variant is not a byte-width integer");
  }

  /** 16-bit integer, widening from `INT1` (byte) - mirrors Java `getShort`. */
  getShort(): number {
    const ti = this.primitiveInfo();
    if (ti === INT1) {
      checkIndex(this.pos + 1, this.value.length);
      return this.view.getInt8(this.pos + 1);
    }
    if (ti === INT2) {
      checkIndex(this.pos + 2, this.value.length);
      return this.view.getInt16(this.pos + 1, true);
    }
    throw new VariantError("variant is not a short-width integer");
  }

  /** 32-bit integer, widening from `INT1`/`INT2` - mirrors Java `getInt`. */
  getInt(): number {
    const ti = this.primitiveInfo();
    if (ti === INT1) {
      checkIndex(this.pos + 1, this.value.length);
      return this.view.getInt8(this.pos + 1);
    }
    if (ti === INT2) {
      checkIndex(this.pos + 2, this.value.length);
      return this.view.getInt16(this.pos + 1, true);
    }
    if (ti === INT4) {
      checkIndex(this.pos + 4, this.value.length);
      return this.view.getInt32(this.pos + 1, true);
    }
    throw new VariantError("variant is not an int-width integer");
  }

  /** Raw integer for any integer-backed type (byte/short/int/long, date days, timestamp
   * micros, time micros, timestamp-nanos) - mirrors Java `getLong`. */
  getLong(): bigint {
    const ti = this.primitiveInfo();
    if (ti === INT1) {
      checkIndex(this.pos + 1, this.value.length);
      return BigInt(this.view.getInt8(this.pos + 1));
    }
    if (ti === INT2) {
      checkIndex(this.pos + 2, this.value.length);
      return BigInt(this.view.getInt16(this.pos + 1, true));
    }
    if (ti === INT4 || ti === DATE) {
      checkIndex(this.pos + 4, this.value.length);
      return BigInt(this.view.getInt32(this.pos + 1, true));
    }
    if (ti === INT8 || ti === TIMESTAMP || ti === TIMESTAMP_NTZ || ti === TIME ||
      ti === TIMESTAMP_NANOS || ti === TIMESTAMP_NANOS_NTZ) {
      checkIndex(this.pos + 8, this.value.length);
      return this.view.getBigInt64(this.pos + 1, true);
    }
    throw new VariantError("variant is not an integer-backed type");
  }

  /** 32-bit float (`FLOAT` only, exact) - mirrors Java `getFloat`. */
  getFloat(): number {
    const ti = this.primitiveInfo();
    if (ti === FLOAT) {
      checkIndex(this.pos + 4, this.value.length);
      return this.view.getFloat32(this.pos + 1, true);
    }
    throw new VariantError("variant is not a float");
  }

  /** 64-bit double (`DOUBLE` only, exact) - mirrors Java `getDouble`. Does not widen a
   * `FLOAT`; use `getFloat` for that. */
  getDouble(): number {
    const ti = this.primitiveInfo();
    if (ti === DOUBLE) {
      checkIndex(this.pos + 8, this.value.length);
      return this.view.getFloat64(this.pos + 1, true);
    }
    throw new VariantError("variant is not a double");
  }

  /** The unscaled integer and scale of a decimal value (scale preserved). */
  getDecimalParts(): { unscaled: bigint; scale: number } {
    const ti = this.primitiveInfo();
    checkIndex(this.pos + 1, this.value.length);
    const scale = this.value[this.pos + 1];
    let width: number;
    let precision: number;
    if (ti === DECIMAL4) { width = 4; precision = MAX_DECIMAL4_PRECISION; }
    else if (ti === DECIMAL8) { width = 8; precision = MAX_DECIMAL8_PRECISION; }
    else if (ti === DECIMAL16) { width = 16; precision = MAX_DECIMAL16_PRECISION; }
    else throw new VariantError("variant is not a decimal");
    const unscaled = readSignedLE(this.value, this.pos + 2, width);
    checkDecimal(unscaled, precision);
    return { unscaled, scale };
  }

  getDecimal(): Decimal {
    const { unscaled, scale } = this.getDecimalParts();
    return new Decimal(decimalPlainString(unscaled, scale));
  }

  getBinary(): Uint8Array {
    const ti = this.primitiveInfo();
    if (ti !== BINARY) throw new VariantError("variant is not binary");
    const length = readUnsignedLE(this.value, this.pos + 1, U32_SIZE);
    const start = this.pos + 1 + U32_SIZE;
    checkIndex(start + length - 1, this.value.length);
    return this.value.slice(start, start + length);
  }

  getUuid(): string {
    const ti = this.primitiveInfo();
    if (ti !== UUID) throw new VariantError("variant is not a uuid");
    const start = this.pos + 1;
    checkIndex(start + 15, this.value.length);
    return formatUuid(this.value.subarray(start, start + 16)); // big-endian
  }

  getString(): string {
    checkIndex(this.pos, this.value.length);
    const [basicType, typeInfo] = getTypeInfo(this.value, this.pos);
    let start: number;
    let length: number;
    if (basicType === SHORT_STR) {
      start = this.pos + 1;
      length = typeInfo;
    } else if (basicType === PRIMITIVE && typeInfo === LONG_STR) {
      length = readUnsignedLE(this.value, this.pos + 1, U32_SIZE);
      start = this.pos + 1 + U32_SIZE;
    } else {
      throw new VariantError("variant is not a string");
    }
    checkIndex(start + length - 1, this.value.length);
    return TEXT_DECODER.decode(this.value.subarray(start, start + length));
  }

  private objectInfo() {
    checkIndex(this.pos, this.value.length);
    const [basicType, typeInfo] = getTypeInfo(this.value, this.pos);
    if (basicType !== OBJECT) throw new VariantError("variant is not an object");
    const largeSize = ((typeInfo >> 4) & 0x1) !== 0;
    const sizeBytes = largeSize ? U32_SIZE : 1;
    const numFields = readUnsignedLE(this.value, this.pos + 1, sizeBytes);
    const idSize = ((typeInfo >> 2) & 0x3) + 1;
    const offsetSize = (typeInfo & 0x3) + 1;
    const idStart = this.pos + 1 + sizeBytes;
    const offsetStart = idStart + numFields * idSize;
    const dataStart = offsetStart + (numFields + 1) * offsetSize;
    return { numFields, idSize, offsetSize, idStart, offsetStart, dataStart };
  }

  private arrayInfo() {
    checkIndex(this.pos, this.value.length);
    const [basicType, typeInfo] = getTypeInfo(this.value, this.pos);
    if (basicType !== ARRAY) throw new VariantError("variant is not an array");
    const largeSize = ((typeInfo >> 2) & 0x1) !== 0;
    const sizeBytes = largeSize ? U32_SIZE : 1;
    const numFields = readUnsignedLE(this.value, this.pos + 1, sizeBytes);
    const offsetSize = (typeInfo & 0x3) + 1;
    const offsetStart = this.pos + 1 + sizeBytes;
    const dataStart = offsetStart + (numFields + 1) * offsetSize;
    return { numFields, offsetSize, offsetStart, dataStart };
  }

  numObjectFields(): number {
    return this.objectInfo().numFields;
  }

  numArrayElements(): number {
    return this.arrayInfo().numFields;
  }

  getFieldByKey(key: string): Variant | null {
    const info = this.objectInfo();
    if (info.numFields < BINARY_SEARCH_THRESHOLD) {
      for (let i = 0; i < info.numFields; i++) {
        const id = readUnsignedLE(this.value, info.idStart + info.idSize * i, info.idSize);
        if (getMetadataKey(this.metadata, id) === key) {
          const offset = readUnsignedLE(
            this.value, info.offsetStart + info.offsetSize * i, info.offsetSize);
          return new Variant(this.value, this.metadata, info.dataStart + offset);
        }
      }
      return null;
    }
    // Encode the lookup key once, outside the loop, rather than on every comparison.
    const keyBytes = TEXT_ENCODER.encode(key);
    let low = 0;
    let high = info.numFields - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const midId = readUnsignedLE(this.value, info.idStart + info.idSize * mid, info.idSize);
      const midKey = getMetadataKey(this.metadata, midId);
      const cmp = compareKeysBytes(TEXT_ENCODER.encode(midKey), keyBytes);
      if (cmp < 0) low = mid + 1;
      else if (cmp > 0) high = mid - 1;
      else {
        const offset = readUnsignedLE(
          this.value, info.offsetStart + info.offsetSize * mid, info.offsetSize);
        return new Variant(this.value, this.metadata, info.dataStart + offset);
      }
    }
    return null;
  }

  getFieldAtIndex(idx: number): [string, Variant] {
    const info = this.objectInfo();
    const id = readUnsignedLE(this.value, info.idStart + info.idSize * idx, info.idSize);
    const offset = readUnsignedLE(
      this.value, info.offsetStart + info.offsetSize * idx, info.offsetSize);
    return [getMetadataKey(this.metadata, id),
      new Variant(this.value, this.metadata, info.dataStart + offset)];
  }

  getElementAtIndex(index: number): Variant | null {
    const info = this.arrayInfo();
    if (index < 0 || index >= info.numFields) return null;
    const offset = readUnsignedLE(
      this.value, info.offsetStart + info.offsetSize * index, info.offsetSize);
    return new Variant(this.value, this.metadata, info.dataStart + offset);
  }

  /** Serialize to a JSON string, matching the Java `VariantUtils.toJsonString` contract. */
  toJson(): string {
    const t = this.getType();
    switch (t) {
      case VariantType.OBJECT: {
        const parts: string[] = [];
        const n = this.numObjectFields();
        for (let i = 0; i < n; i++) {
          const [key, child] = this.getFieldAtIndex(i);
          parts.push(JSON.stringify(key) + ":" + child.toJson());
        }
        return "{" + parts.join(",") + "}";
      }
      case VariantType.ARRAY: {
        const parts: string[] = [];
        const n = this.numArrayElements();
        for (let i = 0; i < n; i++) {
          parts.push(this.getElementAtIndex(i)!.toJson());
        }
        return "[" + parts.join(",") + "]";
      }
      case VariantType.NULL:
        return "null";
      case VariantType.BOOLEAN:
        return this.getBoolean() ? "true" : "false";
      case VariantType.STRING:
        return JSON.stringify(this.getString());
      case VariantType.BYTE:
      case VariantType.SHORT:
      case VariantType.INT:
      case VariantType.LONG:
        return this.getLong().toString();
      case VariantType.FLOAT:
        return floatToJson(this.getFloat());
      case VariantType.DOUBLE:
        return doubleToJson(this.getDouble());
      case VariantType.DECIMAL4:
      case VariantType.DECIMAL8:
      case VariantType.DECIMAL16: {
        const { unscaled, scale } = this.getDecimalParts();
        return decimalPlainString(unscaled, scale);
      }
      case VariantType.DATE:
        return `"${formatDate(Number(this.getLong()))}"`;
      case VariantType.TIMESTAMP_TZ:
        return `"${formatInstant(this.getLong() * 1000n)}"`;
      case VariantType.TIMESTAMP_NTZ:
        return `"${formatLocalDateTime(this.getLong() * 1000n)}"`;
      case VariantType.TIMESTAMP_NANOS_TZ:
        return `"${formatInstant(this.getLong())}"`;
      case VariantType.TIMESTAMP_NANOS_NTZ:
        return `"${formatLocalDateTime(this.getLong())}"`;
      case VariantType.TIME:
        return `"${formatLocalTime(this.getLong())}"`;
      case VariantType.BINARY:
        return `"${base64Encode(this.getBinary())}"`;
      case VariantType.UUID:
        return `"${this.getUuid()}"`;
      default:
        throw new VariantError(`unsupported variant type for JSON: ${t}`);
    }
  }
}

function base64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// --- module-level convenience API ---

export function fromBytes(value: Uint8Array, metadata: Uint8Array): Variant {
  return new Variant(value, metadata);
}

export function toJsonString(variant: Variant): string {
  return variant.toJson();
}

export function parseJson(jsonStr: string): Variant {
  return new VariantBuilder().buildFromJson(jsonStr);
}

// --- Variant builder ---
//
// A flat streaming writer (arrow-dotnet `VariantValueWriter` shape): a single object with an
// internal nesting stack. Each scalar/container append fills the "current slot" - the root,
// the next array element, or the current object field's value (after `appendKey`). Object
// fields are sorted by key on `endObject` (canonical form); the metadata dictionary
// accumulates every key seen.
//
// The same internal machinery drives `parseJson`: `processParsedJson` walks a parsed JSON
// tree with the same low-level writers and object/array finishers, so a programmatic build is
// byte-identical to `parseJson` of an equivalent value.
//
// JSON number handling follows Java VariantUtils.fromJsonNode: a fractional number becomes a
// DOUBLE. Because JS JSON.parse yields a `number` for every JSON number, an integer-valued
// literal (including `1.0`) encodes as an int, and integer literals larger than 2^53 lose
// precision - both inherent JS limitations documented on this module.

interface FieldEntry {
  key: string;
  id: number;
  offset: number;
}

interface ObjectContext {
  kind: "object";
  start: number;
  fields: FieldEntry[];
  pendingKey: string | null;
  pendingId: number;
}

interface ArrayContext {
  kind: "array";
  start: number;
  offsets: number[];
}

type Context = ObjectContext | ArrayContext;

export class VariantBuilder {
  static readonly DEFAULT_SIZE_LIMIT = 16 * 1024 * 1024;

  private value: number[] = [];
  private dictionary = new Map<string, number>();
  private dictionaryKeys: Uint8Array[] = [];
  private sizeLimit: number;
  private stack: Context[] = [];
  private rootWritten = false;

  constructor(sizeLimit = VariantBuilder.DEFAULT_SIZE_LIMIT) {
    this.sizeLimit = sizeLimit;
  }

  // --- public streaming API ---

  /** Finalize and return the built `Variant`. Throws if a container is still open or
   * nothing has been written. */
  build(): Variant {
    if (this.stack.length > 0) throw new VariantError("cannot build with an open container");
    if (!this.rootWritten) throw new VariantError("cannot build an empty variant");
    const { value, metadata } = this.finalize();
    return new Variant(value, metadata);
  }

  appendNull(): void {
    this.beforeAppend();
    this.writeNull();
  }

  appendBoolean(b: boolean): void {
    this.beforeAppend();
    this.writeBoolean(b);
  }

  /** Append an 8-bit integer (`INT1`). */
  appendByte(value: number): void {
    this.beforeAppend();
    this.writeFixedInt(INT1, BigInt(value), 1);
  }

  /** Append a 16-bit integer (`INT2`). */
  appendShort(value: number): void {
    this.beforeAppend();
    this.writeFixedInt(INT2, BigInt(value), 2);
  }

  /** Append a 32-bit integer (`INT4`). */
  appendInt(value: number): void {
    this.beforeAppend();
    this.writeFixedInt(INT4, BigInt(value), 4);
  }

  /** Append a 64-bit integer (`INT8`). */
  appendLong(value: bigint): void {
    this.beforeAppend();
    this.writeFixedInt(INT8, value, 8);
  }

  /** Append a 32-bit float (`FLOAT`). */
  appendFloat(value: number): void {
    this.beforeAppend();
    this.checkCapacity(1 + 4);
    this.value.push(primitiveHeader(FLOAT));
    const buf = new DataView(new ArrayBuffer(4));
    buf.setFloat32(0, value, true);
    for (let i = 0; i < 4; i++) this.value.push(buf.getUint8(i));
  }

  /** Append a 64-bit double (`DOUBLE`). */
  appendDouble(value: number): void {
    this.beforeAppend();
    this.writeDouble(value);
  }

  /** Append a decimal. Either `appendDecimal(unscaledBigEndian, scale)` with a big-endian
   * two's-complement unscaled value (`Uint8Array`) or an unscaled `bigint`, or the native
   * overload `appendDecimal(Decimal)` (scale taken from the value). */
  appendDecimal(unscaled: Uint8Array | bigint | Decimal, scale?: number): void {
    this.beforeAppend();
    if (unscaled instanceof Uint8Array) {
      if (scale === undefined) {
        throw new VariantError("scale is required when appending a decimal from bytes");
      }
      this.writeDecimalUnscaled(bigEndianSigned(unscaled), scale);
    } else if (typeof unscaled === "bigint") {
      if (scale === undefined) {
        throw new VariantError("scale is required when appending an unscaled integer");
      }
      this.writeDecimalUnscaled(unscaled, scale);
    } else {
      if (scale !== undefined) {
        throw new VariantError("scale must not be given with a Decimal value");
      }
      const s = unscaled.decimalPlaces();
      // toFixed(s) is exact (precision-independent) since the value has exactly s decimal places;
      // strip the point (and keep the sign) to get the unscaled integer with no rounding.
      // Arithmetic ops (times/pow) would round to decimal.js's global precision and corrupt
      // values with more than ~20 significant digits.
      const unscaledInt = BigInt(unscaled.toFixed(s).replace(".", ""));
      this.writeDecimalUnscaled(unscaledInt, s);
    }
  }

  appendString(s: string): void {
    this.beforeAppend();
    this.writeString(s);
  }

  appendBinary(data: Uint8Array): void {
    this.beforeAppend();
    this.checkCapacity(1 + U32_SIZE + data.length);
    this.value.push(primitiveHeader(BINARY));
    pushUintLE(this.value, data.length, U32_SIZE);
    for (const b of data) this.value.push(b);
  }

  /** Append a UUID from 16 big-endian bytes. */
  appendUuid(uuid16: Uint8Array): void {
    this.beforeAppend();
    if (uuid16.length !== 16) throw new VariantError("uuid must be 16 bytes");
    this.checkCapacity(1 + 16);
    this.value.push(primitiveHeader(UUID));
    for (const b of uuid16) this.value.push(b);
  }

  appendDate(daysSinceEpoch: number): void {
    this.beforeAppend();
    this.writeFixedInt(DATE, BigInt(daysSinceEpoch), 4);
  }

  /** Append a `TIME` (TIME_NTZ) as microseconds since midnight. */
  appendTime(microsSinceMidnight: bigint): void {
    this.beforeAppend();
    this.writeFixedInt(TIME, microsSinceMidnight, 8);
  }

  appendTimestampTz(micros: bigint): void {
    this.beforeAppend();
    this.writeFixedInt(TIMESTAMP, micros, 8);
  }

  appendTimestampNtz(micros: bigint): void {
    this.beforeAppend();
    this.writeFixedInt(TIMESTAMP_NTZ, micros, 8);
  }

  appendTimestampNanosTz(nanos: bigint): void {
    this.beforeAppend();
    this.writeFixedInt(TIMESTAMP_NANOS, nanos, 8);
  }

  appendTimestampNanosNtz(nanos: bigint): void {
    this.beforeAppend();
    this.writeFixedInt(TIMESTAMP_NANOS_NTZ, nanos, 8);
  }

  startObject(): void {
    this.beforeAppend();
    this.stack.push({ kind: "object", start: this.value.length, fields: [], pendingKey: null, pendingId: 0 });
  }

  appendKey(key: string): void {
    const ctx = this.stack[this.stack.length - 1];
    if (!ctx || ctx.kind !== "object") {
      throw new VariantError("appendKey called outside of an object");
    }
    if (ctx.pendingKey !== null) {
      throw new VariantError("appendKey called twice without an intervening value");
    }
    ctx.pendingKey = key;
    ctx.pendingId = this.addKey(key);
  }

  endObject(): void {
    const ctx = this.stack[this.stack.length - 1];
    if (!ctx || ctx.kind !== "object") {
      throw new VariantError("endObject without a matching startObject");
    }
    if (ctx.pendingKey !== null) {
      throw new VariantError("endObject with a dangling appendKey (no value)");
    }
    this.stack.pop();
    this.finishWritingObject(ctx.start, ctx.fields);
  }

  startArray(): void {
    this.beforeAppend();
    this.stack.push({ kind: "array", start: this.value.length, offsets: [] });
  }

  endArray(): void {
    const ctx = this.stack[this.stack.length - 1];
    if (!ctx || ctx.kind !== "array") {
      throw new VariantError("endArray without a matching startArray");
    }
    this.stack.pop();
    this.finishWritingArray(ctx.start, ctx.offsets);
  }

  // --- current-slot bookkeeping ---

  /** Register the slot the value about to be written will occupy, recording its offset in the
   * enclosing container (or marking the root as written). */
  private beforeAppend(): void {
    const ctx = this.stack[this.stack.length - 1];
    if (!ctx) {
      if (this.rootWritten) throw new VariantError("cannot append multiple root values");
      this.rootWritten = true;
      return;
    }
    if (ctx.kind === "object") {
      if (ctx.pendingKey === null) {
        throw new VariantError("a value in an object must follow appendKey");
      }
      ctx.fields.push({ key: ctx.pendingKey, id: ctx.pendingId, offset: this.value.length - ctx.start });
      ctx.pendingKey = null;
    } else {
      ctx.offsets.push(this.value.length - ctx.start);
    }
  }

  // --- internal JSON-tree driver (used by parseJson) ---

  /** Build a Variant directly from a JSON string (drives the same internal machinery). */
  buildFromJson(jsonStr: string): Variant {
    this.processParsedJson(JSON.parse(jsonStr));
    const { value, metadata } = this.finalize();
    return new Variant(value, metadata);
  }

  private finalize(): { value: Uint8Array; metadata: Uint8Array } {
    const numKeys = this.dictionaryKeys.length;
    const dictStringSize = this.dictionaryKeys.reduce((a, k) => a + k.length, 0);
    const maxSize = Math.max(dictStringSize, numKeys);
    if (maxSize > this.sizeLimit) throw new VariantError("variant size limit exceeded");
    const offsetSize = integerSize(maxSize);

    const stringStart = 1 + offsetSize + (numKeys + 1) * offsetSize;
    if (stringStart + dictStringSize > this.sizeLimit) {
      throw new VariantError("variant size limit exceeded");
    }

    const metadata: number[] = [];
    metadata.push(VERSION | ((offsetSize - 1) << 6));
    pushUintLE(metadata, numKeys, offsetSize);
    let currentOffset = 0;
    for (const key of this.dictionaryKeys) {
      pushUintLE(metadata, currentOffset, offsetSize);
      currentOffset += key.length;
    }
    pushUintLE(metadata, currentOffset, offsetSize);
    for (const key of this.dictionaryKeys) {
      for (const b of key) metadata.push(b);
    }
    return { value: Uint8Array.from(this.value), metadata: Uint8Array.from(metadata) };
  }

  private processParsedJson(parsed: unknown): void {
    if (parsed === null) {
      this.writeNull();
    } else if (Array.isArray(parsed)) {
      const offsets: number[] = [];
      const start = this.value.length;
      for (const elem of parsed) {
        offsets.push(this.value.length - start);
        this.processParsedJson(elem);
      }
      this.finishWritingArray(start, offsets);
    } else if (typeof parsed === "object") {
      const fields: FieldEntry[] = [];
      const start = this.value.length;
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        const id = this.addKey(key);
        fields.push({ key, id, offset: this.value.length - start });
        this.processParsedJson(val);
      }
      this.finishWritingObject(start, fields);
    } else if (typeof parsed === "string") {
      this.writeString(parsed);
    } else if (typeof parsed === "boolean") {
      this.writeBoolean(parsed);
    } else if (typeof parsed === "number") {
      if (Number.isInteger(parsed)) {
        const asInt = BigInt(parsed);
        if (!this.writeSmallestInt(asInt)) {
          this.writeDecimalUnscaled(asInt, 0);
        }
      } else {
        this.writeDouble(parsed);
      }
    } else if (typeof parsed === "bigint") {
      if (!this.writeSmallestInt(parsed)) {
        this.writeDecimalUnscaled(parsed, 0);
      }
    } else {
      throw new VariantError(`unsupported JSON value: ${typeof parsed}`);
    }
  }

  private checkCapacity(additional: number): void {
    if (this.value.length + additional > this.sizeLimit) {
      throw new VariantError("variant size limit exceeded");
    }
  }

  private addKey(key: string): number {
    const existing = this.dictionary.get(key);
    if (existing !== undefined) return existing;
    const id = this.dictionaryKeys.length;
    this.dictionary.set(key, id);
    this.dictionaryKeys.push(TEXT_ENCODER.encode(key));
    return id;
  }

  private writeBoolean(b: boolean): void {
    this.checkCapacity(1);
    this.value.push(primitiveHeader(b ? TRUE : FALSE));
  }

  private writeNull(): void {
    this.checkCapacity(1);
    this.value.push(primitiveHeader(NULL));
  }

  private writeString(s: string): void {
    const text = TEXT_ENCODER.encode(s);
    const longStr = text.length > MAX_SHORT_STR_SIZE;
    this.checkCapacity((longStr ? 1 + U32_SIZE : 1) + text.length);
    if (longStr) {
      this.value.push(primitiveHeader(LONG_STR));
      pushUintLE(this.value, text.length, U32_SIZE);
    } else {
      this.value.push((text.length << 2) | SHORT_STR);
    }
    for (const b of text) this.value.push(b);
  }

  /** Writes a fixed-width signed little-endian integer primitive. */
  private writeFixedInt(typeCode: number, value: bigint, width: number): void {
    const max = (1n << BigInt(width * 8 - 1)) - 1n;
    const min = -(1n << BigInt(width * 8 - 1));
    if (value < min || value > max) {
      throw new VariantError(`integer value out of range for a ${width}-byte width`);
    }
    this.checkCapacity(1 + width);
    this.value.push(primitiveHeader(typeCode));
    pushSignedLE(this.value, value, width);
  }

  /** Writes the smallest int1/2/4/8 that fits; returns false if wider than int64. */
  private writeSmallestInt(i: bigint): boolean {
    this.checkCapacity(1 + 8);
    if (i >= I8_MIN && i <= I8_MAX) {
      this.value.push(primitiveHeader(INT1));
      pushSignedLE(this.value, i, 1);
    } else if (i >= I16_MIN && i <= I16_MAX) {
      this.value.push(primitiveHeader(INT2));
      pushSignedLE(this.value, i, 2);
    } else if (i >= I32_MIN && i <= I32_MAX) {
      this.value.push(primitiveHeader(INT4));
      pushSignedLE(this.value, i, 4);
    } else if (i >= I64_MIN && i <= I64_MAX) {
      this.value.push(primitiveHeader(INT8));
      pushSignedLE(this.value, i, 8);
    } else {
      return false;
    }
    return true;
  }

  private writeDecimalUnscaled(unscaled: bigint, scale: number): void {
    if (scale < 0) throw new VariantError("cannot encode decimal with negative scale");
    const digits = (unscaled < 0n ? -unscaled : unscaled).toString().length;
    this.checkCapacity(2 + 16);
    let code: number;
    let width: number;
    if (scale <= MAX_DECIMAL4_PRECISION && digits <= MAX_DECIMAL4_PRECISION) {
      code = DECIMAL4; width = 4;
    } else if (scale <= MAX_DECIMAL8_PRECISION && digits <= MAX_DECIMAL8_PRECISION) {
      code = DECIMAL8; width = 8;
    } else if (scale <= MAX_DECIMAL16_PRECISION && digits <= MAX_DECIMAL16_PRECISION) {
      code = DECIMAL16; width = 16;
    } else {
      throw new VariantError("decimal exceeds maximum precision (38)");
    }
    this.value.push(primitiveHeader(code));
    this.value.push(scale);
    pushSignedLE(this.value, unscaled, width);
  }

  private writeDouble(f: number): void {
    this.checkCapacity(1 + 8);
    this.value.push(primitiveHeader(DOUBLE));
    const buf = new DataView(new ArrayBuffer(8));
    buf.setFloat64(0, f, true);
    for (let i = 0; i < 8; i++) this.value.push(buf.getUint8(i));
  }

  private finishWritingArray(start: number, offsets: number[]): void {
    const dataSize = this.value.length - start;
    const numOffsets = offsets.length;
    const largeSize = numOffsets > U8_MAX;
    const sizeBytes = largeSize ? U32_SIZE : 1;
    const offsetSize = integerSize(dataSize);
    const header: number[] = [];
    header.push((largeSize ? 1 << (BASIC_TYPE_BITS + 2) : 0) |
      ((offsetSize - 1) << BASIC_TYPE_BITS) | ARRAY);
    pushUintLE(header, numOffsets, sizeBytes);
    for (const offset of offsets) pushUintLE(header, offset, offsetSize);
    pushUintLE(header, dataSize, offsetSize);
    this.value.splice(start, 0, ...header);
  }

  private finishWritingObject(start: number, fields: FieldEntry[]): void {
    const numFields = fields.length;
    // Compare the already-encoded dictionary key bytes rather than re-encoding on each comparison.
    fields.sort((a, b) =>
      compareKeysBytes(this.dictionaryKeys[a.id], this.dictionaryKeys[b.id]));
    const maxId = fields.reduce((m, f) => Math.max(m, f.id), 0);
    const dataSize = this.value.length - start;
    const largeSize = numFields > U8_MAX;
    const sizeBytes = largeSize ? U32_SIZE : 1;
    const idSize = integerSize(maxId);
    const offsetSize = integerSize(dataSize);
    const header: number[] = [];
    header.push((largeSize ? 1 << (BASIC_TYPE_BITS + 4) : 0) |
      ((idSize - 1) << (BASIC_TYPE_BITS + 2)) |
      ((offsetSize - 1) << BASIC_TYPE_BITS) | OBJECT);
    pushUintLE(header, numFields, sizeBytes);
    for (const field of fields) pushUintLE(header, field.id, idSize);
    for (const field of fields) pushUintLE(header, field.offset, offsetSize);
    pushUintLE(header, dataSize, offsetSize);
    this.value.splice(start, 0, ...header);
  }
}

function primitiveHeader(typeCode: number): number {
  return (typeCode << 2) | PRIMITIVE;
}

/**
 * Compares two object field keys by UTF-8 byte order, as required by the Variant spec. This
 * differs from JS string comparison (UTF-16 code unit order) for supplementary characters
 * (U+10000 and above), whose surrogate code units sort before U+E000-U+FFFF in UTF-16 but
 * after them in UTF-8.
 */
function compareKeysBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function integerSize(value: number): number {
  if (value <= U8_MAX) return 1;
  if (value <= U16_MAX) return 2;
  if (value <= U24_MAX) return U24_SIZE;
  return U32_SIZE;
}

function pushUintLE(out: number[], value: number, numBytes: number): void {
  for (let i = 0; i < numBytes; i++) {
    out.push((value >>> (8 * i)) & 0xff);
  }
}

function pushSignedLE(out: number[], value: bigint, width: number): void {
  let v = value < 0n ? (1n << BigInt(width * 8)) + value : value;
  for (let i = 0; i < width; i++) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
}

/** Interpret big-endian two's-complement bytes as a signed bigint. */
function bigEndianSigned(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const b of bytes) result = (result << 8n) | BigInt(b);
  if (bytes.length > 0 && (bytes[0] & 0x80) !== 0) {
    result -= 1n << BigInt(bytes.length * 8);
  }
  return result;
}
