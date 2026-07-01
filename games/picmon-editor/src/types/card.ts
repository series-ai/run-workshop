import type { MonsterType, GeneratedAbility } from '../data/typeSystem';
import { TYPE_DISPLAY, ALL_TYPES, generateAbilities, isAbilityUnlocked, getArchetype } from '../data/typeSystem';

export type { MonsterType } from '../data/typeSystem';
export type Rarity =
  | 'tattered' | 'common' | 'uncommon' | 'rare' | 'superior'
  | 'epic' | 'mythic' | 'legendary' | 'ancient' | 'celestial'
  | 'transcendent' | 'eternal' | 'prismatic' | 'divine' | 'omega';

export const RARITY_ORDER: Rarity[] = [
  'tattered', 'common', 'uncommon', 'rare', 'superior',
  'epic', 'mythic', 'legendary', 'ancient', 'celestial',
  'transcendent', 'eternal', 'prismatic', 'divine', 'omega',
];

export interface MonsterStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export type Ability = GeneratedAbility;

/** Snapshot of a card at the moment it was used in a merge */
export interface MergeParent {
  name: string;
  imageUrl: string;
  element: MonsterType;
  parents?: [MergeParent, MergeParent];
}

export interface BattleCard {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  battleImageUrl?: string;
  backImageUrl?: string;
  backgroundUrl?: string;
  isPixelSprite?: boolean;
  /**
   * 2026-05-18 (v1.408 / Phase 2) — Durable source-of-truth art URL.
   *
   * The permanent, public, hosted URL returned by
   * `RundotGameAPI.imageGen.generate()` (a GCS object made public with a
   * 1-year cache header — it does not expire; see venus
   * storage.service.ts). `imageUrl` / `battleImageUrl` may be a
   * client-side chroma-keyed `data:` URL that gets externalized into
   * volatile browser localStorage and is therefore lost on cache
   * clear / device switch / ITP eviction. `artUrl` is ~80 bytes, well
   * under the per-value cap, so it rides inside the paged collection
   * JSON and syncs cross-device via appStorage like any other field.
   *
   * It is the input the chroma-key step re-derives the transparent
   * sprite from (free, deterministic, same image) instead of
   * re-generating a *different* image when the local sprite cache is
   * gone. Absent on legacy cards until `migrateCard` backfills it from
   * a still-hosted `imageUrl`.
   */
  artUrl?: string;
  rarity: Rarity;
  element: MonsterType;
  stats: MonsterStats;
  abilities: Ability[];
  creatorId: string;
  creatorName: string;
  createdAt: number;
  /**
   * 2026-05-30 (v1.613) — Optional freeform player prompt used at
   * creation time. Set ONLY when the player paid the custom-prompt
   * surcharge in CreateTab and supplied non-empty text. Persisted on
   * the card so future audit / re-roll / moderation review has the
   * exact wording the player submitted. Goes through
   * `findBlockedKeyword` before reaching imageGen; rejected prompts
   * never make it onto a card.
   */
  creationPrompt?: string;
  /**
   * 2026-05-30 (v1.620) — Optional freeform player style directive
   * used at creation time. When set, this REPLACED the picked
   * style's prompt directive at generation. Persisted so future
   * audit / re-roll surfaces know which mons were minted with a
   * player-authored style. Same moderation gating as
   * `creationPrompt` (findBlockedKeyword in CreateTab + defense-in-
   * depth in cardGenerator).
   */
  creationStyle?: string;
  parentTypes?: [MonsterType, MonsterType];
  discoveredRecipe?: boolean;
  /** Full merge lineage — immediate parents with their own ancestry */
  mergeParents?: [MergeParent, MergeParent];
  /**
   * 2026-05-17 (v1.401) — How many merge generations deep this card is.
   *   • 0 / undefined — wild roll, create-flow, capture, gacha pull. Also
   *     the implicit default for ALL legacy cards (grandfathered: existing
   *     merged mons keep their stats but their NEXT merge starts the
   *     diminishing-returns curve from gen 0 → 1).
   *   • N>0 — merge result whose parents had `max(parent.mergeGeneration) === N-1`.
   *
   * Drives the diminishing-returns multiplier in `getMergedStats`:
   *   `multiplier = 1.30 - 0.05 * min(maxParentGen, 5)`
   *   gen 0 parents → 1.30× (first merge feels rewarding)
   *   gen 1 parent  → 1.25×
   *   gen 2 parent  → 1.20×
   *   gen 3 parent  → 1.15×
   *   gen 4 parent  → 1.10×
   *   gen 5+ parent → 1.05× (effectively just "max parents")
   *
   * Why: pre-v1.401 the merge math was `max(parents) × 1.30` with no
   * generation cap, so a 16-mon tournament bracket merge produced a
   * child with 1.30^4 = 2.86× the strongest source mon's stats — way
   * past any rarity curve. Players reported these merge-stacked
   * monsters "smoking" everything in PvP. The diminishing returns
   * preserve the "first merge is a real upgrade" feeling while
   * collapsing the stacking curve.
   */
  mergeGeneration?: number;
  /**
   * Environment this monster was created for (e.g. 'cave', 'snow', 'volcano').
   * Used by the renderer to pick the themed backdrop from
   * environmentBackgroundStore when set; falls back to the per-type backdrop
   * when absent. See src/data/environments.ts for the full list.
   */
  environment?: string;
  xp: number;
  level: number;
  /**
   * Remaining HP at last save. Absent/undefined means "at max" (treat as
   * full HP). Persisted by `updatePartyHps()` at battle end so mons don't
   * auto-heal between fights. See `getCurrentHp()` for the time-based
   * regen computation.
   */
  currentHp?: number;
  /** Epoch ms when currentHp was last written — used for passive HP regen. */
  hpUpdatedAt?: number;
  /**
   * Evolution stage:
   *   0 = Small / Young (freshly created)
   *   1 = Intermediate (first evolution)
   *   2 = Adult (second evolution)
   * Defaults to 0 for legacy cards.
   */
  stage?: 0 | 1 | 2;
  /** Breadcrumb chain of prior stages, newest first. */
  evolvedFrom?: Array<{
    name: string;
    /** 2026-05-11 — removed from new writes (was the second-biggest
     *  appStorage bucket bloat: data: urls from procedural-fallback
     *  art got pinned in every evolved card forever). Kept optional
     *  so legacy persisted entries still parse without throwing. */
    imageUrl?: string;
    stage: 0 | 1 | 2;
  }>;
  /**
   * 2026-06-22 (v1.795) — Timed-evolution pending marker (the starter
   * free "evolve overnight" flow that teaches the evolution loop + drives
   * a D1-return notification). A wall-clock ms timestamp:
   *   • absent          → no timed evolution pending
   *   • Date.now() <  X → still evolving (UI shows "ready in Xh")
   *   • Date.now() >= X → ready to claim — the EvolutionModal runs the
   *                       real `evolveCard` (free, gates waived) and
   *                       clears this field.
   * Tiny (~13 bytes) so it rides inside the synced collection blob like
   * `artUrl`; cleared on claim so it never persists post-evolution.
   */
  evolveReadyAt?: number;
  /**
   * 2026-05-11 — Set to `true` when the card's `abilities` array has
   * been mutated by the Master Tutor (Signature Tome / Cross-Type
   * Scroll / Power Etching) — i.e. anything that diverges from the
   * deterministic `generateAbilities(element, rarity)` baseline.
   *
   * The collection serializer (cardStorage.saveCollection) drops
   * `abilities` from the persisted JSON when this flag is falsy, and
   * the load-time `migrateCard` regenerates the array from
   * (element, rarity) on next load. Saves ~750 bytes per default
   * card; 60-card collections drop ~45KB out of the 128KB per-user
   * appStorage cap. Customized cards keep their full ability array
   * persisted as before.
   */
  customAbilities?: boolean;
  /**
   * 2026-05-14 — SpriteCook-generated idle animation for this specific
   * card. When present, BattleCardDisplay / ModularCard / WorldBattleUI
   * swap the static <img> for an `IdleSpriteAnim` driven by this
   * sheet (same renderer the marquee mons use). Absent on every card by
   * default; populated by the admin-gated "Bring to Life" action in
   * CollectionTab which uploads the mon's portrait to SpriteCook and
   * stores the returned spritesheet URL here.
   *
   * Shape matches `IdleSheetSpec` in `utils/idleSpriteRegistry.ts`.
   * `url` is a hosted SpriteCook CDN URL (~80 bytes), so this lives
   * inline in the persisted collection JSON without needing the same
   * data-URL externalization machinery `imageUrl`/`battleImageUrl` use.
   * `createdAt` is informational only (lets us purge old sheets later
   * if we ever migrate art styles or rotate the API contract).
   */
  idleSheet?: {
    /**
     * 2026-05-19 (v1.425) — Optional. SpriteCook's signed S3 URL
     * (`https://gamearena.s3.<region>.amazonaws.com/user/<uuid>/<uuid>?X-Amz-...`)
     * is 500-800 bytes per entry, expires in ~24h, and bloated
     * `card_collection` saves enough that we started seeing RPC
     * timeouts on the bridge. Starting v1.425, when `cached: true`
     * AND `sheetAssetId` is populated we OMIT this field on new
     * writes — the IDB blob keyed by cardId is the source of truth
     * and the asset endpoint is the cross-device recovery path.
     * Legacy cards animated before v1.425 still have this field set
     * and the render path still reads from it as a fallback (no
     * forced migration; v1.425 is forward-write-only).
     */
    url?: string;
    frames: number;
    frameMs?: number;
    createdAt: number;
    /**
     * 2026-05-16 — When true, the PNG bytes are durably stored in
     * IndexedDB on this device (keyed by card.id) and the renderer
     * MUST read from the cache rather than trusting `url`, which is
     * a SpriteCook signed URL that expires after ~24h. Legacy cards
     * animated before this flag was introduced lack the field; the
     * resolver hook still attempts the URL once and opportunistically
     * backfills the cache while the URL is alive.
     */
    cached?: boolean;
    /**
     * 2026-05-17 — SpriteCook's permanent asset identifier extracted
     * from the job response root / first match. KEPT for diagnostics
     * + backwards compat (legacy cards animated before v1.414 only
     * had this field, never sheetAssetId), but the recovery path
     * SHOULD NOT call `getAssetBlob` with this id — empirically it
     * binds to the animated WebP preview and the worker (correctly)
     * rejects animated bytes with 415, leading to `clearDeadIdleSheet`
     * stripping the metadata on the next render. Prefer `sheetAssetId`.
     */
    assetId?: string;
    /**
     * 2026-05-18 (v1.414) — SpriteCook asset id specifically bound to
     * the static PNG spritesheet (the renderable one), as opposed to
     * the WebP preview that `assetId` happened to land on for jobs
     * since v1.381. Extracted by `extractSheetAssetId` which finds
     * the asset_id co-located with the picked sheet URL in the job
     * response. `usePersistentIdleSheetUrl` calls `getAssetBlob` with
     * this id first; only falls back to `assetId` for legacy cards
     * where this field is absent. Null/undefined for jobs whose
     * response shape didn't expose a sheet-bound id — those cards
     * survive on the IDB cache populated at job time but have no
     * durable recovery path across devices / cache eviction.
     */
    sheetAssetId?: string;
  };
  /**
   * 2026-05-23 (v1.505) — The art style id the card was generated
   * with (from `src/data/cardStyles.ts`). Drives the Style Affinity
   * v1 UI (family chip at the top of the card detail view + match-
   * bonus block at the bottom). Cards generated before v1.505 don't
   * have this field; `getStyleAffinityResult(undefined, ...)`
   * gracefully falls back to Pixel (polyvalent) so legacy cards still
   * show a buff line and nobody is hosed by the rollout.
   */
  styleId?: string;
  /**
   * 2026-05-23 (v1.506) — Set to `true` on merged cards that hit
   * Perfect Merge conditions: BOTH parents at style tier 5 AND
   * both parents' style affinity matches the result family. See
   * `isPerfectMerge` in `src/data/cardStyles.ts` for the gate
   * logic. Carries a +1 rarity bump at merge time and a durable
   * marker that Style Lab / Recipe Library / collection filters
   * read to badge these cards as elite. Absent on every non-merge
   * card and every merge that didn't hit the gate.
   */
  perfectMerge?: boolean;
  /**
   * 2026-05-26 — Share-grant re-rolls earned by sharing this mon
   * with a friend who then installed the game. One pending re-roll
   * is queued per first-install attribution (see
   * `src/utils/shareGrants.ts`). The Collection detail view spends
   * one of these each time the player taps "Re-roll Rarity"; the
   * re-roll is rarity-floored (never goes BELOW the current rarity,
   * see `src/utils/shareReroll.ts`). Capped at 3 lifetime re-rolls
   * per mon via `shareRerollsUsed`.
   */
  shareRerollsAvailable?: number;
  /** 2026-05-26 — Lifetime count of share-grant re-rolls used on
   *  this mon. Hard-capped at 3 by `MAX_SHARE_REROLLS_PER_MON`
   *  (`src/utils/shareReroll.ts`); further grants for this mon
   *  drop on the floor once the cap is reached. */
  shareRerollsUsed?: number;
}

