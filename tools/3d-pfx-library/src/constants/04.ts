import * as THREE from 'three'
import { PFX_SPRITE_ATLAS_DATA_URI } from '../particleSprites'
import { PFX_FLAME_FLIPBOOK_ATLAS } from '../flameFlipbook'
import { PFX_FIREBALL_FLIPBOOK_ATLAS } from '../fireballFlipbook'
import { PFX_MUZZLE_FLASH_ATLAS } from '../muzzleFlashSprites'
import { PERFORMANCE_TIER_BUDGETS, PFX_QUALITY_RUBRIC_KEYS, PFX_TEXTURE_ATLAS, PFX_TEXTURE_KINDS, STYLE_VARIANTS, getPfxTextureAtlasSlice } from './01'
import { roundMetric } from './03'
import { getPfxGeometryResourceKey } from '../effects/geometryResourceKey'
import type { ArtStyleCluster, PfxControlDefinition, PfxControlKey, PfxControls, PfxExternalEvidenceWorkItemId, PfxObjectiveReadinessRequirement, PfxPreset, PfxPresetOverrides, PfxPreviewDescriptor, PfxQualityRubricKey, PfxRedTeamReviewBatchSheetEffect, PfxRenderSurfaceKind, PfxTaxonomyEffect } from '../types/01'
import type { PfxFlameBurstRuntimeState, PfxGradientTextureKind, PfxParticleEmission, PfxParticleMotionKind, PfxParticleShapeProfile, PfxRenderSurface, PfxRuntimeResourceCacheStats } from '../types/02'

export function createReducedMotionControls(controls: PfxControls): PfxControls {
  return {
    ...controls,
    density: clamp(roundMetric(controls.density * 0.55), 0.05, 0.75),
    timing: clamp(roundMetric(controls.timing * 0.45), 0.15, 1),
    velocity: clamp(roundMetric(controls.velocity * 0.35), 0, 0.75),
    turbulence: clamp(roundMetric(controls.turbulence * 0.25), 0, 0.5),
    trailLength: clamp(roundMetric(controls.trailLength * 0.35), 0, 0.4),
    emissiveBloom: clamp(roundMetric(controls.emissiveBloom * 0.75), 0, 1),
    flipbook: 'none',
    lod: ['low'],
  }
}

export function validatePfxPreset(preset: PfxPreset): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const budget = PERFORMANCE_TIER_BUDGETS[preset.performance.tier]
  if (!budget) errors.push(`Unknown performance tier: ${preset.performance.tier}`)
  if (budget && preset.performance.maxParticles > budget.maxParticles) errors.push('maxParticles exceeds tier budget')
  if (budget && preset.performance.maxDrawCalls > budget.maxDrawCalls) errors.push('maxDrawCalls exceeds tier budget')
  if (budget && preset.performance.textureMemoryKb > budget.textureMemoryKb) errors.push('textureMemoryKb exceeds tier budget')
  if (preset.controls.density < 0 || preset.controls.density > 1) errors.push('density must be 0..1')
  if (preset.controls.scale <= 0) errors.push('scale must be positive')
  if (preset.controls.lifetime <= 0) errors.push('lifetime must be positive')
  if (preset.controls.color.length === 0) errors.push('at least one color is required')
  if (preset.preview.clip.frames < 12) errors.push('preview clip must include at least 12 frames')
  if (preset.preview.clip.durationMs <= 0) errors.push('preview clip duration must be positive')
  if (Object.keys(preset.quality.scores).join('|') !== PFX_QUALITY_RUBRIC_KEYS.join('|')) {
    errors.push('quality scores must cover the full rubric')
  }
  for (const key of PFX_QUALITY_RUBRIC_KEYS) {
    const score = preset.quality.scores[key]
    if (score < 1 || score > 5) errors.push(`quality score out of range: ${key}`)
  }
  return { valid: errors.length === 0, errors }
}

export const PFX_BUDGET_AFFECTING_CONTROL_KEYS = new Set<PfxControlKey>([
  'scale',
  'density',
  'timing',
  'lifetime',
  'velocity',
  'gravity',
  'turbulence',
  'spawnShape',
  'flipbook',
  'emissiveBloom',
  'trailLength',
  'lod',
])

export const PFX_RENDER_AFFECTING_CONTROL_KEYS = new Set<PfxControlKey>([
  'color',
  'style',
  'scale',
  'density',
  'timing',
  'lifetime',
  'velocity',
  'gravity',
  'turbulence',
  'spawnShape',
  'texture',
  'flipbook',
  'blendMode',
  'emissiveBloom',
  'trailLength',
  'lod',
])

export function createControlVariantOverride(
  definition: PfxControlDefinition,
  variant: 'min' | 'max',
): PfxPresetOverrides {
  if (definition.kind === 'color-list') {
    return { [definition.key]: variant === 'min' ? ['#ffffff'] : ['#ffffff', '#000000'] } as PfxPresetOverrides
  }
  if (definition.kind === 'multi-select') {
    return { [definition.key]: variant === 'min' ? [definition.options?.[0]] : definition.options } as PfxPresetOverrides
  }
  if (definition.kind === 'select') {
    return {
      [definition.key]: variant === 'min' ? definition.options?.[0] : definition.options?.[definition.options.length - 1],
    } as PfxPresetOverrides
  }
  return { [definition.key]: variant === 'min' ? definition.min : definition.max } as PfxPresetOverrides
}

export function controlDefinitionIsBounded(definition: PfxControlDefinition): boolean {
  if (definition.kind === 'color-list') return true
  if (definition.kind === 'select' || definition.kind === 'multi-select') {
    return Boolean(definition.options && definition.options.length > 0)
  }
  return typeof definition.min === 'number' && typeof definition.max === 'number'
}

export function controlDefaultWithinBounds(value: PfxControls[PfxControlKey], definition: PfxControlDefinition): boolean {
  if (definition.kind === 'color-list') return Array.isArray(value) && value.length > 0
  if (definition.kind === 'multi-select') {
    return Array.isArray(value) && value.every((item) => definition.options?.includes(String(item)))
  }
  if (definition.kind === 'select') return definition.options?.includes(String(value)) ?? false
  if (typeof value === 'number') {
    return (
      (typeof definition.min !== 'number' || value >= definition.min) &&
      (typeof definition.max !== 'number' || value <= definition.max)
    )
  }
  return false
}

export function matchesPfxSearchQuery(query: string, effect: PfxTaxonomyEffect, preset: PfxPreset): boolean {
  const normalizedQuery = normalizeSearchText(query)
  const hyphenQuery = normalizedQuery.replace(/\s+/g, '-')
  const searchable = [
    effect.id,
    effect.name,
    effect.effectType,
    effect.loopMode,
    effect.space,
    effect.mobileSafety,
    preset.performance.tier,
    preset.controls.texture,
    preset.controls.spawnShape,
    preset.acceptanceStatus,
    ...effect.gameplayUseCases,
    ...effect.styleAffinity,
    ...effect.emotionMood,
    ...effect.colorFamily,
    ...effect.assetRequirements,
    ...preset.tags,
  ]
  const haystack = normalizeSearchText(searchable.join(' '))
  const hyphenHaystack = haystack.replace(/\s+/g, '-')
  const terms = new Set(tokenizeSearchQuery(haystack))

  if (haystack.includes(normalizedQuery) || hyphenHaystack.includes(hyphenQuery)) return true

  const rawTokens = tokenizeSearchQuery(normalizedQuery)
  const requiresMobileSafe = rawTokens.includes('mobile-safe') || (rawTokens.includes('mobile') && rawTokens.includes('safe'))
  if (requiresMobileSafe && effect.mobileSafety !== 'safe') return false
  const tokens = rawTokens.filter((token) => token !== 'mobile-safe' && token !== 'mobile' && token !== 'safe')
  if (tokens.length === 0) return true

  return tokens.every((token) => tokenMatchesTerms(token, terms))
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenizeSearchQuery(query: string): string[] {
  const hyphenated = query.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []
  const expanded = query.split(/[^a-z0-9]+/).filter(Boolean)
  return [...new Set([...hyphenated, ...expanded])]
}

function tokenMatchesTerms(token: string, terms: ReadonlySet<string>): boolean {
  return searchSynonyms(token).some((synonym) => terms.has(synonym))
}

function searchSynonyms(token: string): string[] {
  if (token === 'sparkle') return ['sparkle', 'spark', 'glint', 'shine']
  if (token === 'spark') return ['spark', 'sparkle']
  if (token === 'impact') return ['impact', 'hit', 'spark']
  if (token === 'hit') return ['hit', 'impact']
  if (token === 'cozy') return ['cozy', 'soft', 'friendly']
  return [token]
}

export function presetControlsToOverrides(preset: PfxPreset): PfxPresetOverrides {
  return {
    color: preset.controls.color,
    style: preset.controls.style,
    scale: preset.controls.scale,
    density: preset.controls.density,
    timing: preset.controls.timing,
    lifetime: preset.controls.lifetime,
    velocity: preset.controls.velocity,
    gravity: preset.controls.gravity,
    turbulence: preset.controls.turbulence,
    spawnShape: preset.controls.spawnShape,
    texture: preset.controls.texture,
    flipbook: preset.controls.flipbook,
    blendMode: preset.controls.blendMode,
    emissiveBloom: preset.controls.emissiveBloom,
    trailLength: preset.controls.trailLength,
    seed: preset.seed,
    lod: preset.controls.lod,
  }
}

export function developerDocsIntegrationChecklist(): string[] {
  return [
    'Paste the generated component snippet into a React Three Fiber module.',
    'Pass a stable position/rotation from gameplay state instead of mutating the effect imperatively.',
    'Keep density, scale, and LOD inside the exported budget unless you rerun profiling.',
    'Use the JSON preset for tooling, save data, or remote configuration rather than duplicating constants.',
    'Respect reduced-motion settings for accessibility and repeat gameplay loops.',
  ]
}

export function developerDocsProductionCaveat(preset: PfxPreset): string {
  return `${preset.name} is currently ${preset.acceptanceStatus}; treat it as game-integration documentation, not final production approval, until market review, real-device profiling, production implementation evidence, and red-team signoff are complete.`
}

export function developerDocsQualityLabel(key: PfxQualityRubricKey): string {
  return key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).replace(/^./, (match) => match.toUpperCase())
}

export const PFX_FORBIDDEN_EXPORT_TERMS = /Scrabble|Pokemon|Mario|Zelda|Fortnite/i

