import {
  SerdeType,
  SchemaRegistryClient, RuleMode, FieldEncryptionExecutor, AwsKmsDriver,
  Serializer, Deserializer
} from "@confluentinc/schemaregistry";
import {
  JsonSerializer, JsonDeserializer
} from "@confluentinc/schemaregistry/serde/json";
import { bearerAuthCredentials } from "../constants.js";
import { v4 } from "uuid";

FieldEncryptionExecutor.register();
AwsKmsDriver.register();

const clientConfig = {
  baseURLs: ['https://psrc-1ymy5nj.us-east-1.aws.confluent.cloud'],
  isForward: false,
  cacheCapacity: 512,
  cacheLatestTtlSecs: 60,
  bearerAuthCredentials: bearerAuthCredentials,
};

const avroSchemaString = JSON.stringify({
  type: 'record',
  name: 'User',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'age', type: 'int' },
    { name: 'address', type: 'string' },
  ],
});

const avroSchemaStringWithTags = JSON.stringify({
  type: 'record',
  name: 'User',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'age', type: 'int' },
    {
      name: 'address', type: 'string',
      "confluent:tags": ["PII"]
    }
  ],
});

const jsonSchemaString = JSON.stringify({
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "User",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "integer"
    },
    "address": {
      "type": "string",
    }
  },
  "required": ["name", "age", "address"]
});

const jsonSchemaStringWithTags = JSON.stringify({
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "User",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "integer"
    },
    "address": {
      "type": "string",
      "confluent:tags": ["PII"]
    }
  },
  "required": ["name", "age", "address"]
});

let encRule = {
  name: 'EncryptionDemo',
  kind: 'TRANSFORM',
  mode: RuleMode.WRITEREAD,
  type: 'ENCRYPT',
  tags: ['PII'],
  params: {
    'encrypt.kek.name': 'schemaregistrydemo',
    'encrypt.kms.type': 'aws-kms',
    'encrypt.kms.key.id': 'arn:aws:kms:us-east-2:976193223724:key/7c899ecd-599e-4f40-a19f-92ab27a55b35',
  },
  onFailure: 'ERROR,NONE'
};

let ruleSet = {
  domainRules: [encRule]
};

const avroSchemaInfo = {
  schema: avroSchemaString,
  schemaType: 'AVRO'
};

const jsonSchemaInfo = {
  schema: jsonSchemaString,
  schemaType: 'JSON'
};

// const avroSchemaInfoWithRules = {
//   schema: avroSchemaStringWithTags,
//   schemaType: 'AVRO',
//   ruleSet: ruleSet
// };

const jsonSchemaInfoWithRules = {
  schema: jsonSchemaStringWithTags,
  schemaType: 'JSON',
  ruleSet: ruleSet
};

let data: any;

let schemaRegistryClient:SchemaRegistryClient;

function generateData(numRecords: number) {
  for (let i = 0; i < numRecords; i++) {
    data.push({
      name: `User ${i}`,
      age: Math.floor(Math.random() * 100),
      address: v4()
    });
  }
}

const numRecords = 1;

async function serializeAndDeserializeSchemas(serializer: any, deserializer: any, topic: string) {
  await Promise.all(
    data.map(async (record: any) => {
      const serialized = await serializer.serialize(topic, record);
      await deserializer.deserialize(topic, serialized);
    })
  );
}

async function concurrentJSON() {
  schemaRegistryClient = new SchemaRegistryClient(clientConfig);
  data = [];
  generateData(numRecords);

  const topic = v4();
  await schemaRegistryClient.register(topic + "-value", jsonSchemaInfo);

  const jsonSerializerConfig = { useLatestVersion: true };
  const jsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
  const jsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

  const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
  await jsonDeserializer.deserialize(topic, firstSerialized);

  const now = new Date();
console.log(now.toString(), 'concurrent, totalRecords:', numRecords);

  const start = performance.now();
  await serializeAndDeserializeSchemas(jsonSerializer, jsonDeserializer, topic);
  const end = performance.now();

  console.log(`Concurrent serialization and deserialization took ${end - start} ms`);
}

async function concurrentJsonWithCSFLE() {
  const topic = v4();
  await schemaRegistryClient.register(topic + "-value", jsonSchemaInfoWithRules);

  const jsonSerializerConfig = { useLatestVersion: true };
  const jsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
  const jsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

  const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
  await jsonDeserializer.deserialize(topic, firstSerialized);

  const now = new Date();
  console.log(now.toString(), "Concurrent with Rules, totalRecords:", numRecords);

  const start = performance.now();
  await serializeAndDeserializeSchemas(jsonSerializer, jsonDeserializer, topic);
  const end = performance.now();

  console.log(`Concurrent serialization and deserialization with rules took ${end - start} ms`);
}

