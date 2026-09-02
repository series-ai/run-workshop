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
});
