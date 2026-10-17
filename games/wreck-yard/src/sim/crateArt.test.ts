import { describe, expect, it } from 'vitest';
import { STORAGE } from './attractions';
import { crateTone, storageCrateFaces, type StorageGrid } from './crateArt';
import { createCrateSpawns } from './storage';

const GRID: StorageGrid = { columns: STORAGE.columns, rows: STORAGE.rows, tiers: STORAGE.tiers };
const EAST = GRID.columns - 1;

/** One step for each arrow on the east face. Right is north (a smaller row). Left is south. */
const STEP = {
  up: { row: 0, tier: 1 },
  right: { row: -1, tier: 0 },
  left: { row: 1, tier: 0 },
} as const;

describe('storage crate faces', () => {
  it('runs one arrow maze through every light crate on the east face and out of the top', () => {
    let lightCount = 0;
    for (let tier = 0; tier < GRID.tiers; tier++) for (let row = 0; row < GRID.rows; row++) {
      if (storageCrateFaces(EAST, row, tier, GRID).east.tone === 'light') lightCount += 1;
    }

    const visited = new Set<string>();
    let row = GRID.rows - 1;
    let tier = 0;
    while (tier < GRID.tiers) {
      const face = storageCrateFaces(EAST, row, tier, GRID).east;
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

  it('centres the worried face on the south row', () => {
    for (let tier = 0; tier < GRID.tiers; tier++) {
      for (let column = 0; column < GRID.columns; column++) {
        const mirror = GRID.columns - 1 - column;
        const face = storageCrateFaces(column, GRID.rows - 1, tier, GRID).south;
        expect(face.tone).toBe(storageCrateFaces(mirror, GRID.rows - 1, tier, GRID).south.tone);
      }
    }
  });

  it('gives the corner crate the maze on its east face and a plain light face on its south face', () => {
    const corner = storageCrateFaces(EAST, GRID.rows - 1, GRID.tiers - 1, GRID);
    expect(corner.east).toEqual({ tone: 'dark' });
    expect(corner.south).toEqual({ tone: 'light', arrow: 'up' });
  });

  it('gives a maze wall off the front row a dark frame, and the corner a light frame from its south face', () => {
    expect(storageCrateFaces(EAST, 3, 7, GRID).frame).toBe('dark');
    expect(storageCrateFaces(EAST, GRID.rows - 1, GRID.tiers - 1, GRID).frame).toBe('light');
  });

  it('gives a dark crate a dark face where it has no art, so a knocked neighbour shows no light label', () => {
    // A maze wall off the front row: dark east art, and no south art.
    expect(storageCrateFaces(EAST, 3, 7, GRID).south).toEqual({ tone: 'dark' });
    // A dark cell of the front art, away from the east column: no east art.
    expect(storageCrateFaces(1, GRID.rows - 1, 7, GRID).east).toEqual({ tone: 'dark' });
    // A light crate keeps the default light face.
    expect(storageCrateFaces(0, 0, 0, GRID)).toEqual({ east: { tone: 'light', arrow: 'up' }, south: { tone: 'light', arrow: 'up' }, frame: 'light' });
  });

  it('gives a dark cell of the front art a dark frame', () => {
    expect(storageCrateFaces(1, GRID.rows - 1, 7, GRID).frame).toBe('dark');
  });

  it('builds 400 storage crates with unique ids, 34 of them dark (20 maze walls, 14 face cells)', () => {
    const crates = createCrateSpawns('storage').map((spawn) => spawn.body);
    expect(new Set(crates.map((body) => body.id)).size).toBe(STORAGE.count);
    const dark = crates.filter((body) => body.crateFaces && crateTone(body.crateFaces) === 'dark');
    expect(dark).toHaveLength(34);
  });
});
