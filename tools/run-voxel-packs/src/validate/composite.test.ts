import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { AVATAR_LAYER_VOXELS, type AvatarPartRef, type AvatarPartRules } from '../../contracts/catalog'
import { createIo } from '../gltfIo'
import { avatarCompositeFights, COMPOSITE_MAX_AREA, wornTogether } from './composite'

const io = createIo()
const RULES: AvatarPartRules = { hidesHair: false, hidesEyebrows: false, hidesFacialHair: false }

/** A file of 4×4×4-voxel boxes (rig space, 0.01 per voxel), each grown by `grow` voxels, one node per name. */
async function boxes(parts: { name: string; grow: number; shade: number }[]): Promise<string> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene('scene')
  const faces: [number[], number[][]][] = [
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
    [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ]
  for (const { name, grow, shade } of parts) {
    const pos: number[] = []
    const nrm: number[] = []
    const uv: number[] = []
    for (const [n, q] of faces) {
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push(...q[i]!.map((c) => (c * 4 + (c === 0 ? -grow : grow)) * 0.01))
        nrm.push(...n)
        uv.push(shade, 0.5)
      }
    }
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nrm)).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer))
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
  }
  const path = join(mkdtempSync(join(tmpdir(), 'rvx-composite-')), 'parts.glb')
  writeFileSync(path, await io.writeBinary(doc))
  return path
}

const rules = (overrides: Partial<Record<string, AvatarPartRules>> = {}) => (part: AvatarPartRef) => overrides[`${part.slot} ${part.pack}`] ?? RULES

describe('avatar composite scan', () => {
  it('flags a RUN part flush with a PN body, and passes it on its layer', async () => {
    const pirate = await boxes([{ name: 'species 1', grow: 0, shade: 0.1 }])
    const flush = await avatarCompositeFights([await boxes([{ name: 'tops fantasy-1', grow: 0, shade: 0.9 }])], pirate, rules())
    expect(flush.length).toBe(1)
    expect(flush[0]!.part).toBe('tops fantasy-1')
    expect(flush[0]!.area).toBeGreaterThan(COMPOSITE_MAX_AREA)
    const layered = await avatarCompositeFights([await boxes([{ name: 'tops fantasy-1', grow: AVATAR_LAYER_VOXELS.tops, shade: 0.9 }])], pirate, rules())
    expect(layered).toEqual([])
  })

  it('never pairs two parts of one slot, and checks RUN parts of two packs against each other', async () => {
    const pirate = await boxes([{ name: 'tops 1', grow: 0, shade: 0.1 }])
    const parts = await boxes([
      { name: 'tops fantasy-1', grow: 0, shade: 0.9 },
      { name: 'bottoms space-1', grow: 0, shade: 0.5 },
    ])
    const fights = await avatarCompositeFights([parts], pirate, rules())
    expect(fights.map((f) => `${f.part} × ${f.other}`).sort()).toEqual(['bottoms space-1 × tops 1', 'tops fantasy-1 × bottoms space-1'])
    // Checking one pack: its parts against everything else.
    const space = await avatarCompositeFights([parts], pirate, rules(), 'space')
    expect(space.map((f) => `${f.part} × ${f.other}`).sort()).toEqual(['bottoms space-1 × tops 1', 'bottoms space-1 × tops fantasy-1'])
  })

  it('skips parts that are never worn together', async () => {
    const hat = { pack: 'fantasy', slot: 'headwear', index: 1 } as const
    const hair = { pack: 'pirate', slot: 'hair', index: 3 } as const
    expect(wornTogether(hat, { ...RULES, hidesHair: true }, hair, RULES)).toBe(false)
    expect(wornTogether(hat, { ...RULES, hairOverride: { pack: 'pirate', slot: 'hair', index: 3 } }, hair, RULES)).toBe(true)
    expect(wornTogether(hat, { ...RULES, hairOverride: { pack: 'pirate', slot: 'hair', index: 4 } }, hair, RULES)).toBe(false)
    const fullBody = { pack: 'pirate', slot: 'species', index: 7 } as const
    expect(wornTogether(fullBody, { ...RULES, fullBody: true }, hat, RULES)).toBe(false)
    expect(wornTogether(fullBody, { ...RULES, fullBody: true }, { pack: 'space', slot: 'back', index: 1 }, RULES)).toBe(true)
    expect(wornTogether({ pack: 'space', slot: 'face', index: 1 }, { ...RULES, hidesEyebrows: true }, { pack: 'pirate', slot: 'eyebrow', index: 2 }, RULES)).toBe(false)
  })
})
