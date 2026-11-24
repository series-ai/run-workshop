import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import * as THREE from 'three'
import {
  AUTHORED_EFFECT_RECIPES,
  GamePfx,
  PFX_DEFAULT_ATLAS_REGISTRY,
  PFX_BUILTIN_ATLAS_IDS,
  PFX_MATERIAL_PATH_USERDATA_KEY,
  PFX_PRESETS,
  PfxMaterialProvider,
  PfxRecipeParseError,
  createGamePfxComponent,
  createPfxAtlasRegistry,
  createPfxPreset,
  createPfxSpriteEmissionMaterial,
  getPfxFlipbookFrameProps,
  getPfxLayerAnimationMode,
  getPfxRenderPlan,
  getPfxSurfaceMaterialProps,
  parsePfxAuthoredRecipe,
  parsePfxAuthoredRecipeJson,
  resolvePfxMaterialBinding,
  resolvePfxMaterialPath,
  updatePfxMaterialClock,
  usePfxMaterialContext,
  type PfxAtlasId,
  type PfxAtlasRegistry,
  type PfxAuthoredRecipe,
  type PfxControls,
  type PfxMaterialQuality,
  type PfxMaterialTuning,
  type PfxParticleEmission,
  type PfxRenderSurface,
} from '@pfx'
import { buildPfxSpriteEmissionGeometry } from '@pfx/constants/04'
import { describePfxMaterialBinding } from '@pfx/materials/bindings'
import { getPfxMaterialMapStats } from '@pfx/materials/maps'
import { PfxById } from '@pfx/PfxById'
import { MaterialInspector, applyPfxMaterialLayerEdit, removePfxMaterialFeature, setPfxMaterialFeature, type PfxMaterialLayerEdit } from './MaterialInspector'
import { PfxMaterialRuntimeProbe, describePfxMaterialRuntime, usePfxMaterialPreview } from './materialRuntimeStatus'
import { MaterialDepthStage } from './MaterialDepthStage'
import {
  CONSERVATIVE_EXCLUSIONS,
  DEFAULT_DEPTH_OPTIONS,
  DEFAULT_ORACLE,
  MATERIAL_PROOF_ORACLE_DURATIONS,
  MATERIAL_PROOF_CAMERAS,
  MATERIAL_PROOF_CASES,
  MATERIAL_PROOF_EFFECTS,
  MATERIAL_PROOF_ENTRY_POINTS,
  MATERIAL_PROOF_MAX_TIME_MS,
  MATERIAL_PROOF_SEED,
  PROOF_ATLAS,
  PROOF_ATLAS_ID,
  PROOF_CORRUPT_ATLAS_ID,
  depthOptionsToken,
  materialProofFrameToken,
  type DispatchRow,
  type MaterialProofCamera,
  type MaterialProofCase,
  type MaterialProofEffect,
  type MaterialProofEntryPoint,
  type MaterialProofOracle,
  type MaterialProofOracleDuration,
  type MaterialProofOracleUv,
  type MaterialProofRecipeSource,
  type MaterialProofSelection,
} from './materialProofContract'

// Material-controls proof fixture (?materialProof=1). Every case renders real
// production code: GamePfx and its PfxSurface dispatch, or (frame oracle) the
// production sprite material and geometry factories with a one-instance
// emission input. The numbered proof atlas is registered through the public
// atlas registry and provider. There is no mock renderer, special sampler,
// hidden setter, or test-only shader, except the labelled compile-error
// negative control. The runtime-status case registers one corrupt atlas image
// as a real decode fault. See docs/material-controls-verification.md.


const ENTRY_POINT_LABELS: Record<MaterialProofEntryPoint, string> = {
  'game-pfx': 'GamePfx',
  'pfx-by-id': 'PfxById (catalog ID)',
  'drop-in': 'createGamePfxComponent',
}

// ---------------------------------------------------------------------------
// Proof atlas: original numbered cells, registered through the public registry.


