import { meters } from '@series-inc/rundot-syncplay/physics/3d';
import { SCORCH_MATERIAL, VOXEL_SIZE } from './constants';
import { LAVA, LAVA_BOUNDS } from './liquidAssets';
import { rotate, type Vec3 } from './math';
import { bodyNameOf, physicsBodyById, poseOf, type BodyPose, type OpenYardPhysicsWorld } from './physics';
import type { YardBody } from './state';

interface ErodedVoxels {
  readonly voxels: Uint8Array;
  readonly at: Vec3;
  readonly removed: number;
}

export interface LavaErosion extends ErodedVoxels {
  readonly body: YardBody;
  readonly pose: BodyPose;
}

/** Find exposed cell centers inside the lava. Sealed air cells stay dry. */
function erodeVoxels(body: YardBody, pose: BodyPose): ErodedVoxels | null {
  const { dims, voxels } = body;
  const layer = dims.x * dims.y;
  const inside = new Uint8Array(voxels.length);
  const exterior = new Uint8Array(voxels.length);
  const worldY = new Float64Array(voxels.length);
  const basisX = rotate([VOXEL_SIZE, 0, 0], pose.rotation);
  const basisY = rotate([0, VOXEL_SIZE, 0], pose.rotation);
  const basisZ = rotate([0, 0, VOXEL_SIZE], pose.rotation);
  const origin = pose.position.map((value, axis) => value
    - basisX[axis]! * (dims.x - 1) / 2
    - basisY[axis]! * (dims.y - 1) / 2
    - basisZ[axis]! * (dims.z - 1) / 2);
  const inLava = (x: number, y: number, z: number): boolean => {
    for (let axis = 0; axis < 3; axis++) {
      const value = origin[axis]! + basisX[axis]! * x + basisY[axis]! * y + basisZ[axis]! * z;
      if (value < LAVA_BOUNDS.min[axis]! || value > LAVA_BOUNDS.max[axis]!) return false;
    }
    return true;
  };
  const outsideAccess = (x: number, y: number, z: number): boolean =>
    (x === 0 && inLava(-1, y, z)) || (x === dims.x - 1 && inLava(dims.x, y, z))
    || (y === 0 && inLava(x, -1, z)) || (y === dims.y - 1 && inLava(x, dims.y, z))
    || (z === 0 && inLava(x, y, -1)) || (z === dims.z - 1 && inLava(x, y, dims.z));

  const queue = new Int32Array(voxels.length);
  let head = 0;
  let tail = 0;
  for (let z = 0; z < dims.z; z++) for (let y = 0; y < dims.y; y++) for (let x = 0; x < dims.x; x++) {
    const index = x + y * dims.x + z * layer;
    if (!inLava(x, y, z)) continue;
    inside[index] = 1;
    worldY[index] = origin[1]! + basisX[1] * x + basisY[1] * y + basisZ[1] * z;
    if (voxels[index] === 0 && outsideAccess(x, y, z)) {
      exterior[index] = 1;
      queue[tail++] = index;
    }
  }
  const visit = (index: number) => {
    if (inside[index] && voxels[index] === 0 && exterior[index] === 0) {
      exterior[index] = 1;
      queue[tail++] = index;
    }
  };
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % dims.x;
    const y = Math.floor(index / dims.x) % dims.y;
    const z = Math.floor(index / layer);
    if (x > 0) visit(index - 1);
    if (x + 1 < dims.x) visit(index + 1);
    if (y > 0) visit(index - dims.x);
    if (y + 1 < dims.y) visit(index + dims.x);
    if (z > 0) visit(index - layer);
    if (z + 1 < dims.z) visit(index + layer);
  }

  const exposed: number[] = [];
  for (let index = 0; index < voxels.length; index++) {
    if (!inside[index] || voxels[index] === 0) continue;
    const x = index % dims.x;
    const y = Math.floor(index / dims.x) % dims.y;
    const z = Math.floor(index / layer);
    if (outsideAccess(x, y, z)
      || (x > 0 && exterior[index - 1]) || (x + 1 < dims.x && exterior[index + 1])
      || (y > 0 && exterior[index - dims.x]) || (y + 1 < dims.y && exterior[index + dims.x])
      || (z > 0 && exterior[index - layer]) || (z + 1 < dims.z && exterior[index + layer])) exposed.push(index);
  }
  if (exposed.length === 0) return null;
  exposed.sort((a, b) => worldY[a]! - worldY[b]! || a - b);
  const removed = exposed.slice(0, LAVA.maxVoxelsPerPulse);
  const next = voxels.slice();
  for (const index of removed) next[index] = 0;
  const scorch = (index: number) => { if (next[index]) next[index] = SCORCH_MATERIAL; };
  const sum = [0, 0, 0];
  for (const index of removed) {
    const x = index % dims.x;
    const y = Math.floor(index / dims.x) % dims.y;
    const z = Math.floor(index / layer);
    sum[0]! += x;
    sum[1]! += y;
    sum[2]! += z;
    if (x > 0) scorch(index - 1);
    if (x + 1 < dims.x) scorch(index + 1);
    if (y > 0) scorch(index - dims.x);
    if (y + 1 < dims.y) scorch(index + dims.x);
    if (z > 0) scorch(index - layer);
    if (z + 1 < dims.z) scorch(index + layer);
  }
  return { voxels: next, at: [sum[0]! / removed.length, sum[1]! / removed.length, sum[2]! / removed.length], removed: removed.length };
}

/** Select at most one source body per saved-frame pulse. */
export function nextLavaErosion(physics: OpenYardPhysicsWorld, bodies: readonly YardBody[], frame: number): LavaErosion | null {
  if (frame % LAVA.pulseTicks !== 0) return null;
  const hits = physics.world.overlap({
    x: meters(LAVA.center[0]), y: meters((LAVA.bottomY + LAVA.surfaceY) / 2), z: meters(LAVA.center[2]),
    shape: { type: 'box', halfX: meters(LAVA.innerSize[0] / 2), halfY: meters((LAVA.surfaceY - LAVA.bottomY) / 2), halfZ: meters(LAVA.innerSize[2] / 2) },
    maxPortalDepth: 0, hitTriggers: false, hitSensors: false,
  });
  const hitIds = new Set(hits.map((hit) => bodyNameOf(hit.bodyKey)));
  const candidates = bodies.filter((body) => hitIds.has(body.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (candidates.length === 0) return null;
  const first = Math.floor(frame / LAVA.pulseTicks) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset++) {
    const body = candidates[(first + offset) % candidates.length]!;
    const pose = poseOf(physicsBodyById(physics, body.id)!);
    const eroded = erodeVoxels(body, pose);
    if (eroded) return { ...eroded, body, pose };
  }
  return null;
}
