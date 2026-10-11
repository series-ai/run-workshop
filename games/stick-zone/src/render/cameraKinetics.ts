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


export interface CameraLookAheadConfig {
  aimLeadDistance: number;
  velocityLeadFactor: number;
  deadZone: number;
  maxOffset: number;
}

export const DEFAULT_LOOK_AHEAD_CONFIG: CameraLookAheadConfig = {
  aimLeadDistance: 2.2,
  velocityLeadFactor: 0.32,
  deadZone: 0.4,
  maxOffset: 4.8,
};

/**
 * Computes look-ahead camera offset based on player weapon aiming angle and movement velocity.
 * Implements dead zone suppression and maximum offset clamping.
 */
export function computeCameraLookAhead(
  facing: number,
  velocity: { x: number; z: number } = { x: 0, z: 0 },
  config: Partial<CameraLookAheadConfig> = {}
): { offsetX: number; offsetZ: number } {
  const cfg = { ...DEFAULT_LOOK_AHEAD_CONFIG, ...config };

  // Facing angle: sin(facing) maps to +X, cos(facing) maps to +Z in this coordinate system
  const aimX = Math.sin(facing) * cfg.aimLeadDistance;
  const aimZ = Math.cos(facing) * cfg.aimLeadDistance;

  const speed = Math.hypot(velocity.x, velocity.z);
  let velX = 0;
  let velZ = 0;
  if (speed > cfg.deadZone) {
    velX = velocity.x * cfg.velocityLeadFactor;
    velZ = velocity.z * cfg.velocityLeadFactor;
  }

  const rawX = aimX + velX;
  const rawZ = aimZ + velZ;
  const totalMag = Math.hypot(rawX, rawZ);
  if (totalMag > cfg.maxOffset && totalMag > 1e-5) {
    const scale = cfg.maxOffset / totalMag;
    return { offsetX: rawX * scale, offsetZ: rawZ * scale };
  }
  return { offsetX: rawX, offsetZ: rawZ };
}

/**
 * Adjusts camera vantage height dynamically based on active movement stance (slide, sprint, ADS).
 */
export function computeCameraKineticHeight(
  baseHeight: number,
  options: {
    isSliding?: boolean;
    isSprinting?: boolean;
    isAds?: boolean;
  } = {}
): number {
  if (options.isAds) {
    return baseHeight - 1.5;
  }
  if (options.isSliding) {
    return baseHeight - 1.8;
  }
  if (options.isSprinting) {
    return baseHeight + 1.2;
  }
  return baseHeight;
}

/**
 * Computes camera flinch and trauma oscillation impulse resulting from incoming ballistic damage.
 * Displaces camera away from damage source angle with damped spring recovery.
 */
export function computeTraumaImpulse(
  damageAngleDeg: number,
  damageAmount: number,
  elapsedSec: number,
  durationSec: number = 0.35
): { x: number; y: number; z: number } {
  if (elapsedSec < 0 || elapsedSec >= durationSec) return { x: 0, y: 0, z: 0 };
  const progress = elapsedSec / durationSec;
  const decay = Math.pow(1 - progress, 2.5);
  const intensity = Math.min(1.2, (damageAmount / 25) * 0.7);

  // Screen space angle: 0 deg = North (-Z), 90 deg = East (+X), 180 deg = South (+Z), 270 deg = West (-X)
  const rad = (damageAngleDeg * Math.PI) / 180;
  // Push direction: away from damage vector
  const pushX = -Math.sin(rad) * intensity * 0.45 * decay;
  const pushZ = Math.cos(rad) * intensity * 0.45 * decay;

  // Damped high-frequency harmonic vibration
  const osc = Math.sin(elapsedSec * 45) * intensity * 0.28 * decay;
  const oscY = Math.cos(elapsedSec * 55) * intensity * 0.35 * decay;

  return {
    x: pushX + osc * Math.cos(rad),
    y: oscY,
    z: pushZ + osc * Math.sin(rad),
  };
}
