import { describe, it, expect, beforeEach } from 'vitest';
import { useModalStore, resetModalStore } from './ModalStack';
import { ModalPriority } from './types';

function requireAt<T>(values: T[], index: number): T {
  const value = values[index];
  expect(value).toBeDefined();
  return value as T;
}

beforeEach(() => {
  resetModalStore();
});

describe('ModalStack', () => {
  it('push adds a modal to the stack', () => {
    useModalStore.getState().push({ id: 'test', component: 'TestModal' });
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(requireAt(useModalStore.getState().stack, 0).id).toBe('test');
  });

  it('pop removes the top modal', () => {
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().push({ id: 'b', component: 'B' });
    useModalStore.getState().pop();
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(requireAt(useModalStore.getState().stack, 0).id).toBe('a');
  });

  it('popAll clears the stack', () => {
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().push({ id: 'b', component: 'B' });
    useModalStore.getState().popAll();
    expect(useModalStore.getState().stack).toHaveLength(0);
  });

  it('replace swaps the top modal', () => {
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().replace({ id: 'b', component: 'B' });
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(requireAt(useModalStore.getState().stack, 0).id).toBe('b');
  });

  it('replace on empty stack pushes new modal', () => {
    useModalStore.getState().replace({ id: 'b', component: 'B' });
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(requireAt(useModalStore.getState().stack, 0).id).toBe('b');
  });

  it('isOpen returns true for modal in stack', () => {
    useModalStore.getState().push({ id: 'settings', component: 'Settings' });
    expect(useModalStore.getState().isOpen('settings')).toBe(true);
  });

  it('isOpen returns false for modal not in stack', () => {
    expect(useModalStore.getState().isOpen('missing')).toBe(false);
  });

  it('maxDepth is respected', () => {
    for (let i = 0; i < 10; i++) {
      useModalStore.getState().push({ id: `m${i}`, component: `M${i}` });
    }
    expect(useModalStore.getState().stack).toHaveLength(5);
  });

  it('deduplicates by id in stack', () => {
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().push({ id: 'a', component: 'A' });
    expect(useModalStore.getState().stack).toHaveLength(1);
  });
});

describe('Suppression', () => {
  it('suppress queues new modals instead of showing them', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'a', component: 'A' });

    expect(useModalStore.getState().stack).toHaveLength(0);
    expect(useModalStore.getState().queue).toHaveLength(1);
    expect(requireAt(useModalStore.getState().queue, 0).id).toBe('a');
  });

  it('unsuppress shows the highest-priority queued modal and keeps the rest queued', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().push({ id: 'b', component: 'B' });
    useModalStore.getState().unsuppress();

    expect(useModalStore.getState().suppressed).toBe(false);
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(requireAt(useModalStore.getState().stack, 0).id).toBe('a');
    expect(useModalStore.getState().queue).toHaveLength(1);
    expect(requireAt(useModalStore.getState().queue, 0).id).toBe('b');
  });

  it('unsuppress respects maxDepth', () => {
    // Fill stack to 4
    for (let i = 0; i < 4; i++) {
      useModalStore.getState().push({ id: `s${i}`, component: `S${i}` });
    }
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'q1', component: 'Q1' });
    useModalStore.getState().push({ id: 'q2', component: 'Q2' });
    useModalStore.getState().unsuppress();

    // maxDepth is 5, so only 1 queued modal should be promoted
    expect(useModalStore.getState().stack).toHaveLength(5);
    expect(useModalStore.getState().queue).toHaveLength(1);
  });

  it('suppression deduplicates by id in queue', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().push({ id: 'a', component: 'A' });

    expect(useModalStore.getState().queue).toHaveLength(1);
  });

  it('suppression deduplicates across stack and queue', () => {
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'a', component: 'A' });

    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(useModalStore.getState().queue).toHaveLength(0);
  });

  it('isQueued returns true for queued modal', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'a', component: 'A' });

    expect(useModalStore.getState().isQueued('a')).toBe(true);
    expect(useModalStore.getState().isQueued('b')).toBe(false);
  });

  it('dequeue removes a modal from the queue', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'a', component: 'A' });
    useModalStore.getState().push({ id: 'b', component: 'B' });
    useModalStore.getState().dequeue('a');

    expect(useModalStore.getState().queue).toHaveLength(1);
    expect(requireAt(useModalStore.getState().queue, 0).id).toBe('b');
  });

  it('unsuppress with empty queue just lifts suppression', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().unsuppress();

    expect(useModalStore.getState().suppressed).toBe(false);
    expect(useModalStore.getState().queue).toHaveLength(0);
  });
});

describe('Priority ordering', () => {
  it('queued modals are sorted by priority (highest first)', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'low', component: 'Low', priority: ModalPriority.LOW });
    useModalStore.getState().push({ id: 'high', component: 'High', priority: ModalPriority.HIGH });
    useModalStore.getState().push({ id: 'normal', component: 'Normal', priority: ModalPriority.NORMAL });

    const queue = useModalStore.getState().queue;
    expect(requireAt(queue, 0).id).toBe('high');
    expect(requireAt(queue, 1).id).toBe('normal');
    expect(requireAt(queue, 2).id).toBe('low');
  });

  it('unsuppress shows highest-priority modal first', () => {
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'low', component: 'Low', priority: ModalPriority.LOW });
    useModalStore.getState().push({ id: 'critical', component: 'Crit', priority: ModalPriority.CRITICAL });
    useModalStore.getState().unsuppress();

    // Only the highest-priority modal should show immediately.
    const stack = useModalStore.getState().stack;
    expect(requireAt(stack, 0).id).toBe('critical');
    expect(useModalStore.getState().queue).toHaveLength(1);
    expect(requireAt(useModalStore.getState().queue, 0).id).toBe('low');
  });

  it('pop promotes next queued modal', () => {
    useModalStore.getState().push({ id: 'visible', component: 'V' });
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'queued', component: 'Q' });
    useModalStore.getState().unsuppress();

    expect(useModalStore.getState().stack).toHaveLength(2);
    expect(requireAt(useModalStore.getState().stack, 1).id).toBe('queued');

    // Pop the queued modal, leaving the original visible modal.
    useModalStore.getState().pop();
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(requireAt(useModalStore.getState().stack, 0).id).toBe('visible');
  });

  it('pop promotes from queue when stack has room', () => {
    // Fill stack to maxDepth
    for (let i = 0; i < 5; i++) {
      useModalStore.getState().push({ id: `s${i}`, component: `S${i}` });
    }
    // Queue extras (suppression needed to queue them)
    useModalStore.getState().suppress();
    useModalStore.getState().push({ id: 'waiting', component: 'W' });
    // Unsuppress — stack is full so 'waiting' stays queued
    useModalStore.getState().unsuppress();
    expect(useModalStore.getState().queue).toHaveLength(1);

    // Pop one — should promote 'waiting'
    useModalStore.getState().pop();
    expect(useModalStore.getState().stack).toHaveLength(5);
    expect(requireAt(useModalStore.getState().stack, 4).id).toBe('waiting');
    expect(useModalStore.getState().queue).toHaveLength(0);
  });
});
