import { describe, expect, it } from '@jest/globals';
import {
  clone,
  create,
  createFileRegistry,
  DescFile,
} from '@bufbuild/protobuf';
import {
  FieldDescriptorProtoSchema,
  FileDescriptorProtoSchema,
  MessageOptionsSchema,
} from '@bufbuild/protobuf/wkt';
import { setExtension } from '@bufbuild/protobuf';
import { field_meta, MetaSchema, message_meta } from '../../confluent/meta_pb';
import { RuleContext } from '../../serde/serde';
import { RuleMode } from '../../schemaregistry-client';
import { transform, validateProtobufMessage } from '../../serde/protobuf';
import { TestMessageSchema } from './test/test_pb';
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor';
import { CelValidator } from '../../rules/cel/cel-validator';
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
    // Only the name changes: renaming a field at the same number is compatible, whereas
    // changing its type is not - and the message would not transcode.
    field.name = 'renamed'
    field.jsonName = 'renamed'
    // A message-level rule that refers to the field by its new name, as a rule authored
    // against the registered schema would.
    message.options = message.options ?? create(MessageOptionsSchema)
    setExtension(message.options, message_meta, create(MetaSchema, {
      rules: [{ name: 'm', doc: '', expr: 'this.renamed > 0', sql: '' }],
    }))
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
    // The message-level rule fires at the root, and the rule on field 1 fires under the
    // registered schema's name for it.
    expect(errors.map((e: ValidationRuleError) => `${e.rule.name}@${e.fieldPath}`))
      .toEqual(['m@', 'r@renamed'])

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

  it('a message-level rule sees the values under the schema\'s names', async () => {
    // A message-level rule binds `this` to the message, and its CEL environment is built
    // from the registered schema - so the message it evaluates has to be in the schema's
    // terms too. Otherwise `this.renamed` reads a missing field and returns false, failing
    // a valid message.
    const schemaDesc = renamedInner()
    const msg = create(ValidationInnerSchema, { x: 5 })
    const validator = new CelValidator()

    const errors = await validateProtobufMessage(validator, schemaDesc, msg, false,
      ValidationInnerSchema)

    // `this.renamed > 0` holds because the message was re-read through the schema, so the
    // value is under `renamed`. Without that, the rule reads a missing field and fails.
    expect(errors).toEqual([])
  })
})

