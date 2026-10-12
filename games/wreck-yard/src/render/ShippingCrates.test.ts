import { describe, expect, it } from 'vitest';
import { createCrateSpawns } from '../sim/storage';
import type { CrateFace, YardBody } from '../sim/state';
import { crateLook } from './ShippingCrates';

function crateWith(crateFace: CrateFace | undefined): YardBody {
  const [spawn] = createCrateSpawns('returns');
  if (!spawn) throw new Error('TEST_NO_RETURNS_CRATE');
  return { ...spawn.body, crateFace };
}

describe('crateLook', () => {
  it('draws a crate with no face as the default light crate', () => {
    expect(crateLook(crateWith(undefined))).toBe('light-up');
  });

  it('gives each light arrow its own look', () => {
    expect(crateLook(crateWith({ tone: 'light', arrow: 'up' }))).toBe('light-up');
    expect(crateLook(crateWith({ tone: 'light', arrow: 'right' }))).toBe('light-right');
    expect(crateLook(crateWith({ tone: 'light', arrow: 'down' }))).toBe('light-down');
    expect(crateLook(crateWith({ tone: 'light', arrow: 'left' }))).toBe('light-left');
  });

  it('draws a dark crate as the dark look', () => {
    expect(crateLook(crateWith({ tone: 'dark' }))).toBe('dark');
  });
});
