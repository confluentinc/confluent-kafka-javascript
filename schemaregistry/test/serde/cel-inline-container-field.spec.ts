/**
 * An inline `confluent:rules` field rule on a **container** field.
 *
 * The inline path was taught to convert a field's value through the
 * schema - a decimal at its scale rather than bare bytes - by resolving the field's schema node.
 * But the resolver it shares with the `CEL_FIELD` path unwraps array and map containers down to
 * the *element* type, which is right there and wrong here:
 *
 *   - a `CEL_FIELD` rule is applied by the walk, which descends into a container and hands the
 *     executor one **element**, so the element's schema is the correct one;
 *   - an **inline** field rule is handed the field's whole value, so `this` is the container.
 *
 * Converting the array against the element's schema left every element raw, and
 * `decimals.gt(this[0], decimal('1.00'))` failed with `decimal: raw bytes need a scale`.
 *
 * Each positive has a must-fail twin, because a rule that is never evaluated also reports no
 * violation - which is exactly what a positive-only run cannot tell apart.
 */
import { describe, expect, it } from '@jest/globals'
import { AvroSerializer } from '../../serde/avro'
import { SerdeType, ValidationRulesExecution } from '../../serde/serde'
import { SchemaRegistryClient, type SchemaInfo } from '../../schemaregistry-client'

const DECIMAL = { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 }

/** Unscaled two's-complement big-endian bytes for a scale-2 decimal string. */
function dec(text: string): Buffer {
  const unscaled = BigInt(text.replace('.', ''))
  let hex = unscaled.toString(16)
  if (hex.length % 2) hex = '0' + hex
  let bytes = Buffer.from(hex, 'hex')
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes])
  return bytes
}

/**
 * The fixture is amounts = [1.11, 2.22], amountMap = {a: 3.33}, nested.inner = 4.44. `pos` picks
 * a bound they all clear; its inverse picks one none of them does.
 */
function schemaFor(pos: boolean): string {
  const bound = pos ? 'decimal("1.00")' : 'decimal("100.00")'
  const suffix = pos ? '' : 'N'
  return JSON.stringify({
    type: 'record',
    name: 'C9',
    fields: [
      { name: 'amounts', type: { type: 'array', items: DECIMAL },
        'confluent:rules': [{ name: `fldArr${suffix}`, expr: `decimals.gt(this[0], ${bound})` }] },
      { name: 'amountMap', type: { type: 'map', values: DECIMAL },
        'confluent:rules': [
          { name: `fldMap${suffix}`, expr: `decimals.gt(this["a"], ${bound})` }] },
      { name: 'nested', type: { type: 'record', name: 'Inner', fields: [{ name: 'inner', type: DECIMAL }] },
        'confluent:rules': [
          { name: `fldNested${suffix}`, expr: `decimals.gt(this.inner, ${bound})` }] },
      { name: 'label', type: 'string' },
    ],
  })
}

let n = 0

async function serialize(schema: string): Promise<void> {
  const subject = `inlinecontainer${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, {
    useLatestVersion: true,
    validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES,
  } as any)
  await client.register(`${subject}-value`,
    { schemaType: 'AVRO', schema } as any as SchemaInfo, false)
  await ser.serialize(subject, {
    amounts: [dec('1.11'), dec('2.22')],
    amountMap: { a: dec('3.33') },
    nested: { inner: dec('4.44') },
    label: 'hi',
  })
}

describe('inline rules on an Avro container field', () => {
  it('evaluates an array, a map and a nested record correctly', async () => {
    await expect(serialize(schemaFor(true))).resolves.toBeUndefined()
  })

  // The twin. All three rules must fail, and be *named* - which is what proves each was
  // evaluated rather than skipped.
  it('reports every violation when none of the same three rules holds', async () => {
    await expect(serialize(schemaFor(false))).rejects.toThrow(
      /fldArrN[\s\S]*fldMapN[\s\S]*fldNestedN|fldArrN/)

    let message = ''
    try {
      await serialize(schemaFor(false))
    } catch (e: any) {
      message = String(e.message)
    }
    for (const name of ['fldArrN', 'fldMapN', 'fldNestedN']) {
      expect(message).toContain(name)
    }
    // And the failure must be the rule answering false, not the conversion giving up.
    expect(message).not.toContain('raw bytes need a scale')
  })
})
