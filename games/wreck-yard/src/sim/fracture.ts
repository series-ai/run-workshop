import {
  splitVoxelComponents,
  VoxelAnchorFaceMask,
  type VoxelSubChunk,
} from '@series-inc/rundot-syncplay/physics/3d';
import {
  carveCapsule,
  carveParallelogram,
  scorchCapsuleShell,
  scorchParallelogramShell,
} from 'voxel-kit';
import {
  CUT_SEPARATION_BIAS,
  DT,
  IMPACT_SEPARATION_BIAS,
  MAX_TORCH_FRAGMENTS,
  MIN_FRAGMENT_VOXELS,
  SCORCH_MATERIAL,
  VOXEL_SIZE,
} from './constants';
import { add, normalize, rotate, scale, sub, type Vec3 } from './math';
import { makePhysicsBody, toChunk, type BodyPose, type YardPhysicsBodyInput3D } from './physics';
import type { YardBody } from './state';

export interface FractureContact {
  /** Voxel-space start and end of the swept cut. Equal for a sphere. */
  readonly start: Vec3;
  readonly end: Vec3;
  /**
   * Voxel-space point the stroke is carried out to along the contact normal.
   * `start` -> `through` and `end` -> `throughEnd` form the through-cut plane:
   * the stroke swept all the way through to the far side of the body. Equal
   * to the stroke for an impact crater, which never cuts through.
   */
  readonly through: Vec3;
  readonly throughEnd: Vec3;
  /** Radius in voxels. */
  readonly radius: number;
  readonly worldPoint: Vec3;
  /** Meters per second added along the launch direction. Zero for a torch cut. */
  readonly impulseBoost: number;
}

export interface Fragment {
  readonly body: YardBody;
  readonly physics: YardPhysicsBodyInput3D;
}

export interface FractureResult {
  readonly fragments: readonly Fragment[];
  readonly nextSerial: number;
}

function point(v: Vec3) {
  return { x: v[0], y: v[1], z: v[2] };
}

function orderSubChunks(a: VoxelSubChunk, b: VoxelSubChunk): number {
  if (a.occupiedCount !== b.occupiedCount) return b.occupiedCount - a.occupiedCount;
  if (a.offsetCells.x !== b.offsetCells.x) return a.offsetCells.x - b.offsetCells.x;
  if (a.offsetCells.y !== b.offsetCells.y) return a.offsetCells.y - b.offsetCells.y;
  return a.offsetCells.z - b.offsetCells.z;
}

function anchorFacesMask(faces: YardBody['anchorFaces']): number {
  let mask = VoxelAnchorFaceMask.AnchorNone;
  for (const face of faces) {
    if (face === '-x') mask |= VoxelAnchorFaceMask.AnchorNegX;
    else if (face === '+x') mask |= VoxelAnchorFaceMask.AnchorPosX;
    else if (face === '-y') mask |= VoxelAnchorFaceMask.AnchorNegY;
    else if (face === '+y') mask |= VoxelAnchorFaceMask.AnchorPosY;
    else if (face === '-z') mask |= VoxelAnchorFaceMask.AnchorNegZ;
    else mask |= VoxelAnchorFaceMask.AnchorPosZ;
  }
  return mask;
}

function launchDirection(worldOffset: Vec3, hitOffset: Vec3, index: number, count: number): Vec3 {
  const dir = normalize(sub(add(worldOffset, [0, 0.18, 0]), hitOffset));
  if (dir[0] === 0 && dir[1] === 0 && dir[2] === 0) {
    return normalize([index - (count - 1) * 0.5, 0.8, index % 2 === 0 ? -0.4 : 0.4]);
  }
  return dir;
}

/**
 * Carves the contact out of the source body and returns the surviving
 * fragments as new yard bodies with physics bodies. The parent id is kept by
 * the anchored fragment of a fixed body, or by the largest fragment otherwise.
 */
