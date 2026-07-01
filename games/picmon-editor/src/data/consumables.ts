// Consumables are items the player can apply to card creation to bias the
// rolls. Each has a specific PROBABILISTIC effect on rarity / type / abilities
// — stacking more of the same kind raises the chance of getting what you
// want, with a hard cap so it maxes out at 100% after a reasonable number.
//
// All effects are baked into `cardGenerator.generateCard()` via the
// `CreateModifiers` struct — see src/utils/cardGenerator.ts.
//
// Dropped from wild battles (see src/utils/consumableDrops.ts) and spent on
// successful card creation.

import { ALL_TYPES, TYPE_DISPLAY, type MonsterType, type TypeFamily } from './typeSystem';

/**
 * Per-consumable stack amount → cumulative effect percentage.
 *
 * v1.207 — RADICALLY DIALED DOWN from the previous curves (which
 * effectively guaranteed the desired outcome at 1-3 stacks). Single
 * applications now feel like meaningful "tip the odds" choices instead
 * of "always apply on every create or you're griefing yourself" musts.
 * Also lets us hand them out in quests without breaking the rarity /
 * type economy.
 *
 * Old curves are noted in comments for reference.
 */
export const STACK_CHANCE_CURVES = {
  // OLD: [0, 25, 50, 75]  (stack 3 = guaranteed bump)
  luck_charm: [0, 10, 20, 30],
  // OLD: [0, 60, 90]      (stack 2 = near-guaranteed Rare floor)
  prismatic_core: [0, 25, 45],
  // OLD: [0, 60, 85, 100] (stack 3 = 100% family)
  family_prism: [0, 30, 55, 75],
  // OLD: [0, 70, 95]      (stack 2 = 95% chosen type)
  pure_crystal: [0, 35, 60],
  // OLD: [0, 30, 55, 80, 100] (stack 4 = 100% chosen type)
  type_crystal: [0, 15, 30, 50, 70],
  // OLD: [0, 75, 100]     (stack 2 = guaranteed +1 ability tier)
  signature_scroll: [0, 30, 55],
} as const;

// Fixed (non-type-crystal) consumable ids.
type FixedConsumableId =
  | 'luck_charm'
  | 'prismatic_core'
  | 'family_prism'
  | 'pure_crystal'
  | 'signature_scroll'
  | 'growth_shard'
  | 'awakening_crystal'
  // 2026-05-16 (v1.372) — Premium $5 IAP consumable: bumps an existing
  // PicMon's rarity by one tier (stats + abilities scale to match).
  // Hard-capped at 'eternal' — the top-3 rarities (prismatic, divine,
  // omega) cannot be bought into; players have to find them. See
  // ascendCardRarity / canAscendRarity in utils/cardGenerator.ts.
  | 'ascension_stone'
  // Battle-usable (see playerUsesBattleItem in world/systems/WorldBattle.ts).
  | 'health_potion'
  | 'super_potion'
  | 'full_heal'
  // Move tutor — consumed at the Master Tutor vendor's modal to mutate
  // a PicMon's ability set. See src/utils/moveTutorActions.ts.
  | 'signature_tome'
  | 'cross_type_scroll'
  | 'power_etching';

/**
 * Tutor items the player can apply to a single PicMon to permanently
 * mutate its ability set. Sold by the Master Tutor vendor at a high
 * Stardust price; never drop from wild battles.
 */
export type TutorItemId = 'signature_tome' | 'cross_type_scroll' | 'power_etching';

export const TUTOR_ITEM_IDS: TutorItemId[] = ['signature_tome', 'cross_type_scroll', 'power_etching'];

export function isTutorItem(id: ConsumableId): id is TutorItemId {
  return id === 'signature_tome' || id === 'cross_type_scroll' || id === 'power_etching';
}

/**
 * Battle items the player can use mid-fight. Narrow subset of
 * ConsumableId so the battle UI + WorldBattle.playerUsesBattleItem can
 * type against only the valid ones.
 */
export type BattleItemId = 'health_potion' | 'super_potion' | 'full_heal';

export const BATTLE_ITEM_IDS: BattleItemId[] = ['health_potion', 'super_potion', 'full_heal'];

export function isBattleItem(id: ConsumableId): id is BattleItemId {
  return id === 'health_potion' || id === 'super_potion' || id === 'full_heal';
}

// Type-crystal ids are `type_crystal_<MonsterType>` (36 total).
export type TypeCrystalId = `type_crystal_${MonsterType}`;

export type ConsumableId = FixedConsumableId | TypeCrystalId;

export type ConsumableCategory = 'rarity' | 'type' | 'ability' | 'evolution' | 'battle';