/** Friendly label for an evolution stage — used in UI. */
export function stageLabel(stage: number | undefined): string {
  if ((stage ?? 0) === 1) return 'Intermediate';
  if ((stage ?? 0) === 2) return 'Adult';
  return 'Young';
}

// Compat aliases — derived from TYPE_DISPLAY
export const ELEMENT_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_DISPLAY).map(([k, v]) => [k, v.icon]),
);

export const ELEMENT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_DISPLAY).map(([k, v]) => [k, v.color]),
);

export const RARITY_COLORS: Record<Rarity, string> = {
  tattered:      '#6d6d6d',
  common:        '#9e9e9e',
  uncommon:      '#4caf50',
  rare:          '#4da6ff',
  superior:      '#00bcd4',
  epic:          '#b366ff',
  mythic:        '#ff4081',
  legendary:     '#ffd700',
  ancient:       '#ff8c00',
  celestial:     '#00e5ff',
  transcendent:  '#e040fb',
  eternal:       '#ff1744',
  prismatic:     '#76ff03',
  divine:        '#ffc400',
  omega:         '#ff3d00',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  tattered:      'Tattered',
  common:        'Common',
  uncommon:      'Uncommon',
  rare:          'Rare',
  superior:      'Superior',
  epic:          'Epic',
  mythic:        'Mythic',
  legendary:     'Legendary',
  ancient:       'Ancient',
  celestial:     'Celestial',
  transcendent:  'Transcendent',
  eternal:       'Eternal',
  prismatic:     'Prismatic',
  divine:        'Divine',
  omega:         'Omega',
};

