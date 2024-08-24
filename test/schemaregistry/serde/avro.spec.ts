import {describe, expect, it} from '@jest/globals';
import {ClientConfig} from "../../../schemaregistry/rest-service";
import {
  AvroDeserializer, AvroDeserializerConfig,
  AvroSerializer,
  AvroSerializerConfig
} from "../../../schemaregistry/serde/avro";
import {SerdeType} from "../../../schemaregistry/serde/serde";
import {
  Rule,
  RuleMode,
  RuleSet,
  SchemaInfo,
  SchemaRegistryClient
} from "../../../schemaregistry/schemaregistry-client";
import {LocalKmsDriver} from "../../../schemaregistry/rules/encryption/localkms/local-driver";
import {FieldEncryptionExecutor} from "../../../schemaregistry/rules/encryption/encrypt-executor";

const demoSchema = `
{
  "name": "DemoSchema",
  "type": "record",
  "fields": [
    {
      "name": "intField",
      "type": "int"
    },
    {
      "name": "doubleField",
      "type": "double"
    },
    {
      "name": "stringField",
      "type": "string",
      "confluent:tags": [ "PII" ]
    },
    {
      "name": "boolField",
      "type": "boolean"
    },
    {
      "name": "bytesField",
      "type": "bytes",
      "confluent:tags": [ "PII" ]
    }
  ]
}
`

const fieldEncryptionExecutor = FieldEncryptionExecutor.register()
LocalKmsDriver.register()

describe('AvroSerializer', () => {
  it('basic serialization', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    let client = SchemaRegistryClient.newClient(conf)
    let ser = new AvroSerializer(client, SerdeType.VALUE, {autoRegisterSchemas: true})
    let obj = {
      intField: 123,
      doubleField: 45.67,
      stringField: 'hi',
      boolField: true,
      bytesField: Buffer.from([1, 2]),
    }
    let bytes = await ser.serialize("topic1", obj)

    let deser = new AvroDeserializer(client, SerdeType.VALUE, {})
    let obj2 = await deser.deserialize("topic1", bytes)
    expect(obj2.intField).toEqual(obj.intField);
    expect(obj2.doubleField).toBeCloseTo(obj.doubleField, 0.001);
    expect(obj2.stringField).toEqual(obj.stringField);
    expect(obj2.boolField).toEqual(obj.boolField);
    expect(obj2.bytesField).toEqual(obj.bytesField);
  })
  it('basic encryption', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    let client = SchemaRegistryClient.newClient(conf)
    let serConfig: AvroSerializerConfig = {
      useLatestVersion: true,
      ruleConfig: {
        secret: 'mysecret'
      }
    }
    let ser = new AvroSerializer(client, SerdeType.VALUE, serConfig)
    let dekClient = fieldEncryptionExecutor.client

    let encRule: Rule = {
      name: 'test-encrypt',
      kind: 'TRANSFORM',
      mode: RuleMode.WRITEREAD,
      type: 'ENCRYPT',
      tags: ['PII'],
      params: {
        'encrypt.kek.name': 'kek1',
        'encrypt.kms.type': 'local-kms',
        'encrypt.kms.key.id': 'mykey',
      },
      onFailure: 'ERROR,ERROR'
    }
    let ruleSet: RuleSet = {
      domainRules: [encRule]
    }

    let info: SchemaInfo = {
      schemaType: 'AVRO',
      schema: demoSchema,
      ruleSet
    }

    let id = await client.register('topic1-value', info, false)
    expect(id).toEqual(1)

    let obj = {
      intField: 123,
      doubleField: 45.67,
      stringField: 'hi',
      boolField: true,
      bytesField: Buffer.from([1, 2]),
    }
    let bytes = await ser.serialize("topic1", obj)

    // reset encrypted field
    obj.stringField = 'hi'
    obj.bytesField = Buffer.from([1, 2])

    let deserConfig: AvroDeserializerConfig = {
      ruleConfig: {
        secret: 'mysecret'
      }
    }
    let deser = new AvroDeserializer(client, SerdeType.VALUE, deserConfig)
    fieldEncryptionExecutor.client = dekClient
    let obj2 = await deser.deserialize("topic1", bytes)
    expect(obj2.intField).toEqual(obj.intField);
    expect(obj2.doubleField).toBeCloseTo(obj.doubleField, 0.001);
    expect(obj2.stringField).toEqual(obj.stringField);
    expect(obj2.boolField).toEqual(obj.boolField);
    expect(obj2.bytesField).toEqual(obj.bytesField);
  })
})