export function parseExportedPreset(jsonPreset: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(jsonPreset) as Record<string, unknown>
  } catch {
    return undefined
  }
}

export const PFX_FINAL_ACCEPTANCE_COMMAND =
  'npm --prefix tools/3d-pfx-library/viewer run verify:final-acceptance'

export const PFX_LOCAL_ACCEPTANCE_COMMAND =
  'npm --prefix tools/3d-pfx-library/viewer run verify:acceptance'

export const PFX_LAN_PRODUCTION_HANDOFF_COMMAND =
  'PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan'

export const PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND =
  'PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url'

export function objectiveRequirement(input: {
  id: string
  category: string
  requirement: string
  evidence: string[]
  complete: boolean
  blockers: string[]
  nextActions: string[]
}): PfxObjectiveReadinessRequirement {
  return {
    id: input.id,
    category: input.category,
    requirement: input.requirement,
    status: input.complete ? 'locally-satisfied' : 'external-evidence-required',
    evidence: input.evidence,
    blockers: input.blockers,
    nextActions: input.nextActions,
  }
}

export function trimPathTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function sentenceCaseWorkItem(id: PfxExternalEvidenceWorkItemId): string {
  const labels: Record<PfxExternalEvidenceWorkItemId, string> = {
    'taxonomy-review': 'Taxonomy review',
    'production-implementation': 'Production implementation',
    'mobile-safari-capture': 'Mobile Safari capture',
    'chrome-android-capture': 'Chrome Android capture',
    'red-team-review': 'Red-team review',
    'final-approval': 'Final approval',
  }
  return labels[id]
}

export function pfxVisualInspectionPreviewMarkdown(
  effectName: string,
  targets: Pick<
    PfxRedTeamReviewBatchSheetEffect['visualInspectionTargets'],
    'thumbnailAsset' | 'animatedClipAsset' | 'styleContactSheetAsset' | 'controlExtremesContactSheetAsset'
  >,
): string[] {
  const altName = effectName.replace(/[[\]()`]/g, '')
  return [
    `![${altName} thumbnail](${targets.thumbnailAsset})`,
    `![${altName} animated clip](${targets.animatedClipAsset})`,
    `![${altName} style contact sheet](${targets.styleContactSheetAsset})`,
    `![${altName} control extremes contact sheet](${targets.controlExtremesContactSheetAsset})`,
  ]
}

export function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

export function valuesOutsideAcceptedEffectIds(values: readonly string[], acceptedEffectIds: ReadonlySet<string>): string[] {
  return [...new Set(values.filter((value) => !acceptedEffectIds.has(value)))]
}

export function createVisualInspectionTargets(
  effectId: string,
  reviewStage: 'red-team' | 'final-approval',
): PfxRedTeamReviewBatchSheetEffect['visualInspectionTargets'] {
  const suffix = reviewStage === 'final-approval' ? 'final approval' : undefined
  return {
    thumbnailAsset: `.context/r3f-pfx-preview-assets/thumbnails/${effectId}.svg`,
    animatedClipAsset: `.context/r3f-pfx-preview-assets/clips/${effectId}-clip.svg`,
    styleContactSheetAsset: `.context/r3f-pfx-preview-assets/contact-sheets/style-variants/${effectId}-style-contact-sheet.svg`,
    controlExtremesContactSheetAsset: `.context/r3f-pfx-preview-assets/contact-sheets/control-extremes/${effectId}-control-extremes-contact-sheet.svg`,
    styleDifferentiationAnchor: `.context/r3f-pfx-style-differentiation-matrix.json#${effectId}`,
    controlSafetyAnchor: `.context/r3f-pfx-control-safety-matrix.json#${effectId}`,
    requiredChecks:
      reviewStage === 'final-approval'
        ? [
            `Inspect default thumbnail and animated clip before ${suffix}.`,
            `Compare all 17 style variants against rendered browser style controls before ${suffix}.`,
            `Exercise min/default/max states for render-impact and budget-impact controls before ${suffix}.`,
          ]
        : [
            'Inspect default thumbnail and animated clip before visual-quality signoff.',
            'Compare all 17 style variants against rendered browser style controls before style signoff.',
            'Exercise min/default/max states for render-impact and budget-impact controls before customization signoff.',
          ],
  }
}

export const PFX_PRODUCTION_IMPLEMENTATION_NOTE_TERMS = [
  'component',
  'control',
  'customization',
  'documentation',
  'export',
  'implementation',
  'mobile',
  'preset',
  'preview',
  'r3f',
  'recipe',
]

export const PFX_RED_TEAM_NOTE_ACTION_TERMS = [
  'accepted',
  'attacked',
  'blocker',
  'checked',
  'deferral',
  'evidence',
  'rejected',
  'resolved',
  'risk',
]

const PFX_RED_TEAM_NOTE_DIMENSION_TERMS = [
  'control',
  'customization',
  'documentation',
  'game-ready',
  'game readiness',
  'implementation',
  'export',
  'mobile',
  'performance',
  'real-device',
  'style',
  'taxonomy',
]

export function redTeamNoteDimensionCoverage(normalizedNote: string): number {
  return PFX_RED_TEAM_NOTE_DIMENSION_TERMS.filter((term) => normalizedNote.includes(term)).length
}

export function requiredProductionActions(input: {
  productionReady: boolean
  approvedDeferral: boolean
  taxonomyReviewed: boolean
  hasProductionImplementation: boolean
  realDeviceProfiled: boolean
  mobileSafariProfiled: boolean
  chromeAndroidProfiled: boolean
  redTeamSignedOff: boolean
  hasFinalApprovalMetadata: boolean
  hasRequiredApprovalEvidence: boolean
}): string[] {
  if (input.productionReady || input.approvedDeferral) return []

  const actions: string[] = []
  if (!input.taxonomyReviewed) {
    actions.push('Record market-reviewed taxonomy evidence before final production approval.')
  }
  if (!input.hasFinalApprovalMetadata) {
    actions.push('Replace approval placeholder metadata with named approver, timestamp, and rationale.')
  }
  if (input.hasFinalApprovalMetadata && !input.hasRequiredApprovalEvidence) {
    actions.push('Attach every required production approval evidence reference for the same effect.')
  }
  if (!input.hasProductionImplementation) {
    actions.push('Promote authored-preview coverage to a production implementation or record an approved deferral.')
  }
  if (!input.realDeviceProfiled) {
    if (!input.mobileSafariProfiled && !input.chromeAndroidProfiled) {
      actions.push('Attach measured mobile Safari and Chrome Android profile evidence.')
    } else {
      if (!input.mobileSafariProfiled) actions.push('Attach measured mobile Safari profile evidence.')
      if (!input.chromeAndroidProfiled) actions.push('Attach measured Chrome Android profile evidence.')
    }
  }
  if (!input.redTeamSignedOff) {
    actions.push('Resolve adversarial red-team blocking findings and record sign-off.')
  }

  return actions
}

export function createProductionBlockingFindings(input: {
  effectsRequiringDecision: number
  missingTaxonomyReview: number
  missingProductionImplementations: number
  missingDeviceProfiles: number
  missingMobileSafariProfiles: number
  missingChromeAndroidProfiles: number
  missingRedTeamSignoff: number
}): string[] {
  const findings: string[] = []
  if (input.missingTaxonomyReview > 0) {
    findings.push(`${input.missingTaxonomyReview} effects lack market-reviewed taxonomy approval`)
  }
  if (input.missingProductionImplementations > 0) {
    findings.push(`${input.missingProductionImplementations} effects lack production implementation or approved deferral`)
  }
  if (input.missingDeviceProfiles > 0) {
    if (
      input.missingMobileSafariProfiles === input.missingDeviceProfiles &&
      input.missingChromeAndroidProfiles === input.missingDeviceProfiles
    ) {
      findings.push(`${input.missingDeviceProfiles} effects lack mobile Safari and Chrome Android profiling evidence`)
    } else {
      if (input.missingMobileSafariProfiles > 0) {
        findings.push(`${input.missingMobileSafariProfiles} effects lack mobile Safari profiling evidence`)
      }
      if (input.missingChromeAndroidProfiles > 0) {
        findings.push(`${input.missingChromeAndroidProfiles} effects lack Chrome Android profiling evidence`)
      }
    }
  }
  if (input.missingRedTeamSignoff > 0) {
    findings.push(`${input.missingRedTeamSignoff} effects lack red-team sign-off`)
  }
  if (input.effectsRequiringDecision > 0) {
    findings.push(`${input.effectsRequiringDecision} effects lack final production approval or approved deferral`)
  }
  return findings
}

export const PFX_STRUCTURAL_SURFACE_KINDS = new Set<PfxRenderSurfaceKind>([
  'impact-shards',
  'core-sphere',
  'impact-core',
  'mesh-fragments',
  'trail-ribbon',
  'shield-shell',
  'magic-circle',
  'water-cone-sheet',
  'beam-column',
  'cloud-volume',
  'telegraph-disc',
  'portal-throat',
  'scuff-wedge',
  'healing-glyphs',
  'spawn-voxels',
  'footprint-decal',
  'muzzle-cone',
  'toxic-pool',
  'bubble-shells',
  'dissolve-voxels',
  'wind-streaks',
  'reward-gem',
  'coin-medallion',
  'celebration-chevrons',
  'projectile-comet',
  'projectile-head',
  'smoke-billows',
  'tapered-trail',
])

export const PFX_PARTICLE_BASE_SIZE = 0.2

const sharedParticleTextureCache = new Map<PfxControls['texture'], THREE.Texture>()

const sharedGeometryCache = new Map<string, THREE.BufferGeometry>()

let sharedParticleAtlasTexture: THREE.DataTexture | undefined

export function getPfxSharedParticleTexture(kind: PfxControls['texture']): THREE.Texture {
  const cached = sharedParticleTextureCache.get(kind)
  if (cached) return cached
  const texture = makeParticleTexture(kind)
  sharedParticleTextureCache.set(kind, texture)
  return texture
}

export function getPfxSharedGeometry(
  preset: Pick<PfxPreset, 'controls' | 'implementationProfile'>,
): THREE.BufferGeometry {
  const key = getPfxGeometryResourceKey(preset)
  const cached = sharedGeometryCache.get(key)
  if (cached) return cached
  const geometry = makeGeometry(preset)
  sharedGeometryCache.set(key, geometry)
  return geometry
}

export function getPfxRuntimeResourceCacheStats(): PfxRuntimeResourceCacheStats {
  return {
    textures: sharedParticleTextureCache.size,
    geometries: sharedGeometryCache.size,
  }
}

export function clearPfxRuntimeResourceCache(): void {
  for (const texture of sharedParticleTextureCache.values()) texture.dispose()
  for (const geometry of sharedGeometryCache.values()) geometry.dispose()
  for (const texture of sharedGradientTextureCache.values()) texture.dispose()
  sharedParticleAtlasTexture?.dispose()
  sharedSpriteAtlasTexture?.dispose()
  sharedMuzzleFlashAtlasTexture?.dispose()
  sharedFlameFlipbookTexture?.dispose()
  sharedFireballFlipbookTexture?.dispose()
  sharedParticleTextureCache.clear()
  sharedGeometryCache.clear()
  sharedGradientTextureCache.clear()
  sharedParticleAtlasTexture = undefined
  sharedSpriteAtlasTexture = undefined
  sharedMuzzleFlashAtlasTexture = undefined
  sharedFlameFlipbookTexture = undefined
  sharedFireballFlipbookTexture = undefined
}

export function buildPfxSpriteEmissionGeometry(emission: PfxParticleEmission): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry()
  const quad = new THREE.PlaneGeometry(1, 1)
  geometry.index = quad.index
  geometry.setAttribute('position', quad.getAttribute('position'))
  geometry.setAttribute('uv', quad.getAttribute('uv'))
  geometry.instanceCount = emission.count
  geometry.setAttribute('aSpawn', new THREE.InstancedBufferAttribute(emission.spawn, 3))
  geometry.setAttribute('aDirection', new THREE.InstancedBufferAttribute(emission.direction, 3))
  geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(emission.speed, 1))
  geometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(emission.life, 2))
  geometry.setAttribute('aRotation', new THREE.InstancedBufferAttribute(emission.rotation, 2))
  geometry.setAttribute('aVariance', new THREE.InstancedBufferAttribute(emission.variance, 2))
  geometry.setAttribute('aWobble', new THREE.InstancedBufferAttribute(emission.wobble, 2))
  geometry.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(emission.orbit, 2))
  return geometry
}