/**
 * Stat ranges per rarity tier. v1.158 rebalance — the Ancient and above
 * tiers used to snowball into wrecking-ball territory (Omega capped at
 * 300 HP / 55 ATK, almost double Legendary's ceiling). Player feedback:
 * "Ancient is too OP". The new curve makes Ancient marginally better
 * than Legendary (+5-8 HP, +1 ATK), and the tiers above Ancient stack
 * tiny single-digit increments on top instead of doubling stats. Top-
 * tier Omega now caps at 185 HP / 36 ATK — still the king, but no
 * longer one-shotting half the wild pool.
 *
 * The probability of rolling Ancient+ is also dropped to near-extinction
 * in `rollRarity` so a normal player rarely sees one regardless.
 */
export const RARITY_STAT_RANGES: Record<Rarity, { hp: [number, number]; atk: [number, number]; def: [number, number]; spd: [number, number] }> = {
  tattered:      { hp: [40, 55],   atk: [5, 8],   def: [2, 4],   spd: [1, 2] },
  common:        { hp: [55, 75],   atk: [8, 12],  def: [3, 6],   spd: [1, 3] },
  uncommon:      { hp: [65, 85],   atk: [10, 14], def: [4, 7],   spd: [2, 3] },
  rare:          { hp: [75, 100],  atk: [12, 16], def: [5, 9],   spd: [2, 4] },
  superior:      { hp: [85, 110],  atk: [14, 18], def: [6, 10],  spd: [3, 4] },
  epic:          { hp: [95, 120],  atk: [16, 21], def: [7, 12],  spd: [3, 5] },
  mythic:        { hp: [105, 135], atk: [18, 24], def: [8, 13],  spd: [3, 5] },
  legendary:     { hp: [115, 150], atk: [20, 27], def: [10, 16], spd: [4, 6] },
  ancient:       { hp: [120, 158], atk: [21, 28], def: [10, 17], spd: [4, 6] },
  celestial:     { hp: [125, 162], atk: [22, 29], def: [11, 17], spd: [4, 7] },
  transcendent:  { hp: [130, 167], atk: [22, 30], def: [11, 18], spd: [5, 7] },
  eternal:       { hp: [135, 172], atk: [23, 31], def: [12, 18], spd: [5, 7] },
  prismatic:     { hp: [140, 177], atk: [24, 32], def: [12, 19], spd: [5, 8] },
  divine:        { hp: [145, 182], atk: [25, 33], def: [13, 19], spd: [6, 8] },
  omega:         { hp: [150, 188], atk: [26, 34], def: [13, 20], spd: [6, 8] },
};

