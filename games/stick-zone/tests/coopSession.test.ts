/**
 * MultiplayerCoordinator co-op session proof. A fake spoke captures what
 * the coordinator submits; confirmed state comes from the real published
 * raid rules. The contract under test: only PlayerRaidIntent shapes reach
 * the spoke, unsupported peer packets fail loud, and confirmed squadmates
 * render as rivals.
 */
import { describe, it, expect } from "vitest";
import type { ActiveSpokeSession } from "@series-inc/rundot-game-sdk";
import {
  admitSquadManifest,
  createInitialRaidState,
  stepRaidTick,
} from "@series-inc/rundot-syncplay/modules/extraction";
import { SectorDepotSimulation } from "../src/sim/game.js";
import { MultiplayerCoordinator } from "../src/sim/multiplayer.js";
import { buildCoopRaidRules } from "../src/sim/coopConfig.js";

function makeCoordinator() {
  const sim = new SectorDepotSimulation("coop_session_test", "hub");
  sim.admitOperative(0);
  const coordinator = new MultiplayerCoordinator(sim);
  const intents: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  let confirmedCallback: ((tick: number, state: unknown) => void) | undefined;
  const spoke = {
    raidId: "raid-coop-1",
    slot: 0,
    submitIntent: (intent: Record<string, unknown>) => {
      intents.push(intent);
    },
    onConfirmedTick: (callback: (tick: number, state: unknown) => void) => {
      confirmedCallback = callback;
      return () => undefined;
    },
    requestExtractionAsync: async () => ({ success: true, extracted: false }),
    waitForDebriefAsync: async () => {
      throw new Error("unused");
    },
    leaveAsync: async () => undefined,
  } as unknown as ActiveSpokeSession;
  coordinator.onSyncError = (message: string) => errors.push(message);
  return {
    sim,
    coordinator,
    spoke,
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

  it("submits only movement intents for state broadcasts, never action/extra", () => {
    const { sim, coordinator, spoke, intents } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
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
    const debrief = {
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
    (spoke as any).requestExtractionAsync = async () => {
      extractionRequests += 1;
      return { success: true, extracted: true };
    };
    (spoke as any).waitForDebriefAsync = async () => debrief;
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
    (spoke as any).requestExtractionAsync = async () => {
      attempts += 1;
      if (attempts === 1) return { success: false, extracted: false };
      return { success: true, extracted: true };
    };
    (spoke as any).waitForDebriefAsync = async () => ({
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

  it("refuses settlement without an attached spoke", async () => {
    const { coordinator } = makeCoordinator();
    await expect(coordinator.requestCoopSettlement("lz_sector_7")).rejects.toThrow(/no spoke/);
  });

  it("reports malformed confirmed state through onSyncError", () => {
    const { coordinator, spoke, emitConfirmed, errors } = makeCoordinator();
    coordinator.attachSdkSession(spoke);
    emitConfirmed(1, { type: "state", data: { x: 1 } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("[synchub]");
  });
});
