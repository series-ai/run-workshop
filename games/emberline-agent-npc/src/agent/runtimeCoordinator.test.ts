import { describe, expect, it } from 'vitest';
import { RuntimeCoordinator } from './runtimeCoordinator.ts';

interface TestRuntime {
    id: number;
}

describe('RuntimeCoordinator', () => {
    it('clears a failed initial load so a later request can retry', async () => {
        let attempts = 0;
        const coordinator = new RuntimeCoordinator<TestRuntime>({
            create: async () => {
                attempts += 1;
                if (attempts === 1) throw new Error('open failed');
                return { id: attempts };
            },
            close: async () => undefined,
            remove: async () => undefined,
        });

        await expect(coordinator.get()).rejects.toThrow('open failed');
        await expect(coordinator.get()).resolves.toEqual({ id: 2 });
        expect(attempts).toBe(2);
    });

    it('serializes overlapping reopen and reset operations', async () => {
        let nextId = 0;
        const events: string[] = [];
        const coordinator = new RuntimeCoordinator<TestRuntime>({
            create: async () => ({ id: ++nextId }),
            close: async runtime => {
                events.push(`close:${runtime.id}`);
            },
            remove: async runtime => {
                events.push(`remove:${runtime.id}`);
            },
        });
        expect((await coordinator.get()).id).toBe(1);

        const reopened = coordinator.reopen();
        const reset = coordinator.reset();

        await expect(reopened).resolves.toEqual({ id: 2 });
        await expect(reset).resolves.toEqual({ id: 3 });
        await expect(coordinator.get()).resolves.toEqual({ id: 3 });
        expect(events).toEqual(['close:1', 'close:2', 'remove:2']);
    });
});
