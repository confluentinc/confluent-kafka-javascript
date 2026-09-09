/**
 * Two write-back defects that an *identity* transform is enough to expose, plus the read-path
 * counterpart of one of them.
 *
 * 1. A CEL `uint` is a `CelUint` wrapper around a bigint, not a bigint, so it never matched the
 *    `typeof value === 'bigint'` test in the protobuf writer's scalar narrowing and reached
 *    protobuf reflection whole - `FieldError: expected number (uint32), got object`. Every
 *    signed scalar round-tripped, so the fault was unsignedness alone. The reference does not
 *    hit this: Java renders the CEL result map to protobuf JSON and parses it with
 *    `ProtobufSchema.fromJson`, where an unsigned value is just a JSON number.
 *
 * 2. `"__proto__"` as an Avro map key or record field name. `out[key] = v` invokes the
 *    inherited prototype setter instead of creating an own property, so the entry is dropped
 *    (primitive value) or the object's prototype is replaced (object value). Avro map keys are
 *    arbitrary strings and an Avro name matches `[A-Za-z_][A-Za-z0-9_]*`, which `__proto__`
 *    satisfies. Java holds both in a `HashMap`, where the key is just a string.
 */
import { describe, expect, it } from '@jest/globals'
import { create, createRegistry } from '@bufbuild/protobuf'
import { RuleContext } from '../../../serde/serde'
import { RuleMode } from '../../../schemaregistry-client'
import { CelExecutor } from '../../../rules/cel/cel-executor'
import { TestMessageSchema, type TestMessage } from '../../serde/test/test_pb'
import { DecimalSchema } from '../../../confluent/types/decimal_pb'
import { ValueTypesSchema } from '../../serde/test/value_types_pb'

const protoTransform = async (expr: string, msg: TestMessage): Promise<any> => {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, createRegistry(TestMessageSchema))
  return await new CelExecutor().transform(ctx, msg)
}

const MSG = () => create(TestMessageSchema, {
  testString: 'hi',
  testUint32: 7, testUint64: BigInt(9), testFixed32: 11, testFixed64: BigInt(13),
  testInt32: 5, testSint64: BigInt(4), testDouble: 1.5,
})

describe('unsigned protobuf scalars survive a message-level transform', () => {
  it('round-trips every unsigned kind through an identity transform', async () => {
    const out = await protoTransform(
      '{"test_string": message.test_string, "test_uint32": message.test_uint32, ' +
      '"test_uint64": message.test_uint64, "test_fixed32": message.test_fixed32, ' +
      '"test_fixed64": message.test_fixed64}', MSG())

    expect(out.testUint32).toBe(7)
    expect(out.testUint64).toBe(BigInt(9))
    expect(out.testFixed32).toBe(11)
    expect(out.testFixed64).toBe(BigInt(13))
  })

  // The control: the signed kinds always worked, which is what localised the fault.
  it('still round-trips the signed kinds', async () => {
    const out = await protoTransform(
      '{"test_string": message.test_string, "test_int32": message.test_int32, ' +
      '"test_sint64": message.test_sint64, "test_double": message.test_double}', MSG())

    expect(out.testInt32).toBe(5)
    expect(out.testSint64).toBe(BigInt(4))
    expect(out.testDouble).toBe(1.5)
  })

  // A uint is also reachable as a computed value, not only echoed.
  it('accepts a computed unsigned value', async () => {
    const out = await protoTransform(
      '{"test_uint32": message.test_uint32 + 1u, "test_uint64": message.test_uint64 + 1u}',
      MSG())

    expect(out.testUint32).toBe(8)
    expect(out.testUint64).toBe(BigInt(10))
  })
})

/**
 * A `confluent.type.Decimal` field arrives with a producer-controlled int32 scale, and the read
 * path expanded it into a positional string eagerly - `"0".repeat(scale)`. Measured: scale 3e8
 * builds a 300000002-character string (301 MB) before any width guard runs, and past V8's
 * maximum string length it throws `RangeError: Invalid string length` from the string builder
 * rather than from anything naming the decimal. Constructing from exponent notation is O(1), so
 * the value is cheap to hold and is refused by the guard that actually needs the digits.
 */
