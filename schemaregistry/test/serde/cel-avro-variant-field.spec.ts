/**
 * A `CEL_FIELD` rule must not reach an Avro *variant* field.
 *
 * A variant is a record of two bytes fields, and `CEL_FIELD` visits primitive leaves only - which
 * is why every other client, Java included, skips one. (#4538 made decimal and timestamp CEL
 * leaves precisely because they are *not* records in Avro; variant deliberately stays a record.)
 *
 * JS reached it by accident. `avsc` wraps the variant record in a `LogicalType`, so its `typeName`
 * is `logical:variant` rather than `record`; it missed the `record` case in both `getType` and
 * `transform` and fell through to the leaf branch, where a tag-matching rule was applied to the
 * whole variant. A condition hid it - the rule evaluated and passed, which is indistinguishable
 * from a skip - and a transform failed on the way back out, because the rule's result could not be
 * encoded (`Invalid message at data.metadata, expected "bytes", got undefined`).
 *
 * These run through the real serializer, because the walk and the write-back are both part of what
 * is being measured.
 */
import { describe, expect, it } from '@jest/globals'
import { AvroDeserializer, AvroSerializer } from '../../serde/avro'
import { SerdeType } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { SchemaRegistryClient, type Rule, type SchemaInfo } from '../../schemaregistry-client'
import { Variant, parseJson } from '../../confluent/type/variant-utils'
import { CelExecutor } from '../../rules/cel/cel-executor'
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor'

CelExecutor.register()
CelFieldExecutor.register()

const SCHEMA = JSON.stringify({
  type: 'record',
  name: 'ValueTypes',
  fields: [
    {
      name: 'amount',
      type: { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 },
      'confluent:tags': ['AMOUNT'],
    },
    {
      name: 'data',
      type: {
        type: 'record', name: 'confluent.type.Variant', logicalType: 'variant',
        fields: [{ name: 'metadata', type: 'bytes' }, { name: 'value', type: 'bytes' }],
      },
      'confluent:tags': ['DATA'],
    },
    { name: 'plain', type: 'string', 'confluent:tags': ['PLAIN'] },
  ],
})

// 0x04D2 = 1234 unscaled, i.e. 12.34 at scale 2.
const record = () => ({
  amount: Buffer.from([0x04, 0xd2]),
  data: parseJson('{"name":"alice"}'),
  plain: 'hi',
})

/** Serializes the fixture under one tagged field rule and hands back the round-tripped record. */
async function roundTrip(kind: 'CONDITION' | 'TRANSFORM', tag: string, expr: string): Promise<any> {
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const rule = { name: 'r', kind, mode: RuleMode.WRITE, type: 'CEL_FIELD', tags: [tag], expr } as any as Rule
  const info = { schemaType: 'AVRO', schema: SCHEMA, ruleSet: { domainRules: [rule] } } as any as SchemaInfo
  const subject = `d6-${kind}-${tag}-${Math.random().toString(36).slice(2)}`
  await client.register(`${subject}-value`, info, false)
  const bytes = await ser.serialize(subject, record())
  return await new AvroDeserializer(client, SerdeType.VALUE, {}).deserialize(subject, bytes)
}

describe('CEL_FIELD over an Avro variant field', () => {
  // The strong test, and the one that separates "skipped" from "ran and happened to pass": a
  // condition that would be *false* if it were evaluated. It must not raise.
  it('does not evaluate a condition on a variant field', async () => {
    const out = await roundTrip('CONDITION', 'DATA', 'variants.type(value) == "array"')

    expect(out.data).toBeInstanceOf(Variant)
    expect(out.data.toJson()).toBe('{"name":"alice"}')
  })

  // The control for the one above. Without it, "no violation" could just as well mean the rule
  // never fired anywhere - which is exactly how an earlier probe in this area drew a wrong
  // conclusion. The same rule shape on a genuine leaf must raise.
  it('still evaluates the same condition on a plain field', async () => {
    await expect(roundTrip('CONDITION', 'PLAIN', 'value == "not-hi"')).rejects.toThrow()
  })

  // Before the fix this threw
  // `Invalid message at data.metadata, expected "bytes", got undefined`, because the rule ran and
  // its cel-es result was handed to avsc unchanged.
  it('leaves a variant field untouched by a transform', async () => {
    const out = await roundTrip('TRANSFORM', 'DATA', 'variants.parseJson("{\\"name\\":\\"bob\\"}")')

    expect(out.data).toBeInstanceOf(Variant)
    expect(out.data.toJson()).toBe('{"name":"alice"}')
  })

  // The other control: skipping records must not have disturbed the leaf path. A decimal is a
  // leaf, and its transform still has to run and be written back at the schema's scale.
  it('still transforms a decimal field', async () => {
    const out = await roundTrip('TRANSFORM', 'AMOUNT', 'decimals.add(decimal(value), decimal("1.00"))')

    // 0x0536 = 1334, i.e. 13.34 at scale 2.
    expect(Buffer.from(out.amount).toString('hex')).toBe('0536')
  })
})