function createProofAtlasDataUri(): string {
  const { columns, rows, cellPixels, frameColors, sentinel, sentinelPixels } = PROOF_ATLAS
  const canvas = document.createElement('canvas')
  canvas.width = columns * cellPixels
  canvas.height = rows * cellPixels
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Proof atlas: 2D canvas is unavailable')
  frameColors.forEach((color, frame) => {
    const x = (frame % columns) * cellPixels
    const y = Math.floor(frame / columns) * cellPixels
    context.fillStyle = sentinel
    context.fillRect(x, y, cellPixels, cellPixels)
    context.fillStyle = color
    context.fillRect(x + sentinelPixels, y + sentinelPixels, cellPixels - sentinelPixels * 2, cellPixels - sentinelPixels * 2)
    context.fillStyle = '#000000'
    context.font = `bold ${Math.round(cellPixels * 0.5)}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(frame), x + cellPixels * 0.5, y + cellPixels * 0.42)
  })
  return canvas.toDataURL('image/png')
}

let proofRegistry: { registry: PfxAtlasRegistry; atlasId: PfxAtlasId } | null = null

/** Created once per page through the validated public registry input. */
function getProofRegistry(): { registry: PfxAtlasRegistry; atlasId: PfxAtlasId } {
  if (proofRegistry) return proofRegistry
  const registry = createPfxAtlasRegistry([{
    id: PROOF_ATLAS_ID,
    imageSource: createProofAtlasDataUri(),
    width: PROOF_ATLAS.columns * PROOF_ATLAS.cellPixels,
    height: PROOF_ATLAS.rows * PROOF_ATLAS.cellPixels,
    columns: PROOF_ATLAS.columns,
    rows: PROOF_ATLAS.rows,
    frameCount: PROOF_ATLAS.frameCount,
    frameRate: PROOF_ATLAS.frameRate,
    frameOrder: 'row-major-top-left',
    cellInset: PROOF_ATLAS.cellInset,
  }])
  const atlasId = registry.ids.find((id) => id === PROOF_ATLAS_ID)
  if (!atlasId) throw new Error('Proof atlas: registry did not issue the proof ID')
  proofRegistry = { registry, atlasId }
  return proofRegistry
}


/** A PNG signature followed by bytes that are not PNG chunks. It passes the
 * structural registry checks; the browser image decoder rejects it. */
function createCorruptAtlasDataUri(): string {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from('not-a-png-chunk-stream', (char) => char.charCodeAt(0))]
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`
}

let statusRegistry: PfxAtlasRegistry | null = null

/** Runtime-status case: the numbered atlas plus one undecodable image. */
function getStatusRegistry(): PfxAtlasRegistry {
  if (statusRegistry) return statusRegistry
  const common = {
    width: PROOF_ATLAS.columns * PROOF_ATLAS.cellPixels,
    height: PROOF_ATLAS.rows * PROOF_ATLAS.cellPixels,
    columns: PROOF_ATLAS.columns,
    rows: PROOF_ATLAS.rows,
    frameCount: PROOF_ATLAS.frameCount,
    frameRate: PROOF_ATLAS.frameRate,
    frameOrder: 'row-major-top-left',
    cellInset: PROOF_ATLAS.cellInset,
  } as const
  statusRegistry = createPfxAtlasRegistry([
    { id: PROOF_ATLAS_ID, imageSource: createProofAtlasDataUri(), ...common },
    { id: PROOF_CORRUPT_ATLAS_ID, imageSource: createCorruptAtlasDataUri(), ...common },
  ])
  return statusRegistry
}

// ---------------------------------------------------------------------------
// Material scenarios: recipe overrides through the normal GamePfx path.

type LayerMaterials = Record<string, PfxMaterialTuning>
interface MaterialScenario {
  effectId: MaterialProofEffect
  /** Material object per layer phase. */
  materials?: LayerMaterials
  /** Layer phases removed from the recipe (reference images). */
  remove?: string[]
}

const FLAME = 'flame-burst-particle-upward-licks'
const VORTEX = 'vortex-rim'
const THROAT = 'aperture-depth'
const SHELL = 'broken-shell'
const SMOKE_CENTER = 'puff-bloom'

export const MATERIAL_PROOF_SCENARIOS = {
  'flame-catalog': { effectId: 'flame-burst' },
  'flame-empty': { effectId: 'flame-burst', materials: { [FLAME]: {} } },
  'flame-without-licks': { effectId: 'flame-burst', remove: [FLAME] },
  'flame-dissolve-none': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { dissolve: { map: 'noise-a', progress: -0.05, softness: 0.05, edgeWidth: 0.1, edgeColor: '#ffffff' } } },
  },
  'flame-dissolve-mid': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { dissolve: { map: 'noise-a', progress: 0.5, softness: 0.05, edgeWidth: 0.1, edgeColor: '#ffffff' } } },
  },
  'flame-dissolve-full': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { dissolve: { map: 'noise-a', progress: 1.05, softness: 0.0001, edgeWidth: 0.1, edgeColor: '#ffffff' } } },
  },
  'flame-dissolve-life': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { dissolve: { map: 'noise-a', progress: { kind: 'life', values: [-0.05, 0.45, 1.05] }, softness: 0.04, edgeWidth: 0.08, edgeColor: '#fff2a8' } } },
  },
  'flame-mask-zero': { effectId: 'flame-burst', materials: { [FLAME]: { mask: { map: 'mask-a', channel: 'r', strength: 0 } } } },
  'flame-mask-full': { effectId: 'flame-burst', materials: { [FLAME]: { mask: { map: 'mask-a', channel: 'b', strength: 1 } } } },
  'flame-uv-rotate': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { uv: { scale: [1, 1], offset: [0, 0], rotation: Math.PI, scroll: [0, 0], wrap: 'clamp' } } },
  },
  'flame-uv-scroll-repeat': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { uv: { scale: [2, 2], offset: [0, 0], rotation: 0.4, scroll: [0.5, 1.5], wrap: 'repeat' } } },
  },
  'flame-distortion-noise': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { distortion: { kind: 'noise', map: 'noise-a', strength: 0.18, direction: [1, 0.4], scroll: [0, 0.8] } } },
  },
  'flame-frame-animation': {
    effectId: 'flame-burst',
    materials: { [FLAME]: { frameAnimation: { atlas: PFX_BUILTIN_ATLAS_IDS.smallFlame, frameBlend: false } } },
  },
  'portal-catalog': { effectId: 'portal-idle-loop' },
  'portal-empty': { effectId: 'portal-idle-loop', materials: { [VORTEX]: {}, [THROAT]: {} } },
  'portal-throat-rim-baseline': { effectId: 'portal-idle-loop', materials: { [THROAT]: { rim: { power: 2.2, strength: 1 } } } },
  'portal-throat-rim-off': { effectId: 'portal-idle-loop', materials: { [THROAT]: { rim: { power: 2.2, strength: 0 } } } },
  'portal-throat-rim-color': { effectId: 'portal-idle-loop', materials: { [THROAT]: { rim: { power: 1.2, strength: 1, color: '#00ff88' } } } },
  'portal-vortex-uv': {
    effectId: 'portal-idle-loop',
    materials: { [VORTEX]: { uv: { scale: [0.8, 0.8], offset: [0, 0], rotation: 1.2, scroll: [0, 0], wrap: 'clamp' } } },
  },
  'portal-vortex-distortion-flow': {
    effectId: 'portal-idle-loop',
    materials: { [VORTEX]: { distortion: { kind: 'flow', map: 'flow-a', strength: 0.2, scroll: [0.3, 0] } } },
  },
  'shield-catalog': { effectId: 'shield-break' },
  'shield-empty': { effectId: 'shield-break', materials: { [SHELL]: {} } },
  'shield-rim-dissolve': {
    effectId: 'shield-break',
    materials: {
      [SHELL]: {
        rim: { power: 1.6, strength: { kind: 'life', values: [1, 0.7, 0.3] }, color: '#7fffff' },
        dissolve: { map: 'noise-a', progress: { kind: 'life', values: [-0.05, 0.5, 1.05] }, softness: 0.05, edgeWidth: 0.08, edgeColor: '#ffffff' },
      },
    },
  },
  'shield-mask': { effectId: 'shield-break', materials: { [SHELL]: { mask: { map: 'mask-a', channel: 'g', strength: 1 } } } },
  'smoke-catalog': { effectId: 'smoke-puff' },
  'smoke-soft-particles': { effectId: 'smoke-puff', materials: { [SMOKE_CENTER]: { softParticles: { distance: 0.4 } } } },
} as const satisfies Record<string, MaterialScenario>

export type MaterialProofScenario = keyof typeof MATERIAL_PROOF_SCENARIOS

/**
 * The catalog recipe with every `tuning.material` removed. Pilot recipes
 * gain material settings in T6; this keeps the T1 source baseline and every
 * scenario reference independent of that art. Other fields stay as authored.
 */
export function withoutRecipeMaterial(recipe: PfxAuthoredRecipe): PfxAuthoredRecipe {
  return {
    ...recipe,
    surfaces: recipe.surfaces.map((surface) => {
      if (surface.tuning?.material === undefined) return surface
      const { material: _material, ...tuning } = surface.tuning
      return { ...surface, tuning }
    }),
  }
}

function sourceRecipe(effectId: string): PfxAuthoredRecipe {
  const source = AUTHORED_EFFECT_RECIPES[effectId]
  if (!source) throw new Error(`Proof scenario: no authored recipe for ${effectId}`)
  return withoutRecipeMaterial(source)
}

function buildScenarioRecipe(scenario: MaterialScenario): PfxAuthoredRecipe {
  const source = sourceRecipe(scenario.effectId)
  const remove = new Set(scenario.remove ?? [])
  const materials: LayerMaterials = scenario.materials ?? {}
  const known = new Set(source.surfaces.map((surface) => surface.phase))
  for (const phase of [...remove, ...Object.keys(materials)]) {
    if (!known.has(phase)) throw new Error(`Proof scenario: ${scenario.effectId} has no layer '${phase}'`)
  }
  return {
    ...source,
    surfaces: source.surfaces
      .filter((surface) => !remove.has(surface.phase ?? ''))
      .map((surface) => {
        const material = surface.phase ? materials[surface.phase] : undefined
        return material === undefined ? surface : { ...surface, tuning: { ...surface.tuning, material } }
      }),
  }
}

// ---------------------------------------------------------------------------
// Cost edits: visible buttons drive a working recipe through recipeOverride.

export const COST_EDITS = ['scalar', 'structural', 'opacity', 'colour', 'equal-recipe', 'reset'] as const
export type CostEdit = (typeof COST_EDITS)[number]

