import type { ArtStyleCluster, PerformanceTier, PfxBehaviorRole, PfxControlDefinition, PfxControls, PfxMobileRuntimePolicy, PfxPerformanceBudget, PfxStyleRenderProfile, PfxTextureAtlasDescriptor, PfxTextureAtlasSlice, PfxTextureKind, StyleVariantProfile } from '../types/01'
import type { PfxAuthoredRecipe, PfxComboRingMultiplier, PfxRenderSurface } from '../types/02'

export const ART_STYLE_CLUSTERS = [
  'realistic',
  'stylized',
  'anime',
  'pixel-retro',
  'cozy',
  'sci-fi',
  'magical',
  'horror',
  'tactical',
  'arcade',
  'low-poly',
  'painterly',
  'neon',
  'toon',
  'fantasy',
  'elemental',
  'abstract',
] as const

export const EFFECT_TYPE_FILTERS = [
  'fire',
  'explosion',
  'smoke',
  'projectile',
  'weapon',
  'impact',
  'aura',
  'trail',
  'loot',
  'shield',
  'status',
  'telegraph',
  'spawn',
  'dissolve',
  'portal',
  'water',
  'weather',
  'ui',
  'environment',
  'magic',
  'sci-fi',
  'horror',
  'tactical',
  'movement',
  'elemental',
  'abstract',
] as const

export const PFX_TEXTURE_KINDS: PfxTextureKind[] = ['soft-disc', 'spark', 'streak', 'ring', 'square', 'bubble']

export const PFX_MARKET_SOURCE_REFERENCES = {
  'unreal-niagara': 'https://dev.epicgames.com/community/learning/paths/mZ/unreal-engine-niagara-fluids',
  'unity-vfx-graph': 'https://docs.unity3d.com/Packages/com.unity.visualeffectgraph%4012.0/manual/index.html',
  'unity-asset-store-vfx': 'https://assetstore.unity.com/vfx',
  'unity-fire-spell-effects': 'https://assetstore.unity.com/packages/vfx/particles/fire-explosions/fire-spell-effects-36825',
  'embergen': 'https://jangafx.com/software/embergen',
  'popcornfx': 'https://www.popcornfx.com/editor/',
  'three-nebula': 'https://three-nebula.org/',
  'three-quarks-r3f': 'https://quarks.art/runtime/tutorials/reactthreefiber',
  'drei-r3f': 'https://drei.docs.pmnd.rs/abstractions/trail',
  'realtimevfx-stylized': 'https://realtimevfx.com/t/stylized-vfx-unity-pack/28445',
  'wawa-vfx-r3f': 'https://wawasensei.dev/blog/wawa-vfx-open-source-particle-system-for-react-three-fiber-projects',
} as const

function buildTextureAtlasDescriptor(): PfxTextureAtlasDescriptor {
  const tileSize = 32
  const columns = 3
  const rows = Math.ceil(PFX_TEXTURE_KINDS.length / columns)
  const atlasId = 'pfx-procedural-texture-atlas-v1'
  const slices = Object.fromEntries(
    PFX_TEXTURE_KINDS.map((kind, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      return [
        kind,
        {
          atlasId,
          kind,
          uvOffset: [column / columns, row / rows] as [number, number],
          uvScale: [1 / columns, 1 / rows] as [number, number],
          pixelRect: {
            x: column * tileSize,
            y: row * tileSize,
            width: tileSize,
            height: tileSize,
          },
        },
      ]
    }),
  ) as Record<PfxTextureKind, PfxTextureAtlasSlice>

  return {
    id: atlasId,
    tileSize,
    columns,
    rows,
    width: columns * tileSize,
    height: rows * tileSize,
    slices,
  }
}

export const PFX_TEXTURE_ATLAS: PfxTextureAtlasDescriptor = buildTextureAtlasDescriptor()

export function getPfxTextureAtlasSlice(kind: PfxTextureKind): PfxTextureAtlasSlice {
  return PFX_TEXTURE_ATLAS.slices[kind]
}

export const PFX_QUALITY_RUBRIC_KEYS = [
  'gameReadiness',
  'visualProductionQuality',
  'mobilePerformance',
  'r3fIntegrationQuality',
  'customizationRange',
  'artStyleFidelity',
  'catalogCoverage',
  'documentationQuality',
  'exportCleanliness',
  'redTeamApproval',
] as const

