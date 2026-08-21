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
    expect(v.numObjectElements()).toBe(5);
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
    expect(prim(FLOAT, f32(1.5)).getDouble()).toBe(1.5);
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
    const { value, metadata } = new VariantBuilder().build('{"k":true}');
    const v = fromBytes(value, metadata);
    expect(toJsonString(v)).toBe('{"k":true}');
  });
});
