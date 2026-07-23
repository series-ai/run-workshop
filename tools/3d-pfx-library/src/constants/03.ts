import { PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS } from '../plasmaImpactFlipbook'
import { PERFORMANCE_TIER_BUDGETS, PFX_QUALITY_RUBRIC_KEYS, getPfxStyleRenderProfile, getPfxStyleRenderSignature, getPfxTextureAtlasSlice } from './01'
import { AUTHORED_EFFECT_RECIPES } from './02'
import type { ArtStyleCluster, EffectSpace, EffectType, LoopMode, MobileSafety, PerformanceTier, PfxBehaviorRole, PfxControls, PfxMarketSourceFamily, PfxPerformanceBudget, PfxPerformanceMetadata, PfxPreset, PfxPreviewDescriptor, PfxQualityScore, PfxQualityScores, PfxStyleRenderProfile, PfxTaxonomyEffect, SpawnShape } from '../types/01'
import type { PfxImplementationProfile, PfxRenderSurface, PfxSurfaceTuning, SeedEffect } from '../types/02'

export const SEED_EFFECTS: SeedEffect[] = [
  seed('fireball', 'Fireball', 'projectile', ['combat', 'spell', 'ranged'], ['fantasy', 'elemental', 'stylized'], ['danger', 'power'], ['orange', 'yellow'], 'burst', 'world', 'safe', 'directional-burst'),
  seed('explosion', 'Explosion', 'explosion', ['combat', 'destruction'], ['realistic', 'arcade', 'elemental'], ['danger', 'impact'], ['orange', 'gray'], 'burst', 'world', 'caution', 'radial-burst'),
  seed('smoke-puff', 'Smoke Puff', 'smoke', ['impact', 'movement', 'environment'], ['realistic', 'low-poly', 'toon'], ['soft', 'aftermath'], ['gray'], 'burst', 'world', 'safe', 'volume-cloud'),
  seed('muzzle-flash', 'Muzzle Flash', 'weapon', ['combat', 'ranged', 'feedback'], ['sci-fi', 'realistic', 'arcade'], ['sharp', 'impact'], ['yellow', 'white'], 'burst', 'world', 'safe', 'directional-burst'),
  seed('hit-spark', 'Hit Spark', 'impact', ['combat', 'feedback'], ['arcade', 'anime', 'toon'], ['sharp', 'impact'], ['yellow', 'white'], 'burst', 'world', 'safe', 'radial-burst'),
  seed('healing-aura', 'Healing Aura', 'aura', ['healing', 'buff'], ['cozy', 'magical', 'fantasy'], ['comfort', 'relief'], ['green', 'cyan'], 'loop', 'world', 'safe', 'continuous-emitter'),
  seed('slash-trail', 'Slash Trail', 'trail', ['combat', 'melee'], ['anime', 'arcade', 'fantasy'], ['speed', 'impact'], ['white', 'blue'], 'burst', 'world', 'safe', 'trail-ribbon'),
  seed('loot-beam', 'Loot Beam', 'loot', ['reward', 'discovery'], ['cozy', 'arcade', 'fantasy'], ['reward', 'attention'], ['gold', 'white'], 'loop', 'world', 'safe', 'beam-column'),
  seed('force-field', 'Force Field', 'shield', ['defense', 'telegraph'], ['sci-fi', 'magical', 'neon'], ['protection', 'tension'], ['blue', 'cyan'], 'loop', 'world', 'safe', 'ring-field'),
  seed('footstep-dust', 'Footstep Dust', 'movement', ['movement', 'grounding'], ['realistic', 'low-poly', 'toon'], ['grounded'], ['tan', 'gray'], 'burst', 'world', 'safe', 'directional-burst'),
  seed('shield-break', 'Shield Break', 'shield', ['combat', 'defense', 'failure'], ['sci-fi', 'fantasy', 'arcade'], ['alarm', 'impact'], ['cyan', 'white'], 'burst', 'world', 'safe', 'radial-burst'),
  seed('poison-cloud', 'Poison Cloud', 'status', ['hazard', 'debuff', 'area-denial'], ['horror', 'fantasy', 'elemental'], ['danger', 'sickness'], ['green', 'purple'], 'loop', 'world', 'caution', 'volume-cloud'),
  seed('ui-reward-burst', 'UI Reward Burst', 'ui', ['reward', 'celebration'], ['cozy', 'arcade', 'toon'], ['joy', 'reward'], ['gold', 'pink'], 'burst', 'ui', 'safe', 'screen-overlay'),
  seed('charge-telegraph', 'Charge Telegraph', 'telegraph', ['warning', 'combat', 'timing'], ['tactical', 'sci-fi', 'fantasy'], ['tension', 'warning'], ['red', 'orange'], 'loop', 'world', 'safe', 'ring-field'),
  seed('spawn-marker', 'Spawn Marker', 'spawn', ['spawn', 'warning'], ['tactical', 'arcade', 'sci-fi'], ['anticipation'], ['cyan', 'white'], 'loop', 'world', 'safe', 'ring-field'),
  seed('dissolve', 'Dissolve', 'dissolve', ['death', 'transition'], ['sci-fi', 'magical', 'abstract'], ['mystery', 'departure'], ['blue', 'purple'], 'burst', 'world', 'safe', 'volume-cloud'),
  seed('portal-idle-loop', 'Portal Idle Loop', 'portal', ['navigation', 'spawn', 'environment'], ['magical', 'sci-fi', 'fantasy'], ['mystery', 'power'], ['purple', 'cyan'], 'loop', 'world', 'caution', 'ring-field'),
  seed('projectile-trail', 'Projectile Trail', 'trail', ['combat', 'ranged', 'readability'], ['arcade', 'sci-fi', 'fantasy'], ['speed'], ['blue', 'white'], 'loop', 'world', 'safe', 'trail-ribbon'),
  seed('underwater-bubbles', 'Underwater Bubbles', 'water', ['environment', 'movement'], ['cozy', 'realistic', 'toon'], ['calm'], ['blue', 'white'], 'loop', 'world', 'safe', 'continuous-emitter'),
  seed('snow-gust', 'Snow Gust', 'weather', ['weather', 'environment'], ['realistic', 'cozy', 'painterly'], ['cold', 'soft'], ['white', 'blue'], 'loop', 'world', 'safe', 'volume-cloud'),
  seed('low-health-screen-particles', 'Low Health Screen Particles', 'ui', ['warning', 'health', 'accessibility'], ['horror', 'tactical', 'arcade'], ['danger', 'urgency'], ['red'], 'loop', 'ui', 'safe', 'screen-overlay'),
  seed('coin-pickup-sparkle', 'Coin Pickup Sparkle', 'loot', ['reward', 'pickup'], ['cozy', 'arcade', 'toon'], ['joy', 'reward'], ['gold'], 'burst', 'world', 'safe', 'radial-burst'),
  seed('critical-hit-burst', 'Critical Hit Burst', 'impact', ['combat', 'feedback'], ['anime', 'arcade', 'fantasy'], ['impact', 'triumph'], ['red', 'gold'], 'burst', 'world', 'safe', 'radial-burst'),
  seed('enemy-death-poof', 'Enemy Death Poof', 'smoke', ['death', 'cleanup'], ['toon', 'arcade', 'low-poly'], ['release'], ['gray', 'purple'], 'burst', 'world', 'safe', 'volume-cloud'),
  // The event may be triggered by UI progression, but its ceremony belongs
  // to the actor in world space. Camera-pinning erased parallax and made the
  // surge stand beside the character like a HUD sticker in gameplay review.
  seed('level-up-flare', 'Level Up Flare', 'ui', ['reward', 'progression'], ['magical', 'arcade', 'cozy'], ['triumph', 'reward'], ['gold', 'white'], 'burst', 'world', 'safe', 'beam-column'),
]

const FAMILIES = [
  'embers',
  'flame',
  'meteor',
  'blast',
  'shockwave',
  'dust',
  'debris',
  'spark',
  'shard',
  'rune',
  'glyph',
  'beam',
  'laser',
  'plasma',
  'electric',
  'ice',
  'frost',
  'water',
  'bubble',
  'rain',
  'snow',
  'wind',
  'leaf',
  'petal',
  'sand',
  'mud',
  'slime',
  'poison',
  'acid',
  'healing',
  'holy',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'portal',
  'warp',
  'teleport',
  'spawn',
  'despawn',
  'shield',
  'barrier',
  'reflect',
  'parry',
  'dash',
  'jump',
  'landing',
  'footstep',
  'pickup',
  'reward',
  'combo',
  'ui',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'engine',
  'thruster',
  'exhaust',
] as const

const VARIANTS = [
  'burst',
  'loop',
  'trail',
  'impact',
  'idle',
  'charge',
  'release',
  'telegraph',
  'aura',
  'beam',
  'ring',
  'cone',
  'spray',
  'column',
  'screen',
  'pickup',
  'break',
  'hit',
  'miss',
  'ambient',
  'spawn',
  'death',
  'critical',
  'low-health',
] as const

const IMPACT_COMPATIBLE_FAMILIES = new Set([
  'embers',
  'flame',
  'meteor',
  'blast',
  'shockwave',
  'dust',
  'debris',
  'spark',
  'shard',
  'rune',
  'glyph',
  'beam',
  'laser',
  'plasma',
  'electric',
  'ice',
  'frost',
  'water',
  'snow',
  'wind',
  'leaf',
  'petal',
  'sand',
  'mud',
  'slime',
  'poison',
  'acid',
  'holy',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'portal',
  'warp',
  'teleport',
  'despawn',
  'shield',
  'barrier',
  'reflect',
  'parry',
  'dash',
  'jump',
  'landing',
  'footstep',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'engine',
  'thruster',
  'exhaust',
])

