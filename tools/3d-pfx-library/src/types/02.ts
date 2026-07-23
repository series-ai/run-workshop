import { PfxSpriteName } from '../particleSprites'
import { ReactElement } from 'react'
import * as THREE from 'three'
import type { ArtStyleCluster, BlendMode, EffectSpace, EffectType, LoopMode, MobileSafety, PfxMarketSourceFamily, PfxPreset, PfxPresetOverrides, PfxRenderSurfaceKind } from './01'

export interface PfxSurfaceTuning {
  /** Explicit atlas sprite; overrides the effect-family mapping. */
  sprite?: PfxSpriteName
  /** Human-readable provenance for reference-derived particle layers. */
  referenceSource?: string
  /** How the source silhouette was translated into this particle layer. */
  referenceAdaptation?: string
  /** License/provenance receipt for the source reference. */
  referenceLicense?: 'CC0-1.0' | 'repo-original' | 'repo-original-and-CC0-1.0'
  /** Dedicated temporal atlas for a surface that needs authored frame evolution. */
  flipbookAtlas?: 'unity-small-flame-64' | 'unity-fireball-64'
  /** Explicit motion kind; overrides the profile/phase derivation. */
  motion?: PfxParticleMotionKind
  /** Blend override — lets smoke layers stay alpha-blended inside additive effects. */
  blend?: 'additive' | 'alpha'
  /** Alpha-coverage gamma override for deliberately soft fusion layers. */
  alphaGamma?: number
  /** Source-texture RGB contribution [0..1]; low values fuse soft underlays. */
  spriteColorMix?: number
  /** Start of this layer's spawn window inside the burst master cycle [0..1). */
  delay?: number
  /** Fraction of the master cycle during which particles spawn (<1 = burst-clocked). */
  window?: number
  /** Initial mesh scale for a flash envelope; defaults to the shared 0.55 pop. */
  startScale?: number
  /** Particle count multiplier. */
  countScale?: number
  /** Initial speed multiplier. */
  speedScale?: number
  /** Extra world-Y acceleration (negative = fall) on top of controls.gravity. */
  gravity?: number
  /** Exponential drag coefficient — sparks leap then stop instead of coasting. */
  drag?: number
  /** Size-over-life multipliers [from, mid, to]; mid applies at half life. */
  size?: [number, number, number]
  /** Velocity-stretch override (0 = plain billboard). */
  stretch?: number
  /**
   * Lateral-jitter multiplier for trail-stream emitters (default 1). A fast
   * projectile wake needs a tight cone: the fixed jitter scaled by high shed
   * speed otherwise fans the trail into a puffball.
   */
  streamSpread?: number
  /** World-space spawn shift (multiplied by controls.scale) — e.g. start a
   * projectile wake at the rear taper instead of the head center. */
  spawnOffset?: [number, number, number]
  /** Manual placement nudge, ADDED to the semantic anchor (review tooling). */
  positionOffset?: [number, number, number]
  /**
   * Impact spec two-vector model: cone the emission around this attack
   * vector instead of full radial (energy layers inherit the attack
   * vector). Normalized internally.
   */
  impactVector?: [number, number, number]
  /** Cone half-angle in radians around impactVector (default 0.6). */
  spreadAngle?: number
  /** Use seeded independent azimuths instead of golden-angle stratification for deliberately irregular bursts. */
  randomizeAzimuth?: boolean
  /**
   * Per-particle speed variance in [0, 1] for trail-stream (default 0 =
   * uniform). Fire sheds turbulently: slow births churn ON the body (the
   * energy wrap) while fast ones stream into the wake — one layer, two jobs.
   */
  speedJitter?: number
  /** Raw hex color for this surface, bypassing the palette (e.g. a red heat
   * glow on an orange/yellow fireball palette). */
  colorOverride?: string
  /** HUD combo glyph variant; 2 renders x2 and 3 renders x3. */
  comboMultiplier?: 2 | 3
  /**
   * Ramp treatment: 'hot' = steep white-hot→tint→dark, 'held' = stay near the
   * base tint (long-lived motes), 'pinned-hot' = never darken (cores),
   * 'dark' = skip the alpha-blend brightness lift (debris, dark smoke — the
   * value-contrast family that anchors bright effects).
   */
  ramp?: 'hot' | 'held' | 'pinned-hot' | 'dark' | 'pigment'
  /**
   * Octopo-feel: quantize the sprite into N flat temperature rings (cel
   * banding) with a near-white core — replaces the smooth radial gradient.
   */
  bands?: 2 | 3
  /**
   * Octopo-feel: hard-edged matter dissolves through chunky noise erosion
   * instead of a ghost alpha fade. Never use on soft smoke cards: their
   * legible death is stable/growing scale plus alpha dissipation.
   */
  death?: 'erode'
  /** Octopo-feel: fast-in/slow-out size envelope instead of linear. */
  ease?: 'snap'
  /**
   * Multiplier on the turbulence path-wobble for this layer (default 1).
   * Ballistic ejecta (sparks, debris, embers) set 0 — wobble makes dots
   * visibly orbit their own path, which no thrown object does.
   */
  turbulenceScale?: number
  /**
   * World-Y lift applied to this layer's spawn volume — embers spawn up in
   * the smoke cloud they were carried by, not at the ground origin.
   */
  spawnLift?: number
  /**
   * Brightness pulse depth — cooling embers flicker as they die.
   * 0..1 dims; values above 1 over-drive the pulse so the particle blinks
   * fully off at the trough (clamped, never negative). Deterministic per
   * particle and time.
   */
  flicker?: number
  /** Sprite spin-speed multiplier. */
  spinScale?: number
  /** Particle life-duration multiplier (shorten pickup stars, stretch embers). */
  lifeScale?: number
  /** Spawn-position multiplier — pulls scattered layers into a coherent silhouette. */
  spawnScale?: number
  /** Independent world-Z spread for rings/tunnels without inflating their radius. */
  depthScale?: number
  /** Cross-section multiplier for beam/column mesh volumes. */
  widthScale?: number
  /** Dedicated merged geometry variant for a semantic mesh surface. */
  meshGeometry?: 'screen-space-analytic-quad' | 'target-spawn-acquisition-quad' | 'target-spawn-confirmation-pin-quad' | 'curse-binding-seal' | 'curse-twisted-spire' | 'spawn-screen-reticle' | 'jump-pickup-launch-cradle' | 'jump-pickup-reward-gem' | 'target-break-lock-shell' | 'target-break-honeycomb-fragments' | 'target-break-ground-reticle' | 'exhaust-hit-mechanical-nozzle' | 'debris-miss-rock-fragments' | 'debris-release-rock-fragments' | 'spark-cone-streak-prisms' | 'shard-break-crystal-fragments' | 'shard-break-ignition-core' | 'ice-impact-grounded-splinters' | 'frost-aura-crystal-crown' | 'frost-aura-crystal-glint' | 'water-column-churning-body' | 'water-column-foam-spray' | 'snow-idle-flurry-field' | 'snow-idle-depth-granules' | 'wind-beam-pressure-ribbons' | 'wind-beam-debris-leaves' | 'petal-ambient-drifting-blossoms' | 'sand-burst-sculpted-fan' | 'mud-charge-sculpted-clods' | 'slime-ring-viscous-annulus' | 'acid-spawn-corrosive-aperture' | 'healing-loop-renewal-helix' | 'holy-release-radiant-mandorla' | 'curse-cone-twisted-thorn-fan' | 'glyph-trail-rune-chain' | 'glyph-trail-lead-sigil' | 'beam-telegraph-warning-lane' | 'beam-telegraph-source-aperture' | 'exhaust-telegraph-warning-lane' | 'exhaust-telegraph-source-vent' | 'flame-burst-folded-tongues' | 'meteor-burst-impact-diorama' | 'laser-spray-volumetric-nozzle' | 'laser-spray-bolt-rack' | 'plasma-hit-contact-bloom' | 'plasma-hit-broken-flux-arcs' | 'electric-critical-voltage-cage' | 'electric-critical-faceted-nexus' | 'electric-critical-impact-starburst' | 'electric-critical-diagonal-discharge' | 'plasma-ambient-contained-core' | 'plasma-ambient-broken-orbits' | 'snow-spawn-frost-cradle' | 'ghost-critical-spectral-talons' | 'barrier-low-health-fractured-shell' | 'barrier-low-health-breach-ribs' | 'flame-charge-trefoil-crucible' | 'flame-charge-convergence-tendrils' | 'meteor-ring-impact-crater' | 'meteor-ring-heat-front' | 'shockwave-spawn-arrival-flare' | 'shockwave-spawn-pressure-front' | 'shield-aura-fractured-shell' | 'mud-burst-reference-splash-crown' | 'mud-burst-reference-clod-eruption' | 'mud-burst-reference-earth-crown' | 'mud-burst-reference-wet-clot-splash' | 'healing-burst-reference-helix' | 'healing-burst-reference-bloom' | 'holy-burst-reference-sacred-flame' | 'holy-burst-reference-sanctity-sun' | 'holy-burst-reference-mandorla' | 'shadow-burst-reference-claw' | 'shadow-burst-reference-fracture'
  /** Clip-space UI treatment that renders independently of camera framing. */
  screenShader?: 'danger-vignette'
  /** Preset color slot for this layer — keeps rings in the effect's dominant hue. */
  colorIndex?: 0 | 1 | 2
  /** Required semantic job for retained ring geometry; unclassified rings are replaced during plan normalization. */
  ringPurpose?: 'shockwave' | 'boundary' | 'reticle' | 'glyph'
  /** Burst-synced animation for mesh layers (flash pop, expanding shockwave, aura pulse, one-shot volume bloom, shatter dissolve). */
  meshMotion?: 'flash' | 'shockwave' | 'pulse' | 'bloom' | 'break' | 'charge' | 'countdown' | 'pickup' | 'travel' | 'glow' | 'drift' | 'breathe'
  lifecycle?: 'held-projectile-ignition' | 'impact-core-flash' | 'impact-afterglow' | 'impact-shard-burst' | 'debris-release-ballistic' | 'spark-cone-burst' | 'shard-break-fracture' | 'ice-impact-contact' | 'frost-aura-breathing-loop' | 'water-column-eruption' | 'snow-idle-weather-loop' | 'petal-ambient-breeze-loop' | 'sand-burst-ballistic' | 'rain-burst-impact' | 'mud-charge-convergence' | 'mud-burst-reference-eruption' | 'slime-ring-adhesion' | 'acid-spawn-eruption' | 'healing-loop-renewal' | 'healing-burst-reference-renewal' | 'holy-release-cleansing' | 'shadow-break-rupture' | 'shadow-burst-detonation' | 'blood-death-ballistic-collapse' | 'curse-cone-propagation' | 'curse-cone-particle-propagation' | 'curse-burst-particle-malediction' | 'critical-hit-burst-particle-confirm' | 'electric-critical-particle-discharge' | 'embers-burst-particle-breakup' | 'flame-burst-particle-ignite' | 'ice-burst-particle-impact' | 'ghost-critical-particle-haunt' | 'jump-burst-particle-launch' | 'landing-burst-particle-impact' | 'meteor-burst-particle-collision' | 'slime-burst-particle-elasticity' | 'spark-cone-particle-release' | 'hit-spark-particle-confirm' | 'acid-charge-particle-convergence' | 'blood-charge-particle-convergence' | 'glyph-trail-inscription' | 'beam-telegraph-countdown' | 'exhaust-telegraph-arm-countdown-vent' | 'flame-burst-ignite-blossom-peel' | 'meteor-burst-descent-collision-cool' | 'laser-spray-salvo' | 'plasma-hit-discharge' | 'meteor-impact-settle' | 'shockwave-spawn-arrival' | 'shockwave-spawn-pressure-release' | 'dust-loop-breathing' | 'coin-pickup-reward-burst' | 'level-up-surge' | 'spark-gap-loop' | 'electric-trail-propagation' | 'wind-impact-shear' | 'wind-beam-surge' | 'acid-idle-boil' | 'portal-charge-aperture' | 'reward-telegraph-beacon' | 'hologram-aura-loop' | 'blast-beam-sustain' | 'blast-burst-particle-rupture' | 'glyph-ring-inscription' | 'water-cone-surge' | 'sand-spray-burst' | 'curse-column-binding' | 'spawn-screen-transition' | 'jump-pickup-launch' | 'plasma-ambient-breathing-loop' | 'snow-spawn-transition' | 'barrier-low-health-failure-loop' | 'barrier-burst-particle-ward' | 'flame-charge-compress' | 'combo-ring-confirm-hold-decay' | 'pickup-burst-particle-receipt' | 'ui-pickup-collect-rise-deposit' | 'target-spawn-acquire-confirm-release' | 'poison-burst-particle-rupture' | 'acid-burst-particle-eruption'
  /**
   * Dedicated GLSL mesh surface — real geometry + shader instead of a
   * textured plane. 'fresnel-shell' = view-angle rim sphere (shield bubbles;
   * pair with meshMotion 'break' for shatter). 'vortex-swirl' = polar-UV
   * spiral disc (portals). 'portal-throat' = fresnel-lit aperture depth.
   * 'arc-sweep' = burst-clocked crescent with leading
   * edge + tail erosion (melee slashes).
   */
  meshShader?:
    | 'fire-body'
    | 'fire-erode'
    | 'fresnel-shell'
    | 'hex-shell'
    | 'barrier-failure-shell'
    | 'hologram-shell'
    | 'force-field-shell'
    | 'heal-wave'
    | 'vortex-swirl'
    | 'portal-throat'
    | 'arc-sweep'
    | 'energy-column'
    | 'water-flow'
    | 'trail-flow'
    | 'projectile-wake'
    | 'electric-wake'
    | 'bubble-surface'
    | 'toxic-pool'
    | 'acid-pool'
    | 'energy-trail'
    | 'energy-chevron'
    | 'plasma-impact-flipbook'
    | 'combo-ring-meter'
    | 'ui-pickup-receipt'
    | 'target-spawn-reticle'
    | 'target-spawn-pin'
    | 'warning-loop-panel'
    | 'warning-loop-beacon'
    | 'marker-release-ground'
    | 'marker-release-badge'
    | 'scan-cone-footprint'
    | 'scan-cone-volume'
    | 'hologram-break-figure'
    | 'hologram-break-projector'
    | 'thruster-trail-plume'
    | 'thruster-trail-nozzle'
    | 'exhaust-telegraph-lane'
    | 'exhaust-telegraph-vent'
    | 'flame-burst-blossom'
    | 'meteor-burst-collision'
}

