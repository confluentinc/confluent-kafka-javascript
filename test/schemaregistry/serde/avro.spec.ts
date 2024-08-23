import {describe, it} from '@jest/globals';
import {ClientConfig} from "../../../schemaregistry/rest-service";
import {AvroDeserializer, AvroSerializer} from "../../../schemaregistry/serde/avro";
import {newClient, SerdeType} from "../../../schemaregistry/serde/serde";

describe('AvroSerializer', () => {
  it('basic serialization', async () => {
    let conf: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000,
      createAxiosDefaults: {}
    }
    let client = newClient(conf)
    let ser = new AvroSerializer(client, SerdeType.VALUE, {autoRegisterSchemas: true})
    let obj = {
      intField: 123,
      doubleField: 45.67,
      stringField: 'hi',
      boolField: true,
      bytesField: new Uint8Array([1, 2]),
    }
    let bytes = await ser.serialize("topic1", obj)

    let deser = new AvroDeserializer(client, SerdeType.VALUE, {})
    let obj2 = await deser.deserialize("topic1", bytes)
    console.log(obj2)
  })
})
