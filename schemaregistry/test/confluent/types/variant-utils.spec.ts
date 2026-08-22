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

import { describe, expect, it } from "@jest/globals";
import { Decimal } from "decimal.js";
import {
  Variant,
  VariantBuilder,
  VariantError,
  VariantType,
  parseJson,
  toJsonString,
  fromBytes,
  NULL, TRUE, FALSE, INT1, INT2, INT4, INT8, DOUBLE, FLOAT,
  DECIMAL4, DECIMAL8, DECIMAL16, DATE, TIMESTAMP, TIMESTAMP_NTZ, TIME,
  TIMESTAMP_NANOS, TIMESTAMP_NANOS_NTZ, BINARY, UUID,
} from "../../../confluent/types/variant-utils";

const EMPTY_META = new Uint8Array([1, 0, 0]); // version 1, offset_size 1, dict_size 0

function le(value: bigint, width: number): number[] {
  let v = value < 0n ? (1n << BigInt(width * 8)) + value : value;
  const out: number[] = [];
  for (let i = 0; i < width; i++) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return out;
}

function f64(n: number): number[] {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, n, true);
  return Array.from(new Uint8Array(dv.buffer));
}

function f32(n: number): number[] {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, n, true);
  return Array.from(new Uint8Array(dv.buffer));
}

function prim(code: number, payload: number[] = []): Variant {
  return new Variant(new Uint8Array([code << 2, ...payload]), EMPTY_META);
}

function dec(code: number, scale: number, unscaled: bigint, width: number): Variant {
  return prim(code, [scale, ...le(unscaled, width)]);
}

describe("Variant reader - navigation", () => {
  it("parses an object and navigates fields, arrays, and nested paths", () => {
    const v = parseJson(
      '{"name":"alice","age":30,"scores":[10,20,30],"nested":{"x":1},"explicit":null}');
    expect(v.getType()).toBe(VariantType.OBJECT);
    expect(v.numObjectFields()).toBe(5);
    expect(v.getFieldByKey("name")!.getString()).toBe("alice");
    expect(v.getFieldByKey("age")!.getLong()).toBe(30n);
    expect(v.getFieldByKey("scores")!.getElementAtIndex(2)!.getLong()).toBe(30n);
    expect(v.getFieldByKey("scores")!.numArrayElements()).toBe(3);
    // Absent (missing) vs present-but-variant-null (explicit JSON null).
    expect(v.getFieldByKey("missing")).toBeNull();
    expect(v.getFieldByKey("explicit")!.getType()).toBe(VariantType.NULL);
  });

  it("uses binary search past 32 fields", () => {
    const obj: Record<string, number> = {};
    for (let i = 0; i < 40; i++) obj[`k${String(i).padStart(2, "0")}`] = i;
    const v = parseJson(JSON.stringify(obj));
    expect(v.getFieldByKey("k39")!.getLong()).toBe(39n);
    expect(v.getFieldByKey("k00")!.getLong()).toBe(0n);
    expect(v.getFieldByKey("k40")).toBeNull();
  });

  it("returns null for out-of-bounds array index", () => {
    const v = parseJson("[1, 2, 3]");
    expect(v.getElementAtIndex(0)!.getLong()).toBe(1n);
    expect(v.getElementAtIndex(3)).toBeNull();
    expect(v.getElementAtIndex(-1)).toBeNull();
  });
});