export function createPfxFlameBurstLifecycle(cycle: number): {
  progress: number
  opacity: number
  bloom: number
  heat: number
  peel: number
  cool: number
  stage: 'ignite' | 'blossom' | 'peel'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.26) {
    const ignite = THREE.MathUtils.clamp(progress / 0.24, 0, 1)
    return {
      progress,
      opacity: roundMetric(0.32 + ignite * 0.68),
      bloom: roundMetric(0.16 + ignite * 0.84),
      heat: roundMetric(0.42 + ignite * 0.58),
      peel: 0,
      cool: 0,
      stage: 'ignite',
    }
  }
  if (progress < 0.68) {
    const blossom = (progress - 0.26) / 0.42
    return { progress, opacity: 1, bloom: 1, heat: 1, peel: roundMetric(blossom * 0.18), cool: 0, stage: 'blossom' }
  }
  const decay = (progress - 0.68) / 0.32
  return {
    progress,
    opacity: Math.max(0, roundMetric(1 - Math.pow(decay, 0.62))),
    bloom: 1,
    heat: roundMetric(1 - decay * 0.82),
    peel: roundMetric(0.18 + decay * 0.82),
    cool: roundMetric(decay),
    stage: 'peel',
  }
}

export function createPfxFlameBurstRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxFlameBurstRuntimeState,
): PfxFlameBurstRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.35 * Math.max(0.25, lifetime)
  const cycle = THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)
  const lifecycle = createPfxFlameBurstLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, bloom: 0, heat: 0, peel: 0, cool: 0, stage: 'ignite' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.bloom = lifecycle.bloom
  state.heat = lifecycle.heat
  state.peel = lifecycle.peel
  state.cool = lifecycle.cool
  state.stage = lifecycle.stage
  return state
}

export function smoothPfxWaterColumnNormals(geometry: THREE.BufferGeometry): void {
  geometry.computeVertexNormals()
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute
  const sums = new Map<string, THREE.Vector3>()
  const keys: string[] = []
  for (let index = 0; index < position.count; index += 1) {
    const key = `${Math.round(position.getX(index) * 10000)}:${Math.round(position.getY(index) * 10000)}:${Math.round(position.getZ(index) * 10000)}`
    keys.push(key)
    const sum = sums.get(key) ?? new THREE.Vector3()
    sum.x += normal.getX(index)
    sum.y += normal.getY(index)
    sum.z += normal.getZ(index)
    sums.set(key, sum)
  }
  for (let index = 0; index < normal.count; index += 1) {
    const averaged = sums.get(keys[index]!)!.clone().normalize()
    normal.setXYZ(index, averaged.x, averaged.y, averaged.z)
  }
  normal.needsUpdate = true
}

export function markPfxReferenceAdaptation(
  geometry: THREE.BufferGeometry,
  source: string,
  adaptation: string,
  scale: [number, number, number],
  translation: [number, number, number],
): THREE.BufferGeometry {
  geometry.scale(scale[0], scale[1], scale[2])
  geometry.translate(translation[0], translation[1], translation[2])
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxReferenceSource'] = source
  geometry.userData['pfxReferenceAdaptation'] = adaptation
  geometry.userData['pfxReferenceLicense'] = 'repo-original-procedural-closed-mesh'
  geometry.userData['pfxReferenceDrawCalls'] = 1
  geometry.userData['pfxReferenceClosedFaces'] = true
  geometry.userData['pfxReferenceBillboardCount'] = 0
  geometry.userData['pfxReferenceTriangleCount'] = geometry.getAttribute('position').count / 3
  return geometry
}

export function appendPfxBeamTelegraphStroke(
  positions: number[],
  colors: number[],
  start: THREE.Vector3,
  end: THREE.Vector3,
  halfWidth: number,
  halfDepth: number,
  startColor: readonly [number, number, number],
  endColor: readonly [number, number, number],
): void {
  const direction = end.clone().sub(start).normalize()
  const reference = Math.abs(direction.y) < 0.82 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
  const basisA = direction.clone().cross(reference).normalize().multiplyScalar(halfWidth)
  const basisB = direction.clone().cross(basisA).normalize().multiplyScalar(halfDepth)
  const rings = [start, end].map((center) => [
    center.clone().add(basisA).add(basisB),
    center.clone().sub(basisA).add(basisB),
    center.clone().sub(basisA).sub(basisB),
    center.clone().add(basisA).sub(basisB),
  ])
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, colorA: readonly [number, number, number], colorB: readonly [number, number, number]) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorB)
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, colorA: readonly [number, number, number], colorB: readonly [number, number, number]) => {
    push(a, b, c, colorA, colorB)
    push(a, c, d, colorA, colorB)
  }
  quad(rings[0]![0]!, rings[0]![3]!, rings[0]![2]!, rings[0]![1]!, startColor, startColor)
  quad(rings[1]![0]!, rings[1]![1]!, rings[1]![2]!, rings[1]![3]!, endColor, endColor)
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4
    quad(rings[0]![side]!, rings[0]![next]!, rings[1]![next]!, rings[1]![side]!, startColor, endColor)
  }
}

export function appendPfxBeamTelegraphTaperedField(
  positions: number[],
  colors: number[],
  startX: number,
  endX: number,
  sourceHalfWidth: number,
  targetHalfWidth: number,
  baseY: number,
  height: number,
  sourceColor: readonly [number, number, number],
  targetColor: readonly [number, number, number],
): void {
  const topY = baseY + height
  const s0 = new THREE.Vector3(startX, topY, -sourceHalfWidth)
  const s1 = new THREE.Vector3(startX, topY, sourceHalfWidth)
  const e0 = new THREE.Vector3(endX, topY, -targetHalfWidth)
  const e1 = new THREE.Vector3(endX, topY, targetHalfWidth)
  const sb0 = new THREE.Vector3(startX, baseY, -sourceHalfWidth)
  const sb1 = new THREE.Vector3(startX, baseY, sourceHalfWidth)
  const eb0 = new THREE.Vector3(endX, baseY, -targetHalfWidth)
  const eb1 = new THREE.Vector3(endX, baseY, targetHalfWidth)
  const push = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
    colorC: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorC)
  }
  const quad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
  ) => {
    push(a, b, c, colorA, colorB, colorB)
    push(a, c, d, colorA, colorB, colorA)
  }
  quad(s1, e1, e0, s0, sourceColor, targetColor)
  quad(sb0, eb0, eb1, sb1, sourceColor, targetColor)
  quad(s0, e0, eb0, sb0, sourceColor, targetColor)
  quad(s1, sb1, eb1, e1, sourceColor, targetColor)
  quad(s0, sb0, sb1, s1, sourceColor, sourceColor)
  quad(e1, eb1, eb0, e0, targetColor, targetColor)
}

export function appendPfxLaserSprayTriangle(
  positions: number[],
  colors: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  colorA: readonly [number, number, number],
  colorB: readonly [number, number, number],
  colorC: readonly [number, number, number],
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  colors.push(...colorA, ...colorB, ...colorC)
}

export function appendPfxLaserSprayTaperedBolt(
  positions: number[],
  colors: number[],
  sequences: number[],
  shells: number[],
  start: THREE.Vector3,
  end: THREE.Vector3,
  startRadius: number,
  endRadius: number,
  startColor: readonly [number, number, number],
  endColor: readonly [number, number, number],
  sequence: number,
  shell: number,
  sides = 8,
): void {
  const direction = end.clone().sub(start).normalize()
  const reference = Math.abs(direction.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
  const basisA = direction.clone().cross(reference).normalize()
  const basisB = direction.clone().cross(basisA).normalize()
  const ring = (center: THREE.Vector3, radius: number) => Array.from({ length: sides }, (_, index) => {
    const angle = index / sides * Math.PI * 2
    return center.clone()
      .addScaledVector(basisA, Math.cos(angle) * radius)
      .addScaledVector(basisB, Math.sin(angle) * radius)
  })
  const startRing = ring(start, startRadius)
  const endRing = ring(end, endRadius)
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: readonly [number, number, number], cb: readonly [number, number, number], cc: readonly [number, number, number]) => {
    appendPfxLaserSprayTriangle(positions, colors, a, b, c, ca, cb, cc)
    sequences.push(sequence, sequence, sequence)
    shells.push(shell, shell, shell)
  }
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides
    push(startRing[index]!, endRing[index]!, startRing[next]!, startColor, endColor, startColor)
    push(startRing[next]!, endRing[index]!, endRing[next]!, startColor, endColor, endColor)
    push(start, startRing[next]!, startRing[index]!, startColor, startColor, startColor)
    push(end, endRing[index]!, endRing[next]!, endColor, endColor, endColor)
  }
}

