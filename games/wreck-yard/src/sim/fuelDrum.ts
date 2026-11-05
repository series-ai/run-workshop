import type { VoxelDims } from 'voxel-kit';
import { SCORCH_MATERIAL } from './constants';
import type { Vec3 } from './math';
import { fuelDrumPreset, PROP_COLOR } from './props';
import type { FuelDrumState } from './state';

/**
 * Fuel drums from the sky conveyor. Hits, punts, and the torch damage a drum:
 * a hit dents it, and torch heat scorches it. At full damage the drum is lit
 * and explodes after a short fuse, long enough to throw it somewhere. The
 * blast (BLAST) pushes bodies and players away, harder the closer they are,
 * breaks bodies near it, and damages other drums. step.ts applies these rules.
 */
export const FUEL_DRUM = {
  label: 'Fuel Drum',
  idPrefix: 'fuel-drum-',
  maxDamage: 100,
  /** Ticks from lit to the blast (1.5 s). */
  fuseTicks: 45,
  /** A drum that another blast lights goes off sooner. */
  chainFuseTicks: 8,
  /** Closing speed (m/s) from which a hit damages a drum. Lower than IMPACT_MIN_SPEED: drums are fragile. */
  minHitSpeed: 3.5,
  hitDamagePerSpeed: 5,
  maxHitDamage: 45,
  /** Three punts light a drum. */
  puntDamage: 34,
  /** Torch heat per tick: about 1.3 s of torch lights a drum. */
  torchDamagePerTick: 2.5,
  /** Dent radius in voxels. */
  dentRadius: 1.6,
  /** Dents stop taking voxels away below this part of the new drum, so it stays one piece. */
  minVoxelShare: 0.8,
} as const;

export const BLAST = {
  /** Meters. The explosion effect (render/Explosions.tsx) is drawn to this radius. */
  radius: 6,
  /**
   * Impulse (N·s) on a body at the center; the push is impulse × falloff / mass.
   * Yard masses: scrap 0.1, drums 0.5, cars 5, containers 7. A drum next to the
   * blast flies at ~12 m/s; a car moves ~1 m/s.
   */
  impulse: 9,
  /** Most speed (m/s) the blast gives a body. */
  maxSpeed: 22,
  /** Speed (m/s) the blast gives a player at the center: ~10 m/s at 2 m, a throw of ~3 m. */
  playerSpeed: 22,
  /** Spin (rad/s) per m/s of push, so pushed bodies tumble. */
  spinPerSpeed: 0.5,
  /** Bodies closer than this part of the radius also break. */
  shatterShare: 0.4,
  /** Damage to another drum at the center. */
  drumDamage: 220,
} as const;

/** Ticks an explosion stays in the state for the render. */
export const EXPLOSION_SHOW_TICKS = 90;

/** 1 at the blast center, 0 at the radius and past it. Quadratic, so the push is strongest up close. */
export function blastFalloff(distance: number, radius: number = BLAST.radius): number {
  if (distance >= radius) return 0;
  const t = 1 - Math.max(0, distance) / radius;
  return t * t;
}

/** Unit direction away from the blast, with lift, so bodies on the floor fly up and out. */
export function blastDirection(from: Vec3, to: Vec3): Vec3 {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const dy = to[1] - from[1] + 0.5 * Math.hypot(dx, dz) + 0.3;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-6) return [0, 1, 0];
  return [dx / length, dy / length, dz / length];
}

export function hitDamage(closingSpeed: number): number {
  if (closingSpeed < FUEL_DRUM.minHitSpeed) return 0;
  return Math.min(FUEL_DRUM.maxHitDamage, closingSpeed * FUEL_DRUM.hitDamagePerSpeed);
}

/**
 * Adds damage. A drum that reaches maxDamage is lit: it goes off `fuseTicks`
 * from `frame`. A drum that is already lit keeps the earlier frame.
 */
export function damageDrum(drum: FuelDrumState, amount: number, frame: number, fuseTicks: number = FUEL_DRUM.fuseTicks): FuelDrumState {
  if (amount <= 0) return drum;
  const damage = Math.min(FUEL_DRUM.maxDamage, drum.damage + amount);
  if (damage < FUEL_DRUM.maxDamage) return { ...drum, damage };
  return { ...drum, damage, detonateAt: Math.min(drum.detonateAt ?? Number.MAX_SAFE_INTEGER, frame + fuseTicks) };
}

let presetVoxelCount: number | null = null;
function newDrumVoxelCount(): number {
  presetVoxelCount ??= countVoxels(fuelDrumPreset().voxels);
  return presetVoxelCount;
}

function countVoxels(voxels: Uint8Array): number {
  let count = 0;
  for (const value of voxels) if (value !== 0) count += 1;
  return count;
}

/** Calls `visit` with the index and squared distance of each voxel within `reach` of `center` (voxel space). */
function forVoxelsNear(dims: VoxelDims, center: Vec3, reach: number, visit: (index: number, distanceSq: number) => void): void {
  const lo = (axis: number) => Math.max(0, Math.floor(center[axis]! - reach));
  const hi = (axis: number, size: number) => Math.min(size - 1, Math.ceil(center[axis]! + reach));
  for (let z = lo(2); z <= hi(2, dims.z); z += 1) {
    for (let y = lo(1); y <= hi(1, dims.y); y += 1) {
      for (let x = lo(0); x <= hi(0, dims.x); x += 1) {
        const distanceSq = (x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2;
        if (distanceSq <= reach * reach) visit(x + y * dims.x + z * dims.x * dims.y, distanceSq);
      }
    }
  }
}

/**
 * A dent at `center` (voxel space, on the drum's surface): takes away the
 * voxels within the dent radius and darkens a ring around it. A drum that has
 * lost too much only gets the dark ring, so it never breaks apart.
 */
export function dentVoxels(dims: VoxelDims, voxels: Uint8Array, center: Vec3): Uint8Array {
  const out = new Uint8Array(voxels);
  const radius = FUEL_DRUM.dentRadius;
  const carve = countVoxels(voxels) > newDrumVoxelCount() * FUEL_DRUM.minVoxelShare;
  forVoxelsNear(dims, center, radius + 1.2, (index, distanceSq) => {
    if (out[index] === 0) return;
    out[index] = carve && distanceSq <= radius * radius ? 0 : PROP_COLOR.ink;
  });
  return out;
}

/** Torch heat: the voxels within `radius` of `center` glow (SCORCH_MATERIAL). */
export function scorchVoxels(dims: VoxelDims, voxels: Uint8Array, center: Vec3, radius = 1.4): Uint8Array {
  const out = new Uint8Array(voxels);
  forVoxelsNear(dims, center, radius, (index) => {
    if (out[index] !== 0) out[index] = SCORCH_MATERIAL;
  });
  return out;
}
