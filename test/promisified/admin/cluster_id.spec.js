jest.setTimeout(30000);

const {
    createAdmin,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Admin > clusterId', () => {
    let admin;

    beforeEach(async () => {
        admin = createAdmin({});
    });

    afterEach(async () => {
        admin && (await admin.disconnect());
    });

    it('should throw when not connected', async () => {
        await expect(admin.clusterId()).rejects.toHaveProperty(
            'code',
            ErrorCodes.ERR__STATE
        );
    });

    it('should return the cluster id', async () => {
        await admin.connect();
        const clusterId = await admin.clusterId();
        expect(typeof clusterId).toBe('string');
        expect(clusterId.length).toBeGreaterThan(0);
    });

    it('should return the cached cluster id with a zero timeout', async () => {
        await admin.connect();

        /* Fetch it once so that librdkafka has it cached, then a cache-only
         * lookup must return the same value. */
        const clusterId = await admin.clusterId();
        await expect(admin.clusterId({ timeout: 0 })).resolves.toBe(clusterId);
    });
});
