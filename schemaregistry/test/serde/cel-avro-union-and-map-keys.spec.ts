/**
 * Two Avro write-back defects, both reachable from an ordinary rule.
 *
 * A CEL-produced Variant is a `confluent.type.Variant` *message* (that is what
 * `variants.parseJson` and friends return), not an instance of the `Variant` class. Union
 * branch resolution tested only `instanceof`, so a computed Variant fell through to the
 * structural checks and matched any generic `record` branch - while `celVariantToAvro`, the
 * writer for that branch, handled both shapes. A union listing another record before the
 * logical-variant one therefore resolved to the wrong branch.
 *
 * And `"__proto__"` is a legal Avro map key. The serde's own field-transform walk copied map
 * entries into `{}`, where assigning that key invokes the prototype setter instead of creating
 * an own property - so the entry was dropped when its value was a primitive. Java holds the
 * map in a HashMap, where the key is just a string.
 */
import { describe, expect, it } from '@jest/globals'
import { AvroDeserializer, AvroSerializer } from '../../serde/avro'
import { SerdeType } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { SchemaRegistryClient, type Rule, type SchemaInfo } from '../../schemaregistry-client'
import { Variant, parseJson } from '../../confluent/type/variant-utils'
import { CelExecutor } from '../../rules/cel/cel-executor'
import { RuleContext } from '../../serde/serde'
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor'

CelExecutor.register()
CelFieldExecutor.register()

const VARIANT_REC = {
  type: 'record', name: 'confluent.type.Variant', logicalType: 'variant',
  fields: [{ name: 'metadata', type: 'bytes' }, { name: 'value', type: 'bytes' }],
}

// The variant branch is listed second, so resolution has to reach it rather than take the
// first branch positionally.
//
// A union of *two records* (a plain one before the variant) is what Copilot's report describes,
// and it turns out to be unreachable in this client for an unrelated reason: `celToAvro`
// returns the bare value for a union rather than a branch-tagged one, and avsc cannot write a
// two-record union without the tag ("ambiguous conversion"). That fails for an *echoed* Variant
// too, so it is a pre-existing limitation of union write-back rather than anything to do with
// the shape check. `["null", variant]` exercises the same resolution and does round-trip.
// Two non-null branches, so resolution has to actually match rather than fall back:
// pickAvroWriteBranch takes the single non-null branch when nothing matches, which masks the
// bug entirely for a `["null", variant]` union. With more than one it *throws*.
const UNION_SCHEMA = JSON.stringify({
  type: 'record', name: 'UDoc',
  fields: [
    { name: 'u', type: ['string', VARIANT_REC] },
    { name: 'label', type: 'string' },
  ],
})

// A union with *two* non-null branches, one of them a logical decimal. Which branch applies is
// a property of the value, not of the schema.
const DECIMAL_UNION_SCHEMA = JSON.stringify({
  type: 'record', name: 'DDoc',
  fields: [
    {
      name: 'u',
      type: ['string', { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 }],
      'confluent:tags': ['AMOUNT'],
    },
    { name: 'label', type: 'string' },
  ],
})

const MAP_SCHEMA = JSON.stringify({
  type: 'record', name: 'MDoc',
  fields: [
    { name: 'm', type: { type: 'map', values: 'string' }, 'confluent:tags': ['PII'] },
    { name: 'label', type: 'string' },
  ],
})

let n = 0

