// Boundary contracts for the material controls: the recipe parser, the atlas
// registry and its frame oracle, and the depth-source validator. Every case
// runs the real module on real input (JSON text, THREE cameras, a
// THREE.DepthTexture) and checks the outcome at the boundary. No renderer.
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AUTHORED_EFFECT_RECIPES } from '../constants/02'
import { PFX_FIREBALL_FLIPBOOK_ATLAS } from '../fireballFlipbook'
import { PFX_FLAME_FLIPBOOK_ATLAS } from '../flameFlipbook'
import {
  PFX_BUILTIN_ATLAS_IDS,
  PFX_DEFAULT_ATLAS_REGISTRY,
  PfxAtlasRegistryError,
  createPfxAtlasRegistry,
  getPfxAtlasFrameCell,
  getPfxAtlasFrameIndex,
  isPfxAtlasRegistry,
} from './atlas'
import { PfxRecipeParseError, parsePfxAuthoredRecipe, parsePfxAuthoredRecipeJson, parsePfxMaterialTuning, type PfxRecipeParseErrorCode } from './parse'
import {
  createPfxMaterialDepthFrame,
  createPfxMaterialDepthSource,
  isPfxStandardDepthProjection,
  stampPfxMaterialDepthSource,
  validatePfxMaterialDepthSource,
  type PfxMaterialDepthFrame,
} from './PfxMaterialProvider'
import { PFX_MATERIAL_DEPTH_FALLBACK_REASONS, type PfxMaterialDepthFallbackReason, type PfxMaterialDepthSource } from './types'

// Mutable JSON copies of catalog recipes: the scenarios edit them like a user
// edits copied recipe JSON.
type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const recipeJson = (effectId: string): Json => JSON.parse(JSON.stringify(AUTHORED_EFFECT_RECIPES[effectId]))
const layerIndex = (recipe: Json, phase: string): number => {
  const index = recipe.surfaces.findIndex((surface: Json) => surface.phase === phase)
  if (index < 0) throw new Error(`no layer ${phase} in ${recipe.effectId}`)
  return index
}

function parseErrorOf(run: () => unknown): PfxRecipeParseError {
  try {
    run()
  } catch (error) {
    if (error instanceof PfxRecipeParseError) return error
    throw error
  }
  throw new Error('expected PfxRecipeParseError, but parsing succeeded')
}

function atlasErrorOf(run: () => unknown): PfxAtlasRegistryError {
  try {
    run()
  } catch (error) {
    if (error instanceof PfxAtlasRegistryError) return error
    throw error
  }
  throw new Error('expected PfxAtlasRegistryError, but the call succeeded')
}

describe('recipe parser: catalog round trip', () => {
  const recipes = Object.values(AUTHORED_EFFECT_RECIPES)

  it('parses all 500 authored recipes from JSON text without loss', () => {
    expect(recipes).toHaveLength(500)
    expect(new Set(recipes.map((recipe) => recipe.effectId)).size).toBe(500)
    for (const recipe of recipes) {
      const json = JSON.stringify(recipe, null, 2)
      const parsed = parsePfxAuthoredRecipeJson(json)
      expect(parsed, recipe.effectId).toStrictEqual(JSON.parse(json))
      expect(parsePfxAuthoredRecipeJson(JSON.stringify(parsed)), `${recipe.effectId} is idempotent`).toStrictEqual(parsed)
      expect(parsePfxAuthoredRecipe(recipe), `${recipe.effectId} typed value`).toStrictEqual(parsed)
    }
  })
})

