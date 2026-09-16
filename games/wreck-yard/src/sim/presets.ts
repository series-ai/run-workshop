import { makeEmptyVoxelField, stampBox, type VoxelDims } from 'voxel-kit';
import { FLOOR_Y, TANK, VOXEL_SIZE } from './constants';
import { IDENTITY_QUAT, type Quat, type Vec3 } from './math';
import { createWorld, makePhysicsBody } from './physics';
import { EMPTY_PLAYER, type AnchorFace, type BodyMotion, type YardBody, type YardState } from './state';

type VolumePreset = { dims: VoxelDims; voxels: Uint8Array };

/** Yaw 0.08 rad and -0.14 rad as literals, so no trig runs in the simulation. */
const YAW_POS_008: Quat = [0, 0.03998933418663416, 0, 0.9992001066609779];
const YAW_NEG_014: Quat = [0, -0.06994284733753277, 0, 0.9975510002532796];

function makeSteelCase(): VolumePreset {
  const dims = { x: 18, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 17, y: 11, z: 11 }, 3);
  stampBox(voxels, dims, { x: 2, y: 2, z: 2 }, { x: 15, y: 9, z: 9 }, 0);
  stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 16, y: 2, z: 10 }, 4);
  stampBox(voxels, dims, { x: 1, y: 9, z: 1 }, { x: 16, y: 10, z: 10 }, 4);
  stampBox(voxels, dims, { x: 1, y: 2, z: 1 }, { x: 2, y: 9, z: 10 }, 4);
  stampBox(voxels, dims, { x: 15, y: 2, z: 1 }, { x: 16, y: 9, z: 10 }, 4);
  stampBox(voxels, dims, { x: 8, y: 2, z: 1 }, { x: 9, y: 9, z: 10 }, 4);
  return { dims, voxels };
}

function makeTimberPallet(): VolumePreset {
  const dims = { x: 16, y: 10, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 15, y: 1, z: 2 }, 2);
  stampBox(voxels, dims, { x: 0, y: 0, z: 5 }, { x: 15, y: 1, z: 6 }, 2);
  stampBox(voxels, dims, { x: 0, y: 0, z: 9 }, { x: 15, y: 1, z: 11 }, 2);
  stampBox(voxels, dims, { x: 1, y: 2, z: 1 }, { x: 4, y: 8, z: 10 }, 2);
  stampBox(voxels, dims, { x: 6, y: 2, z: 1 }, { x: 9, y: 8, z: 10 }, 2);
  stampBox(voxels, dims, { x: 11, y: 2, z: 1 }, { x: 14, y: 8, z: 10 }, 2);
  stampBox(voxels, dims, { x: 0, y: 9, z: 0 }, { x: 15, y: 9, z: 11 }, 4);
  stampBox(voxels, dims, { x: 1, y: 3, z: 3 }, { x: 14, y: 7, z: 4 }, 0);
  stampBox(voxels, dims, { x: 1, y: 3, z: 7 }, { x: 14, y: 7, z: 8 }, 0);
  return { dims, voxels };
}

function makeFloatCrate(): VolumePreset {
  const dims = { x: 14, y: 8, z: 14 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 13, y: 7, z: 13 }, 1);
  stampBox(voxels, dims, { x: 2, y: 2, z: 2 }, { x: 11, y: 5, z: 11 }, 0);
  stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 12, y: 1, z: 12 }, 4);
  stampBox(voxels, dims, { x: 1, y: 6, z: 1 }, { x: 12, y: 6, z: 12 }, 4);
  stampBox(voxels, dims, { x: 6, y: 2, z: 1 }, { x: 7, y: 5, z: 12 }, 4);
  return { dims, voxels };
}

