import { DEPOT_CRATE_CONFIGS } from "./crates.js";
import { calculateShotgunHit } from './shotgunCollision.js';
export type PresentationEvent =
  | {
      type: 'fire';
      shooterId: string;
      origin: { x: number; y: number; z: number };
      dir: { x: number; y: number; z: number };
      weapon: 'rifle' | 'shotgun' | 'pistol';
    }
  | {
      type: 'impact';
      position: { x: number; y: number; z: number };
      surface?: 'metal' | 'concrete' | 'flesh';
      damage?: number;
      label?: string;
      isCrit?: boolean;
    }
  | {
      type: 'elimination';
      operativeId: string;
      position: { x: number; y: number; z: number };
    }
  | {
      type: 'locomotion';
      operativeId: string;
      subtype: 'roll' | 'sprint' | 'land' | 'slide';
      position: { x: number; y: number; z: number };
    }
  | {
      type: 'kick';
      operativeId: string;
      position: { x: number; y: number; z: number };
      facing: number;
      isHit: boolean;
      hitTarget?: 'rival' | 'machine' | 'cover';
    }
  | {
      type: 'stim';
      operativeId: string;
      position: { x: number; y: number; z: number };
      healAmount?: number;
    }
  | {
      type: 'loot';
      operativeId: string;
      position: { x: number; y: number; z: number };
      crateId?: string;
      value?: number;
    }
  | {
      type: 'grenade_throw';
      shooterId: string;
      origin: { x: number; y: number; z: number };
      target: { x: number; y: number; z: number };
    }
  | {
      type: 'explosion';
      position: { x: number; y: number; z: number };
      radius?: number;
    }
  | {
      type: 'reload';
      operativeId: string;
      position: { x: number; y: number; z: number };
    }
  | {
      type: 'dry_fire';
      operativeId: string;
      position: { x: number; y: number; z: number };
    };


export interface DamageIndicatorEntry {
  id: string;
  angleDeg: number;
  damage: number;
  tick: number;
  timestamp: number;
}

export interface ActiveGrenade {
  id: string;
  throwerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuseTicks: number;
  radius: number;
  maxDamage: number;
  detonated: boolean;
}

export function applyStandardDamage(
  currentHealth: number,
  currentArmor: number,
  rawDamage: number
): { newHealth: number; newArmor: number; absorbed: number; effectiveDamage: number } {
  const absorbed = Math.min(currentArmor, rawDamage);
  const newArmor = currentArmor - absorbed;
  const leftover = rawDamage - absorbed;
  const newHealth = Math.max(0, currentHealth - leftover);
  return { newHealth, newArmor, absorbed, effectiveDamage: leftover };
}

export interface CameraAimParams {
  cameraPos?: { x: number; y: number; z: number };
  targetPos?: { x: number; y: number; z: number };
  playerPos?: { x: number; y: number; z: number };
  dx?: number;
  dz?: number;
}

export function computeGroundAimAngle(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  fov = 48,
  camParam?: CameraAimParams | { dx: number; dz: number }
): number {
  let eyeX = 0, eyeY = 13, eyeZ = 10.5;
  let targetX = 0, targetY = 1, targetZ = 0;
  let playerX = 0, playerZ = 0;

  if (camParam) {
    const cp = camParam as CameraAimParams;
    if (cp.cameraPos) {
      eyeX = cp.cameraPos.x;
      eyeY = cp.cameraPos.y;
      eyeZ = cp.cameraPos.z;
    } else if (cp.dx !== undefined && cp.dz !== undefined) {
      eyeX = cp.dx;
      eyeZ = cp.dz + 10.5;
    }
    if (cp.targetPos) {
      targetX = cp.targetPos.x;
      targetY = cp.targetPos.y;
      targetZ = cp.targetPos.z;
    } else if (cp.playerPos) {
      targetX = cp.playerPos.x;
      targetY = (cp.playerPos.y || 0) + 1;
      targetZ = cp.playerPos.z;
    }
    if (cp.playerPos) {
      playerX = cp.playerPos.x;
      playerZ = cp.playerPos.z;
    }
  }

  // Camera basis (matching Three.js camera.lookAt matrix)
  let zx = eyeX - targetX;
  let zy = eyeY - targetY;
  let zz = eyeZ - targetZ;
  const zLen = Math.hypot(zx, zy, zz);
  if (zLen > 1e-6) {
    zx /= zLen; zy /= zLen; zz /= zLen;
  } else {
    zz = 1;
  }

  // up x z (up is 0, 1, 0)
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xLen = Math.hypot(xx, xz);
  if (xLen > 1e-6) {
    xx /= xLen;
    xz /= xLen;
  } else {
    xx = 1; xz = 0;
  }

  // y = z x x
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  const ndcX = (clientX - width / 2) / (width / 2);
  const ndcY = -(clientY - height / 2) / (height / 2);
  const aspect = width / height;
  const halfTan = Math.tan(((fov / 2) * Math.PI) / 180);

  const vx = ndcX * aspect * halfTan;
  const vy = ndcY * halfTan;

  // World ray dir = vx * x + vy * y - 1 * z
  const rx = vx * xx + vy * yx - zx;
  const ry = vx * xy + vy * yy - zy;
  const rz = vx * xz + vy * yz - zz;

  if (Math.abs(ry) < 1e-6) return 0;
  const t = (0 - eyeY) / ry;
  const hitX = eyeX + t * rx;
  const hitZ = eyeZ + t * rz;

  return Math.atan2(hitX - playerX, hitZ - playerZ);
}

export type HoldProgressReporter = (raidId: string, operativeId: string, holdTicks: number, currentTick: number) => void;
export function registerGlobalHoldReporter(_reporter: HoldProgressReporter | null): void {
  // Pure simulation: no ambient mutable global reporters
}

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ContainerDefinition {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  box: ObstacleBox;
}

export const CONTAINER_GEOMETRY = {
  length: 6.90,
  width: 3.12,
  height: 2.60,
  halfLength: 3.45,
  halfWidth: 1.56,
};

export function createContainerBox(x: number, z: number, isRotated: boolean): ObstacleBox {
  const hx = isRotated ? CONTAINER_GEOMETRY.halfWidth : CONTAINER_GEOMETRY.halfLength;
  const hz = isRotated ? CONTAINER_GEOMETRY.halfLength : CONTAINER_GEOMETRY.halfWidth;
  return {
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz,
  };
}

export function isPositionInExfilZone(x: number, z: number, hasKeycard: boolean = false): boolean {
  const distToExfil = Math.hypot(x - 45.0, z - 45.0);
  const distToBunker = Math.hypot(x - (-45.0), z - (-45.0));
  return distToExfil <= 6.0 || (hasKeycard && distToBunker <= 6.0);
}

export const MAP_CONTAINERS: ContainerDefinition[] = [
  // Original 7 depot containers
  { id: 'cnt_01', position: [-20, 0, -30], rotation: [0, 0, 0], box: createContainerBox(-20, -30, false) },
  { id: 'cnt_02', position: [-35, 0, -10], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-35, -10, true) },
  { id: 'cnt_03', position: [10, 0, -40], rotation: [0, 0, 0], box: createContainerBox(10, -40, false) },
  { id: 'cnt_04', position: [30, 0, -20], rotation: [0, 0, 0], box: createContainerBox(30, -20, false) },
  { id: 'cnt_05', position: [-15, 0, 15], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-15, 15, true) },
  { id: 'cnt_06', position: [5, 0, 30], rotation: [0, 0, 0], box: createContainerBox(5, 30, false) },
  { id: 'cnt_07', position: [-45, 0, 35], rotation: [0, 0, 0], box: createContainerBox(-45, 35, false) },

  // Central Corridor Flanking Industrial Stacks (x = ±5.8 for optimal 66.70° tactical visibility)
  { id: 'flank_w_north', position: [-5.8, 0, -25], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-5.8, -25, true) },
  { id: 'flank_e_north', position: [5.8, 0, -25], rotation: [0, Math.PI / 2, 0], box: createContainerBox(5.8, -25, true) },
  { id: 'flank_w_mid', position: [-9.5, 0, 5], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-9.5, 5, true) },
  { id: 'flank_e_mid', position: [9.5, 0, 5], rotation: [0, Math.PI / 2, 0], box: createContainerBox(9.5, 5, true) },
  { id: 'flank_w_south', position: [-9.5, 0, 35], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-9.5, 35, true) },
  { id: 'flank_e_south', position: [9.5, 0, 35], rotation: [0, Math.PI / 2, 0], box: createContainerBox(9.5, 35, true) },

  // Perimeter Flanking Heavy Stacks (x = ±60)
  { id: 'perim_w_north', position: [-60, 0, -25], rotation: [0, 0, 0], box: createContainerBox(-60, -25, false) },
  { id: 'perim_w_mid', position: [-60, 0, 5], rotation: [0, 0, 0], box: createContainerBox(-60, 5, false) },
  { id: 'perim_w_south', position: [-60, 0, 35], rotation: [0, 0, 0], box: createContainerBox(-60, 35, false) },
  { id: 'perim_e_north', position: [60, 0, -25], rotation: [0, 0, 0], box: createContainerBox(60, -25, false) },
  { id: 'perim_e_mid', position: [60, 0, 5], rotation: [0, 0, 0], box: createContainerBox(60, 5, false) },
  { id: 'perim_e_south', position: [60, 0, 35], rotation: [0, 0, 0], box: createContainerBox(60, 35, false) },
];

export const DEPOT_CONTAINERS: ObstacleBox[] = [
  { minX: -23.5, maxX: -16.5, minZ: -32.0, maxZ: -28.0 },
  { minX: -37.0, maxX: -33.0, minZ: -13.5, maxZ: -6.5 },
  { minX: 7.0, maxX: 13.0, minZ: -41.5, maxZ: -38.5 },
  { minX: 27.0, maxX: 33.0, minZ: -22.5, maxZ: -17.5 },
  { minX: -17.0, maxX: -13.0, minZ: 11.5, maxZ: 18.5 },
  { minX: 2.0, maxX: 8.0, minZ: 28.5, maxZ: 31.5 },
  { minX: -48.5, maxX: -41.5, minZ: 33.0, maxZ: 37.0 },
  ...MAP_CONTAINERS.slice(7).map((c) => c.box),
];

export const FIELD_OBSTACLES: ObstacleBox[] = [
  // Spoke Perimeter Boundary Walls (Perimeter: |x| = 80, z: -50 to +80)
  // South Wall
  { minX: -80.0, maxX: 80.0, minZ: 79.5, maxZ: 80.5 },
  // West Wall
  { minX: -80.5, maxX: -79.5, minZ: -50.0, maxZ: 80.0 },
  // East Wall
  { minX: 79.5, maxX: 80.5, minZ: -50.0, maxZ: 80.0 },
  // North Wall
  { minX: -80.0, maxX: 80.0, minZ: -80.5, maxZ: -79.5 },

  // FOB Staging Outpost (z: -85 to -50)
  // FOB North Wall Behind Outpost
  { minX: -8.0, maxX: 8.0, minZ: -73.6, maxZ: -72.4 },
  // FOB Side Enclosure Walls
  { minX: -8.5, maxX: -7.5, minZ: -73.0, maxZ: -52.0 },
  { minX: 7.5, maxX: 8.5, minZ: -73.0, maxZ: -52.0 },
  // FOB Concrete Security Barriers (wings flanking perimeter, central walkway |x| < 4.8 completely open)
  { minX: -7.5, maxX: -4.8, minZ: -64.2, maxZ: -62.8 },
  { minX: 4.8, maxX: 7.5, minZ: -64.2, maxZ: -62.8 },
  // FOB Power Cores & Consoles
  { minX: -5.4, maxX: -3.8, minZ: -71.8, maxZ: -70.2 },
  { minX: 3.8, maxX: 5.4, minZ: -71.8, maxZ: -70.2 },
  { minX: -4.5, maxX: -3.1, minZ: -67.8, maxZ: -66.2 },
  { minX: 3.1, maxX: 4.5, minZ: -67.8, maxZ: -66.2 },

  // Spatial Airlock Flanking Warp Beacons at z = -52
  { minX: -5.2, maxX: -3.8, minZ: -52.8, maxZ: -51.2 },
  { minX: 3.8, maxX: 5.2, minZ: -52.8, maxZ: -51.2 },

  // Emergency Bunker Exfil Bulkhead & Blast Doors at (-45, -45)
  { minX: -49.0, maxX: -41.0, minZ: -48.5, maxZ: -46.5 },
  // Emergency Bunker Keycard Terminal Console
  { minX: -45.6, maxX: -44.4, minZ: -45.4, maxZ: -44.2 },

  // Placed Loot Containers in Sector 7 Depot
  // crate_01: Military Dumpster (-8, -6)
  { minX: -9.2, maxX: -6.8, minZ: -6.8, maxZ: -5.3 },
  // crate_02: Chemical & Contraband Barrel (20, -15)
  { minX: 19.4, maxX: 20.6, minZ: -15.6, maxZ: -14.4 },
  // crate_03: Tech Storage Console (-16, 14)
  { minX: -16.8, maxX: -15.2, minZ: 13.4, maxZ: 14.6 },
  // crate_04: Supply Footlocker (30, 22)
  { minX: 29.3, maxX: 30.7, minZ: 21.3, maxZ: 22.7 },
  // crate_05: Fallen Operative Corpse (-35, -25)
  { minX: -35.8, maxX: -34.2, minZ: -25.8, maxZ: -24.2 },

  // Exfil Zone Warp Beacons (45, 45)
  { minX: 39.0, maxX: 40.6, minZ: 44.2, maxZ: 45.8 },
  { minX: 49.4, maxX: 51.0, minZ: 44.2, maxZ: 45.8 },
];

export const ALL_OCCLUDING_OBSTACLES: ObstacleBox[] = [
  ...DEPOT_CONTAINERS,
  ...FIELD_OBSTACLES,
];

export const ROGUE_PATROL_WAYPOINTS = [
  { x: -45, z: 45 },
  { x: -20, z: 20 },
  { x: 0, z: 35 },
  { x: 25, z: 15 },
  { x: 0, z: -15 },
  { x: -35, z: -10 },
];