const TRAIL_COMPATIBLE_FAMILIES = new Set([
  'embers',
  'flame',
  'meteor',
  'blast',
  'shockwave',
  'dust',
  'debris',
  'spark',
  'shard',
  'rune',
  'glyph',
  'beam',
  'laser',
  'plasma',
  'electric',
  'ice',
  'frost',
  'water',
  'bubble',
  'rain',
  'snow',
  'wind',
  'leaf',
  'petal',
  'sand',
  'mud',
  'slime',
  'poison',
  'acid',
  'healing',
  'holy',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'portal',
  'warp',
  'teleport',
  'spawn',
  'despawn',
  'shield',
  'barrier',
  'reflect',
  'parry',
  'dash',
  'jump',
  'landing',
  'footstep',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'engine',
  'thruster',
  'exhaust',
])

const LOOP_COMPATIBLE_FAMILIES = new Set([
  'embers',
  'flame',
  'dust',
  'debris',
  'spark',
  'shard',
  'rune',
  'glyph',
  'beam',
  'laser',
  'plasma',
  'electric',
  'ice',
  'frost',
  'water',
  'bubble',
  'rain',
  'snow',
  'wind',
  'leaf',
  'petal',
  'sand',
  'mud',
  'slime',
  'poison',
  'acid',
  'healing',
  'holy',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'portal',
  'warp',
  'teleport',
  'spawn',
  'despawn',
  'shield',
  'barrier',
  'reflect',
  'parry',
  'dash',
  'jump',
  'landing',
  'footstep',
  'pickup',
  'reward',
  'combo',
  'ui',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'engine',
  'thruster',
  'exhaust',
])

const CHARGE_COMPATIBLE_FAMILIES = new Set([
  'embers',
  'flame',
  'meteor',
  'blast',
  'shockwave',
  'dust',
  'debris',
  'spark',
  'shard',
  'rune',
  'glyph',
  'beam',
  'laser',
  'plasma',
  'electric',
  'ice',
  'frost',
  'water',
  'snow',
  'wind',
  'sand',
  'mud',
  'slime',
  'poison',
  'acid',
  'healing',
  'holy',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'portal',
  'warp',
  'teleport',
  'spawn',
  'despawn',
  'shield',
  'barrier',
  'reflect',
  'parry',
  'dash',
  'jump',
  'landing',
  'reward',
  'combo',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'engine',
  'thruster',
  'exhaust',
])

const RELEASE_COMPATIBLE_FAMILIES = new Set([
  'embers',
  'flame',
  'meteor',
  'blast',
  'shockwave',
  'dust',
  'debris',
  'spark',
  'shard',
  'rune',
  'glyph',
  'beam',
  'laser',
  'plasma',
  'electric',
  'ice',
  'frost',
  'water',
  'bubble',
  'rain',
  'snow',
  'wind',
  'leaf',
  'petal',
  'sand',
  'mud',
  'slime',
  'poison',
  'acid',
  'healing',
  'holy',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'portal',
  'warp',
  'teleport',
  'spawn',
  'despawn',
  'shield',
  'barrier',
  'reflect',
  'parry',
  'dash',
  'jump',
  'landing',
  'footstep',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'engine',
  'thruster',
  'exhaust',
])

const PICKUP_COMPATIBLE_FAMILIES = new Set([
  'pickup',
  'reward',
  'combo',
  'ui',
  'spark',
  'glyph',
  'jump',
  'landing',
  'footstep',
])

const MISS_COMPATIBLE_FAMILIES = new Set([
  'target',
  'warning',
  'debris',
  'dust',
  'spark',
  'shard',
  'beam',
  'laser',
  'plasma',
  'electric',
  'dash',
  'jump',
  'combo',
])

const LOW_HEALTH_COMPATIBLE_FAMILIES = new Set([
  'warning',
  'ui',
  'target',
  'shield',
  'barrier',
  'blood',
  'shadow',
  'curse',
  'ghost',
])

const CRITICAL_COMPATIBLE_FAMILIES = new Set([
  'embers',
  'flame',
  'meteor',
  'blast',
  'shockwave',
  'debris',
  'spark',
  'shard',
  'beam',
  'laser',
  'plasma',
  'electric',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'target',
])

const DEATH_COMPATIBLE_FAMILIES = new Set([
  'blast',
  'shockwave',
  'dust',
  'debris',
  'poison',
  'acid',
  'slime',
  'curse',
  'shadow',
  'blood',
  'ghost',
  'despawn',
])

const SCREEN_COMPATIBLE_FAMILIES = new Set([
  'spawn',
  'pickup',
  'reward',
  'combo',
  'ui',
  'target',
  'warning',
  'marker',
  'scan',
  'hologram',
  'blood',
  'shadow',
  'curse',
])

const SEEDED_EFFECT_ROLES: Record<string, PfxBehaviorRole> = {
  fireball: 'projectile',
  explosion: 'burst',
  'smoke-puff': 'impact',
  'muzzle-flash': 'burst',
  'hit-spark': 'impact',
  'healing-aura': 'loop',
  'slash-trail': 'trail',
  'loot-beam': 'reward',
  'force-field': 'loop',
  'footstep-dust': 'impact',
  'shield-break': 'despawn',
  'poison-cloud': 'loop',
  'ui-reward-burst': 'screen',
  'charge-telegraph': 'telegraph',
  'spawn-marker': 'spawn',
  dissolve: 'despawn',
  'portal-idle-loop': 'loop',
  'projectile-trail': 'trail',
  'underwater-bubbles': 'loop',
  'snow-gust': 'loop',
  'low-health-screen-particles': 'screen',
  'coin-pickup-sparkle': 'reward',
  'critical-hit-burst': 'burst',
  'enemy-death-poof': 'despawn',
  'level-up-flare': 'burst',
}

const VARIANT_BEHAVIOR_ROLES: Record<string, PfxBehaviorRole> = {
  burst: 'burst',
  explosion: 'burst',
  poof: 'burst',
  flare: 'burst',
  critical: 'burst',
  cone: 'burst',
  ring: 'burst',
  flash: 'burst',
  impact: 'impact',
  hit: 'impact',
  spark: 'impact',
  miss: 'impact',
  dust: 'impact',
  charge: 'charge',
  release: 'release',
  telegraph: 'telegraph',
  marker: 'telegraph',
  beam: 'beam',
  column: 'beam',
  spray: 'beam',
  trail: 'trail',
  spawn: 'spawn',
  death: 'despawn',
  break: 'despawn',
  dissolve: 'despawn',
  pickup: 'reward',
  health: 'reward',
  sparkle: 'reward',
  loop: 'loop',
  idle: 'loop',
  aura: 'loop',
  field: 'loop',
  ambient: 'loop',
  cloud: 'loop',
  bubbles: 'loop',
  gust: 'loop',
  particles: 'loop',
  fireball: 'projectile',
  screen: 'screen',
}

export function derivePfxBehaviorRole(effect: Omit<PfxTaxonomyEffect, 'rank' | 'role'>): PfxBehaviorRole {
  const seeded = SEEDED_EFFECT_ROLES[effect.id]
  if (seeded) return seeded
  const generatedOverride = GENERATED_BEHAVIOR_ROLE_OVERRIDES[effect.id]
  if (generatedOverride) return generatedOverride
  const variant = effect.id.split('-').at(-1) ?? ''
  const byVariant = VARIANT_BEHAVIOR_ROLES[variant]
  if (byVariant) return effect.space === 'ui' && byVariant !== 'screen' ? byVariant : byVariant
  // Fallback: continuous loops read as loops; everything else as a burst.
  return effect.loopMode === 'loop' ? 'loop' : 'burst'
}

const GENERATED_TYPE_OVERRIDES: Record<string, EffectType> = {
  'blast-trail': 'trail',
  'shockwave-trail': 'trail',
  'blast-beam': 'sci-fi',
}

const GENERATED_PROFILE_OVERRIDES: Partial<Record<string, PfxImplementationProfile>> = {
  'ghost-critical': 'directional-burst',
  // This weather-family beam is a fast attack vector, not an ambient cloud.
  'wind-beam': 'directional-burst',
  // Discrete falling petals form a persistent authored stream; no haze or
  // gaseous mass is implied by the implementation.
  'petal-ambient': 'continuous-emitter',
  // A charge is a sustained anticipation build, not an omnidirectional hit.
  // Its authored surfaces still end as a bounded burst, but the catalog
  // profile must describe the build phase the player is meant to read.
  'flame-charge': 'continuous-emitter',
}

const GENERATED_MOBILE_SAFETY_OVERRIDES: Partial<Record<string, MobileSafety>> = {
  'electric-critical': 'safe',
  // Earned by the authored one-draw, texture-free closed pigment mesh. Real
  // device acceptance remains a separate mandatory evidence gate.
  'blood-death': 'safe',
  // One texture-free merged aperture replaces the old five-draw stack.
  'portal-telegraph': 'safe',
  // Preserve the hero vortex while consolidating support to one closed batch.
  'warp-spray': 'safe',
  // One texture-free merged fortified pillar replaces five persistent draws.
  'barrier-column': 'safe',
  // One texture-free merged accelerator replaces a five-draw beam/particle stack.
  'jump-beam': 'safe',
}

const GENERATED_BEHAVIOR_ROLE_OVERRIDES: Partial<Record<string, PfxBehaviorRole>> = {
  'barrier-low-health': 'loop',
}

const GENERATED_LOOP_MODE_OVERRIDES: Partial<Record<string, LoopMode>> = {
  'barrier-low-health': 'loop',
}

const GENERATED_SPACE_OVERRIDES: Partial<Record<string, EffectSpace>> = {
  'barrier-low-health': 'world',
}

