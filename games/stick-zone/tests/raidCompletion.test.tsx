/**
 * Raid completion contract. The SyncHub debrief is the only settlement
 * authority. Offline extraction is practice and banks nothing. The flow
 * runs one attempt at a time, retries after failure, and applies a
 * completion once.
 */
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createExfilController, type RaidExfilController } from "../src/sim/airlock.js";
import * as airlock from "../src/sim/airlock.js";
import {
  RaidCompletionFlow,
  completionFromDebrief,
  type CompletionSource,
  type RaidCompletion,
} from "../src/sim/raidCompletion.js";
import type { DebriefInput } from "../src/sim/coopAdapter.js";
import { SectorDepotSimulation } from "../src/sim/game.js";
import { TacticalHud } from "../src/components/TacticalHud.js";
import { ExfilOverlay } from "../src/components/ExfilOverlay.js";
import { useStashStore } from "../src/progression/stashStore.js";
import { SIM_CONFIG } from "../src/sim/config.js";

const RAID_ID = "raid-complete-1";

function settledDebrief(overrides: Partial<DebriefInput> = {}): DebriefInput {
  return {
    v: 1,
    settled: true,
    raidId: RAID_ID,
    receiptId: "rcpt-complete-1",
    outcomeId: "out-1",
    outcomeDigest: "digest-1",
    throughTick: 90,
    transfers: [
      { itemId: "currency_credits", quantity: "1200", toProfileId: "profile-a", source: "world" },
    ],
    participantResults: [],
    committedAtMs: 1,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Drive a controller through the hold and past the corridor. */
function controllerAtCorridorEnd(): { exfil: RaidExfilController; clock: { t: number } } {
  const clock = { t: 1_000 };
  const exfil = createExfilController({ now: () => clock.t });
  for (let tick = 1; tick <= SIM_CONFIG.EXFIL_HOLD_TICKS; tick++) {
    exfil.onTick(tick, true, "lz_sector7_charlie", 0);
  }
  expect(exfil.getState().kind).toBe("corridor_presentation");
  clock.t += SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS + 1;
  return { exfil, clock };
}

function makeFlow(source: CompletionSource, exfil: RaidExfilController) {
  const log: string[] = [];
  const completed: RaidCompletion[] = [];
  const flow = new RaidCompletionFlow({
    exfil: () => exfil,
    raidId: () => RAID_ID,
    source: () => source,
    log: (line) => log.push(line),
    onCompleted: (completion) => completed.push(completion),
  });
  return { flow, log, completed };
}

describe("completionFromDebrief", () => {
  it("maps a settled debrief to a settled completion", () => {
    const completion = completionFromDebrief(RAID_ID, settledDebrief());
    expect(completion).toEqual({
      kind: "settled",
      raidId: RAID_ID,
      receiptId: "rcpt-complete-1",
      transferCount: 1,
    });
  });

  it("maps a void resolution to a voided completion with its reason", () => {
    const completion = completionFromDebrief(
      RAID_ID,
      settledDebrief({
        settled: true,
        transfers: [],
        resolution: { kind: "void", reason: "owner-lost", refundedProfiles: ["p"], refunds: [] },
      }),
    );
    expect(completion).toEqual({
      kind: "voided",
      raidId: RAID_ID,
      receiptId: "rcpt-complete-1",
      reason: "owner-lost",
    });
  });

  it("rejects an unsettled void debrief", () => {
    expect(() => completionFromDebrief(RAID_ID, settledDebrief({
      settled: false,
      resolution: { kind: "void", reason: "owner-lost", refundedProfiles: [], refunds: [] },
    }))).toThrow(/not settled/);
  });

  it("rejects a debrief for another raid", () => {
    expect(() => completionFromDebrief(RAID_ID, settledDebrief({ raidId: "other" }))).toThrow(/raid/);
  });

  it("rejects an unsettled debrief without a void resolution", () => {
    expect(() => completionFromDebrief(RAID_ID, settledDebrief({ settled: false }))).toThrow(/not settled/);
  });
});

describe("RaidCompletionFlow", () => {
  it("completes offline extraction as practice without a network request", async () => {
    const { exfil } = controllerAtCorridorEnd();
    const { flow, log, completed } = makeFlow({ kind: "practice" }, exfil);

    const completion = await flow.begin();

    expect(completion).toEqual({ kind: "practice", raidId: RAID_ID });
    const state = exfil.getState();
    expect(state.kind).toBe("extracted");
    if (state.kind === "extracted") expect(state.completion).toEqual(completion);
    expect(completed).toEqual([completion]);
    expect(log.some((line) => line.includes("[PRACTICE]") && line.includes("No cash, items, or XP"))).toBe(true);
  });

  it("settles co-op extraction only from the debrief", async () => {
    const { exfil } = controllerAtCorridorEnd();
    const gate = deferred<DebriefInput>();
    let requests = 0;
    const { flow, completed } = makeFlow(
      { kind: "coop", requestDebrief: () => { requests += 1; return gate.promise; } },
      exfil,
    );

    const pending = flow.begin();
    expect(exfil.getState().kind).toBe("submitting_settlement");
    expect(completed).toHaveLength(0);

    gate.resolve(settledDebrief());
    const completion = await pending;

    expect(requests).toBe(1);
    expect(completion?.kind).toBe("settled");
    expect(exfil.getState().kind).toBe("extracted");
    expect(completed).toHaveLength(1);
  });

  it("runs one attempt for duplicate begin calls and completes once", async () => {
    const { exfil } = controllerAtCorridorEnd();
    const gate = deferred<DebriefInput>();
    let requests = 0;
    const { flow, completed } = makeFlow(
      { kind: "coop", requestDebrief: () => { requests += 1; return gate.promise; } },
      exfil,
    );

    const first = flow.begin();
    const second = flow.begin();
    gate.resolve(settledDebrief());
    const [a, b] = await Promise.all([first, second]);
    const third = await flow.begin();

    expect(requests).toBe(1);
    expect(a).toEqual(b);
    expect(third).toEqual(a);
    expect(completed).toHaveLength(1);
  });

  it("copies the final result before the SDK response can change", async () => {
    const { exfil } = controllerAtCorridorEnd();
    const debrief = settledDebrief();
    const { flow, completed } = makeFlow({ kind: "coop", requestDebrief: async () => debrief }, exfil);
    const first = await flow.begin();
    debrief.receiptId = "changed-receipt";
    debrief.transfers.length = 0;
    expect(await flow.begin()).toEqual(first);
    expect(first).toMatchObject({ receiptId: "rcpt-complete-1", transferCount: 1 });
    expect(completed).toHaveLength(1);
  });

  it("preserves finality if a completion callback fails", async () => {
    const { exfil } = controllerAtCorridorEnd();
    const log: string[] = [];
    const flow = new RaidCompletionFlow({
      exfil: () => exfil, raidId: () => RAID_ID, source: () => ({ kind: "practice" }),
      log: (line) => log.push(line),
      onCompleted: () => { throw new Error("refresh failed"); },
    });
    expect((await flow.begin())?.kind).toBe("practice");
    expect(exfil.getState().kind).toBe("extracted");
    expect(log.some((line) => line.includes("Completion callback failed"))).toBe(true);
    expect(log.some((line) => line.includes("Settlement failed"))).toBe(false);
  });

  it("moves to a retryable failure when the debrief fails, then retries", async () => {
    const { exfil } = controllerAtCorridorEnd();
    let attempt = 0;
    const { flow, completed } = makeFlow(
      {
        kind: "coop",
        requestDebrief: async () => {
          attempt += 1;
          if (attempt === 1) throw new Error("debrief poll timed out");
          return settledDebrief();
        },
      },
      exfil,
    );

    expect(await flow.begin()).toBeNull();
    const failed = exfil.getState();
    expect(failed.kind).toBe("failed");
    if (failed.kind === "failed") {
      expect(failed.canRetry).toBe(true);
      expect(failed.reason).toContain("debrief poll timed out");
    }
    expect(completed).toHaveLength(0);

    const retried = await flow.retry();
    expect(retried?.kind).toBe("settled");
    expect(exfil.getState().kind).toBe("extracted");
    expect(completed).toHaveLength(1);
    expect(attempt).toBe(2);
  });

  it("does not start before the corridor presentation ends", async () => {
    const clock = { t: 0 };
    const exfil = createExfilController({ now: () => clock.t });
    for (let tick = 1; tick <= SIM_CONFIG.EXFIL_HOLD_TICKS; tick++) {
      exfil.onTick(tick, true, "lz_sector7_charlie", 0);
    }
    let requests = 0;
    const { flow } = makeFlow(
      { kind: "coop", requestDebrief: async () => { requests += 1; return settledDebrief(); } },
      exfil,
    );
    expect(await flow.begin()).toBeNull();
    expect(exfil.getState().kind).toBe("corridor_presentation");
    expect(requests).toBe(0);
  });

  it("keeps the server outcome when local damage lands during the debrief wait", async () => {
    const { exfil } = controllerAtCorridorEnd();
    const gate = deferred<DebriefInput>();
    const { flow } = makeFlow({ kind: "coop", requestDebrief: () => gate.promise }, exfil);
    const pending = flow.begin();
    exfil.onDamageTaken();
    expect(exfil.getState().kind).toBe("submitting_settlement");
    gate.resolve(settledDebrief());
    expect((await pending)?.kind).toBe("settled");
  });
});

describe("simulation completion wiring", () => {
  beforeEach(() => {
    useStashStore.getState().resetProgress();
  });

  it("offline practice extraction banks no cash, items, or XP", async () => {
    const sim = new SectorDepotSimulation(RAID_ID, "spoke");
    const clock = { t: 0 };
    sim.exfilController = createExfilController({ now: () => clock.t });
    sim.player.cash = 4_500;
    for (let tick = 1; tick <= SIM_CONFIG.EXFIL_HOLD_TICKS; tick++) {
      sim.exfilController.onTick(tick, true, "lz_sector7_charlie", 0);
    }
    clock.t += SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS + 1;
    const before = useStashStore.getState();
    const snapshot = { bankCash: before.bankCash, xp: before.xp, stash: JSON.stringify(before.stashItems), stats: JSON.stringify(before.stats) };

    expect(sim.coopSpokeAttached).toBe(false);
    const completion = await sim.raidCompletion.begin();

    expect(completion).toEqual({ kind: "practice", raidId: RAID_ID });
    expect(sim.player.isExtracted).toBe(true);
    const after = useStashStore.getState();
    expect(after.bankCash).toBe(snapshot.bankCash);
    expect(after.xp).toBe(snapshot.xp);
    expect(JSON.stringify(after.stashItems)).toBe(snapshot.stash);
    expect(JSON.stringify(after.stats)).toBe(snapshot.stats);
  });

  it("removes the local ledger and receipt verification exports", () => {
    const exported = Object.keys(airlock);
    for (const legacy of [
      "AuthoritativeSettlementLedger",
      "defaultSettlementLedger",
      "authoritativeLedgerCommit",
      "verifySettlementReceipt",
      "createAuthoritativeSettlement",
      "computeCanonicalOutcomeDigest",
      "recordVerifiedReceipt",
      "isReceiptContentVerified",
      "registerDeployment",
    ]) {
      expect(exported).not.toContain(legacy);
    }
    const store = useStashStore.getState() as unknown as Record<string, unknown>;
    expect(store.recordVerifiedSettlement).toBeUndefined();
    expect(store.recordRaidOutcome).toBeUndefined();
  });
});

describe("ExfilOverlay completion screens", () => {
  function simWithCompletion(completion: RaidCompletion): SectorDepotSimulation {
    const sim = new SectorDepotSimulation(completion.raidId, "spoke");
    const clock = { t: 0 };
    sim.exfilController = createExfilController({ now: () => clock.t });
    for (let tick = 1; tick <= SIM_CONFIG.EXFIL_HOLD_TICKS; tick++) {
      sim.exfilController.onTick(tick, true, "lz_sector7_charlie", 0);
    }
    clock.t += SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS + 1;
    sim.exfilController.submitSettlement();
    sim.exfilController.complete(completion);
    sim.player.isExtracted = true;
    return sim;
  }

  const render = (sim: SectorDepotSimulation) =>
    renderToStaticMarkup(<ExfilOverlay sim={sim} onRestart={() => undefined} onReturnToHideout={() => undefined} />);

  it("keeps debrief recovery visible after fatal local bleeding", () => {
    const sim = new SectorDepotSimulation(RAID_ID, "spoke");
    sim.admitOperative(0);
    sim.exfilController = controllerAtCorridorEnd().exfil;
    sim.exfilController.submitSettlement();
    sim.coopDebriefRequest = async () => settledDebrief();
    sim.player.health = 1;
    sim.player.isBleeding = true;
    sim.tick = 59;
    sim.step({ dx: 0, dz: 0, sprint: false, slide: false, roll: false, shoot: false, reload: false, kick: false, interact: false, aimAngle: 0 });
    expect(sim.player.isAlive).toBe(false);
    expect(render(sim)).toContain("WAITING FOR SYNCHUB DEBRIEF");
    sim.exfilController.onFailure("poll timed out", true);
    expect(render(sim)).toContain("Retry Debrief");
    expect(render(sim)).toContain("Return to Hideout");
  });

  it("shows practice completion with nothing banked and no receipt claim", () => {
    const html = render(simWithCompletion({ kind: "practice", raidId: RAID_ID }));
    expect(html).toContain("PRACTICE RUN COMPLETE");
    expect(html).toContain("No cash, items, or XP banked");
    expect(html).not.toMatch(/cryptographic/i);
    expect(html).not.toMatch(/RECEIPT/);
    expect(html).not.toMatch(/BANKED PAYOUT/);
  });

  it("shows the settled debrief without claiming cryptographic verification", () => {
    const html = render(simWithCompletion({ kind: "settled", raidId: RAID_ID, receiptId: "rcpt-xyz", transferCount: 2 }));
    expect(html).toContain("SYNCHUB DEBRIEF SETTLED");
    expect(html).toContain("rcpt-xyz");
    expect(html).not.toMatch(/cryptographic/i);
    expect(html).not.toMatch(/verified/i);
  });

  it("shows a voided debrief as a refund, never as gains", () => {
    const html = render(simWithCompletion({ kind: "voided", raidId: RAID_ID, receiptId: "rcpt-void", reason: "owner-lost" }));
    expect(html).toContain("RAID VOIDED");
    expect(html).toContain("owner-lost");
    expect(html).not.toMatch(/BANKED PAYOUT/);
  });
});

describe("co-op HUD clock", () => {
  it("shows syncing while the drop snapshot is pending after a long hub wait", () => {
    const sim = new SectorDepotSimulation(RAID_ID, "hub");
    sim.tick = 60_000;
    sim.coopDebriefRequest = async () => settledDebrief();
    const html = renderToStaticMarkup(<TacticalHud sim={sim} />);
    expect(html).toContain(">SYNCING</span>");
  });
  it("uses confirmed raid time even when the local clock still has hub time", () => {
    const sim = new SectorDepotSimulation(RAID_ID, "hub");
    sim.tick = 60_000;
    sim.coopDebriefRequest = async () => settledDebrief();
    sim.coopConfirmedTick = 8;
    expect(renderToStaticMarkup(<TacticalHud sim={sim} />)).toContain(">4:58</span>");
  });

});
