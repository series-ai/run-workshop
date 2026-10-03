import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PIRATE_RIG } from '../../contracts/avatarRig.generated'
import { PIRATE_AVATAR_GLB, pirateModelsDir } from '../paths'
import { inspectGlb, type GlbSummary } from './inspect'
import { GL_CLAMP_TO_EDGE, GL_NEAREST, validateAsset, type Violation } from './rules'

const pn = (path: string, zfight = false) => inspectGlb(new Uint8Array(readFileSync(join(pirateModelsDir(), path))), { zfight })
const rules = (violations: Violation[]) => [...new Set(violations.map((v) => v.rule))].sort()

/** A summary that satisfies the rvx contract for a 20-voxel prop. */
/** An avatar parts summary whose parts all sit on their slot layers. */
function validParts(): GlbSummary {
  return { ...validProp(), layers: { misfit: 0, worst: null } }
}

function validProp(): GlbSummary {
  return {
    materials: [{ name: 'palette', metallic: 0, roughness: 1, baseColorSize: [256, 1], baseColorMime: 'image/png', sampler: { magFilter: GL_NEAREST, minFilter: GL_NEAREST, wrapS: GL_CLAMP_TO_EDGE, wrapT: GL_CLAMP_TO_EDGE } }],
    primitives: [{ mesh: 'barrel', material: 0, paletteUvs: true }],
    meshCount: 1,
    nodeNames: ['barrel'],
    skins: [],
    animations: [],
    bounds: { min: [-6, 0, -6], max: [6, 20, 6] },
    vertexCount: 100,
    scaleClass: 'prop',
    surface: { triangles: 400, diagonalShare: 0.2, unitsPerTexel: 1, darkShare: 0.02, meanSaturation: 0.55 },
    zfight: { area: 0, worst: null },
    layers: null,
  }
}

const rigSkin = () => ({
  joints: PIRATE_RIG.map((j) => j.name),
  inverseBindMatrices: PIRATE_RIG.map((j) => [...j.inverseBindMatrix]),
  worldMatrices: PIRATE_RIG.map((j) => [...j.worldMatrix]),
  jointParents: PIRATE_RIG.map((j) => j.parent),
})

describe('pn-compat profile', () => {
  it('accepts a PN harvestable', async () => {
    expect(validateAsset(await pn('harvestables/harvestables-chest-common.glb'), { profile: 'pn-compat', kind: 'model' })).toEqual([])
  })
  it('accepts the PN avatar rig exactly', async () => {
    expect(validateAsset(await pn(PIRATE_AVATAR_GLB), { profile: 'pn-compat', kind: 'avatar-rig' })).toEqual([])
  })
  it('accepts the knight skin by joint name although Barrel sits mid-rig', async () => {
    const knight = await pn('characters-skins/characters-skins-skin-knight.glb', true)
    expect(knight.skins[0]?.joints.indexOf('Barrel')).toBe(10)
    expect(validateAsset(knight, { profile: 'pn-compat', kind: 'skin' })).toEqual([])
  })
})