export interface PfxRenderSurface {
  kind: PfxRenderSurfaceKind
  role: 'body' | 'trail' | 'aura' | 'impact' | 'screen' | 'volume'
  opacity: number
  scale: number
  phase?: string
  tuning?: PfxSurfaceTuning
}

export interface PfxRenderPlan {
  effectId: string
  profile: PfxImplementationProfile
  authoredRecipeId?: string
  signature: string
  surfaces: PfxRenderSurface[]
  estimatedDrawCalls: number
  /** Renderer look version from the recipe; 1 = legacy looks. */
  feelVersion: number
  /** Whole-effect clock multiplier from the recipe. */
  tempo: number
}

export interface PfxAuthoredRecipe {
  id: string
  effectId: string
  label: string
  intent: string
  surfaces: PfxRenderSurface[]
  /**
   * Renderer look version. Versionless recipes (including every frozen
   * baseline snapshot) render the LEGACY kind-level looks; remediated
   * recipes opt into v2 looks (soft shockwave disc, billboard flash,
   * per-cycle freshness). This is what keeps before/after comparisons
   * honest across renderer improvements.
   */
  feelVersion?: number
  /**
   * Whole-effect clock multiplier (default 1). Tempo is a first-class
   * design input: the beat formulas target the researched spec windows
   * (flash 66-100ms, ring gone ~250ms, additive dead ~550ms, total impulse
   * 1-1.5s), and this is the lever that lands them without touching preset
   * controls (which the frozen baselines share).
   */
  tempo?: number
}