describe("Variant reader - getType", () => {
  const cases: [Variant, VariantType][] = [
    [prim(NULL), VariantType.NULL],
    [prim(TRUE), VariantType.BOOLEAN],
    [prim(FALSE), VariantType.BOOLEAN],
    [prim(INT1, le(1n, 1)), VariantType.BYTE],
    [prim(INT2, le(1n, 2)), VariantType.SHORT],
    [prim(INT4, le(1n, 4)), VariantType.INT],
    [prim(INT8, le(1n, 8)), VariantType.LONG],
    [prim(DOUBLE, f64(1)), VariantType.DOUBLE],
    [prim(FLOAT, f32(1)), VariantType.FLOAT],
    [dec(DECIMAL4, 2, 1234n, 4), VariantType.DECIMAL4],
    [dec(DECIMAL8, 2, 1234n, 8), VariantType.DECIMAL8],
    [dec(DECIMAL16, 2, 1234n, 16), VariantType.DECIMAL16],
    [prim(DATE, le(18262n, 4)), VariantType.DATE],
    [prim(TIMESTAMP, le(0n, 8)), VariantType.TIMESTAMP_TZ],
    [prim(TIMESTAMP_NTZ, le(0n, 8)), VariantType.TIMESTAMP_NTZ],
    [prim(TIME, le(0n, 8)), VariantType.TIME],
    [prim(TIMESTAMP_NANOS, le(0n, 8)), VariantType.TIMESTAMP_NANOS_TZ],
    [prim(TIMESTAMP_NANOS_NTZ, le(0n, 8)), VariantType.TIMESTAMP_NANOS_NTZ],
    [prim(BINARY, le(0n, 4)), VariantType.BINARY],
    [prim(UUID, new Array(16).fill(0)), VariantType.UUID],
  ];
  it.each(cases)("types %#", (variant, expected) => {
    expect(variant.getType()).toBe(expected);
  });

  it("types short and long strings as STRING", () => {
    expect(parseJson('"hi"').getType()).toBe(VariantType.STRING);
    expect(parseJson(`"${"x".repeat(100)}"`).getType()).toBe(VariantType.STRING);
  });
});

describe("Variant reader - scalar getters", () => {
  it("reads integer widths as bigint", () => {
    expect(prim(INT1, le(-5n, 1)).getLong()).toBe(-5n);
    expect(prim(INT2, le(-300n, 2)).getLong()).toBe(-300n);
    expect(prim(INT4, le(100000n, 4)).getLong()).toBe(100000n);
    expect(prim(INT8, le(9876543210n, 8)).getLong()).toBe(9876543210n);
  });

  it("reads float and double", () => {
    expect(prim(DOUBLE, f64(2.5)).getDouble()).toBe(2.5);
    expect(prim(FLOAT, f32(1.5)).getFloat()).toBe(1.5);
  });

  it("reads narrowed integer getters with widening", () => {
    // getByte accepts only INT1.
    expect(prim(INT1, le(-5n, 1)).getByte()).toBe(-5);
    // getShort widens INT1 -> INT2.
    expect(prim(INT1, le(-5n, 1)).getShort()).toBe(-5);
    expect(prim(INT2, le(-300n, 2)).getShort()).toBe(-300);
    // getInt widens INT1/INT2 -> INT4.
    expect(prim(INT1, le(-5n, 1)).getInt()).toBe(-5);
    expect(prim(INT2, le(-300n, 2)).getInt()).toBe(-300);
    expect(prim(INT4, le(100000n, 4)).getInt()).toBe(100000);
  });

  it("narrowed integer getters reject wider widths", () => {
    expect(() => prim(INT2, le(1n, 2)).getByte()).toThrow(VariantError);
    expect(() => prim(INT4, le(1n, 4)).getShort()).toThrow(VariantError);
    expect(() => prim(INT8, le(1n, 8)).getInt()).toThrow(VariantError);
  });

  it("getDouble rejects a FLOAT (exact double only)", () => {
    expect(() => prim(FLOAT, f32(1.5)).getDouble()).toThrow(VariantError);
  });

  it("getFloat rejects a DOUBLE (exact float only)", () => {
    expect(() => prim(DOUBLE, f64(2.5)).getFloat()).toThrow(VariantError);
  });

  it("reads boolean, binary, uuid", () => {
    expect(prim(TRUE).getBoolean()).toBe(true);
    expect(prim(FALSE).getBoolean()).toBe(false);
    expect(prim(BINARY, [...le(4n, 4), 1, 2, 3, 4]).getBinary()).toEqual(new Uint8Array([1, 2, 3, 4]));
    const u = "00112233-4455-6677-8899-aabbccddeeff";
    const uuidBytes = u.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16));
    expect(prim(UUID, uuidBytes).getUuid()).toBe(u);
  });

  it.each([
    [DECIMAL4, 2, 1234n, 4, "12.34"],
    [DECIMAL8, 2, 1234n, 8, "12.34"],
    [DECIMAL16, 2, 1234n, 16, "12.34"],
    [DECIMAL4, 2, 150n, 4, "1.5"], // decimal.js normalizes trailing zeros
  ])("reads decimal %#", (code, scale, unscaled, width, expected) => {
    expect(dec(code, scale, unscaled, width).getDecimal().equals(new Decimal(expected))).toBe(true);
  });
});

