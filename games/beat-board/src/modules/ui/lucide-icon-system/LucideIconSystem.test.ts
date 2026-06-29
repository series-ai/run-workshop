import { describe, it, expect } from 'vitest';
import { resolveIconName, isValidIconName, getAllIconNames } from './LucideIconSystem';
import { iconMap } from './config';

describe('LucideIconSystem', () => {
  it('resolveIconName returns correct lucide name for coin', () => {
    expect(resolveIconName('coin')).toBe('Coins');
  });

  it('resolveIconName returns correct lucide name for warning', () => {
    expect(resolveIconName('warning')).toBe('AlertTriangle');
  });

  it('resolveIconName returns correct lucide name for close', () => {
    expect(resolveIconName('close')).toBe('X');
  });

  it('isValidIconName returns true for valid name', () => {
    expect(isValidIconName('heart')).toBe(true);
  });

  it('isValidIconName returns false for invalid name', () => {
    expect(isValidIconName('banana')).toBe(false);
  });

  it('isValidIconName returns false for empty string', () => {
    expect(isValidIconName('')).toBe(false);
  });

  it('getAllIconNames returns all keys from iconMap', () => {
    const names = getAllIconNames();
    const mapKeys = Object.keys(iconMap);
    expect(names).toHaveLength(mapKeys.length);
    expect(names).toEqual(expect.arrayContaining(mapKeys));
  });

  it('getAllIconNames includes all expected icons', () => {
    const names = getAllIconNames();
    expect(names).toContain('coin');
    expect(names).toContain('trophy');
    expect(names).toContain('error');
  });
});
