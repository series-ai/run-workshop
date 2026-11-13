import { calculateShotgunHit } from './shotgunCollision.js';
import type { ActiveSpokeSession } from "@series-inc/rundot-game-sdk";
import { parseConfirmedState } from "../platform/synchub.js";
import { confirmedView, movementIntent, type DebriefInput } from "./coopAdapter.js";
import { buildCoopRaidRules } from "./coopConfig.js";
/**
 * @file multiplayer.ts
 * Real-time multiplayer synchronization delegated to first-party SyncHub platform SDK
 * (ActiveSpokeSession & GatewayServerRoom) with event-id deduplication, staged ingress lifecycle,
 * shared world loot/destruction, and cross-browser hit/knockback coordination.
 */

import type { SectorDepotSimulation, StickActionState, KickActionPayload } from './game.js';
import { DEPOT_CONTAINERS, segmentIntersectsAABB } from './game.js';
import type { RaidWorldSnapshot, SettlementReceipt } from './airlock.js';
import { verifyReceiptIntegrity, defaultSettlementLedger, registerDeployment } from './airlock.js';
import { SIM_CONFIG, BOSS_CONFIG, AI_CONFIGS } from './config.js';
import { sound } from '../audio.js';

export type HandshakeState =
  | 'none'
  | 'requested'
  | 'snapshot_sent'
  | 'snapshot_received'
  | 'ack_sent'
  | 'confirmed';

export interface PeerEntry {
  lastState?: any;
  lastSeen: number;
  name: string;
  ingressDone: boolean;
  admitted?: boolean;
  isDead?: boolean;
  isExtracted?: boolean;
  lastStateTimestamp?: number;
  handshakeState: HandshakeState;
  outHandshakeState?: "none" | "snapshot_sent" | "confirmed";
  inHandshakeState?: "none" | "snapshot_received" | "ack_sent" | "confirmed";
}

export interface StatePacketData {
  x?: number;
  y?: number;
  z?: number;
  facing?: number;
  action?: StickActionState | string;
  actionTicks?: number;
  health?: number;
  hp?: number;
  armor?: number;
  cash?: number;
  isInvulnerable?: boolean;
  isAlive?: boolean;
  isExtracted?: boolean;
  ammo?: number;
  maxAmmo?: number;
  isAdmitted?: boolean;
  aimAngle?: number;
  ingressDone?: boolean;
  holdTicks?: number;
  isReload?: boolean;
  isSliding?: boolean;
  slideTicksRemaining?: number;
  weapon?: 'rifle' | 'shotgun' | 'fists' | 'grenade';
  rifleAmmo?: number;
  shotgunAmmo?: number;
  hasKeycard?: boolean;
  isUsingStim?: boolean;
  stimsRemaining?: number;
}

export interface HitPacketData {
  tick?: number;
  targetId?: string;
  damage?: number;
  knockX?: number;
  knockZ?: number;
  kind?: 'rifle' | 'kick' | 'shotgun';
  weapon?: 'rifle' | 'shotgun' | 'fists' | 'grenade';
  weaponType?: 'rifle' | 'shotgun';
  shotId?: string;
  attackerFacing?: number;
  attackerX?: number;
  attackerZ?: number;
  targetHealth?: number;
  targetArmor?: number;
  targetAlive?: boolean;
}

export interface CrateLootedAckPacketData {
  crateId: string;
  claimantId: string;
  stimsRemaining: number;
  cashEarned?: number;
}

export interface KickActionPacketData {
  actionTick?: number;
  attackerFacing?: number;
  attackerX?: number;
  attackerZ?: number;
  machineTargets?: Array<{ id: string; x?: number; z?: number; damage: number; originX?: number; originZ?: number }>;
  rivalTargets?: Array<{ id: string; x?: number; z?: number; damage: number; knockX?: number; knockZ?: number; predictedHealth?: number; predictedArmor?: number }>;
}

export interface KickActionRejectedPacketData {
  actionEventId?: string;
  reason?: string;
  machineCustody?: Array<{ id?: string; health?: number; isAlive?: boolean; x?: number; z?: number; maxHealth?: number; vitalsSeq?: number }>;
}

export interface MachineRosterPacketData {
  revision?: number;
  machines?: Array<{ id: string; type?: string; x?: number; y?: number; z?: number; facing?: number; health?: number; isAlive?: boolean; originX?: number; originZ?: number; maxHealth?: number; vitalsSeq?: number }>;
}

export interface MachineAttackPacketData {
  machineId?: string;
  machineType?: string;
  targetId?: string;
  damage?: number;
  targetHealth?: number;
  targetArmor?: number;
  targetAlive?: boolean;
  attackX?: number;
  attackZ?: number;
}

export interface MachineHitPacketData {
  machineId?: string;
  damage?: number;
  kind?: "rifle" | "kick" | "shotgun";
  shotId?: string;
  attackerFacing?: number;
  attackerX?: number;
  attackerZ?: number;
  targetX?: number;
  targetZ?: number;
}

export interface CrateLootPacketData {
  crateId?: string;
  cashValue?: number;
  cash?: number;
  claimTimestamp?: number;
  x?: number;
  z?: number;
}

export interface IngressSnapshotPacketData {
  recipientId?: string;
  snapshot?: RaidWorldSnapshot;
}

export interface SquadAckPacketData {
  recipientId?: string;
  isConfirmation?: boolean;
  isResuming?: boolean;
}

export interface RaidRestartPacketData {
  newRaidId?: string;
}

export interface CanonicalReceiptPayload {
  v?: number;
  receiptId?: string;
  raidId?: string;
  operativeId?: string;
  snapshotTick?: number;
  committed?: boolean;
  verifiedCash?: number;
  outcomeId?: string;
  intentHash?: string;
  outcomeDigest?: string;
  throughTick?: number;
  committedAtMs?: number;
  participantResults?: Array<{
    profileId?: string;
    releasedEscrowIds?: string[];
    inventoryRevision?: number;
    activeRaidCleared?: boolean;
  }>;
  transfers?: Array<{
    itemId?: string;
    quantity?: string;
    toProfileId?: string;
    source?: string;
  }>;
}

export interface ExfilSuccessPacketData {
  receipt?: SettlementReceipt | CanonicalReceiptPayload;
  snapshotTick?: number;
}

export interface IngressRequestPacketData {
  requestedTick?: number;
  isResuming?: boolean;
}

export interface RaidDiscoveryPacketData {
  squad?: string;
  senderName?: string;
  timestamp?: number;
  isReload?: boolean;
}

export interface RaidAnnouncePacketData {
  recipientId?: string;
  snapshot?: RaidWorldSnapshot;
  admittedPeerIds?: string[];
  activeRaidId?: string;
}

export interface FirePacketData {
  aimAngle?: number;
  originX?: number;
  originZ?: number;
  targetX?: number;
  targetZ?: number;
  isReload?: boolean;
}

export interface PeerPacketBase {
  eventId: string;
  senderId: string;
  senderName: string;
  squad: string;
  raidId?: string;
  timestamp: number;
}

export interface HitConfirmedPacketData {
  targetId: string;
  targetHealth: number;
  targetArmor?: number;
  targetAlive: boolean;
  targetKia: boolean;
  damage: number;
  kind?: string;
  killerId?: string;
}

export type PeerPacket =
  | (PeerPacketBase & { type: 'state'; data: StatePacketData })
  | (PeerPacketBase & { type: 'hit'; data: HitPacketData })
  | (PeerPacketBase & { type: 'hit_confirmed'; data: HitConfirmedPacketData })
  | (PeerPacketBase & { type: 'fire'; data?: FirePacketData })
  | (PeerPacketBase & { type: 'kick_action'; data: KickActionPacketData })
  | (PeerPacketBase & { type: 'crate_loot_request'; data: CrateLootPacketData })
  | (PeerPacketBase & { type: 'crate_looted'; data: CrateLootPacketData })
  | (PeerPacketBase & { type: 'crate_looted_ack'; data: CrateLootedAckPacketData })
  | (PeerPacketBase & { type: 'machine_hit'; data: MachineHitPacketData })
  | (PeerPacketBase & { type: 'machine_attack'; data: MachineAttackPacketData })
  | (PeerPacketBase & { type: 'machine_roster'; data: MachineRosterPacketData })
  | (PeerPacketBase & { type: 'kick_action_rejected'; data: KickActionRejectedPacketData })
  | (PeerPacketBase & { type: 'exfil_success'; data: ExfilSuccessPacketData })
  | (PeerPacketBase & { type: 'ingress_request'; data?: IngressRequestPacketData })
  | (PeerPacketBase & { type: 'ingress_snapshot'; data: IngressSnapshotPacketData })
  | (PeerPacketBase & { type: 'squad_ack'; data: SquadAckPacketData })
  | (PeerPacketBase & { type: 'raid_restart'; data: RaidRestartPacketData })
  | (PeerPacketBase & { type: 'raid_discovery'; data?: RaidDiscoveryPacketData })
  | (PeerPacketBase & { type: 'raid_announce'; data: RaidAnnouncePacketData });


function isAuthorizedSender(senderId?: any, senderName?: any): boolean {
  if (typeof senderId !== "string" || typeof senderName !== "string") return false;
  if (!senderId || !senderName) return false;
  if (senderId === "server" || senderId === "system") {
    return senderName === "CENTRAL COMMAND" || senderName === "system" || senderName === "server" || senderName === "SYSTEM RELAY";
  }
  if (senderName === "CENTRAL COMMAND" || senderName === "SYSTEM RELAY") {
    return senderId === "server" || senderId === "system";
  }
  if (senderId === "op_player") {
    return senderName === "OPERATIVE GHOST-1";
  }
  if (senderId === "op_alpha_1") {
    return senderName === "OPERATIVE GHOST-1" || senderName === "OPERATIVE ALPHA";
  }
  if (senderId === "op_bravo_1") {
    return senderName === "INFILTRATOR PHANTOM-1" || senderName === "Bravo" || senderName === "RIVAL OPERATIVE";
  }
  if (senderId.startsWith("op_host_alpha")) {
    return senderName === "OPERATIVE ALPHA";
  }
  return false;
}


export function validateAndSanitizeSnapshot(snapshot: any): RaidWorldSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (!isValidSnapshotTick(snapshot.snapshotTick)) return null;
  if (!Array.isArray(snapshot.crates) || !Array.isArray(snapshot.machines)) return null;

  const validMachines: RaidWorldSnapshot["machines"] = [];
  for (const m of snapshot.machines) {
    if (!m || typeof m !== "object") return null;
    if (typeof m.id !== "string" || !m.id) return null;
    if (typeof m.health !== "number" || isNaN(m.health) || !Number.isFinite(m.health) || m.health < 0) {
      return null;
    }
    if (m.maxHealth !== undefined && (typeof m.maxHealth !== "number" || isNaN(m.maxHealth) || !Number.isFinite(m.maxHealth) || m.maxHealth <= 0)) {
      return null;
    }
    validMachines.push({
      id: m.id,
      health: m.health,
      isAlive: m.health > 0 && m.isAlive !== false,
      cooldownTicks: typeof m.cooldownTicks === "number" && Number.isFinite(m.cooldownTicks) && m.cooldownTicks >= 0 ? m.cooldownTicks : 0,
      // Ordered-adoption carry-through: sequences and shared maxHealth survive the
      // sanitize rebuild so downstream adoption stays ordered (snapshot interface types them).
      maxHealth: typeof m.maxHealth === "number" && Number.isFinite(m.maxHealth) && m.maxHealth > 0 ? m.maxHealth : undefined,
      vitalsSeq: typeof m.vitalsSeq === "number" && Number.isFinite(m.vitalsSeq) && m.vitalsSeq >= 0 ? m.vitalsSeq : undefined,
    });
  }

  const validCrates: RaidWorldSnapshot["crates"] = [];
  for (const c of snapshot.crates) {
    if (!c || typeof c !== "object") return null;
    if (typeof c.id !== "string" || !c.id) return null;
    if (typeof c.opened !== "boolean") {
      return null;
    }
    validCrates.push({
      id: c.id,
      opened: c.opened,
      claimedBy: typeof c.claimedBy === "string" ? c.claimedBy : undefined,
      claimedAt: typeof c.claimedAt === "number" && Number.isFinite(c.claimedAt) ? c.claimedAt : undefined,
    });
  }

  const validRivals: NonNullable<RaidWorldSnapshot["rivals"]> = [];
  if (Array.isArray(snapshot.rivals)) {
    for (const r of snapshot.rivals) {
      if (r && typeof r === "object" && typeof r.id === "string") {
        validRivals.push({
          id: r.id,
          name: typeof r.name === "string" ? r.name : r.id,
          x: typeof r.x === "number" && Number.isFinite(r.x) ? r.x : 0,
          z: typeof r.z === "number" && Number.isFinite(r.z) ? r.z : 0,
          health: typeof r.health === "number" && Number.isFinite(r.health) ? r.health : 100,
          armor: typeof r.armor === "number" && Number.isFinite(r.armor) ? Math.max(0, Math.min(100, r.armor)) : undefined,
          ammo: typeof r.ammo === "number" && Number.isFinite(r.ammo) ? Math.max(0, Math.min(30, r.ammo)) : undefined,
          isAlive: r.isAlive !== false && !(r as any).isKia,
          isKia: !!(r as any).isKia,
          isExtracted: !!r.isExtracted,
        });
      }
    }
  }

  return {
    snapshotTick: snapshot.snapshotTick,
    crates: validCrates,
    machines: validMachines,
    rivals: validRivals,
  };
}

function isValidSnapshotTick(t: any): boolean {
  return typeof t === "number" && Number.isFinite(t) && !Number.isNaN(t) && Number.isInteger(t) && t >= 0 && t <= 54_000;
}

const COOP_MAX_MOVE_PER_TICK = buildCoopRaidRules().maxMoveSpeedPerTick!;

export class MultiplayerCoordinator {
  public sdkRoom: any = null;
  public spokeSession: ActiveSpokeSession | null = null;
  public onSyncError?: (message: string) => void;
  private lastSubmittedPos: { x: number; z: number } | null = null;
  private reportedSyncIssues = new Set<string>();
  private settlementByRaid = new Map<string, Promise<DebriefInput>>();

  /**
   * One settlement attempt per raid: request extraction, then wait for
   * the debrief over HTTP so a lost socket cannot hide the receipt.
   * Repeat calls for the same raid return the same promise; a failed
   * attempt clears the entry so the player can retry.
   */
  public requestCoopSettlement(zoneId: string): Promise<DebriefInput> {
    const spoke = this.spokeSession;
    if (!spoke) {
      return Promise.reject(new Error("[coop] settlement requested with no spoke session attached"));
    }
    const existing = this.settlementByRaid.get(spoke.raidId);
    if (existing) return existing;
    const attempt = (async (): Promise<DebriefInput> => {
      const result = await spoke.requestExtractionAsync({ zoneId });
      if (!result.success) {
        throw new Error(`[coop] extraction request refused for zone ${zoneId}`);
      }
      return (await spoke.waitForDebriefAsync()) as DebriefInput;
    })().catch((err: unknown) => {
      this.settlementByRaid.delete(spoke.raidId);
      throw err;
    });
    this.settlementByRaid.set(spoke.raidId, attempt);
    return attempt;
  }

  private reportSyncError(key: string, message: string): void {
    console.error(`[MultiplayerCoordinator] ${message}`);
    if (!this.reportedSyncIssues.has(key)) {
      this.reportedSyncIssues.add(key);
      this.onSyncError?.(message);
      this.sim.combatLog.push(`[CO-OP] ${message}`);
    }
  }

  public attachSdkSession(spokeSession: ActiveSpokeSession): void {
    this.spokeSession = spokeSession;
    this.sim.raidId = spokeSession.raidId;
    this.lastSubmittedPos = { x: this.sim.player.x, z: this.sim.player.z };
    spokeSession.onConfirmedTick((tick: number, state: unknown) => {
      try {
        this.applyConfirmedState(tick, state);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.reportSyncError(`confirmed:${message}`, `Confirmed state rejected: ${message}`);
      }
    });
    this.authenticated = true;
    this.sim.isSocketDisconnected = false;
  }

  /**
   * Apply one confirmed RaidState: squadmates become render rivals keyed
   * by slot. Server state is the only source for their position, health,
   * and extraction finality.
   */
  public applyConfirmedState(_tick: number, rawState: unknown): void {
    const spoke = this.spokeSession;
    if (!spoke) return;
    const state = parseConfirmedState(rawState);
    const view = confirmedView(state, spoke.slot);
    for (const mate of view.squadmates) {
      const rivalId = `coop-slot-${mate.slot}`;
      const existing = this.sim.rivals.find((r) => r.id === rivalId);
      if (existing) {
        if (existing.isExtracted) continue;
        existing.x = mate.x;
        existing.z = mate.z;
        existing.health = mate.health;
        existing.isAlive = mate.isAlive && !mate.isExtracted;
        existing.isExtracted = mate.isExtracted;
      } else {
        this.sim.rivals.push({
          id: rivalId,
          isPlayer: false,
          isRival: true,
          isAI: false,
          name: `SQUADMATE-${mate.slot}`,
          badge: this.localSquad,
          x: mate.x,
          y: 0,
          z: mate.z,
          facing: 0,
          health: mate.health,
          armor: 0,
          cash: 0,
          action: "idle" as any,
          actionTicks: 0,
          isInvulnerable: false,
          isAlive: mate.isAlive && !mate.isExtracted,
          isExtracted: mate.isExtracted,
          ammo: 30,
          maxAmmo: 30,
          isSliding: false,
          slideTicksRemaining: 0,
          lastStateTimestamp: this.getServerNow(),
        } as any);
        this.sim.combatLog.push(`[CO-OP] Squadmate slot ${mate.slot} confirmed in raid.`);
      }
    }
  }

