/**
 * Inline `confluent:rules` over Avro's value types: decimal, timestamp and variant, at both
 * message and field level.
 *
 * The last capability gap against the JVM reference. `CelValidator.celValue`
 * decided what to bind by testing `'fieldKind' in schema` - a protobuf-es `DescField` property -
 * and the Avro walk passes no descriptor, so every value fell through to `return msg` raw: a
 * decimal as bare bytes, a timestamp as a bare long. Five of the six cells failed with errors like
 * `decimal: raw bytes need a scale`. Only field-level variant worked, because a `Variant` is
 * recognised by an explicit `instanceof` check.
 *
 * The domain-rule path had been converting these correctly the whole time. The fix routes the
 * inline path through the *same* helpers, so an inline rule and a `CEL_FIELD` rule on one field
 * now see the same value.
 *
 * Twelve cases: six positives, and the must-fail twin of each. The twins are what make the
 * positives worth anything - a rule that is never evaluated also reports no violation, and that
 * is exactly what a positive-only run cannot distinguish.
 */
import { describe, expect, it } from '@jest/globals'
import { AvroSerializer } from '../../serde/avro'
import { SerdeType, ValidationRulesExecution } from '../../serde/serde'
import { SchemaRegistryClient, type SchemaInfo } from '../../schemaregistry-client'
import { parseJson } from '../../confluent/types/variant-utils'

const DECIMAL = { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 }
const TIMESTAMP = { type: 'long', logicalType: 'timestamp-millis' }
const VARIANT = {
  type: 'record', name: 'confluent.type.Variant', logicalType: 'variant',
  fields: [{ name: 'metadata', type: 'bytes' }, { name: 'value', type: 'bytes' }],
}

/**
 * The fixture record is 12.34 / 1700000000.123 / {"name":"alice"}. `pos` picks rules that must
 * all hold; its inverse picks rules that must all fail.
 */
function schemaFor(pos: boolean): string {
  const dec = pos ? 'decimal("10.00")' : 'decimal("1000.00")'
  const ts = pos ? '"2000-01-01T00:00:00Z"' : '"2050-01-01T00:00:00Z"'
  const varType = pos ? '"object"' : '"array"'
  const suffix = pos ? '' : 'N'
  return JSON.stringify({
    type: 'record',
    name: 'ValueTypes',
    fields: [
      {
        name: 'amount', type: DECIMAL,
        'confluent:rules': [{ name: `fldDec${suffix}`, expr: `decimals.gt(this, ${dec})` }],
      },
      {
        name: 'ts', type: TIMESTAMP,
        'confluent:rules': [{ name: `fldTs${suffix}`, expr: `this > timestamp(${ts})` }],
      },
      {
        name: 'data', type: VARIANT,
        'confluent:rules': [{ name: `fldVar${suffix}`, expr: `variants.type(this) == ${varType}` }],
      },
      // The control: a plain field with no rule, so a schema-wide failure is distinguishable
      // from a value-type one.
      { name: 'plain', type: 'string' },
    ],
    'confluent:rules': [
      { name: `msgDec${suffix}`, expr: `decimals.gt(this.amount, ${dec})` },
      { name: `msgTs${suffix}`, expr: `this.ts > timestamp(${ts})` },
      { name: `msgVar${suffix}`, expr: `variants.type(this.data) == ${varType}` },
    ],
  })
}

// 0x04D2 = 1234 unscaled, i.e. 12.34 at scale 2.
const record = () => ({
  amount: Buffer.from([0x04, 0xd2]),
  ts: 1700000000123,
  data: parseJson('{"name":"alice"}'),
  plain: 'hi',
})

/** Serializes the fixture under one schema's inline rules; returns the violation message, or ''. */
async function violations(subject: string, schema: string): Promise<string> {
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, {
    useLatestVersion: true,
    validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES,
  } as any)
  await client.register(`${subject}-value`,
    { schemaType: 'AVRO', schema } as any as SchemaInfo, false)
  try {
    await ser.serialize(subject, record())
    return ''
  } catch (e: any) {
    return String(e?.message ?? e)
  }
}

describe('inline rules over Avro value types', () => {
  it('binds every value type so all six positive rules hold', async () => {
    const result = await violations('inline-pos', schemaFor(true))

    // Before the fix this reported five violations, one per cell that could not read its value:
    // `decimal: raw bytes need a scale`, `no matching overload for '_>_'`, and so on.
    expect(result).toBe('')
  })

  it('fires all six must-fail twins', async () => {
    const result = await violations('inline-neg', schemaFor(false))

    expect(result).toContain('6 violations')
    // Named individually, so a count that happens to be six for the wrong reason still fails.
    for (const rule of ['fldDecN', 'fldTsN', 'fldVarN', 'msgDecN', 'msgTsN', 'msgVarN']) {
      expect(result).toContain(rule)
    }
  })
})