describe('protobuf schema view', () => {
  /**
   * Rebuilds the validation widget file from its own descriptor proto, applying mutate to the
   * copy. The result is a registry distinct from the generated one, so a test can pair a
   * registered schema against the generated types the way use.latest.version does.
   */
  function rebuiltWidget(mutate: (proto: any) => void, messageName: string) {
    const original: DescFile = ValidationOuterSchema.file
    const proto = clone(FileDescriptorProtoSchema, original.proto)
    mutate(proto)
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
    return registry.getMessage(messageName)!
  }

  function messageOf(proto: any, name: string) {
    return proto.messageType.find((m: any) => m.name === name)!
  }

  /** Records the value each rule was handed, so a test can inspect what `this` was bound to. */
  class Recorder implements ValidationRuleExecutor {
    readonly seen: any[] = []

    async execute(rule: ValidationRule, schema: any, msg: any): Promise<any> {
      this.seen.push(msg)
      return true
    }
  }

  it('does not re-read a message whose type already presents the schema\'s fields', async () => {
    // A generated type's descriptor is never the same object as the one built from the
    // registered schema, so an identity check alone would re-read every record. When the two
    // describe the same fields, the rule is handed the caller's own message - no copy.
    const schemaDesc = rebuiltWidget((proto) => {
      // A message-level rule, so `this` is bound to the message and the test can see which
      // object the rule was handed. The field set is untouched.
      const message = messageOf(proto, 'ValidationInner')
      message.options = message.options ?? create(MessageOptionsSchema)
      setExtension(message.options, message_meta, create(MetaSchema, {
        rules: [{ name: 'm', doc: '', expr: 'true', sql: '' }],
      }))
    }, 'test.ValidationInner')
    const msg = create(ValidationInnerSchema, { x: 5 })
    expect(schemaDesc).not.toBe(ValidationInnerSchema)

    const recorder = new Recorder()
    await validateProtobufMessage(recorder, schemaDesc, msg, false, ValidationInnerSchema)

    expect(recorder.seen.length).toBeGreaterThan(0)
    expect(recorder.seen.some((v) => v === msg)).toBe(true)
  })

  it('re-reads a message whose type names a field differently', async () => {
    // The counterpart: when the names disagree the rule has to be handed a copy read through
    // the registered schema, not the caller's message.
    const schemaDesc = rebuiltWidget((proto) => {
      const message = messageOf(proto, 'ValidationInner')
      const field = message.field.find((f: any) => f.number === 1)!
      field.name = 'renamed_x'
      field.jsonName = 'renamedX'
      message.options = message.options ?? create(MessageOptionsSchema)
      setExtension(message.options, message_meta, create(MetaSchema, {
        rules: [{ name: 'm', doc: '', expr: 'true', sql: '' }],
      }))
    }, 'test.ValidationInner')
    const msg = create(ValidationInnerSchema, { x: 5 })

    const recorder = new Recorder()
    await validateProtobufMessage(recorder, schemaDesc, msg, false, ValidationInnerSchema)

    expect(recorder.seen.length).toBeGreaterThan(0)
    expect(recorder.seen.some((v) => v === msg)).toBe(false)
  })

  it('shows a message rule a field only the registered schema declares', async () => {
    // Adding a field is the most ordinary compatible change there is, so the registered schema
    // can declare one the generated type has never heard of - and a message-level rule can
    // reference it, expecting the schema's default. That only works if the message is read
    // through the schema, so a field with no counterpart is itself a reason to re-read.
    //
    // The added field is repeated deliberately. CEL resolves field access through the
    // registry built from the registered schema, so a missing *scalar* property already reads
    // as that field's default and would pass either way; a missing repeated one does not.
    const schemaDesc = rebuiltWidget((proto) => {
      const message = messageOf(proto, 'ValidationInner')
      message.field.push(create(FieldDescriptorProtoSchema, {
        name: 'added',
        jsonName: 'added',
        number: 99,
        type: 9, // TYPE_STRING
        label: 3, // LABEL_REPEATED
      }))
      message.options = message.options ?? create(MessageOptionsSchema)
      setExtension(message.options, message_meta, create(MetaSchema, {
        rules: [{ name: 'm', doc: '', expr: 'size(this.added) == 0', sql: '' }],
      }))
    }, 'test.ValidationInner')
    const msg = create(ValidationInnerSchema, { x: 5 })

    const errors = await validateProtobufMessage(new CelValidator(), schemaDesc, msg, false,
      ValidationInnerSchema)

    expect(errors).toEqual([])
  })

  it('hands a scalar rule the schema\'s representation of the value', async () => {
    // bytes and string are interchangeable at the same number - a compatible change - so a
    // producer can write bytes against a schema that declares a string. The rule is authored
    // against the schema, so it has to be handed the string: naming is not the only thing the
    // schema's view fixes.
    const asString = rebuiltWidget((proto) => {
      const field = messageOf(proto, 'ValidationInner').field.find((f: any) => f.number === 1)!
      field.name = 'payload'
      field.jsonName = 'payload'
      field.type = 9 // TYPE_STRING
      setExtension(field.options!, field_meta, create(MetaSchema, {
        rules: [{ name: 'r', doc: '', expr: 'this == \'hello\'', sql: '' }],
      }))
    }, 'test.ValidationInner')
    const asBytes = rebuiltWidget((proto) => {
      const field = messageOf(proto, 'ValidationInner').field.find((f: any) => f.number === 1)!
      field.name = 'payload'
      field.jsonName = 'payload'
      field.type = 12 // TYPE_BYTES
    }, 'test.ValidationInner')
    const msg = create(asBytes, { payload: new TextEncoder().encode('hello') } as any)

    const errors = await validateProtobufMessage(new CelValidator(), asString, msg, false,
      asBytes)

    expect(errors).toEqual([])
  })

  it('reports a message it cannot read through the schema as a serialization error', async () => {
    // bytes and string are interchangeable at the same number, so a producer writing non-UTF-8
    // bytes can meet a registered schema that declares a string. Those bytes cannot be read
    // through it - a consumer using that schema could not read them either - so the failure has
    // to arrive as a SerializationError rather than a raw protobuf error.
    const asString = rebuiltWidget((proto) => {
      const field = messageOf(proto, 'ValidationInner').field.find((f: any) => f.number === 1)!
      field.name = 'payload'
      field.jsonName = 'payload'
      field.type = 9 // TYPE_STRING
    }, 'test.ValidationInner')
    const asBytes = rebuiltWidget((proto) => {
      const field = messageOf(proto, 'ValidationInner').field.find((f: any) => f.number === 1)!
      field.name = 'payload'
      field.jsonName = 'payload'
      field.type = 12 // TYPE_BYTES
    }, 'test.ValidationInner')
    const msg = create(asBytes, { payload: new Uint8Array([0xff, 0xfe]) } as any)

    await expect(validateProtobufMessage(new AlwaysFail(), asString, msg, false, asBytes))
      .rejects.toThrow(/could not read message test.ValidationInner/)
  })

  it('pairs nested, repeated and map values to their own schema view', async () => {
    // A rule that binds `this` to a nested message needs that message in the schema's terms,
    // not just the top-level one - on the singular, repeated and map paths alike. The repeated
    // elements also have to be paired positionally, and map values by key.
    const schemaDesc = rebuiltWidget((proto) => {
      for (const [messageName, fieldName] of [['ValidationInner', 'renamed_x'],
        ['ValidationItem', 'renamed_v']]) {
        const message = messageOf(proto, messageName)
        const field = message.field.find((f: any) => f.number === 1)!
        field.name = fieldName
        field.jsonName = fieldName
        message.options = message.options ?? create(MessageOptionsSchema)
        setExtension(message.options, message_meta, create(MetaSchema, {
          rules: [{ name: `${messageName}Rule`, doc: '', expr: `this.${fieldName} > 0`, sql: '' }],
        }))
      }
    }, 'test.ValidationOuter')
    const msg = create(ValidationOuterSchema, {
      inner: create(ValidationInnerSchema, { x: 5 }),
      items: [create(ValidationItemSchema, { v: 1 }), create(ValidationItemSchema, { v: -5 })],
      labels: { a: create(ValidationItemSchema, { v: 2 }) },
    })

    const errors = await validateProtobufMessage(new CelValidator(), schemaDesc, msg, false,
      ValidationOuterSchema)

    expect(errors.map((e: ValidationRuleError) => `${e.rule.name}@${e.fieldPath}`))
      // tagsNotEmpty is the widget's own rule on the empty repeated field, unrelated to the
      // pairing under test.
      .toEqual(['ValidationItemRule@items[1]', 'tagsNotEmpty@tags'])
  })
})
