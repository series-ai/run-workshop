import { describe, it, expect, beforeEach } from 'vitest';
import { useBadgeStore, resetBadgeStore } from './BadgeNotifications';

function requireDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

beforeEach(() => {
  resetBadgeStore();
});

describe('BadgeNotifications', () => {
  it('set creates badge with isNew=true when count > 0', () => {
    useBadgeStore.getState().set('shop', 3);
    const badge = requireDefined(useBadgeStore.getState().badges['shop']);
    expect(badge.count).toBe(3);
    expect(badge.isNew).toBe(true);
  });

  it('set with count 0 sets isNew=false', () => {
    useBadgeStore.getState().set('shop', 0);
    const badge = requireDefined(useBadgeStore.getState().badges['shop']);
    expect(badge.isNew).toBe(false);
  });

  it('increment increases count by 1', () => {
    useBadgeStore.getState().set('shop', 5);
    useBadgeStore.getState().increment('shop');
    expect(requireDefined(useBadgeStore.getState().badges['shop']).count).toBe(6);
  });

  it('increment creates badge if not exists', () => {
    useBadgeStore.getState().increment('new-tab');
    expect(requireDefined(useBadgeStore.getState().badges['new-tab']).count).toBe(1);
  });

  it('increment caps at maxCount (99)', () => {
    useBadgeStore.getState().set('shop', 99);
    useBadgeStore.getState().increment('shop');
    expect(requireDefined(useBadgeStore.getState().badges['shop']).count).toBe(99);
  });

  it('clear sets count to 0', () => {
    useBadgeStore.getState().set('shop', 10);
    useBadgeStore.getState().clear('shop');
    expect(requireDefined(useBadgeStore.getState().badges['shop']).count).toBe(0);
  });

  it('markSeen sets isNew to false', () => {
    useBadgeStore.getState().set('shop', 3);
    useBadgeStore.getState().markSeen('shop');
    expect(requireDefined(useBadgeStore.getState().badges['shop']).isNew).toBe(false);
  });

  it('markSeen on nonexistent key does not crash', () => {
    expect(() => useBadgeStore.getState().markSeen('nope')).not.toThrow();
  });

  it('total sums all badge counts correctly', () => {
    useBadgeStore.getState().set('a', 3);
    useBadgeStore.getState().set('b', 7);
    useBadgeStore.getState().set('c', 0);
    expect(useBadgeStore.getState().total()).toBe(10);
  });
});
