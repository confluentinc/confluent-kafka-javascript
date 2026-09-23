jest.setTimeout(10000);

const { Buffer } = require('buffer');
const { Kafka, ErrorCodes, KafkaJSError } = require('../../../lib').KafkaJS;
const {
    buildSerdes,
    validateSerdeBuildResult,
    intersectSerdeLeftovers,
} = require('../../../lib/kafkajs/_common');

/* No broker is needed: these cases check what the builders are handed and
 * what the client is created with, before any connection is attempted. */

const makeSerde = () => ({
    serialize: async (_topic, v) => Buffer.from(String(v)),
    deserialize: async (_topic, buffer) => buffer.toString(),
    close: jest.fn(async () => { }),
});

/* A builder consuming the given properties and recording the configuration it saw. */
const consumingBuilder = (serde, ...props) => {
    const builder = {
        seen: null,
        build: jest.fn((config) => {
            builder.seen = { ...config };
            const remaining = Object.fromEntries(
                Object.entries(config).filter(([k]) => !props.includes(k)));
            return [serde, remaining];
        }),
    };
    return builder;
};

const kafka = new Kafka({ kafkaJS: { brokers: ['localhost:9092'] } });
const consumerKafka = new Kafka({ kafkaJS: { brokers: ['localhost:9092'], groupId: 'serde-builders' } });

describe('buildSerdes', () => {
    const config = {
        'bootstrap.servers': 'b',
        'shared.prop': 'both',
        'key.only.prop': 'k',
        'value.only.prop': 'v',
    };

    it('returns the configuration as is with no builder', () => {
        const built = buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: null, isKey: true },
            { prop: 'js.value.serializer.builder', builder: undefined, isKey: false },
        ]);
        expect(built.serdes).toEqual([null, null]);
        expect(built.config).toBe(config);
    });

    it('hands every builder its own copy of the full configuration', () => {
        const keyBuilder = consumingBuilder(makeSerde(), 'shared.prop', 'key.only.prop');
        const valueBuilder = consumingBuilder(makeSerde(), 'shared.prop', 'value.only.prop');
        buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: keyBuilder, isKey: true },
            { prop: 'js.value.serializer.builder', builder: valueBuilder, isKey: false },
        ]);

        expect(keyBuilder.seen).toEqual(config);
        expect(valueBuilder.seen).toEqual(config);
        expect(keyBuilder.build).toHaveBeenCalledWith(config, true);
        expect(valueBuilder.build).toHaveBeenCalledWith(config, false);
        const [keyConfig] = keyBuilder.build.mock.calls[0];
        const [valueConfig] = valueBuilder.build.mock.calls[0];
        expect(keyConfig).not.toBe(config);
        expect(valueConfig).not.toBe(config);
        expect(keyConfig).not.toBe(valueConfig);
    });

    it('creates the client configuration from the intersection of the leftovers', () => {
        const keySerde = makeSerde();
        const valueSerde = makeSerde();
        const built = buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: consumingBuilder(keySerde, 'shared.prop', 'key.only.prop'), isKey: true },
            { prop: 'js.value.serializer.builder', builder: consumingBuilder(valueSerde, 'shared.prop', 'value.only.prop'), isKey: false },
        ]);

        expect(built.serdes).toEqual([keySerde, valueSerde]);
        expect(built.config).toEqual({ 'bootstrap.servers': 'b' });
    });

    it('keeps a property only one builder was configured for if that builder leaves it', () => {
        const built = buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: null, isKey: true },
            { prop: 'js.value.serializer.builder', builder: consumingBuilder(makeSerde(), 'value.only.prop'), isKey: false },
        ]);
        expect(built.config).toEqual({ 'bootstrap.servers': 'b', 'shared.prop': 'both', 'key.only.prop': 'k' });
    });

    it('does not let a builder mutating its copy affect the others', () => {
        const mutating = {
            build: jest.fn((cfg) => {
                cfg['not.a.kafka.prop'] = true;
                return [makeSerde(), cfg];
            }),
        };
        const recording = consumingBuilder(makeSerde());
        const built = buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: mutating, isKey: true },
            { prop: 'js.value.serializer.builder', builder: recording, isKey: false },
        ]);
        expect(recording.seen).toEqual(config);
        /* Only in one leftover: filtered out of the client configuration. */
        expect(built.config).toEqual(config);
        expect(config).not.toHaveProperty(['not.a.kafka.prop']);
    });

    it('closes the serdes built so far when a later builder throws', () => {
        const keySerde = makeSerde();
        const keyBuilder = consumingBuilder(keySerde);
        expect(() => buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: keyBuilder, isKey: true },
            { prop: 'js.value.serializer.builder', builder: { build: () => { throw new Error('boom'); } }, isKey: false },
        ])).toThrow('boom');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['a bare serde', () => makeSerde(), 'must return a [serde, configuration] pair from build(), got an instance of Object'],
        ['undefined', () => undefined, 'must return a [serde, configuration] pair from build(), got undefined'],
        ['a longer array', () => [makeSerde(), {}, 1], 'must return a [serde, configuration] pair from build(), got an array of length 3'],
        ['a null configuration', () => [makeSerde(), null], 'returned null as the leftover configuration from build(), expected an object'],
        ['a string configuration', () => [makeSerde(), 'x'], 'returned string as the leftover configuration from build(), expected an object'],
        ['an array configuration', () => [makeSerde(), []], 'returned an array of length 0 as the leftover configuration from build(), expected an object'],
    ])('rejects a builder returning %s, naming the property', (_name, result, message) => {
        let thrown = null;
        try {
            validateSerdeBuildResult('js.value.serializer.builder', result());
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(KafkaJSError);
        expect(thrown.code).toBe(ErrorCodes.ERR__INVALID_ARG);
        expect(thrown.message).toBe(`js.value.serializer.builder ${message}`);
    });

    it('closes the serdes built so far when a later builder returns a bad result', () => {
        const keySerde = makeSerde();
        expect(() => buildSerdes(config, [
            { prop: 'js.key.serializer.builder', builder: consumingBuilder(keySerde), isKey: true },
            { prop: 'js.value.serializer.builder', builder: { build: () => makeSerde() }, isKey: false },
        ])).toThrow('js.value.serializer.builder must return a [serde, configuration] pair');
        expect(keySerde.close).toHaveBeenCalledTimes(1);
    });
});

