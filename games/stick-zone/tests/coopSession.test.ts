/**
 * MultiplayerCoordinator co-op session proof. A fake spoke captures what
 * the coordinator submits; confirmed state comes from the real published
 * raid rules. The contract under test: only PlayerRaidIntent shapes reach
 * the spoke, unsupported peer packets fail loud, and confirmed squadmates
 * render as rivals.
 */
import { describe, it, expect } from "vitest";
import type { ActiveSpokeSession, PlayerRaidIntent } from "@series-inc/rundot-game-sdk";
import {
  admitSquadManifest,
  createInitialRaidState,
  stepRaidTick,
} from "@series-inc/rundot-syncplay/modules/extraction";
import { SectorDepotSimulation } from "../src/sim/game.js";
import { MultiplayerCoordinator } from "../src/sim/multiplayer.js";
import { RaidExfilController } from "../src/sim/airlock.js";
import { buildCoopRaidRules } from "../src/sim/coopConfig.js";

function makeCoordinator(admitted = true) {
  const sim = new SectorDepotSimulation("coop_session_test", "hub");
  if (admitted) sim.admitOperative(0);
  const coordinator = new MultiplayerCoordinator(sim);
  const intents: PlayerRaidIntent[] = [];
  const errors: string[] = [];
  let confirmedCallback: ((tick: number, state: unknown) => void) | undefined;
  const counters = { leaves: 0, unsubscribes: 0 };
  const spoke = {
    raidId: "raid-coop-1",
    slot: 0,
    submitIntent: (intent: PlayerRaidIntent) => {
      intents.push(intent);
    },
    onConfirmedTick: (callback: (tick: number, state: unknown) => void) => {
      confirmedCallback = callback;
      return () => {
        counters.unsubscribes += 1;
      };
    },
    requestExtractionAsync: async () => ({ success: true, extracted: false }),
    waitForDebriefAsync: async () => {
      throw new Error("unused");
    },
    leaveAsync: async () => {
      counters.leaves += 1;
    },
  } as unknown as ActiveSpokeSession;
  coordinator.onSyncError = (message: string) => errors.push(message);
  return {
    sim,
    coordinator,
    spoke,
    counters,
    intents,
    errors,
    emitConfirmed: (tick: number, state: unknown) => confirmedCallback?.(tick, state),
  };
}

