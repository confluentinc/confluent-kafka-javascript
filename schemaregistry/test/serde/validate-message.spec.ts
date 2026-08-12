import { describe, expect, it } from '@jest/globals';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Type } from 'avsc';
import {
  getInlineValidationRules,
  InlineValidationRules,
  validateAvroMessage,
} from '../../serde/avro';
import { DereferencedJSONSchema, validateJsonMessage } from '../../serde/json';
import { validateProtobufMessage } from '../../serde/protobuf';
import {
  ValidationRule,
  ValidationRuleError,
  ValidationRuleExecutor,
} from '../../serde/serde';
import {
  ValidationDynamicMessageSchema,
  ValidationEventSchema,
  ValidationInnerSchema,
  ValidationItemSchema,
  ValidationOuterSchema,
  ValidationPersonSchema,
} from './test/validation_widget_pb';
import { CelValidator } from '../../rules/cel/cel-validator';

/**
 * Walker-level tests for the per-format validateMessage functions. These use a stub
 * executor that always fails, so every rule the walker fires becomes a violation; the
 * assertions are on rule names paired with field paths, which is what verifies the
 * walker's dispatch (recursion into nested records, array/map iteration, skip-on-null).
 */
class AlwaysFail implements ValidationRuleExecutor {
  async execute(_rule: ValidationRule, _schema: any, _msg: any): Promise<any> {
    return false
  }
}

const ALWAYS_FAIL = new AlwaysFail()

const RULE = [{ name: 'r', expr: 'true' }]

function fired(errors: ValidationRuleError[]): string[] {
  return errors.map(e => `${e.rule.name}@${e.fieldPath}`)
}

// --------------------------------------------------------------------------------------
// Avro
// --------------------------------------------------------------------------------------

async function avro(schema: any, msg: any, failFast = false): Promise<string[]> {
  const schemaStr = JSON.stringify(schema)
  const rules: InlineValidationRules = getInlineValidationRules(
    { schemaType: 'AVRO', schema: schemaStr }, new Map<string, string>())
  const type = Type.forSchema(JSON.parse(schemaStr))
  return fired(await validateAvroMessage(ALWAYS_FAIL, type, rules, msg, failFast))
}

const AVRO_ARRAY_OF_RECORDS = {
  type: 'record', name: 'Outer',
  fields: [{
    name: 'items',
    type: {
      type: 'array',
      items: { type: 'record', name: 'Item', fields: [{ name: 'x', type: 'int', 'confluent:rules': RULE }] },
    },
  }],
}

describe('avro validateMessage', () => {
  it('recurses into a nested record and produces a dotted path', async () => {
    const schema = {
      type: 'record', name: 'Outer',
      fields: [{
        name: 'inner',
        type: { type: 'record', name: 'Inner', fields: [{ name: 'x', type: 'int', 'confluent:rules': RULE }] },
      }],
    }
    expect(await avro(schema, { inner: { x: 5 } })).toEqual(['r@inner.x'])
  })

  it('fires a rule per array element with an indexed path', async () => {
    expect(await avro(AVRO_ARRAY_OF_RECORDS, { items: [{ x: 1 }, { x: 2 }] }))
      .toEqual(['r@items[0].x', 'r@items[1].x'])
  })

  it('stops after the first violation when failFast is set', async () => {
    expect(await avro(AVRO_ARRAY_OF_RECORDS, { items: [{ x: 1 }, { x: 2 }] }, true))
      .toEqual(['r@items[0].x'])
  })

  it('skips values whose shape the schema does not allow', async () => {
    // An array is an object in JS, so a map or record schema must reject it rather than
    // walking it by numeric keys and reporting violations against a shape that could
    // never have been written.
    const mapSchema = {
      type: 'record', name: 'Outer',
      fields: [{
        name: 'scores',
        type: { type: 'map', values: { type: 'int', 'confluent:rules': RULE } },
      }],
    }
    expect(await avro(mapSchema, { scores: [1, 2] })).toEqual([])

    const recordSchema = {
      type: 'record', name: 'Outer',
      'confluent:rules': RULE,
      fields: [{ name: 'x', type: 'int' }],
    }
    expect(await avro(recordSchema, [1, 2])).toEqual([])
  })

  it('fires a rule per map entry with a keyed path', async () => {
    const schema = {
      type: 'record', name: 'Outer',
      fields: [{
        name: 'scores',
        type: {
          type: 'map',
          values: { type: 'record', name: 'Score', fields: [{ name: 'v', type: 'int', 'confluent:rules': RULE }] },
        },
      }],
    }
    expect(await avro(schema, { scores: { alice: { v: 10 }, bob: { v: 20 } } }))
      .toEqual(['r@scores["alice"].v', 'r@scores["bob"].v'])
  })

  it('fires a record level rule at the root', async () => {
    const schema = {
      type: 'record', name: 'Outer',
      'confluent:rules': [{ name: 'rr', expr: 'true' }],
      fields: [{ name: 'x', type: 'int' }],
    }
    expect(await avro(schema, { x: 1 })).toEqual(['rr@'])
  })

  it('skips a nullable field rule when the value is null or absent', async () => {
    const schema = {
      type: 'record', name: 'Outer',
      fields: [{ name: 'maybeName', type: ['null', 'string'], default: null, 'confluent:rules': RULE }],
    }
    expect(await avro(schema, { maybeName: null })).toEqual([])
    expect(await avro(schema, {})).toEqual([])
    expect(await avro(schema, { maybeName: 'alice' })).toEqual(['r@maybeName'])
  })

  it('fires every rule on the same field', async () => {
    const schema = {
      type: 'record', name: 'Outer',
      fields: [{
        name: 'x', type: 'int',
        'confluent:rules': [{ name: 'r1', expr: 'true' }, { name: 'r2', expr: 'true' }],
      }],
    }
    expect(await avro(schema, { x: 7 })).toEqual(['r1@x', 'r2@x'])
  })

  it('produces no violations when there are no rules', async () => {
    const schema = { type: 'record', name: 'Outer', fields: [{ name: 'x', type: 'int' }] }
    expect(await avro(schema, { x: 1 })).toEqual([])
  })

  it('ignores a malformed rules property', async () => {
    const schema = {
      type: 'record', name: 'Outer',
      fields: [{ name: 'x', type: 'int', 'confluent:rules': 'not-a-list' }],
    }
    expect(await avro(schema, { x: 1 })).toEqual([])
  })
})

