const { Lock, createKafkaJsErrorFromLibRdKafkaError } = require('../../../lib/kafkajs/_common');
const LibrdKafkaError = require('../../../lib/error');
const { SequentialPromises } = require('../testhelpers');

describe('Lock', () => {

    it('allows multiple concurrent readers', async () => {
        let lock = new Lock();
        let sequentialPromises = new SequentialPromises(1);
        let events = [];
        let tasks = [];
        let concurrency = 50;

        for (let i = 0; i < concurrency; i++) {
            let task = lock.read(async () => {
                events.push(i * 2);
                await sequentialPromises.get(0);
                events.push(i * 2 + 1);
            });
            tasks.push(task);
        }

        /* Make sure all tasks can reach the promise. */
        await new Promise((r) => setTimeout(r, 10));
        sequentialPromises.resolveNext();
        await Promise.all(tasks);

        for (let event of events.slice(0, 50)) {
            expect(event % 2).toEqual(0);
        }
        for (let event of events.slice(50)) {
            expect(event % 2).toEqual(1);
        }
    });

    it('prevents multiple concurrent write locks', async () => {
        let lock = new Lock();
        let sequentialPromises = new SequentialPromises(1);
        let events = [];
        let tasks = [];
        let concurrency = 50;

        for (let i = 0; i < concurrency; i++) {
            let task = lock.write(async () => {
                events.push(i * 2);
                await sequentialPromises.get(0);
                events.push(i * 2 + 1);
            });
            tasks.push(task);
        }

        /* Make sure all tasks can reach the promise in case
         * the lock wasn't working. */
        await new Promise((r) => setTimeout(r, 10));
        sequentialPromises.resolveNext();
        await Promise.all(tasks);

        for (let i = 0; i < concurrency; i++) {
            expect(events[i * 2]).toBe(events[i * 2 + 1] - 1);
        }
    });

    it('allows either multiple readers or a single writer', async () => {
        let lock = new Lock();
        let sequentialPromises = new SequentialPromises(3);
        let events = [];
        let promises = [];
        sequentialPromises.resolveNext();

        let read1 = lock.read(async () => {
            events.push(0);
            await sequentialPromises.get(0);
            events.push(1);
            sequentialPromises.resolveNext();
        });
        promises.push(read1);

        let read2 = lock.read(async () => {
            events.push(2);
            await sequentialPromises.get(1);
            events.push(3);
            sequentialPromises.resolveNext();
        });
        promises.push(read2);

        let write1 = lock.write(async () => {
            events.push(4);
            await sequentialPromises.get(2);
            events.push(5);
        });
        promises.push(write1);

        await Promise.all(promises);

        expect(events).toEqual([0, 2, 1, 3, 4, 5]);
    });


    it('allows reentrant read locks', async () => {
        let lock = new Lock();
        let sequentialPromises = new SequentialPromises(2);
        let events = [];
        let promises = [];
        sequentialPromises.resolveNext();

        let read1 = lock.read(async () => {
            events.push(0);
            await lock.read(async () => {
                events.push(1);
                await sequentialPromises.get(0);
                events.push(2);
            });
            events.push(3);
            sequentialPromises.resolveNext();
        });
        promises.push(read1);

        let read2 = lock.read(async () => {
            events.push(4);
            await lock.read(async () => {
                events.push(5);
                await sequentialPromises.get(1);
                events.push(6);
            });
            events.push(7);
        });
        promises.push(read2);

        await Promise.all(promises);

        expect(events).toEqual([0, 4, 1, 5, 2, 3, 6, 7]);
    });

    it('allows reentrant write locks', async () => {
        let lock = new Lock();
        let sequentialPromises = new SequentialPromises(2);
        let events = [];
        let promises = [];
        sequentialPromises.resolveNext();

        let write1 = lock.write(async () => {
            events.push(0);
            await lock.write(async () => {
                events.push(1);
                await sequentialPromises.get(0);
                events.push(2);
            });
            events.push(3);
            sequentialPromises.resolveNext();
        });
        promises.push(write1);

        let write2 = lock.write(async () => {
            events.push(4);
            await lock.write(async () => {
                events.push(5);
                await sequentialPromises.get(1);
                events.push(6);
            });
            events.push(7);
        });
        promises.push(write2);

        await Promise.allSettled(promises);

        expect(events).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('can upgrade to a write lock while holding a read lock',
        async () => {
        let lock = new Lock();
        await lock.read(async () => {
            await lock.read(async () => {
                await lock.write(async () => {
                    await lock.write(async () => {
                        await lock.read(async () => {

                        });
                    });
                });
            });
        });
    });

    it('can acquire a read lock with holding a write lock', async () => {
        let lock = new Lock();
        await lock.write(async () => {
            await lock.write(async () => {
                await lock.read(async () => {
                    await lock.read(async () => {
                        await lock.write(async () => {
                        });
                    });
                });
            });
        });
    });

    it('awaits locks the called function doesn\'t await', async () => {
        let lock = new Lock();
        let sequentialPromises = new SequentialPromises(2);
        let events = [];
        await lock.write(async () => {
            events.push(0);
            lock.read(async () => {
                await sequentialPromises.get(1);
                events.push(1);
            });
            lock.write(async () => {
                await sequentialPromises.get(0);
                events.push(2);
                sequentialPromises.resolveNext();
            });
            sequentialPromises.resolveNext();
        });

        expect(events).toEqual([0, 2, 1]);
    });

    it('propagates errors', async () => {
        let lock = new Lock();
        let throwing =
            lock.read(async () => {
                throw new Error('shouldn\'t happen');
            });
        await expect(throwing).rejects.toThrow('shouldn\'t happen');
    });
});

describe('createKafkaJsErrorFromLibRdKafkaError', () => {

    it('maps the flags of an error created by the native layer', () => {
        const librdKafkaError = LibrdKafkaError.create({
            code: LibrdKafkaError.codes.ERR__FATAL,
            message: 'Local: Fatal error',
            isFatal: true,
            isRetriable: false,
            isTxnRequiresAbort: true,
        });

        const err = createKafkaJsErrorFromLibRdKafkaError(librdKafkaError);

        expect(err.code).toBe(LibrdKafkaError.codes.ERR__FATAL);
        expect(err.fatal).toBe(true);
        expect(err.retriable).toBe(false);
        expect(err.abortable).toBe(true);
    });

    it('treats ERR__FATAL as fatal', () => {
        const err = createKafkaJsErrorFromLibRdKafkaError(LibrdKafkaError.create({
            code: LibrdKafkaError.codes.ERR__FATAL,
            message: 'Fatal error: Broker: Static consumer fenced by other consumer with same group.instance.id',
        }));

        expect(err.fatal).toBe(true);
    });

    it('keeps the flags of an error that already uses the KafkaJS names', () => {
        const err = createKafkaJsErrorFromLibRdKafkaError({
            code: LibrdKafkaError.codes.ERR__STATE,
            message: 'Local: Erroneous state',
            fatal: false,
            retriable: true,
            abortable: false,
        });

        expect(err.fatal).toBe(false);
        expect(err.retriable).toBe(true);
        expect(err.abortable).toBe(false);
    });
});
