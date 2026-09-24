/**
 * Two result entries naming the same slot.
 *
 * The writer applied both in whatever order the rule wrote them, so the outcome was decided by
 * entry order: for a oneof, `{one_id: .., other_id: ..}` kept the second and the reverse kept
 * the other, because setting a member clears its siblings. `JsonFormat` - the reference's
 * write-back path - refuses both shapes, with *opposite* null handling, measured against
 * protobuf-java:
 *
 *   {"oneofMessage":{..},"oneofString":"s"}   Cannot set field ...oneof_string because another
 *                                            field ...oneof_message belonging to the same oneof
 *                                            has already been set
 *   {"oneofString":"s","oneofMessage":null}  OK            - a null does not occupy the oneof
 *   {"total_amount":{..},"totalAmount":{..}} Field ...total_amount has already been set.
 *   {"total_amount":{..},"totalAmount":null} Field ...total_amount has already been set.
 *   {"total_amount":null,"totalAmount":{..}} OK            - a null did not set it
 *
 * Python, C++ and Rust already carried these two checks; Go, C# and JavaScript did not.
 */
import { describe, expect, it } from '@jest/globals'
import { create, createRegistry } from '@bufbuild/protobuf'
import { RuleContext } from '../../../serde/serde'
import { RuleMode } from '../../../schemaregistry-client'
import { CelExecutor } from '../../../rules/cel/cel-executor'
import { ComplexTypeSchema, type ComplexType } from '../../serde/test/nested_pb'
import { ValueTypeContainersSchema } from '../../serde/test/value_type_rules_pb'

const transform = async (expr: string): Promise<ComplexType> => {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, createRegistry(ComplexTypeSchema))
  return await new CelExecutor().transform(
    ctx, create(ComplexTypeSchema, { someVal: { case: 'oneId', value: 'a' }, isActive: true })) as ComplexType
}

// `amount_map` and `amountMap` are one field: findField accepts the declared name and the JSON
// name, so a result naming both used to apply both and keep the later one.
const containerTransform = async (expr: string): Promise<any> => {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, createRegistry(ValueTypeContainersSchema))
  return await new CelExecutor().transform(ctx, create(ValueTypeContainersSchema, { label: 'hi' }))
}

describe('a result naming one field under both spellings', () => {
  it.each([
    ['two values', '{"amount_map": {}, "amountMap": {}}'],
    // Refused too: the JVM tests hasField *before* its null early-return.
    ['a value then a null', '{"amount_map": {}, "amountMap": null}'],
  ])('refuses %s', async (_label, expr) => {
    await expect(containerTransform(expr)).rejects.toThrow(
      /result names field amount_map twice, as amountMap and amount_map/)
  })

  // The reference's OK case: the first entry was a null, so nothing had been set.
  it('accepts a null then a value', async () => {
    const out = await containerTransform('{"amount_map": null, "amountMap": {}}')

    expect(out.amountMap).toEqual({})
  })
})

describe('a result naming one slot twice', () => {
  // Both orders, because order deciding the winner was the defect.
  it.each([
    '{"one_id": "x", "other_id": 7}',
    '{"other_id": 7, "one_id": "x"}',
  ])('refuses two members of a oneof: %s', async (expr) => {
    await expect(transform(expr)).rejects.toThrow(
      /result sets more than one member of oneof some_val: one_id and other_id/)
  })

  // A null does not occupy the oneof, so this is the reference's OK case and must still apply.
  it('lets a null sit alongside a oneof member', async () => {
    const out = await transform('{"one_id": "x", "other_id": null}')

    expect(out.someVal).toEqual({ case: 'oneId', value: 'x' })
  })

  it('still writes a single oneof member', async () => {
    const out = await transform('{"other_id": 7, "is_active": false}')

    expect(out.someVal).toEqual({ case: 'otherId', value: 7 })
    expect(out.isActive).toBe(false)
  })
})
