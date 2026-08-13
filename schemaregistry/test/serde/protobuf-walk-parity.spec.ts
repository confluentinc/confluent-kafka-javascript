import { describe, expect, it } from '@jest/globals';
import {
  clone,
  create,
  createFileRegistry,
  DescFile,
} from '@bufbuild/protobuf';
import {
  FieldDescriptorProto_Type,
  FileDescriptorProtoSchema,
} from '@bufbuild/protobuf/wkt';
import { RuleContext } from '../../serde/serde';
import { RuleMode } from '../../schemaregistry-client';
import { transform, validateProtobufMessage } from '../../serde/protobuf';
import { TestMessageSchema } from './test/test_pb';
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor';
import { FieldContext, FieldType } from '../../serde/serde';
import {
  ValidationInnerSchema,
  ValidationItemSchema,
  ValidationOuterSchema,
} from './test/validation_widget_pb';
import { ValidationRule, ValidationRuleError, ValidationRuleExecutor } from '../../serde/serde';

/**
 * The inline-validation walk and the field-transform walk have to reach the same fields:
 * both descend into a message-valued field with that field's own descriptor, into every
 * element of a repeated field, and into every value of a message-valued map.
 */
class AlwaysFail implements ValidationRuleExecutor {
  async execute(rule: ValidationRule, schema: any, msg: any): Promise<any> {
    return false
  }
}

function newOuter() {
  return create(ValidationOuterSchema, {
    inner: create(ValidationInnerSchema, { x: 1 }),
    items: [create(ValidationItemSchema, { v: 1 }), create(ValidationItemSchema, { v: 2 })],
    labels: { a: create(ValidationItemSchema, { v: 3 }) },
    maybe: 'hi',
    tags: ['t1', 't2'],
  })
}

describe('protobuf walk parity', () => {
  it('the validation walk reaches every nested message', async () => {
    const errors = await validateProtobufMessage(new AlwaysFail(), ValidationOuterSchema,
      newOuter(), false)
    expect(errors.map((e: ValidationRuleError) => `${e.rule.name}@${e.fieldPath}`)).toEqual([
      'r@inner.x',
      'itemRule@items[0]',
      'itemRule@items[1]',
      'maybeNotEmpty@maybe',
      'itemRule@labels["a"]',
      'tagsNotEmpty@tags',
    ])
  })

  it('the transform walk reaches every nested message', async () => {
    const visited: string[] = []
    const fieldTransform = {
      async transform(_ctx: RuleContext, fieldCtx: any, value: any): Promise<any> {
        visited.push(fieldCtx.name)
        return typeof value === 'string' ? `${value}-suffix` : value
      },
    }
    const rule = { name: 't', type: 'TEST', mode: RuleMode.WRITE, kind: 'TRANSFORM' } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)
    const msg = newOuter()

    await transform(ctx, ValidationOuterSchema, msg, fieldTransform)

    // Fields are walked in declaration order: inner, items, maybe, labels, tags.
    expect(visited).toEqual(['x', 'v', 'v', 'maybe', 'v', 'tags', 'tags'])
    expect(msg.maybe).toBe('hi-suffix')
    expect(msg.tags).toEqual(['t1-suffix', 't2-suffix'])
    expect(msg.inner!.x).toBe(1)
    expect(msg.labels['a'].v).toBe(3)
  })
})

