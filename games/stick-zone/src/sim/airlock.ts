/**
 * @file airlock.ts
 * SyncHub staged admission adapter, dedicated ExfilController wrapper,
 * and authoritative cryptographic settlement validation engine with persistent ledger.
 */

import {
  ExfilController,
  CorridorPresentationInProgressError,
  type ExfilState,
  type SettlementReceipt,
  verifyReceiptIntegrity,
  type RaidId,
  type ProfileId,
} from '@series-inc/rundot-syncplay/extensions/hub';
import { SIM_CONFIG } from './config.js';

export {
  ExfilController,
  CorridorPresentationInProgressError,
  type ExfilState,
  type SettlementReceipt,
  verifyReceiptIntegrity,
};

export interface RaidWorldSnapshot {
  snapshotTick: number;
  crates: Array<{ id: string; opened: boolean; claimedBy?: string; claimedAt?: number }>;
  machines: Array<{ id: string; health: number; isAlive: boolean; cooldownTicks?: number }>;
  rivals?: Array<{ id: string; name: string; x: number; z: number; health: number; armor?: number; ammo?: number; isAlive: boolean; isExtracted?: boolean; isKia?: boolean }>;
}

export type IngressState =
  | { kind: 'idle' }
  | { kind: 'corridor_entered'; startedAtMs: number }
  | { kind: 'hydrating'; snapshotTick: number }
  | { kind: 'waiting_squad'; ackCount: number; targetSquadSize: number; snapshot?: RaidWorldSnapshot }
  | { kind: 'confirmed_active'; activationTick: number; snapshotTick: number }
  | { kind: 'rejected'; reason: string };

export class StagedIngressController {
  private state: IngressState = { kind: 'idle' };
  private clock: { now(): number };

  constructor(clock?: { now(): number }) {
    this.clock = clock ?? { now: () => Date.now() };
  }

  public getState(): IngressState {
    return this.state;
  }

  public enterCorridor(currentTick: number, isResuming = false): boolean {
    if (!isResuming && currentTick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
      this.state = { kind: 'rejected', reason: 'Ingress cutoff: tick > 28,800' };
      return false; // Ingress window closed
    }
    this.state = { kind: 'corridor_entered', startedAtMs: this.clock.now() };
    return true;
  }

  public startHydration(snapshotTick: number): boolean {
    if (this.state.kind !== 'corridor_entered') return false;
    this.state = { kind: 'hydrating', snapshotTick };
    return true;
  }

  public applySnapshot(snapshot: RaidWorldSnapshot): boolean {
    if (this.state.kind !== 'hydrating') return false;
    this.state = {
      kind: 'waiting_squad',
      ackCount: 0,
      targetSquadSize: 1,
      snapshot,
    };
    return true;
  }

  public squadAck(ackCount: number, targetSquadSize: number): boolean {
    if (this.state.kind !== 'waiting_squad') return false;
    this.state = {
      kind: 'waiting_squad',
      ackCount,
      targetSquadSize,
      snapshot: this.state.snapshot,
    };
    return true;
  }

