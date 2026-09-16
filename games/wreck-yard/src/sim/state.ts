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

export interface PlayerState {
  readonly grab: GrabState | null;
  readonly torch: TorchState | null;
  readonly torchTicks: number;
  readonly wasPressed: boolean;
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

export const EMPTY_PLAYER: PlayerState = { grab: null, torch: null, torchTicks: 0, wasPressed: false };