const PFX_HERO_MOMENT_EFFECTS = new Set<string>([
  'critical-hit-burst',
  'electric-critical',
  'ghost-critical',
  'hit-spark',
  // Heavy slams carry the shadow-flash contrast pocket — one extra layer.
  'meteor-impact',
  'landing-impact',
  // Charge exemplar: full five-beat anticipation stack.
  'electric-charge',
  // Release exemplar: full cast-point stack.
  'electric-release',
  // Meteor payoff carries the full molten stack.
  'meteor-release',
  // Telegraph exemplar: full danger-marker stack.
  'meteor-telegraph',
  // Loop exemplar: full aura anatomy (ring, motes, glyphs, body sheen).
  'healing-aura',
  // Beam exemplar: full geyser anatomy.
  'water-column',
])

export const PFX_CERTIFIED_EFFECTS: ReadonlyMap<string, string> = new Map([
  // 2026-07-12 finale groups pass (spawn/despawn/reward/screen, user-reviewed:
  // spawn anticipation grammar, despawn receipts, reward relays, screen
  // camera anchoring; perf 0.40ms worst, gate 22/22).
  ['spawn-marker', 'finale-pass'],
  ['snow-spawn', 'finale-pass'],
  ['acid-spawn', 'finale-pass'],
  ['target-spawn', 'finale-pass'],
  ['shield-break', 'finale-pass'],
  ['dissolve', 'finale-pass'],
  ['enemy-death-poof', 'finale-pass'],
  ['target-break', 'finale-pass'],
  ['poison-death', 'finale-pass'],
  ['shard-break', 'finale-pass'],
  ['shadow-break', 'finale-pass'],
  ['blood-death', 'finale-pass'],
  ['hologram-break', 'finale-pass'],
  ['loot-beam', 'finale-pass'],
  ['coin-pickup-sparkle', 'finale-pass'],
  ['jump-pickup', 'finale-pass'],
  ['barrier-low-health', 'finale-pass'],
  ['ui-pickup', 'finale-pass'],
  ['ui-reward-burst', 'finale-pass'],
  ['low-health-screen-particles', 'finale-pass'],
  ['spawn-screen', 'finale-pass'],
  // 2026-07-12 loop group pass (user-certified: element identity doctrine,
  // no-group-rotation rule, hex-shell force fields, water pool surface,
  // upright lick flames, perf 0.50ms worst, gate 126/126).
  ['healing-aura', 'loop-pass'],
  ['force-field', 'loop-pass'],
  ['poison-cloud', 'loop-pass'],
  ['portal-idle-loop', 'loop-pass'],
  ['underwater-bubbles', 'loop-pass'],
  ['snow-gust', 'loop-pass'],
  ['spark-loop', 'loop-pass'],
  ['acid-idle', 'loop-pass'],
  ['hologram-aura', 'loop-pass'],
  ['plasma-ambient', 'loop-pass'],
  ['dust-loop', 'loop-pass'],
  ['frost-aura', 'loop-pass'],
  ['snow-idle', 'loop-pass'],
  ['petal-ambient', 'loop-pass'],
  ['healing-loop', 'loop-pass'],
  ['shield-aura', 'loop-pass'],
  ['dash-idle', 'loop-pass'],
  ['footstep-ambient', 'loop-pass'],
  ['warning-loop', 'loop-pass'],
  ['embers-loop', 'loop-pass'],
  ['flame-loop', 'loop-pass'],
  ['debris-loop', 'loop-pass'],
  ['shard-loop', 'loop-pass'],
  ['rune-loop', 'loop-pass'],
  ['glyph-loop', 'loop-pass'],
  ['beam-loop', 'loop-pass'],
  ['laser-loop', 'loop-pass'],
  ['plasma-loop', 'loop-pass'],
  ['electric-loop', 'loop-pass'],
  ['ice-loop', 'loop-pass'],
  ['frost-loop', 'loop-pass'],
  ['water-loop', 'loop-pass'],
  ['bubble-loop', 'loop-pass'],
  ['rain-loop', 'loop-pass'],
  ['snow-loop', 'loop-pass'],
  ['wind-loop', 'loop-pass'],
  ['leaf-loop', 'loop-pass'],
  ['petal-loop', 'loop-pass'],
  ['sand-loop', 'loop-pass'],
  ['mud-loop', 'loop-pass'],
  ['slime-loop', 'loop-pass'],
  ['poison-loop', 'loop-pass'],
  ['acid-loop', 'loop-pass'],
  ['holy-loop', 'loop-pass'],
  ['curse-loop', 'loop-pass'],
  ['shadow-loop', 'loop-pass'],
  ['blood-loop', 'loop-pass'],
  ['ghost-loop', 'loop-pass'],
  ['portal-loop', 'loop-pass'],
  ['warp-loop', 'loop-pass'],
  ['teleport-loop', 'loop-pass'],
  ['spawn-loop', 'loop-pass'],
  ['despawn-loop', 'loop-pass'],
  ['shield-loop', 'loop-pass'],
  ['barrier-loop', 'loop-pass'],
  ['reflect-loop', 'loop-pass'],
  ['parry-loop', 'loop-pass'],
  ['dash-loop', 'loop-pass'],
  ['jump-loop', 'loop-pass'],
  ['landing-loop', 'loop-pass'],
  ['footstep-loop', 'loop-pass'],
  ['pickup-loop', 'loop-pass'],
  ['reward-loop', 'loop-pass'],
  ['combo-loop', 'loop-pass'],
  ['ui-loop', 'loop-pass'],
  ['target-loop', 'loop-pass'],
  ['marker-loop', 'loop-pass'],
  ['scan-loop', 'loop-pass'],
  ['hologram-loop', 'loop-pass'],
  ['engine-loop', 'loop-pass'],
  ['thruster-loop', 'loop-pass'],
  ['exhaust-loop', 'loop-pass'],
  ['embers-idle', 'loop-pass'],
  ['flame-idle', 'loop-pass'],
  ['dust-idle', 'loop-pass'],
  ['debris-idle', 'loop-pass'],
  ['spark-idle', 'loop-pass'],
  ['shard-idle', 'loop-pass'],
  ['rune-idle', 'loop-pass'],
  ['glyph-idle', 'loop-pass'],
  ['beam-idle', 'loop-pass'],
  ['laser-idle', 'loop-pass'],
  ['plasma-idle', 'loop-pass'],
  ['electric-idle', 'loop-pass'],
  ['ice-idle', 'loop-pass'],
  ['frost-idle', 'loop-pass'],
  ['water-idle', 'loop-pass'],
  ['bubble-idle', 'loop-pass'],
  ['rain-idle', 'loop-pass'],
  ['wind-idle', 'loop-pass'],
  ['leaf-idle', 'loop-pass'],
  ['petal-idle', 'loop-pass'],
  ['sand-idle', 'loop-pass'],
  ['mud-idle', 'loop-pass'],
  ['slime-idle', 'loop-pass'],
  ['poison-idle', 'loop-pass'],
  ['healing-idle', 'loop-pass'],
  ['holy-idle', 'loop-pass'],
  ['curse-idle', 'loop-pass'],
  ['shadow-idle', 'loop-pass'],
  ['blood-idle', 'loop-pass'],
  ['ghost-idle', 'loop-pass'],
  ['portal-idle', 'loop-pass'],
  ['warp-idle', 'loop-pass'],
  ['teleport-idle', 'loop-pass'],
  ['spawn-idle', 'loop-pass'],
  ['despawn-idle', 'loop-pass'],
  ['shield-idle', 'loop-pass'],
  ['barrier-idle', 'loop-pass'],
  ['reflect-idle', 'loop-pass'],
  ['parry-idle', 'loop-pass'],
  ['jump-idle', 'loop-pass'],
  ['landing-idle', 'loop-pass'],
  ['footstep-idle', 'loop-pass'],
  ['pickup-idle', 'loop-pass'],
  ['reward-idle', 'loop-pass'],
  ['combo-idle', 'loop-pass'],
  ['ui-idle', 'loop-pass'],
  ['target-idle', 'loop-pass'],
  ['warning-idle', 'loop-pass'],
  ['marker-idle', 'loop-pass'],
  ['scan-idle', 'loop-pass'],
  ['hologram-idle', 'loop-pass'],
  ['engine-idle', 'loop-pass'],
  ['thruster-idle', 'loop-pass'],
  ['exhaust-idle', 'loop-pass'],
  // 2026-07-12 trail group pass (user-certified: wake/dash/footprint/slash
  // anatomies, trail-flow ribbons, matter-class sizes, perf 0.47ms worst).
  ['slash-trail', 'trail-pass'],
  ['projectile-trail', 'trail-pass'],
  ['electric-trail', 'trail-pass'],
  ['glyph-trail', 'trail-pass'],
  ['ghost-trail', 'trail-pass'],
  ['thruster-trail', 'trail-pass'],
  ['embers-trail', 'trail-pass'],
  ['flame-trail', 'trail-pass'],
  ['meteor-trail', 'trail-pass'],
  ['blast-trail', 'trail-pass'],
  ['shockwave-trail', 'trail-pass'],
  ['dust-trail', 'trail-pass'],
  ['debris-trail', 'trail-pass'],
  ['spark-trail', 'trail-pass'],
  ['shard-trail', 'trail-pass'],
  ['rune-trail', 'trail-pass'],
  ['beam-trail', 'trail-pass'],
  ['laser-trail', 'trail-pass'],
  ['plasma-trail', 'trail-pass'],
  ['ice-trail', 'trail-pass'],
  ['frost-trail', 'trail-pass'],
  ['water-trail', 'trail-pass'],
  ['bubble-trail', 'trail-pass'],
  ['rain-trail', 'trail-pass'],
  ['snow-trail', 'trail-pass'],
  ['wind-trail', 'trail-pass'],
  ['leaf-trail', 'trail-pass'],
  ['petal-trail', 'trail-pass'],
  ['sand-trail', 'trail-pass'],
  ['mud-trail', 'trail-pass'],
  ['slime-trail', 'trail-pass'],
  ['poison-trail', 'trail-pass'],
  ['acid-trail', 'trail-pass'],
  ['healing-trail', 'trail-pass'],
  ['holy-trail', 'trail-pass'],
  ['curse-trail', 'trail-pass'],
  ['shadow-trail', 'trail-pass'],
  ['blood-trail', 'trail-pass'],
  ['portal-trail', 'trail-pass'],
  ['warp-trail', 'trail-pass'],
  ['teleport-trail', 'trail-pass'],
  ['spawn-trail', 'trail-pass'],
  ['despawn-trail', 'trail-pass'],
  ['shield-trail', 'trail-pass'],
  ['barrier-trail', 'trail-pass'],
  ['reflect-trail', 'trail-pass'],
  ['parry-trail', 'trail-pass'],
  ['dash-trail', 'trail-pass'],
  ['jump-trail', 'trail-pass'],
  ['landing-trail', 'trail-pass'],
  ['footstep-trail', 'trail-pass'],
  ['target-trail', 'trail-pass'],
  ['warning-trail', 'trail-pass'],
  ['marker-trail', 'trail-pass'],
  ['scan-trail', 'trail-pass'],
  ['hologram-trail', 'trail-pass'],
  ['engine-trail', 'trail-pass'],
  ['exhaust-trail', 'trail-pass'],
  // 2026-07-12 beam group pass (user-reviewed rounds: geyser exemplar,
  // origin audit, water-flow shader, apex class; perf 0.64ms worst).
  ['blast-beam', 'beam-pass'],
  ['sand-spray', 'beam-pass'],
  ['curse-column', 'beam-pass'],
  ['laser-spray', 'beam-pass'],
  ['water-column', 'beam-pass'],
  ['wind-beam', 'beam-pass'],
  ['warp-spray', 'beam-pass'],
  ['barrier-column', 'beam-pass'],
  ['jump-beam', 'beam-pass'],
  // 2026-07-12 telegraph group pass (user-certified: danger-marker spec,
  // textured reticle rings, two grammars by tier, perf 0.49ms worst).
  ['charge-telegraph', 'telegraph-pass'],
  ['reward-telegraph', 'telegraph-pass'],
  ['beam-telegraph', 'telegraph-pass'],
  ['portal-telegraph', 'telegraph-pass'],
  ['exhaust-telegraph', 'telegraph-pass'],
  ['embers-telegraph', 'telegraph-pass'],
  ['flame-telegraph', 'telegraph-pass'],
  ['meteor-telegraph', 'telegraph-pass'],
  ['dust-telegraph', 'telegraph-pass'],
  ['debris-telegraph', 'telegraph-pass'],
  ['spark-telegraph', 'telegraph-pass'],
  ['shard-telegraph', 'telegraph-pass'],
  ['rune-telegraph', 'telegraph-pass'],
  ['glyph-telegraph', 'telegraph-pass'],
  ['laser-telegraph', 'telegraph-pass'],
  ['plasma-telegraph', 'telegraph-pass'],
  ['electric-telegraph', 'telegraph-pass'],
  ['ice-telegraph', 'telegraph-pass'],
  ['frost-telegraph', 'telegraph-pass'],
  ['water-telegraph', 'telegraph-pass'],
  ['bubble-telegraph', 'telegraph-pass'],
  ['rain-telegraph', 'telegraph-pass'],
  ['snow-telegraph', 'telegraph-pass'],
  ['wind-telegraph', 'telegraph-pass'],
  ['leaf-telegraph', 'telegraph-pass'],
  ['petal-telegraph', 'telegraph-pass'],
  ['sand-telegraph', 'telegraph-pass'],
  ['mud-telegraph', 'telegraph-pass'],
  ['slime-telegraph', 'telegraph-pass'],
  ['poison-telegraph', 'telegraph-pass'],
  ['acid-telegraph', 'telegraph-pass'],
  ['healing-telegraph', 'telegraph-pass'],
  ['holy-telegraph', 'telegraph-pass'],
  ['curse-telegraph', 'telegraph-pass'],
  ['shadow-telegraph', 'telegraph-pass'],
  ['blood-telegraph', 'telegraph-pass'],
  ['ghost-telegraph', 'telegraph-pass'],
  ['warp-telegraph', 'telegraph-pass'],
  ['teleport-telegraph', 'telegraph-pass'],
  ['spawn-telegraph', 'telegraph-pass'],
  // 2026-07-12 release group pass (user-certified: cast-point spec, element
  // fans, full-chroma pigment pass, performance 0.7ms worst).
  ['reflect-release', 'release-pass'],
  ['debris-release', 'release-pass'],
  ['holy-release', 'release-pass'],
  ['marker-release', 'release-pass'],
  ['embers-release', 'release-pass'],
  ['flame-release', 'release-pass'],
  ['meteor-release', 'release-pass'],
  ['dust-release', 'release-pass'],
  ['spark-release', 'release-pass'],
  ['shard-release', 'release-pass'],
  ['rune-release', 'release-pass'],
  ['glyph-release', 'release-pass'],
  ['beam-release', 'release-pass'],
  ['laser-release', 'release-pass'],
  ['plasma-release', 'release-pass'],
  ['electric-release', 'release-pass'],
  ['ice-release', 'release-pass'],
  ['frost-release', 'release-pass'],
  ['water-release', 'release-pass'],
  ['bubble-release', 'release-pass'],
  ['rain-release', 'release-pass'],
  ['snow-release', 'release-pass'],
  ['wind-release', 'release-pass'],
  ['leaf-release', 'release-pass'],
  ['petal-release', 'release-pass'],
  ['sand-release', 'release-pass'],
  ['mud-release', 'release-pass'],
  ['slime-release', 'release-pass'],
  ['poison-release', 'release-pass'],
  ['acid-release', 'release-pass'],
  ['healing-release', 'release-pass'],
  ['curse-release', 'release-pass'],
  ['shadow-release', 'release-pass'],
  ['blood-release', 'release-pass'],
  ['ghost-release', 'release-pass'],
  ['portal-release', 'release-pass'],
  ['warp-release', 'release-pass'],
  ['teleport-release', 'release-pass'],
  ['spawn-release', 'release-pass'],
  ['despawn-release', 'release-pass'],
  ['shield-release', 'release-pass'],
  ['barrier-release', 'release-pass'],
  ['parry-release', 'release-pass'],
  ['dash-release', 'release-pass'],
  ['jump-release', 'release-pass'],
  ['landing-release', 'release-pass'],
  ['footstep-release', 'release-pass'],
  ['target-release', 'release-pass'],
  ['warning-release', 'release-pass'],
  ['scan-release', 'release-pass'],
  ['hologram-release', 'release-pass'],
  ['engine-release', 'release-pass'],
  ['thruster-release', 'release-pass'],
  ['exhaust-release', 'release-pass'],
  // 2026-07-12 charge group pass (user-certified: anticipation spec, three
  // tier templates, five review rounds, performance pass 0.63ms worst).
  ['portal-charge', 'charge-pass'],
  ['flame-charge', 'charge-pass'],
  ['mud-charge', 'charge-pass'],
  ['reward-charge', 'charge-pass'],
  ['embers-charge', 'charge-pass'],
  ['meteor-charge', 'charge-pass'],
  ['dust-charge', 'charge-pass'],
  ['debris-charge', 'charge-pass'],
  ['spark-charge', 'charge-pass'],
  ['shard-charge', 'charge-pass'],
  ['rune-charge', 'charge-pass'],
  ['glyph-charge', 'charge-pass'],
  ['beam-charge', 'charge-pass'],
  ['laser-charge', 'charge-pass'],
  ['plasma-charge', 'charge-pass'],
  ['electric-charge', 'charge-pass'],
  ['ice-charge', 'charge-pass'],
  ['frost-charge', 'charge-pass'],
  ['water-charge', 'charge-pass'],
  ['snow-charge', 'charge-pass'],
  ['wind-charge', 'charge-pass'],
  ['sand-charge', 'charge-pass'],
  ['slime-charge', 'charge-pass'],
  ['poison-charge', 'charge-pass'],
  ['acid-charge', 'charge-pass'],
  ['healing-charge', 'charge-pass'],
  ['holy-charge', 'charge-pass'],
  ['curse-charge', 'charge-pass'],
  ['shadow-charge', 'charge-pass'],
  ['blood-charge', 'charge-pass'],
  ['ghost-charge', 'charge-pass'],
  ['warp-charge', 'charge-pass'],
  ['teleport-charge', 'charge-pass'],
  ['spawn-charge', 'charge-pass'],
  ['despawn-charge', 'charge-pass'],
  ['shield-charge', 'charge-pass'],
  ['barrier-charge', 'charge-pass'],
  ['reflect-charge', 'charge-pass'],
  ['parry-charge', 'charge-pass'],
  ['dash-charge', 'charge-pass'],
  ['jump-charge', 'charge-pass'],
  ['landing-charge', 'charge-pass'],
  ['combo-charge', 'charge-pass'],
  ['target-charge', 'charge-pass'],
  ['warning-charge', 'charge-pass'],
  ['marker-charge', 'charge-pass'],
  ['scan-charge', 'charge-pass'],
  ['hologram-charge', 'charge-pass'],
  ['engine-charge', 'charge-pass'],
  ['thruster-charge', 'charge-pass'],
  ['exhaust-charge', 'charge-pass'],
  // 2026-07-11 impact group pass (user-certified: spec-tiered speeds,
  // themed mirrors, render-read cures, review round 1 approved).
  ['smoke-puff', 'impact-pass'],
  ['hit-spark', 'impact-pass'],
  ['footstep-dust', 'impact-pass'],
  ['wind-impact', 'impact-pass'],
  ['exhaust-hit', 'impact-pass'],
  ['debris-miss', 'impact-pass'],
  ['plasma-hit', 'impact-pass'],
  ['ice-impact', 'impact-pass'],
  ['teleport-hit', 'impact-pass'],
  ['despawn-impact', 'impact-pass'],
  ['embers-impact', 'impact-pass'],
  ['flame-impact', 'impact-pass'],
  ['meteor-impact', 'impact-pass'],
  ['dust-impact', 'impact-pass'],
  ['debris-impact', 'impact-pass'],
  ['spark-impact', 'impact-pass'],
  ['shard-impact', 'impact-pass'],
  ['rune-impact', 'impact-pass'],
  ['glyph-impact', 'impact-pass'],
  ['beam-impact', 'impact-pass'],
  ['laser-impact', 'impact-pass'],
  ['plasma-impact', 'impact-pass'],
  ['electric-impact', 'impact-pass'],
  ['frost-impact', 'impact-pass'],
  ['water-impact', 'impact-pass'],
  ['snow-impact', 'impact-pass'],
  ['leaf-impact', 'impact-pass'],
  ['petal-impact', 'impact-pass'],
  ['sand-impact', 'impact-pass'],
  ['mud-impact', 'impact-pass'],
  ['slime-impact', 'impact-pass'],
  ['poison-impact', 'impact-pass'],
  ['acid-impact', 'impact-pass'],
  ['holy-impact', 'impact-pass'],
  ['curse-impact', 'impact-pass'],
  ['shadow-impact', 'impact-pass'],
  ['blood-impact', 'impact-pass'],
  ['ghost-impact', 'impact-pass'],
  ['portal-impact', 'impact-pass'],
  ['warp-impact', 'impact-pass'],
  ['teleport-impact', 'impact-pass'],
  ['shield-impact', 'impact-pass'],
  ['barrier-impact', 'impact-pass'],
  ['reflect-impact', 'impact-pass'],
  ['parry-impact', 'impact-pass'],
  ['dash-impact', 'impact-pass'],
  ['jump-impact', 'impact-pass'],
  ['landing-impact', 'impact-pass'],
  ['footstep-impact', 'impact-pass'],
  ['target-impact', 'impact-pass'],
  ['warning-impact', 'impact-pass'],
  ['marker-impact', 'impact-pass'],
  ['scan-impact', 'impact-pass'],
  ['hologram-impact', 'impact-pass'],
  ['engine-impact', 'impact-pass'],
  ['thruster-impact', 'impact-pass'],
  ['exhaust-impact', 'impact-pass'],
  // 2026-07-10/11 explosion category pass (user-reviewed, dieted, gated).
  ['explosion', 'explosion-pass'],
  ['shockwave-spawn', 'explosion-pass'],
  ['blast-burst', 'explosion-pass'],
  ['shockwave-burst', 'explosion-pass'],
  ['blast-impact', 'explosion-pass'],
  ['shockwave-impact', 'explosion-pass'],
  ['blast-charge', 'explosion-pass'],
  ['shockwave-charge', 'explosion-pass'],
  ['blast-release', 'explosion-pass'],
  ['shockwave-release', 'explosion-pass'],
  ['blast-telegraph', 'explosion-pass'],
  ['shockwave-telegraph', 'explosion-pass'],
  // 2026-07-11 projectile category pass (reference-matched, gated).
  ['fireball', 'projectile-pass'],
  // 2026-07-11 burst group pass (user-certified: research spec, diet,
  // beat-scripted sweep, review rounds, performance safety pass).
  ['critical-hit-burst', 'burst-pass'],
  ['muzzle-flash', 'burst-pass'],
  ['level-up-flare', 'burst-pass'],
  ['embers-burst', 'burst-pass'],
  ['glyph-ring', 'burst-pass'],
  ['water-cone', 'burst-pass'],
  ['ghost-critical', 'burst-pass'],
  ['meteor-ring', 'burst-pass'],
  ['spark-cone', 'burst-pass'],
  ['electric-critical', 'burst-pass'],
  ['sand-burst', 'burst-pass'],
  ['slime-ring', 'burst-pass'],
  ['curse-cone', 'burst-pass'],
  ['pickup-burst', 'burst-pass'],
  ['combo-ring', 'burst-pass'],
  ['scan-cone', 'burst-pass'],
  ['flame-burst', 'burst-pass'],
  ['meteor-burst', 'burst-pass'],
  ['dust-burst', 'burst-pass'],
  ['debris-burst', 'burst-pass'],
  ['spark-burst', 'burst-pass'],
  ['shard-burst', 'burst-pass'],
  ['rune-burst', 'burst-pass'],
  ['glyph-burst', 'burst-pass'],
  ['beam-burst', 'burst-pass'],
  ['laser-burst', 'burst-pass'],
  ['plasma-burst', 'burst-pass'],
  ['electric-burst', 'burst-pass'],
  ['ice-burst', 'burst-pass'],
  ['frost-burst', 'burst-pass'],
  ['water-burst', 'burst-pass'],
  ['bubble-burst', 'burst-pass'],
  ['rain-burst', 'burst-pass'],
  ['snow-burst', 'burst-pass'],
  ['wind-burst', 'burst-pass'],
  ['leaf-burst', 'burst-pass'],
  ['petal-burst', 'burst-pass'],
  ['mud-burst', 'burst-pass'],
  ['slime-burst', 'burst-pass'],
  ['poison-burst', 'burst-pass'],
  ['acid-burst', 'burst-pass'],
  ['healing-burst', 'burst-pass'],
  ['holy-burst', 'burst-pass'],
  ['curse-burst', 'burst-pass'],
  ['shadow-burst', 'burst-pass'],
  ['blood-burst', 'burst-pass'],
  ['ghost-burst', 'burst-pass'],
  ['portal-burst', 'burst-pass'],
  ['warp-burst', 'burst-pass'],
  ['teleport-burst', 'burst-pass'],
  ['spawn-burst', 'burst-pass'],
  ['despawn-burst', 'burst-pass'],
  ['shield-burst', 'burst-pass'],
  ['barrier-burst', 'burst-pass'],
  ['reflect-burst', 'burst-pass'],
  ['parry-burst', 'burst-pass'],
  ['dash-burst', 'burst-pass'],
  ['jump-burst', 'burst-pass'],
  ['landing-burst', 'burst-pass'],
  ['footstep-burst', 'burst-pass'],
  ['reward-burst', 'burst-pass'],
  ['combo-burst', 'burst-pass'],
  ['ui-burst', 'burst-pass'],
  ['target-burst', 'burst-pass'],
  ['warning-burst', 'burst-pass'],
  ['marker-burst', 'burst-pass'],
  ['scan-burst', 'burst-pass'],
  ['hologram-burst', 'burst-pass'],
  ['engine-burst', 'burst-pass'],
  ['thruster-burst', 'burst-pass'],
  ['exhaust-burst', 'burst-pass'],
])

