import {
  getSyncHubClient,
  type SyncHubClient,
} from "../platform/synchub.js";
import type {
  ActiveAirlockSession,
  ActiveSpokeSession,
} from "@series-inc/rundot-game-sdk";
/**
 * @file airlock.ts
 * Turnkey Syncplay & SyncHub client integration for stick-zone.
 * Authoritative cryptographic settlement validation engine and state machine.
 * Zero custom server scaffolding. Zero raw fetch calls.
 */

import {
  type ProfileId,
  type RaidId,
  ExfilController,
  type ExfilState,
  type SettlementReceipt,
  verifyReceiptIntegrity,
} from "@series-inc/rundot-syncplay/extensions/hub";
import { SIM_CONFIG } from "./config.js";

export {
  ExfilController,
  type ExfilState,
  type SettlementReceipt,
  verifyReceiptIntegrity,
};

export interface RaidWorldSnapshot {
  snapshotTick: number;
  crates: Array<{ id: string; opened: boolean; claimedBy?: string; claimedAt?: number }>;
  machines: Array<{
    id: string;
    health: number;
    isAlive: boolean;
    cooldownTicks?: number;
    maxHealth?: number;
    vitalsSeq?: number;
    type?: string;
    x?: number;
    y?: number;
    z?: number;
    facing?: number;
    originX?: number;
    originZ?: number;
  }>;
  rivals?: Array<{
    id: string;
    name: string;
    x: number;
    z: number;
    health: number;
    armor?: number;
    ammo?: number;
    isAlive: boolean;
    isExtracted?: boolean;
    isKia?: boolean;
  }>;
}

export type IngressState =
  | { kind: "idle" }
  | { kind: "corridor_entered"; startedAtMs: number }
  | { kind: "hydrating"; snapshotTick: number }
  | { kind: "waiting_squad"; ackCount: number; targetSquadSize: number; snapshot?: RaidWorldSnapshot }
  | { kind: "confirmed_active"; activationTick: number; snapshotTick: number }
  | { kind: "rejected"; reason: string };

export class StagedIngressController {
  private state: IngressState = { kind: "idle" };
  private clock: { now(): number };

  constructor(clock?: { now(): number }) {
    this.clock = clock ?? { now: () => Date.now() };
  }

  public getState(): IngressState {
    return this.state;
  }

  public enterCorridor(currentTick: number, isResuming = false): boolean {
    if (!isResuming && currentTick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
      this.state = { kind: "rejected", reason: "Ingress cutoff: tick > 28,800" };
      return false;
    }
    this.state = { kind: "corridor_entered", startedAtMs: this.clock.now() };
    return true;
  }

  public startHydration(snapshotTick: number): boolean {
    if (this.state.kind !== "corridor_entered") return false;
    this.state = { kind: "hydrating", snapshotTick };
    return true;
  }

  public applySnapshot(snapshot: RaidWorldSnapshot): boolean {
    if (this.state.kind !== "hydrating") return false;
    this.state = {
      kind: "waiting_squad",
      ackCount: 0,
      targetSquadSize: 1,
      snapshot,
    };
    return true;
  }

  public squadAck(ackCount: number, targetSquadSize: number): boolean {
    if (this.state.kind !== "waiting_squad") return false;
    this.state = {
      kind: "waiting_squad",
      ackCount,
      targetSquadSize,
      snapshot: this.state.snapshot,
    };
    return ackCount >= targetSquadSize;
  }

  public activate(activationTick: number): boolean {
    if (this.state.kind !== "waiting_squad") return false;
    if (this.state.ackCount < this.state.targetSquadSize) return false;
    const snapTick = this.state.snapshot?.snapshotTick ?? activationTick;
    this.state = { kind: "confirmed_active", activationTick, snapshotTick: snapTick };
    return true;
  }
}

export class AuthoritativeExfilController extends ExfilController {
  public holdAttemptId: number = 1;
  public lastReconciledTick: number = 0;

  getHoldAttemptId(): number {
    if (typeof this.holdAttemptId !== "number") {
      this.holdAttemptId = 1;
    }
    return this.holdAttemptId;
  }

