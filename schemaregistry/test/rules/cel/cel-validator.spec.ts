import { describe, expect, it } from '@jest/globals';
import { clone, create, createFileRegistry, DescFile } from '@bufbuild/protobuf';
import {
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  FileDescriptorProtoSchema,
} from '@bufbuild/protobuf/wkt';
import avro from 'avsc';
import { CelValidator } from '../../../rules/cel/cel-validator';
import { VariantLogicalType } from '../../../serde/avro';
import { Variant, parseJson } from '../../../confluent/types/variant-utils';
import { VariantSchema } from '../../../confluent/types/variant_pb';
import { DecimalSchema } from '../../../confluent/types/decimal_pb';
import { RuleError, ValidationRule } from '../../../serde/serde';
import {
  ValidationInnerSchema,
  ValidationItemSchema,
  ValidationOuterSchema,
  ValidationPersonSchema,
} from '../../serde/test/validation_widget_pb';
import { NestedMessageSchema, Status } from '../../serde/test/nested_pb';

/**
 * Tests for CelValidator — the per-rule CEL semantics, independent of any walker.
 */
function rule(expr?: string, name = 'r', doc?: string, sql?: string): ValidationRule {
  return { name, doc, expr, sql }
}

describe('CelValidator results', () => {
  const cases: [string, any, boolean][] = [
    ['this >= 0', 30, true],
    ['this >= 0', -5, false],
    ['size(this) > 0', 'alice', true],
    ['size(this) > 0', '', false],
    ['this.age <= 150', { age: 30 }, true],
    ['this.age <= 150', { age: 200 }, false],
    ["this.startsWith('a')", 'alice', true],
    ["this in ['a', 'b']", 'a', true],
  ]

  it.each(cases)('evaluates %s', async (expr, value, expected) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, value)).toBe(expected)
  })

  it('returns the string a rule produces as the failure message', async () => {
    const validator = new CelValidator()
    const expr = "this >= 0 ? '' : 'age must be positive, got ' + string(this)"
    // An empty string means the rule passed.
    expect(await validator.execute(rule(expr), null, 5)).toBe('')
    expect(await validator.execute(rule(expr), null, -5)).toBe('age must be positive, got -5')
  })

  it('binds now for every evaluation', async () => {
    const validator = new CelValidator()
    expect(await validator.execute(rule("now > timestamp('2000-01-01T00:00:00Z')"), null, 1)).toBe(true)
  })
})

describe('CelValidator error surfaces', () => {
  it('rejects a null value as a contract violation', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this > 0'), null, null))
      .rejects.toThrow(/received a null value/)
  })

  it('rejects a missing expression', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule(undefined), null, 1)).rejects.toThrow(/has no expression/)
  })

  it('reports an uncompilable expression', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this >= '), null, 1))
      .rejects.toThrow(/Could not compile validation rule 'r'/)
  })

  it('reports an unevaluatable expression', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this.nope > 0'), null, { a: 1 }))
      .rejects.toThrow(/Could not execute validation rule 'r'/)
  })

  it('includes the rule doc in an evaluation error when present', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this.nope > 0', 'r', 'some doc'), null, { a: 1 }))
      .rejects.toThrow(/Could not execute validation rule 'r' \(some doc\)/)
  })

  it('rejects a result that is neither bool nor string', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('1 + 1'), null, 1))
      .rejects.toThrow(/must return bool or string/)
  })

  it('reports an unnamed rule as unnamed', async () => {
    const validator = new CelValidator()
    await expect(validator.execute({ expr: undefined }, null, 1))
      .rejects.toThrow(/Validation rule 'unnamed' has no expression/)
  })

  it('surfaces failures as RuleError', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this > 0'), null, null)).rejects.toBeInstanceOf(RuleError)
  })
})

describe('CelValidator protobuf values', () => {
  it('binds message fields', async () => {
    const validator = new CelValidator()
    const person = create(ValidationPersonSchema, { age: 30, name: 'Alice' })
    expect(await validator.execute(rule('this.age <= 150'), ValidationPersonSchema, person)).toBe(true)
    expect(await validator.execute(rule("this.name == 'Alice'"), ValidationPersonSchema, person)).toBe(true)
  })

  // Field-level rules are handed the field descriptor, not a message descriptor, and a
  // message, list or map field still binds a protobuf value to `this` — whose fields
  // only resolve if the env carries a registry that knows the value's type.
  it('binds the fields of a message-valued field', async () => {
    const validator = new CelValidator()
    const fd = ValidationOuterSchema.fields.find((f) => f.name === 'inner')!
    const inner = create(ValidationInnerSchema, { x: 5 })
    expect(await validator.execute(rule('this.x > 0'), fd, inner)).toBe(true)
  })

  it('binds the fields of a repeated message field', async () => {
    const validator = new CelValidator()
    const fd = ValidationOuterSchema.fields.find((f) => f.name === 'items')!
    const items = [create(ValidationItemSchema, { v: 1 })]
    expect(await validator.execute(rule('this[0].v > 0'), fd, items)).toBe(true)
  })

  // An enum binds as a CEL int, as in every other client. protobuf-es represents an enum
  // value as a plain JS number and cel-es reads a number as a double, so passing it through
  // unchanged typed the field double: `this == 1` still held, because cel-es compares across
  // the numeric types, but every integer operation on the field failed to find an overload.
  it('binds an enum field as an int, not a double', async () => {
    const validator = new CelValidator()
    const fd = NestedMessageSchema.fields.find((f) => f.name === 'status')!
    const inactive = Status.INACTIVE // = 1

    expect(await validator.execute(rule('type(this) == int'), fd, inactive)).toBe(true)
    expect(await validator.execute(rule('type(this) == double'), fd, inactive)).toBe(false)
    // Integer operations, which have no overload for a double.
    expect(await validator.execute(rule('this % 2 == 1'), fd, inactive)).toBe(true)
    expect(await validator.execute(rule('this + 1 == 2'), fd, inactive)).toBe(true)
    // And the plain comparison a rule is most likely to use.
    expect(await validator.execute(rule('this == 1'), fd, inactive)).toBe(true)
    expect(await validator.execute(rule('this == 0'), fd, inactive)).toBe(false)
  })

  it('binds the fields of a map message field', async () => {
    const validator = new CelValidator()
    const fd = ValidationOuterSchema.fields.find((f) => f.name === 'labels')!
    const labels = { a: create(ValidationItemSchema, { v: 1 }) }
    expect(await validator.execute(rule("this['a'].v > 0"), fd, labels)).toBe(true)
  })

  // One env per descriptor file has to know every type in that file, not just the first
  // one validated through it.
  it('binds fields of two message types declared in the same file', async () => {
    const validator = new CelValidator()
    const item = create(ValidationItemSchema, { v: 1 })
    expect(await validator.execute(rule('this.v > 0'), ValidationItemSchema, item)).toBe(true)
    const inner = create(ValidationInnerSchema, { x: 1 })
    expect(await validator.execute(rule('this.x > 0'), ValidationInnerSchema, inner)).toBe(true)
  })

  // Two schemas can declare the same .proto filename with different contents - different
  // subjects, or two versions of one subject - so the filename cannot identify the env.
  it('does not reuse an env across schemas that share a filename', async () => {
    const validator = new CelValidator()
    const inner = create(ValidationInnerSchema, { x: 5 })
    expect(await validator.execute(rule('this.x > 0'), ValidationInnerSchema, inner)).toBe(true)

    const evolved = evolvedInnerDescriptor()
    const evolvedMsg = { $typeName: evolved.typeName, x: 5, extra: 7 } as any
    expect(await validator.execute(rule('this.extra > 0'), evolved, evolvedMsg)).toBe(true)
  })
})

