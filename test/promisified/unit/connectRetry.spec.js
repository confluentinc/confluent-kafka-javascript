jest.setTimeout(10000);

const {
    isConnectRetriable,
    connectRetries,
    moreInformativeConnectError,
    kafkaJSToRdKafkaConfig,
} = require('../../../lib/kafkajs/_common');
const { ErrorCodes } = require('../../../lib/kafkajs/_error');

describe('isConnectRetriable', () => {
    it('treats transient connection errors as retriable', () => {
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TRANSPORT })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__ALL_BROKERS_DOWN })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TIMED_OUT })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__TIMED_OUT_QUEUE })).toBe(true);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__RESOLVE })).toBe(true);
    });

    it('treats auth, config and unknown errors as non-retriable', () => {
        expect(isConnectRetriable({ code: ErrorCodes.ERR__AUTHENTICATION })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__STATE })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR__INVALID_ARG })).toBe(false);
        expect(isConnectRetriable({ code: ErrorCodes.ERR_UNKNOWN })).toBe(false);
    });

    it('is safe for missing errors', () => {
        expect(isConnectRetriable(undefined)).toBe(false);
        expect(isConnectRetriable(null)).toBe(false);
        expect(isConnectRetriable({})).toBe(false);
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

    it('returns whichever error is present when one is missing', () => {
        const err = { code: ErrorCodes.ERR__TRANSPORT };
        expect(moreInformativeConnectError(null, err)).toBe(err);
        expect(moreInformativeConnectError(err, null)).toBe(err);
        expect(moreInformativeConnectError(null, null)).toBe(null);
    });
});
