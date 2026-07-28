import { KafkaJS } from '@confluentinc/kafka-javascript';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { v4 } from 'uuid';
import { LifecyclePolicy, SchemaInfo, SchemaRegistryClient } from '../schemaregistry-client';
import { RestError } from '../rest-error';
import { clientConfig } from '../test/test-constants';
import { AvroSerializer, kafkaAvroDeserializerBuilder, kafkaAvroSerializerBuilder } from '../serde/avro';

/*
 * Integration of the promisified Kafka clients with a real Schema Registry:
 * the ASSOCIATED subject name strategy (the default of the Kafka serde
 * builders) looks the topic's association up under the id of the cluster the
 * client is connected to, which the client resolves lazily, on the first
 * subject lookup, through the resolver it hands the serde on connect.
 *
 * Requires a broker (KAFKA_HOST, default localhost:9092) and a Schema Registry
 * with the associations API (8.x or later) at the test-constants baseURL, as
 * started by test/docker/docker-compose-kraft.yml. The suite skips itself when
 * either is missing, so it is harmless under the other docker-compose files.
 */

interface User {
  name: string
  age: number
}

const userSchema: SchemaInfo = {
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

const kafkaHost = process.env['KAFKA_HOST'];
const brokers = kafkaHost ? kafkaHost.split(',') : ['localhost:9092'];
const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers } });

const associationsUnsupported = (err: unknown): boolean =>
  err instanceof RestError && [404, 405, 501].includes(err.status);

let schemaRegistryClient: SchemaRegistryClient;
let clusterId: string;
let skipReason: string | null = null;

/* Resources created by a test, released after it. */
let cleanup: Array<() => Promise<void>> = [];

const registerAssociation = async (topic: string, namespace: string, subject: string): Promise<void> => {
  await schemaRegistryClient.register(subject, userSchema);
  const resourceId = `${namespace}:${topic}`;
  await schemaRegistryClient.createAssociation({
    resourceName: topic,
    resourceNamespace: namespace,
    resourceId,
    resourceType: 'topic',
    associations: [{ subject, associationType: 'value', lifecycle: LifecyclePolicy.STRONG }],
  });
  cleanup.push(async () => {
    await schemaRegistryClient.deleteAssociations(resourceId, 'topic', ['value'], true).catch(() => { });
    await deleteSubject(subject);
  });
};

const deleteSubject = async (subject: string): Promise<void> => {
  try {
    await schemaRegistryClient.deleteSubject(subject);
    await schemaRegistryClient.deleteSubject(subject, true);
  } catch {
    /* Already gone, or never registered. */
  }
};

const makeProducer = (topic: string) => {
  const builder = kafkaAvroSerializerBuilder<User>()
    .setSchemaRegistryClient(schemaRegistryClient)
    .setAvroSerializerConfig({ autoRegisterSchemas: false, useLatestVersion: true });
  const producer = kafka.producer<string, User>({
    kafkaJS: { allowAutoTopicCreation: true, acks: 1 },
    'js.value.serializer.builder': builder,
  });
  cleanup.push(() => producer.disconnect());
  return producer;
};

