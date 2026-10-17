import { DT, IMPACT_COOLDOWN_TICKS, VOXEL_SIZE } from './constants';
import { add, normalize, rotate, scale, sub, type Vec3 } from './math';
import { makePhysicsBody, voxelStats, type BodyPose, type YardPhysicsBodyInput3D } from './physics';
import type { YardBody } from './state';

/**
 * FRAGILE crates. A hard hit splits a whole storage crate into four pieces
 * through the hit point. The pieces never break again, so one crate adds at most
 * three bodies. The limits keep a falling stack from filling the physics world.
 */
export const CRATE_BREAK = {
  /** Closing speed (m/s): about a fall from the fourth tier (3.3 m) onto the floor. */
  speed: 8,
  /** Crates that may break in one tick. */
  maxPerTick: 2,
  /** No crate breaks while the world holds this many bodies or more (capacity 2048). */
  bodyBudget: 1500,
  /** Speed (m/s) at which the pieces leave the hit point. */
  burstSpeed: 1.8,
  /** A piece is at least this many voxels wide on each cut axis. */
  minPieceVoxels: 3,
} as const;

/** Ticks that a crate break stays in the state, so a render that skips ticks still sees it. */
export const CRATE_BREAK_SHOW_TICKS = 6;

/** True for a whole storage crate: the only body that this rule breaks. */
export function isBreakableCrate(body: YardBody): boolean {
  return body.renderModel === 'shipping-crate' && voxelStats(body.voxels).occupiedCount === body.voxels.length;
}

export interface CrateBreakResult {
  readonly fragments: readonly { readonly body: YardBody; readonly physics: YardPhysicsBodyInput3D }[];
  readonly nextSerial: number;
}

/**
 * Splits a whole crate along x and z through `hitVoxel` (voxel space) into four
 * upright pieces. Each piece keeps the crate's material, bay, and faces, so it
 * keeps its tone. The pieces burst away from the hit point and spin a little.
 */
export function breakCrate(source: YardBody, pose: BodyPose, hitVoxel: Vec3, serial: number, frame: number): CrateBreakResult {
  if (!isBreakableCrate(source) || !source.storageBay) throw new Error(`WRECK_YARD_CRATE_NOT_BREAKABLE: ${source.id}`);
  const { dims } = source;
  const edge = CRATE_BREAK.minPieceVoxels;
  const cutX = Math.min(dims.x - edge, Math.max(edge, Math.round(hitVoxel[0])));
  const cutZ = Math.min(dims.z - edge, Math.max(edge, Math.round(hitVoxel[2])));
  const hitOffset = rotate(sub(scale(hitVoxel, VOXEL_SIZE), scale([dims.x, dims.y, dims.z], VOXEL_SIZE / 2)), pose.rotation);
  let nextSerial = serial;
  const fragments = [[0, cutX], [cutX, dims.x]].flatMap(([x0, x1]) => [[0, cutZ], [cutZ, dims.z]].map(([z0, z1]) => {
    const piece = { x: x1! - x0!, y: dims.y, z: z1! - z0! };
    // Every voxel of a whole crate is filled, and so is every voxel of a piece.
    const voxels = new Uint8Array(piece.x * piece.y * piece.z);
    for (let z = 0; z < piece.z; z++) for (let y = 0; y < piece.y; y++) for (let x = 0; x < piece.x; x++) {
      voxels[x + y * piece.x + z * piece.x * piece.y] = source.voxels[(x0! + x) + y * dims.x + (z0! + z) * dims.x * dims.y]!;
    }
    const localOffset: Vec3 = [
      (x0! + piece.x / 2 - dims.x / 2) * VOXEL_SIZE,
      0,
      (z0! + piece.z / 2 - dims.z / 2) * VOXEL_SIZE,
    ];
    const worldOffset = rotate(localOffset, pose.rotation);
    // Out from the hit point, and a little up.
    const out = normalize(add(sub(worldOffset, hitOffset), [0, 0.12, 0]));
    const id = `${source.id}-p${nextSerial}`;
    nextSerial += 1;
    const body: YardBody = {
      id,
      label: source.label,
      material: source.material,
      dims: piece,
      voxels,
      motion: 'dynamic',
      buoyancy: source.buoyancy,
      anchorFaces: [],
      impactCooldownUntil: frame + IMPACT_COOLDOWN_TICKS,
      heat: null,
      storageBay: source.storageBay,
      crateFaces: source.crateFaces,
    };
    const physics = makePhysicsBody(body, {
      position: add(pose.position, worldOffset),
      rotation: pose.rotation,
      linearVelocity: add(pose.linearVelocity, scale(out, CRATE_BREAK.burstSpeed * DT)),
      angularVelocity: add(pose.angularVelocity, scale([out[2] * 2.2, 0, -out[0] * 2.2], DT)),
    });
    return { body, physics };
  }));
  return { fragments, nextSerial };
}