// --------------------------------------------------------------------------------------
// JSON Schema
// --------------------------------------------------------------------------------------

async function json(schema: any, msg: any, failFast = false): Promise<string[]> {
  return fired(await validateJsonMessage(ALWAYS_FAIL, schema as DereferencedJSONSchema, msg, failFast))
}

const JSON_ARRAY_OF_OBJECTS = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: { x: { type: 'integer', 'confluent:rules': RULE } } },
    },
  },
}

describe('json validateMessage', () => {
  it('does not mutate the shared schema while walking a multi-type property', async () => {
    // validateSubtypes narrows `type` in place, and the schema handed to the walker comes
    // from the dereferenced-schema cache. Restoring afterwards is not enough: the walk
    // awaits while narrowed, so a concurrent walk on the same object would see a scalar
    // type and skip its own narrowing. Reaching that window needs the multi-type branch to
    // have children with rules, since a property's own rules fire in its parent.
    const schema: any = {
      type: 'object',
      properties: {
        v: {
          type: ['object', 'null'],
          properties: { inner: { type: 'integer', 'confluent:rules': RULE } },
        },
      },
    }
    const observed: unknown[] = []
    class Observer implements ValidationRuleExecutor {
      async execute(_rule: ValidationRule, _schema: any, _msg: any): Promise<any> {
        observed.push(schema.properties.v.type)
        return false
      }
    }

    const errors = await validateJsonMessage(
      new Observer(), schema as DereferencedJSONSchema, { v: { inner: 1 } }, false)

    expect(fired(errors)).toEqual(['r@$.v.inner'])
    // The shared schema must still declare both types while the nested rule is evaluated.
    expect(observed).toEqual([['object', 'null']])
    expect(schema.properties.v.type).toEqual(['object', 'null'])
  })

  it('recurses into a nested object and produces a dotted path', async () => {
    const schema = {
      type: 'object',
      properties: {
        inner: { type: 'object', properties: { x: { type: 'integer', 'confluent:rules': RULE } } },
      },
    }
    expect(await json(schema, { inner: { x: 5 } })).toEqual(['r@$.inner.x'])
  })

  it('fires a rule per array element with an indexed path', async () => {
    expect(await json(JSON_ARRAY_OF_OBJECTS, { items: [{ x: 1 }, { x: 2 }] }))
      .toEqual(['r@$.items[0].x', 'r@$.items[1].x'])
  })

  it('stops after the first violation when failFast is set', async () => {
    expect(await json(JSON_ARRAY_OF_OBJECTS, { items: [{ x: 1 }, { x: 2 }] }, true))
      .toEqual(['r@$.items[0].x'])
  })

  it('fires a rule only on the matching oneOf subschema', async () => {
    const schema = {
      oneOf: [
        {
          type: 'object', properties: { a: { type: 'string' } }, required: ['a'],
          'confluent:rules': [{ name: 'matchA', expr: 'true' }],
        },
        {
          type: 'object', properties: { b: { type: 'integer' } }, required: ['b'],
          'confluent:rules': [{ name: 'matchB', expr: 'true' }],
        },
      ],
    }
    expect(await json(schema, { a: 'hi' })).toEqual(['matchA@$'])
  })

  it('fires an object level rule at the root', async () => {
    const schema = {
      type: 'object',
      'confluent:rules': [{ name: 'rr', expr: 'true' }],
      properties: { x: { type: 'integer' } },
    }
    expect(await json(schema, { x: 1 })).toEqual(['rr@$'])
  })

  it('skips a property rule when the value is null or absent', async () => {
    const schema = {
      type: 'object',
      properties: { maybeName: { type: 'string', 'confluent:rules': RULE } },
    }
    expect(await json(schema, {})).toEqual([])
    expect(await json(schema, { maybeName: null })).toEqual([])
    expect(await json(schema, { maybeName: 'alice' })).toEqual(['r@$.maybeName'])
  })

  it('fires every rule on the same property', async () => {
    const schema = {
      type: 'object',
      properties: {
        x: { type: 'integer', 'confluent:rules': [{ name: 'r1', expr: 'true' }, { name: 'r2', expr: 'true' }] },
      },
    }
    expect(await json(schema, { x: 7 })).toEqual(['r1@$.x', 'r2@$.x'])
  })
})