describe("Variant reader - toJson cross-language contract", () => {
  const cases: [Variant, string][] = [
    // Instant (TZ): seconds always present, 'Z', 0/3/6/9 grouping.
    [prim(TIMESTAMP, le(1577836800000000n, 8)), '"2020-01-01T00:00:00Z"'],
    [prim(TIMESTAMP, le(1577836800123000n, 8)), '"2020-01-01T00:00:00.123Z"'],
    [prim(TIMESTAMP, le(1577836800123456n, 8)), '"2020-01-01T00:00:00.123456Z"'],
    // NTZ: seconds always present, no zone.
    [prim(TIMESTAMP_NTZ, le(1577836800000000n, 8)), '"2020-01-01T00:00:00"'],
    [prim(TIMESTAMP_NTZ, le(1577836830000000n, 8)), '"2020-01-01T00:00:30"'],
    // Nanos: full precision.
    [prim(TIMESTAMP_NANOS, le(1577836800123456789n, 8)), '"2020-01-01T00:00:00.123456789Z"'],
    // Time.
    [prim(TIME, le(45296123456n, 8)), '"12:34:56.123456"'],
    [prim(TIME, le(45240000000n, 8)), '"12:34:00"'],
    // Date.
    [prim(DATE, le(18262n, 4)), '"2020-01-01"'],
    // UUID + binary.
    [prim(UUID, "00112233-4455-6677-8899-aabbccddeeff".replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16))),
      '"00112233-4455-6677-8899-aabbccddeeff"'],
    [prim(BINARY, [...le(4n, 4), 0, 1, 2, 3]), `"${Buffer.from([0, 1, 2, 3]).toString("base64")}"`],
  ];
  it.each(cases)("renders %#", (variant, expected) => {
    expect(variant.toJson()).toBe(expected);
  });

  it("renders decimals as fixed-point (never scientific), preserving scale", () => {
    expect(dec(DECIMAL4, 7, 1n, 4).toJson()).toBe("0.0000001");
    expect(dec(DECIMAL4, 2, 150n, 4).toJson()).toBe("1.50");
    expect(dec(DECIMAL4, 2, 1234n, 4).toJson()).toBe("12.34");
  });

  it("round-trips structure with sorted keys and compact separators", () => {
    const src = '{"a":1,"b":[true,null,"x"],"c":{"d":2}}';
    expect(parseJson(src).toJson()).toBe('{"a":1,"b":[true,null,"x"],"c":{"d":2}}');
  });
});

