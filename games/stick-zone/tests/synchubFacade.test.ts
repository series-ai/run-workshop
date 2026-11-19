/**
 * Typed SyncHub facade proof. The fake here sits exactly on the SDK
 * boundary (ExtractionApi sessions); raid-rule behavior itself is proven
 * against the real stepRaidTick in coopAdapter.test.ts. This suite proves
 * the facade parses confirmed state loudly and never swallows errors.
 */
import { describe, it, expect } from "vitest";
import type {
  ActiveAirlockSession,
  ActiveSpokeSession,
  ExtractionApi,
} from "@series-inc/rundot-game-sdk";
import { createInitialRaidState, type RaidRulesConfig } from "@series-inc/rundot-syncplay/modules/extraction";
import { createSyncHubClient, parseConfirmedState } from "../src/platform/synchub.js";

const CONFIG: RaidRulesConfig = {
  v: 1,
  squadSlots: [[0, 1, 2, 3]],
  friendlyFire: false,
  pickupRadiusFixed: 3,
  extractionZones: [],
  deadlinePolicy: "burn-unextracted",
  raidDeadlineTick: 1200,
};

function fakeSpoke(state: unknown): ActiveSpokeSession {
  return {
    raidId: "raid-1",
    slot: 0,
    submitIntent: () => undefined,
    onConfirmedTick: (callback) => {
      callback(7, state);
      return () => undefined;
    },
    requestExtractionAsync: async () => ({ success: true, extracted: false }),
    waitForDebriefAsync: async () => {
      throw new Error("not used in this test");
    },
    leaveAsync: async () => undefined,
  };
}

function fakeApi(spoke: ActiveSpokeSession): ExtractionApi {
  const airlock: ActiveAirlockSession = {
    handoffId: "handoff-1",
    raidId: "raid-1",
    sector: "sector-7-depot",
    state: "PREPARED",
    onStateChange: () => () => undefined,
    enterAsync: async () => spoke,
    cancelAsync: async () => ({ refunded: true }),
  };
  return {
    openHubAsync: async () => {
      throw new Error("not used in this test");
    },
    prepareRaidAsync: async () => airlock,
    getDebriefAsync: async () => null,
  };
}

describe("parseConfirmedState", () => {
  it("accepts a real initial raid state", () => {
    const state = createInitialRaidState(CONFIG);
    expect(parseConfirmedState(state)).toBe(state);
  });

  it.each([
    ["null", null],
    ["missing tick", { actors: {}, items: {}, corpses: {}, worldPickups: {}, config: CONFIG }],
    ["negative tick", { tick: -1, actors: {}, items: {}, corpses: {}, worldPickups: {}, config: CONFIG }],
    ["actors not a record", { tick: 0, actors: [], items: {}, corpses: {}, worldPickups: {}, config: CONFIG }],
    ["missing config", { tick: 0, actors: {}, items: {}, corpses: {}, worldPickups: {} }],
  ])("rejects %s", (_label, value) => {
    expect(() => parseConfirmedState(value)).toThrow(/\[synchub\]/);
  });
});

describe("createSyncHubClient", () => {
  it("prepares, enters, and delivers parsed confirmed state", async () => {
    const state = createInitialRaidState(CONFIG);
    const client = createSyncHubClient(fakeApi(fakeSpoke(state)));
    const airlock = await client.prepare({ sector: "sector-7-depot", loadout: [] });
    const session = await client.enterAndSubscribe(airlock, () => undefined);
    expect(session.spoke.slot).toBe(0);

    const seen: Array<{ tick: number; same: boolean }> = [];
    const second = await client.enterAndSubscribe(airlock, (tick, parsed) => {
      seen.push({ tick, same: parsed === state });
    });
    expect(second.spoke.raidId).toBe("raid-1");
    expect(seen).toEqual([{ tick: 7, same: true }]);
  });

  it("propagates prepare failure instead of reporting success", async () => {
    const failing: ExtractionApi = {
      openHubAsync: async () => {
        throw new Error("unused");
      },
      prepareRaidAsync: async () => {
        throw new Error("insufficient stash");
      },
      getDebriefAsync: async () => null,
    };
    const client = createSyncHubClient(failing);
    await expect(client.prepare({ sector: "sector-7-depot", loadout: [] })).rejects.toThrow(
      "insufficient stash",
    );
  });

  it("rejects an empty sector before any SDK call", async () => {
    const client = createSyncHubClient(fakeApi(fakeSpoke(createInitialRaidState(CONFIG))));
    await expect(client.prepare({ sector: " ", loadout: [] })).rejects.toThrow(/sector/);
  });
});
