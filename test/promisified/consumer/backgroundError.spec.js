jest.setTimeout(60000);

const {
    secureRandom,
    createTopic,
    createConsumer,
    createProducer,
    waitFor,
    waitForMessages,
    sleep,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Consumer > onBackgroundError', () => {
    let topicName, groupId, consumer, producer;

    const consumerConfig = () => ({
        groupId,
        maxWaitTimeInMs: 100,
        fromBeginning: true,
    });

    beforeEach(async () => {
        topicName = `test-topic-${secureRandom()}`;
        groupId = `consumer-group-id-${secureRandom()}`;
        await createTopic({ topic: topicName });
        consumer = createConsumer(consumerConfig());
        producer = createProducer({});
        await producer.connect();
    });

    afterEach(async () => {
        consumer && (await consumer.disconnect());
        producer && (await producer.disconnect());
    });

    it('passes errors from the error event to the listeners', async () => {
        await consumer.connect();
        const received = [];
        consumer.onBackgroundError(err => received.push(err));

        consumer._getInternalClient().emit('event.error', {
            code: ErrorCodes.ERR__TRANSPORT,
            message: 'Local: Broker transport failure',
            isFatal: false,
        });

        await waitFor(() => received.length > 0, () => null);
        expect(received[0]).toMatchObject({ code: ErrorCodes.ERR__TRANSPORT, fatal: false });
    });

    it('passes errors from fetching to the listeners and keeps consuming', async () => {
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });
        const received = [];
        consumer.onBackgroundError(err => received.push(err));

        const internalClient = consumer._getInternalClient();
        const consume = internalClient.consume.bind(internalClient);
        internalClient.consume = (size, cb) => {
            internalClient.consume = consume;
            cb({ code: ErrorCodes.ERR__STATE, message: 'Local: Erroneous state' });
        };

        const messagesConsumed = [];
        consumer.run({ eachMessage: async event => messagesConsumed.push(event) });

        await waitFor(() => received.length > 0, () => null);
        expect(received[0]).toMatchObject({ code: ErrorCodes.ERR__STATE, fatal: false });

        await producer.send({ topic: topicName, messages: [{ value: 'after-error' }] });
        await waitForMessages(messagesConsumed, { number: 1 });
    });

    it('stops processing messages after a fatal error', async () => {
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });
        const received = [];
        consumer.onBackgroundError(err => received.push(err));

        const messagesConsumed = [];
        consumer.run({ eachMessage: async event => messagesConsumed.push(event) });
        await producer.send({ topic: topicName, messages: [{ value: 'before-fatal' }] });
        await waitForMessages(messagesConsumed, { number: 1 });

        consumer._getInternalClient().emit('event.error', {
            code: ErrorCodes.ERR__FENCED,
            message: 'Local: This instance has been fenced by a newer instance',
            isFatal: true,
        });
        await waitFor(() => received.length > 0, () => null);
        expect(received[0]).toMatchObject({ code: ErrorCodes.ERR__FENCED, fatal: true });

        await producer.send({ topic: topicName, messages: [{ value: 'after-fatal' }] });
        await sleep(3000);
        expect(messagesConsumed.length).toBe(1);
    });

    it('rejects run() after a fatal error', async () => {
        await consumer.connect();
        const received = [];
        consumer.onBackgroundError(err => received.push(err));

        consumer._getInternalClient().emit('event.error', {
            code: ErrorCodes.ERR__FENCED,
            message: 'Local: This instance has been fenced by a newer instance',
            isFatal: true,
        });
        await waitFor(() => received.length > 0, () => null);

        await expect(consumer.run({ eachMessage: async () => {} })).rejects.toMatchObject({
            code: ErrorCodes.ERR__FENCED,
            fatal: true,
        });
    });

    /* With the classic protocol the newer member fences the older one, with
     * the consumer protocol the broker rejects the newer member instead:
     * either way one of them fails with a fatal error. */
    it('stops processing messages when another consumer has the same group.instance.id', async () => {
        const groupInstanceId = `instance-${secureRandom()}`;
        consumer = createConsumer(consumerConfig(), { 'group.instance.id': groupInstanceId });
        const twin = createConsumer(consumerConfig(), { 'group.instance.id': groupInstanceId });
        const consumers = [consumer, twin];
        const received = consumers.map(() => []);
        consumers.forEach((c, i) => c.onBackgroundError(err => received[i].push(err)));

        try {
            await consumer.connect();
            await consumer.subscribe({ topic: topicName });
            consumer.run({ eachMessage: async () => {} });
            await waitFor(() => consumer.assignment().length > 0, () => null);

            await twin.connect();
            await twin.subscribe({ topic: topicName });
            twin.run({ eachMessage: async () => {} });

            await waitFor(() => received.some(errors => errors.some(err => err.fatal)), () => null);
            const failed = received.findIndex(errors => errors.some(err => err.fatal));
            expect(received[failed].find(err => err.fatal).code).toBe(ErrorCodes.ERR__FATAL);

            const errorsAfterFatal = received[failed].length;
            await sleep(3000);
            expect(received[failed].length).toBe(errorsAfterFatal);
        } finally {
            await twin.disconnect();
        }
    });
});
