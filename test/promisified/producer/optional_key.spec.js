jest.setTimeout(30000);

const {
    secureRandom,
    createTopic,
    createProducer,
    createConsumer,
    waitForMessages,
} = require('../testhelpers');

describe('Producer > optional key and value', () => {
    let producer, consumer, topicName;

    beforeEach(async () => {
        topicName = `test-topic-${secureRandom()}`;
        await createTopic({ topic: topicName });
        producer = createProducer({});
        consumer = createConsumer({ groupId: `group-${secureRandom()}`, fromBeginning: true });
    });

    afterEach(async () => {
        producer && (await producer.disconnect());
        consumer && (await consumer.disconnect());
    });

    /* The key is optional in a message, so omitting it must behave the same as
     * passing null rather than being rejected as an invalid type. */
    it.each([
        ['key omitted', { value: 'value' }],
        ['key null', { key: null, value: 'value' }],
        ['key string', { key: 'key', value: 'value' }],
        ['key buffer', { key: Buffer.from('key'), value: 'value' }],
        ['value omitted', { key: 'key' }],
        ['value null', { key: 'key', value: null }],
        ['value buffer', { key: 'key', value: Buffer.from('value') }],
        ['key and value omitted', {}],
    ])('accepts a message with %s', async (_name, message) => {
        await producer.connect();
        await expect(producer.send({ topic: topicName, messages: [message] }))
            .resolves.toBeTruthy();
    });

    it('produces and consumes a message with no key', async () => {
        await producer.connect();
        await producer.send({ topic: topicName, messages: [{ value: 'no-key-value' }] });

        const messagesConsumed = [];
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });
        await consumer.run({
            eachMessage: async (event) => messagesConsumed.push(event),
        });
        await waitForMessages(messagesConsumed, { number: 1 });

        expect(messagesConsumed[0].message.key).toBeNull();
        expect(messagesConsumed[0].message.value.toString()).toBe('no-key-value');
    });

    it('rejects a key that is neither a string nor a buffer', async () => {
        await producer.connect();
        await expect(producer.send({ topic: topicName, messages: [{ key: 42, value: 'value' }] }))
            .rejects.toThrow('Key must be a string or a Buffer');
    });

    /* Only a string or a Buffer, as declared by the Message type: a bare typed
     * array is not accepted even though the binding would take a Uint8Array. */
    it.each([
        ['a number', 42],
        ['a plain object', { a: 1 }],
        ['a Uint8Array', new Uint8Array([118])],
        ['a Float64Array', new Float64Array([1])],
    ])('rejects a value that is %s', async (_name, value) => {
        await producer.connect();
        await expect(producer.send({ topic: topicName, messages: [{ key: 'key', value }] }))
            .rejects.toThrow('Value must be a string or a Buffer');
    });
});