export function appendPfxPlasmaHitPrimitive(
  positions: number[],
  colors: number[],
  primitive: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  color: readonly [number, number, number],
): void {
  const source = primitive.index ? primitive.toNonIndexed() : primitive
  const attribute = source.getAttribute('position')
  const point = new THREE.Vector3()
  for (let index = 0; index < attribute.count; index += 1) {
    point.fromBufferAttribute(attribute, index).applyMatrix4(matrix)
    positions.push(point.x, point.y, point.z)
    colors.push(...color)
  }
  if (source !== primitive) source.dispose()
}

export function appendPfxPlasmaHitTube(
  positions: number[],
  colors: number[],
  centers: THREE.Vector3[],
  radius: number | readonly number[],
  color: readonly [number, number, number],
  crossSectionSides = 8,
): void {
  const sides = crossSectionSides
  const rings = centers.map((center, centerIndex) => {
    const previous = centers[Math.max(0, centerIndex - 1)]!
    const next = centers[Math.min(centers.length - 1, centerIndex + 1)]!
    const tangent = next.clone().sub(previous).normalize()
    const reference = Math.abs(tangent.x) < 0.88 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const basisA = tangent.clone().cross(reference).normalize()
    const basisB = tangent.clone().cross(basisA).normalize()
    const ringRadius = typeof radius === 'number' ? radius : radius[centerIndex]!
    return Array.from({ length: sides }, (_, side) => {
      const angle = side / sides * Math.PI * 2
      return center.clone().addScaledVector(basisA, Math.cos(angle) * ringRadius).addScaledVector(basisB, Math.sin(angle) * ringRadius)
    })
  })
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    appendPfxLaserSprayTriangle(positions, colors, a, b, c, color, color, color)
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const nextSide = (side + 1) % sides
      push(rings[ringIndex]![side]!, rings[ringIndex + 1]![side]!, rings[ringIndex]![nextSide]!)
      push(rings[ringIndex]![nextSide]!, rings[ringIndex + 1]![side]!, rings[ringIndex + 1]![nextSide]!)
    }
  }
  for (let side = 0; side < sides; side += 1) {
    const nextSide = (side + 1) % sides
    push(centers[0]!, rings[0]![nextSide]!, rings[0]![side]!)
    push(centers.at(-1)!, rings.at(-1)![side]!, rings.at(-1)![nextSide]!)
  }
}

export function appendPfxElectricCriticalPrism(
  positions: number[],
  colors: number[],
  start: THREE.Vector3,
  end: THREE.Vector3,
  startRadius: number,
  endRadius: number,
  color: readonly [number, number, number],
): void {
  const direction = end.clone().sub(start)
  const length = direction.length()
  const prism = new THREE.CylinderGeometry(endRadius, startRadius, length, 8, 1, false)
  const matrix = new THREE.Matrix4().compose(
    start.clone().add(end).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    new THREE.Vector3(1, 1, 1),
  )
  appendPfxPlasmaHitPrimitive(positions, colors, prism, matrix, color)
  prism.dispose()
}

export function createPfxFlameBurstGeometry(): THREE.BufferGeometry {
  const radialSegments = 8
  const ringTimes = [0, 0.14, 0.32, 0.52, 0.72, 0.86]
  const ringScales = [0.42, 1.24, 1.06, 0.75, 0.45, 0.18]
  const tongues = [
    { baseX: 0, baseZ: 0, height: 1.6, radius: 0.34, bendX: 0.3, bendZ: -0.12, curlX: -0.22, curlZ: 0.08, phase: 0.2 },
    { baseX: -0.035, baseZ: 0.025, height: 0.92, radius: 0.25, bendX: -0.61, bendZ: 0.18, curlX: 0.17, curlZ: -0.08, phase: 1.1 },
    { baseX: 0.04, baseZ: -0.025, height: 1.26, radius: 0.29, bendX: 0.63, bendZ: -0.22, curlX: -0.2, curlZ: 0.1, phase: 2.2 },
    { baseX: -0.02, baseZ: 0.05, height: 0.74, radius: 0.22, bendX: -0.4, bendZ: 0.45, curlX: 0.12, curlZ: -0.18, phase: 3.25 },
    { baseX: 0.025, baseZ: -0.05, height: 0.86, radius: 0.24, bendX: 0.44, bendZ: -0.43, curlX: -0.13, curlZ: 0.16, phase: 4.4 },
  ]
  const positions: number[] = []
  const uvs: number[] = []
  const tongueIds: number[] = []

  const point = (tongue: (typeof tongues)[number], ring: number, segment: number): [number, number, number] => {
    const time = ring >= ringTimes.length ? 1 : ringTimes[ring]!
    const radius = ring >= ringScales.length ? 0 : tongue.radius * ringScales[ring]!
    const angle = (segment / radialSegments) * Math.PI * 2
    const fold = Math.pow(time, 1.55)
    const curl = 4 * time * (1 - time)
    const radialWarp = 1 + Math.cos(angle * 2 + tongue.phase) * 0.09 * (1 - time * 0.35)
    return [
      tongue.baseX + Math.cos(angle) * radius * radialWarp + tongue.bendX * fold + tongue.curlX * curl,
      time * tongue.height + Math.cos(angle + tongue.phase) * radius * 0.055,
      tongue.baseZ + Math.sin(angle) * radius * radialWarp * 0.84 + tongue.bendZ * fold + tongue.curlZ * curl,
    ]
  }
  const vertex = (value: [number, number, number], u: number, v: number, tongueId: number) => {
    positions.push(...value)
    uvs.push(u, v)
    tongueIds.push(tongueId)
  }
  const triangle = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    au: number,
    av: number,
    bu: number,
    bv: number,
    cu: number,
    cv: number,
    tongueId: number,
  ) => {
    vertex(a, au, av, tongueId)
    vertex(b, bu, bv, tongueId)
    vertex(c, cu, cv, tongueId)
  }

  tongues.forEach((tongue, tongueId) => {
    for (let ring = 0; ring < ringTimes.length - 1; ring += 1) {
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const next = (segment + 1) % radialSegments
        const u0 = segment / radialSegments
        const u1 = (segment + 1) / radialSegments
        const v0 = ringTimes[ring]!
        const v1 = ringTimes[ring + 1]!
        const a = point(tongue, ring, segment)
        const b = point(tongue, ring, next)
        const c = point(tongue, ring + 1, next)
        const d = point(tongue, ring + 1, segment)
        triangle(a, b, c, u0, v0, u1, v0, u1, v1, tongueId)
        triangle(a, c, d, u0, v0, u1, v1, u0, v1, tongueId)
      }
    }
    const shoulderRing = ringTimes.length - 1
    const tip = point(tongue, ringTimes.length, 0)
    const baseCenter: [number, number, number] = [tongue.baseX, 0, tongue.baseZ]
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments
      const u0 = segment / radialSegments
      const u1 = (segment + 1) / radialSegments
      triangle(
        point(tongue, shoulderRing, segment),
        point(tongue, shoulderRing, next),
        tip,
        u0,
        ringTimes[shoulderRing]!,
        u1,
        ringTimes[shoulderRing]!,
        (u0 + u1) * 0.5,
        1,
        tongueId,
      )
      triangle(
        baseCenter,
        point(tongue, 0, next),
        point(tongue, 0, segment),
        0.5,
        0,
        u1,
        0,
        u0,
        0,
        tongueId,
      )
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aTongueId', new THREE.Float32BufferAttribute(tongueIds, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxFlameBurstGeometry'] = true
  geometry.userData['pfxFlameBurstTongueCount'] = tongues.length
  geometry.userData['pfxFlameBurstClosedTongues'] = true
  geometry.userData['pfxFlameBurstTriangles'] = positions.length / 9
  geometry.userData['pfxFlameBurstConnectedComponents'] = tongues.length
  geometry.userData['pfxFlameBurstDrawCalls'] = 1
  return geometry
}