export interface PfxStructuralQualityAuditEffect {
  effectId: string
  space: EffectSpace
  ringSurfaceCount: number
  structuredMesh: boolean
  meshSpawnSource: boolean
  cc0AssetBacked: boolean
  findings: string[]
}

export interface PfxStructuralQualityAudit {
  schema: 'game-bot.r3f-pfx-structural-quality-audit.v1'
  passed: boolean
  thresholds: {
    maximumRingEffectRatio: number
    minimumStructuredWorldEffectRatio: number
    minimumMeshSpawnEffectRatio: number
    minimumCc0AssetBackedEffectRatio: number
  }
  summary: {
    totalEffects: number
    worldEffects: number
    ringEffects: number
    ringEffectRatio: number
    decorativeRingSurfaces: number
    structuredWorldEffects: number
    structuredWorldEffectRatio: number
    meshSpawnEffects: number
    meshSpawnEffectRatio: number
    cc0AssetBackedEffects: number
    cc0AssetBackedEffectRatio: number
  }
  cc0Sources: Array<{
    provider: string
    asset: string
    license: 'CC0-1.0'
    sourceUrl: string
  }>
  effects: PfxStructuralQualityAuditEffect[]
}

export interface PfxSurfaceMaterialProps {
  opacity: number
  color: string
  blending: BlendMode
  particleSizeMultiplier: number
  edgeHardness: number
}

