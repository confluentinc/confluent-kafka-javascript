jest.setTimeout(10000);

const { EventEmitter } = require('events');

/* Headers handed to produce(), in call order. */
let mockProduced = [];

/**
 * Stand-in for the native-backed RdKafka.Producer: connects immediately and
 * reports every mockProduced message as delivered. No broker is needed.
 */
class MockProducer extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.name = 'fake-producer';
        this._isConnected = false;
    }

    connect(options, cb) {
        setImmediate(() => {
            this._isConnected = true;
            this.emit('ready', { name: this.name }, {});
            cb(null, {});
        });
    }

    isConnected() { return this._isConnected; }

    disconnect(timeout, cb) {
        if (typeof timeout === 'function')
            cb = timeout;
        setImmediate(() => {
            this._isConnected = false;
            this.emit('disconnected', {});
            if (cb)
                cb(null, {});
        });
    }

    setPollInBackground() { }

    produce(topic, partition, value, key, timestamp, opaque, headers) {
        mockProduced.push(headers);
        opaque.resolve({ topicName: topic, partition: 0, baseOffset: String(mockProduced.length) });
    }
}

jest.mock('../../../lib/rdkafka', () => {
    const actual = jest.requireActual('../../../lib/rdkafka');
    return { ...actual, Producer: MockProducer };
});

const { Kafka, logLevel } = require('../../../lib').KafkaJS;

describe('Producer > send() does not mutate the message headers', () => {
    beforeEach(() => { mockProduced = []; });

    it('sends the same headers when the same record is sent twice', async () => {
        const producer = new Kafka({ kafkaJS: { brokers: ['localhost:9092'], logLevel: logLevel.NOTHING } }).producer();
        await producer.connect();

        const headers = { traceparent: 'original-trace', tags: ['a', 'b'] };
        const record = { topic: 'events', messages: [{ value: 'event', headers }] };

        await producer.send(record);
        await producer.send(record);

        const expected = [{ traceparent: 'original-trace' }, { tags: 'a' }, { tags: 'b' }];
        expect(mockProduced).toEqual([expected, expected]);
        expect(record.messages[0].headers).toBe(headers);
        expect(headers).toEqual({ traceparent: 'original-trace', tags: ['a', 'b'] });

        await producer.disconnect();
    });
});
