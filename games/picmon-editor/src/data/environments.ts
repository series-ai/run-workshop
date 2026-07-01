// Environments — biome presets the admin can pick when generating themed
// monsters and their matching backdrops. Each entry drives two things:
//
//   1. Wild monster generation (utils/cardGenerator → generateWildEnemy)
//      - Biases the element roll toward thematically-appropriate types
//      - Injects `monsterPrompt` into both the text-gen and image-gen prompts
//   2. Environment background art (utils/environmentBackgroundStore)
//      - Admin generates ONE shared backdrop per environment
//      - Stored in sharedStorage so every player sees the same image
//
// Adding a new biome: append an entry here + re-deploy. Nothing else needed —
// the admin UI lists every entry in this array.

import type { MonsterType } from './typeSystem';
import type { Rarity } from '../types/card';

/**
 * Difficulty / progression tier for a biome. Drives the rarity weighting
 * of wild encounters via WILD_RARITY_WEIGHTS so:
 *   tier 1 (starter)   → almost exclusively common/uncommon, mythic+ legendary
 *                        are <0.1% appearances per encounter.
 *   tier 2 (mid-game)  → Rare/Superior become normal, Epic occasionally,
 *                        Mythic/Legendary still uncommon but reachable.
 *   tier 3 (late-game) → Epic/Mythic/Legendary become viable encounters,
 *                        very-high tiers (Ancient+) start showing up.
 *
 * Adding a biome: pick a tier honestly — players will farm starter zones
 * and feel cheated if the curve is off. Update WILD_RARITY_WEIGHTS in
 * src/utils/wildRarityWeights.ts if you need a 4th tier later.
 */
export type EnvironmentTier = 1 | 2 | 3;

export interface EnvironmentDef {
  id: string;
  label: string;
  icon: string;
  /** Difficulty tier for this biome's wild encounter rarity curve. */
  tier: EnvironmentTier;
  /**
   * Short blurb surfaced in the admin picker + in tooltips. Plain English,
   * not LLM-facing.
   */
  blurb: string;
  /**
   * Elements that FEEL at home in this environment. The wild generator
   * picks from this list ~70% of the time (when the admin doesn't force a
   * specific type). The remainder falls through to the full 36-type pool
   * so you still get occasional surprises (a Fire mon in a snow biome, etc.).
   */
  typeBias: MonsterType[];
  /**
   * Extra context appended to the wild-enemy prompts (both the AI name /
   * description request AND the image-gen prompt). Keep it taut — one or
   * two descriptive sentences. Describes setting, mood, silhouette cues.
   */
  monsterPrompt: string;
  /**
   * Standalone prompt used to generate the environment's shared backdrop.
   * Written as a full, self-contained image brief. No character on the
   * backdrop — monsters render on top of it.
   */
  backgroundPrompt: string;
  /**
   * Inclusive level range for wild encounters in this biome. Distance
   * from the player's spawn point on the map subdivides this range
   * across 6 progressive tiers (closer to spawn = lower end of range,
   * further = upper end). Omit to fall back to the universal default
   * (1-20) — which keeps legacy maps' grass-patch tiers unchanged.
   */
  levelRange?: { min: number; max: number };
  /**
   * Inclusive rarity bounds for wild encounters in this biome. Mons
   * outside this range are filtered out by `pickWeightedWildEnemy`
   * BEFORE the rarity-tier weighting runs, so a forest biome capped at
   * "rare" never spawns an Epic even if the wild pool contains some.
   * Omit to allow the full ladder (capped only by tier weighting).
   */
  rarityRange?: { min: Rarity; max: Rarity };
  /**
   * v1.222 — When true, mons tagged with this environment are EXCLUDED
   * from every wild-encounter eligibility list (env-matching pool,
   * untagged general pool, and the full-pool emergency fallback). They
   * only surface through gacha pulls or other dedicated paths. Set on
   * the cosmos environment so stellar mons never spawn from grass.
   */
  packExclusive?: boolean;
}

