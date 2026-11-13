/**
 * Co-op SyncHub adapter proof.
 *
 * The oracle is the real published raid rules module
 * (@series-inc/rundot-syncplay/modules/extraction): every scenario steps
 * `stepRaidTick` and asserts on the resulting RaidState. The adapter under
 * test only maps local input -> PlayerRaidIntent and RaidState -> a render
 * view, so a green run proves the mapping against server truth, not mocks.
 */
import { describe, it, expect } from "vitest";
import {
  admitSquadManifest,
  asExtractionEntryId,
  createInitialRaidState,
  extractRaidOutcome,
  stepRaidTick,
  type RaidRulesConfig,
  type RaidState,
} from "@series-inc/rundot-syncplay/modules/extraction";
import type { SettlementDebrief } from "@series-inc/rundot-game-sdk";
import {
  movementIntent,
  attackIntent,
  corpsePickupIntent,
  worldPickupIntent,
  confirmedView,
  summarizeDebrief,
  type DebriefInput,
} from "../src/sim/coopAdapter.js";

const CONFIG: RaidRulesConfig = {
  v: 1,
  squadSlots: [[0, 1, 2, 3], [4]],
  friendlyFire: false,
  pickupRadiusFixed: 3,
  extractionZones: [
    { zoneId: "lz_sector_7", geometryId: "lz-delta", dwellTicks: 3, x: 10, z: 0, radius: 2 },
  ],
  deadlinePolicy: "burn-unextracted",
  raidDeadlineTick: 50,
  maxMoveSpeedPerTick: 1.5,
  maxAttackRangeFixed: 30,
  maxAttackDamageFixed: 200,
};

function admittedState(): RaidState {
  let state = createInitialRaidState(CONFIG);
  const squad = admitSquadManifest(state, {
    manifestId: "squad-a",
    squadIndex: 0,
    members: [
      {
        slot: 0,
        entityId: "stick-0",
        spawnPosition: [0, 0, 0],
        initialItems: [{ itemId: "rifle-entry", sourceId: "weapon_rifle", entityId: "rifle-0", quantity: "1" }],
      },
      {
        slot: 1,
        entityId: "stick-1",
        spawnPosition: [1, 0, 0],
        initialItems: [{ itemId: "cash-entry", sourceId: "cash", entityId: "cash-1", quantity: "500" }],
      },
    ],
  });
  expect(squad.admitted).toBe(true);
  state = squad.state;
  const hostile = admitSquadManifest(state, {
    manifestId: "hostile",
    squadIndex: 1,
    members: [{ slot: 4, entityId: "scav-4", spawnPosition: [2, 0, 0], initialItems: [] }],
  });
  expect(hostile.admitted).toBe(true);
  return hostile.state;
}

