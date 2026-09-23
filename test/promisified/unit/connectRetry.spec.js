jest.setTimeout(10000);

const {
    isConnectRetriable,
    connectRetries,
    moreInformativeConnectError,
    connectMetadataTimeout,
    kafkaJSToRdKafkaConfig,
} = require('../../../lib/kafkajs/_common');
const { ErrorCodes } = require('../../../lib/kafkajs/_error');

describe('isConnectRetriable', () => {
    it('retries transient connection errors', () => {
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TRANSPORT })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__ALL_BROKERS_DOWN })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TIMED_OUT })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TIMED_OUT_QUEUE })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__RESOLVE })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__SSL })).toBe(true);
    });

    it('retries by default, including unknown or unexpected errors (KafkaJS-style)', () => {
        expect(isConnectRetriable({ code: ErrorCodes.ERR_UNKNOWN })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_LEADER_NOT_AVAILABLE })).toBe(true);
        expect(isConnectRetriable({})).toBe(true);
    });

    it('does not retry terminal errors: auth, authorization, config, unsupported, fatal', () => {
        expect(isConnectRetriable({ code: ErrorCodes.ERR__AUTHENTICATION })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_SASL_AUTHENTICATION_FAILED })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_UNSUPPORTED_SASL_MECHANISM })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_TOPIC_AUTHORIZATION_FAILED })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_CLUSTER_AUTHORIZATION_FAILED })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__INVALID_ARG })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_INVALID_CONFIG })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_UNSUPPORTED_VERSION })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__FATAL })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__STATE })).toBe(false);
    });

    it('does not retry an error flagged fatal even with an unlisted code', () => {
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TRANSPORT, isFatal: true })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_UNKNOWN, fatal: true })).toBe(false);
    });

    it('is safe for a missing error object', () => {
        expect(isConnectRetriable(undefined)).toBe(false);
        expect(isConnectRetriable(null)).toBe(false);
    });
});

describe('connectRetries', () => {
    it('defaults to the KafkaJS value of 5 when nothing is supplied', () => {
        expect(connectRetries(undefined)).toBe(5);
        expect(connectRetries({})).toBe(5);
    });

    it('honors a user-supplied retries value', () => {
        expect(connectRetries({ retries: 2 })).toBe(2);
    });

    it('honors an explicit zero', () => {
        expect(connectRetries({ retries: 0 })).toBe(0);
    });
});

describe('connectMetadataTimeout', () => {
    it('adds a margin to the configured connection-setup timeout', () => {
        expect(connectMetadataTimeout({ 'socket.connection.setup.timeout.ms': 11000 })).toBe(12000);
        expect(connectMetadataTimeout({ 'socket.connection.setup.timeout.ms': 1000 })).toBe(2000);
    });

    it('falls back to the librdkafka default when the setup timeout is absent', () => {
        // Raw librdkafka config (no kafkaJS block) never sets this key; must not be NaN/0.
        expect(connectMetadataTimeout({})).toBe(31000);
        expect(connectMetadataTimeout({ 'socket.connection.setup.timeout.ms': undefined })).toBe(31000);
    });
});

describe('reconnect.backoff mapping', () => {
    it('maps retry.initialRetryTime/maxRetryTime onto reconnect.backoff.* like retry.backoff.*', () => {
        const c = kafkaJSToRdKafkaConfig({ brokers: ['x:9092'], retry: { initialRetryTime: 250, maxRetryTime: 12345 } });
        expect(c['reconnect.backoff.ms']).toBe(250);
        expect(c['reconnect.backoff.max.ms']).toBe(12345);
        expect(c['retry.backoff.ms']).toBe(250);
        expect(c['retry.backoff.max.ms']).toBe(12345);
    });

    it('uses KafkaJS defaults when retry is not supplied', () => {
        const c = kafkaJSToRdKafkaConfig({ brokers: ['x:9092'] });
        expect(c['reconnect.backoff.ms']).toBe(300);
        expect(c['reconnect.backoff.max.ms']).toBe(30000);
    });
});

describe('moreInformativeConnectError', () => {
    it('prefers the primary error when it has a specific code', () => {
        const primary = { code: ErrorCodes.ERR__TRANSPORT };
        const fallback = { code: ErrorCodes.ERR_UNKNOWN };
        expect(moreInformativeConnectError(primary, fallback)).toBe(primary);
    });

    it('falls back when the primary error has only an unknown code', () => {
        const primary = { code: ErrorCodes.ERR_UNKNOWN };
        const fallback = { code: ErrorCodes.ERR__TRANSPORT };
        expect(moreInformativeConnectError(primary, fallback)).toBe(fallback);
    });

    it('falls back when the primary error has no code but the fallback does', () => {
        const primary = { message: 'no code' };
        const fallback = { code: ErrorCodes.ERR__TRANSPORT };
        expect(moreInformativeConnectError(primary, fallback)).toBe(fallback);
    });

    it('prefers an error flagged fatal over one with a more specific code', () => {
        const fatal = { code: ErrorCodes.ERR_UNKNOWN, isFatal: true };
        const specific = { code: ErrorCodes.ERR__TRANSPORT };
        expect(moreInformativeConnectError(fatal, specific)).toBe(fatal);
        expect(moreInformativeConnectError(specific, fatal)).toBe(fatal);
        expect(isConnectRetriable(moreInformativeConnectError(fatal, specific))).toBe(false);
    });

    it('keeps the primary when neither has a specific code', () => {
        const primary = { message: 'no code' };
        const fallback = { code: ErrorCodes.ERR_UNKNOWN };
        expect(moreInformativeConnectError(primary, fallback)).toBe(primary);
    });

    it('returns whichever error is present when one is missing', () => {
        const err = { code: ErrorCodes.ERR__TRANSPORT };
        expect(moreInformativeConnectError(null, err)).toBe(err);
        expect(moreInformativeConnectError(err, null)).toBe(err);
        expect(moreInformativeConnectError(null, null)).toBe(null);
    });
});
