/**
 * @file config.ts
 * Sector 7 Depot simulation constants and deterministic rules.
 */

export const SIM_CONFIG = {
  TICKS_PER_SECOND: 60,
  TICK_INTERVAL_MS: 1000 / 60, // 16.666ms

  // Ingress & Extraction Lifecycle Ticks
  INGRESS_WINDOW_TICKS: 28_800, // 8:00 cutoff for new squad joins
  AI_FALLBACK_TICK: 7_200,      // 2:00 zero-liquidity rogue AI spawn
  RAID_DEADLINE_TICK: 54_000,   // 15:00 raid closing & burn deadline

  // Exfil Timings
  EXFIL_HOLD_TICKS: 180,        // 3.0s physical hold inside green smoke
  AIRLOCK_CORRIDOR_DURATION_MS: 2500, // 2.5s corridor presentation lock
  EXFIL_ZONE_RADIUS: 6.0,       // 6 meter extraction LZ radius

  // Proximity Alert System
  PROXIMITY_ALERT_RADIUS: 60.0, // 60 meter radar detection warning

  // Kinetic Stickman Locomotion
  SPEED_WALK: 4.5,
  SPEED_SPRINT: 7.5,
  SLIDE_TICKS: 48,              // 0.8s slide
  ROLL_TICKS: 48,               // 0.8s combat roll
  ROLL_IFRAMES: 12,             // 12 invincibility frames during roll
  KICK_TICKS: 42,               // 0.7s melee kick

  // Weapon Stats
  RIFLE_DAMAGE: 24,
  RIFLE_COOLDOWN_TICKS: 8,      // ~7.5 rounds/sec
  SHOTGUN_DAMAGE: 16,           // per pellet (6 pellets)
  SHOTGUN_COOLDOWN_TICKS: 40,   // ~1.5 shots/sec

  // Sector 7 Map Dimensions
  MAP_MIN_X: -80,
  MAP_MAX_X: 80,
  MAP_MIN_Z: -80,
  MAP_MAX_Z: 80,

  // Key Sector Coordinates
  EXFIL_ZONE: { x: 45, y: 0, z: 45, radius: 6.0, zoneId: 'lz_sector_7' },
  SPAWN_SQUAD_A: { x: -50, z: -50 },
  SPAWN_SQUAD_B: { x: 50, z: -50 },
  SPAWN_ROGUE_AI: { x: -45, z: 45 },
} as const;