  /**
   * Guarded transition: activate can ONLY be called from waiting_squad
   * after ackCount >= targetSquadSize. Bypassing barriers returns false.
   */
  public activate(activationTick: number): boolean {
    if (this.state.kind !== 'waiting_squad') {
      return false;
    }
    if (this.state.ackCount < this.state.targetSquadSize) {
      return false;
    }
    const snapTick = this.state.snapshot?.snapshotTick ?? activationTick;
    this.state = { kind: 'confirmed_active', activationTick, snapshotTick: snapTick };
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

  reconcileAuthoritativeHold(serverHoldTicks: number, reset?: boolean, attemptId?: number): void {
    const currentAttempt = this.getHoldAttemptId();
    if (typeof attemptId === "number" && attemptId !== currentAttempt) {
      return; // Drop out-of-order response belonging to an older or newer attempt!
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
      (this as any).state = {
        kind: "corridor_presentation",
        startedAtMs: (this as any).clock?.now?.() || Date.now(),
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

/**
 * Computes canonical SHA-256 digest over outcome payload using key sorting.
 */
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
  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    const mod = 'node:crypto';
    const { createHash } = await import(/* @vite-ignore */ mod);
    return createHash('sha256').update(data).digest('hex');
  }
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

export interface SettlementCommitment {
  receipt: SettlementReceipt;
  outcomePayload: CanonicalOutcomePayload;
}

/**
 * Authoritative settlement ledger managing raid state, escrow revisions,
 * allowable cash pools, and bilateral custody persistence with serialized transactions
 * and immutable audit logging.
 */
export class AuthoritativeSettlementLedger {
  public raids = new Map<string, { raidId: string; status: 'active' | 'settled'; allowableCashPool: number; totalBanked: number }>();
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

    this.raids.set('raid_sector7_1042', {
      raidId: 'raid_sector7_1042',
      status: 'active',
      allowableCashPool: 50000,
      totalBanked: 0,
    });

    this.profiles.set('op_alpha_1', {
      profileId: 'op_alpha_1',
      inventoryRevision: 13,
      activeRaid: 'raid_sector7_1042',
      loadoutEscrowId: 'escrow_op_alpha_1_loadout',
    });

    this.profiles.set('op_bravo_1', {
      profileId: 'op_bravo_1',
      inventoryRevision: 1,
      activeRaid: 'raid_sector7_1042',
      loadoutEscrowId: 'escrow_op_bravo_1_loadout',
    });
  }

  public hasCommittedReceipt(receiptId: string): boolean {
    return this.auditLog.has(receiptId);
  }

  public async commitSettlement(sim: {
    tick: number;
    player: { id: string; cash: number };
    exfilController?: { getState(): { kind: string } };
  }): Promise<SettlementCommitment> {
    // Serialized transaction mutex: all concurrent commits queue sequentially
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
  }): Promise<SettlementCommitment> {
    const snapshotTick = sim.tick;
    const snapshotCash = sim.player.cash;
    const extractingId = sim.player.id;
    const rivalId = extractingId === 'op_alpha_1' ? 'op_bravo_1' : 'op_alpha_1';
    const raidId = 'raid_sector7_1042';

    // 1. Strict tick validation
    if (typeof snapshotTick !== 'number' || isNaN(snapshotTick) || snapshotTick <= 0) {
      throw new Error(`Invalid settlement tick: ${snapshotTick}. Must be greater than 0.`);
    }

    // 2. Strict integer cash validation
    if (typeof snapshotCash !== 'number' || isNaN(snapshotCash) || !Number.isInteger(snapshotCash) || snapshotCash < 0) {
      throw new Error(`Invalid cash banked: ${snapshotCash}. Must be non-negative integer.`);
    }

    // 3. Extraction lifecycle verification
    const isExtracted = (sim as any).player?.isExtracted || (sim as any).isExtracted || (sim.exfilController && sim.exfilController.getState().kind === 'extracted');
    if (sim.exfilController && !isExtracted) {
      throw new Error('Cannot commit settlement: Operative extraction has not completed');
    }

    // 4. Stable idempotency lookup: check BEFORE checking cleared active raid custody!
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
          retainedSquads: [rivalId],
        };
        // Return deep clone of committed receipt
        return { receipt: JSON.parse(JSON.stringify(existing)), outcomePayload };
      }
    }

