/**
 * A message-level `CEL` transform that returns a **container**.
 *
 * Two defects, one per format, both on the write side and both silent about their real cause:
 *
 *   - **Avro**: cel-es returns its own list type (`ArrayList`) rather than a JS Array, so the
 *     write-back's `Array.isArray` guard rejected it and passed it through to avsc untouched.
 *     Its elements were still cel-es values, so the record failed to encode.
 *   - **protobuf**: `ReflectMessage.set` wants a message for a message-valued field, which is
 *     exactly what cel-es hands back for an *echoed* one. A **constructed** nested message comes
 *     back as a CEL map instead, and setting that raised
 *     `expected ReflectMessage (test.ValueTypeNested), got object`.
 *
 * The Avro one was also reported as the wrong error entirely: avsc's `errorHook` stringified the
 * rejected value, which for a protobuf-es message is a circular descriptor graph, so the failure
 * surfaced as `TypeError: Converting circular structure to JSON` from inside the hook. The last
 * test here pins the hook against that.
 */
import { describe, expect, it } from '@jest/globals'
import { create, createRegistry } from '@bufbuild/protobuf'
import { TimestampSchema } from '@bufbuild/protobuf/wkt'
import { AvroDeserializer, AvroSerializer } from '../../serde/avro'
import { RuleContext, SerdeType } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { SchemaRegistryClient, type Rule, type SchemaInfo } from '../../schemaregistry-client'
import { CelExecutor } from '../../rules/cel/cel-executor'
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor'
import { DecimalSchema } from '../../confluent/type/decimal_pb'
import { VariantSchema } from '../../confluent/type/variant_pb'
import { ValueTypeContainersSchema, ValueTypeNestedSchema } from './test/value_type_rules_pb'

CelExecutor.register()
CelFieldExecutor.register()

const DECIMAL = { type: 'bytes', logicalType: 'decimal', precision: 8, scale: 2 }
const SCHEMA = JSON.stringify({
  type: 'record',
  name: 'C9',
  fields: [
    { name: 'amounts', type: { type: 'array', items: DECIMAL } },
    { name: 'amountMap', type: { type: 'map', values: DECIMAL } },
    { name: 'nested', type: { type: 'record', name: 'Inner', fields: [{ name: 'inner', type: DECIMAL }] } },
    { name: 'label', type: 'string' },
  ],
})