describe("Variant reader - malformed input", () => {
  it("rejects an unsupported metadata version", () => {
    expect(() => new Variant(new Uint8Array([0]), new Uint8Array([2, 0, 0]))).toThrow(VariantError);
  });

  it("rejects malformed JSON in parseJson", () => {
    expect(() => parseJson("{not json")).toThrow();
  });

  it("rejects a wrong-typed getter", () => {
    expect(() => prim(TRUE).getString()).toThrow(VariantError);
    expect(() => prim(NULL).getLong()).toThrow(VariantError);
  });

  it("round-trips via fromBytes / toJsonString", () => {
    const { value, metadata } = parseJson('{"k":true}');
    const v = fromBytes(value, metadata);
    expect(toJsonString(v)).toBe('{"k":true}');
  });

  // --- VariantBuilder (flat streaming writer) ---

  it("builds byte-for-byte identically to parseJson", () => {
    // Note: no decimal field here. In JS, JSON.parse yields a `number` for every JSON
    // number, so parseJson never emits a decimal - byte-identity with a decimal field is
    // impossible via parseJson. The decimal builder is covered by the overload test below.
    const src =
      '{"id":42,"name":"hello","active":true,"score":3.5,' +
      '"missing":null,"nums":[1,2,3],"nested":{"a":1}}';

    const b = new VariantBuilder();
    b.startObject();
    b.appendKey("id");
    b.appendByte(42);            // parseJson encodes 42 as INT1
    b.appendKey("name");
    b.appendString("hello");
    b.appendKey("active");
    b.appendBoolean(true);
    b.appendKey("score");
    b.appendDouble(3.5);
    b.appendKey("missing");
    b.appendNull();
    b.appendKey("nums");
    b.startArray();
    b.appendByte(1);
    b.appendByte(2);
    b.appendByte(3);
    b.endArray();
    b.appendKey("nested");
    b.startObject();
    b.appendKey("a");
    b.appendByte(1);
    b.endObject();
    b.endObject();
    const built = b.build();

    const parsed = parseJson(src);

    // Canonical-equivalence via JSON.
    expect(built.toJson()).toBe(parsed.toJson());
    // Byte-identical value + metadata.
    expect(Array.from(built.value)).toEqual(Array.from(parsed.value));
    expect(Array.from(built.metadata)).toEqual(Array.from(parsed.metadata));
  });

  it("supports the native decimal.js overload", () => {
    // decimal.js normalizes "1.50" to 1.5 (scale 1), so the equivalent bytes overload is
    // unscaled 15 at scale 1.
    const b1 = new VariantBuilder();
    b1.appendDecimal(new Decimal("1.50"));
    const b2 = new VariantBuilder();
    b2.appendDecimal(bigEndian(15n), 1);
    expect(Array.from(b1.build().value)).toEqual(Array.from(b2.build().value));
    expect(b1.build().toJson()).toBe("1.5");
  });

  it("builds a root scalar", () => {
    const b = new VariantBuilder();
    b.appendLong(1234567890123n);
    const v = b.build();
    expect(v.getType()).toBe(VariantType.LONG);
    expect(v.getLong()).toBe(1234567890123n);
    expect(v.toJson()).toBe("1234567890123");
  });

  it("throws on appendKey outside an object", () => {
    const b = new VariantBuilder();
    expect(() => b.appendKey("x")).toThrow(VariantError);
  });

  it("throws on a value with no preceding appendKey in an object", () => {
    const b = new VariantBuilder();
    b.startObject();
    expect(() => b.appendLong(1n)).toThrow(VariantError);
  });

  it("throws on build with an open container", () => {
    const b = new VariantBuilder();
    b.startArray();
    b.appendLong(1n);
    expect(() => b.build()).toThrow(VariantError);
  });

  it("throws on an unbalanced end", () => {
    const b = new VariantBuilder();
    b.startObject();
    expect(() => b.endArray()).toThrow(VariantError);
  });
});

