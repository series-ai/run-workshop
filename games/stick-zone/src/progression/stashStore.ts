import { getRundotGameApi } from "../sdk.js";
/**
 * @file stashStore.ts
 * Player stash, bank, rank, and armory loadout store.
 * Raid rewards never credit here locally. A co-op raid settles from the
 * SyncHub debrief, and the stash then hydrates from the hub. An offline
 * raid is practice and banks nothing.
 */

import { create } from "zustand";
import { type Contract, INITIAL_CONTRACTS } from "./contracts.js";
import { type DepotCrateItem } from "../sim/crates.js";
import recipesConfig from "../../rundot/simulation/recipes.json";

export type WeaponType = "rifle" | "shotgun" | "smg" | "dmr";
export type ArmorTier = "light" | "medium" | "heavy";

export interface StashItem {
  id: string;
  name: string;
  type: "weapon" | "armor" | "ammo" | "med" | "valuable" | "keycard";
  rarity: "common" | "rare" | "epic" | "legendary";
  icon: string;
  value: number;
  count: number;
}

export interface PlayerStats {
  raidsCount: number;
  survivedCount: number;
  kiaCount: number;
  killsCount: number;
  bossKillsCount: number;
  cratesLooted: number;
  totalValueExtracted: number;
}

export interface Loadout {
  primaryWeapon: WeaponType;
  secondaryWeapon: WeaponType;
  armorTier: ArmorTier;
  stims: number;
  hasLaserPointer?: boolean;
}

export interface StashState {
  bankCash: number;
  operativeLevel: number;
  xp: number;
  stats: PlayerStats;
  loadout: Loadout;
  stashItems: StashItem[];
  contracts: Contract[];
  activeRaidLoot: DepotCrateItem[];

  // Shop & Economy
  buyShopItem: (item: {
    id: string;
    name: string;
    type: StashItem["type"];
    rarity: StashItem["rarity"];
    icon: string;
    price: number;
  }) => boolean;
  sellStashItem: (itemId: string) => Promise<boolean>;

  // Armory Customization
  equipWeapon: (slot: "primary" | "secondary", weapon: WeaponType) => void;
  equipArmor: (tier: ArmorTier) => void;
  setStimsCount: (count: number) => void;
  setLaserPointer: (enabled: boolean) => void;

  // Maintenance
  resetProgress: () => void;
}



export function getXpForNextLevel(level: number): number {
  return 1000 + (level - 1) * 750;
}

const DEFAULT_LOADOUT: Loadout = {
  primaryWeapon: "rifle",
  secondaryWeapon: "shotgun",
  armorTier: "medium",
  stims: 2,
  hasLaserPointer: false,
};

const DEFAULT_STATS: PlayerStats = {
  raidsCount: 0,
  survivedCount: 0,
  kiaCount: 0,
  killsCount: 0,
  bossKillsCount: 0,
  cratesLooted: 0,
  totalValueExtracted: 0,
};

const DEFAULT_STASH_ITEMS: StashItem[] = [
  { id: "item_m4_start", name: "M4A1 Tactical Carbine", type: "weapon", rarity: "rare", icon: "🔫", value: 2500, count: 1 },
  { id: "item_m590_start", name: "M590 Trench Shotgun", type: "weapon", rarity: "common", icon: "💥", value: 1800, count: 1 },
  { id: "item_trooper_start", name: "Class 4 Trooper Plate", type: "armor", rarity: "rare", icon: "🛡️", value: 2200, count: 1 },
  { id: "item_556_ammo", name: "5.56x45mm FMJ (60 Rnd)", type: "ammo", rarity: "common", icon: "📦", value: 450, count: 3 },
  { id: "item_12g_ammo", name: "12-Gauge Buckshot (24 Rnd)", type: "ammo", rarity: "common", icon: "📦", value: 350, count: 2 },
  { id: "item_propital_start", name: "Propital Combat Stim", type: "med", rarity: "rare", icon: "💉", value: 600, count: 2 },
];