export const ENVIRONMENTS: EnvironmentDef[] = [
  {
    id: 'cave',
    label: 'Cave',
    icon: '\u{1FAA8}', // rock
    tier: 2,
    blurb: 'Damp underground caverns, glowing crystals, stalactites, fungi.',
    typeBias: ['stone', 'crystal', 'fungus', 'shadow', 'bone', 'obsidian', 'spirit'],
    monsterPrompt:
      'The creature lives deep in a damp underground cavern with dripping stalactites, luminescent crystals, and mushroom patches. Its silhouette should feel at home in shadowy, mineral-rich darkness.',
    backgroundPrompt:
      'A moody underground cave interior. Dripping stalactites hang from a rocky ceiling, bioluminescent crystals pulse in teal and violet, mossy boulders and cracked stone on the ground, soft volumetric shafts of light. Painterly dark fantasy illustration, muted cool palette, no characters. 1:1 aspect ratio, empty stage where a monster would stand.',
    levelRange: { min: 10, max: 30 },
    rarityRange: { min: 'common', max: 'epic' },
  },
  {
    id: 'snow',
    label: 'Snow',
    icon: '\u2744\uFE0F',
    tier: 3,
    blurb: 'Frostbitten tundra, blizzards, pine forests, icy peaks.',
    typeBias: ['ice', 'mist', 'cloud', 'crystal', 'wind', 'spirit', 'light'],
    monsterPrompt:
      'The creature endures howling blizzards on a frost-locked tundra. Its body is dusted with snow, its fur or scales are pale and frost-tipped, and its presence feels cold, quiet, and patient.',
    backgroundPrompt:
      'A windswept snowy tundra at twilight. Fresh powder drifts, jagged icy peaks in the distance, scattered snow-laden pines, soft pink and blue sky, faint aurora in the clouds. Painterly fantasy illustration, cool palette with warm highlights, no characters. 1:1 aspect ratio, empty foreground stage.',
    levelRange: { min: 45, max: 65 },
    rarityRange: { min: 'rare', max: 'mythic' },
  },
  {
    id: 'forest',
    label: 'Forest',
    icon: '\u{1F332}',
    tier: 1,
    blurb: 'Ancient canopy, mossy roots, shafts of sunlight, glowflowers.',
    typeBias: ['nature', 'fungus', 'venom', 'spirit', 'wind', 'coral'],
    monsterPrompt:
      'The creature prowls an ancient, sun-dappled forest. Vines, moss, wildflowers, and patches of warm golden light inform its mood. Its body may have leafy, barky, or floral accents.',
    backgroundPrompt:
      'An ancient enchanted forest clearing at golden hour. Towering mossy trees, thick canopy broken by shafts of warm light, delicate glowing flowers on the forest floor, soft atmospheric haze. Painterly fantasy illustration, lush green-and-gold palette, no characters. 1:1 aspect ratio, empty foreground stage.',
    // v1.223 — extended top end from 20 to 25 so deep-forest patches
    // bridge cleanly into Cave (25-45). Starter area near villageruin
    // entry stays gentle (~Lv 1-4) thanks to the distance-from-spawn
    // tier algorithm in grassPatches.ts; the bump only affects the
    // farther patches near the cave-side and snow-side portals.
    levelRange: { min: 1, max: 25 },
    rarityRange: { min: 'tattered', max: 'rare' },
  },
  {
    // v1.225 — Dedicated environment for Forest 1 so the 20 hand-curated
    // mons in the 2026-04-30 seed are EXCLUSIVE to that map. Old `forest`
    // -tagged mons from earlier seeds become orphaned (no map uses
    // 'forest' anymore) and stop diluting the encounter pool.
    id: 'forest1',
    label: 'Forest 1',
    icon: '\u{1F332}',
    tier: 1,
    blurb: 'The starter forest path — exclusive curated encounter pool.',
    typeBias: ['nature', 'fungus', 'venom', 'spirit', 'wind', 'coral'],
    monsterPrompt:
      'The creature prowls an ancient, sun-dappled forest. Vines, moss, wildflowers, and patches of warm golden light inform its mood. Its body may have leafy, barky, or floral accents.',
    backgroundPrompt:
      'An ancient enchanted forest clearing at golden hour. Towering mossy trees, thick canopy broken by shafts of warm light, delicate glowing flowers on the forest floor, soft atmospheric haze. Painterly fantasy illustration, lush green-and-gold palette, no characters. 1:1 aspect ratio, empty foreground stage.',
    levelRange: { min: 1, max: 25 },
    rarityRange: { min: 'tattered', max: 'rare' },
  },
  {
    id: 'desert',
    label: 'Desert',
    icon: '\u{1F3DC}\uFE0F',
    tier: 2,
    blurb: 'Endless dunes, scorched sun, bleached bones, ancient ruins.',
    typeBias: ['sand', 'fire', 'lava', 'ash', 'bone', 'ember', 'furnace'],
    monsterPrompt:
      'The creature endures a blistering desert wasteland. Its body is adapted to heat and sand — weathered hide, sun-bleached scales, claws made for shifting dunes. Dry, dusty, hardened.',
    backgroundPrompt:
      'A vast desert vista at high noon. Wind-sculpted dunes stretch to the horizon, a scorched sun bleaches the sky into peach-and-ochre haze, distant rock spires and sun-bleached bones half-buried in sand. Painterly fantasy illustration, warm desaturated palette, no characters. 1:1 aspect ratio, empty foreground stage.',
  },
  {
    id: 'ruins',
    label: 'Ruins',
    icon: '\u{1F3DB}\uFE0F',
    tier: 3,
    blurb: 'Broken temples, ivy-choked stone, dust-motes, lost gods.',
    typeBias: ['stone', 'bone', 'shadow', 'crystal', 'ash', 'spirit', 'mirror'],
    monsterPrompt:
      'The creature haunts the toppled temples of a long-dead civilization. Cracked stone, ivy, dust, and faded murals frame its existence. It feels ancient, watchful, and slightly haunted.',
    backgroundPrompt:
      'An overgrown stone temple ruin at dusk. Toppled columns, cracked statuary, creeping ivy, moss, shattered tiles, dust motes in a single shaft of amber light. Painterly dark fantasy illustration, warm-stone palette with cool shadows, no characters. 1:1 aspect ratio, empty foreground stage.',
  },
  {
    id: 'volcano',
    label: 'Volcano',
    icon: '\u{1F30B}',
    tier: 3,
    blurb: 'Molten rivers, smoke plumes, obsidian cliffs, ember storms.',
    typeBias: ['fire', 'lava', 'furnace', 'ember', 'ash', 'obsidian', 'plasma'],
    monsterPrompt:
      'The creature stalks the slopes of an active volcano. Molten rivers, smoke plumes, glowing embers and blackened obsidian set its tone. Its body glows from within, or is armored in cooled magma.',
    backgroundPrompt:
      'A volcanic caldera at night. Rivers of molten lava carve through jagged obsidian cliffs, red smoke plumes rise into a starless sky, floating embers drift across the scene, distant eruption glow. Painterly dark fantasy illustration, fiery red-and-black palette, no characters. 1:1 aspect ratio, empty foreground stage.',
  },
  {
    id: 'frost_cave',
    label: 'Frost Cave',
    icon: '\u{1F9CA}',
    tier: 3,
    blurb: 'Ice-glazed caverns, rimed crystals, howling wind through fissures.',
    typeBias: ['ice', 'mist', 'crystal', 'spirit', 'cloud', 'wind', 'mirror'],
    monsterPrompt:
      'The creature haunts a cavern frozen solid \u2014 walls of blue ice, hoarfrost-rimed crystals, and a thin wind that carries snow flurries. Its body is lean and pale, eyes reflecting cold light; it moves quietly across the slick stone.',
    backgroundPrompt:
      'A subterranean ice cavern. Polished blue-white ice walls refract soft cyan light, hoarfrost-covered crystals jut from the floor, a narrow shaft of pale moonlight pierces through a fissure in the ceiling, drifting snow particles in the air. Painterly dark fantasy illustration, cool blue-and-violet palette, no characters. 1:1 aspect ratio, empty foreground stage.',
  },
  {
    // 2026-05-15 — Pharaoh's Awakening LTE pack-exclusive pool.
    //
    // Sister env to `cosmos`: NO map id is wired here in
    // MAP_ENVIRONMENTS so these mons never spawn from a grass patch.
    // They're populated by the Pharaoh admin sub-tab (publish-target
    // toggle set to "Pharaoh's Cache") and pulled exclusively via the
    // RUN-Bucks-priced "Pharaoh's Bundle" / "Pharaoh's Cache Pack" in
    // ShopModal.
    //
    // Distinct from the existing `desert` env which is the wild-grass
    // pool: regular Pharaoh mons spawn in desert encounters AND get
    // mixed into the in-game Pharaoh's Cache (Scarab Coin) pulls; the
    // `pharaohs_cache` env is the premium-only tier that never
    // surfaces outside paid pulls.
    id: 'pharaohs_cache',
    label: "Pharaoh's Cache",
    icon: '\u{1F451}',
    tier: 3,
    blurb: 'Sealed tomb-pool — premium pulls only, never spawns wild.',
    typeBias: ['sand', 'bone', 'ash', 'spirit', 'crystal', 'light', 'fire'],
    monsterPrompt:
      'A regal sealed-tomb Pharaonic creature — gold-encrusted, lapis-and-ruby inlays, hieroglyphs glowing along its body, an aura of ancient royalty. Stands posed as if just stepped from a sarcophagus.',
    backgroundPrompt:
      'The interior of a sealed pharaonic tomb. Towering gold-and-lapis sarcophagi lit by braziers, hieroglyphs glowing on every wall, dust motes drifting through shafts of warm torchlight. Painterly dark-fantasy illustration, royal gold-and-blue palette, no characters. 1:1 aspect ratio, empty foreground stage.',
    levelRange: { min: 25, max: 60 },
    rarityRange: { min: 'epic', max: 'legendary' },
    packExclusive: true,
  },
  {
    // v1.222 — Cosmos environment. Pack-exclusive: NO map is tagged
    // `cosmos` in MAP_ENVIRONMENTS so these mons never spawn from a
    // grass patch. They're populated by admin Wilds → type=stellar,
    // env=cosmos and surfaced exclusively via gacha pack pulls.
    id: 'cosmos',
    label: 'Cosmos',
    icon: '\u{1F31F}',
    tier: 3,
    blurb: 'Drifting nebulae, constellation-lit voids, comet-tail shimmer. Pack-exclusive.',
    typeBias: ['stellar', 'light', 'spirit', 'mirror', 'crystal', 'plasma'],
    monsterPrompt:
      'The creature drifts through a star-strewn void \u2014 its body mapped with constellations of glowing pinpricks, comet-tail wisps trailing behind, eyes lit with star-fire. Cosmic, regal, untouchable.',
    backgroundPrompt:
      'A deep-space nebula. Drifting cosmic clouds in violet and teal, dense starfields, distant galaxies, golden sunbeams cutting through dust, a halo of comet-tails arcing across the scene. Painterly cosmic fantasy illustration, saturated purple-and-gold palette, no characters. 1:1 aspect ratio, empty foreground stage.',
    levelRange: { min: 50, max: 80 },
    rarityRange: { min: 'rare', max: 'legendary' },
    packExclusive: true,
  },
  {
    // 2026-06-05 (v1.730) — Dojo Wilds. Outdoor grass biome that
    // surrounds the Trainer Tower entrance on the villageruin map.
    // Distinct from `martial_champion` (pack-exclusive 5-Pack pool)
    // — these mons spawn in tall grass that the player walks through
    // on their way to Marshal Vance, so the dojo approach has a
    // "training grounds" identity and the player can actually
    // capture martial mons without buying a pack.
    //
    // NOT pack-exclusive: GameCanvas's wild-encounter picker will
    // include `environment: 'martial'` cards on any map/patch tagged
    // for this env. Tier 2 / level 20-35 / rarityRange common→mythic
    // matches the late-game villageruin grass patches just north of
    // the dojo (existing grassPatchLevels at y=69-84 are level 20-34).
    //
    // Wired in via the new `grassPatchEnvOverrides` on villageruin —
    // each of the 7 northwest patches close to the dojo entrance is
    // tagged 'martial', so the env-pool branch in GameCanvas merges
    // martial mons with the general pool at the standard 3× weight.
    // Starter-area patches (south of y=50) are untouched, so the
    // FTUE wilds stay generic.
    id: 'martial',
    label: 'Dojo Wilds',
    icon: '\u{1F44A}',
    tier: 2,
    blurb: 'Tall grass outside the Trainer Tower. Martial mons train openly here.',
    typeBias: ['martial'],
    monsterPrompt:
      'A combat-arts creature out on its morning kata \u2014 wrapped fists, sweat-darkened headband, ready stance. Trained, focused, mid-form.',
    backgroundPrompt:
      'A grassy clearing outside a tiered pagoda tower. Cherry blossom petals on the wind, training dummies in the middle distance, banners snapping in the breeze. Painterly cartoon illustration, golden-hour palette, no characters. 1:1 aspect ratio, empty foreground stage.',
    levelRange: { min: 20, max: 35 },
    rarityRange: { min: 'common', max: 'mythic' },
    packExclusive: false,
  },
  {
    // 2026-06-04 (v1.703) \u2014 Martial Pack guaranteed-mon pool.
    //
    // Sister env to `cosmos` / `pharaohs_cache`: NO map id is wired
    // here in MAP_ENVIRONMENTS so these mons never spawn from a grass
    // patch, and `pickWildMatch` in `trainerMons.ts` filters out pack-
    // exclusive envs so tower trainers never lead with one either.
    // Surfaces ONLY via the Martial 5-Pack `guaranteedCardId` grant
    // (single Martial Pack does not draw from this env).
    id: 'martial_champion',
    label: 'Martial Champion',
    icon: '\u{1F44A}',
    tier: 3,
    blurb: 'Tower champion pool \u2014 5-Pack guaranteed pulls only, never spawns wild.',
    typeBias: ['martial'],
    monsterPrompt:
      'A regal fighting-arts grandmaster creature \u2014 horned, bronze-bound, fists wreathed in copper energy. Stands posed as the tower champion.',
    backgroundPrompt:
      'A torch-lit tower arena. Crimson banners draped from stone columns, bronze gongs, a polished combat floor scattered with chalk dust. Painterly dark-fantasy illustration, bronze-and-crimson palette, no characters. 1:1 aspect ratio, empty foreground stage.',
    levelRange: { min: 30, max: 60 },
    rarityRange: { min: 'epic', max: 'mythic' },
    packExclusive: true,
  },
];