export function segmentIntersectsAABB(
  x0: number, z0: number, x1: number, z1: number,
  minX: number, minZ: number, maxX: number, maxZ: number
): boolean {
  let tmin = 0.0;
  let tmax = 1.0;
  const dx = x1 - x0;
  const dz = z1 - z0;

  if (Math.abs(dx) < 1e-8) {
    if (x0 < minX || x0 > maxX) return false;
  } else {
    const ood = 1.0 / dx;
    let t1 = (minX - x0) * ood;
    let t2 = (maxX - x0) * ood;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-8) {
    if (z0 < minZ || z0 > maxZ) return false;
  } else {
    const ood = 1.0 / dz;
    let t1 = (minZ - z0) * ood;
    let t2 = (maxZ - z0) * ood;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return tmin <= 1.0 && tmax >= 0.0;
}
export function segmentIntersectsAABB3D(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number
): boolean {
  let tmin = 0.0;
  let tmax = 1.0;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  // X slab
  if (Math.abs(dx) < 1e-7) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    let t1 = (minX - x1) / dx;
    let t2 = (maxX - x1) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-7) {
    if (y1 < minY || y1 > maxY) return false;
  } else {
    let t1 = (minY - y1) / dy;
    let t2 = (maxY - y1) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Z slab
  if (Math.abs(dz) < 1e-7) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    let t1 = (minZ - z1) / dz;
    let t2 = (maxZ - z1) / dz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}


/**
 * @file game.ts
 * 60Hz deterministic game loop, kinetic stickman locomotion,
 * machine defense AI, proximity warning, and extraction zone logic.
 */

import { SIM_CONFIG, BOSS_CONFIG, computeBossPosition, AI_CONFIGS, computeAIPosition } from './config.js';
import {
  createExfilController,
  registerDeployment,
  ExfilController,
  StagedIngressController,
  type RaidWorldSnapshot,
} from './airlock.js';

export interface Vector2D {
  x: number;
  z: number;
}

export type StickActionState = 'idle' | 'walk' | 'sprint' | 'slide' | 'roll' | 'kick' | 'throw' | 'shoot' | 'jump' | 'crouch' | 'reload';

export interface OperativeState {
  id: string;
  isPlayer: boolean;
  isRival: boolean;
  isAI: boolean;
  name: string;
  badge?: string;
  x: number;
  y: number;
  z: number;
  facing: number; // radians
  health: number;
  armor: number;
  cash: number;
  action: StickActionState;
  actionTicks: number;
  isCrouching?: boolean;
  isJumping?: boolean;
  isInvulnerable: boolean;
  isAlive: boolean;
  isExtracted: boolean;
  isFlashlightOn?: boolean;
  hasLaser?: boolean;
  ammo: number;
  maxAmmo: number;
  shootCooldownTicks?: number;
  lastStateTimestamp?: number;
  muzzlePos?: { x: number; y: number; z: number };
  muzzleDir?: { x: number; y: number; z: number };
  continuousFireTicks?: number;
  isSliding?: boolean;
  slideTicksRemaining?: number;
  lastFiredAtMs?: number;
  lastFireTimestamp?: number;
  lastFireTick?: number;
  weapon?: 'rifle' | 'shotgun' | 'fists' | 'grenade';
  fragGrenades?: number;
  rifleAmmo?: number;
  shotgunAmmo?: number;
  reserveRifleAmmo?: number;
  reserveShotgunAmmo?: number;
  stimsRemaining?: number;
  isBleeding?: boolean;
  isUsingStim?: boolean;
  stimChannelTicks?: number;
  hasKeycard?: boolean;
  lastHitmarkerTick?: number;
  lastHitmarkerCrit?: boolean;
  squad?: string;
  isRolling?: boolean;
  barkText?: string;
  barkTick?: number;
  aimTicks?: number;
  lastBarkTick?: number;
}

export interface MachineDefense {
  id: string;
  type: 'turret' | 'drone';
  x: number;
  y: number;
  z: number;
  facing: number;
  health: number;
  isAlive: boolean;
  targetId?: string;
  cooldownTicks: number;
  lastFiredAtMs?: number;
  lastFiredTick?: number;
}

export interface LootItem {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  value: number;
  type: 'valuable' | 'med' | 'keycard' | 'ammo';
}

export interface LootCrate {
  id: string;
  x: number;
  z: number;
  cashValue: number;
  opened: boolean;
  claimedBy?: string;
  claimedAt?: number;
  containerType?: 'crate' | 'dumpster' | 'barrel' | 'console' | 'corpse';
  containerTitle?: string;
  items?: LootItem[];
}

export interface ProximityAlert {
  active: boolean;
  distance: number;
  bearing: number; // 0-360 degrees
  targetName?: string;
  isRogueAI?: boolean;
}

/** One authoritative melee kick action carrying its complete validated target set. */
export interface KickActionPayload {
  actionTick: number;
  attackerId: string;
  attackerX: number;
  attackerZ: number;
  attackerFacing: number;
  machineHits: Array<{ id: string; x: number; z: number; y?: number; damage: number; originX?: number; originZ?: number }>;
  rivalHits: Array<{ id: string; x: number; z: number; damage: number; knockX: number; knockZ: number; predictedHealth?: number; predictedArmor?: number }>;
}

export interface ActiveProjectile {
  id: string;
  shooterId: string;
  shooterIsPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  damage: number;
  radius: number;
  maxRange: number;
  distanceTraveled: number;
  weapon: "rifle" | "shotgun";
  isPellet?: boolean;
}

export function distanceToSegmentSquared(
  x1: number, z1: number,
  x2: number, z2: number,
  cx: number, cz: number
): { distSq: number; hitX: number; hitZ: number; t: number } {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.000001) {
    const ddx = cx - x1;
    const ddz = cz - z1;
    return { distSq: ddx * ddx + ddz * ddz, hitX: x1, hitZ: z1, t: 0 };
  }
  let t = ((cx - x1) * dx + (cz - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const hitX = x1 + t * dx;
  const hitZ = z1 + t * dz;
  const ddx = cx - hitX;
  const ddz = cz - hitZ;
  return { distSq: ddx * ddx + ddz * ddz, hitX, hitZ, t };
}

export interface GameInput {
  dx: number;
  dz: number;
  sprint: boolean;
  slide: boolean;
  roll: boolean;
  kick: boolean;
  shoot: boolean;
  interact: boolean;
  jump?: boolean;
  crouch?: boolean;
  aimAngle?: number;
  switchWeapon?: boolean;
  selectWeapon?: 'rifle' | 'shotgun' | 'fists' | 'grenade';
  stim?: boolean;
  reload?: boolean;
  ads?: boolean;
}

export class SectorDepotSimulation {
  private lastConsumedFireTick: number = -1;

  public toggleFlashlight(): boolean {
    this.player.isFlashlightOn = !(this.player.isFlashlightOn ?? true);
    return this.player.isFlashlightOn;
  }

  public toggleLaser(): boolean {
    this.player.hasLaser = !(this.player.hasLaser ?? false);
    return this.player.hasLaser;
  }

  public consumeFireEvent(): boolean {
    if (this.player.lastFireTick !== undefined && this.player.lastFireTick > this.lastConsumedFireTick) {
      this.lastConsumedFireTick = this.player.lastFireTick;
      return true;
    }
    return false;
  }

  public tick = 0;
  public raidId: string = "raid_sector7_1042";
  public isRaidExpired = false;
  public zoneMode: 'hub' | 'airlock_corridor' | 'spoke' = 'spoke';
  public trainingProgress = {
    dummyHit: false,
    agilityUsed: false,
    crateLooted: false,
  };
  public dummyHitCount: number = 0;
  public lastDummyHitTick: number = 0;
  public lastDummyHitSide: 'left' | 'right' = 'left';
  public lastPlayerDamageTick: number = 0;
  public lastPlayerDamageAmount: number = 0;
  public lastPlayerDamageAngle: number = 0;
  public damageIndicators: DamageIndicatorEntry[] = [];
  public lastDamageDirectionDeg: number | null = null;
  public recentBark?: { sender: string; text: string; tick: number; isBoss?: boolean };
  public activeGrenades: ActiveGrenade[] = [];
  public airlockTimerMs: number = 0;
  public aiSpawned = false;
  public frozenSettlementTick?: number;
  public frozenSettlementCash?: number;
  private cratePreviousAmmo = new Map<string, number>();
  private crateLootHistory: Array<{
    crateId: string;
    weapon?: 'rifle' | 'shotgun';
    ammoBefore: number;
    ammoGranted: number;
    rifleAmmoBefore?: number;
    shotgunAmmoBefore?: number;
    rifleAmmoGranted?: number;
    shotgunAmmoGranted?: number;
    tick: number;
    approved: boolean;
  }> = [];
  public player: OperativeState;
  public squadmate: OperativeState;
  public rivals: OperativeState[] = [];
  public machines: MachineDefense[] = [];
  public crates: LootCrate[] = [];
  public exfilController: ExfilController;
  public confirmedAIStates: Map<string, { health: number; armor: number; isAlive: boolean; isKia: boolean; killerId?: string }> = new Map();

  public applyConfirmedAIState(targetId: string, state: { health: number; armor: number; isAlive: boolean; isKia: boolean; killerId?: string }): void {
    this.confirmedAIStates.set(targetId, state);
    const rival = this.rivals.find(r => r.id === targetId);
    if (rival) {
      rival.health = state.health;
      rival.armor = state.armor;
      rival.isAlive = state.isAlive;
      (rival as any).isKia = state.isKia;
    }
  }
  public activeProjectiles: ActiveProjectile[] = [];
  public ingressController: StagedIngressController;
  public proximityAlert: ProximityAlert = { active: false, distance: 999, bearing: 0 };
  public combatLog: string[] = [];
  public lastInterruptionTick = 0;
  public shootCooldownTicks = 0;
  public rollCooldownTicks = 0;
  public kickCooldownTicks = 0;
  public kickStrikePending = false;
  public slideVx = 0;
  public slideVz = 0;
  public walkVx = 0;
  public walkVz = 0;
  public jumpVy = 0;
  public slideTicksRemaining = 0;
  public slideKeyReleased = true;
  public cameraPos?: { x: number; y: number; z: number };
  public cameraTarget?: { x: number; y: number; z: number };
  public cameraFov: number = 46.0;
  public isAds: boolean = false;
  public onPlayerDeath?: () => void;
  public onDamageTaken?: () => void;

  // External network coordinator callbacks
  public onHitTarget?: (targetId: string, damage: number, knockbackX?: number, knockbackZ?: number, kind?: 'rifle' | 'kick' | 'shotgun', shotId?: string) => void;
  public onLootCrate?: (crateId: string, cash: number, claimTimestamp?: number) => void;
  public onHoldProgress?: (holdTicks: number, currentTick: number) => void;
  public settlementAuthority?: any;
  public requestServerSettlement?: (tick: number, cash: number) => Promise<{ receipt: any; outcomePayload: any }>;
  public onRequestLootCrate?: (crateId: string, cashValue: number) => void;
  public keycardSources = new Set<string>();


  public getOperativeMuzzle(operative: OperativeState): {
    origin: { x: number; y: number; z: number };
    dir: { x: number; y: number; z: number };
  } {
    const sinF = Math.sin(operative.facing);
    const cosF = Math.cos(operative.facing);

    // If real 3D skeletal bone muzzle tip has been sampled by renderer, use it
    if (operative.muzzlePos) {
      return {
        origin: { ...operative.muzzlePos },
        dir: operative.muzzleDir ? { ...operative.muzzleDir } : { x: sinF, y: 0, z: cosF },
      };
    }

    // Mathematically exact geometric fallback: forward in aim direction, right weapon flank (-cosF, sinF)
    const forward = operative.weapon === "shotgun" ? 0.68 : 0.62;
    const rightLateral = 0.20;
    const rightX = -cosF;
    const rightZ = sinF;
    return {
      origin: {
        x: operative.x + sinF * forward + rightX * rightLateral,
        y: (operative.y || 0) + 1.16,
        z: operative.z + cosF * forward + rightZ * rightLateral,
      },
      dir: { x: sinF, y: 0, z: cosF },
    };
  }

  public grantKeycard(sourceId: string): void {
    this.keycardSources.add(sourceId);
    this.player.hasKeycard = true;
  }

  public revokeKeycard(sourceId: string): void {
    this.keycardSources.delete(sourceId);
    this.player.hasKeycard = this.keycardSources.size > 0;
  }
  public crateHadKeycard = new Map<string, boolean>();
  public crateAddedStims = new Map<string, number>();
  public crateAddedRifleAmmo = new Map<string, number>();
  public crateAddedShotgunAmmo = new Map<string, number>();
  private shootTriggerReleased = true;
  public onMachineHit?: (machineId: string, damage: number, kind?: 'kick' | 'rifle' | 'shotgun', shotId?: string) => void;
  /**
   * Aggregated melee kick action: ONE action = ONE authoritative validation = ONE cooldown charge.
   * The kick may reach multiple machines and rivals; the network layer must dispatch the full
   * target set as a single packet so the authority validates it atomically (never per-target
   * cooldown rejections that desync optimistic prediction).
   * Falls back to per-target onMachineHit/onHitTarget when no aggregator is wired (offline/solo).
   */
  public onKickAction?: (action: KickActionPayload) => void;
  private _onExfilSuccess?: (receipt?: any) => void;
  public acceptedReceiptKeys = new Set<string>();

  public get onExfilSuccess(): ((receipt?: any) => void) | undefined {
    if (!this._onExfilSuccess) return undefined;
    return (receipt?: any) => {
      if (receipt && receipt.receiptId) {
        const key = `${receipt.raidId || this.raidId}:${receipt.receiptId}`;
        if (this.acceptedReceiptKeys.has(key)) return;
        this.acceptedReceiptKeys.add(key);
      }
      this._onExfilSuccess?.(receipt);
    };
  }

  public set onExfilSuccess(fn: ((receipt?: any) => void) | undefined) {
    this._onExfilSuccess = fn;
  }
  /**
   * When the authenticated relay runs server-side machine attack authority, local
   * machine->player damage is suppressed (visual fire continues): machine damage to
   * the LOCAL operative arrives exclusively via authoritative machine_attack
   * broadcasts, so a client cannot under-report machine fire to keep an hold alive.
   */
  public serverMachineDamageAuthority = false;
  public isSocketDisconnected = false;

  public isAdmitted(): boolean {
    return this.ingressController.getState().kind === 'confirmed_active';
  }

  public freezeSettlementSnapshot(minTick?: number): { tick: number; cash: number } {
    const serverHoldTick = (this as any).serverHoldCompletedAtTick ?? 0;
    const requiredTick = Math.max(this.tick, minTick ?? 0, serverHoldTick);
    if (this.frozenSettlementTick === undefined) {
      this.frozenSettlementTick = requiredTick;
      this.frozenSettlementCash = this.player.cash;
    } else if (this.frozenSettlementTick < requiredTick) {
      this.frozenSettlementTick = requiredTick;
    }
    return { tick: this.frozenSettlementTick, cash: this.frozenSettlementCash ?? this.player.cash };
  }

  public clearFrozenSettlement(): void {
    this.frozenSettlementTick = undefined;
    this.frozenSettlementCash = undefined;
  }

  public recordCrateLootAmmo(crateId: string): void {
    const weapon: 'rifle' | 'shotgun' = this.player.weapon === 'shotgun' ? 'shotgun' : 'rifle';
    const curRifle = typeof this.player.rifleAmmo === 'number' ? this.player.rifleAmmo : (weapon === 'rifle' ? this.player.ammo : 30);
    const curShotgun = typeof this.player.shotgunAmmo === 'number' ? this.player.shotgunAmmo : (weapon === 'shotgun' ? this.player.ammo : 8);
    const rifleGranted = Math.max(0, 30 - curRifle);
    const shotgunGranted = Math.max(0, 8 - curShotgun);

    this.crateLootHistory.push({
      crateId,
      weapon,
      ammoBefore: this.player.ammo,
      ammoGranted: weapon === 'shotgun' ? shotgunGranted : rifleGranted,
      rifleAmmoBefore: curRifle,
      shotgunAmmoBefore: curShotgun,
      rifleAmmoGranted: rifleGranted,
      shotgunAmmoGranted: shotgunGranted,
      tick: this.tick,
      approved: false,
    });
    this.player.rifleAmmo = 30;
    this.player.shotgunAmmo = 8;
    this.player.ammo = weapon === 'shotgun' ? 8 : 30;
    this.player.maxAmmo = weapon === 'shotgun' ? 8 : 30;
  }

  public handleCrateRejectionAmmo(crateId: string): void {
    const idx = this.crateLootHistory.findIndex((e) => e.crateId === crateId);
    if (idx === -1) {
      const prevAmmo = this.cratePreviousAmmo.get(crateId);
      if (prevAmmo !== undefined) {
        this.player.ammo = Math.min(this.player.ammo, prevAmmo);
        this.cratePreviousAmmo.delete(crateId);
      }
      return;
    }
    const entry = this.crateLootHistory[idx];

    // Roll back rifle ammo
    const rifleGranted = typeof (entry as any).rifleAmmoGranted === 'number'
      ? (entry as any).rifleAmmoGranted
      : (entry.weapon === 'rifle' ? entry.ammoGranted : 0);
    const curRifle = this.player.weapon === 'rifle' ? this.player.ammo : (this.player.rifleAmmo ?? 30);
    this.player.rifleAmmo = Math.max(0, curRifle - rifleGranted);

    // Roll back shotgun ammo
    const shotgunGranted = typeof (entry as any).shotgunAmmoGranted === 'number'
      ? (entry as any).shotgunAmmoGranted
      : (entry.weapon === 'shotgun' ? entry.ammoGranted : 0);
    const curShotgun = this.player.weapon === 'shotgun' ? this.player.ammo : (this.player.shotgunAmmo ?? 8);
    this.player.shotgunAmmo = Math.max(0, curShotgun - shotgunGranted);

    // Derive player.ammo from the currently equipped weapon
    if (this.player.weapon === 'shotgun') {
      this.player.ammo = this.player.shotgunAmmo;
    } else {
      this.player.ammo = this.player.rifleAmmo;
    }

    this.crateLootHistory.splice(idx, 1);
    this.cratePreviousAmmo.delete(crateId);
  }

  public handleCrateApprovalAmmo(crateId: string): void {
    const entry = this.crateLootHistory.find((e) => e.crateId === crateId);
    if (entry) {
      entry.approved = true;
    }
    this.cratePreviousAmmo.delete(crateId);
  }

  public restoreCrateStateFromSnapshot(crates: Array<{ id: string; opened?: boolean; claimedBy?: string; claimedAt?: number }>): void {
    for (const snapCrate of crates) {
      const crate = this.crates.find((c) => c.id === snapCrate.id);
      if (!crate) continue;
      const wasClaimedByMe = crate.claimedBy === this.player.id;
      const isNowClaimedByMe = snapCrate.opened !== false && snapCrate.claimedBy === this.player.id;

      if (wasClaimedByMe && !isNowClaimedByMe) {
        // Local claim was revoked by server snapshot! Unified full inventory rollback
        if (!this.player.isExtracted) {
          this.rollbackCrateClaim(crate.id, crate.cashValue);
        }
      }

      if (snapCrate.opened === false || !snapCrate.claimedBy) {
        crate.opened = false;
        crate.claimedBy = undefined;
        crate.claimedAt = 0;
      } else {
        crate.opened = true;
        crate.claimedBy = snapCrate.claimedBy;
        crate.claimedAt = snapCrate.claimedAt || 0;
        if (isNowClaimedByMe && !wasClaimedByMe) {
          if (!this.player.isExtracted) {
            this.player.cash += crate.cashValue;
            if (this.frozenSettlementCash !== undefined) {
              this.frozenSettlementCash += crate.cashValue;
            }
            if (!this.cratePreviousAmmo.has(crate.id)) {
              this.cratePreviousAmmo.set(crate.id, this.player.ammo);
            }
            this.recordCrateLootAmmo(crate.id);
            this.handleCrateApprovalAmmo(crate.id);
          }
        }
      }
    }
  }

  public restoreExtractionCustody(info: { holdCompleted?: boolean; holdCompletedAtTick?: number; isExtracted?: boolean; extractedAtTick?: number; receipt?: any }): void {
    if (info.isExtracted) {
      this.player.isExtracted = true;
      if (typeof (this.exfilController as any)?.restoreExtractionState === "function") {
        (this.exfilController as any).restoreExtractionState(info);
      }
    } else if (info.holdCompleted) {
      if (typeof info.holdCompletedAtTick === "number" && info.holdCompletedAtTick > 0) {
        (this as any).serverHoldCompletedAtTick = info.holdCompletedAtTick;
      } else if (!(this as any).serverHoldCompletedAtTick) {
        (this as any).serverHoldCompletedAtTick = Math.min(this.tick, SIM_CONFIG.RAID_DEADLINE_TICK);
      }
      if (typeof (this.exfilController as any)?.restoreExtractionState === "function") {
        (this.exfilController as any).restoreExtractionState(info);
      }
    } else {
      // Authoritative cancellation: clear local extraction custody and frozen settlement snapshot
      (this as any).serverHoldCompletedAtTick = 0;
      this.player.isExtracted = false;
      this.frozenSettlementCash = undefined;
      this.frozenSettlementTick = undefined;
      if (typeof (this.exfilController as any)?.restoreExtractionState === "function") {
        (this.exfilController as any).restoreExtractionState({ holdCompleted: false, isExtracted: false });
      } else {
        try {
          this.exfilController.cancel();
        } catch {
          (this.exfilController as any).state = { kind: "idle" };
        }
      }
    }
  }

  public reconcileCrateApproval(crateId: string, cash: number, approvedTimestamp?: number): void {
    if (this.player.isExtracted) return;
    const crate = this.crates.find((c) => c.id === crateId);
    if (!crate) return;
    this.handleCrateApprovalAmmo(crateId);
    const effectiveTimestamp = typeof approvedTimestamp === "number" ? approvedTimestamp : Date.now();
    if (crate.claimedBy && crate.claimedBy !== this.player.id) {
      const currentClaimedAt = crate.claimedAt || 0;
      const isWinner = effectiveTimestamp < currentClaimedAt || (effectiveTimestamp === currentClaimedAt && this.player.id < crate.claimedBy);
      if (!isWinner) {
        return; // Rival legitimately won with earlier timestamp or lexicographical tie-break; do not overwrite!
      }
    }
    if (crate.claimedBy !== this.player.id) {
      crate.claimedBy = this.player.id;
      crate.opened = true;
      crate.claimedAt = effectiveTimestamp;
      this.player.cash += cash;
      if (this.frozenSettlementCash !== undefined) {
        this.frozenSettlementCash += cash;
      }
      if (!this.cratePreviousAmmo.has(crate.id)) {
        this.cratePreviousAmmo.set(crate.id, this.player.ammo);
      }
      this.recordCrateLootAmmo(crate.id);
      this.handleCrateApprovalAmmo(crate.id);
      this.combatLog.push(`[SETTLEMENT] Loot claim for ${crateId} confirmed by server authority. Restored balance.`);
    } else {
      const hasHistory = this.crateLootHistory.some((e) => e.crateId === crateId);
      if (!hasHistory) {
        if (!this.cratePreviousAmmo.has(crate.id)) {
          this.cratePreviousAmmo.set(crate.id, this.player.ammo);
        }
        this.recordCrateLootAmmo(crate.id);
        this.handleCrateApprovalAmmo(crate.id);
      }
    }
  }

  public rollbackCrateClaim(crateId: string, cash?: number): void {
    if (this.player.isExtracted) return; // Finality: extracted cash is protected
    const crate = this.crates.find((c) => c.id === crateId);
    if (!crate || crate.claimedBy !== this.player.id) return;
    crate.claimedBy = undefined;
    crate.opened = false;
    const rollbackCash = typeof cash === 'number' ? cash : crate.cashValue;
    this.player.cash = Math.max(0, this.player.cash - rollbackCash);
    this.handleCrateRejectionAmmo(crateId);

    if (this.crateHadKeycard.get(crateId)) {
      this.revokeKeycard(crateId);
      this.crateHadKeycard.delete(crateId);
    }
    if (this.crateAddedStims.has(crateId)) {
      const s = this.crateAddedStims.get(crateId)!;
      this.player.stimsRemaining = Math.max(0, (this.player.stimsRemaining ?? 0) - s);
      this.crateAddedStims.delete(crateId);
    }
    if (this.crateAddedRifleAmmo.has(crateId)) {
      const a = this.crateAddedRifleAmmo.get(crateId)!;
      this.player.reserveRifleAmmo = Math.max(0, (this.player.reserveRifleAmmo ?? 0) - a);
      this.crateAddedRifleAmmo.delete(crateId);
    }
    if (this.crateAddedShotgunAmmo.has(crateId)) {
      const a = this.crateAddedShotgunAmmo.get(crateId)!;
      this.player.reserveShotgunAmmo = Math.max(0, (this.player.reserveShotgunAmmo ?? 0) - a);
      this.crateAddedShotgunAmmo.delete(crateId);
    }
    if (this.frozenSettlementCash !== undefined) {
      this.frozenSettlementCash = Math.min(this.frozenSettlementCash, this.player.cash);
    }
  }

  public reconcileCrateRejection(crateId: string, cash: number): void {
    this.rollbackCrateClaim(crateId, cash);
    this.combatLog.push(`[SETTLEMENT] Loot claim for ${crateId} rejected by authority. Reconciled balance.`);
  }

  public checkContainerCollision(x: number, z: number, radius = 0.45): boolean {
    for (const box of DEPOT_CONTAINERS) {
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        return true;
      }
    }
    for (const box of FIELD_OBSTACLES) {
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  public getBlockingContainerIndex(x: number, z: number, radius = 0.45): number {
    for (let i = 0; i < DEPOT_CONTAINERS.length; i++) {
      const box = DEPOT_CONTAINERS[i];
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        return i;
      }
    }
    return -1;
  }

  public checkContainerRayObstruction(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    y1: number = 1.0,
    y2: number = 1.0
  ): boolean {
    for (const box of DEPOT_CONTAINERS) {
      if (segmentIntersectsAABB3D(x1, y1, z1, x2, y2, z2, box.minX, 0, box.minZ, box.maxX, 5.2, box.maxZ)) {
        return true;
      }
    }
    for (const box of FIELD_OBSTACLES) {
      if (segmentIntersectsAABB3D(x1, y1, z1, x2, y2, z2, box.minX, 0, box.minZ, box.maxX, 4.0, box.maxZ)) {
        return true;
      }
    }
    return false;
  }

  public isPlayerInExfilZone(): boolean {
    return isPositionInExfilZone(this.player.x, this.player.z, this.player.hasKeycard);
  }

  public isInputLocked(): boolean {
    if (this.player.isExtracted) return true;
    if (this.isSocketDisconnected) return true;
    const exfilState = this.exfilController.getState();
    return this.exfilController.isInputLocked() || exfilState.kind === "failed" || exfilState.kind === "submitting_settlement" || exfilState.kind === "extracted" || !this.isAdmitted() || !this.player.isAlive || this.player.health <= 0;
  }

  public admitOperative(activationTick: number = 0, isResuming = false): void {
    if (this.ingressController.getState().kind === 'idle' || (isResuming && this.ingressController.getState().kind === 'rejected')) {
      this.ingressController.enterCorridor(activationTick, isResuming);
    }
    if (this.ingressController.getState().kind === 'corridor_entered') {
      this.ingressController.startHydration(activationTick);
    }
    if (this.ingressController.getState().kind === 'hydrating') {
      this.ingressController.applySnapshot({
        snapshotTick: activationTick,
        crates: this.crates.map((c) => ({ id: c.id, opened: c.opened })),
        machines: this.machines.map((m) => ({ id: m.id, health: m.health, isAlive: m.isAlive })),
      });
    }
    if (this.ingressController.getState().kind === 'waiting_squad') {
      this.ingressController.squadAck(1, 1);
      this.ingressController.activate(activationTick);
    }
  }

  public claimCrateLocally(crateId: string, claimantId: string, timestamp: number): boolean {
    const crate = this.crates.find((c) => c.id === crateId);
    if (!crate) return false;

    if (crate.opened) {
      const currentClaimant = crate.claimedBy || '';
      const currentTimestamp = crate.claimedAt || 0;

      // Deterministic total ordering: earlier timestamp wins, tie broken by lexicographical claimantId
      const isWinner = timestamp < currentTimestamp || (timestamp === currentTimestamp && claimantId < currentClaimant);
      if (isWinner) {
        if (claimantId !== currentClaimant) {
          // If local player had credited it, check finality first:
          if (currentClaimant === this.player.id) {
            if (this.player.isExtracted) {
              return false; // Settled player loot cannot be revoked post-extraction!
            }
            this.rollbackCrateClaim(crate.id, crate.cashValue);
            this.combatLog.push(`[LOOT CONTESTED] Crate already scavenged by rival!`);
          }
          crate.claimedBy = claimantId;
          crate.claimedAt = timestamp;
          if (claimantId === this.player.id) {
            this.player.cash += crate.cashValue;
            if (!this.cratePreviousAmmo.has(crate.id)) {
              this.cratePreviousAmmo.set(crate.id, this.player.ammo);
            }
            this.recordCrateLootAmmo(crate.id);
            this.combatLog.push(`[TICK ${this.tick}] Scavenged Crate: +${crate.cashValue.toLocaleString()}`);
            this.onLootCrate?.(crate.id, crate.cashValue, timestamp);
            return true;
          }
        } else {
          // Same claimant arrives with an earlier timestamp: update to earliest timestamp!
          crate.claimedAt = Math.min(currentTimestamp, timestamp);
        }
      } else {
        if (claimantId === this.player.id && currentClaimant !== this.player.id) {
          this.combatLog.push(`[LOOT CONTESTED] Crate already scavenged by rival!`);
        }
      }
      return false;
    }

    crate.opened = true;
    crate.claimedBy = claimantId;
    crate.claimedAt = timestamp;
    if (claimantId === this.player.id) {
      this.player.cash += crate.cashValue;
      if (!this.cratePreviousAmmo.has(crate.id)) {
        this.cratePreviousAmmo.set(crate.id, this.player.ammo);
      }
      this.recordCrateLootAmmo(crate.id);
      this.enqueuePresentationEvent({
        type: 'loot',
        operativeId: this.player.id,
        position: { x: crate.x, y: 0.8, z: crate.z },
        crateId: crate.id,
        value: crate.cashValue,
      });
      if (crate.items && crate.items.length > 0) {
        for (const item of crate.items) {
          if (item.type === 'keycard') {
            this.grantKeycard(crate.id);
            this.crateHadKeycard.set(crate.id, true);
            this.combatLog.push(`[KEYCARD SECURED] ${item.name} ($${item.value})! Bunker Blast Door Exfil unlocked.`);
          } else if (item.type === 'med') {
            this.player.stimsRemaining = (this.player.stimsRemaining ?? 0) + 1;
            this.crateAddedStims.set(crate.id, (this.crateAddedStims.get(crate.id) ?? 0) + 1);
            this.combatLog.push(`[MEDICAL SECURED] ${item.name} (+1 Stim injector).`);
          } else if (item.id === 'item_m855') {
            this.player.reserveRifleAmmo = (this.player.reserveRifleAmmo ?? 90) + 30;
            this.crateAddedRifleAmmo.set(crate.id, (this.crateAddedRifleAmmo.get(crate.id) ?? 0) + 30);
            this.combatLog.push(`[AMMO SECURED] ${item.name} (+30 5.56 rounds).`);
          } else if (item.id === 'item_slugs') {
            this.player.reserveShotgunAmmo = (this.player.reserveShotgunAmmo ?? 24) + 8;
            this.crateAddedShotgunAmmo.set(crate.id, (this.crateAddedShotgunAmmo.get(crate.id) ?? 0) + 8);
            this.combatLog.push(`[AMMO SECURED] ${item.name} (+8 12G shells).`);
          } else {
            this.combatLog.push(`[TARKOV LOOT] ${item.name} (${item.rarity.toUpperCase()}) — $${item.value.toLocaleString()}`);
          }
        }
      } else {
        this.combatLog.push(`[TICK ${this.tick}] Scavenged Crate: +${crate.cashValue.toLocaleString()}`);
      }
      this.onLootCrate?.(crate.id, crate.cashValue, timestamp);
    }
    return true;
  }

  public confirmedEliminatedIds: Set<string> = new Set<string>();
  private presentationEvents: PresentationEvent[] = [];
  private drainedPresentationEvents: PresentationEvent[] = [];

  public enqueuePresentationEvent(event: PresentationEvent): void {
    this.presentationEvents.push(event);
  }

  public drainPresentationEvents(): PresentationEvent[] {
    const drained = this.presentationEvents;
    const recycled = this.drainedPresentationEvents;
    recycled.length = 0;
    this.presentationEvents = recycled;
    this.drainedPresentationEvents = drained;
    return drained;
  }

  public confirmElimination(id: string, position: { x: number; y: number; z: number }): boolean {
    if (this.confirmedEliminatedIds.has(id)) return false;
    this.confirmedEliminatedIds.add(id);
    this.enqueuePresentationEvent({
      type: 'elimination',
      operativeId: id,
      position,
    });
    return true;
  }

  constructor(raidId: string = "raid_sector7_1042", initialZone: 'hub' | 'spoke' = 'spoke') {
    this.raidId = raidId;
    this.zoneMode = initialZone;
    this.exfilController = createExfilController();
    this.ingressController = new StagedIngressController();
    this.cameraPos = {
      x: initialZone === "hub" ? 0 : SIM_CONFIG.SPAWN_SQUAD_A.x,
      y: initialZone === "hub" ? 20.0 : 16.0,
      z: (initialZone === "hub" ? -66 : SIM_CONFIG.SPAWN_SQUAD_A.z) + (initialZone === "hub" ? 10.0 : 6.46),
    };
    this.cameraTarget = {
      x: initialZone === "hub" ? 0 : SIM_CONFIG.SPAWN_SQUAD_A.x,
      y: 1.0,
      z: (initialZone === "hub" ? -66 : SIM_CONFIG.SPAWN_SQUAD_A.z) + (initialZone === "hub" ? -1.0 : 0),
    };
    this.cameraFov = 46.0;



    const spawnX = initialZone === 'hub' ? 0 : SIM_CONFIG.SPAWN_SQUAD_A.x;
    const spawnZ = initialZone === 'hub' ? -66 : SIM_CONFIG.SPAWN_SQUAD_A.z;
    const spawnFacing = 0;

    // Spawn player operative with automatic deployment registration on identity change
    const rawPlayer: OperativeState = {
      id: 'op_player',
      isPlayer: true,
      isRival: false,
      isAI: false,
      name: 'OPERATIVE GHOST-1',
      badge: 'SQUAD ALPHA',
      x: spawnX,
      y: 0,
      z: spawnZ,
      facing: spawnFacing,
      health: 100,
      armor: 100,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      isFlashlightOn: true,
      hasLaser: false,
      ammo: 30,
      maxAmmo: 30,
      weapon: 'rifle',
      fragGrenades: 2,
      rifleAmmo: 30,
      shotgunAmmo: 8,
      reserveRifleAmmo: 90,
      reserveShotgunAmmo: 24,
      stimsRemaining: 2,
      isBleeding: false,
      isUsingStim: false,
      stimChannelTicks: 0,
      hasKeycard: false,
    };
    this.player = new Proxy(rawPlayer, {
      set: (target: any, prop: string | symbol, val: any) => {
        target[prop] = val;
        if (prop === 'id' && typeof val === 'string' && this.raidId) {
          registerDeployment(val, this.raidId);
        }
        return true;
      },
    });
    registerDeployment(this.player.id, this.raidId);

    // Spawn companion scout right beside the player
    const squadmateX = initialZone === 'hub' ? 2.2 : SIM_CONFIG.SPAWN_SQUAD_A.x + 2;
    const squadmateZ = initialZone === 'hub' ? -66 : SIM_CONFIG.SPAWN_SQUAD_A.z - 2;
    const squadmateFacing = initialZone === 'hub' ? Math.PI : 0;

    this.squadmate = {
      id: 'op_squadmate',
      isPlayer: false,
      isRival: false,
      isAI: true,
      squad: 'alpha',
      name: 'SCOUT VIPER-2',
      badge: 'SQUAD ALPHA',
      x: squadmateX,
      y: 0,
      z: squadmateZ,
      facing: squadmateFacing,
      health: 100,
      armor: 100,
      cash: 0,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    };

    // Initialize 2 automated machine defenses
    this.machines = [
      {
        id: 'turret_depot_alpha',
        type: 'turret',
        x: -5,
        y: 0,
        z: 12,
        facing: Math.PI,
        health: 120,
        isAlive: true,
        cooldownTicks: 45,
      },
      {
        id: 'drone_patrol_beta',
        type: 'drone',
        x: 14,
        y: 2.2,
        z: -8,
        facing: -Math.PI / 2,
        health: 75,
        isAlive: true,
        cooldownTicks: 30,
      },
    ];

    // Initialize tactical Tarkov loot containers across depot from single authoritative source
    this.crates = DEPOT_CRATE_CONFIGS.map((c) => ({
      id: c.id,
      x: c.x,
      z: c.z,
      cashValue: c.cashValue,
      opened: false,
      containerType: c.containerType,
      containerTitle: c.containerTitle,
      items: c.items.map((it) => ({ ...it })),
    }));
  }

  public applyRaidSnapshot(snapshot: RaidWorldSnapshot): void {
    if (!snapshot || typeof snapshot !== "object") return;
    if (!Array.isArray(snapshot.crates) || !Array.isArray(snapshot.machines)) return;
    // Raid-clock adoption ALWAYS routes through the frame consumer (drains the
    // accumulator + advances lastTime) so snapshot hydration can never double-count
    // time with the waiting frame loop.
    if (snapshot.snapshotTick !== undefined && typeof snapshot.snapshotTick === "number" && Number.isFinite(snapshot.snapshotTick) && snapshot.snapshotTick > this.tick) {
      const consume = (globalThis as any).__stickZoneConsumeAccumulatorMs;
      const advTicks = snapshot.snapshotTick - this.tick;
      this.tick = snapshot.snapshotTick;
      if (typeof consume === "function") { try { consume((advTicks * 1000) / 60); } catch {} }
    }
    if (Array.isArray(snapshot.crates)) {
      for (const snapCrate of snapshot.crates) {
        if (!snapCrate || typeof snapCrate !== "object") continue;
        const c = this.crates.find((x) => x.id === snapCrate.id);
        if (c) {
          if (c.claimedBy === this.player.id && snapCrate.claimedBy !== this.player.id) {
            // Local player claimed this crate locally, but snapshot indicates local player is not the owner
            if (!(snapshot as any).isAuthoritative && !(snapshot as any).serverAuthoritative) {
              continue; // Peer snapshots cannot fabricate or overwrite local crate ownership
            }
            // Authority revoked local claim (either awarded to rival or reset/unclaimed): apply complete inventory rollback!
            this.rollbackCrateClaim(c.id);
            c.claimedBy = (snapCrate as any).claimedBy ?? null;
            c.opened = !!snapCrate.opened;
            continue;
          }
          c.opened = c.opened || !!snapCrate.opened;
          if ((snapCrate as any).claimedBy) {
            c.claimedBy = (snapCrate as any).claimedBy;
            c.claimedAt = (snapCrate as any).claimedAt ?? (snapCrate as any).claimTick ?? 0;
          }
        }
      }
    }
    if (Array.isArray(snapshot.machines)) {
      for (const snapMachine of snapshot.machines) {
        if (!snapMachine || typeof snapMachine !== "object") continue;
        const m = this.machines.find((x) => x.id === snapMachine.id);
        if (m) {
          // Ordered vitals: a snapshot with an OLDER sequence never overrides a newer
          // local machine (prevents a stale-cache snapshot from zeroing a live machine).
          const snapSeq = (snapMachine as any).vitalsSeq;
          const localSeq = (m as any).vitalsSeq ?? 0;
          if (typeof snapSeq === "number" && Number.isFinite(snapSeq) && snapSeq < localSeq) {
            continue;
          }
          // If the machine is ALREADY destroyed locally, a peer snapshot MUST NOT resurrect it!
          if (!m.isAlive || m.health <= 0) {
            continue;
          }
          if (snapMachine.isAlive === false || (typeof snapMachine.health === "number" && snapMachine.health <= 0)) {
            m.isAlive = false;
            m.health = 0;
            continue;
          }
          m.health = typeof snapMachine.health === "number" ? Math.min(m.health, snapMachine.health) : m.health;
          m.isAlive = typeof snapMachine.isAlive === "boolean" ? (m.isAlive && snapMachine.isAlive) : m.isAlive;
          if (typeof snapMachine.cooldownTicks === "number") {
            m.cooldownTicks = snapMachine.cooldownTicks;
          }
        }
      }
    }
  }


  public requestLootCrate(crateId: string): boolean {
    if (this.isInputLocked()) return false;
    const crate = this.crates.find(c => c.id === crateId);
    if (this.zoneMode === 'hub') this.trainingProgress.crateLooted = true;
    if (!crate || crate.opened) return false;
    if (this.onRequestLootCrate) {
      this.onRequestLootCrate(crate.id, crate.cashValue);
    } else {
      this.claimCrateLocally(crate.id, this.player.id, Date.now());
    }
    return true;
  }

  public setWeapon(target: 'rifle' | 'shotgun' | 'fists' | 'grenade', force = false): void {
    if (!force && this.isInputLocked()) return;
    if (!force && this.player.action === 'roll') return;
    const current = this.player.weapon || 'rifle';
    if (current === target && !force) return;

    if (current === 'rifle') this.player.rifleAmmo = this.player.ammo;
    else if (current === 'shotgun') this.player.shotgunAmmo = this.player.ammo;
    else if (current === 'grenade') this.player.fragGrenades = this.player.ammo;

    if (target === 'fists') {
      this.player.weapon = 'fists';
      this.player.maxAmmo = 0;
      this.player.ammo = 0;
      this.combatLog.push(`[WEAPON] Equipped Martial Arts Fists & Combat Kicks`);
    } else if (target === 'grenade') {
      this.player.weapon = 'grenade';
      this.player.fragGrenades = this.player.fragGrenades !== undefined ? this.player.fragGrenades : 2;
      this.player.maxAmmo = 2;
      this.player.ammo = this.player.fragGrenades;
      this.combatLog.push(`[WEAPON] Equipped F-1 Concussive Frag Grenade`);
    } else if (target === 'shotgun') {
      this.player.weapon = 'shotgun';
      this.player.maxAmmo = 8;
      this.player.ammo = this.player.shotgunAmmo !== undefined ? this.player.shotgunAmmo : 8;
      this.combatLog.push(`[WEAPON] Equipped M590 Trench Shotgun [12-Gauge Buckshot]`);
    } else {
      this.player.weapon = 'rifle';
      this.player.maxAmmo = 30;
      this.player.ammo = this.player.rifleAmmo !== undefined ? this.player.rifleAmmo : 30;
      this.combatLog.push(`[WEAPON] Equipped M4A1 Tactical Rifle [5.56 NATO]`);
    }
  }

  public throwFragGrenade(): void {
    const forwardX = Math.sin(this.player.facing);
    const forwardZ = Math.cos(this.player.facing);
    const throwSpeed = 16.0;

    this.activeGrenades.push({
      id: `frag_player_${this.tick}_${Math.random().toString(36).substring(2, 6)}`,
      throwerId: this.player.id,
      x: this.player.x + forwardX * 0.65,
      y: 1.35,
      z: this.player.z + forwardZ * 0.65,
      vx: forwardX * throwSpeed,
      vy: 5.5,
      vz: forwardZ * throwSpeed,
      fuseTicks: 90,
      radius: 8.0,
      maxDamage: 90,
      detonated: false,
    });

    this.enqueuePresentationEvent({
      type: 'grenade_throw',
      shooterId: this.player.id,
      origin: { x: this.player.x, y: 1.2, z: this.player.z },
      target: { x: this.player.x + forwardX * 12, y: 0.1, z: this.player.z + forwardZ * 12 },
    });

    this.combatLog.push(`[ORDNANCE] Operative threw F-1 Concussive Frag Grenade!`);
  }

  public switchWeapon(): void {
    const current = this.player.weapon || 'rifle';
    this.setWeapon(current === 'rifle' ? 'shotgun' : 'rifle');
  }

  public reload(): boolean {
    if (this.isInputLocked()) return false;
    if (!this.player.isAlive || this.player.action === 'roll' || this.player.action === 'slide') return false;
    const isShotgun = this.player.weapon === 'shotgun';
    const currentAmmo = this.player.ammo;
    const maxAmmo = this.player.maxAmmo;
    if (currentAmmo >= maxAmmo) return false;

    const needed = maxAmmo - currentAmmo;
    if (isShotgun) {
      const reserve = this.player.reserveShotgunAmmo ?? 0;
      if (reserve <= 0) return false;
      const loaded = Math.min(needed, reserve);
      this.player.reserveShotgunAmmo = reserve - loaded;
      this.player.ammo += loaded;
      this.player.shotgunAmmo = this.player.ammo;
    } else {
      const reserve = this.player.reserveRifleAmmo ?? 0;
      if (reserve <= 0) return false;
      const loaded = Math.min(needed, reserve);
      this.player.reserveRifleAmmo = reserve - loaded;
      this.player.ammo += loaded;
      this.player.rifleAmmo = this.player.ammo;
    }

    this.player.action = 'reload';
    this.player.actionTicks = 15;
    this.shootCooldownTicks = 35;
    this.player.shootCooldownTicks = 35;
    this.combatLog.push(`[RELOAD] Tactical reload completed (${this.player.ammo}/${maxAmmo}).`);
    this.enqueuePresentationEvent({
      type: 'reload',
      operativeId: this.player.id,
      position: { x: this.player.x, y: 1.0, z: this.player.z },
    });
    return true;
  }

  public useStim(): boolean {
    if (this.isInputLocked()) return false;
    if (!this.player.isAlive || (this.player.stimsRemaining ?? 0) <= 0 || this.player.isUsingStim) return false;
    // Reject stim administration during active movement states (roll, slide, jump)
    if (this.player.action === 'roll' || this.player.action === 'slide' || this.player.action === 'jump' || this.player.isJumping || this.player.y > 0 || (this.slideTicksRemaining ?? 0) > 0) {
      return false;
    }
    this.player.isUsingStim = true;
    this.player.stimChannelTicks = 60; // 1.0s administration channel at 60 Hz
    this.combatLog.push(`[MEDS] Injecting Propital Combat Stim... (1.0s channel)`);
    return true;
  }

  public spawnScavSquad(): void {
    const existingScavs = this.rivals.filter(r => r.id.startsWith('scav_') && r.isAlive);
    if (existingScavs.length > 0) return;

    const runnerSaved = this.confirmedAIStates.get(AI_CONFIGS.scav_runner_01.id);
    const runnerPos = computeAIPosition(AI_CONFIGS.scav_runner_01.id, this.tick);
    this.rivals.push({
      id: AI_CONFIGS.scav_runner_01.id,
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: AI_CONFIGS.scav_runner_01.name,
      badge: AI_CONFIGS.scav_runner_01.badge,
      x: runnerPos.x,
      y: 0,
      z: runnerPos.z,
      facing: runnerPos.facing,
      health: runnerSaved ? runnerSaved.health : AI_CONFIGS.scav_runner_01.startingHealth,
      armor: runnerSaved ? runnerSaved.armor : AI_CONFIGS.scav_runner_01.startingArmor,
      cash: AI_CONFIGS.scav_runner_01.cash,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: runnerSaved ? runnerSaved.isAlive : true,
      isExtracted: false,
      ammo: AI_CONFIGS.scav_runner_01.ammo,
      maxAmmo: AI_CONFIGS.scav_runner_01.maxAmmo,
      weapon: AI_CONFIGS.scav_runner_01.weapon,
    });
    if (runnerSaved?.isKia) {
      (this.rivals[this.rivals.length - 1] as any).isKia = true;
    }

    const enforcerSaved = this.confirmedAIStates.get(AI_CONFIGS.scav_enforcer_02.id);
    const enforcerPos = computeAIPosition(AI_CONFIGS.scav_enforcer_02.id, this.tick);
    this.rivals.push({
      id: AI_CONFIGS.scav_enforcer_02.id,
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: AI_CONFIGS.scav_enforcer_02.name,
      badge: AI_CONFIGS.scav_enforcer_02.badge,
      x: enforcerPos.x,
      y: 0,
      z: enforcerPos.z,
      facing: enforcerPos.facing,
      health: enforcerSaved ? enforcerSaved.health : AI_CONFIGS.scav_enforcer_02.startingHealth,
      armor: enforcerSaved ? enforcerSaved.armor : AI_CONFIGS.scav_enforcer_02.startingArmor,
      cash: AI_CONFIGS.scav_enforcer_02.cash,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: enforcerSaved ? enforcerSaved.isAlive : true,
      isExtracted: false,
      ammo: AI_CONFIGS.scav_enforcer_02.ammo,
      maxAmmo: AI_CONFIGS.scav_enforcer_02.maxAmmo,
      weapon: AI_CONFIGS.scav_enforcer_02.weapon,
    });
    if (enforcerSaved?.isKia) {
      (this.rivals[this.rivals.length - 1] as any).isKia = true;
    }

    const bossSaved = this.confirmedAIStates.get(BOSS_CONFIG.id);
    const bossInitPos = computeBossPosition(this.tick);
    this.rivals.push({
      id: BOSS_CONFIG.id,
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: BOSS_CONFIG.name,
      badge: BOSS_CONFIG.badge,
      x: bossInitPos.x,
      y: 0,
      z: bossInitPos.z,
      facing: bossInitPos.facing,
      health: bossSaved ? bossSaved.health : BOSS_CONFIG.startingHealth,
      armor: bossSaved ? bossSaved.armor : BOSS_CONFIG.startingArmor,
      cash: BOSS_CONFIG.cash,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: bossSaved ? bossSaved.isAlive : true,
      isExtracted: false,
      ammo: BOSS_CONFIG.ammo,
      maxAmmo: BOSS_CONFIG.maxAmmo,
      weapon: BOSS_CONFIG.weapon,
      hasKeycard: BOSS_CONFIG.hasKeycard,
    });
    if (bossSaved?.isKia) {
      (this.rivals[this.rivals.length - 1] as any).isKia = true;
    }

    this.combatLog.push(`[SCAV ALERT] Sector 7 Scavs patrolling depot. Warlord Boss spotted near South Depot.`);
  }

  public spawnRogueSquad(): void {
    const activeRivals = this.rivals.filter(r => r.isAlive && !r.isExtracted);
    if (activeRivals.length > 0) return;

    const rogueSaved = this.confirmedAIStates.get(AI_CONFIGS.op_rogue_ai.id);
    const roguePos = computeAIPosition(AI_CONFIGS.op_rogue_ai.id, this.tick);

    this.rivals.push({
      id: AI_CONFIGS.op_rogue_ai.id,
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: AI_CONFIGS.op_rogue_ai.name,
      badge: AI_CONFIGS.op_rogue_ai.badge,
      x: roguePos.x,
      y: 0,
      z: roguePos.z,
      facing: roguePos.facing,
      health: rogueSaved ? rogueSaved.health : AI_CONFIGS.op_rogue_ai.startingHealth,
      armor: rogueSaved ? rogueSaved.armor : AI_CONFIGS.op_rogue_ai.startingArmor,
      cash: AI_CONFIGS.op_rogue_ai.cash,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: rogueSaved ? rogueSaved.isAlive : true,
      isExtracted: false,
      ammo: AI_CONFIGS.op_rogue_ai.ammo,
      maxAmmo: AI_CONFIGS.op_rogue_ai.maxAmmo,
      weapon: AI_CONFIGS.op_rogue_ai.weapon,
    });
    if (rogueSaved?.isKia) {
      (this.rivals[this.rivals.length - 1] as any).isKia = true;
    }

    this.combatLog.push(`[TICK ${this.tick}] WARNING: ROGUE AI OPERATOR detected in Sector 7 Safehouse.`);
  }

  public interruptStimTreatment(reason: 'trauma' | 'movement' = 'trauma'): void {
    if (this.player.isUsingStim) {
      this.player.isUsingStim = false;
      this.player.stimChannelTicks = 0;
      this.combatLog.push(
        reason === 'movement'
          ? '[MEDS INTERRUPTED] Stim injection interrupted by abrupt movement!'
          : '[MEDS INTERRUPTED] Stim injection interrupted by incoming trauma!'
      );
    }
  }

  public applyDamageToPlayer(rawDmg: number, fromX?: number, fromZ?: number): void {
    // Total invulnerability in FOB hub, airlock corridor, or while ingress shield active
    if (this.zoneMode === 'hub' || this.zoneMode === 'airlock_corridor' || this.player.isInvulnerable || !this.player.isAlive || this.isSocketDisconnected) return;

    this.lastPlayerDamageTick = this.tick;
    this.lastPlayerDamageAmount = rawDmg;
    let angleDeg: number;
    if (fromX !== undefined && fromZ !== undefined) {
      const dx = fromX - this.player.x;
      const dz = fromZ - this.player.z;
      this.lastPlayerDamageAngle = Math.atan2(dx, dz);
      // Screen space: 0 deg = North (-Z), 90 deg = East (+X), 180 deg = South (+Z), -90 deg = West (-X)
      angleDeg = Math.round((Math.atan2(dx, -dz) * 180) / Math.PI);
    } else {
      angleDeg = 0;
      this.lastPlayerDamageAngle = (Math.random() - 0.5) * Math.PI;
    }
    this.lastDamageDirectionDeg = angleDeg;

    this.damageIndicators.push({
      id: "dmg_" + this.tick + "_" + Math.random().toString(36).substring(2, 7),
      angleDeg,
      damage: rawDmg,
      tick: this.tick,
      timestamp: Date.now(),
    });
    if (this.damageIndicators.length > 8) {
      this.damageIndicators.shift();
    }

    const { newHealth, newArmor } = applyStandardDamage(this.player.health, this.player.armor, rawDmg);
    this.player.health = newHealth;
    this.player.armor = newArmor;

    this.interruptStimTreatment();

    // Chance of heavy bleed on unarmored or heavy hit
    if (rawDmg >= 12 && this.player.armor < 20 && !this.player.isBleeding) {
      this.player.isBleeding = true;
      this.combatLog.push(`[TRAUMA ALERT] Heavy bleeding sustained! Inject IFAK stim [H] to bandage.`);
    }

    // Critical Extraction Rule: taking damage resets hold ticks to 0 immediately.
    // An "extraction interruption" is only registered when an ACTIVE hold attempt was
    // interrupted — damage outside the LZ must not fabricate a reset event.
    // Handle elimination unconditionally first so player state is never half-alive
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.player.isAlive = false;
      this.confirmElimination(this.player.id, { x: this.player.x, y: 0.95, z: this.player.z });
      this.combatLog.push(`[TICK ${this.tick}] K.I.A. Operative eliminated`);
      this.onPlayerDeath?.();
    }

    const interruptedActiveHold = this.exfilController.getState().kind === "holding_zone";
    try {
      this.exfilController.onDamageTaken();
    } catch {
      // safe fallback
    }
    if (interruptedActiveHold) {
      this.lastInterruptionTick = this.tick;
      this.onHoldProgress?.(0, this.tick);
    }
    this.onDamageTaken?.();
  }

  /** Step active grenade physics, fuse countdown, and concussive fragmentation blast */
  public stepGrenades(): void {
    const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;
    const remaining: ActiveGrenade[] = [];

    for (const g of this.activeGrenades) {
      g.fuseTicks -= 1;
      g.x += g.vx * dt;
      g.z += g.vz * dt;
      g.y += g.vy * dt;
      g.vy -= 14.0 * dt; // Gravity

      // Ground bounce
      if (g.y <= 0.15) {
        g.y = 0.15;
        g.vy = -g.vy * 0.35;
        g.vx *= 0.65;
        g.vz *= 0.65;
      }

      // Container obstacle collision bounce
      if (this.checkContainerCollision(g.x, g.z, 0.2)) {
        g.vx = -g.vx * 0.5;
        g.vz = -g.vz * 0.5;
      }

      if (g.fuseTicks <= 0) {
        g.detonated = true;
        this.enqueuePresentationEvent({
          type: 'explosion',
          position: { x: g.x, y: 0.5, z: g.z },
          radius: g.radius,
        });

        // Concussive shockwave: gunfire sound propagation alerts the sector
        this.propagateGunfireSound(g.x, g.z, 50.0);

        // Blast radius damage calculation
        // 1. Damage to player
        const distToPlayer = Math.hypot(this.player.x - g.x, this.player.z - g.z);
        if (distToPlayer <= g.radius && this.player.isAlive) {
          const isCovered = this.checkContainerRayObstruction(g.x, g.z, this.player.x, this.player.z, 0.8, 0.8);
          if (!isCovered) {
            const falloff = 1 - (distToPlayer / g.radius);
            let dmg = Math.round(g.maxDamage * Math.max(0.3, falloff));
            if (this.player.action === 'roll' || this.player.isInvulnerable) {
              dmg = Math.round(dmg * 0.25); // Roll dodge reduces fragmentation damage by 75%
              this.combatLog.push(`[BLAST DEFLECTION] Combat roll evaded direct fragmentation cone! (-${dmg} HP)`);
            }
            this.applyDamageToPlayer(dmg, g.x, g.z);
            this.combatLog.push(`[DETONATION] F-1 fragmentation blast struck Operative (-${dmg} HP)!`);
          } else {
            this.combatLog.push(`[BLAST COVER] Container absorbed F-1 fragmentation shockwave.`);
          }
        }

        // 2. Damage to rivals
        for (const rival of this.rivals) {
          if (!rival.isAlive || rival.isExtracted) continue;
          const distToRival = Math.hypot(rival.x - g.x, rival.z - g.z);
          if (distToRival <= g.radius) {
            const isCovered = this.checkContainerRayObstruction(g.x, g.z, rival.x, rival.z, 0.8, 0.8);
            if (!isCovered) {
              const falloff = 1 - (distToRival / g.radius);
              const dmg = Math.round(g.maxDamage * Math.max(0.3, falloff));
              const { newHealth, newArmor } = applyStandardDamage(rival.health, rival.armor, dmg);
              rival.health = newHealth;
              rival.armor = newArmor;
              this.handleRivalDamage(rival, dmg);
              this.combatLog.push(`[DETONATION] Frag blast hit ${rival.name} (-${dmg} HP)`);
              if (rival.health <= 0) {
                rival.isAlive = false;
                this.combatLog.push(`[ELIMINATION] ${rival.name} eliminated by fragmentation grenade.`);
                if (rival.id === BOSS_CONFIG.id || rival.badge === BOSS_CONFIG.badge) {
                  this.grantKeycard(BOSS_CONFIG.id);
                }
              }
            }
          }
        }

        // 3. Damage to machines
        for (const machine of this.machines) {
          if (!machine.isAlive) continue;
          const distToM = Math.hypot(machine.x - g.x, machine.z - g.z);
          if (distToM <= g.radius) {
            machine.health = Math.max(0, machine.health - 60);
            if (machine.health <= 0) {
              machine.isAlive = false;
              this.combatLog.push(`[DETONATION] Defense turret ${machine.id} destroyed by explosive blast.`);
            }
          }
        }
      } else {
        remaining.push(g);
      }
    }

    this.activeGrenades = remaining;
  }

  /** Gunfire Acoustic Propagation: alerts AI within hearing radius (Tarkov Macro) */
  public propagateGunfireSound(originX: number, originZ: number, radius = 45.0): void {
    for (const rival of this.rivals) {
      if (!rival.isAlive || rival.isExtracted || !rival.isAI) continue;
      const dx = originX - rival.x;
      const dz = originZ - rival.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        const wasAlert = ((rival as any).playerAlertTicks || 0) > 0;
        (rival as any).playerAlertTicks = Math.max((rival as any).playerAlertTicks || 0, 240);
        (rival as any).lastHeardShotTick = this.tick;
        if (!wasAlert) {
          rival.facing = Math.atan2(dx, dz);
          const alertBarks = ['GUNFIRE!', 'CONTACT!', 'OVER THERE!', 'DID YOU HEAR THAT?!', 'HOSTILE FIRE!'];
          const bark = alertBarks[Math.floor(Math.random() * alertBarks.length)];
          rival.barkText = bark;
          rival.barkTick = this.tick;
          this.recentBark = { sender: rival.name, text: bark, tick: this.tick, isBoss: rival.id === BOSS_CONFIG.id };
          this.combatLog.push();
        }
      }
    }
  }

  /** Boss & Guard Aggro Linking: Pack Tactics coordination when damaged (Tarkov Macro) */
  public handleRivalDamage(rival: OperativeState, damage: number): void {
    if (!rival.isAI) return;
    (rival as any).playerAlertTicks = Math.max((rival as any).playerAlertTicks || 0, 360);

    const isBoss = rival.id === BOSS_CONFIG.id || rival.badge === BOSS_CONFIG.badge;
    const isGuard = rival.id === 'scav_runner_01' || rival.id === 'scav_enforcer_02' || rival.badge === 'SCAV PATROL';

    if (isBoss) {
      // Pack Tactics: Attacking the Warlord alerts all bodyguards to converge
      for (const other of this.rivals) {
        if (!other.isAlive || other.isExtracted || !other.isAI) continue;
        if (other.id === 'scav_runner_01' || other.id === 'scav_enforcer_02' || other.badge === 'SCAV PATROL') {
          (other as any).playerAlertTicks = Math.max((other as any).playerAlertTicks || 0, 360);
          (other as any).convergeOnPlayer = true;
          if (!other.barkTick || this.tick - other.barkTick > 90) {
            const guardBarks = ['PROTECT THE WARLORD!', 'DEFEND THE COMMANDER!', 'FLANKING INTRUDER!'];
            const bark = guardBarks[Math.floor(Math.random() * guardBarks.length)];
            other.barkText = bark;
            other.barkTick = this.tick;
            this.recentBark = { sender: other.name, text: bark, tick: this.tick };
            this.combatLog.push(`[PACK TACTICS] ${other.name}: "${bark}"`);
          }
        }
      }
    } else if (isGuard) {
      // Pack Tactics: Attacking a guard alerts the Boss and fellow guards
      for (const other of this.rivals) {
        if (!other.isAlive || other.isExtracted || !other.isAI) continue;
        if (other.id === BOSS_CONFIG.id || other.badge === BOSS_CONFIG.badge) {
          (other as any).playerAlertTicks = Math.max((other as any).playerAlertTicks || 0, 360);
          if (!other.barkTick || this.tick - other.barkTick > 90) {
            const bossBarks = ['KILL THE INTRUDER!', 'EXTERMINATE THEM!', 'NO ONE SURVIVES!'];
            const bark = bossBarks[Math.floor(Math.random() * bossBarks.length)];
            other.barkText = bark;
            other.barkTick = this.tick;
            this.recentBark = { sender: other.name, text: bark, tick: this.tick, isBoss: true };
            this.combatLog.push(`[PACK TACTICS] ${other.name}: "${bark}" (guard under fire)`);
          }
        } else if (other.id !== rival.id && (other.id === 'scav_runner_01' || other.id === 'scav_enforcer_02' || other.badge === 'SCAV PATROL')) {
          (other as any).playerAlertTicks = Math.max((other as any).playerAlertTicks || 0, 300);
          (other as any).convergeOnPlayer = true;
        }
      }
    }
  }


  public enterSpatialAirlock(): void {
    if (this.zoneMode === 'airlock_corridor' || this.zoneMode === 'spoke') return;
    this.zoneMode = 'airlock_corridor';
    this.airlockTimerMs = Date.now() + 2500;
    this.combatLog.push();
  }

  public returnToHub(): void {
    this.zoneMode = 'hub';
    this.player.x = 0;
    this.player.z = -66;
    this.player.facing = Math.PI;
    this.player.health = 100;
    this.player.armor = 100;
    this.player.isAlive = true;
    this.player.isExtracted = false;
    this.damageIndicators = [];
    this.lastDamageDirectionDeg = null;
    this.combatLog.push();
  }
  public step(input: GameInput): void {
    const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;
        if (this.damageIndicators.length > 0) {
      this.damageIndicators = this.damageIndicators.filter((d) => this.tick - d.tick < 90);
    }
    this.isAds = Boolean(input.ads);
    this.player.isCrouching = Boolean(input.crouch);
    if (!this.player.isAlive || this.player.isExtracted) {
      if (this.exfilController.getState().kind === "corridor_presentation") {
        this.exfilController.cancel();
      }
      if (this.player.y > 0 || this.jumpVy !== 0 || this.player.isJumping) {
        // dt hoisted to step() scope
        this.player.y = Math.max(0, this.player.y + this.jumpVy * dt);
        this.jumpVy -= 12.0 * dt;
        if (this.player.y <= 0) {
          this.player.y = 0;
          this.jumpVy = 0;
          this.player.isJumping = false;
        }
      }
      return;
    }

    if (this.zoneMode === 'spoke' && this.tick >= SIM_CONFIG.RAID_DEADLINE_TICK) {
      const exfilState = this.exfilController.getState();
      const serverHoldTick = (this as any).serverHoldCompletedAtTick || 0;
      const isEligibleGrace = (exfilState.kind === "corridor_presentation" ||
        exfilState.kind === "submitting_settlement" ||
        (exfilState.kind === "failed" && serverHoldTick > 0 && serverHoldTick <= SIM_CONFIG.RAID_DEADLINE_TICK)) &&
        this.tick <= 57600;
      if (!isEligibleGrace) {
        this.isRaidExpired = true;
        this.player.isAlive = false;
        this.player.health = 0;
        this.combatLog.push(`[RAID EXPIRED] Tick ${this.tick}: Sector 7 locked down. Operative M.I.A.`);
        this.onPlayerDeath?.();
        return;
      }
    }

    this.tick += 1;

    if (this.zoneMode === 'airlock_corridor') {
      if (Date.now() >= this.airlockTimerMs) {
        this.zoneMode = 'spoke';
        this.player.z = -46;
        this.player.isInvulnerable = true;
        (this.player as any).ingressShieldTicks = 180; // 3.0s invulnerability grace
        this.ingressController.activate(this.tick);
        this.combatLog.push('[INGRESS] Operative deployed into Sector 7. 3.0s tactical shield active.');
      }
      return;
    }

    if (this.zoneMode === 'hub') {
      const distToAirlock = Math.hypot(this.player.x, this.player.z - (-52));
      if (distToAirlock < 3.2 || (input.interact && distToAirlock < 6.0)) {
        this.enterSpatialAirlock();
        return;
      }
    }

    // Freeze related action timers, cooldowns, and local physics together during disconnect
    if (!this.isSocketDisconnected) {
      // Stim treatment interruption on abrupt movement or active movement states (sprint, slide, roll, jump, or running motion)
      if (this.player.isUsingStim) {
        const isMovingFast = Math.hypot(input.dx, input.dz) > 0.15;
        const isStateAbrupt = this.player.action === 'roll' ||
                              this.player.action === 'slide' ||
                              this.player.action === 'jump' ||
                              this.player.isJumping ||
                              this.player.y > 0 ||
                              (this.slideTicksRemaining ?? 0) > 0;
        if (isStateAbrupt || input.sprint || input.slide || input.roll || input.jump || (isMovingFast && (input.sprint || input.slide))) {
          this.interruptStimTreatment('movement');
        }
      }
      // Handle ingress grace shield countdown
      if ((this.player as any).ingressShieldTicks && (this.player as any).ingressShieldTicks > 0) {
        (this.player as any).ingressShieldTicks -= 1;
        this.player.isInvulnerable = true;
        if ((this.player as any).ingressShieldTicks <= 0) {
          this.player.isInvulnerable = false;
          this.combatLog.push('[TACTICAL] Ingress shield expired. Weapons hot.');
        }
      }

      // Handle ongoing action countdowns and cooldowns
      if (this.shootCooldownTicks > 0) this.shootCooldownTicks -= 1;
      this.player.shootCooldownTicks = this.shootCooldownTicks;
      if (this.rollCooldownTicks > 0) this.rollCooldownTicks -= 1;
      if (this.kickCooldownTicks > 0) this.kickCooldownTicks -= 1;

      // Check combat roll initiation (Space) BEFORE machine and rival attacks run
      // so 12 iframes apply immediately on frame 1
      if (!this.isInputLocked() && input.roll && this.rollCooldownTicks <= 0 && this.player.action !== 'roll' && this.player.action !== 'slide' && this.slideTicksRemaining <= 0) {
        this.player.action = 'roll';
        this.kickStrikePending = false;
      if (this.zoneMode === 'hub') this.trainingProgress.agilityUsed = true;
        this.player.actionTicks = SIM_CONFIG.ROLL_TICKS;
        this.rollCooldownTicks = 30;
        this.player.isInvulnerable = true;
        this.slideTicksRemaining = 0;
        this.slideVx = 0;
        this.slideVz = 0;
      }

      // Decrement actionTicks and strictly enforce 12 iframes at start of tick so machines and rivals see exact state
      if (this.player.actionTicks > 0) {
        this.player.actionTicks -= 1;
        if (this.player.action === 'roll') {
          const elapsed = SIM_CONFIG.ROLL_TICKS - this.player.actionTicks;
          this.player.isInvulnerable = elapsed <= SIM_CONFIG.ROLL_IFRAMES;
        }
        if (this.player.action === 'kick' && this.kickStrikePending && this.player.actionTicks <= 26) {
          this.kickStrikePending = false;
          this.performMeleeKick();
        }
        if (this.player.actionTicks === 0) {
          this.player.action = (this.player.isJumping || this.player.y > 0) ? 'jump' : 'idle';
          this.player.isInvulnerable = false;
          this.kickStrikePending = false;
          if (this.player.weapon === 'grenade' && (this.player.fragGrenades ?? 0) <= 0) {
            this.setWeapon('rifle');
          }
        }
      } else {
        this.kickStrikePending = false;
        if (this.player.action === 'roll' || this.player.action === 'slide' || this.player.action === 'kick' || this.player.action === 'throw' || this.player.action === 'shoot' || this.player.action === 'reload') {
          this.player.action = (this.player.isJumping || this.player.y > 0) ? 'jump' : 'idle';
          if (this.player.weapon === 'grenade' && (this.player.fragGrenades ?? 0) <= 0) {
            this.setWeapon('rifle');
          }
        }
        this.player.isInvulnerable = false;
      }
    }

    // 1. Check Zero-Liquidity Fallback at Tick 7,200 (2:00)
    const activeRivalsAtTick = this.rivals.filter(r => r.isAlive && !r.isExtracted);
    if (this.tick >= SIM_CONFIG.AI_FALLBACK_TICK && activeRivalsAtTick.length === 0 && !this.aiSpawned) {
      this.spawnRogueSquad();
      this.aiSpawned = true;
    }

    // 2. Automated Machines step
    const machineDamage = this.stepMachines();

    // Fatal damage check: stop tick immediately if eliminated
    if (!this.player.isAlive || this.player.health <= 0) {
      if (this.exfilController.getState().kind === "corridor_presentation") {
        this.exfilController.cancel();
      }
      return;
    }

    // 3. Squadmate companion AI step
    this.stepSquadmate();

    // 4. Rival operatives step
    this.stepRivals();
    this.stepGrenades();
    this.stepProjectiles(dt);
    if (!this.player.isAlive || this.player.health <= 0) {
      return;
    }

    if (this.player.isUsingStim) {
      const isMovingFast = Math.hypot(input.dx, input.dz) > 0.15;
      const isStateAbrupt = this.player.action === 'roll' ||
                            this.player.action === 'slide' ||
                            this.player.action === 'jump' ||
                            this.player.isJumping ||
                            this.player.y > 0 ||
                            (this.slideTicksRemaining ?? 0) > 0;
      if (isStateAbrupt || input.sprint || input.slide || input.roll || input.jump || (isMovingFast && (input.sprint || input.slide))) {
        this.interruptStimTreatment('movement');
      }
    }

    // Stim channel administration
    if (this.player.isUsingStim && this.player.stimChannelTicks !== undefined && this.player.stimChannelTicks > 0) {
      this.player.stimChannelTicks--;
      if (this.player.stimChannelTicks === 0) {
        this.player.isUsingStim = false;
        this.player.stimsRemaining = Math.max(0, (this.player.stimsRemaining ?? 0) - 1);
        this.player.isBleeding = false;
        const healed = Math.min(100 - this.player.health, 45);
        this.player.health = Math.min(100, this.player.health + 45);
        this.enqueuePresentationEvent({
          type: 'stim',
          operativeId: this.player.id,
          position: { x: this.player.x, y: 0.95, z: this.player.z },
          healAmount: healed,
        });
        this.combatLog.push(`[MEDS] Propital stim administered. Arterial bleed coagulated, +${healed} HP restored (${this.player.stimsRemaining} stims remaining).`);
      }
    }

    // Fatal Bleeding tick damage (2 HP every 60 ticks = 1.0s at 60 Hz)
    if (this.player.isBleeding && this.tick % 60 === 0 && this.player.isAlive && !this.player.isExtracted) {
      this.player.health = Math.max(0, this.player.health - 2);
      this.combatLog.push(`[BLEEDING] -2 HP from arterial wound. HP: ${this.player.health}/100. Inject STIM [H] to coagulate.`);
      if (this.player.health <= 0) {
        this.player.isAlive = false;
        this.player.action = 'idle';
        this.player.actionTicks = 120;
        this.combatLog.push(`[KIA] Operative succumbed to fatal arterial hemorrhage.`);
        this.onPlayerDeath?.();
        return;
      }
    }

    // 5. Extraction Zone Detection & Dwell State Machine
    const distToExfil = Math.hypot(this.player.x - SIM_CONFIG.EXFIL_ZONE.x, this.player.z - SIM_CONFIG.EXFIL_ZONE.z);
    const distToBunker = Math.hypot(this.player.x - (-45), this.player.z - (-45));
    const ingressKind = this.ingressController.getState().kind;
    const isIngressPending = ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad' || ingressKind === 'rejected';
    const inMainExfil = distToExfil <= SIM_CONFIG.EXFIL_ZONE.radius;
    const inBunkerExfil = distToBunker <= 6.0 && !!this.player.hasKeycard;
    const inExfilZone = !isIngressPending && (inMainExfil || inBunkerExfil);
    const activeZoneId = inBunkerExfil ? 'bunker_exfil_sealed' : 'lz_sector7_charlie';

    this.exfilController.onTick(this.tick, inExfilZone, activeZoneId, machineDamage);

    const exfilState = this.exfilController.getState();
    const isCompletedOrSubmitting =
      exfilState.kind === "corridor_presentation" ||
      exfilState.kind === "submitting_settlement" ||
      exfilState.kind === "extracted" ||
      (exfilState.kind === "failed" && (exfilState as any).canRetry);

    const holdTicks =
      "currentTicks" in exfilState
        ? (exfilState as any).currentTicks
        : ("holdTicks" in exfilState
          ? (exfilState as any).holdTicks
          : (isCompletedOrSubmitting ? 180 : 0));

    if (inExfilZone || holdTicks > 0 || isCompletedOrSubmitting) {


      const reporter = (globalThis as any).__stickZoneHoldReporter;
      if (typeof reporter === "function") {
        reporter(this.raidId, this.player.id, holdTicks, this.tick, {
          inZone: inExfilZone,
          damageTaken: machineDamage,
          simTickAdvancement: true,
        });
      }
      if (this.settlementAuthority && typeof this.settlementAuthority.recordExtractionHold === "function") {
        this.settlementAuthority.recordExtractionHold(this.raidId, this.player.id, holdTicks, this.tick, {
          inZone: inExfilZone,
          damageTaken: machineDamage,
          simTickAdvancement: true,
        });
      }
      this.onHoldProgress?.(holdTicks, this.tick);
    } else {

      const reporter = (globalThis as any).__stickZoneHoldReporter;
      if (typeof reporter === "function") {
        reporter(this.raidId, this.player.id, 0, this.tick, {
          inZone: false,
          damageTaken: 0,
          simTickAdvancement: true,
        });
      }
      if (this.settlementAuthority && typeof this.settlementAuthority.recordExtractionHold === "function") {
        this.settlementAuthority.recordExtractionHold(this.raidId, this.player.id, 0, this.tick, {
          inZone: false,
          damageTaken: 0,
          simTickAdvancement: true,
        });
      }
      this.onHoldProgress?.(0, this.tick);
    }

    // 6. Proximity Radar (<= 60m alert, > 60m all clear)
    this.updateProximityAlert();

    // dt hoisted to step() scope

    if (!this.isSocketDisconnected) {
      // Lingering physical knockback velocity on player
      if ((this.player as any).knockbackVx || (this.player as any).knockbackVz) {
        const kx = ((this.player as any).knockbackVx || 0) * dt;
        const kz = ((this.player as any).knockbackVz || 0) * dt;
        const targetX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.player.x + kx));
        const targetZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.player.z + kz));
        if (!this.checkContainerCollision(targetX, this.player.z, 0.45)) this.player.x = targetX;
        if (!this.checkContainerCollision(this.player.x, targetZ, 0.45)) this.player.z = targetZ;
        (this.player as any).knockbackVx = ((this.player as any).knockbackVx || 0) * 0.85;
        (this.player as any).knockbackVz = ((this.player as any).knockbackVz || 0) * 0.85;
        if (Math.hypot((this.player as any).knockbackVx, (this.player as any).knockbackVz) < 0.05) {
          (this.player as any).knockbackVx = 0;
          (this.player as any).knockbackVz = 0;
        }
      }

      // Continuous jump gravity resolution executes every tick, even when input is locked
      if (this.jumpVy > 0 || this.player.y > 0) {
        this.player.y = Math.max(0, this.player.y + this.jumpVy * dt);
        this.jumpVy -= 12.0 * dt; // Gravity
        if (this.player.y <= 0) {
          this.player.y = 0;
          this.jumpVy = 0;
          this.player.isJumping = false;
          if (this.player.action === 'jump') this.player.action = 'idle';
        }
      }
    }

    // 7. Player Action & Locomotion Step
    if (this.isInputLocked()) {
      return; // Inputs frozen during corridor presentation, extraction, or unconfirmed ingress
    }