export const STYLE_VARIANTS: Record<ArtStyleCluster, StyleVariantProfile> = {
  realistic: { palette: ['#f97316', '#a3a3a3', '#fef3c7'], texture: 'soft-disc', blendMode: 'alpha', emissiveMultiplier: 0.75, turbulenceMultiplier: 0.7, densityMultiplier: 0.9 },
  stylized: { palette: ['#fb923c', '#fde047', '#f8fafc'], texture: 'spark', blendMode: 'additive', emissiveMultiplier: 1.05, turbulenceMultiplier: 1, densityMultiplier: 1 },
  anime: { palette: ['#f8fafc', '#60a5fa', '#f472b6'], texture: 'streak', blendMode: 'additive', emissiveMultiplier: 1.25, turbulenceMultiplier: 0.85, densityMultiplier: 0.85 },
  'pixel-retro': { palette: ['#facc15', '#22c55e', '#7c3aed'], texture: 'square', blendMode: 'alpha', emissiveMultiplier: 0.85, turbulenceMultiplier: 0.45, densityMultiplier: 0.65 },
  cozy: { palette: ['#fbbf24', '#fb7185', '#86efac'], texture: 'bubble', blendMode: 'screen', emissiveMultiplier: 0.85, turbulenceMultiplier: 0.6, densityMultiplier: 0.75 },
  'sci-fi': { palette: ['#22d3ee', '#60a5fa', '#f8fafc'], texture: 'ring', blendMode: 'additive', emissiveMultiplier: 1.35, turbulenceMultiplier: 0.75, densityMultiplier: 0.9 },
  magical: { palette: ['#a78bfa', '#22d3ee', '#f0abfc'], texture: 'spark', blendMode: 'additive', emissiveMultiplier: 1.3, turbulenceMultiplier: 1.25, densityMultiplier: 1.05 },
  horror: { palette: ['#7f1d1d', '#581c87', '#111827'], texture: 'soft-disc', blendMode: 'multiply', emissiveMultiplier: 0.55, turbulenceMultiplier: 1.6, densityMultiplier: 0.95 },
  tactical: { palette: ['#ef4444', '#f97316', '#f8fafc'], texture: 'ring', blendMode: 'alpha', emissiveMultiplier: 0.9, turbulenceMultiplier: 0.4, densityMultiplier: 0.7 },
  arcade: { palette: ['#facc15', '#22d3ee', '#f472b6'], texture: 'spark', blendMode: 'additive', emissiveMultiplier: 1.2, turbulenceMultiplier: 0.95, densityMultiplier: 0.95 },
  'low-poly': { palette: ['#84cc16', '#38bdf8', '#f97316'], texture: 'square', blendMode: 'alpha', emissiveMultiplier: 0.7, turbulenceMultiplier: 0.5, densityMultiplier: 0.7 },
  painterly: { palette: ['#f59e0b', '#8b5cf6', '#0f766e'], texture: 'soft-disc', blendMode: 'screen', emissiveMultiplier: 0.8, turbulenceMultiplier: 1.35, densityMultiplier: 0.9 },
  neon: { palette: ['#22d3ee', '#f472b6', '#a3e635'], texture: 'streak', blendMode: 'additive', emissiveMultiplier: 1.45, turbulenceMultiplier: 0.8, densityMultiplier: 0.9 },
  toon: { palette: ['#fef08a', '#38bdf8', '#fb7185'], texture: 'bubble', blendMode: 'screen', emissiveMultiplier: 1, turbulenceMultiplier: 0.75, densityMultiplier: 0.85 },
  fantasy: { palette: ['#a78bfa', '#fbbf24', '#22c55e'], texture: 'spark', blendMode: 'additive', emissiveMultiplier: 1.15, turbulenceMultiplier: 1.1, densityMultiplier: 1 },
  elemental: { palette: ['#f97316', '#60a5fa', '#4ade80'], texture: 'soft-disc', blendMode: 'additive', emissiveMultiplier: 1.1, turbulenceMultiplier: 1.2, densityMultiplier: 1 },
  abstract: { palette: ['#f8fafc', '#a78bfa', '#22d3ee'], texture: 'ring', blendMode: 'screen', emissiveMultiplier: 1, turbulenceMultiplier: 1.45, densityMultiplier: 0.8 },
}

