// ============================================================
// MONSTER TYPE SYSTEM — 36 types, property-based advantages,
// procedural abilities, merge recipes, ability inheritance
// ============================================================

// ---------- TYPE DEFINITIONS ----------

export type TypeFamily =
  | 'thermal' | 'aquatic' | 'mineral' | 'organic'
  | 'electric' | 'arcane' | 'atmospheric'
  // v1.701 — Combat. New family introduced with the Trainer Tower
  // (Mike: "we should generate a new type for the tower and the
  // surrounding areas...fighting mons"). One type (`martial`) ships
  // initially; room left for gladiator/monk/etc. follow-ons inside the
  // same family. Combat fills the "physical, disciplined, no element"
  // hole in the matchup matrix — most existing families lean
  // elemental or supernatural, so a pure-physical family gives the
  // Tower its own mechanical identity.
  | 'combat';

export type MonsterType =
  // Thermal (5)
  | 'fire' | 'lava' | 'furnace' | 'ember' | 'ash'
  // Aquatic (5)
  | 'water' | 'ice' | 'steam' | 'acid' | 'mist'
  // Mineral (6)
  | 'stone' | 'steel' | 'crystal' | 'chalk' | 'obsidian' | 'sand'
  // Organic (5)
  | 'nature' | 'fungus' | 'coral' | 'venom' | 'bone'
  // Electric (5)
  | 'spark' | 'magnetic' | 'plasma' | 'static' | 'neon'
  // Arcane (6) — `stellar` is gacha-pack-exclusive (v1.222) and rolls
  // only in the cosmos environment. Filed under arcane because its
  // cosmos/star-fire silhouette pairs naturally with spirit/light.
  | 'shadow' | 'light' | 'void' | 'spirit' | 'mirror' | 'stellar'
  // Atmospheric (5)
  | 'wind' | 'thunder' | 'dust' | 'cloud' | 'storm'
  // Combat (1) — v1.701 Trainer Tower drop. See TypeFamily comment.
  | 'martial';

export const ALL_TYPES: MonsterType[] = [
  'fire','lava','furnace','ember','ash',
  'water','ice','steam','acid','mist',
  'stone','steel','crystal','chalk','obsidian','sand',
  'nature','fungus','coral','venom','bone',
  'spark','magnetic','plasma','static','neon',
  'shadow','light','void','spirit','mirror','stellar',
  'wind','thunder','dust','cloud','storm',
  'martial',
];

export const TYPE_FAMILY_MAP: Record<MonsterType, TypeFamily> = {
  fire:'thermal', lava:'thermal', furnace:'thermal', ember:'thermal', ash:'thermal',
  water:'aquatic', ice:'aquatic', steam:'aquatic', acid:'aquatic', mist:'aquatic',
  stone:'mineral', steel:'mineral', crystal:'mineral', chalk:'mineral', obsidian:'mineral', sand:'mineral',
  nature:'organic', fungus:'organic', coral:'organic', venom:'organic', bone:'organic',
  spark:'electric', magnetic:'electric', plasma:'electric', static:'electric', neon:'electric',
  shadow:'arcane', light:'arcane', void:'arcane', spirit:'arcane', mirror:'arcane', stellar:'arcane',
  wind:'atmospheric', thunder:'atmospheric', dust:'atmospheric', cloud:'atmospheric', storm:'atmospheric',
  martial:'combat',
};

// ============================================================
// ARCHETYPES — per-family identity (resource + passive)
// ============================================================
//
// Every monster belongs to a TypeFamily (its "archetype"). Each archetype has:
//   - A named resource (replaces the old generic "Energy") with its own start /
//     regen / max — so different archetypes feel mechanically distinct (e.g.
//     Electric monsters spike fast; Aquatic monsters never run dry).
//   - A passive trait that fires automatically in battle (extra crit, dodge,
//     burn-on-hit, end-of-turn regen, etc.) — wired in battleCore.ts.

export type ArchetypePassiveId =
  | 'searing-touch'   // thermal
  | 'tidal-renewal'   // aquatic
  | 'hardened'        // mineral
  | 'vitality'        // organic
  | 'surging'         // electric
  | 'veiled'          // arcane
  | 'slipstream'      // atmospheric
  | 'battle-hardened'; // combat (v1.701 — Trainer Tower drop)

export interface ArchetypeConfig {
  family: TypeFamily;
  label: string;
  icon: string;
  color: string;

  resourceName: string;
  resourceIcon: string;
  resourceColor: string;
  startingResource: number;
  resourcePerTurn: number;
  maxResource: number;

  passiveId: ArchetypePassiveId;
  passiveLabel: string;
  passiveDescription: string;
}