export interface ConsumableDef {
  id: ConsumableId;
  label: string;
  icon: string;
  category: ConsumableCategory;
  /** Human-readable description shown in the bag + Create loadout. */
  description: string;
  /** Drop tier governs how often this drops (and from which enemy rarity). */
  dropTier: 'common' | 'uncommon' | 'rare';
  /** Whether the player must pick a parameter at use time (family / type). */
  requiresChoice?: 'family' | 'type';
  /** Max copies that can be applied to a single creation (stackable). */
  maxPerCreate: number;
  /**
   * For UI: element-type this crystal is pinned to. Only set on
   * type_crystal_* entries; lets the picker group them by type.
   */
  forType?: MonsterType;
}

/** Build the full consumables catalog, including 36 programmatic Type Crystals. */
function buildCatalog(): Record<ConsumableId, ConsumableDef> {
  const base: Record<string, ConsumableDef> = {
    luck_charm: {
      id: 'luck_charm',
      label: 'Luck Charm',
      icon: '\u{1F340}',
      category: 'rarity',
      description:
        '+10% chance to bump rarity one tier up. Stack 3 for ~30%. A nudge, not a guarantee.',
      dropTier: 'common',
      maxPerCreate: 3,
    },
    prismatic_core: {
      id: 'prismatic_core',
      label: 'Prismatic Core',
      icon: '\u{1F52E}',
      category: 'rarity',
      description:
        '25% chance to floor rarity at Rare or better. Stack 2 for ~45%.',
      dropTier: 'rare',
      maxPerCreate: 2,
    },
    family_prism: {
      id: 'family_prism',
      label: 'Family Prism',
      icon: '\u{1F538}',
      category: 'type',
      description:
        '30% chance the card\u2019s type comes from a chosen family (Thermal, Aquatic, \u2026). Stack 3 for ~75%.',
      dropTier: 'uncommon',
      requiresChoice: 'family',
      maxPerCreate: 3,
    },
    pure_crystal: {
      id: 'pure_crystal',
      label: 'Pure Crystal',
      icon: '\u{1F48E}',
      category: 'type',
      description:
        'Pick an exact type. 35% chance of getting it. Stack 2 for ~60%.',
      dropTier: 'rare',
      requiresChoice: 'type',
      maxPerCreate: 2,
    },
    signature_scroll: {
      id: 'signature_scroll',
      label: 'Signature Scroll',
      icon: '\u{1F4DC}',
      category: 'ability',
      description:
        '30% chance to roll abilities one rarity tier higher. Stack 2 for ~55%.',
      dropTier: 'uncommon',
      maxPerCreate: 2,
    },
    growth_shard: {
      id: 'growth_shard',
      label: 'Growth Shard',
      icon: '\u{1F331}',
      category: 'evolution',
      description:
        'Evolves a Lv.10+ PicMon from its small form into its intermediate form. Consumed on use.',
      dropTier: 'uncommon',
      maxPerCreate: 0,
    },
    awakening_crystal: {
      id: 'awakening_crystal',
      label: 'Awakening Crystal',
      icon: '\u{1F48E}',
      category: 'evolution',
      description:
        'Evolves a Lv.20+ intermediate PicMon into its fully-grown adult form. Consumed on use.',
      dropTier: 'rare',
      maxPerCreate: 0,
    },
    // 2026-05-16 (v1.372) — Premium IAP consumable. Sold only on the
    // Shop (350 RUN Bucks ≈ $5). Bumps a single PicMon up one rarity
    // tier — caps at Eternal so Prismatic/Divine/Omega remain "find-
    // only" trophies and the IAP can't shortcut the absolute top.
    ascension_stone: {
      id: 'ascension_stone',
      label: 'Ascension Stone',
      icon: '\u{1F31F}',
      category: 'rarity',
      description:
        'Raise a PicMon\u2019s rarity by one tier. Stats and abilities scale to the new tier. Caps at Eternal \u2014 Prismatic, Divine, and Omega must be found in the wild.',
      dropTier: 'rare',
      maxPerCreate: 0,
    },
    /* ───────── Battle items ───────── */
    health_potion: {
      id: 'health_potion',
      label: 'Health Potion',
      icon: '\u{1F9EA}',
      category: 'battle',
      description:
        'Restore 50 HP to your active PicMon mid-battle. The enemy gets a free counter-attack while you pour it.',
      dropTier: 'common',
      maxPerCreate: 0,
    },
    super_potion: {
      id: 'super_potion',
      label: 'Super Potion',
      icon: '\u{1F376}',
      category: 'battle',
      description:
        'Restore 150 HP to your active PicMon mid-battle. Enemy gets a free counter-attack.',
      dropTier: 'uncommon',
      maxPerCreate: 0,
    },
    full_heal: {
      id: 'full_heal',
      label: 'Full Heal',
      icon: '\u{1F48A}',
      category: 'battle',
      description:
        'Fully restore HP and cure any status effect (burn, freeze, poison) on the active PicMon. Enemy gets a free counter-attack.',
      dropTier: 'rare',
      maxPerCreate: 0,
    },
    /* ───────── Move tutor items (premium Stardust sink) ───────── */
    signature_tome: {
      id: 'signature_tome',
      label: 'Signature Tome',
      icon: '\u{1F4DA}',
      category: 'ability',
      description:
        'Replaces the lead ability slot on a PicMon with a custom signature move \u2014 high power, named for the mon\u2019s element. Consumed on use. Sold only by the Master Tutor.',
      dropTier: 'rare',
      maxPerCreate: 0,
    },
    cross_type_scroll: {
      id: 'cross_type_scroll',
      label: 'Cross-Type Scroll',
      icon: '\u{1F300}',
      category: 'ability',
      description:
        'Teaches a PicMon a damage move from a totally different element family \u2014 mind-bending matchups, rotated into the secondary slot. Consumed on use.',
      dropTier: 'rare',
      maxPerCreate: 0,
    },
    power_etching: {
      id: 'power_etching',
      label: 'Power Etching',
      icon: '\u{1F528}',
      category: 'ability',
      description:
        'Etches +6 power into every damage move the PicMon currently knows. Stacks with all other modifications. Consumed on use.',
      dropTier: 'rare',
      maxPerCreate: 0,
    },
  };

  // Auto-generate a crystal for each of the 36 MonsterTypes. Drops from wild
  // enemies that match the crystal's element; stacks give +25% per for the
  // chosen type (see STACK_CHANCE_CURVES.type_crystal).
  for (const t of ALL_TYPES) {
    const info = TYPE_DISPLAY[t];
    const id: TypeCrystalId = `type_crystal_${t}`;
    base[id] = {
      id,
      label: `${info?.label ?? t} Crystal`,
      icon: info?.icon ?? '\u{1F48E}',
      category: 'type',
      description:
        `+15% chance the created PicMon is ${info?.label ?? t}-type. ` +
        `Stack up to 4 for ~70%.`,
      dropTier: 'uncommon',
      maxPerCreate: 4,
      forType: t,
    };
  }

  return base as Record<ConsumableId, ConsumableDef>;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = buildCatalog();

export const CONSUMABLE_IDS = Object.keys(CONSUMABLES) as ConsumableId[];

/** Convenience: get the type-crystal id for a MonsterType. */
export function typeCrystalId(t: MonsterType): TypeCrystalId {
  return `type_crystal_${t}` as TypeCrystalId;
}

/** True if a consumable id is one of the 36 type crystals. */
export function isTypeCrystal(id: ConsumableId): id is TypeCrystalId {
  return id.startsWith('type_crystal_');
}

/**
 * Modifier struct produced by the Create flow and consumed by generateCard.
 * All effects are probabilistic — see `STACK_CHANCE_CURVES` for the stacking
 * schedule. The generator rolls the random checks in order: rarity shift,
 * rarity floor, ability tier boost, type bias.
 */
export interface CreateModifiers {
  /** Number of Luck Charms applied (each adds to the chance of +1 tier). */
  luckCharmCount: number;
  /** Number of Prismatic Cores applied (guarantees Rare+ floor with stacking). */
  prismaticCoreCount: number;
  /** Number of Signature Scrolls applied (ability tier +1 check). */
  signatureScrollCount: number;
  /** Family Prism: chosen family + stack count (stacking increases the chance). */
  familyPrism?: { family: TypeFamily; count: number };
  /** Pure Crystal: chosen type + stack count (stacking increases the chance). */
  pureCrystal?: { type: MonsterType; count: number };
  /** Type crystals: map of MonsterType → count of crystals applied. */
  typeCrystalCounts: Partial<Record<MonsterType, number>>;
  /** Which consumable ids (flat list, repeated per count) were spent — for UI + spend. */
  spent: ConsumableId[];
}

export const EMPTY_MODIFIERS: CreateModifiers = {
  luckCharmCount: 0,
  prismaticCoreCount: 0,
  signatureScrollCount: 0,
  typeCrystalCounts: {},
  spent: [],
};

/** Look up the cumulative chance (0-100) for a stack count. */
export function chanceForStack(
  kind: keyof typeof STACK_CHANCE_CURVES,
  count: number,
): number {
  const curve = STACK_CHANCE_CURVES[kind];
  const clamped = Math.max(0, Math.min(curve.length - 1, count));
  return curve[clamped] ?? 0;
}

/** Friendly label for each type family — used in the family picker UI. */
export const FAMILY_LABELS: Record<TypeFamily, { label: string; icon: string }> = {
  thermal: { label: 'Thermal', icon: '\u{1F525}' },
  aquatic: { label: 'Aquatic', icon: '\u{1F30A}' },
  mineral: { label: 'Mineral', icon: '\u{1FAA8}' },
  organic: { label: 'Organic', icon: '\u{1F331}' },
  electric: { label: 'Electric', icon: '\u26A1' },
  arcane: { label: 'Arcane', icon: '\u{1F52E}' },
  atmospheric: { label: 'Atmospheric', icon: '\u{1F32C}\uFE0F' },
  combat: { label: 'Combat', icon: '\u{1F44A}' },
};
