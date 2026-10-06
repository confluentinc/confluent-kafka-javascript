jest.setTimeout(10000);

const { EventEmitter } = require('events');
const { ErrorCodes } = require('../../../lib/kafkajs/_error');

/* Scripted outcomes consumed by each fake client, in construction order, and the
 * clients constructed so far. Reset before each test. */
let plan = [];
let created = [];

/**
 * Stand-in for the native-backed RdKafka.Producer / RdKafka.KafkaConsumer. It
 * follows the base Client's connect() contract (on success: mark connected, emit
 * 'ready', then call back; on failure: only call back with the error) and, like
 * the base Client, keeps its own 'disconnected' listener that clears the
 * connected flag.
 */
class FakeClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.name = `fake#${created.length}`;
        this.outcome = plan.shift() || { type: 'ready' };
        this.connectOptions = null;
        this.disconnectCalls = 0;
        this._isConnected = false;
        this.on('disconnected', () => { this._isConnected = false; });
        created.push(this);
    }

    connect(options, cb) {
        this.connectOptions = options;
        this.connectCb = cb;
        if (this.outcome.type === 'manual')
            return;
        setImmediate(() => {
            if (this.outcome.type === 'fail')
                this.fail(this.outcome.code, this.outcome.isFatal);
            else
                this.succeed();
        });
    }

    succeed() {
        this._isConnected = true;
        this.emit('ready', { name: this.name }, {});
        this.connectCb(null, {});
    }

    fail(code = ErrorCodes.ERR__TRANSPORT, isFatal = false) {
        this.connectCb(Object.assign(new Error(`fake failure ${code}`), { code, isFatal }));
    }

    isConnected() {
        return this._isConnected;
    }

    disconnect(timeout, cb) {
        if (typeof timeout === 'function')
            cb = timeout;
        this.disconnectCalls++;
        setImmediate(() => {
            this.emit('disconnected', {});
            if (cb)
                cb(null, {});
        });
    }

    /* Producer-only surface. */
    setPollInBackground() {}
    initTransactions(timeout, cb) {
        const code = this.outcome.initTransactionsError;
        setImmediate(() => cb(code ? Object.assign(new Error('fake init failure'), { code }) : null));
    }

    /* Consumer-only surface. */
    setDefaultIsTimeoutOnlyForFirstMessage() {}
    setDefaultConsumeTimeout() {}
    unsubscribe() {}
}

jest.mock('../../../lib/rdkafka', () => {
    const actual = jest.requireActual('../../../lib/rdkafka');
    return { ...actual, Producer: FakeClient, KafkaConsumer: FakeClient };
});

const { Kafka, logLevel } = require('../../../lib').KafkaJS;

