/**
 * @file presentationLayout.ts — the canyon as it is drawn: the derived layout, raised and lengthened.
 *
 * T6R P0 "camera escapes the chasm": the derived inner wall (src/sim/derive.ts) tops out between
 * ~650 m and ~1400 m, while free flight may climb to CHASM_BOUNDS.maxY = 2000 m. Any climb, and any
 * camera pitch above a few degrees, therefore framed empty sky over the roofs.
 *
 * derive.ts is hashed into the sim identity (src/sim/identity.ts lists it as a sim source), so the fix
 * cannot live there without re-deriving the runtime identity. This module is a pure, GL-free mapping
 * from the derived layout to the drawn one instead:
 *   - Heights are re-graded per wall column. The inner column always clears the flight ceiling
 *     (`SKYRIVER_ROOFLINE_MIN_M` > CHASM_BOUNDS.maxY), so the flyable volume is a closed chasm.
 *     The derived grade (0..1) is kept, so the skyline keeps its seeded rhythm.
 *   - The canyon is extended by `EXTRA_ROWS_PER_END` rows at each end, cloned from the mirrored
 *     derived rows with hashed jitter, so the view down the canyon has a far vanishing point.
 *
 * Every consumer of tower geometry (city, god rays, searchlights) reads this layout, so they agree.
 * Presentation only: nothing here reaches simulation or checksums.
 */
import type { SkyriverCityLayout, SkyriverTower } from '../sim/derive';
import { CHASM_BOUNDS } from '../sim/systems';

/** Derived height range (derive.ts TOWER_MIN/MAX_HEIGHT_M), used to recover each tower's grade. */
const DERIVED_MIN_HEIGHT_M = 240;
const DERIVED_MAX_HEIGHT_M = 1900;
/** Derived grid (derive.ts CITY_WALL_OFFSET_M / CITY_CELL_M), used to recover the column index. */
const DERIVED_WALL_OFFSET_M = 560;

/** Lowest roof of the inner wall. Above the sim's free-flight ceiling, with camera headroom. */
export const SKYRIVER_ROOFLINE_MIN_M = 2200;

/** Height band per column, inner first: [floor, span]. Inner walls tall, outer ones step down. */
const COLUMN_BANDS: readonly (readonly [number, number])[] = Object.freeze([
  [SKYRIVER_ROOFLINE_MIN_M, 1300],
  [1800, 1500],
  [1300, 1800],
  [900, 2100],
]);

/** Rows cloned past each end: the canyon then runs to |z| ~ 4.3 km, so even the autopilot's U-turns
 * look down a walled canyon rather than out of its open end. */
const EXTRA_ROWS_PER_END = 8;

export const SKYRIVER_PRESENTED_MAX_HEIGHT_M = Math.max(...COLUMN_BANDS.map(([floor, span]) => floor + span));

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function columnOf(tower: SkyriverTower, cell: number): number {
  const column = Math.round((Math.abs(tower.x) - DERIVED_WALL_OFFSET_M) / cell);
  return Math.min(COLUMN_BANDS.length - 1, Math.max(0, column));
}

function regrade(tower: SkyriverTower, cell: number): number {
  const grade = Math.min(1, Math.max(0, (tower.height - DERIVED_MIN_HEIGHT_M) / (DERIVED_MAX_HEIGHT_M - DERIVED_MIN_HEIGHT_M)));
  const [floor, span] = COLUMN_BANDS[columnOf(tower, cell)]!;
  return floor + grade * span;
}

const cache = new Map<number, SkyriverCityLayout>();

/** Pure: the same derived layout always yields the same presented layout. Cached per seed. */
export function presentCityLayout(layout: SkyriverCityLayout): SkyriverCityLayout {
  const cached = cache.get(layout.seed);
  if (cached !== undefined && cached.towers.length > 0) return cached;

  const cell = layout.cell;
  const towers: SkyriverTower[] = layout.towers.map((tower) => ({ ...tower, height: regrade(tower, cell) }));

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const tower of layout.towers) {
    minZ = Math.min(minZ, tower.z);
    maxZ = Math.max(maxZ, tower.z);
  }

  // Clone the end rows outward, mirrored (row k beyond the end copies row k inside it).
  for (let k = 1; k <= EXTRA_ROWS_PER_END; k += 1) {
    for (const end of [-1, 1] as const) {
      // Mirror back and forth through the derived rows, so any extension length has a source row.
      const span = Math.round((maxZ - minZ) / cell);
      const fold = (k - 1) % (2 * span);
      const offset = fold <= span ? fold : 2 * span - fold;
      const sourceZ = end > 0 ? maxZ - offset * cell : minZ + offset * cell;
      const targetZ = end > 0 ? maxZ + k * cell : minZ - k * cell;
      for (const source of layout.towers) {
        if (Math.abs(source.z - sourceZ) > 0.5) continue;
        const h = hash01(source.x * 0.031 + targetZ * 0.017 + k);
        const width = source.width * (0.85 + 0.3 * h);
        const sign = Math.sign(source.x) || 1;
        // Keep the corridor clear, exactly as derive.ts does.
        const minimumCentre = CHASM_BOUNDS.maxX + width / 2;
        const x = Math.abs(source.x) < minimumCentre ? sign * minimumCentre : source.x;
        const jittered: SkyriverTower = {
          ...source,
          x,
          z: targetZ,
          width,
          depth: source.depth * (0.85 + 0.3 * hash01(h * 91.7 + k)),
          height: source.height * (0.9 + 0.2 * hash01(h * 13.1 + 7)),
        };
        towers.push({ ...jittered, height: regrade(jittered, cell) });
      }
    }
  }

  const presented: SkyriverCityLayout = Object.freeze({
    seed: layout.seed,
    cell,
    maxHeight: SKYRIVER_PRESENTED_MAX_HEIGHT_M,
    towers: Object.freeze(towers),
  });
  cache.set(layout.seed, presented);
  return presented;
}