const STYLE_RENDER_PROFILES: Record<ArtStyleCluster, Omit<PfxStyleRenderProfile, 'style' | 'signature'>> = {
  realistic: { silhouette: 'natural-plume', materialTreatment: 'subtle-alpha', motionTreatment: 'physical-drift', particleShape: 'soft', geometrySegments: 24, opacityMultiplier: 0.88, particleSizeMultiplier: 0.92, motionMultiplier: 0.86, edgeHardness: 0.18 },
  stylized: { silhouette: 'chunky-symbolic', materialTreatment: 'bold-cel', motionTreatment: 'snappy-pop', particleShape: 'spark', geometrySegments: 18, opacityMultiplier: 1.04, particleSizeMultiplier: 1.08, motionMultiplier: 1.08, edgeHardness: 0.54 },
  anime: { silhouette: 'speed-line', materialTreatment: 'high-key-streak', motionTreatment: 'anime-smear', particleShape: 'streak', geometrySegments: 20, opacityMultiplier: 1.12, particleSizeMultiplier: 0.94, motionMultiplier: 1.18, edgeHardness: 0.62 },
  'pixel-retro': { silhouette: 'blocky-pixel', materialTreatment: 'crisp-indexed', motionTreatment: 'stepped-flicker', particleShape: 'square', geometrySegments: 8, opacityMultiplier: 0.95, particleSizeMultiplier: 1.18, motionMultiplier: 0.72, edgeHardness: 0.92 },
  cozy: { silhouette: 'rounded-soft', materialTreatment: 'warm-screen', motionTreatment: 'gentle-float', particleShape: 'bubble', geometrySegments: 18, opacityMultiplier: 0.92, particleSizeMultiplier: 1.12, motionMultiplier: 0.78, edgeHardness: 0.22 },
  'sci-fi': { silhouette: 'precision-rings', materialTreatment: 'holographic-add', motionTreatment: 'scanline-sweep', particleShape: 'ring', geometrySegments: 32, opacityMultiplier: 1.06, particleSizeMultiplier: 0.88, motionMultiplier: 1.04, edgeHardness: 0.78 },
  magical: { silhouette: 'arcane-orbit', materialTreatment: 'arcane-add', motionTreatment: 'orbital-magic', particleShape: 'spark', geometrySegments: 28, opacityMultiplier: 1.08, particleSizeMultiplier: 1.02, motionMultiplier: 1.14, edgeHardness: 0.48 },
  horror: { silhouette: 'ragged-shadow', materialTreatment: 'shadow-multiply', motionTreatment: 'uneasy-crawl', particleShape: 'soft', geometrySegments: 14, opacityMultiplier: 0.74, particleSizeMultiplier: 1.2, motionMultiplier: 0.9, edgeHardness: 0.66 },
  tactical: { silhouette: 'targeting-reticle', materialTreatment: 'matte-tactical', motionTreatment: 'tight-pulse', particleShape: 'ring', geometrySegments: 24, opacityMultiplier: 0.9, particleSizeMultiplier: 0.82, motionMultiplier: 0.82, edgeHardness: 0.84 },
  arcade: { silhouette: 'pop-burst', materialTreatment: 'arcade-glow', motionTreatment: 'bouncy-arcade', particleShape: 'spark', geometrySegments: 16, opacityMultiplier: 1.12, particleSizeMultiplier: 1.14, motionMultiplier: 1.18, edgeHardness: 0.58 },
  'low-poly': { silhouette: 'faceted-lowpoly', materialTreatment: 'flat-faceted', motionTreatment: 'angular-step', particleShape: 'square', geometrySegments: 10, opacityMultiplier: 0.9, particleSizeMultiplier: 1.06, motionMultiplier: 0.78, edgeHardness: 0.86 },
  painterly: { silhouette: 'brush-stroke', materialTreatment: 'pigment-screen', motionTreatment: 'brush-wobble', particleShape: 'soft', geometrySegments: 16, opacityMultiplier: 0.86, particleSizeMultiplier: 1.24, motionMultiplier: 0.92, edgeHardness: 0.28 },
  neon: { silhouette: 'tube-glow', materialTreatment: 'neon-bloom', motionTreatment: 'electric-pulse', particleShape: 'streak', geometrySegments: 30, opacityMultiplier: 1.18, particleSizeMultiplier: 0.9, motionMultiplier: 1.2, edgeHardness: 0.72 },
  toon: { silhouette: 'ink-outline', materialTreatment: 'outlined-toon', motionTreatment: 'squash-pop', particleShape: 'bubble', geometrySegments: 14, opacityMultiplier: 1.02, particleSizeMultiplier: 1.1, motionMultiplier: 1.02, edgeHardness: 0.82 },
  fantasy: { silhouette: 'crest-rune', materialTreatment: 'enchanted-gold', motionTreatment: 'rune-breathe', particleShape: 'spark', geometrySegments: 26, opacityMultiplier: 1.02, particleSizeMultiplier: 1.02, motionMultiplier: 1, edgeHardness: 0.5 },
  elemental: { silhouette: 'elemental-swarm', materialTreatment: 'elemental-glow', motionTreatment: 'element-cycle', particleShape: 'soft', geometrySegments: 22, opacityMultiplier: 1.04, particleSizeMultiplier: 1.04, motionMultiplier: 1.1, edgeHardness: 0.46 },
  abstract: { silhouette: 'procedural-glyph', materialTreatment: 'prismatic-screen', motionTreatment: 'chaos-morph', particleShape: 'ring', geometrySegments: 12, opacityMultiplier: 0.96, particleSizeMultiplier: 1.16, motionMultiplier: 1.16, edgeHardness: 0.7 },
}

