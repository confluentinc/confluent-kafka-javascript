import {
  ClientConfig,
  SchemaRegistryClient, SchemaInfo,
  kafkaAvroSerializerBuilder
} from "@confluentinc/schemaregistry";
import { CreateAxiosDefaults } from "axios";
import { KafkaJS } from '@confluentinc/kafka-javascript';
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

async function kafkaProducerAvro() {

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
    type: 'record',
    name: 'User',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'age', type: 'int' },
    ],
  });

  const schemaInfo: SchemaInfo = {
    schemaType: 'AVRO',
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

  /* The serializer is built by the producer while it connects, and applied to
   * every message value from then on. */
  const valueSerializerBuilder = kafkaAvroSerializerBuilder<User>()
    .setClientConfig(clientConfig)
    .setAvroSerializerConfig({ useLatestVersion: true });

  const producer: KafkaJS.Producer<string, User> = kafka.producer<string, User>({
    kafkaJS: {
      allowAutoTopicCreation: true,
      acks: 1,
      compression: KafkaJS.CompressionTypes.GZIP,
    },
    'js.value.serializer.builder': valueSerializerBuilder
  });

  const outgoingMessage: KafkaJS.Message<string, User> = {
    key: "1",
    value: new User('Alice N Bob', 30)
  };

  console.log("Outgoing message: ", outgoingMessage);

  await producer.connect();

  await producer.send({
    topic: userTopic,
    messages: [outgoingMessage]
  });

  await producer.disconnect();
}

kafkaProducerAvro();