export const ARCHETYPE_CONFIG: Record<TypeFamily, ArchetypeConfig> = {
  thermal: {
    family: 'thermal', label: 'Thermal', icon: '\u{1F525}', color: '#ff6633',
    resourceName: 'Heat', resourceIcon: '\u{1F525}', resourceColor: '#ff6633',
    startingResource: 2, resourcePerTurn: 1, maxResource: 5,
    passiveId: 'searing-touch',
    passiveLabel: 'Searing Touch',
    passiveDescription: '+20% chance to inflict Burn on damaging attacks.',
  },
  aquatic: {
    family: 'aquatic', label: 'Aquatic', icon: '\u{1F4A7}', color: '#4da6ff',
    resourceName: 'Flow', resourceIcon: '\u{1F4A7}', resourceColor: '#4da6ff',
    startingResource: 4, resourcePerTurn: 1, maxResource: 5,
    passiveId: 'tidal-renewal',
    passiveLabel: 'Tidal Renewal',
    passiveDescription: 'Regenerate 5 HP at the end of each turn.',
  },
  mineral: {
    family: 'mineral', label: 'Mineral', icon: '\u{1FAA8}', color: '#aa9977',
    resourceName: 'Charge', resourceIcon: '\u{1FAA8}', resourceColor: '#aa9977',
    startingResource: 3, resourcePerTurn: 1, maxResource: 6,
    passiveId: 'hardened',
    passiveLabel: 'Hardened',
    passiveDescription: 'Take 15% less damage when above 50% HP.',
  },
  organic: {
    family: 'organic', label: 'Organic', icon: '\u{1F33F}', color: '#4dff88',
    resourceName: 'Growth', resourceIcon: '\u{1F33F}', resourceColor: '#4dff88',
    startingResource: 3, resourcePerTurn: 2, maxResource: 5,
    passiveId: 'vitality',
    passiveLabel: 'Vitality',
    passiveDescription: 'Healing abilities restore +25% extra HP.',
  },
  electric: {
    family: 'electric', label: 'Electric', icon: '\u26A1', color: '#ffdd00',
    resourceName: 'Voltage', resourceIcon: '\u26A1', resourceColor: '#ffdd00',
    startingResource: 1, resourcePerTurn: 2, maxResource: 5,
    passiveId: 'surging',
    passiveLabel: 'Surging',
    passiveDescription: 'First damaging attack of the battle automatically crits.',
  },
  arcane: {
    family: 'arcane', label: 'Arcane', icon: '\u{1F31A}', color: '#b366ff',
    resourceName: 'Mana', resourceIcon: '\u{1F31A}', resourceColor: '#b366ff',
    startingResource: 4, resourcePerTurn: 1, maxResource: 5,
    passiveId: 'veiled',
    passiveLabel: 'Veiled',
    passiveDescription: '25% chance to ignore status effects + 15% bonus damage when at full Mana.',
  },
  atmospheric: {
    family: 'atmospheric', label: 'Atmospheric', icon: '\u{1F32A}\uFE0F', color: '#88aacc',
    resourceName: 'Pressure', resourceIcon: '\u{1F32A}\uFE0F', resourceColor: '#88aacc',
    startingResource: 3, resourcePerTurn: 1, maxResource: 5,
    passiveId: 'slipstream',
    passiveLabel: 'Slipstream',
    passiveDescription: '10% chance to dodge incoming damage entirely.',
  },
  // v1.701 — Combat family for the Trainer Tower drop. Bronze/copper
  // palette to match the metallic tower theme. Stamina resource builds
  // similarly to mineral's Charge (start 3 / +1 turn / max 5). Passive
  // is a flat +12% damage bonus (battle-hardened) — slightly weaker
  // than arcane's veiled (+15%) since combat mons get balanced offense
  // and lack arcane's status-immunity edge. Wired in battleCore.ts
  // alongside the existing veiled bonus.
  combat: {
    family: 'combat', label: 'Combat', icon: '\u{1F44A}', color: '#cc7733',
    resourceName: 'Stamina', resourceIcon: '\u{1F4AA}', resourceColor: '#cc7733',
    startingResource: 3, resourcePerTurn: 1, maxResource: 5,
    passiveId: 'battle-hardened',
    passiveLabel: 'Battle Hardened',
    passiveDescription: '+12% bonus damage on all attacks. Combat mons hit harder than they look.',
  },
};

export function getArchetype(t: MonsterType): ArchetypeConfig {
  return ARCHETYPE_CONFIG[TYPE_FAMILY_MAP[t]];
}

// ============================================================
// LEVEL- AND STAGE-GATED ABILITIES
// ============================================================
//
// Monsters generate 5 ability slots (quick / signature / heal / self-buff /
// enemy-debuff). Each slot has BOTH a minimum level AND a minimum
// evolution stage gating it:
//
//   Slot 0 (Quick):     Lv.1, Stage 0 — always available
//   Slot 1 (Signature): Lv.3, Stage 0 — early unlock
//   Slot 2 (Heal):      Lv.5, Stage 1 — requires first evolution
//   Slot 3 (Self buff): Lv.7, Stage 1 — requires first evolution
//   Slot 4 (Debuff):    Lv.9, Stage 2 — requires final evolution
//
// v1.208 — added stage gates so spending a Growth Shard / Awakening
// Crystal actually unlocks new tools instead of just bumping stats +
// rarity. A Stage-0 mon has only the first two abilities available
// regardless of level, so chasing evolutions is the only path to a
// fully-unlocked toolkit.

export const ABILITY_UNLOCK_LEVELS: number[] = [1, 3, 5, 7, 9];
export const ABILITY_UNLOCK_STAGES: number[] = [0, 0, 1, 1, 2];

export function isAbilityUnlocked(
  slotIndex: number,
  level: number,
  stage: number = 0,
): boolean {
  const reqLvl = ABILITY_UNLOCK_LEVELS[slotIndex];
  const reqStage = ABILITY_UNLOCK_STAGES[slotIndex] ?? 0;
  if (reqLvl === undefined) return false;
  return level >= reqLvl && stage >= reqStage;
}

/** Required level for a given slot. 99 = never unlocks (out of bounds). */
export function abilityUnlockLevel(slotIndex: number): number {
  return ABILITY_UNLOCK_LEVELS[slotIndex] ?? 99;
}

/** Required evolution stage for a given slot (0/1/2). */
export function abilityUnlockStage(slotIndex: number): number {
  return ABILITY_UNLOCK_STAGES[slotIndex] ?? 0;
}

export interface TypeDisplayInfo {
  icon: string;
  color: string;
  label: string;
}