/**
 * ValidationInner from a second descriptor file that keeps the original filename but adds
 * a field, standing in for a schema that has evolved or for another subject that happens
 * to use the same .proto name.
 */
function evolvedInnerDescriptor() {
  const original: DescFile = ValidationInnerSchema.file
  const proto = clone(FileDescriptorProtoSchema, original.proto)
  const message = proto.messageType.find((m) => m.name === 'ValidationInner')!
  message.field.push(
    create(FieldDescriptorProtoSchema, {
      name: 'extra',
      number: 99,
      type: FieldDescriptorProto_Type.INT32,
      label: FieldDescriptorProto_Label.OPTIONAL,
      jsonName: 'extra',
    }),
  )
  // Keyed by the proto filename, which DescFile.name does not carry (it drops the
  // extension).
  const deps = new Map<string, DescFile>()
  const collect = (file: DescFile) => {
    for (const dep of file.dependencies) {
      if (!deps.has(dep.proto.name)) {
        deps.set(dep.proto.name, dep)
        collect(dep)
      }
    }
  }
  collect(original)
  const registry = createFileRegistry(proto, (name) => deps.get(name)?.proto)
  return registry.getMessage('test.ValidationInner')!
}

describe('CelValidator caching', () => {
  it('caches one program per expression', async () => {
    const validator = new CelValidator()
    for (let i = 0; i < 5; i++) {
      await validator.execute(rule('this >= 0'), null, i)
    }
    await validator.execute(rule('this <= 100'), null, 1)
    expect(validator.cache.size).toBe(2)
  })
})

describe('CelValidator is* format validators', () => {
  const cases: [string, string, boolean][] = [
    ['this.isEmail()', 'foo@bar.com', true],
    ['this.isEmail()', 'not-an-email', false],
    ['this.isHostname()', 'example.com', true],
    ['this.isIpv4()', '192.168.0.1', true],
    ['this.isIpv4()', '::1', false],
    ['this.isIpv6()', '::1', true],
    ['this.isUri()', 'https://example.com/x', true],
    ['this.isUriRef()', './foo/bar', true],
    ['this.isUuid()', '12345678-1234-1234-1234-123456789012', true],
    ['this.isUuid()', 'nope', false],
  ]

  it.each(cases)('evaluates %s on %s', async (expr, value, expected) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, value)).toBe(expected)
  })

  // Decimal/timestamp functions are now available in the validator env too.
  it('supports decimal functions in validation rules', async () => {
    const validator = new CelValidator()
    expect(await validator.execute(
      rule('decimals.gt(decimal(this), decimal("10.00"))'), null, '12.34')).toBe(true)
  })
})

