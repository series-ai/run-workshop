import type { PaletteKey } from '../style/artStyle';

export type VoxelGrid = {
  dims: { x: number; y: number; z: number };
  cells: Uint8Array; // 0 = empty, 1..N = palette index
};

export const PALETTE_INDEX_TO_KEY: readonly PaletteKey[] = [
  'floor', // 0 (unused)
  'signalOrange', // 1
  'orangeShade', // 2
  'concreteLit', // 3
  'concreteShade', // 4
  'teal', // 5
  'mustard', // 6
  'rust', // 7
  'ink', // 8
  'spark', // 9
  'glow', // 10
  'skyline', // 11
];

export function getPaletteKeyIndex(key: PaletteKey): number {
  const idx = PALETTE_INDEX_TO_KEY.indexOf(key);
  return idx > 0 ? idx : 8; // fallback to ink
}

function lcg(seed: number): () => number {
  let s = (seed ^ 0x12345678) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildConcreteBlock(
  _seed: number,
  size: readonly [number, number, number],
): VoxelGrid {
  const [sx, sy, sz] = size;
  const cells = new Uint8Array(sx * sy * sz);
  const concreteIdx = getPaletteKeyIndex('concreteLit');
  cells.fill(concreteIdx);
  return {
    dims: { x: sx, y: sy, z: sz },
    cells,
  };
}

export function buildCar(
  seed: number,
  paint: PaletteKey,
  crush: number, // 0 = pristine, 1 = severely flattened
): VoxelGrid {
  const rand = lcg(seed);
  const sx = 10;
  const sz = 18;
  const maxHeight = Math.max(3, Math.round(7 * (1 - crush * 0.5)));
  const sy = maxHeight;

  const cells = new Uint8Array(sx * sy * sz);
  const paintIdx = getPaletteKeyIndex(paint);
  const rustIdx = getPaletteKeyIndex('rust');
  const inkIdx = getPaletteKeyIndex('ink');

  const idx = (x: number, y: number, z: number) => x + y * sx + z * sx * sy;

  // Chassis base
  for (let z = 2; z < sz - 2; z++) {
    for (let x = 1; x < sx - 1; x++) {
      cells[idx(x, 0, z)] = inkIdx; // chassis underside
      cells[idx(x, 1, z)] = rand() < 0.15 ? rustIdx : paintIdx; // body bottom
    }
  }

  // Wheels (ink)
  const wheelZs = [4, 5, sz - 5, sz - 4];
  for (const wz of wheelZs) {
    cells[idx(0, 0, wz)] = inkIdx;
    cells[idx(sx - 1, 0, wz)] = inkIdx;
  }

  // Cabin / hood / trunk
  const cabinY = Math.min(sy - 1, 4);
  for (let z = 3; z < sz - 3; z++) {
    for (let x = 2; x < sx - 2; x++) {
      // Hood (front: z < 7)
      if (z < 7) {
        cells[idx(x, 2, z)] = rand() < 0.2 ? rustIdx : paintIdx;
      }
      // Cabin (middle: 7 <= z <= 13)
      else if (z <= 13) {
        for (let y = 2; y <= cabinY; y++) {
          if (y === cabinY && (x === 2 || x === sx - 3 || z === 7 || z === 13)) {
            cells[idx(x, y, z)] = inkIdx; // window pillars
          } else {
            cells[idx(x, y, z)] = rand() < 0.1 ? rustIdx : paintIdx;
          }
        }
      }
      // Trunk (back: z > 13)
      else {
        cells[idx(x, 2, z)] = rand() < 0.2 ? rustIdx : paintIdx;
      }
    }
  }

  return {
    dims: { x: sx, y: sy, z: sz },
    cells,
  };
}

export function buildDebrisChips(
  seed: number,
  count: number,
): VoxelGrid {
  const rand = lcg(seed);
  const sx = 8;
  const sy = 2;
  const sz = 8;
  const cells = new Uint8Array(sx * sy * sz);

  const idx = (x: number, y: number, z: number) => x + y * sx + z * sx * sz;
  const rustIdx = getPaletteKeyIndex('rust');
  const inkIdx = getPaletteKeyIndex('ink');
  const concreteIdx = getPaletteKeyIndex('concreteLit');

  const swatches = [rustIdx, inkIdx, concreteIdx];

  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * sx);
    const z = Math.floor(rand() * sz);
    const y = rand() < 0.8 ? 0 : 1;
    const swatch = swatches[Math.floor(rand() * swatches.length)];
    cells[idx(x, y, z)] = swatch;
  }

  return {
    dims: { x: sx, y: sy, z: sz },
    cells,
  };
}