export const TYPE_DISPLAY: Record<MonsterType, TypeDisplayInfo> = {
  // Thermal
  fire:     { icon: '\u{1F525}', color: '#ff4d4d', label: 'Fire' },
  lava:     { icon: '\u{1F30B}', color: '#ff6600', label: 'Lava' },
  furnace:  { icon: '\u2668\uFE0F', color: '#cc3300', label: 'Furnace' },
  ember:    { icon: '\u{1F4AB}', color: '#ff8833', label: 'Ember' },
  ash:      { icon: '\u{1F32B}\uFE0F', color: '#888888', label: 'Ash' },
  // Aquatic
  water:    { icon: '\u{1F4A7}', color: '#4da6ff', label: 'Water' },
  ice:      { icon: '\u2744\uFE0F', color: '#99ddff', label: 'Ice' },
  steam:    { icon: '\u{1F4A8}', color: '#ccccee', label: 'Steam' },
  acid:     { icon: '\u2620\uFE0F', color: '#aaff00', label: 'Acid' },
  mist:     { icon: '\u{1F301}', color: '#aaccdd', label: 'Mist' },
  // Mineral
  stone:    { icon: '\u{1FAA8}', color: '#aa9977', label: 'Stone' },
  steel:    { icon: '\u2699\uFE0F', color: '#aabbcc', label: 'Steel' },
  crystal:  { icon: '\u{1F48E}', color: '#cc66ff', label: 'Crystal' },
  chalk:    { icon: '\u{1F9F1}', color: '#eeddcc', label: 'Chalk' },
  obsidian: { icon: '\u{1F311}', color: '#665577', label: 'Obsidian' },
  sand:     { icon: '\u{1F3D6}\uFE0F', color: '#ddcc88', label: 'Sand' },
  // Organic
  nature:   { icon: '\u{1F33F}', color: '#4dff88', label: 'Nature' },
  fungus:   { icon: '\u{1F344}', color: '#bb88cc', label: 'Fungus' },
  coral:    { icon: '\u{1F9E0}', color: '#ff7799', label: 'Coral' },
  venom:    { icon: '\u{1F40D}', color: '#88cc44', label: 'Venom' },
  bone:     { icon: '\u{1F9B4}', color: '#eeddbb', label: 'Bone' },
  // Electric
  spark:    { icon: '\u26A1', color: '#ffdd00', label: 'Spark' },
  magnetic: { icon: '\u{1F9F2}', color: '#5577ff', label: 'Magnetic' },
  plasma:   { icon: '\u{1F7E3}', color: '#ff44dd', label: 'Plasma' },
  static:   { icon: '\u{1F4AB}', color: '#ccddff', label: 'Static' },
  neon:     { icon: '\u{1F4A1}', color: '#00ffaa', label: 'Neon' },
  // Arcane
  shadow:   { icon: '\u{1F31A}', color: '#b366ff', label: 'Shadow' },
  light:    { icon: '\u2728', color: '#ffd700', label: 'Light' },
  void:     { icon: '\u{1F573}\uFE0F', color: '#8855bb', label: 'Void' },
  spirit:   { icon: '\u{1F47B}', color: '#aaddff', label: 'Spirit' },
  mirror:   { icon: '\u{1FA9E}', color: '#ddeeff', label: 'Mirror' },
  // v1.222 — Stellar is gacha-pack-exclusive. Star icon, gold-on-violet
  // palette pulled from the Stellar Pack marketing art.
  stellar:  { icon: '\u{1F31F}', color: '#c9a3ff', label: 'Stellar' },
  // Atmospheric
  wind:     { icon: '\u{1F343}', color: '#88ddaa', label: 'Wind' },
  thunder:  { icon: '\u{26C8}\uFE0F', color: '#ffaa33', label: 'Thunder' },
  dust:     { icon: '\u{1F4A8}', color: '#ccaa77', label: 'Dust' },
  cloud:    { icon: '\u2601\uFE0F', color: '#bbccdd', label: 'Cloud' },
  storm:    { icon: '\u{1F329}\uFE0F', color: '#6666bb', label: 'Storm' },
  // v1.701 — Combat (Trainer Tower). Fist icon + bronze palette.
  martial:  { icon: '\u{1F44A}', color: '#cc7733', label: 'Martial' },
};

// ---------- PROPERTY-BASED ADVANTAGE SYSTEM ----------

export type TypeProperty =
  | 'hot' | 'cold' | 'wet' | 'dry'
  | 'hard' | 'soft' | 'sharp' | 'brittle'
  | 'conductive' | 'insulating'
  | 'volatile' | 'stable'
  | 'luminous' | 'dark'
  | 'organic' | 'corrosive'
  | 'ethereal' | 'dense'
  // v1.222 — `cosmic` is exclusive to the gacha-pack stellar type.
  // Gives stellar mons a distinctive matchup profile (hard-counters
  // hot + organic, weak to void/corrosive) without affecting any
  // existing type's interactions.
  | 'cosmic';

export const TYPE_PROPERTIES: Record<MonsterType, TypeProperty[]> = {
  // Thermal
  fire:     ['hot', 'volatile', 'luminous', 'dry'],
  lava:     ['hot', 'dense', 'volatile'],
  furnace:  ['hot', 'hard', 'stable', 'conductive'],
  ember:    ['hot', 'dry', 'soft'],
  ash:      ['dry', 'soft', 'insulating'],
  // Aquatic
  water:    ['wet', 'cold', 'conductive', 'soft'],
  ice:      ['cold', 'hard', 'brittle'],
  steam:    ['hot', 'wet', 'volatile', 'ethereal'],
  acid:     ['wet', 'corrosive', 'volatile'],
  mist:     ['wet', 'cold', 'ethereal', 'soft'],
  // Mineral
  stone:    ['hard', 'dense', 'stable', 'dry'],
  steel:    ['hard', 'conductive', 'dense', 'sharp'],
  crystal:  ['hard', 'brittle', 'luminous', 'conductive'],
  chalk:    ['soft', 'dry', 'brittle', 'insulating'],
  obsidian: ['hard', 'sharp', 'brittle', 'dark'],
  sand:     ['dry', 'soft', 'insulating'],
  // Organic
  nature:   ['organic', 'wet', 'soft'],
  fungus:   ['organic', 'soft', 'dark', 'corrosive'],
  coral:    ['organic', 'hard', 'wet'],
  venom:    ['organic', 'wet', 'corrosive', 'volatile'],
  bone:     ['organic', 'hard', 'dry', 'brittle'],
  // Electric
  spark:    ['conductive', 'volatile', 'luminous'],
  magnetic: ['conductive', 'hard', 'stable'],
  plasma:   ['hot', 'conductive', 'volatile', 'luminous'],
  static:   ['conductive', 'dry', 'ethereal'],
  neon:     ['luminous', 'ethereal', 'conductive'],
  // Arcane
  shadow:   ['dark', 'ethereal', 'soft'],
  light:    ['luminous', 'ethereal', 'stable'],
  void:     ['dark', 'ethereal', 'volatile'],
  spirit:   ['ethereal', 'luminous', 'soft'],
  mirror:   ['hard', 'luminous', 'stable', 'brittle'],
  // Stellar — gacha-pack-exclusive. luminous + ethereal core (shines,
  // passes through soft matter), volatile for nova punch, dense for
  // gravity-well crushing of ethereal targets, plus the unique
  // `cosmic` property for stellar-only interactions. Profile reads:
  //   • Strong vs dark, hot, organic, ethereal, brittle, stable
  //   • Hard-countered by void (absorbs starlight) + corrosive (eats
  //     cosmic threads) so packs aren't auto-win.
  stellar:  ['luminous', 'ethereal', 'volatile', 'dense', 'cosmic'],
  // Atmospheric
  wind:     ['ethereal', 'dry', 'soft', 'volatile'],
  thunder:  ['volatile', 'conductive', 'luminous', 'dense'],
  dust:     ['dry', 'soft', 'insulating'],
  cloud:    ['wet', 'soft', 'ethereal'],
  storm:    ['wet', 'volatile', 'conductive'],
  // Combat — v1.701. Picked from existing properties (no new property
  // added, keeps the matchup matrix unchanged) for a "physically tough,
  // disciplined" profile:
  //   • hard      → resists soft (Bounces off), shatters brittle
  //   • dense     → crushes ethereal (the marquee combat-vs-ghost win)
  //   • stable    → resists volatile slightly (disrupted but persists)
  // Reads as: strong vs ghosts/brittle/soft, vulnerable to corrosive
  // (corrodes hard) and volatile (disrupts stable). A clean fighter
  // profile without needing a new TypeProperty.
  martial:  ['hard', 'dense', 'stable'],
};