// Rounding/scale parity with Java BigDecimal (schema-rules BuiltinOverload/DecimalUtils).
// `string(...)` renders a Decimal at its stored scale (BigDecimal.toPlainString), so these
// assert both the rounded value and its resulting scale in one shot.
describe('CelValidator decimal round/trunc scale (Java BigDecimal parity)', () => {
  // expr must return a string; `this` is unused so any scalar works.
  const evalStr = async (expr: string): Promise<any> => {
    const validator = new CelValidator()
    return validator.execute(rule(expr), null, 0)
  }

  // ITEM B: negative scale rounds/truncates left of the decimal point. decimal.js toDP throws
  // on a negative scale; these exercise the toNearest fallback. Java: setScale(-n, HALF_UP/DOWN).
  const negativeScaleCases: [string, string][] = [
    ['string(decimals.round(decimal("1234.5"), -2))', '1200'],
    ['string(decimals.round(decimal("1250"), -2))', '1300'],   // HALF_UP rounds the tie away from 0
    ['string(decimals.round(decimal("-1234.5"), -2))', '-1200'],
    ['string(decimals.round(decimal("-1250"), -2))', '-1300'],
    ['string(decimals.round(decimal("1234.5"), -1))', '1230'],
    ['string(decimals.round(decimal("5678"), -4))', '10000'],  // ties up to the nearest 10000
    ['string(decimals.trunc(decimal("1234.5"), -2))', '1200'],
    ['string(decimals.trunc(decimal("1299"), -2))', '1200'],   // DOWN = toward zero
    ['string(decimals.trunc(decimal("-1234.5"), -2))', '-1200'],
    ['string(decimals.trunc(decimal("-1299"), -2))', '-1200'],
    ['string(decimals.trunc(decimal("1234.5"), -1))', '1230'],
  ]
  it.each(negativeScaleCases)('%s == %s', async (expr, expected) => {
    expect(await evalStr(expr)).toBe(expected)
  })

  // ITEM B / round: a positive scale keeps exactly that scale (setScale pads trailing zeros).
  const positiveScaleCases: [string, string][] = [
    ['string(decimals.round(decimal("2.5"), 2))', '2.50'],
    ['string(decimals.round(decimal("2.567"), 2))', '2.57'],
    ['string(decimals.round(decimal("2.4"), 0))', '2'],
    ['string(decimals.round(decimal("2.5"), 0))', '3'],
  ]
  it.each(positiveScaleCases)('%s == %s', async (expr, expected) => {
    expect(await evalStr(expr)).toBe(expected)
  })

  // ITEM E (localized): decimal(bytes, scale) preserves the given scale, and string() renders it,
  // so a trailing-zero scale survives (Java new BigDecimal(unscaled, scale).toPlainString()).
  const bytesScaleCases: [string, string][] = [
    ['string(decimal(b"\\x07\\xc6", 2))', '19.90'],  // unscaled 1990, scale 2
    ['string(decimal(b"\\x04\\xd2", 2))', '12.34'],  // unscaled 1234, scale 2
    ['string(decimal(b"\\x0c", -2))', '1200'],       // unscaled 12, scale -2
  ]
  it.each(bytesScaleCases)('%s == %s', async (expr, expected) => {
    expect(await evalStr(expr)).toBe(expected)
  })

  // decimal(<uint>) must convert exactly across the whole unsigned range. CEL surfaces uint
  // (proto uint32/uint64 fields and uint literals) as a CelUint wrapper, not a bare bigint, so
  // this exercises the CelUint arm of toDecimal. The uint64 max is above the signed int64 max,
  // which a naive int64 cast would wrap to a negative — Java handles it via UnsignedLong.
  const uintCases: [string, string][] = [
    ['string(decimal(5u))', '5'],
    ['string(decimal(4294967295u))', '4294967295'],              // uint32 max
    ['string(decimal(9223372036854775808u))', '9223372036854775808'],   // 2^63, just past int64 max
    ['string(decimal(18446744073709551615u))', '18446744073709551615'], // uint64 max
  ]
  it.each(uintCases)('%s == %s', async (expr, expected) => {
    expect(await evalStr(expr)).toBe(expected)
  })

  it('decimal(uint64 max) is exact (no wrap to negative)', async () => {
    expect(await evalStr(
      'decimals.eq(decimal(18446744073709551615u), decimal("18446744073709551615")) ? "ok" : "wrong"'
    )).toBe('ok')
  })

  // FIX 1: decimal.js's global precision is 20 significant digits and its arithmetic rounds to it,
  // so the old `new Decimal(unscaled).mul(10^-scale)` construction silently truncated unscaled
  // values above 20 digits (Java BigDecimal is exact to 38). These reach the constructor,
  // decimal(bytes, scale), and the fromProtoDecimal reader with a 23-digit unscaled value.
  describe('exact above 20 significant digits (no precision rounding)', () => {
    // unscaled 12345678901234567890123 (23 digits), scale 5 -> 123456789012345678.90123.
    const bytes = 'b"\\x02\\x9d\\x42\\xb6\\x4e\\x76\\x71\\x42\\x44\\xcb"'
    it('decimal(bytes, scale) preserves all 23 digits', async () => {
      expect(await evalStr(`string(decimal(${bytes}, 5))`)).toBe('123456789012345678.90123')
    })
    it('string(decimal("<23 digits>")) is exact', async () => {
      expect(await evalStr('string(decimal("123456789012345678.90123"))'))
        .toBe('123456789012345678.90123')
    })
    it('decimals.eq distinguishes values differing beyond the 20th digit', async () => {
      // If construction rounded to 20 sig digits both would collapse to the same value.
      expect(await evalStr(
        'decimals.eq(decimal("123456789012345678.90123"), decimal("123456789012345678.90124")) ? "eq" : "ne"'
      )).toBe('ne')
    })
    it('decimals.eq matches bytes-read and string-parsed 23-digit values', async () => {
      expect(await evalStr(
        `decimals.eq(decimal(${bytes}, 5), decimal("123456789012345678.90123")) ? "eq" : "ne"`
      )).toBe('eq')
    })
  })

  // FIX 2: `==` on two Decimals is numeric (value-equal, scale-insensitive), matching decimals.eq,
  // rather than cel-es's field-by-field message equality (which would treat a scale-1 2.0 and a
  // scale-0 2.0 as unequal). `!=` negates.
  describe('== is numeric for Decimals', () => {
    const eqCases: [string, boolean][] = [
      ['decimal("2.0") == decimal("2.00")', true],
      ['decimal("2.0") == decimal("2.0")', true],
      ['decimal("2.0") == decimal("2.1")', false],
      ['decimal("2.0") != decimal("2.1")', true],
      ['decimal("2.0") != decimal("2.00")', false],
      // Differing stored scale: decimal(bytes=0x14=20, scale=1) = 2.0 vs the normalized literal.
      ['decimal(b"\\x14", 1) == decimal("2.0")', true],
      ['decimal(b"\\x14", 1) == decimal("2")', true],
      ['decimal(b"\\x14", 1) != decimal("2.1")', true],
      // Both scale-preserving via bytes: unscaled 200 scale 2 (2.00) vs unscaled 20 scale 1 (2.0).
      ['decimal(b"\\x00\\xc8", 2) == decimal(b"\\x14", 1)', true],
    ]
    it.each(eqCases)('%s -> %s', async (expr, expected) => {
      expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
    })

    // Non-Decimal == must still behave exactly as the stdlib (the override falls through to a
    // faithful port of cel-es equality for every other operand pair).
    const stdlibCases: [string, boolean][] = [
      ['1 == 1', true],
      ['1 == 2', false],
      ['1 == 1u', true],
      ['1.0 == 1', true],
      ["'a' == 'a'", true],
      ["'a' == 'b'", false],
      ['[1, 2] == [1, 2]', true],
      ['[1, 2] == [1, 3]', false],
      ['{"a": 1} == {"a": 1}', true],
      ['type(1) == int', true],
      ['1 != 2', true],
    ]
    it.each(stdlibCases)('stdlib: %s -> %s', async (expr, expected) => {
      expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
    })

    // Numeric Decimal `==` must also apply to Decimals nested in a container: the list/map
    // recursion inside the equality port routes back through the Decimal-aware entry point rather
    // than cel-es's field-by-field message equality.
    //
    // These MUST use the bytes constructor to discriminate scale: decimal("2.0") and
    // decimal("2.00") both normalize to scale 0 in decimal.js (string(...) == "2" for both), so a
    // string-literal version of these cases would pass vacuously. decimal(b"\x14", 1) is 2.0
    // (unscaled 20, scale 1) and decimal(b"\x00\xc8", 2) is 2.00 (unscaled 200, scale 2) — equal in
    // value, different in stored scale.
    describe('== is numeric for Decimals nested in containers', () => {
      const D20_S1 = 'decimal(b"\\x14", 1)'        // 2.0
      const D200_S2 = 'decimal(b"\\x00\\xc8", 2)'  // 2.00
      const D21_S1 = 'decimal(b"\\x15", 1)'        // 2.1

      const nestedCases: [string, boolean][] = [
        // Top-level control (already covered above; repeated as the baseline for the nested cases).
        [`${D20_S1} == ${D200_S2}`, true],
        // List elements.
        [`[${D20_S1}] == [${D200_S2}]`, true],
        [`[${D20_S1}] != [${D200_S2}]`, false],
        [`[${D20_S1}, ${D21_S1}] == [${D200_S2}, ${D21_S1}]`, true],
        // Map values.
        [`{"k": ${D20_S1}} == {"k": ${D200_S2}}`, true],
        [`{"k": ${D20_S1}} != {"k": ${D200_S2}}`, false],
        [`{"a": ${D20_S1}, "b": ${D21_S1}} == {"a": ${D200_S2}, "b": ${D21_S1}}`, true],
        // Nested containers: list in list, map in list, list in map.
        [`[[${D20_S1}]] == [[${D200_S2}]]`, true],
        [`[[${D20_S1}]] != [[${D200_S2}]]`, false],
        [`[{"k": ${D20_S1}}] == [{"k": ${D200_S2}}]`, true],
        [`{"k": [${D20_S1}]} == {"k": [${D200_S2}]}`, true],
        [`{"k": [${D20_S1}]} != {"k": [${D200_S2}]}`, false],
        [`[[[${D20_S1}]]] == [[[${D200_S2}]]]`, true],
        // Non-equal controls: numerically different Decimals stay unequal at every nesting level.
        [`[decimal("2.0")] == [decimal("2.1")]`, false],
        [`[decimal("2.0")] != [decimal("2.1")]`, true],
        [`[${D20_S1}] == [${D21_S1}]`, false],
        [`{"k": ${D20_S1}} == {"k": ${D21_S1}}`, false],
        [`[[${D20_S1}]] == [[${D21_S1}]]`, false],
        // Structural inequality still short-circuits (size / key mismatch).
        [`[${D20_S1}] == [${D200_S2}, ${D200_S2}]`, false],
        [`{"a": ${D20_S1}} == {"b": ${D200_S2}}`, false],
      ]
      it.each(nestedCases)('%s -> %s', async (expr, expected) => {
        expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
      })

      // Container equality for every non-Decimal element type must be byte-for-byte unchanged by
      // the recursion re-point (it only adds a Decimal-pair short-circuit ahead of the fall-through
      // to the cel-es equality port).
      const nonDecimalContainerCases: [string, boolean][] = [
        ['[1, 2, 3] == [1, 2, 3]', true],
        ['[1, 2, 3] == [1, 2, 4]', false],
        ['[1] == [1u]', true],              // cross-type numeric equality inside a list
        ['[1] == [1.0]', true],
        ['["a", "b"] == ["a", "b"]', true],
        ['["a", "b"] == ["a", "c"]', false],
        ['[true, false] == [true, false]', true],
        ['[true] == [false]', false],
        ['[b"\\x01\\x02"] == [b"\\x01\\x02"]', true],
        ['[b"\\x01\\x02"] == [b"\\x01\\x03"]', false],
        ['[[1, 2], [3]] == [[1, 2], [3]]', true],
        ['[[1, 2], [3]] == [[1, 2], [4]]', false],
        ['[] == []', true],
        ['[1] == ["1"]', false],            // no cross-kind coercion
        ['{"a": 1, "b": 2} == {"a": 1, "b": 2}', true],
        ['{"a": 1} == {"a": 2}', false],
        ['{"a": "x"} == {"a": "x"}', true],
        ['{"a": true} == {"a": true}', true],
        ['{"a": b"\\x01"} == {"a": b"\\x01"}', true],
        ['{"a": [1, 2]} == {"a": [1, 2]}', true],
        ['{"a": [1, 2]} == {"a": [1, 3]}', false],
        ['{"a": {"b": 1}} == {"a": {"b": 1}}', true],
        ['{"a": {"b": 1}} == {"a": {"b": 2}}', false],
        ['{} == {}', true],
        ['{1: "a"} == {1: "a"}', true],     // non-string map keys
        ['[type(1)] == [int]', true],
        ['[1, 2] != [1, 3]', true],
        ['{"a": 1} != {"a": 2}', true],
      ]
      it.each(nonDecimalContainerCases)('non-Decimal container: %s -> %s', async (expr, expected) => {
        expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
      })
    })
  })

  // FIX 3: `in` over a list is numeric for Decimals too. `@in` is a separate stdlib overload whose
  // impl calls cel-es's internal `equals` directly, so it never consulted the `_==_` override
  // above: before the DECIMAL_FUNCS `@in(dyn,list)` registration,
  // `decimal(b"\x14", 1) in [decimal(b"\x00\xc8", 2)]` was FALSE while `==` on the same pair was
  // already TRUE.
  //
  // Same trap as the nested-`==` cases above: these MUST use the bytes constructor to discriminate
  // scale. decimal("2.0") and decimal("2.00") both normalize to scale 0 (string(...) == "2" for
  // both), so a string-literal version of these cases would pass vacuously.
  describe('in is numeric for Decimals', () => {
    const D20_S1 = 'decimal(b"\\x14", 1)'        // 2.0  (unscaled 20,  scale 1)
    const D200_S2 = 'decimal(b"\\x00\\xc8", 2)'  // 2.00 (unscaled 200, scale 2)
    const D21_S1 = 'decimal(b"\\x15", 1)'        // 2.1  (unscaled 21,  scale 1)

    const inCases: [string, boolean][] = [
      // The regression itself: differing stored scale, equal value.
      [`${D20_S1} in [${D200_S2}]`, true],
      [`${D200_S2} in [${D20_S1}]`, true],
      // Baseline: `==` on the same pair (was already true; asserted here so the two agree).
      [`${D20_S1} == ${D200_S2}`, true],
      // Same scale, equal value.
      [`${D20_S1} in [${D20_S1}]`, true],
      // Unequal values stay out, at either scale.
      [`${D20_S1} in [${D21_S1}]`, false],
      [`${D20_S1} in [${D21_S1}, decimal(b"\\x16", 1)]`, false],
      // Found among several candidates, only one of which matches.
      [`${D20_S1} in [${D21_S1}, ${D200_S2}]`, true],
      // Empty list.
      [`${D20_S1} in []`, false],
      // Negation / `!=` forms.
      [`!(${D20_S1} in [${D21_S1}])`, true],
      [`!(${D20_S1} in [${D200_S2}])`, false],
      [`(${D20_S1} in [${D200_S2}]) != false`, true],
      // Decimals nested one level down: the membership test recurses through the same
      // Decimal-aware equality, so a list-of-lists matches on value rather than on scale.
      [`[${D20_S1}] in [[${D200_S2}]]`, true],
      [`[${D20_S1}] in [[${D21_S1}]]`, false],
      [`[${D20_S1}] in [[${D21_S1}], [${D200_S2}]]`, true],
      [`{"k": ${D20_S1}} in [{"k": ${D200_S2}}]`, true],
      [`{"k": ${D20_S1}} in [{"k": ${D21_S1}}]`, false],
    ]
    it.each(inCases)('%s -> %s', async (expr, expected) => {
      expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
    })

    // Non-Decimal `in` must be byte-for-byte unchanged: the list form falls through to the
    // cel-es equality port, and the `@in(<scalar>, map)` overloads are not registered over at all.
    const stdlibInCases: [string, boolean][] = [
      ['1 in [1, 2]', true],
      ['3 in [1, 2]', false],
      ['1 in []', false],
      ['1 in [1u]', true],              // cross-type numeric membership
      ['1 in [1.0]', true],
      ["'a' in ['a']", true],
      ["'a' in ['b', 'c']", false],
      ['true in [true, false]', true],
      ['false in [true]', false],
      ['1.5 in [1.5]', true],
      ['1u in [1u]', true],
      ['b"\\x01" in [b"\\x01"]', true],
      ['b"\\x01" in [b"\\x02"]', false],
      ['[1] in [[1], [2]]', true],
      ['[1] in [[2], [3]]', false],
      ['{"a": 1} in [{"a": 1}]', true],
      ['1 in ["1"]', false],            // no cross-kind coercion
      // The map overloads (`@in(string,map)` etc.) are untouched.
      ["'a' in {'a': 1}", true],
      ["'b' in {'a': 1}", false],
      ['1 in {1: "a"}', true],
      ['2 in {1: "a"}', false],
      ['true in {true: "a"}', true],
      ['1.0 in {1.0: "a"}', true],
      ['1u in {1u: "a"}', true],
    ]
    it.each(stdlibInCases)('stdlib: %s -> %s', async (expr, expected) => {
      expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
    })
  })
})

