/**
 * `CEL_FIELD` rules over protobuf decimal and timestamp fields (capabilities C4 and C5).
 *
 * Avro carries these two as logical types on a primitive, so the field is a leaf and a field
 * rule reaches it. Protobuf carries them as messages, so the walk used to descend *past* the
 * field and transform value/scale or seconds/nanos one at a time - meaning a rule tagged for
 * the field never fired at all, and the message came back unchanged with no error.
 *
 * Port of the JVM client's #4538. Variant is deliberately not a leaf - it is a record in Avro
 * too, so skipping it is the behaviour that matches.
 */
import { describe, expect, it } from '@jest/globals'
import { create, createRegistry } from '@bufbuild/protobuf'
import { TimestampSchema } from '@bufbuild/protobuf/wkt'
import { RuleContext } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { transform } from '../../serde/protobuf'
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor'
import { DecimalSchema } from '../../confluent/types/decimal_pb'
import { VariantSchema } from '../../confluent/types/variant_pb'
import { parseJson } from '../../confluent/types/variant-utils'
import { ValueTypesSchema, type ValueTypes } from './test/value_types_pb'

// 0x04D2 = 1234 unscaled, i.e. 12.34 at scale 2.
const UNSCALED_1234 = new Uint8Array([0x04, 0xd2])

const message = (): ValueTypes => {
  const v = parseJson('{"name":"alice"}')
  return create(ValueTypesSchema, {
    amount: create(DecimalSchema, { value: UNSCALED_1234, precision: 8, scale: 2 }),
    ts: create(TimestampSchema, { seconds: BigInt(1700000000), nanos: 123000000 }),
    data: create(VariantSchema, { metadata: v.metadata, value: v.value }),
    label: 'hi',
  })
}

const run = async (expr: string, kind: string, tag: string): Promise<ValueTypes> => {
  const rule = { name: 'r', type: 'CEL_FIELD', mode: RuleMode.WRITE, kind, tags: [tag], expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    // The value types have to be in the registry too: a leaf field now binds as its own
    // message, and CEL resolves that through the registry.
    rule, 0, [rule], null, null as any,
    createRegistry(ValueTypesSchema, DecimalSchema, VariantSchema, TimestampSchema))
  const ft = new CelFieldExecutor().newTransform(ctx)
  const msg = message()
  return await transform(ctx, ValueTypesSchema, msg, ft) as ValueTypes
}

const hex = (b?: Uint8Array) => b === undefined ? '' : Buffer.from(b).toString('hex')

describe('CEL_FIELD over protobuf value types', () => {
  // C4. Before the port this reported nothing because the rule never ran.
  it('fires a decimal condition', async () => {
    await run("decimals.gt(decimal(value), decimal('10.00'))", 'CONDITION', 'AMOUNT')
  })

  // The must-fail twin. Without it the test above would also pass if no rule ran at all -
  // which is exactly how the defect hid.
  it('raises when the decimal condition is false', async () => {
    await expect(run("decimals.gt(decimal(value), decimal('1000.00'))", 'CONDITION', 'AMOUNT'))
      .rejects.toThrow()
  })

  it('fires a timestamp condition', async () => {
    await run("value > timestamp('2000-01-01T00:00:00Z')", 'CONDITION', 'TS')
  })

  it('raises when the timestamp condition is false', async () => {
    await expect(run("value > timestamp('2050-01-01T00:00:00Z')", 'CONDITION', 'TS'))
      .rejects.toThrow()
  })

  // C5.
  it('writes back a computed decimal', async () => {
    const out = await run("decimals.add(decimal(value), decimal('1.00'))", 'TRANSFORM', 'AMOUNT')

    // 0x0536 = 1334, i.e. 13.34 at scale 2.
    expect(hex(out.amount?.value)).toBe('0536')
    expect(out.amount?.scale).toBe(2)
  })

  it('writes back a computed timestamp', async () => {
    const out = await run("value + duration('60s')", 'TRANSFORM', 'TS')

    expect(out.ts?.seconds).toBe(BigInt(1700000060))
    expect(out.ts?.nanos).toBe(123000000)
  })

  // The pass-through: the encode must invert the decode exactly.
  it('round trips an identity transform', async () => {
    const out = await run('value', 'TRANSFORM', 'AMOUNT')

    expect(hex(out.amount?.value)).toBe('04d2')
    expect(out.amount?.scale).toBe(2)
  })

  // Variant is a record in both formats, so a field rule must not reach it. The rule below
  // would raise if it ran, so a clean return means it was skipped.
  it('still skips a variant field', async () => {
    const out = await run("variants.type(value) == 'not-a-type'", 'CONDITION', 'DATA')

    expect(out.data?.metadata.length).toBeGreaterThan(0)
  })

  // An *unset* leaf must be skipped, not transformed. This is the case #4538 opened up and
  // that none of the cases above cover: every one of them uses a present value.
  //
  // Before the leaf treatment an unset confluent.type.Decimal was just a message the walk
  // descended into and found nothing to do. Making it a CEL leaf meant the rule was invoked on
  // `undefined`, returned null, and rebuildValueType raised
  // `Rule 'r' returned null for field 'amount'`. The JVM leaves the field unset, and so does
  // every other client that took the port - the guard was simply missing here.
  //
  // Writing a value back would be worse than the error: it would *materialise* an absent field,
  // turning "no amount" into "amount 1.00".
  it('leaves an unset leaf field alone', async () => {
    const rule = { name: 'r', type: 'CEL_FIELD', mode: RuleMode.WRITE, kind: 'TRANSFORM',
      tags: ['AMOUNT'], expr: "decimals.add(decimal(value), decimal('1.00'))" } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any,
      createRegistry(ValueTypesSchema, DecimalSchema, VariantSchema, TimestampSchema))
    const ft = new CelFieldExecutor().newTransform(ctx)

    // amount and ts left unset; only the scalar is present.
    const msg = create(ValueTypesSchema, { label: 'hi' })
    const out = await transform(ctx, ValueTypesSchema, msg, ft) as ValueTypes

    expect(out.amount).toBeUndefined()
    expect(out.label).toBe('hi')
  })
})