export function getPfxGroupWorkList(effectIds: readonly string[]): string[] {
  return effectIds.filter((id) => !PFX_CERTIFIED_EFFECTS.has(id))
}

export const PFX_CC0_ASSET_SOURCES = [
  {
    provider: 'Kenney',
    asset: 'Particle Pack',
    license: 'CC0-1.0' as const,
    sourceUrl: 'https://kenney.nl/assets/particle-pack',
  },
] as const

export function normalizePfxRenderSurfaces(
  effect: PfxTaxonomyEffect | undefined,
  surfaces: PfxRenderSurface[],
): PfxRenderSurface[] {
  if (!effect) return surfaces.map(clonePfxSurface)
  const normalized = surfaces.map((source) => {
    const surface = clonePfxSurface(source)
    if (surface.kind !== 'ring-field' && surface.kind !== 'shockwave-ring') return surface
    // Explicit authored purpose wins — inference is the fallback for
    // profile-backed surfaces, not an override of reviewed recipes.
    const ringPurpose = surface.tuning?.ringPurpose ?? inferPfxRingPurpose(effect, surface)
    if (ringPurpose) {
      surface.tuning = { ...surface.tuning, ringPurpose }
      return surface
    }
    if (surface.kind === 'shockwave-ring') {
      return {
        ...surface,
        kind: 'mesh-fragments' as const,
        phase: surface.phase ?? `${effect.id}-structured-break`,
        tuning: withoutRingMotion(surface.tuning),
      }
    }
    return {
      ...surface,
      kind: surface.role === 'volume' ? ('cloud-volume' as const) : ('core-sphere' as const),
      opacity: Math.min(surface.opacity, 0.42),
      scale: surface.scale * 0.72,
      phase: surface.phase ?? `${effect.id}-structural-anchor`,
      tuning: withoutRingMotion(surface.tuning),
    }
  })

  return normalized
}

