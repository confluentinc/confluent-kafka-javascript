jest.setTimeout(30000);

const {
    createProducer,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Producer > clusterId', () => {
    let producer;

    beforeEach(async () => {
        producer = createProducer({});
    });

    afterEach(async () => {
        producer && (await producer.disconnect());
    });

    it('should throw when not connected', async () => {
        await expect(producer.clusterId()).rejects.toHaveProperty(
            'code',
            ErrorCodes.ERR__STATE
        );
    });

    it('should return the cluster id', async () => {
        await producer.connect();
        const clusterId = await producer.clusterId();
        expect(typeof clusterId).toBe('string');
        expect(clusterId.length).toBeGreaterThan(0);

        /* connect() fetches metadata, so the value is already cached and a
         * cache-only lookup must return the same thing. */
        await expect(producer.clusterId({ timeout: 0 })).resolves.toBe(clusterId);
    });
});