export type EnvironmentId = (typeof ENVIRONMENTS)[number]['id'];

export function getEnvironment(id: string | undefined | null): EnvironmentDef | null {
  if (!id) return null;
  return ENVIRONMENTS.find((e) => e.id === id) ?? null;
}

/**
 * Map world map IDs to the environment players encounter on them.
 *
 * Used by the wild-spawn picker in GameCanvas: when the player is on a
 * map listed here, ONLY wild pool entries tagged with the matching
 * `environment` will spawn. Maps not listed use the general pool
 * (entries without an environment tag).
 *
 * Add an entry whenever a new themed map ships (e.g. `snow_town: 'snow'`).
 */
export const MAP_ENVIRONMENTS: Record<string, EnvironmentId> = {
  // v1.252 — villageruin (the very first map players see) intentionally
  // does NOT map to an environment. It falls through to grassPatches.ts'
  // DEFAULT_LEVEL_RANGE of {min:1,max:8} so the starter village stays
  // gentle. Mapping it to 'forest1' previously forced 15-25 levels at
  // spawn, which was way too tough for fresh players.
  cave1: 'cave',
  snow_town: 'snow',
  Forest1: 'forest1',
  // 2026-05-13 — Pharaoh's Awakening LTE. Wiring both desert maps to
  // the existing `desert` environment turns on:
  //   • Themed wild encounter pool (typeBias sand/fire/ash/bone)
  //   • Tier 2 rarity weights
  //   • Sand-drift ambient particles from `ambientFx.ts` (the
  //     ZONE_AMBIENT.desert entry was previously dormant)
  // Both maps reuse the same env id; level scaling stays consistent
  // across the city and the wilds.
  desert_city: 'desert',
  desert_wilds: 'desert',
};

/** Resolve the environment for the given mapId, or null if untagged. */
export function getMapEnvironment(mapId: string | undefined | null): EnvironmentId | null {
  if (!mapId) return null;
  return MAP_ENVIRONMENTS[mapId] ?? null;
}

/** v1.222 — Set of environment ids whose mons are gacha-pack-exclusive
 *  (cosmos at minimum). Wild encounter pickers should filter these out
 *  of every eligibility list, including the emergency full-pool
 *  fallback, so pack-exclusive mons never leak into grass spawns. */
export const PACK_EXCLUSIVE_ENVIRONMENTS: Set<string> = new Set(
  ENVIRONMENTS.filter((e) => e.packExclusive).map((e) => e.id),
);

/** True iff the given env id is gacha-pack-exclusive. */
export function isPackExclusiveEnvironment(env: string | undefined | null): boolean {
  if (!env) return false;
  return PACK_EXCLUSIVE_ENVIRONMENTS.has(env);
}