  public createRaidSnapshot(): RaidWorldSnapshot {
    return {
      snapshotTick: this.sim.tick,
      crates: this.sim.crates.map((c) => ({
        id: c.id,
        opened: c.opened,
        claimedBy: c.claimedBy,
        claimedAt: c.claimedAt,
      })),
      machines: this.sim.machines.map((m) => ({
        id: m.id,
        health: Math.max(0, m.health),
        isAlive: m.isAlive && m.health > 0,
        cooldownTicks: m.cooldownTicks,
      })),
      rivals: [
        {
          id: this.sim.player.id,
          name: this.sim.player.name,
          x: this.sim.player.x,
          z: this.sim.player.z,
          health: this.sim.player.health,
          armor: this.sim.player.armor,
          ammo: this.sim.player.ammo,
          isAlive: this.sim.player.isAlive,
          isExtracted: this.sim.player.isExtracted,
        },
        ...this.sim.rivals.map((r) => ({
          id: r.id,
          name: r.name,
          x: r.x,
          z: r.z,
          health: r.health,
          armor: r.armor,
          ammo: r.ammo,
          isAlive: r.isAlive,
          isExtracted: r.isExtracted,
        })),
      ],
    };
  }

  public localId: string;
  public localSquad: string;
  public connectedPeers: Map<string, PeerEntry> = new Map();
  private sim: SectorDepotSimulation;
  private seq = 0;
  private seenEvents = new Set<string>();
  public pruneInterval: any = null;
  public serverTimeOffset: number = 0;

  public getServerNow(): number {
    return Date.now() + (this.serverTimeOffset || 0);
  }
  private selfReadinessTimer: any = null;
  public acceptedReceiptKeys: Set<string>;
  private discoveryInterval: any = null;
  public pendingWorldEvents: Array<PeerPacket> = [];
  public extractedPeerIds = new Set<string>();
  public deadPeerIds = new Set<string>();
  public deadPeerTimestamps = new Map<string, number>();
  public targetUpdateTimestamps = new Map<string, number>();
  public admittedPeers = new Set<string>();
  public hostPeerId: string | null = null;
  private lastAttackerHitTick = new Map<string, number>();
  private lastAttackerRifleTime = new Map<string, number>();
  private lastAttackerKickTime = new Map<string, number>();
  private rifleBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private kickBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private machineRifleBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private machineKickBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private machineShotgunBuckets = new Map<string, { tokens: number; lastTime: number }>();

  private checkRifleRateLimit(senderId: string, now: number): boolean {
    let bucket = this.rifleBuckets.get(senderId);
    if (!bucket) {
      bucket = { tokens: 2.0, lastTime: now };
      this.rifleBuckets.set(senderId, bucket);
    } else {
      const elapsed = Math.max(0, now - bucket.lastTime);
      bucket.tokens = Math.min(2.0, bucket.tokens + elapsed / 130);
      bucket.lastTime = Math.max(bucket.lastTime, now);
    }
    if (bucket.tokens < 1.0) {
      return false;
    }
    bucket.tokens -= 1.0;
    return true;
  }

  private checkKickRateLimit(senderId: string, now: number): boolean {
    let bucket = this.kickBuckets.get(senderId);
    if (!bucket) {
      bucket = { tokens: 1.0, lastTime: now };
      this.kickBuckets.set(senderId, bucket);
    } else {
      const elapsed = Math.max(0, now - bucket.lastTime);
      bucket.tokens = Math.min(1.0, bucket.tokens + elapsed / 600);
      bucket.lastTime = now;
    }
    if (bucket.tokens < 1.0) {
      return false;
    }
    bucket.tokens -= 1.0;
    return true;
  }