describe("MultiplayerCoordinator SyncHub session", () => {
  it("attaches a spoke and adopts its raid id", () => {
    const { sim, coordinator, spoke } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    expect(sim.raidId).toBe("raid-coop-1");
    expect(coordinator.spokeSession).toBe(spoke);
    expect(sim.coopSpokeAttached).toBe(true);
  });

  it("hydrates the local drop and keeps the movement target until server confirmation", () => {
    const { sim, coordinator, spoke, emitConfirmed, intents } = makeCoordinator(false);
    sim.tick = 60_000;
    coordinator.attachSdkSession(spoke);
    expect(sim.isAdmitted()).toBe(false);
    coordinator.broadcastState(0);
    expect(intents).toHaveLength(0);
    let state = admitSquadManifest(createInitialRaidState(buildCoopRaidRules()), {
      manifestId: "drop-position", squadIndex: 0,
      members: [{ slot: 0, entityId: "stick-0", spawnPosition: [30, 0, 45], initialItems: [] }],
    }).state;
    for (let tick = 0; tick < 8; tick++) state = stepRaidTick(state, {});
    emitConfirmed(state.tick, state);
    expect(sim.zoneMode).toBe("spoke");
    expect(sim.tick).toBe(120);
    expect(sim.coopConfirmedTick).toBe(8);
    expect(sim.isAdmitted()).toBe(true);
    expect(sim.player.x).toBe(30);
    expect(sim.player.z).toBe(45);
    sim.player.x = 31;
    coordinator.broadcastState(0);
    coordinator.broadcastState(0);
    expect(intents.at(-1)).toEqual({ moveX: 1, moveZ: 0 });
    state = stepRaidTick(state, { 0: intents.at(-1)! });
    emitConfirmed(state.tick, state);
    coordinator.broadcastState(0);
    expect(intents.at(-1)).toEqual({ moveX: 0, moveZ: 0 });
    sim.player.x = 32;
    emitConfirmed(state.tick, state);
    expect(sim.player.x).toBe(32);
    coordinator.cleanup();
  });

  it("submits only movement intents for state broadcasts, never action/extra", () => {
    const { sim, coordinator, spoke, intents, emitConfirmed } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    const state = admitSquadManifest(createInitialRaidState(buildCoopRaidRules()), {
      manifestId: "movement-spawn", squadIndex: 0,
      members: [{ slot: 0, entityId: "stick-0", spawnPosition: [0, 0, 0], initialItems: [] }],
    }).state;
    emitConfirmed(state.tick, state);
    coordinator.broadcastState(0);
    sim.player.x += 1.5;
    coordinator.broadcastState(0);

    expect(intents.length).toBeGreaterThan(0);
    for (const intent of intents) {
      expect(Object.keys(intent).sort()).toEqual(["moveX", "moveZ"]);
    }
    const last = intents[intents.length - 1];
    expect(last.moveX as number).toBeGreaterThan(0);
    expect(Math.hypot(last.moveX as number, last.moveZ as number)).toBeLessThanOrEqual(
      buildCoopRaidRules().maxMoveSpeedPerTick! + 1e-9,
    );
  });

  it("reports unsupported packet types instead of swallowing them", () => {
    const { coordinator, spoke, intents, errors } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    coordinator.broadcastFire(10, 10);
    coordinator.broadcastFire(10, 10);
    expect(intents).toHaveLength(0);
    expect(errors.some((e) => e.includes("fire"))).toBe(true);
    // One loud report per type, not one per packet.
    expect(errors.filter((e) => e.includes("fire"))).toHaveLength(1);
  });

  it("renders confirmed squadmates as rivals from real raid state", () => {
    const { sim, coordinator, spoke, emitConfirmed } = makeCoordinator();
    coordinator.attachSdkSession(spoke);

    let state = createInitialRaidState(buildCoopRaidRules());
    const admitted = admitSquadManifest(state, {
      manifestId: "squad-a",
      squadIndex: 0,
      members: [
        { slot: 0, entityId: "stick-0", spawnPosition: [0, 0, 0], initialItems: [] },
        { slot: 1, entityId: "stick-1", spawnPosition: [3, 0, -2], initialItems: [] },
      ],
    });
    state = stepRaidTick(admitted.state, { 1: { moveX: 1, moveZ: 0 } });
    emitConfirmed(state.tick, state);

    const mate = sim.rivals.find((r) => r.id === "coop-slot-1");
    expect(mate).toBeDefined();
    expect(mate!.x).toBeCloseTo(4);
    expect(mate!.z).toBeCloseTo(-2);
    expect(mate!.isAlive).toBe(true);
  });

  it("requests co-op settlement once per raid and returns the debrief", async () => {
    const { coordinator, spoke } = makeCoordinator();
    let extractionRequests = 0;
    const debrief: Awaited<ReturnType<ActiveSpokeSession["waitForDebriefAsync"]>> = {
      v: 1,
      settled: true,
      raidId: "raid-coop-1",
      receiptId: "rcpt-1",
      outcomeId: "out-1",
      outcomeDigest: "digest-1",
      throughTick: 90,
      transfers: [],
      participantResults: [],
      committedAtMs: 1,
    };
    spoke.requestExtractionAsync = async () => {
      extractionRequests += 1;
      return { success: true, extracted: true };
    };
    spoke.waitForDebriefAsync = async () => debrief;
    coordinator.attachSdkSession(spoke);

    const first = await coordinator.requestCoopSettlement("lz_sector_7");
    const second = await coordinator.requestCoopSettlement("lz_sector_7");
    expect(first.receiptId).toBe("rcpt-1");
    expect(second).toBe(first);
    expect(extractionRequests).toBe(1);
  });

  it("propagates settlement failure and allows a retry", async () => {
    const { coordinator, spoke } = makeCoordinator();
    let attempts = 0;
    spoke.requestExtractionAsync = async () => {
      attempts += 1;
      if (attempts === 1) return { success: false, extracted: false };
      return { success: true, extracted: true };
    };
    spoke.waitForDebriefAsync = async () => ({
      v: 1,
      settled: true,
      raidId: "raid-coop-1",
      receiptId: "rcpt-2",
      outcomeId: "out-2",
      outcomeDigest: "digest-2",
      throughTick: 91,
      transfers: [],
      participantResults: [],
      committedAtMs: 2,
    });
    coordinator.attachSdkSession(spoke);

    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow(
      /extraction request refused/,
    );
    const retry = await coordinator.requestCoopSettlement("lz_sector_7");
    expect(retry.receiptId).toBe("rcpt-2");
    expect(attempts).toBe(2);
  });

  it("retries only the debrief wait after an accepted extraction request", async () => {
    const { coordinator, spoke } = makeCoordinator();
    let extractionRequests = 0;
    let debriefWaits = 0;
    spoke.requestExtractionAsync = async () => {
      extractionRequests += 1;
      return { success: true, extracted: true };
    };
    spoke.waitForDebriefAsync = async () => {
      debriefWaits += 1;
      if (debriefWaits === 1) throw new Error("debrief poll timed out");
      return {
        v: 1,
        settled: true,
        raidId: "raid-coop-1",
        receiptId: "rcpt-3",
        outcomeId: "out-3",
        outcomeDigest: "digest-3",
        throughTick: 92,
        transfers: [],
        participantResults: [],
        committedAtMs: 3,
      };
    };
    coordinator.attachSdkSession(spoke);

    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow(/timed out/);
    const retry = await coordinator.requestCoopSettlement("lz_sector_7");
    expect(retry.receiptId).toBe("rcpt-3");
    expect(extractionRequests).toBe(1);
    expect(debriefWaits).toBe(2);
  });

  it("resends an unconfirmed extraction request after debrief failure", async () => {
    const { coordinator, spoke } = makeCoordinator();
    let requests = 0;
    spoke.requestExtractionAsync = async () => { requests += 1; return { success: true, extracted: false }; };
    spoke.waitForDebriefAsync = async () => { throw new Error("debrief timeout"); };
    coordinator.attachSdkSession(spoke);
    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow(/timeout/);
    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow(/timeout/);
    expect(requests).toBe(2);
    coordinator.cleanup();
  });

  it.each(["unsettled", "wrong-raid"])("polls again after a %s debrief", async (invalid) => {
    const { coordinator, spoke } = makeCoordinator();
    let requests = 0;
    let polls = 0;
    spoke.requestExtractionAsync = async () => { requests += 1; return { success: true, extracted: true }; };
    spoke.waitForDebriefAsync = async () => {
      polls += 1;
      return {
        v: 1, settled: !(polls === 1 && invalid === "unsettled"),
        raidId: polls === 1 && invalid === "wrong-raid" ? "another-raid" : spoke.raidId,
        receiptId: "retry-valid", outcomeId: "outcome", outcomeDigest: "digest", throughTick: 12,
        transfers: [], participantResults: [], committedAtMs: 1,
      };
    };
    coordinator.attachSdkSession(spoke);
    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow();
    expect((await coordinator.requestCoopSettlement("lz_sector_7")).receiptId).toBe("retry-valid");
    expect(requests).toBe(1);
    expect(polls).toBe(2);
    coordinator.cleanup();
  });

  it("allows returning to the raid after an explicit extraction refusal", async () => {
    const { sim, coordinator, spoke } = makeCoordinator();
    spoke.requestExtractionAsync = async () => ({ success: false, extracted: false });
    coordinator.attachSdkSession(spoke);
    sim.exfilController = new RaidExfilController({ targetHoldTicks: 2, corridorDurationMs: 0 });
    sim.exfilController.onTick(1, true, "lz_sector_7");
    sim.exfilController.onTick(2, true, "lz_sector_7");
    await sim.raidCompletion.begin();
    expect(sim.exfilController.getState()).toMatchObject({ kind: "failed", canReturnToRaid: true });
    sim.exfilController.cancel();
    expect(sim.exfilController.getState().kind).toBe("idle");
    expect(sim.isInputLocked()).toBe(false);
    coordinator.cleanup();
  });

  it("routes the simulation completion source through the attached spoke", () => {
    const { sim, coordinator, spoke } = makeCoordinator();
    expect(sim.coopSpokeAttached).toBe(false);
    coordinator.attachSdkSession(spoke);
    expect(sim.coopSpokeAttached).toBe(true);
    coordinator.cleanup();
    expect(sim.coopSpokeAttached).toBe(false);
  });

  it("refuses settlement without an attached spoke", async () => {
    const { coordinator } = makeCoordinator();
    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow(/no spoke/);
  });

  it("cleanup unsubscribes and leaves the spoke session", () => {
    const { coordinator, spoke, counters } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    coordinator.cleanup();
    expect(counters.unsubscribes).toBe(1);
    expect(counters.leaves).toBe(1);
    expect(coordinator.spokeSession).toBeNull();
  });

  it("applies confirmed self casualty to the local player", () => {
    const { sim, coordinator, spoke, emitConfirmed } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    let state = createInitialRaidState(buildCoopRaidRules());
    state = admitSquadManifest(state, {
      manifestId: "squad-a",
      squadIndex: 0,
      members: [
        { slot: 0, entityId: "stick-0", spawnPosition: [0, 0, 0], initialItems: [] },
        { slot: 4, entityId: "hostile", squadIndex: 1, spawnPosition: [2, 0, 0], initialItems: [] },
      ],
    }).state;
    state = stepRaidTick(state, { 4: { attackTargetSlot: 0, attackDamage: 200 } });
    expect(state.actors[0].isCasualty).toBe(true);
    emitConfirmed(state.tick, state);
    expect(sim.player.isAlive).toBe(false);
    expect(sim.player.health).toBe(0);
  });

  it("starts debrief completion when the server extracts before the local hold", async () => {
    const { sim, coordinator, spoke, emitConfirmed } = makeCoordinator();
    let requests = 0;
    spoke.requestExtractionAsync = async () => { requests += 1; return { success: true, extracted: true }; };
    spoke.waitForDebriefAsync = async () => ({
      v: 1, settled: true, raidId: spoke.raidId, receiptId: "confirmed-receipt",
      outcomeId: "confirmed-outcome", outcomeDigest: "digest", throughTick: 12,
      transfers: [], participantResults: [], committedAtMs: 1,
    });
    coordinator.attachSdkSession(spoke);
    const rules = buildCoopRaidRules();
    let state = admitSquadManifest(createInitialRaidState(rules), {
      manifestId: "squad-extract", squadIndex: 0,
      members: [{ slot: 0, entityId: "stick-0", spawnPosition: [45, 0, 45], initialItems: [] }],
    }).state;
    for (let tick = 0; tick < 12; tick++) state = stepRaidTick(state, {});
    expect(state.actors[0].isExtracted).toBe(true);
    expect(sim.exfilController.getState().kind).toBe("idle");
    emitConfirmed(state.tick, state);
    await sim.raidCompletion.begin();
    expect(sim.exfilController.getState().kind).toBe("extracted");
    expect(requests).toBe(0);
    expect(sim.combatLog.filter((line) => line.includes("Debrief settled"))).toHaveLength(1);
    coordinator.cleanup();
  });

  it("reports malformed confirmed state through onSyncError", () => {
    const { coordinator, spoke, emitConfirmed, errors } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    emitConfirmed(1, { type: "state", data: { x: 1 } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("[synchub]");
  });
});