describe('a producer-supplied decimal scale is not expanded on read', () => {
  const readDecimal = async (scale: number): Promise<any> => {
    const rule = {
      name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION',
      expr: 'string(message.amount) != ""',
    } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any, createRegistry(ValueTypesSchema))
    const msg = create(ValueTypesSchema, {
      amount: create(DecimalSchema, { value: new Uint8Array([0x01]), scale, precision: 1 }),
      label: 'hi',
    })
    return await new CelExecutor().transform(ctx, msg)
  }

  it('refuses an extreme scale through the width guard, not the string builder', async () => {
    // The guard's message. With the eager expansion this was V8's "Invalid string length".
    await expect(readDecimal(2147483647)).rejects.toThrow(/the plain form/)
    await expect(readDecimal(-2147483647)).rejects.toThrow(/the plain form/)
    // Below V8's string limit the eager path did not even fail - it allocated 301 MB.
    await expect(readDecimal(300000000)).rejects.toThrow(/the plain form/)
  })

  it('still reads an ordinary scale exactly', async () => {
    const rule = {
      name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'CONDITION',
      expr: 'string(message.amount) == "12.34"',
    } as any
    const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any, createRegistry(ValueTypesSchema))
    const msg = create(ValueTypesSchema, {
      amount: create(DecimalSchema, { value: new Uint8Array([0x04, 0xd2]), scale: 2, precision: 4 }),
      label: 'hi',
    })

    expect(await new CelExecutor().transform(ctx, msg)).toBe(true)
  })
})

describe('"__proto__" as an Avro key survives the read path', () => {
  const MAP_SCHEMA = JSON.stringify({
    type: 'record', name: 'Doc',
    fields: [{ name: 'm', type: { type: 'map', values: 'string' } }],
  })

  const evalOver = async (expr: string, record: any, schema: string): Promise<any> => {
    const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
    const target = { schema, schemaType: 'AVRO' } as any
    const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
      rule, 0, [rule], null, null as any)
    return await new CelExecutor().transform(ctx, record)
  }

  // The fixture has to be built with JSON.parse, not an object literal: `{__proto__: 'y'}` as
  // a literal *is* the prototype-setting syntax, so it never creates the own property this is
  // about. JSON.parse does create it, which is also how such a key arrives in practice.
  const withProtoKey = (): any => JSON.parse('{"a":"x","__proto__":"y"}')

  it('keeps a "__proto__" map entry, with a primitive value', async () => {
    // A primitive is the case the prototype setter drops outright: it ignores a non-object.
    const out = await evalOver('{"m": message.m}', { m: withProtoKey() }, MAP_SCHEMA)

    expect(Object.keys(out.m).sort()).toEqual(['__proto__', 'a'])
    expect(Object.prototype.hasOwnProperty.call(out.m, '__proto__')).toBe(true)
    expect(out.m['__proto__']).toBe('y')
    expect(out.m['a']).toBe('x')
  })

  it('a rule can read the entry back, and sees the right map size', async () => {
    expect(await evalOver('message.m["__proto__"]',
      { m: withProtoKey() }, MAP_SCHEMA)).toBe('y')
    expect(await evalOver('size(message.m)',
      { m: withProtoKey() }, MAP_SCHEMA)).toBe(BigInt(2))
    expect(await evalOver('"__proto__" in message.m',
      { m: withProtoKey() }, MAP_SCHEMA)).toBe(true)
  })

  // The record arm was not broken - its `{ ...value }` spread copies own properties by
  // definition, so the own "__proto__" already exists and the later write lands on it. Pinned
  // so the arm does not depend on that spread for its correctness.
  it('keeps a "__proto__" record field, which is a legal Avro name', async () => {
    const schema = JSON.stringify({
      type: 'record', name: 'Doc',
      fields: [{ name: '__proto__', type: 'string' }, { name: 'a', type: 'string' }],
    })
    const out = await evalOver('{"__proto__": message["__proto__"], "a": message.a}',
      JSON.parse('{"__proto__":"y","a":"x"}'), schema)

    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true)
    expect(out['__proto__']).toBe('y')
    expect(out['a']).toBe('x')
  })
})