// FIX 4: the bare `timestamp(int)` argument is epoch SECONDS, not millis. @bufbuild/cel's stdlib
// reads it as millis (`timestampFromMs`); the CEL spec and every other Schema Registry client read
// it as seconds, so `timestamp(this.epoch) < now` used to be 1000x wrong in JS. TIMESTAMP_FUNCS
// registers a same-id `timestamp(int)` overload that displaces the stdlib one.
//
// Before the fix: `int(timestamp(1700000000))` was 1700000 and
// `timestamp(1700000000) == timestamp("2023-11-14T22:13:20Z")` was false (it equalled
// "1970-01-20T16:13:20Z" instead).
describe('CelValidator timestamp(int) is epoch seconds', () => {
  const evalStr = async (expr: string): Promise<any> => {
    const validator = new CelValidator()
    return validator.execute(rule(expr), null, 0)
  }

  // `string(timestamp)` renders RFC 3339 and `int(timestamp)` yields the epoch seconds, so these
  // pin the reading directly rather than only via a comparison.
  const renderCases: [string, string][] = [
    ['string(timestamp(1700000000))', '2023-11-14T22:13:20Z'],
    ['string(int(timestamp(1700000000)))', '1700000000'],
    ['string(timestamp(0))', '1970-01-01T00:00:00Z'],
    ['string(timestamp(1))', '1970-01-01T00:00:01Z'],
    // Negative epoch seconds (pre-1970).
    ['string(timestamp(-1))', '1969-12-31T23:59:59Z'],
    // The old millis reading would have rendered 1970-01-20T16:13:20Z here.
    ['string(timestamp(1700000))', '1970-01-20T16:13:20Z'],
  ]
  it.each(renderCases)('%s -> %s', async (expr, expected) => {
    expect(await evalStr(expr)).toBe(expected)
  })

  const boolCases: [string, boolean][] = [
    ['timestamp(1700000000) == timestamp("2023-11-14T22:13:20Z")', true],
    // The old millis reading; must NOT match any more.
    ['timestamp(1700000000) == timestamp("1970-01-20T16:13:20Z")', false],
    ['timestamp(1700000000) != timestamp("1970-01-20T16:13:20Z")', true],
    ['timestamp(0) == timestamp("1970-01-01T00:00:00Z")', true],
    ['timestamp(-1) == timestamp("1969-12-31T23:59:59Z")', true],
    // Ordering, the shape a real rule uses.
    ['timestamp(1700000000) < timestamp(1700000001)', true],
    ['timestamp(1700000000) > timestamp("2000-01-01T00:00:00Z")', true],
    ['now > timestamp(0)', true],
    // Timestamp accessors see the seconds-based instant.
    ['timestamp(1700000000).getFullYear() == 2023', true],
    ['timestamp(1700000000).getHours() == 22', true],

    // ---- MUST NOT REGRESS: the other stdlib `timestamp` overloads ----
    // timestamp(string): RFC 3339 parsing.
    ['timestamp("2026-01-01T00:00:00Z") == timestamp("2026-01-01T00:00:00Z")', true],
    ['timestamp("2026-01-01T00:00:00Z") != timestamp("2026-01-02T00:00:00Z")', true],
    ['timestamp("2026-01-01T00:00:00Z").getFullYear() == 2026', true],
    ['timestamp("2023-11-14T22:13:20Z") == timestamp(1700000000)', true],
    // timestamp(timestamp): identity.
    ['timestamp(timestamp("2026-01-01T00:00:00Z")) == timestamp("2026-01-01T00:00:00Z")', true],
    ['timestamp(timestamp(1700000000)) == timestamp(1700000000)', true],

    // ---- timestamp(value, precision): 0 seconds, 3 millis, 6 micros, 9 nanos ----
    ['timestamp(1700000000, 0) == timestamp(1700000000)', true],
    ['timestamp(1700000000000, 3) == timestamp(1700000000)', true],
    ['timestamp(1700000000000000, 6) == timestamp(1700000000)', true],
    ['timestamp(1700000000000000000, 9) == timestamp(1700000000)', true],
    ['timestamp(1700000000000, 3) == timestamp("2023-11-14T22:13:20Z")', true],
    // Sub-second precision survives.
    ['timestamp(1700000000123, 3) == timestamp("2023-11-14T22:13:20.123Z")', true],
    ['timestamp(1700000000123456, 6) == timestamp("2023-11-14T22:13:20.123456Z")', true],
    // The same integer means different instants across the two arities.
    ['timestamp(1700000000, 3) == timestamp(1700000000)', false],
    // Pre-epoch values floor toward negative infinity rather than truncating toward zero,
    // which would leave a proto Timestamp with a negative nanos field.
    ['timestamp(-500, 3) == timestamp("1969-12-31T23:59:59.500Z")', true],
    ['timestamp(-1, 9) == timestamp("1969-12-31T23:59:59.999999999Z")', true],
  ]
  it.each(boolCases)('%s -> %s', async (expr, expected) => {
    expect(await evalStr(`${expr} ? "T" : "F"`)).toBe(expected ? 'T' : 'F')
  })

  // With the unit a number rather than a name, rejecting anything outside {0, 3, 6, 9} is the
  // only thing between a typo and a silently wrong instant.
  it.each([1, 2, 4, 5, 7, 8, 10, -3])('rejects precision %s', async (precision) => {
    const validator = new CelValidator()
    await expect(
      validator.execute(rule(`timestamp(1700000000, ${precision}) == now`), null, 0))
      .rejects.toThrow(/unknown precision/)
  })

  // CEL's timestamp range is google.protobuf.Timestamp's: 0001-01-01T00:00:00Z through
  // 9999-12-31T23:59:59.999999999Z. @bufbuild/protobuf's create() performs no validation, so
  // without an explicit check `timestamp(253402300800)` built a year-10000 instant that merely
  // compared unequal — Java, Go, Python, C# and C++ all fail the rule here instead.
  it.each([
    'timestamp(253402300800)',
    'timestamp(-62135596801)',
    'timestamp(253402300800000, 3)',
  ])('rejects out-of-range %s', async (expr) => {
    const validator = new CelValidator()
    await expect(validator.execute(rule(`${expr} == now`), null, 0))
      .rejects.toThrow(/must be in range/)
  })

  // Both boundaries are themselves valid, and render as the same instants Java does.
  // (Asserted on the rendered instant rather than .getFullYear(), which @bufbuild/cel reports as
  // 1901 for year 1 — JS's two-digit-year mapping, where `new Date(1, ...)` means 1901.)
  it.each([
    "string(timestamp(253402300799)) == '9999-12-31T23:59:59Z'",
    "string(timestamp(-62135596800)) == '0001-01-01T00:00:00Z'",
  ])('accepts boundary %s', async (expr) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, 0)).toBe(true)
  })
})

