import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AnimationMixer, Matrix4, MeshBasicMaterial, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { PackCatalog } from '@chisel/contracts/catalog'
import { CONTEXT_DEFAULT_PALETTES } from '@chisel/contracts/palette'
import { PROPORTION_DEFAULTS } from '@chisel/contracts/catalog'
import { PolyPartIndex, resolveVisibleParts, type PolyAvatarSelection } from './composePolyAvatar'
import { createRigInstance, findSkinnedPart, getCoreRig, mergeParts } from './polyRig'

const STAGE_ROOT = resolve(import.meta.dirname, '../../../../tools/run-chisel-packs/out/jam-stage')
const CORE_RIG_PATH = resolve(STAGE_ROOT, 'run-chisel-core/3D/characters/core-rig.glb')
const WW2_PARTS_PATH = resolve(STAGE_ROOT, 'run-chisel-ww2/3D/characters/ww2-parts.glb')
const MED_PARTS_PATH = resolve(STAGE_ROOT, 'run-chisel-medieval/3D/characters/medieval-parts.glb')
const SIM_PARTS_PATH = resolve(STAGE_ROOT, 'run-chisel-sim/3D/characters/sim-parts.glb')
const MONSTERS_PARTS_PATH = resolve(STAGE_ROOT, 'run-chisel-monsters/3D/characters/monsters-parts.glb')

async function loadGlb(path: string) {
  const raw = readFileSync(path)
  return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')
}

const MOCK_CORE: PackCatalog = {
  version: 1,
  pack: 'core',
  label: 'Core',
  license: 'CC0-1.0',
  rigModelPath: 'core-rig.glb',
  clips: ['Idle_Loop', 'Walk_Loop'],
  parts: [
    { id: 'body_athletic', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'body_athletic', slot: 'body', label: 'Athletic', triangles: 720, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'head_hero', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'head_hero', slot: 'head', label: 'Hero', triangles: 180, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'hair_short_part', pack: 'core', leaf: 'characters', relativePath: 'core-rig.glb', nodeName: 'hair_short_part', slot: 'hair', label: 'Short Part', triangles: 120, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
  ],
  heldItems: [],
  props: [],
  presets: [],
}

const MOCK_MED: PackCatalog = {
  version: 1,
  pack: 'medieval',
  label: 'Medieval',
  license: 'LicenseRef-RUN-Repository-Supplemental-1.0',
  clips: [],
  parts: [
    { id: 'torso_medieval_knight', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'torso_medieval_knight', slot: 'torso', label: 'Knight', triangles: 440, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'torso_medieval_tunic', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'torso_medieval_tunic', slot: 'torso', label: 'Tunic', triangles: 490, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: true } },
    { id: 'legs_medieval_greaves', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'legs_medieval_greaves', slot: 'legs', label: 'Greaves', triangles: 320, rigId: 'ual1', rules: { hidesHair: false, hidesLegsUpper: false } },
    { id: 'headwear_great_helm', pack: 'medieval', leaf: 'characters', relativePath: 'medieval-parts.glb', nodeName: 'headwear_great_helm', slot: 'headwear', label: 'Great Helm', triangles: 240, rigId: 'ual1', rules: { hidesHair: true, hidesLegsUpper: false } },
  ],
  heldItems: [],
  props: [],
  presets: [],
}

