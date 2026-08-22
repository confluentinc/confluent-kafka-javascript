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
})