/* ==================== XP & LEVELING ==================== */

/**
 * v1.244 — Level cap raised from 10 → 100 with rarity-gated effective caps.
 *
 * Why: trainer/quest mons could spawn at any level via direct
 * `level: N` overrides on TrainerMonSpec, but XP_THRESHOLDS only
 * covered 0–10 so player-trained mons hit a hard ceiling at 10.
 * Result: a player could face a Lv-18 trainer they could never
 * grind to match. New design preserves every existing L1–L10
 * threshold (no migration pain) and extends the curve quadratically
 * past 10. Player progression past L10 is unlocked PER-RARITY via
 * RARITY_LEVEL_CAPS — only an Omega mon can reach 100; commons cap
 * at 10 just like before.
 *
 * Curve choice: xp[L] = 800 + 220·(L-10) + 10·(L-10)² for L > 10.
 * Hits L20=4000, L50=25600, L100=101600. Smooth linear-quadratic
 * blend that doesn't punish mid-game grind but still asks for
 * meaningful effort to push past L50.
 */
export const MAX_LEVEL = 100;

const _baseThresholds = [0, 0, 10, 25, 50, 100, 175, 275, 400, 575, 800];

function _computeThresholds(): number[] {
  const out = new Array<number>(MAX_LEVEL + 1);
  for (let L = 0; L <= 10; L++) out[L] = _baseThresholds[L]!;
  for (let L = 11; L <= MAX_LEVEL; L++) {
    const d = L - 10;
    out[L] = Math.round(800 + 220 * d + 10 * d * d);
  }
  return out;
}

