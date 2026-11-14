/**
 * @file coopConfig.ts
 * Co-op raid rules, converted from design seconds into platform ticks.
 *
 * Platform caps (Venus develop): tickRateHz <= 10 in the raid runtime
 * header schema, raidDeadlineTick <= 1200 in the cloud-run raid runtime
 * schema. At 4 Hz the deadline cap yields a 300 second raid, which fits
 * the short co-op loop and keeps confirmed-state traffic low; the 60 Hz
 * renderer interpolates between confirmed ticks.
 */
import type { RaidRulesConfig } from "@series-inc/rundot-syncplay/modules/extraction";

export const PLATFORM_MAX_TICK_RATE_HZ = 10;
export const PLATFORM_MAX_DEADLINE_TICK = 1200;

export const RAID_TICK_RATE_HZ = 4;
export const RAID_DURATION_SECONDS = 300;
/** Matches the local 3.0s exfil hold (180 ticks at the local 60 Hz sim). */
export const EXTRACTION_DWELL_SECONDS = 3;

/** Released extraction mode key. Must match modes in the server release. */
export const COOP_SECTOR_KEY = "sector-7-depot";

/** Extraction zone center and radius, shared with the local LZ geometry. */
export const EXTRACTION_ZONE = {
  zoneId: "lz_sector_7",
  geometryId: "lz-delta",
  x: 45,
  z: 45,
  radius: 6,
} as const;

export function buildCoopRaidRules(): RaidRulesConfig {
  const raidDeadlineTick = RAID_DURATION_SECONDS * RAID_TICK_RATE_HZ;
  if (RAID_TICK_RATE_HZ > PLATFORM_MAX_TICK_RATE_HZ) {
    throw new Error(
      `[coopConfig] tick rate ${RAID_TICK_RATE_HZ} Hz exceeds platform cap ${PLATFORM_MAX_TICK_RATE_HZ} Hz`,
    );
  }
  if (raidDeadlineTick > PLATFORM_MAX_DEADLINE_TICK) {
    throw new Error(
      `[coopConfig] deadline ${raidDeadlineTick} ticks exceeds platform cap ${PLATFORM_MAX_DEADLINE_TICK}`,
    );
  }
  return {
    v: 1,
    squadSlots: [[0, 1, 2, 3]],
    friendlyFire: false,
    pickupRadiusFixed: 3,
    extractionZones: [
      {
        ...EXTRACTION_ZONE,
        dwellTicks: EXTRACTION_DWELL_SECONDS * RAID_TICK_RATE_HZ,
      },
    ],
    deadlinePolicy: "burn-unextracted",
    raidDeadlineTick,
    // The gateway bounds wire movement to [-1, 1] and the owner applies
    // it unscaled, so confirmed speed caps at 1 m/tick (4 m/s at 4 Hz)
    // regardless of this value. Keep it at the wire cap so replay and
    // live clamps agree. Local sprint (7.5 m/s) stays presentation-only.
    maxMoveSpeedPerTick: 1,
    maxAttackRangeFixed: 30,
    maxAttackDamageFixed: 200,
  };
}
