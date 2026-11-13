jest.setTimeout(30000);

const { secureRandom, createConsumer } = require('../testhelpers');

/** The consumer passes twice the configured max.poll.interval.ms to librdkafka,
 * whose maximum is 24 hours. So the maximum configurable value is 12 hours. */
describe('Consumer max.poll.interval.ms limits', () => {
    let consumer;

    afterEach(async () => {
        consumer && (await consumer.disconnect());
        consumer = null;
    });

    it.each([
        ['the default', undefined],
        ['the 12 hour maximum', 43200000],
    ])('connects with max.poll.interval.ms at %s', async (_, value) => {
        const common = value === undefined ? {} : { 'max.poll.interval.ms': value };
        consumer = createConsumer({ groupId: `group-${secureRandom()}` }, common);
        await expect(consumer.connect()).resolves.toBeUndefined();
    });

    it('connects with rebalanceTimeout at the 12 hour maximum', async () => {
        consumer = createConsumer({
            groupId: `group-${secureRandom()}`,
            rebalanceTimeout: 43200000,
        });
        await expect(consumer.connect()).resolves.toBeUndefined();
    });

    it.each([43200001, 86400000, 0, -1, 1.5])(
        'rejects max.poll.interval.ms %s with a clear error', async (value) => {
        consumer = createConsumer({ groupId: `group-${secureRandom()}` },
            { 'max.poll.interval.ms': value });
        await expect(consumer.connect()).rejects.toThrow(
            new RegExp(`'max\\.poll\\.interval\\.ms' .* must be an integer between 1 and 43200000 \\(12 hours\\), got ${value}`));
    });

    it('rejects rebalanceTimeout above 12 hours with a clear error', async () => {
        consumer = createConsumer({
            groupId: `group-${secureRandom()}`,
            rebalanceTimeout: 43200001,
        });
        await expect(consumer.connect()).rejects.toThrow(
            /must be an integer between 1 and 43200000 \(12 hours\)/);
    });
});
