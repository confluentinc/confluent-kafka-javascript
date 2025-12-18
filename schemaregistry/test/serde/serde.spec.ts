import { describe, expect, it } from '@jest/globals';
import {RecordNameStrategy, SchemaId, SerdeType, TopicNameStrategy} from "../../serde/serde";
import {SchemaInfo} from "../../schemaregistry-client";
import {create, toBinary} from "@bufbuild/protobuf";
import {FileDescriptorProtoSchema} from "@bufbuild/protobuf/wkt";

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

describe('TopicNameStrategy', () => {
  it('should create subject with -value suffix', () => {
    const subject = TopicNameStrategy('test-topic', SerdeType.VALUE)
    expect(subject).toBe('test-topic-value')
  })

  it('should create subject with -key suffix', () => {
    const subject = TopicNameStrategy('test-topic', SerdeType.KEY)
    expect(subject).toBe('test-topic-key')
  })
})

describe('RecordNameStrategy', () => {
  describe('Avro schema', () => {
    it('should extract record name with namespace', () => {
      const schema: SchemaInfo = {
        schema: JSON.stringify({
          type: 'record',
          name: 'User',
          namespace: 'com.example',
          fields: [
            { name: 'name', type: 'string' },
            { name: 'age', type: 'int' }
          ]
        }),
        schemaType: 'AVRO'
      }

      const subject = RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      expect(subject).toBe('com.example.User')
    })

    it('should extract record name without namespace', () => {
      const schema: SchemaInfo = {
        schema: JSON.stringify({
          type: 'record',
          name: 'User',
          fields: [
            { name: 'name', type: 'string' }
          ]
        }),
        schemaType: 'AVRO'
      }

      const subject = RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      expect(subject).toBe('User')
    })

    it('should throw on invalid Avro schema', () => {
      const schema: SchemaInfo = {
        schema: 'invalid json',
        schemaType: 'AVRO'
      }

      expect(() => {
        RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      }).toThrow('Invalid Avro schema')
    })
  })

  describe('JSON schema', () => {
    it('should extract title from JSON schema', () => {
      const schema: SchemaInfo = {
        schema: JSON.stringify({
          title: 'com.example.User',
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' }
          }
        }),
        schemaType: 'JSON'
      }

      const subject = RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      expect(subject).toBe('com.example.User')
    })

    it('should throw on JSON schema without title', () => {
      const schema: SchemaInfo = {
        schema: JSON.stringify({
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }),
        schemaType: 'JSON'
      }

      expect(() => {
        RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      }).toThrow('JSON schema is missing required "title" field')
    })
  })

  describe('Protobuf schema', () => {
    it('should extract message name with package', () => {
      // Create a simple FileDescriptorProto
      const fileDescriptor = create(FileDescriptorProtoSchema, {
        name: 'test.proto',
        package: 'com.example',
        messageType: [
          { name: 'User' }
        ]
      })

      const base64Schema = Buffer.from(
        toBinary(FileDescriptorProtoSchema, fileDescriptor)
      ).toString('base64')

      const schema: SchemaInfo = {
        schema: base64Schema,
        schemaType: 'PROTOBUF'
      }

      const subject = RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      expect(subject).toBe('com.example.User')
    })

    it('should extract message name without package', () => {
      const fileDescriptor = create(FileDescriptorProtoSchema, {
        name: 'test.proto',
        messageType: [
          { name: 'User' }
        ]
      })

      const base64Schema = Buffer.from(
        toBinary(FileDescriptorProtoSchema, fileDescriptor)
      ).toString('base64')

      const schema: SchemaInfo = {
        schema: base64Schema,
        schemaType: 'PROTOBUF'
      }

      const subject = RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      expect(subject).toBe('User')
    })

    it('should throw on Protobuf schema without messages', () => {
      const fileDescriptor = create(FileDescriptorProtoSchema, {
        name: 'test.proto',
        package: 'com.example'
      })

      const base64Schema = Buffer.from(
        toBinary(FileDescriptorProtoSchema, fileDescriptor)
      ).toString('base64')

      const schema: SchemaInfo = {
        schema: base64Schema,
        schemaType: 'PROTOBUF'
      }

      expect(() => {
        RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      }).toThrow('Protobuf schema has no message types defined')
    })

    it('should throw on invalid base64 Protobuf schema', () => {
      const schema: SchemaInfo = {
        schema: 'invalid-base64!!!',
        schemaType: 'PROTOBUF'
      }

      expect(() => {
        RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      }).toThrow('Invalid Protobuf schema')
    })
  })

  describe('edge cases', () => {
    it('should throw when schema is undefined', () => {
      expect(() => {
        RecordNameStrategy('test-topic', SerdeType.VALUE, undefined)
      }).toThrow('Schema is required but was not provided')
    })

    it('should throw when schema.schema is empty', () => {
      const schema: SchemaInfo = {
        schema: '',
        schemaType: 'AVRO'
      }

      expect(() => {
        RecordNameStrategy('test-topic', SerdeType.VALUE, schema)
      }).toThrow('Schema is required but was not provided')
    })
  })
})
