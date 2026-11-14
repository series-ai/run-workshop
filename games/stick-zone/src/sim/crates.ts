/**
 * @file crates.ts
 * Single shared source of truth for Sector Depot tactical loot crates,
 * physical coordinates, cash values, and container inventory tables.
 */

export interface DepotCrateItem {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  icon: string;
  value: number;
  type: "valuable" | "ammo" | "med" | "keycard";
}

export interface DepotCrateConfig {
  id: string;
  x: number;
  z: number;
  cashValue: number;
  containerType: "dumpster" | "barrel" | "console" | "crate" | "corpse";
  containerTitle: string;
  items: DepotCrateItem[];
}

export const DEPOT_CRATE_CONFIGS: DepotCrateConfig[] = [
  {
    id: "crate_01",
    x: -8,
    z: -6,
    cashValue: 1250,
    containerType: "dumpster",
    containerTitle: "MILITARY DUMPSTER // WEST ALLEY",
    items: [
      { id: "item_gpu", name: "Encrypted GPU", rarity: "legendary", icon: "💾", value: 950, type: "valuable" },
      { id: "item_m855", name: "M855A1 AP Ammo Pack", rarity: "rare", icon: "📦", value: 300, type: "ammo" },
    ],
  },
  {
    id: "crate_02",
    x: 20,
    z: -15,
    cashValue: 2400,
    containerType: "barrel",
    containerTitle: "CHEMICAL & CONTRABAND BARREL",
    items: [
      { id: "item_bitcoin", name: "Physical Bitcoin", rarity: "legendary", icon: "🪙", value: 1800, type: "valuable" },
      { id: "item_stim", name: "Propital Combat Stim", rarity: "rare", icon: "💉", value: 600, type: "med" },
    ],
  },
  {
    id: "crate_03",
    x: -16,
    z: 14,
    cashValue: 3800,
    containerType: "console",
    containerTitle: "SECURE TECH STORAGE CONSOLE",
    items: [
      { id: "item_keycard", name: "Violet Lab Access Keycard", rarity: "legendary", icon: "💳", value: 3200, type: "keycard" },
      { id: "item_slugs", name: "12G Magnum Buckshot Box", rarity: "rare", icon: "📦", value: 600, type: "ammo" },
    ],
  },
  {
    id: "crate_04",
    x: 30,
    z: 22,
    cashValue: 2500,
    containerType: "crate",
    containerTitle: "TACTICAL SUPPLY FOOTLOCKER",
    items: [
      { id: "item_flashdrive", name: "Encrypted Flash Drive", rarity: "rare", icon: "💾", value: 1700, type: "valuable" },
      { id: "item_morphine", name: "Morphine Auto-Injector", rarity: "rare", icon: "💉", value: 800, type: "med" },
    ],
  },
  {
    id: "crate_05",
    x: -35,
    z: -25,
    cashValue: 3200,
    containerType: "corpse",
    containerTitle: "FALLEN PMC OPERATIVE",
    items: [
      { id: "item_folder", name: "Classified Intelligence Folder", rarity: "epic", icon: "📁", value: 2200, type: "valuable" },
      { id: "item_defib", name: "Portable Defibrillator", rarity: "epic", icon: "⚡", value: 1000, type: "med" },
    ],
  },
  {
    id: "crate_fob_training",
    x: 4.5,
    z: -63,
    cashValue: 600,
    containerType: "crate",
    containerTitle: "TRAINING SUPPLY LOCKER // FOB HUB",
    items: [
      { id: "item_training_m855", name: "Training AP Ammo (x60)", rarity: "common", icon: "📦", value: 350, type: "ammo" },
      { id: "item_training_stim", name: "Emergency Field Stim", rarity: "rare", icon: "💉", value: 250, type: "med" },
    ],
  },
  {
    id: "crate_warehouse_vault",
    x: 22.5,
    z: -9.5,
    cashValue: 4200,
    containerType: "console",
    containerTitle: "REINFORCED ARMORY VAULT // COMMAND HQ",
    items: [
      { id: "item_gold_bullion", name: "Military Gold Bullion Bar", rarity: "legendary", icon: "🪙", value: 2500, type: "valuable" },
      { id: "item_m61", name: "7.62x51mm M61 AP Ammo Pack", rarity: "rare", icon: "📦", value: 700, type: "ammo" },
      { id: "item_medkit", name: "Grizzly First Aid Field Kit", rarity: "epic", icon: "🩹", value: 1000, type: "med" },
    ],
  },
  {
    id: "crate_river_cache",
    x: -20,
    z: 19,
    cashValue: 3500,
    containerType: "barrel",
    containerTitle: "WATERPROOF RIVER CACHE // EMBANKMENT",
    items: [
      { id: "item_intel_drive", name: "Submerged Black Box SSD", rarity: "legendary", icon: "💾", value: 2100, type: "valuable" },
      { id: "item_injector", name: "SJ6 Endurance Combat Injector", rarity: "rare", icon: "💉", value: 800, type: "med" },
      { id: "item_buckshot", name: "Flechette Tactical Shells", rarity: "rare", icon: "📦", value: 600, type: "ammo" },
    ],
  },
  {
    id: "crate_substation_bunker",
    x: -24,
    z: 48,
    cashValue: 3800,
    containerType: "crate",
    containerTitle: "PUMPING STATION ORDNANCE LOCKER",
    items: [
      { id: "item_crypto_cold", name: "Hardware Crypto Ledger", rarity: "legendary", icon: "💳", value: 2400, type: "valuable" },
      { id: "item_ap_slugs", name: "AP-20 Armor-Piercing Slugs", rarity: "rare", icon: "📦", value: 700, type: "ammo" },
      { id: "item_adrenaline", name: "Zagustin Hemostatic Injector", rarity: "rare", icon: "💉", value: 700, type: "med" },
    ],
  },
];

export const KNOWN_DEPOT_CRATES: Record<string, number> = Object.fromEntries(
  DEPOT_CRATE_CONFIGS.map((c) => [c.id, c.cashValue])
);

export const DEPOT_CRATE_LOCATIONS: Record<string, { x: number; z: number }> = Object.fromEntries(
  DEPOT_CRATE_CONFIGS.map((c) => [c.id, { x: c.x, z: c.z }])
);
