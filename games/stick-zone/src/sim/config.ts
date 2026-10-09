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
  MAP_MIN_X: -79.05,
  MAP_MAX_X: 79.05,
  MAP_MIN_Z: -79.05,
  MAP_MAX_Z: 79.05,

  // Key Sector Coordinates
  EXFIL_ZONE: { x: 45, y: 0, z: 45, radius: 6.0, zoneId: 'lz_sector_7' },
  SPAWN_SQUAD_A: { x: -50, z: -50 },
  SPAWN_SQUAD_B: { x: 50, z: -50 },
  SPAWN_ROGUE_AI: { x: -45, z: 45 },
} as const;

export const AI_CONFIGS = {
  scav_boss_warlord: {
    id: "scav_boss_warlord",
    name: "SECTOR WARLORD BOSS",
    badge: "SECTOR BOSS",
    type: "boss" as const,
    health: 100,
    startingHealth: 100,
    maxHealth: 100,
    armor: 100,
    startingArmor: 100,
    maxArmor: 100,
    cash: 6500,
    ammo: 30,
    maxAmmo: 30,
    weapon: "rifle" as const,
    hasKeycard: true,
    dropsKeycard: true,
    originX: 0,
    originZ: 42,
    speed: 0.005,
    ampX: 2.0,
    ampZ: 1.5,
  },
  scav_runner_01: {
    id: "scav_runner_01",
    name: "SCAV RUNNER // RECON",
    badge: "SCAV PATROL",
    type: "scav" as const,
    health: 80,
    startingHealth: 80,
    maxHealth: 80,
    armor: 40,
    startingArmor: 40,
    maxArmor: 40,
    cash: 1800,
    ammo: 30,
    maxAmmo: 30,
    weapon: "rifle" as const,
    hasKeycard: false,
    dropsKeycard: false,
    originX: -25,
    originZ: 5,
    speed: 0.006,
    ampX: 3.0,
    ampZ: 2.0,
  },
  scav_enforcer_02: {
    id: "scav_enforcer_02",
    name: "SCAV ENFORCER // SHOTGUN",
    badge: "SCAV ENFORCER",
    type: "scav" as const,
    health: 100,
    startingHealth: 100,
    maxHealth: 100,
    armor: 60,
    startingArmor: 60,
    maxArmor: 60,
    cash: 2800,
    ammo: 6,
    maxAmmo: 6,
    weapon: "shotgun" as const,
    hasKeycard: false,
    dropsKeycard: false,
    originX: 18,
    originZ: 28,
    speed: 0.004,
    ampX: 2.5,
    ampZ: 2.5,
  },
  op_rogue_ai: {
    id: "op_rogue_ai",
    name: "ROGUE EXFIL HUNTER",
    badge: "ROGUE AI OPERATOR",
    type: "scav" as const,
    health: 100,
    startingHealth: 100,
    maxHealth: 100,
    armor: 75,
    startingArmor: 75,
    maxArmor: 75,
    cash: 2500,
    ammo: 30,
    maxAmmo: 30,
    weapon: "rifle" as const,
    hasKeycard: false,
    dropsKeycard: false,
    originX: -45,
    originZ: 45,
    speed: 0.005,
    ampX: 3.5,
    ampZ: 2.0,
  },
} as const;

export const BOSS_CONFIG = AI_CONFIGS.scav_boss_warlord;
export const BOSS_PATROL = {
  originX: AI_CONFIGS.scav_boss_warlord.originX,
  originZ: AI_CONFIGS.scav_boss_warlord.originZ,
  speed: AI_CONFIGS.scav_boss_warlord.speed,
  ampX: AI_CONFIGS.scav_boss_warlord.ampX,
  ampZ: AI_CONFIGS.scav_boss_warlord.ampZ,
} as const;

export function computeAIPosition(targetId: string, tick: number): { x: number; z: number; facing: number } {
  const cfg = (AI_CONFIGS as any)[targetId] || AI_CONFIGS.scav_boss_warlord;
  const x = cfg.originX + Math.sin(tick * cfg.speed) * cfg.ampX;
  const z = cfg.originZ + Math.cos(tick * cfg.speed) * cfg.ampZ;
  const vx = Math.cos(tick * cfg.speed) * cfg.ampX * cfg.speed;
  const vz = -Math.sin(tick * cfg.speed) * cfg.ampZ * cfg.speed;
  const facing = Math.atan2(vx, vz);
  return { x, z, facing };
}

export function computeBossPosition(tick: number): { x: number; z: number; facing: number } {
  return computeAIPosition("scav_boss_warlord", tick);
}
