import {
  SerdeType,
  SchemaRegistryClient, RuleMode, FieldEncryptionExecutor, AwsKmsDriver, JsonDeserializer, JsonSerializer
} from "@confluentinc/schemaregistry";
import { bearerAuthCredentials } from "../constants.js";
import { v4 } from "uuid";

FieldEncryptionExecutor.register();
AwsKmsDriver.register();

const clientConfig = {
  baseURLs: ['your-schema-registry-url'],
  isForward: false,
  cacheCapacity: 512,
  cacheLatestTtlSecs: 60,
  bearerAuthCredentials: bearerAuthCredentials,
};

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

// const jsonSchemaStringWithTags = JSON.stringify({
//   "$schema": "http://json-schema.org/draft-07/schema#",
//   "title": "User",
//   "type": "object",
//   "properties": {
//     "name": {
//       "type": "string"
//     },
//     "age": {
//       "type": "integer"
//     },
//     "address": {
//       "type": "string",
//       "confluent:tags": ["PII"]
//     },
//     "ssn": {
//       "type": "string",
//       "confluent:tags": ["PII"]
//     },
//   },
//   "required": ["name", "age", "address", "ssn"]
// });

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
      "type": "string"
    },
    "ssn": {
      "type": "string",
    },
    "ssn1": {
      "type": "string",
    },
    "ssn2": {
      "type": "string",
    },
    "ssn3": {
      "type": "string",
    },
    "ssn4": {
      "type": "string",
    },
  },
  "required": ["name", "age", "address", "ssn", "ssn1", "ssn2", "ssn3", "ssn4"],
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

const jsonSchemaInfo = {
  schema: jsonSchemaString,
  schemaType: 'JSON'
};


const jsonSchemaInfoWithRules = {
  schema: jsonSchemaStringWithTags,
  schemaType: 'JSON',
  ruleSet: ruleSet
};

let data;

let schemaRegistryClient;

function generateData(numRecords) {
  for (let i = 0; i < numRecords; i++) {
    data.push({
      name: `User ${i}`,
      age: Math.floor(Math.random() * 100),
      address: v4(),
      ssn: (Math.floor(Math.random() * 1000000000)).toString(),
      ssn1: (Math.floor(Math.random() * 1000000000)).toString(),
      ssn2: (Math.floor(Math.random() * 1000000000)).toString(),
      ssn3: (Math.floor(Math.random() * 1000000000)).toString(),
      ssn4: (Math.floor(Math.random() * 1000000000)).toString(),
    });
  }
}

const numRecords = 10000;
const numIterations = 10;
let sequentialJsonTime = 0.0;
let concurrentJsonTime = 0.0;
let sequentialJsonWithCSFLETime = 0.0;
let concurrentJsonWithCSFLETime = 0.0;

async function serializeAndDeserializeSchemas(serializer, deserializer, topic) {
  await Promise.all(
    data.map(async (record) => {
      const serialized = await serializer.serialize(topic, record);
      await sleep(2);
      await deserializer.deserialize(topic, serialized);
    })
  );
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function concurrentJSON() {

  const topic = v4();
  await schemaRegistryClient.register(topic + "-value", jsonSchemaInfo);

  const jsonSerializerConfig = { useLatestVersion: true };
  const jsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
  const jsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

  const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
  await jsonDeserializer.deserialize(topic, firstSerialized);

  const now = new Date();
console.log('concurrent, totalRecords:', numRecords);

  const start = performance.now();
  await serializeAndDeserializeSchemas(jsonSerializer, jsonDeserializer, topic);
  const end = performance.now();

  concurrentJsonTime += (end - start);

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

  console.log("Concurrent with Rules, totalRecords:", numRecords);

  const start = performance.now();
  await serializeAndDeserializeSchemas(jsonSerializer, jsonDeserializer, topic);
  const end = performance.now();

  concurrentJsonWithCSFLETime += (end - start);

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

  console.log('Sequential, totalRecords:', numRecords);

  const start = performance.now();
  for (let i = 0; i < numRecords; i++) {
    const serialized = await jsonSerializer.serialize(topic, data[i]);
    await jsonDeserializer.deserialize(topic, serialized);
  }
  const end = performance.now();

  sequentialJsonTime += (end - start);

  console.log(`Sequential serialization and deserialization took ${end - start} ms`);
}

async function sequentialJsonWithCSFLE() {
  const topic = v4();
  await schemaRegistryClient.register(topic + "-value", jsonSchemaInfoWithRules);
  const jsonSerializerConfig = { useLatestVersion: true };
  const jsonSerializer = new JsonSerializer(schemaRegistryClient, SerdeType.VALUE, jsonSerializerConfig);
  const jsonDeserializer = new JsonDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

  const firstSerialized = await jsonSerializer.serialize(topic, data[0]);
  await jsonDeserializer.deserialize(topic, firstSerialized);

  console.log('Sequential with rules, totalRecords:', numRecords);

  const start = performance.now();
  for (let i = 0; i < numRecords; i++) {
    const serialized = await jsonSerializer.serialize(topic, data[i]);
    await jsonDeserializer.deserialize(topic, serialized);
  }
  const end = performance.now();

  sequentialJsonWithCSFLETime += (end - start);

  console.log(`Sequential serialization and deserialization with rules took ${end - start} ms`);
}

async function runEverything() {
  for (let i = 0; i < numIterations; i++) {
    const start = performance.now();
    schemaRegistryClient = new SchemaRegistryClient(clientConfig);
    data = [];
    generateData(numRecords);
    const end = performance.now();
    console.log(`Data generation took ${end - start} ms`);
    await concurrentJSON();
    await sequentialJson();
    // await sequentialJsonWithCSFLE();
    // await concurrentJsonWithCSFLE();
  }

  console.log(`Average time for concurrent JSON serialization and deserialization over ${numIterations} iterations: ${(concurrentJsonTime / numIterations).toFixed(4)} ms`);
  console.log(`Average time for sequential JSON serialization and deserialization over ${numIterations} iterations: ${(sequentialJsonTime / numIterations).toFixed(4)} ms`);
  console.log(`Average time for sequential JSON serialization and deserialization with rules over ${numIterations} iterations: ${(sequentialJsonWithCSFLETime / numIterations).toFixed(4)} ms`);
  console.log(`Average time for concurrent JSON serialization and deserialization with rules over ${numIterations} iterations: ${(concurrentJsonWithCSFLETime / numIterations).toFixed(4)} ms`);

}

runEverything();