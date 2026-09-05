import { expect, it } from '@jest/globals';
import { CelExecutor, wrapAvroFieldForCel, unwrapAvroFieldFromCel } from '../../../rules/cel/cel-executor';
import { RuleContext } from '../../../serde/serde';
import { RuleMode } from '../../../schemaregistry-client';

const schemaStr = JSON.stringify({
  type: 'record', name: 'A1', namespace: 'a1',
  fields: [
    { name: 'i', type: 'int' }, { name: 'l', type: 'long' },
    { name: 'f', type: 'float' }, { name: 'd', type: 'double' },
    { name: 'dt', type: { type: 'int', logicalType: 'date' } },
    { name: 'nest', type: { type: 'record', name: 'N', fields: [{ name: 'x', type: 'int' }] } },
    { name: 'arr', type: { type: 'array', items: 'int' } },
    { name: 'mp', type: { type: 'map', values: 'int' } },
  ],
})

function ctxFor(expr: string): RuleContext {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION', expr } as any
  const target = { schema: schemaStr, schemaType: 'AVRO' } as any
  return new RuleContext(undefined, null, target, 'subject', 'topic', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, undefined)
}

// An Avro int/long field must reach a rule as a CEL *int*, not a double. avsc hands out a plain
// JS number for both and cel-es reads a number as a double, so `message.count + 1` used to fail
// with "no matching overload for '_+_' applied to '(double, int)'" while `message.count == 1`
// still passed (cel-es compares across the numeric types) - which is what kept it hidden.
//
// The conversion has to cover a primitive in BOTH its short form (the bare string "int") and its
// long form ({"type":"int"}), and reach nested records, array items and map values. The short form
// was the one originally missed: avroToCel returns early for a non-object node.
it('binds an Avro int/long field as a CEL int, not a double', async () => {
  const rec = { i: 5, l: 7, f: 1.5, d: 2.5, dt: 19675, nest: { x: 3 }, arr: [1, 2, 3], mp: { k: 9 } }
  const exec = new CelExecutor()
  const run = (expr: string) => exec.transform(ctxFor(expr), rec)
  for (const expr of [
    'type(message.i) == int',
    'type(message.l) == int',
    'message.i + 1 == 6',
    'message.l * 2 == 14',
    'message.i == 5',
    'message.i == 5u',
    'type(message.nest.x) == int',
    'message.nest.x + 1 == 4',
    'type(message.arr[0]) == int',
    'message.arr[0] + 1 == 2',
    'type(message.mp["k"]) == int',
    'message.mp["k"] + 1 == 10',
    'type(message.dt) == int',
    'type(message.f) == double',
    'type(message.d) == double',
    'message.f == 1.5',
  ]) {
    expect(await run(expr)).toBe(true)
  }
})

// The write-back half: a CEL_FIELD rule's result goes back to avsc, which rejects a bigint
// outright ("Cannot mix BigInt and other types"). So the int a rule now receives as a CEL int has
// to be handed back as a number. unwrapAvroFieldFromCel had the same short-form blind spot as the
// read side, and the existing serde suite did not cover an int field transform, so nothing caught
// it.
it('round-trips an Avro int/long field through CEL and back to a number', () => {
  for (const [field, raw] of [['i', 5], ['l', 7]] as [string, number][]) {
    const toCel = wrapAvroFieldForCel(raw, `a1.A1.${field}`, schemaStr)
    expect(typeof toCel).toBe('bigint')
    const back = unwrapAvroFieldFromCel(toCel, `a1.A1.${field}`, schemaStr)
    expect(typeof back).toBe('number')
    expect(back).toBe(raw)
  }
  // A double field is untouched in both directions.
  expect(typeof wrapAvroFieldForCel(1.5, 'a1.A1.d', schemaStr)).toBe('number')
})
