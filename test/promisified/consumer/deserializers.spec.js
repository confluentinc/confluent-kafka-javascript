jest.setTimeout(30000);

const {
    secureRandom,
    createTopic,
    createProducer,
    createConsumer,
    waitForMessages,
} = require('../testhelpers');
const {
    ErrorCodes,
    KeyDeserializationError,
    ValueDeserializationError,
} = require('../../../lib').KafkaJS;

/* Deserializers that fail on a specific payload, so that a single topic can hold
 * both messages that deserialize and messages that don't. They also record
 * what the consumer hands them: the cluster id resolver on connect, and close
 * on disconnect. */
const failingOn = (poison, transform) => {
    const serde = {
        resolvers: [],
        async deserialize(topic, buffer) {
            const s = buffer.toString();
            if (s === poison) {
                throw new Error(`cannot deserialize ${JSON.stringify(s)}`);
            }
            return transform(s);
        },
        setClusterIdResolver: jest.fn((resolver) => { serde.resolvers.push(resolver); }),
        close: jest.fn(async () => { }),
    };
    return serde;
};

describe('Consumer > deserializers', () => {
    let producer, consumer, topicName;

    beforeEach(async () => {
        topicName = `test-topic-${secureRandom()}`;
        await createTopic({ topic: topicName });
        producer = createProducer({});
    });

    afterEach(async () => {
        producer && (await producer.disconnect());
        consumer && (await consumer.disconnect());
    });

    let keySerde, valueSerde;
    const makeConsumer = () => {
        keySerde = failingOn('badkey', (s) => `key:${s}`);
        valueSerde = failingOn('badvalue', (s) => `value:${s}`);
        return createConsumer({
            groupId: `group-${secureRandom()}`,
            fromBeginning: true,
        }, {
            'js.key.deserializer.builder': { build: (config) => [keySerde, config] },
            'js.value.deserializer.builder': { build: (config) => [valueSerde, config] },
        });
    };

    it('shares a single cluster id call among concurrent resolver invocations', async () => {
        consumer = makeConsumer();
        await consumer.connect();
        const clusterIdSpy = jest.spyOn(consumer, 'clusterId');

        const results = await Promise.all([
            keySerde.resolvers[0](), valueSerde.resolvers[0](),
            keySerde.resolvers[0](), valueSerde.resolvers[0](),
        ]);
        expect(clusterIdSpy).toHaveBeenCalledTimes(1);
        expect(clusterIdSpy).toHaveBeenCalledWith({ timeout: 60000 });
        expect(new Set(results).size).toBe(1);
        expect(results[0]).toBe(await consumer.clusterId());

        /* The resolver does not cache the outcome; librdkafka does. */
        clusterIdSpy.mockClear();
        await expect(valueSerde.resolvers[0]()).resolves.toBe(results[0]);
        expect(clusterIdSpy).toHaveBeenCalledTimes(1);
        clusterIdSpy.mockRestore();
    });

    it('hands both deserializers a cluster id resolver on connect, without invoking it', async () => {
        consumer = makeConsumer();
        await consumer.connect();

        expect(keySerde.setClusterIdResolver).toHaveBeenCalledTimes(1);
        expect(valueSerde.setClusterIdResolver).toHaveBeenCalledTimes(1);

        /* Lazy: invoking the resolver is up to the deserializer, and it returns
         * what the consumer reports. */
        const clusterId = await consumer.clusterId();
        await expect(keySerde.resolvers[0]()).resolves.toBe(clusterId);
        await expect(valueSerde.resolvers[0]()).resolves.toBe(clusterId);
    });

    it('closes both deserializers once on disconnect', async () => {
        consumer = makeConsumer();
        await consumer.connect();
        await consumer.disconnect();

        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);

        /* A second disconnect is a no-op. */
        await consumer.disconnect();
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);
        consumer = null;
    });

    const messages = [
        { key: 'k0', value: 'v0' },             /* both succeed */
        { key: 'k1', value: 'badvalue' },       /* value fails */
        { key: 'badkey', value: 'v2' },         /* key fails */
        { key: 'badkey', value: 'badvalue' },   /* both fail */
        { key: 'k4', value: 'v4' },             /* both succeed */
    ];

    const expectDeserialized = (consumed) => {
        expect(consumed).toHaveLength(5);

        /* Successful messages carry the deserialized form and no error. */
        expect(consumed[0].deserializedKey).toEqual({ key: 'key:k0', error: null });
        expect(consumed[0].deserializedValue).toEqual({ value: 'value:v0', error: null });
        expect(consumed[4].deserializedKey).toEqual({ key: 'key:k4', error: null });
        expect(consumed[4].deserializedValue).toEqual({ value: 'value:v4', error: null });

        /* A failing value does not affect the key, and vice versa. Each field can
         * only ever hold the error type belonging to its own side. */
        expect(consumed[1].deserializedKey).toEqual({ key: 'key:k1', error: null });
        expect(consumed[1].deserializedValue.value).toBeNull();
        expect(consumed[1].deserializedValue.error).toBeInstanceOf(ValueDeserializationError);
        expect(consumed[1].deserializedValue.error).toHaveProperty('code', ErrorCodes.ERR__VALUE_DESERIALIZATION);

        expect(consumed[2].deserializedKey.key).toBeNull();
        expect(consumed[2].deserializedKey.error).toBeInstanceOf(KeyDeserializationError);
        expect(consumed[2].deserializedKey.error).toHaveProperty('code', ErrorCodes.ERR__KEY_DESERIALIZATION);
        expect(consumed[2].deserializedValue).toEqual({ value: 'value:v2', error: null });

        /* Both deserializers are attempted, so both errors are reported. */
        expect(consumed[3].deserializedKey.error).toBeInstanceOf(KeyDeserializationError);
        expect(consumed[3].deserializedValue.error).toBeInstanceOf(ValueDeserializationError);

        /* The error thrown by the deserializer is not lost. */
        expect(consumed[3].deserializedValue.error.cause).toBeInstanceOf(Error);
        expect(consumed[3].deserializedValue.error.message).toBe('cannot deserialize "badvalue"');

        /* The raw bytes stay available regardless. */
        expect(consumed[3].key.toString()).toBe('badkey');
        expect(consumed[3].value.toString()).toBe('badvalue');
    };

    /* A deserializer that throws must not stop the partition: every message,
     * including the ones after the failure, has to be delivered. */
    it('reports deserialization errors on the message in eachMessage', async () => {
        await producer.connect();
        await producer.send({ topic: topicName, messages });

        consumer = makeConsumer();
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });

        const consumed = [];
        await consumer.run({
            eachMessage: async ({ message }) => { consumed.push(message); },
        });
        await waitForMessages(consumed, { number: 5 });

        expectDeserialized(consumed);
    });

    it('reports deserialization errors on the message in eachBatch', async () => {
        await producer.connect();
        await producer.send({ topic: topicName, messages });

        consumer = makeConsumer();
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });

        const consumed = [];
        await consumer.run({
            eachBatch: async ({ batch }) => { consumed.push(...batch.messages); },
        });
        await waitForMessages(consumed, { number: 5 });

        expectDeserialized(consumed);
    });

    it('leaves the fields empty when no deserializer is configured', async () => {
        await producer.connect();
        await producer.send({ topic: topicName, messages: [{ key: 'k', value: 'v' }] });

        consumer = createConsumer({ groupId: `group-${secureRandom()}`, fromBeginning: true });
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });

        const consumed = [];
        await consumer.run({
            eachMessage: async ({ message }) => { consumed.push(message); },
        });
        await waitForMessages(consumed, { number: 1 });

        expect(consumed[0].deserializedKey).toEqual({ key: null, error: null });
        expect(consumed[0].deserializedValue).toEqual({ value: null, error: null });
        expect(consumed[0].key.toString()).toBe('k');
        expect(consumed[0].value.toString()).toBe('v');
    });
});
