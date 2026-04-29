import { describe, expect, it } from '@jest/globals';
import {SchemaId} from "../../serde/serde";

describe('readMessageIndexes', () => {
  it('returns [0] for zero-count shorthand, consuming 1 byte', () => {
    const schemaId = new SchemaId("PROTOBUF")
    // 0x00 = count 0, meaning default index [0]
    const payload = Buffer.from([0x00, 0x0a, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
    const [bytesRead, indexes] = schemaId.readMessageIndexes(payload)
    expect(indexes).toEqual([0])
    expect(bytesRead).toEqual(1)
  })

  it('returns [0] with 0 bytes consumed when count zigzag-decodes to negative (absent indexes)', () => {
    const schemaId = new SchemaId("PROTOBUF")
    // 0x09 = raw 9, zigzag decode = -5 (field 1, 64-bit wire type in protobuf)
    const payload = Buffer.from([0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const [bytesRead, indexes] = schemaId.readMessageIndexes(payload)
    expect(indexes).toEqual([0])
    expect(bytesRead).toEqual(0)
  })

  it('returns [0] with 0 bytes consumed when first index is negative (absent indexes, positive count)', () => {
    const schemaId = new SchemaId("PROTOBUF")
    // 0x0a = count 5 (field 1, wire type 2 in protobuf), 0x05 = raw 5, zigzag = -3
    const payload = Buffer.from([0x0a, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
    const [bytesRead, indexes] = schemaId.readMessageIndexes(payload)
    expect(indexes).toEqual([0])
    expect(bytesRead).toEqual(0)
  })

  it('reads valid positive message indexes normally', () => {
    const schemaId = new SchemaId("PROTOBUF")
    // 0x06 = count 3, then indexes 1, 2, 3 (zigzag encoded as 0x02 0x04 0x06)
    const payload = Buffer.from([0x06, 0x02, 0x04, 0x06])
    const [bytesRead, indexes] = schemaId.readMessageIndexes(payload)
    expect(indexes).toEqual([1, 2, 3])
    expect(bytesRead).toEqual(4)
  })
})

describe('SchemaGuid', () => {
  it('schema guid', () => {
    const schemaId = new SchemaId("AVRO")
    const input = new Uint8Array([
      0x01, 0x89, 0x79, 0x17, 0x62, 0x23, 0x36, 0x41, 0x86, 0x96, 0x74, 0x29, 0x9b, 0x90,
      0xa8, 0x02, 0xe2,
    ])
    schemaId.fromBytes(Buffer.from(input))
    const guid = schemaId.guid
    expect(guid).toEqual("89791762-2336-4186-9674-299b90a802e2")

    const output = new Uint8Array(schemaId.guidToBytes())
    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toEqual(input[i])
    }
  })
  it('schema id', () => {
    const schemaId = new SchemaId("AVRO")
    const input = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x01,
    ])
    schemaId.fromBytes(Buffer.from(input))
    const id = schemaId.id
    expect(id).toEqual(1)

    const output = new Uint8Array(schemaId.idToBytes())
    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toEqual(input[i])
    }
  })
  it('schema guid with message indexes', () => {
    const schemaId = new SchemaId("PROTOBUF")
    const input = new Uint8Array([
      0x01, 0x89, 0x79, 0x17, 0x62, 0x23, 0x36, 0x41, 0x86, 0x96, 0x74, 0x29, 0x9b, 0x90,
      0xa8, 0x02, 0xe2, 0x06, 0x02, 0x04, 0x06,
    ])
    schemaId.fromBytes(Buffer.from(input))
    const guid = schemaId.guid
    expect(guid).toEqual("89791762-2336-4186-9674-299b90a802e2")

    const msgIndexes = schemaId.messageIndexes
    expect(msgIndexes).toEqual([1, 2, 3])

    const output = new Uint8Array(schemaId.guidToBytes())
    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toEqual(input[i])
    }
  })
  it('schema id with message indexes', () => {
    const schemaId = new SchemaId("PROTOBUF")
    const input = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x01, 0x06, 0x02, 0x04, 0x06,
    ])
    schemaId.fromBytes(Buffer.from(input))
    const id = schemaId.id
    expect(id).toEqual(1)

    const msgIndexes = schemaId.messageIndexes
    expect(msgIndexes).toEqual([1, 2, 3])

    const output = new Uint8Array(schemaId.idToBytes())
    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toEqual(input[i])
    }
  })
})
