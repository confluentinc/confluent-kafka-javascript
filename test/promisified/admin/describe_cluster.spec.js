jest.setTimeout(30000);

const {
    createAdmin,
} = require('../testhelpers');

describe('Admin > describeCluster', () => {
    let admin;

    beforeEach(async () => {
        admin = createAdmin({});
    });

    afterEach(async () => {
        admin && (await admin.disconnect());
    });

    it('should fail if not connected', async () => {
        await expect(admin.describeCluster()).rejects.toHaveProperty(
            'code',
            -172 // ERR__STATE
        );
    });

    it('should describe the cluster', async () => {
        await admin.connect();

        const result = await admin.describeCluster();

        expect(result).toEqual(
            expect.objectContaining({
                clusterId: expect.any(String),
                controller: expect.any(Number),
                brokers: expect.arrayContaining([
                    expect.objectContaining({
                        nodeId: expect.any(Number),
                        host: expect.any(String),
                        port: expect.any(Number),
                    }),
                ]),
            })
        );

        expect(result.clusterId.length).toBeGreaterThan(0);
        expect(result.brokers.length).toBeGreaterThan(0);
    });
});
