/**
 * A `CEL_FIELD` rule over the *null* branch of an Avro `["null", T]` union must be evaluated,
 * not skipped.
 *
 * Avro's null is a first-class value, and the reference binds it as CEL null so a rule can guard
 * with `value == null`. Skipping the field instead removes that capability and is *silent*: a
 * rule that never ran and a rule that ran and passed produce the same result, so nothing in a
 * positive-only test can tell them apart.
 *
 * Two guards used to prevent it - one in `CelFieldExecutor` (`if (fieldValue == null)`), and the
 * blanket `if (msg == null)` at the top of the Avro walk. The reference has neither: it guards a
 * null only where there is nothing to walk (record, array, map) and leaves the decision to each
 * format's walk. The protobuf walk still skips an unset field, which is correct there - a field
 * with presence that is unset has no value, and writing one back would materialise it.
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
  name: 'Nullable',
  fields: [
    {
      name: 'amount',
      type: ['null', { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 }],
      'confluent:tags': ['AMOUNT'],
    },
    { name: 'plain', type: 'string' },
  ],
})

let n = 0

async function serialize(expr: string, amount: any): Promise<void> {
  const subject = `nullfield${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const rule = {
    name: 'r', kind: 'CONDITION', mode: RuleMode.WRITE, type: 'CEL_FIELD',
    tags: ['AMOUNT'], expr,
  } as any as Rule
  const info = {
    schemaType: 'AVRO', schema: SCHEMA, ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  await ser.serialize(subject, { amount, plain: 'hi' })
}

describe('CEL_FIELD over a null Avro union branch', () => {
  it('binds the null so a `== null` guard can test for it', async () => {
    await expect(serialize('value == null', null)).resolves.toBeUndefined()
  })

  // The discriminator. Without it the test above is satisfied by a rule that never ran, since
  // a skipped field reports no violation either.
  it('really evaluates the rule: `value != null` must fail on a null', async () => {
    await expect(serialize('value != null', null)).rejects.toThrow(/Expr failed/)
  })

  it('fails loudly when the expression cannot handle a null', async () => {
    await expect(serialize('decimals.gt(decimal(value), decimal("10.00"))', null))
      .rejects.toThrow(/cannot convert null/)
  })

  it('lets a guarded expression pass, which is why binding beats skipping', async () => {
    await expect(serialize(
      'value == null || decimals.gt(decimal(value), decimal("10.00"))', null))
      .resolves.toBeUndefined()
  })

  // The must-pass/must-fail pair on a present value: removing the skip must not disturb the
  // ordinary case.
  it('still evaluates a present value normally', async () => {
    const present = Buffer.from([0x04, 0xd2])
    await expect(serialize('decimals.gt(decimal(value), decimal("10.00"))', present))
      .resolves.toBeUndefined()
    await expect(serialize('decimals.gt(decimal(value), decimal("100.00"))', present))
      .rejects.toThrow(/Expr failed/)
  })
})

/**
 * The same walk with avsc's *wrapped* union representation, where a union value is keyed by
 * branch name. Re-wrapping a rule's result under the branch it arrived on gave `{null: 'x'}`,
 * which avsc rejects; and `resolveUnion` reached `Object.keys(null)` on the null branch, which
 * throws. The reference resolves the branch from the value, so this does too.
 */
const WRAPPED_SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Wrapped',
  fields: [
    { name: 'note', type: ['null', 'string'], 'confluent:tags': ['NOTE'] },
    { name: 'plain', type: 'string' },
  ],
})

async function roundTrip(expr: string, note: any): Promise<any> {
  const subject = `wrappedunion${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const rule = {
    name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL_FIELD',
    tags: ['NOTE'], expr,
  } as any as Rule
  const info = {
    schemaType: 'AVRO', schema: WRAPPED_SCHEMA, ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  const ser = new AvroSerializer(client, SerdeType.VALUE,
    { useLatestVersion: true, wrapUnions: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, { wrapUnions: true })
  return await deser.deserialize(subject, await ser.serialize(subject, { note, plain: 'hi' }))
}

describe('CEL_FIELD write-back into a wrapped Avro union', () => {
  it('moves a filled null branch onto the value branch', async () => {
    await expect(roundTrip("'recovered'", null)).resolves
      .toMatchObject({ note: { string: 'recovered' } })
  })

  it('keeps a present value on its own branch', async () => {
    await expect(roundTrip("value + '!'", { string: 'a' })).resolves
      .toMatchObject({ note: { string: 'a!' } })
  })

  it('moves a nulled value branch back to the null branch', async () => {
    await expect(roundTrip('null', { string: 'a' })).resolves.toMatchObject({ note: null })
  })
})
