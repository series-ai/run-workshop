import { ELEVATOR, STORAGE } from './attractions';
import { FLOOR_Y } from './constants';
import type { ShellBox } from './setPieces';

const box = (id: string, center: [number, number, number], size: [number, number, number]): ShellBox => ({ id, center, size });

/** The fixed roof height leaves 3 m above the highest platform stop. */
export const STORAGE_SHAFT_TOP_Y = ELEVATOR.floors[3] + 3;
export const STORAGE_LANDING_SIGN_X = -8.83;

/** Fixed storage parts that need static physics boxes. STORAGE_SOLIDS stays in attractions.ts. */
export const STORAGE_FIXTURE_SOLIDS: readonly ShellBox[] = [
  box('storage-elevator-roof', [ELEVATOR.x, STORAGE_SHAFT_TOP_Y, ELEVATOR.z], [3.5, 0.18, 3.5]),
  ...([0, 1, 2, 3] as const).map((floor) => box(
    `storage-landing-sign-${floor}`,
    [STORAGE_LANDING_SIGN_X, ELEVATOR.floors[floor] + 0.92, ELEVATOR.z + 1.82],
    [0.86, 0.58, 0.12],
  )),
  box('storage-info-sign', [STORAGE.center[0], FLOOR_Y + 1.28, STORAGE.center[2] + STORAGE.rows * STORAGE.spacing * 0.5 + 0.33], [4.9, 1.82, 0.18]),
  box('storage-restack-pedestal', [ELEVATOR.resetButton[0], FLOOR_Y + 0.35, ELEVATOR.resetButton[2]], [0.62, 0.7, 0.62]),
  box('storage-restack-top', [ELEVATOR.resetButton[0], FLOOR_Y + 0.78, ELEVATOR.resetButton[2]], [0.74, 0.16, 0.74]),
  box('storage-restack-button', [ELEVATOR.resetButton[0], FLOOR_Y + 0.91, ELEVATOR.resetButton[2]], [0.5, 0.12, 0.5]),
  box('storage-restack-sign', [ELEVATOR.resetButton[0], FLOOR_Y + 1.38, ELEVATOR.resetButton[2] + 0.37], [1.55, 0.82, 0.12]),
];

/** Center and size for the control panel, relative to the native elevator body center. */
export const STORAGE_ELEVATOR_CAR_FIXTURE = {
  id: 'storage-elevator-control-panel',
  center: [ELEVATOR.panel[0] - ELEVATOR.x - 0.3, ELEVATOR.size[1] / 2 + 1.23, ELEVATOR.panel[1] - ELEVATOR.z] as [number, number, number],
  size: [1.08, 2.46, 0.16] as [number, number, number],
} as const;