async function sequentialJson() {
  const topic = v4();
  await schemaRegistryClient.register(topic + "-value", jsonSchemaInfo);
  const jsonSerializerConfig = { useLatestVersion: true };
  const jsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
  const jsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

  const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
  await jsonDeserializer.deserialize(topic, firstSerialized);

  const now = new Date();
console.log(now.toString(), 'sequential, totalRecords:', numRecords);

  const start = performance.now();
  for (let i = 0; i < numRecords; i++) {
    const serialized = await jsonSerializer.serialize(topic, data[i]);
    await jsonDeserializer.deserialize(topic, serialized);
  }
  const end = performance.now();

  console.log(`Sequential serialization and deserialization took ${end - start} ms`);
}

async function sequentialJsonWithRules() {
  const topic = v4();
  await schemaRegistryClient.register(topic + "-value", jsonSchemaInfoWithRules);
  const jsonSerializerConfig = { useLatestVersion: true };
  const jsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
  const jsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

  const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
  await jsonDeserializer.deserialize(topic, firstSerialized);

  const now = new Date();
console.log(now.toString(), 'sequential with rules, totalRecords:', numRecords);

  const start = performance.now();
  for (let i = 0; i < numRecords; i++) {
    const serialized = await jsonSerializer.serialize(topic, data[i]);
    await jsonDeserializer.deserialize(topic, serialized);
  }
  const end = performance.now();

  console.log(`Sequential serialization and deserialization with rules took ${end - start} ms`);
}

async function runEverything() {
  await concurrentJSON();
  await concurrentJsonWithCSFLE();
  // await sequentialJson();
  // await sequentialJsonWithRules();
}

runEverything();


// describe('Concurrent Serialization Performance Test', () => {

//   beforeEach(async () => {
//     schemaRegistryClient = new SchemaRegistryClient(clientConfig);
//     data = [];
//     generateData(numRecords);
//   });

//   it("Should measure serialization and deserialization performance for JSON", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", jsonSchemaInfo);

//     const jsonSerializerConfig: JsonSerializerConfig = { useLatestVersion: true };
//     const jsonSerializer: JsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
//     const jsonDeserializer: JsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
//     await jsonDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     await serializeAndDeserializeSchemas(jsonSerializer, jsonDeserializer, topic);
//     const end = performance.now();

//     console.log(`Concurrent JSON serialization and deserialization took ${end - start} ms`);
//   });

//   it("Should measure serialization and deserialization performance for Avro", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", avroSchemaInfo);

//     const avroSerializerConfig: AvroSerializerConfig = { useLatestVersion: true };
//     const avroSerializer: AvroSerializer = new AvroSerializer(schemaRegistryClient, SerdeType.VALUE, avroSerializerConfig);
//     const avroDeserializer: AvroDeserializer = new AvroDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await avroSerializer.serialize(topic, data[0]);
//     await avroDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     await serializeAndDeserializeSchemas(avroSerializer, avroDeserializer, topic);
//     const end = performance.now();

//     console.log(`Concurrent Avro serialization and deserialization took ${end - start} ms`);
//   });

//   // it("Should measure serialization and deserialization performance for Protobuf", async () => {
//   //   const protobufSerializerConfig: ProtobufSerializerConfig = { useLatestVersion: true };
//   //   const serializer: ProtobufSerializer = new ProtobufSerializer(schemaRegistryClient, SerdeType.VALUE, protobufSerializerConfig);
//   //   const deserializer: ProtobufDeserializer = new ProtobufDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//   //   const start = performance.now();
//   //   await serializeAndDeserializeSchemas(serializer, deserializer, topic);
//   //   const end = performance.now();

//   //   console.log(`Protobuf serialization and deserialization took ${end - start} ms`);
//   // });
// });

// describe('Concurrent Serialization Performance Test with Rules', () => {
//   beforeEach(async () => {
//     schemaRegistryClient = new SchemaRegistryClient(clientConfig);
//     data = [];
//     generateData(numRecords);
//   });

//   it("Should measure serialization and deserialization performance for JSON with rules", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", jsonSchemaInfoWithRules);

