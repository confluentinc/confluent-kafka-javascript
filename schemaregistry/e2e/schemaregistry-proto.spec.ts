import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  SchemaRegistryClient,
  SchemaInfo,
} from '../schemaregistry-client';
import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import { clientConfig } from '../test/test-constants';
import { SerdeType } from "../serde/serde";
import { v4 } from 'uuid';
import {ProtobufDeserializer, ProtobufSerializer, ProtobufSerializerConfig} from "../serde/protobuf";

let schemaRegistryClient: SchemaRegistryClient;
let serializerConfig: ProtobufSerializerConfig;
let serializer: ProtobufSerializer;
let deserializer: ProtobufDeserializer;
let producer: KafkaJS.Producer;
let consumer: KafkaJS.Consumer;


const kafkaBrokerList = 'localhost:9092';
const kafka = new KafkaJS.Kafka({
  kafkaJS: {
    brokers: [kafkaBrokerList],
  },
});


const schemaString: string = "\n" +
  "syntax = \"proto3\";\n" +
  "message TestMessageValue {\n" +
  "  string name = 1;\n" +
  "  int32 age = 2;\n" +
  "\n" +
  "}\n";

const messageValue = {
  "name": "Bob Jones",
  "age": 25
};

const schemaInfo: SchemaInfo = {
  schema: schemaString,
  schemaType: 'PROTOBUF'
};

describe('SchemaRegistryClient Proto Integration Test', () => {

  beforeEach(async () => {
    schemaRegistryClient = new SchemaRegistryClient(clientConfig);

    producer = kafka.producer({
      kafkaJS: {
        allowAutoTopicCreation: true,
        acks: 1,
        compression: KafkaJS.CompressionTypes.GZIP,
      }
    });
    await producer.connect();

    consumer = kafka.consumer({
      kafkaJS: {
        groupId: 'test-group',
        fromBeginning: true,
        partitionAssigners: [KafkaJS.PartitionAssigners.roundRobin],
      },
    });
  });

  afterEach(async () => {
    await producer.disconnect();
  });

  it("Should serialize and deserialize proto", async () => {
    const testTopic = v4();

    await schemaRegistryClient.register(testTopic + "-value", schemaInfo);

    serializerConfig = { useLatestVersion: true };
    serializer = new ProtobufSerializer(schemaRegistryClient, SerdeType.VALUE, serializerConfig);
    deserializer = new ProtobufDeserializer(schemaRegistryClient, SerdeType.VALUE, {});

    const outgoingMessage = {
      key: 'key',
      value: await serializer.serialize(testTopic, {...messageValue,  $typeName: "TestMessageValue"})
    };

    await producer.send({
      topic: testTopic,
      messages: [outgoingMessage]
    });

    consumer = kafka.consumer({
      kafkaJS: {
        groupId: 'test-group',
        fromBeginning: true,
        partitionAssigners: [KafkaJS.PartitionAssigners.roundRobin],
      },
    });

    await consumer.connect();
    await consumer.subscribe({ topic: testTopic });
    let messageRcvd = false;
    await consumer.run({
      eachMessage: async ({ message }) => {
        const decodedMessage = {
          ...message,
          value: await deserializer.deserialize(testTopic, message.value as Buffer)
        };
        messageRcvd = true;

        expect(decodedMessage.value).toMatchObject(messageValue);
      },
    });

    // Wait around until we get a message, and then disconnect.
    while (!messageRcvd) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await consumer.disconnect();
  }, 30000);
});