export interface PropertyInteraction {
  attackerHas: TypeProperty;
  defenderHas: TypeProperty;
  multiplier: number;
  label: string;
}

// v1.250 — second multiplier crank. Players reported matchups still
// felt subtle ("are strengths/weaknesses even working?"). The v1.202
// pass moved single-rule advantages from 1.2-1.4× → 1.4-1.65×; this
// pass pushes them again to 1.6-2.0× so a clean type counter visibly
// tilts the fight. Resistances now drop to 0.35-0.55× (was 0.5-0.65)
// so picking the wrong attack feels like a real punishment, not a
// minor scratch. Stacked counters (multiple matching rules) can hit
// the new [0.3, 4.0] cap — a perfect type read can erase a mon in
// 1-2 swings, exactly the "decisive matchup" players asked for.
export const PROPERTY_INTERACTIONS: PropertyInteraction[] = [
  // Strong (>1) — primary elemental counters
  { attackerHas: 'hot',        defenderHas: 'organic',    multiplier: 1.85, label: 'Burns!' },
  { attackerHas: 'hot',        defenderHas: 'cold',       multiplier: 1.85, label: 'Melts!' },
  { attackerHas: 'hot',        defenderHas: 'soft',       multiplier: 1.60, label: 'Scorches!' },
  { attackerHas: 'cold',       defenderHas: 'wet',        multiplier: 1.85, label: 'Freezes!' },
  { attackerHas: 'cold',       defenderHas: 'organic',    multiplier: 1.60, label: 'Withers!' },
  { attackerHas: 'wet',        defenderHas: 'hot',        multiplier: 1.85, label: 'Douses!' },
  { attackerHas: 'wet',        defenderHas: 'dry',        multiplier: 1.60, label: 'Soaks!' },
  { attackerHas: 'sharp',      defenderHas: 'soft',       multiplier: 2.00, label: 'Slices!' },
  { attackerHas: 'hard',       defenderHas: 'brittle',    multiplier: 2.00, label: 'Shatters!' },
  { attackerHas: 'conductive', defenderHas: 'wet',        multiplier: 1.85, label: 'Shocks!' },
  { attackerHas: 'corrosive',  defenderHas: 'hard',       multiplier: 1.85, label: 'Corrodes!' },
  { attackerHas: 'corrosive',  defenderHas: 'organic',    multiplier: 1.60, label: 'Dissolves!' },
  { attackerHas: 'volatile',   defenderHas: 'stable',     multiplier: 1.60, label: 'Disrupts!' },
  { attackerHas: 'luminous',   defenderHas: 'dark',       multiplier: 2.00, label: 'Illuminates!' },
  { attackerHas: 'dark',       defenderHas: 'luminous',   multiplier: 1.60, label: 'Eclipses!' },
  { attackerHas: 'dense',      defenderHas: 'ethereal',   multiplier: 1.85, label: 'Crushes!' },
  { attackerHas: 'volatile',   defenderHas: 'brittle',    multiplier: 1.85, label: 'Explodes!' },
  // Weak (<1) — resistances and grounds
  { attackerHas: 'hot',        defenderHas: 'hot',        multiplier: 0.45, label: 'Resisted...' },
  { attackerHas: 'cold',       defenderHas: 'cold',       multiplier: 0.45, label: 'Resisted...' },
  { attackerHas: 'wet',        defenderHas: 'insulating', multiplier: 0.55, label: 'Absorbed...' },
  { attackerHas: 'conductive', defenderHas: 'insulating', multiplier: 0.35, label: 'Grounded...' },
  { attackerHas: 'soft',       defenderHas: 'hard',       multiplier: 0.45, label: 'Bounces off...' },
  { attackerHas: 'corrosive',  defenderHas: 'corrosive',  multiplier: 0.45, label: 'Neutralized...' },
  { attackerHas: 'ethereal',   defenderHas: 'ethereal',   multiplier: 0.55, label: 'Passes through...' },
  { attackerHas: 'organic',    defenderHas: 'corrosive',  multiplier: 0.55, label: 'Wilts...' },
  // v1.222 — cosmic property (stellar mons only). Strong vs hot
  // (stars outshine fire) and organic (cosmic radiation withers
  // life). Hard-countered by dark+ethereal "void" types (which
  // absorb starlight) and corrosive types (which eat cosmic threads).
  // These mirror the lore from the Stellar Pack marketing arc.
  { attackerHas: 'cosmic',     defenderHas: 'hot',        multiplier: 2.00, label: 'Outshines!' },
  { attackerHas: 'cosmic',     defenderHas: 'organic',    multiplier: 1.85, label: 'Withers in starlight!' },
  { attackerHas: 'cosmic',     defenderHas: 'cosmic',     multiplier: 0.45, label: 'Stars cancel out...' },
  { attackerHas: 'dark',       defenderHas: 'cosmic',     multiplier: 1.85, label: 'Eclipsed by void!' },
  { attackerHas: 'corrosive',  defenderHas: 'cosmic',     multiplier: 1.60, label: 'Cosmic threads dissolve!' },
];

export interface AdvantageResult {
  multiplier: number;
  labels: string[];
  isAdvantage: boolean;
  isDisadvantage: boolean;
}

export function computeAdvantage(attackerType: MonsterType, defenderType: MonsterType): AdvantageResult {
  if (attackerType === defenderType) {
    return { multiplier: 1.0, labels: [], isAdvantage: false, isDisadvantage: false };
  }

  const atkProps = new Set(TYPE_PROPERTIES[attackerType]);
  const defProps = new Set(TYPE_PROPERTIES[defenderType]);

  let multiplier = 1.0;
  const labels: string[] = [];

  for (const rule of PROPERTY_INTERACTIONS) {
    if (atkProps.has(rule.attackerHas) && defProps.has(rule.defenderHas)) {
      multiplier *= rule.multiplier;
      if (!labels.includes(rule.label)) labels.push(rule.label);
    }
  }

  // v1.250 — widened to [0.3, 4.0]. Single-rule advantages now sit at
  // 1.6–2.0×, single-rule resistances at 0.35–0.55×; a cleanly stacked
  // double-counter can reach the 4.0× cap to make perfect type reads
  // genuinely decisive. Disadvantage label now triggers at < 0.85 to
  // catch the new "minor resistance" floor.
  multiplier = Math.max(0.3, Math.min(4.0, multiplier));

  return {
    multiplier,
    labels,
    isAdvantage: multiplier > 1.15,
    isDisadvantage: multiplier < 0.85,
  };
}

