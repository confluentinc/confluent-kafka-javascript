jest.setTimeout(30000);

const { secureRandom, createConsumer } = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

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

    // Fractional values were accepted before the 12 hour check was added.
    // The doubled value must stay above session.timeout.ms (45000 by default).
    it('still accepts a fractional max.poll.interval.ms', async () => {
        consumer = createConsumer({ groupId: `group-${secureRandom()}` },
            { 'max.poll.interval.ms': 60000.5 });
        await expect(consumer.connect()).resolves.toBeUndefined();
    });

    it.each([43200001, 86400000, 43200000.5, 'abc'])(
        'rejects max.poll.interval.ms %s with a clear error', async (value) => {
        consumer = createConsumer({ groupId: `group-${secureRandom()}` },
            { 'max.poll.interval.ms': value });
        await expect(consumer.connect()).rejects.toMatchObject({
            code: ErrorCodes.ERR__INVALID_ARG,
            message: expect.stringContaining(
                `not greater than 43200000 (12 hours), got ${value}`),
        });
    });

    it('rejects rebalanceTimeout above 12 hours with a clear error', async () => {
        consumer = createConsumer({
            groupId: `group-${secureRandom()}`,
            rebalanceTimeout: 43200001,
        });
        await expect(consumer.connect()).rejects.toMatchObject({
            code: ErrorCodes.ERR__INVALID_ARG,
            message: expect.stringContaining('not greater than 43200000 (12 hours)'),
        });
    });
});