function makeBallastBlock(): VolumePreset {
  const dims = { x: 12, y: 12, z: 12 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 11, y: 11, z: 11 }, 3);
  stampBox(voxels, dims, { x: 2, y: 5, z: 0 }, { x: 9, y: 6, z: 11 }, 4);
  stampBox(voxels, dims, { x: 5, y: 0, z: 2 }, { x: 6, y: 11, z: 9 }, 4);
  return { dims, voxels };
}

function makeSteelGantry(): VolumePreset {
  const dims = { x: 26, y: 18, z: 8 };
  const voxels = makeEmptyVoxelField(dims);
  stampBox(voxels, dims, { x: 0, y: 0, z: 1 }, { x: 2, y: 17, z: 6 }, 3);
  stampBox(voxels, dims, { x: 3, y: 12, z: 3 }, { x: 4, y: 13, z: 4 }, 4);
  stampBox(voxels, dims, { x: 5, y: 12, z: 2 }, { x: 24, y: 14, z: 5 }, 3);
  stampBox(voxels, dims, { x: 8, y: 6, z: 2 }, { x: 9, y: 11, z: 5 }, 4);
  stampBox(voxels, dims, { x: 17, y: 7, z: 2 }, { x: 18, y: 11, z: 5 }, 4);
  stampBox(voxels, dims, { x: 21, y: 9, z: 1 }, { x: 24, y: 11, z: 6 }, 3);
  return { dims, voxels };
}

function restY(dims: VoxelDims): number {
  return FLOOR_Y + dims.y * VOXEL_SIZE * 0.5;
}

interface Spawn {
  readonly body: YardBody;
  readonly position: Vec3;
  readonly rotation: Quat;
}

function spawn(
  id: string,
  label: string,
  preset: VolumePreset,
  position: Vec3,
  buoyancy: number,
  rotation: Quat = IDENTITY_QUAT,
  motion: BodyMotion = 'dynamic',
  anchorFaces: readonly AnchorFace[] = [],
): Spawn {
  return {
    body: { id, label, dims: preset.dims, voxels: preset.voxels, motion, buoyancy, anchorFaces, impactCooldownUntil: 0 },
    position,
    rotation,
  };
}

export function createSpawns(): Spawn[] {
  const steel = makeSteelCase();
  const timber = makeTimberPallet();
  const steelY = restY(steel.dims);
  const timberY = steelY + steel.dims.y * VOXEL_SIZE * 0.5 + timber.dims.y * VOXEL_SIZE * 0.5 + 0.02;
  const ballast = makeBallastBlock();
  return [
    spawn('steel-case', 'Steel Case', steel, [-1.35, steelY, -0.2], 0.1),
    spawn('timber-pallet', 'Timber Pallet', timber, [-1.3, timberY, -0.16], 0.28, YAW_POS_008),
    spawn('steel-gantry', 'Steel Gantry', makeSteelGantry(), [2.18, 1.74, TANK.center[2]], 0.08, IDENTITY_QUAT, 'fixed', ['-x']),
    spawn('float-crate', 'Float Crate', makeFloatCrate(), [TANK.center[0] + 0.35, 0.04, TANK.center[2] + 0.2], 1, YAW_POS_008),
    spawn('ballast-box', 'Ballast Box', ballast, [0.62, restY(ballast.dims), 1.3], 0.05, YAW_NEG_014),
  ];
}

export function createInitialState(playerCount: number): YardState {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new Error(`WRECK_YARD_PLAYER_COUNT_INVALID: ${playerCount}`);
  }
  const spawns = createSpawns();
  const world = createWorld(
    spawns.map((entry) =>
      makePhysicsBody(entry.body, {
        position: entry.position,
        rotation: entry.rotation,
        linearVelocity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
      }),
    ),
  );
  return {
    frame: 0,
    bodies: spawns.map((entry) => entry.body),
    world,
    players: Array.from({ length: playerCount }, () => EMPTY_PLAYER),
    stats: { torchCuts: 0, throws: 0, fractures: 0 },
    nextSerial: 0,
  };
}
