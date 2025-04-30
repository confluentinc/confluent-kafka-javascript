jest.setTimeout(30000);

const {
    secureRandom,
    createTopic,
    createAdmin,
    sleep,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Admin > listTopics', () => {
    let topicNames, admin;

    beforeEach(async () => {
        topicNames = [`test-topic-${secureRandom()}`, `test-topic-${secureRandom()}`];

        await createTopic({ topic: topicNames[0], });
        await createTopic({ topic: topicNames[1] });

        admin = createAdmin({});
    });

    afterEach(async () => {
        admin && (await admin.disconnect());
    });

    it('should timeout', async () => {
        await admin.connect();

        /* Await for the learned brokers to avoid having to do
         * manual retries */
        await sleep(1000);

        await expect(admin.listTopics({ timeout: 1 })).rejects.toHaveProperty(
            'code',
            ErrorCodes.ERR__TIMED_OUT
        );
    });

    it('should list consumer topics', async () => {
        await admin.connect();
        const listTopicsResult = await admin.listTopics();
        expect(listTopicsResult).toEqual(
            expect.arrayContaining(topicNames)
        );
    });
});