describe('recipe parser: rejection names the code and the field', () => {
  const FLAME_LICK = 'flame-burst-particle-upward-licks'
  const flameJson = (mutate: (recipe: Json) => void) => {
    const recipe = recipeJson('flame-burst')
    mutate(recipe)
    return JSON.stringify(recipe)
  }
  const withMaterial = (effectId: string, phase: string, material: unknown, tuning: Record<string, unknown> = {}) => {
    const recipe = recipeJson(effectId)
    const index = layerIndex(recipe, phase)
    recipe.surfaces[index].tuning = { ...recipe.surfaces[index].tuning, ...tuning, material }
    return { json: JSON.stringify(recipe), field: `recipe.surfaces[${index}].tuning.material` }
  }
  const uv = { scale: [1, 1], offset: [0, 0], rotation: 0, scroll: [0, 0.25], wrap: 'repeat' }
  const noise = { kind: 'noise', map: 'noise-a', strength: { kind: 'life', values: [0, 0.08, 0.02] }, direction: [0, 1], scroll: [0, 0.4] }
  const dissolve = { map: 'noise-a', progress: { kind: 'life', values: [0, 0.2, 1] }, softness: 0.05, edgeWidth: 0.04, edgeColor: '#ffd166' }

  const recipeCases: Array<[name: string, run: () => unknown, code: PfxRecipeParseErrorCode, field: string]> = [
    ['malformed JSON', () => parsePfxAuthoredRecipeJson('{"id": '), 'json', 'recipe'],
    ['non-string JSON input', () => parsePfxAuthoredRecipeJson({}), 'type', 'recipe'],
    ['preset v1 document', () => parsePfxAuthoredRecipeJson(JSON.stringify({ schema: 'game-bot.r3f-pfx-preset.v1', effectId: 'flame-burst' })), 'unknown-key', 'recipe.schema'],
    ['unknown recipe key', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.extra = 1 })), 'unknown-key', 'recipe.extra'],
    ['unknown effect ID', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.effectId = 'flame-burst-2' })), 'unknown-effect', 'recipe.effectId'],
    ['missing surfaces', () => parsePfxAuthoredRecipeJson(flameJson((r) => { delete r.surfaces })), 'missing-key', 'recipe.surfaces'],
    ['empty surfaces', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces = [] })), 'type', 'recipe.surfaces'],
    ['duplicate layer key', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces.push(r.surfaces[0]) })), 'duplicate-layer', 'recipe.surfaces[3]'],
    ['unknown surface key', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].color = '#ffffff' })), 'unknown-key', 'recipe.surfaces[0].color'],
    ['unknown surface kind', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].kind = 'sprites' })), 'enum', 'recipe.surfaces[0].kind'],
    ['NaN opacity written as null', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].opacity = Number.NaN })), 'non-finite', 'recipe.surfaces[0].opacity'],
    ['Infinity scale in a typed value', () => {
      const recipe = recipeJson('flame-burst')
      return parsePfxAuthoredRecipe({ ...recipe, surfaces: [{ ...recipe.surfaces[0], scale: Number.POSITIVE_INFINITY }] })
    }, 'non-finite', 'recipe.surfaces[0].scale'],
    ['opacity above range', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].opacity = 1.5 })), 'range', 'recipe.surfaces[0].opacity'],
    ['unknown tuning key', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.glow = 1 })), 'unknown-key', 'recipe.surfaces[0].tuning.glow'],
    ['short size tuple', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.size = [0.1, 0.2] })), 'tuple', 'recipe.surfaces[0].tuning.size'],
    ['string inside positionOffset', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.positionOffset = [0, '1', 0] })), 'type', 'recipe.surfaces[0].tuning.positionOffset[1]'],
    ['short hex colour', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.colorOverride = '#fff' })), 'color', 'recipe.surfaces[0].tuning.colorOverride'],
    ['unknown sprite', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.sprite = 'flames' })), 'enum', 'recipe.surfaces[0].tuning.sprite'],
    ['unknown mesh geometry', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.meshGeometry = 'flame-burst-tongues' })), 'enum', 'recipe.surfaces[0].tuning.meshGeometry'],
    ['unknown lifecycle', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.lifecycle = 'flame-burst-ignite' })), 'enum', 'recipe.surfaces[0].tuning.lifecycle'],
    ['unknown mesh shader', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.meshShader = 'flame-burst-bloom' })), 'enum', 'recipe.surfaces[0].tuning.meshShader'],
    ['unknown legacy flipbookAtlas', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.flipbookAtlas = 'smoke-8' })), 'unknown-atlas', 'recipe.surfaces[0].tuning.flipbookAtlas'],
    ['zero impactVector', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.impactVector = [0, 0, 0] })), 'range', 'recipe.surfaces[0].tuning.impactVector'],
    ['delay at exclusive max', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.surfaces[0].tuning.delay = 1 })), 'range', 'recipe.surfaces[0].tuning.delay'],
    ['fractional feelVersion', () => parsePfxAuthoredRecipeJson(flameJson((r) => { r.feelVersion = 2.5 })), 'range', 'recipe.feelVersion'],
    ['forged registry option', () => parsePfxAuthoredRecipeJson(flameJson(() => {}), { atlasRegistry: { ids: [], get() { throw new Error('forged') }, lookup: () => undefined } as never }), 'type', 'options.atlasRegistry'],
  ]

  const materialCases: Array<[name: string, effectId: string, phase: string, material: unknown, code: PfxRecipeParseErrorCode, suffix: string, tuning?: Record<string, unknown>]> = [
    ['unknown material key', 'flame-burst', FLAME_LICK, { glow: 1 }, 'unknown-key', '.glow'],
    ['UV scale below minimum', 'flame-burst', FLAME_LICK, { uv: { ...uv, scale: [0, 1] } }, 'range', '.uv.scale[0]'],
    ['UV scale bad tuple', 'flame-burst', FLAME_LICK, { uv: { ...uv, scale: [1] } }, 'tuple', '.uv.scale'],
    ['UV missing wrap', 'flame-burst', FLAME_LICK, { uv: { scale: [1, 1], offset: [0, 0], rotation: 0, scroll: [0, 0] } }, 'missing-key', '.uv.wrap'],
    ['UV unknown wrap', 'flame-burst', FLAME_LICK, { uv: { ...uv, wrap: 'mirror' } }, 'enum', '.uv.wrap'],
    ['UV rotation NaN written as null', 'flame-burst', FLAME_LICK, { uv: { ...uv, rotation: Number.NaN } }, 'non-finite', '.uv.rotation'],
    ['noise distortion with flow map', 'flame-burst', FLAME_LICK, { distortion: { ...noise, map: 'flow-a' } }, 'unknown-map', '.distortion.map'],
    ['flow distortion with a direction', 'flame-burst', FLAME_LICK, { distortion: { kind: 'flow', map: 'flow-a', strength: 0.05, scroll: [0, 0], direction: [0, 1] } }, 'unknown-key', '.distortion.direction'],
    ['zero noise direction', 'flame-burst', FLAME_LICK, { distortion: { ...noise, direction: [0, 0] } }, 'range', '.distortion.direction'],
    ['life curve with two stops', 'flame-burst', FLAME_LICK, { distortion: { ...noise, strength: { kind: 'life', values: [0, 0.1] } } }, 'tuple', '.distortion.strength.values'],
    ['unknown mask map', 'flame-burst', FLAME_LICK, { mask: { map: 'mask-b', channel: 'r', strength: 1 } }, 'unknown-map', '.mask.map'],
    ['named edge colour', 'flame-burst', FLAME_LICK, { dissolve: { ...dissolve, edgeColor: 'red' } }, 'color', '.dissolve.edgeColor'],
    ['unknown frame atlas', 'flame-burst', FLAME_LICK, { frameAnimation: { atlas: 'smoke-8', frameBlend: false } }, 'unknown-atlas', '.frameAnimation.atlas'],
    ['frameBlend not boolean', 'flame-burst', FLAME_LICK, { frameAnimation: { atlas: 'unity-small-flame-64', frameBlend: 1 } }, 'type', '.frameAnimation.frameBlend'],
    ['frameAnimation conflicts with flipbookAtlas', 'flame-burst', FLAME_LICK, { frameAnimation: { atlas: 'unity-small-flame-64', frameBlend: false } }, 'atlas-conflict', '.frameAnimation.atlas', { flipbookAtlas: 'unity-fireball-64' }],
    ['rim on a flat sprite', 'flame-burst', FLAME_LICK, { rim: { power: 2, strength: 1 } }, 'unsupported-feature', '.rim'],
    ['soft particles on an additive sprite', 'flame-burst', FLAME_LICK, { softParticles: { distance: 0.5 } }, 'unsupported-feature', '.softParticles'],
    ['vortex dissolve', 'portal-idle-loop', 'vortex-rim', { dissolve }, 'unsupported-feature', '.dissolve'],
    ['vortex life-curve distortion', 'portal-idle-loop', 'vortex-rim', { distortion: noise }, 'life-curve-not-allowed', '.distortion.strength'],
    ['throat UV', 'portal-idle-loop', 'aperture-depth', { uv }, 'unsupported-feature', '.uv'],
    ['throat life-curve rim', 'portal-idle-loop', 'aperture-depth', { rim: { power: 2.2, strength: { kind: 'life', values: [1, 1, 0] } } }, 'life-curve-not-allowed', '.rim.strength'],
    ['rim power below range', 'portal-idle-loop', 'aperture-depth', { rim: { power: 0.05, strength: 1 } }, 'range', '.rim.power'],
    ['shell UV', 'shield-break', 'broken-shell', { uv }, 'unsupported-feature', '.uv'],
    ['special mesh geometry shell', 'shield-aura', 'shield-aura-defensive-envelope', {}, 'unsupported-path', ''],
    ['authored bubble film', 'bubble-burst', 'bubble-burst-thin-film', {}, 'unsupported-path', ''],
    ['meteor-impact motion renders chunks', 'portal-idle-loop', 'depth-flow', {}, 'unsupported-path', '', { motion: 'meteor-impact' }],
  ]

  it.each(recipeCases)('recipe: %s', (_name, run, code, field) => {
    const error = parseErrorOf(run)
    expect({ code: error.code, field: error.field }).toEqual({ code, field })
  })

  it.each(materialCases)('material: %s', (_name, effectId, phase, material, code, suffix, tuning) => {
    const { json, field } = withMaterial(effectId, phase, material, tuning)
    const error = parseErrorOf(() => parsePfxAuthoredRecipeJson(json))
    expect({ code: error.code, field: error.field }).toEqual({ code, field: `${field}${suffix}` })
  })

  it('covers every parse error code', () => {
    // A new code is a compile error here until a case above rejects with it.
    const codes = {
      json: true, type: true, 'unknown-key': true, 'missing-key': true, 'non-finite': true, range: true, tuple: true,
      enum: true, color: true, 'unknown-map': true, 'unknown-effect': true, 'unknown-atlas': true, 'atlas-conflict': true,
      'duplicate-layer': true, 'unsupported-path': true, 'unsupported-feature': true, 'life-curve-not-allowed': true,
    } satisfies Record<PfxRecipeParseErrorCode, true>
    const covered = new Set([...recipeCases.map((entry) => entry[2]), ...materialCases.map((entry) => entry[4])])
    expect([...covered].sort()).toEqual(Object.keys(codes).sort())
  })

  it('names the effect and layer in the message', () => {
    const { json } = withMaterial('flame-burst', FLAME_LICK, { rim: { power: 2, strength: 1 } })
    expect(parseErrorOf(() => parsePfxAuthoredRecipeJson(json)).message).toMatch(/effect flame-burst, layer flame-burst-particle-upward-licks/)
  })

  it('applies the field prefix in the standalone material parser', () => {
    const error = parseErrorOf(() => parsePfxMaterialTuning({ glow: 1 }, { field: 'edit' }))
    expect({ code: error.code, field: error.field }).toEqual({ code: 'unknown-key', field: 'edit.glow' })
  })

  it('accepts the 42 catalog values that were outside the declared unions', () => {
    // Representative catalog layers that use the widened geometry, lifecycle,
    // and mesh shader vocabulary. Their typed values parse unchanged.
    for (const effectId of ['debris-burst', 'dust-burst', 'shockwave-burst', 'thruster-trail', 'scan-cone']) {
      const recipe = AUTHORED_EFFECT_RECIPES[effectId]!
      expect(parsePfxAuthoredRecipe(recipe)).toStrictEqual(JSON.parse(JSON.stringify(recipe)))
    }
  })

  it('accepts a host atlas only with its registry', () => {
    const registry = createPfxAtlasRegistry([{ id: 'proof-numbered', imageSource: 'data:image/png;base64,iVBORw0KGgo=', width: 512, height: 256, columns: 4, rows: 2, frameCount: 8, frameRate: 4, frameOrder: 'row-major-top-left', cellInset: 0.018 }])
    const { json, field } = withMaterial('flame-burst', FLAME_LICK, { frameAnimation: { atlas: 'proof-numbered', frameBlend: false } })
    const parsed = parsePfxAuthoredRecipeJson(json, { atlasRegistry: registry })
    expect(parsed.surfaces[layerIndex(parsed, FLAME_LICK)]!.tuning!.material!.frameAnimation!.atlas).toBe('proof-numbered')
    const error = parseErrorOf(() => parsePfxAuthoredRecipeJson(json))
    expect({ code: error.code, field: error.field }).toEqual({ code: 'unknown-atlas', field: `${field}.frameAnimation.atlas` })
  })
})