/** Total XP needed to reach each level (index = level). 101 entries (L0–L100). */
export const XP_THRESHOLDS: readonly number[] = _computeThresholds();

/**
 * Per-rarity effective level cap. A player can only push a mon to its
 * rarity's cap regardless of how much XP they pour in — the XP tab
 * still shows progress past the cap as MAX. Trainers / quest mons
 * remain free to spawn above this cap for boss-fight pacing; this is
 * purely about player-controlled progression.
 */
export const RARITY_LEVEL_CAPS: Record<Rarity, number> = {
  // 2026-05-19 (v1.432) — Bumped from 5 to 10. Cap-5 left tattered mons
  // unable to evolve at all because the v1.250 stage-0 evolution gate
  // is `growth_shard @ Lv10`. Players reported being stuck — release
  // / merge were the only ways to clear tattered slots. Cap-10 puts
  // tattered on par with common's ceiling so they can hit stage-0
  // evolution at all; the stat-range gap (see RARITY_STAT_RANGES
  // above) still keeps tattered as the visibly weakest tier.
  tattered:     10,
  common:       10,
  uncommon:     15,
  rare:         25,
  superior:     35,
  epic:         45,
  mythic:       55,
  legendary:    65,
  ancient:      75,
  celestial:    85,
  transcendent: 90,
  eternal:      95,
  prismatic:    98,
  divine:       99,
  omega:       100,
};

/** Lookup helper. Falls back to MAX_LEVEL for unknown rarity strings
 *  (defensive — shouldn't happen but cheap to be safe). */