describe("Variant builder - regression", () => {
  it("4-byte offsets for data region larger than 16 MiB", () => {
    // A single string element whose UTF-8 length is just over 0xFFFFFF (16777215)
    // forces the array's offset region to need 4-byte offsets. Previously integerSize
    // capped at 3 bytes and produced a corrupt Variant.
    const len = 16777216; // > 0xFFFFFF
    const big = "a".repeat(len);
    const b = new VariantBuilder(64 * 1024 * 1024);
    b.startArray();
    b.appendString(big);
    b.endArray();
    const v = b.build();
    expect(v.getType()).toBe(VariantType.ARRAY);
    expect(v.numArrayElements()).toBe(1);
    const elem = v.getElementAtIndex(0)!;
    expect(elem.getType()).toBe(VariantType.STRING);
    expect(elem.getString().length).toBe(len);
  });

  it("parseJson of an integer literal larger than int64 does not corrupt", () => {
    // 29 digits, > 2^63. writeSmallestInt returns false, so the number branch must fall
    // back to a DECIMAL (scale 0) rather than silently writing nothing.
    let v!: Variant;
    expect(() => { v = parseJson("12345678901234567890123456789"); }).not.toThrow();
    // A valid decimal variant (exact numeric value is lost by JSON.parse - inherent limit).
    expect([VariantType.DECIMAL4, VariantType.DECIMAL8, VariantType.DECIMAL16])
      .toContain(v.getType());
    expect(v.getDecimalParts().scale).toBe(0);
  });

  it("object keys are sorted by UTF-8 byte order", () => {
    // U+FFFF encodes to UTF-8 EF BF BF; U+10000 (𐀀) to F0 90 80 80, so U+FFFF must
    // sort FIRST by unsigned byte order. In UTF-16 the high surrogate 0xD800 of
    // U+10000 sorts before 0xFFFF, so a UTF-16 comparison would order them the other
    // way. Keys are appended in the wrong (UTF-16) order on purpose.
    const bmpKey = "￿";              // U+FFFF
    const supplementaryKey = "\u{10000}"; // U+10000

    const b = new VariantBuilder();
    b.startObject();
    b.appendKey(supplementaryKey);
    b.appendLong(2n);
    b.appendKey(bmpKey);
    b.appendLong(1n);
    b.endObject();
    const v = b.build();

    expect(v.getType()).toBe(VariantType.OBJECT);
    expect(v.numObjectFields()).toBe(2);
    expect(v.getFieldAtIndex(0)[0]).toBe(bmpKey);
    expect(v.getFieldAtIndex(1)[0]).toBe(supplementaryKey);
    expect(v.getFieldByKey(bmpKey)!.getLong()).toBe(1n);
    expect(v.getFieldByKey(supplementaryKey)!.getLong()).toBe(2n);
  });

  it("large object binary search resolves a supplementary-plane key", () => {
    // 42 fields exceeds the binary-search threshold (32), so getFieldByKey uses the
    // byte-order binary search. The supplementary-plane key must be found despite
    // UTF-16 vs UTF-8 ordering disagreement.
    const bmpKey = "￿";              // U+FFFF
    const supplementaryKey = "\u{10000}"; // U+10000

    const b = new VariantBuilder();
    b.startObject();
    for (let i = 0; i < 40; i++) {
      b.appendKey(`a${String(i).padStart(3, "0")}`);
      b.appendLong(BigInt(i));
    }
    b.appendKey(bmpKey);
    b.appendLong(998n);
    b.appendKey(supplementaryKey);
    b.appendLong(999n);
    b.endObject();
    const v = b.build();

    expect(v.numObjectFields()).toBe(42);
    expect(v.getFieldByKey(bmpKey)).not.toBeNull();
    expect(v.getFieldByKey(bmpKey)!.getLong()).toBe(998n);
    expect(v.getFieldByKey(supplementaryKey)).not.toBeNull();
    expect(v.getFieldByKey(supplementaryKey)!.getLong()).toBe(999n);
    expect(v.getFieldByKey("a037")!.getLong()).toBe(37n);
  });

  it("appendDecimal(Decimal) preserves >20 significant digits without rounding", () => {
    // decimal.js arithmetic (times/pow) rounds to the global precision (default 20
    // significant digits), which silently zeroed the low-order digits of any value with
    // more than 20 sig digits. Deriving the unscaled integer from the exact string form
    // (toFixed) instead must preserve all 28 digits here (fits DECIMAL16's 38).
    const b = new VariantBuilder();
    b.appendDecimal(new Decimal("1234567890123456789012345678"));
    const v = b.build();

    const { unscaled, scale } = v.getDecimalParts();
    expect(unscaled).toBe(1234567890123456789012345678n);
    expect(scale).toBe(0);
    expect(v.getDecimal().toFixed()).toBe("1234567890123456789012345678");
  });

  it("FLOAT renders float32-shortest, not f64-precision noise", () => {
    // Bug #7: the FLOAT case widened the f64 through the double formatter, emitting the
    // f64-shortest string (e.g. "0.10000000149011612") instead of the float32-shortest
    // string ("0.1") that Java Float.toString / Apache Arrow produce.
    const render = (f: number): string => {
      const b = new VariantBuilder();
      b.appendFloat(f);
      return b.build().toJson();
    };
    expect(render(0.1)).toBe("0.1");
    expect(render(0.3)).toBe("0.3");
    expect(render(2.0)).toBe("2.0"); // integer ".0" preserved
  });
});

/** Minimal-length big-endian two's-complement bytes for a bigint. */
function bigEndian(value: bigint): Uint8Array {
  const negative = value < 0n;
  const out: number[] = [];
  let v = value;
  if (v === 0n) return new Uint8Array([0]);
  while (v !== 0n && v !== -1n) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
  // Ensure the sign bit is correct.
  const top = out.length > 0 ? out[out.length - 1] : 0;
  if (!negative && (top & 0x80) !== 0) out.push(0x00);
  if (negative && (top & 0x80) === 0) out.push(0xff);
  out.reverse();
  return new Uint8Array(out);
}