export function getPfxStyleRenderProfile(style: ArtStyleCluster): PfxStyleRenderProfile {
  const profile = STYLE_RENDER_PROFILES[style]
  return {
    style,
    ...profile,
    signature: createStyleProfileSignature(style, profile),
  }
}

export function getPfxStyleRenderSignature(
  controls: Pick<PfxControls, 'style' | 'texture' | 'blendMode' | 'density' | 'turbulence' | 'emissiveBloom'>,
): string {
  const profile = getPfxStyleRenderProfile(controls.style)
  return [
    profile.signature,
    `texture:${controls.texture}`,
    `blend:${controls.blendMode}`,
    `density:${bucketMetric(controls.density)}`,
    `turbulence:${bucketMetric(controls.turbulence)}`,
    `emissive:${bucketMetric(controls.emissiveBloom)}`,
  ].join('|')
}

function createStyleProfileSignature(
  style: ArtStyleCluster,
  profile: Omit<PfxStyleRenderProfile, 'style' | 'signature'>,
): string {
  return [
    `style:${style}`,
    `silhouette:${profile.silhouette}`,
    `material:${profile.materialTreatment}`,
    `motion:${profile.motionTreatment}`,
    `shape:${profile.particleShape}`,
    `segments:${profile.geometrySegments}`,
    `edge:${bucketMetric(profile.edgeHardness)}`,
    `size:${bucketMetric(profile.particleSizeMultiplier)}`,
  ].join('|')
}

function bucketMetric(value: number): string {
  return String(Math.round(value * 100))
}

export const PFX_BEHAVIOR_ROLE_REVIEW_ORDER: PfxBehaviorRole[] = [
  'projectile',
  'burst',
  'impact',
  'charge',
  'release',
  'telegraph',
  'beam',
  'trail',
  'spawn',
  'despawn',
  'reward',
  'loop',
  'screen',
]

export const PFX_TAXONOMY_REVIEW_CRITERIA = [
  'source-observed-need',
  'rank-justified',
  'family-balanced',
  'variant-compatible',
  'production-critical-coverage',
  'not-duplicate',
  'market-source-linked',
] as const

export const PFX_PRODUCTION_IMPLEMENTATION_CRITERIA = [
  'drop-in-r3f-component',
  'authored-render-recipe',
  'all-controls-safe',
  'mobile-budget-declared',
  'preview-asset-exported',
  'documentation-export-clean',
] as const

export const PFX_PRODUCTION_IMPLEMENTATION_CANDIDATE_PREREQUISITES = [
  'drop-in-r3f-component',
  'authored-render-recipe',
  'all-controls-safe',
  'mobile-budget-declared',
  'preview-asset-exported',
  'documentation-export-clean',
  'render-plan-depth',
] as const

export const PFX_RED_TEAM_CRITERIA = [
  'taxonomy-comprehensive',
  'game-ready-not-decorative',
  'mobile-performance-proven',
  'style-clusters-distinct',
  'customization-safe',
  'export-clean',
  'documentation-sufficient',
] as const

