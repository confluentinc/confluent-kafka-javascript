/**
 * The `message` binding inside a `CEL_FIELD` rule must be presented the same way `value` is.
 *
 * The reference converts *every* binding through `CelUtils.toCelValue`, whose Avro arm walks an
 * `IndexedRecord` field by field against its schema (`normalizeAvroLogical`). Left raw here,
 * `message.amount` reached a rule as unscaled bytes and `message.ts` as a bare epoch, while
 * `value` on the very same field was already a Decimal/Timestamp.
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

const SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Money',
  fields: [
    { name: 'amount', type: { type: 'bytes', logicalType: 'decimal', precision: 12, scale: 4 } },
    { name: 'ts', type: { type: 'long', logicalType: 'timestamp-millis' } },
    { name: 'label', type: 'string', 'confluent:tags': ['LABEL'] },
  ],
})

let n = 0

/** Runs a CEL_FIELD rule over `label` and returns what it wrote there. */
async function labelFrom(expr: string): Promise<string> {
  const subject = `celfieldmsg${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const rule = {
    name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL_FIELD',
    tags: ['LABEL'], expr,
  } as any as Rule
  const info = {
    schemaType: 'AVRO', schema: SCHEMA, ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})
  // 0x01E208 = 123400 unscaled, i.e. 12.3400 at scale 4.
  const bytes = await ser.serialize(subject, {
    amount: Buffer.from([0x01, 0xe2, 0x08]), ts: 1700000000123, label: 'usd',
  })
  return String((await deser.deserialize(subject, bytes)).label)
}

describe('the `message` binding in a CEL_FIELD rule', () => {
  it('presents a decimal field at the schema scale, as the reference does', async () => {
    await expect(labelFrom('string(message.amount)')).resolves.toBe('12.3400')
  })

  it('presents a timestamp field in the schema unit', async () => {
    await expect(labelFrom('string(message.ts)')).resolves.toBe('2023-11-14T22:13:20.123Z')
  })

  it('lets decimals.* read it without a scale literal', async () => {
    await expect(labelFrom(
      "decimals.eq(decimal(message.amount), decimal('12.3400')) ? 'yes' : 'no'"))
      .resolves.toBe('yes')
  })

  it('still binds `value` as the field under the rule', async () => {
    // The must-pass twin: converting the message must not disturb `value`.
    await expect(labelFrom('value + "!"')).resolves.toBe('usd!')
  })
})
