/**
 * A value inside a *nested* record must be presented to CEL the way a root-level one is.
 *
 * Both paths converted against the **root** schema node: a `CEL_FIELD` rule's `message` binding,
 * and an inline record-level rule's `this`. Matching a nested record against the root node finds
 * none of its fields, so its decimals stayed unscaled bytes and its timestamps bare epochs, while
 * the identical schema flattened to the root worked. The reference cannot have this bug - its
 * converter reads `record.getSchema()` off the record it was handed.
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

const DEC = { type: 'bytes', logicalType: 'decimal', precision: 12, scale: 4 }
const TS = { type: 'long', logicalType: 'timestamp-millis' }

/** Outer { inner: Inner { amount, ts, label }, top }, with an optional rule on Inner. */
function nestedSchema(innerRecordRule?: { name: string; expr: string }): string {
  const inner: any = {
    type: 'record',
    name: 'Inner',
    fields: [
      { name: 'amount', type: DEC },
      { name: 'ts', type: TS },
      { name: 'label', type: 'string', 'confluent:tags': ['LABEL'] },
    ],
  }
  if (innerRecordRule != null) {
    inner['confluent:rules'] = [innerRecordRule]
  }
  return JSON.stringify({
    type: 'record',
    name: 'Outer',
    fields: [{ name: 'inner', type: inner }, { name: 'top', type: 'string' }],
  })
}

// 0x01E208 = 123400 unscaled, i.e. 12.3400 at scale 4.
const PAYLOAD = {
  inner: { amount: Buffer.from([0x01, 0xe2, 0x08]), ts: 1700000000123, label: 'usd' },
  top: 'x',
}

let n = 0

/** Runs a CEL_FIELD rule over the nested `label` and returns what it wrote there. */
async function nestedFieldRule(expr: string): Promise<string> {
  const subject = `nestedfield${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const rule = {
    name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL_FIELD',
    tags: ['LABEL'], expr,
  } as any as Rule
  const info = {
    schemaType: 'AVRO', schema: nestedSchema(), ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})
  const bytes = await ser.serialize(subject, PAYLOAD)
  return String((await deser.deserialize(subject, bytes)).inner.label)
}

/** Runs an inline record-level rule on the nested record; resolves when it passed. */
async function nestedRecordRule(expr: string): Promise<void> {
  const subject = `nestedrecord${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const info = {
    schemaType: 'AVRO', schema: nestedSchema({ name: 'ir', expr }),
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  const ser = new AvroSerializer(client, SerdeType.VALUE,
    { useLatestVersion: true, validationRulesExecution: 'BEFORE_DOMAIN_RULES' } as any)
  await ser.serialize(subject, PAYLOAD)
}

describe('CEL bindings inside a nested Avro record', () => {
  it('presents a nested sibling decimal at the schema scale to a CEL_FIELD rule', async () => {
    await expect(nestedFieldRule('string(message.amount)')).resolves.toBe('12.3400')
  })

  it('presents a nested sibling timestamp in the schema unit', async () => {
    await expect(nestedFieldRule('string(message.ts)'))
      .resolves.toBe('2023-11-14T22:13:20.123Z')
  })

  it('presents a nested decimal to an inline record rule', async () => {
    await expect(nestedRecordRule(
      "decimals.eq(decimal(this.amount), decimal('12.3400'))")).resolves.toBeUndefined()
  })

  it('presents a nested timestamp to an inline record rule', async () => {
    await expect(nestedRecordRule(
      "string(this.ts) == '2023-11-14T22:13:20.123Z'")).resolves.toBeUndefined()
  })

  // The discriminators. Without them a rule that errored on raw bytes and a rule that evaluated
  // to false both report one violation, so the passing cases above prove nothing on their own.
  it('still fails an inline rule that is genuinely false', async () => {
    await expect(nestedRecordRule(
      "decimals.eq(decimal(this.amount), decimal('99.9999'))"))
      .rejects.toThrow(/1 violation/)
    await expect(nestedRecordRule("string(this.ts) == 'nope'")).rejects.toThrow(/1 violation/)
  })
})