// Scale preservation across every decimal-producing operation (Java BigDecimal parity).
//
// decimal.js has no scale concept - `new Decimal("2.00")` normalizes to 2 - so results encoded
// from decimalPlaces() silently dropped trailing zeros, and `string(decimal("2.00"))` came back
// as "2". Scale is now recovered from each operand and carried through explicitly, following
// BigDecimal's rules: add/sub/mod take max(s1,s2), mul takes s1+s2, neg/abs keep the operand's,
// greatest/least keep the *selected* operand's, sqrt uses the preferred scale/2 when the root is
// exact, and div alone has no derived scale (MathContext gives the quotient its own).
//
// Every expectation below is the verbatim output of the Java reference for the same expression.
describe('CelValidator decimal scale preservation (Java BigDecimal parity)', () => {
  const evalStr = async (expr: string): Promise<any> => {
    const validator = new CelValidator()
    return validator.execute(rule(expr), null, 0)
  }

  const scaleCases: [string, string][] = [
    ['string(decimal("2.00"))', '2.00'],
    ['string(decimal("2.0"))', '2.0'],
    ['string(decimal("2"))', '2'],
    ['string(decimal("0.00"))', '0.00'],
    ['string(decimal("-1.50"))', '-1.50'],
    ['string(decimal("1E+3"))', '1000'],
    ['string(decimal("2.00e1"))', '20.0'],
    ['string(decimal("1e-5"))', '0.00001'],
    ['string(decimal(5))', '5'],
    ['string(decimal(5.25))', '5.25'],
    ['string(decimal(decimal("3.400")))', '3.400'],
    ['string(decimals.add(decimal("1.5"), decimal("1.50")))', '3.00'],
    ['string(decimals.add(decimal("1.005"), decimal("2.1")))', '3.105'],
    ['string(decimals.add(decimal("1"), decimal("2")))', '3'],
    ['string(decimals.sub(decimal("1.5"), decimal("1.50")))', '0.00'],
    ['string(decimals.sub(decimal("5.250"), decimal("1.1")))', '4.150'],
    ['string(decimals.mul(decimal("2.0"), decimal("3.0")))', '6.00'],
    ['string(decimals.mul(decimal("1.25"), decimal("4.000")))', '5.00000'],
    ['string(decimals.mul(decimal("2"), decimal("3")))', '6'],
    ['string(decimals.div(decimal("1.0"), decimal("4.0")))', '0.25'],
    ['string(decimals.div(decimal("1.00"), decimal("4.0")))', '0.25'],
    ['string(decimals.div(decimal("1"), decimal("4")))', '0.25'],
    ['string(decimals.div(decimal("1"), decimal("3")))', '0.33333333333333333333333333333333333333'],
    ['string(decimals.div(decimal("10.0"), decimal("2.0")))', '5'],
    ['string(decimals.mod(decimal("5.50"), decimal("2.0")))', '1.50'],
    ['string(decimals.mod(decimal("5.5"), decimal("2.00")))', '1.50'],
    ['string(decimals.mod(decimal("7"), decimal("3")))', '1'],
    ['string(decimals.greatest(decimal("2.0"), decimal("2.00")))', '2.0'],
    ['string(decimals.greatest(decimal("3.00"), decimal("2.0")))', '3.00'],
    ['string(decimals.least(decimal("2.0"), decimal("2.00")))', '2.0'],
    ['string(decimals.least(decimal("3.00"), decimal("2.0")))', '2.0'],
    ['string(decimals.sqrt(decimal("4.00")))', '2.0'],
    ['string(decimals.sqrt(decimal("4")))', '2'],
    ['string(decimals.sqrt(decimal("2")))', '1.4142135623730950488016887242096980786'],
    ['string(decimals.sqrt(decimal("9.0000")))', '3.00'],
    ['string(decimals.neg(decimal("1.50")))', '-1.50'],
    ['string(decimals.abs(decimal("-1.50")))', '1.50'],
    ['string(decimals.floor(decimal("1.50")))', '1'],
    ['string(decimals.ceil(decimal("1.50")))', '2'],
    ['string(decimals.trunc(decimal("1.50")))', '1'],
    ['string(decimals.trunc(decimal("1.2999"), 2))', '1.29'],
    ['string(decimals.trunc(decimal("1.5"), 4))', '1.5'],
    ['string(decimals.round(decimal("2.5"), 2))', '2.50'],
    ['string(decimals.round(decimal("1.50")))', '2'],
    ['string(decimals.add(decimals.mul(decimal("2.0"), decimal("3.0")), decimal("1.000")))', '7.000'],
    ['string(decimal(5.0))', '5.0'],
    ['string(decimal(100.0))', '100.0'],
    ['string(decimal(0.1))', '0.1'],
    ['string(decimals.sqrt(decimal("1.0")))', '1'],
    ['string(decimals.sqrt(decimal("0.0004")))', '0.02'],
    ['string(decimals.sqrt(decimal("2.25")))', '1.5'],
    ['string(decimals.sqrt(decimal("6.250000")))', '2.500'],
    ['string(decimals.sqrt(decimal("100.000")))', '10.0'],
    ['string(decimals.trunc(decimal("1.50"), 4))', '1.50'],
    ['string(decimals.trunc(decimal("2.00")))', '2'],
    ['string(decimals.floor(decimal("2.00")))', '2'],
    ['string(decimals.ceil(decimal("2.00")))', '2'],
    ['string(decimals.round(decimal("2.00")))', '2'],
    ['string(decimals.add(decimal("1E+3"), decimal("1")))', '1001'],
    ['string(decimals.mul(decimal("1E+3"), decimal("2")))', '2000'],
    ['string(decimals.neg(decimal("1E+3")))', '-1000'],
    ['string(decimals.greatest(decimal("2.00"), decimal("2.0")))', '2.00'],
    ['string(decimals.least(decimal("2.00"), decimal("2.0")))', '2.00'],
  ]
  it.each(scaleCases)('%s == %s', async (expr, expected) => {
    expect(await evalStr(expr)).toBe(expected)
  })

  // Equality stays numeric across differing scales. Preserving scale means two decimals that
  // used to encode to byte-identical protos ("2.00" and "2.0" both normalized to 2) now differ
  // structurally, so anything that fell back to a message comparison would start reporting them
  // unequal - where Java compares by value. Lists are included because container equality is
  // exactly where such a fallback would hide.
  const equalityCases: [string, boolean][] = [
    ['decimal("2.00") == decimal("2.0")', true],
    ['decimal("2.00") == decimal("2")', true],
    ['decimals.eq(decimal("2.00"), decimal("2.0"))', true],
    ['decimal("2.00") != decimal("2.0")', false],
    ['decimal("2.00") in [decimal("2.0"), decimal("9")]', true],
    ['decimals.add(decimal("1.5"), decimal("1.50")) == decimal("3")', true],
    ['decimal("0.00") == decimal("0")', true],
    ['[decimal("2.00")] == [decimal("2.0")]', true],
  ]
  it.each(equalityCases)('%s is %s', async (expr, expected) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, 0)).toBe(expected)
  })
})

