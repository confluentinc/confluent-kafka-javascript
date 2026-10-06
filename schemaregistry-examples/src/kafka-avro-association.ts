import {
  ClientConfig,
  LifecyclePolicy,
  SchemaInfo,
  SchemaRegistryClient,
  kafkaAvroDeserializerBuilder,
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

/*
 * Topic-to-subject associations with the ASSOCIATED subject name strategy,
 * which is the default of the Kafka serde builders.
 *
 * An association binds a topic, within a Kafka cluster, to a subject whose
 * name does not need to follow the `<topic>-value` convention. The strategy
 * looks the association up under the id of the cluster the client is connected
 * to. Neither the producer nor the consumer is told that id: the client
 * resolves it lazily, on the first message, from the broker it is connected to.
 * Should the id need to be supplied explicitly (for instance to serialize
 * before connecting), set `subject.name.strategy.kafka.cluster.id` in the
 * serde's `subjectNameStrategyConfig`.
 *
 * Associations require Schema Registry 8.x or later.
 */

class User {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
}

async function kafkaAvroAssociation() {

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

  /* One Schema Registry client, shared by the application, the producer's
   * serializer and the consumer's deserializer. Being supplied rather than
   * created by the builders, it is not closed when the Kafka clients disconnect. */
  const schemaRegistryClient = new SchemaRegistryClient(clientConfig);

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

  const userTopic = 'example-association-topic';
  const userSubject = 'example-association-user';

  /* The association is registered under the id of the cluster the topic
   * lives in, which the admin client reports. */
  const admin = kafka.admin();
  await admin.connect();
  const clusterId = await admin.clusterId();
  await admin.disconnect();
  console.log(`Kafka cluster id: ${clusterId}`);

  const schemaInfo: SchemaInfo = {
    schemaType: 'AVRO',
    schema: JSON.stringify({
      type: 'record',
      name: 'User',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'int' },
      ],
    }),
  };
  await schemaRegistryClient.register(userSubject, schemaInfo);

  const resourceId = `${clusterId}:${userTopic}`;
  await schemaRegistryClient.createAssociation({
    resourceName: userTopic,
    resourceNamespace: clusterId,
    resourceId,
    resourceType: 'topic',
    associations: [{ subject: userSubject, associationType: 'value', lifecycle: LifecyclePolicy.STRONG }],
  });
  console.log(`Associated topic ${userTopic} with subject ${userSubject}`);

  /* No cluster id is configured on the serializer: the producer resolves it
   * on the first send and the strategy picks the associated subject. With
   * autoRegisterSchemas off, a lookup under the wrong subject would fail
   * rather than register `${userTopic}-value`. */
  const producer: KafkaJS.Producer<string, User> = kafka.producer<string, User>({
    kafkaJS: {
      allowAutoTopicCreation: true,
      acks: 1,
    },
    'js.value.serializer.builder': kafkaAvroSerializerBuilder<User>()
      .setSchemaRegistryClient(schemaRegistryClient)
      .setAvroSerializerConfig({ autoRegisterSchemas: false, useLatestVersion: true })
  });

  await producer.connect();
  await producer.send({
    topic: userTopic,
    messages: [{ key: "1", value: new User('Alice N Bob', 30) }]
  });
  await producer.disconnect();

  const subjects = await schemaRegistryClient.getAllSubjects();
  console.log(`Subject used: ${userSubject} (registered: ${subjects.includes(userSubject)}); ` +
    `fallback ${userTopic}-value registered: ${subjects.includes(`${userTopic}-value`)}`);

  const consumer: KafkaJS.Consumer<string, User> = kafka.consumer<string, User>({
    kafkaJS: {
      groupId: 'example-association-group',
      fromBeginning: true,
    },
    'js.value.deserializer.builder': kafkaAvroDeserializerBuilder<User>()
      .setSchemaRegistryClient(schemaRegistryClient)
  });

  await consumer.connect();
  await consumer.subscribe({ topic: userTopic });

  let messageRcvd = false;
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (message.deserializedValue.error) {
        console.error("Could not decode value", message.deserializedValue.error);
      } else {
        console.log("Decoded value", message.deserializedValue.value);
      }
      messageRcvd = true;
    },
  });

  while (!messageRcvd) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await consumer.disconnect();

  /* Clean up: the association first, then the subject it points at. */
  await schemaRegistryClient.deleteAssociations(resourceId, 'topic', ['value'], true);
  await schemaRegistryClient.deleteSubject(userSubject);
  await schemaRegistryClient.deleteSubject(userSubject, true);
  await schemaRegistryClient.close();
}

kafkaAvroAssociation();