function clonePfxSurface(surface: PfxRenderSurface): PfxRenderSurface {
  return { ...surface, ...(surface.tuning ? { tuning: { ...surface.tuning } } : {}) }
}

function withoutRingMotion(tuning: PfxSurfaceTuning | undefined): PfxSurfaceTuning | undefined {
  if (!tuning) return undefined
  const { meshMotion: _meshMotion, ringPurpose: _ringPurpose, ...rest } = tuning
  return rest
}

function inferPfxRingPurpose(
  effect: PfxTaxonomyEffect,
  surface: Pick<PfxRenderSurface, 'kind' | 'phase'>,
): NonNullable<PfxSurfaceTuning['ringPurpose']> | null {
  const semantic = effect.id
  if (surface.kind === 'shockwave-ring') {
    return ['explosion', 'impact', 'spawn', 'movement'].includes(effect.effectType) ||
      /(shockwave|blast|explosion|impact|hit|landing|break)/.test(semantic)
      ? 'shockwave'
      : null
  }
  if (effect.effectType === 'telegraph' || /(marker|scan|warning|target)/.test(semantic)) return 'reticle'
  if (/(rune|glyph|circle)/.test(semantic)) return 'glyph'
  if (
    ['shield', 'portal', 'aura'].includes(effect.effectType) ||
    /(ring|aura|field|barrier|orbit|vortex|warp|teleport)/.test(semantic)
  ) {
    return 'boundary'
  }
  return null
}