describe('atlas registry', () => {
  const proofInput = { id: 'proof-numbered', imageSource: 'data:image/png;base64,iVBORw0KGgo=', width: 512, height: 256, columns: 4, rows: 2, frameCount: 8, frameRate: 4, frameOrder: 'row-major-top-left', cellInset: 0.018 }
  const proofAtlas = () => createPfxAtlasRegistry([proofInput]).lookup('proof-numbered')!

  it('holds the two built-in sheets with their source metadata', () => {
    expect([...PFX_DEFAULT_ATLAS_REGISTRY.ids]).toEqual([PFX_BUILTIN_ATLAS_IDS.smallFlame, PFX_BUILTIN_ATLAS_IDS.fireball])
    for (const source of [PFX_FLAME_FLIPBOOK_ATLAS, PFX_FIREBALL_FLIPBOOK_ATLAS]) {
      const atlas = PFX_DEFAULT_ATLAS_REGISTRY.lookup(source.id)!
      expect(atlas.imageSource).toBe(source.dataUri)
      expect([atlas.width, atlas.height, atlas.columns, atlas.rows, atlas.frameCount]).toEqual([source.width, source.height, source.columns, source.rows, source.frameCount])
    }
  })

  it.each<[string, unknown, string]>([
    ['duplicate of a built-in ID', { ...proofInput, id: 'unity-small-flame-64' }, 'atlases[0].id'],
    ['non-kebab ID', { ...proofInput, id: 'Proof_Numbered' }, 'atlases[0].id'],
    ['remote image URL', { ...proofInput, imageSource: 'https://example.com/a.png' }, 'atlases[0].imageSource'],
    ['width not a multiple of columns', { ...proofInput, width: 510 }, 'atlases[0].columns'],
    ['frame count above the grid', { ...proofInput, frameCount: 9 }, 'atlases[0].frameCount'],
    ['frame count that leaves an empty row', { ...proofInput, frameCount: 4 }, 'atlases[0].frameCount'],
    ['NaN frame rate', { ...proofInput, frameRate: Number.NaN }, 'atlases[0].frameRate'],
    ['unknown frame order', { ...proofInput, frameOrder: 'column-major' }, 'atlases[0].frameOrder'],
    ['unknown key', { ...proofInput, fps: 4 }, 'atlases[0].fps'],
  ])('rejects %s', (_name, input, field) => {
    expect(atlasErrorOf(() => createPfxAtlasRegistry([input])).field).toBe(field)
  })

  it('rejects a duplicate host ID', () => {
    expect(atlasErrorOf(() => createPfxAtlasRegistry([proofInput, proofInput])).field).toBe('atlases[1].id')
  })

  it('cannot be forged, and get() rejects an ID from another registry', () => {
    expect(isPfxAtlasRegistry({ ids: [], get() {}, lookup() {} })).toBe(false)
    expect(isPfxAtlasRegistry(PFX_DEFAULT_ATLAS_REGISTRY)).toBe(true)
    expect(atlasErrorOf(() => PFX_DEFAULT_ATLAS_REGISTRY.get(proofAtlas().id)).field).toBe('atlas')
  })

  it('plays the documented frame oracle: 8 frames at 4 fps', () => {
    // docs/material-controls-verification.md "Frame oracle": with duration 1,
    // a particle's age is fract(t + variant).
    const atlas = proofAtlas()
    const frameAt = (t: number, variant: number) => getPfxAtlasFrameIndex(atlas, t + variant - Math.floor(t + variant), variant)
    expect([0.1, 0.25, 0.5, 0.75].map((t) => frameAt(t, 0))).toEqual([0, 1, 2, 3])
    expect([0.1, 0.25, 0.5].map((t) => frameAt(t, 0.5))).toEqual([7, 0, 5])
    expect(frameAt(-0.4, 0)).toBe(2)
    // Ages outside one cycle wrap like GLSL mod.
    expect(getPfxAtlasFrameIndex(atlas, -0.1, 0)).toBe(7)
    expect(getPfxAtlasFrameIndex(atlas, 2.1, 0)).toBe(0)
    expect(atlasErrorOf(() => getPfxAtlasFrameIndex(atlas, Number.NaN, 0)).field).toBe('ageSeconds')
  })

  it('maps frames row-major from the top-left of a flipY texture', () => {
    const atlas = proofAtlas()
    expect(getPfxAtlasFrameCell(atlas, 0)).toEqual({ column: 0, row: 0, uvOffset: [0, 0.5], uvScale: [0.25, 0.5] })
    expect(getPfxAtlasFrameCell(atlas, 5)).toEqual({ column: 1, row: 1, uvOffset: [0.25, 0], uvScale: [0.25, 0.5] })
    expect(atlasErrorOf(() => getPfxAtlasFrameCell(atlas, 8)).field).toBe('frameIndex')
  })
})

