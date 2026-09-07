/**
 * Message-level `CEL` transforms over Avro.
 *
 * Two defects met here. An Avro `confluent.type.Variant` record fell to `avroToCel`'s generic
 * "record" case and became a plain object, so `variants.type(message.data)` had nothing it
 * recognised - and since `CEL_FIELD` skips records, that made variants unreachable from JS
 * domain rules entirely. And there was no message-level write-back at all: the
 * field-level `unwrapAvroFieldFromCel` had no counterpart, so the cel-es map reached the Avro
 * writer unchanged and every message-level transform failed (including an identity one).
 *
 * The transform has replace semantics: the result map is the new record.
 */
import { describe, expect, it } from '@jest/globals'
import { RuleContext } from '../../../serde/serde'
import { RuleMode } from '../../../schemaregistry-client'
import { CelExecutor } from '../../../rules/cel/cel-executor'
import { Variant, parseJson } from '../../../confluent/types/variant-utils'

const SCHEMA = JSON.stringify({
  type: 'record',
  name: 'ValueTypes',
  fields: [
    { name: 'amount', type: { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 } },
    { name: 'ts', type: { type: 'long', logicalType: 'timestamp-millis' } },
    {
      name: 'data',
      type: {
        type: 'record', name: 'confluent.type.Variant', logicalType: 'variant',
        fields: [{ name: 'metadata', type: 'bytes' }, { name: 'value', type: 'bytes' }],
      },
    },
    { name: 'label', type: 'string' },
  ],
})

// 0x04D2 = 1234 unscaled, i.e. 12.34 at scale 2.
const UNSCALED_1234 = Buffer.from([0x04, 0xd2])

const record = () => ({
  amount: UNSCALED_1234,
  ts: 1700000000123,
  data: parseJson('{"name":"alice"}'),
  label: 'hi',
})

const transform = async (expr: string): Promise<any> => {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
  const target = { schema: SCHEMA, schemaType: 'AVRO' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any)
  return await new CelExecutor().transform(ctx, record())
}

const ALL = '"amount": message.amount, "ts": message.ts, ' +
            '"data": message.data, "label": message.label'

describe('message-level CEL transforms over Avro', () => {
  // An identity transform is the cheapest regression test for a write-back path, and here it
  // also covers the read: it fails if a variant field cannot be read at all.
  it('returns a record unchanged for a pass-through', async () => {
    const out = await transform(`{${ALL}}`)

    expect(Buffer.from(out.amount).toString('hex')).toBe('04d2')
    expect(out.ts).toBe(1700000000123)
    expect(out.data).toBeInstanceOf(Variant)
    expect(out.data.toJson()).toBe('{"name":"alice"}')
    expect(out.label).toBe('hi')
  })

  it('writes back a computed decimal at the schema scale', async () => {
    const out = await transform(
      '{"amount": decimals.add(decimal(message.amount), decimal("1.00")), ' +
      '"ts": message.ts, "data": message.data, "label": message.label}')

    // 0x0536 = 1334, i.e. 13.34 at scale 2.
    expect(Buffer.from(out.amount).toString('hex')).toBe('0536')
  })

  it('writes back a computed timestamp in the schema unit', async () => {
    const out = await transform(
      '{"amount": message.amount, "ts": message.ts + duration("60s"), ' +
      '"data": message.data, "label": message.label}')

    expect(out.ts).toBe(1700000060123)
  })

  // Asserted through the decoded JSON rather than the metadata bytes: metadata holds the field
  // names, so the two documents share it and comparing metadata would prove nothing.
  it('writes back a computed variant', async () => {
    const out = await transform(
      '{"amount": message.amount, "ts": message.ts, ' +
      '"data": variants.parseJson("{\\"name\\":\\"bob\\"}"), "label": message.label}')

    expect(out.data).toBeInstanceOf(Variant)
    expect(out.data.toJson()).toBe('{"name":"bob"}')
  })

  // Reading a variant field had to work before any of the above could.
  it('can read a variant field in a condition', async () => {
    const rule = {
      name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION',
      expr: 'variants.type(message.data) == "object"',
    } as any
    const target = { schema: SCHEMA, schemaType: 'AVRO' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)

    expect(await new CelExecutor().transform(ctx, record())).toBe(true)
  })

  // Replace semantics: a rule naming only the field it changes discards the rest.
  it('drops a field the rule does not name', async () => {
    const out = await transform('{"label": "changed"}')

    expect(out.label).toBe('changed')
    expect(out.amount).toBeUndefined()
    expect(out.ts).toBeUndefined()
  })
})