export interface PfxFlipbookFrameProps {
  frameCount: number
  frameIndex: number
  uvOffset: [number, number]
  uvScale: [number, number]
  opacityMultiplier: number
  sizeMultiplier: number
}

export interface PfxSurfaceAnimationProps {
  rotationZ: number
  xOffset: number
  yOffset: number
  scaleMultiplier: number
  opacityMultiplier: number
  signature: string
}

export interface PfxRuntimeResourceCacheStats {
  textures: number
  geometries: number
}

export type PfxImplementationProfile =
  | 'radial-burst'
  | 'directional-burst'
  | 'continuous-emitter'
  | 'trail-ribbon'
  | 'screen-overlay'
  | 'ring-field'
  | 'volume-cloud'
  | 'beam-column'

export interface SeedEffect {
  id: string
  name: string
  effectType: EffectType
  gameplayUseCases: string[]
  styleAffinity: ArtStyleCluster[]
  emotionMood: string[]
  colorFamily: string[]
  loopMode: LoopMode
  space: EffectSpace
  mobileSafety: MobileSafety
  implementationProfile: PfxImplementationProfile
  marketSourceFamilies?: PfxMarketSourceFamily[]
}

export type PfxComboRingMultiplier = 2 | 3

export interface PfxRenderPlanOptions {
  /**
   * Render from an explicit recipe instead of the registry — lets a frozen
   * baseline snapshot play beside the current recipe for before/after review.
   */
  recipeOverride?: PfxAuthoredRecipe
}