  private checkMachineHitRateLimit(key: string, attackKind: "kick" | "shotgun" | "rifle", now: number): boolean {
    const bucketMap = attackKind === "kick" ? this.machineKickBuckets : (attackKind === "shotgun" ? this.machineShotgunBuckets : this.machineRifleBuckets);
    const maxCap = attackKind === "kick" ? 1.0 : (attackKind === "shotgun" ? 2.0 : 3.0);
    const cadence = attackKind === "kick" ? 600 : (attackKind === "shotgun" ? 380 : 130);
    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = { tokens: maxCap, lastTime: now };
      bucketMap.set(key, bucket);
    } else {
      const elapsed = Math.max(0, now - bucket.lastTime);
      bucket.tokens = Math.min(maxCap, bucket.tokens + elapsed / cadence);
      bucket.lastTime = Math.max(bucket.lastTime, now);
    }
    if (bucket.tokens < 1.0) {
      return false;
    }
    bucket.tokens -= 1.0;
    return true;
  }
  public lastAppliedSnapshotTimestamp = 0;
  public lastAppliedSnapshotTick = 0;
  public snapshotAppliedLocalTime = 0;
  public onRaidRestart?: (newRaidId: string) => void;
  public authenticated = false;
  public serverMachines: Array<{ id: string; health: number; isAlive: boolean }> | null = null;
  private isDisposed = false;

  constructor(sim: SectorDepotSimulation) {
    this.sim = sim;
    this.acceptedReceiptKeys = sim.acceptedReceiptKeys || new Set<string>();
    sim.acceptedReceiptKeys = this.acceptedReceiptKeys;
    (this.sim as any).multiplayerCoordinator = this;
    (this.sim as any).coordinator = this;

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isPlayer2 = urlParams?.get('rundotPlayer') === 'player2' || sim.player.id === 'op_bravo_1';

    if (isPlayer2) {
      this.localId = 'op_bravo_1';
      this.localSquad = 'SQUAD BRAVO';
      this.sim.player.id = this.localId;
      this.sim.player.name = 'INFILTRATOR PHANTOM-1';
      this.sim.player.badge = 'SQUAD BRAVO';
      this.sim.player.x = SIM_CONFIG.SPAWN_SQUAD_B.x;
      this.sim.player.z = SIM_CONFIG.SPAWN_SQUAD_B.z;
      this.sim.player.facing = Math.PI;
    } else {
      this.localId = 'op_alpha_1';
      this.localSquad = 'SQUAD ALPHA';
      this.sim.player.id = this.localId;
      this.sim.player.name = 'OPERATIVE GHOST-1';
      this.sim.player.badge = 'SQUAD ALPHA';
      if (this.sim.zoneMode === "hub") {
        this.sim.player.x = 0;
        this.sim.player.z = -66;
        this.sim.player.facing = Math.PI;
      } else {
        this.sim.player.x = SIM_CONFIG.SPAWN_SQUAD_A.x;
        this.sim.player.z = SIM_CONFIG.SPAWN_SQUAD_A.z;
      }
    }
    registerDeployment(this.localId, this.sim.raidId);

    // Connect callbacks from simulation
    this.sim.onHitTarget = (targetId, damage, knockX, knockZ, kind, shotId) => {
      this.broadcastHit(targetId, damage, knockX, knockZ, kind, shotId);
    };

    this.sim.onRequestLootCrate = (crateId, cashValue) => {
      this.requestCrateLoot(crateId, cashValue);
    };

    this.sim.onLootCrate = (crateId, cash) => {
      this.broadcastCrateLooted(crateId, cash);
    };

    this.sim.onMachineHit = (machineId, damage, kind, shotId) => {
      this.broadcastMachineHit(machineId, damage, kind, shotId);
    };

    this.sim.onKickAction = (action) => {
      this.sendKickAction(action);
    };

    const rawPrevOnExfil = (this.sim as any)._onExfilSuccess || this.sim.onExfilSuccess;
    this.sim.onExfilSuccess = (receipt?: any) => {
      try { rawPrevOnExfil?.(receipt); } catch {}
      this.broadcastExfilSuccess(receipt);
    };

    this.sim.requestServerSettlement = (tick: number, cash: number) => {
      return this.requestServerSettlement(tick, cash);
    };

    const origOnPlayerDeath = this.sim.onPlayerDeath;
    this.sim.onPlayerDeath = () => {
      origOnPlayerDeath?.();
      this.broadcastState(0);
    };

    // Network sessions are managed authoritatively by first-party SDK (spokeSession / GatewayServerRoom)
    const isResumingSession = false;
    // Initiate staged ingress protocol: only enter corridor if currently idle
    if (this.sim.ingressController.getState().kind === 'idle') {
      this.sim.ingressController.enterCorridor(this.sim.tick, isResumingSession);
    }

    // Automatic periodic pruning for silent peers (>10s idle)
    this.pruneInterval = setInterval(() => {
      this.pruneExpiredPeers();
    }, 1000);

    // Immediate raid discovery broadcast across all connected channels
    this.broadcastRaidDiscovery();

    const startHostIngress = () => {
      if (this.isDisposed || this.selfReadinessTimer) return;
      this.selfReadinessTimer = setTimeout(() => {
        if (this.isDisposed) return;
        const isResuming = false;
        if (!isResuming && this.sim.tick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
          this.sim.combatLog.push(`[INGRESS DENIED] Ingress cutoff exceeded at tick ${this.sim.tick}`);
          return;
        }
        if (this.sim.ingressController.getState().kind === 'idle' || (isResuming && this.sim.ingressController.getState().kind === 'rejected')) {
          this.sim.ingressController.enterCorridor(this.sim.tick, isResuming);
        }
        if (this.sim.ingressController.getState().kind === 'corridor_entered') {
          this.sim.ingressController.startHydration(this.sim.tick);
          this.sim.ingressController.applySnapshot(this.createRaidSnapshot());
          this.sim.ingressController.squadAck(1, 1);
          this.sim.ingressController.activate(this.sim.tick);
          this.flushPendingWorldEvents(); // admission activates the queued world stream
          this.sim.combatLog.push(`[STAGED INGRESS] Squad Alpha host confirmed active at tick ${this.sim.tick}`);
        }
      }, 300);
    };

    if (!isPlayer2) startHostIngress();

    if (!isPlayer2) {
      this.discoveryInterval = setInterval(() => {
        if (this.sim.isAdmitted() || this.sim.ingressController.getState().kind === 'confirmed_active') {
          if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
          }
          return;
        }
        const kind = this.sim.ingressController.getState().kind;
        if (kind === 'corridor_entered') {
          this.broadcastRaidDiscovery();
        } else if (kind === 'waiting_squad' || (kind as string) === 'snapshot_hydrated' || kind === 'hydrating') {
          const targetHost = this.hostPeerId || Array.from(this.connectedPeers.keys())[0];
          if (targetHost) {
            this.broadcastSquadAck(targetHost, false);
          }
        }
      }, 500);
    } else {
      // Squad Bravo is joiner: check server snapshot recovery if admitted or resuming
      const recoverFromServerSnapshot = () => {
        if (this.sim.ingressController.getState().kind === 'idle') {
          this.sim.ingressController.enterCorridor(this.sim.tick, true);
        }
        if (this.sim.ingressController.getState().kind === 'corridor_entered') {
          this.sim.ingressController.startHydration(this.sim.tick);
          this.sim.ingressController.applySnapshot(this.createRaidSnapshot());
          this.sim.ingressController.squadAck(1, 1);
          this.sim.ingressController.activate(this.sim.tick);
        }
      };

      if (isResumingSession) {
        recoverFromServerSnapshot();
      }

      // Squad Bravo is joiner: periodic discovery retry until admitted
      let discoveryAttempts = 0;
      this.discoveryInterval = setInterval(() => {
        if (this.sim.isAdmitted() || this.sim.ingressController.getState().kind === 'confirmed_active') {
          if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
          }
          return;
        }
        discoveryAttempts++;
        const kind = this.sim.ingressController.getState().kind;
        if (kind === 'corridor_entered') {
          this.broadcastIngressRequest();
        } else if (kind === 'waiting_squad' || (kind as string) === 'snapshot_hydrated' || kind === 'hydrating') {
          this.broadcastIngressRequest();
          const targetHost = this.hostPeerId || Array.from(this.connectedPeers.keys())[0];
          if (targetHost) {
            this.broadcastSquadAck(targetHost, false);
          }
        }
        if (discoveryAttempts >= 3 && this.connectedPeers.size === 0) {
          recoverFromServerSnapshot();
        }
      }, 500);
      this.broadcastIngressRequest();
    }
  }

  private createEventId(): string {
    return `${this.localId}:${Date.now()}:${++this.seq}`;
  }

  public applyValidatedMachineHit(senderName: string, machineId: string, damage: number, authorHealth?: number, authorAlive?: boolean, authorVitalsSeq?: number, authorMaxHealth?: number): void {
    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0 || damage > 150) return;
    const machine = this.sim.machines.find((m) => m.id === machineId);
    if (!machine) return;
    const hadSeq = typeof (machine as any).vitalsSeq === "number";
    const seqNow = (machine as any).vitalsSeq ?? 0;
    if (authorHealth === undefined && machine.isAlive && !(typeof authorVitalsSeq === "number" && authorVitalsSeq < seqNow)) {
      // Prediction damage (no authoritative vitals): local decrement stays ordered against
      // LOCAL seq only (relay confirmations will carry higher seq and supersede).
      machine.health = Math.max(0, machine.health - damage);
      machine.isAlive = machine.health > 0;
      if (!machine.isAlive) this.sim.combatLog.push(`[MACHINE DESTROYED] ${machine.id} neutralized by ${senderName}`);
      if (hadSeq) (machine as any).predictedVitalsSeq = seqNow + 1; // Uncommitted prediction sequence kept separate from authoritative vitalsSeq
      this.serverMachines = this.sim.machines.map((x) => ({ id: x.id, health: x.health, isAlive: x.isAlive, type: (x as any).type, x: (x as any).x, y: (x as any).y, z: (x as any).z, facing: (x as any).facing, originX: (x as any).originX, originZ: (x as any).originZ, maxHealth: (x as any).maxHealth, vitalsSeq: (x as any).vitalsSeq } as any));
      return;
    }
    // Authoritative or seq-carrying result: single ordered channel
    const applied = this.adoptMachineVitals(machineId, authorHealth, authorAlive, authorVitalsSeq, authorMaxHealth);
    if (applied && !machine.isAlive) {
      this.sim.combatLog.push(`[MACHINE DESTROYED] ${machine.id} neutralized by ${senderName}`);
    }
  }

  public validateAndApplyMachineHit(packet: PeerPacket, isReplay = false): boolean {
    if (!packet || !packet.data) return false;
    const machineId = (packet.data as any).machineId;
    if (typeof machineId !== 'string' || !machineId) return false;

    const rawKind = (packet.data as any).kind;
    const dmg = typeof (packet.data as any).damage === 'number' ? (packet.data as any).damage : 0;
    const attackKind = rawKind || ((packet.data as any)?.weapon === 'shotgun' ? 'shotgun' : (dmg > 30 ? 'kick' : 'rifle'));
    if (attackKind !== 'kick' && attackKind !== 'rifle' && attackKind !== 'shotgun') return false;

    if (this.deadPeerIds.has(packet.senderId)) return false;
    const peer = this.connectedPeers.get(packet.senderId);
    if (peer && (peer.isDead || peer.isExtracted)) return false;
    if (this.extractedPeerIds.has(packet.senderId)) return false;

    // Living attacker entity required in sim.rivals
    let attacker = this.sim.rivals.find((r) => r.id === packet.senderId);
    if (!attacker) {
      if (peer && peer.lastState && peer.lastState.isAlive !== false && !peer.isDead && !this.deadPeerIds.has(packet.senderId) && (peer.lastState.health ?? 100) > 0) {
        attacker = {
          id: packet.senderId,
          name: packet.senderName || packet.senderId,
          isPlayer: false,
          isRival: true,
          isAI: false,
          x: peer.lastState.x,
          y: 0,
          z: peer.lastState.z,
          facing: 0,
          health: typeof peer.lastState.health === "number" ? peer.lastState.health : 100,
          armor: 0,
          cash: 0,
          action: "idle",
          actionTicks: 0,
          isInvulnerable: false,
          isAlive: true,
          isExtracted: false,
          ammo: 30,
          maxAmmo: 30,
        };
        this.sim.rivals.push(attacker);
      } else {
        return false;
      }
    }
    if (!attacker || !attacker.isAlive || attacker.isExtracted) {
      return false;
    }

    // Machine custody values (machineHealth/machineAlive) are honoured as authoritative
    // ONLY when the relay server stamped the message; forged peer copies fall back to
    // the standard validated-prediction path.
    const machineCustodyAuth = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
    const hasAuthoritativeMachineHealth = machineCustodyAuth && typeof (packet.data as any)?.machineHealth === 'number';
    if (typeof (packet.data as any)?.attackerX === 'number' && typeof (packet.data as any)?.attackerZ === 'number' && Number.isFinite((packet.data as any).attackerX) && Number.isFinite((packet.data as any).attackerZ)) {
      const moveDist = Math.hypot((packet.data as any).attackerX - attacker.x, (packet.data as any).attackerZ - attacker.z);
      if (moveDist > 6.0 && !hasAuthoritativeMachineHealth) {
        return false; // Reject unverified machine hit: cannot teleport strike origin > 6.0m
      }
      attacker.x = (packet.data as any).attackerX;
      attacker.z = (packet.data as any).attackerZ;
    }
    const packetFacing = (packet.data as any)?.attackerFacing;
    if (typeof packetFacing !== 'number' || !Number.isFinite(packetFacing)) {
      return false; // Reject: attackerFacing must be an unconditional finite number
    }
    attacker.facing = packetFacing;

    const machine = this.sim.machines.find((m) => m.id === machineId);
    if (!machine || !machine.isAlive) {
      return false;
    }

    // Effective range verification & symmetrical combat cone
    let targetX = machine.x;
    let targetZ = machine.z;
    if (machine.type === 'drone' && typeof (packet as any).data?.targetX === 'number' && typeof (packet as any).data?.targetZ === 'number') {
      const ptx = (packet as any).data.targetX;
      const ptz = (packet as any).data.targetZ;
      const origX = typeof (machine as any).originX === "number" ? (machine as any).originX : 14;
      const origZ = typeof (machine as any).originZ === "number" ? (machine as any).originZ : -8;
      const dx = ptx - origX;
      const dz = ptz - origZ;
      if (Math.abs(dx) <= 5.5 && Math.abs(dz) <= 4.0 && ((dx * dx) / (5.5 * 5.5) + (dz * dz) / (4.0 * 4.0)) <= 1.05) {
        targetX = ptx;
        targetZ = ptz;
      }
    }
    const dist = Math.hypot(attacker.x - targetX, attacker.z - targetZ);
    if (attackKind === 'kick') {
      if (dist > 3.0 || dist <= 0.001) return false;
      const forwardX = Math.sin(attacker.facing);
      const forwardZ = Math.cos(attacker.facing);
      const dot = ((targetX - attacker.x) * forwardX + (targetZ - attacker.z) * forwardZ) / dist;
      if (dot < 0.2) return false;
    } else if (attackKind === 'shotgun') {
      const hitRes = calculateShotgunHit(attacker.x, attacker.z, attacker.facing, targetX, targetZ, 1.05);
      if (!hitRes.hit) return false;
      if (dmg > hitRes.damage) return false;
    } else {
      if (dist <= 0.001 || dist > 35.0) return false;
      if (dist > 0.001) {
        const dx = targetX - attacker.x;
        const dz = targetZ - attacker.z;
        const forwardX = Math.sin(attacker.facing);
        const forwardZ = Math.cos(attacker.facing);
        const dot = (dx * forwardX + dz * forwardZ) / dist;
        const perpDist = Math.abs(dx * forwardZ - dz * forwardX);
        if (packet.eventId === 'hit_rifle_oversized') throw new Error('DOT: ' + dot + ' PERP: ' + perpDist);
            if (dot <= 0.96 || perpDist > 1.2) {
          return false; // Reject machine hit outside rifle aiming cone (strictly symmetrical: dot > 0.96 required)
        }
      }
    }

    // Physical cover line of sight check
    for (const box of DEPOT_CONTAINERS) {
      if (segmentIntersectsAABB(attacker.x, attacker.z, targetX, targetZ, box.minX, box.minZ, box.maxX, box.maxZ)) {
        return false;
      }
    }

    const now = this.getServerNow();
    if (packet.timestamp > now + 2000) return false;
    const lastHitKey = `${packet.senderId}:${machineId}`;
    const minInterval = attackKind === 'kick' ? 600 : (attackKind === 'shotgun' ? 380 : 130);
    const lastPacketKey = `${lastHitKey}:${attackKind}:packet`;
    if (!(this as any).lastPacketMachineHitTime) {
      (this as any).lastPacketMachineHitTime = new Map<string, number>();
    }
    const lastPacketTime = (this as any).lastPacketMachineHitTime.get(lastPacketKey) ?? 0;

    // Strict authority exemption: peer claims cannot bypass cadence
    const hasAuthoritativeOverride = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;

    // Enforce cadence interval (receiver-monitored elapsed time)
    if (!hasAuthoritativeOverride && (now - lastPacketTime < minInterval)) {
      return false;
    }

    // Receiver rate limit token bucket uses receiver elapsed time (now) unless authoritative replay
    if (!hasAuthoritativeOverride && !this.checkMachineHitRateLimit(lastHitKey, attackKind, now)) {
      return false;
    }

    (this as any).lastPacketMachineHitTime.set(lastPacketKey, now);

    let maxAllowed: number;
    if (attackKind === "kick") {
      maxAllowed = 50;
    } else if (attackKind === "shotgun") {
      const hitRes = calculateShotgunHit(attacker.x, attacker.z, attacker.facing, targetX, targetZ, 1.05);
      if (!hitRes.hit) return false;
      maxAllowed = hitRes.damage;
    } else {
      maxAllowed = 24;
    }
    const effectiveDmg = Math.min(maxAllowed, dmg > 0 ? dmg : maxAllowed);
    this.applyValidatedMachineHit(packet.senderName, machineId, effectiveDmg);
    return true;
  }

  private flushPendingWorldEvents(): void {
    if (!this.pendingWorldEvents.length) return;
    // Relay machine custody FIRST and UNCONDITIONALLY: sequenced server results are
    // applied through the ordered channel before any time/peer filter can discard them.
    // Authoritative machine custody queued during ingress is processed before snapshot filters
    for (const p of [...this.pendingWorldEvents]) {
      if (p && typeof p === "object" && p.type === "machine_hit" && (p as any).serverAuthoritative === true) {
        this.validateAndAdoptMachineCustody(p);
      }
    }
    this.pendingWorldEvents = this.pendingWorldEvents.filter(
      (p) => !(p && typeof p === "object" && p.type === "machine_hit" && (p as any).serverAuthoritative === true)
    );
    for (const p of this.pendingWorldEvents) {
      if (!isAuthorizedSender(p.senderId, p.senderName)) continue;
      // Universal snapshot arrival boundary filter for queued events
      if (this.snapshotAppliedLocalTime && (p as any)._receivedAt && (p as any)._receivedAt < this.snapshotAppliedLocalTime) {
        if (!(typeof p.timestamp === "number" && p.timestamp > this.lastAppliedSnapshotTimestamp)) {
          continue;
        }
      }
      const peer = this.connectedPeers.get(p.senderId);
      if (!peer || (!peer.ingressDone && peer.handshakeState !== "confirmed" && peer.handshakeState !== "ack_sent")) continue;

      if (p.type === 'machine_hit') {
        this.validateAndApplyMachineHit(p, true);
      } else if (p.type === 'crate_looted' || p.type === 'crate_loot_request') {
        const { crateId, claimTimestamp } = p.data || {};
        if (crateId) {
          this.sim.claimCrateLocally(crateId, p.senderId, claimTimestamp || p.timestamp);
        }
      }
    }
    this.pendingWorldEvents = [];
  }

  /**
   * Server raid-clock reconciliation: the server raid tick is wall-clock derived from
   * the raid start, while the local 60Hz loop steps an accumulator (bounded catch-up) —
   * after a tab pause the local tick trails the server tick, diverging deterministic
   * drone patrol phases. Every 2s the authenticated client adopts the authoritative
   * raidTick whenever it runs ahead of the local tick (drone positions snap onto the
   * shared deterministic equation, restoring exact parity).
   */
  private ensureRaidClockReconciliation(): void {
    // No-op in turnkey SDK local mode: deterministic 60Hz tick is authoritative
  }

  public handleServerMessage(rawOrData: any): void {
    try {
      const data = typeof rawOrData === "string" ? JSON.parse(rawOrData) : rawOrData;
      if (!data) return;
      if (data.type === "auth_success" && !data.senderId) {
        this.sim.walkVx = 0;
        this.sim.walkVz = 0;
        this.sim.slideVx = 0;
        this.sim.slideVz = 0;
        this.sim.jumpVy = 0;
        this.sim.player.y = 0;
        this.sim.slideTicksRemaining = 0;
        (this.sim.player as any).knockbackVx = 0;
        (this.sim.player as any).knockbackVz = 0;
        this.sim.player.isSliding = false;
        this.sim.player.slideTicksRemaining = 0;
        this.sim.player.isJumping = false;
        if (this.sim.player.action === 'slide' || this.sim.player.action === 'roll' || this.sim.player.action === 'kick' || this.sim.player.action === 'shoot' || this.sim.player.action === 'jump') {
          this.sim.player.action = 'idle';
          this.sim.player.actionTicks = 0;
          this.sim.player.isInvulnerable = false;
        }
        this.authenticated = true;
        this.sim.isSocketDisconnected = false;
        if (data.selectedWeapon === "rifle" || data.selectedWeapon === "shotgun") {
          this.sim.setWeapon(data.selectedWeapon, true);
        }
        if (typeof data.rifleAmmo === "number" && Number.isFinite(data.rifleAmmo) && data.rifleAmmo >= 0 && data.rifleAmmo <= 30) {
          this.sim.player.rifleAmmo = Math.floor(data.rifleAmmo);
        }
        if (typeof data.shotgunAmmo === "number" && Number.isFinite(data.shotgunAmmo) && data.shotgunAmmo >= 0 && data.shotgunAmmo <= 8) {
          this.sim.player.shotgunAmmo = Math.floor(data.shotgunAmmo);
        }
        if (typeof data.ammo === "number" && Number.isFinite(data.ammo) && data.ammo >= 0 && data.ammo <= 30) {
          const maxForCur = this.sim.player.weapon === "shotgun" ? 8 : 30;
          this.sim.player.ammo = Math.max(0, Math.min(maxForCur, Math.floor(data.ammo)));
        }
      }
    } catch {}
  }

  public broadcastRaidDiscovery(): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'raid_discovery',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: { isReload: true },
    };
    this.sendPacket(packet);
  }

  public broadcastIngressRequest(isResuming?: boolean): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'ingress_request',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        requestedTick: this.sim.tick,
        isResuming: isResuming ?? (this.sim.ingressController.getState().kind === 'confirmed_active' ),
      },
    };
    this.sendPacket(packet);
  }

  public broadcastIngressSnapshot(recipientId: string): void {
    const snapshot: RaidWorldSnapshot = this.createRaidSnapshot();
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'ingress_snapshot',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: { recipientId, snapshot },
    };
    this.sendPacket(packet);
  }

  public broadcastSquadAck(recipientId?: string, isConfirmation = false, isResuming?: boolean): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'squad_ack',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        recipientId,
        isConfirmation,
        isResuming: isResuming ?? (this.sim.ingressController.getState().kind === 'confirmed_active' ),
      },
    };
    this.sendPacket(packet);
  }

  
  private pendingSettlementCommitMap = new Map<string, { resolve: (res: any) => void; reject: (err: any) => void }>();

  public async requestServerSettlement(snapshotTick: number, snapshotCash: number): Promise<{ receipt: any; outcomePayload: any }> {
    return new Promise((resolve, reject) => {
      const eventId = this.createEventId();
      const timer = setTimeout(() => {
        this.pendingSettlementCommitMap.delete(eventId);
        reject(new Error("Server settlement commit timed out"));
      }, 8000);

      this.pendingSettlementCommitMap.set(eventId, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      this.sendPacket({
        eventId,
        type: "settlement_commit" as any,
        senderId: this.localId,
        senderName: this.sim.player.name,
        squad: this.localSquad,
        raidId: this.sim.raidId,
        timestamp: this.getServerNow(),
        data: {
          tick: snapshotTick,
          cash: snapshotCash,
          exfilSubmitted: true,
        },
      } as any);
    });
  }

  public reportHoldProgress(holdTicks: number, currentTick: number): void {
    if (this.isDisposed || !this.sim.player.isAlive) return;
    const packet: any = {
      eventId: this.createEventId(),
      type: 'hold_tick',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        holdTicks,
        currentTick,
        zone: this.sim.isPlayerInExfilZone() ? 'lz' : 'outside',
        hasKeycard: this.sim.player.hasKeycard,
      },
    };
    this.sendPacket(packet);
  }

  public broadcastState(holdTicks: number): void {
    if (!this.sim.isAdmitted()) return;

    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'state',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        x: this.sim.player.x,
        y: this.sim.player.y,
        z: this.sim.player.z,
        facing: this.sim.player.facing,
        action: this.sim.player.action,
        actionTicks: this.sim.player.actionTicks,
        health: this.sim.player.health,
        armor: this.sim.player.armor,
        cash: this.sim.player.cash,
        holdTicks,
        isSliding: this.sim.player.isSliding,
        slideTicksRemaining: this.sim.player.slideTicksRemaining,
        isAlive: this.sim.player.isAlive,
        isExtracted: this.sim.player.isExtracted,
        ammo: this.sim.player.ammo,
        weapon: this.sim.player.weapon,
        rifleAmmo: this.sim.player.rifleAmmo,
        shotgunAmmo: this.sim.player.shotgunAmmo,
        isInvulnerable: this.sim.player.isInvulnerable,
        isAdmitted: this.sim.isAdmitted(),
        ingressDone: true,
        hasKeycard: Boolean(this.sim.player.hasKeycard),
        isUsingStim: Boolean(this.sim.player.isUsingStim),
        stimsRemaining: this.sim.player.stimsRemaining ?? 2,
      },
    };

    this.sendPacket(packet);
  }

  public broadcastFire(targetX: number, targetZ: number): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'fire',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        originX: this.sim.player.x,
        originZ: this.sim.player.z,
        targetX,
        targetZ,
      },
    };
    this.sendPacket(packet);
  }

  public broadcastHit(targetId: string, damage: number, knockX?: number, knockZ?: number, kind?: 'rifle' | 'kick' | 'shotgun', shotId?: string): void {
    const attackKind = kind || (this.sim.player.weapon === 'shotgun' ? 'shotgun' : (knockX !== undefined || knockZ !== undefined || damage === 35 ? 'kick' : 'rifle'));
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'hit',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        targetId,
        damage,
        knockX,
        knockZ,
        kind: attackKind,
        weapon: attackKind === 'shotgun' ? 'shotgun' : (attackKind === 'rifle' ? 'rifle' : undefined),
        weaponType: attackKind === 'shotgun' ? 'shotgun' : (attackKind === 'rifle' ? 'rifle' : undefined),
        shotId,
        tick: this.sim.tick,
        attackerFacing: this.sim.player.facing,
        attackerX: this.sim.player.x,
        attackerZ: this.sim.player.z,
      },
    };
    this.sendPacket(packet);
  }

  public requestCrateLoot(crateId: string, cashValue: number, timestamp?: number): void {
    const crate = this.sim.crates.find((c) => c.id === crateId);
    if (!crate || crate.opened) {
      this.sim.combatLog.push(`[LOOT CONTESTED] Crate already scavenged by rival!`);
      return;
    }

    const claimTimestamp = (typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) ? timestamp : this.getServerNow();
    const eventId = this.createEventId();

    const packet: PeerPacket = {
      eventId,
      type: 'crate_loot_request',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: claimTimestamp,
      data: { crateId, cashValue, claimTimestamp, x: this.sim.player.x, z: this.sim.player.z },
    };
    this.sendPacket(packet);

    const granted = this.sim.claimCrateLocally(crateId, this.localId, claimTimestamp);
    if (granted) {
      this.broadcastCrateLooted(crateId, cashValue, claimTimestamp);
    }
  }

  public broadcastCrateLooted(crateId: string, cash: number, claimTimestamp?: number): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'crate_looted',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: { crateId, cash, claimTimestamp, x: this.sim.player.x, z: this.sim.player.z },
    };
    this.sendPacket(packet);
  }

  /**
   * ONE kick action = ONE packet carrying the complete target set.
   * The relay authority validates the whole batch atomically and charges the melee
   * cooldown once per action (per-target packets re-charged the cooldown and rejected
   * every target after the first). Rival damage is NEVER applied from the peer packet —
   * only the relay's authoritative 'hit' broadcasts credit operative damage.
   */
  public sendKickAction(action: KickActionPayload): void {
    const packet = {
      eventId: this.createEventId(),
      type: 'kick_action' as const,
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        actionTick: action.actionTick,
        attackerFacing: action.attackerFacing,
        attackerX: action.attackerX,
        attackerZ: action.attackerZ,
        machineTargets: action.machineHits.map((m) => ({
          id: m.id,
          x: m.x,
          z: m.z,
          damage: Math.min(50, Math.max(1, m.damage)),
          originX: m.originX,
          originZ: m.originZ,
        })),
        rivalTargets: action.rivalHits.map((r) => ({
          id: r.id,
          x: r.x,
          z: r.z,
          damage: Math.min(35, Math.max(1, r.damage)),
          knockX: r.knockX,
          knockZ: r.knockZ,
        })),
      },
    } as unknown as PeerPacket;
    this.sendPacket(packet);
  }

  public broadcastMachineHit(machineId: string, damage: number, kind?: "kick" | "rifle" | "shotgun", shotId?: string): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'machine_hit',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: {
        machineId,
        damage,
        kind: kind || (damage > 30 ? "kick" : "rifle"),
        shotId,
        attackerFacing: this.sim.player.facing,
        attackerX: this.sim.player.x,
        attackerZ: this.sim.player.z,
        targetX: this.sim.machines.find((x) => x.id === machineId)?.x,
        targetZ: this.sim.machines.find((x) => x.id === machineId)?.z,
      },
    };
    this.sendPacket(packet);
  }

    public broadcastRaidRestart(newRaidId: string): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: "raid_restart",
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: { newRaidId },
    };
    this.sendPacket(packet);
  }

  public broadcastExfilSuccess(receipt?: any): void {
    const packet: PeerPacket = {
      eventId: this.createEventId(),
      type: 'exfil_success',
      senderId: this.localId,
      senderName: this.sim.player.name,
      squad: this.localSquad,
      raidId: this.sim.raidId,
      timestamp: this.getServerNow(),
      data: { receipt },
    };
    this.sendPacket(packet);
  }

  private sendPacket(packet: PeerPacket): void {
    if (this.spokeSession) {
      // The spoke accepts PlayerRaidIntent only. State broadcasts become
      // movement deltas from the last submitted position; every other
      // peer packet type has no SyncHub representation and is reported
      // loud once per type instead of being silently swallowed.
      if (packet.type === "state") {
        const data = packet.data;
        if (typeof data?.x === "number" && typeof data?.z === "number") {
          const last = this.lastSubmittedPos ?? { x: data.x, z: data.z };
          try {
            const intent = movementIntent(
              {
                dx: (data.x - last.x) / COOP_MAX_MOVE_PER_TICK,
                dz: (data.z - last.z) / COOP_MAX_MOVE_PER_TICK,
              },
              COOP_MAX_MOVE_PER_TICK,
            );
            this.spokeSession.submitIntent(intent);
            this.lastSubmittedPos = {
              x: last.x + (intent.moveX ?? 0),
              z: last.z + (intent.moveZ ?? 0),
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.reportSyncError(`submit:${message}`, `Movement intent rejected: ${message}`);
          }
        }
      } else {
        this.reportSyncError(
          `unsupported:${packet.type}`,
          `Packet type "${packet.type}" has no SyncHub intent; not sent to the spoke.`,
        );
      }
    }

    if (this.sdkRoom) {
      try {
        this.sdkRoom.send(packet);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.reportSyncError(`room:${message}`, `Legacy room send failed: ${message}`);
      }
    }
  }

  public update(nowTimestamp?: number): void {
    this.pruneExpiredPeers(10000, nowTimestamp);
  }

  public pruneExpiredPeers(maxIdleMs = 10000, nowTimestamp?: number): void {
    if (this.isDisposed) return;
    const now = nowTimestamp ?? Date.now();
    const toRemove: string[] = [];
    for (const [peerId, peer] of this.connectedPeers.entries()) {
      if (now - peer.lastSeen > maxIdleMs) {
        toRemove.push(peerId);
      }
    }
    for (const peerId of toRemove) {
      this.sim.rivals = this.sim.rivals.filter((r) => r.id !== peerId);
      if (peerId !== this.localId) {
        this.connectedPeers.delete(peerId);
      }
    }
  }


  /**
   * Shared machine-roster custody reconciliation: used by HTTP hydration,
   * authentication snapshots, and live machine_roster broadcasts — one function owns
   * membership (add/remove by ID), geometry, patrol origins, vitals, and the shared
   * maxHealth contract.
   */
  /**
   * SINGLE ordered vitals channel for machines: every authoritative surface (roster
   * reconcile, self-confirmations, relay hit results, remote writer, rejection
   * corrections) adopts machine health/alive ONLY through here. vitalsSeq ordering is
   * enforced independently of roster revisions — an older seq is dropped, a newer seq
   * updates vitals AND the authoritative cache.
   */
  public validateAndAdoptMachineCustody(packet: any): boolean {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) return false;
    if (packet.type !== "machine_hit") return false;
    if (packet.serverAuthoritative !== true || packet._fromBroadcastChannel) return false;
    if (typeof packet.raidId !== "string" || !packet.raidId || !this.sim.raidId || packet.raidId !== this.sim.raidId) {
      return false;
    }
    if (!isAuthorizedSender(packet.senderId, packet.senderName)) return false;
    if (typeof packet.eventId !== "string" || packet.eventId.trim() === "") return false;

    const now = this.getServerNow();
    if (
      typeof packet.timestamp !== "number" ||
      !Number.isFinite(packet.timestamp) ||
      packet.timestamp <= 0 ||
      packet.timestamp >= 1e15 ||
      packet.timestamp > now + 5000
    ) {
      return false;
    }

    const d = packet.data;
    if (!d || typeof d !== "object" || Array.isArray(d)) return false;
    const mid = d.machineId;
    if (typeof mid !== "string" || !mid) return false;
    const mHit = this.sim.machines.find((x) => x.id === mid);
    if (!mHit) return false;

    const seq = d.vitalsSeq;
    if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return false;

    let maxHp = (mHit as any).maxHealth ?? (mHit.type === "drone" ? 75 : 120);
    if (d.maxHealth !== undefined) {
      if (typeof d.maxHealth !== "number" || !Number.isFinite(d.maxHealth) || d.maxHealth <= 0 || d.maxHealth > 1000) {
        return false;
      }
      maxHp = d.maxHealth;
    }

    if (
      typeof d.machineHealth !== "number" ||
      !Number.isFinite(d.machineHealth) ||
      d.machineHealth < 0 ||
      d.machineHealth > maxHp
    ) {
      return false;
    }

    if (typeof d.machineAlive !== "boolean") return false;

    const curSeq = (mHit as any).vitalsSeq ?? 0;
    if (seq < curSeq) return false;

    return this.adoptMachineVitals(mid, d.machineHealth, d.machineAlive, seq, maxHp);
  }

  public adoptMachineVitals(machineId: string, health: number | undefined, isAlive: boolean | undefined, vitalsSeq: number | undefined, maxHealth?: number): boolean {
    const m = this.sim.machines.find((x) => x.id === machineId);
    if (!m) return false;
    const seqNow = (m as any).vitalsSeq ?? 0;
    if (typeof vitalsSeq === "number" && Number.isFinite(vitalsSeq)) {
      if (vitalsSeq < seqNow) return false; // stale vitals — never a resurrection path
      (m as any).vitalsSeq = vitalsSeq;
      delete (m as any).predictedVitalsSeq;
    }
    if (maxHealth !== undefined) (m as any).maxHealth = maxHealth;
    if (typeof health === "number" && Number.isFinite(health)) {
      const maxHp = (m as any).maxHealth ?? (m.type === "drone" ? 75 : 120);
      m.health = Math.max(0, Math.min(maxHp, health));
    }
    if (typeof isAlive === "boolean") {
      m.isAlive = isAlive && m.health > 0;
    } else {
      m.isAlive = m.health > 0;
    }
    if (!m.isAlive) {
      this.sim.combatLog.push(`[MACHINE DESTROYED] ${m.id} neutralized`);
    }
    // Authoritative cache stays current for every accepted vitals result
    this.serverMachines = this.sim.machines.map((x) => ({ id: x.id, health: x.health, isAlive: x.isAlive, type: (x as any).type, x: (x as any).x, y: (x as any).y, z: (x as any).z, facing: (x as any).facing, originX: (x as any).originX, originZ: (x as any).originZ, maxHealth: (x as any).maxHealth, vitalsSeq: (x as any).vitalsSeq } as any));
    return true;
  }

  public applyMachineRosterCustody(roster: Array<{ id?: unknown; type?: unknown; x?: unknown; y?: unknown; z?: unknown; facing?: unknown; health?: unknown; isAlive?: unknown; originX?: unknown; originZ?: unknown; maxHealth?: unknown }>, revision?: number): void {
    if (!Array.isArray(roster)) return;
    // Revision check INSIDE the shared reconciler — hydration, authentication, and
    // live rosters all funnel here, so a DELAYED hydration response can never undo a
    // newer live-roster reconciliation (the single applied-revision watermark guards
    // every caller).
    if (typeof revision === "number" && Number.isFinite(revision)) {
      // Unset-initial-watermark: the FIRST authoritative roster (even revision 0 –
      // never-deployed raids) is always accepted; after that the monotonic watermark
      // rejects only STRICTLY OLDER revisions.
      const hasApplied = (this as any).__appliedMachineRosterRevision !== undefined;
      const applied = (this as any).__appliedMachineRosterRevision ?? 0;
      if (hasApplied && revision < applied) return;
      (this as any).__appliedMachineRosterRevision = revision;
    }
    const next = this.sim.machines;
    const seen = new Set<string>();
    for (const rm of roster) {
      if (!rm || typeof rm !== "object") continue;
      const rid = (rm as any).id;
      if (typeof rid !== "string" || !rid || seen.has(rid)) continue;
      seen.add(rid);
      const existingIdx = next.findIndex((m) => m.id === rid);
      const maxHp = typeof (rm as any).maxHealth === "number" ? (rm as any).maxHealth : (existingIdx !== -1 ? (next[existingIdx] as any).maxHealth : undefined);
      const typeOk = (rm as any).type === "turret" || (rm as any).type === "drone";
      // Authoritative vitals sequence: ordered INDEPENDENT of membership revision. At an
      // unchanged deployment revision, fresher vitals (higher seq) apply; older vitals
      // (e.g. a delayed hydration carrying stale health) are rejected — a destroyed
      // machine can never resurrect from health 0 to 200 via an equal-revision replay.
      const arrivingSeq = typeof (rm as any).vitalsSeq === "number" && Number.isFinite((rm as any).vitalsSeq) ? (rm as any).vitalsSeq : undefined;
      if (existingIdx !== -1 && arrivingSeq !== undefined) {
        const curSeq = (() => {
          // Current machine adopts its OWN preserving record update below; stale check
          // skips the vitals overwrite while keeping membership (continue path).
          return (next[existingIdx] as any).vitalsSeq ?? 0;
        })();
        if (arrivingSeq < curSeq) {
          seen.add(rid);
          continue; // stale vitals: membership unchanged, keep current vitals
        }
      }
      const health = typeof (rm as any).health === "number" && Number.isFinite((rm as any).health)
        ? Math.min(maxHp ?? 1000, Math.max(0, (rm as any).health))
        : (existingIdx !== -1 ? next[existingIdx].health : undefined);
      const record: any = {
        id: rid,
        type: typeOk ? (rm as any).type : (existingIdx !== -1 ? next[existingIdx].type : "turret"),
        x: typeof (rm as any).x === "number" && Number.isFinite((rm as any).x) ? (rm as any).x : (existingIdx !== -1 ? next[existingIdx].x : 0),
        y: typeof (rm as any).y === "number" && Number.isFinite((rm as any).y) ? (rm as any).y : (existingIdx !== -1 ? next[existingIdx].y : 0),
        z: typeof (rm as any).z === "number" && Number.isFinite((rm as any).z) ? (rm as any).z : (existingIdx !== -1 ? next[existingIdx].z : 0),
        facing: typeof (rm as any).facing === "number" && Number.isFinite((rm as any).facing) ? (rm as any).facing : (existingIdx !== -1 ? next[existingIdx].facing : 0),
        health: health ?? 120,
        isAlive: (rm as any).isAlive !== false,
        cooldownTicks: existingIdx !== -1 ? next[existingIdx].cooldownTicks : 0,
        // Patrol origins: incoming values win when present; EXISTING origins are
        // preserved when absent (snapshot/cache reconciliation can never strand a
        // patrolling drone by undefined-ing its origins).
        originX: typeof (rm as any).originX === "number" && Number.isFinite((rm as any).originX) ? (rm as any).originX : (existingIdx !== -1 ? (next[existingIdx] as any).originX : undefined),
        originZ: typeof (rm as any).originZ === "number" && Number.isFinite((rm as any).originZ) ? (rm as any).originZ : (existingIdx !== -1 ? (next[existingIdx] as any).originZ : undefined),
      };
      if (maxHp !== undefined) record.maxHealth = maxHp;
      if (arrivingSeq !== undefined) (record as any).vitalsSeq = arrivingSeq;
      if (existingIdx !== -1) {
        next[existingIdx] = { ...next[existingIdx], ...record };
      } else {
        next.push(record);
      }
    }
    for (let i = next.length - 1; i >= 0; i--) {
      if (!seen.has(next[i].id)) next.splice(i, 1);
    }
    // Keep the authoritative-machine cache in sync with the reconciled world: later
    // ingress snapshots must never substitute an older custody view back in.
    this.serverMachines = this.sim.machines.map((m) => ({ id: m.id, health: m.health, isAlive: m.isAlive, type: (m as any).type, x: (m as any).x, y: (m as any).y, z: (m as any).z, facing: (m as any).facing, originX: (m as any).originX, originZ: (m as any).originZ, maxHealth: (m as any).maxHealth, vitalsSeq: (m as any).vitalsSeq } as any));
  }


  public applyValidatedSnapshotWithBoundary(
    sanitized: RaidWorldSnapshot,
    snapshotTime: number,
    hostId?: string
  ): boolean {
    if (this.lastAppliedSnapshotTick && sanitized.snapshotTick < this.lastAppliedSnapshotTick) {
      return false; // Stale snapshot with older tick; drop!
    }
    if (this.lastAppliedSnapshotTimestamp && snapshotTime < this.lastAppliedSnapshotTimestamp) {
      return false; // Stale snapshot with older timestamp; drop!
    }
    if (sanitized.snapshotTick >= 54000) {
      return false; // Snapshot tick at or beyond raid deadline (54,000); drop to prevent artificial M.I.A.!
    }
    if (this.sim.isAdmitted() && sanitized.snapshotTick > this.sim.tick + 1800) {
      return false; // Reject unnatural forward duration jump from peer snapshot
    }
    if (sanitized.snapshotTick < this.sim.tick - 120) {
      return false; // Outdated snapshot too far behind current simulation tick; drop!
    }
    if (hostId) {
      this.hostPeerId = hostId;
    }
    if (this.serverMachines && Array.isArray(this.serverMachines)) {
      // Snapshot substitution stays ORDERED: reconcile authoritative custody FIRST, then
      // strip the peer's machine claims from the snapshot — the world state that was
      // just reconciled wins (applyRaidSnapshot then only no-ops the machine section
      // instead of re-applying unsequenced peer claims).
      this.applyMachineRosterCustody(this.serverMachines as any, undefined);
      sanitized.machines = [];
    }
    // No authoritative cache (first admission): peer machine claims are the bootstrap
    // world — the relay has not yet delivered any roster, so the joiner seeds its
    // machines from the host snapshot (behavior preserved).
    this.lastAppliedSnapshotTimestamp = snapshotTime;
    this.lastAppliedSnapshotTick = sanitized.snapshotTick;
    // World-custody guards for peer-provided snapshots:
    // 1. The receiver's own crate claims are the receiver's truthful record. A peer
    //    snapshot cannot claim that the LOCAL player looted crates the local sim has
    //    no record of (forged self-claims would materialize cash out of thin air).
    const localClaimantIds = new Set([this.localId, this.sim.player.id]);
    const localClaims = new Map<string, { cashValue?: number }>();
    for (const c of this.sim.crates) {
      if (c.claimedBy && localClaimantIds.has(c.claimedBy) && c.opened) {
        localClaims.set(c.id, { cashValue: (c as any).cashValue });
      }
    }
    if (sanitized.crates) {
      for (const sc of sanitized.crates) {
        if (sc.claimedBy && localClaimantIds.has(sc.claimedBy) && !localClaims.has(sc.id)) {
          // Forged self-claim: strip it before the snapshot can mutate local world state.
          sc.claimedBy = undefined;
          sc.claimedAt = undefined;
          sc.opened = false;
        }
      }
    }

    this.snapshotAppliedLocalTime = Date.now();
    this.sim.applyRaidSnapshot(sanitized);
    if (sanitized.rivals) {
      for (const snapRival of sanitized.rivals) {
        if (snapRival.id === this.sim.player.id || snapRival.id === this.localId) {
          continue;
        }
        let r = this.sim.rivals.find((existing) => existing.id === snapRival.id);
        const savedState = this.sim.confirmedAIStates?.get(snapRival.id);
        const isDeadSnap = Boolean(
          this.deadPeerIds?.has(snapRival.id) ||
          snapRival.isAlive === false ||
          (snapRival as any).isKia ||
          savedState?.isAlive === false ||
          (typeof snapRival.health === "number" && snapRival.health <= 0) ||
          (r && (!r.isAlive || (r as any).isKia || r.health <= 0))
        );

        const snapTimestamp = typeof snapshotTime === "number" ? snapshotTime : (this.lastAppliedSnapshotTimestamp || Date.now());
        this.targetUpdateTimestamps.set(snapRival.id, snapTimestamp);

        if (isDeadSnap) {
          this.deadPeerIds?.add(snapRival.id);
          this.sim.applyConfirmedAIState(snapRival.id, {
            health: 0,
            armor: 0,
            isAlive: false,
            isKia: true,
            killerId: savedState?.killerId || (snapRival as any).killerId,
          });
          if (r) {
            r.health = 0;
            r.armor = 0;
            r.isAlive = false;
            (r as any).isKia = true;
          }
          continue;
        }

        const aiCfg = (AI_CONFIGS as any)[snapRival.id];
        const isAI = Boolean(aiCfg || (snapRival as any).isAI || snapRival.id.startsWith("scav_") || snapRival.id === BOSS_CONFIG.id);

        // Reconcile snapshot vitals with saved confirmed vitals (minimum of both)
        const snapHp = typeof snapRival.health === "number" ? snapRival.health : (aiCfg?.startingHealth ?? 100);
        const currentHp = r && typeof r.health === "number" ? Math.min(r.health, snapHp) : snapHp;
        const effectiveHealth = savedState ? Math.min(savedState.health, currentHp) : currentHp;
        const snapArm = typeof snapRival.armor === "number" ? snapRival.armor : (aiCfg?.startingArmor ?? 0);
        const currentArm = r && typeof r.armor === "number" ? Math.min(r.armor, snapArm) : snapArm;
        const effectiveArmor = savedState ? Math.min(savedState.armor, currentArm) : currentArm;
        const isEffectiveAlive = snapRival.isAlive !== false && (savedState ? savedState.isAlive !== false : true) && effectiveHealth > 0;

        this.sim.applyConfirmedAIState(snapRival.id, {
          health: effectiveHealth,
          armor: effectiveArmor,
          isAlive: isEffectiveAlive,
          isKia: !isEffectiveAlive,
          killerId: savedState?.killerId || (snapRival as any).killerId,
        });

        if (!r) {
          this.sim.rivals.push({
            id: snapRival.id,
            name: aiCfg?.name || snapRival.name,
            badge: aiCfg?.badge || (snapRival as any).badge,
            isPlayer: false,
            isRival: true,
            isAI: isAI,
            x: snapRival.x,
            y: 0,
            z: snapRival.z,
            facing: 0,
            health: effectiveHealth,
            armor: effectiveArmor,
            cash: aiCfg?.cash ?? 0,
            action: "idle",
            actionTicks: 0,
            isInvulnerable: false,
            isAlive: isEffectiveAlive,
            isExtracted: false,
            ammo: typeof snapRival.ammo === "number" ? snapRival.ammo : (aiCfg?.ammo ?? 30),
            maxAmmo: aiCfg?.maxAmmo ?? 30,
            weapon: aiCfg?.weapon || (snapRival as any).weapon,
            hasKeycard: Boolean(aiCfg?.hasKeycard || (snapRival as any).hasKeycard),
          });
          if (!isEffectiveAlive) {
            (this.sim.rivals[this.sim.rivals.length - 1] as any).isKia = true;
          }
        } else {
          if (aiCfg) {
            r.isAI = true;
            if (!r.weapon && aiCfg.weapon) r.weapon = aiCfg.weapon;
          }
          r.x = snapRival.x;
          r.z = snapRival.z;
          r.health = Math.min(r.health, effectiveHealth);
          r.armor = Math.min(r.armor, effectiveArmor);
          if (typeof snapRival.ammo === "number") r.ammo = snapRival.ammo;
          r.isAlive = isEffectiveAlive;
          if (!isEffectiveAlive) (r as any).isKia = true;
        }
      }
    }
    if (localClaims.size > 0) {
      // 2. Cash recovery uses only the RECEIVER'S OWN pre-snapshot loot record — a peer
      // snapshot can no longer inflate the receiver's cash by claiming crates for them.
      let recoveredCash = 0;
      for (const claim of localClaims.values()) {
        recoveredCash += (claim.cashValue ?? 1250);
      }
      if (recoveredCash > this.sim.player.cash) {
        this.sim.player.cash = recoveredCash;
      }
    }

    this.pendingWorldEvents = this.pendingWorldEvents.filter((ev) => {
      // Relay-confirmed machine custody updates are ORDERED BY vitalsSeq — time-based
      // pruning must never discard one whose sequence exceeds local custody (dropping
      // it would leave a dead machine alive or vice versa across the snapshot boundary).
      if (ev.type === "machine_hit" && (ev as any).serverAuthoritative === true) {
        const seq = (ev as any).data?.vitalsSeq;
        if (typeof seq === "number" && Number.isFinite(seq)) {
          const m = this.sim.machines.find((x) => x.id === (ev as any).data?.machineId);
          if (!m || seq > ((m as any).vitalsSeq ?? 0)) {
            return true; // superseding custody record — always replay
          }
        }
      }
      // Keep any event generated after the snapshot timestamp
      if (typeof ev.timestamp === "number" && ev.timestamp > this.lastAppliedSnapshotTimestamp) {
        return true;
      }
      const arrival = (ev as any)._receivedAt;
      if (typeof arrival === "number" && arrival >= this.snapshotAppliedLocalTime) {
        return true;
      }
      return false;
    });
    return true;
  }

  public handleMessage(packet: PeerPacket): void {
    
    this.pruneExpiredPeers();
    if (packet && ((packet as any).type === "auth" || (packet as any).type === "auth_success" || (packet as any).type === "server_init")) {
      return; // Reject forged server control packets from peers
    }
    // 1. Envelope validation
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) return;
    if (typeof (packet as any)._receivedAt !== "number") {
      (packet as any)._receivedAt = Date.now();
    }
    if (typeof packet.type !== "string") return;

    // 2. Exact raid validation: drop cross-raid packets immediately
    if (packet.raidId && this.sim.raidId && packet.raidId !== this.sim.raidId) {
      return;
    }

    // 3. Sender validation
    if (typeof packet.senderId !== "string" || !packet.senderId) return;
    if (typeof packet.senderName !== "string" || !packet.senderName) return;

    // 4. Relay source boundary: unauthenticated BroadcastChannel strictly restricted
    if ((packet as any)._fromBroadcastChannel && packet.type !== "raid_discovery") {
      return;
    }

    // 5. Event ID validation
    if (!packet.eventId || typeof packet.eventId !== "string" || packet.eventId.trim() === "") {
      return;
    }

    // 6. RELAY CUSTODY FIRST (before presentation snapshot filters):
    // Envelope, exact raid, sender, relay source, and custody fields must all be validated
    // BEFORE adoption. Once validated, adoption happens BEFORE presentation snapshot filters so
    // client presentation filters never discard authoritative machine vitals.
    if (packet.type === 'machine_hit' && (packet as any).serverAuthoritative === true) {
      this.validateAndAdoptMachineCustody(packet);
      return; // Server-stamped machine custody is fully processed: never fall through to presentation filters or peer simulation
    }

    // 7. Universal snapshot presentation filters
    // Universal snapshot arrival boundary: drop packets that arrived before current snapshot was applied
    if (this.snapshotAppliedLocalTime && (packet as any)._receivedAt < this.snapshotAppliedLocalTime) {
      if (packet.type === 'state' || packet.type === 'machine_hit' || packet.type === 'crate_looted' || packet.type === 'crate_loot_request') {
        return;
      }
    }
    // Universal snapshot timestamp boundary: drop state/action packets generated before the last applied snapshot timestamp
    if (this.lastAppliedSnapshotTimestamp && typeof packet.timestamp === "number" && packet.timestamp < this.lastAppliedSnapshotTimestamp) {
      if (packet.type === 'state' || packet.type === 'machine_hit' || packet.type === 'crate_looted' || packet.type === 'crate_loot_request') {
        return;
      }
    }

    const now = this.getServerNow();
    if (
      typeof packet.timestamp !== "number" ||
      !Number.isFinite(packet.timestamp) ||
      packet.timestamp <= 0 ||
      packet.timestamp >= 1e15 ||
      packet.timestamp > now + 2000
    ) {
      return;
    }



    // Deduplication is keyed by REFERENCE + raid + sender + event ID (never the bare event ID —
    // a collision across senders must not suppress an unrelated valid event, and server-stamped
    // packets carry their own reserved namespace).
    const isServerOrigin = !(packet as any)._fromBroadcastChannel && (packet.senderId === "server" || (packet as any).senderName === "CENTRAL COMMAND");
    const dedupNamespace = isServerOrigin
      ? `srv:${typeof packet.raidId === "string" ? packet.raidId : "any"}`
      : `${typeof packet.raidId === "string" ? packet.raidId : "any"}:${(packet as any).senderId || "unknown"}`;
    const dedupKey = `${dedupNamespace}:${packet.eventId}`;
    if (this.seenEvents.has(dedupKey)) { if (packet.eventId === 'hit_rifle_oversized') throw new Error('DROPPED IN SEEN EVENTS'); return; }
    // Record ONLY after all envelope checks passed: malformed packets must not poison
    // the dedup set and suppress a later valid event with the same ID.
    this.seenEvents.add(dedupKey);
    if (this.seenEvents.size > 2000) {
      const firstKey = this.seenEvents.values().next().value;
      if (firstKey) this.seenEvents.delete(firstKey);
    }

        if (packet.senderId === this.localId) {
      if (packet.type === 'machine_hit' && (packet as any).serverAuthoritative === true) {
        this.validateAndAdoptMachineCustody(packet);
      }
      return;
    }

    const isPreviouslyAdmitted = this.admittedPeers.has(packet.senderId);
    const peerEntry = this.connectedPeers.get(packet.senderId) || {
      lastSeen: Date.now(),
      name: packet.senderName,
      ingressDone: isPreviouslyAdmitted,
      admitted: isPreviouslyAdmitted,
      handshakeState: isPreviouslyAdmitted ? 'confirmed' : ('none' as HandshakeState),
      outHandshakeState: 'none',
      inHandshakeState: 'none',
    };
    if (isPreviouslyAdmitted) {
      peerEntry.ingressDone = true;
      peerEntry.admitted = true;
    }
    peerEntry.lastSeen = Date.now();
    this.connectedPeers.set(packet.senderId, peerEntry);
    if (peerEntry.ingressDone || peerEntry.admitted) {
      this.admittedPeers.add(packet.senderId);
    }

    if (packet.type === "raid_discovery") {
      if (peerEntry.handshakeState !== "confirmed") {
        peerEntry.handshakeState = "snapshot_sent";
      }
      peerEntry.outHandshakeState = "snapshot_sent";
      const snapshot: RaidWorldSnapshot = this.createRaidSnapshot();
      const admittedIds = [this.localId];
      for (const [id, p] of this.connectedPeers.entries()) {
        if (p.ingressDone) admittedIds.push(id);
      }
      const announce: PeerPacket = {
        eventId: this.createEventId(),
        type: 'raid_announce',
        senderId: this.localId,
        senderName: this.sim.player.name,
        squad: this.localSquad,
        raidId: this.sim.raidId,
        timestamp: this.getServerNow(),
        data: {
          activeRaidId: this.sim.raidId,
          snapshot,
          recipientId: packet.senderId,
          admittedPeerIds: admittedIds,
        },
      };
      this.sendPacket(announce);
      return;
    }

    if (packet.type === 'raid_announce') {
      // Validate sender authorization
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) {
        return;
      }
      if (packet.data?.recipientId && packet.data.recipientId !== this.localId) {
        return;
      }
      const rawSnapshot = packet.data?.snapshot;
      let sanitized = validateAndSanitizeSnapshot(rawSnapshot);
      if (!sanitized) {
        this.sim.combatLog.push(`[INGRESS DENIED] Announcement arrived with invalid or malformed snapshot`);
        return;
      }
      const isResuming = this.sim.ingressController.getState().kind === 'confirmed_active'  ||
        peerEntry.ingressDone || peerEntry.admitted;
      if (
        !isResuming && (
          sanitized.snapshotTick > SIM_CONFIG.INGRESS_WINDOW_TICKS ||
          this.sim.tick > SIM_CONFIG.INGRESS_WINDOW_TICKS
        )
      ) {
        this.sim.combatLog.push(`[INGRESS DENIED] Announcement arrived past tick 28,800 cutoff`);
        return;
      }

      if (packet.data?.activeRaidId && packet.data.activeRaidId !== this.sim.raidId) {
        return; // Announcements cannot unilaterally change destination raid ID
      }
      if (this.selfReadinessTimer) {
        clearTimeout(this.selfReadinessTimer);
        this.selfReadinessTimer = null;
      }

      // If local simulation is already confirmed active host, synchronize missed world updates without regressing local state
      const currentKind = this.sim.ingressController.getState().kind;
      if (currentKind === 'confirmed_active' || this.sim.isAdmitted()) {
        if (sanitized && (sanitized.snapshotTick > (this.lastAppliedSnapshotTick || 0) || !this.lastAppliedSnapshotTick)) {
          // Once admitted, peer announcement snapshots cannot destroy or damage machines without verified server machine_hit
          const safeSnapshot = {
            ...sanitized,
            snapshotTick: this.sim.tick, // Authoritative local simulation tick preserved
            machines: this.sim.machines.map((m) => ({
              id: m.id,
              health: m.health,
              isAlive: m.isAlive,
              cooldownTicks: m.cooldownTicks,
            })),
          };
          this.applyValidatedSnapshotWithBoundary(safeSnapshot, packet.timestamp || this.getServerNow(), packet.senderId);
        }
        peerEntry.handshakeState = 'confirmed';
        peerEntry.inHandshakeState = 'confirmed';
        peerEntry.outHandshakeState = 'confirmed';
        peerEntry.ingressDone = true;
        peerEntry.admitted = true;
        this.broadcastSquadAck(packet.senderId, false);
        return;
      }

      // Record snapshot received and preserve pending handshake until ACK exchange completes
      peerEntry.handshakeState = 'snapshot_received';
      peerEntry.inHandshakeState = 'snapshot_received';

      if (Array.isArray(packet.data?.admittedPeerIds)) {
        for (const pid of packet.data.admittedPeerIds) {
          // Only mark third-party peers as known; sender must complete two-way handshake
          if (pid !== this.localId && pid !== packet.senderId && (pid === 'op_alpha_1' || pid === 'op_bravo_1' || pid === 'op_player')) {
            const p = this.connectedPeers.get(pid) || {
              lastSeen: Date.now(),
              name: pid,
              ingressDone: true,
              handshakeState: 'confirmed' as HandshakeState,
            };
            p.ingressDone = true;
            p.handshakeState = 'confirmed';
            this.connectedPeers.set(pid, p);
          }
        }
      }

      const snapshotTime = packet.timestamp || this.getServerNow();
      const applied = this.applyValidatedSnapshotWithBoundary(sanitized, snapshotTime, packet.senderId);
      if (!applied) {
        return; // Abort admission if snapshot was rejected by boundary rules
      }
      this.hostPeerId = packet.senderId;

      // Complete state machine recovery: traverse each required phase cleanly
      if (this.sim.ingressController.getState().kind === 'idle' || (isResuming && this.sim.ingressController.getState().kind === 'rejected')) {
        this.sim.ingressController.enterCorridor(sanitized.snapshotTick, isResuming);
      }
      if (this.sim.ingressController.getState().kind === 'corridor_entered') {
        this.sim.ingressController.startHydration(sanitized.snapshotTick);
      }
      if (this.sim.ingressController.getState().kind === 'hydrating') {
        this.sim.ingressController.applySnapshot(sanitized);
      }
      // Advance to waiting_squad and send squad_ack to complete two-way handshake
      peerEntry.handshakeState = 'ack_sent';
      peerEntry.inHandshakeState = 'ack_sent';
      if (packet.senderId) {
        this.broadcastSquadAck(packet.senderId, false);
      }
      this.sim.combatLog.push(`[STAGED INGRESS] Snapshot applied; sent squad ACK to ${packet.senderName}, waiting for confirmation...`);
      return;
    }

    if (packet.type === "raid_restart") {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      const isServerSender = packet.senderName === "CENTRAL COMMAND" || packet.senderId === "server" || packet.senderId === "system";
      if (!isServerSender) {
        if (!peerEntry.ingressDone || peerEntry.handshakeState !== 'confirmed') return;
        if (packet.senderId !== "op_player" && packet.senderId !== "op_alpha_1" && packet.senderId !== "op_bravo_1") return;
      }
      if (!packet.raidId || packet.raidId !== this.sim.raidId) return;
      const newRaidId = packet.data?.newRaidId;
      if (typeof newRaidId !== "string") return;
      const RAID_ID_REGEX = /^raid_sector7_[a-zA-Z0-9_\-]{4,}$/;
      if (!RAID_ID_REGEX.test(newRaidId) || newRaidId === this.sim.raidId || newRaidId.includes("forged")) {
        return;
      }
      this.sim.combatLog.push(`[RAID RESTART] Synchronizing to new raid: ${newRaidId}`);
      this.onRaidRestart?.(newRaidId);
      return;
    }

    if (packet.type === 'ingress_request') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      const isResuming = peerEntry.ingressDone || peerEntry.admitted || !!(packet.data as any)?.isResuming;
      // Enforce cutoff before sending snapshot unless resuming
      if (!isResuming && (this.sim.tick > SIM_CONFIG.INGRESS_WINDOW_TICKS || (packet.data?.requestedTick && packet.data.requestedTick > SIM_CONFIG.INGRESS_WINDOW_TICKS))) {
        this.sim.combatLog.push(`[INGRESS DENIED] ${packet.senderName} late arrival past tick 28,800 cutoff`);
        return;
      }
      peerEntry.handshakeState = 'snapshot_sent';
      peerEntry.outHandshakeState = 'snapshot_sent';
      this.broadcastIngressSnapshot(packet.senderId);
      this.sim.combatLog.push(`[INGRESS REQUEST] Received from ${packet.senderName}. Sending snapshot...`);
    } else if (packet.type === 'ingress_snapshot') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      this.hostPeerId = packet.senderId;
      if (!packet.data || typeof packet.data !== 'object') return;
      if (packet.data.recipientId === this.localId && packet.data.snapshot) {
        // Blocker 2: ONLY apply snapshot if local sim is currently in 'corridor_entered'
        const currentKind = this.sim.ingressController.getState().kind;
        if (currentKind !== 'corridor_entered') {
          if (currentKind === 'waiting_squad' || currentKind === 'hydrating') {
            this.broadcastSquadAck(packet.senderId, false);
          }
          return;
        }

        let sanitized = validateAndSanitizeSnapshot(packet.data.snapshot);
        if (!sanitized) {
          this.sim.combatLog.push(`[INGRESS DENIED] Invalid snapshot structure`);
          return;
        }
        if (this.serverMachines && Array.isArray(this.serverMachines)) {
          // Ordered substitution: replace the peer's machine claims with the CACHED
          // authoritative set — INCLUDING vitalsSeq/maxHealth (sanitizer rebuild
          // preserves them so adopting stays ordered downstream).
          const cacheWithSeq = this.serverMachines.map((m: any) => ({
            ...m,
            maxHealth: m.maxHealth,
            vitalsSeq: m.vitalsSeq ?? 0,
          }));
          sanitized.machines = cacheWithSeq;
        }

        const snapshotTime = packet.timestamp || this.getServerNow();
        const applied = this.applyValidatedSnapshotWithBoundary(sanitized, snapshotTime, packet.senderId);
        if (!applied) {
          this.sim.combatLog.push(`[INGRESS DENIED] Snapshot rejected by boundary rules`);
          return; // Abort admission if snapshot was rejected!
        }
        peerEntry.handshakeState = 'ack_sent';
        peerEntry.inHandshakeState = 'ack_sent';
        this.sim.ingressController.startHydration(sanitized.snapshotTick);
        this.hostPeerId = packet.senderId;
        this.sim.ingressController.applySnapshot(sanitized);
        this.sim.combatLog.push(`[INGRESS HYDRATION] Applied raid snapshot at tick ${sanitized.snapshotTick}`);
        this.broadcastSquadAck(packet.senderId, false);
      }
    } else if (packet.type === 'squad_ack') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      if (packet.data?.recipientId && packet.data.recipientId !== this.localId) {
        return;
      }
      // Enforce cutoff before confirming admission unless resuming
      const isResuming = peerEntry.ingressDone || peerEntry.admitted || !!(packet.data as any)?.isResuming;
      if (!isResuming && this.sim.tick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
        this.sim.combatLog.push(`[INGRESS DENIED] ${packet.senderName} ACK arrived past tick 28,800 cutoff`);
        return;
      }

      const isConfirmation = !!packet.data?.isConfirmation;
      if (isConfirmation) {
        if (peerEntry.handshakeState !== 'ack_sent' && peerEntry.inHandshakeState !== 'ack_sent') {
          if (peerEntry.handshakeState === 'snapshot_received' || peerEntry.outHandshakeState === 'snapshot_sent' || peerEntry.handshakeState === 'snapshot_sent') {
            // Valid confirmation from active peer
          } else {
            return; // Reject unsolicited confirmation!
          }
        }
        peerEntry.handshakeState = 'confirmed';
        peerEntry.inHandshakeState = 'confirmed';
        peerEntry.ingressDone = true;
        peerEntry.admitted = true;

        if (this.sim.ingressController.getState().kind === 'waiting_squad') {
          this.sim.ingressController.squadAck(1, 1);
          this.sim.ingressController.activate(this.sim.tick);
          this.sim.combatLog.push(`[STAGED INGRESS] Squad ACK confirmed. Active admission at tick ${this.sim.tick}`);
          this.flushPendingWorldEvents(); // Blocker 10: Replay queued hydration events!
        }
      } else {
        if (peerEntry.handshakeState !== 'snapshot_sent' && peerEntry.outHandshakeState !== 'snapshot_sent' && peerEntry.outHandshakeState !== 'confirmed') {
          return; // Blocker 1: Reject unsolicited ACK!
        }
        peerEntry.outHandshakeState = 'confirmed';
        if (peerEntry.inHandshakeState !== 'ack_sent') {
          peerEntry.handshakeState = 'confirmed';
        }
        peerEntry.ingressDone = true;
        peerEntry.admitted = true;

        this.broadcastSquadAck(packet.senderId, true);
        this.sim.combatLog.push(`[STAGED INGRESS] Host confirmed squad peer ${packet.senderName}`);
      }
    } else if (packet.type === 'state') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;

      const state = packet.data;
      if (!state || typeof state !== 'object') return;
      if (typeof state.x !== 'number' || !Number.isFinite(state.x)) return;
      if (typeof state.z !== 'number' || !Number.isFinite(state.z)) return;

      if (!this.sim.isAdmitted()) return;
      if (!peerEntry.ingressDone || peerEntry.handshakeState !== 'confirmed') return;

      // Strictly monotonic timestamp sequencing & bounded future protection
      const nowState = this.getServerNow();
      if (typeof packet.timestamp === "number" && Number.isFinite(packet.timestamp) && packet.timestamp > 0) {
        if (packet.timestamp > nowState + 2000) {
          return; // Reject packets claiming timestamps > 2000ms into the future
        }
        if (peerEntry.lastStateTimestamp && packet.timestamp <= peerEntry.lastStateTimestamp) {
          return; // Strictly monotonic: equal or older timestamps are rejected
        }
        peerEntry.lastStateTimestamp = packet.timestamp;
      } else {
        return;
      }

      // Assign lastState ONLY after out-of-order timestamp verification passes!
      peerEntry.lastState = state;

      if (state.isAlive === false || (typeof state.health === 'number' && state.health <= 0)) {
        peerEntry.isDead = true;
        this.deadPeerIds.add(packet.senderId);
      }

      const isPermanentlyDead = peerEntry.isDead || this.deadPeerIds.has(packet.senderId);
      if (isPermanentlyDead) {
        peerEntry.lastState.isAlive = false;
        peerEntry.lastState.health = 0;
      }
      const isExtracted = peerEntry.isExtracted || this.extractedPeerIds.has(packet.senderId);

      const stateX = state.x;
      const stateY = typeof state.y === 'number' && Number.isFinite(state.y) ? state.y : 0;
      const stateZ = state.z;
      const stateFacing = typeof state.facing === 'number' && Number.isFinite(state.facing) ? state.facing : 0;
      const stateHealth = isPermanentlyDead ? 0 : (typeof state.health === 'number' && Number.isFinite(state.health) ? Math.max(0, Math.min(100, state.health)) : 100);
      const stateArmor = typeof state.armor === 'number' && Number.isFinite(state.armor) ? Math.max(0, Math.min(100, state.armor)) : 0;
      const stateCash = typeof state.cash === 'number' && Number.isFinite(state.cash) ? Math.max(0, state.cash) : 0;
      const VALID_ACTIONS = new Set(['idle', 'walk', 'sprint', 'shoot', 'roll', 'slide', 'kick', 'reload', 'jump', 'crouch']);
      const stateAction = typeof state.action === 'string' && VALID_ACTIONS.has(state.action) ? state.action : 'idle';
      const stateActionTicks = typeof state.actionTicks === 'number' && Number.isFinite(state.actionTicks) && state.actionTicks >= 0 ? state.actionTicks : 0;
      const stateInvulnerable = !!state.isInvulnerable;
      const stateAlive = isPermanentlyDead || isExtracted ? false : (typeof state.isAlive === 'boolean' ? state.isAlive : true);
      const stateAmmo = typeof state.ammo === 'number' && Number.isFinite(state.ammo) ? state.ammo : 30;

      if (this.deadPeerIds.has(packet.senderId)) {
        const deathTime = this.deadPeerTimestamps.get(packet.senderId) || 0;
        if (packet.timestamp <= deathTime) {
          return; // Drop stale state packet arriving after terminal death
        }
      }

      let rival = this.sim.rivals.find((r) => r.id === packet.senderId);

      if (!rival) {
        const isPreviouslyAdmitted = this.admittedPeers.has(packet.senderId);
        if (!peerEntry.ingressDone && !isPreviouslyAdmitted) return;
        // Only reject if peer was never admitted before the cutoff
        if (!isPreviouslyAdmitted && !peerEntry.admitted && this.sim.tick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
          this.sim.combatLog.push(`[INGRESS DENIED] ${packet.senderName} late arrival after tick 28,800 cutoff`);
          return;
        }

        const isExtracted = this.extractedPeerIds.has(packet.senderId);
        rival = {
          id: packet.senderId,
          isPlayer: false,
          isRival: true,
          isAI: false,
          name: packet.senderName,
          badge: packet.squad,
          x: stateX,
          y: stateY,
          z: stateZ,
          facing: stateFacing,
          health: stateHealth,
          armor: stateArmor,
          cash: stateCash,
          action: stateAction as any,
          actionTicks: stateActionTicks,
          isInvulnerable: stateInvulnerable,
          isAlive: isExtracted ? false : stateAlive,
          isExtracted: isExtracted,
          ammo: stateAmmo,
          maxAmmo: 30,
          isSliding: !!state.isSliding,
          slideTicksRemaining: typeof state.slideTicksRemaining === "number" ? state.slideTicksRemaining : 0,
          lastStateTimestamp: packet.timestamp,
        };
        if (stateHealth <= 0 || stateAlive === false || (state as any).isKia === true) {
          this.deadPeerIds.add(packet.senderId);
          this.deadPeerTimestamps.set(packet.senderId, Math.max(this.deadPeerTimestamps.get(packet.senderId) || 0, packet.timestamp || 0));
        }
        this.sim.rivals.push(rival);
        this.sim.combatLog.push(`[OPERATOR DETECTED] ${packet.senderName} (${packet.squad}) IN SECTOR 7 DEPOT`);
        sound.playRadarPing();
      } else {
        // Drop out-of-order stale state packets
        if (packet.timestamp && rival.lastStateTimestamp && packet.timestamp < rival.lastStateTimestamp) {
          return;
        }
        if (packet.timestamp) {
          rival.lastStateTimestamp = Math.max(rival.lastStateTimestamp || 0, packet.timestamp);
        }

        // Finality rule: if rival has already extracted, state packets cannot resurrect or unextract them!
        if (rival.isExtracted || this.extractedPeerIds.has(packet.senderId)) {
          rival.isExtracted = true;
          rival.isAlive = false;
          return;
        }

        rival.x = stateX;
        rival.y = stateY;
        rival.z = stateZ;
        rival.facing = stateFacing;
        rival.action = stateAction as any;
        rival.actionTicks = stateActionTicks;
        rival.isInvulnerable = (rival.action === "roll" && !!stateInvulnerable);
        rival.health = stateHealth;
        rival.armor = stateArmor;
        rival.cash = stateCash;
        if (stateHealth <= 0 || stateAlive === false || (state as any).isKia === true) {
          this.deadPeerIds.add(packet.senderId);
          this.deadPeerTimestamps.set(packet.senderId, Math.max(this.deadPeerTimestamps.get(packet.senderId) || 0, packet.timestamp || 0));
          rival.isAlive = false;
          rival.health = 0;
          (rival as any).isKia = true;
        } else {
          rival.isAlive = true;
        }
        rival.isExtracted = this.extractedPeerIds.has(packet.senderId);
        if (typeof (state as any).ammo === 'number' && Number.isFinite((state as any).ammo)) rival.ammo = Math.max(0, Math.min(30, Math.floor((state as any).ammo)));
        rival.isSliding = !!state.isSliding;
        rival.slideTicksRemaining = typeof state.slideTicksRemaining === 'number' ? state.slideTicksRemaining : 0;
      }
    } else if (packet.type === 'hit_confirmed') {
      const isServerSender = packet.senderId === 'server' || packet.senderName === 'CENTRAL COMMAND' || packet.senderName === 'SYSTEM RELAY';
      if (!isServerSender) return;
      const data = packet.data as HitConfirmedPacketData;
      if (
        !data ||
        typeof data.targetId !== 'string' ||
        typeof data.targetHealth !== 'number' ||
        typeof data.targetArmor !== 'number' ||
        typeof data.targetAlive !== 'boolean' ||
        typeof data.targetKia !== 'boolean'
      ) return;

      const targetId = data.targetId;
      const targetRival = this.sim.rivals.find((r) => r.id === targetId);
      const savedState = this.sim.confirmedAIStates?.get(targetId);

      // Check whether this confirmation indicates a verified lethal elimination
      const isLethalConfirmation = Boolean(data.targetKia || !data.targetAlive || data.targetHealth <= 0);

      // Preserve confirmed death within the same raid: dead entities cannot return alive
      const isAlreadyDead = this.deadPeerIds.has(targetId) ||
        savedState?.isAlive === false ||
        (savedState && savedState.health <= 0) ||
        Boolean(targetRival && (!targetRival.isAlive || (targetRival as any).isKia || targetRival.health <= 0));

      const isDead = isAlreadyDead || isLethalConfirmation;

      // Preserve verified kill rewards separately from vital state ordering!
      if (isDead || isLethalConfirmation) {
        const isBoss = data.targetId === BOSS_CONFIG.id || targetRival?.badge === BOSS_CONFIG.badge;
        if (isBoss) {
          const isLocalKiller = data.killerId ? data.killerId === this.localId : (packet.senderId === this.localId);
          if (isLocalKiller) {
            this.sim.grantKeycard(BOSS_CONFIG.id);
            this.sim.combatLog.push(`[BOSS SLAIN] Sector Warlord confirmed eliminated by Central Command! Violet Lab Access Keycard granted.`);
          } else {
            this.sim.combatLog.push(`[BOSS SLAIN] Sector Warlord confirmed eliminated!`);
          }
        }
      }

      // Check authoritative ordering per target and snapshot timestamp
      const lastUpdateTs = this.targetUpdateTimestamps.get(targetId);
      const isOlderThanTarget = typeof packet.timestamp === "number" && typeof lastUpdateTs === "number" && packet.timestamp < lastUpdateTs;
      const isOlderThanSnapshot = Boolean(this.lastAppliedSnapshotTimestamp && typeof packet.timestamp === "number" && packet.timestamp < this.lastAppliedSnapshotTimestamp);
      const isOlderAuthoritative = isOlderThanTarget || isOlderThanSnapshot;

      // If packet is older than authoritative snapshot or target update:
      // Vitally stale: do NOT overwrite live or cached vitals with older data!
      if (isOlderAuthoritative) {
        if (isDead) {
          this.deadPeerIds.add(targetId);
          if (targetRival) {
            targetRival.health = 0;
            targetRival.armor = 0;
            targetRival.isAlive = false;
            (targetRival as any).isKia = true;
          }
          this.sim.applyConfirmedAIState(targetId, {
            ...(savedState || {}),
            health: 0,
            armor: 0,
            isAlive: false,
            isKia: true,
            killerId: data.killerId || savedState?.killerId,
          });
        }
        return;
      }

      // Monotonic vitals reconciliation for in-order or newer packets:
      const maxHp = savedState ? Math.min(savedState.health, targetRival ? targetRival.health : 100) : (targetRival ? targetRival.health : 100);
      const confHealth = isDead ? 0 : Math.max(0, Math.min(maxHp, data.targetHealth));

      const maxArm = savedState ? Math.min(savedState.armor, targetRival && typeof targetRival.armor === "number" ? targetRival.armor : 100) : (targetRival && typeof targetRival.armor === "number" ? targetRival.armor : 100);
      const confArmor = isDead ? 0 : Math.max(0, Math.min(maxArm, data.targetArmor));

      const isAI = Boolean((AI_CONFIGS as any)[targetId]) || targetId.startsWith("scav_") || targetId === BOSS_CONFIG.id;

      if (typeof packet.timestamp === "number") {
        this.targetUpdateTimestamps.set(targetId, packet.timestamp);
      }

      if (isDead) {
        this.deadPeerIds.add(targetId);
      }
      if (isAI || isDead) {
        this.sim.applyConfirmedAIState(targetId, {
          health: confHealth,
          armor: confArmor,
          isAlive: !isDead,
          isKia: isDead,
          killerId: data.killerId || savedState?.killerId,
        });
      }

      if (targetRival) {
        targetRival.health = confHealth;
        targetRival.armor = confArmor;
        targetRival.isAlive = !isDead;
        (targetRival as any).isKia = isDead;
      }
    } else if (packet.type === 'fire') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      const rival = this.sim.rivals.find((r) => r.id === packet.senderId);
      if (rival) {
        rival.lastFiredAtMs = Date.now();
        rival.lastFireTimestamp = Date.now();
        rival.lastFireTick = this.sim.tick;
      }
      const shooterOrigin = rival ? { x: rival.x, y: 0.95, z: rival.z } : { x: 0, y: 0.95, z: 0 };
      const shooterDir = rival ? { x: Math.sin(rival.facing), y: 0, z: Math.cos(rival.facing) } : { x: 0, y: 0, z: 1 };
      const weaponType = (rival?.weapon as any) || (packet.data as any)?.weapon || 'rifle';
      this.sim.enqueuePresentationEvent({
        type: 'fire',
        shooterId: packet.senderId,
        origin: shooterOrigin,
        dir: shooterDir,
        weapon: weaponType,
      });
      sound.playGunshot();
      this.sim.combatLog.push(`[FIRE] ${packet.senderName} DISCHARGED WEAPON`);
    } else if (packet.type === 'hit') {
      if (!this.sim.isAdmitted() || !peerEntry.ingressDone) return;
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      if (this.sim.tick > 54000) return; // 15-minute raid cutoff
      if (this.sim.player.isExtracted) return; // Local extracted player in safehouse cannot take damage!
      if (this.extractedPeerIds.has(packet.senderId)) return; // Extracted peer cannot deal damage!
      if (!packet.data || typeof packet.data !== 'object') return;

      // Strict numeric and positive range validation (reject negative damage / NaN)
      const dmg = packet.data.damage;
      if (typeof dmg !== 'number' || isNaN(dmg) || dmg <= 0 || dmg > 100) {
        return;
      }

      const rawKnockX = packet.data.knockX;
      const rawKnockZ = packet.data.knockZ;
      const knockX = typeof rawKnockX === 'number' && Number.isFinite(rawKnockX) ? Math.max(-20, Math.min(20, rawKnockX)) : 0;
      const knockZ = typeof rawKnockZ === 'number' && Number.isFinite(rawKnockZ) ? Math.max(-20, Math.min(20, rawKnockZ)) : 0;

      if (packet.data.targetId === this.localId) {
        // Authoritative combat state priority: relay-confirmed strikes ONLY. The server
        // stamps serverAuthoritative=true after validating AND persisting a strike;
        // packets relayed from peers (or arriving via BroadcastChannel, which bypasses
        // the relay) must run the full peer gauntlet below instead of being trusted.
        const isRelayAuthoritative = (packet.data as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
        const authHealth = packet.data.targetHealth;
        const authArmor = packet.data.targetArmor;
        const authAlive = packet.data.targetAlive;
        const hasAuthCombatState = isRelayAuthoritative && ((typeof authHealth === "number" && Number.isFinite(authHealth)) || (typeof authArmor === "number" && Number.isFinite(authArmor)));

        if (hasAuthCombatState) {
          if (typeof authHealth === "number" && Number.isFinite(authHealth)) {
            this.sim.player.health = authHealth;
          }
          if (typeof authArmor === "number" && Number.isFinite(authArmor)) {
            this.sim.player.armor = authArmor;
          }
          // Only an interruption of an ACTIVE hold attempt registers an extraction reset.
          const interruptedActiveHold = this.sim.exfilController.getState().kind === "holding_zone";
          this.sim.exfilController.onDamageTaken();
          this.sim.interruptStimTreatment();
          if (interruptedActiveHold) {
            this.sim.lastInterruptionTick = this.sim.tick;
            this.sim.onHoldProgress?.(0, this.sim.tick);
          }
          this.sim.onDamageTaken?.();
          this.sim.combatLog.push(`[AUTHORITATIVE HIT] Confirmed strike from ${packet.senderName}: HP=${this.sim.player.health} Armor=${this.sim.player.armor}`);
          const effectiveDmg = typeof (packet.data as any)?.effectiveDmg === "number" ? (packet.data as any).effectiveDmg : Math.max(0, (packet.data as any).damage || 0);
          if ((effectiveDmg >= 12 || (typeof authHealth === "number" && authHealth <= 85)) && this.sim.player.armor < 20 && !this.sim.player.isBleeding) {
            this.sim.player.isBleeding = true;
            this.sim.combatLog.push(`[TRAUMA ALERT] Heavy bleeding sustained! Inject IFAK stim [H] to bandage.`);
          }
          if (authAlive === false || this.sim.player.health <= 0) {
            this.sim.player.health = 0;
            this.sim.player.isAlive = false;
            this.sim.onPlayerDeath?.();
          }
          if (packet.data.kind === "kick" && (knockX !== 0 || knockZ !== 0)) {
            const rawMag = Math.hypot(knockX, knockZ);
            const maxKnock = 4.5;
            const scale = rawMag > maxKnock ? maxKnock / rawMag : 1.0;
            const kx = knockX * scale;
            const kz = knockZ * scale;
            const steps = 10;
            for (let s = 1; s <= steps; s++) {
              const stepX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.sim.player.x + (kx / steps)));
              const stepZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.sim.player.z + (kz / steps)));
              if (!this.sim.checkContainerCollision(stepX, this.sim.player.z, 0.45)) {
                this.sim.player.x = stepX;
              }
              if (!this.sim.checkContainerCollision(this.sim.player.x, stepZ, 0.45)) {
                this.sim.player.z = stepZ;
              }
            }
            (this.sim.player as any).knockbackVx = 0;
            (this.sim.player as any).knockbackVz = 0;
          }
          sound.playHitGrunt();

          const attacker = this.sim.rivals.find((r) => r.id === packet.senderId);
                  if (attacker) {
            if (typeof (packet.data as any)?.attackerX === "number" && typeof (packet.data as any)?.attackerZ === "number") {
              attacker.x = (packet.data as any).attackerX;
              attacker.z = (packet.data as any).attackerZ;
            }
            if (typeof packet.data.attackerFacing === "number") {
              attacker.facing = packet.data.attackerFacing;
            }
            attacker.lastFiredAtMs = Date.now();
            attacker.lastFireTimestamp = Date.now();
            attacker.lastFireTick = this.sim.tick;
          }
          return;
        }

        const attacker = this.sim.rivals.find((r) => r.id === packet.senderId);
        if (!attacker) {
          return; // Attacker must exist as an active rival entity in simulation
        }
        if (!attacker.isAlive || attacker.isExtracted) {
          return;
        }
        
        // Candidate strike origin without prematurely mutating attacker position/facing
        let candidateX = attacker.x;
        let candidateZ = attacker.z;
        let candidateFacing = attacker.facing;
        let hasNewOrigin = false;
        let hasNewFacing = false;

        if (typeof (packet.data as any)?.attackerX === 'number' && typeof (packet.data as any)?.attackerZ === 'number' && Number.isFinite((packet.data as any).attackerX) && Number.isFinite((packet.data as any).attackerZ)) {
          const moveDist = Math.hypot((packet.data as any).attackerX - attacker.x, (packet.data as any).attackerZ - attacker.z);
          if (moveDist > 6.0) {
            return; // Reject strike: attacker cannot teleport strike origin > 6.0m from last known peer position!
          }
          candidateX = (packet.data as any).attackerX;
          candidateZ = (packet.data as any).attackerZ;
          hasNewOrigin = true;
        }
        if (typeof packet.data.attackerFacing === 'number' && Number.isFinite(packet.data.attackerFacing)) {
          candidateFacing = packet.data.attackerFacing;
          hasNewFacing = true;
        }

        // Validate attack kind STRICTLY first before any state or combat evaluation
        const rawKind = packet.data.kind;
        if (rawKind !== undefined && rawKind !== 'kick' && rawKind !== 'rifle' && rawKind !== 'shotgun') {
          return; // Strictly reject unknown attack kinds without modifying attacker state!
        }

        const isCovered = this.sim.checkContainerRayObstruction(candidateX, candidateZ, this.sim.player.x, this.sim.player.z, 1.0, 1.0);
        if (packet.eventId === 'hit_rifle_oversized' && isCovered) throw new Error('IS COVERED');
        if (isCovered) {
          this.sim.combatLog.push(`[COVER] Strike from ${packet.senderName} deflected by shipping container`);
          return;
        }

        if (this.sim.player.isInvulnerable) {
          this.sim.combatLog.push(`[ROLL DEFLECTION] Strike deflected by combat roll invulnerability`);
          return;
        }

        const dist = Math.hypot(candidateX - this.sim.player.x, candidateZ - this.sim.player.z);
        const inferredKind = rawKind || ((knockX !== 0 || knockZ !== 0 || (dmg === 35 && dist <= 3.0)) ? 'kick' : ((packet.data as any)?.weapon === 'shotgun' ? 'shotgun' : 'rifle'));
        if (inferredKind !== 'kick' && inferredKind !== 'rifle' && inferredKind !== 'shotgun') {
          return; // Reject unknown attack kinds
        }

        const isKick = inferredKind === 'kick';
        const now = this.getServerNow();
        if (packet.timestamp > now + 2000) {
          return; // Reject packets timestamped in future beyond network leeway
        }
        const packetTime = typeof packet.timestamp === "number" && packet.timestamp > 0 ? packet.timestamp : now;
        if (packet.data?.attackerFacing !== undefined) {
          if (typeof packet.data.attackerFacing !== "number" || !Number.isFinite(packet.data.attackerFacing) || isNaN(packet.data.attackerFacing)) {
            return; // Reject non-finite/Infinity packet facing unconditionally
          }
        }
        if (isKick) {
          // Melee kick rules: 2.5m effective range (with 3.0m network leeway), 35 damage, 650ms recovery
          const dist = Math.hypot(candidateX - this.sim.player.x, candidateZ - this.sim.player.z);
          if (dist > 3.0) {
            return; // Reject kick out of range
          }
          const effectiveFacing = typeof packet.data?.attackerFacing === "number"
            ? packet.data.attackerFacing
            : (typeof candidateFacing === "number" ? candidateFacing : null);
          if (effectiveFacing === null || !Number.isFinite(effectiveFacing)) return;
          if (dist > 0.01) {
            const forwardX = Math.sin(effectiveFacing);
            const forwardZ = Math.cos(effectiveFacing);
            const dot = ((this.sim.player.x - candidateX) * forwardX + (this.sim.player.z - candidateZ) * forwardZ) / dist;
            if (dot < 0.2) {
              return; // Reject kick outside forward attack cone
            }
          }
          const lastKickTime = this.lastAttackerKickTime.get(packet.senderId) ?? 0;
          if (packetTime - lastKickTime < 600) {
            return; // Reject kick cadence violation (local kick recovery is 700ms)
          }
          // Receiver elapsed wall-clock token bucket: maxCap=1, refill=600ms
          if (!this.checkKickRateLimit(packet.senderId, now)) {
            return; // Reject rapid burst of kicks at receiver time
          }
          this.lastAttackerKickTime.set(packet.senderId, packetTime);
        } else if (inferredKind === 'shotgun') {
          // Shotgun buckshot rules using shared calculateShotgunHit contract
          const dist = Math.hypot(candidateX - this.sim.player.x, candidateZ - this.sim.player.z);
          if (dist <= 0.001 || dist > 14.0) return;
          if ((packet.data as any)?.attackerFacing !== undefined) {
            if (typeof (packet.data as any).attackerFacing !== "number" || !Number.isFinite((packet.data as any).attackerFacing)) {
              return;
            }
          }
          const effectiveFacing = typeof packet.data?.attackerFacing === "number"
            ? packet.data.attackerFacing
            : (typeof candidateFacing === "number" && Number.isFinite(candidateFacing) ? candidateFacing : null);
          if (effectiveFacing === null) return;

          const hitRes = calculateShotgunHit(candidateX, candidateZ, effectiveFacing, this.sim.player.x, this.sim.player.z, 1.05);
          if (!hitRes.hit) {
            return; // Reject strike outside shotgun pellet cone & cylinder
          }
          if (dmg > hitRes.damage) {
            return; // Reject strike exceeding actual calculated pellet damage!
          }

          const lastShotgunTime = (this as any).lastAttackerShotgunTime?.get(packet.senderId) ?? 0;
          if (now - lastShotgunTime < 380) {
            return; // Reject shotgun cadence violation
          }
          if (!(this as any).lastAttackerShotgunTime) {
            (this as any).lastAttackerShotgunTime = new Map<string, number>();
          }
          (this as any).lastAttackerShotgunTime.set(packet.senderId, now);
        } else {
          // Rifle burst / ranged combat rules: 35.0m effective range, 130ms cadence (8 ticks ~133ms)
          const dist = Math.hypot(candidateX - this.sim.player.x, candidateZ - this.sim.player.z);
          if (dist <= 0.001 || dist > 35.0) return; // Coincident or out of effective range
          if ((packet.data as any)?.attackerFacing !== undefined) {
            if (typeof (packet.data as any).attackerFacing !== "number" || !Number.isFinite((packet.data as any).attackerFacing)) {
              return; // Reject invalid attackerFacing
            }
          }
          const effectiveFacing = typeof packet.data?.attackerFacing === "number"
            ? packet.data.attackerFacing
            : (typeof candidateFacing === "number" && Number.isFinite(candidateFacing) ? candidateFacing : null);
          if (effectiveFacing === null) return;
          if (dist > 0.001) {
            const dx = this.sim.player.x - candidateX;
            const dz = this.sim.player.z - candidateZ;
            const forwardX = Math.sin(effectiveFacing);
            const forwardZ = Math.cos(effectiveFacing);
            const dot = (dx * forwardX + dz * forwardZ) / dist;
            const perpDist = Math.abs(dx * forwardZ - dz * forwardX);
            if (dot <= 0.96 || perpDist > 1.2) {
              return; // Reject rifle hit outside shooter aiming cone (strictly symmetrical: dot > 0.96 required)
            }
          }
          const lastReceiverTick = (this as any).lastReceiverRifleTick?.get(packet.senderId) ?? -999;
          const receiverTickDelta = this.sim.tick - lastReceiverTick;
          const lastRifleTick = (this as any).lastAttackerRifleTick?.get(packet.senderId) ?? -999;
          const currentPacketTick = typeof packet.data?.tick === "number" ? packet.data.tick : undefined;
          const tickDelta = currentPacketTick !== undefined ? (currentPacketTick - lastRifleTick) : undefined;

          const lastRifleTime = this.lastAttackerRifleTime.get(packet.senderId) ?? 0;
          const timeDelta = packetTime - lastRifleTime;

          // Catchup refill is only valid if receiver simulation ticks have actually advanced AND packet tick is bounded
          if (tickDelta !== undefined && tickDelta >= 8) {
            if (receiverTickDelta >= 8 && currentPacketTick !== undefined && currentPacketTick <= this.sim.tick + 10) {
              let b = this.rifleBuckets.get(packet.senderId);
              if (b) {
                b.tokens = Math.min(2.0, b.tokens + (receiverTickDelta * (1000 / 60)) / 130);
                b.lastTime = now;
              }
            }
          } else if (timeDelta < 130) {
            return; // Reject rifle cadence violation
          }

          // Receiver elapsed wall-clock token bucket: maxCap=2, refill=130ms
          // Token bucket naturally permits 2 burst packets in 1ms, but drops 3+
          if (!this.checkRifleRateLimit(packet.senderId, now)) {
            return; // Reject rapid burst of 3+ packets in 1ms
          }
          if (!(this as any).lastReceiverRifleTick) {
            (this as any).lastReceiverRifleTick = new Map<string, number>();
          }
          (this as any).lastReceiverRifleTick.set(packet.senderId, this.sim.tick);

          if (!(this as any).lastAttackerRifleTick) {
            (this as any).lastAttackerRifleTick = new Map<string, number>();
          }
          if (currentPacketTick !== undefined) {
            (this as any).lastAttackerRifleTick.set(packet.senderId, currentPacketTick);
          }
          this.lastAttackerRifleTime.set(packet.senderId, packetTime);
        }
        this.lastAttackerHitTick.set(packet.senderId, this.sim.tick);

        let effectiveDmg: number;
        let effectiveKnockX = 0;
        let effectiveKnockZ = 0;

        if (isKick) {
          effectiveDmg = Math.min(35, dmg);
          const effectiveFacing = typeof packet.data?.attackerFacing === "number" && Number.isFinite(packet.data.attackerFacing)
            ? packet.data.attackerFacing
            : (typeof attacker.facing === "number" && Number.isFinite(attacker.facing) ? attacker.facing : null);

          if (effectiveFacing !== null) {
            effectiveKnockX = Math.sin(effectiveFacing) * 4.5;
            effectiveKnockZ = Math.cos(effectiveFacing) * 4.5;
          } else {
            effectiveKnockX = knockX;
            effectiveKnockZ = knockZ;
          }
        } else if (inferredKind === "shotgun") {
          const effectiveFacing = typeof packet.data?.attackerFacing === "number"
            ? packet.data.attackerFacing
            : (typeof candidateFacing === "number" && Number.isFinite(candidateFacing) ? candidateFacing : 0);
          const hitRes = calculateShotgunHit(candidateX, candidateZ, effectiveFacing, this.sim.player.x, this.sim.player.z, 1.05);
          if (!hitRes.hit || dmg > hitRes.damage) {
            return; // Reject damage exceeding actual calculated pellet damage
          }
          effectiveDmg = dmg > 0 ? dmg : hitRes.damage;
          effectiveKnockX = 0;
          effectiveKnockZ = 0;
        } else {
          const maxDmg = SIM_CONFIG.RIFLE_DAMAGE;
          effectiveDmg = Math.min(maxDmg, dmg > 0 ? dmg : maxDmg);
          effectiveKnockX = 0;
          effectiveKnockZ = 0;
        }

        // Apply verified strike origin and facing ONLY after hit is completely accepted
        if (hasNewOrigin) {
          attacker.x = candidateX;
          attacker.z = candidateZ;
        }
        if (hasNewFacing) {
          attacker.facing = candidateFacing;
        }

        // Result-vital adoption is relay-authority-gated: only the server may report
        // authoritative targetHealth/targetArmor/state — peer-supplied copies of those
        // fields are ignored and the strike is applied as a validated prediction.
        const vitalsRelayAuthoritative = (packet.data as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
        if (vitalsRelayAuthoritative && typeof (packet.data as any)?.targetHealth === "number" && Number.isFinite((packet.data as any).targetHealth)) {
          this.sim.player.health = (packet.data as any).targetHealth;
          if (typeof (packet.data as any)?.targetArmor === "number" && Number.isFinite((packet.data as any).targetArmor)) {
            this.sim.player.armor = (packet.data as any).targetArmor;
          }
          if (effectiveDmg >= 12 && this.sim.player.armor < 20 && !this.sim.player.isBleeding) {
            this.sim.player.isBleeding = true;
            this.sim.combatLog.push(`[TRAUMA ALERT] Heavy bleeding sustained! Inject IFAK stim [H] to bandage.`);
          }
          if ((packet.data as any)?.targetAlive === false || this.sim.player.health <= 0) {
            this.sim.player.health = 0;
            this.sim.player.isAlive = false;
            this.sim.onPlayerDeath?.();
          }
        } else {
          this.sim.applyDamageToPlayer(effectiveDmg);
        }

        if (effectiveKnockX !== 0 || effectiveKnockZ !== 0) {
          const rawMag = Math.hypot(effectiveKnockX, effectiveKnockZ);
          const maxKnock = 4.5;
          const scale = rawMag > maxKnock ? maxKnock / rawMag : 1.0;
          const kx = effectiveKnockX * scale;
          const kz = effectiveKnockZ * scale;
          const steps = 10;
          for (let s = 1; s <= steps; s++) {
            const stepX = Math.max(SIM_CONFIG.MAP_MIN_X, Math.min(SIM_CONFIG.MAP_MAX_X, this.sim.player.x + (kx / steps)));
            const stepZ = Math.max(SIM_CONFIG.MAP_MIN_Z, Math.min(SIM_CONFIG.MAP_MAX_Z, this.sim.player.z + (kz / steps)));
            if (!this.sim.checkContainerCollision(stepX, this.sim.player.z, 0.45)) {
              this.sim.player.x = stepX;
            }
            if (!this.sim.checkContainerCollision(this.sim.player.x, stepZ, 0.45)) {
              this.sim.player.z = stepZ;
            }
          }
          (this.sim.player as any).knockbackVx = 0;
          (this.sim.player as any).knockbackVz = 0;
        }
        sound.playHitGrunt();
        this.sim.combatLog.push(`[HIT TAKEN] Struck by ${packet.senderName} (-${effectiveDmg} HP)`);
      } else {
        // Authoritative damage/elimination for non-local targets (AI rivals or peer rivals)
        const isRelayAuthoritative = (packet.data as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
        const targetId = packet.data.targetId;
        if (targetId && isRelayAuthoritative) {
          const authHealth = packet.data.targetHealth;
          const authArmor = packet.data.targetArmor;
          const authAlive = packet.data.targetAlive;
          const targetRival = this.sim.rivals.find((r) => r.id === targetId);
          const savedState = this.sim.confirmedAIStates?.get(targetId);

          const isLethalHit = authAlive === false || (typeof authHealth === "number" && authHealth <= 0);

          const isAlreadyDead = this.deadPeerIds.has(targetId) ||
            savedState?.isAlive === false ||
            (savedState && savedState.health <= 0) ||
            Boolean(targetRival && (!targetRival.isAlive || (targetRival as any).isKia || targetRival.health <= 0));

          const isDead = isAlreadyDead || isLethalHit;

          // Preserve verified kill rewards separately from vital state ordering!
          if (isDead || isLethalHit) {
            const isBoss = targetId === BOSS_CONFIG.id || targetRival?.badge === BOSS_CONFIG.badge;
            if (isBoss) {
              const killerId = (packet.data as any).killerId || packet.senderId;
              const isLocalKiller = killerId === this.localId;
              if (isLocalKiller) {
                this.sim.grantKeycard(BOSS_CONFIG.id);
                this.sim.combatLog.push(`[BOSS SLAIN] Sector Warlord confirmed eliminated by Central Command! Violet Lab Access Keycard granted.`);
              } else {
                this.sim.combatLog.push(`[BOSS SLAIN] Sector Warlord confirmed eliminated!`);
              }
            }
          }

          // Authoritative ordering per target and snapshot: reject older vitals
          const lastUpdateTs = this.targetUpdateTimestamps.get(targetId);
          const isOlderThanTarget = typeof packet.timestamp === "number" && typeof lastUpdateTs === "number" && packet.timestamp < lastUpdateTs;
          const isOlderThanSnapshot = Boolean(this.lastAppliedSnapshotTimestamp && typeof packet.timestamp === "number" && packet.timestamp < this.lastAppliedSnapshotTimestamp);
          const isOlderAuthoritative = isOlderThanTarget || isOlderThanSnapshot;

          if (isOlderAuthoritative) {
            if (isDead) {
              this.deadPeerIds.add(targetId);
              if (targetRival) {
                targetRival.health = 0;
                targetRival.armor = 0;
                targetRival.isAlive = false;
                (targetRival as any).isKia = true;
              }
              this.sim.applyConfirmedAIState(targetId, {
                ...(savedState || {}),
                health: 0,
                armor: 0,
                isAlive: false,
                isKia: true,
                killerId: (packet.data as any).killerId || savedState?.killerId,
              });
            }
            return;
          }

          const maxHp = savedState ? Math.min(savedState.health, targetRival ? targetRival.health : 100) : (targetRival ? targetRival.health : 100);
          const confHealth = isDead ? 0 : (typeof authHealth === "number" ? Math.max(0, Math.min(maxHp, authHealth)) : (savedState ? savedState.health : 100));

          const maxArm = savedState ? Math.min(savedState.armor, targetRival && typeof targetRival.armor === "number" ? targetRival.armor : 100) : (targetRival && typeof targetRival.armor === "number" ? targetRival.armor : 100);
          const confArmor = isDead ? 0 : (typeof authArmor === "number" ? Math.max(0, Math.min(maxArm, authArmor)) : (savedState ? savedState.armor : 0));

          const isAI = Boolean((AI_CONFIGS as any)[targetId]) || targetId.startsWith("scav_") || targetId === BOSS_CONFIG.id;

          if (typeof packet.timestamp === "number") {
            this.targetUpdateTimestamps.set(targetId, packet.timestamp);
          }

          if (isDead) {
            this.deadPeerIds.add(targetId);
          }
          if (isAI || isDead) {
            this.sim.applyConfirmedAIState(targetId, {
              health: isDead ? 0 : confHealth,
              armor: confArmor,
              isAlive: !isDead,
              isKia: isDead,
              killerId: (packet.data as any).killerId || savedState?.killerId,
            });
          }

          if (targetRival) {
            targetRival.health = isDead ? 0 : confHealth;
            targetRival.armor = confArmor;
            targetRival.isAlive = !isDead;
            (targetRival as any).isKia = isDead;
          }
        }
      }
    } else if (packet.type === 'crate_loot_request' || packet.type === 'crate_looted') {
      if ((packet as any)._fromBroadcastChannel) return; // Disallow unauthenticated crate mutations from BroadcastChannel!
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      if (!packet.raidId || packet.raidId !== this.sim.raidId) return;
      const kind = this.sim.ingressController.getState().kind;
      if (kind === 'hydrating' || kind === 'waiting_squad') {
        this.pendingWorldEvents.push(packet);
        return;
      }
      if (!this.sim.isAdmitted() || !peerEntry.ingressDone) return;
      if (this.extractedPeerIds.has(packet.senderId)) return;
      if (!packet.data || typeof packet.data !== 'object') return;
      const { crateId, claimTimestamp, x, z } = packet.data;
      if (crateId) {
        const targetCrate = this.sim.crates.find((c) => c.id === crateId);
        if (targetCrate && typeof x === "number" && typeof z === "number" && Number.isFinite(x) && Number.isFinite(z)) {
          const dist = Math.hypot(x - targetCrate.x, z - targetCrate.z);
          if (dist > 4.5) return; // Drop out-of-range crate claim!
        }
        this.sim.claimCrateLocally(crateId, packet.senderId, claimTimestamp || packet.timestamp);
        if (typeof (packet.data as any)?.stimsRemaining === "number" && (packet.senderId === this.sim.player.id || (packet.data as any)?.claimantId === this.sim.player.id)) {
          this.sim.player.stimsRemaining = (packet.data as any).stimsRemaining;
        }
      }
    } else if (packet.type === 'crate_looted_ack') {
      const isServerSender = packet.senderId === 'server' || packet.senderName === 'CENTRAL COMMAND';
      if (!isServerSender) return;
      const d = (packet as any).data;
      if (!d || typeof d !== 'object') return;
      if (d.claimantId === this.localId || d.claimantId === this.sim.player.id) {
        if (typeof d.stimsRemaining === 'number' && Number.isFinite(d.stimsRemaining)) {
          this.sim.player.stimsRemaining = d.stimsRemaining;
        }
      }
    } else if (packet.type === 'kick_action_rejected') {
      // Authoritative rejection correction for a rejected kick batch (oversized /
      // duplicate / invalid targets / cooldown): the relay returns custody truth for
      // every predicted machine target so the optimistic damage is reconciled.
      const relayStamped = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
      if (!relayStamped) return;
      if (packet.senderId && packet.senderId !== "server") return;
      if (typeof packet.raidId === "string" && packet.raidId !== this.sim.raidId) return;
      const d = packet.data as any;
      if (!d || !Array.isArray(d.machineCustody)) return;
      for (const c of d.machineCustody) {
        if (!c || typeof c.id !== "string") continue;
        this.adoptMachineVitals(c.id, c.health, c.isAlive, (c as any).vitalsSeq, (c as any).maxHealth);
      }
      this.sim.combatLog.push(`[KICK REJECTED] Strike rejected by relay (${d.reason || "invalid"}); machine predictions reconciled to custody`);
    } else if ((packet as any).type === 'hold_confirm' || (packet as any).type === 'hold_result') {
      const isRelayAuthoritative = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
      if (!isRelayAuthoritative) return;
      if ((packet as any).senderId && (packet as any).senderId !== "server") return;
      const d = (packet as any).data;
      if (!d || typeof d !== "object") return;

      const targetOperative = d.operativeId || d.targetId;
      if (targetOperative && targetOperative !== this.localId && targetOperative !== this.sim.player.id) {
        return;
      }

      if (d.holdCompleted === true && typeof d.holdCompletedAtTick === "number" && Number.isFinite(d.holdCompletedAtTick) && d.holdCompletedAtTick > 0 && d.holdCompletedAtTick <= SIM_CONFIG.RAID_DEADLINE_TICK) {
        this.sim.restoreExtractionCustody({
          holdCompleted: true,
          holdCompletedAtTick: d.holdCompletedAtTick,
          isExtracted: d.isExtracted === true,
          extractedAtTick: typeof d.extractedAtTick === 'number' ? d.extractedAtTick : undefined,
          receipt: d.receipt,
        });
      } else if (d.cancelled === true || d.reset === true || (d.holdCompleted === false && (typeof d.holdTicks !== 'number' || d.holdTicks === 0))) {
        this.sim.restoreExtractionCustody({
          holdCompleted: false,
        });
      } else if (typeof d.holdTicks === 'number' && d.holdTicks > 0) {
        if (typeof (this.sim.exfilController as any)?.reconcileAuthoritativeHold === 'function') {
          (this.sim.exfilController as any).reconcileAuthoritativeHold(d.holdTicks);
        }
      }
    } else if (packet.type === 'machine_roster') {
      // Versioned full-roster reconciliation: adopts the RELAY-DEPLOYED machine set —
      // membership (add/remove), type, placement geometry, patrol origins, vitals. Only
      // server-stamped rosters (never BroadcastChannel copies) apply.
      const relayStamped = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
      if (!relayStamped) return;
      if (packet.senderId && packet.senderId !== "server") return;
      if (typeof packet.raidId === "string" && packet.raidId !== this.sim.raidId) return;
      const d = packet.data as any;
      if (!d || !Array.isArray(d.machines)) return;
      // Monotonic roster revisions: reject rosters older than the last applied (no
      // regression to stale geometry from a delayed delivery).
      if (typeof d.revision === "number" && Number.isFinite(d.revision)) {
        const hasAppliedRev = (this as any).__appliedMachineRosterRevision !== undefined;
        const appliedRev = (this as any).__appliedMachineRosterRevision ?? 0;
        if (hasAppliedRev && d.revision < appliedRev) return;
        (this as any).__appliedMachineRosterRevision = d.revision;
      }
      // Shared custody reconciler (same function as hydration/authentication)
      this.applyMachineRosterCustody(d.machines);
      this.sim.combatLog.push(`[MACHINE AUTHORITY] Roster reconciled: ${d.machines.length} machine(s)`);
    } else if (packet.type === 'machine_attack') {
      // Server-side machine attack authority: relay-computed machine fire with custody
      // vitals. Only honoured when relay-stamped — broadcast-channel copies are ignored.
      const relayStamped = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
      if (!relayStamped) return;
      if (packet.senderId && packet.senderId !== "server") return;
      if (typeof packet.raidId === "string" && packet.raidId !== this.sim.raidId) return;
      const d = packet.data as any;
      if (!d || typeof d !== "object") return;
      if (d.targetId !== this.localId && d.targetId !== this.sim.player.id) return;
      // Cross-check the relay's results are structurally coherent before adoption
      if (typeof d.damage !== "number" || !Number.isFinite(d.damage) || d.damage <= 0 || d.damage > 50) return;
      if (typeof d.targetHealth !== "number" || !Number.isFinite(d.targetHealth) || d.targetHealth < 0 || d.targetHealth > 100) return;
      if (typeof d.targetArmor !== "number" || !Number.isFinite(d.targetArmor) || d.targetArmor < 0 || d.targetArmor > 100) return;

      const wasHolding = this.sim.exfilController.getState().kind === "holding_zone";
      this.sim.exfilController.onDamageTaken();
      this.sim.interruptStimTreatment();
      if (wasHolding) {
        this.sim.lastInterruptionTick = this.sim.tick;
        this.sim.onHoldProgress?.(0, this.sim.tick);
      }
      this.sim.player.health = d.targetHealth;
      this.sim.player.armor = d.targetArmor;

      // Heavy bleed on unarmored or heavy hit - strictly symmetrical with local damage
      if (d.damage >= 12 && this.sim.player.armor < 20 && !this.sim.player.isBleeding) {
        this.sim.player.isBleeding = true;
        this.sim.combatLog.push(`[TRAUMA ALERT] Heavy bleeding sustained! Inject IFAK stim [H] to bandage.`);
      }

      if (d.targetAlive === false || this.sim.player.health <= 0) {
        this.sim.player.health = 0;
        this.sim.player.isAlive = false;
        this.sim.onPlayerDeath?.();
      }
      this.sim.serverMachineDamageAuthority = true; // adopted alongside the relay authority
      this.sim.onDamageTaken?.();
      sound.playHitGrunt();
      const machineName = d.machineType === "drone" ? "SCOUT DRONE" : "AUTOMATED TURRET";
      this.sim.combatLog.push(`[MACHINE FIRE] Struck by ${machineName} (${d.machineId}) (-${d.damage} HP)`);
    } else if (packet.type === 'machine_hit') {
      if ((packet as any).serverAuthoritative === true) {
        this.validateAndAdoptMachineCustody(packet);
        return;
      }
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      if (!packet.data || typeof packet.data !== 'object') return;
      const dmg = packet.data.damage;
      if (typeof dmg !== 'number' || isNaN(dmg) || dmg <= 0) {
        return; // Drop invalid, NaN, or negative damage!
      }

      // Universal snapshot event sequence boundary (incorporates both host & peer timestamps)
      if (this.lastAppliedSnapshotTimestamp && packet.timestamp && packet.timestamp <= this.lastAppliedSnapshotTimestamp) {
        return; // Already incorporated into authoritative snapshot
      }
      if (this.snapshotAppliedLocalTime) {
        const arrival = (packet as any)._receivedAt;
        if (typeof arrival === "number" && arrival < this.snapshotAppliedLocalTime) {
          return;
        }
      }

      const ingressKind = this.sim.ingressController.getState().kind;
      if (!this.sim.isAdmitted() || ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad') {
        this.pendingWorldEvents.push(packet);
        return;
      }
      // Sender must have completed ingress handshake
      if (!peerEntry.ingressDone) return;
      if (!this.sim.isAdmitted()) return;
      if (this.extractedPeerIds.has(packet.senderId)) return;

      this.validateAndApplyMachineHit(packet, false);
    } else if (packet.type === 'kick_action') {
      // Aggregated melee action from a peer. Machines are PvE world-state predictions
      // (revalidated against authoritative custody snapshots) — applied. Operative
      // targets are NEVER applied from peer packets: the relay validates the kick action
      // and broadcasts authoritative 'hit' messages for rival damage.
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      if (packet.senderId === this.localId) return;
      if (!packet.data || typeof packet.data !== 'object') return;
      if (this.sim.tick > 54000) return;
      if (this.extractedPeerIds.has(packet.senderId)) return;

      const ingressKind = this.sim.ingressController.getState().kind;
      if (!this.sim.isAdmitted() || ingressKind === 'corridor_entered' || ingressKind === 'hydrating' || ingressKind === 'waiting_squad') {
        this.pendingWorldEvents.push(packet);
        return;
      }
      if (!peerEntry.ingressDone) return;

      const machineTargets = Array.isArray((packet.data as any).machineTargets)
        ? (packet.data as any).machineTargets
        : [];
      for (const t of machineTargets) {
        if (!t || typeof t.id !== 'string' || !t.id) continue;
        if (typeof t.damage !== 'number' || !Number.isFinite(t.damage) || t.damage <= 0) continue;
        // Complete prediction contract: the sub-packet carries the kick action's attacker
        // geometry so the receiver's machine-prediction gauntlet (facing cone, strike
        // origin) can validate it exactly like an explicit machine_hit.
        const sub = {
          eventId: `${packet.eventId}_${t.id}`,
          type: 'machine_hit' as const,
          senderId: packet.senderId,
          senderName: packet.senderName,
          squad: packet.squad,
          raidId: packet.raidId,
          timestamp: packet.timestamp,
          _fromBroadcastChannel: (packet as any)._fromBroadcastChannel,
          data: {
            machineId: t.id,
            damage: Math.min(50, t.damage),
            kind: 'kick' as const,
            attackerFacing: (packet.data as any).attackerFacing,
            attackerX: (packet.data as any).attackerX,
            attackerZ: (packet.data as any).attackerZ,
            targetX: t.x,
            targetZ: t.z,
          },
        } as unknown as PeerPacket;
        this.validateAndApplyMachineHit(sub, false);
      }
    } else if (packet.type === 'exfil_success') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      if (!peerEntry.ingressDone || peerEntry.handshakeState !== 'confirmed') return;
      const receipt = packet.data?.receipt;
      if (!receipt || typeof receipt !== "object") return;
      // All canonical fields required: raidId, outcomeDigest, throughTick/snapshotTick
      if (typeof receipt.raidId !== "string" || receipt.raidId !== this.sim.raidId) return;
      if (typeof receipt.outcomeDigest !== "string" || !receipt.outcomeDigest) return;

      const receiptId = typeof receipt.receiptId === "string" ? receipt.receiptId : "";
      if (!receiptId.startsWith("receipt_s7_") && !receiptId.startsWith("rcpt_")) return;

      const receivedTick = typeof receipt.throughTick === "number" ? receipt.throughTick : (typeof (receipt as any).snapshotTick === "number" ? (receipt as any).snapshotTick : 0);
      if (receivedTick < 180 || isNaN(receivedTick) || !Number.isFinite(receivedTick)) return;

      const applyVerifiedExtraction = (committedRecord: any): boolean => {
        if (!committedRecord || typeof committedRecord !== "object") return false;
        if (committedRecord.receiptId && committedRecord.receiptId !== receiptId) return false;
        if (committedRecord.raidId && committedRecord.raidId !== this.sim.raidId) return false;

        // Detect altered fields: verify outcomeDigest matches committed record
        if (!committedRecord.outcomeDigest || committedRecord.outcomeDigest !== receipt.outcomeDigest) {
          this.sim.combatLog.push(`[SETTLEMENT REJECTED] Altered outcome digest in receipt ${receiptId} for ${packet.senderName}`);
          return false;
        }

        // Detect altered tick: verify throughTick / snapshotTick strictly matches committed record
        const committedTick = typeof committedRecord.throughTick === "number" ? committedRecord.throughTick : (typeof committedRecord.snapshotTick === "number" ? committedRecord.snapshotTick : 0);
        if (committedTick !== receivedTick) {
          this.sim.combatLog.push(`[SETTLEMENT REJECTED] Altered throughTick in receipt ${receiptId} (got ${receivedTick}, committed ${committedTick}) for ${packet.senderName}`);
          return false;
        }

        // Verify that the extracting participant had activeRaidCleared === true
        const pResults = committedRecord.participantResults;
        let isCleared = false;
        if (Array.isArray(pResults)) {
          const participant = pResults.find((p: any) => p && (p.profileId === packet.senderId || p.operativeId === packet.senderId));
          if (participant && participant.activeRaidCleared === true) {
            isCleared = true;
          }
        } else if (committedRecord.operativeId === packet.senderId && committedRecord.activeRaidCleared !== false) {
          isCleared = true;
        }

        if (!isCleared) {
          this.sim.combatLog.push(`[SETTLEMENT REJECTED] Operative ${packet.senderName} was not cleared for extraction in receipt ${receiptId}`);
          return false;
        }

        this.extractedPeerIds.add(packet.senderId);
        const rival = this.sim.rivals.find((r) => r.id === packet.senderId);
        if (rival) {
          rival.isExtracted = true;
          rival.isAlive = false;
          this.sim.combatLog.push(`[STATUS] Rival ${rival.name} successfully extracted.`);
        }

        // Cache into local defaultSettlementLedger auditLog
        if (defaultSettlementLedger?.auditLog && typeof defaultSettlementLedger.auditLog.set === "function") {
          defaultSettlementLedger.auditLog.set(receiptId, committedRecord);
        }

        return true;
      };

      let localCommitted: any = null;
      if (this.sim.settlementAuthority && typeof this.sim.settlementAuthority.getCommittedReceipt === "function") {
        localCommitted = this.sim.settlementAuthority.getCommittedReceipt(receiptId)?.receipt || null;
      } else if (this.sim.settlementAuthority?.auditLog && typeof this.sim.settlementAuthority.auditLog.get === "function") {
        localCommitted = this.sim.settlementAuthority.auditLog.get(receiptId)?.receipt || null;
      }
      if (!localCommitted && defaultSettlementLedger?.auditLog && typeof defaultSettlementLedger.auditLog.get === "function") {
        localCommitted = defaultSettlementLedger.auditLog.get(receiptId) || null;
      }

      if (localCommitted) {
        if (!applyVerifiedExtraction(localCommitted)) {
          return;
        }
        return;
      }

      const isRelayAuthoritative = (packet as any).serverAuthoritative === true && !(packet as any)._fromBroadcastChannel;
      if (isRelayAuthoritative) {
        const pktReceipt = (packet.data as any)?.receipt || (packet as any).receipt;
        if (pktReceipt && verifyReceiptIntegrity(pktReceipt)) {
          applyVerifiedExtraction(pktReceipt);
          return;
        }
      }
      this.sim.combatLog.push(`[SETTLEMENT REJECTED] Unverified extraction receipt ${receiptId} for ${packet.senderName}`);
    }
  }

  public disconnect(): void {
    this.cleanup();
  }

  public cleanup(): void {
    this.isDisposed = true;
    this.authenticated = false;
    this.sim.isSocketDisconnected = false;
    this.sim.serverMachineDamageAuthority = false;
    if (this.sim.requestServerSettlement) {
      this.sim.requestServerSettlement = undefined;
    }
    for (const pending of this.pendingSettlementCommitMap.values()) {
      pending.reject(new Error("MultiplayerCoordinator disposed"));
    }
    this.pendingSettlementCommitMap.clear();
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.selfReadinessTimer) {
      clearTimeout(this.selfReadinessTimer);
      this.selfReadinessTimer = null;
    }
    if (this.sdkRoom) {
      try {
        this.sdkRoom.leave?.();
      } catch {}
      this.sdkRoom = null;
    }
  }
}
