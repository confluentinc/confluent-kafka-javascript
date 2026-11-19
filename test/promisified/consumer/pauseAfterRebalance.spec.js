/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect", "expectDeliveredOnce"] }] */
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
    testConsumerGroupProtocolClassic,
} = require('../testhelpers');
const { PartitionAssigners } = require('../../../lib').KafkaJS;

const PARTITIONS = 4;

/* The classic protocol runs the rebalance tests with both the default (eager) assignors
 * and the cooperative-sticky assignor. The consumer protocol (KIP-848) is always
 * incremental, so it runs them once. */
const rebalanceModes = testConsumerGroupProtocolClassic() ?
    [
        ['eager', 'EAGER', {}],
        ['cooperative', 'COOPERATIVE', { partitionAssigners: [PartitionAssigners.cooperativeSticky] }],
    ] :
    [['the consumer protocol', 'COOPERATIVE', {}]];

/* Pausing a partition drops its prefetched messages and seeks back to the last
 * consumed offset, and with autoCommit on, the seek commits that offset. These tests
 * cover partitions that move to another member and come back, partitions a member
 * keeps through a rebalance, and partitions with messages prefetched but none
 * consumed yet. */
describe('Consumer > pause with prefetched messages', () => {
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

    /* `run` is a consumer.run() config, or a function that takes the consumer and
     * returns one. */
    async function startConsumer(run, { config = {}, common = {} } = {}) {
        const consumer = createConsumer({
            groupId,
            maxWaitTimeInMs: 100,
            fromBeginning: true,
            autoCommit: true,
            autoCommitInterval: 500,
            ...config,
        }, {
            /* Size the cache for 10s of consumption. Then a fetch prefetches the messages
             * of every partition, instead of the adaptive cache size, which starts at 1,
             * deciding which partitions get prefetched. */
            'js.consumer.max.cache.size.per.worker.ms': 10000,
            ...common,
        });
        consumers.push(consumer);
        await consumer.connect();
        await consumer.subscribe({ topic: topicName });
        consumer.run(typeof run === 'function' ? run(consumer) : run);
        return consumer;
    }

    /* An eachMessage handler that records [partition, offset] in `consumed`, and with
     * autoCommit off, commits each message after recording it. */
    function recordInto(consumed, { autoCommit = true } = {}) {
        return consumer => ({
            eachMessage: async ({ partition, message }) => {
                consumed.push([partition, Number(message.offset)]);
                if (!autoCommit)
                    await consumer.commitOffsets([
                        { topic: topicName, partition, offset: String(Number(message.offset) + 1) }]);
            },
        });
    }

    /* An eachBatch handler that records [partition, offset] in `consumed` and resolves
     * each message. holdNext() holds the next batch until released, so the cache keeps
     * the messages prefetched with it, and returns a promise that resolves once that
     * batch is held. */
    function holdableBatches(consumed) {
        let held = null;
        return {
            run: {
                eachBatchAutoResolve: false,
                eachBatch: async ({ batch, resolveOffset }) => {
                    if (held) {
                        const { onHold, released } = held;
                        held = null;
                        onHold();
                        await released;
                    }
                    for (const message of batch.messages) {
                        consumed.push([batch.partition, Number(message.offset)]);
                        resolveOffset(message.offset);
                    }
                },
            },
            holdNext() {
                let onHold, release;
                const holding = new Promise(resolve => { onHold = resolve; });
                const released = new Promise(resolve => { release = resolve; });
                held = { onHold, released };
                return { holding, release };
            },
        };
    }

    /* Waits a bounded time, since skipped messages never arrive, for offsets
     * [from, from + count) of each of `partitions` to be delivered after
     * consumed[before]. Then checks that each was delivered exactly once and that no
     * older message was delivered again. */
    async function expectDeliveredOnce(consumed, before, partitions, from, count) {
        const delivered = () => consumed.slice(before);
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline &&
               delivered().filter(([, offset]) => offset >= from).length < partitions.length * count)
            await sleep(100);
        /* Give duplicates time to arrive. */
        await sleep(1000);

        expect(delivered().filter(([, offset]) => offset < from)).toEqual([]);
        for (const partition of partitions) {
            const offsets = delivered().filter(([p]) => p === partition).map(([, offset]) => offset);
            expect(offsets.sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => from + i));
        }
    }

    describe.each(rebalanceModes)('with %s rebalancing', (mode, protocol, assignors) => {
        /* consumer1 consumes `perPartition` messages on every partition, consumer2 joins
         * and both consume `perPartition` more, then consumer2 leaves and consumer1 gets
         * its partitions back without consuming anything on them. */
        async function regainPartitions(consumer1, consumed, perPartition, config = assignors) {
            await produce(0, perPartition);
            await waitForMessages(consumed, { number: PARTITIONS * perPartition });

            const consumer2 = await startConsumer(recordInto(consumed, { autoCommit: config.autoCommit ?? true }),
                                                  { config });
            await waitFor(() => consumer2.assignment().length > 0 &&
                consumer1.assignment().length + consumer2.assignment().length === PARTITIONS, () => null, { delay: 100 });
            const consumer2Partitions = consumer2.assignment().map(({ partition }) => partition);

            await produce(1, perPartition);
            await waitForMessages(consumed, { number: 2 * PARTITIONS * perPartition });
            await waitForCommitted(2 * perPartition);

            await consumer2.disconnect();
            consumers.splice(consumers.indexOf(consumer2), 1);
            await waitFor(() => consumer1.assignment().length === PARTITIONS, () => null, { delay: 100 });
            expect(consumer1.rebalanceProtocol()).toEqual(protocol);
            return consumer2Partitions;
        }

        it('does not rewind the committed offsets of partitions it got back', async () => {
            const consumed = [];
            const consumer1 = await startConsumer(recordInto(consumed), { config: assignors });
            const consumer2Partitions = await regainPartitions(consumer1, consumed, 10);
            expect(consumer2Partitions.length).toBeGreaterThan(0);

            /* consumer1's last consumed offsets on consumer2's partitions are 9, from
             * before consumer2 joined. Pausing must not seek back to them and commit 10. */
            consumer1.pause([{ topic: topicName }]);
            await consumer1.disconnect();
            consumers.splice(consumers.indexOf(consumer1), 1);

            const committed = await committedOffsets();
            for (let partition = 0; partition < PARTITIONS; partition++)
                expect(committed[partition]).toEqual(20);
        });

        it('does not re-deliver what the other member processed, with autoCommit off', async () => {
            const consumed = [];
            const config = { ...assignors, autoCommit: false };
            const consumer1 = await startConsumer(recordInto(consumed, { autoCommit: false }), { config });
            const consumer2Partitions = await regainPartitions(consumer1, consumed, 10, config);
            expect(consumer2Partitions.length).toBeGreaterThan(0);

            /* With autoCommit off the seek commits nothing, but seeking back to consumer1's
             * last consumed offsets on consumer2's partitions (9) would deliver consumer2's
             * messages 10-19 again. */
            const before = consumed.length;
            consumer1.pause([{ topic: topicName }]);
            await sleep(1000);
            consumer1.resume([{ topic: topicName }]);
            await sleep(3000);
            expect(consumed.slice(before)).toEqual([]);

            const committed = await committedOffsets();
            for (let partition = 0; partition < PARTITIONS; partition++)
                expect(committed[partition]).toEqual(20);
        });

        it('neither re-delivers nor skips messages when paused and resumed after a rebalance', async () => {
            const perPartition = 50;
            const consumed = [];
            const batches = holdableBatches(consumed);
            const consumer1 = await startConsumer(batches.run,
                { config: assignors, common: { 'js.consumer.max.batch.size': 5 } });
            await regainPartitions(consumer1, consumed, perPartition);

            /* Hold the first batch of the next round. The fetch that returned it also
             * prefetched the other partitions, including the ones consumer1 got back,
             * which have no consumed messages yet. Pause and resume the topic while
             * those are in the cache. */
            const before = consumed.length;
            const { holding, release } = batches.holdNext();
            await produce(2, perPartition);
            await holding;
            await sleep(1000);
            consumer1.pause([{ topic: topicName }]);
            release();
            await sleep(1000);
            consumer1.resume([{ topic: topicName }]);

            await expectDeliveredOnce(consumed, before, [...Array(PARTITIONS).keys()],
                                      2 * perPartition, perPartition);
        });

        /* Control for the partitions a member keeps: an incremental rebalance revokes only
         * some partitions, and the ones kept must keep their last consumed offsets. An eager
         * rebalance revokes every partition, so there is nothing to keep. */
        if (protocol === 'COOPERATIVE') {
            it('neither re-delivers nor skips messages on a partition it kept through the rebalance', async () => {
                const perPartition = 50;
                const consumed = [];
                const batches = holdableBatches(consumed);
                const consumer1 = await startConsumer(batches.run,
                    { config: assignors, common: { 'js.consumer.max.batch.size': 5 } });
                await produce(0, 10);
                await waitForMessages(consumed, { number: PARTITIONS * 10 });

                /* consumer2 takes some of the partitions. consumer1 keeps the others, with
                 * last consumed offsets (9) from before the rebalance. */
                const consumer2 = await startConsumer(recordInto([]), { config: assignors });
                await waitFor(() => consumer2.assignment().length > 0 &&
                    consumer1.assignment().length + consumer2.assignment().length === PARTITIONS, () => null, { delay: 100 });
                const kept = consumer1.assignment().map(({ partition }) => partition).sort();
                expect(kept.length).toBeGreaterThan(0);

                /* Hold consumer1's first batch of the next round, so its other kept
                 * partitions have prefetched, unprocessed messages, and pause and resume the
                 * topic while they are in the cache. */
                const before = consumed.length;
                const { holding, release } = batches.holdNext();
                await produce(1, perPartition);
                await holding;
                await sleep(1000);
                consumer1.pause([{ topic: topicName }]);
                release();
                await sleep(1000);
                consumer1.resume([{ topic: topicName }]);

                await expectDeliveredOnce(consumed, before, kept, 10, perPartition);
                expect(consumer1.assignment().map(({ partition }) => partition).sort()).toEqual(kept);
            });
        }
    });

    describe('without a rebalance', () => {
        /* More partitions than workers, and a slow handler, so the cache holds messages
         * of partitions no worker has started on. Pausing drops them, and resuming must
         * fetch them again. */
        it.each(['eachMessage', 'eachBatch'])(
            'neither re-delivers nor skips prefetched messages when paused and resumed (%s)', async (handler) => {
            const perPartition = 30;
            await produce(0, perPartition);

            const consumed = [];
            let paused = false;
            const deliver = async (partition, message) => {
                await sleep(20);
                consumed.push([partition, Number(message.offset)]);
            };
            const pauseOnce = (consumer) => {
                if (paused || consumed.length < 40)
                    return;
                paused = true;
                consumer.pause([{ topic: topicName }]);
                setTimeout(() => consumer.resume([{ topic: topicName }]), 2000);
            };
            await startConsumer(consumer => (handler === 'eachMessage' ? {
                partitionsConsumedConcurrently: 2,
                eachMessage: async ({ partition, message }) => {
                    await deliver(partition, message);
                    pauseOnce(consumer);
                },
            } : {
                partitionsConsumedConcurrently: 2,
                /* Resolve message by message and stop at the pause, so that the batch
                 * seeks back to the first unprocessed message. */
                eachBatchAutoResolve: false,
                eachBatch: async ({ batch, resolveOffset, isStale }) => {
                    for (const message of batch.messages) {
                        if (isStale())
                            break;
                        await deliver(batch.partition, message);
                        resolveOffset(message.offset);
                        pauseOnce(consumer);
                    }
                },
            }));

            await expectDeliveredOnce(consumed, 0, [...Array(PARTITIONS).keys()], 0, perPartition);
            expect(paused).toBe(true);
        });
    });
});