export function createProfileBackedPhase(
  effectId: string,
  surface: Pick<PfxRenderSurface, 'kind' | 'role'>,
): string {
  const variant = effectId.includes('-') ? effectId.slice(effectId.lastIndexOf('-') + 1) : 'effect'
  const semanticRole =
    surface.kind === 'screen-plane'
      ? 'screen-plane'
      : surface.kind === 'ring-field' || surface.kind === 'shield-shell' || surface.kind === 'shockwave-ring'
        ? variant === 'telegraph' || variant === 'charge'
          ? 'warning-ring'
          : surface.kind === 'shield-shell'
            ? 'aura-shell'
            : 'energy-ring'
        : surface.kind === 'core-sphere'
          ? 'body-core'
          : surface.kind === 'trail-ribbon'
            ? 'motion-trail'
            : surface.kind === 'beam-column'
              ? 'body-column'
              : surface.kind === 'cloud-volume'
                ? 'volume-cloud'
                : surface.kind === 'impact-sparks'
                  ? 'impact-sparks'
                  : `${surface.role}-particles`
  return `${effectId}-${semanticRole}`
}

function seed(
  id: string,
  name: string,
  effectType: EffectType,
  gameplayUseCases: string[],
  styleAffinity: ArtStyleCluster[],
  emotionMood: string[],
  colorFamily: string[],
  loopMode: LoopMode,
  space: EffectSpace,
  mobileSafety: MobileSafety,
  implementationProfile: PfxImplementationProfile,
): SeedEffect {
  return {
    id,
    name,
    effectType,
    gameplayUseCases,
    styleAffinity,
    emotionMood,
    colorFamily,
    loopMode,
    space,
    mobileSafety,
    implementationProfile,
  }
}

export function generatedPairQueue(): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const queued = new Set<string>()
  const enqueue = (family: string, variant: string) => {
    if (!isCompatibleGeneratedPair(family, variant)) return
    const key = `${family}:${variant}`
    if (queued.has(key)) return
    queued.add(key)
    pairs.push([family, variant])
  }

  VARIANTS.forEach((variant, index) => {
    const family = FAMILIES[(index * 7) % FAMILIES.length]
    if (family) enqueue(family, variant)
  })
  FAMILIES.forEach((family, index) => {
    const variant = VARIANTS[(index * 5) % VARIANTS.length]
    if (variant) enqueue(family, variant)
  })
  for (const variant of VARIANTS) {
    for (const family of FAMILIES) {
      enqueue(family, variant)
    }
  }

  return pairs
}

function isCompatibleGeneratedPair(family: string, variant: string): boolean {
  if (variant === 'impact' || variant === 'hit') return IMPACT_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'trail') return TRAIL_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'loop' || variant === 'idle') return LOOP_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'charge') return CHARGE_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'release') return RELEASE_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'pickup') return PICKUP_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'miss') return MISS_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'low-health') return LOW_HEALTH_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'critical') return CRITICAL_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'death') return DEATH_COMPATIBLE_FAMILIES.has(family)
  if (variant === 'screen') return SCREEN_COMPATIBLE_FAMILIES.has(family)
  return true
}

export function generatedSeed(family: string, variant: string, id: string): SeedEffect {
  const effectType = GENERATED_TYPE_OVERRIDES[id] ?? inferEffectType(family, variant)
  const loopMode: LoopMode = GENERATED_LOOP_MODE_OVERRIDES[id]
    ?? (variant === 'loop' || variant === 'idle' || variant === 'ambient' || variant === 'aura' ? 'loop' : 'burst')
  const space: EffectSpace = GENERATED_SPACE_OVERRIDES[id]
    ?? (family === 'ui' || variant === 'screen' || variant === 'low-health' ? 'ui' : 'world')
  const mobileSafety = GENERATED_MOBILE_SAFETY_OVERRIDES[id] ?? inferMobileSafety(family, variant, effectType)
  return seed(
    id,
    titleCase(`${family} ${variant}`),
    effectType,
    inferUseCases(family, variant, effectType),
    inferStyles(family, effectType),
    inferMood(family, variant, effectType),
    inferColors(family, effectType),
    loopMode,
    space,
    mobileSafety,
    GENERATED_PROFILE_OVERRIDES[id] ?? inferProfile(effectType, variant),
  )
}

export function inferMarketSourceFamilies(source: SeedEffect): PfxMarketSourceFamily[] {
  const families = new Set<PfxMarketSourceFamily>(['unity-asset-store-vfx', 'unity-vfx-graph'])
  const useCases = new Set(source.gameplayUseCases)
  const semanticText = `${source.id} ${source.name}`.toLowerCase()

  if (
    source.effectType === 'fire' ||
    source.effectType === 'explosion' ||
    source.effectType === 'smoke' ||
    /(fire|flame|ember|explosion|blast|smoke|meteor)/.test(semanticText)
  ) {
    families.add('unreal-niagara')
    families.add('embergen')
    families.add('unity-fire-spell-effects')
  }
  if (source.effectType === 'water' || source.effectType === 'weather' || source.effectType === 'environment') {
    families.add('unreal-niagara')
  }
  if (source.effectType === 'trail' || source.effectType === 'weapon' || source.effectType === 'impact') {
    families.add('realtimevfx-stylized')
    families.add('drei-r3f')
  }
  if (source.effectType === 'projectile' || source.effectType === 'magic' || useCases.has('spell')) {
    families.add('unity-fire-spell-effects')
    families.add('three-quarks-r3f')
  }
  if (source.effectType === 'shield' || source.effectType === 'sci-fi' || source.implementationProfile === 'ring-field') {
    families.add('popcornfx')
    families.add('three-quarks-r3f')
  }
  if (source.effectType === 'ui' || source.effectType === 'loot' || useCases.has('reward')) {
    families.add('drei-r3f')
    families.add('three-nebula')
  }
  if (source.implementationProfile === 'continuous-emitter' || source.implementationProfile === 'volume-cloud') {
    families.add('three-nebula')
  }
  if (source.implementationProfile === 'trail-ribbon') {
    families.add('wawa-vfx-r3f')
  }

  return [...families].slice(0, 5)
}

function inferMobileSafety(family: string, variant: string, effectType: EffectType): MobileSafety {
  if (
    ['blast', 'shockwave', 'meteor'].includes(family) &&
    ['trail', 'beam', 'column', 'ring', 'critical', 'death', 'screen'].includes(variant)
  ) {
    return 'cinematic-only'
  }
  if (
    ['portal', 'warp', 'teleport'].includes(family) &&
    ['trail', 'beam', 'column', 'screen'].includes(variant)
  ) {
    return 'cinematic-only'
  }
  if (['critical', 'death'].includes(variant) && ['explosion', 'portal', 'horror'].includes(effectType)) {
    return 'cinematic-only'
  }
  if (
    effectType === 'explosion' ||
    effectType === 'smoke' ||
    effectType === 'portal' ||
    ['critical', 'death', 'beam', 'column'].includes(variant)
  ) {
    return 'caution'
  }
  return 'safe'
}

export function createPresetFromEffect(effect: PfxTaxonomyEffect): PfxPreset {
  const recipe = AUTHORED_EFFECT_RECIPES[effect.id]
  const tier = inferTier(effect)
  const density = effect.id === 'petal-ambient' ? 0.68 : effect.id === 'acid-burst' ? 0.58 : effect.id === 'healing-burst' ? 0.52 : effect.id === 'holy-burst' ? 0.56 : effect.id === 'curse-burst' ? 0.54 : effect.id === 'shadow-burst' ? 0.58 : tier === 'low' ? 0.38 : tier === 'medium' ? 0.56 : tier === 'high' ? 0.72 : 0.88
  const controls: PfxControls = {
    color: colorsForEffect(effect),
    style: effect.styleAffinity[0] ?? 'stylized',
    scale: effect.space === 'ui' ? 1 : 1.15,
    density,
    timing: effect.loopMode === 'loop' ? 0.85 : 1.15,
    lifetime: effect.loopMode === 'loop' ? 2.8 : 0.82,
    velocity: effect.implementationProfile === 'beam-column' ? 0.25 : 0.75,
    gravity: effect.effectType === 'smoke' || effect.effectType === 'weather' ? -0.05 : 0,
    turbulence: effect.effectType === 'magic' || effect.effectType === 'portal' ? 0.8 : 0.35,
    // Audited particle-authored references keep point emission so the generic
    // mesh-emitter control cannot silently replace their authored silhouettes.
    spawnShape: ['mud-burst', 'healing-burst', 'holy-burst', 'shadow-burst', 'acid-burst', 'barrier-burst', 'blast-burst', 'curse-cone', 'pickup-burst', 'poison-burst', 'curse-burst', 'critical-hit-burst', 'electric-critical', 'embers-burst', 'flame-burst', 'ice-burst', 'ghost-critical', 'jump-burst', 'landing-burst', 'meteor-burst', 'slime-burst', 'spark-cone', 'hit-spark', 'wind-impact', 'debris-release', 'acid-charge', 'blood-charge', 'flame-charge', 'mud-charge', 'reward-charge', 'sand-charge'].includes(effect.id)
      ? 'point'
      : spawnShapeFor(effect),
    texture: textureFor(effect.effectType),
    flipbook: flipbookFor(effect.effectType),
    blendMode: effect.effectType === 'smoke' || effect.effectType === 'weather' ? 'alpha' : 'additive',
    emissiveBloom: effect.effectType === 'ui' || effect.effectType === 'loot' ? 0.75 : 0.45,
    trailLength: effect.implementationProfile === 'trail-ribbon' ? 1.25 : 0.2,
    seed: hash(effect.id),
    lod: ['low', 'medium', 'high'],
  }
  const styledControls = controls
  const performance = createPerformanceMetadata(effect, styledControls)
  const quality = createQualityScore(effect, performance)

  return {
    id: `${effect.id}-default`,
    effectId: effect.id,
    name: `${effect.name} Default`,
    tags: [effect.effectType, ...effect.gameplayUseCases, ...effect.styleAffinity],
    controls: styledControls,
    textureAtlas: getPfxTextureAtlasSlice(styledControls.texture),
    styleRender: createPfxStyleRender(styledControls),
    preview: previewForEffect(effect, styledControls),
    performance,
    quality,
    implementationProfile: effect.implementationProfile,
    acceptanceStatus: effect.acceptanceStatus,
    authoredRecipeId: recipe?.id,
    mobileSafety: effect.mobileSafety,
    componentName: `${pascal(effect.id)}Pfx`,
    seed: styledControls.seed,
  }
}