// --------------------------------------------------------------------------------------
// Protobuf
// --------------------------------------------------------------------------------------

async function protobuf(schema: any, msg: any, failFast = false): Promise<string[]> {
  return fired(await validateProtobufMessage(ALWAYS_FAIL, schema, msg, failFast))
}

// The rule on the repeated `tags` field has no presence, so it is never skipped and fires
// on every ValidationOuter — matching the JVM client, which binds the empty collection to
// `this`. Fields are walked in declaration order, so `tags` always comes last.
const TAGS = ['tagsNotEmpty@tags']

describe('protobuf validateMessage', () => {
  it('recurses into a nested message and produces a dotted path', async () => {
    const msg = create(ValidationOuterSchema, { inner: create(ValidationInnerSchema, { x: 5 }) })
    expect(await protobuf(ValidationOuterSchema, msg)).toEqual(['r@inner.x', ...TAGS])
  })

  it('fires the element message rule per repeated element', async () => {
    const msg = create(ValidationOuterSchema, {
      items: [create(ValidationItemSchema, { v: 1 }), create(ValidationItemSchema, { v: 2 })],
    })
    expect(await protobuf(ValidationOuterSchema, msg))
      .toEqual(['itemRule@items[0]', 'itemRule@items[1]', ...TAGS])
  })

  it('stops after the first violation when failFast is set', async () => {
    const msg = create(ValidationOuterSchema, {
      items: [create(ValidationItemSchema, { v: 1 }), create(ValidationItemSchema, { v: 2 })],
    })
    expect(await protobuf(ValidationOuterSchema, msg, true)).toEqual(['itemRule@items[0]'])
  })

  it('skips an optional field rule when unset', async () => {
    expect(await protobuf(ValidationOuterSchema, create(ValidationOuterSchema, {}))).toEqual(TAGS)
    expect(await protobuf(ValidationOuterSchema, create(ValidationOuterSchema, { maybe: 'hi' })))
      .toEqual(['maybeNotEmpty@maybe', ...TAGS])
  })

  it('descends into map values with a keyed path', async () => {
    const msg = create(ValidationOuterSchema, { labels: { a: create(ValidationItemSchema, { v: 1 }) } })
    expect(await protobuf(ValidationOuterSchema, msg)).toEqual(['itemRule@labels["a"]', ...TAGS])
  })

  it('fires both message level and field level rules', async () => {
    const msg = create(ValidationPersonSchema, { age: 30, name: 'Alice' })
    expect(await protobuf(ValidationPersonSchema, msg))
      .toEqual(['ageNotInsane@', 'agePositive@age', 'nameNotEmpty@name'])
  })
})

// --------------------------------------------------------------------------------------
// `now` end to end through the protobuf walker, mirroring the JVM client's test
// --------------------------------------------------------------------------------------

describe('now binding', () => {
  it('is satisfied by a past timestamp', async () => {
    const past = create(ValidationEventSchema, {
      createdAt: timestampFromDate(new Date(Date.now() - 60_000)),
    })
    expect(await validateProtobufMessage(new CelValidator(), ValidationEventSchema, past, false)).toEqual([])
  })

  it('is violated by a future timestamp', async () => {
    const future = create(ValidationEventSchema, {
      createdAt: timestampFromDate(new Date(Date.now() + 3_600_000)),
    })
    const errors = await validateProtobufMessage(new CelValidator(), ValidationEventSchema, future, false)
    expect(errors).toHaveLength(1)
    expect(errors[0].rule.name).toBe('notFuture')
    expect(errors[0].fieldPath).toBe('created_at')
  })
})

// --------------------------------------------------------------------------------------
// Dynamic failure messages
// --------------------------------------------------------------------------------------

describe('dynamic failure message', () => {
  it('is reported when the rule returns a non-empty string', async () => {
    const msg = create(ValidationDynamicMessageSchema, { age: -5 })
    const errors = await validateProtobufMessage(new CelValidator(), ValidationDynamicMessageSchema, msg, false)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('age must be positive, got -5')
    expect(`${errors[0]}`).toBe('age: ageMsg: age must be positive, got -5')
  })
})
