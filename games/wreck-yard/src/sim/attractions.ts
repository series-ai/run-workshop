import { FLOOR_Y, VOXEL_SIZE } from './constants';
import type { Vec3Tuple } from 'voxel-kit';
import type { Vec3 } from './math';
import type { ShellBox } from './setPieces';

export type ElevatorFloor = 0 | 1 | 2 | 3;
export type AttractionCommand = 0 | 1 | 2 | 3 | 4 | 5;
export interface AttractionRequest { command: AttractionCommand; sequence: number }
export interface AttractionState {
  readonly elevator: { readonly y: number; readonly velocity: number; readonly target: ElevatorFloor; readonly status: 'ready' | 'moving' | 'blocked' };
  readonly resetFrame: number;
  readonly resetStatus: 'ready' | 'blocked';
}
export const STORAGE = {
  center: [-13.1, FLOOR_Y, -20.7] as Vec3,
  columns: 8, rows: 5, tiers: 10,
  size: 12 * VOXEL_SIZE, spacing: 12 * VOXEL_SIZE,
  count: 400,
} as const;
export const ELEVATOR = {
  id: 'storage-elevator', x: -6.8, z: -20.7,
  size: [3.2, 0.24, 3.2] as Vec3,
  floors: [FLOOR_Y, FLOOR_Y + 3.2, FLOOR_Y + 6.4, FLOOR_Y + 9.6] as const,
  speed: 1.6, acceleration: 2.4,
  panel: [-5.55, -20.7] as const,
  resetButton: [-10.2, FLOOR_Y, -16.8] as Vec3,
} as const;
export const INITIAL_ATTRACTIONS: AttractionState = {
  elevator: { y: FLOOR_Y, velocity: 0, target: 0, status: 'ready' },
  resetFrame: -1000, resetStatus: 'ready',
};
export const STORAGE_BOUNDS = {
  min: [STORAGE.center[0] - STORAGE.columns * STORAGE.spacing / 2 - 0.3, FLOOR_Y - 0.05, STORAGE.center[2] - STORAGE.rows * STORAGE.spacing / 2 - 0.3] as Vec3,
  max: [STORAGE.center[0] + STORAGE.columns * STORAGE.spacing / 2 + 0.3, FLOOR_Y + STORAGE.tiers * STORAGE.spacing + 1, STORAGE.center[2] + STORAGE.rows * STORAGE.spacing / 2 + 0.3] as Vec3,
};
/** The ground landing sits this far above the yard floor. Equal heights z-fight. */
const GROUND_LANDING_LIFT = 0.02;
export const STORAGE_SOLIDS: readonly ShellBox[] = [
  ...[0, 1, 2, 3].map((floor) => ({
    id: `storage-landing-${floor}`,
    center: [-8.83, ELEVATOR.floors[floor]! - 0.13 + (floor === 0 ? GROUND_LANDING_LIFT : 0), ELEVATOR.z] as Vec3Tuple,
    size: [0.86, 0.26, 3.2] as Vec3Tuple,
  })),
  ...[-1, 1].map((side) => ({ id: `storage-guide-${side}`, center: [-5.1, FLOOR_Y + 5.4, ELEVATOR.z + side * 1.8] as Vec3Tuple, size: [0.16, 10.8, 0.16] as Vec3Tuple })),
];
export function elevatorPanelWithinReach(at: Vec3, elevatorY: number): boolean {
  const car = Math.abs(at[0] - ELEVATOR.x) < 1.9 && Math.abs(at[2] - ELEVATOR.z) < 1.9 && Math.abs(at[1] - elevatorY - 0.4) < 1.5;
  const call = ELEVATOR.floors.some((y) => Math.abs(at[0] + 8.85) < 1.9 && Math.abs(at[2] - ELEVATOR.z) < 2 && Math.abs(at[1] - y - 0.4) < 1.5);
  return car || call;
}
export function restackWithinReach(at: Vec3): boolean {
  return Math.hypot(at[0] - ELEVATOR.resetButton[0], at[2] - ELEVATOR.resetButton[2]) < 2.6 && Math.abs(at[1] - FLOOR_Y) < 2;
}
