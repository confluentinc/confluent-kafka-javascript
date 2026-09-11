jest.setTimeout(30000);

const {
    createAdmin,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Admin > describeCluster', () => {
    let admin;

    beforeEach(async () => {
        admin = createAdmin({});
    });

    afterEach(async () => {
        admin && (await admin.disconnect());
    });

    it('should throw an error when not connected', async () => {
        await expect(admin.describeCluster()).rejects.toHaveProperty(
            'code',
            ErrorCodes.ERR__STATE
        );
    });

    it('should timeout', async () => {
        await admin.connect();

        while (true) {
            try {
                await admin.describeCluster({ timeout: 0.00001 });
                jest.fail('Should have thrown an error');
            } catch (e) {
                if (e.code === ErrorCodes.ERR__TRANSPORT)
                    continue;
                expect(e).toHaveProperty(
                    'code',
                    ErrorCodes.ERR__TIMED_OUT
                );
                break;
            }
        }
    });

    it('should describe the cluster', async () => {
        await admin.connect();

        const description = await admin.describeCluster();

        expect(typeof description.clusterId).toBe('string');
        expect(description.clusterId.length).toBeGreaterThan(0);
        expect(typeof description.controller).toBe('number');
        expect(Array.isArray(description.brokers)).toBe(true);
        expect(description.brokers.length).toBeGreaterThan(0);
        for (const broker of description.brokers) {
            expect(typeof broker.nodeId).toBe('number');
            expect(typeof broker.host).toBe('string');
            expect(typeof broker.port).toBe('number');
        }
        expect(description.brokers.map(broker => broker.nodeId)).toContain(
            description.controller
        );
        expect(description.authorizedOperations).toBeUndefined();
    });

    it('should include authorized operations when requested', async () => {
        await admin.connect();

        const description = await admin.describeCluster({
            includeAuthorizedOperations: true,
        });

        expect(Array.isArray(description.authorizedOperations)).toBe(true);
        expect(description.authorizedOperations.length).toBeGreaterThan(0);
    });
});