export function createPfxStyleRender(controls: PfxControls): PfxStyleRenderProfile {
  const profile = getPfxStyleRenderProfile(controls.style)
  return {
    ...profile,
    signature: getPfxStyleRenderSignature(controls),
  }
}

export function createPerformanceMetadata(effect: PfxTaxonomyEffect, controls: PfxControls): PfxPerformanceMetadata {
  const tier = inferTier(effect)
  const budget = PERFORMANCE_TIER_BUDGETS[tier]
  const recipe = AUTHORED_EFFECT_RECIPES[effect.id]
  const lodMultiplier = controls.lod.includes('high') ? 1 : controls.lod.includes('medium') ? 0.72 : 0.45
  const maxParticles = Math.min(
    budget.maxParticles,
    Math.max(8, Math.floor(budget.maxParticles * controls.density * lodMultiplier)),
  )
  const plannedDrawCalls = recipe?.surfaces.length ?? estimatedDrawCallsForProfile(effect.implementationProfile)
  const textureMemoryKb = effect.id === 'plasma-hit'
    ? Math.ceil(PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.runtimeBytes / 1024)
    : Math.min(
      budget.textureMemoryKb,
      controls.flipbook === 'none' ? 96 : controls.flipbook === 'magic-12' ? 384 : 256,
    )
  const expectedFrameCostMs = roundMetric(
    budget.expectedFrameCostMs *
      (0.65 + controls.density * 0.35) *
      (controls.lod.includes('high') ? 1 : controls.lod.includes('medium') ? 0.86 : 0.72),
  )
  const overdrawRisk =
    controls.scale > 2 || controls.density > 0.82
      ? bumpRisk(budget.overdrawRisk)
      : budget.overdrawRisk

  return {
    tier,
    maxParticles,
    maxDrawCalls: Math.min(budget.maxDrawCalls, plannedDrawCalls),
    textureMemoryKb,
    expectedFrameCostMs,
    overdrawRisk,
    evidence: recipe
      ? `Authored preview recipe ${recipe.id}: density ${controls.density}, LOD ${controls.lod.join('/')}, ${maxParticles} particles, ${plannedDrawCalls} planned draw calls, deterministic seed ${controls.seed}.`
      : `Profile-backed tier budget: density ${controls.density}, LOD ${controls.lod.join('/')}, ${maxParticles} particles, ${budget.maxDrawCalls} draw-call cap, deterministic seed ${controls.seed}.`,
  }
}

export function createQualityScore(effect: PfxTaxonomyEffect, performance: PfxPerformanceMetadata): PfxQualityScore {
  const authored = effect.acceptanceStatus === 'authored-preview'
  const mobileScore = effect.mobileSafety === 'safe'
    ? 4
    : effect.mobileSafety === 'caution'
      ? 3
      : 2
  const performancePenalty = performance.tier === 'cinematic' ? -1 : 0
  const scores: PfxQualityScores = {
    gameReadiness: authored ? 4 : 3,
    visualProductionQuality: authored ? 4 : 2,
    mobilePerformance: clampQualityScore(mobileScore + performancePenalty),
    r3fIntegrationQuality: authored ? 4 : 3,
    customizationRange: 4,
    artStyleFidelity: authored ? 3 : 2,
    catalogCoverage: 3,
    documentationQuality: 3,
    exportCleanliness: 4,
    redTeamApproval: 1,
  }
  const total = PFX_QUALITY_RUBRIC_KEYS.reduce((sum, key) => sum + scores[key], 0)
  const max = PFX_QUALITY_RUBRIC_KEYS.length * 5

  return {
    scores,
    total,
    max,
    summary: `${effect.acceptanceStatus} quality score ${total}/${max}; final red-team approval is still pending.`,
    evidence: [
      `${effect.name} uses the ${effect.implementationProfile} runtime profile with ${performance.tier} tier budgets.`,
      authored
        ? 'Authored preview surfaces drive phase, opacity, material, and motion behavior.'
        : 'Profile-backed preset uses shared deterministic renderer profiles and still needs effect-specific art direction.',
      `Mobile safety is ${effect.mobileSafety}; performance evidence: ${performance.evidence}`,
    ],
  }
}

function clampQualityScore(score: number): number {
  return Math.max(1, Math.min(5, score))
}

function bumpRisk(risk: PfxPerformanceBudget['overdrawRisk']): PfxPerformanceBudget['overdrawRisk'] {
  if (risk === 'low') return 'medium'
  return 'high'
}

function estimatedDrawCallsForProfile(profile: PfxImplementationProfile): number {
  if (profile === 'continuous-emitter') return 2
  return 3
}

export function previewForEffect(effect: PfxTaxonomyEffect, controls: PfxControls): PfxPreviewDescriptor {
  const primary = controls.color[0] ?? '#ffffff'
  const secondary = controls.color[1] ?? primary
  const accent = controls.color[2] ?? '#111827'
  const radial =
    effect.implementationProfile === 'ring-field' || effect.effectType === 'portal'
      ? `radial-gradient(circle, transparent 34%, ${primary} 36%, transparent 42%),`
      : ''

  return {
    thumbnail: {
      kind: 'procedural-gradient',
      css: `${radial} radial-gradient(circle at 48% 46%, ${primary} 0 12%, ${secondary} 34%, ${accent} 72%, #0f172a 100%)`,
      alt: `${effect.name} ${effect.effectType} particle preview thumbnail`,
    },
    clip: {
      kind: 'procedural-loop',
      frames: effect.loopMode === 'loop' ? 48 : 18,
      durationMs: effect.loopMode === 'loop' ? 1600 : 720,
      motion: motionForProfile(effect.implementationProfile),
    },
    camera: {
      position: [0, 0, 4],
      fov: effect.space === 'ui' ? 42 : 48,
    },
  }
}

function motionForProfile(profile: PfxImplementationProfile): PfxPreviewDescriptor['clip']['motion'] {
  if (profile === 'beam-column') return 'rise'
  if (profile === 'ring-field') return 'orbit'
  if (profile === 'trail-ribbon') return 'streak'
  if (profile === 'volume-cloud') return 'drift'
  if (profile === 'radial-burst' || profile === 'directional-burst') return 'burst'
  return 'pulse'
}

function inferTier(effect: PfxTaxonomyEffect): PerformanceTier {
  if (effect.mobileSafety === 'cinematic-only') return 'cinematic'
  // The authored plasma impact uses a three-card 512px turbulent flipbook.
  // Local SwiftShader profiling passes its 60 FPS gate at four concurrent
  // instances and misses at ten, so its honest canonical tier is high.
  if (effect.id === 'plasma-hit') return 'high'
  // The authored wind beam's two full-volume shader passes are locally safe
  // at four concurrent instances but exceed the p95 budget at ten. Keep the
  // visual A grade and declare the measured high-tier concurrency honestly.
  if (effect.id === 'wind-beam') return 'high'
  // A shield aura is only one draw, but its persistent full-envelope fragment
  // shader covers substantially more screen area than low-tier point matter.
  // Cap it at ten concurrent instances so mobile stress scenes stay below the
  // shared 60% non-background canvas threshold without shrinking the hero read.
  if (effect.id === 'shield-aura') return 'medium'
  if (effect.id === 'portal-telegraph') return 'low'
  if (
    effect.mobileSafety === 'caution' &&
    (effect.effectType === 'explosion' ||
      effect.effectType === 'portal' ||
      effect.implementationProfile === 'beam-column' ||
      effect.implementationProfile === 'ring-field')
  ) {
    return 'high'
  }
  if (effect.effectType === 'explosion' || effect.effectType === 'portal') return 'medium'
  // Hero traveling bodies: the researched component stack (burning head
  // shell + twin-tendril helix + glow + core) needs 4 draw calls.
  if (effect.effectType === 'projectile') return 'medium'
  // Hero one-shot moments (Burst spec tier table): crits/finishers earn the
  // >=2-axes upgrade — more layers AND longer — which needs the medium
  // draw budget. Deliberate list, grown per group review, never inferred.
  if (PFX_HERO_MOMENT_EFFECTS.has(effect.id)) return 'medium'
  if (effect.effectType === 'smoke' && effect.loopMode === 'loop') return 'medium'
  if (effect.mobileSafety === 'caution') return 'medium'
  return 'low'
}