export function getRarityLevelCap(rarity: Rarity | string | undefined): number {
  if (!rarity) return MAX_LEVEL;
  return RARITY_LEVEL_CAPS[rarity as Rarity] ?? MAX_LEVEL;
}

/**
 * Get the level a monster should be at given their XP. Optionally pass
 * `rarity` to clamp at the per-rarity cap. Without rarity this returns
 * the raw "where on the curve" level (still capped at MAX_LEVEL).
 */
export function levelFromXP(xp: number, rarity?: Rarity | string): number {
  let lvl = 1;
  for (let i = MAX_LEVEL; i >= 1; i--) {
    if (xp >= (XP_THRESHOLDS[i] ?? 0)) { lvl = i; break; }
  }
  if (rarity) {
    const cap = getRarityLevelCap(rarity);
    if (lvl > cap) lvl = cap;
  }
  return lvl;
}

/** XP needed for the next level (0 if at the rarity cap or absolute max). */
export function xpToNextLevel(xp: number, level: number, rarity?: Rarity | string): number {
  const cap = rarity ? getRarityLevelCap(rarity) : MAX_LEVEL;
  if (level >= cap) return 0;
  return (XP_THRESHOLDS[level + 1] ?? 0) - xp;
}

/** XP progress within current level as 0-1 fraction. Saturates at 1
 *  once the mon hits its rarity cap. */
export function xpProgress(xp: number, level: number, rarity?: Rarity | string): number {
  const cap = rarity ? getRarityLevelCap(rarity) : MAX_LEVEL;
  if (level >= cap) return 1;
  const currentThreshold = XP_THRESHOLDS[level] ?? 0;
  const nextThreshold = XP_THRESHOLDS[level + 1] ?? 1;
  const range = nextThreshold - currentThreshold;
  if (range <= 0) return 1;
  return Math.min(1, (xp - currentThreshold) / range);
}

/**
 * The abilities the card can actually use right now, given its level.
 * Other slots are still on the card data — they just don't appear in battle.
 */
export function unlockedAbilities(card: BattleCard): Ability[] {
  const lvl = card.level ?? 1;
  const stage = card.stage ?? 0;
  return card.abilities.filter((_, i) => isAbilityUnlocked(i, lvl, stage));
}

/** Convenience re-export so consumers don't need to dip into typeSystem. */
export { getArchetype };

/** Get effective stats for a monster at its current level (5% boost per level above 1) */
export function getEffectiveStats(card: BattleCard): MonsterStats {
  const baseStats = card.stats ?? { hp: 60, atk: 10, def: 5, spd: 3 };
  const level = card.level ?? 1;
  // v1.190 — bumped 5% → 10% per level so level differential actually
  // determines battle outcomes. With the old curve a Lv.10 mon was only
  // 1.45× a Lv.1 mon, and combined with ~6% per-level damage from
  // ability-power milestones, fights felt RNG-determined rather than
  // level-determined. At 10% the same Lv.10 mon hits ~1.9× the stats,
  // and combined with ability scaling does ~3.5× damage to a Lv.1 mon
  // — properly impactful. Tune this constant to dial level pressure
  // up or down (current playtest: 0.10 felt right).
  const mult = 1 + (level - 1) * 0.10;
  return {
    hp: Math.floor(baseStats.hp * mult),
    atk: Math.floor(baseStats.atk * mult),
    def: Math.floor((baseStats.def ?? 5) * mult),
    spd: Math.floor(baseStats.spd * mult),
  };
}

/** Get evolved ability power based on monster level. Milestones at 3, 5, 8 */
/** Default energy cost for abilities that predate the energy system */
function ensureEnergyCost(ability: Ability): number {
  if (typeof ability.energyCost === 'number') return ability.energyCost;
  // Legacy fallback: damage-signature and heal cost 2, quick/buff/debuff cost 1
  if (ability.type === 'heal') return 2;
  if (ability.type === 'damage' && ability.power >= 14) return 2;
  return 1;
}

