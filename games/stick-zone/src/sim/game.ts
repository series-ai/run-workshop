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

export const DEPOT_CONTAINERS: ObstacleBox[] = [
  { minX: -23.5, maxX: -16.5, minZ: -32.0, maxZ: -28.0 },
  { minX: -37.0, maxX: -33.0, minZ: -13.5, maxZ: -6.5 },
  { minX: 7.0, maxX: 13.0, minZ: -41.5, maxZ: -38.5 },
  { minX: 27.0, maxX: 33.0, minZ: -22.5, maxZ: -17.5 },
  { minX: -17.0, maxX: -13.0, minZ: 11.5, maxZ: 18.5 },
  { minX: 2.0, maxX: 8.0, minZ: 28.5, maxZ: 31.5 },
  { minX: -48.5, maxX: -41.5, minZ: 33.0, maxZ: 37.0 },
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

import { SIM_CONFIG } from './config.js';
import {
  createExfilController,
  ExfilController,
  StagedIngressController,
  type RaidWorldSnapshot,
} from './airlock.js';

export interface Vector2D {
  x: number;
  z: number;
}

export type StickActionState = 'idle' | 'walk' | 'sprint' | 'slide' | 'roll' | 'kick' | 'shoot' | 'jump' | 'crouch';

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
  ammo: number;
  maxAmmo: number;
  shootCooldownTicks?: number;
  lastStateTimestamp?: number;
  isSliding?: boolean;
  slideTicksRemaining?: number;
  lastFiredAtMs?: number;
  lastFireTimestamp?: number;
  lastFireTick?: number;
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

export interface LootCrate {
  id: string;
  x: number;
  z: number;
  cashValue: number;
  opened: boolean;
  claimedBy?: string;
  claimedAt?: number;
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
}

export class SectorDepotSimulation {
  public tick = 0;
  public raidId: string = "raid_sector7_1042";
  public isRaidExpired = false;
  public aiSpawned = false;
  public frozenSettlementTick?: number;
  public frozenSettlementCash?: number;
  private cratePreviousAmmo = new Map<string, number>();
  private crateLootHistory: Array<{ crateId: string; ammoBefore: number; ammoGranted: number; tick: number; approved: boolean }> = [];
  public player: OperativeState;
  public squadmate: OperativeState;
  public rivals: OperativeState[] = [];
  public machines: MachineDefense[] = [];
  public crates: LootCrate[] = [];
  public exfilController: ExfilController;
  public ingressController: StagedIngressController;
  public proximityAlert: ProximityAlert = { active: false, distance: 999, bearing: 0 };
  public combatLog: string[] = [];
  public lastInterruptionTick = 0;
  public shootCooldownTicks = 0;
  public rollCooldownTicks = 0;
  public kickCooldownTicks = 0;
  public slideVx = 0;
  public slideVz = 0;
  public walkVx = 0;
  public walkVz = 0;
  public jumpVy = 0;
  public slideTicksRemaining = 0;
  public slideKeyReleased = true;
  public cameraPos?: { x: number; y: number; z: number };
  public cameraTarget?: { x: number; y: number; z: number };
  public onPlayerDeath?: () => void;
  public onDamageTaken?: () => void;

  // External network coordinator callbacks
  public onHitTarget?: (targetId: string, damage: number, knockbackX?: number, knockbackZ?: number) => void;
  public onLootCrate?: (crateId: string, cash: number, claimTimestamp?: number) => void;
  public onHoldProgress?: (holdTicks: number, currentTick: number) => void;
  public settlementAuthority?: any;
  public onRequestLootCrate?: (crateId: string, cashValue: number) => void;
  public onMachineHit?: (machineId: string, damage: number, kind?: 'kick' | 'rifle') => void;
  /**
   * Aggregated melee kick action: ONE action = ONE authoritative validation = ONE cooldown charge.
   * The kick may reach multiple machines and rivals; the network layer must dispatch the full
   * target set as a single packet so the authority validates it atomically (never per-target
   * cooldown rejections that desync optimistic prediction).
   * Falls back to per-target onMachineHit/onHitTarget when no aggregator is wired (offline/solo).
   */
  public onKickAction?: (action: KickActionPayload) => void;
  public onExfilSuccess?: (receipt?: any) => void;
  public sessionToken?: string;
  /**
   * When the authenticated relay runs server-side machine attack authority, local
   * machine->player damage is suppressed (visual fire continues): machine damage to
   * the LOCAL operative arrives exclusively via authoritative machine_attack
   * broadcasts, so a client cannot under-report machine fire to keep an hold alive.
   */
  public serverMachineDamageAuthority = false;

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
    const granted = Math.max(0, this.player.maxAmmo - this.player.ammo);
    this.crateLootHistory.push({
      crateId,
      ammoBefore: this.player.ammo,
      ammoGranted: granted,
      tick: this.tick,
      approved: false,
    });
    this.player.ammo = this.player.maxAmmo;
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
    if (idx < this.crateLootHistory.length - 1) {
      // A later crate was looted after this one: transfer the true pre-loot baseline minus intervening shots to the next entry
      const nextEntry = this.crateLootHistory[idx + 1];
      const shotsFired = Math.max(0, this.player.maxAmmo - nextEntry.ammoBefore);
      const effectiveAmmoBefore = Math.max(0, entry.ammoBefore - shotsFired);
      nextEntry.ammoBefore = effectiveAmmoBefore;
      nextEntry.ammoGranted = Math.max(0, this.player.maxAmmo - effectiveAmmoBefore);
    } else {
      // No later crate loot: deduct only the ammo granted by this rejected crate
      this.player.ammo = Math.max(0, this.player.ammo - entry.ammoGranted);
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
        // Local claim was revoked by server snapshot! Reconcile local cash and ammo
        if (!this.player.isExtracted) {
          this.player.cash = Math.max(0, this.player.cash - crate.cashValue);
          if (this.frozenSettlementCash !== undefined) {
            this.frozenSettlementCash = Math.min(this.frozenSettlementCash, this.player.cash);
          }
          this.handleCrateRejectionAmmo(crate.id);
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
      // Authoritative cancellation: clear local extraction custody
      (this as any).serverHoldCompletedAtTick = 0;
      this.player.isExtracted = false;
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

  public reconcileCrateRejection(crateId: string, cash: number): void {
    if (this.player.isExtracted) return; // Finality: extracted cash is protected
    const crate = this.crates.find((c) => c.id === crateId);
    if (!crate || crate.claimedBy !== this.player.id) return;
    crate.claimedBy = undefined;
    crate.opened = false;
    this.player.cash = Math.max(0, this.player.cash - cash);
    this.handleCrateRejectionAmmo(crateId);
    if (this.frozenSettlementCash !== undefined) {
      this.frozenSettlementCash = Math.min(this.frozenSettlementCash, this.player.cash);
    }
    this.combatLog.push(`[SETTLEMENT] Loot claim for ${crateId} rejected by authority. Reconciled balance.`);
  }
  private _unusedFreeze() {
    if (this.frozenSettlementTick === undefined) {
      this.frozenSettlementTick = this.tick;
      this.frozenSettlementCash = this.player.cash;
    }
    return { tick: this.frozenSettlementTick, cash: this.frozenSettlementCash };
  }

  public checkContainerCollision(x: number, z: number, radius = 0.45): boolean {
    for (const box of DEPOT_CONTAINERS) {
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
    return false;
  }

  public isPlayerInExfilZone(): boolean {
    const distToExfil = Math.hypot(this.player.x - SIM_CONFIG.EXFIL_ZONE.x, this.player.z - SIM_CONFIG.EXFIL_ZONE.z);
    return distToExfil <= SIM_CONFIG.EXFIL_ZONE.radius;
  }

  public isInputLocked(): boolean {
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
            this.player.cash = Math.max(0, this.player.cash - crate.cashValue);
            this.handleCrateRejectionAmmo(crate.id);
            if (this.frozenSettlementCash !== undefined) {
              this.frozenSettlementCash = Math.min(this.frozenSettlementCash, this.player.cash);
            }
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
      this.combatLog.push(`[TICK ${this.tick}] Scavenged Crate: +${crate.cashValue.toLocaleString()}`);
      this.onLootCrate?.(crate.id, crate.cashValue, timestamp);
    }
    return true;
  }

  constructor(raidId: string = "raid_sector7_1042") {
    this.raidId = raidId;
    this.exfilController = createExfilController();
    this.ingressController = new StagedIngressController();

    // Spawn player operative
    this.player = {
      id: 'op_player',
      isPlayer: true,
      isRival: false,
      isAI: false,
      name: 'OPERATIVE GHOST-1',
      badge: 'SQUAD ALPHA',
      x: SIM_CONFIG.SPAWN_SQUAD_A.x,
      y: 0,
      z: SIM_CONFIG.SPAWN_SQUAD_A.z,
      facing: 0,
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

    // Spawn companion scout
    this.squadmate = {
      id: 'op_squadmate',
      isPlayer: false,
      isRival: false,
      isAI: true,
      name: 'SCOUT VIPER-2',
      badge: 'SQUAD ALPHA',
      x: SIM_CONFIG.SPAWN_SQUAD_A.x + 2,
      y: 0,
      z: SIM_CONFIG.SPAWN_SQUAD_A.z - 2,
      facing: 0,
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
        cooldownTicks: 0,
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
        cooldownTicks: 0,
      },
    ];

    // Initialize 3 loot crates across depot
    this.crates = [
      { id: 'crate_01', x: -8, z: -6, cashValue: 1250, opened: false },
      { id: 'crate_02', x: 20, z: -15, cashValue: 2400, opened: false },
      { id: 'crate_03', x: -18, z: 22, cashValue: 3800, opened: false },
    ];
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

  public spawnRogueSquad(): void {
    const activeRivals = this.rivals.filter(r => r.isAlive && !r.isExtracted);
    if (activeRivals.length > 0) return;

    const rogueX = (SIM_CONFIG as any).SPAWN_ROGUE_AI ? (SIM_CONFIG as any).SPAWN_ROGUE_AI.x : -45;
    const rogueZ = (SIM_CONFIG as any).SPAWN_ROGUE_AI ? (SIM_CONFIG as any).SPAWN_ROGUE_AI.z : 45;

    this.rivals.push({
      id: 'op_rogue_ai',
      isPlayer: false,
      isRival: true,
      isAI: true,
      name: 'ROGUE EXFIL HUNTER',
      badge: 'ROGUE AI OPERATOR',
      x: rogueX,
      y: 0,
      z: rogueZ,
      facing: Math.PI,
      health: 100,
      armor: 75,
      cash: 2500,
      action: 'idle',
      actionTicks: 0,
      isInvulnerable: false,
      isAlive: true,
      isExtracted: false,
      ammo: 30,
      maxAmmo: 30,
    });

    this.combatLog.push(`[TICK ${this.tick}] WARNING: ROGUE AI OPERATOR detected in Sector 7 Safehouse.`);
  }

  public applyDamageToPlayer(rawDmg: number): void {
    if (this.player.isInvulnerable || !this.player.isAlive) return;

    const { newHealth, newArmor } = applyStandardDamage(this.player.health, this.player.armor, rawDmg);
    this.player.health = newHealth;
    this.player.armor = newArmor;

    // Critical Extraction Rule: taking damage resets hold ticks to 0 immediately.
    // An "extraction interruption" is only registered when an ACTIVE hold attempt was
    // interrupted — damage outside the LZ must not fabricate a reset event.
    const interruptedActiveHold = this.exfilController.getState().kind === "holding_zone";
    this.exfilController.onDamageTaken();
    if (interruptedActiveHold) {
      this.lastInterruptionTick = this.tick;
      this.onHoldProgress?.(0, this.tick);
    }
    this.onDamageTaken?.();

    if (this.player.health <= 0) {
      this.player.health = 0;
      this.player.isAlive = false;
      this.combatLog.push(`[TICK ${this.tick}] K.I.A. Operative eliminated`);
      this.onPlayerDeath?.();
    }
  }

  public step(input: GameInput): void {
    if (!this.player.isAlive || this.player.isExtracted) {
      if (this.exfilController.getState().kind === "corridor_presentation") {
        this.exfilController.cancel();
      }
      if (this.player.y > 0 || this.jumpVy !== 0 || this.player.isJumping) {
        const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;
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

    if (this.tick >= SIM_CONFIG.RAID_DEADLINE_TICK) {
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

    // Handle ongoing action countdowns and cooldowns
    if (this.shootCooldownTicks > 0) this.shootCooldownTicks -= 1;
    this.player.shootCooldownTicks = this.shootCooldownTicks;
    if (this.rollCooldownTicks > 0) this.rollCooldownTicks -= 1;
    if (this.kickCooldownTicks > 0) this.kickCooldownTicks -= 1;

    // Check combat roll initiation (Space) BEFORE machine and rival attacks run
    // so 12 iframes apply immediately on frame 1
    if (!this.isInputLocked() && input.roll && this.rollCooldownTicks <= 0 && this.player.action !== 'roll' && this.player.action !== 'slide' && this.slideTicksRemaining <= 0) {
      this.player.action = 'roll';
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
      if (this.player.actionTicks === 0) {
        this.player.action = (this.player.isJumping || this.player.y > 0) ? 'jump' : 'idle';
        this.player.isInvulnerable = false;
      }
    } else {
      if (this.player.action === 'roll' || this.player.action === 'slide' || this.player.action === 'kick' || this.player.action === 'shoot') {
        this.player.action = (this.player.isJumping || this.player.y > 0) ? 'jump' : 'idle';
      }
      this.player.isInvulnerable = false;
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
    if (!this.player.isAlive || this.player.health <= 0) {
      return;
    }

    // 5. Extraction Zone Detection & Dwell State Machine
    const distToExfil = Math.hypot(this.player.x - SIM_CONFIG.EXFIL_ZONE.x, this.player.z - SIM_CONFIG.EXFIL_ZONE.z);
    const ingressKind = this.ingressController.getState().kind;
    const isIngressPending = ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad' || ingressKind === 'rejected';
    const inExfilZone = !isIngressPending && (distToExfil <= SIM_CONFIG.EXFIL_ZONE.radius);

    this.exfilController.onTick(this.tick, inExfilZone, 'lz_sector7_charlie', machineDamage);

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

    const dt = SIM_CONFIG.TICK_INTERVAL_MS / 1000;

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
      this.player.actionTicks = SIM_CONFIG.SLIDE_TICKS;
      this.slideTicksRemaining = SIM_CONFIG.SLIDE_TICKS;
      this.walkVx = 0;
      this.walkVz = 0;
      const moveMag = Math.hypot(input.dx, input.dz);
      const dirX = moveMag > 0.01 ? (input.dx / moveMag) : Math.sin(this.player.facing);
      const dirZ = moveMag > 0.01 ? (input.dz / moveMag) : Math.cos(this.player.facing);
      this.slideVx = dirX * (SIM_CONFIG.SPEED_SPRINT * 1.35);
      this.slideVz = dirZ * (SIM_CONFIG.SPEED_SPRINT * 1.35);
    }

    // Melee kick initiation (F) with 42-tick recovery cooldown
    if (input.kick && this.kickCooldownTicks <= 0 && this.player.action !== 'roll') {
      this.player.action = 'kick';
      this.player.actionTicks = SIM_CONFIG.KICK_TICKS;
      this.kickCooldownTicks = SIM_CONFIG.KICK_TICKS;
      this.performMeleeKick();
    }

    // Gunplay shooting with proper weapon fire cadence (RIFLE_COOLDOWN_TICKS)
    if (input.shoot && this.player.ammo > 0 && this.player.action !== 'roll' && this.shootCooldownTicks <= 0) {
      this.player.ammo -= 1;
      if (this.player.action !== 'kick') {
        this.player.action = 'shoot';
        this.player.actionTicks = 6; // Set actionTicks so recoil visually displays
      }
      this.shootCooldownTicks = SIM_CONFIG.RIFLE_COOLDOWN_TICKS;
      this.player.shootCooldownTicks = this.shootCooldownTicks;
      this.fireWeapon();
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

    // Loot crate pickup
    if (input.interact) {
      for (const crate of this.crates) {
        if (!crate.opened && Math.hypot(this.player.x - crate.x, this.player.z - crate.z) <= 3.0) {
          if (this.onRequestLootCrate) {
            this.onRequestLootCrate(crate.id, crate.cashValue);
          } else {
            this.claimCrateLocally(crate.id, this.player.id, Date.now());
          }
          break;
        }
      }
    }
  }

  private performMeleeKick(): void {
    const kickRange = 2.5;
    const forwardX = Math.sin(this.player.facing);
    const forwardZ = Math.cos(this.player.facing);

    const machineHits: KickActionPayload['machineHits'] = [];
    const rivalHits: KickActionPayload['rivalHits'] = [];

    // 1. Kick machines (turrets, drones)
    for (const machine of this.machines) {
      if (!machine.isAlive) continue;
      const mdx = machine.x - this.player.x;
      const mdz = machine.z - this.player.z;
      const mdist = Math.hypot(mdx, mdz);
      if (mdist <= kickRange && mdist > 0.1) {
        const dot = (mdx * forwardX + mdz * forwardZ) / mdist;
        if (dot < 0.2) continue; // Must be in forward attack cone (~78 degrees)
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
        const dot = (dx * forwardX + dz * forwardZ) / dist;
        if (dot < 0.2) continue; // Must be in front of player (forward attack cone)
        // Physical cover check: cannot kick through containers
        if (this.checkContainerRayObstruction(this.player.x, this.player.z, rival.x, rival.z, 1.0, 1.0)) {
          this.combatLog.push(`[TICK ${this.tick}] Melee kick deflected by container cover`);
          continue;
        }

        const { newHealth, newArmor } = applyStandardDamage(rival.health, rival.armor, 35);
        rival.health = newHealth;
        rival.armor = newArmor;
        const knockX = Math.sin(this.player.facing) * 4.5;
        const knockZ = Math.cos(this.player.facing) * 4.5;

        // Step along knockback displacement and clamp against container collision
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

        (rival as any).knockbackVx = 0;
        (rival as any).knockbackVz = 0;
        this.combatLog.push(`[TICK ${this.tick}] Roundhouse Kick connected on ${rival.name} (-35 HP, 4.5m knockback)`);
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
          if (rival.isAI) {
            rival.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Rival operator eliminated by melee kick: ${rival.name}`);
          } else {
            // For multiplayer rivals, local hit is a prediction; keep at 1 HP until peer/authority confirms death
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
  }

  private fireWeapon(): void {
    const now = Date.now();
    this.player.lastFiredAtMs = now;
    this.player.lastFireTimestamp = now;
    this.player.lastFireTick = this.tick;
    const range = 35.0; // Strictly matches multiplayer effective range threshold
    const bulletDirX = Math.sin(this.player.facing);
    const bulletDirZ = Math.cos(this.player.facing);

    let closestHit: { type: 'machine' | 'rival'; id: string; dist: number; ref: any } | null = null;
    let anyInConeObstructed = false;

    // Check hit against machines
    for (const m of this.machines) {
      if (!m.isAlive) continue;
      const dx = m.x - this.player.x;
      const dz = m.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist <= range) {
        const dot = (dx * bulletDirX + dz * bulletDirZ) / dist;
        const perpDist = Math.abs(dx * bulletDirZ - dz * bulletDirX);
        if (dot > 0.96 && perpDist <= 1.2) {
          const mY = typeof m.y === "number" ? m.y : (m.type === "drone" ? 3.5 : 1.0);
          const isCovered = this.checkContainerRayObstruction(this.player.x, this.player.z, m.x, m.z, 1.0, mY);
          if (isCovered) {
            anyInConeObstructed = true;
          } else if (!closestHit || dist < closestHit.dist) {
            closestHit = { type: 'machine', id: m.id, dist, ref: m };
          }
        }
      }
    }

    // Check hit against rivals
    for (const r of this.rivals) {
      if (!r.isAlive || r.isExtracted || (r.isInvulnerable && r.action === 'roll')) continue;
      const dx = r.x - this.player.x;
      const dz = r.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist <= range) {
        const dot = (dx * bulletDirX + dz * bulletDirZ) / dist;
        const perpDist = Math.abs(dx * bulletDirZ - dz * bulletDirX);
        if (dot > 0.96 && perpDist <= 1.2) {
          const isCovered = this.checkContainerRayObstruction(this.player.x, this.player.z, r.x, r.z);
          if (isCovered) {
            anyInConeObstructed = true;
          } else if (!closestHit || dist < closestHit.dist) {
            closestHit = { type: 'rival', id: r.id, dist, ref: r };
          }
        }
      }
    }

    if (!closestHit && anyInConeObstructed) {
      this.combatLog.push('[COVER] Rifle burst impacted shipping container');
      return;
    }

    if (closestHit) {

      if (closestHit.type === 'machine') {
        const m = closestHit.ref;
        if (this.onMachineHit) {
          m.health = Math.max(1, m.health - SIM_CONFIG.RIFLE_DAMAGE);
          this.onMachineHit(m.id, SIM_CONFIG.RIFLE_DAMAGE, 'rifle');
        } else {
          m.health = Math.max(0, m.health - SIM_CONFIG.RIFLE_DAMAGE);
          if (m.health <= 0) {
            m.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Enemy destroyed: ${m.id}`);
          }
        }
      } else if (closestHit.type === 'rival') {
        const r = closestHit.ref;
        const { newHealth, newArmor } = applyStandardDamage(r.health, r.armor, SIM_CONFIG.RIFLE_DAMAGE);
        r.health = newHealth;
        r.armor = newArmor;
        this.onHitTarget?.(r.id, SIM_CONFIG.RIFLE_DAMAGE);
        this.combatLog.push(`[TICK ${this.tick}] Direct hit on ${r.name} (-${SIM_CONFIG.RIFLE_DAMAGE} HP)`);
        if (r.health <= 0) {
          if (r.isAI) {
            r.isAlive = false;
            this.combatLog.push(`[TICK ${this.tick}] Rival operator eliminated: ${r.name}`);
          } else {
            // For multiplayer rivals, local hit is a prediction; keep at 1 HP until peer/authority confirms death
            r.health = 1;
          }
        }
      }
    }
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

      const dx = this.player.x - rival.x;
      const dz = this.player.z - rival.z;
      const distToPlayer = Math.hypot(dx, dz);

      const isLowHealth = rival.health < 40;
      const hasLosToPlayer = !this.checkContainerRayObstruction(rival.x, rival.z, this.player.x, this.player.z, 1.0, 1.0);
      if ((distToPlayer <= 25.0 && hasLosToPlayer) || distToPlayer <= 16.0) {
        (rival as any).playerAlertTicks = 300; // Maintain combat pursuit for 300 ticks (5s) through cover
      } else if ((rival as any).playerAlertTicks > 0) {
        (rival as any).playerAlertTicks -= 1;
      }
      const isPlayerDetected = ((rival as any).playerAlertTicks || 0) > 0 && distToPlayer <= 35.0;

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

      // Tactical weapon fire cadence: attacks when in range <= 22m and cooldown ready
      const ingressKind = this.ingressController.getState().kind;
      const isIngressPending = ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad' || ingressKind === 'rejected';
      if (!isIngressPending && distToPlayer <= 22.0 && (rival.shootCooldownTicks || 0) <= 0) {
        rival.action = 'shoot';
        rival.actionTicks = 6;
        rival.shootCooldownTicks = 18; // ~3.3 bursts/sec
        rival.lastFiredAtMs = Date.now();
        rival.lastFireTimestamp = Date.now();
        rival.lastFireTick = this.tick;

        // Physical cover check: bullets cannot penetrate shipping containers
        const isCovered = this.checkContainerRayObstruction(rival.x, rival.z, this.player.x, this.player.z, 1.0, 1.0);
        if (isCovered) {
          this.combatLog.push(`[COVER] ${rival.name} rifle burst deflected by container cover`);
          continue;
        }

        // Deal combat damage to player unless player is invulnerable (roll iframes)
        if (!this.player.isInvulnerable) {
          const rawDmg = 12;
          this.applyDamageToPlayer(rawDmg);
          this.combatLog.push(`[TICK ${this.tick}] Struck by ${rival.name} rifle burst (-${rawDmg} HP)`);
        } else {
          this.combatLog.push(`[TICK ${this.tick}] ${rival.name} burst deflected by combat roll`);
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
      if (!isIngressPending && this.player.isAlive && !this.player.isExtracted && this.player.health > 0) {
        candidates.push({ id: this.player.id, x: this.player.x, z: this.player.z, isPlayer: true, isAI: false });
      }
      for (const r of this.rivals) {
        if (r.isAlive && !r.isExtracted && r.health > 0) {
          candidates.push({ id: r.id, x: r.x, z: r.z, isPlayer: false, isAI: !!r.isAI });
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

        if (machine.cooldownTicks <= 0) {
          machine.cooldownTicks = machine.type === 'turret' ? 45 : 30;
          machine.lastFiredAtMs = Date.now();
          machine.lastFiredTick = this.tick;
          (machine as any).targetDistance = Math.hypot(closestTarget.x - machine.x, closestTarget.z - machine.z);
          (machine as any).targetY = 1.0;
          (machine as any).targetX = closestTarget.x;
          (machine as any).targetZ = closestTarget.z;

          const machineY = typeof machine.y === "number" ? machine.y : (machine.type === "drone" ? 3.5 : 1.0);
          const isCovered = this.checkContainerRayObstruction(machine.x, machine.z, closestTarget.x, closestTarget.z, machineY, 1.0);
          if (isCovered) {
            this.combatLog.push(`[COVER] ${machine.id} fire deflected by container cover`);
            continue;
          }

          if (closestTarget.isPlayer) {
            if (!this.player.isInvulnerable && !this.serverMachineDamageAuthority) {
              const rawDmg = machine.type === 'turret' ? 14 : 10;
              this.applyDamageToPlayer(rawDmg);
              damageToPlayer += rawDmg;
            }
            // When serverMachineDamageAuthority is active, the authoritative damage is
            // applied by the relay's machine_attack broadcast — local application is
            // suppressed so the two paths never double-apply.
          } else if (closestTarget.isAI) {
            const r = this.rivals.find((riv) => riv.id === closestTarget!.id && riv.isAI);
            if (r && r.isAlive && !r.isInvulnerable) {
              const rawDmg = machine.type === 'turret' ? 14 : 10;
              const { newHealth, newArmor } = applyStandardDamage(r.health, r.armor, rawDmg);
              r.health = newHealth;
              r.armor = newArmor;
              if (r.health <= 0) {
                r.isAlive = false;
                this.combatLog.push(`[TICK ${this.tick}] Enemy eliminated by machine defense: ${r.name}`);
              }
            }
          }
        }
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