describe('depth source validation', () => {
  const WIDTH = 64
  const HEIGHT = 32
  const TOKEN = 7

  /** A real camera, depth texture, and descriptor stamped for frame TOKEN. */
  function scene(camera: THREE.Camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100)) {
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 0, 0)
    const texture = new THREE.DepthTexture(WIDTH, HEIGHT)
    const source = createPfxMaterialDepthSource(texture)
    stampPfxMaterialDepthSource(source, { camera, width: WIDTH, height: HEIGHT, token: TOKEN, xr: false })
    const frame = createPfxMaterialDepthFrame()
    frame.token = TOKEN
    frame.camera = camera
    frame.bufferSize.set(WIDTH, HEIGHT)
    return { camera, texture, source, frame }
  }

  type Scene = ReturnType<typeof scene>
  const fallbacks: Array<[PfxMaterialDepthFallbackReason, (state: Scene) => { source: PfxMaterialDepthSource | null; frame: PfxMaterialDepthFrame }]> = [
    ['no-source', ({ frame }) => ({ source: null, frame })],
    ['xr', ({ source, frame }) => { frame.xrPresenting = true; return { source, frame } }],
    ['logarithmic-depth', ({ source, frame }) => { frame.logarithmicDepthBuffer = true; return { source, frame } }],
    ['reversed-depth', ({ source, frame }) => { source.encoding = 'reversed'; return { source, frame } }],
    ['packed-depth', ({ source, frame }) => { source.encoding = 'packed-rgba'; return { source, frame } }],
    ['unsupported-texture', ({ texture, source, frame }) => { texture.compareFunction = THREE.LessCompare; return { source, frame } }],
    ['stale-token', ({ source, frame }) => { frame.token = TOKEN + 1; return { source, frame } }],
    ['wrong-camera', ({ source, frame }) => { frame.camera = new THREE.PerspectiveCamera(); return { source, frame } }],
    ['size-mismatch', ({ source, frame }) => { frame.bufferSize.set(WIDTH * 2, HEIGHT * 2); return { source, frame } }],
    ['camera-matrix-mismatch', ({ camera, source, frame }) => {
      camera.position.x += 0.25
      camera.updateMatrixWorld()
      return { source, frame }
    }],
    ['projection-matrix-mismatch', ({ camera, source, frame }) => {
      const perspective = camera as THREE.PerspectiveCamera
      perspective.fov = 60
      perspective.updateProjectionMatrix()
      return { source, frame }
    }],
  ]

  it.each(fallbacks)('classifies %s', (reason, mutate) => {
    const { source, frame } = mutate(scene())
    expect(validatePfxMaterialDepthSource(source, frame)).toEqual({ valid: false, reason })
  })

  it('classifies a texture that no longer matches the drawing buffer as size-mismatch', () => {
    const { texture, source, frame } = scene()
    texture.image = { width: WIDTH, height: HEIGHT * 2 }
    expect(validatePfxMaterialDepthSource(source, frame)).toEqual({ valid: false, reason: 'size-mismatch' })
  })

  it('classifies an oblique near-plane projection as unsupported-projection', () => {
    // Reflector-style clip plane: the third row of the projection gains x/y terms.
    const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100)
    camera.projectionMatrix.elements[2] = 0.2
    camera.projectionMatrix.elements[6] = 0.1
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
    const { source, frame } = scene(camera)
    expect(isPfxStandardDepthProjection(camera.projectionMatrix)).toBe(false)
    expect(validatePfxMaterialDepthSource(source, frame)).toEqual({ valid: false, reason: 'unsupported-projection' })
  })

  it('names every fallback reason in at least one case', () => {
    const covered = new Set<PfxMaterialDepthFallbackReason>([...fallbacks.map(([reason]) => reason), 'unsupported-projection', 'size-mismatch'])
    expect([...covered].sort()).toEqual([...PFX_MATERIAL_DEPTH_FALLBACK_REASONS].sort())
  })

  it('accepts a standard perspective and an orthographic capture of this frame', () => {
    const perspective = scene()
    expect(isPfxStandardDepthProjection(perspective.camera.projectionMatrix)).toBe(true)
    expect(validatePfxMaterialDepthSource(perspective.source, perspective.frame)).toEqual({ valid: true, reason: null })

    const orthographic = scene(new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 100))
    expect(isPfxStandardDepthProjection(orthographic.camera.projectionMatrix)).toBe(true)
    expect(validatePfxMaterialDepthSource(orthographic.source, orthographic.frame)).toEqual({ valid: true, reason: null })
  })
})