describe('CelValidator variant functions', () => {
  // `this` is a JSON string; variants.parseJson(this) turns it into a Variant, then the
  // variants.* accessors navigate and extract. Covers the null model (absent vs
  // variant-null), navigation, typed extraction, and toJson.
  const V = 'variants.parseJson(this)'
  const json =
    '{"name":"alice","age":30,"scores":[10,20,30],"nested":{"x":1},"explicit":null}'
  const cases: string[] = [
    `variants.type(${V}) == 'object'`,
    `variants.as(variants.field(${V}, 'name'), 'string') == 'alice'`,
    `variants.as(variants.field(${V}, 'age'), 'int') == 30`,
    `variants.field(${V}, 'missing') == null`,
    `variants.isNull(variants.field(${V}, 'explicit'))`,
    `!variants.isNull(variants.field(${V}, 'missing'))`,
    `variants.as(variants.path(${V}, '$.nested.x'), 'int') == 1`,
    `variants.as(variants.index(variants.field(${V}, 'scores'), 2), 'int') == 30`,
    `variants.tryAs(variants.field(${V}, 'age'), 'string') == null`,
    `variants.toJson(variants.field(${V}, 'nested')) == '{"x":1}'`,
  ]

  it.each(cases)('evaluates %s', async (expr) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, json)).toBe(true)
  })

  // A string is rejected by variant(...) with a redirect to parseJson.
  it('rejects a string passed to variant()', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule("variants.type(variant(this)) == 'object'"), null, 'x'))
      .rejects.toThrow(/Could not execute/)
  })

  // variant(null) yields CEL null instead of erroring (matching the Java reference), and it
  // composes: a null flows through the accessors as absent.
  const nullCases: string[] = [
    'variant(null) == null',
    "variants.field(variant(null), 'k') == null",
    // An absent field is null, and variant(null) of it is still null.
    `variant(variants.field(${V}, 'missing')) == null`,
  ]

  it.each(nullCases)('variant(null) yields CEL null: %s', async (expr) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, json)).toBe(true)
  })

  // variants.tryParseJson soft-fails to CEL null on unparseable input, including empty and
  // whitespace-only strings (JSON.parse throws SyntaxError, which tryParseJson catches).
  const tryParseNullCases: string[] = [
    "variants.tryParseJson('') == null",
    "variants.tryParseJson('   ') == null",
    "variants.tryParseJson('{not json') == null",
  ]

  it.each(tryParseNullCases)('tryParseJson soft-fails to null: %s', async (expr) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, json)).toBe(true)
  })

  // The non-finite bareword contract, end to end through the CEL layer. JSON.parse rejects the
  // barewords, so parseJson rewrites them; Java (Jackson), Python, C#, Rust, Go and C++ all
  // accept them, and every client's toJson writes them back out as barewords.
  const nonFiniteCases: string[] = [
    "variants.type(variants.parseJson('NaN')) == 'double'",
    "variants.type(variants.parseJson('Infinity')) == 'double'",
    "variants.type(variants.parseJson('-Infinity')) == 'double'",
    "variants.toJson(variants.parseJson('NaN')) == 'NaN'",
    "variants.toJson(variants.parseJson('Infinity')) == 'Infinity'",
    "variants.toJson(variants.parseJson('-Infinity')) == '-Infinity'",
    `variants.toJson(variants.parseJson('{"a":NaN}')) == '{"a":NaN}'`,
    `variants.toJson(variants.parseJson('[NaN,Infinity,-Infinity]')) == '[NaN,Infinity,-Infinity]'`,
    `variants.type(variants.field(variants.parseJson('{"a":NaN}'), 'a')) == 'double'`,
    // Magnitude overflow, which JSON.parse already reads as Infinity.
    "variants.toJson(variants.parseJson('1e400')) == 'Infinity'",
    // A bareword is a successful parse, not a soft failure.
    "variants.tryParseJson('NaN') != null",
    // Spelling and case are exact, matching Jackson, so these stay soft failures.
    "variants.tryParseJson('nan') == null",
    "variants.tryParseJson('INFINITY') == null",
  ]

  it.each(nonFiniteCases)('non-finite through CEL: %s', async (expr) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, json)).toBe(true)
  })
})

