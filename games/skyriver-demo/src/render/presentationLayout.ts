/**
 * @file presentationLayout.ts — the canyon as it is drawn: the derived layout, raised and tiled
 * around the winding loop (T7-3).
 *
 * derive.ts is hashed into the sim identity, so it stays untouched; this is a pure, GL-free mapping
 * from the derived layout to the drawn one, in *canyon space* (x across, z = v along the loop; see
 * canyonWarp.ts, which bends canyon space into the closed S-curving loop):
 *   - Rows tile the whole loop: the derived 11 rows are folded back and forth (with hashed jitter)
 *     to fill all CANYON_LOOP_LENGTH_M / cell rows, so the city has no end and the lap no U-turn.
 *   - Heights are re-graded per wall column into the T7-3 strata: the inner wall always clears the
 *     route's highest climb (~2.3 km) so the chase stays in a canyon from the grime to the heights.
 *     The derived grade (0..1) is kept, so the skyline keeps its seeded rhythm.
 *   - The inner wall is set back 70 m so setback tiers (city.ts) can project into the canyon.
 *   - Outer towers that would reach across into another stretch of the loop are dropped.
 */
import type { SkyriverCityLayout, SkyriverTower } from '../sim/derive';
import { CHASM_BOUNDS } from '../sim/systems';
import { CANYON_LOOP_LENGTH_M, foldsInsideBend, intrudesOtherStretch, wrapCanyonV } from './canyonWarp';
import { routeAltitude } from './routeProfile';

/**
 * R17 podium lots: inner-wall lots cut down to a podium (the wall face still clears the route by
 * PODIUM_ROUTE_CLEARANCE_M over the nearby stretch), their full height handed to the massing pass
 * (city.ts), which raises a cluster or a stepped shaft from the podium. Down the canyon the skyline
 * becomes clusters of towers of different heights instead of one cliff edge. Keyed by tower object.
 */
const podiumLots = new WeakMap<SkyriverTower, number>();
const PODIUM_SHARE = 0.45;
const PODIUM_ROUTE_CLEARANCE_M = 650;
const PODIUM_MIN_DROP_M = 400;

/** The full height a podium lot's towers rise back to (undefined for an ordinary lot). */
export function podiumLotHeight(tower: SkyriverTower): number | undefined {
  return podiumLots.get(tower);
}

/** Derived height range (derive.ts TOWER_MIN/MAX_HEIGHT_M), used to recover each tower's grade. */
const DERIVED_MIN_HEIGHT_M = 240;
const DERIVED_MAX_HEIGHT_M = 1900;
/** Derived grid (derive.ts CITY_WALL_OFFSET_M / CITY_CELL_M), used to recover the column index. */
const DERIVED_WALL_OFFSET_M = 560;

/** Lowest roof of the inner wall: above the route's highest climb and the free-flight ceiling. */
export const SKYRIVER_ROOFLINE_MIN_M = 2500;

const INNER_SETBACK_M = 70;

/**
 * Height band per column, inner first: [floor, span]. Inner walls tall (the canyon), outer columns
 * step down, and the outermost carry the tallest spears (city.ts adds those).
 */
const COLUMN_BANDS: readonly (readonly [number, number])[] = Object.freeze([
  [SKYRIVER_ROOFLINE_MIN_M, 1300],
  [2000, 1600],
  [1500, 1900],
  [900, 2300],
]);

/** R17: tallest outer spire the height yarn may raise, metres. */
const YARN_SPIRE_MAX_M = 6200;
export const SKYRIVER_PRESENTED_MAX_HEIGHT_M = Math.max(YARN_SPIRE_MAX_M, ...COLUMN_BANDS.map(([floor, span]) => floor + span));

/**
 * R17 height yarn and aspect variety (operator: "even plateaus", "near-square slabs dominate").
 * Each lot gets an irregular height ratio to its neighbours and, on the outer columns, a footprint
 * archetype: slender blades (1:4-1:6), wide-but-low plateau blocks, a few very tall spires, the rest
 * a broad scatter. The inner wall only ever rises (it is the canyon, and the signage reads its
 * heights); it keeps its floor above the route's highest climb. Hashed per lot, so pure per seed.
 */
