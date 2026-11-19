import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Matrix4, Quaternion, SkinnedMesh, Vector3, type Bone } from 'three'
import { packCatalogSchema, PROPORTION_DEFAULTS, type AvatarPartEntry, type PackCatalog } from './catalog'
import { POLY_PACK_KEYS } from './packs'
import { boneScaleFor } from './proportions'
import {
  interpolateBuildColliders,
  mergeColliderMaps,
  RAGDOLL_RIG_TEMPLATES,
  ragdollGroupFor,
  resolveCharacterRagdoll,
  type RagdollColliderMap,
} from './ragdoll'
import { RIG_IDS } from './rig'
import { loadGlbHeadless } from '../src/animationAudit'
import { META_DIR, STAGE_DIR } from '../src/paths'

const MANIFEST_PATH = join(META_DIR, 'manifest.json')
const HAS_BUILT_MANIFEST = existsSync(MANIFEST_PATH)

function loadBuiltPacks(): PackCatalog[] {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { packs: unknown[] }
  return raw.packs.map((p) => packCatalogSchema.parse(p))
}

describe('ragdoll physics metadata contracts', () => {
  it('defines complete canonical templates for all 8 rigs', () => {
    expect(RAGDOLL_RIG_TEMPLATES.ual1.bodies).toHaveLength(16)
    expect(RAGDOLL_RIG_TEMPLATES.quadruped.bodies).toHaveLength(22)
    expect(RAGDOLL_RIG_TEMPLATES.arachnid.bodies).toHaveLength(27)
    expect(RAGDOLL_RIG_TEMPLATES.avian.bodies).toHaveLength(20)
    expect(RAGDOLL_RIG_TEMPLATES.dragon.bodies).toHaveLength(27)
    expect(RAGDOLL_RIG_TEMPLATES.kaiju.bodies).toHaveLength(21)
    expect(RAGDOLL_RIG_TEMPLATES.serpent.bodies).toHaveLength(11)
    expect(RAGDOLL_RIG_TEMPLATES.aquatic.bodies).toHaveLength(12)

    for (const rigId of RIG_IDS) {
      const resolved = resolveCharacterRagdoll({
        rigId,
        proportions: { ...PROPORTION_DEFAULTS },
      })
      expect(resolved.rigId).toBe(rigId)
      expect(resolved.totalMassKg).toBeGreaterThan(20)
      expect(resolved.ignoreCollisionPairs.length).toBeGreaterThanOrEqual(resolved.bodies.length - 1)
      expect(resolved.groundContactBones.length).toBeGreaterThanOrEqual(2)
      for (const body of resolved.bodies) {
        expect(body.collider.radius).toBeGreaterThan(0.01)
        expect(body.massKg).toBeGreaterThan(0.04)
      }
    }
  })

  it('interpolates continuous build morphs (-1 slim .. +1 heavy) and scales parent anchors with proportions', () => {
    const slim: RagdollColliderMap = {
      pelvis: { type: 'capsule', a: [-0.05, 0, 0], b: [0.05, 0, 0], radius: 0.11 },
      spine_03: { type: 'capsule', a: [-0.05, 0, 0], b: [0.05, 0, 0], radius: 0.10 },
    }
    const athletic: RagdollColliderMap = {
      pelvis: { type: 'capsule', a: [-0.06, 0, 0], b: [0.06, 0, 0], radius: 0.14 },
      spine_03: { type: 'capsule', a: [-0.07, 0, 0], b: [0.07, 0, 0], radius: 0.13 },
    }
    const heavy: RagdollColliderMap = {
      pelvis: { type: 'capsule', a: [-0.08, 0, 0], b: [0.08, 0, 0], radius: 0.18 },
      spine_03: { type: 'capsule', a: [-0.09, 0, 0], b: [0.09, 0, 0], radius: 0.17 },
    }
    const variants = { body_slim: slim, body_athletic: athletic, body_heavy: heavy }

    const midHeavy = interpolateBuildColliders('body_athletic', 0.5, variants)
    expect(midHeavy.pelvis!.radius).toBeCloseTo(0.16, 4)
    expect(midHeavy.spine_03!.b[0]).toBeCloseTo(0.08, 4)

    const armorShell: RagdollColliderMap = {
      spine_03: { type: 'capsule', a: [-0.09, 0, 0], b: [0.09, 0, 0], radius: 0.19 },
    }
    const merged = mergeColliderMaps([midHeavy, armorShell])
    expect(merged.spine_03!.radius).toBeCloseTo(0.19, 4)
    expect(merged.pelvis!.radius).toBeCloseTo(0.16, 4)

    const baseRagdoll = resolveCharacterRagdoll({
      rigId: 'ual1',
      proportions: { ...PROPORTION_DEFAULTS },
      bindColliders: merged,
    })
    const colossusRagdoll = resolveCharacterRagdoll({
      rigId: 'ual1',
      proportions: { ...PROPORTION_DEFAULTS, height: 1.32, legRatio: 0.85, armLength: 1.32, shoulderWidth: 1.3 },
      bindColliders: merged,
    })

    const baseArm = baseRagdoll.bodies.find((b) => b.bone === 'lowerarm_l')!
    const colArm = colossusRagdoll.bodies.find((b) => b.bone === 'lowerarm_l')!
    expect(Math.hypot(...colArm.parentAnchor)).toBeGreaterThan(Math.hypot(...baseArm.parentAnchor) * 1.25)

    const baseUpper = baseRagdoll.bodies.find((b) => b.bone === 'upperarm_l')!
    const colUpper = colossusRagdoll.bodies.find((b) => b.bone === 'upperarm_l')!
    expect(Math.hypot(...colUpper.parentAnchor)).toBeGreaterThan(Math.hypot(...baseUpper.parentAnchor) * 1.15)
    expect(colossusRagdoll.totalMassKg).toBeGreaterThan(baseRagdoll.totalMassKg * 1.3)
  })

  it.skipIf(!HAS_BUILT_MANIFEST)('enriches all built presets across all registered packs and all rigged parts with valid ragdoll metadata', () => {
    const packs = loadBuiltPacks()
    expect(packs).toHaveLength(POLY_PACK_KEYS.length)
    const allPresets = packs.flatMap((p) => p.presets)
    expect(allPresets.length).toBeGreaterThanOrEqual(20)

    for (const pack of packs) {
      for (const part of pack.parts) {
        expect(part.ragdollColliders, `Part ${part.id} missing ragdollColliders`).toBeDefined()
        const rigId = part.rigId ?? 'ual1'
        if (part.slot === 'body') {
          expect(Object.keys(part.ragdollColliders!)).toHaveLength(RAGDOLL_RIG_TEMPLATES[rigId].bodies.length)
        }
      }
      for (const preset of pack.presets) {
        const rigId = preset.rigId ?? 'ual1'
        expect(preset.ragdoll, `Preset ${preset.id} missing ragdoll`).toBeDefined()
        const ragdoll = preset.ragdoll!
        expect(ragdoll.rigId).toBe(rigId)
        expect(ragdoll.bodies).toHaveLength(RAGDOLL_RIG_TEMPLATES[rigId].bodies.length)
        expect(ragdoll.totalMassKg).toBeGreaterThan(20)

        const seen = new Set<string>()
        for (const body of ragdoll.bodies) {
          if (body.parentBody) expect(seen.has(body.parentBody)).toBe(true)
          seen.add(body.bone)
          expect(body.massKg).toBeGreaterThan(0.04)
          expect(body.collider.radius).toBeGreaterThan(0.01)
          const allFinite = [...body.parentAnchor, ...body.collider.a, ...body.collider.b, body.collider.radius].every(Number.isFinite)
          expect(allFinite).toBe(true)
        }
      }
    }
  })

  it.skipIf(!HAS_BUILT_MANIFEST)(
    'matches Three.js proportionRig world bone offsets and wraps posed body vertices tightly',
    async () => {
      const packs = loadBuiltPacks()
      const partsById = new Map<string, AvatarPartEntry>()
      for (const p of packs) for (const part of p.parts) partsById.set(part.id, part)

      const coreGlb = await loadGlbHeadless(join(STAGE_DIR, 'run-chisel-core/3D/characters/core-rig.glb'))
      const bodyMesh = coreGlb.scene.getObjectByName('body_athletic') as SkinnedMesh
      expect(bodyMesh?.isSkinnedMesh).toBe(true)

      const customProps = {
        ...PROPORTION_DEFAULTS,
        height: 1.24,
        legRatio: 1.12,
        shoulderWidth: 1.28,
        torsoBulk: 1.22,
        waistScale: 1.15,
        headScale: 1.08,
        limbThickness: 1.18,
        armLength: 1.22,
        build: 0.35,
      }
      const resolved = resolveCharacterRagdoll({
        rigId: 'ual1',
        proportions: customProps,
        bindColliders: partsById.get('body_athletic')!.ragdollColliders!,
      })

      // Apply exact proportionRig joint transforms in Three.js and verify parentAnchor spans match
      const skel = bodyMesh.skeleton
      const boneByName = new Map<string, Bone>(skel.bones.map((b) => [b.name, b]))
      const scratchMat = new Matrix4()
      const invRot: Quaternion[] = []
      const bindPos: Vector3[] = []
      const scales: Vector3[] = []
      for (let i = 0; i < skel.bones.length; i++) {
        const pos = new Vector3()
        const rot = new Quaternion()
        const sc = new Vector3()
        scratchMat.copy(skel.boneInverses[i]!).invert().decompose(pos, rot, sc)
        bindPos.push(pos)
        invRot.push(rot.invert())
        const s = new Vector3(1, 1, 1)
        boneScaleFor(skel.bones[i]!.name, customProps, s, 'ual1')
        scales.push(s)
      }
      for (let i = 0; i < skel.bones.length; i++) {
        const bone = skel.bones[i]!
        const parent = bone.parent ? skel.bones.indexOf(bone.parent as Bone) : -1
        if (parent >= 0 && skel.bones[parent]!.name !== 'root') {
          const offset = bindPos[i]!.clone().sub(bindPos[parent]!).multiply(scales[parent]!).applyQuaternion(invRot[parent]!)
          bone.position.copy(offset)
        }
      }
      coreGlb.scene.updateMatrixWorld(true)

      for (const body of resolved.bodies) {
        if (!body.parentBody) continue
        const childWorld = boneByName.get(body.bone)!.getWorldPosition(new Vector3())
        const parentWorld = boneByName.get(body.parentBody)!.getWorldPosition(new Vector3())
        const actualDist = childWorld.distanceTo(parentWorld)
        const anchorDist = Math.hypot(...body.parentAnchor)
        expect(Math.abs(actualDist - anchorDist), `Parent anchor mismatch on ${body.bone}`).toBeLessThan(0.005)
      }

      // Check bind-pose capsule containment on unscaled body_athletic vertices
      const defaultRagdoll = resolveCharacterRagdoll({
        rigId: 'ual1',
        proportions: { ...PROPORTION_DEFAULTS },
        bindColliders: partsById.get('body_athletic')!.ragdollColliders!,
      })
      const unscaledGlb = await loadGlbHeadless(join(STAGE_DIR, 'run-chisel-core/3D/characters/core-rig.glb'))
      const unscaledMesh = unscaledGlb.scene.getObjectByName('body_athletic') as SkinnedMesh
      unscaledGlb.scene.updateMatrixWorld(true)
      const capByBone = new Map(defaultRagdoll.bodies.map((b) => [b.bone, b.collider]))
      const posAttr = unscaledMesh.geometry.getAttribute('position')
      const idxAttr = unscaledMesh.geometry.getAttribute('skinIndex')
      const wtAttr = unscaledMesh.geometry.getAttribute('skinWeight')
      let checked = 0
      let insideOrNear = 0
      for (let vi = 0; vi < posAttr.count; vi++) {
        if (wtAttr.getX(vi) < 0.75) continue
        const bone = unscaledMesh.skeleton.bones[idxAttr.getX(vi)]!
        const grp = ragdollGroupFor('ual1', bone.name)
        const cap = grp ? capByBone.get(grp) : undefined
        const grpBone = grp ? unscaledMesh.skeleton.bones.find((b) => b.name === grp) : undefined
        if (!cap || !grpBone) continue
        checked++
        const wp = new Vector3(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi))
        const wa = new Vector3(...cap.a).applyMatrix4(grpBone.matrixWorld)
        const wb = new Vector3(...cap.b).applyMatrix4(grpBone.matrixWorld)
        const ab = wb.clone().sub(wa)
        const abLenSq = ab.lengthSq()
        const t = abLenSq > 1e-10 ? Math.max(0, Math.min(1, wp.clone().sub(wa).dot(ab) / abLenSq)) : 0
        const closest = wa.clone().addScaledVector(ab, t)
        if (wp.distanceTo(closest) <= cap.radius + 0.045) insideOrNear++
      }
      expect(checked).toBeGreaterThan(200)
      expect(insideOrNear / checked).toBeGreaterThan(0.95)
    },
  )
})