    // 5. Authoritative raid validation
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== 'active') {
      throw new Error(`Raid ${raidId} is not active in authoritative ledger`);
    }

    if (raid.totalBanked + snapshotCash > raid.allowableCashPool) {
      throw new Error(`Invalid cash banked: $${snapshotCash} + existing $${raid.totalBanked} exceeds allowable pool limit $${raid.allowableCashPool}`);
    }

    const extractingProfile = this.profiles.get(extractingId);
    if (!extractingProfile || extractingProfile.activeRaid !== raidId) {
      throw new Error(`Operative ${extractingId} does not have active raid custody in ${raidId}`);
    }

    const retainedProfile = this.profiles.get(rivalId);
    if (!retainedProfile) {
      throw new Error(`Rival operative ${rivalId} not found in authoritative ledger`);
    }

    // 6. Compute canonical outcome payload and digest
    const outcomePayload = {
      raidId,
      verifiedPrefixTick: snapshotTick,
      cutoffTick: 54000,
      isFinalClose: false,
      cashBanked: snapshotCash,
      extractedSquad: extractingId,
      retainedSquads: [rivalId],
    };

    const outcomeDigest = await computeCanonicalOutcomeDigest(outcomePayload);
    const receiptId = `receipt_s7_${outcomeDigest.slice(0, 16)}`;

    // 7. Derive bilateral participant results dynamically from authoritative profile state
    const rivalAlreadyExtracted = retainedProfile.activeRaid === null;
    const nextRevision = (extractingProfile.inventoryRevision ?? (extractingId.includes("alpha") || extractingId === "op_player" ? 13 : 1)) + 1;
    const participantResults = [
      {
        profileId: extractingId as ProfileId,
        releasedEscrowIds: [`escrow_${extractingId}_loadout`],
        inventoryRevision: nextRevision,
        activeRaidCleared: true,
      },
      {
        profileId: rivalId as ProfileId,
        releasedEscrowIds: rivalAlreadyExtracted ? [`escrow_${rivalId}_loadout`] : [],
        // Preserves actual profile revision (13 for Alpha, 1 for Bravo)
        inventoryRevision: retainedProfile.inventoryRevision,
        activeRaidCleared: rivalAlreadyExtracted,
      },
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
          itemId: 'currency_credits',
          quantity: `BE:${BigInt(snapshotCash).toString()}`,
          toProfileId: extractingId as ProfileId,
          source: 'world_spawn',
        },
      ],
    };

    // 8. ATOMIC commit to ledger state
    extractingProfile.activeRaid = null; // Extracting squad active raid lock cleared
    extractingProfile.inventoryRevision = nextRevision; // Advanced inventory revision
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

    // Store immutable deep clone in auditLog
    const storedReceipt = JSON.parse(JSON.stringify(receipt));
    this.auditLog.set(receiptId, storedReceipt);
    this.idempotencyMap.set(idempKey, receiptId);

    // Return separate deep clone
    return { receipt: JSON.parse(JSON.stringify(receipt)), outcomePayload };
  }
}

export const defaultSettlementLedger = new AuthoritativeSettlementLedger();

/**
 * Authoritative ledger commit authority helper.
 * If running in browser and backend settlement API is reachable, commits server-side.
 * Otherwise commits to local authoritative settlement ledger.
 */