function makeKafka(retry) {
    return new Kafka({ kafkaJS: { brokers: ['localhost:9092'], logLevel: logLevel.NOTHING, retry } });
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

/* Listeners the base client keeps for itself (the fake's own 'disconnected'
 * handler) versus those the wrapper adds; after teardown only the former remain,
 * plus a no-op 'error' sink. */
function assertDetached(client) {
    expect(client.listenerCount('ready')).toBe(0);
    expect(client.listenerCount('event.error')).toBe(0);
    expect(client.listenerCount('event.log')).toBe(0);
    expect(client.listenerCount('disconnected')).toBe(1);
    expect(client.listenerCount('error')).toBe(1);
}

beforeEach(() => {
    plan = [];
    created = [];
});

describe('Producer connect() retry lifecycle', () => {
    it('retries on a transient error with a fresh client and then connects', async () => {
        plan = [{ type: 'fail' }, { type: 'fail' }, { type: 'ready' }];
        const producer = makeKafka().producer();

        await producer.connect();

        expect(created).toHaveLength(3);
        assertDetached(created[0]);
        assertDetached(created[1]);
        /* Failed attempts never connected, so there is nothing to disconnect. */
        expect(created[0].disconnectCalls).toBe(0);
        expect(created[1].disconnectCalls).toBe(0);
        expect(producer._getInternalClient()).toBe(created[2]);
        await producer.disconnect();
    });

    it('bounds each attempt by the connection-setup timeout plus a margin', async () => {
        const producer = makeKafka().producer();
        await producer.connect();
        /* KafkaJS defaults: connectionTimeout 1000 + authenticationTimeout 10000. */
        expect(created[0].connectOptions).toEqual({ timeout: 12000 });
        await producer.disconnect();
    });

    it('gives up after retry.retries retries and rejects with the last error', async () => {
        plan = [{ type: 'fail' }, { type: 'fail' }, { type: 'fail' }];
        const producer = makeKafka({ retries: 2 }).producer();

        await expect(producer.connect()).rejects.toMatchObject({ code: ErrorCodes.ERR__TRANSPORT });
        expect(created).toHaveLength(3);
        created.forEach(assertDetached);
    });

    it('makes a single attempt when retry.retries is 0', async () => {
        plan = [{ type: 'fail' }];
        const producer = makeKafka({ retries: 0 }).producer();

        await expect(producer.connect()).rejects.toMatchObject({ code: ErrorCodes.ERR__TRANSPORT });
        expect(created).toHaveLength(1);
    });

    it('does not retry a terminal error', async () => {
        plan = [{ type: 'fail', code: ErrorCodes.ERR__AUTHENTICATION }];
        const producer = makeKafka().producer();

        await expect(producer.connect()).rejects.toMatchObject({ code: ErrorCodes.ERR__AUTHENTICATION });
        expect(created).toHaveLength(1);
    });

    it('does not retry an error flagged fatal, even with a transient code', async () => {
        plan = [{ type: 'fail', code: ErrorCodes.ERR__TRANSPORT, isFatal: true }];
        const producer = makeKafka().producer();

        await expect(producer.connect()).rejects.toBeDefined();
        expect(created).toHaveLength(1);
    });

    it('shares one in-flight attempt between concurrent connect() calls', async () => {
        plan = [{ type: 'fail' }, { type: 'ready' }];
        const producer = makeKafka().producer();

        await Promise.all([producer.connect(), producer.connect(), producer.connect()]);

        expect(created).toHaveLength(2);
        await producer.disconnect();
    });

    it('rejects a connect() made after a previous connect() settled', async () => {
        const producer = makeKafka().producer();
        await producer.connect();

        await expect(producer.connect()).rejects.toMatchObject({ code: ErrorCodes.ERR__STATE });
        await producer.disconnect();
    });

    it('stops retrying when disconnect() is called during a failing attempt', async () => {
        plan = [{ type: 'manual' }];
        const producer = makeKafka().producer();

        const connectPromise = producer.connect();
        await tick();
        const disconnectPromise = producer.disconnect();
        created[0].fail();

        await expect(connectPromise).rejects.toMatchObject({ code: ErrorCodes.ERR__STATE });
        await disconnectPromise;
        expect(created).toHaveLength(1);
    });

    it('tears down a client that becomes ready after disconnect() aborted it', async () => {
        plan = [{ type: 'manual' }];
        const producer = makeKafka().producer();

        const connectPromise = producer.connect();
        await tick();
        const disconnectPromise = producer.disconnect();
        created[0].succeed();

        await expect(connectPromise).rejects.toMatchObject({ code: ErrorCodes.ERR__STATE });
        await disconnectPromise;
        expect(created).toHaveLength(1);
        expect(created[0].disconnectCalls).toBe(1);
        /* The base client's own 'disconnected' listener survived teardown, so the
         * abandoned client no longer reports itself as connected. */
        expect(created[0].isConnected()).toBe(false);
        assertDetached(created[0]);
    });

    it('disconnects a client whose transaction init failed before retrying', async () => {
        plan = [{ type: 'ready', initTransactionsError: ErrorCodes.ERR__TIMED_OUT }, { type: 'ready' }];
        const producer = makeKafka().producer({ kafkaJS: { transactionalId: 'txn' } });

        await producer.connect();

        expect(created).toHaveLength(2);
        expect(created[0].disconnectCalls).toBe(1);
        expect(created[0].isConnected()).toBe(false);
        assertDetached(created[0]);
        await producer.disconnect();
    });
});

describe('Consumer connect() retry lifecycle', () => {
    function makeConsumer(retry) {
        return makeKafka(retry).consumer({ kafkaJS: { groupId: 'connect-retry-lifecycle' } });
    }

    it('retries on a transient error with a fresh client and then connects', async () => {
        plan = [{ type: 'fail' }, { type: 'ready' }];
        const consumer = makeConsumer();

        await consumer.connect();

        expect(created).toHaveLength(2);
        assertDetached(created[0]);
        await consumer.disconnect();
    });

    it('gives up after retry.retries retries', async () => {
        plan = [{ type: 'fail' }, { type: 'fail' }];
        const consumer = makeConsumer({ retries: 1 });

        await expect(consumer.connect()).rejects.toMatchObject({ code: ErrorCodes.ERR__TRANSPORT });
        expect(created).toHaveLength(2);
    });

    it('shares one in-flight attempt between concurrent connect() calls', async () => {
        const consumer = makeConsumer();

        await Promise.all([consumer.connect(), consumer.connect()]);

        expect(created).toHaveLength(1);
        await consumer.disconnect();
    });

    it('tears down a client that becomes ready after disconnect() aborted it', async () => {
        plan = [{ type: 'manual' }];
        const consumer = makeConsumer();

        const connectPromise = consumer.connect();
        await tick();
        const disconnectPromise = consumer.disconnect();
        created[0].succeed();

        await expect(connectPromise).rejects.toMatchObject({ code: ErrorCodes.ERR__STATE });
        await disconnectPromise;
        expect(created[0].disconnectCalls).toBe(1);
        expect(created[0].isConnected()).toBe(false);
        assertDetached(created[0]);
    });
});