//     const jsonSerializerConfig: JsonSerializerConfig = { useLatestVersion: true };
//     const jsonSerializer: JsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
//     const jsonDeserializer: JsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
//     await jsonDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     await serializeAndDeserializeSchemas(jsonSerializer, jsonDeserializer, topic);
//     const end = performance.now();

//     console.log(`Concurrent JSON serialization and deserialization with rules took ${end - start} ms`);
//   });

//   it("Should measure serialization and deserialization performance for Avro with rules", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", avroSchemaInfoWithRules);

//     const avroSerializerConfig: AvroSerializerConfig = { useLatestVersion: true };
//     const avroSerializer: AvroSerializer = new AvroSerializer(schemaRegistryClient, SerdeType.VALUE, avroSerializerConfig);
//     const avroDeserializer: AvroDeserializer = new AvroDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await avroSerializer.serialize(topic, data[0]);
//     await avroDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     await serializeAndDeserializeSchemas(avroSerializer, avroDeserializer, topic);
//     const end = performance.now();

//     console.log(`Concurrent Avro serialization and deserialization with rules took ${end - start} ms`);
//   });
// });

// describe("Sequential Serialization Performance Test", () => {
//   beforeEach(async () => {
//     schemaRegistryClient = new SchemaRegistryClient(clientConfig);
//     data = [];
//     generateData(numRecords);
//   });

//   it("Should measure serialization and deserialization performance for JSON", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", jsonSchemaInfo);

//     const jsonSerializerConfig: JsonSerializerConfig = { useLatestVersion: true };
//     const jsonSerializer: JsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
//     const jsonDeserializer: JsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
//     await jsonDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     for (let i = 0; i < numRecords; i++) {
//       const serialized = await jsonSerializer.serialize(topic, data[i]);
//       await jsonDeserializer.deserialize(topic, serialized);
//     }
//     const end = performance.now();

//     console.log(`Sequential JSON serialization and deserialization took ${end - start} ms`);
//   });

//   it("Should measure serialization and deserialization performance for Avro", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", avroSchemaInfo);

//     const avroSerializerConfig: AvroSerializerConfig = { useLatestVersion: true };
//     const avroSerializer: AvroSerializer = new AvroSerializer(schemaRegistryClient, SerdeType.VALUE, avroSerializerConfig);
//     const avroDeserializer: AvroDeserializer = new AvroDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await avroSerializer.serialize(topic, data[0]);
//     await avroDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     for (let i = 0; i < numRecords; i++) {
//       const serialized = await avroSerializer.serialize(topic, data[i]);
//       await avroDeserializer.deserialize(topic, serialized);
//     }
//     const end = performance.now();

//     console.log(`Sequential Avro serialization and deserialization took ${end - start} ms`);
//   });
// });

// describe("Sequential Serialization Performance Test with Rules", () => {
//   beforeEach(async () => {
//     schemaRegistryClient = new SchemaRegistryClient(clientConfig);
//     data = [];
//     generateData(numRecords);
//   });

//   it("Should measure serialization and deserialization performance for JSON with rules", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", jsonSchemaInfoWithRules);

//     const jsonSerializerConfig: JsonSerializerConfig = { useLatestVersion: true };
//     const jsonSerializer: JsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
//     const jsonDeserializer: JsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
//     await jsonDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     for (let i = 0; i < numRecords; i++) {
//       const serialized = await jsonSerializer.serialize(topic, data[i]);
//       await jsonDeserializer.deserialize(topic, serialized);
//     }
//     const end = performance.now();

//     console.log(`Sequential JSON serialization and deserialization with rules took ${end - start} ms`);
//   });

//   it("Should measure serialization and deserialization performance for Avro with rules", async () => {
//     const topic = v4();
//     await schemaRegistryClient.register(topic + "-value", avroSchemaInfoWithRules);

//     const avroSerializerConfig: AvroSerializerConfig = { useLatestVersion: true };
//     const avroSerializer: AvroSerializer = new AvroSerializer(schemaRegistryClient, SerdeType.VALUE, avroSerializerConfig);
//     const avroDeserializer: AvroDeserializer = new AvroDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

//     const firstSerialized = await avroSerializer.serialize(topic, data[0]);
//     await avroDeserializer.deserialize(topic, firstSerialized);

//     const start = performance.now();
//     for (let i = 0; i < numRecords; i++) {
//       const serialized = await avroSerializer.serialize(topic, data[i]);
//       await avroDeserializer.deserialize(topic, serialized);
//     }
//     const end = performance.now();

//     console.log(`Sequential Avro serialization and deserialization with rules took ${end - start} ms`);
//   });

// });
