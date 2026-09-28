/**
 * A tagged decimal or timestamp field declared in a **referenced** schema.
 *
 * `getInlineTags(info, deps)` collects tags from the dependencies as well as the root, so the
 * `CEL_FIELD` walk does reach such a field - but the value it handed the rule was converted
 * against the *root* schema text alone. The lookup missed, so the field arrived as raw bytes (a
 * decimal) or a raw epoch (a timestamp) and `decimal(value)` failed on it with "raw bytes need a
 * scale". A field's declared type is what carries a decimal's scale and a timestamp's unit, and
 * for a referenced type that declaration is in the dependency.
 *
 * The inline validation path already carried this information -
 * `wrapAvroDeclaredFieldForCel(msg, fullName, schema, deps)` - so the fix is the same
 * information for the walk: the resolved dependency texts now travel on the RuleContext.
 */
import { describe, expect, it } from '@jest/globals'
import { AvroDeserializer, AvroSerializer } from '../../serde/avro'
import { SerdeType } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { SchemaRegistryClient, type Rule, type SchemaInfo } from '../../schemaregistry-client'
import { CelExecutor } from '../../rules/cel/cel-executor'
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor'

CelExecutor.register()
CelFieldExecutor.register()

// The referenced schema is where the tagged decimal and timestamp are *declared*.
const NESTED_SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Money',
  namespace: 'ref',
  fields: [
    {
      name: 'amount',
      type: { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 },
      'confluent:tags': ['AMOUNT'],
    },
    {
      name: 'at',
      type: { type: 'long', logicalType: 'timestamp-millis' },
      'confluent:tags': ['AT'],
    },
  ],
})

const ROOT_SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Order',
  namespace: 'ref',
  fields: [
    { name: 'money', type: 'ref.Money' },
    { name: 'label', type: 'string' },
  ],
})

let n = 0

async function roundTrip(tag: string, expr: string, kind: string): Promise<any> {
  const subject = `celref${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})

  await client.register('ref-money-value', { schemaType: 'AVRO', schema: NESTED_SCHEMA } as SchemaInfo, false)
  const rule = { name: 'r', kind, mode: RuleMode.WRITE, type: 'CEL_FIELD', tags: [tag], expr } as any as Rule
  await client.register(`${subject}-value`, {
    schemaType: 'AVRO',
    schema: ROOT_SCHEMA,
    references: [{ name: 'ref.Money', subject: 'ref-money-value', version: 1 }],
    ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo, false)

  const record = {
    money: { amount: Buffer.from([0x04, 0xd2]), at: 1700000000123 }, // 12.34, and an epoch-millis
    label: 'hi',
  }
  return await deser.deserialize(subject, await ser.serialize(subject, record))
}

// A message-level rule (type CEL, no tags) sees the whole record rather than one field, and it
// needs the referenced schema for the same reason the field walk does: the declaration is what
// carries the decimal's scale and the timestamp's unit. Without the dependency texts on the way
// *in*, `message.money.amount` arrived as raw bytes and this condition was false.
async function messageRoundTrip(expr: string): Promise<any> {
  const subject = `celrefmsg${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})

  await client.register('ref-money-value', { schemaType: 'AVRO', schema: NESTED_SCHEMA } as SchemaInfo, false)
  const rule = { name: 'r', kind: 'CONDITION', mode: RuleMode.WRITE, type: 'CEL', expr } as any as Rule
  await client.register(`${subject}-value`, {
    schemaType: 'AVRO',
    schema: ROOT_SCHEMA,
    references: [{ name: 'ref.Money', subject: 'ref-money-value', version: 1 }],
    ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo, false)

  const record = {
    money: { amount: Buffer.from([0x04, 0xd2]), at: 1700000000123 },
    label: 'hi',
  }
  return await deser.deserialize(subject, await ser.serialize(subject, record))
}

describe('a message-level rule over a referenced Avro schema', () => {
  it('sees a referenced decimal as a Decimal', async () => {
    const out = await messageRoundTrip(
      'decimals.eq(message.money.amount, decimal("12.34"))')
    expect(out.label).toBe('hi')
  })

  it('sees a referenced timestamp as a Timestamp', async () => {
    const out = await messageRoundTrip(
      'message.money.at == timestamp("2023-11-14T22:13:20.123Z")')
    expect(out.label).toBe('hi')
  })
})

describe('a tagged field declared in a referenced Avro schema', () => {
  it('reaches a decimal rule as a Decimal, not as raw bytes', async () => {
    // Before the dependency texts travelled on the context this failed with
    // "decimal: raw bytes need a scale; use decimal(bytes, scale)".
    const out = await roundTrip('AMOUNT', 'decimals.gt(decimal(value), decimal("1.00"))', 'CONDITION')

    expect(out.label).toBe('hi')
    expect(Buffer.from(out.money.amount).toString('hex')).toBe('04d2')
  })

  it('reaches a timestamp rule as a Timestamp, not as a raw epoch', async () => {
    const out = await roundTrip('AT', 'value > timestamp("2020-01-01T00:00:00Z")', 'CONDITION')

    expect(out.money.at).toBe(1700000000123)
  })

  // And a transform, so the write-back resolves the referenced declaration too.
  it('writes a computed decimal back at the referenced schema scale', async () => {
    const out = await roundTrip('AMOUNT', 'decimals.add(decimal(value), decimal("1.00"))', 'TRANSFORM')

    // 12.34 + 1.00 = 13.34, unscaled 1334 at the declared scale 2.
    expect(Buffer.from(out.money.amount).toString('hex')).toBe('0536')
  })
})
