import type { VoxelDims } from 'voxel-kit';
import type { Vec3 } from './math';
import type { YardPhysicsWorldState } from './physics';

export type AnchorFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type BodyMotion = 'dynamic' | 'fixed';

export interface YardBody {
  readonly id: string;
  readonly label: string;
  readonly dims: VoxelDims;
  readonly voxels: Uint8Array;
  readonly motion: BodyMotion;
  readonly buoyancy: number;
  readonly anchorFaces: readonly AnchorFace[];
  /** Frame at which the body may fracture from an impact again. */
  readonly impactCooldownUntil: number;
}

export interface GrabState {
  readonly bodyId: string;
  readonly distance: number;
  /** Last pull velocity in meters per second; becomes the throw velocity. */
  readonly velocity: Vec3;
  readonly target?: Vec3;
}

export interface TorchState {
  readonly bodyId: string;
  /** Voxel-space point of the previous pulse. */
  readonly prev: Vec3;
}

export type PlayerTool = 'gravity' | 'torch';

export interface PlayerState {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly grounded: boolean;
  readonly fuel: number;
  readonly activeTool: PlayerTool;
  readonly grab: GrabState | null;
  readonly torch: TorchState | null;
  readonly torchTicks: number;
  readonly wasPressed: boolean;
  readonly wasSecondaryPressed: boolean;
  readonly jetpackActive: boolean;
}

export interface YardStats {
  readonly torchCuts: number;
  readonly throws: number;
  readonly fractures: number;
}

export interface YardState {
  readonly frame: number;
  readonly bodies: readonly YardBody[];
  readonly world: YardPhysicsWorldState;
  readonly players: readonly PlayerState[];
  readonly stats: YardStats;
  readonly nextSerial: number;
}

export const PLAYER_SPAWN_POINTS: readonly Vec3[] = [
  [-3, 0.2, 10],
  [3, 0.2, 10],
  [-7, 0.2, 12],
  [7, 0.2, 12],
];

export function createInitialPlayer(slot = 0): PlayerState {
  const spawn = PLAYER_SPAWN_POINTS[slot % PLAYER_SPAWN_POINTS.length] ?? [0, 0.2, 10];
  return {
    slot,
    x: spawn[0],
    y: spawn[1],
    z: spawn[2],
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.PI, // Facing forward (negative Z) towards the playground
    pitch: 0,
    grounded: true,
    fuel: 100,
    activeTool: 'gravity',
    grab: null,
    torch: null,
    torchTicks: 0,
    wasPressed: false,
    wasSecondaryPressed: false,
    jetpackActive: false,
  };
}

export const EMPTY_PLAYER: PlayerState = createInitialPlayer(0);
