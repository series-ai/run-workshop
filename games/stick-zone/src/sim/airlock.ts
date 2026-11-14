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
 * Staged ingress, the local exfil state machine, and co-op raid
 * preparation through the typed SyncHub facade.
 */

import { SIM_CONFIG } from "./config.js";
import type { RaidCompletion } from "./raidCompletion.js";

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

export type RaidExfilState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "holding_zone";
      readonly currentTicks: number;
      readonly targetTicks: number;
      readonly zoneId: string;
    }
  | { readonly kind: "corridor_presentation"; readonly startedAtMs: number; readonly durationMs: number }
  | { readonly kind: "submitting_settlement"; readonly startedAtMs: number }
  | { readonly kind: "extracted"; readonly completion: RaidCompletion }
  | { readonly kind: "failed"; readonly reason: string; readonly canRetry: boolean; readonly canReturnToRaid: boolean };

export interface RaidExfilOptions {
  targetHoldTicks: number;
  corridorDurationMs: number;
  clock?: { now(): number };
}

/**
 * Local exfil state machine: zone hold, corridor presentation, and the
 * completion phase. The completion is a practice run or a SyncHub
 * debrief (see raidCompletion.ts). This controller holds no ledger.
 */
export class RaidExfilController {
  private state: RaidExfilState = { kind: "idle" };
  private lastProcessedTick = -1;
  private readonly targetHoldTicks: number;
  private readonly corridorDurationMs: number;
  private readonly clock: { now(): number };

  constructor(options: RaidExfilOptions) {
    this.targetHoldTicks = options.targetHoldTicks;
    this.corridorDurationMs = options.corridorDurationMs;
    this.clock = options.clock ?? { now: () => Date.now() };
  }

  public getState(): RaidExfilState {
    return this.state;
  }

  public isInputLocked(): boolean {
    const kind = this.state.kind;
    return kind === "corridor_presentation" || kind === "submitting_settlement" || kind === "extracted";
  }

  public onTick(tick: number, inZone: boolean, zoneId: string, damageTaken = 0): void {
    if (this.state.kind === "extracted") return;
    if (tick <= this.lastProcessedTick) return;
    this.lastProcessedTick = tick;
    const st = this.state;
    if (st.kind === "idle") {
      if (inZone && damageTaken === 0) {
        this.state = { kind: "holding_zone", currentTicks: 1, targetTicks: this.targetHoldTicks, zoneId };
      }
      return;
    }
    if (st.kind !== "holding_zone") return;
    if (!inZone || damageTaken > 0) {
      this.state = { kind: "idle" };
    } else if (zoneId !== st.zoneId) {
      this.state = { kind: "holding_zone", currentTicks: 1, targetTicks: this.targetHoldTicks, zoneId };
    } else if (st.currentTicks + 1 >= this.targetHoldTicks) {
      this.state = { kind: "corridor_presentation", startedAtMs: this.clock.now(), durationMs: this.corridorDurationMs };
    } else {
      this.state = { ...st, currentTicks: st.currentTicks + 1 };
    }
  }

  /**
   * Damage resets a hold and cancels the corridor. During the completion
   * phase the outcome belongs to the debrief, so damage changes nothing.
   */
  public onDamageTaken(): void {
    if (this.state.kind === "holding_zone" || this.state.kind === "corridor_presentation") {
      this.state = { kind: "idle" };
    }
  }

  public isCorridorComplete(): boolean {
    const st = this.state;
    return st.kind === "corridor_presentation" && this.clock.now() - st.startedAtMs >= st.durationMs;
  }

  public submitSettlement(): void {
    if (!this.isCorridorComplete()) {
      throw new Error(`Cannot start raid completion from state "${this.state.kind}" before the corridor ends`);
    }
    this.state = { kind: "submitting_settlement", startedAtMs: this.clock.now() };
  }

  /** Server extraction can finish before the local corridor. */
  public submitConfirmedExtraction(): void {
    this.state = { kind: "submitting_settlement", startedAtMs: this.clock.now() };
  }

  /** Apply a completion once. Returns false when the phase already ended. */
  public complete(completion: RaidCompletion): boolean {
    if (this.state.kind !== "submitting_settlement") return false;
    this.state = { kind: "extracted", completion };
    return true;
  }

  public onFailure(reason: string, canRetry = true, canReturnToRaid = false): void {
    if (this.state.kind !== "submitting_settlement") {
      throw new Error(`Cannot fail raid completion from state "${this.state.kind}"`);
    }
    this.state = { kind: "failed", reason, canRetry, canReturnToRaid };
  }

  public retrySettlement(): void {
    const st = this.state;
    if (st.kind !== "failed" || !st.canRetry) {
      throw new Error(`Cannot retry raid completion from state "${st.kind}"`);
    }
    this.state = { kind: "submitting_settlement", startedAtMs: this.clock.now() };
  }

  /** Leave the corridor or a failure and return to the raid. */
  public cancel(): void {
    if (this.state.kind === "extracted" || this.state.kind === "submitting_settlement" ||
        (this.state.kind === "failed" && !this.state.canReturnToRaid)) {
      throw new Error(`Cannot cancel exfil from state "${this.state.kind}"`);
    }
    this.state = { kind: "idle" };
  }
}

export function createExfilController(clock?: { now(): number }): RaidExfilController {
  return new RaidExfilController({
    targetHoldTicks: SIM_CONFIG.EXFIL_HOLD_TICKS,
    corridorDurationMs: SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS,
    clock,
  });
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
