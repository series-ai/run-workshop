/**
 * Co-op raid rules conversion proof. Platform limits come from Venus
 * develop: tickRateHz <= 10 (raidRuntimeProtocol header schema) and
 * raidDeadlineTick <= 1200 (cloud-run raidRuntime schema). Every derived
 * tick count must respect both caps with the seconds math shown.
 */
import { describe, it, expect } from "vitest";
import {
  COOP_SECTOR_KEY,
  RAID_TICK_RATE_HZ,
  RAID_DURATION_SECONDS,
  EXTRACTION_DWELL_SECONDS,
  PLATFORM_MAX_TICK_RATE_HZ,
  PLATFORM_MAX_DEADLINE_TICK,
  buildCoopRaidRules,
} from "../src/sim/coopConfig.js";
import { SIM_CONFIG } from "../src/sim/config.js";

describe("coop raid rules conversion", () => {
  const rules = buildCoopRaidRules();

  it("respects both platform caps", () => {
    expect(RAID_TICK_RATE_HZ).toBeLessThanOrEqual(PLATFORM_MAX_TICK_RATE_HZ);
    expect(PLATFORM_MAX_TICK_RATE_HZ).toBe(10);
    expect(rules.raidDeadlineTick).toBeLessThanOrEqual(PLATFORM_MAX_DEADLINE_TICK);
    expect(PLATFORM_MAX_DEADLINE_TICK).toBe(1200);
  });

  it("derives deadline and dwell from seconds at the raid tick rate", () => {
    expect(rules.raidDeadlineTick).toBe(RAID_DURATION_SECONDS * RAID_TICK_RATE_HZ);
    expect(rules.extractionZones[0].dwellTicks).toBe(
      EXTRACTION_DWELL_SECONDS * RAID_TICK_RATE_HZ,
    );
  });

  it("drops one co-op squad of four with friendly fire off", () => {
    expect(rules.squadSlots).toEqual([[0, 1, 2, 3]]);
    expect(rules.friendlyFire).toBe(false);
    expect(rules.deadlinePolicy).toBe("burn-unextracted");
  });

  it("derives per-tick speed from the local sprint speed", () => {
    expect(rules.maxMoveSpeedPerTick).toBeCloseTo(
      SIM_CONFIG.SPEED_SPRINT / RAID_TICK_RATE_HZ,
      10,
    );
  });

  it("uses the released mode key, not the display name", () => {
    expect(COOP_SECTOR_KEY).toBe("sector-7-depot");
    expect(rules.extractionZones[0].zoneId).toBe("lz_sector_7");
  });
});
