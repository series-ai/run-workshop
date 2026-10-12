import { describe, expect, it } from 'vitest';
import { STORAGE } from './attractions';
import { storageCrateFace, type StorageGrid } from './crateArt';
import { createCrateSpawns } from './storage';

const GRID: StorageGrid = { columns: STORAGE.columns, rows: STORAGE.rows, tiers: STORAGE.tiers };
const EAST = GRID.columns - 1;

/** One step for each arrow on the east face. Right is north (a smaller row). Left is south. */
const STEP = {
  up: { row: 0, tier: 1 },
  down: { row: 0, tier: -1 },
  right: { row: -1, tier: 0 },
  left: { row: 1, tier: 0 },
} as const;

describe('storage crate faces', () => {
  it('runs one arrow maze through every light crate on the east face and out of the top', () => {
    let lightCount = 0;
    for (let tier = 0; tier < GRID.tiers; tier++) for (let row = 0; row < GRID.rows; row++) {
      if (storageCrateFace(EAST, row, tier, GRID).tone === 'light') lightCount += 1;
    }

    const visited = new Set<string>();
    let row = GRID.rows - 1;
    let tier = 0;
    while (tier < GRID.tiers) {
      const face = storageCrateFace(EAST, row, tier, GRID);
      if (face.tone !== 'light') throw new Error(`MAZE_STEPS_ON_DARK_CRATE:${row}:${tier}`);
      const key = `${row}:${tier}`;
      if (visited.has(key)) throw new Error(`MAZE_REVISITS_CRATE:${key}`);
      visited.add(key);
      row += STEP[face.arrow].row;
      tier += STEP[face.arrow].tier;
      if (tier < GRID.tiers && (row < 0 || row >= GRID.rows)) throw new Error(`MAZE_LEAVES_FACE_SIDEWAYS:${row}:${tier}`);
    }

    expect(lightCount).toBe(30);
    expect(visited.size).toBe(lightCount);
    expect(row).toBe(0);
  });

  it('builds 400 storage crates with unique ids, 33 of them dark', () => {
    const crates = createCrateSpawns('storage').map((spawn) => spawn.body);
    expect(new Set(crates.map((body) => body.id)).size).toBe(STORAGE.count);
    expect(crates.filter((body) => body.crateFace?.tone === 'dark')).toHaveLength(33);
  });
});
