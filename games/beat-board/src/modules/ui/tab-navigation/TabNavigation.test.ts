import { describe, it, expect } from 'vitest';
import { createTabStore } from './TabNavigation';

const sampleTabs = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'profile', label: 'Profile' },
];

describe('TabNavigation', () => {
  it('setActive changes activeTabId', () => {
    const store = createTabStore(sampleTabs, 'home');
    store.getState().setActive('shop');
    expect(store.getState().activeTabId).toBe('shop');
  });

  it('initializes with defaultTabId', () => {
    const store = createTabStore(sampleTabs, 'profile');
    expect(store.getState().activeTabId).toBe('profile');
  });

  it('initializes with first tab when no defaultTabId', () => {
    const store = createTabStore(sampleTabs);
    expect(store.getState().activeTabId).toBe('home');
  });

  it('setBadge updates badge count', () => {
    const store = createTabStore(sampleTabs, 'home');
    store.getState().setBadge('shop', 3);
    const shopTab = store.getState().tabs.find((t) => t.id === 'shop');
    expect(shopTab?.badge).toBe(3);
  });

  it('clearBadge removes badge', () => {
    const store = createTabStore(sampleTabs, 'home');
    store.getState().setBadge('shop', 5);
    store.getState().clearBadge('shop');
    const shopTab = store.getState().tabs.find((t) => t.id === 'shop');
    expect(shopTab?.badge).toBeUndefined();
  });

  it('setActive with unknown tab does not crash', () => {
    const store = createTabStore(sampleTabs, 'home');
    expect(() => store.getState().setActive('nonexistent')).not.toThrow();
    expect(store.getState().activeTabId).toBe('home');
  });
});
