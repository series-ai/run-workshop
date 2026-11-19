/**
 * @file raidCompletion.ts
 * Raid completion after the exfil corridor.
 *
 * The SyncHub debrief is the only settlement authority. A co-op raid
 * completes from the debrief that the server sends. An offline raid is
 * practice: it completes locally and banks no cash, items, or XP. The
 * client does not verify the debrief cryptographically. It checks the
 * raid id and the settled flag, and the stash refreshes from the hub.
 */
import type { DebriefInput } from "./coopAdapter.js";
import type { RaidExfilController } from "./airlock.js";

/** The server refused extraction before it accepted the actor. */
export class ExtractionRefusedError extends Error {}

export type RaidCompletion =
  | { readonly kind: "practice"; readonly raidId: string }
  | {
      readonly kind: "settled";
      readonly raidId: string;
      readonly receiptId: string;
      readonly transferCount: number;
    }
  | {
      readonly kind: "voided";
      readonly raidId: string;
      readonly receiptId: string;
      readonly reason: string;
    };

export type CompletionSource =
  | { readonly kind: "practice" }
  | { readonly kind: "coop"; requestDebrief(): Promise<DebriefInput> };

/**
 * Debrief -> completion. Throws when the debrief belongs to another raid
 * or is not settled, so the caller shows a retryable failure.
 */
export function completionFromDebrief(raidId: string, debrief: DebriefInput): RaidCompletion {
  if (debrief.raidId !== raidId) {
    throw new Error(`Debrief is for raid ${debrief.raidId}, expected raid ${raidId}`);
  }
  if (!debrief.settled) {
    throw new Error(`Debrief ${debrief.receiptId} is not settled`);
  }
  if (debrief.resolution?.kind === "void") {
    return {
      kind: "voided",
      raidId,
      receiptId: debrief.receiptId,
      reason: debrief.resolution.reason,
    };
  }
  return {
    kind: "settled",
    raidId,
    receiptId: debrief.receiptId,
    transferCount: debrief.transfers.length,
  };
}

export function completionLogLine(completion: RaidCompletion): string {
  switch (completion.kind) {
    case "practice":
      return "[PRACTICE] Offline raid complete. No cash, items, or XP banked.";
    case "settled":
      return `[CO-OP] Debrief settled: ${completion.receiptId}, ${completion.transferCount} transfer(s).`;
    case "voided":
      return `[CO-OP] Raid voided (${completion.reason}). Loadout refund per debrief ${completion.receiptId}.`;
    default: {
      const unreachable: never = completion;
      throw new Error(`Unknown raid completion: ${JSON.stringify(unreachable)}`);
    }
  }
}

export interface RaidCompletionDeps {
  exfil(): RaidExfilController;
  raidId(): string;
  source(): CompletionSource;
  log(line: string): void;
  onCompleted?(completion: RaidCompletion): void;
}

/**
 * One completion attempt at a time. Duplicate calls share the attempt in
 * flight. After the raid completes, calls return the same completion and
 * start no new request. A failure moves the controller to a retryable
 * failure; `retry` starts the next attempt.
 */
export class RaidCompletionFlow {
  private inFlight: Promise<RaidCompletion | null> | null = null;

  constructor(private readonly deps: RaidCompletionDeps) {}

  /** Start completion when the corridor presentation has ended. */
  public begin(): Promise<RaidCompletion | null> {
    if (this.inFlight) return this.inFlight;
    const exfil = this.deps.exfil();
    const state = exfil.getState();
    if (state.kind === "extracted") return Promise.resolve(state.completion);
    if (state.kind !== "corridor_presentation" || !exfil.isCorridorComplete()) {
      return Promise.resolve(null);
    }
    exfil.submitSettlement();
    return this.run(exfil);
  }

  /** Complete an extraction that the server already confirmed. */
  public beginConfirmedExtraction(): Promise<RaidCompletion | null> {
    if (this.inFlight) return this.inFlight;
    const exfil = this.deps.exfil();
    const state = exfil.getState();
    if (state.kind === "extracted") return Promise.resolve(state.completion);
    if (state.kind === "failed" && !state.canReturnToRaid) return Promise.resolve(null);
    exfil.submitConfirmedExtraction();
    return this.run(exfil);
  }

  /** Start the next attempt after a retryable failure. */
  public retry(): Promise<RaidCompletion | null> {
    if (this.inFlight) return this.inFlight;
    const exfil = this.deps.exfil();
    const state = exfil.getState();
    if (state.kind === "extracted") return Promise.resolve(state.completion);
    if (state.kind !== "failed" || !state.canRetry) return Promise.resolve(null);
    exfil.retrySettlement();
    return this.run(exfil);
  }

  private run(exfil: RaidExfilController): Promise<RaidCompletion | null> {
    const raidId = this.deps.raidId();
    const source = this.deps.source();
    const attempt = (async (): Promise<RaidCompletion | null> => {
      try {
        const completion: RaidCompletion =
          source.kind === "practice"
            ? { kind: "practice", raidId }
            : completionFromDebrief(raidId, await source.requestDebrief());
        if (!exfil.complete(completion)) return null;
        this.deps.log(completionLogLine(completion));
        try {
          this.deps.onCompleted?.(completion);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.deps.log(`[CO-OP] Completion callback failed: ${message}`);
        }
        return completion;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (exfil.getState().kind === "submitting_settlement") {
          exfil.onFailure(`SyncHub debrief failed: ${message}`, true, err instanceof ExtractionRefusedError);
        }
        this.deps.log(`[CO-OP] Settlement failed: ${message}`);
        return null;
      }
    })().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = attempt;
    return attempt;
  }
}