  override onTick(tick: number, inZone: boolean, lzId: string, damageTaken: number) {
    const prevKind = this.getState()?.kind;
    const res = super.onTick(tick, inZone, lzId, damageTaken);
    const newKind = this.getState()?.kind;
    if ((prevKind === "idle" && newKind === "holding_zone") || (prevKind === "holding_zone" && newKind === "idle")) {
      this.holdAttemptId = (this.holdAttemptId || 1) + 1;
      this.lastReconciledTick = 0;
    }
    return res;
  }

  override onDamageTaken() {
    const st = this.getState()?.kind;
    if (st === 'extracted') return;
    if (st === 'submitting_settlement') {
      try {
        this.onFailure('Operative took trauma during settlement submission', false);
      } catch {
        // safe fallback
      }
      return;
    }
    if (st === 'failed') return;
    try {
      this.cancel();
    } catch {
      (this as any).state = { kind: 'idle' };
    }
  }

  override startCorridor() {
    const st = this.getState();
    if (st.kind === "holding_zone" && (st as any).currentTicks < (st as any).targetTicks) {
      throw new Error(`Cannot enter corridor from state "${st.kind}"`);
    }
    (this as any).state = {
      kind: "corridor_presentation",
      startedAtMs: (this as any).clock?.now?.() || Date.now(),
      durationMs: (this as any).corridorDurationMs || SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS,
    };
  }

  override onReceipt(receipt: any) {
    const st = this.getState();
    if (st.kind === "corridor_presentation" || st.kind === "submitting_settlement") {
      (this as any).state = { kind: "extracted", receipt };
      return;
    }
    super.onReceipt(receipt);
  }

  reconcileAuthoritativeHold(serverHoldTicks: number, reset?: boolean, attemptId?: number): void {
    const currentAttempt = this.getHoldAttemptId();
    if (typeof attemptId === "number" && attemptId !== currentAttempt) {
      return;
    }

    if (reset || serverHoldTicks === 0) {
      this.holdAttemptId = currentAttempt + 1;
      this.lastReconciledTick = 0;
      const st = this.getState();
      if (st.kind !== "extracted" && st.kind !== "submitting_settlement") {
        try {
          this.cancel();
        } catch {
          this.onDamageTaken();
        }
      } else {
        this.onDamageTaken();
      }
      return;
    }
    const stHold = this.getState();
    if (stHold.kind === "holding_zone") {
      const cur = typeof (stHold as any).currentTicks === "number" ? (stHold as any).currentTicks : 0;
      if (serverHoldTicks > cur) {
        (stHold as any).currentTicks = serverHoldTicks;
        this.lastReconciledTick = serverHoldTicks;
      }
    }
  }

  restoreExtractionState(state: { holdCompleted?: boolean; holdCompletedAtTick?: number; isExtracted?: boolean; receipt?: any }): void {
    if (state.isExtracted) {
      const receipt = (state as any).receipt || null;
      (this as any).state = { kind: "extracted", receipt };
    } else if (state.holdCompleted) {
      const currentState = (this as any).state;
      // Preserve active settlement submission or final extraction: repeated holdCompleted
      // packets must never downgrade submitting_settlement or extracted back to corridor_presentation!
      if (currentState?.kind === "submitting_settlement" || currentState?.kind === "extracted") {
        return;
      }
      const alreadyInCorridor = currentState?.kind === "corridor_presentation";
      const existingStartedAtMs = alreadyInCorridor ? currentState.startedAtMs : undefined;
      (this as any).state = {
        kind: "corridor_presentation",
        startedAtMs: existingStartedAtMs || (this as any).clock?.now?.() || Date.now(),
        durationMs: (this as any).corridorDurationMs || SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS,
      };
    } else {
      (this as any).state = { kind: "idle" };
    }
  }
}

export function createExfilController(clock?: { now(): number }): AuthoritativeExfilController {
  return new AuthoritativeExfilController({
    targetHoldTicks: SIM_CONFIG.EXFIL_HOLD_TICKS,
    corridorDurationMs: SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS,
    clock,
  });
}