/** Unscaled two's-complement big-endian bytes for a scale-2 decimal string. */
function decBytes(text: string): Buffer {
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

const avroRecord = () => ({
  amounts: [decBytes('1.11'), decBytes('2.22')],
  amountMap: { a: decBytes('3.33') },
  nested: { inner: decBytes('4.44') },
  label: 'hi',
})

let n = 0

/** Round-trips the record through the real serializer and deserializer under one CEL rule. */
async function avroRoundTrip(expr: string, msg: any = avroRecord()): Promise<any> {
  const subject = `celcontainerxf${n++}`
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const deser = new AvroDeserializer(client, SerdeType.VALUE, {})
  const rule = {
    name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL', expr,
  } as any as Rule
  await client.register(`${subject}-value`,
    { schemaType: 'AVRO', schema: SCHEMA, ruleSet: { domainRules: [rule] } } as any as SchemaInfo,
    false)
  return await deser.deserialize(subject, await ser.serialize(subject, msg))
}

const IDENTITY = '{"amounts": message.amounts, "amountMap": message.amountMap, ' +
  '"nested": message.nested, "label": message.label}'

describe('a message transform returning an Avro container', () => {
  it('keeps an echoed array, map and nested record', async () => {
    const out = await avroRoundTrip(IDENTITY)

    expect(out.amounts.map(show)).toEqual(['1.11', '2.22'])
    expect(show(out.amountMap.a)).toBe('3.33')
    expect(show(out.nested.inner)).toBe('4.44')
    expect(out.label).toBe('hi')
  })

  // The discriminator for the test above: a *computed* array proves the rule's result was
  // written, so "the containers survived" cannot mean "nothing was written at all".
  it('writes a computed array', async () => {
    const out = await avroRoundTrip(
      '{"amounts": [decimal("9.99")], "amountMap": message.amountMap, ' +
      '"nested": message.nested, "label": message.label}')

    expect(out.amounts.map(show)).toEqual(['9.99'])
  })

  it('writes a computed nested record', async () => {
    const out = await avroRoundTrip(
      '{"amounts": message.amounts, "amountMap": message.amountMap, ' +
      '"nested": {"inner": decimal("8.88")}, "label": message.label}')

    expect(show(out.nested.inner)).toBe('8.88')
  })

  it('writes a computed map', async () => {
    const out = await avroRoundTrip(
      '{"amounts": message.amounts, "amountMap": {"a": decimal("7.77")}, ' +
      '"nested": message.nested, "label": message.label}')

    expect(show(out.amountMap.a)).toBe('7.77')
  })
})

const protoDec = (text: string) => create(DecimalSchema, {
  value: new Uint8Array(decBytes(text)), precision: 8, scale: 2,
})
const protoMsg = () => create(ValueTypeContainersSchema, {
  amounts: [protoDec('1.11'), protoDec('2.22')],
  amountMap: { a: protoDec('3.33') },
  nested: create(ValueTypeNestedSchema, { inner: protoDec('4.44') }),
  label: 'hi',
})

async function protoTransform(expr: string): Promise<any> {
  const rule = { name: 'r', kind: 'TRANSFORM', mode: RuleMode.WRITE, type: 'CEL', expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any,
    createRegistry(ValueTypeContainersSchema, ValueTypeNestedSchema, DecimalSchema, VariantSchema,
      TimestampSchema))
  return await new CelExecutor().transform(ctx, protoMsg())
}

describe('a message transform returning a protobuf container', () => {
  it('writes a constructed nested message', async () => {
    const out = await protoTransform(
      '{"amounts": message.amounts, "amount_map": message.amount_map, ' +
      '"nested": {"inner": decimal("8.88")}, "label": message.label}')

    expect(show(out.nested.inner.value)).toBe('8.88')
    // And the echoed containers are still intact alongside it.
    expect(out.amounts.map((d: any) => show(d.value))).toEqual(['1.11', '2.22'])
    expect(show(out.amountMap.a.value)).toBe('3.33')
  })

  it('keeps an echoed nested message', async () => {
    const out = await protoTransform(
      '{"amounts": message.amounts, "amount_map": message.amount_map, ' +
      '"nested": message.nested, "label": message.label}')

    expect(show(out.nested.inner.value)).toBe('4.44')
  })

  // A mistyped container result used to yield nothing and leave the field *empty*, which under
  // replace semantics is a deletion reported as a success. Each row is refused by the
  // reference's write-back parse - measured against protobuf-java's JsonFormat:
  //   {"amounts": 1}          Expected an array for amounts but found 1
  //   {"amount_map": 1}       Expect a map object but found: 1
  //   {"amounts": [null]}     Repeated field elements cannot be null in field: ...
  //   {"amount_map": {a:null}} Map value cannot be null.
  const refused: [string, string, RegExp][] = [
    ['a scalar for a repeated field', '{"amounts": 1}', /cannot write bigint to repeated field amounts/],
    ['a string for a repeated field', '{"amounts": "abc"}', /cannot write string to repeated field amounts/],
    ['a map for a repeated field', '{"amounts": message.amount_map}', /cannot write a map to repeated field amounts/],
    ['a scalar for a map field', '{"amount_map": 1}', /cannot write bigint to map field amount_map/],
    ['a string for a map field', '{"amount_map": "abc"}', /cannot write string to map field amount_map/],
    ['a list for a map field', '{"amount_map": message.amounts}', /cannot write a list to map field amount_map/],
    ['a null list element', '{"amounts": [null]}', /cannot write null to repeated field amounts/],
    ['a null map value', '{"amount_map": {"a": null}}', /cannot write a null value to map field amount_map/],
  ]
  it.each(refused)('refuses %s', async (_label, expr, message) => {
    await expect(protoTransform(expr)).rejects.toThrow(message)
  })

  // Empty is still a legitimate way to clear either field, as it is on the reference
  // ({"amounts": []} and {"amount_map": {}} both parse), and so is an explicit null.
  it('clears a container with an empty one, or with null', async () => {
    const empty = await protoTransform('{"amounts": [], "amount_map": {}, "label": "hi"}')
    expect(empty.amounts).toEqual([])
    expect(empty.amountMap).toEqual({})

    const cleared = await protoTransform('{"amounts": null, "amount_map": null, "label": "hi"}')
    expect(cleared.amounts).toEqual([])
    expect(cleared.amountMap).toEqual({})
  })
})

describe('avsc error reporting', () => {
  // A protobuf-es message carries a circular descriptor graph, so stringifying it inside the
  // error hook threw and hid the schema mismatch that was the actual failure. The rejected
  // value must be *named* instead.
  it('names a foreign object rather than crashing on it', async () => {
    // No rule: the point is the writer's own validity check, reached with a protobuf message
    // sitting where the schema wants bytes - which is the state a transform used to leave.
    const subject = `celcontainerhook${n++}`
    const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
    const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
    await client.register(`${subject}-value`,
      { schemaType: 'AVRO', schema: SCHEMA } as any as SchemaInfo, false)

    let message = ''
    try {
      await ser.serialize(subject, { ...avroRecord(), amounts: [protoDec('1.11')] })
    } catch (e: any) {
      message = String(e.message)
    }

    expect(message).not.toContain('circular structure')
    expect(message).toContain('Invalid message at amounts')
    // Naming the type is the useful part: it says which foreign object was left behind.
    expect(message).toContain('Decimal')
  })
})
