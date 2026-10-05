jest.setTimeout(30000);

const {
    createConsumer,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Consumer > clusterId', () => {
    let consumer;

    beforeEach(async () => {
        consumer = createConsumer({
            groupId: `consumer-cluster-id-${Date.now()}`,
        });
    });

    afterEach(async () => {
        consumer && (await consumer.disconnect());
    });

    it('should throw when not connected', async () => {
        await expect(consumer.clusterId()).rejects.toHaveProperty(
            'code',
            ErrorCodes.ERR__STATE
        );
    });

    it('should return the cluster id', async () => {
        await consumer.connect();
        const clusterId = await consumer.clusterId();
        expect(typeof clusterId).toBe('string');
        expect(clusterId.length).toBeGreaterThan(0);

        /* connect() fetches metadata, so the value is already cached and a
         * cache-only lookup must return the same thing. */
        await expect(consumer.clusterId({ timeout: 0 })).resolves.toBe(clusterId);
    });
});