export function createPfxMeteorBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const parts: number[] = []
  const origins: number[] = []
  const directions: number[] = []
  const seeds: number[] = []
  const point = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()

  const appendClosedComponent = (
    source: THREE.BufferGeometry,
    origin: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number],
    part: number,
    direction: [number, number, number],
    seed: number,
  ) => {
    const geometry = source.index ? source.toNonIndexed() : source
    quaternion.setFromEuler(new THREE.Euler(...rotation))
    const sourcePosition = geometry.getAttribute('position')
    for (let index = 0; index < sourcePosition.count; index += 1) {
      point.fromBufferAttribute(sourcePosition, index)
      point.multiply(new THREE.Vector3(...scale)).applyQuaternion(quaternion)
      positions.push(point.x + origin[0], point.y + origin[1], point.z + origin[2])
      parts.push(part)
      origins.push(...origin)
      directions.push(...direction)
      seeds.push(seed)
    }
    if (geometry !== source) geometry.dispose()
    source.dispose()
  }

  const incomingBodies = [
    { origin: [-0.62, 0.94, -0.4] as [number, number, number], scale: [0.36, 0.3, 0.52] as [number, number, number], seed: 0.08 },
    { origin: [-0.82, 1.16, -0.53] as [number, number, number], scale: [0.2, 0.4, 0.2] as [number, number, number], seed: 0.26 },
    { origin: [-1.01, 1.37, -0.66] as [number, number, number], scale: [0.13, 0.3, 0.13] as [number, number, number], seed: 0.42 },
  ]
  incomingBodies.forEach((body, index) => {
    const rotation = index === 0
      ? new THREE.Euler(0.38, -0.52, -0.72)
      : new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(...body.origin).normalize(),
        ))
    appendClosedComponent(
      index === 0 ? new THREE.IcosahedronGeometry(1, 0) : new THREE.ConeGeometry(1, 1, 5, 1, false),
      body.origin,
      body.scale,
      [rotation.x, rotation.y, rotation.z],
      0,
      [-body.origin[0], -body.origin[1], -body.origin[2]],
      body.seed,
    )
  })

  const crownCount = 5
  for (let index = 0; index < crownCount; index += 1) {
    const crownAngles = [0, 0.2, 1.48, 2.92, 4.42]
    const angle = crownAngles[index]!
    const radial = index === 0 ? 0 : 0.22 + (index % 2) * 0.045
    const direction: [number, number, number] = [Math.cos(angle), 0.64 + (index % 3) * 0.08, Math.sin(angle)]
    appendClosedComponent(
      index === 0 ? new THREE.IcosahedronGeometry(1, 0) : new THREE.ConeGeometry(1, 1, 4, 1, false),
      index === 0 ? [0.04, 0.09, -0.03] : [Math.cos(angle) * radial, 0.19, Math.sin(angle) * radial],
      index === 0
        ? [0.44, 0.14, 0.34]
        : [0.17 + (index % 2) * 0.035, 0.46 - (index % 3) * 0.04, 0.17 + ((index + 1) % 2) * 0.025],
      index === 0
        ? [0.04, -0.2, 0.02]
        : [Math.sin(angle) * 0.82, 0.3 + index * 0.5, -Math.cos(angle) * 0.82],
      1,
      direction,
      0.12 + index * 0.13,
    )
  }

  const ejectaCount = 8
  for (let index = 0; index < ejectaCount; index += 1) {
    const angle = index / ejectaCount * Math.PI * 2 + 0.17
    const radius = 0.58 + (index % 3) * 0.13
    const lift = 0.28 + ((index * 5) % 7) * 0.07
    const directionVector = new THREE.Vector3(Math.cos(angle), 0.56 + (index % 4) * 0.11, Math.sin(angle)).normalize()
    const direction: [number, number, number] = [directionVector.x, directionVector.y, directionVector.z]
    appendClosedComponent(
      new THREE.IcosahedronGeometry(1, 0),
      [Math.cos(angle) * radius, lift, Math.sin(angle) * radius * 0.82],
      [0.1 + (index % 3) * 0.025, 0.08 + ((index + 1) % 3) * 0.022, 0.15 + (index % 2) * 0.035],
      [index * 0.61, index * 0.93, index * 0.37],
      2,
      direction,
      (index + 0.5) / ejectaCount,
    )
  }

  const groundFrontCount = 7
  for (let index = 0; index < groundFrontCount; index += 1) {
    const angle = -2.4 + index / (groundFrontCount - 1) * Math.PI * 1.25
    const radius = 0.76 + (index % 3) * 0.13
    const directionVector = new THREE.Vector3(Math.cos(angle), 0.08, Math.sin(angle)).normalize()
    const direction: [number, number, number] = [directionVector.x, directionVector.y, directionVector.z]
    appendClosedComponent(
      new THREE.BoxGeometry(1, 1, 1),
      [Math.cos(angle) * radius, 0.025, Math.sin(angle) * radius * 0.88],
      [0.28 + (index % 2) * 0.05, 0.055 + (index % 3) * 0.012, 0.13 - (index % 2) * 0.018],
      [0.03 * (index - 3), -angle + Math.PI * 0.5, 0.025 * (index - 3)],
      3,
      direction,
      (index + 0.35) / groundFrontCount,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aMeteorPart', new THREE.Float32BufferAttribute(parts, 1))
  geometry.setAttribute('aMeteorOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('aMeteorDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('aMeteorSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxMeteorBurstGeometry'] = true
  geometry.userData['pfxMeteorBurstClosedComponents'] = true
  geometry.userData['pfxMeteorBurstIncomingBodyCount'] = incomingBodies.length
  geometry.userData['pfxMeteorBurstCollisionCrownCount'] = crownCount
  geometry.userData['pfxMeteorBurstEjectaCount'] = ejectaCount
  geometry.userData['pfxMeteorBurstGroundFrontCount'] = groundFrontCount
  geometry.userData['pfxMeteorBurstConnectedComponents'] = incomingBodies.length + crownCount + ejectaCount + groundFrontCount
  geometry.userData['pfxMeteorBurstTriangles'] = positions.length / 9
  geometry.userData['pfxMeteorBurstDrawCalls'] = 1
  geometry.userData['pfxMeteorBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function applyStyleVariant(controls: PfxControls, style: ArtStyleCluster): PfxControls {
  const variant = STYLE_VARIANTS[style]
  const semanticPrimary = controls.color[0] ?? variant.palette[0] ?? '#ffffff'
  const semanticSecondary = controls.color[1] ?? variant.palette[1] ?? semanticPrimary
  return {
    ...controls,
    style,
    color: [semanticPrimary, semanticSecondary, variant.palette[0] ?? semanticPrimary],
    texture: variant.texture ?? controls.texture,
    blendMode: variant.blendMode ?? controls.blendMode,
    emissiveBloom: clamp(controls.emissiveBloom * variant.emissiveMultiplier, 0, 1.5),
    turbulence: clamp(controls.turbulence * variant.turbulenceMultiplier, 0, 2),
    density: clamp(controls.density * variant.densityMultiplier, 0.05, 1),
  }
}

export function flipbookFrameCount(flipbook: PfxControls['flipbook']): number {
  if (flipbook === 'smoke-8' || flipbook === 'flame-8') return 8
  if (flipbook === 'magic-12') return 12
  if (flipbook === 'impact-6') return 6
  return 1
}

function makeGeometry(preset: Pick<PfxPreset, 'controls' | 'implementationProfile'>): THREE.BufferGeometry {
  const lodMultiplier = preset.controls.lod.includes('high') ? 1 : preset.controls.lod.includes('medium') ? 0.72 : 0.45
  const count = Math.max(8, Math.floor(64 * preset.controls.density * lodMultiplier))
  const positions = new Float32Array(count * 3)
  const rand = seededRandom(preset.controls.seed)
  for (let i = 0; i < count; i++) {
    const index = i * 3
    const angle = rand() * Math.PI * 2
    const lifePhase = count <= 1 ? 0 : i / (count - 1)
    const velocityRadius = 1 + preset.controls.velocity * 0.42
    const lifetimeFalloff = Math.max(0.2, preset.controls.lifetime / 2.8)
    const radius = Math.pow(rand(), 0.65) * preset.controls.scale * velocityRadius * lifetimeFalloff
    const z = (rand() - 0.5) * 0.18 * preset.controls.scale
    if (preset.implementationProfile === 'beam-column') {
      positions[index] = (rand() - 0.5) * 0.14 * preset.controls.scale
      positions[index + 1] = rand() * preset.controls.scale * 1.8
      positions[index + 2] = z
    } else if (preset.implementationProfile === 'trail-ribbon') {
      positions[index] = (i / count - 0.5) * preset.controls.scale * preset.controls.trailLength
      positions[index + 1] = Math.sin(i * 0.32) * 0.05
      positions[index + 2] = z
    } else if (preset.controls.spawnShape === 'ring') {
      positions[index] = Math.cos(angle) * preset.controls.scale
      positions[index + 1] = Math.sin(angle) * preset.controls.scale
      positions[index + 2] = z
    } else if (preset.controls.spawnShape === 'box') {
      positions[index] = (rand() - 0.5) * preset.controls.scale * 1.8
      positions[index + 1] = (rand() - 0.5) * preset.controls.scale * 1.2
      positions[index + 2] = (rand() - 0.5) * preset.controls.scale * 0.3
    } else if (preset.controls.spawnShape === 'cone') {
      positions[index] = Math.cos(angle) * radius * lifePhase
      positions[index + 1] = lifePhase * preset.controls.scale * 1.7
      positions[index + 2] = Math.sin(angle) * radius * lifePhase * 0.25
    } else if (preset.controls.spawnShape === 'sphere' || preset.controls.spawnShape === 'mesh') {
      const phi = Math.acos(2 * rand() - 1)
      positions[index] = Math.sin(phi) * Math.cos(angle) * radius
      positions[index + 1] = Math.sin(phi) * Math.sin(angle) * radius
      positions[index + 2] = Math.cos(phi) * radius
    } else {
      positions[index] = Math.cos(angle) * radius
      positions[index + 1] = Math.sin(angle) * radius
      positions[index + 2] = z
    }
    positions[index + 1] = (positions[index + 1] ?? 0) + preset.controls.gravity * lifePhase * preset.controls.scale
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

export const sharedGradientTextureCache = new Map<PfxGradientTextureKind, THREE.DataTexture>()

const PFX_MESH_EMITTER_VERTICES: ReadonlyArray<readonly [number, number, number]> = (() => {
  const phi = (1 + Math.sqrt(5)) / 2
  const vertices: Array<[number, number, number]> = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ]
  return vertices.map(([x, y, z]) => {
    const length = Math.hypot(x, y, z)
    return [x / length, y / length, z / length] as const
  })
})()

export function samplePfxMeshEmitter(index: number, count: number, jitter: number): readonly [number, number, number] {
  const a = PFX_MESH_EMITTER_VERTICES[index % PFX_MESH_EMITTER_VERTICES.length]!
  const stride = Math.max(1, Math.floor(count / PFX_MESH_EMITTER_VERTICES.length))
  const b = PFX_MESH_EMITTER_VERTICES[(index + stride * 5) % PFX_MESH_EMITTER_VERTICES.length]!
  const mix = 0.08 + jitter * 0.24
  const x = a[0] * (1 - mix) + b[0] * mix
  const y = a[1] * (1 - mix) + b[1] * mix
  const z = a[2] * (1 - mix) + b[2] * mix
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

export function hashPfxSurfaceKey(surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase'>): number {
  const key = `${surface.kind}:${surface.role}:${surface.phase ?? 'base'}`
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}

export function getPfxParticleMotionKind(
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase' | 'tuning'>,
  preset: Pick<PfxPreset, 'controls' | 'implementationProfile'>,
): PfxParticleMotionKind {
  if (surface.tuning?.motion) return surface.tuning.motion
  const phase = surface.phase ?? ''
  if (surface.kind === 'impact-sparks' || phase.includes('spark') || phase.includes('shard')) return 'impact-burst'
  if (surface.role === 'screen' || preset.implementationProfile === 'screen-overlay') return 'screen-fall'
  if (surface.role === 'trail' || preset.implementationProfile === 'trail-ribbon' || phase.includes('streak')) {
    return 'trail-stream'
  }
  if (
    surface.role === 'aura' ||
    preset.implementationProfile === 'ring-field' ||
    preset.controls.spawnShape === 'ring' ||
    phase.includes('ring') ||
    phase.includes('orbit')
  ) {
    return 'orbit-ring'
  }
  if (preset.implementationProfile === 'beam-column' || phase.includes('column') || phase.includes('beam')) {
    return 'column-rise'
  }
  if (surface.role === 'volume' || preset.implementationProfile === 'volume-cloud' || phase.includes('cloud')) {
    return 'drift-cloud'
  }
  if (preset.controls.spawnShape === 'cone' || preset.implementationProfile === 'directional-burst') {
    return 'cone-fountain'
  }
  return 'radial-burst'
}

export function parsePfxHexColor(hex: string | undefined): [number, number, number] {
  const value = (hex ?? '#ffffff').replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const parsed = Number.parseInt(full.slice(0, 6), 16)
  if (!Number.isFinite(parsed)) return [1, 1, 1]
  return [((parsed >> 16) & 0xff) / 255, ((parsed >> 8) & 0xff) / 255, (parsed & 0xff) / 255]
}

let sharedSpriteAtlasTexture: THREE.Texture | undefined

export function getPfxSharedSpriteAtlasTexture(): THREE.Texture {
  if (sharedSpriteAtlasTexture) return sharedSpriteAtlasTexture
  const texture = new THREE.TextureLoader().load(PFX_SPRITE_ATLAS_DATA_URI)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  sharedSpriteAtlasTexture = texture
  return texture
}

let sharedFlameFlipbookTexture: THREE.Texture | undefined

export function getPfxSharedFlameFlipbookTexture(): THREE.Texture {
  if (sharedFlameFlipbookTexture) return sharedFlameFlipbookTexture
  const texture = new THREE.TextureLoader().load(PFX_FLAME_FLIPBOOK_ATLAS.dataUri)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.userData = {
    pfxFlipbookAtlas: PFX_FLAME_FLIPBOOK_ATLAS.id,
    pfxFlipbookLicense: PFX_FLAME_FLIPBOOK_ATLAS.license,
    pfxFlipbookFrames: PFX_FLAME_FLIPBOOK_ATLAS.frameCount,
  }
  sharedFlameFlipbookTexture = texture
  return texture
}

let sharedFireballFlipbookTexture: THREE.Texture | undefined

export function getPfxSharedFireballFlipbookTexture(): THREE.Texture {
  if (sharedFireballFlipbookTexture) return sharedFireballFlipbookTexture
  const texture = new THREE.TextureLoader().load(PFX_FIREBALL_FLIPBOOK_ATLAS.dataUri)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.userData = {
    pfxFlipbookAtlas: PFX_FIREBALL_FLIPBOOK_ATLAS.id,
    pfxFlipbookLicense: PFX_FIREBALL_FLIPBOOK_ATLAS.license,
    pfxFlipbookFrames: PFX_FIREBALL_FLIPBOOK_ATLAS.frameCount,
  }
  sharedFireballFlipbookTexture = texture
  return texture
}

let sharedMuzzleFlashAtlasTexture: THREE.Texture | undefined

export function getPfxMuzzleFlashAtlasTexture(): THREE.Texture {
  if (sharedMuzzleFlashAtlasTexture) return sharedMuzzleFlashAtlasTexture
  const texture = new THREE.TextureLoader().load(PFX_MUZZLE_FLASH_ATLAS.dataUri)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  sharedMuzzleFlashAtlasTexture = texture
  return texture
}

export function getPfxParticleShapeProfile(motionKind: PfxParticleMotionKind): PfxParticleShapeProfile {
  switch (motionKind) {
    case 'impact-burst':
      // Sparks hold near-full alpha then snap out — a long dim tail leaves
      // corpse particles that read as dirt for most of the effect.
      return { sizeFrom: 1.15, sizeTo: 0.25, fadeIn: 0.03, fadeOut: 0.85, stretch: 1.6 }
    case 'meteor-impact':
      return { sizeFrom: 1.05, sizeTo: 0.3, fadeIn: 0.02, fadeOut: 0.82, stretch: 0.08 }
    case 'ground-scuff':
      return { sizeFrom: 0.82, sizeTo: 1.45, fadeIn: 0.05, fadeOut: 0.5, stretch: 0.18 }
    case 'shockwave-ground-burst':
      return { sizeFrom: 0.72, sizeTo: 1.7, fadeIn: 0.04, fadeOut: 0.54, stretch: 0.08 }
    case 'healing-spiral':
      return { sizeFrom: 0.65, sizeTo: 1.05, fadeIn: 0.1, fadeOut: 0.55, stretch: 0 }
    case 'healing-cross':
      return { sizeFrom: 0.9, sizeTo: 0.72, fadeIn: 0.06, fadeOut: 0.76, stretch: 0 }
    case 'shadow-claw':
      return { sizeFrom: 0.95, sizeTo: 0.34, fadeIn: 0.03, fadeOut: 0.82, stretch: 0.42 }
    case 'converge-center':
      return { sizeFrom: 0.55, sizeTo: 1.15, fadeIn: 0.06, fadeOut: 0.72, stretch: 1.2 }
    case 'spherical-converge':
      return { sizeFrom: 0.62, sizeTo: 0.34, fadeIn: 0.04, fadeOut: 0.82, stretch: 0.72 }
    case 'braided-converge':
      return { sizeFrom: 0.52, sizeTo: 0.28, fadeIn: 0.04, fadeOut: 0.84, stretch: 0.08 }
    case 'asymmetric-converge':
      return { sizeFrom: 0.9, sizeTo: 0.62, fadeIn: 0.04, fadeOut: 0.84, stretch: 0.65 }
    case 'portal-flow':
      return { sizeFrom: 0.72, sizeTo: 0.28, fadeIn: 0.08, fadeOut: 0.62, stretch: 0.35 }
    case 'trail-stream':
      return { sizeFrom: 1, sizeTo: 0.35, fadeIn: 0.06, fadeOut: 0.7, stretch: 1.1 }
    case 'beam-telegraph-flow':
      return { sizeFrom: 0.72, sizeTo: 1.08, fadeIn: 0.08, fadeOut: 0.78, stretch: 0 }
    case 'laser-spray-ricochet':
      return { sizeFrom: 0.88, sizeTo: 0.24, fadeIn: 0.02, fadeOut: 0.76, stretch: 1.25 }
    case 'drift-cloud':
      return { sizeFrom: 1.05, sizeTo: 2.1, fadeIn: 0.2, fadeOut: 0.45, stretch: 0 }
    case 'dust-loop':
      return { sizeFrom: 0.72, sizeTo: 1.45, fadeIn: 0.14, fadeOut: 0.82, stretch: 0.12 }
    case 'snow-gust':
      return { sizeFrom: 0.72, sizeTo: 1.05, fadeIn: 0.12, fadeOut: 0.62, stretch: 0.18 }
    case 'screen-fall':
      return { sizeFrom: 0.9, sizeTo: 0.75, fadeIn: 0.1, fadeOut: 0.75, stretch: 0 }
    case 'danger-pulse':
      return { sizeFrom: 0.55, sizeTo: 1.15, fadeIn: 0.08, fadeOut: 0.7, stretch: 0.15 }
    case 'column-rise':
      return { sizeFrom: 0.8, sizeTo: 1.1, fadeIn: 0.12, fadeOut: 0.5, stretch: 0.35 }
    case 'jump-launch':
      return { sizeFrom: 0.72, sizeTo: 0.42, fadeIn: 0.04, fadeOut: 0.7, stretch: 0.18 }
    case 'cone-fountain':
      return { sizeFrom: 1.05, sizeTo: 0.45, fadeIn: 0.08, fadeOut: 0.5, stretch: 0.25 }
    case 'orbit-ring':
    case 'ground-ring':
      return { sizeFrom: 0.85, sizeTo: 0.85, fadeIn: 0.16, fadeOut: 0.72, stretch: 0 }
    default:
      return { sizeFrom: 0.95, sizeTo: 0.55, fadeIn: 0.08, fadeOut: 0.55, stretch: 0 }
  }
}

export const PFX_BURST_CYCLE_MULTIPLIER = 1.65

export const PFX_SPRITE_PARTICLE_VERTEX = /* glsl */ `
attribute vec3 aSpawn;
attribute vec3 aDirection;
attribute float aSpeed;
attribute vec2 aLife;
attribute vec2 aRotation;
attribute vec2 aVariance;
attribute vec2 aWobble;
attribute vec2 aOrbit;

uniform float uTime;
uniform float uTiming;
uniform float uLifetime;
uniform float uGravity;
uniform float uTurbulence;
uniform float uSize;
uniform float uEmissionWindow;
uniform float uDelay;
uniform float uDrag;
uniform vec2 uSizeRange;
uniform float uSizeMid;
uniform vec2 uFadeWindow;
uniform float uStretch;
uniform float uAdditiveShrink;
uniform float uSnapEase;
uniform float uTurbulenceScale;
uniform float uSpawnLift;
uniform float uFlicker;
uniform float uFreshness;
uniform float uCycleScale;
uniform float uSpriteAspect;

varying vec2 vUv;
varying float vProgress;
varying float vBrightness;
varying float vFlicker;
varying float vVariant;
varying float vChargeEnvelope;

void main() {
  float progress;
  float age;
  // Per-cycle freshness: every burst repeat re-rolls this particle's scale,
  // initial rotation, and spin speed (deterministic in uTime, so scrubbing
  // and captures stay reproducible). 0 outside BURST; uFreshness gates it to
  // v2 recipes so frozen baselines repeat identically.
  float cycleFresh = 0.0;
  #ifdef BURST
    // One shared clock: every particle spawns inside the emission window at
    // the start of each cycle, lives its own duration, then the effect rests
    // until the cycle repeats. This is what makes bursts pop.
    float period = max(0.3, uLifetime) * ${PFX_BURST_CYCLE_MULTIPLIER};
    // The full cycle spans uCycleScale base periods so long-lived layers
    // (smoke, embers) complete instead of being hard-cut at the wrap. Beat
    // fractions stay in base-period units — masterCycle may exceed 1.
    float fullPeriod = period * max(1.0, uCycleScale);
    float masterCycle = mod(uTime * uTiming, fullPeriod) / period;
    float cycleIndex = floor(uTime * uTiming / fullPeriod);
    cycleFresh = fract(sin(cycleIndex * 91.317 + aLife.x * 47.13 + aRotation.x) * 43758.5453);
    float durationFraction = max(0.1, aLife.y * (1.0 - uEmissionWindow) * 0.85);
    float ageFraction = masterCycle - aLife.x - uDelay;
    float alive = step(0.0, ageFraction) * step(ageFraction, durationFraction);
    progress = clamp(ageFraction / durationFraction, 0.0, 1.0);
    age = ageFraction * period;
    if (alive < 0.5) {
      progress = 1.0;
    }
  #else
    float duration = max(0.2, uLifetime * aLife.y);
    float recyclePhase = uTime * uTiming / duration + aLife.x;
    progress = fract(recyclePhase);
    // Continuous emitters recycle each particle with its static attributes —
    // every splash replayed identically (user-caught on blood/acid gathers).
    // Re-roll size and roll per RECYCLE, same hash family as the burst path.
    cycleFresh = fract(sin(floor(recyclePhase) * 91.317 + aLife.x * 47.13 + aRotation.x) * 43758.5453);
    age = progress * duration;
  #endif
  float chargeEnvelope = 0.0;
  #ifdef MOTION_FLAME_CHARGE_GATHER
    float chargePeriod = max(0.3, uLifetime) * ${PFX_BURST_CYCLE_MULTIPLIER};
    float chargeCycle = mod(uTime * uTiming, chargePeriod) / chargePeriod;
    chargeEnvelope = smoothstep(0.0, 0.12, chargeCycle)
      * (1.0 - smoothstep(0.54, 0.72, chargeCycle));
  #endif
  #ifdef MOTION_BEAM_TELEGRAPH_FLOW
    float beamPeriod = max(0.3, uLifetime) * ${PFX_BURST_CYCLE_MULTIPLIER};
    float beamCycle = mod(uTime * uTiming, beamPeriod) / beamPeriod;
    chargeEnvelope = smoothstep(0.0, 0.3, beamCycle)
      * (1.0 - smoothstep(0.48, 0.78, beamCycle));
  #endif
  #ifdef MOTION_LASER_SPRAY_RICOCHET
    float laserSprayPeriod = max(0.3, uLifetime) * ${PFX_BURST_CYCLE_MULTIPLIER};
    float laserSprayCycle = mod(uTime * uTiming, laserSprayPeriod) / laserSprayPeriod;
    chargeEnvelope = smoothstep(0.08, 0.18, laserSprayCycle)
      * (1.0 - smoothstep(0.42, 0.62, laserSprayCycle));
  #endif
  vProgress = progress;
  vChargeEnvelope = chargeEnvelope;
  vBrightness = aVariance.y;
  // Stable per-particle atlas choice. It changes neither over lifetime nor
  // between cameras, so shape variation reads as authored volume rather than
  // texture swimming.
  vVariant = aLife.x;

  float wobbleT = uTime * uTiming * aWobble.y + aWobble.x;
  vec3 wobble = vec3(sin(wobbleT), cos(wobbleT * 0.83) * 0.7, sin(wobbleT * 0.6) * 0.3) * uTurbulence * uTurbulenceScale * 0.055;

  vec3 velocity = aDirection * aSpeed;
  vec3 worldOffset;
  #ifdef MOTION_HEALING_SPIRAL
    float angle = aOrbit.x + uTime * uTiming * (1.15 + uTurbulence * 0.3) + progress * 1.8;
    float radius = aOrbit.y * (0.82 + sin(wobbleT) * 0.12);
    worldOffset = vec3(cos(angle) * radius, aSpawn.y + progress * 1.55, sin(angle) * radius) + wobble * 0.45;
    velocity = vec3(-sin(angle) * radius, 0.85, cos(angle) * radius);
  #elif defined(MOTION_DANGER_PULSE)
    float dangerBeat = 0.88 + 0.12 * sin(uTime * uTiming * 6.2831853);
    worldOffset = aSpawn * dangerBeat + velocity * age + wobble * 0.18;
    velocity = normalize(-aSpawn) * aSpeed;
  #elif defined(MOTION_ORBIT)
    float angle = aOrbit.x + uTime * uTiming * (0.45 + uTurbulence * 0.35) + progress * 0.4;
    float radius = aOrbit.y * (1.0 + sin(wobbleT) * 0.05 * (1.0 + uTurbulence * 0.5));
    worldOffset = vec3(cos(angle) * radius, sin(angle) * radius, aSpawn.z) + wobble * 0.4;
    velocity = vec3(-sin(angle), cos(angle), 0.0) * radius * (0.45 + uTurbulence * 0.35);
  #elif defined(MOTION_GROUND_RING)
    float angle = aOrbit.x + uTime * uTiming * (0.45 + uTurbulence * 0.35);
    float radius = aOrbit.y * (1.0 + sin(wobbleT) * 0.04);
    worldOffset = vec3(cos(angle) * radius, aSpawn.y, sin(angle) * radius) + wobble * 0.2;
    velocity = vec3(-sin(angle), 0.0, cos(angle)) * radius * 0.4;
  #elif defined(MOTION_SHOCKWAVE_GROUND)
    // Keep every visible dust mote on the same expanding displacement front.
    // Individual life offsets still stagger visibility, but no longer reset
    // travel distance into a center-bound puff.
    float shockwavePeriod = max(0.3, uLifetime) * ${PFX_BURST_CYCLE_MULTIPLIER};
    float shockwaveCycle = mod(uTime * uTiming, shockwavePeriod) / shockwavePeriod;
    float shockwaveRelease = clamp((shockwaveCycle - 0.025) / 0.3, 0.0, 1.0);
    float shockwaveAge = shockwaveRelease * 0.72;
    float shockwaveTravel = uDrag > 0.001
      ? (1.0 - exp(-uDrag * shockwaveAge)) / uDrag
      : shockwaveAge;
    worldOffset = aSpawn
      + velocity * shockwaveTravel
      + vec3(0.0, -abs(uGravity) * shockwaveAge * shockwaveAge * 0.5 + uSpawnLift, 0.0)
      + vec3(wobble.x, 0.0, wobble.z) * 0.2;
    worldOffset.y = max(0.0, worldOffset.y);
  #elif defined(MOTION_DUST_LOOP)
    // Each staggered particle rolls along the same lateral wind axis while
    // a small phase-offset eddy gives the bank height variation. The regular
    // life fade hides recycling, yielding a continuous loop with no burst
    // restart and no camera-facing center card.
    float dustTravel = uDrag > 0.001
      ? (1.0 - exp(-uDrag * age)) / uDrag
      : age;
    float dustEddy = sin(
      aSpawn.x * 2.7
      + aSpawn.z * 3.1
      + uTime * uTiming * (1.4 + aWobble.y * 0.15)
      + aWobble.x
    );
    worldOffset = aSpawn
      + velocity * dustTravel
      + vec3(wobble.x * 0.34, dustEddy * 0.045 + wobble.y * 0.12, wobble.z * 0.28);
    worldOffset.y = max(0.0, worldOffset.y);
  #elif defined(MOTION_HELIX_TRAIL)
    // Twin-strand fire helix: each lick is born ON the head's equator and
    // unwinds backward around the travel axis while the whole braid spins.
    // Twist rate bounds bead spacing: consecutive licks sit 1/COUNT apart in
    // phase, so arc-gap = radius * twist / count — too much twist and the
    // strand separates into beads no sprite size can bridge.
    float hAngle = aOrbit.x + uTime * uTiming * 1.5 + progress * 2.9;
    // Strands CONVERGE: radius collapses toward the travel axis down the
    // tail so the twin tendrils taper together into a point.
    float hRadius = aOrbit.y * (1.0 - progress * 0.82);
    worldOffset = vec3(aSpawn.x - aSpeed * progress, cos(hAngle) * hRadius, sin(hAngle) * hRadius) + wobble * 0.35;
    velocity = vec3(-aSpeed * 0.5, -sin(hAngle) * hRadius * 2.8, cos(hAngle) * hRadius * 2.8);
  #elif defined(MOTION_FLAME_CHARGE_GATHER)
    // Three authored 3D lanes contract together instead of recycling as
    // unrelated fire blobs. The outer cage remains visible at onset, then
    // tightens rapidly into the ember orb as its heat rises.
    worldOffset = aSpawn * (1.0 - chargeEnvelope * 0.25) + wobble * 0.12;
    velocity = -normalize(aSpawn) * aSpeed;
  #elif defined(MOTION_BEAM_TELEGRAPH_FLOW)
    float beamMin = -1.55;
    float beamSpan = 3.1;
    float flowingBeamX = beamMin + mod((aSpawn.x - beamMin) - uTime * uTiming * max(0.04, aSpeed) + beamSpan * 32.0, beamSpan);
    float contractedBeamX = mix(-1.42, flowingBeamX, chargeEnvelope);
    float beamProgress = (contractedBeamX - beamMin) / beamSpan;
    float currentWave = sin(contractedBeamX * 5.2 - uTime * uTiming * 8.0 + aWobble.x);
    worldOffset = vec3(
      contractedBeamX,
      aSpawn.y * chargeEnvelope + currentWave * 0.28 * chargeEnvelope,
      (aSpawn.z * (0.42 + beamProgress * 0.58) + cos(currentWave + aWobble.x) * 0.018) * chargeEnvelope
    );
    velocity = vec3(-max(0.04, aSpeed), currentWave * 0.08, 0.0);
  #elif defined(MOTION_LASER_SPRAY_RICOCHET)
    worldOffset = aSpawn;
    velocity = aDirection * aSpeed;
  #else
    vec3 gravityDrop = vec3(0.0, uGravity * age * age * 0.5, 0.0);
    // Exponential drag: displacement approaches speed/drag, so sparks leap
    // then stop instead of coasting forever.
    float travel = uDrag > 0.001 ? (1.0 - exp(-uDrag * age)) / uDrag : age;
    worldOffset = aSpawn + vec3(0.0, uSpawnLift, 0.0) + velocity * travel + gravityDrop + wobble;
    velocity = velocity * exp(-uDrag * age) + vec3(0.0, uGravity * age, 0.0);
  #endif

  // Cooling flicker: deterministic per-particle brightness pulse that
  // deepens over life — dying embers gutter before they go out.
  // max(0): over-driven flicker (>1) blinks fully off, never negative color.
  vFlicker = uFlicker > 0.001
    ? max(0.0, 1.0 - uFlicker * (0.3 + progress * 0.7) * (0.5 + 0.5 * sin(uTime * uTiming * (9.0 + aWobble.y * 4.0) + aWobble.x * 17.0)))
    : 1.0;

  // Snap easing: fast-in/slow-out — the burst reaches its pose immediately
  // and spends its life settling, instead of a dead linear ramp.
  float sizeT = uSnapEase > 0.5 ? 1.0 - pow(1.0 - progress, 2.4) : progress;
  float sizeLife = sizeT < 0.5
    ? mix(uSizeRange.x, uSizeMid, sizeT * 2.0)
    : mix(uSizeMid, uSizeRange.y, sizeT * 2.0 - 1.0);
  #ifdef MOTION_BEAM_TELEGRAPH_FLOW
    sizeLife *= mix(0.28, 1.0, chargeEnvelope);
  #endif
  #ifdef MOTION_LASER_SPRAY_RICOCHET
    sizeLife *= mix(0.04, 1.0, chargeEnvelope);
  #endif
  // Fade-in growth for everyone; fade-OUT shrink for ADDITIVE only.
  // Additive alpha fades inevitably transit dim-mustard pixels over a dark
  // scene — the only artifact-free additive death is shrink-to-zero while
  // bright. Alpha-blend keeps full-size fades (shrink-to-dark was the
  // round-4 smoke bug).
  float shrink = mix(1.0, 1.0 - smoothstep(min(uFadeWindow.y, 0.98) - 0.12, 1.0, progress), uAdditiveShrink);
  // Kill at 40% scale: shrinking to zero lets the gaussian texture's sampled
  // peak collapse, so the texture dims the particle the alpha no longer does.
  if (uAdditiveShrink > 0.5 && shrink < 0.42) shrink = 0.0;
  float appear = smoothstep(0.0, uFadeWindow.x, progress) * shrink;
  #ifdef MOTION_FLAME_CHARGE_GATHER
    appear = max(appear, 0.72) * mix(0.68, 1.08, chargeEnvelope);
  #endif
  // Sprites billboard in world space, so inherit the model's uniform scale
  // (gallery tiles wrap effects in scaled groups).
  float modelScale = length(modelMatrix[0].xyz);
  // Freshness: ±22% scale re-roll per burst cycle.
  float freshScale = 1.0 + (cycleFresh - 0.5) * 0.44 * uFreshness;
  float dustSizeAppear = appear;
  #ifdef MOTION_DUST_LOOP
    // Continuous dust recycles by opacity, not by visibly growing from pin
    // dots. Keeping its card footprint broad lets new puffs emerge inside the
    // bank instead of reading as detached grit around the silhouette.
    dustSizeAppear = mix(0.72, 1.0, appear);
  #endif
  float size = uSize * aVariance.x * freshScale * sizeLife * dustSizeAppear * modelScale;

  vec3 instancePosition = (modelMatrix * vec4(worldOffset, 1.0)).xyz;
  // Freshness: new initial rotation and ±40% spin-speed re-roll per cycle.
  // Axis-locked layers (spinScale 0 => both rotation attributes zero, e.g.
  // the muzzle flash card) must stay locked — no fresh roll.
  float rollLocked = step(abs(aRotation.x) + abs(aRotation.y), 0.0001);
  float freshSpinPhase = cycleFresh * 6.2831853 * (1.0 - rollLocked) * uFreshness;
  float freshSpinRate = 1.0 + (fract(cycleFresh * 7.13) - 0.5) * 0.8 * uFreshness;
  float spin = aRotation.x + freshSpinPhase + aRotation.y * freshSpinRate * age;
  mat2 spinMatrix = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
  vec2 localPosition = spinMatrix * position.xy;

  vec3 up;
  vec3 right;
  vec3 eye = normalize(cameraPosition - instancePosition);
  if (uStretch > 0.001) {
    // Stalled streaks keep their emission axis — the billboard fallback
    // applied a random static roll, rendering scribble blades (rounds 8-9).
    vec3 alignAxis = length(velocity) > 0.05 ? velocity : aDirection;
    vec3 worldVelocity = normalize(mat3(modelMatrix) * alignAxis);
    // Stretch magnitude decays with LAUNCH speed only — gravity re-growing
    // |v| re-stretched dying sparks into parallel falling bars.
    float launchSpeed = aSpeed * exp(-max(uDrag, 0.35) * age);
    vec3 projected = worldVelocity - dot(worldVelocity, eye) * eye;
    up = length(projected) > 0.001 ? normalize(projected) : worldVelocity;
    right = normalize(cross(up, eye));
    localPosition = position.xy;
    // Clamp stretched WORLD length: multiplier-only clamps let large quads
    // smear into 300px out-of-focus flare bars (rounds 8-9).
    float stretchFactor = 1.0 + min(launchSpeed * uStretch, 2.6);
    localPosition.y *= min(stretchFactor, 0.55 / max(size, 0.001));
  } else {
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    right = normalize(cross(worldUp, eye));
    up = cross(eye, right);
  }
  localPosition.x *= uSpriteAspect;

  vec3 vertexWorld = instancePosition + (right * localPosition.x + up * localPosition.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(vertexWorld, 1.0);
  #ifdef MOTION_DANGER_PULSE
    float dangerSeedScale = fract(vVariant * 19.37 + 0.21);
    vec2 dangerScale = vec2(mix(0.72, 1.3, dangerSeedScale), mix(0.78, 1.58, fract(dangerSeedScale * 4.17)));
    gl_Position = vec4(worldOffset.xy + localPosition * size * 0.17 * dangerScale, 0.0, 1.0);
  #endif
  vUv = uv;
  // Mirror half the particles — one fixed lobe layout read as the same
  // trefoil silhouette on every smoke puff.
  if (fract(aRotation.x * 2.39996) > 0.5) vUv.x = 1.0 - vUv.x;
}
`

function makeParticleTexture(kind: PfxControls['texture']): THREE.Texture {
  const atlas = getPfxSharedParticleAtlasTexture()
  const slice = getPfxTextureAtlasSlice(kind)
  const atlasUvInset: readonly [number, number] = [0.5 / PFX_TEXTURE_ATLAS.width, 0.5 / PFX_TEXTURE_ATLAS.height]
  const texture = atlas.clone()
  texture.image = atlas.image
  // Sample from texel centers, not tile borders. Linear filtering at an exact
  // atlas boundary blends the neighboring sprite into a screen-fixed seam on
  // large glow cards (visible across core-sphere effects).
  texture.offset.set(slice.uvOffset[0] + atlasUvInset[0], slice.uvOffset[1] + atlasUvInset[1])
  texture.repeat.set(slice.uvScale[0] - atlasUvInset[0] * 2, slice.uvScale[1] - atlasUvInset[1] * 2)
  texture.needsUpdate = true
  texture.userData = {
    atlasId: slice.atlasId,
    atlasKind: kind,
    atlasPixelRect: slice.pixelRect,
    atlasUvInset,
  }
  return texture
}

function getPfxSharedParticleAtlasTexture(): THREE.DataTexture {
  if (sharedParticleAtlasTexture) return sharedParticleAtlasTexture
  const atlas = PFX_TEXTURE_ATLAS
  const data = new Uint8Array(atlas.width * atlas.height * 4)

  for (const kind of PFX_TEXTURE_KINDS) {
    const slice = atlas.slices[kind]
    for (let tileY = 0; tileY < slice.pixelRect.height; tileY++) {
      for (let tileX = 0; tileX < slice.pixelRect.width; tileX++) {
        const x = slice.pixelRect.x + tileX
        const y = slice.pixelRect.y + tileY
        const index = (y * atlas.width + x) * 4
        const alpha = particleAlphaForKind(kind, tileX, tileY, atlas.tileSize)
        data[index] = 255
        data[index + 1] = 255
        data[index + 2] = 255
        data[index + 3] = Math.round(alpha * 255)
      }
    }
  }

  sharedParticleAtlasTexture = new THREE.DataTexture(data, atlas.width, atlas.height, THREE.RGBAFormat)
  sharedParticleAtlasTexture.needsUpdate = true
  sharedParticleAtlasTexture.magFilter = THREE.LinearFilter
  sharedParticleAtlasTexture.minFilter = THREE.LinearFilter
  sharedParticleAtlasTexture.generateMipmaps = false
  sharedParticleAtlasTexture.colorSpace = THREE.SRGBColorSpace
  sharedParticleAtlasTexture.userData = {
    atlasId: atlas.id,
    atlasTileSize: atlas.tileSize,
    atlasKinds: [...PFX_TEXTURE_KINDS],
  }
  return sharedParticleAtlasTexture
}

function particleAlphaForKind(kind: PfxControls['texture'], x: number, y: number, size: number): number {
  const center = (size - 1) / 2
  const dx = (x - center) / center
  const dy = (y - center) / center
  const d = Math.sqrt(dx * dx + dy * dy)
  let alpha = Math.max(0, 1 - d)
  if (kind === 'spark') alpha = Math.max(alpha, Math.max(0, 1 - Math.abs(dx) * 6), Math.max(0, 1 - Math.abs(dy) * 6))
  if (kind === 'streak') alpha = Math.max(0, 1 - Math.abs(dy) * 8) * Math.max(0, 1 - Math.abs(dx) * 0.8)
  if (kind === 'ring') alpha = Math.max(0, 1 - Math.abs(d - 0.55) * 8)
  if (kind === 'square') alpha = Math.max(0, 1 - Math.max(Math.abs(dx), Math.abs(dy)) * 1.25)
  if (kind === 'bubble') alpha = Math.max(0, 1 - Math.abs(d - 0.62) * 6) * 0.8
  return alpha
}

export function withoutSeed(overrides: PfxPresetOverrides): Omit<PfxPresetOverrides, 'seed'> {
  const { seed: _seed, ...rest } = overrides
  return rest
}

export function overlaps<T>(needles: readonly T[], haystack: readonly T[]): boolean {
  return needles.some((needle) => haystack.includes(needle))
}

export function sanitizeComponentName(value: string): string {
  const name = value.replace(/[^A-Za-z0-9_]/g, '')
  if (!/^[A-Z]/.test(name)) return `Game${name}`
  return name
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function normalizeThumbnailColors(colors: string[]): [string, string, string] {
  return [colors[0] ?? '#f8fafc', colors[1] ?? colors[0] ?? '#60a5fa', colors[2] ?? colors[1] ?? '#22d3ee']
}

export function clipMotionPath(motion: PfxPreviewDescriptor['clip']['motion']): string {
  if (motion === 'rise') return 'M0,18 C8,4 14,-9 20,-24'
  if (motion === 'burst') return 'M0,0 C14,-13 24,8 38,-16'
  if (motion === 'orbit') return 'M0,0 C18,-18 38,-18 56,0 C38,18 18,18 0,0'
  if (motion === 'drift') return 'M-24,6 C-4,-10 20,16 38,-8'
  if (motion === 'streak') return 'M-42,0 C-18,-6 18,6 48,0'
  return 'M-10,0 C-4,-8 4,8 10,0'
}

export function roundSvg(value: number): string {
  return (Math.round(value * 10) / 10).toString()
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function seededRandom(seedValue: number): () => number {
  // mulberry32: consecutive LCG draws lie on lattice lines (the classic
  // spectral flaw), which banded spawn-position pairs onto one diagonal.
  let state = (seedValue >>> 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
