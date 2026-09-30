import * as THREE from 'three';

/**
 * The city behind the yard: rings of flat building silhouettes with lit
 * windows, placed like the factory skyline (skylineShapes.ts) but farther out.
 * Everything is seeded, so the same city builds on every load.
 */

export type RoofKind = 'flat' | 'spire' | 'crown' | 'antenna' | 'waterTank';

export interface CityBuilding {
  readonly azimuthDeg: number;
  readonly width: number;
  readonly height: number;
  /** Number of setbacks: each tier above the first is narrower. */
  readonly setbacks: 0 | 1 | 2;
  readonly roof: RoofKind;
  /** Fraction of windows lit (0..1). */
  readonly lit: number;
  readonly seed: number;
}

export interface CityLayer {
  readonly distance: number;
  readonly baseY: number;
  readonly color: string;
  readonly buildings: readonly CityBuilding[];
}

/** A window or other lit rectangle in building-local meters (x across, y up). */
export interface LitRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: THREE.Color;
}

export interface CityBuildingGeometry {
  readonly shape: THREE.Shape;
  readonly windows: readonly LitRect[];
  /** Top of the spire, crown, or antenna of a tall tower, for an aviation light. */
  readonly beacon: readonly [number, number] | null;
}

function lcg(seed: number): () => number {
  let state = Math.imul(seed, 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Towers at least this tall (m) carry an aviation light on their spire, crown, or antenna. */
export const BEACON_MIN_HEIGHT = 45;

/** Floor and window-column spacing (m). Real floors are ~3.3 m. */
const FLOOR = 3.4;
const BAY = 2.2;
const WINDOW = { width: 1.1, height: 1.6 } as const;
/** Warm interiors, with a few cool (screen and fluorescent) ones. */
const WINDOW_COLORS = ['#ffd58a', '#ffc66b', '#ffb454', '#ffe6b0', '#cfe6ff'].map((hex) => new THREE.Color(hex));

interface Tier { readonly width: number; readonly bottom: number; readonly top: number }

function tiersOf(building: CityBuilding): Tier[] {
  const { width, height, setbacks } = building;
  if (setbacks === 0) return [{ width, bottom: 0, top: height }];
  const baseTop = height * (setbacks === 1 ? 0.7 : 0.58);
  const tiers: Tier[] = [{ width, bottom: 0, top: baseTop }];
  const upper = (height - baseTop) / setbacks;
  for (let i = 1; i <= setbacks; i += 1) {
    tiers.push({ width: width * (1 - 0.2 * i), bottom: baseTop + upper * (i - 1), top: baseTop + upper * i });
  }
  return tiers;
}

/**
 * Silhouette and lit windows of one building. The outline climbs the right
 * side tier by tier, crosses the roof (with its feature), and comes down the
 * left side, so it is one simple polygon.
 */
export function buildCityBuilding(building: CityBuilding): CityBuildingGeometry {
  const random = lcg(building.seed);
  const tiers = tiersOf(building);
  const top = tiers[tiers.length - 1]!;
  const hw = top.width / 2;
  const right: [number, number][] = [[tiers[0]!.width / 2, 0]];
  for (const [index, tier] of tiers.entries()) {
    right.push([tier.width / 2, tier.top]);
    const next = tiers[index + 1];
    if (next) right.push([next.width / 2, tier.top]);
  }
  // Roof feature, from the right edge of the top tier to its left edge.
  const roof: [number, number][] = [];
  let beacon: [number, number] | null = null;
  const H = top.top;
  switch (building.roof) {
    case 'flat': {
      roof.push([hw * 0.55, H], [hw * 0.55, H + 1.6], [hw * 0.15, H + 1.6], [hw * 0.15, H]);
      break;
    }
    case 'antenna': {
      const mast = building.height * 0.18;
      roof.push([hw * 0.3, H], [hw * 0.3, H + 3], [0.35, H + 3], [0.35, H + 3 + mast], [-0.35, H + 3 + mast], [-0.35, H + 3], [-hw * 0.3, H + 3], [-hw * 0.3, H]);
      beacon = [0, H + 3 + mast];
      break;
    }
    case 'spire': {
      const rise = top.width * 0.9;
      const tip = building.height * 0.14;
      roof.push([hw * 0.2, H + rise], [0.3, H + rise], [0.3, H + rise + tip], [-0.3, H + rise + tip], [-0.3, H + rise], [-hw * 0.2, H + rise]);
      beacon = [0, H + rise + tip];
      break;
    }
    case 'crown': {
      // Stepped art-deco crown: three narrowing steps and a short mast.
      const step = top.width * 0.12;
      roof.push(
        [hw * 0.8, H], [hw * 0.8, H + step], [hw * 0.6, H + step], [hw * 0.6, H + step * 2], [hw * 0.4, H + step * 2], [hw * 0.4, H + step * 3],
        [0.3, H + step * 3], [0.3, H + step * 5], [-0.3, H + step * 5],
        [-0.3, H + step * 3], [-hw * 0.4, H + step * 3], [-hw * 0.4, H + step * 2], [-hw * 0.6, H + step * 2], [-hw * 0.6, H + step], [-hw * 0.8, H + step], [-hw * 0.8, H],
      );
      beacon = [0, H + step * 5];
      break;
    }
    case 'waterTank': {
      // Rooftop water tank on a short stand, off center.
      const cx = (random() - 0.5) * hw;
      roof.push([cx + 1.4, H], [cx + 1.4, H + 1.8], [cx + 1.9, H + 1.8], [cx + 1.9, H + 5.2], [cx, H + 6.4], [cx - 1.9, H + 5.2], [cx - 1.9, H + 1.8], [cx - 1.4, H + 1.8], [cx - 1.4, H]);
      break;
    }
    default: {
      const unreachable: never = building.roof;
      throw new Error(`WRECK_YARD_ROOF_KIND_INVALID: ${String(unreachable)}`);
    }
  }
  const shape = new THREE.Shape();
  shape.moveTo(-tiers[0]!.width / 2, 0);
  for (const [x, y] of right) shape.lineTo(x, y);
  for (const [x, y] of roof) shape.lineTo(x, y);
  for (const [x, y] of [...right].reverse()) shape.lineTo(-x, y);
  shape.closePath();

  // Lit windows on each tier, in whole bays and floors, with lit runs clustered by floor.
  const windows: LitRect[] = [];
  for (const tier of tiers) {
    const columns = Math.floor((tier.width - 1.2) / BAY);
    const floors = Math.floor((tier.top - tier.bottom - 2) / FLOOR);
    if (columns < 1 || floors < 1) continue;
    const x0 = -((columns - 1) * BAY) / 2;
    for (let floor = 0; floor < floors; floor += 1) {
      // Some floors are dark offices, some are busy.
      const busy = random() < 0.25 ? 2.2 : random() < 0.35 ? 0.2 : 1;
      const color = WINDOW_COLORS[Math.floor(random() * WINDOW_COLORS.length)]!;
      for (let column = 0; column < columns; column += 1) {
        if (random() >= building.lit * busy) continue;
        windows.push({
          x: x0 + column * BAY - WINDOW.width / 2,
          y: tier.bottom + 1.4 + floor * FLOOR,
          width: WINDOW.width,
          height: WINDOW.height,
          color: random() < 0.8 ? color : WINDOW_COLORS[Math.floor(random() * WINDOW_COLORS.length)]!,
        });
      }
    }
  }
  // Aviation lights mark only the tall towers (each light is a draw call).
  return { shape, windows, beacon: building.height >= BEACON_MIN_HEIGHT ? beacon : null };
}

/** Angular distance in degrees, wrapped to -180..180. */
function angleBetween(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/** Downtown clusters: azimuth (0 is the yard's north, the main view), spread, and peak height. */
const DOWNTOWNS = [
  { azimuth: 12, spread: 28, peak: 62 },
  { azimuth: -150, spread: 20, peak: 42 },
] as const;

function downtownRing(seed: number, distance: number, color: string): CityLayer {
  const random = lcg(seed);
  const buildings: CityBuilding[] = [];
  for (let azimuth = -180; azimuth < 180; azimuth += 3.2 + random() * 2.4) {
    const boost = Math.max(...DOWNTOWNS.map((d) => d.peak * Math.exp(-((angleBetween(azimuth, d.azimuth) / d.spread) ** 2))));
    const height = 18 + boost * (0.55 + random() * 0.6) + random() * 10;
    const tall = height > 50;
    const roofs: readonly RoofKind[] = tall ? ['spire', 'crown', 'antenna', 'flat'] : ['flat', 'flat', 'antenna', 'crown'];
    buildings.push({
      azimuthDeg: azimuth,
      width: 12 + random() * 16,
      height,
      setbacks: tall ? (random() < 0.5 ? 2 : 1) : random() < 0.3 ? 1 : 0,
      roof: roofs[Math.floor(random() * roofs.length)]!,
      lit: 0.18 + random() * 0.2,
      seed: Math.floor(random() * 1e9),
    });
  }
  return { distance, baseY: -2, color, buildings };
}

function midriseRing(seed: number, distance: number, color: string): CityLayer {
  const random = lcg(seed);
  const buildings: CityBuilding[] = [];
  for (let azimuth = -180; azimuth < 180; azimuth += 4 + random() * 3.5) {
    buildings.push({
      azimuthDeg: azimuth,
      width: 14 + random() * 18,
      height: 14 + random() * 18,
      setbacks: random() < 0.2 ? 1 : 0,
      roof: random() < 0.45 ? 'waterTank' : 'flat',
      lit: 0.14 + random() * 0.16,
      seed: Math.floor(random() * 1e9),
    });
  }
  return { distance, baseY: -2, color, buildings };
}

/** Farthest first. Downtown towers are hazier; the mid-rise blocks are darker and closer. */
export const CITY_LAYERS: readonly CityLayer[] = [
  downtownRing(31, 250, '#3b3340'),
  midriseRing(47, 190, '#2a2731'),
];
