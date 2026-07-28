jest.setTimeout(30000);

const { Buffer } = require('buffer');
const {
    secureRandom,
    createTopic,
    createProducer,
    createConsumer,
    waitForMessages,
} = require('../testhelpers');
const {
    ErrorCodes,
    KafkaJSError,
    SerializationError,
    KeySerializationError,
    ValueSerializationError,
} = require('../../../lib').KafkaJS;

/* A serializer that records what it is handed by the producer: the cluster id
 * resolver on connect, and close on disconnect. It fails on a specific input so
 * that serialization errors can be provoked on demand. */
const makeSerde = (prefix, { poison = null, closeImpl = async () => { } } = {}) => {
    const serde = {
        resolvers: [],
        serialize: jest.fn(async (_topic, msg) => {
            if (msg === poison) {
                throw new Error(`cannot serialize ${JSON.stringify(msg)}`);
            }
            return Buffer.from(`${prefix}${msg}`);
        }),
        setClusterIdResolver: jest.fn((resolver) => { serde.resolvers.push(resolver); }),
        close: jest.fn(closeImpl),
    };
    return serde;
};

const builderFor = (serde) => ({ build: jest.fn(() => serde) });

describe('Producer > serializers', () => {
    let producer, consumer, topicName, keySerde, valueSerde, keyBuilder, valueBuilder;

    beforeEach(async () => {
        topicName = `test-topic-${secureRandom()}`;
        await createTopic({ topic: topicName });
        keySerde = makeSerde('key:', { poison: 'badkey' });
        valueSerde = makeSerde('value:', { poison: 'badvalue' });
        keyBuilder = builderFor(keySerde);
        valueBuilder = builderFor(valueSerde);
        producer = createProducer({}, {
            'js.key.serializer.builder': keyBuilder,
            'js.value.serializer.builder': valueBuilder,
        });
    });

    afterEach(async () => {
        producer && (await producer.disconnect());
        consumer && (await consumer.disconnect());
        consumer = null;
    });

    it('builds each serializer once, with the resolved config and its side', async () => {
        await producer.connect();

        expect(keyBuilder.build).toHaveBeenCalledTimes(1);
        expect(valueBuilder.build).toHaveBeenCalledTimes(1);

        const [keyConfig, keyIsKey] = keyBuilder.build.mock.calls[0];
        const [valueConfig, valueIsKey] = valueBuilder.build.mock.calls[0];
        expect(keyIsKey).toBe(true);
        expect(valueIsKey).toBe(false);
        /* The builder sees the librdkafka config the producer is created with.
         * (Array paths: jest would otherwise read the dots as nesting.) */
        expect(keyConfig).toHaveProperty(['bootstrap.servers']);
        expect(valueConfig).toHaveProperty(['bootstrap.servers']);
        /* The builder keys themselves are consumed by the producer. */
        expect(keyConfig).not.toHaveProperty(['js.key.serializer.builder']);
        expect(keyConfig).not.toHaveProperty(['js.value.serializer.builder']);
    });

    it('hands both serializers a cluster id resolver on connect, without invoking it', async () => {
        await producer.connect();

        expect(keySerde.setClusterIdResolver).toHaveBeenCalledTimes(1);
        expect(valueSerde.setClusterIdResolver).toHaveBeenCalledTimes(1);
        expect(keySerde.resolvers).toHaveLength(1);

        /* Lazy: nothing has asked for the cluster id yet, so connect() did not
         * wait on it. Invoking it returns what the producer reports. */
        const clusterId = await producer.clusterId();
        await expect(keySerde.resolvers[0]()).resolves.toBe(clusterId);
        await expect(valueSerde.resolvers[0]()).resolves.toBe(clusterId);
    });

    it('closes both serializers once on disconnect', async () => {
        await producer.connect();
        await producer.disconnect();

        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);

        /* A second disconnect is a no-op. */
        await producer.disconnect();
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);
        producer = null;
    });

    it('closes the other serializer and rethrows the first error when a close fails', async () => {
        keySerde = makeSerde('key:', { closeImpl: async () => { throw new Error('key close failed'); } });
        valueSerde = makeSerde('value:');
        producer = createProducer({}, {
            'js.key.serializer.builder': builderFor(keySerde),
            'js.value.serializer.builder': builderFor(valueSerde),
        });
        await producer.connect();

        await expect(producer.disconnect()).rejects.toThrow('key close failed');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);
        producer = null;
    });

    it('serializes keys and values through the configured serializers', async () => {
        await producer.connect();
        await producer.send({
            topic: topicName,
            messages: [{ key: 'k0', value: 'v0' }, { value: 'v1' }],
        });

        expect(keySerde.serialize).toHaveBeenCalledTimes(1);
        expect(keySerde.serialize).toHaveBeenCalledWith(topicName, 'k0', undefined);
        expect(valueSerde.serialize).toHaveBeenCalledTimes(2);

        consumer = createConsumer({ groupId: `group-${secureRandom()}`, fromBeginning: true });
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });
        const consumed = [];
        await consumer.run({ eachMessage: async ({ message }) => { consumed.push(message); } });
        await waitForMessages(consumed, { number: 2 });

        expect(consumed[0].key.toString()).toBe('key:k0');
        expect(consumed[0].value.toString()).toBe('value:v0');
        expect(consumed[1].key).toBeNull();
        expect(consumed[1].value.toString()).toBe('value:v1');
    });

    it('wraps a key serializer failure in a KeySerializationError', async () => {
        await producer.connect();
        let thrown = null;
        try {
            await producer.send({ topic: topicName, messages: [{ key: 'badkey', value: 'v' }] });
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(KeySerializationError);
        expect(thrown).toBeInstanceOf(SerializationError);
        expect(thrown).toBeInstanceOf(KafkaJSError);
        expect(thrown.code).toBe(ErrorCodes.ERR__KEY_SERIALIZATION);
        expect(thrown.cause).toBeInstanceOf(Error);
        expect(thrown.message).toBe('cannot serialize "badkey"');
        /* The key failed first: the value serializer was never reached. */
        expect(valueSerde.serialize).not.toHaveBeenCalled();
    });

    it('wraps a value serializer failure in a ValueSerializationError', async () => {
        await producer.connect();
        let thrown = null;
        try {
            await producer.send({ topic: topicName, messages: [{ key: 'k', value: 'badvalue' }] });
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(ValueSerializationError);
        expect(thrown).toBeInstanceOf(SerializationError);
        expect(thrown).not.toBeInstanceOf(KeySerializationError);
        expect(thrown.code).toBe(ErrorCodes.ERR__VALUE_SERIALIZATION);
        expect(thrown.cause.message).toBe('cannot serialize "badvalue"');
    });

    it.each([
        ['missing', undefined],
        ['empty', ''],
        ['not a string', 42],
    ])('rejects a %s topic before serializing anything', async (_name, topic) => {
        await producer.connect();
        await expect(producer.send({ topic, messages: [{ key: 'k', value: 'v' }] }))
            .rejects.toHaveProperty('code', ErrorCodes.ERR__INVALID_ARG);
        expect(keySerde.serialize).not.toHaveBeenCalled();
        expect(valueSerde.serialize).not.toHaveBeenCalled();
    });

    it('rejects missing messages with an invalid argument error', async () => {
        await producer.connect();
        await expect(producer.send({ topic: topicName }))
            .rejects.toHaveProperty('code', ErrorCodes.ERR__INVALID_ARG);
        await expect(producer.send({ topic: topicName, messages: { key: 'k' } }))
            .rejects.toHaveProperty('code', ErrorCodes.ERR__INVALID_ARG);
    });
});
