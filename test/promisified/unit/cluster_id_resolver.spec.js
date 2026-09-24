jest.setTimeout(10000);

const { createClusterIdResolver } = require('../../../lib/kafkajs/_common');

/* Lets every pending microtask run, so that a fetch started by the resolver
 * or a continuation of a settled promise has been executed. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/* A fetch whose settlement is controlled by the test. */
const controllable = () => {
    const pending = [];
    const fetch = jest.fn(() => new Promise((resolve, reject) => { pending.push({ resolve, reject }); }));
    return { fetch, pending };
};

describe('createClusterIdResolver', () => {
    it('shares a single fetch among concurrent callers', async () => {
        const { fetch, pending } = controllable();
        const resolver = createClusterIdResolver(fetch);

        const results = [resolver(), resolver(), resolver()];
        /* The fetch is started asynchronously, on the next microtask. */
        await flush();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(pending).toHaveLength(1);

        pending[0].resolve('lkc-1');
        await expect(Promise.all(results)).resolves.toEqual(['lkc-1', 'lkc-1', 'lkc-1']);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does not cache a completed resolution', async () => {
        const { fetch, pending } = controllable();
        const resolver = createClusterIdResolver(fetch);

        const first = resolver();
        await flush();
        pending[0].resolve('lkc-1');
        await expect(first).resolves.toBe('lkc-1');

        /* A caller arriving after settlement starts a fresh fetch. */
        const second = resolver();
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        pending[1].resolve('lkc-1');
        await expect(second).resolves.toBe('lkc-1');
    });

    it('starts a fresh fetch from a continuation of the settled one', async () => {
        const { fetch, pending } = controllable();
        const resolver = createClusterIdResolver(fetch);

        const chained = resolver().then(() => resolver());
        await flush();
        pending[0].resolve('lkc-1');
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        pending[1].resolve('lkc-1');
        await expect(chained).resolves.toBe('lkc-1');
    });

    it('fails every concurrent caller when the fetch fails, and retries on the next call', async () => {
        const { fetch, pending } = controllable();
        const resolver = createClusterIdResolver(fetch);

        const failing = [resolver(), resolver()];
        await flush();
        pending[0].reject(new Error('Cluster id is not available'));
        for (const p of failing) {
            await expect(p).rejects.toThrow('Cluster id is not available');
        }

        const retry = resolver();
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        pending[1].resolve('lkc-1');
        await expect(retry).resolves.toBe('lkc-1');
    });

    it('turns a synchronously throwing fetch into a rejection and retries afterwards', async () => {
        let calls = 0;
        const resolver = createClusterIdResolver(() => {
            calls++;
            if (calls === 1) {
                throw new Error('not connected');
            }
            return Promise.resolve('lkc-1');
        });

        await expect(resolver()).rejects.toThrow('not connected');
        await expect(resolver()).resolves.toBe('lkc-1');
        expect(calls).toBe(2);
    });
});
