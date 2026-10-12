import type { AttractionState } from './attractions';
import type { DeterministicVehicleState3D } from '@series-inc/rundot-syncplay/physics/3d';
import type { VoxelDims } from 'voxel-kit';
import type { Vec3 } from './math';
import type { YardPhysicsWorldState } from './physics';

export type AnchorFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type BodyMotion = 'dynamic' | 'fixed';

/** The way a light crate's arrow points. */
export type CrateArrow = 'up' | 'down' | 'left' | 'right';
/** How a shipping crate's face reads. The renderer uses it. Physics ignores it. */
export type CrateFace =
  | { readonly tone: 'light'; readonly arrow: CrateArrow }
  | { readonly tone: 'dark' };

export interface YardBody {
  readonly renderModel?: 'shipping-crate';
  readonly storageBay?: 'storage' | 'returns';
  /** Shipping crates only. Missing means a light crate with the arrow up. */
  readonly crateFace?: CrateFace;
  readonly id: string;
  readonly label: string;
  readonly dims: VoxelDims;
  readonly voxels: Uint8Array;
  readonly motion: BodyMotion;
  readonly buoyancy: number;
  readonly anchorFaces: readonly AnchorFace[];
  /** Frame at which a hit may damage the body (a fuel drum) again. */
  readonly impactCooldownUntil: number;
  /** The last torch or blast heat on the body, until its scorch cools (HEAT). */
  readonly heat: BodyHeat | null;
}

export interface BodyHeat {
  readonly frame: number;
  /** Voxel-space center of the heated area. The heat light sits here. */
  readonly at: Vec3;
}

export interface GrabState {
  readonly bodyId: string;
  readonly distance: number;
  /** Hold point the grab spring pulls toward. */
  readonly target: Vec3;
  /** Hold point motion in meters per tick; the spring damps relative to it. */
  readonly targetVelocity: Vec3;
}

export interface TorchState {
  readonly bodyId: string;
  /** Voxel-space point of the previous pulse. */
  readonly prev: Vec3;
}

export type PlayerTool = 'gravity' | 'torch';

/**
 * What the player's last tool action did, so every click shows a result.
 * grab/punt/throw: the gravity gun acted. blocked: the ray hit something the
 * tool cannot act on (static, fixed, or out of punt range). miss: nothing in
 * range. cut: the torch is cutting a body. scorch: the torch hits a surface it
 * cannot cut. quench: the flame met water (at the surface, or the nozzle is
 * under water) and goes out. press: the player pressed a contraption button.
 */
export type ToolResult = 'grab' | 'punt' | 'throw' | 'blocked' | 'miss' | 'cut' | 'scorch' | 'quench' | 'press';

export interface ToolFeedback {
  readonly result: ToolResult;
  /** Where the ray ended: the hit point, or the end of the range on a miss. */
  readonly point: Vec3;
  /** Simulation frame of the action. */
  readonly frame: number;
}

export interface PlayerState {
  readonly portalTeleports: number;
  readonly lastAttractionRequest: number;
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
  readonly wasUsePressed: boolean;
  readonly jetpackActive: boolean;
  readonly ridingVehicle?: boolean;
  readonly feedback: ToolFeedback | null;
}

export interface YardStats {
  readonly torchCuts: number;
  readonly throws: number;
  readonly fractures: number;
  /** Bodies that dropped down through the hoop (sim/contraptions.ts). */
  readonly dunks: number;
  /** Fuel drums that blew up (sim/fuelDrum.ts). */
  readonly explosions: number;
}

/** A catapult-launched body that flies without damping until frame `until`. */
export interface BallisticBody {
  readonly bodyId: string;
  readonly until: number;
}

/** A fuel drum from the sky conveyor (sim/fuelDrum.ts). */
export interface FuelDrumState {
  readonly bodyId: string;
  /** 0 when new. At FUEL_DRUM.maxDamage the drum is lit. */
  readonly damage: number;
  /** Frame on which a lit drum explodes; null while it is not lit. */
  readonly detonateAt: number | null;
}

/** A drum explosion, kept for a short time so the render can show it. */
export interface Explosion {
  readonly at: Vec3;
  readonly radius: number;
  readonly frame: number;
}

export interface ContraptionState {
  /** Frame of the last drum drop; -Infinity is not JSON, so "never" is a large negative frame. */
  readonly lastDropFrame: number;
  /** Drums the conveyor dropped that still exist, oldest first. */
  readonly drums: readonly FuelDrumState[];
  /** Recent explosions, oldest first (sim/fuelDrum.ts EXPLOSION_SHOW_TICKS). */
  readonly explosions: readonly Explosion[];
  readonly lastLaunchFrame: number;
  readonly ballistic: readonly BallisticBody[];
}

export const NEVER_FRAME = -1_000_000;

export const INITIAL_CONTRAPTIONS: ContraptionState = {
  lastDropFrame: NEVER_FRAME,
  drums: [],
  explosions: [],
  lastLaunchFrame: NEVER_FRAME,
  ballistic: [],
};

/** What the renderer draws for one wheel. Syncplay's vehicle step reports it. */
export interface BuggyWheelState {
  readonly compression: number;
  readonly steerAngleTurns: number;
  readonly spinTurns: number;
  readonly grounded: boolean;
}

export interface YardState {
  readonly attractions: AttractionState;
  readonly buggyWheels?: readonly BuggyWheelState[];
  /** Syncplay's revision 2 vehicle state. Canonical JSON keeps its bigint ids (codec.ts). */
  readonly buggyVehicle?: DeterministicVehicleState3D;
  readonly frame: number;
  readonly bodies: readonly YardBody[];
  readonly world: YardPhysicsWorldState;
  readonly players: readonly PlayerState[];
  readonly stats: YardStats;
  readonly contraptions: ContraptionState;
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
    portalTeleports: 0,
    lastAttractionRequest: 0,
    x: spawn[0],
    y: spawn[1],
    z: spawn[2],
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0, // Facing forward (negative Z) towards the playground
    pitch: 0,
    grounded: true,
    fuel: 100,
    activeTool: 'gravity',
    grab: null,
    torch: null,
    torchTicks: 0,
    wasPressed: false,
    wasSecondaryPressed: false,
    wasUsePressed: false,
    jetpackActive: false,
    feedback: null,
  };
}

export const EMPTY_PLAYER: PlayerState = createInitialPlayer(0);