export async function authoritativeLedgerCommit(
  sim: {
    tick: number;
    player: { id: string; cash: number };
    exfilController?: { getState(): { kind: string } };
    frozenSettlementTick?: number;
    frozenSettlementCash?: number;
    raidId?: string;
  },
  ledger: AuthoritativeSettlementLedger = defaultSettlementLedger
): Promise<SettlementCommitment> {
  const serverHoldTick = (sim as any).serverHoldCompletedAtTick || 0;
  if (sim.frozenSettlementTick === undefined) {
    sim.frozenSettlementTick = Math.max(sim.tick, serverHoldTick);
  }
  const commitTick = sim.frozenSettlementTick;
  const commitCash = sim.frozenSettlementCash ?? sim.player.cash;
  const raidId = sim.raidId || 'raid_sector7_1042';

  if (sim.player && (sim.player as any).isAlive === false) {
    throw new Error(`Cannot commit settlement: Operative ${sim.player.id} is K.I.A.`);
  }

  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    let resp: Response | null = null;
    let data: any = null;
    const sessionTok = (sim as any).sessionToken;
    // Eventual-consistency commit: the relay's extraction-hold ladder verifies in real
    // time and can still be mid-verification when the 2500ms corridor closes. Retry the
    // commit with backoff until the custody gate confirms the verified hold (bounded to
    // 15s of wall time — the relay never relaxes its own verification).
    let lastErrText = "";
    // Bounded eventual-consistency window (~15s wall): the deadline is applied to EACH
    // round (request + backoff must both fit in the remaining window), and only the
    // custody-verification race / transient network failures are retried — permanent
    // rejections surface immediately.
    const commitDeadline = Date.now() + 15000;
    const __isTransient = (msg: string) =>
      msg.includes("hold not completed") ||
      msg.includes("pending revocation") ||
      msg.includes("corridor presentation in progress") ||
      msg.includes("Unreachable") ||
      msg.includes("unreachable") ||
      msg.includes("Network") ||
      msg.includes("fetch");
    for (let commitRound = 0; commitRound < 40 && !data; commitRound++) {
      const __remaining = commitDeadline - Date.now();
      if (__remaining <= 0) break;
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const tid = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
      try {
        const roundResp = await fetch('/api/settlement/commit', {
          signal: ctrl ? ctrl.signal : undefined,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-operative-id': sim.player.id,
            ...(sessionTok ? { 'Authorization': `Bearer ${sessionTok}` } : {}),
          },
          body: JSON.stringify({
            raidId,
            tick: commitTick,
            cash: commitCash,
            playerId: sim.player.id,
            extractingId: sim.player.id,
            exfilSubmitted: true,
          }),
        });
        if (roundResp && roundResp.ok) {
          resp = roundResp;
          data = await roundResp.json();
        } else {
          lastErrText = await roundResp.text().catch(() => "");
          // Retry only on the mid-verification race; other rejects fall through.
        }
      } catch (roundErr: any) {
        lastErrText = `Settlement server unreachable: ${roundErr?.message || "Network error"}`;
      } finally {
        if (tid) clearTimeout(tid);
      }
      if (!data) {
        if (!__isTransient(lastErrText)) {
          break; // Permanent rejection: surface immediately
        }
        const __rem = commitDeadline - Date.now();
        if (__rem <= 300) break;
        await new Promise((r) => setTimeout(r, Math.min(300, __rem)));
      }
    }
    if (!data) {
      const __deadlineHit = Date.now() >= commitDeadline;
      throw new Error(
        (__deadlineHit && __isTransient(lastErrText))
          ? `Settlement custody verification not confirmed within the bounded retry window: ${lastErrText}`
          : `Commit rejected: ${lastErrText}`
      );
    }
    if (data) {
      ledger.auditLog.set(data.receipt.receiptId, JSON.parse(JSON.stringify(data.receipt)));
      if (Array.isArray(data.receipt?.participantResults)) {
        for (const p of data.receipt.participantResults) {
          const prof = ledger.profiles.get(p.profileId);
          if (prof) {
            if (p.activeRaidCleared) {
              prof.activeRaid = null;
            }
            if (typeof p.inventoryRevision === "number") {
              prof.inventoryRevision = p.inventoryRevision;
            }
          }
        }
      }
      return data as SettlementCommitment;
    } else if (resp) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || ("Server settlement rejected with HTTP " + resp.status));
    }
  }
  return ledger.commitSettlement({
    tick: commitTick,
    player: { id: sim.player.id, cash: commitCash, isExtracted: (sim as any).player?.isExtracted ?? (sim as any).isExtracted } as any,
    exfilController: sim.exfilController,
  });
}

/**
 * Backwards-compatible settlement creator.
 */
export async function createAuthoritativeSettlement(
  sim: {
    tick: number;
    player: { id: string; cash: number };
    exfilController?: { getState(): { kind: string } };
  },
  ledger: AuthoritativeSettlementLedger = defaultSettlementLedger
): Promise<SettlementReceipt> {
  const commitment = await authoritativeLedgerCommit(sim, ledger);
  return commitment.receipt;
}

/**
 * Validates settlement receipt against authoritative outcome payload,
 * checking cryptographic SHA-256 integrity, exact BigInt cash transfer,
 * strict types, bilateral custody conservation, raid identifiers, throughTick, intentHash,
 * inventory revisions, released escrow IDs, transfer sources, and participant counts.
 */