// Cooldowns decremented at start of tick

    // Always update facing from aim angle immediately, even when stationary
    if (input.aimAngle !== undefined) {
      this.player.facing = input.aimAngle;
    }

    // Action countdown and roll iframe state already updated at start of tick

// Combat roll initiation handled at start of tick for immediate iframe coverage

    // Track C key release state: must release C before initiating another slide
    if (!input.slide) {
      this.slideKeyReleased = true;
    }

    // Slide initiation (C / slide while sprinting) with stored momentum & release requirement
    if (
      input.slide &&
      this.slideKeyReleased &&
      input.sprint &&
      this.slideTicksRemaining <= 0 &&
      this.player.action !== 'slide' &&
      this.player.action !== 'roll' &&
      !this.player.isJumping &&
      this.player.y <= 0
    ) {
      this.slideKeyReleased = false;
      this.player.action = 'slide';
      if (this.zoneMode === 'hub') this.trainingProgress.agilityUsed = true;
      this.player.actionTicks = SIM_CONFIG.SLIDE_TICKS;
      this.slideTicksRemaining = SIM_CONFIG.SLIDE_TICKS;
      this.walkVx = 0;
      this.walkVz = 0;
      const moveMag = Math.hypot(input.dx, input.dz);
      const dirX = moveMag > 0.01 ? (input.dx / moveMag) : Math.sin(this.player.facing);
      const dirZ = moveMag > 0.01 ? (input.dz / moveMag) : Math.cos(this.player.facing);
      this.slideVx = dirX * (SIM_CONFIG.SPEED_SPRINT * 1.35);
      this.slideVz = dirZ * (SIM_CONFIG.SPEED_SPRINT * 1.35);
      this.enqueuePresentationEvent({
        type: 'locomotion',
        operativeId: this.player.id,
        subtype: 'slide',
        position: { x: this.player.x, y: this.player.y, z: this.player.z },
      });
    }

    // Melee jump kick initiation (F) with 42-tick recovery cooldown
    if (input.kick && this.kickCooldownTicks <= 0 && this.player.action !== 'roll') {
      this.player.action = 'kick';
      this.player.actionTicks = SIM_CONFIG.KICK_TICKS;
      this.kickCooldownTicks = SIM_CONFIG.KICK_TICKS;
      this.kickStrikePending = true;
      const forwardX = Math.sin(this.player.facing);
      const forwardZ = Math.cos(this.player.facing);
      this.walkVx = forwardX * 2.2;
      this.walkVz = forwardZ * 2.2;
      if (this.player.y <= 0) {
        this.jumpVy = 2.4;
        this.player.isJumping = true;
      }
    }

    // Weapon switch (1/2 or Q)
    if (input.selectWeapon) {
      if (this.player.weapon !== input.selectWeapon) {
        this.setWeapon(input.selectWeapon);
      }
    } else if (input.switchWeapon) {
      this.switchWeapon();
    }
    // Tactical Stim (H)
    if (input.stim) {
      this.useStim();
    }
    // Reload (R)
    if (input.reload) {
      this.reload();
    }

    // Edge-triggered pump action for shotgun / fire input tracking
    if (!input.shoot) {
      this.shootTriggerReleased = true;
      this.player.continuousFireTicks = Math.max(0, (this.player.continuousFireTicks || 0) - 2);
    } else {
      this.player.continuousFireTicks = (this.player.continuousFireTicks || 0) + 1;
    }

    // Gunplay shooting with proper weapon fire cadence
    const canFireShotgun = this.player.weapon !== 'shotgun' || this.shootTriggerReleased;
    if (input.shoot && canFireShotgun && this.player.action !== 'roll' && this.shootCooldownTicks <= 0) {
      if (this.player.weapon === 'shotgun') {
        this.shootTriggerReleased = false;
      }
      this.fire();
    }

    // Jump mechanics: impulse initiation
    if (input.jump && this.player.y <= 0 && this.player.action !== 'roll' && this.player.action !== 'slide' && this.slideTicksRemaining <= 0) {
      this.jumpVy = 4.2;
      this.player.action = 'jump';
      this.player.isJumping = true;
    }

    // Movement calculation: handles slide momentum even when input stops or when player fires while sliding
    this.player.isSliding = this.slideTicksRemaining > 0;
    this.player.slideTicksRemaining = this.slideTicksRemaining;
    if (this.slideTicksRemaining > 0) {
      this.slideTicksRemaining--;
      this.player.isSliding = this.slideTicksRemaining > 0;
      this.player.slideTicksRemaining = this.slideTicksRemaining;
      if (Math.abs(this.slideVx) > 0.01 || Math.abs(this.slideVz) > 0.01) {
        const nextX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.player.x + this.slideVx * dt));
        const nextZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.player.z + this.slideVz * dt));

        if (!this.checkContainerCollision(nextX, this.player.z, 0.45)) {
          this.player.x = nextX;
        } else {
          this.slideVx = 0;
        }
        if (!this.checkContainerCollision(this.player.x, nextZ, 0.45)) {
          this.player.z = nextZ;
        } else {
          this.slideVz = 0;
        }

        // Smooth friction deceleration
        this.slideVx *= 0.96;
        this.slideVz *= 0.96;
      }
      if (this.slideTicksRemaining === 0) {
        this.slideVx = 0;
        this.slideVz = 0;
        this.walkVx = 0;
        this.walkVz = 0;
        if (this.player.action === 'slide') {
          this.player.action = 'idle';
        }
      }
    } else {
      let speed = input.sprint ? SIM_CONFIG.SPEED_SPRINT : SIM_CONFIG.SPEED_WALK;
      if (input.crouch) {
        speed *= 0.55;
        this.player.isCrouching = true;
      } else {
        this.player.isCrouching = false;
      }
      if (this.player.action === 'roll') speed *= 1.1;
      if (this.player.action === 'shoot') speed *= 0.84;

      const moveMagnitude = Math.hypot(input.dx, input.dz);
      if (moveMagnitude > 0.01) {
        const normX = input.dx / moveMagnitude;
        const normZ = input.dz / moveMagnitude;
        const inputScale = Math.min(1.0, moveMagnitude);
        const effectiveSpeed = speed * inputScale;
        this.walkVx = normX * effectiveSpeed;
        this.walkVz = normZ * effectiveSpeed;

        const nextX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.player.x + normX * effectiveSpeed * dt));
        const nextZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.player.z + normZ * effectiveSpeed * dt));

        if (!this.checkContainerCollision(nextX, this.player.z, 0.45)) {
          this.player.x = nextX;
        }
        if (!this.checkContainerCollision(this.player.x, nextZ, 0.45)) {
          this.player.z = nextZ;
        }

        if (input.aimAngle !== undefined) {
          this.player.facing = input.aimAngle;
        } else {
          this.player.facing = Math.atan2(normX, normZ);
        }

        if (this.player.actionTicks === 0 && !this.player.isJumping && this.player.y <= 0 && this.player.action !== 'jump') {
          this.player.action = input.sprint ? 'sprint' : (input.crouch ? 'crouch' : 'walk');
        }
      } else {
        // Natural movement inertia: smooth deceleration rather than instant zero
        if (Math.abs(this.walkVx) > 0.05 || Math.abs(this.walkVz) > 0.05) {
          const nextX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.player.x + this.walkVx * dt));
          const nextZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.player.z + this.walkVz * dt));
          if (!this.checkContainerCollision(nextX, this.player.z, 0.45)) {
            this.player.x = nextX;
          } else {
            this.walkVx = 0;
          }
          if (!this.checkContainerCollision(this.player.x, nextZ, 0.45)) {
            this.player.z = nextZ;
          } else {
            this.walkVz = 0;
          }
          this.walkVx *= 0.65;
          this.walkVz *= 0.65;
        } else {
          this.walkVx = 0;
          this.walkVz = 0;
        }

        if (this.player.actionTicks === 0 && this.player.action !== 'jump') {
          this.player.action = input.crouch ? 'crouch' : 'idle';
        }
      }
    }

    // Loot crate pickup: unified through requestLootCrate
    if (input.interact) {
      for (const crate of this.crates) {
        if (!crate.opened && Math.hypot(this.player.x - crate.x, this.player.z - crate.z) <= 3.0) {
          this.requestLootCrate(crate.id);
          break;
        }
      }
    }
  }

  private performMeleeKick(): void {
    // Roundhouse kick physical reach: 2.8m (martial arts leg reach + forward lunge)
    const kickRange = 2.8;
    const forwardX = Math.sin(this.player.facing);
    const forwardZ = Math.cos(this.player.facing);
    this.walkVx = forwardX * 0.8;
    this.walkVz = forwardZ * 0.8;

    const machineHits: KickActionPayload['machineHits'] = [];
    const rivalHits: KickActionPayload['rivalHits'] = [];

    // Right-leg roundhouse sweep arc check:
    // Right leg sweeps from right flank (+1.35 rad ~77°) across front centerline (0 rad)
    // through to left flank (-0.85 rad ~-48°). Total arc ~125°.
    const inSweepArc = (targetX: number, targetZ: number): boolean => {
      const dx = targetX - this.player.x;
      const dz = targetZ - this.player.z;
      let diff = Math.atan2(dx, dz) - this.player.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff >= -0.85 && diff <= 1.35;
    };

    // FOB Training Dummies Kick Interaction
    let dummyKicked = false;
    if (this.zoneMode === "hub") {
      const dummies = [
        { side: "left" as const, x: -5.0, z: -64.0 },
        { side: "right" as const, x: 5.0, z: -64.0 },
      ];
      for (const d of dummies) {
        const ddx = d.x - this.player.x;
        const ddz = d.z - this.player.z;
        const ddist = Math.hypot(ddx, ddz);
        if (ddist <= kickRange && ddist > 0.1) {
          if (inSweepArc(d.x, d.z)) {
            dummyKicked = true;
            this.player.lastHitmarkerTick = this.tick;
            this.dummyHitCount++;
            this.lastDummyHitTick = this.tick;
            this.lastDummyHitSide = d.side;
            this.trainingProgress.dummyHit = true;
            this.enqueuePresentationEvent({
              type: "impact",
              position: { x: d.x, y: 1.6, z: d.z },
              surface: "metal",
              damage: 35,
              label: "35",
            });
            this.combatLog.push(`[TARGET RANGE] Melee kick impacted ${d.side.toUpperCase()} target dummy!`);
          }
        }
      }
    }

    // 1. Kick machines (turrets, drones)
    for (const machine of this.machines) {
      if (!machine.isAlive) continue;
      const mdx = machine.x - this.player.x;
      const mdz = machine.z - this.player.z;
      const mdist = Math.hypot(mdx, mdz);
      if (mdist <= kickRange && mdist > 0.1) {
        if (!inSweepArc(machine.x, machine.z)) continue; // Must be in roundhouse sweep arc
        if (this.checkContainerRayObstruction(this.player.x, this.player.z, machine.x, machine.z, 1.0, 1.0)) continue;
        const isAggregateWired = !!this.onKickAction;
        const isPrediction = isAggregateWired || !!this.onMachineHit;
        if (isPrediction) {
          machine.health = Math.max(1, machine.health - 50);
        } else {
          machine.health = Math.max(0, machine.health - 50);
          if (machine.health <= 0) {
            machine.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Machine destroyed by kinetic kick: ${machine.id}`);
          }
        }
        machineHits.push({
          id: machine.id,
          x: machine.x,
          z: machine.z,
          y: machine.y,
          damage: 50,
          originX: (machine as any).originX,
          originZ: (machine as any).originZ,
        });
      }
    }

    // 2. Kick rivals: 35 damage and 4.5m physical knockback in facing direction
    for (const rival of this.rivals) {
      if (!rival.isAlive || rival.isInvulnerable || rival.isExtracted) continue;
      const dx = rival.x - this.player.x;
      const dz = rival.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= kickRange && dist > 0.1) {
        if (!inSweepArc(rival.x, rival.z)) continue; // Must be in roundhouse sweep arc
        // Physical cover check: cannot kick through containers
        if (this.checkContainerRayObstruction(this.player.x, this.player.z, rival.x, rival.z, 1.0, 1.0)) {
          this.combatLog.push(`[TICK ${this.tick}] Melee kick deflected by container cover`);
          continue;
        }

        const { newHealth, newArmor } = applyStandardDamage(rival.health, rival.armor, 35);
        rival.health = newHealth;
        rival.armor = newArmor;
        this.handleRivalDamage(rival, 35);
        const isBossTarget = rival.id === BOSS_CONFIG.id || rival.badge === BOSS_CONFIG.badge;
        const isAITarget = Boolean((AI_CONFIGS as any)[rival.id]) || isBossTarget;
        const knockX = isAITarget ? 0 : Math.sin(this.player.facing) * 4.5;
        const knockZ = isAITarget ? 0 : Math.cos(this.player.facing) * 4.5;

        // Step along knockback displacement and clamp against container collision (AI targets are immune to knockback displacement)
        if (!isAITarget) {
          const steps = 10;
          for (let s = 1; s <= steps; s++) {
            const stepX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, rival.x + (knockX / steps)));
            const stepZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, rival.z + (knockZ / steps)));
            if (!this.checkContainerCollision(stepX, rival.z, 0.45)) {
              rival.x = stepX;
            }
            if (!this.checkContainerCollision(rival.x, stepZ, 0.45)) {
              rival.z = stepZ;
            }
          }
        }

        (rival as any).knockbackVx = 0;
        (rival as any).knockbackVz = 0;
        this.combatLog.push(`[TICK ${this.tick}] Flying Jump Kick connected on ${rival.name} (-35 HP${isAITarget ? "" : ", 4.5m knockback"})`);
        rivalHits.push({
          id: rival.id,
          x: rival.x,
          z: rival.z,
          damage: 35,
          knockX,
          knockZ,
          predictedHealth: rival.health,
          predictedArmor: rival.armor,
        });
        if (rival.health <= 0) {
          if (!this.onHitTarget) {
            rival.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Rival operator eliminated by melee kick: ${rival.name}`);
            if (isBossTarget) {
              this.grantKeycard(BOSS_CONFIG.id);
              this.combatLog.push(`[BOSS SLAIN] Sector Warlord eliminated by martial arts jump kick! Dropped Violet Lab Access Keycard!`);
            }
          } else {
            // For multiplayer / networked rivals, local hit is a prediction; keep at 1 HP until server confirms death
            rival.health = 1;
          }
        }
      }
    }

    // ONE kick action = ONE authoritative validation batch = ONE cooldown charge.
    // The network layer validates the full target set atomically instead of per-target
    // packets re-charging the melee cooldown (which rejected every target after the first).
    if (machineHits.length + rivalHits.length > 0) {
      if (this.onKickAction) {
        this.onKickAction({
          actionTick: this.tick,
          attackerId: this.player.id,
          attackerX: this.player.x,
          attackerZ: this.player.z,
          attackerFacing: this.player.facing,
          machineHits,
          rivalHits,
        });
      } else {
        for (const h of machineHits) this.onMachineHit?.(h.id, h.damage, 'kick');
        for (const h of rivalHits) this.onHitTarget?.(h.id, h.damage, h.knockX, h.knockZ);
      }
    }
    this.enqueuePresentationEvent({
      type: 'kick',
      operativeId: this.player.id,
      position: { x: this.player.x, y: 0.95, z: this.player.z },
      facing: this.player.facing,
      isHit: machineHits.length + rivalHits.length > 0 || dummyKicked,
      hitTarget: machineHits.length > 0 ? 'machine' : rivalHits.length > 0 ? 'rival' : undefined,
    });
  }

  public fire(): boolean {
    if (this.isInputLocked()) return false;
    if (
      this.player.action === "roll" ||
      this.player.action === "kick" ||
      this.player.action === "throw" ||
      this.player.action === "reload"
    ) return false;

    if (this.player.weapon === "fists") {
      if (this.kickCooldownTicks > 0) return false;
      this.player.action = "kick";
      this.player.actionTicks = SIM_CONFIG.KICK_TICKS;
      this.kickCooldownTicks = SIM_CONFIG.KICK_TICKS;
      this.kickStrikePending = true;
      const forwardX = Math.sin(this.player.facing);
      const forwardZ = Math.cos(this.player.facing);
      this.walkVx = forwardX * 2.2;
      this.walkVz = forwardZ * 2.2;
      if (this.player.y <= 0) {
        this.jumpVy = 2.4;
        this.player.isJumping = true;
      }
      return true;
    }

    if (this.player.weapon === "grenade") {
      if ((this.player.fragGrenades ?? 0) <= 0) return false;
      if (this.shootCooldownTicks > 0) return false;
      this.player.fragGrenades = (this.player.fragGrenades ?? 2) - 1;
      this.player.ammo = this.player.fragGrenades;
      this.shootCooldownTicks = 38;
      this.player.shootCooldownTicks = 38;
      this.player.action = "throw";
      this.player.actionTicks = 36;
      this.throwFragGrenade();
      return true;
    }

    // Firing when out of bullets automatically initiates tactical reload from reserve
    if (this.player.ammo <= 0) {
      if (this.player.weapon === "shotgun" || this.player.weapon === "rifle") {
        const reloaded = this.reload();
        if (!reloaded) {
          this.shootCooldownTicks = 18;
          this.player.shootCooldownTicks = 18;
          this.combatLog.push(`[AMMO EMPTY] Out of ammunition! Reserve depleted.`);
          this.enqueuePresentationEvent({
            type: "dry_fire",
            operativeId: this.player.id,
            position: { x: this.player.x, y: 1.0, z: this.player.z },
          });
        }
        return reloaded;
      }
      return false;
    }

    if (this.shootCooldownTicks > 0) return false;
    this.player.ammo -= 1;
    if (this.player.weapon === "shotgun") {
      this.player.shotgunAmmo = this.player.ammo;
    } else {
      this.player.rifleAmmo = this.player.ammo;
    }
    this.player.action = "shoot";
    this.player.actionTicks = this.player.weapon === "shotgun" ? 12 : 5;
    const fireCooldown = this.player.weapon === "shotgun" ? SIM_CONFIG.SHOTGUN_COOLDOWN_TICKS : SIM_CONFIG.RIFLE_COOLDOWN_TICKS;
    this.shootCooldownTicks = fireCooldown;
    this.player.shootCooldownTicks = this.shootCooldownTicks;
    const { origin: muzzleOrigin, dir: muzzleDir } = this.getOperativeMuzzle(this.player);

    // Physical shooter recoil impulse (Newton third law pushback)
    const kickForce = this.player.weapon === "shotgun" ? 1.65 : 0.42;
    this.walkVx -= muzzleDir.x * kickForce;
    this.walkVz -= muzzleDir.z * kickForce;

    this.fireWeapon(muzzleOrigin, muzzleDir);
    this.enqueuePresentationEvent({
      type: "fire",
      shooterId: this.player.id,
      origin: muzzleOrigin,
      dir: muzzleDir,
      weapon: (this.player.weapon as any) || "rifle",
    });
    return true;
  }

  private fireWeapon(muzzleOrigin?: { x: number; y: number; z: number }, muzzleDir?: { x: number; y: number; z: number }): void {
    if (!muzzleOrigin || !muzzleDir) {
      const m = this.getOperativeMuzzle(this.player);
      muzzleOrigin = m.origin;
      muzzleDir = m.dir;
    }
    const originX = muzzleOrigin.x;
    const originY = muzzleOrigin.y;
    const originZ = muzzleOrigin.z;
    const bulletDirX = muzzleDir.x;
    const bulletDirZ = muzzleDir.z;
    const now = Date.now();
    this.player.lastFiredAtMs = now;
    this.player.lastFireTimestamp = now;
    this.player.lastFireTick = this.tick;
    // Acoustic sound propagation across 45m radius
    this.propagateGunfireSound(this.player.x, this.player.z, 45.0);

    if (this.player.weapon === "shotgun") {
      const PELLETS_OFFSETS = [-0.174, -0.105, -0.035, 0.035, 0.105, 0.174];
      const speed = 44.0;
      const damage = SIM_CONFIG.SHOTGUN_DAMAGE;

      // Check if point-blank target exists before spawning projectiles
      // This prevents single pellets from pushing the target away before subsequent pellets connect
      let pointBlankRival: any = null;
      for (const r of this.rivals) {
        if (!r.isAlive || r.isExtracted) continue;
        const dx = r.x - originX;
        const dz = r.z - originZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001 && dist <= 3.5) {
          const dot = (dx * bulletDirX + dz * bulletDirZ) / dist;
          if (dot > 0.75) {
            pointBlankRival = r;
            break;
          }
        }
      }

      if (pointBlankRival) {
        const r = pointBlankRival;
        const totalDamage = damage * 6; // All 6 pellets connect at point-blank
        this.player.lastHitmarkerTick = this.tick;
        this.player.lastHitmarkerCrit = true;

        if (r.isInvulnerable && r.action === "roll") {
          this.enqueuePresentationEvent({
            type: "impact",
            position: { x: r.x, y: 1.2, z: r.z },
            surface: "metal",
          });
          return;
        }

        this.enqueuePresentationEvent({
          type: "impact",
          position: { x: r.x, y: 1.5, z: r.z },
          surface: "flesh",
          damage: totalDamage,
          label: "-" + totalDamage,
          isCrit: true,
        });
        const { newHealth, newArmor } = applyStandardDamage(r.health, r.armor, totalDamage);
        r.health = newHealth;
        r.armor = newArmor;
        this.handleRivalDamage(r, totalDamage);

        // Combined heavy shotgun knockback
        const knockForce = 3.2;
        r.x = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, r.x + bulletDirX * knockForce));
        r.z = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, r.z + bulletDirZ * knockForce));
        this.onHitTarget?.(r.id, totalDamage, bulletDirX * knockForce, bulletDirZ * knockForce, "shotgun");

        if (r.health <= 0) {
          const isBossTarget = r.id === BOSS_CONFIG.id || r.badge === BOSS_CONFIG.badge;
          if (!this.onHitTarget) {
            r.isAlive = false;
            this.combatLog.push("[TICK " + this.tick + "] Rival eliminated by shotgun: " + r.name);
            if (isBossTarget) {
              this.grantKeycard(BOSS_CONFIG.id);
              this.combatLog.push("[BOSS SLAIN] Sector Warlord eliminated! Dropped Violet Lab Access Keycard!");
            }
          } else {
            r.health = 1;
          }
        }
        return;
      }

      // Spawn 6 distinct buckshot pellets across 20° fan into active ballistics
      for (let i = 0; i < PELLETS_OFFSETS.length; i++) {
        const pAngle = PELLETS_OFFSETS[i];
        const cosA = Math.cos(pAngle);
        const sinA = Math.sin(pAngle);
        const dirX = bulletDirX * cosA - bulletDirZ * sinA;
        const dirZ = bulletDirX * sinA + bulletDirZ * cosA;

        this.spawnProjectile({
          id: "pellet_" + this.player.id + "_" + this.tick + "_" + i + "_" + Math.random().toString(36).slice(2, 6),
          shooterId: this.player.id,
          shooterIsPlayer: true,
          x: originX,
          y: originY,
          z: originZ,
          vx: dirX * speed,
          vy: 0,
          vz: dirZ * speed,
          speed,
          damage,
          radius: 0.165,
          maxRange: 14.0,
          distanceTraveled: 0,
          weapon: "shotgun",
          isPellet: true,
        });
      }
      return;
    }

    // Rifle: surviv.io assault rifle ballistics with spread bloom
    this.player.continuousFireTicks = (this.player.continuousFireTicks || 0) + 1;
    const bloom = Math.min(0.085, 0.015 + this.player.continuousFireTicks * 0.012);
    const angleOffset = (Math.random() - 0.5) * 2 * bloom;
    const cosA = Math.cos(angleOffset);
    const sinA = Math.sin(angleOffset);
    const dirX = bulletDirX * cosA - bulletDirZ * sinA;
    const dirZ = bulletDirX * sinA + bulletDirZ * cosA;
    const speed = 54.0;
    const damage = SIM_CONFIG.RIFLE_DAMAGE;

    this.spawnProjectile({
      id: "proj_" + this.player.id + "_" + this.tick + "_" + Math.random().toString(36).slice(2, 6),
      shooterId: this.player.id,
      shooterIsPlayer: true,
      x: originX,
      y: originY,
      z: originZ,
      vx: dirX * speed,
      vy: 0,
      vz: dirZ * speed,
      speed,
      damage,
      radius: 0.21,
      maxRange: 22.0,
      distanceTraveled: 0,
      weapon: "rifle",
    });
  }

  public spawnProjectile(proj: ActiveProjectile): void {
    if (this.checkImmediatePointBlankHit(proj)) {
      return;
    }
    this.activeProjectiles.push(proj);
  }

  private checkImmediatePointBlankHit(proj: ActiveProjectile): boolean {
    const normVx = proj.vx / proj.speed;
    const normVz = proj.vz / proj.speed;

    if (proj.shooterIsPlayer) {
      // Hub target dummies
      if (this.zoneMode === "hub") {
        const dummies = [
          { side: "left" as const, x: -5.0, z: -64.0 },
          { side: "right" as const, x: 5.0, z: -64.0 },
        ];
        for (const d of dummies) {
          const dx = d.x - proj.x;
          const dz = d.z - proj.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.001 && dist <= 2.2) {
            const dot = (dx * normVx + dz * normVz) / dist;
            if (dot > 0.8) {
              this.dummyHitCount++;
              this.lastDummyHitTick = this.tick;
              this.lastDummyHitSide = d.side;
              this.trainingProgress.dummyHit = true;
              this.player.lastHitmarkerTick = this.tick;
              this.enqueuePresentationEvent({
                type: "impact",
                position: { x: d.x, y: 1.6, z: d.z },
                surface: "metal",
                damage: proj.damage,
                label: String(proj.damage),
              });
              this.combatLog.push("[TARGET RANGE] Point-blank hit on " + d.side.toUpperCase() + " dummy!");
              return true;
            }
          }
        }
      }

      // Check rivals at point-blank
      for (const r of this.rivals) {
        if (!r.isAlive || r.isExtracted) continue;
        const dx = r.x - proj.x;
        const dz = r.z - proj.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001 && dist <= 3.5) {
          const dot = (dx * normVx + dz * normVz) / dist;
          if (dot > 0.75) {
            this.player.lastHitmarkerTick = this.tick;
            this.player.lastHitmarkerCrit = dist <= 2.0;

            if (r.isInvulnerable && r.action === "roll") {
              this.enqueuePresentationEvent({
                type: "impact",
                position: { x: r.x, y: 1.2, z: r.z },
                surface: "metal",
              });
              return true;
            }

            this.enqueuePresentationEvent({
              type: "impact",
              position: { x: r.x, y: 1.5, z: r.z },
              surface: "flesh",
              damage: proj.damage,
              label: "-" + proj.damage,
              isCrit: this.player.lastHitmarkerCrit,
            });
            const { newHealth, newArmor } = applyStandardDamage(r.health, r.armor, proj.damage);
            r.health = newHealth;
            r.armor = newArmor;
            this.handleRivalDamage(r, proj.damage);

            const knockForce = proj.isPellet ? 2.4 : 0.8;
            r.x = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, r.x + normVx * knockForce));
            r.z = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, r.z + normVz * knockForce));
            this.onHitTarget?.(r.id, proj.damage, normVx * knockForce, normVz * knockForce, proj.weapon);

            if (r.health <= 0) {
              const isBossTarget = r.id === BOSS_CONFIG.id || r.badge === BOSS_CONFIG.badge;
              if (!this.onHitTarget) {
                r.isAlive = false;
                this.combatLog.push("[TICK " + this.tick + "] Rival eliminated: " + r.name);
                if (isBossTarget) {
                  this.grantKeycard(BOSS_CONFIG.id);
                  this.combatLog.push("[BOSS SLAIN] Sector Warlord eliminated! Dropped Violet Lab Access Keycard!");
                }
              } else {
                r.health = 1;
              }
            }
            return true;
          }
        }
      }

      // Check machines at point-blank
      for (const m of this.machines) {
        if (!m.isAlive) continue;
        const dx = m.x - proj.x;
        const dz = m.z - proj.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001 && dist <= 3.5) {
          const dot = (dx * normVx + dz * normVz) / dist;
          if (dot > 0.75) {
            this.player.lastHitmarkerTick = this.tick;
            const mY = typeof m.y === "number" ? m.y : (m.type === "drone" ? 3.5 : 1.0);
            this.enqueuePresentationEvent({
              type: "impact",
              position: { x: m.x, y: mY, z: m.z },
              surface: "metal",
              damage: proj.damage,
              label: "-" + proj.damage,
            });
            if (this.onMachineHit) {
              m.health = Math.max(1, m.health - proj.damage);
              this.onMachineHit(m.id, proj.damage, proj.weapon);
            } else {
              m.health = Math.max(0, m.health - proj.damage);
              if (m.health <= 0) {
                m.isAlive = false;
                this.combatLog.push("[TICK " + this.tick + "] Enemy destroyed: " + m.id);
              }
            }
            return true;
          }
        }
      }
    }

    return false;
  }

  public stepProjectiles(dt: number): void {
    if (this.activeProjectiles.length === 0) return;

    const remaining: ActiveProjectile[] = [];

    for (let i = 0; i < this.activeProjectiles.length; i++) {
      const p = this.activeProjectiles[i];
      const stepDist = p.speed * dt;
      const nextX = p.x + p.vx * dt;
      const nextZ = p.z + p.vz * dt;
      const nextDist = p.distanceTraveled + stepDist;

      let hitEntity = false;

      // Target Dummies in FOB hub (training range target detection)
      if (p.shooterIsPlayer && this.zoneMode === "hub") {
        const dummies = [
          { side: "left" as const, x: -5.0, z: -64.0 },
          { side: "right" as const, x: 5.0, z: -64.0 },
        ];
        for (const d of dummies) {
          const seg = distanceToSegmentSquared(p.x, p.z, nextX, nextZ, d.x, d.z);
          if (seg.distSq <= 1.1 * 1.1) {
            hitEntity = true;
            this.dummyHitCount++;
            this.lastDummyHitTick = this.tick;
            this.lastDummyHitSide = d.side;
            this.trainingProgress.dummyHit = true;
            this.player.lastHitmarkerTick = this.tick;
            this.enqueuePresentationEvent({
              type: "impact",
              position: { x: d.x, y: 1.6, z: d.z },
              surface: "metal",
              damage: p.damage,
              label: String(p.damage),
            });
            this.combatLog.push("[TARGET RANGE] Ballistic hit on " + d.side.toUpperCase() + " target dummy!");
            break;
          }
        }
      }
      if (hitEntity) continue;

      // Cover and container collision check
      const isCovered = this.checkContainerRayObstruction(p.x, p.z, nextX, nextZ, p.y, p.y);
      if (isCovered) {
        this.enqueuePresentationEvent({
          type: "impact",
          position: { x: nextX, y: p.y, z: nextZ },
          surface: "metal",
        });
        continue;
      }

      if (p.shooterIsPlayer) {

        // Machines
        for (const m of this.machines) {
          if (!m.isAlive) continue;
          const mY = typeof m.y === "number" ? m.y : (m.type === "drone" ? 3.5 : 1.0);
          const seg = distanceToSegmentSquared(p.x, p.z, nextX, nextZ, m.x, m.z);
          if (seg.distSq <= (1.1 + p.radius) * (1.1 + p.radius)) {
            hitEntity = true;
            this.player.lastHitmarkerTick = this.tick;
            this.enqueuePresentationEvent({
              type: "impact",
              position: { x: m.x, y: mY, z: m.z },
              surface: "metal",
              damage: p.damage,
              label: "-" + p.damage,
            });
            if (this.onMachineHit) {
              m.health = Math.max(1, m.health - p.damage);
              this.onMachineHit(m.id, p.damage, p.weapon);
            } else {
              m.health = Math.max(0, m.health - p.damage);
              if (m.health <= 0) {
                m.isAlive = false;
                this.combatLog.push("[TICK " + this.tick + "] Enemy destroyed: " + m.id);
              }
            }
            break;
          }
        }
        if (hitEntity) continue;

        // Rivals
        for (const r of this.rivals) {
          if (!r.isAlive || r.isExtracted) continue;
          const seg = distanceToSegmentSquared(p.x, p.z, nextX, nextZ, r.x, r.z);
          if (seg.distSq <= (0.8 + p.radius) * (0.8 + p.radius)) {
            hitEntity = true;
            this.player.lastHitmarkerTick = this.tick;

            if (r.isInvulnerable && r.action === "roll") {
              this.enqueuePresentationEvent({
                type: "impact",
                position: { x: r.x, y: 1.2, z: r.z },
                surface: "metal",
              });
              this.combatLog.push("[DEFLECT] Combat roll deflected incoming bullet stream");
              break;
            }

            this.enqueuePresentationEvent({
              type: "impact",
              position: { x: r.x, y: 1.5, z: r.z },
              surface: "flesh",
              damage: p.damage,
              label: "-" + p.damage,
            });
            const { newHealth, newArmor } = applyStandardDamage(r.health, r.armor, p.damage);
            r.health = newHealth;
            r.armor = newArmor;
            this.handleRivalDamage(r, p.damage);

            const knockForce = p.isPellet ? 1.6 : 0.6;
            const normVx = p.vx / p.speed;
            const normVz = p.vz / p.speed;
            r.x = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, r.x + normVx * knockForce));
            r.z = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, r.z + normVz * knockForce));
            this.onHitTarget?.(r.id, p.damage, normVx * knockForce, normVz * knockForce, p.weapon);

            if (r.health <= 0) {
              const isBossTarget = r.id === BOSS_CONFIG.id || r.badge === BOSS_CONFIG.badge;
              if (!this.onHitTarget) {
                r.isAlive = false;
                this.combatLog.push("[TICK " + this.tick + "] Rival operator eliminated: " + r.name);
                if (isBossTarget) {
                  this.grantKeycard(BOSS_CONFIG.id);
                  this.combatLog.push("[BOSS SLAIN] Sector Warlord eliminated! Dropped Violet Lab Access Keycard!");
                }
              } else {
                r.health = 1;
              }
            }
            break;
          }
        }
        if (hitEntity) continue;
      } else {
        // Enemy / Rival projectile checking Player
        if (this.player.isAlive && !this.player.isExtracted) {
          const seg = distanceToSegmentSquared(p.x, p.z, nextX, nextZ, this.player.x, this.player.z);
          if (seg.distSq <= (0.8 + p.radius) * (0.8 + p.radius)) {
            hitEntity = true;
            if (this.player.isInvulnerable && this.player.action === "roll") {
              this.enqueuePresentationEvent({
                type: "impact",
                position: { x: this.player.x, y: 1.2, z: this.player.z },
                surface: "metal",
              });
              this.combatLog.push("[DEFLECT] Combat roll deflected incoming bullet stream");
            } else {
              this.applyDamageToPlayer(p.damage, p.x, p.z);
              const normVx = p.vx / p.speed;
              const normVz = p.vz / p.speed;
              this.walkVx += normVx * 0.35;
              this.walkVz += normVz * 0.35;
              this.enqueuePresentationEvent({
                type: "impact",
                position: { x: this.player.x, y: 1.5, z: this.player.z },
                surface: "flesh",
                damage: p.damage,
                label: "-" + p.damage,
              });
              this.combatLog.push("[TICK " + this.tick + "] Struck by incoming ballistic fire (-" + p.damage + " HP)");
            }
          }
        }

        // Machine projectile checking AI Rivals
        if (!hitEntity && (p.shooterId.startsWith("turret") || p.shooterId.startsWith("drone") || p.shooterId.startsWith("machine"))) {
          for (const r of this.rivals) {
            if (!r.isAlive || r.isExtracted || r.id === p.shooterId) continue;
            const seg = distanceToSegmentSquared(p.x, p.z, nextX, nextZ, r.x, r.z);
            if (seg.distSq <= (0.8 + p.radius) * (0.8 + p.radius)) {
              hitEntity = true;
              this.enqueuePresentationEvent({
                type: "impact",
                position: { x: r.x, y: 1.5, z: r.z },
                surface: "flesh",
                damage: p.damage,
                label: "-" + p.damage,
              });
              const { newHealth, newArmor } = applyStandardDamage(r.health, r.armor, p.damage);
              r.health = newHealth;
              r.armor = newArmor;
              if (r.health <= 0) {
                r.isAlive = false;
                this.combatLog.push(`[TICK ${this.tick}] Enemy eliminated by machine defense: ${r.name}`);
              }
              break;
            }
          }
        }

        if (hitEntity) continue;
      }

      p.x = nextX;
      p.z = nextZ;
      p.distanceTraveled = nextDist;
      if (p.distanceTraveled < p.maxRange) {
        remaining.push(p);
      }
    }

    this.activeProjectiles = remaining;
  }
  private stepSquadmate(): void {
    if (!this.squadmate.isAlive || this.squadmate.isExtracted) return;
    const dx = this.player.x - this.squadmate.x;
    const dz = this.player.z - this.squadmate.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 3.5) {
      const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;
      const companionSpeed = this.player.action === "sprint" ? SIM_CONFIG.SPEED_SPRINT : SIM_CONFIG.SPEED_WALK;
      const stepDist = companionSpeed * dt;
      const nx = dx / dist;
      const nz = dz / dist;
      const nextX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.squadmate.x + nx * stepDist));
      const nextZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.squadmate.z + nz * stepDist));
      let movedX = false;
      let movedZ = false;
      if (Math.abs(nx) > 0.001 && !this.checkContainerCollision(nextX, this.squadmate.z, 0.45)) {
        this.squadmate.x = nextX;
        movedX = true;
      }
      if (Math.abs(nz) > 0.001 && !this.checkContainerCollision(this.squadmate.x, nextZ, 0.45)) {
        this.squadmate.z = nextZ;
        movedZ = true;
      }

      const hasIntentX = Math.abs(nx) > 0.001;
      const hasIntentZ = Math.abs(nz) > 0.001;
      const blockedX = hasIntentX && !movedX;
      const blockedZ = hasIntentZ && !movedZ;

      if (blockedX || blockedZ) {
        // If primary axis is blocked, do not let small opposing direct motion cancel tangential bypass
        // Couple obstacle key with bypass direction to prevent corner oscillation
        if (Math.abs(dx) >= Math.abs(dz) && blockedX) {
          const bId = this.getBlockingContainerIndex(nextX, this.squadmate.z, 0.45);
          const key = `box_${bId}_X`;
          if ((this.squadmate as any).flankObstacle !== key) {
            (this.squadmate as any).flankObstacle = key;
            (this.squadmate as any).flankSign = dz >= 0 ? 1 : -1;
          }
          let prefSign = (this.squadmate as any).flankSign || (dz >= 0 ? 1 : -1);
          let slid = false;
          for (const sign of [prefSign, -prefSign]) {
            const slideZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.squadmate.z + sign * stepDist));
            if (!this.checkContainerCollision(this.squadmate.x, slideZ, 0.45)) {
              this.squadmate.z = slideZ;
              (this.squadmate as any).flankSign = sign;
              slid = true;
              break;
            }
          }
          if (!slid) (this.squadmate as any).flankSign = -prefSign;
        } else if (Math.abs(dz) > Math.abs(dx) && blockedZ) {
          const bId = this.getBlockingContainerIndex(this.squadmate.x, nextZ, 0.45);
          const key = `box_${bId}_Z`;
          if ((this.squadmate as any).flankObstacle !== key) {
            (this.squadmate as any).flankObstacle = key;
            (this.squadmate as any).flankSign = dx >= 0 ? 1 : -1;
          }
          let prefSign = (this.squadmate as any).flankSign || (dx >= 0 ? 1 : -1);
          let slid = false;
          for (const sign of [prefSign, -prefSign]) {
            const slideX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.squadmate.x + sign * stepDist));
            if (!this.checkContainerCollision(slideX, this.squadmate.z, 0.45)) {
              this.squadmate.x = slideX;
              (this.squadmate as any).flankSign = sign;
              slid = true;
              break;
            }
          }
          if (!slid) (this.squadmate as any).flankSign = -prefSign;
        } else if (!movedX && !movedZ) {
          const bId = this.getBlockingContainerIndex(nextX, nextZ, 0.45);
          const key = `box_${bId}_XZ`;
          if ((this.squadmate as any).flankObstacle !== key) {
            (this.squadmate as any).flankObstacle = key;
            (this.squadmate as any).flankSign = 1;
          }
          let prefSign = (this.squadmate as any).flankSign || 1;
          let slid = false;
          for (const sign of [prefSign, -prefSign]) {
            const slideZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.squadmate.z + sign * stepDist));
            if (!this.checkContainerCollision(this.squadmate.x, slideZ, 0.45)) {
              this.squadmate.z = slideZ;
              (this.squadmate as any).flankSign = sign;
              slid = true;
              break;
            }
            const slideX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.squadmate.x + sign * stepDist));
            if (!this.checkContainerCollision(slideX, this.squadmate.z, 0.45)) {
              this.squadmate.x = slideX;
              (this.squadmate as any).flankSign = sign;
              slid = true;
              break;
            }
          }
          if (!slid) (this.squadmate as any).flankSign = -prefSign;
        }
      } else {
        (this.squadmate as any).flankObstacle = null;
        (this.squadmate as any).flankSign = 0;
      }
      this.squadmate.facing = Math.atan2(dx, dz);
      this.squadmate.action = 'walk';
    } else {
      this.squadmate.action = 'idle';
    }
  }

  private stepRivals(): void {
    const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;
    for (const rival of this.rivals) {
      if (!rival.isAlive || rival.isExtracted) continue;

      // Apply decaying physical knockback velocity with 0.85 friction for all rivals (AI and human)
      if ((rival as any).knockbackVx || (rival as any).knockbackVz) {
        const kx = ((rival as any).knockbackVx || 0) * dt;
        const kz = ((rival as any).knockbackVz || 0) * dt;
        const targetX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, rival.x + kx));
        const targetZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, rival.z + kz));
        if (!this.checkContainerCollision(targetX, rival.z, 0.45)) rival.x = targetX;
        if (!this.checkContainerCollision(rival.x, targetZ, 0.45)) rival.z = targetZ;
        (rival as any).knockbackVx = ((rival as any).knockbackVx || 0) * 0.85;
        (rival as any).knockbackVz = ((rival as any).knockbackVz || 0) * 0.85;
        if (Math.hypot((rival as any).knockbackVx, (rival as any).knockbackVz) < 0.05) {
          (rival as any).knockbackVx = 0;
          (rival as any).knockbackVz = 0;
        }
      }

      // Human remote rivals must NOT be overridden by local AI movement logic or action state
      if (!rival.isAI) continue;



      if ((rival.shootCooldownTicks || 0) > 0) {
        rival.shootCooldownTicks = (rival.shootCooldownTicks || 0) - 1;
      }
      if (rival.actionTicks > 0) {
        rival.actionTicks -= 1;
        if (rival.actionTicks === 0) {
          rival.action = 'idle';
        }
      }

      const isBoss = rival.id === BOSS_CONFIG.id || rival.badge === BOSS_CONFIG.badge;
      const isAIRoster = Boolean((AI_CONFIGS as any)[rival.id]) || isBoss;
      const isAlerted = ((rival as any).playerAlertTicks || 0) > 0 || Boolean((rival as any).convergeOnPlayer);

      if (isAIRoster && !isAlerted) {
        const aiPos = computeAIPosition(rival.id, this.tick);
        const isManuallyPositioned = Math.hypot(rival.x - aiPos.x, rival.z - aiPos.z) > 5.0;
        if (!isManuallyPositioned) {
          rival.x = aiPos.x;
          rival.z = aiPos.z;
          rival.facing = aiPos.facing;
          rival.action = 'walk';
          continue;
        }
      }

      const ingressKind = this.ingressController.getState().kind;
      const isIngressPending = ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad' || ingressKind === 'rejected';
      const isPlayerInHub = this.zoneMode === 'hub' || this.zoneMode === 'airlock_corridor';

      const dx = this.player.x - rival.x;
      const dz = this.player.z - rival.z;
      const distToPlayer = Math.hypot(dx, dz);

      const isLowHealth = rival.health < 40;
      const hasLosToPlayer = !this.checkContainerRayObstruction(rival.x, rival.z, this.player.x, this.player.z, 1.0, 1.0);

      // Dynamic Concealment & Shadow/Acoustic Detection (Tarkov Macro):
      let visualDetectionRange = 28.0;
      if (this.player.isCrouching) {
        visualDetectionRange = 15.0; // Crouch low silhouette concealment in shadows
      } else if (this.player.action === 'sprint') {
        visualDetectionRange = 36.0; // Sprinting motion profile
      }

      const auditoryDetectionRange = this.player.isCrouching
        ? 4.0
        : (this.player.action === 'sprint' ? 24.0 : 10.0);

      const rivalForwardX = Math.sin(rival.facing);
      const rivalForwardZ = Math.cos(rival.facing);
      const safeD = Math.max(0.001, distToPlayer);
      const dotForward = (dx * rivalForwardX + dz * rivalForwardZ) / safeD;
      const isInFieldOfView = dotForward > -0.25;

      const isVisuallySpotted = hasLosToPlayer && isInFieldOfView && distToPlayer <= visualDetectionRange;
      const isAuditorilyDetected = distToPlayer <= auditoryDetectionRange;

      if (isVisuallySpotted || isAuditorilyDetected) {
        (rival as any).playerAlertTicks = 300; // Maintain combat pursuit for 300 ticks (5s) through cover
      } else if ((rival as any).playerAlertTicks > 0) {
        (rival as any).playerAlertTicks -= 1;
      }
      const isPlayerDetected = (((rival as any).playerAlertTicks || 0) > 0 && distToPlayer <= 50.0) || Boolean((rival as any).convergeOnPlayer);

      let moveDirX = 0;
      let moveDirZ = 0;

      if (!isPlayerDetected && !isLowHealth) {
        // Sector Patrol Mode: navigate sequential tactical perimeter waypoints
        const waypoints = ROGUE_PATROL_WAYPOINTS;
        const wpIdx = (rival as any).patrolWpIndex || 0;
        const targetWp = waypoints[wpIdx % waypoints.length];
        const wpDx = targetWp.x - rival.x;
        const wpDz = targetWp.z - rival.z;
        const distToWp = Math.hypot(wpDx, wpDz);
        if (distToWp < 3.0) {
          (rival as any).patrolWpIndex = (wpIdx + 1) % waypoints.length;
        }
        const safeWpDist = Math.max(0.001, distToWp);
        moveDirX = wpDx / safeWpDist;
        moveDirZ = wpDz / safeWpDist;
        rival.facing = Math.atan2(wpDx, wpDz);
      } else {
        // Tactical combat pursuit and strafe movement
        rival.facing = Math.atan2(dx, dz);
        const safeDist = Math.max(0.001, distToPlayer);
        const nx = distToPlayer < 0.001 ? 1 : dx / safeDist;
        const nz = distToPlayer < 0.001 ? 0 : dz / safeDist;

        if (isLowHealth) {
          // Health-based retreat: back away from player towards tactical cover
          moveDirX = -nx;
          moveDirZ = -nz;
        } else if (distToPlayer < 4.0) {
          // Backpedal to maintain tactical shooting distance
          moveDirX = -nx;
          moveDirZ = -nz;
        } else {
          moveDirX = nx;
          moveDirZ = nz;
        }
      }

      const isPlayerCovered = this.checkContainerRayObstruction(rival.x, rival.z, this.player.x, this.player.z, 1.0, 1.0);

      // F-1 Fragmentation Grenade Flush (Tarkov Ordnance):
      // When player holds container cover, Scavs flush them out with frag grenades
      if ((rival as any).grenadeCooldownTicks === undefined) {
        (rival as any).grenadeCooldownTicks = 180; // 3.0s initial engagement delay
      } else if ((rival as any).grenadeCooldownTicks > 0) {
        (rival as any).grenadeCooldownTicks -= 1;
      }

      const isScavOrBoss = rival.id.startsWith('scav_') || rival.badge === 'SCAV PATROL' || rival.badge === 'SECTOR BOSS';
      if (
        isScavOrBoss &&
        !isIngressPending &&
        !isPlayerInHub &&
        isPlayerDetected &&
        isPlayerCovered &&
        distToPlayer >= 7.0 &&
        distToPlayer <= 25.0 &&
        (rival as any).grenadeCooldownTicks <= 0
      ) {
        (rival as any).grenadeCooldownTicks = 600; // 10.0s cooldown
        const fragBarks = ['GRANATA!', 'EAT PINEAPPLE!', 'FRAG OUT!', 'FLUSH HIM OUT!'];
        const chosenBark = fragBarks[Math.floor(Math.random() * fragBarks.length)];
        rival.barkText = chosenBark;
        rival.barkTick = this.tick;
        rival.action = "throw";
        rival.actionTicks = 35;
        this.recentBark = { sender: rival.name, text: chosenBark, tick: this.tick, isBoss: rival.id === BOSS_CONFIG.id };
        this.combatLog.push(`[TACTICAL ORDNANCE] ${rival.name} hurled an F-1 Frag Grenade over cover: "${chosenBark}"`);

        const throwSpeed = Math.min(14.0, Math.max(8.0, distToPlayer * 0.72));
        const safeDist = Math.max(0.001, distToPlayer);
        const toDirX = dx / safeDist;
        const toDirZ = dz / safeDist;
        this.activeGrenades.push({
          id: `frag_${rival.id}_${this.tick}`,
          throwerId: rival.id,
          x: rival.x,
          y: 1.2,
          z: rival.z,
          vx: toDirX * throwSpeed,
          vy: 5.5,
          vz: toDirZ * throwSpeed,
          fuseTicks: 90, // 1.5s fuse
          radius: 7.0,
          maxDamage: 75,
          detonated: false,
        });

        this.enqueuePresentationEvent({
          type: 'grenade_throw',
          shooterId: rival.id,
          origin: { x: rival.x, y: 1.2, z: rival.z },
          target: { x: this.player.x, y: 0.1, z: this.player.z },
        });
      }

      const shouldMove = isLowHealth || !isPlayerDetected || distToPlayer > 12.0 || distToPlayer < 4.0 || isPlayerCovered;
      if (shouldMove) {
        if (isPlayerCovered && isPlayerDetected && !isLowHealth) {
          const safeDist = Math.max(0.001, distToPlayer);
          const cnx = dx / safeDist;
          const cnz = dz / safeDist;
          if (!(rival as any).flankSign) {
            (rival as any).flankSign = ((rival.id.charCodeAt(rival.id.length - 1) || 0) % 2 === 0) ? 1 : -1;
          }
          const strafeSign = (rival as any).flankSign;
          const perpX = -cnz * strafeSign;
          const perpZ = cnx * strafeSign;
          moveDirX = cnx * 0.35 + perpX * 0.9;
          moveDirZ = cnz * 0.35 + perpZ * 0.9;
          const mag = Math.hypot(moveDirX, moveDirZ);
          if (mag > 0.001) {
            moveDirX /= mag;
            moveDirZ /= mag;
          }
        }
        const moveSpeed = isLowHealth ? (SIM_CONFIG.SPEED_WALK * 1.1) : SIM_CONFIG.SPEED_WALK;
        const nextX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, rival.x + moveDirX * moveSpeed * dt));
        const nextZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, rival.z + moveDirZ * moveSpeed * dt));
        let movedX = false;
        let movedZ = false;

        if (Math.abs(moveDirX) > 0.001 && !this.checkContainerCollision(nextX, rival.z, 0.45)) {
          rival.x = nextX;
          movedX = true;
        }
        if (Math.abs(moveDirZ) > 0.001 && !this.checkContainerCollision(rival.x, nextZ, 0.45)) {
          rival.z = nextZ;
          movedZ = true;
        }

        // Tangential wall sliding ONLY if intended movement along an axis was blocked by container
        const hasIntentX = Math.abs(moveDirX) > 0.001;
        const hasIntentZ = Math.abs(moveDirZ) > 0.001;
        const blockedX = hasIntentX && !movedX;
        const blockedZ = hasIntentZ && !movedZ;

        if (blockedX && !hasIntentZ) {
          for (const sign of [1, -1]) {
            const slideZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, rival.z + sign * moveSpeed * dt));
            if (!this.checkContainerCollision(rival.x, slideZ, 0.45)) {
              rival.z = slideZ;
              break;
            }
          }
        } else if (blockedZ && !hasIntentX) {
          for (const sign of [1, -1]) {
            const slideX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, rival.x + sign * moveSpeed * dt));
            if (!this.checkContainerCollision(slideX, rival.z, 0.45)) {
              rival.x = slideX;
              break;
            }
          }
        } else if (!movedX && !movedZ && (hasIntentX || hasIntentZ)) {
          const prefSign = (rival as any).flankSign || 1;
          let slid = false;
          for (const sign of [prefSign, -prefSign]) {
            const slideZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, rival.z + sign * moveSpeed * dt));
            if (!this.checkContainerCollision(rival.x, slideZ, 0.45)) {
              rival.z = slideZ;
              (rival as any).flankSign = sign;
              slid = true;
              break;
            }
            const slideX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, rival.x + sign * moveSpeed * dt));
            if (!this.checkContainerCollision(slideX, rival.z, 0.45)) {
              rival.x = slideX;
              (rival as any).flankSign = sign;
              slid = true;
              break;
            }
          }
          if (!slid) {
            (rival as any).flankSign = -prefSign;
          }
        }

        if (rival.action !== 'shoot') rival.action = 'walk';
      } else {
        if (rival.action !== 'shoot') rival.action = 'idle';
      }

      // Tactical weapon fire cadence & pre-attack telegraph:
      const hasLos = !this.checkContainerRayObstruction(rival.x, rival.z, this.player.x, this.player.z, 1.0, 1.0);

      if (!isIngressPending && !isPlayerInHub && distToPlayer <= 22.0 && hasLos) {
        if ((rival.shootCooldownTicks || 0) <= 0) {
          // Pre-attack telegraph for Scavs (Tarkov voice bark + weapon raise counterplay window)
          const isScav = rival.id.startsWith('scav_') || rival.badge === 'SCAV PATROL' || rival.badge === 'SECTOR BOSS';
          if (isScav && (rival.aimTicks === undefined || rival.aimTicks <= 0)) {
            // Initiate pre-attack telegraph (20 ticks = ~333ms at 60Hz)
            rival.aimTicks = 20;
            rival.facing = Math.atan2(dx, dz);

            let barks = ['VONON!', 'OPACHKI!', 'SUKA!', 'CONTACT!', 'DROP HIM!'];
            if (rival.id === BOSS_CONFIG.id || rival.badge === BOSS_CONFIG.badge) {
              barks = ['DIE, RAT!', 'OPEN FIRE!', 'CRUSH HIM!', 'NO MERCY!'];
            } else if (rival.id === 'scav_enforcer_02') {
              barks = ['ENGAGING HOSTILE!', 'TARGET IN SIGHT!', 'SUPPRESSING!'];
            }
            const chosenBark = barks[Math.floor(Math.random() * barks.length)];
            rival.barkText = chosenBark;
            rival.barkTick = this.tick;
            this.recentBark = { sender: rival.name, text: chosenBark, tick: this.tick, isBoss: rival.id === BOSS_CONFIG.id };
            this.combatLog.push(`[SCAV BARK] ${rival.name}: "${chosenBark}"`);
            continue;
          } else if (isScav && (rival.aimTicks || 0) > 0) {
            rival.aimTicks = (rival.aimTicks || 0) - 1;
            rival.facing = Math.atan2(dx, dz);
            if (rival.aimTicks > 0) {
              continue;
            }
            rival.aimTicks = undefined;
          }

          // Trigger weapon discharge
          rival.action = 'shoot';
          rival.actionTicks = 6;
          rival.shootCooldownTicks = 42; // ~1.4 bursts/sec
          rival.facing = Math.atan2(dx, dz);
          rival.lastFiredAtMs = Date.now();
          rival.lastFireTimestamp = Date.now();
          rival.lastFireTick = this.tick;

          if (!isScav && (!rival.barkTick || this.tick - rival.barkTick > 120)) {
            rival.barkText = 'TARGET ACQUIRED!';
            rival.barkTick = this.tick;
            this.recentBark = { sender: rival.name, text: 'TARGET ACQUIRED!', tick: this.tick };
          }

          // Gunfire acoustic propagation from enemy fire alerts nearby AI
          this.propagateGunfireSound(rival.x, rival.z, 35.0);

          const rMuzzle = this.getOperativeMuzzle(rival);
          this.enqueuePresentationEvent({
            type: "fire",
            shooterId: rival.id,
            origin: rMuzzle.origin,
            dir: rMuzzle.dir,
            weapon: (rival.weapon as any) || "rifle",
          });

          // Lead target slightly based on player movement
          const leadTime = distToPlayer / 52.0;
          const targetX = this.player.x + (this.player.action === "sprint" ? Math.sin(this.player.facing) * 7.5 * leadTime * 0.4 : 0);
          const targetZ = this.player.z + (this.player.action === "sprint" ? Math.cos(this.player.facing) * 7.5 * leadTime * 0.4 : 0);
          const aimDx = targetX - rMuzzle.origin.x;
          const aimDz = targetZ - rMuzzle.origin.z;
          const aimDist = Math.max(0.001, Math.hypot(aimDx, aimDz));
          const aimDirX = aimDx / aimDist;
          const aimDirZ = aimDz / aimDist;

          const rawDmg = rival.weapon === "shotgun" ? 20 : 12;
          this.spawnProjectile({
            id: "proj_" + rival.id + "_" + this.tick + "_" + Math.random().toString(36).slice(2, 6),
            shooterId: rival.id,
            shooterIsPlayer: false,
            x: rMuzzle.origin.x,
            y: rMuzzle.origin.y,
            z: rMuzzle.origin.z,
            vx: aimDirX * 52.0,
            vy: 0,
            vz: aimDirZ * 52.0,
            speed: 52.0,
            damage: rawDmg,
            radius: 0.21,
            maxRange: 22.0,
            distanceTraveled: 0,
            weapon: (rival.weapon as any) || "rifle",
          });
        }
      }
    }
  }

  private stepMachines(): number {
    let damageToPlayer = 0;

    for (const machine of this.machines) {
      if (!machine.isAlive) continue;

      if (machine.cooldownTicks > 0) {
        machine.cooldownTicks -= 1;
      }

      // Shared defense targeting: identify closest alive, unextracted operative
      const candidates: Array<{ id: string; x: number; z: number; isPlayer: boolean; isAI: boolean }> = [];
      const ingressKind = this.ingressController.getState().kind;
      const isIngressPending = ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad' || ingressKind === 'rejected';
      const isHub = this.zoneMode === 'hub' || this.zoneMode === 'airlock_corridor' || this.player.z < -48;
      if (!isIngressPending && !isHub && this.player.isAlive && !this.player.isExtracted && this.player.health > 0) {
        candidates.push({ id: this.player.id, x: this.player.x, z: this.player.z, isPlayer: true, isAI: false });
      }
      for (const r of this.rivals) {
        if (!isHub && r.isAlive && !r.isExtracted && r.health > 0 && r.isAI) {
          candidates.push({ id: r.id, x: r.x, z: r.z, isPlayer: false, isAI: true });
        }
      }

      // Physical patrol sweep for drones
      if (machine.type === 'drone') {
        if (typeof (machine as any).originX !== 'number') {
          (machine as any).originX = machine.x;
          (machine as any).originZ = machine.z;
        }
        const pSpeed = 0.012;
        machine.x = (machine as any).originX + Math.sin(this.tick * pSpeed) * 5.0;
        machine.z = (machine as any).originZ + Math.cos(this.tick * pSpeed) * 3.5;
      }

      const detectionRange = machine.type === 'turret' ? 20.0 : 25.0;
      // Deterministically sort candidates: primary by 5cm distance bins, tie-break by ID (strictly transitive total order)
      candidates.sort((a, b) => {
        const distA = Math.hypot(a.x - machine.x, a.z - machine.z);
        const distB = Math.hypot(b.x - machine.x, b.z - machine.z);
        const binA = Math.floor(distA * 20); // 5cm resolution
        const binB = Math.floor(distB * 20);
        if (binA !== binB) {
          return binA - binB;
        }
        return a.id.localeCompare(b.id);
      });

      // Target selection: select nearest candidate that is NOT covered by containers!
      let chosenTarget: { id: string; x: number; z: number; isPlayer: boolean; isAI: boolean; dist: number } | null = null;
      for (const cand of candidates) {
        const d = Math.hypot(cand.x - machine.x, cand.z - machine.z);
        if (d > detectionRange) continue;
        const mY = typeof machine.y === "number" ? machine.y : (machine.type === "drone" ? 3.5 : 1.0);
        const isCovered = this.checkContainerRayObstruction(machine.x, machine.z, cand.x, cand.z, mY, 1.0);
        if (!isCovered) {
          chosenTarget = { ...cand, dist: d };
          break;
        }
      }

      const closestTarget = chosenTarget || (candidates.length > 0 && Math.hypot(candidates[0].x - machine.x, candidates[0].z - machine.z) <= detectionRange
        ? { ...candidates[0], dist: Math.hypot(candidates[0].x - machine.x, candidates[0].z - machine.z) }
        : null);

      if (closestTarget) {
        machine.facing = Math.atan2(closestTarget.x - machine.x, closestTarget.z - machine.z);
        (machine as any).targetDistance = Math.hypot(closestTarget.x - machine.x, closestTarget.z - machine.z);
        (machine as any).targetY = 1.0;
        (machine as any).targetX = closestTarget.x;
        (machine as any).targetZ = closestTarget.z;

        if (machine.cooldownTicks <= 0) {
          machine.cooldownTicks = machine.type === 'turret' ? 45 : 30;
          machine.lastFiredAtMs = Date.now();
          machine.lastFiredTick = this.tick;

          const machineY = typeof machine.y === "number" ? machine.y : (machine.type === "drone" ? 3.5 : 1.0);
          const isCovered = this.checkContainerRayObstruction(machine.x, machine.z, closestTarget.x, closestTarget.z, machineY, 1.0);
          if (isCovered) {
            this.combatLog.push(`[COVER] ${machine.id} fire deflected by container cover`);
            continue;
          }

          // Calculate 3D physical muzzle origin point
          const muzzleOffset = 1.2;
          const muzzleX = machine.x + Math.sin(machine.facing) * muzzleOffset;
          const muzzleY = machine.type === 'turret' ? 1.1 : machineY;
          const muzzleZ = machine.z + Math.cos(machine.facing) * muzzleOffset;

          const aimDx = closestTarget.x - muzzleX;
          const aimDz = closestTarget.z - muzzleZ;
          const aimDist = Math.max(0.001, Math.hypot(aimDx, aimDz));
          const aimDirX = aimDx / aimDist;
          const aimDirZ = aimDz / aimDist;

          // Enqueue presentation event for muzzle flash, audio, and bullet tracer
          this.enqueuePresentationEvent({
            type: "fire",
            shooterId: machine.id,
            origin: { x: muzzleX, y: muzzleY, z: muzzleZ },
            dir: { x: aimDirX, y: 0, z: aimDirZ },
            weapon: "rifle",
          });

          // Spawn visible ballistic projectile traveling towards target with crimson tracer
          const rawDmg = this.serverMachineDamageAuthority ? 0 : (machine.type === 'turret' ? 14 : 10);
          const projSpeed = 44.0;
          this.spawnProjectile({
            id: `proj_${machine.id}_${this.tick}_${Math.random().toString(36).slice(2, 6)}`,
            shooterId: machine.id,
            shooterIsPlayer: false,
            x: muzzleX,
            y: muzzleY,
            z: muzzleZ,
            vx: aimDirX * projSpeed,
            vy: 0,
            vz: aimDirZ * projSpeed,
            speed: projSpeed,
            damage: rawDmg,
            radius: 0.21,
            maxRange: detectionRange + 4.0,
            distanceTraveled: 0,
            weapon: "rifle",
          });

          this.combatLog.push(`[DEFENSE FIRE] ${machine.id} discharged round at ${closestTarget.isPlayer ? "Operative" : closestTarget.id}`);
        }
      } else {
        (machine as any).targetDistance = 0;
        (machine as any).targetX = undefined;
        (machine as any).targetZ = undefined;
      }
    }

    return damageToPlayer;
  }

  private updateProximityAlert(): void {
    let closestDist = 999;
    let closestRival: OperativeState | undefined;

    for (const rival of this.rivals) {
      if (!rival.isAlive || rival.isExtracted) continue;
      const d = Math.hypot(this.player.x - rival.x, this.player.z - rival.z);
      if (d < closestDist) {
        closestDist = d;
        closestRival = rival;
      }
    }

    if (closestDist <= SIM_CONFIG.PROXIMITY_ALERT_RADIUS && closestRival) {
      const dx = closestRival.x - this.player.x;
      const dz = closestRival.z - this.player.z;
      let angleRad = Math.atan2(dx, -dz);
      let angleDeg = (angleRad * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;

      this.proximityAlert = {
        active: true,
        distance: Math.round(closestDist),
        bearing: Math.round(angleDeg),
        targetName: closestRival.name,
        isRogueAI: closestRival.badge === 'ROGUE AI OPERATOR',
      };
    } else {
      this.proximityAlert = {
        active: false,
        distance: Math.round(closestDist),
        bearing: 0,
      };
    }
  }
}
