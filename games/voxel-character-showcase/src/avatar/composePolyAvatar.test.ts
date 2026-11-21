import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { PackCatalog } from '@voxchar/contracts/catalog'
import { CONTEXT_DEFAULT_PALETTES } from '@voxchar/contracts/palette'
import { PROPORTION_DEFAULTS } from '@voxchar/contracts/catalog'
import { PolyPartIndex, resolveVisibleParts, type PolyAvatarSelection } from './composePolyAvatar'
import { findSkinnedPart, mergeParts } from './polyRig'

const STAGE_ROOT = resolve(import.meta.dirname, '../../../../tools/run-voxel-characters/out/jam-stage')
const CORE_RIG_PATH = resolve(STAGE_ROOT, 'run-cubix-core/3D/characters/core-rig.glb')
const HEIST_PACK_PATH = resolve(STAGE_ROOT, 'run-cubix-heist/3D/characters/heist-pack.glb')

async function loadGlb(path: string) {
  const raw = readFileSync(path)
  return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')
}

const MOCK_CORE: PackCatalog = {
  version: 1,
  pack: 'core',
  label: 'Core Rig & Voxel Bodies',
  license: 'CC0-1.0',
  rigModelPath: 'core-rig.glb',
  clips: ['Idle_Loop', 'Walk_Loop'],
  parts: [
    { id: 'body_athletic', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'body_athletic', slot: 'body', label: 'Athletic', triangles: 640, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'head_rugged_hero', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'head_rugged_hero', slot: 'head', label: 'Hero', triangles: 160, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'hair_short_quiff', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'hair_short_quiff', slot: 'hair', label: 'Short Quiff', triangles: 110, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
  ],
  heldItems: [],
  props: [],
  levelKitProps: [],
  presets: [],
}

const MOCK_HEIST: PackCatalog = {
  version: 1,
  pack: 'heist',
  label: 'Heist & Demolition',
  license: 'LicenseRef-RUN-Repository-Supplemental-1.0',
  clips: [],
  parts: [
    { id: 'torso_heist_tee', pack: 'heist', leaf: 'characters', relativePath: 'heist-pack.glb', nodeName: 'torso_heist_tee', slot: 'torso', label: 'Tee', triangles: 340, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'torso_heist_belted_tunic', pack: 'heist', leaf: 'characters', relativePath: 'heist-pack.glb', nodeName: 'torso_heist_belted_tunic', slot: 'torso', label: 'Belted Tunic', triangles: 410, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: true } },
    { id: 'legs_heist_holster_jeans', pack: 'heist', leaf: 'characters', relativePath: 'heist-pack.glb', nodeName: 'legs_heist_holster_jeans', slot: 'legs', label: 'Holster Jeans', triangles: 280, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'headwear_red_bob_hat', pack: 'heist', leaf: 'characters', relativePath: 'heist-pack.glb', nodeName: 'headwear_red_bob_hat', slot: 'headwear', label: 'Red Bob Hat', triangles: 180, rigId: 'ual1', rules: { hidesHair: true, hidesLegsUpper: false } },
  ],
  heldItems: [],
  props: [],
  levelKitProps: [],
  presets: [],
}