describe('CelValidator variant serde into CEL', () => {
  const expr = "variants.as(variants.field(variant(this), 'name'), 'string') == 'alice'"

  // An Avro `variant` logical-type field decodes to a Variant (via the production
  // VariantLogicalType), which then flows into CEL through variant(this).
  it('passes an Avro variant (logical type) into CEL', async () => {
    const type = avro.Type.forSchema(
      {
        type: 'record', name: 'confluent.type.Variant', logicalType: 'variant',
        fields: [{ name: 'metadata', type: 'bytes' }, { name: 'value', type: 'bytes' }],
      } as avro.Schema,
      { logicalTypes: { variant: VariantLogicalType } },
    )
    const { value, metadata } = parseJson('{"name":"alice","age":30}')
    const decoded = type.fromBuffer(type.toBuffer(new Variant(value, metadata)))
    expect(decoded).toBeInstanceOf(Variant)
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, decoded)).toBe(true)
  })

  // A confluent.type.Variant proto message flows into CEL through variant(this).
  it('passes a Protobuf variant message into CEL', async () => {
    const { value, metadata } = parseJson('{"name":"alice","age":30}')
    const msg = create(VariantSchema, { value, metadata })
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), VariantSchema, msg)).toBe(true)
  })

  // Cross-client parity: a variant value is usable with the variants.* accessors with no
  // variant(...) call, in both formats, and the wrapped form keeps working alongside it. The
  // accessors are declared [DYN, ...] and coerce inside, so they take whatever the decoder
  // produced.
  const bareCases: [string, boolean][] = [
    // Bare: no constructor call.
    ["variants.type(this) == 'object'", true],
    ["variants.as(variants.field(this, 'name'), 'string') == 'alice'", true],
    ["variants.as(variants.path(this, '$.age'), 'int') == 30", true],
    // The wrapped form must keep working (variant(...) re-entry).
    ["variants.as(variants.field(variant(this), 'name'), 'string') == 'alice'", true],
    // A missing key is CEL null, not an error.
    ["variants.field(this, 'nope') == null", true],
    // Negative control.
    ["variants.as(variants.field(this, 'name'), 'string') == 'bob'", false],
  ]

  it.each(bareCases)('Avro variant needs no constructor: %s', async (e, expected) => {
    const type = avro.Type.forSchema(
      {
        type: 'record', name: 'confluent.type.Variant', logicalType: 'variant',
        fields: [{ name: 'metadata', type: 'bytes' }, { name: 'value', type: 'bytes' }],
      } as avro.Schema,
      { logicalTypes: { variant: VariantLogicalType } },
    )
    const { value, metadata } = parseJson('{"name":"alice","age":30}')
    const decoded = type.fromBuffer(type.toBuffer(new Variant(value, metadata)))
    expect(await new CelValidator().execute(rule(e), null, decoded)).toBe(expected)
  })

  // `variants.isNull` must coerce its receiver like every other accessor. It is declared [DYN],
  // so a bare variant field reaches it. A bare *object* cannot catch a missing coercion - isNull
  // on an object is false either way - so only a variant that is itself null discriminates.
  it.each([['null', true], ['5', false]] as [string, boolean][])(
    'variants.isNull coerces a bare receiver: %s', async (json, expected) => {
      const { value, metadata } = parseJson(json)
      const msg = create(VariantSchema, { value, metadata })
      expect(await new CelValidator().execute(
        rule('variants.isNull(this)'), VariantSchema, msg)).toBe(expected)
      // The wrapped form has always worked and must keep working.
      expect(await new CelValidator().execute(
        rule('variants.isNull(variant(this))'), VariantSchema, msg)).toBe(expected)
    })

  it.each(bareCases)('Protobuf variant needs no constructor: %s', async (e, expected) => {
    const { value, metadata } = parseJson('{"name":"alice","age":30}')
    const msg = create(VariantSchema, { value, metadata })
    expect(await new CelValidator().execute(rule(e), VariantSchema, msg)).toBe(expected)
  })
})

