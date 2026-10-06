/**
 * @file multiplayer.ts
 * Real-time peer-to-peer multiplayer synchronization via BroadcastChannel
 * and Vite HMR WebSocket relay with event-id deduplication, staged ingress lifecycle,
 * shared world loot/destruction, and cross-browser hit/knockback coordination.
 */

import type { SectorDepotSimulation, OperativeState, StickActionState, KickActionPayload } from './game.js';
import { DEPOT_CONTAINERS, segmentIntersectsAABB } from './game.js';
import type { RaidWorldSnapshot, SettlementReceipt } from './airlock.js';
import { defaultSettlementLedger } from './airlock.js';
import { SIM_CONFIG } from './config.js';
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
}

export interface HitPacketData {
  tick?: number;
  targetId?: string;
  damage?: number;
  knockX?: number;
  knockZ?: number;
  kind?: 'rifle' | 'kick';
  attackerFacing?: number;
  attackerX?: number;
  attackerZ?: number;
  targetHealth?: number;
  targetArmor?: number;
  targetAlive?: boolean;
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
  machineCustody?: Array<{ id?: string; health?: number; isAlive?: boolean; x?: number; z?: number }>;
}

export interface MachineRosterPacketData {
  machines?: Array<{ id: string; type?: string; x?: number; y?: number; z?: number; facing?: number; health?: number; isAlive?: boolean; originX?: number; originZ?: number }>;
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
  kind?: "rifle" | "kick";
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
}

export type PeerPacket =
  | (PeerPacketBase & { type: 'state'; data: StatePacketData })
  | (PeerPacketBase & { type: 'hit'; data: HitPacketData })
  | (PeerPacketBase & { type: 'hit_confirmed'; data: HitConfirmedPacketData })
  | (PeerPacketBase & { type: 'fire'; data?: FirePacketData })
  | (PeerPacketBase & { type: 'kick_action'; data: KickActionPacketData })
  | (PeerPacketBase & { type: 'crate_loot_request'; data: CrateLootPacketData })
  | (PeerPacketBase & { type: 'crate_looted'; data: CrateLootPacketData })
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

export class MultiplayerCoordinator {
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
  public channel: BroadcastChannel | null = null;
  public ws: WebSocket | null = null;
  public connectedPeers: Map<string, PeerEntry> = new Map();
  private sim: SectorDepotSimulation;
  private seq = 0;
  private seenEvents = new Set<string>();
  private boundHotHandler: ((data: any) => void) | null = null;
  public pruneInterval: any = null;
  public serverTimeOffset: number = 0;
  public lastServerMessageTime: number = Date.now();

  public getServerNow(): number {
    return Date.now() + (this.serverTimeOffset || 0);
  }
  private selfReadinessTimer: any = null;
  private discoveryInterval: any = null;
  public pendingWorldEvents: Array<PeerPacket> = [];
  public extractedPeerIds = new Set<string>();
  public deadPeerIds = new Set<string>();
  public deadPeerTimestamps = new Map<string, number>();
  public admittedPeers = new Set<string>();
  public hostPeerId: string | null = null;
  private lastAttackerHitTick = new Map<string, number>();
  private lastAttackerRifleTime = new Map<string, number>();
  private lastAttackerKickTime = new Map<string, number>();
  private rifleBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private kickBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private machineRifleBuckets = new Map<string, { tokens: number; lastTime: number }>();
  private machineKickBuckets = new Map<string, { tokens: number; lastTime: number }>();

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

  private checkMachineHitRateLimit(key: string, isKick: boolean, now: number): boolean {
    const bucketMap = isKick ? this.machineKickBuckets : this.machineRifleBuckets;
    const maxCap = isKick ? 1.0 : 3.0;
    const cadence = isKick ? 600 : 130;
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
  private reconnectTimer: any = null;
  private raidClockSyncInterval: any = null;

  constructor(sim: SectorDepotSimulation) {
    this.sim = sim;

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
      this.sim.player.x = SIM_CONFIG.SPAWN_SQUAD_A.x;
      this.sim.player.z = SIM_CONFIG.SPAWN_SQUAD_A.z;
    }

    // Connect callbacks from simulation
    this.sim.onHitTarget = (targetId, damage, knockX, knockZ) => {
      this.broadcastHit(targetId, damage, knockX, knockZ);
    };

    this.sim.onRequestLootCrate = (crateId, cashValue) => {
      this.requestCrateLoot(crateId, cashValue);
    };

    this.sim.onLootCrate = (crateId, cash) => {
      this.broadcastCrateLooted(crateId, cash);
    };

    this.sim.onMachineHit = (machineId, damage, kind) => {
      this.broadcastMachineHit(machineId, damage, kind);
    };

    this.sim.onKickAction = (action) => {
      this.sendKickAction(action);
    };

    this.sim.onExfilSuccess = (receipt?: any) => {
      this.broadcastExfilSuccess(receipt);
    };

    const origOnPlayerDeath = this.sim.onPlayerDeath;
    this.sim.onPlayerDeath = () => {
      origOnPlayerDeath?.();
      this.broadcastState(0);
    };

    // 1. Listen on BroadcastChannel for fast same-process tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('stick_zone_mesh');
      this.channel.onmessage = (event) => {
        const p = event.data as any;
        if (p) {
          p._fromBroadcastChannel = true;
          this.handleMessage(p as PeerPacket);
        }
      };
    }

    // 1b. Dedicated production WebSocket relay at /syncplay-ws (connected once sessionToken is present)
    if (this.sim.sessionToken) {
      this.connectWebSocket(this.sim.sessionToken);
    }

