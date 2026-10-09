/**
 * @file cameraKinetics.ts
 * Recoil impulses and line-of-sight obstacle clearance for the tactical camera.
 */
export interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

export interface CameraObstacle {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface CameraOcclusionResult extends CameraPoint {
  adjusted: boolean;
  obstacleIndex: number | null;
}

const CAMERA_BODY_SAMPLES = [0.12, 1.05, 1.9];
const CAMERA_WALL_PADDING = 0.16;
const CAMERA_WALL_CLEARANCE = 0.12;

function segmentEntry(
  start: CameraPoint,
  end: CameraPoint,
  obstacle: CameraObstacle,
  padding: number
): number | null {
  const bounds: [number, number][] = [
    [obstacle.minX - padding, obstacle.maxX + padding],
    [obstacle.minY, obstacle.maxY + padding],
    [obstacle.minZ - padding, obstacle.maxZ + padding],
  ];
  const origin = [start.x, start.y, start.z];
  const delta = [end.x - start.x, end.y - start.y, end.z - start.z];
  let near = 0;
  let far = 1;
  for (let index = 0; index < 3; index++) {
    const [minimum, maximum] = bounds[index];
    const value = origin[index];
    const change = delta[index];
    if (Math.abs(change) < 1e-8) {
      if (value < minimum || value > maximum) return null;
      continue;
    }
    const first = (minimum - value) / change;
    const last = (maximum - value) / change;
    near = Math.max(near, Math.min(first, last));
    far = Math.min(far, Math.max(first, last));
    if (near > far) return null;
  }
  if (far < 1e-5 || near > 1) return null;
  return Math.max(0, near);
}

/**
 * Keeps a camera on the actor's side of district obstacles.
 * Uses 3 vertical body samples (feet, torso, head) and authored bounding boxes.
 */
export function cameraOnActorSide(
  actor: CameraPoint,
  desired: CameraPoint,
  obstacles: readonly CameraObstacle[],
  samples = CAMERA_BODY_SAMPLES
): CameraOcclusionResult {
  const dx = desired.x - actor.x;
  const dy = desired.y - actor.y;
  const dz = desired.z - actor.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 1e-6) return { ...desired, adjusted: false, obstacleIndex: null };

  let nearest = 1;
  let obstacleIndex: number | null = null;

  for (const [index, obstacle] of obstacles.entries()) {
    for (const offset of samples) {
      const sample = { x: actor.x, y: actor.y + offset, z: actor.z };
      if (sample.y >= obstacle.maxY - CAMERA_WALL_CLEARANCE) continue;
      const entry = segmentEntry(sample, desired, obstacle, CAMERA_WALL_PADDING);
      if (entry === null || entry >= nearest) continue;
      nearest = Math.max(0, entry - CAMERA_WALL_CLEARANCE / distance);
      obstacleIndex = index;
    }
  }

  if (obstacleIndex === null) return { ...desired, adjusted: false, obstacleIndex: null };

  return {
    x: actor.x + dx * nearest,
    y: actor.y + dy * nearest,
    z: actor.z + dz * nearest,
    adjusted: true,
    obstacleIndex,
  };
}

/**
 * Converts 2D/3D container bounds into 3D CameraObstacles with standard stacked container height (5.2m).
 */
export function createCameraObstacles(
  containers: ReadonlyArray<{
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY?: number;
    maxY?: number;
  }>
): CameraObstacle[] {
  return containers.map((c) => ({
    minX: c.minX,
    maxX: c.maxX,
    minY: c.minY ?? 0,
    maxY: c.maxY ?? 5.2,
    minZ: c.minZ,
    maxZ: c.maxZ,
  }));
}

/**
 * Short, cubic-damped camera recoil impulse that decays to zero within 200ms.
 */
export function cameraImpulse(age: number, strength: number): [number, number] {
  if (age < 0 || age >= 0.2) return [0, 0];
  const decay = (1 - age / 0.2) ** 3;
  return [Math.sin(age * 100) * strength * decay, Math.cos(age * 83) * strength * 0.45 * decay];
}
