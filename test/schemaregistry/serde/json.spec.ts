import {describe, expect, it} from '@jest/globals';
import {ClientConfig} from "../../../schemaregistry/rest-service";
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
import {
  JsonDeserializer, JsonDeserializerConfig,
  JsonSerializer,
  JsonSerializerConfig
} from "../../../schemaregistry/serde/json";

const fieldEncryptionExecutor = FieldEncryptionExecutor.register()
LocalKmsDriver.register()

const demoSchema = `
{
  "type": "object",
  "properties": {
    "intField": { "type": "integer" },
    "doubleField": { "type": "number" },
    "stringField": {
       "type": "string",
       "confluent:tags": [ "PII" ]
    },
    "boolField": { "type": "boolean" },
    "bytesField": {
       "type": "string",
       "contentEncoding": "base64",
       "confluent:tags": [ "PII" ]
    }
  }
}
`

describe('JsonSerializer', () => {
  it('basic serialization', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    let client = SchemaRegistryClient.newClient(conf)
    let ser = new JsonSerializer(client, SerdeType.VALUE, {autoRegisterSchemas: true})
    let obj = {
      intField: 123,
      doubleField: 45.67,
      stringField: 'hi',
      boolField: true,
      bytesField: Buffer.from([0, 0, 0, 1]).toString('base64')
    }
    let bytes = await ser.serialize("topic1", obj)

    let deser = new JsonDeserializer(client, SerdeType.VALUE, {})
    let obj2 = await deser.deserialize("topic1", bytes)
    expect(obj2).toEqual(obj)
  })
  it('basic encryption', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    let client = SchemaRegistryClient.newClient(conf)
    let serConfig: JsonSerializerConfig = {
      useLatestVersion: true,
      ruleConfig: {
        secret: 'mysecret'
      }
    }
    let ser = new JsonSerializer(client, SerdeType.VALUE, serConfig)
    let dekClient = fieldEncryptionExecutor.client!

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
      bytesField: Buffer.from([0, 0, 0, 1]).toString('base64')
    }
    let bytes = await ser.serialize("topic1", obj)

    // reset encrypted field
    obj.stringField = 'hi'
    obj.bytesField = Buffer.from([0, 0, 0, 1]).toString('base64')

    let deserConfig: JsonDeserializerConfig = {
      ruleConfig: {
        secret: 'mysecret'
      }
    }
    let deser = new JsonDeserializer(client, SerdeType.VALUE, deserConfig)
    fieldEncryptionExecutor.client = dekClient
    let obj2 = await deser.deserialize("topic1", bytes)
    expect(obj2).toEqual(obj)
  })
})