export interface GamePfxProps {
  preset: Pick<PfxPreset, 'effectId' | 'controls' | 'implementationProfile'> | PfxPreset
  position?: [number, number, number]
  reducedMotion?: boolean
  previewTimeSeconds?: number
  /** Frozen recipe snapshot to render instead of the registry recipe. */
  recipeOverride?: PfxAuthoredRecipe
  /**
   * space:'ui' anchoring mode. true (default) pins the effect to the camera
   * (solo/detail stages). false keeps the authored position and only
   * billboards the orientation — gallery tiles pin to ONE camera spot
   * otherwise and every screen effect piles up mispositioned.
   */
  screenAnchor?: boolean
}

export interface PfxDropInComponentProps extends Omit<GamePfxProps, 'preset'> {
  overrides?: PfxPresetOverrides
}

export type PfxDropInComponent = ((props: PfxDropInComponentProps) => ReactElement) & {
  displayName?: string
  effectId?: string
}

export interface PfxComboRingRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  stage: 'confirm' | 'hold' | 'decay' | 'rest'
}

export interface PfxUiPickupRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  rise: number
  stage: 'collect' | 'rise' | 'deposit' | 'decay' | 'rest'
}

export interface PfxTargetSpawnRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  lift: number
  stage: 'acquire' | 'lock' | 'confirm' | 'release' | 'rest'
}

export interface PfxWarningLoopRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  pulse: number
  lift: number
  stage: 'inhale' | 'alert' | 'hold' | 'exhale'
}

export interface PfxMarkerReleaseRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  expansion: number
  lift: number
  stage: 'clamp' | 'confirm' | 'release' | 'settle'
}

export interface PfxScanConeRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  sweep: number
  range: number
  stage: 'acquire' | 'sweep' | 'resolve'
}

export interface PfxHologramBreakRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  breakAmount: number
  scan: number
  collapse: number
  stage: 'stabilize' | 'fracture' | 'collapse'
}

export interface PfxThrusterTrailRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  flow: number
  thrust: number
  cutoff: number
  stage: 'ignite' | 'sustain' | 'cutoff'
}

export interface PfxExhaustTelegraphRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  urgency: number
  ventOpen: number
  release: number
  stage: 'arm' | 'countdown' | 'vent'
}

export interface PfxFlameBurstRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  bloom: number
  heat: number
  peel: number
  cool: number
  stage: 'ignite' | 'blossom' | 'peel'
}

