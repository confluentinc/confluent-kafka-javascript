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
import { Variant, VariantBuilder, parseJson } from '../../../confluent/type/variant-utils'

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

  // `variants.as(v, "decimal")` is the fourth path in this client that produces a
  // confluent.type.Decimal, and the one that was left at `precision: 0`. Java's
  // ProtobufResultWriter does `m.put("precision", dec.precision())` on the same path, and
  // precision() is never less than 1 - zero's is 1 - so 0 is a value the reference cannot
  // produce, and a JVM consumer rewrites it on its next touch.
  //
  // The variant has to be built rather than parsed from JSON: JSON has no decimal type, so
  // `variants.parseJson("12.34")` is a DOUBLE and `variants.as(..., "decimal")` rejects it.
  const decimalVariant = (unscaled: bigint, scale: number): Variant => {
    const b = new VariantBuilder()
    b.appendDecimal(unscaled, scale)
    return b.build()
  }

  // Asserted at the CEL level rather than on the returned value, because `precision` is a
  // uint32 and so comes back as a CelUint wrapper - which is the very thing the protobuf
  // writer has to unwrap (see cel-proto-key-and-uint.spec.ts).
  const asDecimalHolds = async (unscaled: bigint, scale: number, expr: string): Promise<any> => {
    const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION', expr } as any
    const target = { schema: SCHEMA, schemaType: 'AVRO' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)
    return await new CelExecutor().transform(
      ctx, { ...record(), data: decimalVariant(unscaled, scale) })
  }

  const PREC = 'variants.as(message.data, "decimal").precision'

  it('variants.as decimal carries the unscaled digit count as its precision', async () => {
    // 1234 at scale 2 is 12.34: four digits, as BigDecimal("12.34").precision() reports.
    expect(await asDecimalHolds(BigInt(1234), 2, `${PREC} == 4u`)).toBe(true)
    expect(await asDecimalHolds(BigInt(1234), 2,
      'variants.as(message.data, "decimal").scale == 2')).toBe(true)
    // Trailing zeros count, because the scale is preserved: 1500 at scale 3 is four digits.
    expect(await asDecimalHolds(BigInt(1500), 3, `${PREC} == 4u`)).toBe(true)
    // Zero is precision 1, never 0 - which is the value the reference cannot produce.
    expect(await asDecimalHolds(BigInt(0), 2, `${PREC} == 1u`)).toBe(true)
    expect(await asDecimalHolds(BigInt(0), 0, `${PREC} == 1u`)).toBe(true)
    // The sign is not a digit.
    expect(await asDecimalHolds(BigInt(-9995), 1, `${PREC} == 4u`)).toBe(true)
    // Negative controls: 0 is what this path used to write for everything.
    expect(await asDecimalHolds(BigInt(1234), 2, `${PREC} == 0u`)).toBe(false)
    expect(await asDecimalHolds(BigInt(1234), 2, `${PREC} == 2u`)).toBe(false)
  })

  it('variants.as decimal agrees with the decimal constructor', async () => {
    // The property that makes the wire form independent of which path produced it.
    const expr = 'variants.as(message.data, "decimal") == decimal("12.34")'
    const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION', expr } as any
    const target = { schema: SCHEMA, schemaType: 'AVRO' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)

    expect(await new CelExecutor().transform(
      ctx, { ...record(), data: decimalVariant(BigInt(1234), 2) })).toBe(true)
  })
})
