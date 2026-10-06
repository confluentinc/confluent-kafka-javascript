jest.setTimeout(10000);

const {
    SerializationError,
    KeySerializationError,
    ValueSerializationError,
    DeserializationError,
    KafkaJSError,
    ErrorCodes,
} = require('../../../lib').KafkaJS;

describe('Key/ValueSerializationError', () => {
    it.each([
        ['KeySerializationError', KeySerializationError, ErrorCodes.ERR__KEY_SERIALIZATION, 'ERR__KEY_SERIALIZATION'],
        ['ValueSerializationError', ValueSerializationError, ErrorCodes.ERR__VALUE_SERIALIZATION, 'ERR__VALUE_SERIALIZATION'],
    ])('%s carries its own name and code', (name, Ctor, code, type) => {
        const e = new Ctor(new Error('schema not found'));
        expect(e.name).toBe(name);
        expect(e.code).toBe(code);
        expect(e.type).toBe(type);
        expect(e.message).toBe('schema not found');
    });

    /* The shared base is what lets either be recognised with a single check. */
    it.each([
        ['KeySerializationError', KeySerializationError],
        ['ValueSerializationError', ValueSerializationError],
    ])('%s is a SerializationError and a KafkaJSError', (_name, Ctor) => {
        const e = new Ctor(new Error('nope'));
        expect(e).toBeInstanceOf(SerializationError);
        expect(e).toBeInstanceOf(KafkaJSError);
        expect(e).toBeInstanceOf(Error);
        /* Serialization and deserialization failures are distinct families. */
        expect(e).not.toBeInstanceOf(DeserializationError);
    });

    it('does not confuse the two subclasses', () => {
        expect(new KeySerializationError(new Error('k'))).not.toBeInstanceOf(ValueSerializationError);
        expect(new ValueSerializationError(new Error('v'))).not.toBeInstanceOf(KeySerializationError);
    });

    it.each([
        ['KeySerializationError', KeySerializationError],
        ['ValueSerializationError', ValueSerializationError],
    ])('%s keeps the thrown error as the cause, with its stack', (_name, Ctor) => {
        const thrown = new Error('schema not found');
        const e = new Ctor(thrown);
        expect(e.cause).toBe(thrown);
        expect(e.stack).toBe(thrown.stack);
    });

    it.each([
        ['KeySerializationError', KeySerializationError],
        ['ValueSerializationError', ValueSerializationError],
    ])('%s tolerates a non-Error being thrown', (_name, Ctor) => {
        const e = new Ctor('just a string');
        expect(e.message).toBe('just a string');
        expect(e.cause).toBeNull();
    });
});
