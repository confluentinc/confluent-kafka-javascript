import { describe, expect, it } from "@jest/globals";
import { Decimal } from "decimal.js";
import { create } from "@bufbuild/protobuf";
import { DecimalSchema } from "../../../confluent/types/decimal_pb";
import {
  bigIntToTwosComplementBytes,
  bytesToBigIntSigned,
  decimalPlainString,
  decimalToUnscaled,
  fromProtoDecimal,
  toProtoDecimal,
  toProtoDecimalWithScale,
} from "../../../confluent/types/decimal-utils";

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
