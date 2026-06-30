import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore, resetToastStore } from './ToastNotifications';

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`);
  }
  return item;
}

beforeEach(() => {
  resetToastStore();
});

describe('ToastNotifications', () => {
  it('show() adds toast and returns ID', () => {
    const id = useToastStore.getState().show({ message: 'Hello', severity: 'info' });
    expect(typeof id).toBe('string');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(requireAt(useToastStore.getState().toasts, 0).id).toBe(id);
  });

  it('dismiss() removes the correct toast', () => {
    const id1 = useToastStore.getState().show({ message: 'First', severity: 'info' });
    useToastStore.getState().show({ message: 'Second', severity: 'success' });
    useToastStore.getState().dismiss(id1);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(requireAt(toasts, 0).message).toBe('Second');
  });

  it('dismissAll() clears all toasts', () => {
    useToastStore.getState().show({ message: 'A', severity: 'info' });
    useToastStore.getState().show({ message: 'B', severity: 'error' });
    useToastStore.getState().dismissAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('maxToasts limit: oldest removed when at limit', () => {
    for (let i = 0; i < 5; i++) {
      useToastStore.getState().show({ message: `Toast ${i}`, severity: 'info' });
    }
    expect(useToastStore.getState().toasts).toHaveLength(5);
    useToastStore.getState().show({ message: 'Overflow', severity: 'warning' });
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(5);
    expect(requireAt(toasts, toasts.length - 1).message).toBe('Overflow');
    expect(requireAt(toasts, 0).message).toBe('Toast 1');
  });

  it('auto-dismiss via durationMs', () => {
    vi.useFakeTimers();
    const id = useToastStore.getState().show({ message: 'Temp', severity: 'info', durationMs: 1000 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts.find((t) => t.id === id)).toBeUndefined();
    vi.useRealTimers();
  });
});