describe('composePolyAvatar', () => {
  it('hides hair and emits extraCovered tags for hidesHair and hidesLegsUpper rules', () => {
    const idx = new PolyPartIndex([MOCK_CORE, MOCK_HEIST])
    const base: PolyAvatarSelection = {
      rigId: 'ual1',
      body: 'body_athletic',
      head: 'head_rugged_hero',
      hair: 'hair_short_quiff',
      torso: 'torso_heist_belted_tunic',
      legs: 'legs_heist_holster_jeans',
      headwear: 'headwear_red_bob_hat',
      back: null,
      heldRight: null,
      heldLeft: null,
      clip: 'Idle_Loop',
      palette: { ...CONTEXT_DEFAULT_PALETTES.heist },
      proportions: { ...PROPORTION_DEFAULTS },
    }
    const vis = resolveVisibleParts(base, idx)
    expect(vis.parts.map((p) => p.id)).not.toContain('hair_short_quiff')
    expect(vis.extraCovered).toContain('hair')
    expect(vis.extraCovered).toContain('legs_waist')
    expect(vis.totalTriangles).toBe(640 + 160 + 410 + 280 + 180)
  })

  it.skipIf(!existsSync(CORE_RIG_PATH))('smoothly blends body_athletic toward body_heavy and body_slim and preserves uv1', async () => {
    const gltf = await loadGlb(CORE_RIG_PATH)
    const athletic = gltf.scene.getObjectByName('body_athletic') as SkinnedMesh
    const torsoDepth = (geo: ReturnType<typeof mergeParts>) => {
      const pos = geo.getAttribute('position')
      let minZ = Infinity
      let maxZ = -Infinity
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        if (y > 0.9 && y < 1.45 && Math.abs(x) < 0.25) {
          minZ = Math.min(minZ, pos.getZ(i))
          maxZ = Math.max(maxZ, pos.getZ(i))
        }
      }
      return maxZ - minZ
    }
    const gSlim = mergeParts([athletic], 'body_athletic', -1)
    const gAth = mergeParts([athletic], 'body_athletic', 0)
    const gMid = mergeParts([athletic], 'body_athletic', 0.5)
    const gHeavy = mergeParts([athletic], 'body_athletic', 1.0)
    const dSlim = torsoDepth(gSlim)
    const dAth = torsoDepth(gAth)
    const dMid = torsoDepth(gMid)
    const dHeavy = torsoDepth(gHeavy)
    expect(dSlim).toBeLessThan(dAth - 0.012)
    expect(dMid).toBeGreaterThan(dAth + 0.01)
    expect(dHeavy).toBeGreaterThan(dMid + 0.01)
    const pAth = gAth.getAttribute('position')
    const pMid = gMid.getAttribute('position')
    const pHeavy = gHeavy.getAttribute('position')
    for (let i = 0; i < pMid.count; i++) {
      expect(pMid.getZ(i)).toBeCloseTo((pAth.getZ(i) + pHeavy.getZ(i)) / 2, 5)
    }
    const uv1 = gAth.getAttribute('uv1')
    expect(uv1).toBeDefined()
    expect(uv1.count).toBe(pAth.count)
    let hasVoxelCoord = false
    for (let i = 0; i < uv1.count; i++) {
      if (uv1.getX(i) > -100) {
        hasVoxelCoord = true
        break
      }
    }
    expect(hasVoxelCoord).toBe(true)
  })

  it.skipIf(!existsSync(CORE_RIG_PATH) || !existsSync(HEIST_PACK_PATH))(
    'applies body morphs, culls hair/legs_waist, and deforms heist garments without NaN vertices',
    async () => {
      const [coreGltf, heistGltf] = await Promise.all([loadGlb(CORE_RIG_PATH), loadGlb(HEIST_PACK_PATH)])
      const athletic = findSkinnedPart(coreGltf, 'body_athletic')
      const hair = findSkinnedPart(coreGltf, 'hair_short_quiff')
      const beltedTunic = findSkinnedPart(heistGltf, 'torso_heist_belted_tunic')
      const jeans = findSkinnedPart(heistGltf, 'legs_heist_holster_jeans')
      const hat = findSkinnedPart(heistGltf, 'headwear_red_bob_hat')

      const gAth = mergeParts([athletic, beltedTunic, jeans], 'body_athletic', 0)
      const gHeavy = mergeParts([athletic, beltedTunic, jeans], 'body_heavy', 0)
      const gSlim = mergeParts([athletic, beltedTunic, jeans], 'body_slim', 0)

      const maxZChest = (geo: ReturnType<typeof mergeParts>) => {
        const pos = geo.getAttribute('position')
        let m = -Infinity
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) > 1.15 && pos.getY(i) < 1.48 && Math.abs(pos.getX(i)) < 0.2) {
            m = Math.max(m, pos.getZ(i))
          }
        }
        return m
      }
      expect(maxZChest(gSlim)).toBeLessThan(maxZChest(gAth))
      expect(maxZChest(gHeavy)).toBeGreaterThan(maxZChest(gAth))

      const gBodyFull = mergeParts([athletic], 'body_athletic', 0, null, [])
      const gBodyNoChest = mergeParts([athletic], 'body_athletic', 0, null, ['chest'])
      expect(gBodyNoChest.getIndex()!.count).toBeLessThan(gBodyFull.getIndex()!.count)

      const gJeansOnly = mergeParts([jeans], 'body_athletic', 0, null, [])
      expect(gAth.getIndex()!.count).toBeLessThan(
        gBodyFull.getIndex()!.count + mergeParts([beltedTunic], 'body_athletic', 0).getIndex()!.count + gJeansOnly.getIndex()!.count,
      )

      const gHatMerged = mergeParts([hair, hat], 'body_athletic', 0, null, [])
      expect(gHatMerged.getIndex()!.count).toBeGreaterThan(0)

      gAth.dispose()
      gHeavy.dispose()
      gSlim.dispose()
      gBodyFull.dispose()
      gBodyNoChest.dispose()
      gJeansOnly.dispose()
      gHatMerged.dispose()
    },
  )
})
