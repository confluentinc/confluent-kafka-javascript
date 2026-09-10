import { describe, expect, it } from "@jest/globals";
import { Decimal } from "decimal.js";
import { create } from "@bufbuild/protobuf";
import { DecimalSchema } from "../../../confluent/type/decimal_pb";
import {
  bigIntToTwosComplementBytes,
  bytesToBigIntSigned,
  decimalPlainString,
  decimalToUnscaled,
  fromProtoDecimal,
  toProtoDecimal,
  toProtoDecimalWithScale,
} from "../../../confluent/type/decimal-utils";

/**
 * FIX 1 regression: decimal.js's global precision is 20 significant digits, and its arithmetic
 * (`.mul`/`.times`) rounds to it. Constructing/reading a Decimal via `new Decimal(unscaled).mul(...)`
 * silently lost value for unscaled magnitudes above 20 digits (Java's BigDecimal is exact to 38).
 * These assert exactness for >20-digit unscaled values across all four converters.
 */
describe("decimal-utils exactness above 20 significant digits", () => {
  const proto = (unscaled: bigint, scale: number) =>
    create(DecimalSchema, {
      value: bigIntToTwosComplementBytes(unscaled),
      scale,
      precision: 0,
    });

  it("fromProtoDecimal keeps all 23 digits (no rounding to 20)", () => {
    // The canonical example: unscaled 12345678901234567890123 (23 digits), scale 5.
    const d = fromProtoDecimal(proto(12345678901234567890123n, 5));
    expect(d.toFixed(5)).toBe("123456789012345678.90123");
  });

  it("fromProtoDecimal handles negative unscaled and scale 0", () => {
    expect(fromProtoDecimal(proto(-12345678901234567890123n, 5)).toFixed(5)).toBe(
      "-123456789012345678.90123",
    );
    expect(fromProtoDecimal(proto(98765432109876543210987n, 0)).toFixed()).toBe(
      "98765432109876543210987",
    );
    expect(fromProtoDecimal(proto(0n, 0)).toFixed()).toBe("0");
  });

  it("toProtoDecimal round-trips a >20-digit value exactly", () => {
    const d = new Decimal("123456789012345678.90123");
    const p = toProtoDecimal(d);
    expect(p.scale).toBe(5);
    expect(bytesToBigIntSigned(p.value)).toBe(12345678901234567890123n);
    // Full round-trip proto -> Decimal -> proto.
    const back = toProtoDecimal(fromProtoDecimal(proto(12345678901234567890123n, 5)));
    expect(back.scale).toBe(5);
    expect(bytesToBigIntSigned(back.value)).toBe(12345678901234567890123n);
  });

  it("toProtoDecimalWithScale preserves the requested scale exactly (>20 digits)", () => {
    const d = new Decimal("123456789012345678.90123");
    const p = toProtoDecimalWithScale(d, 5);
    expect(p.scale).toBe(5);
    expect(bytesToBigIntSigned(p.value)).toBe(12345678901234567890123n);

    // Negative scale: 38-digit multiple of 100 at scale -2 -> divide is exact.
    const big = new Decimal("12345678901234567890123456789012345600");
    const neg = toProtoDecimalWithScale(big, -2);
    expect(neg.scale).toBe(-2);
    expect(bytesToBigIntSigned(neg.value)).toBe(123456789012345678901234567890123456n);

    // Negative unscaled, trailing-zero scale.
    const negVal = toProtoDecimalWithScale(new Decimal("-19.90"), 2);
    expect(negVal.scale).toBe(2);
    expect(bytesToBigIntSigned(negVal.value)).toBe(-1990n);
  });

  it("decimalPlainString builds exact plain strings", () => {
    expect(decimalPlainString(12345678901234567890123n, 5)).toBe("123456789012345678.90123");
    expect(decimalPlainString(-1990n, 2)).toBe("-19.90");
    expect(decimalPlainString(1234n, 0)).toBe("1234");
    expect(decimalPlainString(12n, -2)).toBe("1200");
    expect(decimalPlainString(5n, 3)).toBe("0.005");
    expect(decimalPlainString(0n, 2)).toBe("0.00");
  });

  it("decimalToUnscaled is the exact inverse (no precision rounding)", () => {
    expect(decimalToUnscaled(new Decimal("123456789012345678.90123"), 5)).toBe(
      12345678901234567890123n,
    );
    expect(decimalToUnscaled(new Decimal("-19.90"), 2)).toBe(-1990n);
    expect(decimalToUnscaled(new Decimal("1200"), -2)).toBe(12n);
    expect(decimalToUnscaled(new Decimal("0"), 0)).toBe(0n);
  });
});

/**
 * `confluent.type.Decimal.precision` is the unscaled value's digit count -- what
 * `BigDecimal.precision()` reports, and what the JVM writes from both `DecimalUtils.fromBigDecimal`
 * and its CEL `ProtobufResultWriter`. Both writers here hard-coded `precision: 0`, so the same
 * value serialized differently than it does on the JVM.
 *
 * Derived from the unscaled value actually written, not from the operand's own digits: the two
 * differ whenever a scale is applied. Understating precision would make a reader that treats it as
 * a MathContext (Java and Python both do) round the value and shift its scale.
 */
describe("decimal-utils precision matches BigDecimal.precision()", () => {
  // Verified against the JVM: new BigDecimal(v).precision() / .setScale(s).precision().
  const derived: [string, number, number][] = [
    // value, precision, scale  -- decimal.js normalizes trailing zeros, so scale is its own
    ["12.34", 4, 2],
    ["100", 3, 0],
    ["0", 1, 0],       // zero has precision 1, not 0
    ["-12.34", 4, 2],  // the sign is not a digit
  ];
  it.each(derived)("toProtoDecimal(%s) -> precision %d", (value, precision, scale) => {
    const p = toProtoDecimal(new Decimal(value));
    expect(p.precision).toBe(precision);
    expect(p.scale).toBe(scale);
  });

  // The explicit-scale variant: applying a scale changes the digit count, and precision must
  // follow the written unscaled value. JVM: new BigDecimal("12.34").setScale(4).precision() == 6.
  const explicit: [string, number, number, bigint][] = [
    ["12.34", 4, 6, 123400n],
    ["12.34", 2, 4, 1234n],
    ["1200", -2, 2, 12n],
    ["0", 0, 1, 0n],
  ];
  it.each(explicit)(
    "toProtoDecimalWithScale(%s, %d) -> precision %d",
    (value, scale, precision, unscaled) => {
      const p = toProtoDecimalWithScale(new Decimal(value), scale);
      expect(p.precision).toBe(precision);
      expect(p.scale).toBe(scale);
      expect(bytesToBigIntSigned(p.value)).toBe(unscaled);
    },
  );
});

