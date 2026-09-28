import * as THREE from 'three';
import { ART_STYLE, type Hex } from './artStyle';

export type SkylineProfileKind = 'furnace' | 'pressFrame' | 'stack' | 'shed' | 'gasHolder' | 'coolingTower' | 'factoryBlock';

export type SkylineProfile = {
  kind: SkylineProfileKind;
  azimuthDeg: number;
  width: number;
  height: number;
};

export type SkylineLayer = {
  distance: number;
  baseY: number;
  color: Hex;
  profiles: readonly SkylineProfile[];
};

export function buildProfileShape(profile: SkylineProfile): THREE.Shape {
  const { kind, width, height } = profile;
  const hw = width * 0.5;
  const shape = new THREE.Shape();

  switch (kind) {
    case 'furnace': {
      // Blast furnace: plant block, stepped shaft, hood, and top stack.
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.42);
      shape.lineTo(hw * 0.44, height * 0.42);
      shape.lineTo(hw * 0.44, height * 0.8);
      shape.lineTo(hw * 0.58, height * 0.8);
      shape.lineTo(hw * 0.58, height * 0.88);
      shape.lineTo(hw * 0.12, height * 0.88);
      shape.lineTo(hw * 0.12, height);
      shape.lineTo(-hw * 0.12, height);
      shape.lineTo(-hw * 0.12, height * 0.88);
      shape.lineTo(-hw * 0.58, height * 0.88);
      shape.lineTo(-hw * 0.58, height * 0.8);
      shape.lineTo(-hw * 0.44, height * 0.8);
      shape.lineTo(-hw * 0.44, height * 0.42);
      shape.lineTo(-hw, height * 0.42);
      shape.closePath();
      break;
    }
    case 'pressFrame': {
      // Press frame: two legs and a deep header around an open window.
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.9);
      shape.lineTo(hw * 0.6, height);
      shape.lineTo(-hw * 0.6, height);
      shape.lineTo(-hw, height * 0.9);
      shape.closePath();
      const opening = new THREE.Path();
      opening.moveTo(-hw * 0.62, height * 0.12);
      opening.lineTo(-hw * 0.62, height * 0.66);
      opening.lineTo(hw * 0.62, height * 0.66);
      opening.lineTo(hw * 0.62, height * 0.12);
      opening.closePath();
      shape.holes.push(opening);
      break;
    }
    case 'stack': {
      // Tall industrial smokestack with top cowl
      const topHw = hw * 0.65;
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(topHw, height * 0.92);
      shape.lineTo(topHw * 1.3, height * 0.94); // rim
      shape.lineTo(topHw * 1.3, height);
      shape.lineTo(-topHw * 1.3, height);
      shape.lineTo(-topHw * 1.3, height * 0.94);
      shape.lineTo(-topHw, height * 0.92);
      shape.closePath();
      break;
    }
    case 'shed': {
      // Sawtooth industrial mill shed
      const third = width / 3;
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.6);
      // Sawtooth 1
      shape.lineTo(hw - third * 0.2, height);
      shape.lineTo(hw - third, height * 0.6);
      // Sawtooth 2
      shape.lineTo(hw - third * 1.2, height);
      shape.lineTo(hw - third * 2, height * 0.6);
      // Sawtooth 3
      shape.lineTo(hw - third * 2.2, height);
      shape.lineTo(-hw, height * 0.6);
      shape.closePath();
      break;
    }
    case 'gasHolder': {
      // Cylindrical gasometer tank with shallow domed crown
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.75);
      shape.quadraticCurveTo(0, height * 1.05, -hw, height * 0.75);
      shape.closePath();
      break;
    }
    case 'coolingTower': {
      // Hyperbolic cooling tower: flared base, pinched waist, flared lip.
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.quadraticCurveTo(hw * 0.5, height * 0.62, hw * 0.66, height);
      shape.lineTo(-hw * 0.66, height);
      shape.quadraticCurveTo(-hw * 0.5, height * 0.62, -hw, 0);
      shape.closePath();
      break;
    }
    case 'factoryBlock': {
      // Mill block: stepped roof line with two vent stacks.
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.55);
      shape.lineTo(hw * 0.4, height * 0.55);
      shape.lineTo(hw * 0.4, height * 0.72);
      shape.lineTo(hw * 0.3, height * 0.72);
      shape.lineTo(hw * 0.3, height);
      shape.lineTo(hw * 0.2, height);
      shape.lineTo(hw * 0.2, height * 0.72);
      shape.lineTo(-hw * 0.35, height * 0.72);
      shape.lineTo(-hw * 0.35, height * 0.9);
      shape.lineTo(-hw * 0.45, height * 0.9);
      shape.lineTo(-hw * 0.45, height * 0.72);
      shape.lineTo(-hw * 0.6, height * 0.72);
      shape.lineTo(-hw * 0.6, height * 0.45);
      shape.lineTo(-hw, height * 0.45);
      shape.closePath();
      break;
    }
  }

  return shape;
}

export function computeShapeArea(shape: THREE.Shape): number {
  const pts = shape.getPoints();
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) * 0.5;
}

/** Furnace mouths glow. Center and radius as fractions of the profile width/height. */
export const FURNACE_GLOW = { y: 0.22, radius: 0.13 } as const;

const RING_PATTERN: readonly SkylineProfileKind[] = [
  'factoryBlock', 'stack', 'shed', 'pressFrame', 'stack', 'coolingTower', 'factoryBlock', 'gasHolder', 'stack', 'shed',
];
const SHAPE_SIZE: Readonly<Record<SkylineProfileKind, { width: number; height: number }>> = {
  furnace: { width: 26, height: 30 },
  pressFrame: { width: 18, height: 22 },
  stack: { width: 3.2, height: 30 },
  shed: { width: 28, height: 12 },
  gasHolder: { width: 20, height: 15 },
  coolingTower: { width: 20, height: 24 },
  factoryBlock: { width: 26, height: 17 },
};

/**
 * A closed ring of factory silhouettes. Deterministic: the same seed builds
 * the same skyline on every load. Furnaces sit at fixed headings so the
 * glowing mouths frame the main views.
 */
function buildRing(seed: number, stepDeg: number, scale: number, furnaceAzimuths: readonly number[]): SkylineProfile[] {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const profiles: SkylineProfile[] = [];
  for (let index = 0, azimuth = -180; azimuth < 180; index += 1) {
    const kind = RING_PATTERN[index % RING_PATTERN.length]!;
    const size = SHAPE_SIZE[kind];
    const jitter = 0.8 + random() * 0.45;
    const nearFurnace = furnaceAzimuths.some((f) => Math.abs(f - azimuth) < stepDeg * 1.2);
    if (!nearFurnace) {
      profiles.push({ kind, azimuthDeg: azimuth, width: size.width * scale * jitter, height: size.height * scale * jitter });
    }
    azimuth += stepDeg * (0.75 + random() * 0.5);
  }
  for (const azimuthDeg of furnaceAzimuths) {
    profiles.push({ kind: 'furnace', azimuthDeg, width: SHAPE_SIZE.furnace.width * scale, height: SHAPE_SIZE.furnace.height * scale });
  }
  return profiles;
}

export const SKYLINE_LAYERS: readonly SkylineLayer[] = [
  // Far layer: taller, lighter with haze.
  { distance: 150, baseY: 2, color: ART_STYLE.palette.skylineFar, profiles: buildRing(7, 9, 1.25, []) },
  // Near layer: darkest silhouettes, with the glowing furnaces.
  { distance: 110, baseY: 0, color: ART_STYLE.palette.skyline, profiles: buildRing(19, 12, 0.9, [8, 172]) },
];