describe('rvx profile', () => {
  it('accepts a valid prop', () => {
    expect(validateAsset(validProp(), { profile: 'rvx', pack: 'fantasy', category: 'props' })).toEqual([])
  })
  it('rejects the PN knight: linear/repeat sampler and PN clips', async () => {
    const knight = await pn('characters-skins/characters-skins-skin-knight.glb', true)
    const found = rules(validateAsset(knight, { profile: 'rvx', pack: 'fantasy', category: 'characters-skins' }))
    expect(found).toContain('material.sampler')
    expect(found).toContain('clips.no-pirate')
  })
  it('rejects a metallic material', () => {
    const s = validProp()
    s.materials[0]!.metallic = 0.5
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['material.pbr'])
  })
  it('rejects a prop over budget and off the ground', () => {
    const s = validProp()
    s.bounds = { min: [-6, 3, -6], max: [6, 200, 6] }
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['scale.budget', 'scale.class', 'scale.origin'])
  })
  it('requires a world scale class the category allows, and bounds that fit it', () => {
    const missing = validProp()
    missing.scaleClass = null
    expect(rules(validateAsset(missing, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['scale.class'])
    const wrong = validProp()
    wrong.scaleClass = 'building'
    expect(validateAsset(wrong, { profile: 'rvx', pack: 'fantasy', category: 'props' })[0]?.message).toMatch(/not allowed for props/)
    const small = validProp()
    small.scaleClass = 'lamp'
    expect(validateAsset(small, { profile: 'rvx', pack: 'fantasy', category: 'props' }).map((v) => v.message)).toEqual([
      'largest 20.0 is outside lamp 40–64',
      'height 20.0 is outside lamp 40–64',
    ])
  })
  it('holds world assets to the painted-atlas art direction', () => {
    const s = validProp()
    s.surface = { triangles: 9000, diagonalShare: 0, unitsPerTexel: 0.5, darkShare: 0.3, meanSaturation: 0.05 }
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['style.budget', 'style.dark', 'style.saturation', 'texture.density'])
    s.surface = null
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['texture.density'])
    const building = validProp()
    building.scaleClass = 'building'
    building.bounds = { min: [-50, 0, -40], max: [50, 110, 40] }
    building.surface = { triangles: 2000, diagonalShare: 0.05, unitsPerTexel: 1, darkShare: 0.02, meanSaturation: 0.5 }
    expect(rules(validateAsset(building, { profile: 'rvx', pack: 'fantasy', category: 'buildings' }))).toEqual(['style.diagonal'])
  })
  it('accepts a world atlas of any size but keeps the 256×1 palette for avatar space', () => {
    const s = validProp()
    s.materials[0]!.baseColorSize = [328, 331]
    s.primitives[0]!.paletteUvs = false
    expect(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' })).toEqual([])
  })
  it('rejects an unknown prop clip and an animated prop without clips', () => {
    const s = validProp()
    s.animations = [{ name: 'wiggle', targets: ['lid'], duration: 1, seam: null }]
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['clips.names'])
    expect(rules(validateAsset(validProp(), { profile: 'rvx', pack: 'fantasy', category: 'animated-props' }))).toEqual(['clips.required'])
  })
  it('rejects an armature outside the characters leaf', () => {
    const s = validProp()
    s.skins = [rigSkin()]
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['rig.absent'])
  })
  it('requires a socket on held items and a grip inside the bounds', () => {
    const s = validProp()
    s.bounds = { min: [0.07, -0.05, -0.01], max: [0.1, 0.3, 0.01] }
    expect(rules(validateAsset(s, { profile: 'rvx', pack: 'space', category: 'held-items' }))).toEqual(['scale.origin', 'sockets.required'])
  })
  it('rejects shuffled joints on a parts file and a drifted IBM on a skin', () => {
    const parts = validParts()
    const shuffled = rigSkin()
    ;[shuffled.joints[0], shuffled.joints[1]] = [shuffled.joints[1]!, shuffled.joints[0]!]
    parts.skins = [shuffled]
    parts.animations = [{ name: '32_Cast_Spell', targets: ['Arm.R'], duration: 1, seam: null }]
    expect(rules(validateAsset(parts, { profile: 'rvx', pack: 'fantasy', category: 'avatar' }))).toEqual(['rig.order'])

    const skin = validProp()
    skin.bounds = { min: [-0.2, 0, -0.3], max: [0.2, 0.7, 0.3] }
    const drifted = rigSkin()
    drifted.inverseBindMatrices[7]!.splice(13, 1, drifted.inverseBindMatrices[7]![13]! + 0.01)
    skin.skins = [drifted]
    expect(rules(validateAsset(skin, { profile: 'rvx', pack: 'fantasy', category: 'characters-skins' }))).toEqual(['rig.bind'])
  })
  it('rejects an avatar clip from another pack range', () => {
    const parts = validParts()
    parts.skins = [rigSkin()]
    parts.animations = [{ name: '40_Rifle_Aim', targets: ['Arm.R'], duration: 1, seam: null }]
    expect(rules(validateAsset(parts, { profile: 'rvx', pack: 'fantasy', category: 'avatar' }))).toEqual(['clips.names'])
  })

  it('rejects missing IBMs, a re-parented joint, bad UVs and a clip on a non-PN node', () => {
    const skin = validProp()
    skin.bounds = { min: [-0.2, 0, -0.3], max: [0.2, 0.7, 0.3] }
    const broken = rigSkin()
    broken.inverseBindMatrices[3] = []
    broken.jointParents[4] = 'Head'
    skin.skins = [broken]
    expect(rules(validateAsset(skin, { profile: 'rvx', pack: 'fantasy', category: 'characters-skins' }))).toEqual(['rig.bind', 'rig.rest'])

    const uv = validProp()
    uv.primitives = [{ mesh: 'barrel', material: -1, paletteUvs: false }]
    expect(rules(validateAsset(uv, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).toEqual(['material.primitive'])

    const parts = validParts()
    parts.skins = [rigSkin()]
    parts.animations = [{ name: '32_Cast_Spell', targets: ['Arm.R', 'Tail'], duration: 1, seam: null }]
    expect(rules(validateAsset(parts, { profile: 'rvx', pack: 'fantasy', category: 'avatar' }))).toEqual(['clips.targets'])
  })

  it('flags avatar parts off their slot layer, or a parts file without layers', () => {
    const parts = validParts()
    parts.skins = [rigSkin()]
    expect(rules(validateAsset(parts, { profile: 'rvx', pack: 'fantasy', category: 'avatar' }))).toEqual([])
    parts.layers = { misfit: 12, worst: 'tops fantasy-3 (12.0 voxel² at 0.000 voxel)' }
    expect(rules(validateAsset(parts, { profile: 'rvx', pack: 'fantasy', category: 'avatar' }))).toEqual(['avatar.layers'])
    parts.layers = null
    expect(rules(validateAsset(parts, { profile: 'rvx', pack: 'fantasy', category: 'avatar' }))).toEqual(['avatar.layers'])
  })

  it('flags visible z-fighting above the tolerance', () => {
    const summary = { ...validProp(), zfight: { area: 12.5, worst: 'lid × chest (12.50 voxel²)' } }
    const found = validateAsset(summary, { profile: 'rvx', pack: 'fantasy', category: 'props' })
    expect(found.find((v) => v.rule === 'geometry.zfight')?.message).toMatch(/12\.5 voxel².*lid × chest/)
    expect(rules(validateAsset({ ...validProp(), zfight: { area: 0.4, worst: 'x × y (0.40 voxel²)' } }, { profile: 'rvx', pack: 'fantasy', category: 'props' }))).not.toContain('geometry.zfight')
  })

  it('flags a looping clip that does not end where it starts, but not a one-shot', () => {
    const clip = (name: string) => ({ name, targets: ['wheel'], duration: 1.2, seam: { channel: 'wheel.rotation', gap: 108, path: 'rotation' as const } })
    const looped = { ...validProp(), animations: [clip('move')] }
    const found = validateAsset(looped, { profile: 'rvx', pack: 'fantasy', category: 'vehicles' })
    expect(found.find((v) => v.rule === 'clips.loop')?.message).toMatch(/"move".*wheel\.rotation is 108\.0° off/)
    const once = { ...validProp(), animations: [clip('open')] }
    expect(rules(validateAsset(once, { profile: 'rvx', pack: 'fantasy', category: 'vehicles' }))).not.toContain('clips.loop')
  })
})