/**
 * 2026-06-24 — Quick-glance matchup direction for a type chip's arrow.
 * Returns 'up' when `attacker` is offensively strong vs `defender`, 'down'
 * when resisted/weak, and null when the matchup is neutral (no arrow shown).
 * Thin wrapper over `computeAdvantage` so every battle surface (HUD, switch
 * panel, matchup popover) reads the same thresholds.
 */
export type MatchupArrowDir = 'up' | 'down' | null;
export function matchupArrowDir(attacker: MonsterType, defender: MonsterType): MatchupArrowDir {
  const adv = computeAdvantage(attacker, defender);
  if (adv.isAdvantage) return 'up';
  if (adv.isDisadvantage) return 'down';
  return null;
}

// ---------- ABILITY GENERATION ----------

interface AbilityTemplate {
  category: 'damage' | 'heal' | 'buff' | 'debuff';
  powerBase: number;
  powerScale: number;
  energyCost: number;
  /** v1.208 — resource the ability adds back when used. Pairs with
   *  energyCost to define the net resource economy: a generator has
   *  cost 0 + gain 1, a spender has cost 3 + gain 0, a slow heal can
   *  have cost 2 + gain 0 (consumes resource for sustain). */
  energyGain?: number;
}

// v1.208 — Combat resource loop redesign. Each mon now has a
// cantrip-and-finisher rhythm:
//   Slot 0 (Quick attack)  — cost 0, gain +1. Spam to build resource.
//   Slot 1 (Signature)     — cost 3, lower-frequency big hit.
//   Slot 2 (Sustain heal)  — cost 2, traditional sink.
//   Slot 3 (Self buff)     — cost 0, gain +2. Setup turn that ALSO
//                             ramps your bar.
//   Slot 4 (Enemy debuff)  — cost 1, occasional disruption.
//
// Net result: holding a Signature costs the player a turn of Quick
// or Buff to generate the resource first, instead of Signature being
// usable every other turn for free.
const ABILITY_SLOTS: AbilityTemplate[] = [
  { category: 'damage', powerBase: 10, powerScale: 2, energyCost: 0, energyGain: 1 },  // Quick (generator)
  { category: 'damage', powerBase: 22, powerScale: 4, energyCost: 3 },                  // Signature (spender)
  { category: 'heal',   powerBase: 14, powerScale: 2, energyCost: 2 },                  // Sustain
  { category: 'buff',   powerBase: 3,  powerScale: 1, energyCost: 0, energyGain: 2 },  // Self buff (setup + generator)
  { category: 'debuff', powerBase: 2,  powerScale: 1, energyCost: 1 },                  // Enemy debuff
];

/** Debuff ability names per type */
const TYPE_DEBUFF_NAMING: Record<MonsterType, { verb: string; noun: string }> = {
  // Thermal
  fire:     { verb: 'Scorch',   noun: 'Bane' },
  lava:     { verb: 'Melt',     noun: 'Doom' },
  furnace:  { verb: 'Overheat', noun: 'Drain' },
  ember:    { verb: 'Singe',    noun: 'Curse' },
  ash:      { verb: 'Smother',  noun: 'Fade' },
  // Aquatic
  water:    { verb: 'Drench',   noun: 'Hex' },
  ice:      { verb: 'Numb',     noun: 'Grip' },
  steam:    { verb: 'Wilt',     noun: 'Haze' },
  acid:     { verb: 'Erode',    noun: 'Burn' },
  mist:     { verb: 'Fog',      noun: 'Blind' },
  // Mineral
  stone:    { verb: 'Crush',    noun: 'Weight' },
  steel:    { verb: 'Rust',     noun: 'Corrosion' },
  crystal:  { verb: 'Fracture', noun: 'Flaw' },
  chalk:    { verb: 'Crumble',  noun: 'Dust' },
  obsidian: { verb: 'Splinter', noun: 'Wound' },
  sand:     { verb: 'Grind',    noun: 'Slow' },
  // Organic
  nature:   { verb: 'Tangle',   noun: 'Root' },
  fungus:   { verb: 'Spore',    noun: 'Rot' },
  coral:    { verb: 'Barnacle', noun: 'Drag' },
  venom:    { verb: 'Toxin',    noun: 'Sap' },
  bone:     { verb: 'Fracture', noun: 'Ache' },
  // Electric
  spark:    { verb: 'Short',    noun: 'Circuit' },
  magnetic: { verb: 'Repulse',  noun: 'Drain' },
  plasma:   { verb: 'Overload', noun: 'Crash' },
  static:   { verb: 'Static',   noun: 'Cling' },
  neon:     { verb: 'Flicker',  noun: 'Dim' },
  // Arcane
  shadow:   { verb: 'Dread',    noun: 'Curse' },
  light:    { verb: 'Blind',    noun: 'Glare' },
  void:     { verb: 'Null',     noun: 'Void' },
  spirit:   { verb: 'Haunt',    noun: 'Fear' },
  mirror:   { verb: 'Shatter',  noun: 'Doubt' },
  stellar:  { verb: 'Eclipse',  noun: 'Awe' },
  // Atmospheric
  wind:     { verb: 'Gale',     noun: 'Stagger' },
  thunder:  { verb: 'Deafen',   noun: 'Roar' },
  dust:     { verb: 'Blind',    noun: 'Storm' },
  cloud:    { verb: 'Obscure',  noun: 'Haze' },
  storm:    { verb: 'Tempest',  noun: 'Ruin' },
  // Combat (v1.701)
  martial:  { verb: 'Stagger',  noun: 'Strike' },
};

interface TypeNaming {
  verbs: [string, string, string, string];
  nouns: [string, string, string, string];
}

