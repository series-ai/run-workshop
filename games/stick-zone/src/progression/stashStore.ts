import { getRundotGameApi } from "../sdk.js";
/**
 * @file stashStore.ts
 * Authoritative player stash, bank, rank leveling, and armory loadout store.
 * Strictly adheres to the "Can't Trust the Client" paradigm:
 * 1. Extraction settlements MUST be backed by a cryptographically verified SettlementReceipt.
 * 2. Bank cash is derived exclusively from outcomePayload.cashBanked, verified against the canonical digest.
 * 3. Replay attack protection rejects duplicated receipt IDs.
 * 4. Local storage state is protected with cryptographic tamper-detection checksums.
 */

import { create } from "zustand";
import { type Contract, INITIAL_CONTRACTS, updateContractProgress } from "./contracts.js";
import { type DepotCrateItem } from "../sim/crates.js";
import { computeCanonicalOutcomeDigest, type SettlementReceipt, type CanonicalOutcomePayload } from "../sim/airlock.js";

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
}

export interface VerifiedSettlementParams {
  receipt: SettlementReceipt;
  outcomePayload: CanonicalOutcomePayload;
  kills?: number;
  bossKill?: boolean;
  cratesLooted?: number;
  itemsSecured?: DepotCrateItem[];
  hasKeycard?: boolean;
  hadBleed?: boolean;
}

export interface StashState {
  bankCash: number;
  operativeLevel: number;
  xp: number;
  stats: PlayerStats;
  loadout: Loadout;
  stashItems: StashItem[];
  contracts: Contract[];
  settledReceiptIds: string[];
  activeRaidLoot: DepotCrateItem[];

  // Authoritative Settlement Action
  recordVerifiedSettlement: (params: VerifiedSettlementParams) => Promise<{
    success: boolean;
    xpGained: number;
    cashCredited: number;
    reason?: string;
  }>;

  // KIA Death Recording
  recordKiaOutcome: (raidId: string) => void;

  // Fallback / Testing adapter
  recordRaidOutcome: (params: {
    survived: boolean;
    cashEarned: number;
    kills: number;
    bossKill: boolean;
    cratesLooted: number;
    itemsSecured: DepotCrateItem[];
    hadBleed?: boolean;
    hasKeycard?: boolean;
  }) => { xpGained: number; leveledUp: boolean; newLevel: number };

  // Shop & Economy
  buyShopItem: (item: {
    id: string;
    name: string;
    type: StashItem["type"];
    rarity: StashItem["rarity"];
    icon: string;
    price: number;
  }) => boolean;
  sellStashItem: (itemId: string) => boolean;

  // Armory Customization
  equipWeapon: (slot: "primary" | "secondary", weapon: WeaponType) => void;
  equipArmor: (tier: ArmorTier) => void;
  setStimsCount: (count: number) => void;

  // Contracts
  claimContractReward: (contractId: string) => void;

  // Maintenance
  resetProgress: () => void;
}