/**
 * Map a stash item to its configured sell recipe by entity id. Stash item
 * ids are `item_<entityId>` for hydrated loot; shop-bought ids carry a
 * timestamp suffix on the shop id. Returns null when the catalog has no
 * sell recipe, so callers never invent a recipe name from display text.
 */
export function sellRecipeNameForItem(item: { id: string; name: string }): string | null {
  const recipes = (recipesConfig as { recipes: Record<string, unknown> }).recipes;
  const candidates: string[] = [];
  if (item.id.startsWith("item_")) candidates.push(item.id.slice("item_".length));
  candidates.push(item.id.replace(/_\d+$/, ""));
  candidates.push(item.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  for (const entityId of candidates) {
    const recipe = `sell_${entityId}`;
    if (recipe in recipes) return recipe;
  }
  return null;
}

export function parseCanonicalQuantity(val: string | number | undefined): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = val.startsWith("BE:") ? val.slice(3) : val;
  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const useStashStore = create<StashState>((set, get) => {
  const initial = {
    bankCash: 5000,
    operativeLevel: 1,
    xp: 0,
    stats: DEFAULT_STATS,
    loadout: DEFAULT_LOADOUT,
    stashItems: DEFAULT_STASH_ITEMS,
    contracts: INITIAL_CONTRACTS,
    activeRaidLoot: [],
  };

  return {
    ...initial,

    buyShopItem: (item) => {
      const state = get();
      if (state.bankCash < item.price) return false;

      const newCash = state.bankCash - item.price;
      const updatedStash = [...state.stashItems];
      const existing = updatedStash.find((s) => s.name === item.name);
      if (existing) {
        existing.count += 1;
      } else {
        updatedStash.push({
          id: `${item.id}_${Date.now()}`,
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          icon: item.icon,
          value: Math.floor(item.price * 0.6),
          count: 1,
        });
      }

      set({ bankCash: newCash, stashItems: updatedStash });
      return true;
    },

    sellStashItem: async (itemId) => {
      const state = get();
      const itemIndex = state.stashItems.findIndex((s) => s.id === itemId);
      if (itemIndex === -1) return false;

      const item = state.stashItems[itemIndex];
      const sellPrice = item.value || 200;

      // With a live simulation API the server trade decides: execute the
      // configured recipe first, then hydrate the confirmed inventory.
      // A failed or unmapped trade changes nothing locally.
      const simulation = getRundotGameApi()?.simulation;
      if (simulation?.executeRecipeAsync) {
        const recipeName = sellRecipeNameForItem(item);
        if (!recipeName) return false;
        const entityId = item.id.startsWith("item_") ? item.id.slice("item_".length) : item.id.replace(/_\d+$/, "");
        await simulation.executeRecipeAsync(recipeName, { [entityId]: 1 });
        await hydrateStashFromCloud();
        return true;
      }

      const newCash = state.bankCash + sellPrice;
      const updatedStash = [...state.stashItems];
      if (item.count > 1) {
        updatedStash[itemIndex] = { ...item, count: item.count - 1 };
      } else {
        updatedStash.splice(itemIndex, 1);
      }

      set({ bankCash: newCash, stashItems: updatedStash });
      return true;
    },

    equipWeapon: (slot, weapon) => {
      const state = get();
      const newLoadout = {
        ...state.loadout,
        [slot === "primary" ? "primaryWeapon" : "secondaryWeapon"]: weapon,
      };
      set({ loadout: newLoadout });
    },

    equipArmor: (tier) => {
      const state = get();
      const newLoadout = { ...state.loadout, armorTier: tier };
      set({ loadout: newLoadout });
    },

    setStimsCount: (count) => {
      const state = get();
      const newLoadout = { ...state.loadout, stims: Math.max(0, Math.min(4, count)) };
      set({ loadout: newLoadout });
    },

    setLaserPointer: (enabled) => {
      const state = get();
      const newLoadout = { ...state.loadout, hasLaserPointer: enabled };
      set({ loadout: newLoadout });
    },

    resetProgress: () => {
      set({
        bankCash: 5000,
        operativeLevel: 1,
        xp: 0,
        stats: DEFAULT_STATS,
        loadout: DEFAULT_LOADOUT,
        stashItems: DEFAULT_STASH_ITEMS,
        contracts: INITIAL_CONTRACTS,
      });
      const api = getRundotGameApi();
      if (api?.simulation?.resetStateAsync) {
        api.simulation.resetStateAsync({ initializeRecipe: "grant_starter_loadout" })
          .then(() => hydrateStashFromCloud())
          .catch(() => {});
      }
    },
  };
});

/**
 * Cloud hydration from RUN platform storage (authoritative online state).
 * Offline practice does not change the cloud stash.
 */
function mapEntityToStashItem(entityId: string, count: number): StashItem | null {
  const entityMap: Record<string, { name: string; type: StashItem["type"]; rarity: StashItem["rarity"]; icon: string; value: number }> = {
    weapon_rifle: { name: "Assault Rifle", type: "weapon", rarity: "rare", icon: "🔫", value: 2500 },
    weapon_shotgun: { name: "Tactical Shotgun", type: "weapon", rarity: "common", icon: "💥", value: 1800 },
    armor_heavy: { name: "Heavy Assault Armor", type: "armor", rarity: "rare", icon: "🛡️", value: 2200 },
    armor_light: { name: "Light Recon Vest", type: "armor", rarity: "common", icon: "🦺", value: 1200 },
    med_stim: { name: "Military Med Stim", type: "med", rarity: "rare", icon: "💉", value: 600 },
    tactical_bandage: { name: "Tactical Bandage", type: "med", rarity: "common", icon: "🩹", value: 200 },
    circuit_board: { name: "Military Circuit Board", type: "valuable", rarity: "common", icon: "📟", value: 450 },
    encrypted_drive: { name: "Encrypted Intel Drive", type: "valuable", rarity: "rare", icon: "💾", value: 1200 },
    military_battery: { name: "Military Battery", type: "valuable", rarity: "common", icon: "🔋", value: 850 },
    weapon_parts: { name: "Weapon Parts", type: "valuable", rarity: "common", icon: "🔧", value: 300 },
    depot_keycard: { name: "Sector 7 Depot Red Keycard", type: "keycard", rarity: "epic", icon: "💳", value: 5000 },
  };
  const def = entityMap[entityId];
  if (!def) return null;
  return {
    id: `item_${entityId}`,
    name: def.name,
    type: def.type,
    rarity: def.rarity,
    icon: def.icon,
    value: def.value,
    count,
  };
}

export function applySimulationEntities(entities: Record<string, number | string>): void {
  const cashVal = parseCanonicalQuantity(entities["currency_cash"]);
  const items: StashItem[] = [];

  for (const [entityId, qtyRaw] of Object.entries(entities)) {
    if (entityId === "currency_cash") continue;
    const qty = Math.floor(parseCanonicalQuantity(qtyRaw));
    if (qty > 0) {
      const item = mapEntityToStashItem(entityId, qty);
      if (item) items.push(item);
    }
  }

  useStashStore.setState((prev) => ({
    ...prev,
    bankCash: "currency_cash" in entities ? cashVal : prev.bankCash,
    stashItems: items,
  }));
}

/**
 * Authoritative cloud hydration from RundotGameAPI.simulation.
 * All player currency and gear are governed by the server simulation engine.
 */
export async function hydrateStashFromCloud(): Promise<void> {
  const api = getRundotGameApi();
  if (api?.simulation?.getStateAsync) {
    try {
      const simState = await api.simulation.getStateAsync();
      if (simState && "entities" in simState && simState.entities) {
        const entities = simState.entities as Record<string, number | string>;
        const entityKeys = Object.keys(entities);
        if (entityKeys.length === 0 && api.simulation.executeRecipeAsync) {
          try {
            await api.simulation.executeRecipeAsync("grant_starter_loadout", {});
            const refreshed = await api.simulation.getStateAsync();
            if (refreshed && "entities" in refreshed && refreshed.entities) {
              applySimulationEntities(refreshed.entities as Record<string, number | string>);
              return;
            }
          } catch {}
        }
        applySimulationEntities(entities);
      }
    } catch (err) {
      console.warn("[StashStore] Simulation hydration error:", err);
    }
  }
}