const TYPE_NAMING: Record<MonsterType, TypeNaming> = {
  // Thermal
  fire:     { verbs: ['Flicker','Inferno','Warm','Blaze'],        nouns: ['Snap','Surge','Embrace','Up'] },
  lava:     { verbs: ['Molten','Eruption','Magma','Harden'],      nouns: ['Spit','Blast','Soak','Shell'] },
  furnace:  { verbs: ['Forge','Smelt','Temper','Overheat'],       nouns: ['Strike','Down','Repair','Core'] },
  ember:    { verbs: ['Spark','Wildfire','Smolder','Kindle'],     nouns: ['Toss','Wave','Glow','Spirit'] },
  ash:      { verbs: ['Cinder','Dustfall','Soot','Ashen'],        nouns: ['Flick','Storm','Veil','Guard'] },
  // Aquatic
  water:    { verbs: ['Splash','Tidal','Bubble','Current'],       nouns: ['Shot','Wave','Shield','Flow'] },
  ice:      { verbs: ['Frost','Glacier','Chill','Permafrost'],    nouns: ['Bite','Crush','Mend','Armor'] },
  steam:    { verbs: ['Scald','Geyser','Vapor','Pressurize'],     nouns: ['Jet','Burst','Cloud','Vent'] },
  acid:     { verbs: ['Spit','Acid','Corrode','Toxify'],          nouns: ['Splash','Rain','Mend','Coat'] },
  mist:     { verbs: ['Fog','Haze','Dew','Obscure'],             nouns: ['Touch','Blanket','Drop','Veil'] },
  // Mineral
  stone:    { verbs: ['Rock','Boulder','Pebble','Fortify'],       nouns: ['Throw','Slam','Rest','Wall'] },
  steel:    { verbs: ['Blade','Iron','Rivet','Reinforce'],        nouns: ['Slash','Crash','Patch','Plate'] },
  crystal:  { verbs: ['Prism','Shatter','Facet','Resonate'],      nouns: ['Beam','Barrage','Heal','Tune'] },
  chalk:    { verbs: ['Dust','Chalk','Powder','Mark'],            nouns: ['Puff','Slide','Coat','Line'] },
  obsidian: { verbs: ['Glass','Obsidian','Volcanic','Darkforge'], nouns: ['Edge','Shatter','Seal','Ward'] },
  sand:     { verbs: ['Grit','Sandstorm','Dune','Quicksand'],    nouns: ['Blast','Fury','Drift','Trap'] },
  // Organic
  nature:   { verbs: ['Thorn','Vine','Photo','Spore'],           nouns: ['Lash','Crush','Synthesis','Burst'] },
  fungus:   { verbs: ['Mycel','Rot','Spore','Decompose'],        nouns: ['Whip','Cloud','Drain','Bloom'] },
  coral:    { verbs: ['Reef','Barnacle','Tide','Polyp'],          nouns: ['Sting','Slam','Growth','Shield'] },
  venom:    { verbs: ['Fang','Toxin','Viper','Envenom'],          nouns: ['Strike','Spray','Sap','Coat'] },
  bone:     { verbs: ['Marrow','Skull','Calcify','Ossify'],       nouns: ['Crack','Bash','Mend','Wall'] },
  // Electric
  spark:    { verbs: ['Zap','Lightning','Charge','Overload'],     nouns: ['Jolt','Bolt','Pulse','Surge'] },
  magnetic: { verbs: ['Polar','Magnet','Flux','Repulse'],         nouns: ['Pull','Slam','Field','Shield'] },
  plasma:   { verbs: ['Arc','Plasma','Ion','Supercharge'],        nouns: ['Flash','Cannon','Bath','Core'] },
  static:   { verbs: ['Crackle','Discharge','Cling','Frizz'],    nouns: ['Pop','Wave','Touch','Guard'] },
  neon:     { verbs: ['Glow','Neon','Luminous','Radiate'],        nouns: ['Ray','Flash','Aura','Sign'] },
  // Arcane
  shadow:   { verbs: ['Void','Nightmare','Shadow','Dusk'],        nouns: ['Scratch','Pulse','Fade','Cloak'] },
  light:    { verbs: ['Sparkle','Holy','Radiant','Dawn'],         nouns: ['Shot','Beam','Heal','Blessing'] },
  void:     { verbs: ['Null','Abyss','Rift','Negate'],           nouns: ['Touch','Tear','Drain','Field'] },
  spirit:   { verbs: ['Haunt','Phantom','Ethereal','Commune'],    nouns: ['Grasp','Wail','Mend','Link'] },
  mirror:   { verbs: ['Reflect','Shatter','Silver','Double'],     nouns: ['Ray','Glass','Glint','Image'] },
  stellar:  { verbs: ['Comet','Stellar','Nova','Constellate'],    nouns: ['Strike','Flare','Burst','Bond'] },
  // Atmospheric
  wind:     { verbs: ['Gust','Cyclone','Breeze','Uplift'],       nouns: ['Slash','Fury','Kiss','Draft'] },
  thunder:  { verbs: ['Rumble','Thunder','Sonic','Amp'],          nouns: ['Clap','Crash','Hum','Boom'] },
  dust:     { verbs: ['Grit','Dust','Erode','Settle'],           nouns: ['Throw','Devil','Wrap','Down'] },
  cloud:    { verbs: ['Nimbus','Cirrus','Drizzle','Cumulus'],     nouns: ['Strike','Burst','Rain','Puff'] },
  storm:    { verbs: ['Tempest','Maelstrom','Squall','Charge'],   nouns: ['Bolt','Fury','Eye','Front'] },
  // Combat — v1.701. Punchy fighter vocabulary: jabs, combos, throws,
  // strikes. Slot 0/1 lean offensive (Jab/Combo), slot 2 heal as
  // "Recover" (rest between rounds), slot 3 self-buff as "Brace"
  // (defensive stance). Nouns balance the verb (Hook, Counter, Stance).
  martial:  { verbs: ['Jab','Combo','Recover','Brace'],           nouns: ['Hook','Counter','Stance','Form'] },
};

// v1.158 — capped above Mythic so ability power doesn't snowball.
// Ability power formula is `powerBase + powerScale * tier`, so Omega at
// tier 14 was producing damage moves with double-Mythic power. Now
// Legendary peaks at tier 7 and every tier above just gets +1 (Ancient
// = 8, Celestial = 8, Transcendent = 8, ...). Combined with the flatter
// stat ranges in RARITY_STAT_RANGES, this shrinks the late-game power
// snowball that was making Ancient feel one-shot.
const RARITY_TIER: Record<string, number> = {
  tattered: 0, common: 1, uncommon: 2, rare: 3, superior: 4,
  epic: 5, mythic: 6, legendary: 7, ancient: 8, celestial: 8,
  transcendent: 8, eternal: 8, prismatic: 8, divine: 8, omega: 8,
};

export interface GeneratedAbility {
  id: string;
  name: string;
  type: 'damage' | 'heal' | 'buff' | 'debuff';
  power: number;
  element: MonsterType;
  /** Cost paid when used (subtracted from current resource). */
  energyCost: number;
  /**
   * v1.208 — optional GAIN added to the player's resource when this
   * ability resolves. Used to designate "generator" abilities (cheap
   * cantrips that BUILD Heat / Flow / Voltage / etc.) so the
   * combat loop has spam→build→unleash combos instead of every move
   * just costing energy. Net delta per use is `(energyGain ?? 0) - energyCost`.
   */
  energyGain?: number;
}

