jest.setTimeout(10000);

const {
    DeserializationError,
    KeyDeserializationError,
    ValueDeserializationError,
    KafkaJSError,
    ErrorCodes,
} = require('../../../lib').KafkaJS;

describe('Key/ValueDeserializationError', () => {
    it.each([
        ['KeyDeserializationError', KeyDeserializationError, ErrorCodes.ERR__KEY_DESERIALIZATION, 'ERR__KEY_DESERIALIZATION'],
        ['ValueDeserializationError', ValueDeserializationError, ErrorCodes.ERR__VALUE_DESERIALIZATION, 'ERR__VALUE_DESERIALIZATION'],
    ])('%s carries its own name and code', (name, Ctor, code, type) => {
        const e = new Ctor(new Error('bad magic byte'));
        expect(e.name).toBe(name);
        expect(e.code).toBe(code);
        expect(e.type).toBe(type);
        expect(e.message).toBe('bad magic byte');
    });

    /* The shared base is what lets either be recognised with a single check. */
    it.each([
        ['KeyDeserializationError', KeyDeserializationError],
        ['ValueDeserializationError', ValueDeserializationError],
    ])('%s is a DeserializationError and a KafkaJSError', (_name, Ctor) => {
        const e = new Ctor(new Error('nope'));
        expect(e).toBeInstanceOf(DeserializationError);
        expect(e).toBeInstanceOf(KafkaJSError);
        expect(e).toBeInstanceOf(Error);
    });

    it('does not confuse the two subclasses', () => {
        expect(new KeyDeserializationError(new Error('k'))).not.toBeInstanceOf(ValueDeserializationError);
        expect(new ValueDeserializationError(new Error('v'))).not.toBeInstanceOf(KeyDeserializationError);
    });

    it.each([
        ['KeyDeserializationError', KeyDeserializationError],
        ['ValueDeserializationError', ValueDeserializationError],
    ])('%s keeps the thrown error as the cause, with its stack', (_name, Ctor) => {
        const thrown = new Error('bad magic byte');
        const e = new Ctor(thrown);
        expect(e.cause).toBe(thrown);
        expect(e.stack).toBe(thrown.stack);
    });

    it.each([
        ['KeyDeserializationError', KeyDeserializationError],
        ['ValueDeserializationError', ValueDeserializationError],
    ])('%s tolerates a non-Error being thrown', (_name, Ctor) => {
        const e = new Ctor('just a string');
        expect(e.message).toBe('just a string');
        expect(e.cause).toBeNull();
    });
});
