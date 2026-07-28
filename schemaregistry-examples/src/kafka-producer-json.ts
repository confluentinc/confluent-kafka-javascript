import {
  ClientConfig,
  SchemaRegistryClient, SchemaInfo,
  kafkaJsonSerializerBuilder
} from "@confluentinc/schemaregistry";
import { CreateAxiosDefaults } from "axios";
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Message } from "../../types/kafkajs";
import {
  basicAuthCredentials,
  clusterApiKey,
  clusterApiSecret,
  clusterBootstrapUrl,
  baseUrl
} from "./constants";

class User {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
}

async function kafkaProducerJson() {

  const createAxiosDefaults: CreateAxiosDefaults = {
    timeout: 10000
  };

  const clientConfig: ClientConfig = {
    baseURLs: [baseUrl],
    createAxiosDefaults: createAxiosDefaults,
    cacheCapacity: 512,
    cacheLatestTtlSecs: 60,
    basicAuthCredentials: basicAuthCredentials
  };

  const schemaRegistryClient = new SchemaRegistryClient(clientConfig);

  const schemaString: string = JSON.stringify({
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "User",
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "age": {
        "type": "integer"
      }
    },
    "required": ["name", "age"]
  });

  const schemaInfo: SchemaInfo = {
    schemaType: 'JSON',
    schema: schemaString,
  };

  const userTopic = 'example-user-topic';
  await schemaRegistryClient.register(userTopic + "-value", schemaInfo);

  const kafka: KafkaJS.Kafka = new KafkaJS.Kafka({
    kafkaJS: {
      brokers: [clusterBootstrapUrl],
      ssl: true,
      sasl: {
        mechanism: 'plain',
        username: clusterApiKey,
        password: clusterApiSecret,
      },
    },
  });

  const valueSerializerBuilder = kafkaJsonSerializerBuilder<User>()
    .setClientConfig(clientConfig)
    .setJsonSerializerConfig({ useLatestVersion: true });
    
  const producer: KafkaJS.Producer<string, User> = kafka.producer<string, User>({
    kafkaJS: {
      allowAutoTopicCreation: true,
      acks: 1,
      compression: KafkaJS.CompressionTypes.GZIP,
    },
    'js.value.serializer.builder': valueSerializerBuilder
  });

  const outgoingMessage = {
    key: "1",
    value: new User('Alice N Bob', 30)
  } as Message<string, User>;

  console.log("Outgoing message: ", outgoingMessage);

  await producer.connect();

  await producer.send({
    topic: userTopic,
    messages: [outgoingMessage]
  });

  await producer.disconnect();
}

kafkaProducerJson();