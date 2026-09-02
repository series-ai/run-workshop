import { describe, expect, it } from 'vitest';
import { createLatestOperation } from './latestOperation.ts';

describe('latest operation', () => {
    it('does not let an aborted operation erase a newer reset retry', () => {
        const operations = createLatestOperation<string>();
        const send = operations.begin();
        const reset = operations.begin();

        expect(operations.settle(reset, 'reset')).toBe(true);
        expect(operations.settle(send, null)).toBe(false);
        expect(operations.retry()).toBe('reset');
    });

    it('drops a load value that resolves after a newer operation starts', async () => {
        const operations = createLatestOperation<string>();
        const load = operations.begin();
        const messages = operations.capture(load, Promise.resolve(['old message']));

        operations.begin();

        await expect(messages).resolves.toBeUndefined();
    });
});