describe('composePolyAvatar', () => {
  it('hides hair and emits extraCovered tags for hidesHair and hidesLegsUpper rules', () => {
    const idx = new PolyPartIndex([MOCK_CORE, MOCK_MED])
    const base: PolyAvatarSelection = {
      rigId: 'ual1',
      body: 'body_athletic',
      head: 'head_hero',
      hair: 'hair_short_part',
      torso: 'torso_medieval_tunic',
      legs: 'legs_medieval_greaves',
      headwear: 'headwear_great_helm',
      back: null,
      heldRight: null,
      heldLeft: null,
      clip: 'Idle_Loop',
      palette: { ...CONTEXT_DEFAULT_PALETTES.medieval },
      proportions: { ...PROPORTION_DEFAULTS },
    }
    const vis = resolveVisibleParts(base, idx)
    expect(vis.parts.map((p) => p.id)).not.toContain('hair_short_part')
    expect(vis.extraCovered).toContain('hair')
    expect(vis.extraCovered).toContain('legs_waist')
    expect(vis.totalTriangles).toBe(720 + 180 + 490 + 320 + 240)
  })

  it.skipIf(!existsSync(CORE_RIG_PATH))('smoothly blends body_athletic toward body_heavy and body_slim with build morphs', async () => {
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
    expect(dSlim).toBeLessThan(dAth - 0.02)
    expect(dMid).toBeGreaterThan(dAth + 0.01)
    expect(dHeavy).toBeGreaterThan(dMid + 0.01)
    const pAth = gAth.getAttribute('position')
    const pMid = gMid.getAttribute('position')
    const pHeavy = gHeavy.getAttribute('position')
    for (let i = 0; i < pMid.count; i++) {
      expect(pMid.getZ(i)).toBeCloseTo((pAth.getZ(i) + pHeavy.getZ(i)) / 2, 5)
    }
  })

  it.skipIf(!existsSync(CORE_RIG_PATH) || !existsSync(MONSTERS_PARTS_PATH) || !existsSync(MED_PARTS_PATH) || !existsSync(SIM_PARTS_PATH))(
    'applies head_troll fit morphs to headwear, culls troll hair crest under headwear, and culls legs_waist',
    async () => {
      const [coreGltf, monGltf, medGltf, simGltf] = await Promise.all([
        loadGlb(CORE_RIG_PATH),
        loadGlb(MONSTERS_PARTS_PATH),
        loadGlb(MED_PARTS_PATH),
        loadGlb(SIM_PARTS_PATH),
      ])
      const helm = findSkinnedPart(medGltf, 'headwear_great_helm')
      const trollHead = findSkinnedPart(monGltf, 'head_troll')
      const heroHead = findSkinnedPart(coreGltf, 'head_hero')
      const jeans = findSkinnedPart(simGltf, 'legs_sim_jeans')

      const gHero = mergeParts([heroHead, helm], 'body_athletic', 0, 'head_hero', ['hair'])
      const gTroll = mergeParts([trollHead, helm], 'body_troll', 0, 'head_troll', ['hair'])

      // Great helm expands in +Z to clear troll brow/jaw, and troll's hair crest (y > 2.02) is culled.
      const maxZ = (geo: ReturnType<typeof mergeParts>) => {
        const pos = geo.getAttribute('position')
        let m = -Infinity
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) > 1.72 && pos.getY(i) < 1.98) m = Math.max(m, pos.getZ(i))
        }
        return m
      }
      const maxY = (geo: ReturnType<typeof mergeParts>) => {
        const pos = geo.getAttribute('position')
        let m = -Infinity
        for (let i = 0; i < pos.count; i++) m = Math.max(m, pos.getY(i))
        return m
      }
      expect(maxZ(gTroll)).toBeGreaterThan(maxZ(gHero) + 0.015)
      const gTrollUnculled = mergeParts([trollHead], 'body_troll', 0, 'head_troll', [])
      expect(maxY(gTroll)).toBeLessThan(maxY(gTrollUnculled) - 0.02)

      // legs_waist culling removes jeans waist rim & belt buckle triangles.
      const gJeansFull = mergeParts([jeans], 'body_athletic', 0)
      const gJeansWaistCulled = mergeParts([jeans], 'body_athletic', 0, null, ['legs_waist'])
      expect(gJeansWaistCulled.getIndex()!.count).toBeLessThan(gJeansFull.getIndex()!.count)
    },
  )

  it.skipIf(!existsSync(CORE_RIG_PATH))(
    'applies body morphs to torso_core_tee and legs_core_shorts and culls legs_waist under tee',
    async () => {
      const coreGltf = await loadGlb(CORE_RIG_PATH)
      const tee = findSkinnedPart(coreGltf, 'torso_core_tee')
      const shorts = findSkinnedPart(coreGltf, 'legs_core_shorts')

      const chestDepth = (geo: ReturnType<typeof mergeParts>) => {
        const pos = geo.getAttribute('position')
        let minZ = Infinity
        let maxZ = -Infinity
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i)
          const y = pos.getY(i)
          if (y > 1.25 && y < 1.55 && Math.abs(x) < 0.18) {
            minZ = Math.min(minZ, pos.getZ(i))
            maxZ = Math.max(maxZ, pos.getZ(i))
          }
        }
        return maxZ - minZ
      }

      const gTeeSlim = mergeParts([tee], 'body_slim', 0)
      const gTeeAth = mergeParts([tee], 'body_athletic', 0)
      const gTeeHeavy = mergeParts([tee], 'body_heavy', 0)
      expect(chestDepth(gTeeSlim)).toBeLessThan(chestDepth(gTeeAth) - 0.015)
      expect(chestDepth(gTeeHeavy)).toBeGreaterThan(chestDepth(gTeeAth) + 0.015)

      const gShortsFull = mergeParts([shorts], 'body_athletic', 0)
      const gShortsCulled = mergeParts([shorts], 'body_athletic', 0, null, ['legs_waist'])
      expect(gShortsCulled.getIndex()!.count).toBeLessThan(gShortsFull.getIndex()!.count)
    },
  )

  it.skipIf(!existsSync(CORE_RIG_PATH) || !existsSync(WW2_PARTS_PATH) || !existsSync(MED_PARTS_PATH) || !existsSync(MONSTERS_PARTS_PATH))(
    'keeps split skirts/coat tails rotating cleanly with thighs in Sitting_Idle_Loop and Sprint_Loop',
    async () => {
      const [coreGltf, ww2Gltf, medGltf, monGltf] = await Promise.all([
        loadGlb(CORE_RIG_PATH),
        loadGlb(WW2_PARTS_PATH),
        loadGlb(MED_PARTS_PATH),
        loadGlb(MONSTERS_PARTS_PATH),
      ])
      const coreRig = getCoreRig(coreGltf, 'ual1')
      const sitClip = coreRig.clips.get('Sitting_Idle_Loop')!
      const sprintClip = coreRig.clips.get('Sprint_Loop')!
      expect(sitClip).toBeDefined()
      expect(sprintClip).toBeDefined()

      const cases: Array<{ label: string; bodyId: string; torso: SkinnedMesh; legs: SkinnedMesh; minSittingHemY: number }> = [
        {
          label: 'trenchcoat+breeches',
          bodyId: 'body_athletic',
          torso: findSkinnedPart(ww2Gltf, 'torso_ww2_trenchcoat'),
          legs: findSkinnedPart(ww2Gltf, 'legs_ww2_officer_breeches'),
          minSittingHemY: 0.72,
        },
        {
          label: 'tunic+greaves',
          bodyId: 'body_heavy',
          torso: findSkinnedPart(medGltf, 'torso_medieval_tunic'),
          legs: findSkinnedPart(medGltf, 'legs_medieval_greaves'),
          minSittingHemY: 0.72,
        },
        {
          label: 'orc_harness+kilt',
          bodyId: 'body_orc',
          torso: findSkinnedPart(monGltf, 'torso_orc_harness'),
          legs: findSkinnedPart(monGltf, 'legs_orc_kilt'),
          minSittingHemY: 0.72,
        },
        {
          label: 'troll_hide+wraps',
          bodyId: 'body_troll',
          torso: findSkinnedPart(monGltf, 'torso_troll_hide'),
          legs: findSkinnedPart(monGltf, 'legs_troll_wraps'),
          minSittingHemY: 0.72,
        },
      ]

      for (const tc of cases) {
        const rig = createRigInstance(coreRig, 'ual1')
        const geo = mergeParts([tc.torso, tc.legs], tc.bodyId, 0)
        const skinMesh = new SkinnedMesh(geo, new MeshBasicMaterial())
        skinMesh.bind(rig.skeleton, new Matrix4())
        rig.root.add(skinMesh)

        const skirtGeo = mergeParts([tc.torso], tc.bodyId, 0)
        const skirtMesh = new SkinnedMesh(skirtGeo, new MeshBasicMaterial())
        skirtMesh.bind(rig.skeleton, new Matrix4())
        rig.root.add(skirtMesh)

        const mixer = new AnimationMixer(rig.root)
        const sitAction = mixer.clipAction(sitClip).play()
        sitAction.time = sitClip.duration * 0.5
        mixer.update(0)
        rig.root.updateMatrixWorld(true)
        rig.skeleton.update()

        // Evaluate finite positions on full composed avatar and verify coat/tunic hems rotate forward relative to pelvis when sitting.
        const pelvisBone = rig.bones.find((b) => b.name === 'pelvis')!
        const pelvisZ = pelvisBone.getWorldPosition(new Vector3()).z
        const v = new Vector3()
        const skirtPos = skirtGeo.getAttribute('position')
        let maxSkirtHemZ = -Infinity
        let minSkirtHemY = Infinity
        let skirtVerts = 0
        for (let i = 0; i < skirtPos.count; i++) {
          const restY = skirtPos.getY(i)
          if (restY > 0.58 && restY < 0.90) {
            skirtVerts++
            skirtMesh.getVertexPosition(i, v)
            maxSkirtHemZ = Math.max(maxSkirtHemZ, v.z)
            minSkirtHemY = Math.min(minSkirtHemY, v.y)
          }
        }
        if (skirtVerts > 0) {
          // Trenchcoat and tunic lower skirt hems must rotate forward with the thighs in Sitting_Idle_Loop, not hang straight down.
          expect(maxSkirtHemZ - pelvisZ, `${tc.label} sitting skirt forward reach`).toBeGreaterThan(0.22)
          expect(minSkirtHemY, `${tc.label} sitting skirt min Y`).toBeGreaterThan(0.45)
        }

        // Verify left and right skirt panels split independently during Sprint_Loop stride.
        sitAction.stop()
        const sprintAction = mixer.clipAction(sprintClip).play()
        sprintAction.time = sprintClip.duration * 0.25
        mixer.update(0)
        rig.root.updateMatrixWorld(true)
        rig.skeleton.update()

        if (skirtVerts > 0) {
          let sumLeftZ = 0
          let countLeft = 0
          let sumRightZ = 0
          let countRight = 0
          for (let i = 0; i < skirtPos.count; i++) {
            const restY = skirtPos.getY(i)
            const restX = skirtPos.getX(i)
            if (restY > 0.58 && restY < 0.90) {
              skirtMesh.getVertexPosition(i, v)
              if (restX > 0.04) {
                sumLeftZ += v.z
                countLeft++
              } else if (restX < -0.04) {
                sumRightZ += v.z
                countRight++
              }
            }
          }
          expect(countLeft).toBeGreaterThan(4)
          expect(countRight).toBeGreaterThan(4)
          expect(Math.abs(sumLeftZ / countLeft - sumRightZ / countRight), `${tc.label} sprint L/R split`).toBeGreaterThan(0.08)
        }

        const pos = geo.getAttribute('position')
        for (let i = 0; i < pos.count; i++) {
          skinMesh.getVertexPosition(i, v)
          expect(Number.isFinite(v.x + v.y + v.z)).toBe(true)
        }
        geo.dispose()
        skirtGeo.dispose()
      }
    },
  )
})