describe('protobuf unsigned fields', () => {
  it('presents an unsigned field to a field rule as unsigned', async () => {
    // FieldType collapses uint32/uint64 onto INT and LONG, so without the unsignedness
    // travelling alongside, a rule comparing against a uint literal has no overload - and
    // the other clients all bind these as unsigned.
    const seen: any[] = []
    const fieldTransform = {
      async transform(_ctx: RuleContext, fieldCtx: any, value: any): Promise<any> {
        if (fieldCtx.name === 'test_uint64' || fieldCtx.name === 'test_uint32') {
          seen.push([fieldCtx.name, fieldCtx.isUnsigned])
        }
        return value
      },
    }
    const rule = { name: 't', type: 'TEST', mode: RuleMode.WRITE, kind: 'TRANSFORM' } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)
    const msg = create(TestMessageSchema, {
      testString: 'hi',
      testUint32: 7,
      testUint64: 18446744073709551615n,
    })

    await transform(ctx, TestMessageSchema, msg, fieldTransform)

    expect(seen).toEqual([['test_uint32', true], ['test_uint64', true]])
    // The value itself survives unchanged, and above int64 max.
    expect(msg.testUint64).toBe(18446744073709551615n)
  })

  it('evaluates a CEL field rule against an unsigned value', async () => {
    const validator = new CelFieldExecutor()
    const rule = {
      name: 't', type: 'CEL_FIELD', mode: RuleMode.WRITE, kind: 'TRANSFORM',
      // Arithmetic, not comparison: CEL compares across numeric types but has no
      // overload mixing int and uint, so this only resolves if the value is a uint.
      expr: "name == 'test_uint64' ; value % 10u == 5u",
    } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)
    const fieldCtx = new FieldContext({}, 'test.TestMessage.test_uint64', 'test_uint64',
      FieldType.LONG, new Set<string>(), true)

    const transformer = await validator.newTransform(ctx)
    expect(await transformer.transform(ctx, fieldCtx, 18446744073709551615n)).toBe(true)
  })
})

describe('protobuf absent fields', () => {
  it('leaves a field with unset presence absent', async () => {
    // Writing a transformed default back would materialize the field: an absent message or
    // unset optional scalar would become present.
    const fieldTransform = {
      async transform(_ctx: RuleContext, _fieldCtx: any, value: any): Promise<any> {
        return typeof value === 'string' ? `${value}-suffix` : value
      },
    }
    const rule = { name: 't', type: 'TEST', mode: RuleMode.WRITE, kind: 'TRANSFORM' } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)
    const msg = create(ValidationOuterSchema, { tags: ['t'] })

    await transform(ctx, ValidationOuterSchema, msg, fieldTransform)

    expect(msg.inner).toBeUndefined()
    expect(msg.maybe).toBeUndefined()
    expect(msg.tags).toEqual(['t-suffix'])
  })
})

describe('protobuf renamed fields', () => {
  /**
   * ValidationInner with field 1 renamed and tagged, standing in for a registered schema
   * whose field names have moved on from the generated class. Renaming a field at the same
   * number is a compatible change, since protobuf identifies a field by its number.
   */
  function renamedInner() {
    const original: DescFile = ValidationInnerSchema.file
    const proto = clone(FileDescriptorProtoSchema, original.proto)
    const message = proto.messageType.find((m: any) => m.name === 'ValidationInner')!
    const field = message.field.find((f: any) => f.number === 1)!
    field.name = 'renamed'
    field.jsonName = 'renamed'
    field.type = FieldDescriptorProto_Type.STRING
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

  it('both walks pair fields by number, not by name', async () => {
    const schemaDesc = renamedInner()
    // The generated class calls field 1 "x"; the registered schema calls it "renamed".
    const msg = create(ValidationInnerSchema, { x: 5 })

    const errors = await validateProtobufMessage(new AlwaysFail(), schemaDesc, msg, false,
      ValidationInnerSchema)
    // The rule on field 1 fires, reported under the registered schema's name.
    expect(errors.map((e: ValidationRuleError) => `${e.rule.name}@${e.fieldPath}`))
      .toEqual(['r@renamed'])

    const visited: string[] = []
    const fieldTransform = {
      async transform(_ctx: RuleContext, fieldCtx: any, value: any): Promise<any> {
        visited.push(fieldCtx.name)
        return value
      },
    }
    const rule = { name: 't', type: 'TEST', mode: RuleMode.WRITE, kind: 'TRANSFORM' } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)

    await transform(ctx, schemaDesc, msg, fieldTransform, ValidationInnerSchema)

    // The value was reached through the runtime property, and reported under the
    // registered name.
    expect(visited).toEqual(['renamed'])
    expect(msg.x).toBe(5)
  })
})

