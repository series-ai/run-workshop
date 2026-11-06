import type { DeterministicHfsmAgent, DeterministicHfsmDefinition } from '@series-inc/rundot-syncplay/browser';
import { FLOOR_Y, VOXEL_SIZE } from './constants';
import { fuelDrumPreset } from './props';
import { ROAD_WORKER_DIMS, ROAD_WORKER_LABEL, roadWorkerPreset } from './roadWorker';
import { FUEL_DRUM } from './fuelDrum';
import { lerp, type Vec3 } from './math';
import type { Spawn } from './presets';
import { ofMaterial } from './setPieces';

export const ROAD = {
  slots: [[12.2, 6], [15.8, 10], [12.2, 14], [15.8, 18]] as const,
  workerId: 'road-worker',
  workerHome: [19.3, FLOOR_Y + ROAD_WORKER_DIMS.y * VOXEL_SIZE / 2 + 0.01, -4] as Vec3,
  laneX: 19.3,
  workerSpeed: 2.8,
  barrelLimit: 8,
  crashSpeed: 4,
  crashFuseTicks: 6,
  belt: { center: [22, FLOOR_Y + 0.5, -4] as Vec3, size: [3.4, 0.2, 1.3] as Vec3, speed: 1.8 },
  supply: [23, FLOOR_Y + 1.1, -4] as Vec3,
  magnetId: 'shell:road-magnet',
  magnetPark: [20.5, FLOOR_Y + 6, -12] as Vec3,
  magnetSize: [2.8, 0.35, 2.6] as Vec3,
  magnetRadius: 2.8,
  magnetTargets: 4,
  releaseTick: 75,
  resetTicks: 120,
  carStart: [14, FLOOR_Y + 1.45, -12] as Vec3,
} as const;

export interface RoadCourseState {
  readonly slots: readonly (string | null)[];
  readonly worker: {
    readonly agent: DeterministicHfsmAgent;
    readonly job: { readonly slot: number; readonly bodyId: string; readonly leg: 'lane' | 'slot' } | null;
  };
  readonly resetFrame: number;
}

export const ROAD_WORKER_FSM: DeterministicHfsmDefinition = {
  initialState: 'waiting',
  states: ['waiting', 'collect', 'deliver', 'return'].map((id) => ({ id })),
  transitions: [
    { from: 'waiting', to: 'collect', whenKey: 'work', equals: true },
    { from: 'collect', to: 'return', whenKey: 'lost', equals: true },
    { from: 'collect', to: 'deliver', whenKey: 'caught', equals: true },
    { from: 'deliver', to: 'return', whenKey: 'lost', equals: true },
    { from: 'deliver', to: 'return', whenKey: 'placed', equals: true },
    { from: 'return', to: 'waiting', whenKey: 'home', equals: true },
  ],
};

export const INITIAL_ROAD_COURSE: RoadCourseState = {
  slots: ROAD.slots.map((_, index) => `road-barrel-${index}`),
  worker: { agent: { state: 'waiting', transitionsTaken: 0, actionLog: [] }, job: null },
  resetFrame: -1_000_000,
};

export const ROAD_SOLIDS = ofMaterial('steel', [
  { id: 'road-supply-belt', center: [...ROAD.belt.center], size: [...ROAD.belt.size], surfaceVelocity: [-ROAD.belt.speed, 0, 0] },
  ...[-1, 1].map((side) => ({ id: `road-supply-rail-${side}`, center: [22, FLOOR_Y + 0.75, -4 + side * 0.7] as [number, number, number], size: [3.4, 0.3, 0.1] as [number, number, number] })),
]);

export function roadBarrelSpawn(id: string, position: Vec3): Spawn {
  const preset = fuelDrumPreset();
  return {
    body: { id, label: FUEL_DRUM.label, material: 'steel', dims: preset.dims, voxels: preset.voxels, motion: 'dynamic', buoyancy: 0.3, anchorFaces: [], impactCooldownUntil: 0, heat: null },
    position, rotation: [0, 0, 0, 1],
  };
}

export function roadSpawns(): Spawn[] {
  const { dims, voxels } = roadWorkerPreset();
  return [
    ...ROAD.slots.map(([x, z], index) => roadBarrelSpawn(`road-barrel-${index}`, [x, FLOOR_Y + 0.49, z])),
    { body: { id: ROAD.workerId, label: ROAD_WORKER_LABEL, material: 'steel' as const, dims, voxels, motion: 'dynamic' as const, buoyancy: 0.1, anchorFaces: [], impactCooldownUntil: 0, heat: null }, position: ROAD.workerHome, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
  ];
}

export function roadResetActive(frame: number, resetFrame: number): boolean {
  return frame >= resetFrame && frame - resetFrame < ROAD.resetTicks;
}

/** The same saved-frame path drives the native magnet and its visible claw. */
export function roadMagnetPosition(frame: number, resetFrame: number): Vec3 {
  const age = frame - resetFrame;
  if (age < 0 || age >= ROAD.resetTicks) return ROAD.magnetPark;
  const high: Vec3 = [ROAD.carStart[0], ROAD.magnetPark[1], ROAD.carStart[2]];
  const low: Vec3 = [ROAD.carStart[0], FLOOR_Y + 3.4, ROAD.carStart[2]];
  const blend = (a: Vec3, b: Vec3, t: number): Vec3 => {
    const u = t * t * (3 - 2 * t);
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  };
  if (age < 30) return blend(ROAD.magnetPark, high, age / 30);
  if (age < ROAD.releaseTick) return blend(high, low, (age - 30) / (ROAD.releaseTick - 30));
  return blend(low, ROAD.magnetPark, (age - ROAD.releaseTick) / (ROAD.resetTicks - ROAD.releaseTick));
}

export function roadCarCarryPoint(magnet: Vec3): Vec3 {
  return [magnet[0], magnet[1] - 1.55, magnet[2]];
}