function applyYarn(tower: SkyriverTower, column: number, v: number, r: number): SkyriverTower {
  const h = hash01(tower.x * 0.0091 + v * 0.0137 + r * 3.1 + 0.77);
  const k = hash01(h * 53.1 + v * 0.0021);
  if (column === 0) {
    // Inner wall: a quarter of the lots rise well clear of the plateau, a half a little, a quarter not.
    const rise = h < 0.25 ? 600 + k * 700 : h < 0.75 ? k * 320 : 0;
    return { ...tower, height: tower.height + rise };
  }
  if (h < 0.15) {
    // Wide-but-low plateau block.
    return { ...tower, width: tower.width * 1.35, depth: tower.depth * 1.3, height: Math.max(600, tower.height * (0.42 + 0.16 * k)) };
  }
  if (h < 0.3) {
    // Slender blade, 1:4 to 1:6, long along the canyon or across it.
    const long = Math.max(tower.width, tower.depth) * 1.15;
    const thin = long / (4 + 2 * k);
    const along = hash01(k * 17.3 + 1.1) < 0.6;
    return { ...tower, width: along ? thin : long, depth: along ? long : thin, height: tower.height * (1.1 + 0.3 * k) };
  }
  if (h < 0.37) {
    // A few very tall spires: 2-3x their neighbours on a narrow footprint.
    return { ...tower, width: tower.width * 0.5, depth: tower.depth * 0.5, height: Math.min(YARN_SPIRE_MAX_M, tower.height * (2.0 + 0.6 * k)) };
  }
  // The rest: an irregular scatter (no two neighbours at one height).
  return { ...tower, height: tower.height * (0.62 + 0.75 * k * k + 0.12 * hash01(k * 9.1)) };
}

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
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const tower of layout.towers) {
    minZ = Math.min(minZ, tower.z);
    maxZ = Math.max(maxZ, tower.z);
  }
  const derivedRows = Math.round((maxZ - minZ) / cell) + 1;
  const loopRows = Math.round(CANYON_LOOP_LENGTH_M / cell);
  if (Math.abs(loopRows * cell - CANYON_LOOP_LENGTH_M) > 1) throw new Error('SKYRIVER_LOOP_NOT_ROW_MULTIPLE');

  const towers: SkyriverTower[] = [];
  // Row r sits at v = (r - loopRows / 2) * cell, so the derived rows (centred on z = 0) land on
  // themselves and the free-flight box keeps its exact derived walls.
  for (let r = 0; r < loopRows; r += 1) {
    const v = wrapCanyonV((r - loopRows / 2) * cell);
    const derivedIndex = Math.round((v - minZ) / cell);
    let sourceZ: number;
    let cloned = false;
    if (derivedIndex >= 0 && derivedIndex < derivedRows) {
      sourceZ = minZ + derivedIndex * cell;
    } else {
      // Fold back and forth through the derived rows.
      const period = 2 * (derivedRows - 1);
      const k = ((derivedIndex % period) + period) % period;
      sourceZ = minZ + (k < derivedRows ? k : period - k) * cell;
      cloned = true;
    }
    for (const source of layout.towers) {
      if (Math.abs(source.z - sourceZ) > 0.5) continue;
      const sign = Math.sign(source.x) || 1;
      let tower: SkyriverTower = { ...source, z: v };
      if (cloned) {
        const h = hash01(source.x * 0.031 + v * 0.017 + r);
        const width = source.width * (0.85 + 0.3 * h);
        const minimumCentre = CHASM_BOUNDS.maxX + width / 2;
        tower = {
          ...tower,
          x: Math.abs(source.x) < minimumCentre ? sign * minimumCentre : source.x,
          width,
          depth: source.depth * (0.85 + 0.3 * hash01(h * 91.7 + r)),
          height: source.height * (0.9 + 0.2 * hash01(h * 13.1 + 7)),
        };
      }
      // R12: strongly varied slab widths along the canyon (0.6x-1.6x depth): narrow blades next to
      // broad plates, so the walls read as distinct shapes.
      const widthHash = hash01(tower.x * 0.0131 + v * 0.0071 + r * 1.7);
      const column = columnOf(tower, cell);
      tower = {
        ...tower,
        x: tower.x + sign * INNER_SETBACK_M,
        depth: tower.depth * (0.6 + 1.0 * widthHash * widthHash),
        height: regrade(tower, cell),
      };
      // The free-flight box keeps its exact walls (|v| < 650); everywhere else the skyline varies.
      let podiumFull: number | undefined;
      if (Math.abs(v) >= 650) {
        tower = applyYarn(tower, column, v, r);
        if (column === 0 && hash01(tower.x * 0.0057 + v * 0.0193 + r * 0.7 + 2.9) < PODIUM_SHARE) {
          let routeTop = 0;
          for (let dv = -450; dv <= 450; dv += 150) routeTop = Math.max(routeTop, routeAltitude(v + dv));
          const podium = Math.max(700, routeTop + PODIUM_ROUTE_CLEARANCE_M);
          if (podium < tower.height - PODIUM_MIN_DROP_M) {
            podiumFull = tower.height;
            tower = { ...tower, height: podium };
          }
        }
      }
      const half = Math.max(tower.width, tower.depth) * 0.5;
      if (Math.abs(tower.x) > 900 && intrudesOtherStretch(tower.x, tower.z, half)) continue;
      // T7-5: tighter S-bends — drop footprints that would fold back through a bend's centre.
      if (Math.abs(tower.x) > 600 && foldsInsideBend(tower.x, tower.z, half)) continue;
      if (podiumFull !== undefined) podiumLots.set(tower, podiumFull);
      towers.push(tower);
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
