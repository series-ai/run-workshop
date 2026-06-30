import { create } from 'zustand';

export function formatBalance(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    return `${sign}${trimTrailingZeros(v)}B`;
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${trimTrailingZeros(v)}M`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    return `${sign}${trimTrailingZeros(v)}K`;
  }
  return `${amount}`;
}

function trimTrailingZeros(v: number): string {
  // Show up to 1 decimal place, remove trailing zeros
  const rounded = Math.round(v * 10) / 10;
  if (rounded === Math.floor(rounded)) {
    return `${Math.floor(rounded)}`;
  }
  return `${rounded}`;
}

interface CurrencyStore {
  id: string;
  balance: number;
  formatted: string;
  delta: number | null;
  setBalance(amount: number): void;
  adjustBalance(delta: number): void;
}

export function createCurrencyIndicatorStore(currencyId: string) {
  return create<CurrencyStore>((set, get) => ({
    id: currencyId,
    balance: 0,
    formatted: '0',
    delta: null,

    setBalance(amount: number) {
      const prev = get().balance;
      const delta = amount - prev;
      set({ balance: amount, formatted: formatBalance(amount), delta });
    },

    adjustBalance(delta: number) {
      const prev = get().balance;
      const next = prev + delta;
      set({ balance: next, formatted: formatBalance(next), delta });
    },
  }));
}