export const PFX_CONTROL_DEFINITIONS: PfxControlDefinition[] = [
  { key: 'color', label: 'Color', kind: 'color-list' },
  { key: 'style', label: 'Style', kind: 'select', options: ART_STYLE_CLUSTERS },
  { key: 'scale', label: 'Scale', kind: 'range', min: 0.35, max: 3, step: 0.05 },
  { key: 'density', label: 'Density', kind: 'range', min: 0.05, max: 1, step: 0.05 },
  { key: 'timing', label: 'Timing', kind: 'range', min: 0.2, max: 2.4, step: 0.05 },
  { key: 'lifetime', label: 'Lifetime', kind: 'range', min: 0.15, max: 5, step: 0.05 },
  { key: 'velocity', label: 'Velocity', kind: 'range', min: 0, max: 2.5, step: 0.05 },
  { key: 'gravity', label: 'Gravity', kind: 'range', min: -1.5, max: 1.5, step: 0.05 },
  { key: 'turbulence', label: 'Turbulence', kind: 'range', min: 0, max: 2, step: 0.05 },
  { key: 'spawnShape', label: 'Spawn Shape', kind: 'select', options: ['point', 'cone', 'sphere', 'ring', 'box', 'line', 'mesh'] },
  { key: 'texture', label: 'Texture', kind: 'select', options: ['soft-disc', 'spark', 'streak', 'ring', 'square', 'bubble'] },
  { key: 'flipbook', label: 'Flipbook', kind: 'select', options: ['none', 'smoke-8', 'flame-8', 'magic-12', 'impact-6'] },
  { key: 'blendMode', label: 'Blend Mode', kind: 'select', options: ['additive', 'alpha', 'multiply', 'screen'] },
  { key: 'emissiveBloom', label: 'Emissive Bloom', kind: 'range', min: 0, max: 1.5, step: 0.05 },
  { key: 'trailLength', label: 'Trail Length', kind: 'range', min: 0, max: 3, step: 0.05 },
  { key: 'seed', label: 'Seed', kind: 'number', min: 1, max: 2147483647, step: 1 },
  { key: 'lod', label: 'LOD', kind: 'multi-select', options: ['low', 'medium', 'high'] },
]

export const PERFORMANCE_TIER_BUDGETS: Record<PerformanceTier, PfxPerformanceBudget> = {
  low: {
    maxParticles: 64,
    maxDrawCalls: 3,
    textureMemoryKb: 128,
    expectedFrameCostMs: 0.45,
    overdrawRisk: 'low',
  },
  medium: {
    maxParticles: 160,
    maxDrawCalls: 5,
    textureMemoryKb: 384,
    expectedFrameCostMs: 1.1,
    overdrawRisk: 'medium',
  },
  high: {
    maxParticles: 384,
    maxDrawCalls: 8,
    textureMemoryKb: 768,
    expectedFrameCostMs: 2.2,
    overdrawRisk: 'medium',
  },
  cinematic: {
    maxParticles: 768,
    maxDrawCalls: 12,
    textureMemoryKb: 1536,
    expectedFrameCostMs: 4.5,
    overdrawRisk: 'high',
  },
}

export const PFX_MOBILE_RUNTIME_POLICY: PfxMobileRuntimePolicy = {
  schema: 'game-bot.r3f-pfx-mobile-runtime-policy.v1',
  maxDevicePixelRatio: 1.5,
  canvasDprRange: [1, 1.5],
  webgl: {
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  },
  tierConcurrencyCaps: {
    low: 20,
    medium: 10,
    high: 4,
    cinematic: 1,
  },
  requiredOptimizations: [
    'capped-dpr',
    'deterministic-seeds',
    'lod-controls',
    'reduced-motion-fallback',
    'texture-atlas',
    'shared-geometry-cache',
    'profile-threshold-gate',
  ],
  finalAcceptanceRequiresRealDevices: true,
}

export function createPfxComboRingVariantRecipe(multiplier: PfxComboRingMultiplier): PfxAuthoredRecipe {
  return {
    ...authoredRecipe(
      'combo-ring',
      `${multiplier}x Combo ring`,
      `One-quad HUD-safe streak meter with an asymmetric confirmation notch, chained score ticks, and a held-to-decay ${multiplier}x glyph.`,
      [
        {
          kind: 'screen-plane',
          role: 'screen',
          opacity: 0.92,
          scale: 0.42,
          phase: 'combo-ring-streak-meter',
          tuning: {
            meshGeometry: 'screen-space-analytic-quad',
            meshShader: 'combo-ring-meter',
            lifecycle: 'combo-ring-confirm-hold-decay',
            blend: 'alpha',
            colorOverride: '#ffc928',
            comboMultiplier: multiplier,
            positionOffset: [0, 0.96, 0],
            turbulenceScale: 0,
          },
        },
      ],
      2,
      1.3,
    ),
    id: `combo-ring:authored-preview-${multiplier}x`,
  }
}

export function authoredRecipe(
  effectId: string,
  label: string,
  intent: string,
  surfaces: PfxRenderSurface[],
  feelVersion?: number,
  tempo?: number,
): PfxAuthoredRecipe {
  return {
    id: `${effectId}:authored-preview-v1`,
    effectId,
    label,
    intent,
    surfaces,
    ...(feelVersion !== undefined ? { feelVersion } : {}),
    ...(tempo !== undefined ? { tempo } : {}),
  }
}