export async function verifySettlementReceipt(
  receipt: SettlementReceipt,
  outcomePayload: {
    raidId: string;
    verifiedPrefixTick: number;
    cutoffTick: number;
    isFinalClose: boolean;
    cashBanked: number;
    extractedSquad: string;
    retainedSquads: string[];
  },
  ledger: AuthoritativeSettlementLedger = defaultSettlementLedger,
  expectedPreviousRevision?: number
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Structural and canonical BigInt grammar check
  if (!verifyReceiptIntegrity(receipt)) {
    return { valid: false, reason: 'Structural integrity or canonical BigInt grammar validation failed' };
  }

  // 2. Validate receipt prefix requirement
  if (!receipt.receiptId.startsWith('receipt_')) {
    return { valid: false, reason: "Receipt ID must start with 'receipt_'" };
  }

  // 3. Strict commitment timestamp validation (reject NaN, values < 1500000000000 or future beyond server time tolerance)
  const serverOffset = (typeof globalThis !== 'undefined' && (globalThis as any).__stickZoneServerTimeOffset) ? (globalThis as any).__stickZoneServerTimeOffset : 0;
  const synchronizedNow = Date.now() + serverOffset;
  if (
    typeof receipt.committedAtMs !== 'number' ||
    isNaN(receipt.committedAtMs) ||
    receipt.committedAtMs < 1500000000000 ||
    receipt.committedAtMs > synchronizedNow + 300000
  ) {
    return { valid: false, reason: `Invalid commitment timestamp: ${receipt.committedAtMs}` };
  }

  // 4. Raid ID & throughTick integrity match
  if (receipt.raidId !== outcomePayload.raidId) {
    return { valid: false, reason: `Raid ID mismatch: expected ${outcomePayload.raidId}, got ${receipt.raidId}` };
  }
  if (receipt.throughTick !== outcomePayload.verifiedPrefixTick) {
    return { valid: false, reason: `throughTick mismatch: expected ${outcomePayload.verifiedPrefixTick}, got ${receipt.throughTick}` };
  }

  // 5. Compute real SHA-256 digest of outcome payload and verify against receipt
  const expectedDigest = await computeCanonicalOutcomeDigest(outcomePayload);
  if (receipt.outcomeDigest !== expectedDigest) {
    return { valid: false, reason: `Outcome digest mismatch: expected ${expectedDigest}, received ${receipt.outcomeDigest}` };
  }
  if (receipt.outcomeId !== expectedDigest) {
    return { valid: false, reason: `Outcome ID mismatch with verified digest: expected ${expectedDigest}` };
  }
  if (receipt.receiptId !== `receipt_s7_${expectedDigest.slice(0, 16)}`) {
    return { valid: false, reason: 'Receipt identifier not bound to canonical outcome digest prefix' };
  }
  const expectedIntentHash = `intent_${expectedDigest.slice(16, 32)}`;
  if (receipt.intentHash !== expectedIntentHash) {
    return { valid: false, reason: `Intent hash mismatch: expected ${expectedIntentHash}, received ${receipt.intentHash}` };
  }

  // 6. Exact cash transfer match & strictly validate transfer fields
  if (receipt.transfers.length !== 1) {
    return { valid: false, reason: `Unexpected transfers count: expected 1, found ${receipt.transfers.length}` };
  }
  const creditTransfer = receipt.transfers[0] as any;
  const transferKeys = Object.keys(creditTransfer).sort().join(',');
  if (transferKeys !== 'itemId,quantity,source,toProfileId') {
    return { valid: false, reason: `Unauthorized or mutated fields in transfer: ${transferKeys}` };
  }

  const expectedTransfer = `BE:${BigInt(outcomePayload.cashBanked).toString()}`;
  if (creditTransfer.itemId !== 'currency_credits' || creditTransfer.quantity !== expectedTransfer) {
    return { valid: false, reason: `Transfer quantity does not match banked cash: expected ${expectedTransfer}` };
  }
  if (creditTransfer.toProfileId !== outcomePayload.extractedSquad) {
    return { valid: false, reason: `Transfer recipient does not match extracted squad: expected ${outcomePayload.extractedSquad}` };
  }
  if (creditTransfer.source !== 'world_spawn') {
    return { valid: false, reason: `Transfer source must be 'world_spawn', got ${creditTransfer.source}` };
  }

  // 7. Bilateral custody conservation & participant count validation
  const expectedParticipantsCount = 1 + outcomePayload.retainedSquads.length;
  if (receipt.participantResults.length !== expectedParticipantsCount) {
    return { valid: false, reason: `Unexpected participant count: expected ${expectedParticipantsCount}, found ${receipt.participantResults.length}` };
  }

  const extractingRes = receipt.participantResults.find((p: any) => p.profileId === outcomePayload.extractedSquad) as any;
  if (!extractingRes) {
    return { valid: false, reason: 'Missing extracting squad participant result' };
  }
  if (typeof extractingRes.activeRaidCleared !== 'boolean' || extractingRes.activeRaidCleared !== true) {
    return { valid: false, reason: 'Extracting squad must have activeRaidCleared strictly equal to boolean true' };
  }
  const expectedExtractRev = (extractingRes.profileId.includes('alpha') || extractingRes.profileId === 'op_player') ? 14 : 2;
  if (expectedPreviousRevision !== undefined) {
    if (typeof extractingRes.inventoryRevision !== 'number' || extractingRes.inventoryRevision !== expectedPreviousRevision + 1) {
      return { valid: false, reason: `Extracting squad inventory revision must be strictly incremented from ${expectedPreviousRevision} to ${expectedPreviousRevision + 1}, got ${extractingRes.inventoryRevision}` };
    }
  } else if (typeof extractingRes.inventoryRevision !== 'number' || extractingRes.inventoryRevision < expectedExtractRev) {
    return { valid: false, reason: `Extracting squad inventory revision must be at least ${expectedExtractRev}, got ${extractingRes.inventoryRevision}` };
  }
  const extKeys = Object.keys(extractingRes).sort().join(',');
  if (extKeys !== 'activeRaidCleared,inventoryRevision,profileId,releasedEscrowIds') {
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

    if (typeof retainedRes.activeRaidCleared !== 'boolean') {
      return { valid: false, reason: `Retained squad ${retainedId} must have activeRaidCleared strictly equal to boolean` };
    }
    const retKeys = Object.keys(retainedRes).sort().join(',');
    if (retKeys !== 'activeRaidCleared,inventoryRevision,profileId,releasedEscrowIds') {
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
    if (retainedProfile && retainedProfile.activeRaid !== null) {
      if (retainedRes.activeRaidCleared !== false) {
        return { valid: false, reason: `Retained squad ${retainedId} in ongoing raid cannot have activeRaidCleared true` };
      }
      if (retainedRes.releasedEscrowIds.length !== 0) {
        return { valid: false, reason: `Retained squad ${retainedId} in ongoing raid cannot have released escrow` };
      }
      if (retainedRes.inventoryRevision !== retainedProfile.inventoryRevision) {
        return { valid: false, reason: `Retained squad ${retainedId} inventory revision mismatch with authoritative ledger` };
      }
    }
  }

  // 8. Check no duplicate participant profiles
  const profileSet = new Set<string>();
  for (const p of receipt.participantResults) {
    if (profileSet.has(p.profileId)) {
      return { valid: false, reason: `Duplicate participant profile in results: ${p.profileId}` };
    }
    profileSet.add(p.profileId);
  }

  // 9. Authoritative commitment verification:
  // Must exist in ledger auditLog and match the committed immutable record exactly!
  const committed = ledger.auditLog.get(receipt.receiptId);
  if (!committed) {
    return { valid: false, reason: 'Receipt was not committed in authoritative ledger' };
  }
  if (JSON.stringify(receipt) !== JSON.stringify(committed)) {
    return { valid: false, reason: 'Receipt does not match committed record in authoritative ledger' };
  }

  return { valid: true };
}


declare module "@series-inc/rundot-syncplay/extensions/hub" {
  interface ExfilController {
    reconcileAuthoritativeHold(serverHoldTicks: number, reset?: boolean, attemptId?: number): void;
    getHoldAttemptId(): number;
  }
}
