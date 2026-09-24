/**
 * A `CEL_FIELD` rule on an Avro **array** or **map** field.
 *
 * A condition is evaluated once per element and the verdicts are then dropped: the reference
 * collects them into a new, untyped list, and the field-level check that raises tests for
 * `false`, which a list never is. A condition therefore does not apply to a container field -
 * decided as the intended contract.
 *
 * This walk assigned each verdict back into the input container as it went, so by the time the
 * field-level code decided not to keep the result, the elements had already been replaced with
 * booleans and avsc rejected the record - the field failed whatever the rule answered. The
 * transform cases below are the other half of the contract: dropping a verdict must not become
 * skipping the field.
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

const DECIMAL = { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 }

const SCHEMA = JSON.stringify({
  type: 'record',
  name: 'C9',
  fields: [
    { name: 'amounts', type: { type: 'array', items: DECIMAL },
      'confluent:tags': ['AMOUNTS'] },
    { name: 'amountMap', type: { type: 'map', values: DECIMAL },
      'confluent:tags': ['AMOUNTMAP'] },
    { name: 'label', type: 'string' },
  ],
})

/** Unscaled two's-complement big-endian bytes for a scale-2 decimal string. */
function dec(text: string): Buffer {
  const unscaled = BigInt(text.replace('.', ''))
  let hex = unscaled.toString(16)
  if (hex.length % 2) hex = '0' + hex
  let bytes = Buffer.from(hex, 'hex')
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes])
  return bytes
}

const show = (b: any): string => {
  const hundred = BigInt(100)
  const n = BigInt('0x' + Buffer.from(b).toString('hex'))
  return `${n / hundred}.${(n % hundred).toString().padStart(2, '0')}`
}

const record = () => ({
  amounts: [dec('1.11'), dec('2.22')],
  amountMap: { a: dec('3.33') },
  label: 'hi',
})

let n = 0

/** Round-trips the record under one CEL_FIELD rule, so what is asserted went on the wire. */
async function roundTrip(kind: string, tag: string, expr: string): Promise<any> {
  const subject = `celcontainer${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})
  const rule = {
    name: 'r', kind, mode: RuleMode.WRITE, type: 'CEL_FIELD', tags: [tag], expr,
  } as any as Rule
  const info = {
    schemaType: 'AVRO', schema: SCHEMA, ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  return await deser.deserialize(subject, await ser.serialize(subject, record()))
}

describe('CEL_FIELD on an Avro container field', () => {
  it('passes a condition that holds and leaves the array alone', async () => {
    const out = await roundTrip('CONDITION', 'AMOUNTS',
      'decimals.gt(decimal(value), decimal("1.00"))')

    expect(out.amounts.map(show)).toEqual(['1.11', '2.22'])
  })

  // The twin: the verdict is false for both elements and the walk
  // still has to pass, because a condition does not apply to a container field. Before the fix
  // this threw `Invalid message at amounts.0, expected "bytes", got false` - and so did the
  // twin above, with `got true`, so the cell failed whatever the rule answered.
  it('drops a failing condition on an array rather than raising it', async () => {
    const out = await roundTrip('CONDITION', 'AMOUNTS',
      'decimals.gt(decimal(value), decimal("100.00"))')

    expect(out.amounts.map(show)).toEqual(['1.11', '2.22'])
  })

  it('drops a failing condition on a map the same way', async () => {
    const out = await roundTrip('CONDITION', 'AMOUNTMAP',
      'decimals.gt(decimal(value), decimal("100.00"))')

    expect(show(out.amountMap.a)).toBe('3.33')
  })

  // The discriminator for the three above: dropping the verdict must not become skipping the
  // field. A rule that cannot evaluate on a decimal has to surface, which it can only do if
  // every element was handed to it.
  it('still evaluates the rule per element', async () => {
    await expect(roundTrip('CONDITION', 'AMOUNTS', 'variants.type(value) == "object"'))
      .rejects.toThrow()
  })

  it('still writes every element of a transformed array', async () => {
    const out = await roundTrip('TRANSFORM', 'AMOUNTS',
      'decimals.add(decimal(value), decimal("1.00"))')

    expect(out.amounts.map(show)).toEqual(['2.11', '3.22'])
  })

  it('still writes every value of a transformed map', async () => {
    const out = await roundTrip('TRANSFORM', 'AMOUNTMAP',
      'decimals.add(decimal(value), decimal("1.00"))')

    expect(show(out.amountMap.a)).toBe('4.33')
  })
})
