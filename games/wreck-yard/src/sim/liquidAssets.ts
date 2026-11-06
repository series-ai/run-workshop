import { FLOOR_Y } from './constants';
import { ofMaterial } from './setPieces';

export const LAVA = {
  center: [7.3, FLOOR_Y, 0.55] as const,
  innerSize: [2.6, 0.58, 2.4] as const,
  bottomY: FLOOR_Y + 0.12,
  surfaceY: FLOOR_Y + 0.7,
  wallThickness: 0.16,
  pulseTicks: 15,
  maxVoxelsPerPulse: 6,
} as const;

export const LAVA_BOUNDS = {
  min: [LAVA.center[0] - LAVA.innerSize[0] / 2, LAVA.bottomY, LAVA.center[2] - LAVA.innerSize[2] / 2],
  max: [LAVA.center[0] + LAVA.innerSize[0] / 2, LAVA.surfaceY, LAVA.center[2] + LAVA.innerSize[2] / 2],
} as const;

const height = LAVA.surfaceY + 0.12 - LAVA.bottomY;
const centerY = LAVA.bottomY + height / 2;

export const LAVA_SOLIDS = ofMaterial('concrete', [
  { id: 'lava-floor', center: [LAVA.center[0], LAVA.bottomY - 0.1, LAVA.center[2]], size: [LAVA.innerSize[0] + LAVA.wallThickness * 2, 0.2, LAVA.innerSize[2] + LAVA.wallThickness * 2] },
  ...([-1, 1] as const).flatMap((side) => [
    { id: `lava-wall-x-${side}`, center: [LAVA.center[0] + side * (LAVA.innerSize[0] + LAVA.wallThickness) / 2, centerY, LAVA.center[2]] as [number, number, number], size: [LAVA.wallThickness, height, LAVA.innerSize[2] + LAVA.wallThickness * 2] as [number, number, number] },
    { id: `lava-wall-z-${side}`, center: [LAVA.center[0], centerY, LAVA.center[2] + side * (LAVA.innerSize[2] + LAVA.wallThickness) / 2] as [number, number, number], size: [LAVA.innerSize[0], height, LAVA.wallThickness] as [number, number, number] },
  ]),
]);
