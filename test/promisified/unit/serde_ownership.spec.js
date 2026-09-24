jest.setTimeout(10000);

const { Buffer } = require('buffer');
const { Kafka, ErrorCodes } = require('../../../lib').KafkaJS;

/* No broker is needed: every case here fails before a connection is
 * attempted, and checks that serdes already built are released and that the
 * client is left in a state where connect() can be retried. */

const makeSerde = (closeImpl = async () => { }) => {
    const serde = {
        serialize: async (_topic, v) => Buffer.from(String(v)),
        deserialize: async (_topic, buffer) => buffer.toString(),
        close: jest.fn(closeImpl),
    };
    return serde;
};

const builderFor = (serde) => ({ build: jest.fn((config) => [serde, config]) });

const throwingBuilder = (message) => ({
    build: jest.fn(() => { throw new Error(message); }),
});

const kafka = new Kafka({ kafkaJS: { brokers: ['localhost:9092'] } });

describe('Producer > serde ownership', () => {
    it('closes the key serializer when the value builder throws and stays retryable', async () => {
        const keySerde = makeSerde();
        const valueBuilder = throwingBuilder('value builder failed');
        const producer = kafka.producer({
            'js.key.serializer.builder': builderFor(keySerde),
            'js.value.serializer.builder': valueBuilder,
        });

        await expect(producer.connect()).rejects.toThrow('value builder failed');
        expect(keySerde.close).toHaveBeenCalledTimes(1);

        /* Still in the initial state: disconnect is a no-op and connect reaches
         * the builders again, rather than failing with a state error. */
        await expect(producer.disconnect()).resolves.toBeUndefined();
        await expect(producer.connect()).rejects.toThrow('value builder failed');
        expect(valueBuilder.build).toHaveBeenCalledTimes(2);
    });

    it('closes both serializers when the internal client cannot be created', async () => {
        const keySerde = makeSerde();
        const valueSerde = makeSerde();
        const producer = kafka.producer({
            'not.a.property': 'x',
            'js.key.serializer.builder': builderFor(keySerde),
            'js.value.serializer.builder': builderFor(valueSerde),
        });

        await expect(producer.connect()).rejects.toThrow('No such configuration property');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);

        await expect(producer.disconnect()).resolves.toBeUndefined();
        await expect(producer.connect()).rejects.toThrow('No such configuration property');
    });

    it('reports the builder error even if closing the other serializer throws', async () => {
        const keySerde = makeSerde(async () => { throw new Error('close failed'); });
        const producer = kafka.producer({
            'js.key.serializer.builder': builderFor(keySerde),
            'js.value.serializer.builder': throwingBuilder('value builder failed'),
        });

        await expect(producer.connect()).rejects.toThrow('value builder failed');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
    });

    it('does not build or close serializers on disconnect() before connect()', async () => {
        const keyBuilder = builderFor(makeSerde());
        const producer = kafka.producer({ 'js.key.serializer.builder': keyBuilder });
        await producer.disconnect();
        expect(keyBuilder.build).not.toHaveBeenCalled();
    });

    it('keeps the builder error type', async () => {
        const producer = kafka.producer({
            'js.value.serializer.builder': {
                build: () => { throw new TypeError('bad config'); },
            },
        });
        await expect(producer.connect()).rejects.toBeInstanceOf(TypeError);
    });
});

describe('Consumer > serde ownership', () => {
    const groupConfig = { kafkaJS: { brokers: ['localhost:9092'], groupId: 'serde-ownership' } };
    const consumerKafka = new Kafka(groupConfig);

    it('closes the key deserializer when the value builder throws and stays retryable', async () => {
        const keySerde = makeSerde();
        const valueBuilder = throwingBuilder('value builder failed');
        const consumer = consumerKafka.consumer({
            'js.key.deserializer.builder': builderFor(keySerde),
            'js.value.deserializer.builder': valueBuilder,
        });

        await expect(consumer.connect()).rejects.toThrow('value builder failed');
        expect(keySerde.close).toHaveBeenCalledTimes(1);

        await expect(consumer.disconnect()).resolves.toBeUndefined();
        await expect(consumer.connect()).rejects.toThrow('value builder failed');
        expect(valueBuilder.build).toHaveBeenCalledTimes(2);
    });

    it('closes both deserializers when the internal client cannot be created', async () => {
        const keySerde = makeSerde();
        const valueSerde = makeSerde();
        const consumer = consumerKafka.consumer({
            'not.a.property': 'x',
            'js.key.deserializer.builder': builderFor(keySerde),
            'js.value.deserializer.builder': builderFor(valueSerde),
        });

        await expect(consumer.connect()).rejects.toThrow('No such configuration property');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        expect(valueSerde.close).toHaveBeenCalledTimes(1);

        await expect(consumer.disconnect()).resolves.toBeUndefined();
        await expect(consumer.connect()).rejects.toThrow('No such configuration property');
    });

    it('reports the builder error even if closing the other deserializer throws', async () => {
        const keySerde = makeSerde(async () => { throw new Error('close failed'); });
        const consumer = consumerKafka.consumer({
            'js.key.deserializer.builder': builderFor(keySerde),
            'js.value.deserializer.builder': throwingBuilder('value builder failed'),
        });

        await expect(consumer.connect()).rejects.toThrow('value builder failed');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
    });

    it('does not build or close deserializers on disconnect() before connect()', async () => {
        const keyBuilder = builderFor(makeSerde());
        const consumer = consumerKafka.consumer({ 'js.key.deserializer.builder': keyBuilder });
        await consumer.disconnect();
        expect(keyBuilder.build).not.toHaveBeenCalled();
    });
});

describe('Producer > send() argument checks', () => {
    it('rejects send() before connect() with a state error', async () => {
        const producer = kafka.producer({});
        await expect(producer.send({ topic: 't', messages: [] }))
            .rejects.toHaveProperty('code', ErrorCodes.ERR__STATE);
    });
});
