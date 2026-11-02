jest.setTimeout(90000);

const {
    secureRandom,
    createTopic,
    waitFor,
    waitForMessages,
    createConsumer,
    createProducer,
    createAdmin,
    sleep,
} = require('../testhelpers');

const PARTITIONS = 4;

/* Pausing a partition drops its prefetched messages and seeks back to the last
 * consumed offset, and with autoCommit on, the seek commits that offset. These tests
 * cover partitions that move to another member and come back, and partitions that
 * arrive with messages already prefetched but none consumed yet. */
describe('Consumer > pause after a rebalance', () => {
    let groupId, topicName, producer, admin, consumers;

    beforeEach(async () => {
        console.log("Starting:", expect.getState().currentTestName);
        topicName = `test-topic-${secureRandom()}`;
        groupId = `consumer-group-id-${secureRandom()}`;
        await createTopic({ topic: topicName, partitions: PARTITIONS });

        producer = createProducer({});
        await producer.connect();
        admin = createAdmin({});
        await admin.connect();
        consumers = [];
    });

    afterEach(async () => {
        for (const consumer of consumers)
            await consumer.disconnect().catch(() => {});
        producer && (await producer.disconnect());
        admin && (await admin.disconnect());
        console.log("Ending:", expect.getState().currentTestName);
    });

    async function produce(round, perPartition) {
        const messages = [];
        for (let partition = 0; partition < PARTITIONS; partition++)
            for (let i = 0; i < perPartition; i++)
                messages.push({ value: `round-${round}-${partition}-${i}`, partition });
        await producer.send({ topic: topicName, messages });
    }

    async function committedOffsets() {
        const [{ partitions }] = await admin.fetchOffsets({ groupId, topics: [topicName] });
        return Object.fromEntries(partitions.map(({ partition, offset }) => [partition, Number(offset)]));
    }

    async function waitForCommitted(offset) {
        for (;;) {
            const committed = await committedOffsets();
            if (Object.values(committed).filter(o => o === offset).length === PARTITIONS)
                return;
            await sleep(200);
        }
    }

    async function startConsumer(run, common = {}) {
        const consumer = createConsumer({
            groupId,
            maxWaitTimeInMs: 100,
            fromBeginning: true,
            autoCommit: true,
            autoCommitInterval: 500,
        }, common);
        consumers.push(consumer);
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });
        consumer.run(run);
        return consumer;
    }

    /* consumer1 consumes `perPartition` messages on every partition, consumer2 joins and
     * both consume `perPartition` more, then consumer2 leaves and consumer1 gets its
     * partitions back without consuming anything on them. */
    async function regainPartitions(consumer1, consumed, perPartition) {
        await produce(0, perPartition);
        await waitForMessages(consumed, { number: PARTITIONS * perPartition });

        const consumer2 = await startConsumer({
            eachMessage: async ({ partition, message }) => { consumed.push([partition, Number(message.offset)]); },
        });
        await waitFor(() => consumer2.assignment().length > 0 &&
            consumer1.assignment().length + consumer2.assignment().length === PARTITIONS, () => null, { delay: 100 });
        const consumer2Partitions = consumer2.assignment().map(({ partition }) => partition);

        await produce(1, perPartition);
        await waitForMessages(consumed, { number: 2 * PARTITIONS * perPartition });
        await waitForCommitted(2 * perPartition);

        await consumer2.disconnect();
        consumers.splice(consumers.indexOf(consumer2), 1);
        await waitFor(() => consumer1.assignment().length === PARTITIONS, () => null, { delay: 100 });
        return consumer2Partitions;
    }

    it('does not rewind the committed offsets of partitions it got back', async () => {
        const consumed = [];
        const consumer1 = await startConsumer({
            eachMessage: async ({ partition, message }) => { consumed.push([partition, Number(message.offset)]); },
        });
        const consumer2Partitions = await regainPartitions(consumer1, consumed, 10);
        expect(consumer2Partitions.length).toBeGreaterThan(0);

        /* consumer1's last consumed offsets on consumer2's partitions are 9, from before
         * consumer2 joined. Pausing must not seek back to them and commit 10. */
        consumer1.pause([{ topic: topicName }]);
        await consumer1.disconnect();
        consumers.splice(consumers.indexOf(consumer1), 1);

        const committed = await committedOffsets();
        for (let partition = 0; partition < PARTITIONS; partition++)
            expect(committed[partition]).toEqual(20);
    });

    it('neither re-delivers nor skips messages when paused and resumed after a rebalance', async () => {
        const perPartition = 50;
        const consumed = [];
        let block = false;
        let entered, release;
        const consumer1 = await startConsumer({
            eachBatchAutoResolve: false,
            eachBatch: async ({ batch, resolveOffset }) => {
                if (block) {
                    block = false;
                    entered.resolve();
                    await release;
                }
                for (const message of batch.messages) {
                    consumed.push([batch.partition, Number(message.offset)]);
                    resolveOffset(message.offset);
                }
            },
        }, { 'js.consumer.max.batch.size': 5 });
        await regainPartitions(consumer1, consumed, perPartition);

        /* Hold the first batch of the next round so the cache fills with prefetched
         * messages, including on the partitions consumer1 got back, then pause and resume
         * the topic. */
        const before = consumed.length;
        entered = {};
        const enteredPromise = new Promise(resolve => { entered.resolve = resolve; });
        let releaseBatch;
        release = new Promise(resolve => { releaseBatch = resolve; });
        block = true;
        await produce(2, perPartition);
        await enteredPromise;
        await sleep(1000);
        consumer1.pause([{ topic: topicName }]);
        releaseBatch();
        await sleep(1000);
        consumer1.resume([{ topic: topicName }]);

        /* Wait a bounded time: skipped messages never arrive. */
        const roundStart = 2 * perPartition;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline &&
               consumed.slice(before).filter(([, offset]) => offset >= roundStart).length < PARTITIONS * perPartition)
            await sleep(100);
        await sleep(1000);

        const afterPause = consumed.slice(before);
        /* Nothing from before the pause is delivered again... */
        expect(afterPause.filter(([, offset]) => offset < roundStart)).toEqual([]);
        /* ...and every new message is delivered exactly once. */
        for (let partition = 0; partition < PARTITIONS; partition++) {
            const offsets = afterPause.filter(([p]) => p === partition).map(([, offset]) => offset);
            expect(offsets.sort((a, b) => a - b)).toEqual(
                Array.from({ length: perPartition }, (_, i) => roundStart + i));
        }
    });
});