describe("coop adapter intents against real stepRaidTick", () => {
  it("movement intent stays inside the wire bound and moves the actor", () => {
    const intent = movementIntent({ dx: 1, dz: 1 });
    const magnitude = Math.hypot(intent.moveX!, intent.moveZ!);
    expect(magnitude).toBeCloseTo(1, 6);
    expect(Math.abs(intent.moveX!)).toBeLessThanOrEqual(1);
    expect(Math.abs(intent.moveZ!)).toBeLessThanOrEqual(1);

    const next = stepRaidTick(admittedState(), { 0: intent });
    expect(next.actors[0].x).toBeCloseTo(intent.moveX!, 6);
    expect(next.actors[0].z).toBeCloseTo(intent.moveZ!, 6);
    expect(next.tick).toBe(1);
  });

  it("rejects non-finite movement and invalid attack or pickup ids", () => {
    expect(() => movementIntent({ dx: Number.NaN, dz: 0 })).toThrow();
    expect(() => attackIntent(-1, 25)).toThrow();
    expect(() => attackIntent(1.5, 25)).toThrow();
    expect(() => attackIntent(4, 0)).toThrow();
    expect(() => corpsePickupIntent("", "cash-entry")).toThrow();
    expect(() => worldPickupIntent("")).toThrow();
  });

  it("friendly fire is off inside the squad and damage lands across squads", () => {
    const state = admittedState();
    const friendly = stepRaidTick(state, { 0: attackIntent(1, 50) });
    expect(friendly.actors[1].health).toBe(100);

    const hostileHit = stepRaidTick(state, { 4: attackIntent(1, 40) });
    expect(hostileHit.actors[1].health).toBe(60);
  });

  it("corpse loot recovery by a squadmate through adapter intents", () => {
    let state = admittedState();
    state = stepRaidTick(state, { 4: attackIntent(1, 200) });
    expect(state.actors[1].isAlive).toBe(false);

    const view = confirmedView(state, 0);
    expect(view.corpses).toHaveLength(1);
    expect(view.corpses[0].originalSlot).toBe(1);
    expect(view.corpses[0].itemIds).toContain("cash-entry");

    const recovered = stepRaidTick(state, {
      0: corpsePickupIntent(view.corpses[0].corpseId, "cash-entry"),
    });
    expect(recovered.items["cash-entry"].holder).toEqual({ kind: "player", slot: 0 });
    expect(confirmedView(recovered, 0).heldItemIds).toContain("cash-entry");
  });

  it("world pickup through adapter intents", () => {
    const base = admittedState();
    const seeded: RaidState = {
      ...base,
      worldPickups: { loot_1: { pickupId: "loot_1", x: 0.5, z: 0, spawnedAtTick: 0 } },
      items: {
        ...base.items,
        "meds-entry": {
          itemId: asExtractionEntryId("meds-entry"),
          sourceId: "meds",
          entityId: "meds-1",
          quantity: "1",
          holder: { kind: "world", pickupId: "loot_1" },
        },
      },
    };

    const view = confirmedView(seeded, 0);
    expect(view.worldPickups).toEqual([
      { pickupId: "loot_1", x: 0.5, z: 0, itemIds: ["meds-entry"] },
    ]);

    const picked = stepRaidTick(seeded, { 0: worldPickupIntent("loot_1", "meds-entry") });
    expect(picked.items["meds-entry"].holder).toEqual({ kind: "player", slot: 0 });
    expect(picked.worldPickups.loot_1).toBeUndefined();
  });

  it("extraction dwell is per actor and confirmed view reports progress", () => {
    const base = admittedState();
    const inZone: RaidState = {
      ...base,
      actors: { ...base.actors, 0: { ...base.actors[0], x: 10, z: 0 } },
    };

    const tick1 = stepRaidTick(inZone, {});
    expect(confirmedView(tick1, 0).self?.dwellTicks).toBe(1);
    const tick2 = stepRaidTick(tick1, {});
    expect(confirmedView(tick2, 0).self?.dwellTicks).toBe(2);
    const tick3 = stepRaidTick(tick2, {});
    const view = confirmedView(tick3, 0);
    expect(view.self?.isExtracted).toBe(true);
    expect(view.heldItemIds).toContain("rifle-entry");
    expect(tick3.items["rifle-entry"].holder.kind).toBe("extracted");

    // The squadmate outside the zone is unaffected.
    expect(view.squadmates.find((m) => m.slot === 1)?.isExtracted).toBe(false);
  });

  it("deadline burns unextracted actors and consumes held items", () => {
    const base = admittedState();
    const late: RaidState = { ...base, tick: 49 };
    const burned = stepRaidTick(late, {});
    expect(burned.actors[0].isCasualty).toBe(true);
    expect(burned.items["rifle-entry"].holder.kind).toBe("consumed");

    const outcome = extractRaidOutcome(burned);
    expect(outcome.participants.find((p) => p.slot === 0)?.status).toBe("burned");
  });
});

describe("debrief summary", () => {
  it("summarizes a settled debrief for one profile", () => {
    const debrief: SettlementDebrief = {
      v: 1,
      settled: true,
      raidId: "raid-1",
      receiptId: "rcpt-1",
      throughTick: 120,
      transfers: [
        { itemId: "cash", quantity: "500", source: "corpse", toProfileId: "profile-a" },
        { itemId: "meds", quantity: "1", source: "world", toProfileId: "profile-b" },
      ],
      participantResults: [
        { profileId: "profile-a", releasedEscrowIds: ["e1", "e2"], inventoryRevision: 7, activeRaidCleared: true },
      ],
      committedAtMs: 123,
      outcomeId: "out-1",
      outcomeDigest: "digest-1",
    };

    const summary = summarizeDebrief(debrief, "profile-a");
    expect(summary.settled).toBe(true);
    expect(summary.voided).toBe(false);
    expect(summary.gainedItems).toEqual([{ itemId: "cash", quantity: "500" }]);
    expect(summary.escrowReleased).toBe(2);
    expect(summary.inventoryRevision).toBe(7);
    expect(summary.activeRaidCleared).toBe(true);
  });

  it("summarizes a void debrief as a refund, never as gains", () => {
    const debrief: DebriefInput = {
      v: 1,
      settled: false,
      raidId: "raid-2",
      receiptId: "rcpt-2",
      throughTick: 40,
      transfers: [],
      participantResults: [],
      committedAtMs: 456,
      resolution: {
        kind: "void",
        reason: "owner-lost",
        refundedProfiles: ["profile-a"],
        refunds: [{ profileId: "profile-a", items: { weapon_rifle: "1" } }],
      },
    };

    const summary = summarizeDebrief(debrief, "profile-a");
    expect(summary.voided).toBe(true);
    expect(summary.refundedItems).toEqual([{ itemId: "weapon_rifle", quantity: "1" }]);
    expect(summary.gainedItems).toEqual([]);
  });
});
