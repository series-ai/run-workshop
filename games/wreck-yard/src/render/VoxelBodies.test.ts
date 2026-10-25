import { describe, expect, it } from 'vitest';
import { crateTone } from '../sim/crateArt';
import { createCrateSpawns } from '../sim/storage';
import type { YardBody } from '../sim/state';
import { bodyPalette } from './VoxelBodies';

/** The first storage crate with the given tone. */
function storageCrate(tone: 'light' | 'dark'): YardBody {
  const body = createCrateSpawns('storage')
    .map((spawn) => spawn.body)
    .find((crate) => crate.crateFaces !== undefined && crateTone(crate.crateFaces) === tone);
  if (!body) throw new Error(`TEST_NO_${tone.toUpperCase()}_STORAGE_CRATE`);
  return body;
}

/** The red, green, and blue bytes of the crate wood slot (palette slot 2). */
function woodBytes(palette: ReturnType<typeof bodyPalette>): number {
  return palette[8]! + palette[9]! + palette[10]!;
}

describe('bodyPalette', () => {
  it('keeps a cut dark crate in the dark stain', () => {
    const dark = storageCrate('dark');
    const cut: YardBody = { ...dark, voxels: dark.voxels.slice() };
    cut.voxels[0] = 0;
    expect(bodyPalette(cut)).toBe(bodyPalette(dark));
    expect(woodBytes(bodyPalette(dark))).toBeLessThan(woodBytes(bodyPalette(storageCrate('light'))));
  });
});
