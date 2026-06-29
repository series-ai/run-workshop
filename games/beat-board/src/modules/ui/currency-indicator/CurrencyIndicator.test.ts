import { describe, it, expect } from 'vitest';
import { formatBalance, createCurrencyIndicatorStore } from './CurrencyIndicator';

describe('formatBalance', () => {
  it('0 → "0"', () => expect(formatBalance(0)).toBe('0'));
  it('999 → "999"', () => expect(formatBalance(999)).toBe('999'));
  it('1000 → "1K"', () => expect(formatBalance(1000)).toBe('1K'));
  it('1500 → "1.5K"', () => expect(formatBalance(1500)).toBe('1.5K'));
  it('10000 → "10K"', () => expect(formatBalance(10000)).toBe('10K'));
  it('1000000 → "1M"', () => expect(formatBalance(1_000_000)).toBe('1M'));
  it('1500000 → "1.5M"', () => expect(formatBalance(1_500_000)).toBe('1.5M'));
  it('1000000000 → "1B"', () => expect(formatBalance(1_000_000_000)).toBe('1B'));
  it('-1000 → "-1K"', () => expect(formatBalance(-1000)).toBe('-1K'));
  it('-1500 → "-1.5K"', () => expect(formatBalance(-1500)).toBe('-1.5K'));
});

describe('createCurrencyIndicatorStore', () => {
  it('initializes with zero balance', () => {
    const store = createCurrencyIndicatorStore('coins');
    expect(store.getState().balance).toBe(0);
    expect(store.getState().formatted).toBe('0');
  });

  it('setBalance updates balance and formatted', () => {
    const store = createCurrencyIndicatorStore('coins');
    store.getState().setBalance(2500);
    expect(store.getState().balance).toBe(2500);
    expect(store.getState().formatted).toBe('2.5K');
  });

  it('adjustBalance computes delta', () => {
    const store = createCurrencyIndicatorStore('gems');
    store.getState().setBalance(1000);
    store.getState().adjustBalance(500);
    expect(store.getState().balance).toBe(1500);
    expect(store.getState().delta).toBe(500);
  });
});