/** Energy constants */
export const ENERGY_START = 3;
export const ENERGY_PER_TURN = 1;
export const ENERGY_MAX = 5;

export function generateAbilities(
  monsterType: MonsterType,
  rarity: string = 'common',
): GeneratedAbility[] {
  const naming = TYPE_NAMING[monsterType];
  const debuffNaming = TYPE_DEBUFF_NAMING[monsterType];
  const tier = RARITY_TIER[rarity] ?? 0;

  return ABILITY_SLOTS.map((template, i) => {
    const name = i < 4
      ? `${naming.verbs[i]} ${naming.nouns[i]}`
      : `${debuffNaming.verb} ${debuffNaming.noun}`;
    return {
      id: `${monsterType}_${i}`,
      name,
      type: template.category,
      power: template.powerBase + template.powerScale * tier,
      element: monsterType,
      energyCost: template.energyCost,
      ...(template.energyGain ? { energyGain: template.energyGain } : {}),
    };
  });
}

// ---------- MERGE RECIPES ----------

interface MergeRecipe {
  input: [MonsterType, MonsterType];
  output: MonsterType;
  flavorText: string;
}

const MERGE_RECIPES: MergeRecipe[] = [
  { input: ['fire','water'],    output: 'steam',    flavorText: 'A scalding cloud erupts!' },
  { input: ['fire','stone'],    output: 'lava',     flavorText: 'The rock melts into magma!' },
  { input: ['fire','steel'],    output: 'furnace',  flavorText: 'A blazing forge is born!' },
  { input: ['fire','nature'],   output: 'ash',      flavorText: 'From the flames, only ash remains...' },
  { input: ['fire','sand'],     output: 'crystal',  flavorText: 'Sand fuses into brilliant glass!' },
  { input: ['fire','wind'],     output: 'ember',    flavorText: 'Sparks scatter on the breeze!' },
  { input: ['fire','ice'],      output: 'steam',    flavorText: 'Ice evaporates instantly!' },
  { input: ['water','ice'],     output: 'mist',     flavorText: 'A chilling fog rolls in...' },
  { input: ['water','spark'],   output: 'storm',    flavorText: 'Lightning meets the deep!' },
  { input: ['water','nature'],  output: 'coral',    flavorText: 'Life blooms beneath the waves!' },
  { input: ['water','wind'],    output: 'cloud',    flavorText: 'Vapor rises to the sky!' },
  { input: ['water','stone'],   output: 'sand',     flavorText: 'Erosion grinds stone to grains!' },
  { input: ['water','venom'],   output: 'acid',     flavorText: 'The water turns caustic!' },
  { input: ['ice','wind'],      output: 'storm',    flavorText: 'A blizzard howls to life!' },
  { input: ['ice','stone'],     output: 'obsidian', flavorText: 'Flash-frozen volcanic glass!' },
  { input: ['stone','nature'],  output: 'coral',    flavorText: 'Life clings to ancient rock!' },
  { input: ['stone','spark'],   output: 'magnetic', flavorText: 'The stone hums with polarity!' },
  { input: ['stone','shadow'],  output: 'obsidian', flavorText: 'Darkness hardens into glass!' },
  { input: ['steel','spark'],   output: 'magnetic', flavorText: 'Metal bends to unseen force!' },
  { input: ['steel','acid'],    output: 'venom',    flavorText: 'A toxic alloy seeps out!' },
  { input: ['steel','ice'],     output: 'mirror',   flavorText: 'A perfect reflective surface!' },
  { input: ['nature','shadow'], output: 'fungus',   flavorText: 'Something grows in the dark!' },
  { input: ['nature','bone'],   output: 'venom',    flavorText: 'A deadly natural toxin!' },
  { input: ['shadow','light'],  output: 'spirit',   flavorText: 'The veil between worlds thins!' },
  { input: ['shadow','void'],   output: 'void',     flavorText: 'The abyss stares back...' },
  { input: ['shadow','mirror'], output: 'void',     flavorText: 'The reflection swallows itself!' },
  { input: ['light','crystal'], output: 'neon',     flavorText: 'Prismatic beams scatter everywhere!' },
  { input: ['light','spark'],   output: 'plasma',   flavorText: 'Pure energy coalesces!' },
  { input: ['wind','sand'],     output: 'dust',     flavorText: 'A swirling sandstorm!' },
  { input: ['wind','spark'],    output: 'thunder',  flavorText: 'The sky cracks with power!' },
  { input: ['wind','cloud'],    output: 'storm',    flavorText: 'Winds churn the clouds!' },
  { input: ['spark','neon'],    output: 'plasma',   flavorText: 'Raw energy overloads!' },
  { input: ['crystal','shadow'],output: 'obsidian', flavorText: 'Darkness crystallizes!' },
  { input: ['crystal','spark'], output: 'neon',     flavorText: 'The crystal glows electric!' },
  { input: ['chalk','water'],   output: 'sand',     flavorText: 'Chalk dissolves into sediment!' },
  { input: ['chalk','fire'],    output: 'ash',      flavorText: 'Chalk crumbles to powder!' },
  { input: ['bone','shadow'],   output: 'spirit',   flavorText: 'A haunting presence arises!' },
  { input: ['bone','fire'],     output: 'ash',      flavorText: 'Only cinders remain...' },
  { input: ['fungus','water'],  output: 'acid',     flavorText: 'Spores ferment into acid!' },
  { input: ['fungus','venom'],  output: 'acid',     flavorText: 'A potent biological weapon!' },
  { input: ['mist','spark'],    output: 'static',   flavorText: 'Charges cling to moisture!' },
  { input: ['dust','fire'],     output: 'ember',    flavorText: 'Dust particles ignite!' },
  { input: ['lava','water'],    output: 'obsidian', flavorText: 'Lava cools into black glass!' },
  { input: ['plasma','ice'],    output: 'steam',    flavorText: 'Superheated ice vaporizes!' },
];

// Build O(1) lookup map
function recipeKey(a: MonsterType, b: MonsterType): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

const recipeMap = new Map<string, MergeRecipe>();
for (const r of MERGE_RECIPES) {
  recipeMap.set(recipeKey(r.input[0], r.input[1]), r);
}

