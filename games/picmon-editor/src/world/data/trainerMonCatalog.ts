// Curated catalog of trainer-exclusive PicMon. Sourced from the
// 2026-04-24 wild-enemy-pool export, hand-picked so trainers can field
// unique monsters (not shared with the wild pool) across the full power
// curve. Each entry carries its FULL art/stats/abilities so runtime battles
// are stable and consistent — no random re-rolls per encounter.
//
// Used by `buildTrainerMon` when a TrainerMonSpec declares `specId`. The
// spec's `level` is still authoritative so the SAME unique mon can appear
// at low level for a starter trainer and high level for a champion.

import type { Ability, Rarity } from '../../types/card';
import type { MonsterType } from '../../data/typeSystem';

export interface TrainerMonCatalogEntry {
  id: string;
  name: string;
  description: string;
  element: MonsterType;
  rarity: Rarity;
  imageUrl: string;
  /** Base stats at level 1 (getEffectiveStats scales these per trainer level). */
  stats: { hp: number; atk: number; def: number; spd: number };
  abilities: Ability[];
}

export const TRAINER_MON_CATALOG: Record<string, TrainerMonCatalogEntry> = {
  /* ───────── Tier 1 — starter trainer mons (common/uncommon) ───────── */
  basalt_brawler: {
    id: 'basalt_brawler',
    name: 'Basalt Brawler',
    description: "A punchy pebble beast with a face full of grit.",
    element: 'stone',
    rarity: 'common',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/T3U96xfHz0IT4BkY6eVQ/NRA8QxNVWHPSrwsQq8sNzsar5qu1/10d3fb91-1b68-4a33-8129-2750b972ba42.png',
    stats: { hp: 55, atk: 10, def: 5, spd: 2 },
    abilities: [
      { id: 'stone_0', name: 'Rock Throw',    type: 'damage', power: 12, element: 'stone', energyCost: 1 },
      { id: 'stone_1', name: 'Boulder Slam',  type: 'damage', power: 19, element: 'stone', energyCost: 2 },
      { id: 'stone_2', name: 'Pebble Rest',   type: 'heal',   power: 14, element: 'stone', energyCost: 2 },
      { id: 'stone_3', name: 'Fortify Wall',  type: 'buff',   power: 3,  element: 'stone', energyCost: 1 },
      { id: 'stone_4', name: 'Crush Weight',  type: 'debuff', power: 3,  element: 'stone', energyCost: 1 },
    ],
  },
  cinder_mite: {
    id: 'cinder_mite',
    name: 'Cinder Mite',
    description: 'A tiny ember bug that snacks on campfire jokes.',
    element: 'fire',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/26de5051-2cf6-46b5-91f8-af202b20374c.png',
    stats: { hp: 73, atk: 10, def: 5, spd: 2 },
    abilities: [
      { id: 'fire_0', name: 'Flicker Snap',   type: 'damage', power: 12, element: 'fire', energyCost: 1 },
      { id: 'fire_1', name: 'Inferno Surge',  type: 'damage', power: 19, element: 'fire', energyCost: 2 },
      { id: 'fire_2', name: 'Warm Embrace',   type: 'heal',   power: 14, element: 'fire', energyCost: 2 },
      { id: 'fire_3', name: 'Blaze Up',       type: 'buff',   power: 3,  element: 'fire', energyCost: 1 },
      { id: 'fire_4', name: 'Scorch Bane',    type: 'debuff', power: 3,  element: 'fire', energyCost: 1 },
    ],
  },
  frost_mite: {
    id: 'frost_mite',
    name: 'Frost Mite',
    description: 'A tiny chill gremlin that nips toes and confidence.',
    element: 'ice',
    rarity: 'common',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/fcce8dc7-fc14-4f54-aa4e-a8383f5b3a85.png',
    stats: { hp: 67, atk: 12, def: 5, spd: 2 },
    abilities: [
      { id: 'ice_0', name: 'Frost Bite',        type: 'damage', power: 12, element: 'ice', energyCost: 1 },
      { id: 'ice_1', name: 'Glacier Crush',     type: 'damage', power: 19, element: 'ice', energyCost: 2 },
      { id: 'ice_2', name: 'Chill Mend',        type: 'heal',   power: 14, element: 'ice', energyCost: 2 },
      { id: 'ice_3', name: 'Permafrost Armor',  type: 'buff',   power: 3,  element: 'ice', energyCost: 1 },
      { id: 'ice_4', name: 'Numb Grip',         type: 'debuff', power: 3,  element: 'ice', energyCost: 1 },
    ],
  },

  /* ───────── Early-game trainer mons ───────── */
  thornveil_hex: {
    id: 'thornveil_hex',
    name: 'Thornveil Hex',
    description: 'A venomous thorn beast that poisons the air around it.',
    element: 'venom',
    rarity: 'common',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/d2e394d6-8c38-4d03-a778-2f0f73a11f58.png',
    stats: { hp: 70, atk: 10, def: 5, spd: 2 },
    abilities: [
      { id: 'ven_0', name: 'Fang Strike',    type: 'damage', power: 12, element: 'venom', energyCost: 1 },
      { id: 'ven_1', name: 'Toxin Spray',    type: 'damage', power: 19, element: 'venom', energyCost: 2 },
      { id: 'ven_2', name: 'Viper Sap',      type: 'heal',   power: 14, element: 'venom', energyCost: 2 },
      { id: 'ven_3', name: 'Envenom Coat',   type: 'buff',   power: 3,  element: 'venom', energyCost: 1 },
      { id: 'ven_4', name: 'Toxin Sap',      type: 'debuff', power: 3,  element: 'venom', energyCost: 1 },
    ],
  },
  thunderfluff_warden: {
    id: 'thunderfluff_warden',
    name: 'Thunderfluff Warden',
    description: 'A puffy cloud beast that crackles with static.',
    element: 'cloud',
    rarity: 'common',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/2bcb1456-73ff-48d9-a264-6f6861f99dfc.png',
    stats: { hp: 75, atk: 10, def: 5, spd: 2 },
    abilities: [
      { id: 'cld_0', name: 'Nimbus Strike',  type: 'damage', power: 12, element: 'cloud', energyCost: 1 },
      { id: 'cld_1', name: 'Cirrus Burst',   type: 'damage', power: 19, element: 'cloud', energyCost: 2 },
      { id: 'cld_2', name: 'Drizzle Mend',   type: 'heal',   power: 14, element: 'cloud', energyCost: 2 },
      { id: 'cld_3', name: 'Cumulus Puff',    type: 'buff',   power: 3,  element: 'cloud', energyCost: 1 },
      { id: 'cld_4', name: 'Obscure Haze',   type: 'debuff', power: 3,  element: 'cloud', energyCost: 1 },
    ],
  },
  briarglow_stag: {
    id: 'briarglow_stag',
    name: 'Briarglow Stag',
    description: 'A majestic forest guardian with antlers of living wood.',
    element: 'nature',
    rarity: 'common',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/1fd5ef34-2f39-4851-8772-aec8e0e648b7.png',
    stats: { hp: 75, atk: 10, def: 6, spd: 2 },
    abilities: [
      { id: 'nat_0', name: 'Thorn Lash',      type: 'damage', power: 12, element: 'nature', energyCost: 1 },
      { id: 'nat_1', name: 'Vine Crush',      type: 'damage', power: 19, element: 'nature', energyCost: 2 },
      { id: 'nat_2', name: 'Photo Synthesis',  type: 'heal',   power: 14, element: 'nature', energyCost: 2 },
      { id: 'nat_3', name: 'Spore Burst',     type: 'buff',   power: 3,  element: 'nature', energyCost: 1 },
      { id: 'nat_4', name: 'Tangle Root',     type: 'debuff', power: 3,  element: 'nature', energyCost: 1 },
    ],
  },
  galebloom_spriggan: {
    id: 'galebloom_spriggan',
    name: 'Galebloom Spriggan',
    description: 'A wind-borne forest sprite with petal-blade wings.',
    element: 'wind',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/160cff23-5def-4105-986e-f7b1f10bd9c4.png',
    stats: { hp: 80, atk: 11, def: 6, spd: 3 },
    abilities: [
      { id: 'wnd_e0', name: 'Gust Slash',    type: 'damage', power: 12, element: 'wind', energyCost: 1 },
      { id: 'wnd_e1', name: 'Cyclone Fury',  type: 'damage', power: 19, element: 'wind', energyCost: 2 },
      { id: 'wnd_e2', name: 'Breeze Kiss',   type: 'heal',   power: 14, element: 'wind', energyCost: 2 },
      { id: 'wnd_e3', name: 'Uplift Draft',  type: 'buff',   power: 3,  element: 'wind', energyCost: 1 },
      { id: 'wnd_e4', name: 'Gale Stagger',  type: 'debuff', power: 3,  element: 'wind', energyCost: 1 },
    ],
  },
  lantern_wisp: {
    id: 'lantern_wisp',
    name: 'Lantern Wisp',
    description: 'A ghostly lantern-bearer that drifts through the trees.',
    element: 'spirit',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/T3U96xfHz0IT4BkY6eVQ/NRA8QxNVWHPSrwsQq8sNzsar5qu1/849e30d5-48e5-42c3-980c-19ddf2e3a020.png',
    stats: { hp: 78, atk: 11, def: 6, spd: 3 },
    abilities: [
      { id: 'spr_e0', name: 'Haunt Grasp',   type: 'damage', power: 12, element: 'spirit', energyCost: 1 },
      { id: 'spr_e1', name: 'Phantom Wail',  type: 'damage', power: 19, element: 'spirit', energyCost: 2 },
      { id: 'spr_e2', name: 'Ethereal Mend', type: 'heal',   power: 14, element: 'spirit', energyCost: 2 },
      { id: 'spr_e3', name: 'Commune Link',  type: 'buff',   power: 3,  element: 'spirit', energyCost: 1 },
      { id: 'spr_e4', name: 'Haunt Fear',    type: 'debuff', power: 3,  element: 'spirit', energyCost: 1 },
    ],
  },
  mossmire_bloom: {
    id: 'mossmire_bloom',
    name: 'Mossmire Bloom',
    description: 'A sly sporebeast that pounces from the undergrowth.',
    element: 'fungus',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/a6fc72b3-d4cf-4223-a268-ec215ac63ba2.png',
    stats: { hp: 80, atk: 11, def: 6, spd: 2 },
    abilities: [
      { id: 'fun_0', name: 'Mycel Whip',      type: 'damage', power: 12, element: 'fungus', energyCost: 1 },
      { id: 'fun_1', name: 'Rot Cloud',       type: 'damage', power: 19, element: 'fungus', energyCost: 2 },
      { id: 'fun_2', name: 'Spore Drain',     type: 'heal',   power: 14, element: 'fungus', energyCost: 2 },
      { id: 'fun_3', name: 'Decompose Bloom', type: 'buff',   power: 3,  element: 'fungus', energyCost: 1 },
      { id: 'fun_4', name: 'Spore Rot',       type: 'debuff', power: 3,  element: 'fungus', energyCost: 1 },
    ],
  },

  /* ───────── Hunter Ryx's pack — low-level rares ───────── */
  nimbus_prowler: {
    id: 'nimbus_prowler',
    name: 'Nimbus Prowler',
    description: 'A sneaky cloud cat that pounces from fog banks.',
    element: 'cloud',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/d21c0a84-90e3-46fd-9354-b7ae0de816b9.png',
    stats: { hp: 90, atk: 12, def: 6, spd: 3 },
    abilities: [
      { id: 'cloud_0', name: 'Nimbus Strike',  type: 'damage', power: 12, element: 'cloud', energyCost: 1 },
      { id: 'cloud_1', name: 'Cirrus Burst',   type: 'damage', power: 19, element: 'cloud', energyCost: 2 },
      { id: 'cloud_2', name: 'Drizzle Mend',   type: 'heal',   power: 14, element: 'cloud', energyCost: 2 },
      { id: 'cloud_3', name: 'Cumulus Puff',    type: 'buff',   power: 3,  element: 'cloud', energyCost: 1 },
      { id: 'cloud_4', name: 'Obscure Haze',   type: 'debuff', power: 3,  element: 'cloud', energyCost: 1 },
    ],
  },
  sporecap_lurker: {
    id: 'sporecap_lurker',
    name: 'Sporecap Lurker',
    description: 'A sly sporebeast that perfumes the forest then pounces.',
    element: 'fungus',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/a6fc72b3-d4cf-4223-a268-ec215ac63ba2.png',
    stats: { hp: 95, atk: 11, def: 7, spd: 2 },
    abilities: [
      { id: 'fungus_0', name: 'Mycel Whip',       type: 'damage', power: 12, element: 'fungus', energyCost: 1 },
      { id: 'fungus_1', name: 'Rot Cloud',        type: 'damage', power: 19, element: 'fungus', energyCost: 2 },
      { id: 'fungus_2', name: 'Spore Drain',      type: 'heal',   power: 14, element: 'fungus', energyCost: 2 },
      { id: 'fungus_3', name: 'Decompose Bloom',  type: 'buff',   power: 3,  element: 'fungus', energyCost: 1 },
      { id: 'fungus_4', name: 'Spore Rot',        type: 'debuff', power: 3,  element: 'fungus', energyCost: 1 },
    ],
  },
  briarspike_viper: {
    id: 'briarspike_viper',
    name: 'Briarspike Viper',
    description: 'A grinning vine-serpent that leaves itchy doom.',
    element: 'venom',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/41cc0166-7abf-4393-a91f-9ae65e024727.png',
    stats: { hp: 80, atk: 13, def: 5, spd: 3 },
    abilities: [
      { id: 'venom_0', name: 'Fang Strike',     type: 'damage', power: 12, element: 'venom', energyCost: 1 },
      { id: 'venom_1', name: 'Toxin Spray',     type: 'damage', power: 19, element: 'venom', energyCost: 2 },
      { id: 'venom_2', name: 'Viper Sap',       type: 'heal',   power: 14, element: 'venom', energyCost: 2 },
      { id: 'venom_3', name: 'Envenom Coat',    type: 'buff',   power: 3,  element: 'venom', energyCost: 1 },
      { id: 'venom_4', name: 'Toxin Sap',       type: 'debuff', power: 3,  element: 'venom', energyCost: 1 },
    ],
  },

  /* ───────── Tier 2 — mid-game trainer mons (rare/uncommon) ───────── */
  mossfang_sprite: {
    id: 'mossfang_sprite',
    name: 'Mossfang Sprite',
    description: "A tiny terror that bites with the forest's grin.",
    element: 'nature',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/0a787f02-bde3-4000-8982-5ab4a0da9ba0.png',
    stats: { hp: 95, atk: 12, def: 7, spd: 2 },
    abilities: [
      { id: 'nature_0', name: 'Thorn Lash',       type: 'damage', power: 12, element: 'nature', energyCost: 1 },
      { id: 'nature_1', name: 'Vine Crush',       type: 'damage', power: 19, element: 'nature', energyCost: 2 },
      { id: 'nature_2', name: 'Photo Synthesis',  type: 'heal',   power: 14, element: 'nature', energyCost: 2 },
      { id: 'nature_3', name: 'Spore Burst',      type: 'buff',   power: 3,  element: 'nature', energyCost: 1 },
      { id: 'nature_4', name: 'Tangle Root',      type: 'debuff', power: 3,  element: 'nature', energyCost: 1 },
    ],
  },
  caustic_nibbler: {
    id: 'caustic_nibbler',
    name: 'Caustic Nibbler',
    description: 'Tiny menace that eats armor and burps bubbles.',
    element: 'acid',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/2bb29f81-d0af-4822-b534-bded4aba32e3.png',
    stats: { hp: 98, atk: 12, def: 5, spd: 3 },
    abilities: [
      { id: 'acid_0', name: 'Spit Splash',      type: 'damage', power: 12, element: 'acid', energyCost: 1 },
      { id: 'acid_1', name: 'Acid Rain',        type: 'damage', power: 19, element: 'acid', energyCost: 2 },
      { id: 'acid_2', name: 'Corrode Mend',     type: 'heal',   power: 14, element: 'acid', energyCost: 2 },
      { id: 'acid_3', name: 'Toxify Coat',      type: 'buff',   power: 3,  element: 'acid', energyCost: 1 },
      { id: 'acid_4', name: 'Erode Burn',       type: 'debuff', power: 3,  element: 'acid', energyCost: 1 },
    ],
  },
  arc_snail: {
    id: 'arc_snail',
    name: 'Arc Snail',
    description: 'A zappy slug that leaves glowing scorch trails.',
    element: 'plasma',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/c1viNIE15iM0flBA3Ztp/NRA8QxNVWHPSrwsQq8sNzsar5qu1/d37005e4-010c-4a46-93e9-696eafae04f9.png',
    stats: { hp: 69, atk: 12, def: 6, spd: 3 },
    abilities: [
      { id: 'plasma_0', name: 'Arc Flash',         type: 'damage', power: 12, element: 'plasma', energyCost: 1 },
      { id: 'plasma_1', name: 'Plasma Cannon',     type: 'damage', power: 19, element: 'plasma', energyCost: 2 },
      { id: 'plasma_2', name: 'Ion Bath',          type: 'heal',   power: 14, element: 'plasma', energyCost: 2 },
      { id: 'plasma_3', name: 'Supercharge Core',  type: 'buff',   power: 3,  element: 'plasma', energyCost: 1 },
      { id: 'plasma_4', name: 'Overload Crash',    type: 'debuff', power: 3,  element: 'plasma', energyCost: 1 },
    ],
  },

  /* ───────── Five Pillars Dojo — curated disciple signature mons ───────── */

  // Daichi the Stoneheart (stone/obsidian/steel)
  gloombark_prism: {
    id: 'gloombark_prism',
    name: 'Gloombark Prism',
    description: 'A volcanic glass titan that reflects your fear back at you.',
    element: 'obsidian',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/edd7d73d-f7b5-4f59-bc7c-7f7947f1c156.png',
    stats: { hp: 100, atk: 14, def: 9, spd: 3 },
    abilities: [
      { id: 'obs_0', name: 'Glass Edge',       type: 'damage', power: 12, element: 'obsidian', energyCost: 1 },
      { id: 'obs_1', name: 'Obsidian Shatter',  type: 'damage', power: 19, element: 'obsidian', energyCost: 2 },
      { id: 'obs_2', name: 'Volcanic Seal',     type: 'heal',   power: 14, element: 'obsidian', energyCost: 2 },
      { id: 'obs_3', name: 'Darkforge Ward',    type: 'buff',   power: 3,  element: 'obsidian', energyCost: 1 },
      { id: 'obs_4', name: 'Splinter Wound',    type: 'debuff', power: 3,  element: 'obsidian', energyCost: 1 },
    ],
  },
  rivet_gremlin: {
    id: 'rivet_gremlin',
    name: 'Rivet Gremlin',
    description: 'A gear-crunching pest that eats armor for breakfast.',
    element: 'steel',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/97083dd5-2f07-46a5-a9fc-4cd3c850e210.png',
    stats: { hp: 90, atk: 14, def: 7, spd: 3 },
    abilities: [
      { id: 'stl_0', name: 'Blade Slash',      type: 'damage', power: 12, element: 'steel', energyCost: 1 },
      { id: 'stl_1', name: 'Iron Crash',       type: 'damage', power: 19, element: 'steel', energyCost: 2 },
      { id: 'stl_2', name: 'Rivet Patch',      type: 'heal',   power: 14, element: 'steel', energyCost: 2 },
      { id: 'stl_3', name: 'Reinforce Plate',  type: 'buff',   power: 3,  element: 'steel', energyCost: 1 },
      { id: 'stl_4', name: 'Rust Corrosion',   type: 'debuff', power: 3,  element: 'steel', energyCost: 1 },
    ],
  },
  mossgraft_brute: {
    id: 'mossgraft_brute',
    name: 'Mossgraft Brute',
    description: 'A moss-covered boulder that punches like a landslide.',
    element: 'stone',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/71832cad-c356-4d2e-bf86-b60c4d3115f4.png',
    stats: { hp: 85, atk: 12, def: 7, spd: 2 },
    abilities: [
      { id: 'stn_0', name: 'Rock Throw',    type: 'damage', power: 12, element: 'stone', energyCost: 1 },
      { id: 'stn_1', name: 'Boulder Slam',  type: 'damage', power: 19, element: 'stone', energyCost: 2 },
      { id: 'stn_2', name: 'Pebble Rest',   type: 'heal',   power: 14, element: 'stone', energyCost: 2 },
      { id: 'stn_3', name: 'Fortify Wall',  type: 'buff',   power: 3,  element: 'stone', energyCost: 1 },
      { id: 'stn_4', name: 'Crush Weight',  type: 'debuff', power: 3,  element: 'stone', energyCost: 1 },
    ],
  },

  // Tsubaki the Tidebound (water/ice/mist)
  blizzard_warden: {
    id: 'blizzard_warden',
    name: 'Blizzard Warden',
    description: 'A frost sentinel that guards the frozen passes.',
    element: 'ice',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/12607da4-1129-4349-90a6-6e8c9479db6c.png',
    stats: { hp: 105, atk: 14, def: 9, spd: 3 },
    abilities: [
      { id: 'ice_d0', name: 'Frost Bite',       type: 'damage', power: 12, element: 'ice', energyCost: 1 },
      { id: 'ice_d1', name: 'Glacier Crush',    type: 'damage', power: 19, element: 'ice', energyCost: 2 },
      { id: 'ice_d2', name: 'Chill Mend',       type: 'heal',   power: 14, element: 'ice', energyCost: 2 },
      { id: 'ice_d3', name: 'Permafrost Armor', type: 'buff',   power: 3,  element: 'ice', energyCost: 1 },
      { id: 'ice_d4', name: 'Numb Grip',        type: 'debuff', power: 3,  element: 'ice', energyCost: 1 },
    ],
  },
  glacier_wisp: {
    id: 'glacier_wisp',
    name: 'Glacier Wisp',
    description: 'A haunting fog spirit that freezes the air itself.',
    element: 'mist',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/47963392-463e-4ab6-af28-cfcebb5d2c8d.png',
    stats: { hp: 95, atk: 13, def: 8, spd: 4 },
    abilities: [
      { id: 'mst_0', name: 'Fog Touch',      type: 'damage', power: 12, element: 'mist', energyCost: 1 },
      { id: 'mst_1', name: 'Haze Blanket',   type: 'damage', power: 19, element: 'mist', energyCost: 2 },
      { id: 'mst_2', name: 'Dew Drop',       type: 'heal',   power: 14, element: 'mist', energyCost: 2 },
      { id: 'mst_3', name: 'Obscure Veil',   type: 'buff',   power: 3,  element: 'mist', energyCost: 1 },
      { id: 'mst_4', name: 'Fog Blind',      type: 'debuff', power: 3,  element: 'mist', energyCost: 1 },
    ],
  },
  brinefin_trickster: {
    id: 'brinefin_trickster',
    name: 'Brinefin Trickster',
    description: 'A slippery saltwater imp that fights dirty.',
    element: 'water',
    rarity: 'uncommon',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/6aca8fef-461c-4974-bb8e-20606bf1db3b.png',
    stats: { hp: 85, atk: 12, def: 6, spd: 3 },
    abilities: [
      { id: 'wtr_0', name: 'Splash Shot',    type: 'damage', power: 12, element: 'water', energyCost: 1 },
      { id: 'wtr_1', name: 'Tidal Wave',     type: 'damage', power: 19, element: 'water', energyCost: 2 },
      { id: 'wtr_2', name: 'Bubble Shield',  type: 'heal',   power: 14, element: 'water', energyCost: 2 },
      { id: 'wtr_3', name: 'Current Flow',   type: 'buff',   power: 3,  element: 'water', energyCost: 1 },
      { id: 'wtr_4', name: 'Drench Hex',     type: 'debuff', power: 3,  element: 'water', energyCost: 1 },
    ],
  },

  // Kaen the Emberheart (fire/lava/ember)
  emberbloom_golem: {
    id: 'emberbloom_golem',
    name: 'Emberbloom Golem',
    description: 'A molten giant whose footsteps birth wildfires.',
    element: 'lava',
    rarity: 'epic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/906f4e3d-37d4-468a-b33a-2c6887bf91f8.png',
    stats: { hp: 110, atk: 16, def: 10, spd: 3 },
    abilities: [
      { id: 'lav_d0', name: 'Molten Spit',     type: 'damage', power: 12, element: 'lava', energyCost: 1 },
      { id: 'lav_d1', name: 'Eruption Blast',  type: 'damage', power: 19, element: 'lava', energyCost: 2 },
      { id: 'lav_d2', name: 'Magma Soak',      type: 'heal',   power: 14, element: 'lava', energyCost: 2 },
      { id: 'lav_d3', name: 'Harden Shell',    type: 'buff',   power: 3,  element: 'lava', energyCost: 1 },
      { id: 'lav_d4', name: 'Melt Doom',       type: 'debuff', power: 3,  element: 'lava', energyCost: 1 },
    ],
  },
  cinderjack_imp: {
    id: 'cinderjack_imp',
    name: 'Cinderjack Imp',
    description: 'A wicked little spark that dances in the embers.',
    element: 'ember',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/a3b8e7ee-181e-41b3-9b2a-1795af3a1daf.png',
    stats: { hp: 90, atk: 14, def: 7, spd: 3 },
    abilities: [
      { id: 'emb_0', name: 'Spark Toss',     type: 'damage', power: 12, element: 'ember', energyCost: 1 },
      { id: 'emb_1', name: 'Wildfire Wave',  type: 'damage', power: 19, element: 'ember', energyCost: 2 },
      { id: 'emb_2', name: 'Smolder Glow',   type: 'heal',   power: 14, element: 'ember', energyCost: 2 },
      { id: 'emb_3', name: 'Kindle Spirit',  type: 'buff',   power: 3,  element: 'ember', energyCost: 1 },
      { id: 'emb_4', name: 'Singe Curse',    type: 'debuff', power: 3,  element: 'ember', energyCost: 1 },
    ],
  },

  // Hayate the Stormblade (wind/thunder/storm)
  thunderwisp_tyrant: {
    id: 'thunderwisp_tyrant',
    name: 'Thunderwisp Tyrant',
    description: 'A crackling storm lord that commands the sky.',
    element: 'storm',
    rarity: 'epic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/863dcecc-2e55-48b1-ae11-d32a045f3a55.png',
    stats: { hp: 105, atk: 16, def: 9, spd: 4 },
    abilities: [
      { id: 'str_0', name: 'Tempest Bolt',   type: 'damage', power: 12, element: 'storm', energyCost: 1 },
      { id: 'str_1', name: 'Maelstrom Fury', type: 'damage', power: 19, element: 'storm', energyCost: 2 },
      { id: 'str_2', name: 'Squall Eye',     type: 'heal',   power: 14, element: 'storm', energyCost: 2 },
      { id: 'str_3', name: 'Charge Front',   type: 'buff',   power: 3,  element: 'storm', energyCost: 1 },
      { id: 'str_4', name: 'Tempest Ruin',   type: 'debuff', power: 3,  element: 'storm', energyCost: 1 },
    ],
  },
  galefern_sprite: {
    id: 'galefern_sprite',
    name: 'Galefern Sprite',
    description: 'A forest wind spirit that slices with leaf-blades.',
    element: 'wind',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/75fc719c-b555-48ee-9426-b4ee091d8983.png',
    stats: { hp: 95, atk: 13, def: 8, spd: 4 },
    abilities: [
      { id: 'wnd_0', name: 'Gust Slash',     type: 'damage', power: 12, element: 'wind', energyCost: 1 },
      { id: 'wnd_1', name: 'Cyclone Fury',   type: 'damage', power: 19, element: 'wind', energyCost: 2 },
      { id: 'wnd_2', name: 'Breeze Kiss',    type: 'heal',   power: 14, element: 'wind', energyCost: 2 },
      { id: 'wnd_3', name: 'Uplift Draft',   type: 'buff',   power: 3,  element: 'wind', energyCost: 1 },
      { id: 'wnd_4', name: 'Gale Stagger',   type: 'debuff', power: 3,  element: 'wind', energyCost: 1 },
    ],
  },
  gleamjaw_voltbeast: {
    id: 'gleamjaw_voltbeast',
    name: 'Gleamjaw Voltbeast',
    description: 'A crackling predator that bites with pure voltage.',
    element: 'thunder',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/T3U96xfHz0IT4BkY6eVQ/NRA8QxNVWHPSrwsQq8sNzsar5qu1/e0f3cb17-8aae-4cc7-b745-eba7230d1b27.png',
    stats: { hp: 90, atk: 15, def: 7, spd: 3 },
    abilities: [
      { id: 'thn_0', name: 'Rumble Clap',    type: 'damage', power: 12, element: 'thunder', energyCost: 1 },
      { id: 'thn_1', name: 'Thunder Crash',  type: 'damage', power: 19, element: 'thunder', energyCost: 2 },
      { id: 'thn_2', name: 'Sonic Hum',      type: 'heal',   power: 14, element: 'thunder', energyCost: 2 },
      { id: 'thn_3', name: 'Amp Boom',       type: 'buff',   power: 3,  element: 'thunder', energyCost: 1 },
      { id: 'thn_4', name: 'Deafen Roar',    type: 'debuff', power: 3,  element: 'thunder', energyCost: 1 },
    ],
  },

  // Akari the Lightbringer (light/spirit/mirror)
  halo_prowler: {
    id: 'halo_prowler',
    name: 'Halo Prowler',
    description: 'A radiant hunter that blinds before it strikes.',
    element: 'light',
    rarity: 'rare',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/0cd6badf-2d1a-4eab-9755-b01b2902cbeb.png',
    stats: { hp: 100, atk: 14, def: 9, spd: 4 },
    abilities: [
      { id: 'lgt_0', name: 'Sparkle Shot',   type: 'damage', power: 12, element: 'light', energyCost: 1 },
      { id: 'lgt_1', name: 'Holy Beam',      type: 'damage', power: 19, element: 'light', energyCost: 2 },
      { id: 'lgt_2', name: 'Radiant Heal',   type: 'heal',   power: 14, element: 'light', energyCost: 2 },
      { id: 'lgt_3', name: 'Dawn Blessing',  type: 'buff',   power: 3,  element: 'light', energyCost: 1 },
      { id: 'lgt_4', name: 'Blind Glare',    type: 'debuff', power: 3,  element: 'light', energyCost: 1 },
    ],
  },
  blizzard_wisp: {
    id: 'blizzard_wisp',
    name: 'Blizzard Wisp',
    description: 'A ghostly chill that whispers from the other side.',
    element: 'spirit',
    rarity: 'epic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/c19146a9-4414-44c4-9a7c-898d3733347d.png',
    stats: { hp: 95, atk: 15, def: 8, spd: 4 },
    abilities: [
      { id: 'spr_0', name: 'Haunt Grasp',    type: 'damage', power: 12, element: 'spirit', energyCost: 1 },
      { id: 'spr_1', name: 'Phantom Wail',   type: 'damage', power: 19, element: 'spirit', energyCost: 2 },
      { id: 'spr_2', name: 'Ethereal Mend',  type: 'heal',   power: 14, element: 'spirit', energyCost: 2 },
      { id: 'spr_3', name: 'Commune Link',   type: 'buff',   power: 3,  element: 'spirit', energyCost: 1 },
      { id: 'spr_4', name: 'Haunt Fear',     type: 'debuff', power: 3,  element: 'spirit', energyCost: 1 },
    ],
  },
  prism_maw: {
    id: 'prism_maw',
    name: 'Prism Maw',
    description: 'A mirror-skinned beast that reflects attacks with a grin.',
    element: 'mirror',
    rarity: 'epic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/46564f63-662d-457b-85c4-c1d9dd67dfed.png',
    stats: { hp: 100, atk: 15, def: 8, spd: 4 },
    abilities: [
      { id: 'mir_0', name: 'Reflect Ray',    type: 'damage', power: 12, element: 'mirror', energyCost: 1 },
      { id: 'mir_1', name: 'Shatter Glass',  type: 'damage', power: 19, element: 'mirror', energyCost: 2 },
      { id: 'mir_2', name: 'Silver Glint',   type: 'heal',   power: 14, element: 'mirror', energyCost: 2 },
      { id: 'mir_3', name: 'Double Image',   type: 'buff',   power: 3,  element: 'mirror', energyCost: 1 },
      { id: 'mir_4', name: 'Shatter Doubt',  type: 'debuff', power: 3,  element: 'mirror', energyCost: 1 },
    ],
  },

  /* ───────── Tier 3 — boss trainer mons (epic / mythic / legendary) ───────── */
  basalt_gnasher: {
    id: 'basalt_gnasher',
    name: 'Basalt Gnasher',
    description: 'A grumpy rock beast with a taste for bad luck.',
    element: 'stone',
    rarity: 'epic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/173a8e96-97b2-4b58-b189-4e6951cd3b06.png',
    stats: { hp: 120, atk: 17, def: 12, spd: 4 },
    abilities: [
      { id: 'stone_0', name: 'Rock Throw',     type: 'damage', power: 12, element: 'stone', energyCost: 1 },
      { id: 'stone_1', name: 'Boulder Slam',   type: 'damage', power: 19, element: 'stone', energyCost: 2 },
      { id: 'stone_2', name: 'Pebble Rest',    type: 'heal',   power: 14, element: 'stone', energyCost: 2 },
      { id: 'stone_3', name: 'Fortify Wall',   type: 'buff',   power: 3,  element: 'stone', energyCost: 1 },
      { id: 'stone_4', name: 'Crush Weight',   type: 'debuff', power: 3,  element: 'stone', energyCost: 1 },
    ],
  },
  prism_wyrm: {
    id: 'prism_wyrm',
    name: 'Prism Wyrm',
    description: 'A glow-drunk serpent that hisses in laser colors.',
    element: 'neon',
    rarity: 'epic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/42994141-3fd0-494c-a7f0-eab3fca4e7e9.png',
    stats: { hp: 95, atk: 16, def: 10, spd: 4 },
    abilities: [
      { id: 'neon_0', name: 'Glow Ray',         type: 'damage', power: 12, element: 'neon', energyCost: 1 },
      { id: 'neon_1', name: 'Neon Flash',       type: 'damage', power: 19, element: 'neon', energyCost: 2 },
      { id: 'neon_2', name: 'Luminous Aura',    type: 'heal',   power: 14, element: 'neon', energyCost: 2 },
      { id: 'neon_3', name: 'Radiate Sign',     type: 'buff',   power: 3,  element: 'neon', energyCost: 1 },
      { id: 'neon_4', name: 'Flicker Dim',      type: 'debuff', power: 3,  element: 'neon', energyCost: 1 },
    ],
  },
  cinder_crown_titan: {
    id: 'cinder_crown_titan',
    name: 'Cinder Crown Titan',
    description: 'A molten monarch who taxes volcanoes in ash.',
    element: 'lava',
    rarity: 'mythic',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/1a91de19-a441-4561-adcf-4e1e34152749.png',
    stats: { hp: 110, atk: 19, def: 12, spd: 5 },
    abilities: [
      { id: 'lava_0', name: 'Molten Spit',      type: 'damage', power: 12, element: 'lava', energyCost: 1 },
      { id: 'lava_1', name: 'Eruption Blast',   type: 'damage', power: 19, element: 'lava', energyCost: 2 },
      { id: 'lava_2', name: 'Magma Soak',       type: 'heal',   power: 14, element: 'lava', energyCost: 2 },
      { id: 'lava_3', name: 'Harden Shell',     type: 'buff',   power: 3,  element: 'lava', energyCost: 1 },
      { id: 'lava_4', name: 'Melt Doom',        type: 'debuff', power: 3,  element: 'lava', energyCost: 1 },
    ],
  },
  arc_lightning_golem: {
    id: 'arc_lightning_golem',
    name: 'Arc Lightning Golem',
    description: 'A smug statue that zaps anyone who blinks.',
    element: 'static',
    rarity: 'legendary',
    imageUrl: 'https://storage.googleapis.com/venus-app-a037a.firebasestorage.app/h5-imagegen/VgTkt8Oz4bfMDPd6SvpV/NRA8QxNVWHPSrwsQq8sNzsar5qu1/ea91633e-4eb7-4f3e-90d8-dc5fe58eb62c.png',
    stats: { hp: 123, atk: 22, def: 11, spd: 6 },
    abilities: [
      { id: 'static_0', name: 'Crackle Pop',      type: 'damage', power: 12, element: 'static', energyCost: 1 },
      { id: 'static_1', name: 'Discharge Wave',   type: 'damage', power: 19, element: 'static', energyCost: 2 },
      { id: 'static_2', name: 'Cling Touch',      type: 'heal',   power: 14, element: 'static', energyCost: 2 },
      { id: 'static_3', name: 'Frizz Guard',      type: 'buff',   power: 3,  element: 'static', energyCost: 1 },
      { id: 'static_4', name: 'Static Cling',     type: 'debuff', power: 3,  element: 'static', energyCost: 1 },
    ],
  },
};

export function getTrainerMonEntry(specId: string): TrainerMonCatalogEntry | null {
  return TRAINER_MON_CATALOG[specId] ?? null;
}
