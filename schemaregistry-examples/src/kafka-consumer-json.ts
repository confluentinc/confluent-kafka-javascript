import {
    ClientConfig,
    kafkaJsonDeserializerBuilder
  } from "@confluentinc/schemaregistry";
  import { CreateAxiosDefaults } from "axios";
  import { KafkaJS } from '@confluentinc/kafka-javascript';
  import {
    basicAuthCredentials,
    clusterApiKey, clusterApiSecret,
    clusterBootstrapUrl, baseUrl
  } from "./constants";
  
class User {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
}
  
  async function kafkaConsumerJson() {
  
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
  
    const userTopic = 'example-user-topic';
  
    const consumer: KafkaJS.Consumer<string, User> = kafka.consumer<string, User>({
      kafkaJS: {
        groupId: 'example-group',
        fromBeginning: true,
        partitionAssigners: [KafkaJS.PartitionAssigners.roundRobin],
      },
      'js.value.deserializer.builder':
        kafkaJsonDeserializerBuilder<User>()
        .setClientConfig(clientConfig)
    });
  
    await consumer.connect();
    await consumer.subscribe({ topic: userTopic });
  
    let messageRcvd = false;
    await consumer.run({
      eachMessage: async ({ message }) => {
        console.log("Message key", message.key);
        console.log("Decoded key", message.deserializedKey);
        console.log("Message value", message.value);
        console.log("Decoded message", message.deserializedValue);
        messageRcvd = true;
      },
    });
  
    while (!messageRcvd) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  
    await consumer.disconnect();
  }
  
  kafkaConsumerJson();
  