const FAMILY_MEMBERS: Record<TypeFamily, MonsterType[]> = {
  thermal:     ['fire','lava','furnace','ember','ash'],
  aquatic:     ['water','ice','steam','acid','mist'],
  mineral:     ['stone','steel','crystal','chalk','obsidian','sand'],
  organic:     ['nature','fungus','coral','venom','bone'],
  electric:    ['spark','magnetic','plasma','static','neon'],
  arcane:      ['shadow','light','void','spirit','mirror'],
  atmospheric: ['wind','thunder','dust','cloud','storm'],
  // v1.701 — Combat ships with one member (martial). Room for
  // gladiator/monk/etc. as the Tower expands; FAMILY_MEMBERS just
  // needs the new ids appended here when those types land.
  combat:      ['martial'],
};

/**
 * Property-based merge resolver: combines properties of both input types
 * and finds the best matching type from all 36 options.
 */
function findBestPropertyMatch(a: MonsterType, b: MonsterType): MonsterType {
  const propsA = TYPE_PROPERTIES[a];
  const propsB = TYPE_PROPERTIES[b];
  const combined = new Set([...propsA, ...propsB]);

  let bestType: MonsterType = a;
  let bestScore = -1;

  for (const candidate of ALL_TYPES) {
    // Skip the two input types
    if (candidate === a || candidate === b) continue;

    const candidateProps = TYPE_PROPERTIES[candidate];
    let score = 0;
    for (const p of candidateProps) {
      if (combined.has(p)) score++;
    }
    // Bonus for matching properties from BOTH parents (not just one)
    for (const p of candidateProps) {
      if (propsA.includes(p) && propsB.includes(p)) score += 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestType = candidate;
    }
  }

  return bestType;
}

export interface MergeResult {
  resultType: MonsterType;
  flavorText: string;
  isDiscovery: boolean;
}

export function resolveMergeType(a: MonsterType, b: MonsterType): MergeResult {
  // 1. Specific recipe
  const recipe = recipeMap.get(recipeKey(a, b));
  if (recipe) {
    return { resultType: recipe.output, flavorText: recipe.flavorText, isDiscovery: true };
  }

  // 2. Same type
  if (a === b) {
    return { resultType: a, flavorText: 'The same energies amplify!', isDiscovery: false };
  }

  // 3. Family fallback
  const famA = TYPE_FAMILY_MAP[a];
  const famB = TYPE_FAMILY_MAP[b];

  if (famA === famB) {
    const pool = FAMILY_MEMBERS[famA].filter(t => t !== a && t !== b);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? a;
    return { resultType: pick, flavorText: 'Familiar energies recombine!', isDiscovery: false };
  }

  // 3b. Cross-family: find the type whose properties best combine both inputs
  const match = findBestPropertyMatch(a, b);
  return { resultType: match, flavorText: 'An unexpected transformation!', isDiscovery: false };
}

// ---------- MERGE ABILITY INHERITANCE ----------

export interface MergeAbilityPreview {
  abilities: GeneratedAbility[];
  inheritedFrom: ('parent1' | 'parent2' | 'new')[];
}

export function computeMergeAbilities(
  parent1: { abilities: GeneratedAbility[]; stats: { hp: number; atk: number; spd: number } },
  parent2: { abilities: GeneratedAbility[]; stats: { hp: number; atk: number; spd: number } },
  resultType: MonsterType,
  resultRarity: string,
): MergeAbilityPreview {
  const newAbs = generateAbilities(resultType, resultRarity);

  const atkDonor = parent1.stats.atk >= parent2.stats.atk ? parent1 : parent2;
  const hpDonor  = parent1.stats.hp  >= parent2.stats.hp  ? parent1 : parent2;
  const spdDonor = parent1.stats.spd >= parent2.stats.spd ? parent1 : parent2;

  const atkSrc: 'parent1' | 'parent2' = atkDonor === parent1 ? 'parent1' : 'parent2';
  const hpSrc:  'parent1' | 'parent2' = hpDonor  === parent1 ? 'parent1' : 'parent2';
  const spdSrc: 'parent1' | 'parent2' = spdDonor === parent1 ? 'parent1' : 'parent2';

  // 2026-05-17 (v1.401) — Anti-stack: every merged ability slot is
  // capped at `freshly-rolled-power + 1`. Previously each slot took
  // `max(new, parent.power + 1)`, so abilities ratcheted +1 per merge
  // generation — a 4-gen merge child had ability powers up to +4
  // above what a fresh roll could produce, on TOP of the stat
  // multiplier. With the cap, the +1 bonus still exists vs a fresh
  // roll (you get "slightly better than wild"), but it can't compound
  // through merge stacks.
  const abilityPowerCap = (slot: GeneratedAbility) => slot.power + 1;

  // Slot 0: Quick attack — capped boost over fresh-rolled power
  const slot0: GeneratedAbility = {
    ...newAbs[0]!,
    power: Math.min(
      abilityPowerCap(newAbs[0]!),
      Math.max(newAbs[0]!.power, (atkDonor.abilities[0]?.power ?? 0) + 1),
    ),
  };

  // Slot 1: Signature — always new
  const slot1 = newAbs[1]!;

  // Slot 2: Sustain — capped boost over fresh-rolled power
  const donorHeal = hpDonor.abilities.find(a => a.type === 'heal') ?? hpDonor.abilities[1];
  const slot2: GeneratedAbility = {
    ...newAbs[2]!,
    power: Math.min(
      abilityPowerCap(newAbs[2]!),
      Math.max(newAbs[2]!.power, (donorHeal?.power ?? 0) + 1),
    ),
  };

  // Slot 3: Utility buff — capped boost over fresh-rolled power
  const donorBuff = spdDonor.abilities.find(a => a.type === 'buff') ?? spdDonor.abilities[1];
  const slot3: GeneratedAbility = {
    ...newAbs[3]!,
    power: Math.min(
      abilityPowerCap(newAbs[3]!),
      Math.max(newAbs[3]!.power, (donorBuff?.power ?? 0) + 1),
    ),
  };

  // Slot 4: Debuff — capped boost over fresh-rolled power
  const donorDebuff = atkDonor.abilities.find(a => a.type === 'debuff') ?? atkDonor.abilities[0];
  const slot4: GeneratedAbility = {
    ...newAbs[4]!,
    power: Math.min(
      abilityPowerCap(newAbs[4]!),
      Math.max(newAbs[4]!.power, (donorDebuff?.power ?? 0) + 1),
    ),
  };

  return {
    abilities: [slot0, slot1, slot2, slot3, slot4],
    inheritedFrom: [atkSrc, 'new', hpSrc, spdSrc, atkSrc],
  };
}