const consumeOne = async (topic: string): Promise<KafkaJS.KafkaMessage<Buffer, User>> => {
  const consumer = kafka.consumer<Buffer, User>({
    kafkaJS: { groupId: `assoc-${v4()}`, fromBeginning: true },
    'js.value.deserializer.builder': kafkaAvroDeserializerBuilder<User>()
      .setSchemaRegistryClient(schemaRegistryClient),
  });
  cleanup.push(() => consumer.disconnect());
  await consumer.connect();
  await consumer.subscribe({ topic });

  let received: KafkaJS.KafkaMessage<Buffer, User> | null = null;
  await consumer.run({
    eachMessage: async ({ message }) => { received = message; },
  });
  const deadline = Date.now() + 30000;
  while (received === null && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (received === null) {
    throw new Error(`no message received on ${topic} within 30s`);
  }
  return received;
};

describe('Associated subject name strategy with the connected cluster id', () => {
  beforeAll(async () => {
    schemaRegistryClient = new SchemaRegistryClient(clientConfig);
    try {
      await schemaRegistryClient.getAllSubjects();
    } catch (err) {
      skipReason = `Schema Registry unreachable at ${clientConfig.baseURLs.join(',')}: ${(err as Error).message}`;
      return;
    }

    const admin = kafka.admin();
    try {
      await admin.connect();
      clusterId = await admin.clusterId();
    } catch (err) {
      skipReason = `Kafka broker unreachable at ${brokers.join(',')}: ${(err as Error).message}`;
      return;
    } finally {
      await admin.disconnect().catch(() => { });
    }

    try {
      await schemaRegistryClient.getAssociationsByResourceName(
        `probe-${v4()}`, clusterId, 'topic', ['value'], null, 0, -1);
    } catch (err) {
      if (associationsUnsupported(err)) {
        skipReason = `this Schema Registry does not support associations: ${(err as Error).message}`;
        return;
      }
      throw err;
    }
  }, 60000);

  afterEach(async () => {
    const pending = cleanup.reverse();
    cleanup = [];
    for (const release of pending) {
      await release().catch(() => { });
    }
  });

  afterAll(async () => {
    await schemaRegistryClient?.close();
  });

  const itUnlessSkipped = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (skipReason !== null) {
        console.warn(`skipping "${name}": ${skipReason}`);
        return;
      }
      await fn();
    }, 60000);
  };

  itUnlessSkipped('uses the association registered under the connected cluster id', async () => {
    const topic = `assoc-${v4()}`;
    const subject = `${topic}-subject`;
    await registerAssociation(topic, clusterId, subject);

    /* No cluster id configured anywhere: the producer resolves it. */
    const producer = makeProducer(topic);
    await producer.connect();
    await producer.send({ topic, messages: [{ key: 'u1', value: { name: 'Alice', age: 30 } }] });

    const subjects = await schemaRegistryClient.getAllSubjects();
    expect(subjects).toContain(subject);
    /* autoRegisterSchemas is off, so a wrong subject would have failed the
     * send; check the fallback subject was not created either way. */
    expect(subjects).not.toContain(`${topic}-value`);

    const message = await consumeOne(topic);
    expect(message.deserializedValue.error).toBeNull();
    expect(message.deserializedValue.value).toEqual({ name: 'Alice', age: 30 });
  });

  itUnlessSkipped('does not see an association registered under the wildcard namespace', async () => {
    const topic = `assoc-${v4()}`;
    const subject = `${topic}-subject`;
    await registerAssociation(topic, '-', subject);
    /* The fallback subject the strategy will pick instead. */
    await schemaRegistryClient.register(`${topic}-value`, userSchema);
    cleanup.push(() => deleteSubject(`${topic}-value`));

    const producer = makeProducer(topic);
    await producer.connect();
    await producer.send({ topic, messages: [{ key: 'u1', value: { name: 'Bob', age: 41 } }] });

    /* The connected client looks up under its real cluster id, not '-', so it
     * fell back to the topic name strategy. */
    const message = await consumeOne(topic);
    expect(message.deserializedValue.error).toBeNull();
    expect(message.deserializedValue.value).toEqual({ name: 'Bob', age: 41 });
  });

  itUnlessSkipped('resolves the cluster id lazily, on the first send only', async () => {
    const topic = `assoc-${v4()}`;
    const subject = `${topic}-subject`;
    await registerAssociation(topic, clusterId, subject);

    let serializer: AvroSerializer | null = null;
    let resolverCalls = 0;
    const builder = kafkaAvroSerializerBuilder<User>()
      .setSchemaRegistryClient(schemaRegistryClient)
      .setAvroSerializerConfig({ autoRegisterSchemas: false, useLatestVersion: true })
      .setSerializerInitializer((ser) => {
        serializer = ser;
        /* Count invocations of whatever resolver the producer hands over. */
        const original = ser.setClusterIdResolver.bind(ser);
        jest.spyOn(ser, 'setClusterIdResolver').mockImplementation((resolver) => {
          original(async () => { resolverCalls++; return resolver(); });
        });
      });
    const producer = kafka.producer<string, User>({
      kafkaJS: { allowAutoTopicCreation: true, acks: 1 },
      'js.value.serializer.builder': builder,
    });
    cleanup.push(() => producer.disconnect());

    await producer.connect();
    expect(serializer).not.toBeNull();
    expect(serializer!.setClusterIdResolver).toHaveBeenCalledTimes(1);
    /* Connecting handed the resolver over but did not need the id. */
    expect(resolverCalls).toBe(0);

    await producer.send({ topic, messages: [{ value: { name: 'Carol', age: 27 } }] });
    /* The first send needs the id (once per distinct subject lookup). */
    expect(resolverCalls).toBeGreaterThanOrEqual(1);
    const callsAfterFirstSend = resolverCalls;

    /* The subject lookups are cached: the next send does not resolve again. */
    await producer.send({ topic, messages: [{ value: { name: 'Dave', age: 52 } }] });
    expect(resolverCalls).toBe(callsAfterFirstSend);
  });
});
