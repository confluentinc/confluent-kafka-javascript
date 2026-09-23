jest.setTimeout(10000);

const {
    isConnectRetriable,
    connectRetryParams,
    moreInformativeConnectError,
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

describe('connectRetryParams', () => {
    it('defaults to KafkaJS values when nothing is supplied', () => {
        expect(connectRetryParams(undefined)).toEqual({
            retries: 5,
            initialRetryTime: 300,
            maxRetryTime: 30000,
        });
    });

    it('honors user-supplied retry fields', () => {
        expect(connectRetryParams({ retries: 2, initialRetryTime: 100, maxRetryTime: 5000 })).toEqual({
            retries: 2,
            initialRetryTime: 100,
            maxRetryTime: 5000,
        });
    });

    it('fills in defaults for individually-missing fields', () => {
        expect(connectRetryParams({ retries: 0 })).toEqual({
            retries: 0,
            initialRetryTime: 300,
            maxRetryTime: 30000,
        });
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
