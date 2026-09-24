/**
 * Message-level `CEL` transforms over protobuf: the rule returns a map and the message is
 * rebuilt from it.
 *
 * Before this the executor returned the cel-es `NativeMap` raw, which the protobuf serializer
 * cannot write, so every message-level transform failed - including an identity one.
 *
 * The transform has **replace** semantics: the map is the new message, so a field the rule
 * does not name is dropped and a `null` clears its field. Both are covered here, because they
 * are the part a rule author is most likely to be surprised by.
 */
import { describe, expect, it } from '@jest/globals'
import { create, createRegistry } from '@bufbuild/protobuf'
import { TimestampSchema } from '@bufbuild/protobuf/wkt'
import { RuleContext } from '../../../serde/serde'
import { RuleMode } from '../../../schemaregistry-client'
import { CelExecutor } from '../../../rules/cel/cel-executor'
import { DecimalSchema } from '../../../confluent/type/decimal_pb'
import { VariantSchema } from '../../../confluent/type/variant_pb'
import { Variant, parseJson } from '../../../confluent/type/variant-utils'
import { ValueTypesSchema, type ValueTypes } from '../../serde/test/value_types_pb'

// 0x04D2 = 1234 unscaled, i.e. 12.34 at scale 2.
const UNSCALED_1234 = new Uint8Array([0x04, 0xd2])

const message = (): ValueTypes => {
  const v = parseJson('{"name":"alice"}')
  return create(ValueTypesSchema, {
    amount: create(DecimalSchema, { value: UNSCALED_1234, precision: 8, scale: 2 }),
    ts: create(TimestampSchema, { seconds: BigInt(1700000000), nanos: 123000000 }),
    data: create(VariantSchema, { metadata: v.metadata, value: v.value }),
    label: 'hi',
    count: 7,
  })
}

const transform = async (expr: string, msg?: ValueTypes): Promise<ValueTypes> => {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, createRegistry(ValueTypesSchema))
  return await new CelExecutor().transform(ctx, msg ?? message()) as ValueTypes
}

const hex = (b?: Uint8Array) => b === undefined ? '' : Buffer.from(b).toString('hex')
const variantJson = (v: any) => new Variant(v.value, v.metadata).toJson()

const ALL = '"amount": message.amount, "ts": message.ts, ' +
            '"data": message.data, "label": message.label, "count": message.count'

describe('message-level CEL transforms over protobuf', () => {
  // An identity transform is the cheapest regression test for a write-back path: it fails for
  // any breakage in the plumbing, without depending on the computation.
  it('returns a message unchanged for a pass-through', async () => {
    const result = await transform(`{${ALL}}`)

    expect(result.$typeName).toBe('test.ValueTypes')
    expect(hex(result.amount?.value)).toBe('04d2')
    expect(result.amount?.scale).toBe(2)
    expect(result.ts?.seconds).toBe(BigInt(1700000000))
    expect(result.ts?.nanos).toBe(123000000)
    expect(variantJson(result.data)).toBe('{"name":"alice"}')
    expect(result.label).toBe('hi')
    expect(result.count).toBe(7)
  })

  it('writes back a computed decimal', async () => {
    const result = await transform(
      '{"amount": decimals.add(decimal(message.amount), decimal("1.00")), ' +
      '"ts": message.ts, "data": message.data, "label": message.label}')

    // 0x0536 = 1334, i.e. 13.34 at scale 2.
    expect(hex(result.amount?.value)).toBe('0536')
    expect(result.amount?.scale).toBe(2)
    expect(hex(result.amount?.value)).not.toBe('04d2')
  })

  it('writes back a computed timestamp, keeping sub-second precision', async () => {
    const result = await transform(
      '{"amount": message.amount, "ts": message.ts + duration("60s"), ' +
      '"data": message.data, "label": message.label}')

    expect(result.ts?.seconds).toBe(BigInt(1700000060))
    expect(result.ts?.nanos).toBe(123000000)
  })

  // Asserted through the decoded JSON rather than the metadata bytes: metadata holds the
  // field names, so the two documents share it and comparing metadata would prove nothing.
  it('writes back a computed variant', async () => {
    const result = await transform(
      '{"amount": message.amount, "ts": message.ts, ' +
      '"data": variants.parseJson("{\\"name\\":\\"bob\\"}"), "label": message.label}')

    expect(variantJson(result.data)).toBe('{"name":"bob"}')
  })

  // Replace semantics, and the consequence most likely to surprise: a rule naming only the
  // field it changes discards everything else. Intended, but silent on protobuf - proto3 has
  // no required fields, so nothing catches it.
  it('drops a field the rule does not name', async () => {
    const result = await transform('{"label": "changed"}')

    expect(result.label).toBe('changed')
    expect(result.amount).toBeUndefined()
    expect(result.ts).toBeUndefined()
    expect(result.data).toBeUndefined()
    expect(result.count).toBe(0)
  })

  // The idiom for preserving absence across a transform that echoes a field is
  // `has(x) ? x : null`; without a null arm there would be no way to express it.
  it('clears a field set to null', async () => {
    const result = await transform(
      '{"amount": null, "ts": message.ts, "data": message.data, "label": message.label}')

    expect(result.amount).toBeUndefined()
    expect(result.ts).toBeDefined()
    expect(result.label).toBe('hi')
  })

  it('preserves absence with the has() guard', async () => {
    const absent = create(ValueTypesSchema, { label: 'hi' })

    const guarded = await transform(
      '{"amount": has(message.amount) ? message.amount : null, "label": message.label}',
      absent)

    expect(guarded.amount).toBeUndefined()
    expect(guarded.label).toBe('hi')
  })

  // A CONDITION answers with a bool, which must never reach the rebuild.
  it('leaves condition results alone', async () => {
    const rule = {
      name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION',
      expr: 'decimals.gt(message.amount, decimal("10.00"))',
    } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any, createRegistry(ValueTypesSchema))

    expect(await new CelExecutor().transform(ctx, message())).toBe(true)
  })
})