// Cross-client parity: a bare confluent.type.Decimal field is usable with decimals.*, ==,
// string() and double() with no decimal(...) call on it. The discriminating case is the
// scale-differing equality: a client comparing decimals by their protobuf encoding (unscaled
// bytes plus scale, field by field) answers false for decimal("12.340"), because 12.34 and
// 12.340 are the same number in two different encodings.
describe('CelValidator bare protobuf decimal', () => {
  const bareDecimalCases: [string, boolean][] = [
    // Bare: no constructor call on the field.
    ['decimals.eq(this, decimal("12.34"))', true],
    ['decimals.gt(this, decimal("10.00"))', true],
    // The wrapped form must keep working (decimal(...) re-entry).
    ['decimals.eq(decimal(this), decimal("12.34"))', true],
    // `==` is numeric on it: 12.34 equals 12.340 despite the differing scale.
    ['this == decimal("12.340")', true],
    ['this != decimal("12.340")', false],
    ['decimals.lt(this, decimal("100"))', true],
    // Negative control: a false comparison must still be false.
    ['decimals.gt(this, decimal("100"))', false],
    ['string(this) == "12.34"', true],
    ['double(this) == 12.34', true],
  ]

  it.each(bareDecimalCases)('Protobuf decimal needs no constructor: %s', async (e, expected) => {
    // 12.34 = unscaled 1234 (0x04D2) at scale 2.
    const msg = create(DecimalSchema, { value: new Uint8Array([0x04, 0xd2]), scale: 2 })
    expect(await new CelValidator().execute(rule(e), DecimalSchema, msg)).toBe(expected)
  })
})