function inferEffectType(family: string, variant: string): EffectType {
  if (['flame', 'embers', 'meteor'].includes(family)) return 'fire'
  if (['blast', 'shockwave'].includes(family)) return 'explosion'
  if (['dust', 'debris'].includes(family)) return 'smoke'
  if (['beam', 'laser', 'plasma'].includes(family)) return 'projectile'
  if (['spark', 'shard'].includes(family) || ['impact', 'hit', 'critical'].includes(variant)) return 'impact'
  if (['rune', 'glyph', 'holy', 'curse'].includes(family)) return 'magic'
  if (['shield', 'barrier', 'reflect'].includes(family)) return 'shield'
  if (['poison', 'acid', 'slime'].includes(family)) return 'status'
  if (['water', 'bubble', 'rain'].includes(family)) return 'water'
  if (['snow', 'wind', 'leaf', 'petal', 'sand'].includes(family)) return 'weather'
  if (['portal', 'warp', 'teleport'].includes(family)) return 'portal'
  if (['spawn', 'despawn'].includes(family)) return 'spawn'
  if (['dash', 'jump', 'landing', 'footstep'].includes(family)) return 'movement'
  if (['pickup', 'reward', 'combo', 'ui'].includes(family)) return 'ui'
  if (['target', 'warning', 'marker', 'scan'].includes(family)) return 'telegraph'
  if (['hologram', 'engine', 'thruster', 'exhaust', 'electric'].includes(family)) return 'sci-fi'
  if (['shadow', 'blood', 'ghost'].includes(family)) return 'horror'
  if (['ice', 'frost', 'healing'].includes(family)) return 'elemental'
  return 'abstract'
}

function inferProfile(effectType: EffectType, variant: string): PfxImplementationProfile {
  if (variant === 'trail') return 'trail-ribbon'
  if (variant === 'screen') return 'screen-overlay'
  if (['shield', 'telegraph', 'portal'].includes(effectType)) return 'ring-field'
  if (['smoke', 'weather', 'status'].includes(effectType)) return 'volume-cloud'
  if (['loot', 'ui'].includes(effectType) && variant !== 'impact') return 'screen-overlay'
  if (['projectile', 'weapon'].includes(effectType)) return 'directional-burst'
  if (variant === 'beam' || variant === 'column') return 'beam-column'
  if (variant === 'loop' || variant === 'idle' || variant === 'ambient') return 'continuous-emitter'
  return 'radial-burst'
}

function inferUseCases(family: string, variant: string, effectType: EffectType): string[] {
  const uses = new Set<string>()
  if (['impact', 'hit', 'break', 'critical'].includes(variant)) uses.add('combat')
  if (['telegraph', 'charge', 'warning'].includes(variant) || effectType === 'telegraph') uses.add('warning')
  if (['pickup', 'reward', 'combo'].includes(family) || family === 'ui') uses.add('reward')
  if (['dash', 'jump', 'landing', 'footstep'].includes(family)) uses.add('movement')
  if (['rain', 'snow', 'wind', 'leaf', 'petal', 'sand', 'water', 'bubble'].includes(family)) uses.add('environment')
  if (['poison', 'acid', 'curse', 'slime'].includes(family)) uses.add('debuff')
  if (['healing', 'holy'].includes(family)) uses.add('healing')
  if (['spawn', 'despawn', 'portal', 'warp', 'teleport'].includes(family)) uses.add('transition')
  if (uses.size === 0) uses.add(effectType === 'ui' ? 'feedback' : 'gameplay-feedback')
  return [...uses]
}

function inferStyles(family: string, effectType: EffectType): ArtStyleCluster[] {
  if (['hologram', 'laser', 'plasma', 'electric', 'engine', 'thruster', 'exhaust'].includes(family)) return ['sci-fi', 'neon', 'tactical']
  if (['healing', 'holy', 'rune', 'glyph', 'portal'].includes(family)) return ['magical', 'fantasy', 'stylized']
  if (['shadow', 'blood', 'ghost', 'curse'].includes(family)) return ['horror', 'painterly', 'realistic']
  if (['leaf', 'petal', 'pickup', 'reward'].includes(family)) return ['cozy', 'toon', 'arcade']
  if (effectType === 'fire' || effectType === 'elemental') return ['elemental', 'fantasy', 'stylized']
  if (effectType === 'ui') return ['cozy', 'arcade', 'toon']
  return ['stylized', 'low-poly', 'arcade']
}

function inferMood(family: string, variant: string, effectType: EffectType): string[] {
  if (['warning', 'low-health', 'telegraph'].includes(variant)) return ['warning', 'tension']
  if (['pickup', 'reward', 'combo'].includes(family)) return ['reward', 'joy']
  if (['blood', 'shadow', 'ghost', 'poison', 'acid'].includes(family)) return ['danger', 'unease']
  if (effectType === 'impact' || effectType === 'explosion') return ['impact', 'power']
  return ['readability']
}

function inferColors(family: string, effectType: EffectType): string[] {
  if (effectType === 'fire' || effectType === 'explosion') return ['orange', 'yellow']
  if (effectType === 'water' || family === 'ice' || family === 'frost') return ['blue', 'white']
  if (family === 'dust') return ['tan', 'khaki']
  if (family === 'debris') return ['slate', 'sand']
  if (family === 'glyph') return ['arcane-cyan', 'arcane-violet']
  if (['poison', 'acid', 'slime', 'healing'].includes(family)) return ['green', 'purple']
  if (['shadow', 'ghost', 'curse'].includes(family)) return ['purple', 'black']
  if (effectType === 'sci-fi' || effectType === 'shield') return ['cyan', 'blue']
  if (effectType === 'ui' || effectType === 'loot') return ['gold', 'pink']
  return ['white', 'blue']
}

function colorsForEffect(effect: PfxTaxonomyEffect): string[] {
  if (effect.id === 'exhaust-telegraph') return ['#ff8a3d', '#fff0c2']
  if (effect.id === 'beam-telegraph') return ['#f04418', '#8eefff']
  if (effect.id === 'laser-spray') return ['#ff3d1f', '#ffb23c']
  if (effect.id === 'plasma-hit') return ['#4ff7ff', '#8a42ff']
  if (effect.id === 'electric-critical') return ['#5eeaff', '#ffd45a']
  if (effect.id === 'ice-impact') return ['#7ddfff', '#e9fcff']
  if (effect.id === 'frost-aura') return ['#8ee8ff', '#e8fbff']
  if (effect.id === 'water-column') return ['#168fd1', '#bdefff']
  if (effect.id === 'snow-idle') return ['#edfaff', '#bfeeff']
  if (effect.id === 'wind-beam') return ['#d8fff4', '#b8e6ff']
  if (effect.id === 'petal-ambient') return ['#f47cab', '#ffd0c4']
  if (effect.id === 'rain-burst') return ['#2d8fd3', '#c7f5ff']
  if (effect.id === 'snow-burst') return ['#edfaff', '#5bbde8']
  if (effect.id === 'wind-burst') return ['#dff9ff', '#72cde8']
  if (effect.id === 'leaf-burst') return ['#69a83e', '#d8f29a']
  if (effect.id === 'petal-burst') return ['#f48fb1', '#ffe4d6']
  if (effect.id === 'mud-burst') return ['#4a3127', '#76503b', '#b08462']
  if (effect.id === 'slime-burst') return ['#2c8f45', '#b8ff75']
  if (effect.id === 'poison-burst') return ['#6b2a8e', '#9cff57']
  if (effect.id === 'acid-burst') return ['#3f9f2f', '#d9ff47']
  if (effect.id === 'healing-burst') return ['#37d982', '#d7f8df', '#fff0b0']
  if (effect.id === 'holy-burst') return ['#fff9e6', '#ffc83d', '#9edcff']
  if (effect.id === 'curse-burst') return ['#2e0249', '#a855f7', '#bef264']
  if (effect.id === 'shadow-burst') return ['#0c1019', '#44576a', '#9bb5c4']
  const colorMap: Record<string, string> = {
    orange: '#ff7a18',
    yellow: '#ffd166',
    gray: '#9ca3af',
    white: '#f8fafc',
    green: '#4ade80',
    cyan: '#22d3ee',
    blue: '#60a5fa',
    purple: '#a78bfa',
    red: '#ef4444',
    gold: '#fbbf24',
    pink: '#f472b6',
    black: '#1f2937',
    tan: '#d6a66f',
    khaki: '#e2c99b',
    slate: '#7c8796',
    sand: '#c7a676',
    'arcane-cyan': '#61e7ff',
    'arcane-violet': '#a78bfa',
  }
  return effect.colorFamily.map((name) => colorMap[name] ?? '#ffffff')
}

function spawnShapeFor(effect: Pick<PfxTaxonomyEffect, 'effectType' | 'implementationProfile'>): SpawnShape {
  if (['impact', 'explosion', 'projectile', 'magic', 'sci-fi', 'shield', 'elemental', 'abstract'].includes(effect.effectType)) {
    return 'mesh'
  }
  const profile = effect.implementationProfile
  if (profile === 'ring-field') return 'ring'
  if (profile === 'volume-cloud') return 'sphere'
  if (profile === 'trail-ribbon') return 'line'
  if (profile === 'beam-column') return 'cone'
  if (profile === 'screen-overlay') return 'box'
  return 'point'
}

function textureFor(effectType: EffectType): PfxControls['texture'] {
  if (effectType === 'impact' || effectType === 'fire') return 'spark'
  if (effectType === 'trail' || effectType === 'projectile') return 'streak'
  if (effectType === 'shield' || effectType === 'portal' || effectType === 'telegraph') return 'ring'
  if (effectType === 'water') return 'bubble'
  if (effectType === 'ui') return 'square'
  return 'soft-disc'
}

function flipbookFor(effectType: EffectType): PfxControls['flipbook'] {
  if (effectType === 'smoke' || effectType === 'weather') return 'smoke-8'
  if (effectType === 'fire' || effectType === 'explosion') return 'flame-8'
  if (effectType === 'magic' || effectType === 'portal') return 'magic-12'
  if (effectType === 'impact') return 'impact-6'
  return 'none'
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function pascal(value: string): string {
  return titleCase(value.replace(/-/g, ' ')).replace(/\s+/g, '')
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}