describe('intersectSerdeLeftovers', () => {
    it('keeps the values of the last leftover', () => {
        expect(intersectSerdeLeftovers({ a: 0 }, [{ a: 1, b: 2 }, { a: 3, c: 4 }])).toEqual({ a: 3 });
    });

    it('is the configuration itself with no leftovers', () => {
        const config = { a: 1 };
        expect(intersectSerdeLeftovers(config, [])).toBe(config);
    });

    it('is the single leftover with one builder', () => {
        expect(intersectSerdeLeftovers({ a: 1, b: 2 }, [{ a: 1 }])).toEqual({ a: 1 });
    });
});

describe('Producer > serde builders', () => {
    it('creates the producer with what the builders left over', async () => {
        /* 'not.a.property' is not a librdkafka property: the producer would
         * fail to construct if the leftover configuration were not the one
         * used. Here it is left in place, so it reaches librdkafka. */
        const producer = kafka.producer({
            'not.a.property': 'x',
            'js.value.serializer.builder': consumingBuilder(makeSerde()),
        });
        await expect(producer.connect()).rejects.toThrow('No such configuration property: "not.a.property"');
    });

    it.each([
        ['a bare serde', () => makeSerde(), 'js.value.serializer.builder must return a [serde, configuration] pair from build()'],
        ['a non-object configuration', () => [makeSerde(), 42], 'js.value.serializer.builder returned number as the leftover configuration from build(), expected an object'],
    ])('rejects a value builder returning %s and stays retryable', async (_name, result, message) => {
        const keySerde = makeSerde();
        const producer = kafka.producer({
            'js.key.serializer.builder': consumingBuilder(keySerde),
            'js.value.serializer.builder': { build: result },
        });
        let thrown = null;
        try {
            await producer.connect();
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(KafkaJSError);
        expect(thrown.code).toBe(ErrorCodes.ERR__INVALID_ARG);
        expect(thrown.message).toContain(message);
        /* The key serializer built before it was released. */
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        await expect(producer.connect()).rejects.toThrow(message);
    });

    it('names the key property when the key builder is at fault', async () => {
        const producer = kafka.producer({
            'js.key.serializer.builder': { build: () => makeSerde() },
        });
        await expect(producer.connect()).rejects.toThrow(
            'js.key.serializer.builder must return a [serde, configuration] pair from build()');
    });
});

describe('Consumer > serde builders', () => {
    it('creates the consumer with what the builders left over', async () => {
        const consumer = consumerKafka.consumer({
            'not.a.property': 'x',
            'js.value.deserializer.builder': consumingBuilder(makeSerde()),
        });
        await expect(consumer.connect()).rejects.toThrow('No such configuration property: "not.a.property"');
    });

    it.each([
        ['a bare serde', () => makeSerde(), 'js.value.deserializer.builder must return a [serde, configuration] pair from build()'],
        ['a non-object configuration', () => [makeSerde(), 42], 'js.value.deserializer.builder returned number as the leftover configuration from build(), expected an object'],
    ])('rejects a value builder returning %s and stays retryable', async (_name, result, message) => {
        const keySerde = makeSerde();
        const consumer = consumerKafka.consumer({
            'js.key.deserializer.builder': consumingBuilder(keySerde),
            'js.value.deserializer.builder': { build: result },
        });
        let thrown = null;
        try {
            await consumer.connect();
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(KafkaJSError);
        expect(thrown.code).toBe(ErrorCodes.ERR__INVALID_ARG);
        expect(thrown.message).toContain(message);
        expect(keySerde.close).toHaveBeenCalledTimes(1);
        await expect(consumer.connect()).rejects.toThrow(message);
    });

    it('names the key property when the key builder is at fault', async () => {
        const consumer = consumerKafka.consumer({
            'js.key.deserializer.builder': { build: () => makeSerde() },
        });
        await expect(consumer.connect()).rejects.toThrow(
            'js.key.deserializer.builder must return a [serde, configuration] pair from build()');
    });
});