/** Calculate estimated damage range for an ability (min-max without type advantage, plus crit max) */
export function getDamageRange(card: BattleCard, ability: Ability, atkBuff = 0): { min: number; max: number; critMax: number } {
  const eff = getEffectiveStats(card);
  const evolved = getEvolvedAbility(ability, card.level ?? 1);
  if (evolved.type !== 'damage') return { min: 0, max: 0, critMax: 0 };
  const buffedAtk = eff.atk + atkBuff;
  const base = evolved.power * (buffedAtk / 10);
  const min = Math.max(1, Math.floor(base * 0.9));
  const max = Math.max(1, Math.floor(base * 1.1));
  const critMax = Math.max(1, Math.floor(base * 1.1 * 1.5));
  return { min, max, critMax };
}

export function getEvolvedAbility(ability: Ability, level: number): Ability {
  const cost = ensureEnergyCost(ability);
  let bonus = 0;
  if (level >= 3) bonus += 2;
  if (level >= 5) bonus += 3;
  if (level >= 8) bonus += 5;
  if (bonus === 0 && cost === ability.energyCost) return ability;
  return { ...ability, power: ability.power + bonus, energyCost: cost };
}

/* ==================== BATTLE TIERS ==================== */

export type BattleTier = 'rookie' | 'challenger' | 'champion' | 'legend';

export const TIER_CONFIG: Record<BattleTier, {
  label: string;
  icon: string;
  color: string;
  statMult: number;
  xpMult: number;
  minRankXP: number;
}> = {
  rookie:     { label: 'Rookie',     icon: '\u2B50',       color: '#9e9e9e', statMult: 1.0, xpMult: 1.0, minRankXP: 0 },
  challenger: { label: 'Challenger', icon: '\u2B50\u2B50', color: '#4da6ff', statMult: 1.3, xpMult: 1.5, minRankXP: 100 },
  champion:   { label: 'Champion',   icon: '\uD83D\uDC51', color: '#b366ff', statMult: 1.6, xpMult: 2.0, minRankXP: 500 },
  legend:     { label: 'Legend',     icon: '\uD83C\uDFC6', color: '#ffd700', statMult: 2.0, xpMult: 3.0, minRankXP: 2000 },
};

export const TIER_ORDER: BattleTier[] = ['rookie', 'challenger', 'champion', 'legend'];

export type PlayerRank = BattleTier;

export function rankFromXP(totalXP: number): PlayerRank {
  if (totalXP >= 2000) return 'legend';
  if (totalXP >= 500) return 'champion';
  if (totalXP >= 100) return 'challenger';
  return 'rookie';
}

/* ==================== STATUS EFFECTS ==================== */

export type StatusEffect = 'burn' | 'freeze' | 'poison' | 'bleed' | 'stun' | 'confuse';

export interface ActiveStatus {
  type: StatusEffect;
  turnsLeft: number;
}

export const STATUS_CONFIG: Record<StatusEffect, {
  /** Flat HP damage applied at the start/end of the afflicted mon's turn. */
  dmgPerTurn: number;
  /** Number of turns the status persists after being applied. */
  duration: number;
  /** 0-1 chance the afflicted mon skips its action this turn (freeze/stun). */
  skipChance: number;
  /** 0-1 chance the mon hits itself with a weak attack instead of acting (confuse). */
  selfHitChance?: number;
  icon: string;
  label: string;
  color: string;
}> = {
  burn:    { dmgPerTurn: 5, duration: 3, skipChance: 0,    icon: '\uD83D\uDD25',                label: 'Burn',    color: '#ff4d4d' },
  freeze:  { dmgPerTurn: 0, duration: 2, skipChance: 0.30, icon: '\u2744\uFE0F',                 label: 'Freeze',  color: '#99ddff' },
  poison:  { dmgPerTurn: 3, duration: 4, skipChance: 0,    icon: '\u2620\uFE0F',                 label: 'Poison',  color: '#88cc44' },
  bleed:   { dmgPerTurn: 8, duration: 3, skipChance: 0,    icon: '\uD83E\uDE78',                 label: 'Bleed',   color: '#c71f1f' },
  stun:    { dmgPerTurn: 0, duration: 1, skipChance: 1.00, icon: '\u26A1',                       label: 'Stun',    color: '#ffee58' },
  confuse: { dmgPerTurn: 0, duration: 3, skipChance: 0, selfHitChance: 0.40, icon: '\uD83D\uDCAB', label: 'Confuse', color: '#d18bff' },
};

