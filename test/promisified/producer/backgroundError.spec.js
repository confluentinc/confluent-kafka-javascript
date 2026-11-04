jest.setTimeout(60000);

const {
    secureRandom,
    createProducer,
    waitFor,
} = require('../testhelpers');
const { ErrorCodes } = require('../../../lib').KafkaJS;

describe('Producer > onBackgroundError', () => {
    let producer, fencingProducer;

    afterEach(async () => {
        producer && (await producer.disconnect());
        fencingProducer && (await fencingProducer.disconnect());
        producer = fencingProducer = null;
    });

    it('passes errors from the error event to the listeners', async () => {
        producer = createProducer({});
        await producer.connect();
        const received = [];
        producer.onBackgroundError(err => received.push(err));

        producer._getInternalClient().emit('event.error', {
            code: ErrorCodes.ERR__ALL_BROKERS_DOWN,
            message: 'Local: All broker connections are down',
            isFatal: false,
        });

        await waitFor(() => received.length > 0, () => null);
        expect(received[0]).toMatchObject({ code: ErrorCodes.ERR__ALL_BROKERS_DOWN, fatal: false });
    });

    it('passes a fatal error when a newer producer with the same transactional id fences it', async () => {
        const transactionalId = `transactional-id-${secureRandom()}`;
        producer = createProducer({ transactionalId });
        fencingProducer = createProducer({ transactionalId });
        await producer.connect();
        const received = [];
        producer.onBackgroundError(err => received.push(err));

        await fencingProducer.connect();
        const transaction = await producer.transaction();
        await transaction.send({ topic: `test-topic-${secureRandom()}`, messages: [{ value: 'fenced' }] })
            .catch(() => {});
        await transaction.commit().catch(() => {});

        await waitFor(() => received.length > 0, () => null);
        expect(received[0]).toMatchObject({ code: ErrorCodes.ERR__FENCED, fatal: true });
    });
});