async function roundTrip(schema: string, rule: Rule, record: any): Promise<any> {
  const subject = `celunionmap${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})
  const info = {
    schemaType: 'AVRO', schema, ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  return await deser.deserialize(subject, await ser.serialize(subject, record))
}

describe('a computed Variant resolves the variant union branch', () => {
  it('writes a CEL-produced Variant into the logical-variant branch', async () => {
    const rule = {
      name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL',
      expr: `{"u": variants.parseJson('{"name":"alice"}'), "label": message.label}`,
    } as any as Rule
    const out = await roundTrip(UNION_SCHEMA, rule,
      { u: parseJson('{"name":"bob"}'), label: 'hi' })

    // Round-tripped through Avro, so the branch that was chosen is the one on the wire.
    expect(out.label).toBe('hi')
    expect(new Variant(out.u.value, out.u.metadata).toJson()).toBe('{"name":"alice"}')
  })

  // The control that always worked: an echoed Variant is an instance of the class.
  it('still writes an echoed Variant into the same branch', async () => {
    const rule = {
      name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL',
      expr: `{"u": message.u, "label": message.label}`,
    } as any as Rule
    const out = await roundTrip(UNION_SCHEMA, rule,
      { u: parseJson('{"name":"bob"}'), label: 'hi' })

    expect(new Variant(out.u.value, out.u.metadata).toJson()).toBe('{"name":"bob"}')
  })
})

// The ordering case, tested at the transform rather than through a round-trip: a union of two
// *records* is the only shape where the structural fallback picks the wrong one, and avsc
// cannot write such a union at all ("ambiguous conversion"), so it never survives serialization.
//
// Why the structural fallback usually hides this: `celMatchesAvro`'s record arm is
// `isCelStruct(value)`, which a ReflectMessage satisfies - so a CEL Variant matches *any*
// record branch. With `["string", variant]` the string branch fails and the variant branch
// matches by luck; with a plain record listed first, that record wins instead.
describe('a computed Variant is matched by type, not by structure', () => {
  const TWO_RECORDS = JSON.stringify({
    type: 'record', name: 'TDoc',
    fields: [
      { name: 'u', type: [{ type: 'record', name: 'Other', fields: [{ name: 'a', type: 'string' }] }, VARIANT_REC] },
      { name: 'label', type: 'string' },
    ],
  })

  it('resolves the variant branch even when a plain record is listed first', async () => {
    const rule = {
      name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL',
      expr: `{"u": variants.parseJson('{"name":"alice"}'), "label": message.label}`,
    } as any as Rule
    const ctx = new RuleContext(undefined, null,
      { schema: TWO_RECORDS, schemaType: 'AVRO' } as any, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)

    const out: any = await new CelExecutor().transform(ctx, { u: { a: 'x' }, label: 'hi' })

    // The variant branch was chosen, so the value is a Variant rather than the `Other` record
    // the structural check would have matched first.
    expect(out.u).toBeInstanceOf(Variant)
    expect(out.u.toJson()).toBe('{"name":"alice"}')
  })
})

describe('"__proto__" as an Avro map key', () => {
  // The serde's own field-transform walk copied map entries into `{}`, where assigning
  // "__proto__" invokes the prototype setter instead of creating an own property - so the
  // entry was dropped. That is fixed (the walk builds a null-prototype object, as the CEL
  // conversion helpers already did), but it cannot be observed end to end, because **avsc
  // itself drops the key on decode**. Measured directly, with no rule involved:
  //
  //   input        -> ["a", "__proto__"]
  //   after avsc   -> ["a"], hasOwnProperty("__proto__") === false
  //
  // So this pins the upstream limitation rather than claiming a round-trip that cannot happen.
  // Java holds an Avro map in a HashMap and keeps the entry, so JS diverges here for a reason
  // outside this client. Removing our own contribution to the loss is still worth doing: it is
  // what stops a *transform* from being where the entry disappears.
  it('is dropped by avsc on decode, independently of any rule', async () => {
    const rule = {
      name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL_FIELD',
      tags: ['PII'], expr: 'value + "!"',
    } as any as Rule
    // JSON.parse, not a literal: `{__proto__: "y"}` as a literal *is* the prototype syntax and
    // never creates the own property this is about.
    const out = await roundTrip(MAP_SCHEMA, rule,
      { m: JSON.parse('{"a":"x","__proto__":"y"}'), label: 'hi' })

    // The ordinary key transforms as always - the walk still works.
    expect(out.m['a']).toBe('x!')
    // And the "__proto__" entry is gone, dropped by avsc's decoder rather than by the walk.
    expect(Object.keys(out.m)).toEqual(['a'])
  })

  // The keys that look dangerous but are not: only "__proto__" hits the prototype setter.
  it('keeps the other reserved-looking keys', async () => {
    const rule = {
      name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL_FIELD',
      tags: ['PII'], expr: 'value + "!"',
    } as any as Rule
    const out = await roundTrip(MAP_SCHEMA, rule,
      { m: { constructor: 'c', hasOwnProperty: 'h', toString: 't' }, label: 'hi' })

    expect(Object.keys(out.m).sort()).toEqual(['constructor', 'hasOwnProperty', 'toString'])
    expect(out.m['constructor']).toBe('c!')
    expect(out.m['hasOwnProperty']).toBe('h!')
    expect(out.m['toString']).toBe('t!')
  })
})

// The reference resolves a union member from the datum - `resolveUnion(schema, value)`, then the
// member at that index - in both its transform and validation walks. Collapsing a multi-branch
// union to its first non-null member instead gave a decimal value the "string" branch, so a
// tagged CEL_FIELD rule saw raw bytes and the write-back left them unencoded. The single
// non-null case (["null", X]) is still resolved from the schema, since there is only one answer.
describe('a union with several non-null branches', () => {
  it('hands a CEL_FIELD rule the decimal branch, not the first branch', async () => {
    const rule = {
      name: 'r', kind: 'CONDITION', mode: RuleMode.WRITE, type: 'CEL_FIELD',
      tags: ['AMOUNT'], expr: 'decimals.eq(value, decimal("12.34"))',
    } as any as Rule
    // 1234 unscaled at scale 2. If the rule saw raw bytes, decimals.eq would fail the condition.
    const out = await roundTrip(DECIMAL_UNION_SCHEMA, rule,
      { u: Buffer.from([0x04, 0xd2]), label: 'hi' })
    expect(out.label).toBe('hi')
  })

  it('still resolves the string branch for a string value', async () => {
    const rule = {
      name: 'r', kind: 'CONDITION', mode: RuleMode.WRITE, type: 'CEL_FIELD',
      tags: ['AMOUNT'], expr: 'value == "hi"',
    } as any as Rule
    const out = await roundTrip(DECIMAL_UNION_SCHEMA, rule, { u: 'hi', label: 'ok' })
    expect(out.label).toBe('ok')
  })

  it('writes a computed decimal back into the decimal branch', async () => {
    const rule = {
      name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL_FIELD',
      tags: ['AMOUNT'], expr: 'decimals.add(value, decimal("1.00"))',
    } as any as Rule
    const out = await roundTrip(DECIMAL_UNION_SCHEMA, rule,
      { u: Buffer.from([0x04, 0xd2]), label: 'hi' })
    // 12.34 + 1.00 = 13.34 -> unscaled 1334 -> 0x05 0x36
    expect(Array.from(out.u as Uint8Array)).toEqual([0x05, 0x36])
  })
})