/** Which attacker properties can inflict which status */
export const STATUS_INFLICT_RULES: { property: string; status: StatusEffect; chance: number }[] = [
  { property: 'hot',       status: 'burn',    chance: 0.25 },
  { property: 'cold',      status: 'freeze',  chance: 0.20 },
  { property: 'corrosive', status: 'poison',  chance: 0.30 },
  { property: 'volatile',  status: 'burn',    chance: 0.15 },
  // New status-inflict rules reuse existing properties so no type data migration
  // is needed: sharp → bleed (steel/obsidian weapons), dense → stun (heavy
  // blunt impact from stone/steel), ethereal → confuse (spirits/mist/void).
  { property: 'sharp',     status: 'bleed',   chance: 0.22 },
  { property: 'dense',     status: 'stun',    chance: 0.15 },
  { property: 'ethereal',  status: 'confuse', chance: 0.22 },
];

/* ==================== UTILS ==================== */

/**
 * Player-create rarity roller. v1.158 — Legendary becomes the practical
 * top tier. Ancient and above were dropped to near-extinction (combined
 * 0.05%) after player feedback that Ancient was both too OP and too
 * common when it appeared. The 6 tiers above Ancient still exist in the
 * type system for legacy admin-published cards but are vanishingly
 * unlikely to roll naturally.
 *
 * Targets:
 *   Rare+ in ~22% of creates  (was ~45% pre-rebalance)
 *   Epic+ in ~5%              (was ~17%)
 *   Mythic+ in ~2%            (was ~10%)
 *   Legendary+ in ~0.55%      (was ~6%)
 *   Ancient+ in ~0.05%        (was ~3.2% — now basically a meme rarity)
 *
 * Cumulative thresholds (sum to 10000):
 *   omega        0..0       (0.000%)  ← practically zero
 *   divine       0..0       (0.000%)
 *   prismatic    0..1       (0.010%)
 *   eternal      1..1       (0.000%)
 *   transcendent 1..2       (0.010%)
 *   celestial    2..3       (0.010%)
 *   ancient      3..5       (0.020%)
 *   legendary    5..50      (0.45%)  → Legendary+ cumulative = 0.50%
 *   mythic       50..200    (1.50%)  → Mythic+    cumulative = 2.00%
 *   epic         200..500   (3.00%)  → Epic+      cumulative = 5.00%
 *   superior     500..1000  (5.00%)  → Superior+  cumulative = 10.0%
 *   rare         1000..2200 (12.0%)  → Rare+      cumulative = 22.0%
 *   uncommon     2200..5200 (30.0%)  → Uncommon+  cumulative = 52.0%
 *   common       5200..8800 (36.0%)
 *   tattered     8800..10000 (12.0%)
 */
export function rollRarity(): Rarity {
  const roll = Math.random() * 10000;
  if (roll < 1)    return 'prismatic';      // ~0.01%
  if (roll < 2)    return 'transcendent';   // ~0.01%
  if (roll < 3)    return 'celestial';      // ~0.01%
  if (roll < 5)    return 'ancient';        // ~0.02%
  if (roll < 50)   return 'legendary';      // ~0.45%
  if (roll < 200)  return 'mythic';         // ~1.50%
  if (roll < 500)  return 'epic';
  if (roll < 1000) return 'superior';
  if (roll < 2200) return 'rare';
  if (roll < 5200) return 'uncommon';
  if (roll < 8800) return 'common';
  return 'tattered';
}

export function rollStats(rarity: Rarity): MonsterStats {
  const ranges = RARITY_STAT_RANGES[rarity];
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  return { hp: rand(...ranges.hp), atk: rand(...ranges.atk), def: rand(...ranges.def), spd: rand(...ranges.spd) };
}

export function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Roll abilities for a given monster type and rarity */
export function rollAbilities(element: MonsterType): Ability[] {
  return generateAbilities(element, 'common');
}

/** Pick a random monster type from all 36 */
export function randomType(): MonsterType {
  return ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)]!;
}
