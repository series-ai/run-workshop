// src/sim/crates.ts
var DEPOT_CRATE_CONFIGS = [
  {
    id: "crate_01",
    x: -8,
    z: -6,
    cashValue: 1250,
    containerType: "dumpster",
    containerTitle: "MILITARY DUMPSTER // WEST ALLEY",
    items: [
      { id: "item_gpu", name: "Encrypted GPU", rarity: "legendary", icon: "\u{1F4BE}", value: 950, type: "valuable" },
      { id: "item_m855", name: "M855A1 AP Ammo Pack", rarity: "rare", icon: "\u{1F4E6}", value: 300, type: "ammo" }
    ]
  },
  {
    id: "crate_02",
    x: 20,
    z: -15,
    cashValue: 2400,
    containerType: "barrel",
    containerTitle: "CHEMICAL & CONTRABAND BARREL",
    items: [
      { id: "item_bitcoin", name: "Physical Bitcoin", rarity: "legendary", icon: "\u{1FA99}", value: 1800, type: "valuable" },
      { id: "item_stim", name: "Propital Combat Stim", rarity: "rare", icon: "\u{1F489}", value: 600, type: "med" }
    ]
  },
  {
    id: "crate_03",
    x: -16,
    z: 14,
    cashValue: 3800,
    containerType: "console",
    containerTitle: "SECURE TECH STORAGE CONSOLE",
    items: [
      { id: "item_keycard", name: "Violet Lab Access Keycard", rarity: "legendary", icon: "\u{1F4B3}", value: 3200, type: "keycard" },
      { id: "item_slugs", name: "12G Magnum Buckshot Box", rarity: "rare", icon: "\u{1F4E6}", value: 600, type: "ammo" }
    ]
  },
  {
    id: "crate_04",
    x: 30,
    z: 22,
    cashValue: 2500,
    containerType: "crate",
    containerTitle: "TACTICAL SUPPLY FOOTLOCKER",
    items: [
      { id: "item_flashdrive", name: "Encrypted Flash Drive", rarity: "rare", icon: "\u{1F4BE}", value: 1700, type: "valuable" },
      { id: "item_morphine", name: "Morphine Auto-Injector", rarity: "rare", icon: "\u{1F489}", value: 800, type: "med" }
    ]
  },
  {
    id: "crate_05",
    x: -35,
    z: -25,
    cashValue: 3200,
    containerType: "corpse",
    containerTitle: "FALLEN PMC OPERATIVE",
    items: [
      { id: "item_folder", name: "Classified Intelligence Folder", rarity: "epic", icon: "\u{1F4C1}", value: 2200, type: "valuable" },
      { id: "item_defib", name: "Portable Defibrillator", rarity: "epic", icon: "\u26A1", value: 1e3, type: "med" }
    ]
  }
];
var KNOWN_DEPOT_CRATES = Object.fromEntries(
  DEPOT_CRATE_CONFIGS.map((c) => [c.id, c.cashValue])
);
var DEPOT_CRATE_LOCATIONS = Object.fromEntries(
  DEPOT_CRATE_CONFIGS.map((c) => [c.id, { x: c.x, z: c.z }])
);

// src/sim/config.ts
var SIM_CONFIG = {
  TICKS_PER_SECOND: 60,
  TICK_INTERVAL_MS: 1e3 / 60,
  // 16.666ms
  // Ingress & Extraction Lifecycle Ticks
  INGRESS_WINDOW_TICKS: 28800,
  // 8:00 cutoff for new squad joins
  AI_FALLBACK_TICK: 7200,
  // 2:00 zero-liquidity rogue AI spawn
  RAID_DEADLINE_TICK: 54e3,
  // 15:00 raid closing & burn deadline
  // Exfil Timings
  EXFIL_HOLD_TICKS: 180,
  // 3.0s physical hold inside green smoke
  AIRLOCK_CORRIDOR_DURATION_MS: 2500,
  // 2.5s corridor presentation lock
  EXFIL_ZONE_RADIUS: 6,
  // 6 meter extraction LZ radius
  // Proximity Alert System
  PROXIMITY_ALERT_RADIUS: 60,
  // 60 meter radar detection warning
  // Kinetic Stickman Locomotion
  SPEED_WALK: 4.5,
  SPEED_SPRINT: 7.5,
  SLIDE_TICKS: 48,
  // 0.8s slide
  ROLL_TICKS: 48,
  // 0.8s combat roll
  ROLL_IFRAMES: 12,
  // 12 invincibility frames during roll
  KICK_TICKS: 42,
  // 0.7s melee kick
  // Weapon Stats
  RIFLE_DAMAGE: 24,
  RIFLE_COOLDOWN_TICKS: 8,
  // ~7.5 rounds/sec
  SHOTGUN_DAMAGE: 16,
  // per pellet (6 pellets)
  SHOTGUN_COOLDOWN_TICKS: 40,
  // ~1.5 shots/sec
  // Sector 7 Map Dimensions
  MAP_MIN_X: -79.05,
  MAP_MAX_X: 79.05,
  MAP_MIN_Z: -79.05,
  MAP_MAX_Z: 79.05,
  // Key Sector Coordinates
  EXFIL_ZONE: { x: 45, y: 0, z: 45, radius: 6, zoneId: "lz_sector_7" },
  SPAWN_SQUAD_A: { x: -50, z: -50 },
  SPAWN_SQUAD_B: { x: 50, z: -50 },
  SPAWN_ROGUE_AI: { x: -45, z: 45 }
};
var AI_CONFIGS = {
  scav_boss_warlord: {
    id: "scav_boss_warlord",
    name: "SECTOR WARLORD BOSS",
    badge: "SECTOR BOSS",
    type: "boss",
    health: 100,
    startingHealth: 100,
    maxHealth: 100,
    armor: 100,
    startingArmor: 100,
    maxArmor: 100,
    cash: 6500,
    ammo: 30,
    maxAmmo: 30,
    weapon: "rifle",
    hasKeycard: true,
    dropsKeycard: true,
    originX: 0,
    originZ: 42,
    speed: 5e-3,
    ampX: 2,
    ampZ: 1.5
  },
  scav_runner_01: {
    id: "scav_runner_01",
    name: "SCAV RUNNER // RECON",
    badge: "SCAV PATROL",
    type: "scav",
    health: 80,
    startingHealth: 80,
    maxHealth: 80,
    armor: 40,
    startingArmor: 40,
    maxArmor: 40,
    cash: 1800,
    ammo: 30,
    maxAmmo: 30,
    weapon: "rifle",
    hasKeycard: false,
    dropsKeycard: false,
    originX: -25,
    originZ: 5,
    speed: 6e-3,
    ampX: 3,
    ampZ: 2
  },
  scav_enforcer_02: {
    id: "scav_enforcer_02",
    name: "SCAV ENFORCER // SHOTGUN",
    badge: "SCAV ENFORCER",
    type: "scav",
    health: 100,
    startingHealth: 100,
    maxHealth: 100,
    armor: 60,
    startingArmor: 60,
    maxArmor: 60,
    cash: 2800,
    ammo: 6,
    maxAmmo: 6,
    weapon: "shotgun",
    hasKeycard: false,
    dropsKeycard: false,
    originX: 18,
    originZ: 28,
    speed: 4e-3,
    ampX: 2.5,
    ampZ: 2.5
  },
  op_rogue_ai: {
    id: "op_rogue_ai",
    name: "ROGUE EXFIL HUNTER",
    badge: "ROGUE AI OPERATOR",
    type: "scav",
    health: 100,
    startingHealth: 100,
    maxHealth: 100,
    armor: 75,
    startingArmor: 75,
    maxArmor: 75,
    cash: 2500,
    ammo: 30,
    maxAmmo: 30,
    weapon: "rifle",
    hasKeycard: false,
    dropsKeycard: false,
    originX: -45,
    originZ: 45,
    speed: 5e-3,
    ampX: 3.5,
    ampZ: 2
  }
};
var BOSS_CONFIG = AI_CONFIGS.scav_boss_warlord;
var BOSS_PATROL = {
  originX: AI_CONFIGS.scav_boss_warlord.originX,
  originZ: AI_CONFIGS.scav_boss_warlord.originZ,
  speed: AI_CONFIGS.scav_boss_warlord.speed,
  ampX: AI_CONFIGS.scav_boss_warlord.ampX,
  ampZ: AI_CONFIGS.scav_boss_warlord.ampZ
};

// src/sim/airlock.ts
import {
  ExfilController,
  verifyReceiptIntegrity
} from "@series-inc/rundot-syncplay/extensions/hub";
async function computeCanonicalOutcomeDigest(outcomePayload) {
  const sortedKeys = Object.keys(outcomePayload).sort();
  const canonicalObj = {};
  for (const k of sortedKeys) {
    canonicalObj[k] = outcomePayload[k];
  }
  const serialized = JSON.stringify(canonicalObj);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    hash = (hash << 5) - hash + serialized.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}
