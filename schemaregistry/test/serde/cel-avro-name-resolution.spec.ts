/**
 * An unqualified Avro type reference resolves against the namespace it is written in.
 *
 * The named-type index kept a single repository-wide alias from each definition's bare name, so
 * with both `a.Money` and `b.Money` collected, a `"Money"` written inside namespace `b` resolved
 * to whichever had been indexed first - the root before its dependencies, and the dependencies in
 * order. The rule then read the wrong decimal scale. Avro resolves an unqualified name against
 * the enclosing namespace first and only then against the null namespace, which is what the
 * reference's `Schema.Names.get` does and what the C++ client's resolver already did.
 */
import { describe, expect, it } from '@jest/globals'
import { AvroDeserializer, AvroSerializer } from '../../serde/avro'
import { SerdeType } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { SchemaRegistryClient, type Rule, type SchemaInfo } from '../../schemaregistry-client'
import { CelExecutor } from '../../rules/cel/cel-executor'

CelExecutor.register()

/** The same physical shape in both namespaces, so only the CEL-side scale can differ. */
const money = (namespace: string, scale: number) => JSON.stringify({
  type: 'record',
  name: 'Money',
  namespace,
  fields: [{ name: 'amount', type: { type: 'bytes', logicalType: 'decimal', precision: 8, scale } }],
})

// `"Money"` with no namespace, inside namespace `b`: by the spec this is `b.Money`.
const ROOT = JSON.stringify({
  type: 'record',
  name: 'Order',
  namespace: 'b',
  fields: [
    { name: 'money', type: 'Money' },
    { name: 'label', type: 'string' },
  ],
})

let n = 0

async function condition(expr: string): Promise<any> {
  const subject = `celns${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})

  // `a.Money` is registered - and so collected - first, which is what used to decide.
  await client.register('a-money-value', { schemaType: 'AVRO', schema: money('a', 4) } as SchemaInfo, false)
  await client.register('b-money-value', { schemaType: 'AVRO', schema: money('b', 2) } as SchemaInfo, false)
  const rule = { name: 'r', kind: 'CONDITION', mode: RuleMode.WRITE, type: 'CEL', expr } as any as Rule
  await client.register(`${subject}-value`, {
    schemaType: 'AVRO',
    schema: ROOT,
    references: [
      { name: 'a.Money', subject: 'a-money-value', version: 1 },
      { name: 'b.Money', subject: 'b-money-value', version: 1 },
    ],
    ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo, false)

  // 0x04d2 = 1234 unscaled: 12.34 at b.Money's scale 2, 0.1234 at a.Money's scale 4.
  const record = { money: { amount: Buffer.from([0x04, 0xd2]) }, label: 'hi' }
  return await deser.deserialize(subject, await ser.serialize(subject, record))
}

describe('unqualified Avro name resolution', () => {
  it("reads the decimal at the scale of the reference's own namespace", async () => {
    const out = await condition('decimal(message.money.amount) == decimal("12.34")')

    expect(out.label).toBe('hi')
  })

  it('is not reading it at the other namespace\'s scale', async () => {
    // The control: at a.Money's scale 4 the same bytes are 0.1234, and the condition below is
    // the one that passed while the bare-name alias decided.
    await expect(condition('decimal(message.money.amount) == decimal("0.1234")'))
      .rejects.toThrow(/rule r failed/)
  })
})