const COST_SCENARIOS: Record<'flame-burst' | 'portal-idle-loop', {
  base: MaterialScenario
  scalar: { layer: string; apply: (material: PfxMaterialTuning, on: boolean) => PfxMaterialTuning }
  structural: { layer: string; apply: (material: PfxMaterialTuning, on: boolean) => PfxMaterialTuning }
  existing: string
}> = {
  'flame-burst': {
    base: {
      effectId: 'flame-burst',
      materials: { [FLAME]: { dissolve: { map: 'noise-a', progress: 0.2, softness: 0.05, edgeWidth: 0.08, edgeColor: '#ffffff' } } },
    },
    scalar: { layer: FLAME, apply: (material, on) => ({ ...material, dissolve: { ...material.dissolve!, progress: on ? 0.55 : 0.2 } }) },
    structural: {
      layer: FLAME,
      apply: (material, on) => {
        const { mask: _mask, ...rest } = material
        return on ? { ...rest, mask: { map: 'mask-a', channel: 'b', strength: 1 } } : rest
      },
    },
    existing: FLAME,
  },
  'portal-idle-loop': {
    base: {
      effectId: 'portal-idle-loop',
      materials: {
        [VORTEX]: { uv: { scale: [1, 1], offset: [0, 0], rotation: 0.3, scroll: [0, 0], wrap: 'clamp' } },
        [THROAT]: { rim: { power: 2.2, strength: 1 } },
      },
    },
    scalar: { layer: THROAT, apply: (material, on) => ({ ...material, rim: { ...material.rim!, power: on ? 1.1 : 2.2 } }) },
    structural: { layer: VORTEX, apply: (material, on) => ({ ...material, uv: { ...material.uv!, wrap: on ? 'repeat' : 'clamp', scale: on ? [1.6, 1.6] : [1, 1] } }) },
    existing: VORTEX,
  },
}

interface CostState {
  recipe: PfxAuthoredRecipe
  scalarOn: boolean
  structuralOn: boolean
  opacityOn: boolean
  colourOn: boolean
  edits: number
}

/**
 * Cost edits belong to one effect. The slot names that effect, so a recipe
 * built for one effect never meets the preset of another.
 */
interface CostSlot {
  effectId: MaterialProofEffect
  /** Null when the effect has no cost scenario. */
  state: CostState | null
}

function initialCostState(effectId: MaterialProofEffect): CostState | null {
  const config = COST_SCENARIOS[effectId as keyof typeof COST_SCENARIOS]
  if (!config) return null
  return { recipe: buildScenarioRecipe(config.base), scalarOn: false, structuralOn: false, opacityOn: false, colourOn: false, edits: 0 }
}

function mapLayer(recipe: PfxAuthoredRecipe, phase: string, update: (surface: PfxRenderSurface) => PfxRenderSurface): PfxAuthoredRecipe {
  return { ...recipe, surfaces: recipe.surfaces.map((surface) => (surface.phase === phase ? update(surface) : surface)) }
}