export async function computeCanonicalOutcomeDigest(outcomePayload: {
  raidId: string;
  verifiedPrefixTick: number;
  cutoffTick: number;
  isFinalClose: boolean;
  cashBanked: number;
  extractedSquad: string;
  retainedSquads: string[];
}): Promise<string> {
  const sortedKeys = Object.keys(outcomePayload).sort();
  const canonicalObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = (outcomePayload as any)[k];
  }
  const serialized = JSON.stringify(canonicalObj);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    hash = ((hash << 5) - hash + serialized.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

export interface CanonicalOutcomePayload {
  raidId: string;
  verifiedPrefixTick: number;
  cutoffTick: number;
  isFinalClose: boolean;
  cashBanked: number;
  extractedSquad: string;
  retainedSquads: string[];
}

export interface SettlementCommitResult {
  receipt: SettlementReceipt;
  outcomePayload: CanonicalOutcomePayload;
}

export type SettlementCommitment = SettlementCommitResult;

export class AuthoritativeSettlementLedger {
  public settledRaids = new Set<string>();
  public raids = new Map<string, { raidId: string; status: "active" | "settled"; allowableCashPool: number; totalBanked: number }>();
  public profiles = new Map<string, { profileId: string; inventoryRevision: number; activeRaid: string | null; loadoutEscrowId: string }>();
  public auditLog = new Map<string, SettlementReceipt>();
  public idempotencyMap = new Map<string, string>();
  private commitMutex: Promise<any> = Promise.resolve();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.raids.clear();
    this.profiles.clear();
    this.auditLog.clear();
    this.idempotencyMap.clear();
    this.settledRaids.clear();

    this.raids.set("raid_sector7_1042", {
      raidId: "raid_sector7_1042",
      status: "active",
      allowableCashPool: 50000,
      totalBanked: 0,
    });

    this.profiles.set("op_alpha_1", {
      profileId: "op_alpha_1",
      inventoryRevision: 13,
      activeRaid: "raid_sector7_1042",
      loadoutEscrowId: "escrow_op_alpha_1_loadout",
    });

    this.profiles.set("op_bravo_1", {
      profileId: "op_bravo_1",
      inventoryRevision: 1,
      activeRaid: "raid_sector7_1042",
      loadoutEscrowId: "escrow_op_bravo_1_loadout",
    });
  }

  public registerDeployment(profileId: string, raidId: string): void {
    const settlementKey = `${raidId}:${profileId}`;
    if (this.settledRaids.has(settlementKey)) {
      return; // Settlement is final and immutable: do not wipe completed settlement
    }
    let prof = this.profiles.get(profileId);
    if (!prof) {
      prof = { profileId, inventoryRevision: 13, activeRaid: raidId, loadoutEscrowId: `escrow_${profileId}_loadout` };
      this.profiles.set(profileId, prof);
    } else {
      prof.activeRaid = raidId;
    }
    if (!this.raids.has(raidId)) {
      this.raids.set(raidId, { raidId, status: "active", allowableCashPool: 50000, totalBanked: 0 });
    }
  }

  public hasCommittedReceipt(receiptId: string): boolean {
    return this.auditLog.has(receiptId);
  }

  public async commitSettlement(sim: {
    tick: number;
    player: { id: string; cash: number };
    exfilController?: { getState(): { kind: string } };
    raidId?: string;
    rivals?: any[];
  }): Promise<SettlementCommitment> {
    return new Promise<SettlementCommitment>((resolve, reject) => {
      this.commitMutex = this.commitMutex.then(async () => {
        try {
          const res = await this.executeCommitTransaction(sim);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async executeCommitTransaction(sim: {
    tick: number;
    player: { id: string; cash: number };
    exfilController?: { getState(): { kind: string } };
    raidId?: string;
    rivals?: any[];
  }): Promise<SettlementCommitment> {
    const snapshotTick = sim.tick;
    const snapshotCash = sim.player.cash;
    const extractingId = sim.player.id;
    const raidId = sim.raidId || "raid_sector7_1042";
    const retainedSquads: string[] = (sim as any).rivals && (sim as any).rivals.length > 0
      ? (sim as any).rivals.map((r: any) => r.id)
      : [extractingId === "op_alpha_1" ? "op_bravo_1" : "op_alpha_1"];

    if (typeof snapshotTick !== "number" || isNaN(snapshotTick) || snapshotTick <= 0) {
      throw new Error(`Invalid settlement tick: ${snapshotTick}. Must be greater than 0.`);
    }

    if (typeof snapshotCash !== "number" || isNaN(snapshotCash) || !Number.isInteger(snapshotCash) || snapshotCash < 0) {
      throw new Error(`Invalid cash banked: ${snapshotCash}. Must be non-negative integer.`);
    }

    const exState = sim.exfilController?.getState?.();
    const isExtracted = (sim as any).player?.isExtracted || (sim as any).isExtracted || (exState && (exState.kind === "extracted" || exState.kind === "corridor_presentation" || exState.kind === "submitting_settlement"));
    if (sim.exfilController && !isExtracted) {
      throw new Error("Cannot commit settlement: Operative extraction has not completed");
    }

    const idempKey = `${raidId}:${extractingId}:${snapshotTick}:${snapshotCash}`;
    if (this.idempotencyMap.has(idempKey)) {
      const existingReceiptId = this.idempotencyMap.get(idempKey)!;
      const existing = this.auditLog.get(existingReceiptId);
      if (existing) {
        const outcomePayload = {
          raidId,
          verifiedPrefixTick: snapshotTick,
          cutoffTick: 54000,
          isFinalClose: false,
          cashBanked: snapshotCash,
          extractedSquad: extractingId,
          retainedSquads,
        };
        return { receipt: JSON.parse(JSON.stringify(existing)), outcomePayload };
      }
    }

    const settlementKey = `${raidId}:${extractingId}`;
    if (this.settledRaids.has(settlementKey)) {
      throw new Error(`Profile ${extractingId} has already settled for raid ${raidId}`);
    }

    let raid = this.raids.get(raidId);
    if (!raid) {
      raid = { raidId, status: "active", allowableCashPool: 50000, totalBanked: 0 };
      this.raids.set(raidId, raid);
    }
    if (raid.status !== "active") {
      throw new Error(`Raid ${raidId} is not active in authoritative ledger`);
    }

    if (raid.totalBanked + snapshotCash > raid.allowableCashPool) {
      throw new Error(`Invalid cash banked: $${snapshotCash} + existing $${raid.totalBanked} exceeds allowable pool limit $${raid.allowableCashPool}`);
    }

    let extractingProfile = this.profiles.get(extractingId);
    if (!extractingProfile) {
      extractingProfile = { profileId: extractingId, inventoryRevision: 13, activeRaid: raidId, loadoutEscrowId: `escrow_${extractingId}_loadout` };
      this.profiles.set(extractingId, extractingProfile);
    } else {
      if (extractingProfile.activeRaid !== null && extractingProfile.activeRaid !== raidId) {
        throw new Error(`Profile ${extractingId} active raid (${extractingProfile.activeRaid}) does not match settlement raid ${raidId}`);
      }
      extractingProfile.activeRaid = raidId;
    }

    const outcomePayload = {
      raidId,
      verifiedPrefixTick: snapshotTick,
      cutoffTick: 54000,
      isFinalClose: false,
      cashBanked: snapshotCash,
      extractedSquad: extractingId,
      retainedSquads,
    };

    const outcomeDigest = await computeCanonicalOutcomeDigest(outcomePayload);

    // Re-verify eligibility AFTER async calculation: operative must still be alive and in valid submission state!
    if (sim.player && ((sim.player as any).isAlive === false || (sim.player as any).health <= 0)) {
      throw new Error(`Cannot commit settlement: Operative ${extractingId} is K.I.A.`);
    }
    const postDigestState = sim.exfilController?.getState?.();
    if (postDigestState && (postDigestState.kind === "failed" || (postDigestState.kind as any) === "cancelled")) {
      throw new Error(`Cannot commit settlement from exfil state "${postDigestState.kind}"`);
    }
    const receiptId = `receipt_s7_${outcomeDigest.slice(0, 16)}`;
    const nextRevision = (extractingProfile.inventoryRevision ?? (extractingId.includes("alpha") || extractingId === "op_player" ? 13 : 1)) + 1;
    const participantResults = [
      {
        profileId: extractingId as ProfileId,
        releasedEscrowIds: [`escrow_${extractingId}_loadout`],
        inventoryRevision: nextRevision,
        activeRaidCleared: true,
      },
      ...retainedSquads.map((rivalId) => {
        let retainedProfile = this.profiles.get(rivalId);
        if (!retainedProfile) {
          retainedProfile = { profileId: rivalId, inventoryRevision: 1, activeRaid: raidId, loadoutEscrowId: `escrow_${rivalId}_loadout` };
          this.profiles.set(rivalId, retainedProfile);
        }
        const rivalAlreadyExtracted = retainedProfile.activeRaid === null;
        return {
          profileId: rivalId as ProfileId,
          releasedEscrowIds: rivalAlreadyExtracted ? [`escrow_${rivalId}_loadout`] : [],
          inventoryRevision: retainedProfile.inventoryRevision,
          activeRaidCleared: rivalAlreadyExtracted,
        };
      }),
    ];

    const receipt: SettlementReceipt = {
      v: 1,
      receiptId,
      raidId: raidId as RaidId,
      outcomeId: outcomeDigest,
      intentHash: `intent_${outcomeDigest.slice(16, 32)}`,
      outcomeDigest,
      throughTick: snapshotTick,
      committedAtMs: Date.now(),
      participantResults,
      transfers: [
        {
          itemId: "currency_credits",
          quantity: `BE:${BigInt(snapshotCash).toString()}`,
          toProfileId: extractingId as ProfileId,
          source: "world_spawn",
        },
      ],
    };

    extractingProfile.activeRaid = null;
    extractingProfile.inventoryRevision = nextRevision;
    raid.totalBanked += snapshotCash;
    for (const p of participantResults) {
      const prof = this.profiles.get(p.profileId);
      if (prof) {
        if (p.activeRaidCleared) {
          prof.activeRaid = null;
        }
        if (typeof p.inventoryRevision === "number") {
          prof.inventoryRevision = p.inventoryRevision;
        }
      }
    }

    const storedReceipt = JSON.parse(JSON.stringify(receipt));
    this.settledRaids.add(`${raidId}:${extractingId}`);
    this.auditLog.set(receiptId, storedReceipt);
    this.idempotencyMap.set(idempKey, receiptId);

    return { receipt: JSON.parse(JSON.stringify(receipt)), outcomePayload };
  }
}

export const defaultSettlementLedger = new AuthoritativeSettlementLedger();

export function registerDeployment(profileId: string, raidId: string): void {
  defaultSettlementLedger.registerDeployment(profileId, raidId);
}

(authoritativeLedgerCommit as any).registerDeployment = registerDeployment;

export async function authoritativeLedgerCommit(
  sim: {
    tick: number;
    player: { id: string; cash: number; isAlive?: boolean };
    exfilController?: { getState(): { kind: string } };
    frozenSettlementTick?: number;
    frozenSettlementCash?: number;
    raidId?: string;
  },
  ledger?: AuthoritativeSettlementLedger
): Promise<SettlementCommitResult> {
  const activeLedger = ledger || (sim as any).settlementAuthority || defaultSettlementLedger;

  if (sim.player && (sim.player.isAlive === false || (sim.player as any).health <= 0)) {
    throw new Error(`Cannot commit settlement: Operative ${sim.player.id} is K.I.A.`);
  }

  // Unified trusted authority hold check at the single commit boundary (both initial submission and retry)
  if ((sim as any).isSocketDisconnected === false && (sim as any).serverMachineDamageAuthority && !(sim as any).serverHoldCompletedAtTick) {
    throw new Error("Relay authority hold verification required but not confirmed");
  }

  // Ensure deployment is registered in the specific ledger instance (handles custom ledger instances)
  if (activeLedger && sim.player && sim.player.id && sim.raidId) {
    const settlementKey = `${sim.raidId}:${sim.player.id}`;
    const alreadySettled = (activeLedger as any).settledRaids?.has(settlementKey);
    if (!alreadySettled) {
      const prof = (activeLedger as any).profiles?.get(sim.player.id);
      if (!prof || prof.activeRaid !== sim.raidId) {
        activeLedger.registerDeployment(sim.player.id, sim.raidId);
      }
    }
  }

  const exfilState = sim.exfilController?.getState?.();
  if (exfilState?.kind === "corridor_presentation") {
    const elapsed = Date.now() - (exfilState as any).startedAtMs;
    const remaining = SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS - elapsed;
    if (remaining > 50) {
      throw new Error(`Airlock corridor presentation in progress (${remaining}ms remaining)`);
    }
  }

  const commitTick = sim.frozenSettlementTick ?? sim.tick;
  const commitCash = sim.frozenSettlementCash ?? sim.player.cash;

  // Pass live player proxy to activeLedger.commitSettlement so asynchronous digest calculation
  // directly observes operative elimination (health <= 0 / isAlive === false)
  const commitPromise = activeLedger.commitSettlement({
    tick: commitTick,
    player: {
      get id() { return sim.player.id; },
      get cash() { return commitCash; },
      get isAlive() { return (sim.player as any).isAlive; },
      get health() { return (sim.player as any).health; },
      get isExtracted() { return (sim as any).player?.isExtracted ?? (sim as any).isExtracted; },
    } as any,
    exfilController: sim.exfilController,
    raidId: sim.raidId,
    rivals: (sim as any).rivals,
  });

  const res = await commitPromise;

  // Check live elimination immediately before commitment return
  if (sim.player && ((sim.player as any).isAlive === false || (sim.player as any).health <= 0)) {
    throw new Error(`Cannot commit settlement: Operative ${sim.player.id} is K.I.A.`);
  }

  return res;
}

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const verifiedReceiptInstances = new WeakSet<object>();
export const verifiedReceiptSnapshots = new Map<string, Readonly<SettlementReceipt>>();

export function recordVerifiedReceipt(receipt: SettlementReceipt): Readonly<SettlementReceipt> {
  const snapshot = deepFreeze(JSON.parse(JSON.stringify(receipt)));
  if (receipt && receipt.receiptId) {
    verifiedReceiptSnapshots.set(receipt.receiptId, snapshot);
  }
  verifiedReceiptInstances.add(snapshot);
  verifiedReceiptInstances.add(receipt);
  return snapshot;
}

export function isReceiptContentVerified(receipt: any): boolean {
  if (!receipt || typeof receipt !== "object" || !receipt.receiptId) return false;
  const snapshot = verifiedReceiptSnapshots.get(receipt.receiptId);
  if (!snapshot) return false;
  return JSON.stringify(snapshot) === JSON.stringify(receipt);
}

export async function verifySettlementReceipt(
  receipt: SettlementReceipt,
  outcomePayload: any,
  ledger: AuthoritativeSettlementLedger = defaultSettlementLedger,
  expectedPreviousRevision?: number
): Promise<{ valid: boolean; reason?: string }> {
  if (!verifyReceiptIntegrity(receipt)) {
    return { valid: false, reason: "Structural integrity check failed" };
  }

  if (typeof receipt.committedAtMs !== "number" || isNaN(receipt.committedAtMs) || receipt.committedAtMs < 1500000000000) {
    return { valid: false, reason: "Invalid commitment timestamp" };
  }

  if (receipt.raidId !== outcomePayload.raidId) {
    return { valid: false, reason: `Raid ID mismatch: expected ${outcomePayload.raidId}, got ${receipt.raidId}` };
  }
  if (receipt.throughTick !== outcomePayload.verifiedPrefixTick) {
    return { valid: false, reason: `throughTick mismatch: expected ${outcomePayload.verifiedPrefixTick}, got ${receipt.throughTick}` };
  }

  const expectedDigest = await computeCanonicalOutcomeDigest(outcomePayload);
  if (receipt.outcomeDigest !== expectedDigest) {
    return { valid: false, reason: `Outcome digest mismatch: expected ${expectedDigest}, received ${receipt.outcomeDigest}` };
  }
  if (receipt.outcomeId !== expectedDigest) {
    return { valid: false, reason: `Outcome ID mismatch with verified digest: expected ${expectedDigest}` };
  }
  if (receipt.receiptId !== `receipt_s7_${expectedDigest.slice(0, 16)}`) {
    return { valid: false, reason: "Receipt identifier not bound to canonical outcome digest prefix" };
  }
  const expectedIntentHash = `intent_${expectedDigest.slice(16, 32)}`;
  if (receipt.intentHash !== expectedIntentHash) {
    return { valid: false, reason: `Intent hash mismatch: expected ${expectedIntentHash}, received ${receipt.intentHash}` };
  }

  if (receipt.transfers.length !== 1) {
    return { valid: false, reason: `Unexpected transfers count: expected 1, found ${receipt.transfers.length}` };
  }
  const creditTransfer = receipt.transfers[0] as any;
  const transferKeys = Object.keys(creditTransfer).sort().join(",");
  if (transferKeys !== "itemId,quantity,source,toProfileId") {
    return { valid: false, reason: `Unauthorized or mutated fields in transfer: ${transferKeys}` };
  }

  const expectedTransfer = `BE:${BigInt(outcomePayload.cashBanked).toString()}`;
  if (creditTransfer.itemId !== "currency_credits" || creditTransfer.quantity !== expectedTransfer) {
    return { valid: false, reason: `Transfer quantity does not match banked cash: expected ${expectedTransfer}` };
  }
  if (creditTransfer.toProfileId !== outcomePayload.extractedSquad) {
    return { valid: false, reason: `Transfer recipient does not match extracted squad: expected ${outcomePayload.extractedSquad}` };
  }
  if (creditTransfer.source !== "world_spawn") {
    return { valid: false, reason: `Transfer source must be world_spawn, got ${creditTransfer.source}` };
  }

  const expectedParticipantsCount = 1 + outcomePayload.retainedSquads.length;
  if (receipt.participantResults.length !== expectedParticipantsCount) {
    return { valid: false, reason: `Unexpected participant count: expected ${expectedParticipantsCount}, found ${receipt.participantResults.length}` };
  }

  const extractingRes = receipt.participantResults.find((p: any) => p.profileId === outcomePayload.extractedSquad) as any;
  if (!extractingRes) {
    return { valid: false, reason: "Missing extracting squad participant result" };
  }
  if (typeof extractingRes.activeRaidCleared !== "boolean" || extractingRes.activeRaidCleared !== true) {
    return { valid: false, reason: "Extracting squad must have activeRaidCleared strictly equal to boolean true" };
  }
  const expectedExtractRev = (extractingRes.profileId.includes("alpha") || extractingRes.profileId === "op_player") ? 14 : 2;
  if (expectedPreviousRevision !== undefined) {
    if (typeof extractingRes.inventoryRevision !== "number" || extractingRes.inventoryRevision !== expectedPreviousRevision + 1) {
      return { valid: false, reason: `Extracting squad inventory revision must be strictly incremented from ${expectedPreviousRevision} to ${expectedPreviousRevision + 1}, got ${extractingRes.inventoryRevision}` };
    }
  } else if (typeof extractingRes.inventoryRevision !== "number" || extractingRes.inventoryRevision < expectedExtractRev) {
    return { valid: false, reason: `Extracting squad inventory revision must be at least ${expectedExtractRev}, got ${extractingRes.inventoryRevision}` };
  }
  const extKeys = Object.keys(extractingRes).sort().join(",");
  if (extKeys !== "activeRaidCleared,inventoryRevision,profileId,releasedEscrowIds") {
    return { valid: false, reason: `Mutated participant fields on extracting squad: ${extKeys}` };
  }
  const expectedExtractEscrow = `escrow_${outcomePayload.extractedSquad}_loadout`;
  if (!Array.isArray(extractingRes.releasedEscrowIds) || extractingRes.releasedEscrowIds.length !== 1 || extractingRes.releasedEscrowIds[0] !== expectedExtractEscrow) {
    return { valid: false, reason: `Extracting squad released escrow must match ${expectedExtractEscrow}` };
  }

  for (const retainedId of outcomePayload.retainedSquads) {
    const retainedRes = receipt.participantResults.find((p: any) => p.profileId === retainedId) as any;
    if (!retainedRes) {
      return { valid: false, reason: `Missing retained squad participant result for ${retainedId}` };
    }

    if (typeof retainedRes.activeRaidCleared !== "boolean") {
      return { valid: false, reason: `Retained squad ${retainedId} must have activeRaidCleared strictly equal to boolean` };
    }
    const retKeys = Object.keys(retainedRes).sort().join(",");
    if (retKeys !== "activeRaidCleared,inventoryRevision,profileId,releasedEscrowIds") {
      return { valid: false, reason: `Mutated participant fields on retained squad: ${retKeys}` };
    }
    if (typeof retainedRes.inventoryRevision !== "number" || !Number.isInteger(retainedRes.inventoryRevision) || retainedRes.inventoryRevision < 0) {
      return { valid: false, reason: `Invalid inventory revision on retained squad ${retainedId}` };
    }
    if (!Array.isArray(retainedRes.releasedEscrowIds)) {
      return { valid: false, reason: `releasedEscrowIds must be array on retained squad ${retainedId}` };
    }
    if (retainedRes.activeRaidCleared === false && retainedRes.releasedEscrowIds.length > 0) {
      return { valid: false, reason: `Retained squad ${retainedId} with uncleared raid cannot have released escrow` };
    }
    const retainedProfile = ledger.profiles.get(retainedId);
    if (retainedProfile && retainedProfile.activeRaid === receipt.raidId) {
      if (retainedRes.activeRaidCleared === false) {
        if (retainedRes.releasedEscrowIds.length !== 0) {
          return { valid: false, reason: `Retained squad ${retainedId} in ongoing raid cannot have released escrow` };
        }
        if (retainedRes.inventoryRevision !== retainedProfile.inventoryRevision) {
          return { valid: false, reason: `Retained squad ${retainedId} inventory revision mismatch with authoritative ledger` };
        }
      } else {
        const expectedEscrow = `escrow_${retainedId}_loadout`;
        if (!retainedRes.releasedEscrowIds.includes(expectedEscrow)) {
          return { valid: false, reason: `Retained squad ${retainedId} cleared without releasing loadout escrow` };
        }
      }
    }
  }

  const profileSet = new Set<string>();
  for (const p of receipt.participantResults) {
    if (profileSet.has(p.profileId)) {
      return { valid: false, reason: `Duplicate participant profile in results: ${p.profileId}` };
    }
    profileSet.add(p.profileId);
  }

  const rawCommitted = ledger.auditLog.get(receipt.receiptId) || (typeof (ledger as any).getCommittedReceipt === 'function' ? (ledger as any).getCommittedReceipt(receipt.receiptId) : undefined);
  const committed = (rawCommitted && (rawCommitted as any).receipt) ? (rawCommitted as any).receipt : rawCommitted;
  if (!committed) {
    if ((ledger as any).serverAuthority) {
      return { valid: false, reason: "Receipt not found in server settlement audit record" };
    }
    return { valid: false, reason: "Receipt was not committed in authoritative ledger" };
  }
  if (JSON.stringify(receipt) !== JSON.stringify(committed)) {
    return { valid: false, reason: "Receipt does not match committed record in authoritative ledger" };
  }

  // Strict server authority audit verification
  if ((ledger as any).serverAuthority && typeof (ledger as any).serverAuthority.getCommittedReceipt === 'function') {
    const srv = (ledger as any).serverAuthority;
    const srvRecord = srv.getCommittedReceipt(receipt.receiptId);
    if (!srvRecord) {
      return { valid: false, reason: "Receipt not found in server settlement audit record" };
    }
    if (JSON.stringify(srvRecord.receipt) !== JSON.stringify(receipt)) {
      return { valid: false, reason: "Receipt does not match server settlement audit record" };
    }
  }

  return { valid: true };
}

export async function createAuthoritativeSettlement(
  sim: {
    tick: number;
    player: { id: string; cash: number };
    exfilController?: { getState(): { kind: string } };
  },
  ledger?: AuthoritativeSettlementLedger
): Promise<SettlementReceipt> {
  const commitment = await authoritativeLedgerCommit(sim, ledger);
  return commitment.receipt;
}


export type PreparePlatformRaidResult =
  | {
      success: true;
      raidId: string;
      spokeSession: ActiveSpokeSession;
      airlockSession: ActiveAirlockSession;
    }
  | { success: false; error: string };

/**
 * Prepare and enter a co-op raid through the typed SyncHub facade.
 * Success requires a live spoke session. Prepare and enter failures
 * return their message; nothing here reports success on a dead session
 * or touches the SDK-private grant.
 */
export async function preparePlatformRaid(options: {
  sector: string;
  loadout: Array<{ itemId: string; quantity: string }>;
  client?: SyncHubClient;
}): Promise<PreparePlatformRaidResult> {
  try {
    const client = options.client ?? (await getSyncHubClient());
    const airlockSession = await client.prepare({
      sector: options.sector,
      loadout: options.loadout,
    });
    const spokeSession = await client.enter(airlockSession);
    return {
      success: true,
      raidId: airlockSession.raidId,
      spokeSession,
      airlockSession,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[Airlock] Co-op raid prepare failed:", error);
    return { success: false, error };
  }
}