export interface PfxMeteorBurstRuntimeState {
  cycle: number
  periodSeconds: number
  progress: number
  opacity: number
  impact: number
  flash: number
  scatter: number
  cool: number
  head: number
  stage: 'descent' | 'collision' | 'ballistic-cool'
}

export interface PfxBlastBurstRuntimeState {
  cycle: number; periodSeconds: number; progress: number; opacity: number; compression: number; breach: number; flash: number; scatter: number; vacuum: number
  stage: 'compression' | 'breach' | 'vacuum-tail'
}

export interface PfxShockwaveBurstRuntimeState {
  cycle: number; periodSeconds: number; progress: number; opacity: number; compression: number; expansion: number; front: number; attenuation: number
  stage: 'compression' | 'expansion' | 'attenuation'
}

export interface PfxDustBurstRuntimeState { cycle: number; periodSeconds: number; progress: number; opacity: number; compression: number; roll: number; loft: number; settle: number; stage: 'contact' | 'roll' | 'settle' }

export interface PfxDebrisBurstRuntimeState { cycle: number; periodSeconds: number; progress: number; opacity: number; fracture: number; eject: number; fall: number; darken: number; stage: 'fracture' | 'eject' | 'fall' }

export interface PfxChoreographyBeat {
  phase: string
  role: string
  kind: string
  startFraction: number
  spawnEndFraction: number
  lifeScale: number
}

export interface PfxChoreographyAudit {
  effectId: string
  /** 'burst' effects have staged beats to audit; continuous 'loop' effects do not. */
  kind: 'burst' | 'loop'
  beats: PfxChoreographyBeat[]
  findings: string[]
  passed: boolean
}

export interface PfxMobileDeviceBenchmark {
  deviceClass: 'low-end' | 'mid'
  /** Representative hardware for the class. */
  hardware: string
  targetFps: number
  vfxGpuBudgetMs: number
  maxLiveParticles: number
  maxVfxDrawCalls: number
  maxTextureMemoryKb: number
  concurrentLargeEffects: number
}

export interface PfxMobileBenchmarkRow {
  deviceClass: PfxMobileDeviceBenchmark['deviceClass']
  /** Estimated single-instance metrics vs the class budgets. */
  passedSingle: boolean
  /** At the class's concurrent-large-effects count. */
  passedConcurrent: boolean
  findings: string[]
}

export interface PfxGroupReadinessRow {
  effectId: string
  choreographyFindings: string[]
  physicsFindings: string[]
  simParticles: number
  peakLiveParticles: number
  bufferWasteRatio: number
  drawCalls: number
  estimatedFrameCostMs: number
  lowEndSingle: boolean
  lowEndConcurrent: boolean
  midSingle: boolean
  midConcurrent: boolean
  pass: boolean
  blockers: string[]
}

export interface PfxGroupReadinessReport {
  effectIds: string[]
  rows: PfxGroupReadinessRow[]
  passedCount: number
  /** Effects failing any RECIPE-owned gate (choreography, physics, single-
   * instance budgets, buffer waste). Concurrency misses are reported per row
   * but do not block: they are gated on runtime instance-pooling. */
  blockedEffectIds: string[]
  pass: boolean
}

export interface PfxEmitterPhysicsFinding {
  phase: string
  rule: string
  detail: string
}

export interface PfxSurfaceSpatialPolicy {
  cameraFacing: boolean
  minimumDepth: number
  crossedVolume: boolean
}

export type PfxLeafBurstDescriptor = {
  center: THREE.Vector3
  direction: THREE.Vector3
  rotation: THREE.Quaternion
  seed: number
  form: number
  size: number
  shell: number
}

export type PfxPetalBurstDescriptor = {
  center: THREE.Vector3
  direction: THREE.Vector3
  rotation: THREE.Quaternion
  seed: number
  form: number
  size: number
  shell: number
}

export type PfxMudBurstClodDescriptor = {
  center: THREE.Vector3
  direction: THREE.Vector3
  seed: number
  form: number
  shell: number
  size: number
  rotation: THREE.Quaternion
}

export type PfxSlimeBurstBubbleDescriptor = {
  center: THREE.Vector3
  direction: THREE.Vector3
  seed: number
  form: number
  size: number
  rotation: THREE.Quaternion
}