export function fractureBody(source: YardBody, pose: BodyPose, contact: FractureContact, serial: number): FractureResult {
  const cutsThrough = contact.through[0] !== contact.start[0]
    || contact.through[1] !== contact.start[1]
    || contact.through[2] !== contact.start[2];

  const heated = cutsThrough
    ? scorchParallelogramShell(
      source.voxels,
      source.dims,
      point(contact.start),
      point(contact.end),
      point(contact.through),
      point(contact.throughEnd),
      Math.max(0.5, contact.radius * 0.7),
      contact.radius + 1.15,
      SCORCH_MATERIAL,
    )
    : scorchCapsuleShell(
      source.voxels,
      source.dims,
      point(contact.start),
      point(contact.end),
      Math.max(0.5, contact.radius * 0.7),
      contact.radius + 1.15,
      SCORCH_MATERIAL,
    );

  const carved = cutsThrough
    ? carveParallelogram(
      heated,
      source.dims,
      point(contact.start),
      point(contact.end),
      point(contact.through),
      point(contact.throughEnd),
      contact.radius,
    )
    : carveCapsule(heated, source.dims, point(contact.start), point(contact.end), contact.radius);
  const parts = [...splitVoxelComponents(toChunk(carved, source.dims), {
    anchorFacesMask: anchorFacesMask(source.anchorFaces),
  }).subChunks]
    .filter((part) => part.occupiedCount >= MIN_FRAGMENT_VOXELS)
    .sort(orderSubChunks);
  const entries = source.motion === 'fixed' ? parts : parts.slice(0, MAX_TORCH_FRAGMENTS);
  if (entries.length === 0) return { fragments: [], nextSerial: serial };

  // A fixed body keeps its parent id only if a surviving fragment is still
  // anchored to the face it was pinned by. When the cut severs the anchored
  // piece (or it drops below the fragment floor), nothing may inherit the id:
  // doing so would leave the largest loose piece frozen mid-air, anchored to
  // nothing. Those cuts hand every surviving piece a fresh dynamic id instead.
  const anchoredIndex = entries.findIndex((entry) => entry.anchored);
  const preservedIndex = source.motion === 'fixed' ? anchoredIndex : 0;
  const scatter = contact.impulseBoost > 0;
  const hitOffset = sub(contact.worldPoint, pose.position);
  let nextSerial = serial;

  const fragments = entries.map((entry, index) => {
    const dims = { x: entry.dimX, y: entry.dimY, z: entry.dimZ };
    const voxels = entry.occupancy instanceof Uint8Array ? entry.occupancy : Uint8Array.from(entry.occupancy);
    const localOffset: Vec3 = [
      (entry.offsetCells.x + dims.x * 0.5 - source.dims.x * 0.5) * VOXEL_SIZE,
      (entry.offsetCells.y + dims.y * 0.5 - source.dims.y * 0.5) * VOXEL_SIZE,
      (entry.offsetCells.z + dims.z * 0.5 - source.dims.z * 0.5) * VOXEL_SIZE,
    ];
    const worldOffset = rotate(localOffset, pose.rotation);
    const anchored = source.motion === 'fixed' && entry.anchored && index === preservedIndex;
    const keepsId = index === preservedIndex;
    let id = source.id;
    if (!keepsId) {
      id = `${source.id}-p${nextSerial}`;
      nextSerial += 1;
    }

    let position = add(pose.position, worldOffset);
    let linearVelocity: Vec3 = anchored ? [0, 0, 0] : pose.linearVelocity;
    let angularVelocity: Vec3 = anchored ? [0, 0, 0] : pose.angularVelocity;

    if (!anchored) {
      const dir = launchDirection(worldOffset, hitOffset, index, entries.length);
      position = add(position, scale(dir, scatter ? IMPACT_SEPARATION_BIAS : CUT_SEPARATION_BIAS));
      if (scatter) {
        linearVelocity = add(linearVelocity, scale(dir, (contact.impulseBoost + index * 0.18) * DT));
        angularVelocity = add(angularVelocity, scale([dir[2] * 1.8, 1.1 * (index % 2 === 0 ? 1 : -1), -dir[0] * 1.8], DT));
      }
    }

    const body: YardBody = {
      id,
      label: source.label,
      dims,
      voxels,
      motion: anchored ? 'fixed' : 'dynamic',
      buoyancy: source.buoyancy,
      anchorFaces: anchored ? source.anchorFaces : [],
      impactCooldownUntil: source.impactCooldownUntil,
    };
    const physics = makePhysicsBody(body, { position, rotation: pose.rotation, linearVelocity, angularVelocity });
    return { body, physics };
  });

  return { fragments, nextSerial };
}