    // 2. Listen on Vite HMR WebSocket for separate browser contexts / external devices
    if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
      this.boundHotHandler = (packet: PeerPacket) => this.handleMessage(packet);
      (import.meta as any).hot.on('stick:peer_packet', this.boundHotHandler);
    }

    const isResumingSession = (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(`sz_session_${this.sim.raidId}_${this.localId}`));
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
        const isResuming = (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(`sz_session_${this.sim.raidId}_${this.localId}`));
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
          this.sim.combatLog.push(`[STAGED INGRESS] Squad Alpha host confirmed active at tick ${this.sim.tick}`);
        }
      }, 300);
    };

    if (typeof fetch !== "undefined") {
      const savedRaid = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("sz_active_raid") : null;
      const query = savedRaid ? `?raidId=${encodeURIComponent(savedRaid)}` : "";
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
      fetch(`/api/settlement/active-raid${query}`, { signal: controller ? controller.signal : undefined })
        .then((res) => res.json())
        .finally(() => { if (timeoutId) clearTimeout(timeoutId); })
        .then((data) => {
          if (this.isDisposed) return;
          if (data && data.activeRaidId) {
            if (savedRaid) {
              this.sim.raidId = savedRaid;
            } else if (this.sim.ingressController.getState().kind !== "confirmed_active") {
              this.sim.raidId = data.activeRaidId;
            }
            const currentTick = typeof data.raidTick === "number" ? data.raidTick : this.sim.tick;
            if (!isResumingSession && currentTick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
              this.sim.combatLog.push(`[INGRESS DENIED] Raid ${data.activeRaidId} exceeded 8-minute ingress limit (tick ${currentTick})`);
              return;
            }
            {
              const consumeH = (globalThis as any).__stickZoneConsumeAccumulatorMs;
              const advH = currentTick - this.sim.tick;
              this.sim.tick = Math.max(this.sim.tick, currentTick);
              if (advH > 0 && typeof consumeH === "function") { try { consumeH((advH * 1000) / 60); } catch {} }
            }
            if (data.crates) {
              const crateEntries = Object.entries(data.crates as Record<string, any>).map(([cid, cinfo]) => ({
                id: cid,
                opened: !!cinfo?.claimedBy,
                claimedBy: cinfo?.claimedBy,
                claimedAt: cinfo?.claimTimestamp || cinfo?.serverClaimedAt || 0,
              }));
              this.sim.restoreCrateStateFromSnapshot(crateEntries);
            }
            if (data.machines && Array.isArray(data.machines)) {
              this.serverMachines = JSON.parse(JSON.stringify(data.machines));
              // Full roster reconciliation (hydration): membership + geometry + vitals
              // via the shared custody reconciler — reconnecting clients never retain
              // removed machines or miss deployed ones.
              this.applyMachineRosterCustody(data.machines);
            }
            if (typeof data.holdCompleted === "boolean" || typeof data.isExtracted === "boolean" || typeof data.holdCompletedAtTick === "number") {
              this.sim.restoreExtractionCustody({
                holdCompleted: !!data.holdCompleted,
                holdCompletedAtTick: data.holdCompletedAtTick || 0,
                isExtracted: !!data.isExtracted,
                extractedAtTick: data.extractedAtTick || 0,
              });
            }
          }
          if (!isPlayer2) startHostIngress();
        })
        .catch(() => {
          if (this.isDisposed) return;
          if (!isPlayer2) startHostIngress();
        });
    } else {
      if (!isPlayer2) startHostIngress();
    }

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
        const query = this.sim.raidId ? `?raidId=${encodeURIComponent(this.sim.raidId)}` : "";
        const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const tid = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
        fetch(`/api/settlement/active-raid${query}`, { signal: ctrl ? ctrl.signal : undefined })
          .then((res) => res.json())
          .finally(() => { if (tid) clearTimeout(tid); })
          .then((data) => {
            if (data && this.sim.ingressController.getState().kind !== "confirmed_active") {
              if (data.activeRaidId) this.sim.raidId = data.activeRaidId;
              const currentTick = typeof data.raidTick === "number" ? data.raidTick : this.sim.tick;
              {
              const consumeH = (globalThis as any).__stickZoneConsumeAccumulatorMs;
              const advH = currentTick - this.sim.tick;
              this.sim.tick = Math.max(this.sim.tick, currentTick);
              if (advH > 0 && typeof consumeH === "function") { try { consumeH((advH * 1000) / 60); } catch {} }
            }
              if (data.crates) {
                const crateEntries = Object.entries(data.crates as Record<string, any>).map(([cid, cinfo]) => ({
                  id: cid,
                  opened: !!cinfo?.claimedBy,
                  claimedBy: cinfo?.claimedBy,
                  claimedAt: cinfo?.claimTimestamp || cinfo?.serverClaimedAt || 0,
                }));
                this.sim.restoreCrateStateFromSnapshot(crateEntries);
              }
              if (typeof data.holdCompleted === "boolean" || typeof data.isExtracted === "boolean" || typeof data.holdCompletedAtTick === "number") {
                this.sim.restoreExtractionCustody({
                  holdCompleted: !!data.holdCompleted,
                  holdCompletedAtTick: data.holdCompletedAtTick || 0,
                  isExtracted: !!data.isExtracted,
                  extractedAtTick: data.extractedAtTick || 0,
                });
              }
              if (data.machines && Array.isArray(data.machines)) {
                for (const mData of data.machines) {
                  const m = this.sim.machines.find((x) => x.id === mData.id);
                  if (m) {
                    m.health = Math.min(m.health, mData.health);
                    m.isAlive = mData.isAlive && m.health > 0;
                  }
                }
              }
              const kind = this.sim.ingressController.getState().kind;
              if (kind === "corridor_entered" || kind === "idle" || kind === "waiting_squad") {
                if (kind === "idle") this.sim.ingressController.enterCorridor(this.sim.tick, true);
                this.sim.ingressController.startHydration(this.sim.tick);
                this.sim.ingressController.applySnapshot(this.createRaidSnapshot());
                this.sim.ingressController.squadAck(1, 1);
                this.sim.ingressController.activate(this.sim.tick);
              }
            }
          })
          .catch(() => {});
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

  public applyValidatedMachineHit(senderName: string, machineId: string, damage: number, authorHealth?: number, authorAlive?: boolean): void {
    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0 || damage > 150) return;
    const machine = this.sim.machines.find((m) => m.id === machineId);
    if (machine) {
      const maxHp = (machine as any).maxHealth ?? (machine.type === 'drone' ? 75 : 120);
      if (typeof authorHealth === "number" && Number.isFinite(authorHealth)) {
        const clampedHp = Math.max(0, Math.min(maxHp, authorHealth));
        machine.health = clampedHp;
        machine.isAlive = authorAlive !== false && clampedHp > 0;
      } else if (machine.isAlive) {
        machine.health = Math.max(0, machine.health - damage);
        if (machine.health <= 0) {
          machine.health = 0;
          machine.isAlive = false;
        }
      }
      if (!machine.isAlive && machine.health <= 0) {
        this.sim.combatLog.push(`[MACHINE DESTROYED] ${machine.id} neutralized by ${senderName}`);
      }
    }
  }

  public validateAndApplyMachineHit(packet: PeerPacket, isReplay = false): boolean {
    if (!packet || !packet.data) return false;
    const machineId = (packet.data as any).machineId;
    if (typeof machineId !== 'string' || !machineId) return false;

    const rawKind = (packet.data as any).kind;
    const dmg = typeof (packet.data as any).damage === 'number' ? (packet.data as any).damage : 0;
    const attackKind = rawKind || (dmg > 30 ? 'kick' : 'rifle');
    if (attackKind !== 'kick' && attackKind !== 'rifle') return false;

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
    } else {
      if (dist <= 0.001 || dist > 35.0) return false;
      if (dist > 0.001) {
        const dx = targetX - attacker.x;
        const dz = targetZ - attacker.z;
        const forwardX = Math.sin(attacker.facing);
        const forwardZ = Math.cos(attacker.facing);
        const dot = (dx * forwardX + dz * forwardZ) / dist;
        const perpDist = Math.abs(dx * forwardZ - dz * forwardX);
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
    const packetTime = typeof packet.timestamp === 'number' && packet.timestamp > 0 ? packet.timestamp : now;
    const lastHitKey = `${packet.senderId}:${machineId}`;
    const minInterval = attackKind === 'kick' ? 600 : 130;

    // Receiver rate limit token bucket (allows bursts for simulation catch-up, enforces sustained cadence)
    const effectiveTime = isReplay ? packetTime : now;
    const isDeathConfirmation = (packet as any).data?.machineAlive === false || (packet as any).data?.machineHealth === 0;
    // Authoritative custody overrides (relay-confirmed machineHealth) always apply —
    // they never repeat prediction damage: they overwrite the value verbatim, so the
    // per-attacker rate limiter must not drop them.
    const hasAuthoritativeOverride = hasAuthoritativeMachineHealth;
    if (!isDeathConfirmation && !hasAuthoritativeOverride && !this.checkMachineHitRateLimit(lastHitKey, attackKind === 'kick', effectiveTime)) {
      return false;
    }

    const lastPacketKey = `${lastHitKey}:${attackKind}:packet`;
    if (!(this as any).lastPacketMachineHitTime) {
      (this as any).lastPacketMachineHitTime = new Map<string, number>();
    }
    (this as any).lastPacketMachineHitTime.set(lastPacketKey, packetTime);

    const maxAllowed = attackKind === 'kick' ? 50 : 24;
    const effectiveDmg = Math.min(maxAllowed, dmg > 0 ? dmg : maxAllowed);
    const authorHealth = machineCustodyAuth && typeof (packet as any).data?.machineHealth === 'number' ? (packet as any).data.machineHealth : undefined;
    const authorAlive = machineCustodyAuth && typeof (packet as any).data?.machineAlive === 'boolean' ? (packet as any).data.machineAlive : undefined;
    this.applyValidatedMachineHit(packet.senderName, machineId, effectiveDmg, authorHealth, authorAlive);
    return true;
  }

  private flushPendingWorldEvents(): void {
    if (!this.pendingWorldEvents.length) return;
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
    if (this.raidClockSyncInterval || this.isDisposed) return;
    if (typeof fetch === "undefined") return;
    this.raidClockSyncInterval = setInterval(() => {
      if (this.isDisposed || !this.authenticated) return;
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const tid = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
      fetch(`/api/settlement/active-raid?raidId=${encodeURIComponent(this.sim.raidId)}`, {
        signal: ctrl ? ctrl.signal : undefined,
        headers: this.sim.sessionToken ? { Authorization: `Bearer ${this.sim.sessionToken}` } : {},
      })
        .then((res) => (res.ok ? res.json() : null))
        .finally(() => { if (tid) clearTimeout(tid); })
        .then((data) => {
          const serverTick = data?.raidTick;
          if (typeof serverTick === "number" && Number.isFinite(serverTick) && serverTick > this.sim.tick && serverTick <= 57600) {
            // Fast-forward only — and CONSUME the equivalent elapsed time from the
            // frame accumulator (exposed by App via __stickZoneConsumeAccumulatorMs),
            // so the frame loop cannot re-execute the reconciled interval and the
            // local clock doubles no time (single-owner tick advancement).
            const advancedTicks = Math.floor(serverTick) - this.sim.tick;
            this.sim.tick = Math.floor(serverTick);
            const consume = (globalThis as any).__stickZoneConsumeAccumulatorMs;
            if (typeof consume === "function") {
              try { consume((advancedTicks * 1000) / 60); } catch {}
            }
          }
        })
        .catch(() => {});
    }, 2000);
  }

  public connectWebSocket(token?: string): void {
    if (this.isDisposed) return;
    if (typeof window === "undefined" || !("WebSocket" in window) || !window.location) return;
    const tok = token || (this.sim as any).sessionToken;
    if (!tok) return; // Do not connect without authenticated session token!
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.authenticated = false;
    (this as any).connectionStartTime = Date.now();
    try {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/syncplay-ws?token=${encodeURIComponent(tok)}&raidId=${encodeURIComponent(this.sim.raidId)}`;
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.broadcastRaidDiscovery();
      };
      this.ws.onmessage = async (event) => {
        this.lastServerMessageTime = Date.now();
        try {
          const raw = typeof event.data === "string" ? event.data : (event.data instanceof Blob ? await event.data.text() : new TextDecoder().decode(event.data));
          const data = JSON.parse(raw);
          if (data && typeof (data as any).serverTime === "number") {
            this.serverTimeOffset = (data as any).serverTime - Date.now();
            if (typeof globalThis !== "undefined") (globalThis as any).__stickZoneServerTimeOffset = this.serverTimeOffset;
          }
          if (data && data.type === "heartbeat") {
            this.lastServerMessageTime = Date.now();
            return;
          }
          if (data && data.type === "state_correction" && !data.senderId && data.operativeId === this.localId && data.raidId === this.sim.raidId) {
            if (typeof data.x === "number" && typeof data.z === "number" && Number.isFinite(data.x) && Number.isFinite(data.z)) {
              if (Math.abs(data.x) <= 80 && Math.abs(data.z) <= 80) {
                this.sim.player.x = data.x;
                this.sim.player.z = data.z;
              }
            }
            return;
          }
          if (data && (data.type === "auth_success" || data.type === "auth")) {
            // Strictly guard: only accept server auth_success once during initial handshake (peers cannot send it!)
            if (!this.authenticated && data.type === "auth_success" && !data.senderId) {
              this.authenticated = true;
              if (typeof data.serverTime === "number") {
                this.serverTimeOffset = data.serverTime - Date.now();
                if (typeof globalThis !== "undefined") (globalThis as any).__stickZoneServerTimeOffset = this.serverTimeOffset;
              }
              if (typeof data.currentRaidTick === "number" && data.currentRaidTick > this.sim.tick) {
                // Single clock owner: adopt the server tick THROUGH the frame consumer
                // (drains the accumulator + advances lastTime — no double count).
                const consume = (globalThis as any).__stickZoneConsumeAccumulatorMs;
                const advTicks = data.currentRaidTick - this.sim.tick;
                this.sim.tick = data.currentRaidTick;
                if (typeof consume === "function") { try { consume((advTicks * 1000) / 60); } catch {} }
              }
              if (data.lastAcceptedPosition && typeof data.lastAcceptedPosition.x === "number" && typeof data.lastAcceptedPosition.z === "number" && Number.isFinite(data.lastAcceptedPosition.x) && Number.isFinite(data.lastAcceptedPosition.z)) {
                this.sim.player.x = data.lastAcceptedPosition.x;
                this.sim.player.z = data.lastAcceptedPosition.z;
              }
              if (typeof data.health === "number" && Number.isFinite(data.health)) {
                this.sim.player.health = data.health;
              }
              if (typeof data.armor === "number" && Number.isFinite(data.armor)) {
                this.sim.player.armor = data.armor;
              }
              if (data.isAlive === false || (typeof data.health === "number" && data.health <= 0)) {
                this.sim.player.isAlive = false;
                this.sim.player.health = 0;
              }
              // Authoritative weapon state: adopt persisted ammunition resolved from
              // custody at authentication (supports direct reconnects after restarts).
              if (typeof data.ammo === "number" && Number.isFinite(data.ammo) && data.ammo >= 0 && data.ammo <= 30) {
                this.sim.player.ammo = Math.floor(data.ammo);
              }
              this.ensureRaidClockReconciliation();
              this.sim.serverMachineDamageAuthority = true; // relay owns machine fire now
              if (Array.isArray(data.machines)) {
                // Full roster reconciliation (authentication): shared custody reconciler
                this.applyMachineRosterCustody(data.machines);
              }
              if (data.crates && typeof data.crates === "object") {
                const crateEntries = Object.entries(data.crates as Record<string, any>).map(([cid, cinfo]) => ({
                  id: cid,
                  opened: !!cinfo?.claimedBy,
                  claimedBy: cinfo?.claimedBy,
                  claimedAt: cinfo?.claimTimestamp || cinfo?.serverClaimedAt || 0,
                }));
                this.sim.restoreCrateStateFromSnapshot(crateEntries);
              }
              if (
                typeof data.holdCompleted === "boolean" ||
                typeof data.isExtracted === "boolean" ||
                typeof data.holdCompletedAtTick === "number" ||
                typeof data.extractedAtTick === "number"
              ) {
                this.sim.restoreExtractionCustody({
                  holdCompleted: !!data.holdCompleted,
                  holdCompletedAtTick: data.holdCompletedAtTick || 0,
                  isExtracted: !!data.isExtracted,
                  extractedAtTick: data.extractedAtTick || 0,
                });
              }
            }
            return; // Never forward or process auth packets as peer events
          }
          this.handleMessage(data);
        } catch {}
      };
      this.ws.onclose = (event) => {
        this.authenticated = false;
        this.sim.serverMachineDamageAuthority = false; // relay authority lost: local simulation resumes
        if (this.raidClockSyncInterval) {
          clearInterval(this.raidClockSyncInterval);
          this.raidClockSyncInterval = null;
        }
        if (this.isDisposed) return;
        if (event.code === 4009 || (typeof event.reason === "string" && event.reason.includes("superseded"))) {
          this.sim.combatLog.push("[NETWORK] Session terminated: operative slot claimed by newer connection.");
          return;
        }
        if (event.code === 4003) {
          if (typeof fetch !== "undefined") {
            this.reconnectTimer = setTimeout(async () => {
              if (this.isDisposed) return;
              let resumeKey: string | null = null;
              if (typeof sessionStorage !== "undefined") {
                resumeKey = sessionStorage.getItem(`sz_resume_${this.sim.raidId}_${this.sim.player.id}`);
              }
              const termCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
              const termTid = termCtrl ? setTimeout(() => termCtrl.abort(), 4000) : null;
              try {
                const res = await fetch("/api/settlement/join", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(this.sim.sessionToken ? { Authorization: `Bearer ${this.sim.sessionToken}` } : {}),
                    ...(resumeKey ? { "x-resumption-key": resumeKey } : {}),
                  },
                  signal: termCtrl ? termCtrl.signal : undefined,
                  body: JSON.stringify({
                    raidId: this.sim.raidId,
                    operativeId: this.sim.player.id,
                    ...(resumeKey ? { resumeKey } : {}),
                  }),
                });
                if (this.isDisposed) return;
                if (res.ok) {
                  const data = await res.json();
                  if (data && (data.isTerminal || data.isExtracted || data.isKia)) {
                    if (data.isExtracted) {
                      this.sim.restoreExtractionCustody({
                        isExtracted: true,
                        holdCompleted: true,
                        extractedAtTick: data.extractedAtTick || this.sim.tick,
                        receipt: data.receipt,
                      });
                      if (typeof sessionStorage !== "undefined") {
                        sessionStorage.setItem(`sz_exfil_${this.sim.raidId}_${this.sim.player.id}`, JSON.stringify({
                          isExtracted: true,
                          holdCompleted: true,
                          extractedAtTick: data.extractedAtTick || this.sim.tick,
                          receipt: data.receipt,
                        }));
                      }
                    } else if (data.isKia) {
                      this.sim.player.health = 0;
                      this.sim.player.isAlive = false;
                      if (typeof sessionStorage !== "undefined") {
                        sessionStorage.setItem(`sz_kia_${this.sim.raidId}_${this.sim.player.id}`, "true");
                      }
                    }
                    return;
                  }
                }
              } catch {} finally {
                if (termTid) clearTimeout(termTid);
              }

              try {
                const restartCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
                const restartTid = restartCtrl ? setTimeout(() => restartCtrl.abort(), 4000) : null;
                const activeRes = await fetch("/api/settlement/active-raid", { signal: restartCtrl ? restartCtrl.signal : undefined });
                if (restartTid) clearTimeout(restartTid);
                if (activeRes.ok) {
                  const activeData = await activeRes.json();
                  if (this.isDisposed) return;
                  if (activeData?.activeRaidId && activeData.activeRaidId !== this.sim.raidId) {
                    this.onRaidRestart?.(activeData.activeRaidId);
                  }
                }
              } catch {}
            }, 200);
          }
        } else if (event.code === 4001) {
          // Token expired or slot claim timed out during disconnect: retry with bounded exponential backoff
          if (typeof fetch !== "undefined") {
            this.sim.combatLog.push("[NETWORK] Session token expired. Renewing slot authorization via resumption credential...");
            const attemptRenewal = async (attempt: number) => {
              if (this.isDisposed) return;
              try {
                let resumeKey: string | null = null;
                if (typeof sessionStorage !== "undefined") {
                  resumeKey = sessionStorage.getItem(`sz_resume_${this.sim.raidId}_${this.sim.player.id}`);
                }
                const renewalCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
                const renewalTid = renewalCtrl ? setTimeout(() => renewalCtrl.abort(), 4000) : null;
                try {
                  const res = await fetch("/api/settlement/join", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(resumeKey ? { "x-resumption-key": resumeKey } : {}),
                    },
                    signal: renewalCtrl ? renewalCtrl.signal : undefined,
                    body: JSON.stringify({
                      raidId: this.sim.raidId,
                      operativeId: this.sim.player.id,
                      ...(resumeKey ? { resumeKey } : {}),
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (this.isDisposed) return;
                    const tok = data?.token;
                    const newResKey = data?.resumeKey;
                    if (tok) {
                      this.sim.sessionToken = tok;
                      if (typeof data?.ammo === "number") {
                        this.sim.player.ammo = data.ammo;
                      }
                      if (typeof sessionStorage !== "undefined") {
                        sessionStorage.setItem(`sz_session_${this.sim.raidId}_${this.sim.player.id}`, tok);
                        if (newResKey) sessionStorage.setItem(`sz_resume_${this.sim.raidId}_${this.sim.player.id}`, newResKey);
                      }
                      this.sim.combatLog.push("[NETWORK] Session link restored. Reconnecting...");
                      this.connectWebSocket(tok);
                      return;
                    }
                  }
                } finally {
                  if (renewalTid) clearTimeout(renewalTid);
                }
              } catch {}
              if (attempt < 5) {
                const backoffMs = Math.min(8000, 1000 * Math.pow(1.5, attempt));
                this.reconnectTimer = setTimeout(() => attemptRenewal(attempt + 1), backoffMs);
              } else {
                this.sim.combatLog.push("[NETWORK CRITICAL] Sector link lost: session expired or slot reallocated.");
              }
            };
            this.reconnectTimer = setTimeout(() => attemptRenewal(1), 1000);
          }
        } else if (event.code !== 1000) {
          this.reconnectTimer = setTimeout(() => {
            if (this.isDisposed) return;
            if (this.sim.sessionToken) {
              this.connectWebSocket(this.sim.sessionToken);
            }
          }, 1000);
        }
      };
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
        isResuming: isResuming ?? (this.sim.ingressController.getState().kind === 'confirmed_active' || (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(`sz_session_${this.sim.raidId}_${this.localId}`))),
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
        isResuming: isResuming ?? (this.sim.ingressController.getState().kind === 'confirmed_active' || (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(`sz_session_${this.sim.raidId}_${this.localId}`))),
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
        isInvulnerable: this.sim.player.isInvulnerable,
        isAdmitted: this.sim.isAdmitted(),
        ingressDone: true,
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

  public broadcastHit(targetId: string, damage: number, knockX?: number, knockZ?: number, kind?: 'rifle' | 'kick'): void {
    const attackKind = kind || (knockX !== undefined || knockZ !== undefined || damage === 35 ? 'kick' : 'rifle');
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

  public broadcastMachineHit(machineId: string, damage: number, kind?: "kick" | "rifle"): void {
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
    if (this.sim.sessionToken) {
      (packet as any).token = this.sim.sessionToken;
    }
    // Deliver via BroadcastChannel
    if (this.ws && this.ws.readyState === 1) {
      if (this.ws.bufferedAmount && this.ws.bufferedAmount > 65536) {
        if (packet.type === "state" || (packet as any).type === "hold_tick") {
          return; // Prevent send buffer bloat on high-frequency telemetry packets
        }
      }
      try {
        this.ws.send(JSON.stringify(packet));
      } catch {}
    }

    if (this.channel) {
      try {
        const channelPacket = { ...packet };
        delete (channelPacket as any).token;
        if (channelPacket.data && typeof channelPacket.data === "object") {
          channelPacket.data = { ...channelPacket.data };
          delete (channelPacket.data as any).token;
        }
        this.channel.postMessage(channelPacket);
      } catch {}
    }
    // AND Deliver via Vite HMR WebSocket mesh (enables cross-browser & separate Playwright contexts)
    if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
      try {
        (import.meta as any).hot.send('stick:peer_packet', packet);
      } catch {}
    }
  }

  public pruneExpiredPeers(maxIdleMs = 10000): void {
    const now = Date.now();
    // Socket silent stall detection: if authenticated socket has had no incoming server traffic for >5000ms, force close to trigger reconnect
    if (this.ws && this.ws.readyState === 1 && this.authenticated) {
      if (this.lastServerMessageTime && now - this.lastServerMessageTime > 5000) {
        try {
          this.ws.close(4008, "Heartbeat timeout: silent connection stall");
        } catch {}
      }
    }
    // Connection & authentication deadline: if socket opened or connecting but not authenticated within 5000ms, force close
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1) && !this.authenticated) {
      const connStart = (this as any).connectionStartTime || 0;
      if (connStart && now - connStart > 5000) {
        try {
          this.ws.close(4008, "Authentication timeout: connection stalled before auth");
        } catch {}
      }
    }
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
  public applyMachineRosterCustody(roster: Array<{ id?: unknown; type?: unknown; x?: unknown; y?: unknown; z?: unknown; facing?: unknown; health?: unknown; isAlive?: unknown; originX?: unknown; originZ?: unknown; maxHealth?: unknown }>): void {
    if (!Array.isArray(roster)) return;
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
        originX: (rm as any).originX,
        originZ: (rm as any).originZ,
      };
      if (maxHp !== undefined) record.maxHealth = maxHp;
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
    this.serverMachines = this.sim.machines.map((m) => ({ id: m.id, health: m.health, isAlive: m.isAlive }));
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
      sanitized.machines = JSON.parse(JSON.stringify(this.serverMachines));
    }
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
        if (!r) {
          if (this.deadPeerIds?.has(snapRival.id) || snapRival.isAlive === false || (snapRival as any).isKia) {
            continue; // Removed dead peers cannot return alive in snapshot!
          }
          this.sim.rivals.push({
            id: snapRival.id,
            name: snapRival.name,
            isPlayer: false,
            isRival: true,
            isAI: false,
            x: snapRival.x,
            y: 0,
            z: snapRival.z,
            facing: 0,
            health: snapRival.health,
            armor: typeof snapRival.armor === "number" ? snapRival.armor : 0,
            cash: 0,
            action: "idle",
            actionTicks: 0,
            isInvulnerable: false,
            isAlive: snapRival.isAlive,
            // Extraction is settlement-authoritative (verified exfil_success receipts only):
            // a peer snapshot can never grant extracted status to a rival.
            isExtracted: false,
            ammo: typeof snapRival.ammo === "number" ? snapRival.ammo : 30,
            maxAmmo: 30,
          });
        } else {
          const wasDead = !r.isAlive || (r as any).isKia || this.deadPeerIds?.has(r.id);
          r.x = snapRival.x;
          r.z = snapRival.z;
          if (!wasDead) {
            // Peer snapshots may only report DECLINING combat vitals for a known rival
            // (peers can damage a rival, never heal it beyond locally-known state), and
            // can never resurrect a dead one.
            r.health = Math.min(r.health, snapRival.health);
            if (typeof snapRival.armor === "number") r.armor = Math.min(r.armor, snapRival.armor);
            if (typeof snapRival.ammo === "number") r.ammo = snapRival.ammo;
            if (snapRival.isAlive === false) r.isAlive = false;
          } else {
            r.health = 0;
            r.isAlive = false;
          }
          // Extraction stays settlement-authoritative: never granted from a peer snapshot.
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
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) return;
    if (typeof (packet as any)._receivedAt !== "number") {
      (packet as any)._receivedAt = Date.now();
    }
    // Universal snapshot arrival boundary: drop packets that arrived before current snapshot was applied
    if (this.snapshotAppliedLocalTime && (packet as any)._receivedAt < this.snapshotAppliedLocalTime) {
      if (packet.type === 'state' || packet.type === 'hit' || packet.type === 'machine_hit' || packet.type === 'crate_looted' || packet.type === 'crate_loot_request') {
        return;
      }
    }
    // Universal snapshot timestamp boundary: drop state/action packets generated before the last applied snapshot timestamp
    if (this.lastAppliedSnapshotTimestamp && typeof packet.timestamp === "number" && packet.timestamp < this.lastAppliedSnapshotTimestamp) {
      if (packet.type === 'state' || packet.type === 'hit' || packet.type === 'machine_hit' || packet.type === 'crate_looted' || packet.type === 'crate_loot_request') {
        return;
      }
    }
    if (typeof packet.senderId !== "string" || !packet.senderId) return;
    if (typeof packet.senderName !== "string" || !packet.senderName) return;

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

    // Discard packets from different raids if raidId is stamped
    if (packet.raidId && this.sim.raidId && packet.raidId !== this.sim.raidId) {
      return;
    }

    // Strictly restrict unauthenticated BroadcastChannel: all combat, admission, damage, and loot must arrive via authenticated server relay!
    if ((packet as any)._fromBroadcastChannel && packet.type !== "raid_discovery") {
      return;
    }

    // Mandatory Event ID & envelope validation. Deduplication is keyed by
    // REFERENCE + raid + sender + event ID (never the bare event ID — a collision
    // across senders must not suppress an unrelated valid event, and server-stamped
    // packets carry their own reserved namespace).
    if (!packet.eventId || typeof packet.eventId !== "string" || packet.eventId.trim() === "") {
      return;
    }
    const isServerOrigin = !(packet as any)._fromBroadcastChannel && (packet.senderId === "server" || (packet as any).senderName === "CENTRAL COMMAND");
    const dedupNamespace = isServerOrigin
      ? `srv:${typeof packet.raidId === "string" ? packet.raidId : "any"}`
      : `${typeof packet.raidId === "string" ? packet.raidId : "any"}:${(packet as any).senderId || "unknown"}`;
    const dedupKey = `${dedupNamespace}:${packet.eventId}`;
    if (this.seenEvents.has(dedupKey)) return;
    // Record ONLY after all envelope checks passed: malformed packets must not poison
    // the dedup set and suppress a later valid event with the same ID.
    this.seenEvents.add(dedupKey);
    if (this.seenEvents.size > 2000) {
      const firstKey = this.seenEvents.values().next().value;
      if (firstKey) this.seenEvents.delete(firstKey);
    }

    if (packet.senderId === this.localId) {
      if (packet.type === 'machine_hit') {
        const smId = (packet as any).data?.machineId;
        const targetM = this.sim.machines.find((x) => x.id === smId);
        if (targetM) {
          const newHealth = (packet as any).data?.machineHealth;
          if (typeof newHealth === 'number' && Number.isFinite(newHealth)) {
            const maxHp = (targetM as any).maxHealth ?? (targetM.type === 'drone' ? 75 : 120);
            targetM.health = Math.max(0, Math.min(maxHp, newHealth));
            if (typeof (packet as any).data?.machineAlive === 'boolean') {
              targetM.isAlive = (packet as any).data.machineAlive && targetM.health > 0;
            } else {
              targetM.isAlive = targetM.health > 0;
            }
            if (!targetM.isAlive) {
              this.sim.combatLog.push(`[MACHINE DESTROYED] ${targetM.id} neutralized by ${this.sim.player.name}`);
            }
          }
        }
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
      const isResuming = this.sim.ingressController.getState().kind === 'confirmed_active' ||
        (typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(`sz_session_${this.sim.raidId}_${this.localId}`)) ||
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
          sanitized.machines = JSON.parse(JSON.stringify(this.serverMachines));
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
      const targetRival = this.sim.rivals.find((r) => r.id === data.targetId);
      if (targetRival) {
        targetRival.health = Math.max(0, Math.min(targetRival.health, data.targetHealth));
        targetRival.armor = Math.max(0, Math.min(targetRival.armor, data.targetArmor));
        if (data.targetKia || !data.targetAlive || targetRival.health <= 0) {
          targetRival.health = 0;
          targetRival.isAlive = false;
          (targetRival as any).isKia = true;
          this.deadPeerIds.add(data.targetId);
        }
      }
    } else if (packet.type === 'fire') {
      if (!isAuthorizedSender(packet.senderId, packet.senderName)) return;
      const rival = this.sim.rivals.find((r) => r.id === packet.senderId);
      if (rival) {
        rival.lastFiredAtMs = Date.now();
        rival.lastFireTimestamp = Date.now();
        rival.lastFireTick = this.sim.tick;
      }
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
          if (interruptedActiveHold) {
            this.sim.lastInterruptionTick = this.sim.tick;
            this.sim.onHoldProgress?.(0, this.sim.tick);
          }
          this.sim.onDamageTaken?.();
          this.sim.combatLog.push(`[AUTHORITATIVE HIT] Confirmed strike from ${packet.senderName}: HP=${this.sim.player.health} Armor=${this.sim.player.armor}`);
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
          return; // Attacker must be an active, living, unextracted rival
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
        if (rawKind !== undefined && rawKind !== 'kick' && rawKind !== 'rifle') {
          return; // Strictly reject unknown attack kinds without modifying attacker state!
        }

        const isCovered = this.sim.checkContainerRayObstruction(candidateX, candidateZ, this.sim.player.x, this.sim.player.z, 1.0, 1.0);
        if (isCovered) {
          this.sim.combatLog.push(`[COVER] Strike from ${packet.senderName} deflected by shipping container`);
          return;
        }

        if (this.sim.player.isInvulnerable) {
          this.sim.combatLog.push(`[ROLL DEFLECTION] Strike deflected by combat roll invulnerability`);
          return;
        }

        const dist = Math.hypot(candidateX - this.sim.player.x, candidateZ - this.sim.player.z);
        const inferredKind = rawKind || ((knockX !== 0 || knockZ !== 0 || (dmg === 35 && dist <= 3.0)) ? 'kick' : 'rifle');
        if (inferredKind !== 'kick' && inferredKind !== 'rifle') {
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
        } else {
          // Any non-kick / rifle attack is strictly capped to SIM_CONFIG.RIFLE_DAMAGE (24)
          effectiveDmg = Math.min(SIM_CONFIG.RIFLE_DAMAGE, dmg > 0 ? dmg : SIM_CONFIG.RIFLE_DAMAGE);
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
        const m = this.sim.machines.find((x) => x.id === c.id);
        if (!m) continue;
        const maxHp = (m as any).maxHealth ?? (m.type === "drone" ? 75 : 120);
        if (typeof c.health === "number" && Number.isFinite(c.health)) {
          m.health = Math.max(0, Math.min(maxHp, c.health));
          m.isAlive = c.isAlive !== false && m.health > 0;
        }
      }
      this.sim.combatLog.push(`[KICK REJECTED] Strike rejected by relay (${d.reason || "invalid"}); machine predictions reconciled to custody`);
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
        const appliedRev = (this as any).__appliedMachineRosterRevision ?? 0;
        if (d.revision <= appliedRev) return;
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
      if (wasHolding) {
        this.sim.lastInterruptionTick = this.sim.tick;
        this.sim.onHoldProgress?.(0, this.sim.tick);
      }
      this.sim.player.health = d.targetHealth;
      this.sim.player.armor = d.targetArmor;
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

      // 1. Check local authority or local ledger if present
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

      // 2. Separate browser client path: verify with server API
      if (typeof fetch !== "undefined") {
        const sessionTok = (this.sim as any).sessionToken;
        const verifyCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const verifyTid = verifyCtrl ? setTimeout(() => verifyCtrl.abort(), 4000) : null;
        fetch(`/api/settlement/verify-receipt?receiptId=${encodeURIComponent(receiptId)}&raidId=${encodeURIComponent(this.sim.raidId)}`, {
          signal: verifyCtrl ? verifyCtrl.signal : undefined,
          headers: sessionTok ? { "Authorization": `Bearer ${sessionTok}` } : {},
        })
          .then((res) => (res.ok ? res.json() : null))
          .finally(() => { if (verifyTid) clearTimeout(verifyTid); })
          .then((data) => {
            if (data && data.valid && data.receipt) {
              applyVerifiedExtraction(data.receipt);
            } else {
              this.sim.combatLog.push(`[SETTLEMENT REJECTED] Unverified extraction receipt ${receiptId} for ${packet.senderName}`);
            }
          })
          .catch(() => {
            this.sim.combatLog.push(`[SETTLEMENT REJECTED] Receipt verification failed for ${packet.senderName}`);
          });
        return;
      }

      this.sim.combatLog.push(`[SETTLEMENT REJECTED] Unverified extraction receipt ${receiptId} for ${packet.senderName}`);
    }
  }

  public cleanup(): void {
    this.isDisposed = true;
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.raidClockSyncInterval) {
      clearInterval(this.raidClockSyncInterval);
      this.raidClockSyncInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.selfReadinessTimer) {
      clearTimeout(this.selfReadinessTimer);
      this.selfReadinessTimer = null;
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).hot && this.boundHotHandler) {
      try {
        (import.meta as any).hot.off('stick:peer_packet', this.boundHotHandler);
      } catch {}
      this.boundHotHandler = null;
    }
  }
}