export type PfxPoisonBurstSporeDescriptor = {
  center: THREE.Vector3
  direction: THREE.Vector3
  seed: number
  form: number
  size: number
  rotation: THREE.Quaternion
}

export type PfxAcidBurstDropletDescriptor = {
  center: THREE.Vector3
  direction: THREE.Vector3
  seed: number
  form: number
  shell: number
  size: number
  rotation: THREE.Quaternion
}

export interface PfxMeteorChunkPose {
  visible: boolean
  incoming: boolean
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: [number, number, number]
}

export interface PfxGlyphTrailRuntimeState { cycle: number; periodSeconds: number; progress: number; opacity: number; inscription: number; hold: number; erode: number; stage: 'write' | 'hold' | 'erode' }

export interface PfxHealingSparklePose {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}

export interface PfxHealingGlyphPose {
  role: 'hero' | 'satellite'
  position: [number, number, number]
  rotationY: number
  scale: number
}

export interface PfxHealingLeafHelixPose {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}

export type PfxGradientTextureKind =
  | 'radial-glow'
  | 'ring-glow'
  | 'trail-fade'
  | 'beam-fade'
  | 'soft-smoke'
  | 'screen-vignette'

export type PfxParticleMotionKind =
  | 'radial-burst'
  | 'shockwave-ground-burst'
  | 'cone-fountain'
  | 'orbit-ring'
  | 'ground-ring'
  | 'column-rise'
  | 'jump-launch'
  | 'drift-cloud'
  | 'dust-loop'
  | 'snow-gust'
  | 'screen-fall'
  | 'trail-stream'
  | 'beam-telegraph-flow'
  | 'laser-spray-ricochet'
  | 'impact-burst'
  | 'meteor-impact'
  | 'ground-scuff'
  | 'healing-spiral'
  | 'healing-cross'
  | 'helix-trail'
  | 'shell-flame'
  | 'converge-center'
  | 'spherical-converge'
  | 'braided-converge'
  | 'asymmetric-converge'
  | 'shadow-claw'
  | 'portal-flow'
  | 'danger-pulse'

export interface PfxParticleSimulation {
  effectId: string
  motionKind: PfxParticleMotionKind
  count: number
  /** Per-particle spawn positions, xyz triplets. */
  spawn: Float32Array
  /** Per-particle unit travel directions, xyz triplets. */
  direction: Float32Array
  /** Per-particle travel speed in world units per second. */
  speed: Float32Array
  /** Per-particle life-cycle stagger in [0, 1). */
  lifeOffset: Float32Array
  /** Per-particle turbulence wobble phase in radians. */
  wobblePhase: Float32Array
  /** Per-particle turbulence wobble frequency multiplier. */
  wobbleFrequency: Float32Array
  /** Per-particle orbit radius (orbit-ring motion). */
  orbitRadius: Float32Array
  /** Per-particle base orbit angle in radians. */
  orbitAngle: Float32Array
  colorStart: [number, number, number]
  colorEnd: [number, number, number]
}

export interface PfxSpriteVariantLayout {
  offset: THREE.Vector2
  cellScale: THREE.Vector2
  count: number
  columns: number
  startIndex: number
  rowDirection: 1 | -1
}

export interface PfxParticleEmission {
  count: number
  motionKind: PfxParticleMotionKind
  sprite: PfxSpriteName
  /** Fraction of the lifetime during which particles spawn: small = burst pop. */
  emissionWindow: number
  spawn: Float32Array
  direction: Float32Array
  speed: Float32Array
  /** Per particle: cycle offset in [0, emissionWindow), duration multiplier. */
  life: Float32Array
  /** Per particle: initial rotation, rotation speed (radians/s). */
  rotation: Float32Array
  /** Per particle: size multiplier, brightness multiplier. */
  variance: Float32Array
  /** Per particle: turbulence wobble phase and frequency. */
  wobble: Float32Array
  orbit: Float32Array
}

export interface PfxParticleShapeProfile {
  /** Size envelope: from/to multipliers over life plus fade windows. */
  sizeFrom: number
  sizeTo: number
  fadeIn: number
  fadeOut: number
  /** Velocity stretch factor (0 = billboard). */
  stretch: number
}

export interface PfxParticleColorRamp {
  hot: [number, number, number]
  base: [number, number, number]
  tail: [number, number, number]
}
