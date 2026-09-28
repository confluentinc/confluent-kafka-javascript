/**
 * Protobuf enums through a message-level `CEL` transform.
 *
 * CEL has no enum type: cel-es reads an enum field as an int, which this runtime carries as a
 * `bigint`, while protobuf reflection wants the generated numeric value. The writer narrowed
 * the scalar kinds and left `enum` alone at all three value positions, so an *identity*
 * transform over a message with an enum field failed with
 * `FieldError: expected enum test.Status, got 1n`. Every other client narrows enums explicitly
 * (the reference gets it free: its write-back renders the result map to protobuf JSON, where an
 * enum is a number or a name).
 */
import { describe, expect, it } from '@jest/globals'
import { clone, create, createFileRegistry, createRegistry, type DescFile, type DescMessage } from '@bufbuild/protobuf'
import {
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  DescriptorProtoSchema,
  MessageOptionsSchema,
  FileDescriptorProtoSchema,
} from '@bufbuild/protobuf/wkt'
import { RuleContext } from '../../../serde/serde'
import { RuleMode } from '../../../schemaregistry-client'
import { CelExecutor } from '../../../rules/cel/cel-executor'
import { NestedMessageSchema, Status } from '../../serde/test/nested_pb'

/**
 * `test.NestedMessage` with a repeated and a map enum field added, which the checked-in
 * descriptor has no equivalent of - the list and map value positions need the same narrowing
 * as the singular one.
 */
function withEnumContainers(): DescMessage {
  const original: DescFile = NestedMessageSchema.file
  const proto = clone(FileDescriptorProtoSchema, original.proto)
  const message = proto.messageType.find((m) => m.name === 'NestedMessage')!
  message.field.push(create(FieldDescriptorProtoSchema, {
    name: 'statuses', number: 90, jsonName: 'statuses',
    type: FieldDescriptorProto_Type.ENUM, typeName: '.test.Status',
    label: FieldDescriptorProto_Label.REPEATED,
  }))
  message.nestedType.push(create(DescriptorProtoSchema, {
    name: 'StatusMapEntry',
    options: create(MessageOptionsSchema, { mapEntry: true }),
    field: [
      create(FieldDescriptorProtoSchema, {
        name: 'key', number: 1, jsonName: 'key',
        type: FieldDescriptorProto_Type.STRING, label: FieldDescriptorProto_Label.OPTIONAL,
      }),
      create(FieldDescriptorProtoSchema, {
        name: 'value', number: 2, jsonName: 'value',
        type: FieldDescriptorProto_Type.ENUM, typeName: '.test.Status',
        label: FieldDescriptorProto_Label.OPTIONAL,
      }),
    ],
  }))
  message.field.push(create(FieldDescriptorProtoSchema, {
    name: 'status_map', number: 91, jsonName: 'statusMap',
    type: FieldDescriptorProto_Type.MESSAGE, typeName: '.test.NestedMessage.StatusMapEntry',
    label: FieldDescriptorProto_Label.REPEATED,
  }))
  const deps = new Map<string, DescFile>()
  const collect = (file: DescFile) => {
    for (const dep of file.dependencies) {
      if (!deps.has(dep.proto.name)) {
        deps.set(dep.proto.name, dep)
        collect(dep)
      }
    }
  }
  collect(original)
  const registry = createFileRegistry(proto, (name) => deps.get(name)?.proto)
  return registry.getMessage('test.NestedMessage')!
}

const transform = async (expr: string, msg: any, schema: DescMessage = NestedMessageSchema): Promise<any> => {
  const rule = { name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr } as any
  const target = { schema: '{}', schemaType: 'PROTOBUF' } as any
  const ctx = new RuleContext(undefined, null, target, 's', 't', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, createRegistry(schema))
  return await new CelExecutor().transform(ctx, msg)
}

const nested = () => create(NestedMessageSchema, {
  isActive: true,
  status: Status.INACTIVE,
})

describe('protobuf enums survive a message-level transform', () => {
  // The identity transform is the whole bug: no computation, just the write-back.
  it('round-trips a singular enum', async () => {
    const out = await transform('{"is_active": message.is_active, "status": message.status}', nested())

    expect(out.status).toBe(Status.INACTIVE)
    expect(typeof out.status).toBe('number')
    expect(out.isActive).toBe(true)
  })

  // An enum reads as a CEL int, so arithmetic and comparison against a number are what a rule
  // will actually do with one.
  it('writes back a computed enum number', async () => {
    const out = await transform('{"status": message.status - 1}', nested())

    expect(out.status).toBe(Status.ACTIVE)
  })

  // protobuf JSON's canonical form for an enum is its symbol name, and `JsonFormat.parseEnum`
  // on the reference takes a name as well as a number - CEL has no enum type, so a name is the
  // only way a rule can write a symbol.
  it('accepts a symbol name', async () => {
    const out = await transform('{"status": "INACTIVE"}', nested())

    expect(out.status).toBe(Status.INACTIVE)
  })

  it('refuses an unknown symbol name rather than writing zero', async () => {
    await expect(transform('{"status": "NOPE"}', nested())).rejects.toThrow(/invalid enum value NOPE/)
  })

  // proto3 enums are open, which is what this file is: the reference's
  // findValueByNumberCreatingIfUnknown keeps an unrecognised number, and protobuf-es agrees.
  it('carries an unrecognised number through an open enum', async () => {
    const out = await transform('{"status": 77}', nested())

    expect(out.status).toBe(77)
  })

  it('refuses an enum number outside int32', async () => {
    await expect(transform('{"status": 2147483648}', nested()))
      .rejects.toThrow(/out of range for enum type test.Status/)
  })

  it('round-trips enum list elements and map values', async () => {
    const schema = withEnumContainers()
    const msg = create(schema, {
      status: Status.INACTIVE,
      statuses: [Status.ACTIVE, Status.INACTIVE],
      statusMap: { a: Status.INACTIVE },
    } as any)

    const out: any = await transform(
      '{"status": message.status, "statuses": message.statuses, "status_map": message.status_map}',
      msg, schema)

    expect(out.statuses).toEqual([Status.ACTIVE, Status.INACTIVE])
    expect(out.statusMap).toEqual({ a: Status.INACTIVE })
    expect(out.status).toBe(Status.INACTIVE)
  })
})