function applyCostEdit(effectId: MaterialProofEffect, state: CostState, edit: CostEdit): CostState {
  const config = COST_SCENARIOS[effectId as keyof typeof COST_SCENARIOS]
  if (!config) return state
  const edits = state.edits + 1
  const source = AUTHORED_EFFECT_RECIPES[effectId]!
  switch (edit) {
    case 'scalar': {
      const on = !state.scalarOn
      return { ...state, scalarOn: on, edits, recipe: mapLayer(state.recipe, config.scalar.layer, (surface) => ({ ...surface, tuning: { ...surface.tuning, material: config.scalar.apply(surface.tuning!.material!, on) } })) }
    }
    case 'structural': {
      const on = !state.structuralOn
      return { ...state, structuralOn: on, edits, recipe: mapLayer(state.recipe, config.structural.layer, (surface) => ({ ...surface, tuning: { ...surface.tuning, material: config.structural.apply(surface.tuning!.material!, on) } })) }
    }
    case 'opacity': {
      const on = !state.opacityOn
      const authored = source.surfaces.find((surface) => surface.phase === config.existing)!.opacity
      return { ...state, opacityOn: on, edits, recipe: mapLayer(state.recipe, config.existing, (surface) => ({ ...surface, opacity: on ? authored * 0.35 : authored })) }
    }
    case 'colour': {
      const on = !state.colourOn
      const authored = source.surfaces.find((surface) => surface.phase === config.existing)!.tuning?.colorOverride
      return {
        ...state,
        colourOn: on,
        edits,
        recipe: mapLayer(state.recipe, config.existing, (surface) => {
          const { colorOverride: _colorOverride, ...tuning } = surface.tuning ?? {}
          const colorOverride = on ? '#18c8ff' : authored
          return { ...surface, tuning: colorOverride === undefined ? tuning : { ...tuning, colorOverride } }
        }),
      }
    }
    case 'equal-recipe':
      return { ...state, edits, recipe: structuredClone(state.recipe) }
    case 'reset':
      return { ...initialCostState(effectId)!, edits }
    default: {
      const unreachable: never = edit
      throw new Error(`Unhandled cost edit ${String(unreachable)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Selection and frame token.





const INITIAL_SELECTION: MaterialProofSelection = {
  proofCase: 'baseline-gamepfx',
  effectId: 'flame-burst',
  timeMs: 250,
  camera: 'three-quarter',
  scenario: 'flame-catalog',
  quality: 'low',
  reducedMotion: false,
  oracle: DEFAULT_ORACLE,
  recipeSource: 'catalog',
  entryPoint: 'game-pfx',
  depth: DEFAULT_DEPTH_OPTIONS,
}

// Same orbit values as the viewer review cameras (PfxBrowserApp).
const CAMERA_TARGET = new THREE.Vector3(0, 0.15, 0)
const CAMERA_ORBITS: Record<MaterialProofCamera, { yaw: number; pitch: number; distance: number }> = {
  front: { yaw: 0, pitch: 0.18, distance: 5 },
  'three-quarter': { yaw: 0.72, pitch: 0.34, distance: 5.2 },
  side: { yaw: Math.PI / 2, pitch: 0, distance: 5.2 },
}

function FixedCamera({ camera: angle, target }: { camera: MaterialProofCamera; target: THREE.Vector3 }) {
  const { camera } = useThree()
  useFrame(() => {
    const orbit = CAMERA_ORBITS[angle]
    const horizontal = Math.cos(orbit.pitch) * orbit.distance
    camera.position.set(
      target.x + Math.sin(orbit.yaw) * horizontal,
      target.y + Math.sin(orbit.pitch) * orbit.distance,
      target.z + Math.cos(orbit.yaw) * horizontal,
    )
    camera.lookAt(target)
    camera.updateProjectionMatrix()
  })
  return null
}

const ORACLE_TARGET = new THREE.Vector3(0, 0, 0)

// ---------------------------------------------------------------------------
// Diagnostics read from the real renderer after the frame handshake.

const trackedMaterials = new Map<string, { disposed: boolean; tag: string | null }>()

function trackMaterial(material: THREE.Material): void {
  if (trackedMaterials.has(material.uuid)) return
  const tag = (material.userData[PFX_MATERIAL_PATH_USERDATA_KEY] as string | undefined) ?? null
  trackedMaterials.set(material.uuid, { disposed: false, tag })
  material.addEventListener('dispose', () => {
    const entry = trackedMaterials.get(material.uuid)
    if (entry) entry.disposed = true
  })
}

interface LayerDiagnostic {
  layer: string
  tags: string[]
  materials: string[]
  geometries: string[]
  defines: string[]
  samplers: string[]
  /** Per-frame opacity uniform written by PfxSurface (legacy pulse included). */
  opacity: number | null
  binding: unknown
}

function activeSamplers(renderer: THREE.WebGLRenderer, material: THREE.Material): string[] {
  const program = (renderer.properties.get(material) as { currentProgram?: { program: WebGLProgram } }).currentProgram
  if (!program) return []
  const gl = renderer.getContext()
  const count = gl.getProgramParameter(program.program, gl.ACTIVE_UNIFORMS) as number
  const samplers: string[] = []
  for (let index = 0; index < count; index += 1) {
    const info = gl.getActiveUniform(program.program, index)
    if (info && (info.type === gl.SAMPLER_2D || info.type === 0x8b60 /* SAMPLER_CUBE */)) samplers.push(info.name)
  }
  return samplers.sort()
}

function collectLayerDiagnostics(scene: THREE.Scene, renderer: THREE.WebGLRenderer): LayerDiagnostic[] {
  const layers: LayerDiagnostic[] = []
  scene.traverse((object) => {
    const surface = object.userData.pfxSurface as PfxRenderSurface | undefined
    const oracle = object.userData.pfxProofOracle as boolean | undefined
    if (!surface && !oracle) return
    const materials = new Map<string, THREE.Material>()
    const geometries = new Set<string>()
    object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.material) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.set(material.uuid, material)
      if (mesh.geometry) geometries.add(mesh.geometry.uuid)
    })
    for (const material of materials.values()) trackMaterial(material)
    const list = [...materials.values()]
    layers.push({
      layer: surface ? (surface.phase ?? surface.kind) : 'proof-one-instance',
      tags: [...new Set(list.map((material) => material.userData[PFX_MATERIAL_PATH_USERDATA_KEY] as string | undefined).filter((tag): tag is string => !!tag))],
      materials: list.map((material) => material.uuid),
      geometries: [...geometries],
      defines: [...new Set(list.flatMap((material) => Object.keys((material as THREE.ShaderMaterial).defines ?? {})))].sort(),
      samplers: [...new Set(list.flatMap((material) => activeSamplers(renderer, material)))].sort(),
      opacity: (() => {
        const shader = list.find((material) => (material as THREE.ShaderMaterial).uniforms?.uOpacity) as THREE.ShaderMaterial | undefined
        return shader ? (shader.uniforms.uOpacity!.value as number) : null
      })(),
      binding: object.userData.pfxMaterialBinding ?? null,
    })
  })
  return layers
}

function ProofFrameHandshake({ token }: { token: string }) {
  const { gl, scene } = useThree()
  const committedFrames = useRef(0)
  const glErrors = useRef(0)
  useEffect(() => {
    committedFrames.current = 0
    delete gl.domElement.dataset.pfxProofFrame
    return () => {
      delete gl.domElement.dataset.pfxProofFrame
    }
  }, [gl, token])
  useFrame(() => {
    committedFrames.current += 1
    const error = gl.getContext().getError()
    if (error !== 0) {
      glErrors.current += 1
      gl.domElement.dataset.pfxProofGlErrors = String(glErrors.current)
      gl.domElement.dataset.pfxProofLastGlError = String(error)
    }
    // Acknowledge only after several frames consumed the frozen time, so a
    // capture cannot reuse the previous selection's framebuffer. Diagnostics
    // refresh every 30 frames after that, so a check can prove that frames
    // alone never replace a material.
    const acknowledged = gl.domElement.dataset.pfxProofFrame === token
    if (committedFrames.current >= 3 && (!acknowledged || committedFrames.current % 30 === 0)) {
      const render = gl.info.render
      gl.domElement.dataset.pfxProofRenderInfo = JSON.stringify({
        drawCalls: render.calls,
        triangles: render.triangles,
        points: render.points,
        programs: gl.info.programs?.length ?? null,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      })
      const layers = collectLayerDiagnostics(scene, gl)
      const disposed = [...trackedMaterials.entries()].filter(([, entry]) => entry.disposed).map(([uuid]) => uuid)
      gl.domElement.dataset.pfxProofLayers = JSON.stringify({
        frame: committedFrames.current,
        token,
        layers,
        disposedMaterials: disposed,
        materialMaps: getPfxMaterialMapStats(),
      })
      gl.domElement.dataset.pfxProofFrame = token
    }
  })
  return null
}

// ---------------------------------------------------------------------------
// Frame oracle: one particle through the production sprite factories.

/** Controls whose effective shader timing and lifetime are exactly 1. */
function oracleControls(): PfxControls {
  const controls = createPfxPreset('fireball', { seed: MATERIAL_PROOF_SEED }).controls
  return {
    ...controls,
    // 'fantasy' has motionMultiplier 1, so uTiming = 1 * 1 * tempo 1.
    style: 'fantasy',
    timing: 1,
    lifetime: 1,
    gravity: 0,
    turbulence: 0,
    scale: 1,
    emissiveBloom: 0,
    color: ['#ffffff', '#ffffff', '#ffffff'],
    flipbook: 'none',
    blendMode: 'additive',
  }
}

function oneInstanceEmission(variant: number, duration: MaterialProofOracleDuration): PfxParticleEmission {
  return {
    count: 1,
    // No MOTION_* define; its additive shrink stays near 1 before 0.85 life.
    motionKind: 'impact-burst',
    sprite: 'spark',
    // A window of 1 selects the continuous clock: age = fract(t + variant) * lifetime.
    emissionWindow: 1,
    spawn: new Float32Array([0, 0, 0]),
    direction: new Float32Array([0, 1, 0]),
    speed: new Float32Array([0]),
    // aLife.y scales this particle's duration: lifetime * duration seconds.
    life: new Float32Array([variant, duration]),
    rotation: new Float32Array([0, 0]),
    variance: new Float32Array([1, 1]),
    wobble: new Float32Array([0, 0]),
    orbit: new Float32Array([0, 0]),
  }
}

const ORACLE_UV: Record<MaterialProofOracleUv, PfxMaterialTuning['uv'] | undefined> = {
  none: undefined,
  'rotate-clamp': { scale: [1, 1], offset: [0, 0], rotation: 0.7, scroll: [0, 0], wrap: 'clamp' },
  'repeat-tiles': { scale: [2.5, 2.5], offset: [0.13, 0.07], rotation: 0.5, scroll: [0, 0], wrap: 'repeat' },
}

function oracleSurface(oracle: MaterialProofOracle, atlasId: PfxAtlasId): PfxRenderSurface {
  const uv = ORACLE_UV[oracle.uv]
  return {
    kind: 'particles',
    role: 'body',
    opacity: 1,
    scale: oracle.size === 'large' ? 6.5 : 0.16,
    phase: 'proof-numbered-frames',
    tuning: {
      blend: 'additive',
      size: [1, 1, 1],
      stretch: 0,
      flicker: 0,
      material: { frameAnimation: { atlas: atlasId, frameBlend: oracle.frameBlend }, ...(uv ? { uv } : {}) },
    },
  }
}

function OneInstanceFrameOracle({ oracle, timeSeconds, reducedMotion }: { oracle: MaterialProofOracle; timeSeconds: number; reducedMotion: boolean }) {
  const { atlasRegistry, quality } = usePfxMaterialContext()
  const { atlasId } = getProofRegistry()
  const controls = useMemo(oracleControls, [])
  const surface = useMemo(() => oracleSurface(oracle, atlasId), [atlasId, oracle])
  const binding = useMemo(
    () => resolvePfxMaterialBinding({ effectId: 'proof-frame-oracle', surface, atlasRegistry, quality, reducedMotion }),
    [atlasRegistry, quality, reducedMotion, surface],
  )
  const emission = useMemo(() => oneInstanceEmission(oracle.variant, oracle.duration ?? 1), [oracle.duration, oracle.variant])
  const geometry = useMemo(() => buildPfxSpriteEmissionGeometry(emission), [emission])
  const material = useMemo(
    // feelVersion 1 turns freshness off; cycleScale and tempo stay 1.
    () => createPfxSpriteEmissionMaterial(emission, controls, surface, getPfxSurfaceMaterialProps(surface, controls), 1, 1, 1, binding),
    [binding, controls, emission, surface],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  // The same per-frame clock writes as PfxSurface.
  useFrame(() => {
    material.uniforms.uTime!.value = timeSeconds
    if (binding) updatePfxMaterialClock(material, binding, timeSeconds * material.uniforms.uTiming!.value)
  })
  return <mesh geometry={geometry} material={material} frustumCulled={false} userData={{ pfxProofOracle: true, pfxMaterialBinding: describePfxMaterialBinding(binding) }} />
}

// ---------------------------------------------------------------------------
// Dispatch tags: every catalog recipe through production GamePfx dispatch.



function DispatchCollector({ onReport }: { onReport: (rows: DispatchRow[]) => void }) {
  const { scene } = useThree()
  const frames = useRef(0)
  const reported = useRef(false)
  useFrame(() => {
    frames.current += 1
    if (reported.current || frames.current < 3) return
    reported.current = true
    const rows: DispatchRow[] = []
    for (const preset of PFX_PRESETS) {
      const group = scene.getObjectByProperty('name', `dispatch:${preset.effectId}`)
      const expected = getPfxRenderPlan(createPfxPreset(preset.effectId, { seed: MATERIAL_PROOF_SEED })).surfaces
      const drawn = new Map<string, { surface: PfxRenderSurface; tags: Set<string> }>()
      group?.traverse((object) => {
        const surface = object.userData.pfxSurface as PfxRenderSurface | undefined
        if (!surface) return
        // Collect from the layer root: the child of the GamePfx group.
        let root: THREE.Object3D = object
        while (root.parent && !root.parent.userData.testid) root = root.parent
        const tags = new Set<string>()
        root.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (!mesh.material) return
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const tag = material.userData[PFX_MATERIAL_PATH_USERDATA_KEY] as string | undefined
            if (tag) tags.add(tag)
          }
        })
        drawn.set(`${surface.kind}|${surface.phase ?? ''}`, { surface, tags })
      })
      for (const planned of expected) {
        const entry = drawn.get(`${planned.kind}|${planned.phase ?? ''}`)
        const path = resolvePfxMaterialPath({ surface: entry?.surface ?? planned })
        const reason = path.kind === 'unsupported' ? path.reason : null
        const tags = entry ? [...entry.tags].sort() : []
        let status: DispatchRow['status']
        if (!entry) status = path.kind === 'unsupported' ? 'missing-object' : 'mismatch'
        else if (path.kind !== 'unsupported') status = tags.length === 1 && tags[0] === path.kind ? 'match' : 'mismatch'
        else if (tags.length === 0) status = 'match'
        else status = (CONSERVATIVE_EXCLUSIONS as readonly string[]).includes(reason!) ? 'conservative-exclusion' : 'mismatch'
        rows.push({ effectId: preset.effectId, layer: planned.phase ?? planned.kind, kind: planned.kind, resolver: path.kind, reason, tags, status })
      }
    }
    onReport(rows)
  })
  return null
}

function DispatchScene({ onReport }: { onReport: (rows: DispatchRow[]) => void }) {
  const presets = useMemo(() => PFX_PRESETS.map((preset) => createPfxPreset(preset.effectId, { seed: MATERIAL_PROOF_SEED })), [])
  // Hidden: the renderer skips the subtree, so no program compiles. Factories,
  // memos, and dispatch still run in production order.
  return (
    <group visible={false}>
      {presets.map((preset) => (
        <group key={preset.effectId} name={`dispatch:${preset.effectId}`}>
          <GamePfx preset={preset} previewTimeSeconds={0.25} />
        </group>
      ))}
      <DispatchCollector onReport={onReport} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Recipe replay: one imported recipe through a selected public entry point.
// All three use the catalog preset and its seed (PfxById takes no seed).

function RecipeReplayScene({ recipe, entryPoint, timeSeconds }: { recipe: PfxAuthoredRecipe; entryPoint: MaterialProofEntryPoint; timeSeconds: number }) {
  const preset = useMemo(() => createPfxPreset(recipe.effectId), [recipe.effectId])
  const DropIn = useMemo(() => createGamePfxComponent(recipe.effectId), [recipe.effectId])
  switch (entryPoint) {
    case 'game-pfx':
      return <GamePfx preset={preset} recipeOverride={recipe} previewTimeSeconds={timeSeconds} />
    case 'pfx-by-id':
      return <PfxById effectId={recipe.effectId} recipeOverride={recipe} previewTimeSeconds={timeSeconds} />
    case 'drop-in':
      return <DropIn recipeOverride={recipe} previewTimeSeconds={timeSeconds} />
    default: {
      const unreachable: never = entryPoint
      throw new Error(`Unhandled entry point ${String(unreachable)}`)
    }
  }
}

type RecipeCheck = { ok: true; recipe: PfxAuthoredRecipe } | { ok: false; error: PfxRecipeParseError }

function checkRecipe(recipe: PfxAuthoredRecipe, atlasRegistry: PfxAtlasRegistry): RecipeCheck {
  try {
    return { ok: true, recipe: parsePfxAuthoredRecipe(recipe, { atlasRegistry }) }
  } catch (error) {
    if (error instanceof PfxRecipeParseError) return { ok: false, error }
    throw error
  }
}

const STATUS_EFFECT: MaterialProofEffect = 'flame-burst'

// ---------------------------------------------------------------------------
// Compile-error negative control: proves that a GLSL failure reaches the
// console and the run record. This is the only non-production shader here.

function CompileErrorControl() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    fragmentShader: 'void main() { pfx_negative_control_undeclared(); }',
  }), [])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material}>
      <planeGeometry args={[0.2, 0.2]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Scene error boundary: a validation error stays visible and keeps the page.

class SceneBoundary extends Component<{ children: ReactNode; onError: (message: string) => void; resetKey: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    this.props.onError(`${error.name}: ${error.message}`)
  }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// ---------------------------------------------------------------------------
// Page.

function parseTimeInput(value: string): number | null {
  if (value.trim() === '') return null
  const seconds = Number(value)
  if (!Number.isFinite(seconds)) return null
  const timeMs = Math.round(seconds * 1000)
  return Math.abs(timeMs) <= MATERIAL_PROOF_MAX_TIME_MS ? timeMs : null
}

const pageStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  maxWidth: 760,
  margin: '0 auto',
  fontFamily: 'system-ui, sans-serif',
  color: '#e5e7eb',
  boxSizing: 'border-box',
}
const stageStyle: CSSProperties = { width: '100%', aspectRatio: '1 / 1', background: '#111827' }
const controlsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }
const fieldStyle: CSSProperties = { display: 'grid', gap: 4, fontSize: 14 }

export function MaterialProofApp() {
  const [selection, setSelection] = useState<MaterialProofSelection>(INITIAL_SELECTION)
  const [timeText, setTimeText] = useState(String(INITIAL_SELECTION.timeMs / 1000))
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [dispatchRows, setDispatchRows] = useState<DispatchRow[] | null>(null)
  const [costSlot, setCostSlot] = useState<CostSlot | null>(null)
  const timeInvalid = parseTimeInput(timeText) == null
  const { proofCase } = selection
  const scenarioId = selection.scenario ?? 'flame-catalog'
  const scenario: MaterialScenario = MATERIAL_PROOF_SCENARIOS[scenarioId]
  const effectId: MaterialProofEffect = proofCase === 'material-gamepfx'
    ? scenario.effectId
    : proofCase === 'runtime-status' ? STATUS_EFFECT : proofCase === 'depth' ? 'smoke-puff' : selection.effectId
  const depthOptions = selection.depth ?? DEFAULT_DEPTH_OPTIONS
  const recipeSource = selection.recipeSource ?? 'catalog'
  const entryPoint = selection.entryPoint ?? 'game-pfx'

  // Recipe replay: the visible JSON import is the only recipe input.
  const [replayText, setReplayText] = useState('')
  const [replay, setReplay] = useState<{ recipe: PfxAuthoredRecipe; imports: number } | null>(null)
  const [replayError, setReplayError] = useState<string | null>(null)
  const importReplay = () => {
    try {
      const recipe = parsePfxAuthoredRecipeJson(replayText)
      setReplay((current) => ({ recipe, imports: (current?.imports ?? 0) + 1 }))
      setReplayError(null)
    } catch (error) {
      if (!(error instanceof PfxRecipeParseError)) throw error
      setReplayError(error.message)
    }
  }

  // Runtime status: the real inspector edits one flame layer; the probe
  // measures the mounted resources; an error shows the last ready recipe.
  const [statusEdit, setStatusEdit] = useState<PfxMaterialLayerEdit | undefined>(undefined)
  const statusRegistry = proofCase === 'runtime-status' ? getStatusRegistry() : PFX_DEFAULT_ATLAS_REGISTRY
  const statusBase = useMemo(() => sourceRecipe(STATUS_EFFECT), [])
  const statusWorking = useMemo(
    () => mapLayer(statusBase, FLAME, (surface) => {
      const material = applyPfxMaterialLayerEdit(undefined, statusEdit)
      return material ? { ...surface, tuning: { ...surface.tuning, material } } : surface
    }),
    [statusBase, statusEdit],
  )
  const statusCheck = useMemo(() => checkRecipe(statusWorking, statusRegistry), [statusRegistry, statusWorking])
  const statusLastValid = useRef<PfxAuthoredRecipe>(statusBase)
  useEffect(() => {
    if (statusCheck.ok) statusLastValid.current = statusCheck.recipe
  }, [statusCheck])
  const statusCandidate = statusCheck.ok ? statusCheck.recipe : statusLastValid.current
  const statusPreview = usePfxMaterialPreview(
    'runtime-status',
    statusCandidate,
    [selection.quality ?? 'low', selection.reducedMotion ?? false],
    proofCase === 'runtime-status',
  )
  const quality = selection.quality ?? 'low'
  const reducedMotion = selection.reducedMotion ?? false
  const oracle = selection.oracle ?? DEFAULT_ORACLE
  const preset = useMemo(() => createPfxPreset(effectId, { seed: MATERIAL_PROOF_SEED }), [effectId])
  const scenarioRecipe = useMemo(() => (proofCase === 'material-gamepfx' ? buildScenarioRecipe(scenario) : undefined), [proofCase, scenario])
  const baselineRecipe = useMemo(
    () => (proofCase === 'baseline-gamepfx' && recipeSource === 'no-material' ? sourceRecipe(effectId) : undefined),
    [effectId, proofCase, recipeSource],
  )
  // The slot follows the selected effect during render, not in an effect
  // after it: when the effect or case changes, React discards this render and
  // renders again with the new slot, so no child sees a stale cost recipe.
  const costEffect = proofCase === 'cost-edits' ? effectId : null
  if ((costSlot?.effectId ?? null) !== costEffect) {
    setCostSlot(costEffect ? { effectId: costEffect, state: initialCostState(costEffect) } : null)
  }
  const cost = costSlot && costSlot.effectId === costEffect ? costSlot.state : null
  const recipeOverride = proofCase === 'cost-edits'
    ? cost?.recipe
    : proofCase === 'baseline-gamepfx'
      ? baselineRecipe
      : proofCase === 'runtime-status'
        ? (statusPreview.display.kind === 'none' ? undefined : statusPreview.display.value)
        : scenarioRecipe
  const plan = useMemo(() => getPfxRenderPlan(preset, { recipeOverride }), [preset, recipeOverride])
  const legacyPulse = getPfxFlipbookFrameProps(preset.controls, selection.timeMs / 1000)
  const atlasLayers = plan.surfaces
    .filter((surface) => surface.tuning?.flipbookAtlas || surface.tuning?.material?.frameAnimation)
    .map((surface) => `${surface.phase ?? surface.kind}: ${surface.tuning?.material?.frameAnimation?.atlas ?? surface.tuning!.flipbookAtlas}`)
  const effectiveSelection: MaterialProofSelection = { ...selection, effectId }
  const tokenDetail = proofCase === 'recipe-replay'
    ? `ep=${entryPoint},i=${replay?.imports ?? 0},fx=${replay?.recipe.effectId ?? '-'}`
    : proofCase === 'runtime-status'
      ? `rev=${statusPreview.revision},rt=${describePfxMaterialRuntime(statusPreview.runtime)},d=${statusPreview.display.kind}`
      : proofCase === 'depth' ? `dp=${depthOptionsToken(depthOptions)}` : ''
  const token = materialProofFrameToken(effectiveSelection, cost?.edits ?? 0, tokenDetail)
  const registry = proofCase === 'frame-oracle' ? getProofRegistry().registry : proofCase === 'runtime-status' ? statusRegistry : undefined
  const state = {
    ...effectiveSelection,
    seed: MATERIAL_PROOF_SEED,
    frameToken: token,
    legacyPulse: { name: preset.controls.flipbook, timing: preset.controls.timing, ...legacyPulse },
    frameAnimationAtlases: atlasLayers,
    layers: plan.surfaces.map((surface) => surface.phase ?? surface.kind),
    layerAnimation: plan.surfaces.map((surface) => ({ layer: surface.phase ?? surface.kind, mode: getPfxLayerAnimationMode(surface.tuning) })),
    proofAtlas: proofCase === 'frame-oracle'
      ? { id: PROOF_ATLAS_ID, ...PROOF_ATLAS, registeredIds: registry?.ids ?? [] }
      : null,
    cost: cost ? { edits: cost.edits, scalarOn: cost.scalarOn, structuralOn: cost.structuralOn, opacityOn: cost.opacityOn, colourOn: cost.colourOn } : null,
    recipeSource: proofCase === 'baseline-gamepfx' ? recipeSource : null,
    replay: proofCase === 'recipe-replay'
      ? {
          entryPoint,
          imports: replay?.imports ?? 0,
          effectId: replay?.recipe.effectId ?? null,
          seed: replay ? createPfxPreset(replay.recipe.effectId).controls.seed : null,
          layers: replay?.recipe.surfaces.map((surface) => surface.phase ?? surface.kind) ?? [],
          error: replayError,
        }
      : null,
    runtimeStatus: proofCase === 'runtime-status'
      ? {
          revision: statusPreview.revision,
          runtime: statusPreview.runtime,
          display: statusPreview.display.kind,
          atlasRegistryIds: statusRegistry.ids,
          editError: 'error' in statusCheck ? statusCheck.error.message : null,
        }
      : null,
    depth: proofCase === 'depth' ? depthOptions : null,
    sceneError,
  }
  const resetKey = token

  const scene = (() => {
    switch (proofCase) {
      case 'baseline-gamepfx':
        return <GamePfx key={effectId} preset={preset} recipeOverride={baselineRecipe} previewTimeSeconds={selection.timeMs / 1000} />
      case 'frame-oracle':
        return <OneInstanceFrameOracle oracle={oracle} timeSeconds={selection.timeMs / 1000} reducedMotion={reducedMotion} />
      case 'material-gamepfx':
      case 'cost-edits':
        return (
          <GamePfx
            key={effectId}
            preset={preset}
            recipeOverride={recipeOverride}
            reducedMotion={reducedMotion}
            previewTimeSeconds={selection.timeMs / 1000}
          />
        )
      case 'dispatch-tags':
        return <DispatchScene onReport={setDispatchRows} />
      case 'compile-error-control':
        return <CompileErrorControl />
      case 'recipe-replay':
        return replay
          ? <RecipeReplayScene key={`${entryPoint}:${replay.imports}`} recipe={replay.recipe} entryPoint={entryPoint} timeSeconds={selection.timeMs / 1000} />
          : null
      case 'depth':
        // MaterialDepthStage owns its canvas: the projection and the depth
        // renderer flags are canvas creation options.
        return null
      case 'runtime-status':
        return statusPreview.display.kind === 'none' ? null : (
          <PfxMaterialRuntimeProbe revision={statusPreview.revision} active={statusPreview.probeActive} onReport={statusPreview.report}>
            <GamePfx
              preset={preset}
              recipeOverride={statusPreview.display.value}
              reducedMotion={reducedMotion}
              previewTimeSeconds={selection.timeMs / 1000}
            />
          </PfxMaterialRuntimeProbe>
        )
      default: {
        const unreachable: never = proofCase
        throw new Error(`Unhandled proof case ${String(unreachable)}`)
      }
    }
  })()

  const dispatchSummary = dispatchRows
    ? {
        effects: new Set(dispatchRows.map((row) => row.effectId)).size,
        layers: dispatchRows.length,
        byStatus: Object.fromEntries(['match', 'conservative-exclusion', 'mismatch', 'missing-object']
          .map((status) => [status, dispatchRows.filter((row) => row.status === status).length])),
        byResolver: Object.fromEntries([...new Set(dispatchRows.map((row) => `${row.resolver}${row.reason ? `:${row.reason}` : ''}`))].sort()
          .map((key) => [key, dispatchRows.filter((row) => `${row.resolver}${row.reason ? `:${row.reason}` : ''}` === key).length])),
      }
    : null

  const effectLocked = proofCase === 'material-gamepfx' || proofCase === 'recipe-replay' || proofCase === 'runtime-status' || proofCase === 'depth'
  const effectHelp = proofCase === 'depth'
    ? 'The depth fixture uses a smoke-puff override with depth fade. The catalog recipe is unchanged.'
    : proofCase === 'material-gamepfx'
    ? 'The material scenario selects the effect.'
    : proofCase === 'recipe-replay'
      ? 'The imported recipe selects the effect. Replay uses its catalog preset and seed.'
      : proofCase === 'runtime-status' ? 'Runtime status uses flame-burst without its catalog material settings.' : null
  const statusSurface = statusWorking.surfaces.find((surface) => surface.phase === FLAME)!

  return (
    <main style={pageStyle} data-testid="material-proof">
      <h1 style={{ fontSize: 20, margin: 0 }}>PFX material proof fixture</h1>
      <div style={controlsStyle} role="group" aria-label="Proof selection">
        <label style={fieldStyle}>
          Proof case
          <select
            data-testid="material-proof-case"
            value={selection.proofCase}
            onChange={(event) => {
              setSceneError(null)
              setDispatchRows(null)
              setSelection((current) => ({ ...current, proofCase: event.target.value as MaterialProofCase }))
            }}
          >
            {MATERIAL_PROOF_CASES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Effect
          <select
            data-testid="material-proof-effect"
            value={effectId}
            disabled={effectLocked}
            aria-describedby={effectLocked ? 'material-proof-effect-help' : undefined}
            onChange={(event) => setSelection((current) => ({ ...current, effectId: event.target.value as MaterialProofEffect }))}
          >
            {MATERIAL_PROOF_EFFECTS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Preview time (seconds)
          <input
            data-testid="material-proof-time"
            type="number"
            min={-MATERIAL_PROOF_MAX_TIME_MS / 1000}
            max={MATERIAL_PROOF_MAX_TIME_MS / 1000}
            step={0.01}
            value={timeText}
            aria-invalid={timeInvalid}
            aria-describedby="material-proof-time-help"
            onChange={(event) => {
              setTimeText(event.target.value)
              const timeMs = parseTimeInput(event.target.value)
              if (timeMs != null) setSelection((current) => ({ ...current, timeMs }))
            }}
          />
        </label>
        <label style={fieldStyle}>
          Camera
          <select
            data-testid="material-proof-camera"
            value={selection.camera}
            onChange={(event) => setSelection((current) => ({ ...current, camera: event.target.value as MaterialProofCamera }))}
          >
            {MATERIAL_PROOF_CAMERAS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {proofCase === 'baseline-gamepfx' && (
          <label style={fieldStyle}>
            Recipe source
            <select
              data-testid="material-proof-recipe-source"
              value={recipeSource}
              onChange={(event) => setSelection((current) => ({ ...current, recipeSource: event.target.value as MaterialProofRecipeSource }))}
            >
              <option value="catalog">catalog</option>
              <option value="no-material">catalog without material settings</option>
            </select>
          </label>
        )}
      </div>
      {proofCase !== 'baseline-gamepfx' && (
        <div style={controlsStyle} role="group" aria-label="Material options">
          <label style={fieldStyle}>
            Material scenario
            <select
              data-testid="material-proof-scenario"
              value={scenarioId}
              disabled={proofCase !== 'material-gamepfx'}
              onChange={(event) => {
                setSceneError(null)
                setSelection((current) => ({ ...current, scenario: event.target.value as MaterialProofScenario }))
              }}
            >
              {Object.keys(MATERIAL_PROOF_SCENARIOS).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            Material quality
            <select
              data-testid="material-proof-quality"
              value={quality}
              onChange={(event) => setSelection((current) => ({ ...current, quality: event.target.value as PfxMaterialQuality }))}
            >
              <option value="low">low</option>
              <option value="high">high</option>
            </select>
          </label>
          <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
            <input
              type="checkbox"
              data-testid="material-proof-reduced-motion"
              checked={reducedMotion}
              disabled={proofCase === 'recipe-replay'}
              aria-describedby={proofCase === 'recipe-replay' ? 'material-proof-replay-motion-help' : undefined}
              onChange={(event) => setSelection((current) => ({ ...current, reducedMotion: event.target.checked }))}
            />
            Reduced motion
          </label>
        </div>
      )}
      {proofCase === 'recipe-replay' && (
        <section style={{ display: 'grid', gap: 8 }} aria-label="Recipe replay">
          <label style={fieldStyle}>
            Recipe JSON
            <textarea
              data-testid="material-proof-replay-json"
              rows={6}
              value={replayText}
              spellCheck={false}
              aria-invalid={replayError != null}
              aria-describedby="material-proof-replay-help"
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              onChange={(event) => setReplayText(event.target.value)}
            />
          </label>
          <div style={controlsStyle}>
            <button type="button" data-testid="material-proof-replay-import" onClick={importReplay}>
              Import recipe
            </button>
            <label style={fieldStyle}>
              Entry point
              <select
                data-testid="material-proof-entry-point"
                value={entryPoint}
                onChange={(event) => setSelection((current) => ({ ...current, entryPoint: event.target.value as MaterialProofEntryPoint }))}
              >
                {MATERIAL_PROOF_ENTRY_POINTS.map((value) => <option key={value} value={value}>{ENTRY_POINT_LABELS[value]}</option>)}
              </select>
            </label>
          </div>
          <p id="material-proof-replay-help" style={{ margin: 0, fontSize: 13 }} data-testid="material-proof-replay-status">
            {replay
              ? `Imported ${replay.recipe.effectId} (${replay.recipe.surfaces.length} layers), import ${replay.imports}. Playing through ${ENTRY_POINT_LABELS[entryPoint]}.`
              : 'Paste a recipe from Copy recipe JSON, then import it.'}
          </p>
          <p id="material-proof-replay-motion-help" style={{ margin: 0, fontSize: 13 }}>
            Reduced motion is off for replay: PfxById has no reducedMotion prop.
          </p>
          {replayError && (
            <p role="alert" data-testid="material-proof-replay-error" style={{ margin: 0, color: '#fca5a5' }}>
              The recipe was not imported: {replayError}
            </p>
          )}
        </section>
      )}
      {proofCase === 'frame-oracle' && (
        <div style={controlsStyle} role="group" aria-label="Frame oracle options">
          <label style={fieldStyle}>
            Particle variant
            <select
              data-testid="material-proof-variant"
              value={String(oracle.variant)}
              onChange={(event) => setSelection((current) => ({ ...current, oracle: { ...(current.oracle ?? DEFAULT_ORACLE), variant: Number(event.target.value) as 0 | 0.5 } }))}
            >
              <option value="0">0</option>
              <option value="0.5">0.5</option>
            </select>
          </label>
          <label style={fieldStyle}>
            Sprite size
            <select
              data-testid="material-proof-size"
              value={oracle.size}
              onChange={(event) => setSelection((current) => ({ ...current, oracle: { ...(current.oracle ?? DEFAULT_ORACLE), size: event.target.value as 'large' | 'small' } }))}
            >
              <option value="large">large (magnified)</option>
              <option value="small">small (minified)</option>
            </select>
          </label>
          <label style={fieldStyle}>
            UV transform
            <select
              data-testid="material-proof-uv"
              value={oracle.uv}
              onChange={(event) => setSelection((current) => ({ ...current, oracle: { ...(current.oracle ?? DEFAULT_ORACLE), uv: event.target.value as MaterialProofOracleUv } }))}
            >
              <option value="none">none</option>
              <option value="rotate-clamp">rotate 0.7 rad, clamp</option>
              <option value="repeat-tiles">scale 2.5, rotate 0.5 rad, repeat</option>
            </select>
          </label>
          <label style={fieldStyle}>
            Particle duration
            <select
              data-testid="material-proof-duration"
              value={String(oracle.duration ?? 1)}
              onChange={(event) => setSelection((current) => ({ ...current, oracle: { ...(current.oracle ?? DEFAULT_ORACLE), duration: Number(event.target.value) as MaterialProofOracleDuration } }))}
            >
              {MATERIAL_PROOF_ORACLE_DURATIONS.map((value) => <option key={value} value={String(value)}>{value === 1 ? '1 × lifetime' : `${value} × lifetime`}</option>)}
            </select>
          </label>
          <label style={{ ...fieldStyle, gridAutoFlow: 'column', alignItems: 'center' }}>
            <input
              type="checkbox"
              data-testid="material-proof-frame-blend"
              checked={oracle.frameBlend}
              onChange={(event) => setSelection((current) => ({ ...current, oracle: { ...(current.oracle ?? DEFAULT_ORACLE), frameBlend: event.target.checked } }))}
            />
            Frame blend
          </label>
        </div>
      )}
      {proofCase === 'cost-edits' && cost && (
        <div style={controlsStyle} role="group" aria-label="Recipe edits">
          {COST_EDITS.map((edit) => (
            <button
              key={edit}
              type="button"
              data-testid={`material-proof-edit-${edit}`}
              onClick={() => setCostSlot((current) => (current?.state ? { effectId: current.effectId, state: applyCostEdit(current.effectId, current.state, edit) } : current))}
            >
              {edit === 'equal-recipe' ? 'Replace with equal recipe' : edit === 'reset' ? 'Reset edits' : `Edit ${edit}`}
            </button>
          ))}
        </div>
      )}
      <p id="material-proof-time-help" role={timeInvalid ? 'alert' : undefined} style={{ margin: 0, fontSize: 13 }}>
        {timeInvalid
          ? `Time must be −${MATERIAL_PROOF_MAX_TIME_MS / 1000}–${MATERIAL_PROOF_MAX_TIME_MS / 1000} seconds. The preview keeps ${selection.timeMs / 1000} s.`
          : `Paused at ${selection.timeMs / 1000} s. Seed ${MATERIAL_PROOF_SEED}.`}
      </p>
      {effectHelp && (
        <p id="material-proof-effect-help" style={{ margin: 0, fontSize: 13 }}>{effectHelp}</p>
      )}
      {sceneError && (
        <p role="alert" data-testid="material-proof-scene-error" style={{ margin: 0, color: '#fca5a5' }}>
          Scene error: {sceneError}
        </p>
      )}
      {proofCase === 'depth' ? (
        <MaterialDepthStage
          options={depthOptions}
          onChange={(depth) => setSelection((current) => ({ ...current, depth }))}
          quality={quality}
          camera={selection.camera}
          timeSeconds={selection.timeMs / 1000}
        >
          <ProofFrameHandshake token={token} />
        </MaterialDepthStage>
      ) : (
      <div style={stageStyle} data-testid="material-proof-stage">
        <Canvas
          dpr={1}
          camera={{ position: [3.6, 2.4, 4.8], fov: 44, near: 0.05, far: 80 }}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#111827']} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.1} />
          <FixedCamera camera={selection.camera} target={proofCase === 'frame-oracle' ? ORACLE_TARGET : CAMERA_TARGET} />
          {proofCase === 'baseline-gamepfx' ? (
            scene
          ) : (
            <PfxMaterialProvider quality={quality} atlasRegistry={registry}>
              <SceneBoundary onError={setSceneError} resetKey={resetKey}>{scene}</SceneBoundary>
            </PfxMaterialProvider>
          )}
          <ProofFrameHandshake token={token} />
        </Canvas>
      </div>
      )}
      {proofCase === 'runtime-status' && (
        <section aria-label="Runtime status inspector" data-testid="material-proof-inspector">
          <MaterialInspector
            phase={FLAME}
            surface={statusSurface}
            baseMaterial={undefined}
            edited={statusEdit !== undefined}
            quality={quality}
            reducedMotion={reducedMotion}
            atlasRegistry={statusRegistry}
            editError={'error' in statusCheck ? statusCheck.error : null}
            runtime={statusPreview.runtime}
            revision={statusPreview.revision}
            onSetFeature={(feature, value) => setStatusEdit((current) => setPfxMaterialFeature(current, feature, value))}
            onRemoveFeature={(feature) => setStatusEdit((current) => removePfxMaterialFeature(current, feature, undefined))}
            onReset={() => setStatusEdit(undefined)}
            onRetry={statusPreview.retry}
          />
        </section>
      )}
      <section aria-label="Animation inputs" style={{ fontSize: 14 }}>
        <p style={{ margin: '4px 0' }} data-testid="material-proof-legacy-pulse">
          Legacy pulse: {preset.controls.flipbook} · {legacyPulse.frameCount} steps · step {legacyPulse.frameIndex} ·
          opacity ×{legacyPulse.opacityMultiplier} · size ×{legacyPulse.sizeMultiplier}
        </p>
        <p style={{ margin: '4px 0' }} data-testid="material-proof-frame-animation">
          Frame animation: {atlasLayers.length > 0 ? atlasLayers.join(', ') : 'No animation sheet'}
        </p>
      </section>
      <output
        data-testid="material-proof-state"
        aria-label="Proof state"
        style={{ display: 'block', fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {JSON.stringify(state, null, 2)}
      </output>
      {dispatchRows && (
        <output
          data-testid="material-proof-dispatch"
          aria-label="Dispatch tag report"
          data-rows={JSON.stringify(dispatchRows)}
          style={{ display: 'block', fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}
        >
          {JSON.stringify(dispatchSummary, null, 2)}
        </output>
      )}
    </main>
  )
}
