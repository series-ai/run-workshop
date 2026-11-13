/**
 * preparePlatformRaid honesty proof. The old implementation returned
 * success after enterAsync failed and swallowed prepare errors. These
 * tests pin the replacement contract: success only with a live spoke,
 * and every failure returns its message.
 */
import { describe, it, expect } from "vitest";
import type {
  ActiveAirlockSession,
  ActiveSpokeSession,
} from "@series-inc/rundot-game-sdk";
import type { SyncHubClient } from "../src/platform/synchub.js";
import { preparePlatformRaid } from "../src/sim/airlock.js";

const spoke = { raidId: "raid-9", slot: 2 } as unknown as ActiveSpokeSession;

function fakeAirlock(enter: () => Promise<ActiveSpokeSession>): ActiveAirlockSession {
  return {
    handoffId: "handoff-9",
    raidId: "raid-9",
    sector: "sector-7-depot",
    state: "PREPARED",
    onStateChange: () => () => undefined,
    enterAsync: enter,
    cancelAsync: async () => ({ refunded: false }),
  };
}

function fakeClient(partial: Partial<SyncHubClient>): SyncHubClient {
  return {
    prepare: async () => fakeAirlock(async () => spoke),
    enter: async (airlock) => airlock.enterAsync(),
    enterAndSubscribe: async () => {
      throw new Error("unused");
    },
    cancel: async () => ({ refunded: false }),
    ...partial,
  };
}

const OPTIONS = {
  sector: "sector-7-depot",
  loadout: [{ itemId: "weapon_rifle", quantity: "1" }],
};

describe("preparePlatformRaid", () => {
  it("succeeds only with a live spoke session and no grant exposure", async () => {
    const result = await preparePlatformRaid({ ...OPTIONS, client: fakeClient({}) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.raidId).toBe("raid-9");
      expect(result.spokeSession).toBe(spoke);
      expect("grant" in result).toBe(false);
    }
  });

  it("reports prepare failure with its message", async () => {
    const client = fakeClient({
      prepare: async () => {
        throw new Error("insufficient stash for weapon_rifle");
      },
    });
    const result = await preparePlatformRaid({ ...OPTIONS, client });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("insufficient stash");
    }
  });

  it("reports enter failure instead of the old false success", async () => {
    const client = fakeClient({
      prepare: async () =>
        fakeAirlock(async () => {
          throw new Error("gateway refused the grant");
        }),
    });
    const result = await preparePlatformRaid({ ...OPTIONS, client });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("gateway refused");
    }
  });
});