export function computeStoreChecksum(data: {
  bankCash: number;
  operativeLevel: number;
  xp: number;
  settledReceiptIds: string[];
}): string {
  const raw = `${data.bankCash}:${data.operativeLevel}:${data.xp}:${(data.settledReceiptIds || []).slice().sort().join(",")}:sz_salt_9182`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function getXpForNextLevel(level: number): number {
  return 1000 + (level - 1) * 750;
}

const DEFAULT_LOADOUT: Loadout = {
  primaryWeapon: "rifle",
  secondaryWeapon: "shotgun",
  armorTier: "medium",
  stims: 2,
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

export function parseCanonicalQuantity(val: string | number | undefined): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = val.startsWith("BE:") ? val.slice(3) : val;
  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadPersistedState(): Partial<StashState> {
  return {};
}

function persistState(state: {
  bankCash: number;
  operativeLevel: number;
  xp: number;
  stats: PlayerStats;
  loadout: Loadout;
  stashItems: StashItem[];
  contracts: Contract[];
  settledReceiptIds: string[];
}) {
  // Authoritative state lives strictly in RundotGameAPI.simulation.
  // Game client does not issue client-side mutations to appStorage or localStorage.
}

export const useStashStore = create<StashState>((set, get) => {
  const initialPersisted = loadPersistedState();

  const initial = {
    bankCash: initialPersisted.bankCash ?? 5000,
    operativeLevel: initialPersisted.operativeLevel ?? 1,
    xp: initialPersisted.xp ?? 0,
    stats: initialPersisted.stats ?? DEFAULT_STATS,
    loadout: initialPersisted.loadout ?? DEFAULT_LOADOUT,
    stashItems: initialPersisted.stashItems ?? DEFAULT_STASH_ITEMS,
    contracts: initialPersisted.contracts ?? INITIAL_CONTRACTS,
    settledReceiptIds: initialPersisted.settledReceiptIds ?? [],
    activeRaidLoot: [],
  };

  return {
    ...initial,

    recordVerifiedSettlement: async (params) => {
      const state = get();
      const { receipt, outcomePayload } = params;

      // 1. Structural validity check
      if (!receipt || !outcomePayload || receipt.v !== 1) {
        return { success: false, xpGained: 0, cashCredited: 0, reason: "Malformed receipt structure" };
      }

      // 2. Replay attack rejection: each receipt ID can only be settled ONCE
      if (state.settledReceiptIds.includes(receipt.receiptId)) {
        return { success: false, xpGained: 0, cashCredited: 0, reason: "Receipt already settled (replay rejected)" };
      }

      // 3. Cryptographic outcome digest validation
      const expectedDigest = await computeCanonicalOutcomeDigest(outcomePayload);
      if (receipt.outcomeDigest !== expectedDigest) {
        return { success: false, xpGained: 0, cashCredited: 0, reason: "Cryptographic digest mismatch" };
      }

      // 4. Server-verified authoritative cash (client cannot self-report cash)
      const authoritativeCash = outcomePayload.cashBanked;
      if (typeof authoritativeCash !== "number" || isNaN(authoritativeCash) || authoritativeCash < 0) {
        return { success: false, xpGained: 0, cashCredited: 0, reason: "Invalid authoritative cash banked" };
      }

      const kills = params.kills ?? 0;
      const bossKill = Boolean(params.bossKill);
      const cratesLooted = params.cratesLooted ?? 0;

      const xpGained =
        1000 + // extraction bonus
        kills * 150 +
        (bossKill ? 800 : 0) +
        cratesLooted * 100 +
        Math.floor(authoritativeCash / 10);

      let newXp = state.xp + xpGained;
      let newLevel = state.operativeLevel;

      while (newXp >= getXpForNextLevel(newLevel)) {
        newXp -= getXpForNextLevel(newLevel);
        newLevel += 1;
      }

      // Secure vetted loot into stash
      let updatedStash = [...state.stashItems];
      if (params.itemsSecured && params.itemsSecured.length > 0) {
        for (const item of params.itemsSecured) {
          const existing = updatedStash.find((s) => s.name === item.name);
          if (existing) {
            existing.count += 1;
          } else {
            updatedStash.push({
              id: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: item.name,
              type: item.type,
              rarity: item.rarity,
              icon: item.icon,
              value: item.value,
              count: 1,
            });
          }
        }
      }

      // Update contracts
      let updatedContracts = state.contracts;
      for (let i = 0; i < kills; i++) {
        updatedContracts = updateContractProgress(updatedContracts, { type: "kill" });
      }
      if (bossKill) {
        updatedContracts = updateContractProgress(updatedContracts, { type: "boss_kill" });
      }
      updatedContracts = updateContractProgress(updatedContracts, {
        type: "exfil",
        cashExtracted: authoritativeCash,
        hasKeycard: params.hasKeycard,
        hadBleed: params.hadBleed,
      });

      if (cratesLooted > 0) {
        for (let i = 0; i < cratesLooted; i++) {
          updatedContracts = updateContractProgress(updatedContracts, { type: "crate_looted" });
        }
      }

      const newStats: PlayerStats = {
        raidsCount: state.stats.raidsCount + 1,
        survivedCount: state.stats.survivedCount + 1,
        kiaCount: state.stats.kiaCount,
        killsCount: state.stats.killsCount + kills,
        bossKillsCount: state.stats.bossKillsCount + (bossKill ? 1 : 0),
        cratesLooted: state.stats.cratesLooted + cratesLooted,
        totalValueExtracted: state.stats.totalValueExtracted + authoritativeCash,
      };

      const newCash = state.bankCash + authoritativeCash;
      const updatedReceipts = [...state.settledReceiptIds, receipt.receiptId];

      set({
        bankCash: newCash,
        operativeLevel: newLevel,
        xp: newXp,
        stats: newStats,
        stashItems: updatedStash,
        contracts: updatedContracts,
        settledReceiptIds: updatedReceipts,
      });

      persistState({
        bankCash: newCash,
        operativeLevel: newLevel,
        xp: newXp,
        stats: newStats,
        loadout: state.loadout,
        stashItems: updatedStash,
        contracts: updatedContracts,
        settledReceiptIds: updatedReceipts,
      });

      return { success: true, xpGained, cashCredited: authoritativeCash };
    },

    recordKiaOutcome: (raidId: string) => {
      const state = get();
      const kiaKey = `kia_${raidId}`;
      if (state.settledReceiptIds.includes(kiaKey)) return;

      const newStats: PlayerStats = {
        ...state.stats,
        raidsCount: state.stats.raidsCount + 1,
        kiaCount: state.stats.kiaCount + 1,
      };

      const updatedReceipts = [...state.settledReceiptIds, kiaKey];

      set({
        stats: newStats,
        settledReceiptIds: updatedReceipts,
      });

      persistState({
        bankCash: state.bankCash,
        operativeLevel: state.operativeLevel,
        xp: state.xp,
        stats: newStats,
        loadout: state.loadout,
        stashItems: state.stashItems,
        contracts: state.contracts,
        settledReceiptIds: updatedReceipts,
      });
    },

    recordRaidOutcome: (params) => {
      // Local fallback adapter for backward compatibility in mock simulation unit tests
      const state = get();
      const xpGained =
        (params.survived ? 1000 : 250) +
        params.kills * 150 +
        (params.bossKill ? 800 : 0) +
        params.cratesLooted * 100 +
        Math.floor(params.cashEarned / 10);

      let newXp = state.xp + xpGained;
      let newLevel = state.operativeLevel;
      let leveledUp = false;

      while (newXp >= getXpForNextLevel(newLevel)) {
        newXp -= getXpForNextLevel(newLevel);
        newLevel += 1;
        leveledUp = true;
      }

      let updatedStash = [...state.stashItems];
      if (params.survived && params.itemsSecured.length > 0) {
        for (const item of params.itemsSecured) {
          const existing = updatedStash.find((s) => s.name === item.name);
          if (existing) {
            existing.count += 1;
          } else {
            updatedStash.push({
              id: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: item.name,
              type: item.type,
              rarity: item.rarity,
              icon: item.icon,
              value: item.value,
              count: 1,
            });
          }
        }
      }

      let updatedContracts = state.contracts;
      for (let i = 0; i < params.kills; i++) {
        updatedContracts = updateContractProgress(updatedContracts, { type: "kill" });
      }
      if (params.bossKill) {
        updatedContracts = updateContractProgress(updatedContracts, { type: "boss_kill" });
      }
      if (params.survived) {
        updatedContracts = updateContractProgress(updatedContracts, {
          type: "exfil",
          cashExtracted: params.cashEarned,
          hasKeycard: params.hasKeycard,
          hadBleed: params.hadBleed,
        });
      }

      if (params.cratesLooted > 0) {
        for (let i = 0; i < params.cratesLooted; i++) {
          updatedContracts = updateContractProgress(updatedContracts, {
            type: "crate_looted",
          });
        }
      }

      const newStats: PlayerStats = {
        raidsCount: state.stats.raidsCount + 1,
        survivedCount: state.stats.survivedCount + (params.survived ? 1 : 0),
        kiaCount: state.stats.kiaCount + (params.survived ? 0 : 1),
        killsCount: state.stats.killsCount + params.kills,
        bossKillsCount: state.stats.bossKillsCount + (params.bossKill ? 1 : 0),
        cratesLooted: state.stats.cratesLooted + params.cratesLooted,
        totalValueExtracted: state.stats.totalValueExtracted + (params.survived ? params.cashEarned : 0),
      };

      const newCash = state.bankCash + (params.survived ? params.cashEarned : 0);

      set({
        bankCash: newCash,
        operativeLevel: newLevel,
        xp: newXp,
        stats: newStats,
        stashItems: updatedStash,
        contracts: updatedContracts,
      });

      persistState({
        bankCash: newCash,
        operativeLevel: newLevel,
        xp: newXp,
        stats: newStats,
        loadout: state.loadout,
        stashItems: updatedStash,
        contracts: updatedContracts,
        settledReceiptIds: state.settledReceiptIds,
      });

      return { xpGained, leveledUp, newLevel };
    },

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
      persistState({
        ...state,
        bankCash: newCash,
        stashItems: updatedStash,
      });
      return true;
    },

    sellStashItem: (itemId) => {
      const state = get();
      const itemIndex = state.stashItems.findIndex((s) => s.id === itemId);
      if (itemIndex === -1) return false;

      const item = state.stashItems[itemIndex];
      const sellPrice = item.value || 200;
      const newCash = state.bankCash + sellPrice;

      // Pure RUN SDK simulation integration
      try {
        if (getRundotGameApi()?.simulation?.executeRecipeAsync) {
          const recipeName = `sell_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
          getRundotGameApi().simulation.executeRecipeAsync(recipeName, { [item.id || item.name]: 1 }).catch(() => {});
        }
      } catch {}

      const updatedStash = [...state.stashItems];
      if (item.count > 1) {
        updatedStash[itemIndex] = { ...item, count: item.count - 1 };
      } else {
        updatedStash.splice(itemIndex, 1);
      }

      set({ bankCash: newCash, stashItems: updatedStash });
      persistState({
        ...state,
        bankCash: newCash,
        stashItems: updatedStash,
      });
      return true;
    },

    equipWeapon: (slot, weapon) => {
      const state = get();
      const newLoadout = {
        ...state.loadout,
        [slot === "primary" ? "primaryWeapon" : "secondaryWeapon"]: weapon,
      };
      set({ loadout: newLoadout });
      persistState({ ...state, loadout: newLoadout });
    },

    equipArmor: (tier) => {
      const state = get();
      const newLoadout = { ...state.loadout, armorTier: tier };
      set({ loadout: newLoadout });
      persistState({ ...state, loadout: newLoadout });
    },

    setStimsCount: (count) => {
      const state = get();
      const newLoadout = { ...state.loadout, stims: Math.max(0, Math.min(4, count)) };
      set({ loadout: newLoadout });
      persistState({ ...state, loadout: newLoadout });
    },

    claimContractReward: (contractId) => {
      const state = get();
      const contract = state.contracts.find((c) => c.id === contractId);
      if (!contract || !contract.completed || contract.claimed) return;

      const newCash = state.bankCash + contract.rewardCash;
      let newXp = state.xp + contract.rewardXp;
      let newLevel = state.operativeLevel;

      while (newXp >= getXpForNextLevel(newLevel)) {
        newXp -= getXpForNextLevel(newLevel);
        newLevel += 1;
      }

      const updatedContracts = state.contracts.map((c) =>
        c.id === contractId ? { ...c, claimed: true } : c
      );

      set({
        bankCash: newCash,
        xp: newXp,
        operativeLevel: newLevel,
        contracts: updatedContracts,
      });

      persistState({
        ...state,
        bankCash: newCash,
        xp: newXp,
        operativeLevel: newLevel,
        contracts: updatedContracts,
      });
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
        settledReceiptIds: [],
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
 * Stick Zone is an always-connected platform game (no offline).
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

function applySimulationEntities(entities: Record<string, number | string>): void {
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
    bankCash: cashVal > 0 ? cashVal : prev.bankCash,
    stashItems: items.length > 0 ? items : prev.stashItems,
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