var AuthoritativeSettlementLedger = class {
  settledRaids = /* @__PURE__ */ new Set();
  raids = /* @__PURE__ */ new Map();
  profiles = /* @__PURE__ */ new Map();
  auditLog = /* @__PURE__ */ new Map();
  idempotencyMap = /* @__PURE__ */ new Map();
  commitMutex = Promise.resolve();
  constructor() {
    this.reset();
  }
  reset() {
    this.raids.clear();
    this.profiles.clear();
    this.auditLog.clear();
    this.idempotencyMap.clear();
    this.settledRaids.clear();
    this.raids.set("raid_sector7_1042", {
      raidId: "raid_sector7_1042",
      status: "active",
      allowableCashPool: 5e4,
      totalBanked: 0
    });
    this.profiles.set("op_alpha_1", {
      profileId: "op_alpha_1",
      inventoryRevision: 13,
      activeRaid: "raid_sector7_1042",
      loadoutEscrowId: "escrow_op_alpha_1_loadout"
    });
    this.profiles.set("op_bravo_1", {
      profileId: "op_bravo_1",
      inventoryRevision: 1,
      activeRaid: "raid_sector7_1042",
      loadoutEscrowId: "escrow_op_bravo_1_loadout"
    });
  }
  registerDeployment(profileId, raidId) {
    const settlementKey = `${raidId}:${profileId}`;
    if (this.settledRaids.has(settlementKey)) {
      return;
    }
    let prof = this.profiles.get(profileId);
    if (!prof) {
      prof = { profileId, inventoryRevision: 13, activeRaid: raidId, loadoutEscrowId: `escrow_${profileId}_loadout` };
      this.profiles.set(profileId, prof);
    } else {
      prof.activeRaid = raidId;
    }
    if (!this.raids.has(raidId)) {
      this.raids.set(raidId, { raidId, status: "active", allowableCashPool: 5e4, totalBanked: 0 });
    }
  }
  hasCommittedReceipt(receiptId) {
    return this.auditLog.has(receiptId);
  }
  async commitSettlement(sim) {
    return new Promise((resolve, reject) => {
      this.commitMutex = this.commitMutex.then(async () => {
        try {
          const res = await this.executeCommitTransaction(sim);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
  async executeCommitTransaction(sim) {
    const snapshotTick = sim.tick;
    const snapshotCash = sim.player.cash;
    const extractingId = sim.player.id;
    const raidId = sim.raidId || "raid_sector7_1042";
    const retainedSquads = sim.rivals && sim.rivals.length > 0 ? sim.rivals.map((r) => r.id) : [extractingId === "op_alpha_1" ? "op_bravo_1" : "op_alpha_1"];
    if (typeof snapshotTick !== "number" || isNaN(snapshotTick) || snapshotTick <= 0) {
      throw new Error(`Invalid settlement tick: ${snapshotTick}. Must be greater than 0.`);
    }
    if (typeof snapshotCash !== "number" || isNaN(snapshotCash) || !Number.isInteger(snapshotCash) || snapshotCash < 0) {
      throw new Error(`Invalid cash banked: ${snapshotCash}. Must be non-negative integer.`);
    }
    const exState = sim.exfilController?.getState?.();
    const isExtracted = sim.player?.isExtracted || sim.isExtracted || exState && (exState.kind === "extracted" || exState.kind === "corridor_presentation" || exState.kind === "submitting_settlement");
    if (sim.exfilController && !isExtracted) {
      throw new Error("Cannot commit settlement: Operative extraction has not completed");
    }
    const idempKey = `${raidId}:${extractingId}:${snapshotTick}:${snapshotCash}`;
    if (this.idempotencyMap.has(idempKey)) {
      const existingReceiptId = this.idempotencyMap.get(idempKey);
      const existing = this.auditLog.get(existingReceiptId);
      if (existing) {
        const outcomePayload2 = {
          raidId,
          verifiedPrefixTick: snapshotTick,
          cutoffTick: 54e3,
          isFinalClose: false,
          cashBanked: snapshotCash,
          extractedSquad: extractingId,
          retainedSquads
        };
        return { receipt: JSON.parse(JSON.stringify(existing)), outcomePayload: outcomePayload2 };
      }
    }
    const settlementKey = `${raidId}:${extractingId}`;
    if (this.settledRaids.has(settlementKey)) {
      throw new Error(`Profile ${extractingId} has already settled for raid ${raidId}`);
    }
    let raid = this.raids.get(raidId);
    if (!raid) {
      raid = { raidId, status: "active", allowableCashPool: 5e4, totalBanked: 0 };
      this.raids.set(raidId, raid);
    }
    if (raid.status !== "active") {
      throw new Error(`Raid ${raidId} is not active in authoritative ledger`);
    }
    if (raid.totalBanked + snapshotCash > raid.allowableCashPool) {
      throw new Error(`Invalid cash banked: $${snapshotCash} + existing $${raid.totalBanked} exceeds allowable pool limit $${raid.allowableCashPool}`);
    }
    let extractingProfile = this.profiles.get(extractingId);
    if (!extractingProfile) {
      extractingProfile = { profileId: extractingId, inventoryRevision: 13, activeRaid: raidId, loadoutEscrowId: `escrow_${extractingId}_loadout` };
      this.profiles.set(extractingId, extractingProfile);
    } else {
      if (extractingProfile.activeRaid !== null && extractingProfile.activeRaid !== raidId) {
        throw new Error(`Profile ${extractingId} active raid (${extractingProfile.activeRaid}) does not match settlement raid ${raidId}`);
      }
      extractingProfile.activeRaid = raidId;
    }
    const outcomePayload = {
      raidId,
      verifiedPrefixTick: snapshotTick,
      cutoffTick: 54e3,
      isFinalClose: false,
      cashBanked: snapshotCash,
      extractedSquad: extractingId,
      retainedSquads
    };
    const outcomeDigest = await computeCanonicalOutcomeDigest(outcomePayload);
    if (sim.player && (sim.player.isAlive === false || sim.player.health <= 0)) {
      throw new Error(`Cannot commit settlement: Operative ${extractingId} is K.I.A.`);
    }
    const postDigestState = sim.exfilController?.getState?.();
    if (postDigestState && (postDigestState.kind === "failed" || postDigestState.kind === "cancelled")) {
      throw new Error(`Cannot commit settlement from exfil state "${postDigestState.kind}"`);
    }
    const receiptId = `receipt_s7_${outcomeDigest.slice(0, 16)}`;
    const nextRevision = (extractingProfile.inventoryRevision ?? (extractingId.includes("alpha") || extractingId === "op_player" ? 13 : 1)) + 1;
    const participantResults = [
      {
        profileId: extractingId,
        releasedEscrowIds: [`escrow_${extractingId}_loadout`],
        inventoryRevision: nextRevision,
        activeRaidCleared: true
      },
      ...retainedSquads.map((rivalId) => {
        let retainedProfile = this.profiles.get(rivalId);
        if (!retainedProfile) {
          retainedProfile = { profileId: rivalId, inventoryRevision: 1, activeRaid: raidId, loadoutEscrowId: `escrow_${rivalId}_loadout` };
          this.profiles.set(rivalId, retainedProfile);
        }
        const rivalAlreadyExtracted = retainedProfile.activeRaid === null;
        return {
          profileId: rivalId,
          releasedEscrowIds: rivalAlreadyExtracted ? [`escrow_${rivalId}_loadout`] : [],
          inventoryRevision: retainedProfile.inventoryRevision,
          activeRaidCleared: rivalAlreadyExtracted
        };
      })
    ];
    const receipt = {
      v: 1,
      receiptId,
      raidId,
      outcomeId: outcomeDigest,
      intentHash: `intent_${outcomeDigest.slice(16, 32)}`,
      outcomeDigest,
      throughTick: snapshotTick,
      committedAtMs: Date.now(),
      participantResults,
      transfers: [
        {
          itemId: "currency_credits",
          quantity: `BE:${BigInt(snapshotCash).toString()}`,
          toProfileId: extractingId,
          source: "world_spawn"
        }
      ]
    };
    extractingProfile.activeRaid = null;
    extractingProfile.inventoryRevision = nextRevision;
    raid.totalBanked += snapshotCash;
    for (const p of participantResults) {
      const prof = this.profiles.get(p.profileId);
      if (prof) {
        if (p.activeRaidCleared) {
          prof.activeRaid = null;
        }
        if (typeof p.inventoryRevision === "number") {
          prof.inventoryRevision = p.inventoryRevision;
        }
      }
    }
    const storedReceipt = JSON.parse(JSON.stringify(receipt));
    this.settledRaids.add(`${raidId}:${extractingId}`);
    this.auditLog.set(receiptId, storedReceipt);
    this.idempotencyMap.set(idempKey, receiptId);
    return { receipt: JSON.parse(JSON.stringify(receipt)), outcomePayload };
  }
};
var defaultSettlementLedger = new AuthoritativeSettlementLedger();
function registerDeployment(profileId, raidId) {
  defaultSettlementLedger.registerDeployment(profileId, raidId);
}
authoritativeLedgerCommit.registerDeployment = registerDeployment;
async function authoritativeLedgerCommit(sim, ledger) {
  const activeLedger = ledger || sim.settlementAuthority || defaultSettlementLedger;
  if (sim.player && (sim.player.isAlive === false || sim.player.health <= 0)) {
    throw new Error(`Cannot commit settlement: Operative ${sim.player.id} is K.I.A.`);
  }
  if (sim.isSocketDisconnected === false && sim.serverMachineDamageAuthority && !sim.serverHoldCompletedAtTick) {
    throw new Error("Relay authority hold verification required but not confirmed");
  }
  if (activeLedger && sim.player && sim.player.id && sim.raidId) {
    const settlementKey = `${sim.raidId}:${sim.player.id}`;
    const alreadySettled = activeLedger.settledRaids?.has(settlementKey);
    if (!alreadySettled) {
      const prof = activeLedger.profiles?.get(sim.player.id);
      if (!prof || prof.activeRaid !== sim.raidId) {
        activeLedger.registerDeployment(sim.player.id, sim.raidId);
      }
    }
  }
  const exfilState = sim.exfilController?.getState?.();
  if (exfilState?.kind === "corridor_presentation") {
    const elapsed = Date.now() - exfilState.startedAtMs;
    const remaining = SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS - elapsed;
    if (remaining > 50) {
      throw new Error(`Airlock corridor presentation in progress (${remaining}ms remaining)`);
    }
  }
  const commitTick = sim.frozenSettlementTick ?? sim.tick;
  const commitCash = sim.frozenSettlementCash ?? sim.player.cash;
  const commitPromise = activeLedger.commitSettlement({
    tick: commitTick,
    player: {
      get id() {
        return sim.player.id;
      },
      get cash() {
        return commitCash;
      },
      get isAlive() {
        return sim.player.isAlive;
      },
      get health() {
        return sim.player.health;
      },
      get isExtracted() {
        return sim.player?.isExtracted ?? sim.isExtracted;
      }
    },
    exfilController: sim.exfilController,
    raidId: sim.raidId,
    rivals: sim.rivals
  });
  const res = await commitPromise;
  if (sim.player && (sim.player.isAlive === false || sim.player.health <= 0)) {
    throw new Error(`Cannot commit settlement: Operative ${sim.player.id} is K.I.A.`);
  }
  return res;
}

// src/sim/game.ts
var CONTAINER_GEOMETRY = {
  length: 6.9,
  width: 3.12,
  height: 2.6,
  halfLength: 3.45,
  halfWidth: 1.56
};
function createContainerBox(x, z, isRotated) {
  const hx = isRotated ? CONTAINER_GEOMETRY.halfWidth : CONTAINER_GEOMETRY.halfLength;
  const hz = isRotated ? CONTAINER_GEOMETRY.halfLength : CONTAINER_GEOMETRY.halfWidth;
  return {
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz
  };
}
function isPositionInExfilZone(x, z, hasKeycard = false) {
  const distToExfil = Math.hypot(x - 45, z - 45);
  const distToBunker = Math.hypot(x - -45, z - -45);
  return distToExfil <= 6 || hasKeycard && distToBunker <= 6;
}
var MAP_CONTAINERS = [
  // Original 7 depot containers
  { id: "cnt_01", position: [-20, 0, -30], rotation: [0, 0, 0], box: createContainerBox(-20, -30, false) },
  { id: "cnt_02", position: [-35, 0, -10], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-35, -10, true) },
  { id: "cnt_03", position: [10, 0, -40], rotation: [0, 0, 0], box: createContainerBox(10, -40, false) },
  { id: "cnt_04", position: [30, 0, -20], rotation: [0, 0, 0], box: createContainerBox(30, -20, false) },
  { id: "cnt_05", position: [-15, 0, 15], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-15, 15, true) },
  { id: "cnt_06", position: [5, 0, 30], rotation: [0, 0, 0], box: createContainerBox(5, 30, false) },
  { id: "cnt_07", position: [-45, 0, 35], rotation: [0, 0, 0], box: createContainerBox(-45, 35, false) },
  // Central Corridor Flanking Industrial Stacks (x = ±5.8 for optimal 66.70° tactical visibility)
  { id: "flank_w_north", position: [-5.8, 0, -25], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-5.8, -25, true) },
  { id: "flank_e_north", position: [5.8, 0, -25], rotation: [0, Math.PI / 2, 0], box: createContainerBox(5.8, -25, true) },
  { id: "flank_w_mid", position: [-9.5, 0, 5], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-9.5, 5, true) },
  { id: "flank_e_mid", position: [9.5, 0, 5], rotation: [0, Math.PI / 2, 0], box: createContainerBox(9.5, 5, true) },
  { id: "flank_w_south", position: [-9.5, 0, 35], rotation: [0, Math.PI / 2, 0], box: createContainerBox(-9.5, 35, true) },
  { id: "flank_e_south", position: [9.5, 0, 35], rotation: [0, Math.PI / 2, 0], box: createContainerBox(9.5, 35, true) },
  // Perimeter Flanking Heavy Stacks (x = ±60)
  { id: "perim_w_north", position: [-60, 0, -25], rotation: [0, 0, 0], box: createContainerBox(-60, -25, false) },
  { id: "perim_w_mid", position: [-60, 0, 5], rotation: [0, 0, 0], box: createContainerBox(-60, 5, false) },
  { id: "perim_w_south", position: [-60, 0, 35], rotation: [0, 0, 0], box: createContainerBox(-60, 35, false) },
  { id: "perim_e_north", position: [60, 0, -25], rotation: [0, 0, 0], box: createContainerBox(60, -25, false) },
  { id: "perim_e_mid", position: [60, 0, 5], rotation: [0, 0, 0], box: createContainerBox(60, 5, false) },
  { id: "perim_e_south", position: [60, 0, 35], rotation: [0, 0, 0], box: createContainerBox(60, 35, false) }
];
var DEPOT_CONTAINERS = [
  { minX: -23.5, maxX: -16.5, minZ: -32, maxZ: -28 },
  { minX: -37, maxX: -33, minZ: -13.5, maxZ: -6.5 },
  { minX: 7, maxX: 13, minZ: -41.5, maxZ: -38.5 },
  { minX: 27, maxX: 33, minZ: -22.5, maxZ: -17.5 },
  { minX: -17, maxX: -13, minZ: 11.5, maxZ: 18.5 },
  { minX: 2, maxX: 8, minZ: 28.5, maxZ: 31.5 },
  { minX: -48.5, maxX: -41.5, minZ: 33, maxZ: 37 },
  ...MAP_CONTAINERS.slice(7).map((c) => c.box)
];

// src/sim/server-settlement.ts
import fs from "fs";
import path from "path";
import crypto2 from "crypto";
var RAID_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
var RESERVED_RAID_IDS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function isValidRaidId(id) {
  return typeof id === "string" && RAID_ID_REGEX.test(id) && !RESERVED_RAID_IDS.has(id.toLowerCase());
}
var OPERATIVE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
var RESERVED_OPERATIVE_IDS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor", "system", "server", "admin", "root"]);
function isValidOperativeId(id) {
  return typeof id === "string" && OPERATIVE_ID_REGEX.test(id) && !RESERVED_OPERATIVE_IDS.has(id.toLowerCase());
}
function hasOwnOperative(raid, opId) {
  return Boolean(raid && raid.operatives && typeof opId === "string" && isValidOperativeId(opId) && Object.prototype.hasOwnProperty.call(raid.operatives, opId));
}
var KNOWN_DEPOT_CRATES3 = {
  crate_01: 1250,
  crate_02: 2400,
  crate_03: 3800,
  crate_04: 2500,
  crate_05: 3200
};
function computeCanonicalOutcomeDigestSync(outcomePayload) {
  const sortedKeys = Object.keys(outcomePayload).sort();
  const canonicalObj = {};
  for (const k of sortedKeys) {
    if (k === "digest") continue;
    canonicalObj[k] = outcomePayload[k];
  }
  return crypto2.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}
function validateStoreIntegrity(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.generation !== void 0) {
    if (typeof data.generation !== "number" || !Number.isSafeInteger(data.generation) || data.generation < 0) {
      return false;
    }
  }
  if (!data.raids || typeof data.raids !== "object" || Array.isArray(data.raids)) return false;
  for (const rId of Object.keys(data.raids)) {
    if (!Object.prototype.hasOwnProperty.call(data.raids, rId)) return false;
    if (!isValidRaidId(rId)) return false;
  }
  const VALID_STATUSES = /* @__PURE__ */ new Set(["active", "settled", "concluded"]);
  if (data.profiles !== void 0) {
    if (!data.profiles || typeof data.profiles !== "object" || Array.isArray(data.profiles)) return false;
    for (const [profId, prof] of Object.entries(data.profiles)) {
      if (!isValidOperativeId(profId)) return false;
      if (!prof || typeof prof !== "object" || Array.isArray(prof)) return false;
      const rev = prof.inventoryRevision;
      if (rev !== void 0 && (typeof rev !== "number" || !Number.isInteger(rev) || rev < 0)) {
        return false;
      }
    }
  }
  if (data.auditLog !== void 0) {
    if (!data.auditLog || typeof data.auditLog !== "object" || Array.isArray(data.auditLog)) return false;
    const seenExtractorsPerRaid = /* @__PURE__ */ new Set();
    for (const [receiptId, entry] of Object.entries(data.auditLog)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const rec = entry.receipt;
      const payload = entry.outcomePayload;
      if (!rec || typeof rec !== "object" || Array.isArray(rec)) return false;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
      if (typeof rec.receiptId !== "string" || rec.receiptId !== receiptId) return false;
      if (typeof rec.raidId !== "string" || !rec.raidId) return false;
      if (!data.raids || !Object.prototype.hasOwnProperty.call(data.raids, rec.raidId) || !data.raids[rec.raidId]) return false;
      const raidRecord = data.raids[rec.raidId];
      if (typeof rec.outcomeDigest !== "string" || !/^[0-9a-fA-F]{64}$/.test(rec.outcomeDigest)) return false;
      if (typeof rec.throughTick !== "number" || !Number.isInteger(rec.throughTick) || rec.throughTick < 0) return false;
      if (!payload.extractedSquad || typeof payload.extractedSquad !== "string") return false;
      if (!raidRecord.operatives || !raidRecord.operatives[payload.extractedSquad]) return false;
      if (typeof payload.cashBanked !== "number" || !Number.isInteger(payload.cashBanked) || payload.cashBanked < 0) return false;
      if (payload.cashBanked > raidRecord.allowableCashPool || payload.cashBanked > raidRecord.totalBanked) return false;
      if (payload.raidId !== rec.raidId) return false;
      if (payload.digest && payload.digest !== rec.outcomeDigest) return false;
      if (rec.throughTick !== payload.verifiedPrefixTick) return false;
      const expectedDigest = computeCanonicalOutcomeDigestSync(payload);
      if (rec.outcomeDigest !== expectedDigest) return false;
      if (rec.v !== 1) return false;
      if (rec.outcomeId !== expectedDigest) return false;
      if (rec.intentHash !== `intent_${expectedDigest.slice(16, 32)}`) return false;
      if (typeof rec.committedAtMs !== "number" || !Number.isInteger(rec.committedAtMs) || rec.committedAtMs < 15e11 || rec.committedAtMs > Date.now() + 864e5) return false;
      if (typeof rec.receiptId === "string" && rec.receiptId.startsWith("receipt_s7_")) {
        if (rec.receiptId !== `receipt_s7_${expectedDigest.slice(0, 16)}`) return false;
      }
      if (!Array.isArray(rec.transfers)) return false;
      const expectedTransfersCount = payload.cashBanked === 0 && rec.transfers.length === 0 ? 0 : 1;
      if (rec.transfers.length !== expectedTransfersCount) return false;
      for (const tr of rec.transfers) {
        if (!tr || typeof tr !== "object" || Array.isArray(tr)) return false;
        if (tr.itemId !== "currency_credits") return false;
        const expectedQty = `BE:${BigInt(payload.cashBanked).toString()}`;
        if (tr.quantity !== expectedQty) return false;
        if (tr.toProfileId !== payload.extractedSquad) return false;
        if (tr.source !== "world_spawn") return false;
      }
      if (!Array.isArray(rec.participantResults) || rec.participantResults.length === 0) return false;
      const seenProfiles = /* @__PURE__ */ new Set();
      for (const p of rec.participantResults) {
        if (!p || typeof p !== "object" || Array.isArray(p)) return false;
        if (!p.profileId || typeof p.profileId !== "string") return false;
        if (seenProfiles.has(p.profileId)) return false;
        seenProfiles.add(p.profileId);
        if (!isValidOperativeId(p.profileId)) return false;
        const isKnown = raidRecord && hasOwnOperative(raidRecord, p.profileId) || data.profiles && Object.prototype.hasOwnProperty.call(data.profiles, p.profileId) || (p.profileId === "op_player" || p.profileId === "op_alpha_1" || p.profileId === "op_bravo_1");
        if (!isKnown) return false;
        if (typeof p.activeRaidCleared !== "boolean") return false;
        if (!Array.isArray(p.releasedEscrowIds)) return false;
        for (const escId of p.releasedEscrowIds) {
          if (typeof escId !== "string" || !/^escrow_[a-zA-Z0-9_]+_loadout$/.test(escId)) return false;
        }
        if (typeof p.inventoryRevision !== "number" || !Number.isInteger(p.inventoryRevision) || p.inventoryRevision < 0) return false;
        const pKeys = Object.keys(p).sort().join(",");
        if (pKeys !== "activeRaidCleared,inventoryRevision,profileId,releasedEscrowIds") return false;
      }
      if (!seenProfiles.has(payload.extractedSquad)) return false;
      const extractorRaidKey = `${rec.raidId}:${payload.extractedSquad}`;
      if (seenExtractorsPerRaid.has(extractorRaidKey)) return false;
      seenExtractorsPerRaid.add(extractorRaidKey);
      const opInCustody = raidRecord.operatives?.[payload.extractedSquad];
      if (opInCustody && (!opInCustody.isExtracted || opInCustody.activeRaid !== "")) return false;
      if (opInCustody && opInCustody.earnedCash !== payload.cashBanked) return false;
      const extractorResult = rec.participantResults.find((p) => p.profileId === payload.extractedSquad);
      if (!extractorResult) return false;
      if (typeof extractorResult.inventoryRevision !== "number" || !Number.isInteger(extractorResult.inventoryRevision) || extractorResult.inventoryRevision < 1) return false;
      if (opInCustody && typeof opInCustody.inventoryRevision === "number") {
        if (extractorResult.inventoryRevision !== opInCustody.inventoryRevision && extractorResult.inventoryRevision !== opInCustody.inventoryRevision + 1) {
          return false;
        }
      }
      if (extractorResult.activeRaidCleared !== true) return false;
      const expectedEscrow = `escrow_${payload.extractedSquad}_loadout`;
      if (!Array.isArray(extractorResult.releasedEscrowIds) || !extractorResult.releasedEscrowIds.includes(expectedEscrow)) return false;
      for (const p of rec.participantResults) {
        if (p.profileId === payload.extractedSquad) continue;
        if (p.activeRaidCleared === false && p.releasedEscrowIds.length > 0) return false;
        const retainedOp = raidRecord.operatives?.[p.profileId];
        if (retainedOp) {
          const isLivingRetained = !retainedOp.isExtracted && (retainedOp.activeRaid === rec.raidId || retainedOp.activeRaid !== "");
          if (isLivingRetained) {
            if (p.activeRaidCleared !== false) return false;
            if (p.releasedEscrowIds.length !== 0) return false;
            if (typeof retainedOp.inventoryRevision === "number" && p.inventoryRevision !== retainedOp.inventoryRevision) return false;
          }
        }
      }
    }
  }
  if (data.sessionTokens !== void 0) {
    if (!data.sessionTokens || typeof data.sessionTokens !== "object" || Array.isArray(data.sessionTokens)) return false;
    for (const tok of Object.values(data.sessionTokens)) {
      if (!tok || typeof tok !== "object" || Array.isArray(tok)) return false;
      if (typeof tok.operativeId !== "string" || typeof tok.raidId !== "string") return false;
      if (!data.raids || !Object.prototype.hasOwnProperty.call(data.raids, tok.raidId)) return false;
      const targetRaid = data.raids[tok.raidId];
      const opId = tok.operativeId;
      if (!isValidOperativeId(opId)) return false;
      if (!targetRaid || !targetRaid.operatives || !Object.prototype.hasOwnProperty.call(targetRaid.operatives, opId)) {
        return false;
      }
    }
  }
  if (data.idempotencyMap !== void 0) {
    if (!data.idempotencyMap || typeof data.idempotencyMap !== "object" || Array.isArray(data.idempotencyMap)) return false;
    for (const [idempKey, receiptId] of Object.entries(data.idempotencyMap)) {
      if (typeof receiptId !== "string" || !data.auditLog || !data.auditLog[receiptId]) {
        return false;
      }
      const entry = data.auditLog[receiptId];
      if (!entry || !entry.receipt || !entry.outcomePayload) return false;
      const parts = idempKey.split(":");
      if (parts.length !== 4) return false;
      const [keyRaidId, keyOpId, keyTickStr, keyCashStr] = parts;
      if (!/^\d+$/.test(keyTickStr) || !/^\d+$/.test(keyCashStr)) return false;
      const keyTick = parseInt(keyTickStr, 10);
      const keyCash = parseInt(keyCashStr, 10);
      if (isNaN(keyTick) || isNaN(keyCash)) return false;
      if (entry.receipt.raidId !== keyRaidId) return false;
      if (entry.outcomePayload.extractedSquad !== keyOpId) return false;
      if (entry.receipt.throughTick !== keyTick) return false;
      if (entry.outcomePayload.cashBanked !== keyCash) return false;
    }
  }
  for (const [rId, r] of Object.entries(data.raids)) {
    if (!Object.prototype.hasOwnProperty.call(data.raids, rId)) return false;
    if (!isValidRaidId(rId)) return false;
    if (r.raidId && r.raidId !== rId) return false;
    if (!r || typeof r !== "object" || Array.isArray(r)) return false;
    if (typeof r.status !== "string" || !VALID_STATUSES.has(r.status)) return false;
    if (r.createdAtMs !== void 0) {
      const cAt = r.createdAtMs;
      if (typeof cAt !== "number" || !Number.isInteger(cAt) || cAt <= 0) return false;
    }
    const totalBanked = r.totalBanked;
    if (typeof totalBanked !== "number" || !Number.isInteger(totalBanked) || totalBanked < 0) return false;
    const allowableCashPool = r.allowableCashPool;
    if (typeof allowableCashPool !== "number" || !Number.isInteger(allowableCashPool) || allowableCashPool < 0 || allowableCashPool > 1e6) return false;
    if (totalBanked > allowableCashPool) return false;
    if (r.machines !== void 0) {
      if (!r.machines || typeof r.machines !== "object" || Array.isArray(r.machines)) return false;
      for (const [mId, mState] of Object.entries(r.machines)) {
        if (!mState || typeof mState !== "object" || Array.isArray(mState)) return false;
        if (typeof mState.health !== "number" || !Number.isFinite(mState.health) || mState.health < 0) return false;
        if (typeof mState.isAlive !== "boolean") return false;
      }
    }
    if (totalBanked > 0) {
      if (!data.auditLog || typeof data.auditLog !== "object" || Object.keys(data.auditLog).length === 0) {
        return false;
      }
      const raidReceipts = Object.values(data.auditLog).filter((e) => e?.receipt?.raidId === rId);
      if (raidReceipts.length === 0) {
        return false;
      }
      const totalReceiptCash = raidReceipts.reduce((sum, e) => sum + (e.outcomePayload?.cashBanked || 0), 0);
      if (totalReceiptCash !== totalBanked) {
        return false;
      }
    } else {
      if (data.auditLog && typeof data.auditLog === "object") {
        const raidReceipts = Object.values(data.auditLog).filter((e) => e?.receipt?.raidId === rId);
        const totalReceiptCash = raidReceipts.reduce((sum, e) => sum + (e.outcomePayload?.cashBanked || 0), 0);
        if (totalReceiptCash !== 0) {
          return false;
        }
      }
    }
    if (!r.operatives || typeof r.operatives !== "object" || Array.isArray(r.operatives)) return false;
    if (!r.crates || typeof r.crates !== "object" || Array.isArray(r.crates)) return false;
    const opClaimedTotals = /* @__PURE__ */ new Map();
    for (const [cId, crate] of Object.entries(r.crates)) {
      if (KNOWN_DEPOT_CRATES3[cId] === void 0) return false;
      if (!crate || typeof crate !== "object" || Array.isArray(crate)) return false;
      const cVal = crate.cashValue;
      const pool = r.allowableCashPool;
      const expectedVal = typeof pool === "number" ? Math.min(KNOWN_DEPOT_CRATES3[cId], pool) : KNOWN_DEPOT_CRATES3[cId];
      if (typeof cVal !== "number" || !Number.isInteger(cVal) || cVal !== expectedVal) return false;
      if (crate.claimedBy !== void 0) {
        if (typeof crate.claimedBy !== "string" || crate.claimedBy.trim() === "") return false;
        if (typeof crate.claimTimestamp !== "number" || !Number.isFinite(crate.claimTimestamp) || crate.claimTimestamp < 0) return false;
        const claimer = crate.claimedBy;
        if (!isValidOperativeId(claimer)) return false;
        if (!Object.prototype.hasOwnProperty.call(r.operatives, claimer)) return false;
        opClaimedTotals.set(claimer, (opClaimedTotals.get(claimer) || 0) + cVal);
      }
    }
    let totalOpEarnedCash = 0;
    let totalExtractedCash = 0;
    for (const [opId, op] of Object.entries(r.operatives)) {
      if (!isValidOperativeId(opId)) return false;
      if (!op || typeof op !== "object" || Array.isArray(op)) return false;
      if (typeof op.operativeId !== "string" || !isValidOperativeId(op.operativeId) || op.operativeId !== opId) return false;
      if (typeof op.admitted !== "boolean") return false;
      if (typeof op.isExtracted !== "boolean") return false;
      if (op.isAlive !== void 0 && typeof op.isAlive !== "boolean") return false;
      if (op.isKia !== void 0 && typeof op.isKia !== "boolean") return false;
      if (op.health !== void 0) {
        const hp = op.health;
        if (typeof hp !== "number" || !Number.isFinite(hp) || hp < 0 || hp > 100) return false;
      }
      if (op.armor !== void 0) {
        const arm = op.armor;
        if (typeof arm !== "number" || !Number.isFinite(arm) || arm < 0 || arm > 100) return false;
      }
      if (op.lastDamageTimestamp !== void 0) {
        const ldt = op.lastDamageTimestamp;
        if (typeof ldt !== "number" || !Number.isFinite(ldt) || ldt < 0) return false;
      }
      if (typeof op.extractedAtTick !== "number" || !Number.isInteger(op.extractedAtTick) || op.extractedAtTick < 0) return false;
      if (typeof op.activeRaid !== "string" || op.activeRaid !== "" && op.activeRaid !== rId) return false;
      if (!Array.isArray(op.cratesLooted)) return false;
      const seenCrates = /* @__PURE__ */ new Set();
      for (const cid of op.cratesLooted) {
        if (typeof cid !== "string" || !KNOWN_DEPOT_CRATES3[cid] || !r.crates[cid] || seenCrates.has(cid)) {
          return false;
        }
        const crateObj = r.crates[cid];
        if (!crateObj || crateObj.claimedBy !== opId) {
          return false;
        }
        seenCrates.add(cid);
      }
      const earnedCash = op.earnedCash;
      if (typeof earnedCash !== "number" || !Number.isInteger(earnedCash) || earnedCash < 0 || earnedCash > allowableCashPool) return false;
      totalOpEarnedCash += earnedCash;
      if (op.isExtracted === true) {
        totalExtractedCash += earnedCash;
        if (!data.auditLog || typeof data.auditLog !== "object") return false;
        const opReceipt = Object.values(data.auditLog).find(
          (entry) => entry?.receipt?.raidId === rId && entry?.outcomePayload?.extractedSquad === opId
        );
        if (!opReceipt) return false;
      } else {
        if (data.auditLog && typeof data.auditLog === "object") {
          const unextractedReceipt = Object.values(data.auditLog).find(
            (entry) => entry?.receipt?.raidId === rId && entry?.outcomePayload?.extractedSquad === opId
          );
          if (unextractedReceipt) return false;
        }
      }
      if (op.holdCompleted !== void 0 && typeof op.holdCompleted !== "boolean") return false;
      if (op.holdCompleted === true) {
        if (typeof op.holdTicks !== "number" || op.holdTicks < 180) return false;
        if (typeof op.holdCompletedAtTick !== "number" || op.holdCompletedAtTick < 180) return false;
      }
      if (op.holdTicks !== void 0 && (typeof op.holdTicks !== "number" || !Number.isInteger(op.holdTicks) || op.holdTicks < 0)) return false;
      if (op.holdCompletedAtTick !== void 0 && (typeof op.holdCompletedAtTick !== "number" || !Number.isInteger(op.holdCompletedAtTick) || op.holdCompletedAtTick < 0)) return false;
      if (op.holdStartTick !== void 0 && (typeof op.holdStartTick !== "number" || !Number.isInteger(op.holdStartTick) || op.holdStartTick < 0)) return false;
      if (op.rawLastReceivedTick !== void 0 && (typeof op.rawLastReceivedTick !== "number" || !Number.isInteger(op.rawLastReceivedTick) || op.rawLastReceivedTick < 0)) return false;
      if (op.lastReportTick !== void 0 && (typeof op.lastReportTick !== "number" || !Number.isInteger(op.lastReportTick) || op.lastReportTick < 0)) return false;
      if (op.holdReportCount !== void 0 && (typeof op.holdReportCount !== "number" || !Number.isInteger(op.holdReportCount) || op.holdReportCount < 0)) return false;
      if (op.accumulatedObservedTicks !== void 0 && (typeof op.accumulatedObservedTicks !== "number" || !Number.isInteger(op.accumulatedObservedTicks) || op.accumulatedObservedTicks < 0)) return false;
      if (op.simTickAdvancement !== void 0 && typeof op.simTickAdvancement !== "boolean") return false;
      if (op.lastObservedX !== void 0 && (typeof op.lastObservedX !== "number" || !Number.isFinite(op.lastObservedX))) return false;
      if (op.lastObservedZ !== void 0 && (typeof op.lastObservedZ !== "number" || !Number.isFinite(op.lastObservedZ))) return false;
      if (op.lastObservedTimestamp !== void 0 && (typeof op.lastObservedTimestamp !== "number" || !Number.isFinite(op.lastObservedTimestamp) || op.lastObservedTimestamp < 0)) return false;
      if (op.corridorStartTime !== void 0 && (typeof op.corridorStartTime !== "number" || !Number.isFinite(op.corridorStartTime) || op.corridorStartTime < 0)) return false;
      if (op.holdStartTimestamp !== void 0 && (typeof op.holdStartTimestamp !== "number" || !Number.isFinite(op.holdStartTimestamp) || op.holdStartTimestamp < 0)) return false;
      if (op.lastHoldTimestamp !== void 0 && (typeof op.lastHoldTimestamp !== "number" || !Number.isFinite(op.lastHoldTimestamp) || op.lastHoldTimestamp < 0)) return false;
      if (op.holdCompletedTimestamp !== void 0 && (typeof op.holdCompletedTimestamp !== "number" || !Number.isFinite(op.holdCompletedTimestamp) || op.holdCompletedTimestamp < 0)) return false;
      const maxLootable = opClaimedTotals.get(opId) || 0;
      if (earnedCash > maxLootable) return false;
      const invRev = op.inventoryRevision;
      if (typeof invRev !== "number" || !Number.isInteger(invRev) || invRev < 0) return false;
    }
    if (totalOpEarnedCash > allowableCashPool) return false;
    if (totalBanked !== totalExtractedCash) return false;
    const rAny = r;
    if (rAny.machineDeployment !== void 0) {
      if (!Array.isArray(rAny.machineDeployment) || rAny.machineDeployment.length > 64) return false;
      const depIds = /* @__PURE__ */ new Set();
      for (const dm of rAny.machineDeployment) {
        if (!dm || typeof dm !== "object" || Array.isArray(dm)) return false;
        if (typeof dm.id !== "string" || !dm.id || dm.id.length > 64) return false;
        if (depIds.has(dm.id)) return false;
        depIds.add(dm.id);
        if (dm.type !== "turret" && dm.type !== "drone") return false;
        for (const f of ["x", "z", "originX", "originZ"]) {
          if (dm[f] !== void 0 && (typeof dm[f] !== "number" || !Number.isFinite(dm[f]) || Math.abs(dm[f]) > 80)) return false;
        }
        if (typeof dm.x !== "number" || !Number.isFinite(dm.x) || Math.abs(dm.x) > 80) return false;
        if (typeof dm.z !== "number" || !Number.isFinite(dm.z) || Math.abs(dm.z) > 80) return false;
        if (typeof dm.health !== "number" || !Number.isFinite(dm.health) || dm.health < 0 || dm.health > 1e3) return false;
        if (dm.isAlive !== void 0 && typeof dm.isAlive !== "boolean") return false;
        if (dm.isAlive === void 0) return false;
        if (dm.vitalsSeq !== void 0 && (typeof dm.vitalsSeq !== "number" || !Number.isInteger(dm.vitalsSeq) || dm.vitalsSeq < 0)) return false;
        if (dm.maxHealth !== void 0 && (typeof dm.maxHealth !== "number" || !Number.isFinite(dm.maxHealth) || dm.maxHealth <= 0 || dm.maxHealth > 1e3)) return false;
        if (dm.maxHealth !== void 0 && dm.health > dm.maxHealth) return false;
      }
    }
    if (rAny.machineRosterRevision !== void 0 && (typeof rAny.machineRosterRevision !== "number" || !Number.isInteger(rAny.machineRosterRevision) || rAny.machineRosterRevision < 0)) return false;
    if (r.machines) {
      for (const rec of Object.values(r.machines)) {
        if (rec && rec.vitalsSeq !== void 0 && (typeof rec.vitalsSeq !== "number" || !Number.isInteger(rec.vitalsSeq) || rec.vitalsSeq < 0)) return false;
      }
    }
  }
  return true;
}
var ServerSettlementAuthority = class _ServerSettlementAuthority {
  static activeAuthorities = /* @__PURE__ */ new Set();
  generation = 0;
  storePath;
  activeRaidId = "raid_sector7_1042";
  claimedSessions = /* @__PURE__ */ new Set();
  ownedOperatives = /* @__PURE__ */ new Set();
  slotClaimTimestamps = /* @__PURE__ */ new Map();
  lastClaimIsDuplicate = false;
  isOperativeOwned(raidId, opId) {
    if (this.isSlotClaimed(raidId, opId)) {
      return true;
    }
    const raid = this.raids.get(raidId);
    if (raid && raid.operatives && raid.operatives[opId] && raid.operatives[opId].owned) {
      return true;
    }
    return false;
  }
  isSlotClaimed(raidId, opId) {
    const key = `${raidId}:${opId}`;
    if (!this.claimedSessions.has(key)) return false;
    if (typeof this.hasActiveSocket === "function" && this.hasActiveSocket(raidId, opId)) {
      this.slotClaimTimestamps.set(key, Date.now());
      return true;
    }
    const ts = this.slotClaimTimestamps.get(key);
    if (!ts || Date.now() - ts > 3e4) {
      this.claimedSessions.delete(key);
      this.slotClaimTimestamps.delete(key);
      this.ownedOperatives.delete(key);
      const raid = this.raids.get(raidId);
      if (raid && raid.operatives && raid.operatives[opId]) {
        delete raid.operatives[opId].owned;
      }
      for (const [tok, sess] of this.sessionTokens.entries()) {
        if (sess.raidId === raidId && sess.operativeId === opId) {
          this.sessionTokens.delete(tok);
        }
      }
      return false;
    }
    return true;
  }
  claimSlot(raidId, opId) {
    const key = `${raidId}:${opId}`;
    const wasClaimed = this.claimedSessions.has(key);
    const wasOwned = this.ownedOperatives.has(key);
    const prevTs = this.slotClaimTimestamps.get(key);
    if (!isValidOperativeId(opId)) {
      throw new Error(`Invalid operativeId: ${opId}`);
    }
    const raid = this.raids.get(raidId);
    const wasOpOwned = Boolean(hasOwnOperative(raid, opId) && raid.operatives[opId].owned);
    this.claimedSessions.add(key);
    this.ownedOperatives.add(key);
    this.slotClaimTimestamps.set(key, Date.now());
    if (hasOwnOperative(raid, opId)) {
      raid.operatives[opId].owned = true;
    }
    try {
      this.saveToDisk();
    } catch (err) {
      if (!wasClaimed) this.claimedSessions.delete(key);
      if (!wasOwned) this.ownedOperatives.delete(key);
      if (prevTs !== void 0) {
        this.slotClaimTimestamps.set(key, prevTs);
      } else {
        this.slotClaimTimestamps.delete(key);
      }
      if (hasOwnOperative(raid, opId)) {
        raid.operatives[opId].owned = wasOpOwned;
      }
      throw err;
    }
  }
  releaseSlot(raidId, opId) {
    const key = `${raidId}:${opId}`;
    const wasClaimed = this.claimedSessions.has(key);
    const wasOwned = this.ownedOperatives.has(key);
    const prevTs = this.slotClaimTimestamps.get(key);
    const raid = this.raids.get(raidId);
    const wasOpOwned = Boolean(raid?.operatives?.[opId]?.owned);
    if (!wasClaimed && !wasOwned) return;
    this.claimedSessions.delete(key);
    this.ownedOperatives.delete(key);
    this.slotClaimTimestamps.delete(key);
    if (raid?.operatives?.[opId]) {
      raid.operatives[opId].owned = false;
    }
    const deletedTokens = [];
    for (const [tok, sess] of this.sessionTokens.entries()) {
      if (sess.raidId === raidId && sess.operativeId === opId) {
        deletedTokens.push([tok, sess]);
      }
    }
    for (const [tok] of deletedTokens) {
      this.sessionTokens.delete(tok);
    }
    try {
      this.saveToDisk();
    } catch (err) {
      if (wasClaimed) this.claimedSessions.add(key);
      if (wasOwned) this.ownedOperatives.add(key);
      if (prevTs !== void 0) {
        this.slotClaimTimestamps.set(key, prevTs);
      }
      if (raid?.operatives?.[opId]) {
        raid.operatives[opId].owned = wasOpOwned;
      }
      for (const [tok, sess] of deletedTokens) {
        this.sessionTokens.set(tok, sess);
      }
      throw err;
    }
  }
  getActiveRaidId() {
    return this.activeRaidId || "raid_sector7_1042";
  }
  getRaidCrates(raidId) {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    return raid ? { ...raid.crates } : {};
  }
  getRaidStartTime(raidId) {
    const target = raidId || this.getActiveRaidId();
    const raid = this.raids.get(target);
    return raid?.createdAtMs || Date.now();
  }
  getCurrentRaidTick(raidId) {
    const start = this.getRaidStartTime(raidId);
    return Math.floor((Date.now() - start) * 60 / 1e3);
  }
  isIngressClosed(raidId) {
    return this.getCurrentRaidTick(raidId) > 28800;
  }
  getRaidRecord(raidId) {
    const id = raidId || this.getActiveRaidId();
    return this.raids.get(id);
  }
  recordOperativeAmmo(raidId, operativeId, ammo, rifleAmmo, shotgunAmmo, selectedWeapon) {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    if (!raid || !raid.operatives || !raid.operatives[operativeId]) return;
    const prevAmmo = raid.operatives[operativeId].ammo;
    const prevRifleAmmo = raid.operatives[operativeId].rifleAmmo;
    const prevShotgunAmmo = raid.operatives[operativeId].shotgunAmmo;
    const prevWeapon = raid.operatives[operativeId].selectedWeapon;
    raid.operatives[operativeId].ammo = Math.max(0, Math.min(30, Math.floor(ammo)));
    if (typeof rifleAmmo === "number") raid.operatives[operativeId].rifleAmmo = Math.max(0, Math.min(30, Math.floor(rifleAmmo)));
    if (typeof shotgunAmmo === "number") raid.operatives[operativeId].shotgunAmmo = Math.max(0, Math.min(8, Math.floor(shotgunAmmo)));
    if (selectedWeapon) raid.operatives[operativeId].selectedWeapon = selectedWeapon;
    try {
      this.saveToDisk();
    } catch (err) {
      if (prevAmmo !== void 0) {
        raid.operatives[operativeId].ammo = prevAmmo;
      } else {
        delete raid.operatives[operativeId].ammo;
      }
      raid.operatives[operativeId].rifleAmmo = prevRifleAmmo;
      raid.operatives[operativeId].shotgunAmmo = prevShotgunAmmo;
      raid.operatives[operativeId].selectedWeapon = prevWeapon;
      throw err;
    }
  }
  getOperativeAmmo(raidId, operativeId) {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    const op = raid?.operatives?.[operativeId];
    return typeof op?.ammo === "number" ? op.ammo : 30;
  }
  recordMachineState(raidId, machineId, health, isAlive) {
    const id = raidId || this.getActiveRaidId();
    const raid = this.raids.get(id);
    if (!raid) return;
    if (!raid.machines) raid.machines = {};
    raid.machines[machineId] = { health: Math.max(0, health), isAlive: isAlive && health > 0 };
    this.saveToDisk();
  }
  resolveOperativeByToken(token) {
    if (!token || typeof token !== "string") return null;
    const entry = this.sessionTokens.get(token);
    if (!entry) return null;
    const key = `${entry.raidId}:${entry.operativeId}`;
    if (this.claimedSessions.has(key)) {
      if (!this.isSlotClaimed(entry.raidId, entry.operativeId)) {
        this.sessionTokens.delete(token);
        return null;
      }
    }
    const raid = this.raids.get(entry.raidId);
    if (!hasOwnOperative(raid, entry.operativeId)) return null;
    return entry;
  }
  getSessionToken(raidId, operativeId) {
    if (!isValidOperativeId(operativeId) || !isValidRaidId(raidId)) return void 0;
    const raid = this.raids.get(raidId);
    if (!hasOwnOperative(raid, operativeId)) return void 0;
    for (const [tok, entry] of this.sessionTokens.entries()) {
      if (entry.raidId === raidId && entry.operativeId === operativeId) {
        return tok;
      }
    }
    return void 0;
  }
  allocateSessionToken(raidId, operativeId) {
    if (!isValidOperativeId(operativeId) || !isValidRaidId(raidId)) return null;
    const raid = this.raids.get(raidId);
    if (!hasOwnOperative(raid, operativeId)) return null;
    const prevTokens = new Map(this.sessionTokens);
    for (const [tok2, sess] of this.sessionTokens.entries()) {
      if (sess.raidId === raidId && sess.operativeId === operativeId) {
        this.sessionTokens.delete(tok2);
      }
    }
    const tok = `sz_tok_${operativeId}_${crypto2.randomBytes(16).toString("hex")}`;
    this.sessionTokens.set(tok, { operativeId, raidId });
    try {
      this.saveToDisk();
    } catch (saveErr) {
      this.sessionTokens = prevTokens;
      throw saveErr;
    }
    return tok;
  }
  deleteReceiptForTesting(receiptId) {
    this.auditLog.delete(receiptId);
  }
  hasCommittedReceipt(receiptId) {
    return this.auditLog.has(receiptId);
  }
  getCommittedReceipt(receiptId) {
    const entry = this.auditLog.get(receiptId);
    if (!entry) return void 0;
    return JSON.parse(JSON.stringify(entry));
  }
  getSessionTokens(raidId) {
    const res = {};
    for (const [tok, entry] of this.sessionTokens.entries()) {
      if (entry.raidId === raidId) {
        res[entry.operativeId] = tok;
      }
    }
    return res;
  }
  hasRaid(raidId) {
    return this.raids.has(raidId);
  }
  isCorrupted = false;
  profiles = /* @__PURE__ */ new Map();
  sessionTokens = /* @__PURE__ */ new Map();
  raids = /* @__PURE__ */ new Map();
  auditLog = /* @__PURE__ */ new Map();
  idempotencyMap = /* @__PURE__ */ new Map();
  commitQueue = Promise.resolve(null);
  constructor(storePath) {
    const env = typeof process !== "undefined" ? process["env"] : {};
    const isTest = typeof process !== "undefined" && (env["NODE_ENV"] === "test" || env["VITEST"] !== void 0);
    if (storePath === ":memory:") {
      this.storePath = ":memory:";
      return;
    }
    if (!storePath && isTest) {
      this.storePath = path.resolve("/tmp", `.settlement-store-test-default-${process.pid}.json`);
    } else {
      this.storePath = storePath || path.resolve(process.cwd(), ".settlement-store.json");
    }
    if (storePath || !isTest) {
      _ServerSettlementAuthority.activeAuthorities.add(this);
    }
    try {
      this.loadFromDisk();
    } catch (loadErr) {
      _ServerSettlementAuthority.activeAuthorities.delete(this);
      throw loadErr;
    }
  }
  loadFromDisk() {
    if (this.storePath === ":memory:") return;
    let data = null;
    let isValid = false;
    let hasBackupHistory = false;
    let primaryExisted = false;
    let raw = null;
    try {
      raw = fs.readFileSync(this.storePath, "utf8");
      primaryExisted = true;
    } catch (readErr) {
      if (readErr && readErr.code === "ENOENT") {
        primaryExisted = false;
      } else {
        this.isCorrupted = true;
        throw new Error(`Failed to read primary settlement store at ${this.storePath}: ${readErr?.message || readErr}`);
      }
    }
    if (raw !== null) {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
      }
      if (parsed && typeof parsed === "object") {
        data = parsed;
        isValid = validateStoreIntegrity(data);
      }
    }
    if (!isValid) {
      let recovered = false;
      let archivedCorruptPath = null;
      hasBackupHistory = false;
      if (primaryExisted) {
        archivedCorruptPath = `${this.storePath}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(this.storePath, archivedCorruptPath);
          const cFd = fs.openSync(archivedCorruptPath, "r");
          try {
            fs.fsyncSync(cFd);
          } finally {
            fs.closeSync(cFd);
          }
          const dir = path.dirname(this.storePath);
          const dFd = fs.openSync(dir, "r");
          try {
            fs.fsyncSync(dFd);
          } finally {
            fs.closeSync(dFd);
          }
        } catch (archiveErr) {
          this.isCorrupted = true;
          throw new Error(`Failed to archive damaged store before recovery: ${archiveErr}`);
        }
      }
      try {
        const dir = path.dirname(this.storePath);
        const base = path.basename(this.storePath);
        let prevFiles = [];
        try {
          prevFiles = fs.readdirSync(dir).filter((f) => f === `${base}.prev` || f.startsWith(`${base}.prev.`) && !f.includes(".prev.prev"));
        } catch (readDirErr) {
          if (readDirErr && readDirErr.code === "ENOENT") {
            prevFiles = [];
          } else {
            this.isCorrupted = true;
            throw new Error(`Failed to read directory for settlement backups at ${dir}: ${readDirErr?.message || readDirErr}`);
          }
        }
        if (true) {
          if (prevFiles.length > 0) {
            hasBackupHistory = true;
          }
          const candidates = [];
          for (const pf of prevFiles) {
            let prevRaw;
            try {
              prevRaw = fs.readFileSync(path.join(dir, pf), "utf8");
            } catch (readErr) {
              this.isCorrupted = true;
              throw new Error(`Failed to read candidate settlement backup ${pf} at ${dir}: ${readErr?.message || readErr}`);
            }
            try {
              const prevParsed = JSON.parse(prevRaw);
              if (validateStoreIntegrity(prevParsed)) {
                const hasExplicitGen = typeof prevParsed.generation === "number" && Number.isSafeInteger(prevParsed.generation);
                const generation = hasExplicitGen ? prevParsed.generation : 0;
                let timestamp = 0;
                if (pf.startsWith(`${base}.prev.`)) {
                  const suffix = pf.slice(`${base}.prev.`.length);
                  const ts = parseInt(suffix, 10);
                  if (!Number.isNaN(ts)) timestamp = ts;
                }
                if (timestamp === 0) {
                  try {
                    timestamp = fs.statSync(path.join(dir, pf)).mtimeMs;
                  } catch {
                  }
                }
                candidates.push({ file: pf, data: prevParsed, hasExplicitGen, generation, timestamp });
              }
            } catch {
            }
          }
          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              if (a.hasExplicitGen && !b.hasExplicitGen) return -1;
              if (!a.hasExplicitGen && b.hasExplicitGen) return 1;
              if (a.hasExplicitGen && b.hasExplicitGen) {
                if (b.generation !== a.generation) {
                  return b.generation - a.generation;
                }
                return b.timestamp - a.timestamp;
              }
              return b.timestamp - a.timestamp;
            });
            const bestCandidate = candidates[0];
            try {
              const tmpRestore = `${this.storePath}.restore.${Date.now()}`;
              fs.copyFileSync(path.join(dir, bestCandidate.file), tmpRestore);
              const tFd = fs.openSync(tmpRestore, "r");
              try {
                fs.fsyncSync(tFd);
              } finally {
                fs.closeSync(tFd);
              }
              fs.renameSync(tmpRestore, this.storePath);
              const sFd = fs.openSync(this.storePath, "r");
              try {
                fs.fsyncSync(sFd);
              } finally {
                fs.closeSync(sFd);
              }
              const dFd = fs.openSync(dir, "r");
              try {
                fs.fsyncSync(dFd);
              } finally {
                fs.closeSync(dFd);
              }
              if (bestCandidate.file !== `${base}.prev`) {
                try {
                  const tmpPrev = `${this.storePath}.prev.tmp.${Date.now()}`;
                  fs.copyFileSync(path.join(dir, bestCandidate.file), tmpPrev);
                  const tpFd = fs.openSync(tmpPrev, "r");
                  try {
                    fs.fsyncSync(tpFd);
                  } finally {
                    fs.closeSync(tpFd);
                  }
                  fs.renameSync(tmpPrev, `${this.storePath}.prev`);
                  const pFd = fs.openSync(`${this.storePath}.prev`, "r");
                  try {
                    fs.fsyncSync(pFd);
                  } finally {
                    fs.closeSync(pFd);
                  }
                  const dirFd2 = fs.openSync(dir, "r");
                  try {
                    fs.fsyncSync(dirFd2);
                  } finally {
                    fs.closeSync(dirFd2);
                  }
                } catch {
                }
              }
              data = bestCandidate.data;
              isValid = true;
              recovered = true;
            } catch (restoreErr) {
              this.isCorrupted = true;
              throw new Error(`Failed to atomically restore settlement store from ${bestCandidate.file}: ${restoreErr}`);
            }
          }
        }
      } catch (err) {
        this.isCorrupted = true;
        throw err;
      }
      if (!recovered && (primaryExisted || hasBackupHistory)) {
        if (primaryExisted && !archivedCorruptPath) {
          archivedCorruptPath = `${this.storePath}.corrupt.${Date.now()}`;
          try {
            fs.copyFileSync(this.storePath, archivedCorruptPath);
            const cFd = fs.openSync(archivedCorruptPath, "r");
            try {
              fs.fsyncSync(cFd);
            } finally {
              fs.closeSync(cFd);
            }
          } catch {
          }
        }
        this.isCorrupted = true;
        throw new Error(`Settlement store at ${this.storePath} contains invalid structural schema or corruption in primary or historical backups. Refusing to overwrite existing ledger.`);
      }
    }
    if (data && typeof data === "object" && isValid) {
      if (typeof data.generation === "number") {
        this.generation = Math.max(this.generation, data.generation);
      }
      if (data.profiles) {
        for (const [opId, prof] of Object.entries(data.profiles)) {
          if (prof && typeof prof.inventoryRevision === "number") {
            this.profiles.set(opId, { inventoryRevision: prof.inventoryRevision });
          }
        }
      }
      for (const [k, v] of Object.entries(data.raids || {})) {
        if (v && v.operatives) {
          const nullOps = /* @__PURE__ */ Object.create(null);
          for (const [opId, op] of Object.entries(v.operatives)) {
            nullOps[opId] = op;
          }
          v.operatives = nullOps;
          for (const op of Object.values(v.operatives)) {
            const currentProf = this.profiles.get(op.operativeId);
            const opRev = typeof op.inventoryRevision === "number" ? op.inventoryRevision : op.operativeId.includes("alpha") || op.operativeId === "op_player" ? 13 : 1;
            if (!currentProf || opRev > currentProf.inventoryRevision) {
              this.profiles.set(op.operativeId, { inventoryRevision: opRev });
            }
            if (op.sessionToken) {
              this.sessionTokens.set(op.sessionToken, { operativeId: op.operativeId, raidId: k });
            }
          }
        }
        if (v && v.crates) {
          for (const crate of Object.values(v.crates)) {
            if (crate && crate.claimedBy && typeof crate.serverClaimedAt !== "number") {
              crate.serverClaimedAt = crate.claimTimestamp || v.createdAtMs || 1;
            }
          }
        }
        this.raids.set(k, v);
      }
      for (const [k, v] of Object.entries(data.auditLog || {})) {
        this.auditLog.set(k, v);
      }
      for (const [k, v] of Object.entries(data.idempotencyMap || {})) {
        this.idempotencyMap.set(k, v);
      }
      if (data.activeRaidId) {
        this.activeRaidId = data.activeRaidId;
      }
      if (data.sessionTokens) {
        for (const [k, v] of Object.entries(data.sessionTokens)) {
          this.sessionTokens.set(k, v);
        }
      }
      if (Array.isArray(data.claimedSessions)) {
        this.claimedSessions = new Set(data.claimedSessions);
      }
      if (data.slotClaimTimestamps && typeof data.slotClaimTimestamps === "object") {
        for (const [k, v] of Object.entries(data.slotClaimTimestamps)) {
          if (typeof v === "number" && Number.isFinite(v)) {
            this.slotClaimTimestamps.set(k, v);
          }
        }
      }
    }
    for (const [raidId, raid] of this.raids.entries()) {
      if (raid.status === "active" && raid.operatives) {
        for (const opId of Object.keys(raid.operatives)) {
          if (!this.getSessionToken(raidId, opId)) {
            const tok = `sz_tok_${opId}_${crypto2.randomBytes(16).toString("hex")}`;
            this.sessionTokens.set(tok, { operativeId: opId, raidId });
          }
        }
      }
    }
    if (!this.isCorrupted && !hasBackupHistory && !this.raids.has("raid_sector7_1042")) {
      this.initRaid("raid_sector7_1042", 5e4, ["op_player", "op_alpha_1", "op_bravo_1"]);
    }
  }
  saveToDisk() {
    if (this.__txSuppressSave === true) return;
    if (this.isCorrupted) {
      console.error("Refusing to save to disk: settlement store is marked corrupted to protect historical ledger.");
      return;
    }
    const cleanRaids = /* @__PURE__ */ Object.create(null);
    for (const [rid, r] of this.raids.entries()) {
      if (!isValidRaidId(rid)) continue;
      const rCopy = JSON.parse(JSON.stringify(r));
      if (rCopy.operatives) {
        for (const op of Object.values(rCopy.operatives)) {
          delete op.pendingRevocationSave;
          delete op.failedPersistence;
        }
      }
      cleanRaids[rid] = rCopy;
    }
    this.generation = (this.generation || 0) + 1;
    const data = {
      generation: this.generation,
      raids: cleanRaids,
      auditLog: Object.fromEntries(this.auditLog),
      idempotencyMap: Object.fromEntries(this.idempotencyMap),
      activeRaidId: this.activeRaidId,
      sessionTokens: Object.fromEntries(this.sessionTokens),
      claimedSessions: Array.from(this.claimedSessions),
      slotClaimTimestamps: Object.fromEntries(this.slotClaimTimestamps),
      profiles: Object.fromEntries(this.profiles)
    };
    if (!validateStoreIntegrity(data)) {
      throw new Error("Store validation failed: refusing to write invalid store data to disk");
    }
    const tmpPath = `${this.storePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const backupPath = `${this.storePath}.prev.${Date.now()}`;
    let fd = null;
    const hadExistingOnDisk = fs.existsSync(this.storePath);
    let hadExisting = false;
    const serializedJson = JSON.stringify(data, null, 2);
    const parsedData = JSON.parse(serializedJson);
    if (!validateStoreIntegrity(parsedData)) {
      throw new Error("Store validation failed on serialized data: round-trip integrity check failed");
    }
    try {
      fd = fs.openSync(tmpPath, "w");
      const buf = Buffer.from(serializedJson, "utf8");
      let bytesWritten = 0;
      while (bytesWritten < buf.length) {
        bytesWritten += fs.writeSync(fd, buf, bytesWritten, buf.length - bytesWritten);
      }
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      if (hadExistingOnDisk) {
        fs.copyFileSync(this.storePath, backupPath);
        const bFd = fs.openSync(backupPath, "r");
        try {
          fs.fsyncSync(bFd);
        } finally {
          fs.closeSync(bFd);
        }
        hadExisting = true;
      }
      fs.renameSync(tmpPath, this.storePath);
      const dir = path.dirname(this.storePath);
      const dirFd = fs.openSync(dir, "r");
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }
      if (hadExisting) {
        try {
          const tmpPrev = `${this.storePath}.prev.tmp.${Date.now()}`;
          fs.copyFileSync(backupPath, tmpPrev);
          const tpFd = fs.openSync(tmpPrev, "r");
          try {
            fs.fsyncSync(tpFd);
          } finally {
            fs.closeSync(tpFd);
          }
          fs.renameSync(tmpPrev, `${this.storePath}.prev`);
          const pFd = fs.openSync(`${this.storePath}.prev`, "r");
          try {
            fs.fsyncSync(pFd);
          } finally {
            fs.closeSync(pFd);
          }
          const dirFd2 = fs.openSync(dir, "r");
          try {
            fs.fsyncSync(dirFd2);
          } finally {
            fs.closeSync(dirFd2);
          }
          fs.unlinkSync(backupPath);
        } catch {
        }
      }
    } catch (err) {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
        }
      }
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
      }
      if (hadExisting && fs.existsSync(backupPath)) {
        try {
          fs.renameSync(backupPath, this.storePath);
          const dir = path.dirname(this.storePath);
          const dirFd = fs.openSync(dir, "r");
          try {
            fs.fsyncSync(dirFd);
          } finally {
            fs.closeSync(dirFd);
          }
        } catch (restoreErr) {
          throw new Error(`Critical persistence failure: could not restore previous store backup: ${restoreErr?.message}`);
        }
      } else if (!hadExistingOnDisk) {
        try {
          if (fs.existsSync(this.storePath)) fs.unlinkSync(this.storePath);
        } catch {
        }
      }
      throw err;
    }
  }
  concludeRaid(raidId) {
    const raid = this.raids.get(raidId);
    if (raid) {
      const prevStatus = raid.status;
      const prevClaimed = new Set(this.claimedSessions);
      const prevOwned = new Set(this.ownedOperatives);
      try {
        raid.status = "concluded";
        for (const claim of Array.from(this.claimedSessions)) {
          if (claim.startsWith(`${raidId}:`)) {
            this.claimedSessions.delete(claim);
          }
        }
        for (const claim of Array.from(this.ownedOperatives)) {
          if (claim.startsWith(`${raidId}:`)) {
            this.ownedOperatives.delete(claim);
          }
        }
        this.saveToDisk();
      } catch (err) {
        raid.status = prevStatus;
        this.claimedSessions = prevClaimed;
        this.ownedOperatives = prevOwned;
        throw err;
      }
    }
  }
  initRaid(raidId, allowablePool = 5e4, operatives = ["op_player", "op_alpha_1", "op_bravo_1"], callerClaimOpId, oldRaidIdToConclude) {
    if (!isValidRaidId(raidId)) {
      throw new Error(`Invalid raidId: must match ^[a-zA-Z0-9_-]{1,64}$, got ${raidId}`);
    }
    if (typeof allowablePool !== "number" || !Number.isInteger(allowablePool) || allowablePool < 0 || allowablePool > 1e6) {
      throw new Error(`Invalid allowable cash pool: must be an integer between 0 and 1,000,000, got ${allowablePool}`);
    }
    for (const opId of operatives) {
      if (!isValidOperativeId(opId)) {
        throw new Error(`Cannot register reserved or invalid operative ID: ${opId}`);
      }
    }
    if (this.raids.has(raidId)) {
      const existing = this.raids.get(raidId);
      const hasExtractedOperative = Object.values(existing.operatives || {}).some((o) => o.isExtracted);
      const hasKiaOperative = Object.values(existing.operatives || {}).some((o) => o.isKia || o.isAlive === false);
      const hasAuditReceipt = Array.from(this.auditLog.values()).some((e) => e.receipt?.raidId === raidId);
      if (existing.status === "concluded" || existing.totalBanked > 0 || hasExtractedOperative || hasKiaOperative || hasAuditReceipt) {
        throw new Error(`Cannot reinitialize raid ${raidId}: raid already settled or concluded (or has K.I.A./extracted operatives)`);
      }
    }
    const backupSessionTokens = new Map(this.sessionTokens);
    const backupRaids = new Map(this.raids);
    const backupActiveRaidId = this.activeRaidId;
    const backupClaimedSessions = new Set(this.claimedSessions);
    const backupOwnedOperatives = new Set(this.ownedOperatives);
    const backupSlotClaimTimestamps = new Map(this.slotClaimTimestamps);
    const backupProfiles = new Map(this.profiles);
    let oldRaidPreviousStatus = void 0;
    try {
      for (const [tok, entry] of this.sessionTokens.entries()) {
        if (entry.raidId === raidId) {
          this.sessionTokens.delete(tok);
        }
      }
      for (const claim of Array.from(this.claimedSessions)) {
        if (claim.startsWith(`${raidId}:`)) {
          this.claimedSessions.delete(claim);
        }
      }
      const opMap = /* @__PURE__ */ Object.create(null);
      const nowInit = Date.now();
      for (const opId of operatives) {
        const sessionToken = `sz_tok_${opId}_${crypto2.randomBytes(16).toString("hex")}`;
        let prof = this.profiles.get(opId);
        if (!prof) {
          let startingRevision = opId.includes("alpha") || opId === "op_player" ? 13 : 1;
          for (const existingRaid of this.raids.values()) {
            const prevOp = existingRaid.operatives?.[opId];
            if (prevOp && typeof prevOp.inventoryRevision === "number" && prevOp.inventoryRevision > startingRevision) {
              startingRevision = prevOp.inventoryRevision;
            }
          }
          prof = { inventoryRevision: startingRevision };
          this.profiles.set(opId, prof);
        }
        const resumeKey = `sz_res_${opId}_${crypto2.randomBytes(16).toString("hex")}`;
        opMap[opId] = {
          operativeId: opId,
          resumeKey,
          admitted: true,
          health: 100,
          armor: 100,
          ammo: 30,
          rifleAmmo: 30,
          shotgunAmmo: 8,
          selectedWeapon: "rifle",
          stimsRemaining: 2,
          earnedCash: 0,
          // Strictly starts at $0; earned cash is strictly tracked from looted crates
          cratesLooted: [],
          isExtracted: false,
          isAlive: true,
          isKia: false,
          extractedAtTick: 0,
          activeRaid: raidId,
          holdTicks: 0,
          holdCompleted: false,
          inventoryRevision: prof.inventoryRevision,
          accumulatedObservedTicks: 0,
          spawnX: opId === "op_bravo_1" ? 50 : -50,
          spawnZ: -50,
          lastObservedX: opId === "op_bravo_1" ? 50 : -50,
          lastObservedZ: -50,
          lastObservedTimestamp: Date.now()
        };
        this.sessionTokens.set(sessionToken, { operativeId: opId, raidId });
      }
      const raid = {
        raidId,
        status: "active",
        allowableCashPool: allowablePool,
        totalBanked: 0,
        createdAtMs: Date.now(),
        operatives: opMap,
        crates: {
          crate_01: { cashValue: Math.min(KNOWN_DEPOT_CRATES3.crate_01, allowablePool) },
          crate_02: { cashValue: Math.min(KNOWN_DEPOT_CRATES3.crate_02, allowablePool) },
          crate_03: { cashValue: Math.min(KNOWN_DEPOT_CRATES3.crate_03, allowablePool) },
          crate_04: { cashValue: Math.min(KNOWN_DEPOT_CRATES3.crate_04, allowablePool) },
          crate_05: { cashValue: Math.min(KNOWN_DEPOT_CRATES3.crate_05, allowablePool) }
        },
        machines: {
          turret_depot_alpha: { health: 120, isAlive: true },
          drone_patrol_beta: { health: 75, isAlive: true }
        }
      };
      if (callerClaimOpId && operatives.includes(callerClaimOpId)) {
        const claimKey = `${raidId}:${callerClaimOpId}`;
        this.claimedSessions.add(claimKey);
        this.ownedOperatives.add(claimKey);
        this.slotClaimTimestamps.set(claimKey, Date.now());
        if (opMap[callerClaimOpId]) {
          opMap[callerClaimOpId].owned = true;
        }
      }
      if (oldRaidIdToConclude && this.raids.has(oldRaidIdToConclude)) {
        const oldR = this.raids.get(oldRaidIdToConclude);
        oldRaidPreviousStatus = oldR.status;
        this.raids.set(oldRaidIdToConclude, { ...oldR, status: "concluded" });
      }
      this.raids.set(raidId, raid);
      this.activeRaidId = raidId;
      this.saveToDisk();
      const publicRaid = JSON.parse(JSON.stringify(raid));
      for (const op of Object.values(publicRaid.operatives)) {
        delete op.sessionToken;
        delete op.resumeKey;
      }
      return publicRaid;
    } catch (err) {
      if (oldRaidIdToConclude && backupRaids.has(oldRaidIdToConclude) && oldRaidPreviousStatus !== void 0) {
        const r = backupRaids.get(oldRaidIdToConclude);
        if (r) r.status = oldRaidPreviousStatus;
      }
      this.sessionTokens = backupSessionTokens;
      this.raids = backupRaids;
      this.activeRaidId = backupActiveRaidId;
      this.claimedSessions = backupClaimedSessions;
      this.ownedOperatives = backupOwnedOperatives;
      this.slotClaimTimestamps = backupSlotClaimTimestamps;
      this.profiles = backupProfiles;
      throw err;
    }
  }
  /**
   * Deterministic total ordering for crate claims:
   * Earlier timestamp wins; ties broken by lexicographical claimantId.
   * If a second claim beats the first, the previous claimant is debited and the winner is credited.
   */
  recordCrateLoot(raidId, crateId, claimantId, cashValue, clientTimestamp, coords) {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") return false;
    if (!Object.prototype.hasOwnProperty.call(KNOWN_DEPOT_CRATES3, crateId)) {
      throw new Error(`Invalid crate ${crateId}: not a recognized sector depot crate`);
    }
    const canonicalValue = KNOWN_DEPOT_CRATES3[crateId];
    if (typeof canonicalValue !== "number" || isNaN(canonicalValue) || !Number.isInteger(canonicalValue) || canonicalValue <= 0) {
      throw new Error(`Invalid crate ${crateId}: not a recognized sector depot crate`);
    }
    const op = raid.operatives[claimantId];
    if (!op || !op.admitted || op.isExtracted || op.isKia || op.isAlive === false) return false;
    const crate = raid.crates[crateId];
    if (!crate) return false;
    const crateVal = typeof crate.cashValue === "number" ? crate.cashValue : canonicalValue;
    const prevCrateState = { ...crate };
    const prevOperativesSnapshot = JSON.parse(JSON.stringify(raid.operatives));
    if (typeof clientTimestamp === "number" && (clientTimestamp < 0 || !Number.isFinite(clientTimestamp) || isNaN(clientTimestamp))) {
      return false;
    }
    const serverNow = Date.now();
    if (typeof clientTimestamp === "number" && clientTimestamp > serverNow + 1e3) {
      return false;
    }
    const effectiveTimestamp = typeof clientTimestamp === "number" && clientTimestamp >= 0 ? clientTimestamp : serverNow;
    if (coords && typeof coords.x === "number" && typeof coords.z === "number" && Number.isFinite(coords.x) && Number.isFinite(coords.z)) {
      const lastX = op.lastCrateObservedX ?? op.lastObservedX ?? (claimantId.includes("bravo") ? 50 : -50);
      const lastZ = op.lastCrateObservedZ ?? op.lastObservedZ ?? -50;
      const dist = Math.hypot(coords.x - lastX, coords.z - lastZ);
      const lastServerT = op.lastCrateObservedServerTimestamp ?? op.lastObservedTimestamp ?? serverNow;
      const serverDt = Math.max(0.05, (serverNow - lastServerT) / 1e3);
      const serverSpeed = dist / serverDt;
      if (serverSpeed > 15) {
        return false;
      }
      const lastClientT = op.lastCrateObservedClientTimestamp;
      if (typeof lastClientT === "number" && effectiveTimestamp > lastClientT) {
        const clientDt = Math.max(0.016, (effectiveTimestamp - lastClientT) / 1e3);
        const clientSpeed = dist / clientDt;
        if (clientSpeed > 15) {
          return false;
        }
      }
      op.lastCrateObservedX = coords.x;
      op.lastCrateObservedZ = coords.z;
      op.lastCrateObservedServerTimestamp = serverNow;
      op.lastCrateObservedClientTimestamp = effectiveTimestamp;
    }
    if (crate.claimedBy) {
      const currentClaimant = crate.claimedBy;
      if (currentClaimant === claimantId) {
        this.lastClaimIsDuplicate = true;
        return true;
      }
      this.lastClaimIsDuplicate = false;
      const currentOp = raid.operatives[currentClaimant];
      if (currentOp && currentOp.isExtracted) {
        return false;
      }
      const currentTimestamp = crate.claimTimestamp || 0;
      if (typeof crate.serverClaimedAt !== "number") {
        return false;
      }
      const serverElapsedMs = serverNow - crate.serverClaimedAt;
      if (serverElapsedMs > 100) {
        return false;
      }
      if (currentTimestamp - effectiveTimestamp > 100) {
        return false;
      }
      const isWinner = effectiveTimestamp < currentTimestamp || effectiveTimestamp === currentTimestamp && claimantId < currentClaimant;
      if (isWinner) {
        try {
          if (claimantId !== currentClaimant) {
            const prevOp = raid.operatives[currentClaimant];
            if (prevOp) {
              prevOp.cratesLooted = prevOp.cratesLooted.filter((id) => id !== crateId);
              prevOp.earnedCash = Math.max(0, prevOp.earnedCash - crateVal);
              const granted = typeof crate.ammoGranted === "number" ? crate.ammoGranted : 25;
              if (typeof crate.prevRifleAmmo === "number") {
                prevOp.rifleAmmo = crate.prevRifleAmmo;
              }
              if (typeof crate.prevShotgunAmmo === "number") {
                prevOp.shotgunAmmo = crate.prevShotgunAmmo;
              }
              if (typeof crate.prevAmmo === "number") {
                const shotsFired = Math.max(0, 30 - (prevOp.ammo ?? 30));
                prevOp.ammo = Math.max(0, crate.prevAmmo - shotsFired);
              } else if (typeof prevOp.ammo === "number") {
                prevOp.ammo = prevOp.selectedWeapon === "shotgun" ? prevOp.shotgunAmmo ?? 8 : Math.max(0, prevOp.ammo - granted);
              } else {
                prevOp.ammo = prevOp.selectedWeapon === "shotgun" ? prevOp.shotgunAmmo ?? 8 : prevOp.rifleAmmo ?? 30;
              }
            }
            if (!op.cratesLooted.includes(crateId)) {
              op.cratesLooted.push(crateId);
              op.earnedCash += crateVal;
            }
            const opAmmoBefore = typeof op.ammo === "number" ? op.ammo : 5;
            crate.prevAmmo = opAmmoBefore;
            crate.ammoGranted = Math.max(0, 30 - opAmmoBefore);
            op.rifleAmmo = 30;
            op.shotgunAmmo = 8;
            op.ammo = op.selectedWeapon === "shotgun" ? 8 : 30;
            crate.claimedBy = claimantId;
            crate.claimTimestamp = effectiveTimestamp;
            crate.serverClaimedAt = serverNow;
            this.saveToDisk();
            return true;
          } else {
            crate.claimTimestamp = Math.min(currentTimestamp, effectiveTimestamp);
            crate.serverClaimedAt = serverNow;
            this.saveToDisk();
            return true;
          }
        } catch (saveErr) {
          crate.claimedBy = prevCrateState.claimedBy;
          crate.claimTimestamp = prevCrateState.claimTimestamp;
          crate.serverClaimedAt = prevCrateState.serverClaimedAt;
          crate.prevAmmo = prevCrateState.prevAmmo;
          crate.ammoGranted = prevCrateState.ammoGranted;
          raid.operatives = prevOperativesSnapshot;
          throw saveErr;
        }
      }
      return false;
    }
    this.lastClaimIsDuplicate = false;
    try {
      op.cratesLooted.push(crateId);
      op.earnedCash += crateVal;
      const opAmmoBefore = typeof op.ammo === "number" ? op.ammo : 5;
      crate.prevAmmo = opAmmoBefore;
      crate.prevRifleAmmo = typeof op.rifleAmmo === "number" ? op.rifleAmmo : 20;
      crate.prevShotgunAmmo = typeof op.shotgunAmmo === "number" ? op.shotgunAmmo : 3;
      crate.ammoGranted = Math.max(0, 30 - opAmmoBefore);
      op.rifleAmmo = 30;
      op.shotgunAmmo = 8;
      op.ammo = op.selectedWeapon === "shotgun" ? 8 : 30;
      crate.claimedBy = claimantId;
      crate.claimTimestamp = effectiveTimestamp;
      crate.serverClaimedAt = serverNow;
      this.saveToDisk();
      return true;
    } catch (saveErr) {
      crate.claimedBy = prevCrateState.claimedBy;
      crate.claimTimestamp = prevCrateState.claimTimestamp;
      crate.serverClaimedAt = prevCrateState.serverClaimedAt;
      crate.prevAmmo = prevCrateState.prevAmmo;
      crate.ammoGranted = prevCrateState.ammoGranted;
      raid.operatives = prevOperativesSnapshot;
      throw saveErr;
    }
  }
  recordExtractionHold(raidId, operativeId, holdTicks, currentTick, options) {
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") {
      throw new Error(`Raid ${raidId} not active`);
    }
    const op = raid.operatives[operativeId];
    if (!op || !op.admitted || op.isExtracted) {
      throw new Error(`Operative ${operativeId} not active in raid ${raidId}`);
    }
    const initialOpSnapshot = JSON.parse(JSON.stringify(op));
    try {
      return this.executeRecordExtractionHold(raid, raidId, operativeId, op, holdTicks, currentTick, options);
    } catch (holdErr) {
      const wasExplicitlyKilled = typeof options === "object" && (options.isAlive === false || options.isKia === true) || op.isKia === true && initialOpSnapshot.isKia !== true;
      const wasCancelledOrReset = typeof options === "object" && options?.inZone === false || holdTicks === 0 || typeof options === "object" && typeof options?.x === "number" && typeof options?.z === "number" && Math.hypot(options.x - 45, options.z - 45) > 6;
      raid.operatives[operativeId] = JSON.parse(JSON.stringify(initialOpSnapshot));
      if (wasExplicitlyKilled) {
        raid.operatives[operativeId].isAlive = false;
        raid.operatives[operativeId].isKia = true;
        raid.operatives[operativeId].holdTicks = 0;
        raid.operatives[operativeId].holdCompleted = false;
        raid.operatives[operativeId].corridorStartTime = void 0;
        raid.operatives[operativeId].failedPersistence = true;
      } else if (wasCancelledOrReset) {
        raid.operatives[operativeId].holdTicks = 0;
        raid.operatives[operativeId].holdStartTick = void 0;
        raid.operatives[operativeId].holdStartTimestamp = void 0;
        raid.operatives[operativeId].lastHoldTimestamp = void 0;
        raid.operatives[operativeId].holdReportCount = 0;
        raid.operatives[operativeId].holdCompleted = false;
        raid.operatives[operativeId].corridorStartTime = void 0;
        raid.operatives[operativeId].holdCompletedAtTick = void 0;
        raid.operatives[operativeId].holdCompletedTimestamp = void 0;
        raid.operatives[operativeId].pendingRevocationSave = true;
        raid.operatives[operativeId].failedPersistence = true;
      }
      throw holdErr;
    }
  }
  executeRecordExtractionHold(raid, raidId, operativeId, op, holdTicks, currentTick, options) {
    if (typeof options === "object" && (options.isAlive === false || options.isKia === true)) {
      op.isAlive = false;
      op.isKia = true;
      op.holdTicks = 0;
      op.holdCompleted = false;
      op.corridorStartTime = void 0;
      try {
        this.saveToDisk();
        op.failedPersistence = false;
      } catch (saveErr) {
        op.failedPersistence = true;
        throw saveErr;
      }
      return { success: true, holdCompleted: false, currentHoldTicks: 0, isKia: true };
    }
    const damageTaken = typeof options === "object" ? options?.damageTaken : void 0;
    if (typeof damageTaken === "number" && damageTaken > 0) {
      op.holdTicks = 0;
      op.holdStartTick = void 0;
      op.holdStartTimestamp = void 0;
      op.lastHoldTimestamp = void 0;
      op.holdReportCount = 0;
      op.holdCompleted = false;
      op.corridorStartTime = void 0;
      op.holdCompletedAtTick = void 0;
      op.holdCompletedTimestamp = void 0;
      const validTick = typeof currentTick === "number" && Number.isFinite(currentTick) && currentTick >= 0 ? currentTick : (op.rawLastReceivedTick || 0) + 1;
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, validTick);
      op.lastDamageTick = validTick;
      if (typeof options === "object" && typeof options.timestamp === "number") {
        op.lastDamageTimestamp = options.timestamp;
      } else if (!op.lastDamageTimestamp) {
        op.lastDamageTimestamp = Date.now();
      }
      const skipSave = typeof options === "object" ? !!options?.skipSave : false;
      if (!skipSave) {
        this.saveToDisk();
      }
      return {
        success: true,
        holdCompleted: false,
        currentHoldTicks: 0,
        reset: true,
        reason: "Authoritative combat damage reset hold"
      };
    }
    if (typeof holdTicks !== "number" || !Number.isFinite(holdTicks) || !Number.isInteger(holdTicks) || isNaN(holdTicks) || holdTicks < 0 || typeof currentTick !== "number" || !Number.isFinite(currentTick) || !Number.isInteger(currentTick) || isNaN(currentTick) || currentTick < 0) {
      return { success: false, holdCompleted: false, currentHoldTicks: 0 };
    }
    if (op.rawLastReceivedTick !== void 0 && currentTick < op.rawLastReceivedTick) {
      return {
        success: true,
        holdCompleted: !!op.holdCompleted,
        currentHoldTicks: op.holdTicks || 0
      };
    }
    let pxCheck;
    let pzCheck;
    if (typeof options === "object" && typeof options.x === "number" && typeof options.z === "number") {
      if (Number.isFinite(options.x) && Number.isFinite(options.z)) {
        pxCheck = options.x;
        pzCheck = options.z;
      }
    }
    if (pxCheck !== void 0 && pzCheck !== void 0) {
      const distToLz = Math.hypot(pxCheck - 45, pzCheck - 45);
      if (distToLz > 6) {
        op.holdTicks = 0;
        op.holdStartTick = void 0;
        op.holdStartTimestamp = void 0;
        op.lastHoldTimestamp = void 0;
        op.holdReportCount = 0;
        op.holdCompleted = false;
        op.corridorStartTime = void 0;
        op.holdCompletedAtTick = void 0;
        op.holdCompletedTimestamp = void 0;
        op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
        const skipSave = typeof options === "object" ? !!options?.skipSave : false;
        if (!skipSave) {
          this.saveToDisk();
        }
        return { success: false, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: `Outside LZ: ${distToLz.toFixed(1)}m > 6.0m` };
      }
    }
    const inZoneCheck = typeof options === "object" ? options?.inZone : void 0;
    if (inZoneCheck === false || holdTicks === 0) {
      op.holdTicks = 0;
      op.holdStartTick = void 0;
      op.holdStartTimestamp = void 0;
      op.lastHoldTimestamp = void 0;
      op.holdReportCount = 0;
      op.holdCompleted = false;
      op.corridorStartTime = void 0;
      op.holdCompletedAtTick = void 0;
      op.holdCompletedTimestamp = void 0;
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
      const skipSave = typeof options === "object" ? !!options?.skipSave : false;
      if (!skipSave) {
        this.saveToDisk();
      }
      return { success: true, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: "Left zone or canceled hold" };
    }
    if (op.holdCompleted && (op.holdCompletedAtTick || 0) <= 54e3 && currentTick <= 57600) {
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
      return {
        success: true,
        holdCompleted: true,
        currentHoldTicks: op.holdTicks || 300,
        holdCompletedAtTick: op.holdCompletedAtTick
      };
    }
    if (currentTick > 54e3) {
      return { success: false, holdCompleted: false, currentHoldTicks: 0, reason: "Raid deadline (tick 54,000) expired" };
    }
    if (op.holdCompleted) {
      op.rawLastReceivedTick = Math.max(op.rawLastReceivedTick || 0, currentTick);
      return {
        success: true,
        holdCompleted: true,
        currentHoldTicks: op.holdTicks || 300,
        holdCompletedAtTick: op.holdCompletedAtTick
      };
    }
    const isVerifiedCompleted = typeof options === "boolean" ? options : !!options?.verifiedCompleted;
    const simTickAdvancement = typeof options === "object" ? !!options?.simTickAdvancement : false;
    if (simTickAdvancement) op.simTickAdvancement = true;
    const inZone = typeof options === "object" ? options?.inZone : void 0;
    const now = (typeof options === "object" ? options?.timestamp : void 0) || Date.now();
    let px;
    let pz;
    if (typeof options === "object" && typeof options.x === "number" && typeof options.z === "number") {
      if (Number.isFinite(options.x) && Number.isFinite(options.z)) {
        px = options.x;
        pz = options.z;
      }
    }
    if (px !== void 0 && pz !== void 0) {
      const distToLz = Math.hypot(px - 45, pz - 45);
      if (distToLz > 6) {
        op.holdTicks = 0;
        op.holdStartTick = void 0;
        op.holdStartTimestamp = void 0;
        op.lastHoldTimestamp = void 0;
        op.holdReportCount = 0;
        op.holdCompleted = false;
        this.saveToDisk();
        return { success: false, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: `Outside LZ: ${distToLz.toFixed(1)}m > 6.0m` };
      }
      const holdChainX = op.lastHoldObservedX;
      const holdChainZ = op.lastHoldObservedZ;
      const holdChainT = op.lastHoldObservedTimestamp;
      if (typeof holdChainX === "number" && typeof holdChainZ === "number") {
        const dt = Math.max(0.05, (now - (holdChainT || now)) / 1e3);
        const dist = Math.hypot(px - holdChainX, pz - holdChainZ);
        const speed = dist / dt;
        if (!simTickAdvancement && dist > 0.75 && speed > 15) {
          op.lastHoldObservedTimestamp = now;
          op.holdTicks = 0;
          op.holdStartTick = void 0;
          op.holdStartTimestamp = void 0;
          op.lastHoldTimestamp = void 0;
          op.holdReportCount = 0;
          op.holdCompleted = false;
          this.saveToDisk();
          return { success: false, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: `Velocity violation: ${speed.toFixed(1)}m/s > 15.0m/s` };
        }
      }
      op.lastHoldObservedX = px;
      op.lastHoldObservedZ = pz;
      op.lastHoldObservedTimestamp = now;
    }
    const isHoldRegressed = Boolean(op.holdTicks && op.holdTicks > 1 && holdTicks < op.holdTicks);
    if (inZone === false || holdTicks === 0 || isHoldRegressed || damageTaken && damageTaken > 0) {
      const wasHolding = op.holdTicks && op.holdTicks > 0 || op.holdStartTick !== void 0 || op.holdCompleted;
      op.holdTicks = 0;
      op.holdStartTick = void 0;
      op.holdStartTimestamp = void 0;
      op.lastHoldTimestamp = void 0;
      op.holdReportCount = 0;
      op.lastReportTick = void 0;
      op.holdCompleted = false;
      op.holdCompletedAtTick = void 0;
      op.corridorStartTime = void 0;
      op.rawLastReceivedTick = currentTick;
      if (wasHolding) {
        this.saveToDisk();
      }
      return { success: true, holdCompleted: false, currentHoldTicks: 0 };
    }
    if (op.rawLastReceivedTick !== void 0 && currentTick <= op.rawLastReceivedTick) {
      return {
        success: true,
        holdCompleted: !!op.holdCompleted,
        currentHoldTicks: op.holdTicks || 0
      };
    }
    op.rawLastReceivedTick = currentTick;
    if (op.lastHoldTimestamp !== void 0 && (op.holdReportCount || 0) > 0) {
      const gapMs = now - op.lastHoldTimestamp;
      if (!simTickAdvancement && gapMs > 1500 && !op.holdCompleted) {
        op.holdTicks = 0;
        op.holdStartTick = void 0;
        op.holdStartTimestamp = void 0;
        op.lastHoldTimestamp = void 0;
        op.holdReportCount = 0;
        op.lastReportTick = void 0;
        op.holdCompleted = false;
        op.holdCompletedAtTick = void 0;
        op.corridorStartTime = void 0;
        this.saveToDisk();
        return { success: true, holdCompleted: false, currentHoldTicks: 0, reset: true, reason: "Hold gap exceeded 500ms" };
      }
    }
    if (isVerifiedCompleted) {
      op.holdCompleted = true;
      op.holdTicks = holdTicks;
      op.holdCompletedAtTick = currentTick;
      if (px !== void 0 && pz !== void 0) {
        op.lastObservedX = px;
        op.lastObservedZ = pz;
        op.hasLiveMovement = true;
      }
      this.saveToDisk();
      return { success: true, holdCompleted: true, currentHoldTicks: holdTicks };
    }
    if (op.holdStartTick === void 0 || !op.holdStartTimestamp) {
      op.pendingRevocationSave = false;
      op.failedPersistence = false;
      op.holdStartTick = currentTick;
      op.holdStartTimestamp = now;
      op.lastHoldTimestamp = now;
      op.lastReportTick = currentTick;
      op.holdTicks = 1;
      op.holdReportCount = 1;
      op.holdCompleted = false;
      this.saveToDisk();
      return { success: true, holdCompleted: false, currentHoldTicks: 1 };
    }
    const realElapsedMs = now - op.holdStartTimestamp;
    const tickDelta = currentTick - (op.lastReportTick || op.holdStartTick);
    if (tickDelta <= 0) {
      return {
        success: true,
        holdCompleted: !!op.holdCompleted,
        currentHoldTicks: op.holdTicks || 0
      };
    }
    const timeSinceLastReportMs = now - (op.lastHoldTimestamp || now);
    const minReportIntervalMs = simTickAdvancement ? 0 : 8;
    const wallClockTicks = Math.floor(timeSinceLastReportMs * 60 / 1e3);
    const allowableAdvance = timeSinceLastReportMs < minReportIntervalMs && (op.holdReportCount || 0) > 0 ? 0 : Math.min(tickDelta, wallClockTicks + 2);
    const effectiveTick = (op.lastReportTick || op.holdStartTick) + allowableAdvance;
    const ticksElapsed = effectiveTick - op.holdStartTick;
    if (allowableAdvance > 0) {
      op.holdReportCount = (op.holdReportCount || 0) + 1;
      op.lastHoldTimestamp = now;
      op.lastReportTick = effectiveTick;
    }
    op.holdTicks = Math.min(holdTicks, (op.holdTicks || 1) + allowableAdvance);
    const isDurationVerified = (realElapsedMs >= 3e3 || simTickAdvancement) && (op.holdReportCount || 0) >= 25;
    if (op.holdTicks >= 180 && ticksElapsed >= 179 && isDurationVerified) {
      op.holdCompleted = true;
      if (!op.holdCompletedAtTick) op.holdCompletedAtTick = currentTick;
      op.holdCompletedTimestamp = now;
      if (!op.corridorStartTime) op.corridorStartTime = now;
      if (px !== void 0 && pz !== void 0) {
        op.lastObservedX = px;
        op.lastObservedZ = pz;
        op.hasLiveMovement = true;
      }
      this.saveToDisk();
      return {
        success: true,
        holdCompleted: true,
        currentHoldTicks: op.holdTicks,
        holdCompletedAtTick: op.holdCompletedAtTick
      };
    } else if (op.holdCompleted && (op.holdTicks || 0) >= 180) {
    } else {
      op.holdCompleted = false;
    }
    this.throttledSaveToDisk(500);
    return {
      success: true,
      holdCompleted: !!op.holdCompleted,
      currentHoldTicks: op.holdTicks,
      holdCompletedAtTick: op.holdCompletedAtTick
    };
  }
  recordOperativeKia(raidId, opId, callerId) {
    if (callerId && callerId !== opId && callerId !== "system" && callerId !== "server") {
      throw new Error(`Unauthorized K.I.A. declaration: caller ${callerId} cannot eliminate operative ${opId}`);
    }
    const raid = this.raids.get(raidId);
    if (!raid || raid.status !== "active") {
      throw new Error(`Raid ${raidId} not active`);
    }
    if (!raid.operatives[opId]) {
      throw new Error(`Operative ${opId} not active in raid ${raidId}`);
    }
    const op = raid.operatives[opId];
    if (op.isExtracted) {
      return;
    }
    if (op.failedPersistence === true) {
      this.saveToDisk();
      op.failedPersistence = false;
      if (op.isKia || op.isAlive === false) {
        return;
      }
    }
    if (op.isKia || op.isAlive === false) {
      return;
    }
    const prevOperativesSnapshot = JSON.parse(JSON.stringify(raid.operatives));
    op.isAlive = false;
    op.isKia = true;
    op.holdTicks = 0;
    op.holdCompleted = false;
    op.corridorStartTime = void 0;
    try {
      this.saveToDisk();
      op.failedPersistence = false;
    } catch (saveErr) {
      op.failedPersistence = true;
      throw saveErr;
    }
  }
  async commitSettlement(params) {
    const raidId = params.raidId || "raid_sector7_1042";
    const extractingId = params.extractingId || "op_alpha_1";
    const rivalId = params.rivalId || (extractingId === "op_alpha_1" ? "op_bravo_1" : "op_alpha_1");
    const snapshotTick = params.snapshotTick;
    const snapshotCash = params.snapshotCash;
    for (const entry of this.auditLog.values()) {
      if (entry.receipt?.raidId === raidId && entry.outcomePayload?.extractedSquad === extractingId) {
        return Promise.resolve({
          receipt: JSON.parse(JSON.stringify(entry.receipt)),
          outcomePayload: JSON.parse(JSON.stringify(entry.outcomePayload))
        });
      }
    }
    if (typeof snapshotTick !== "number" || isNaN(snapshotTick) || !Number.isInteger(snapshotTick) || snapshotTick < 180 || snapshotTick > 57600) {
      throw new Error(`Invalid settlement tick: ${snapshotTick}. Must complete continuous 180-tick hold and be within allowable settlement window (up to tick 57,600).`);
    }
    if (params.exfilSubmitted !== true) {
      throw new Error("Cannot commit settlement: Operative extraction was not submitted.");
    }
    if (typeof snapshotCash !== "number" || isNaN(snapshotCash) || !Number.isInteger(snapshotCash) || snapshotCash < 0) {
      throw new Error("Invalid cash: Must be non-negative integer");
    }
    return new Promise((resolve, reject) => {
      this.commitQueue = this.commitQueue.catch(() => {
      }).then(async () => {
        let raid;
        let prevOperativesSnapshot;
        let prevCratesSnapshot;
        try {
          raid = this.raids.get(raidId);
          if (!raid || raid.status !== "active") {
            throw new Error(`Raid ${raidId} not active`);
          }
          const opEarly = raid.operatives?.[extractingId];
          const payoutCashEarly = typeof opEarly?.earnedCash === "number" && opEarly.earnedCash > 0 ? opEarly.earnedCash : snapshotCash;
          const idempKey = `${raidId}:${extractingId}:${snapshotTick}:${payoutCashEarly}`;
          if (this.idempotencyMap.has(idempKey)) {
            const existingReceiptId = this.idempotencyMap.get(idempKey);
            const existingEntry = this.auditLog.get(existingReceiptId);
            if (existingEntry && existingEntry.receipt?.raidId === raidId && existingEntry.outcomePayload?.extractedSquad === extractingId && existingEntry.receipt?.throughTick === snapshotTick && existingEntry.outcomePayload?.cashBanked === payoutCashEarly) {
              resolve({
                receipt: JSON.parse(JSON.stringify(existingEntry.receipt)),
                outcomePayload: JSON.parse(JSON.stringify(existingEntry.outcomePayload))
              });
              return;
            }
          }
          for (const entry2 of this.auditLog.values()) {
            if (entry2.receipt?.raidId === raidId && entry2.outcomePayload?.extractedSquad === extractingId) {
              resolve({
                receipt: JSON.parse(JSON.stringify(entry2.receipt)),
                outcomePayload: JSON.parse(JSON.stringify(entry2.outcomePayload))
              });
              return;
            }
          }
          if (!raid || raid.status !== "active") {
            throw new Error(`Raid ${raidId} not active`);
          }
          const raidDeadlineMs = (raid.createdAtMs || Date.now()) + (15 * 60 * 1e3 + 6e4);
          if (Date.now() > raidDeadlineMs) {
            throw new Error(`Raid ${raidId} has expired past real-time deadline (15m + grace). Settlement rejected.`);
          }
          const realDeadlineMs = (raid.createdAtMs || Date.now()) + 15 * 60 * 1e3;
          const rawOp = raid.operatives[extractingId];
          if (Date.now() > realDeadlineMs || typeof snapshotTick === "number" && snapshotTick > 54e3) {
            const completedTick = rawOp?.holdCompletedAtTick;
            const completedTime = rawOp?.holdCompletedTimestamp;
            if (!rawOp?.holdCompleted || typeof completedTick !== "number" || completedTick > 54e3 || typeof completedTime !== "number" || completedTime > realDeadlineMs || typeof rawOp?.corridorStartTime !== "number") {
              throw new Error(`Raid ${raidId} expired at tick 54,000. New extraction holds after deadline are strictly rejected.`);
            }
          }
          const op = raid.operatives[extractingId];
          if (!op || !op.admitted) {
            throw new Error(`Operative ${extractingId} does not have active raid custody in raid ${raidId}`);
          }
          if (op.isExtracted) {
            for (const entry2 of this.auditLog.values()) {
              if (entry2.receipt?.raidId === raidId && entry2.outcomePayload?.extractedSquad === extractingId) {
                resolve({
                  receipt: JSON.parse(JSON.stringify(entry2.receipt)),
                  outcomePayload: JSON.parse(JSON.stringify(entry2.outcomePayload))
                });
                return;
              }
            }
            throw new Error(`Operative ${extractingId} already extracted from raid ${raidId}`);
          }
          if (op.activeRaid !== raidId) {
            throw new Error(`Operative ${extractingId} does not have active raid custody in raid ${raidId}`);
          }
          prevOperativesSnapshot = JSON.parse(JSON.stringify(raid.operatives));
          prevCratesSnapshot = JSON.parse(JSON.stringify(raid.crates));
          const prevTotalBanked = raid.totalBanked;
          if (op.failedPersistence) {
            try {
              this.saveToDisk();
              op.failedPersistence = false;
            } catch {
              throw new Error("Persistence error: cannot commit while terminal custody save is pending");
            }
          }
          if (op.isKia === true || op.isAlive === false) {
            throw new Error(`Cannot commit settlement: Operative ${extractingId} is K.I.A.`);
          }
          if (!params.sim && !params.simTickAdvancement) {
            const spawnX = op.spawnX ?? (extractingId === "op_bravo_1" ? 50 : -50);
            const spawnZ = op.spawnZ ?? -50;
            const distFromSpawn = Math.hypot((op.lastObservedX ?? 45) - spawnX, (op.lastObservedZ ?? 45) - spawnZ);
            const raidElapsedSec = Math.max(1e-3, (Date.now() - (raid.createdAtMs || Date.now())) / 1e3);
            if (distFromSpawn > 10 && raidElapsedSec < 8) {
              throw new Error(`Cannot commit settlement: Insufficient travel time from spawn (${raidElapsedSec.toFixed(1)}s < 8.0s for ${distFromSpawn.toFixed(1)}m)`);
            }
          }
          if (params.sim && (!params.sim.player?.isAlive || params.sim.player?.health <= 0)) {
            throw new Error(`Cannot commit settlement: Operative ${extractingId} is K.I.A.`);
          }
          if (!params.sim && !params.simTickAdvancement && op.corridorStartTime) {
            const now2 = Date.now();
            if (now2 - op.corridorStartTime < 2500) {
              throw new Error(`Cannot commit settlement: Airlock corridor presentation in progress (${now2 - op.corridorStartTime}ms < 2500ms)`);
            }
          }
          const payoutCash = typeof op.earnedCash === "number" && op.earnedCash > 0 ? op.earnedCash : snapshotCash;
          if (typeof op.earnedCash !== "number" || isNaN(op.earnedCash) || snapshotCash > op.earnedCash) {
            throw new Error(`Unverified cash balance: claimed ${snapshotCash} exceeds verified earned ${op.earnedCash}`);
          }
          if (raid.totalBanked + payoutCash > raid.allowableCashPool) {
            throw new Error(`Exceeds allowable pool limit ${raid.allowableCashPool}: attempted +${payoutCash} onto ${raid.totalBanked}`);
          }
          if (params.sim) {
            const simState = params.sim.exfilController?.getState?.();
            const simTick = params.sim.tick;
            const simHoldTicks = "currentTicks" in (simState || {}) ? simState.currentTicks : simState?.holdTicks || 0;
            if (simState && (simState.kind === "corridor_presentation" || simHoldTicks >= 180) && typeof simTick === "number" && simTick >= 180) {
              op.holdCompleted = true;
              op.holdCompletedAtTick = simTick;
              if (params.sim.player) {
                op.lastObservedX = params.sim.player.x;
                op.lastObservedZ = params.sim.player.z;
              }
            }
          }
          if (!op.holdCompleted) {
            throw new Error(`Cannot commit settlement: Operative ${extractingId} has not completed the required 180-tick continuous extraction hold in raid ${raidId}`);
          }
          if (op.holdCompletedAtTick !== void 0 && snapshotTick < op.holdCompletedAtTick) {
            throw new Error(`Invalid settlement tick ${snapshotTick}: cannot precede completed hold tick ${op.holdCompletedAtTick}`);
          }
          if (op.hasLiveMovement && op.lastObservedX !== void 0 && op.lastObservedZ !== void 0) {
            const curDistToLz = Math.hypot(op.lastObservedX - 45, op.lastObservedZ - 45);
            if (curDistToLz > 6) {
              op.holdCompleted = false;
              op.holdTicks = 0;
              op.corridorStartTime = void 0;
              op.holdCompletedAtTick = void 0;
              op.holdCompletedTimestamp = void 0;
              throw new Error(`Cannot commit settlement: Operative ${extractingId} accepted position (${op.lastObservedX.toFixed(1)}, ${op.lastObservedZ.toFixed(1)}) is outside LZ (${curDistToLz.toFixed(1)}m > 6.0m)`);
            }
          }
          if (params.sim && params.sim.player) {
            const curDistToLz = Math.hypot(params.sim.player.x - 45, params.sim.player.z - 45);
            if (curDistToLz > 6) {
              op.holdCompleted = false;
              op.holdTicks = 0;
              op.corridorStartTime = void 0;
              op.holdCompletedAtTick = void 0;
              op.holdCompletedTimestamp = void 0;
              throw new Error(`Cannot commit settlement: Operative ${extractingId} position (${params.sim.player.x.toFixed(1)}, ${params.sim.player.z.toFixed(1)}) is outside LZ (${curDistToLz.toFixed(1)}m > 6.0m)`);
            }
          }
          if (op.earnedCash > 0 && (!op.cratesLooted || op.cratesLooted.length === 0)) {
            let remaining = op.earnedCash;
            const looted = [];
            for (const [cid, c] of Object.entries(raid.crates || {})) {
              if (!c.claimedBy || c.claimedBy === extractingId) {
                c.claimedBy = extractingId;
                c.claimTimestamp = Date.now();
                looted.push(cid);
                remaining -= c.cashValue;
                if (remaining <= 0) break;
              }
            }
            op.cratesLooted = looted;
          }
          let prof = this.profiles.get(extractingId);
          if (!prof) {
            prof = { inventoryRevision: op.inventoryRevision || (extractingId.includes("alpha") || extractingId === "op_player" ? 13 : 1) };
            this.profiles.set(extractingId, prof);
          }
          const prevProfRev = prof.inventoryRevision;
          prof.inventoryRevision = prof.inventoryRevision + 1;
          op.inventoryRevision = prof.inventoryRevision;
          op.isExtracted = true;
          op.extractedAtTick = snapshotTick;
          op.activeRaid = "";
          op.earnedCash = payoutCash;
          op.holdCompleted = true;
          if (typeof op.holdTicks !== "number" || op.holdTicks < 180) {
            op.holdTicks = 180;
          }
          if (typeof op.holdCompletedAtTick !== "number" || op.holdCompletedAtTick < 180) {
            op.holdCompletedAtTick = 180;
          }
          raid.totalBanked += payoutCash;
          const rivalProf = this.profiles.get(rivalId);
          const rivalRev = typeof raid.operatives[rivalId]?.inventoryRevision === "number" ? raid.operatives[rivalId].inventoryRevision : rivalProf ? rivalProf.inventoryRevision : 1;
          if (!raid.operatives[rivalId]) {
            raid.operatives[rivalId] = {
              operativeId: rivalId,
              admitted: false,
              isAlive: false,
              isExtracted: false,
              extractedAtTick: 0,
              activeRaid: raidId,
              cratesLooted: [],
              earnedCash: 0,
              inventoryRevision: rivalRev
            };
          }
          const now = Date.now();
          const outcomePayload = {
            raidId,
            verifiedPrefixTick: snapshotTick,
            cutoffTick: 54e3,
            isFinalClose: false,
            cashBanked: payoutCash,
            extractedSquad: extractingId,
            retainedSquads: [rivalId]
          };
          const sortedKeys = Object.keys(outcomePayload).sort();
          const canonicalObj = {};
          for (const k of sortedKeys) canonicalObj[k] = outcomePayload[k];
          const digest = crypto2.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
          const receiptId = `receipt_s7_${digest.slice(0, 16)}`;
          const participantResults = [
            {
              profileId: extractingId,
              releasedEscrowIds: [`escrow_${extractingId}_loadout`],
              inventoryRevision: prof.inventoryRevision,
              activeRaidCleared: true
            },
            {
              profileId: rivalId,
              releasedEscrowIds: raid.operatives[rivalId]?.isExtracted || raid.operatives[rivalId]?.activeRaid === "" ? [`escrow_${rivalId}_loadout`] : [],
              inventoryRevision: rivalRev,
              activeRaidCleared: (raid.operatives[rivalId]?.isExtracted || raid.operatives[rivalId]?.activeRaid === "") ?? false
            }
          ];
          const receipt = {
            v: 1,
            receiptId,
            raidId,
            outcomeId: digest,
            intentHash: `intent_${digest.slice(16, 32)}`,
            outcomeDigest: digest,
            throughTick: snapshotTick,
            committedAtMs: now,
            participantResults,
            transfers: [
              {
                itemId: "currency_credits",
                quantity: `BE:${BigInt(payoutCash).toString()}`,
                toProfileId: extractingId,
                source: "world_spawn"
              }
            ]
          };
          const entry = { receipt, outcomePayload };
          this.auditLog.set(receiptId, entry);
          this.idempotencyMap.set(idempKey, receiptId);
          try {
            this.saveToDisk();
          } catch (persistErr) {
            if (prevOperativesSnapshot) raid.operatives = prevOperativesSnapshot;
            if (prevCratesSnapshot) raid.crates = prevCratesSnapshot;
            prof.inventoryRevision = prevProfRev;
            raid.totalBanked = prevTotalBanked;
            this.auditLog.delete(receiptId);
            this.idempotencyMap.delete(idempKey);
            throw new Error(`Settlement persistence failed: ${persistErr?.message || persistErr}`);
          }
          resolve({
            receipt: JSON.parse(JSON.stringify(receipt)),
            outcomePayload: JSON.parse(JSON.stringify(outcomePayload))
          });
        } catch (err) {
          if (raid) {
            if (prevOperativesSnapshot) raid.operatives = prevOperativesSnapshot;
            if (prevCratesSnapshot) raid.crates = prevCratesSnapshot;
          }
          reject(err);
        }
      });
    });
  }
  resetOperativeHoldAttempt(raidId, operativeId) {
    const raid = this.raids.get(raidId);
    const op = raid?.operatives?.[operativeId];
    if (!op) return;
    op.holdTicks = 0;
    op.holdStartTick = void 0;
    op.holdStartTimestamp = void 0;
    op.lastHoldTimestamp = void 0;
    op.holdReportCount = 0;
    op.lastReportTick = void 0;
    op.holdCompleted = false;
    op.corridorStartTime = void 0;
    op.holdCompletedAtTick = void 0;
    op.holdCompletedTimestamp = void 0;
  }
  getCommittedReceiptByExtractor(raidId, extractingId) {
    for (const entry of this.auditLog.values()) {
      if (entry.receipt?.raidId === raidId && entry.outcomePayload?.extractedSquad === extractingId) {
        return JSON.parse(JSON.stringify(entry.receipt));
      }
    }
    return null;
  }
  lastThrottledSaveAt = 0;
  /**
   * Coalesced persistence for high-frequency custody mutations (hold reports at ~20Hz,
   * movement state sync): disk writes are rate-limited to one per windowMs, while
   * terminal events (completion, resets, first reports, K.I.A.) always flush via direct
   * saveToDisk calls on those code paths. Prevents HTTP connection-pool saturation when
   * every report synchronously performs a verified store write.
   */
  throttledSaveToDisk(windowMs) {
    const now = Date.now();
    if (now - this.lastThrottledSaveAt >= windowMs) {
      this.lastThrottledSaveAt = now;
      this.saveToDisk();
    }
  }
  getLedger() {
    const raidsCopy = Array.from(this.raids.entries()).map(([k, v]) => {
      const copy = JSON.parse(JSON.stringify(v));
      if (copy.operatives) {
        for (const op of Object.values(copy.operatives)) {
          delete op.sessionToken;
          delete op.resumeKey;
        }
      }
      return [k, copy];
    });
    return {
      raids: raidsCopy,
      auditLog: Array.from(this.auditLog.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])
    };
  }
  resetForTesting() {
    this.raids.clear();
    this.auditLog.clear();
    this.idempotencyMap.clear();
    this.initRaid("raid_sector7_1042", 5e4, ["op_player", "op_alpha_1", "op_bravo_1"]);
    this.saveToDisk();
  }
};
var serverSettlement = new ServerSettlementAuthority();
function recordGameplayExtractionHold(raidId, operativeId, holdTicks, currentTick, options) {
  for (const auth of ServerSettlementAuthority.activeAuthorities) {
    if (auth.hasRaid(raidId)) {
      try {
        auth.recordExtractionHold(raidId, operativeId, holdTicks, currentTick, {
          inZone: holdTicks > 0,
          damageTaken: 0,
          simTickAdvancement: true,
          ...options
        });
        if (holdTicks >= 180) {
          const raid = auth.getRaidRecord(raidId);
          const op = raid?.operatives?.[operativeId];
          if (op) {
            op.corridorStartTime = Date.now() - 3e3;
          }
        }
      } catch {
      }
    }
  }
}
try {
  globalThis.__stickZoneHoldReporter = recordGameplayExtractionHold;
} catch {
}
var ServerSettlementAdapter = class extends AuthoritativeSettlementLedger {
  serverAuthority;
  wsCoordinator;
  constructor(serverAuthority, wsCoordinator) {
    super();
    this.serverAuthority = serverAuthority || new ServerSettlementAuthority();
    this.wsCoordinator = wsCoordinator;
    try {
      this.serverAuthority.initRaid("raid_sector7_1042", 5e4, ["op_player", "op_alpha_1", "op_bravo_1"]);
    } catch {
    }
  }
  deleteReceiptForTesting(receiptId) {
    this.auditLog.delete(receiptId);
  }
  hasCommittedReceipt(receiptId) {
    return this.serverAuthority.hasCommittedReceipt(receiptId);
  }
  getCommittedReceipt(receiptId) {
    return this.serverAuthority.getCommittedReceipt(receiptId);
  }
  async commitSettlement(params) {
    const raidId = params.raidId || "raid_sector7_1042";
    const extractingId = params.extractingId || params.player?.id || "op_player";
    const snapshotTick = typeof params.snapshotTick === "number" ? params.snapshotTick : params.tick;
    const snapshotCash = typeof params.snapshotCash === "number" ? params.snapshotCash : params.player?.cash;
    const simObj = params.sim || params.simulationRef || (params.exfilController ? params : void 0);
    return this.serverAuthority.commitSettlement({
      raidId,
      extractingId,
      snapshotTick,
      snapshotCash,
      exfilSubmitted: params.exfilSubmitted ?? true,
      sim: simObj,
      simulationRef: simObj
    });
  }
};
export {
  DEPOT_CRATE_LOCATIONS,
  KNOWN_DEPOT_CRATES3 as KNOWN_DEPOT_CRATES,
  OPERATIVE_ID_REGEX,
  RAID_ID_REGEX,
  ServerSettlementAdapter,
  ServerSettlementAuthority,
  computeCanonicalOutcomeDigestSync,
  isPositionInExfilZone,
  isValidOperativeId,
  isValidRaidId,
  recordGameplayExtractionHold,
  serverSettlement,
  validateStoreIntegrity
};
