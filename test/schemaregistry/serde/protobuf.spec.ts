import {describe, expect, it} from '@jest/globals';
import {ClientConfig} from "../../../schemaregistry/rest-service";
import {
  ProtobufDeserializer, ProtobufDeserializerConfig,
  ProtobufSerializer, ProtobufSerializerConfig,
} from "../../../schemaregistry/serde/protobuf";
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
import {AuthorSchema, file_test_schemaregistry_serde_author} from "./author_pb";
import {create, toBinary} from "@bufbuild/protobuf";
import {FileDescriptorProtoSchema} from "@bufbuild/protobuf/wkt";

const fieldEncryptionExecutor = FieldEncryptionExecutor.register()
LocalKmsDriver.register()

describe('ProtobufSerializer', () => {
  it('basic serialization', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    let client = SchemaRegistryClient.newClient(conf)
    let ser = new ProtobufSerializer(client, SerdeType.VALUE, {autoRegisterSchemas: true})
    ser.registry.add(AuthorSchema)
    let obj = create(AuthorSchema, {
      name: 'Kafka',
      id: 123,
      picture: Buffer.from([1, 2]),
      works: ['The Castle', 'The Trial']
    })
    let bytes = await ser.serialize("topic1", obj)

    let deser = new ProtobufDeserializer(client, SerdeType.VALUE, {})
    let obj2 = await deser.deserialize("topic1", bytes)
    expect(obj2).toEqual(obj)
  })
  it('basic encryption', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    let client = SchemaRegistryClient.newClient(conf)
    let serConfig: ProtobufSerializerConfig = {
      useLatestVersion: true,
      ruleConfig: {
        secret: 'mysecret'
      }
    }
    let ser = new ProtobufSerializer(client, SerdeType.VALUE, serConfig)
    ser.registry.add(AuthorSchema)
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
      schema: Buffer.from(toBinary(FileDescriptorProtoSchema, file_test_schemaregistry_serde_author.proto)).toString('base64'),
      ruleSet
    }

    let id = await client.register('topic1-value', info, false)
    expect(id).toEqual(1)

    let obj = create(AuthorSchema, {
      name: 'Kafka',
      id: 123,
      picture: Buffer.from([1, 2]),
      works: ['The Castle', 'The Trial']
    })
    let bytes = await ser.serialize("topic1", obj)

    // reset encrypted field
    obj.name = 'Kafka'
    obj.picture = Buffer.from([1, 2])

    let deserConfig: ProtobufDeserializerConfig = {
      ruleConfig: {
        secret: 'mysecret'
      }
    }
    let deser = new ProtobufDeserializer(client, SerdeType.VALUE, deserConfig)
    fieldEncryptionExecutor.client = dekClient
    let obj2 = await deser.deserialize("topic1", bytes)
    expect(obj2).toEqual(obj)
  })
})
