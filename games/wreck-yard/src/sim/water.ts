import { TANK } from './constants';
import type { Vec3 } from './math';

/** The water in the tank: its inner walls, from the tank floor up to the surface. */
export const WATER_BOUNDS = {
  min: [TANK.center[0] - TANK.innerSize[0] * 0.5, TANK.bottomY, TANK.center[2] - TANK.innerSize[2] * 0.5],
  max: [TANK.center[0] + TANK.innerSize[0] * 0.5, TANK.surfaceY, TANK.center[2] + TANK.innerSize[2] * 0.5],
} as const;

/**
 * Distance along a ray (unit `direction`) to where it enters the water: 0 if
 * it starts in the water, null if it does not reach the water within
 * `maxDistance`. The torch flame stops there.
 */
export function waterEntry(origin: Vec3, direction: Vec3, maxDistance: number): number | null {
  let near = 0;
  let far = maxDistance;
  for (let axis = 0; axis < 3; axis += 1) {
    const min = WATER_BOUNDS.min[axis]!;
    const max = WATER_BOUNDS.max[axis]!;
    const o = origin[axis]!;
    const d = direction[axis]!;
    if (Math.abs(d) < 1e-12) {
      if (o < min || o > max) return null;
      continue;
    }
    let t0 = (min - o) / d;
    let t1 = (max - o) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0);
    far = Math.min(far, t1);
    if (near > far) return null;
  }
  return near;
}
