import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AnimationClip,
  AnimationMixer,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type Bone,
} from 'three'
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { packCatalogSchema, type CharacterPreset, type PackCatalog } from '../contracts/catalog'
import { auditRigClips, loadPresetForAudit } from './animationAudit'
import { META_DIR, STAGE_DIR } from './paths'

const MANIFEST_PATH = join(META_DIR, 'manifest.json')
const HAS_BUILT_MANIFEST = existsSync(MANIFEST_PATH)

function loadBuiltPacks(): PackCatalog[] {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { packs: unknown[] }
  return raw.packs.map((p) => packCatalogSchema.parse(p))
}

function findPreset(packs: PackCatalog[], id: string): CharacterPreset {
  for (const pack of packs) {
    const hit = pack.presets.find((p) => p.id === id)
    if (hit) return hit
  }
  throw new Error(`Missing preset "${id}"`)
}

/** Rotate a bone cleanly around a world-space axis from its rest orientation. */
function localQuatFromWorldDelta(bone: Bone, worldAxis: Vector3, angleRad: number): Quaternion {
  const worldQ = bone.getWorldQuaternion(new Quaternion())
  const parentWorldQ = bone.parent ? bone.parent.getWorldQuaternion(new Quaternion()) : new Quaternion()
  const deltaWorld = new Quaternion().setFromAxisAngle(worldAxis.clone().normalize(), angleRad)
  const targetWorld = deltaWorld.multiply(worldQ)
  return parentWorldQ.invert().multiply(targetWorld).normalize()
}

describe.skipIf(!HAS_BUILT_MANIFEST)('geometry-accurate animation audit engine', () => {
  const cache = new Map<string, GLTF>()

  it('detects synthetic bad animations: arm-through-torso, arm-through-arm, floor plunge, loop seam break, and velocity pop', async () => {
    const packs = loadBuiltPacks()
    const athletic = findPreset(packs, 'core_athletic')
    const loaded = await loadPresetForAudit(athletic, packs, STAGE_DIR, cache)
    loaded.root.updateMatrixWorld(true)

    const boneByName = new Map<string, Bone>()
    loaded.root.traverse((obj) => {
      if ((obj as Bone).isBone) boneByName.set(obj.name, obj as Bone)
    })

    const pelvis = boneByName.get('pelvis')!
    const upperarmL = boneByName.get('upperarm_l')!
    const upperarmR = boneByName.get('upperarm_r')!
    const lowerarmL = boneByName.get('lowerarm_l')!
    const lowerarmR = boneByName.get('lowerarm_r')!

    // Helper: swing limb along world direction towards target world position using rest-pose limb vector
    const swingToDirection = (bone: Bone, child: Bone, targetDirWorld: Vector3): Quaternion => {
      const p0 = bone.getWorldPosition(new Vector3())
      const p1 = child.getWorldPosition(new Vector3())
      const curDir = p1.sub(p0).normalize()
      const dstDir = targetDirWorld.clone().normalize()
      const axis = new Vector3().crossVectors(curDir, dstDir)
      const angle = Math.acos(Math.max(-1, Math.min(1, curDir.dot(dstDir))))
      if (axis.lengthSq() < 1e-8) return bone.quaternion.clone()
      return localQuatFromWorldDelta(bone, axis, angle)
    }

    // 1. Arm-through-torso: drive left arm straight through center chest (+Y down slightly and -X inward)
    const qUA_L0 = upperarmL.quaternion.clone()
    const qUA_L_torso = swingToDirection(upperarmL, lowerarmL, new Vector3(-1, -0.15, 0.02))
    const armTorsoClip = new AnimationClip('Synth_Arm_Through_Torso', 0.5, [
      new QuaternionKeyframeTrack(
        'upperarm_l.quaternion',
        [0, 0.25, 0.5],
        [
          qUA_L0.x, qUA_L0.y, qUA_L0.z, qUA_L0.w,
          qUA_L_torso.x, qUA_L_torso.y, qUA_L_torso.z, qUA_L_torso.w,
          qUA_L0.x, qUA_L0.y, qUA_L0.z, qUA_L0.w,
        ],
      ),
    ])

    // 2. Arm-through-arm: swing both upper arms forward (+Z) and inward across midline so forearms cross inside each other
    const qUA_R0 = upperarmR.quaternion.clone()
    const qLA_L0 = lowerarmL.quaternion.clone()
    const qLA_R0 = lowerarmR.quaternion.clone()
    const qUA_L_fwd = swingToDirection(upperarmL, lowerarmL, new Vector3(-0.35, -0.2, 0.92))
    const qUA_R_fwd = swingToDirection(upperarmR, lowerarmR, new Vector3(0.35, -0.2, 0.92))
    const qLA_L_bend = localQuatFromWorldDelta(lowerarmL, new Vector3(0, 1, 0), -0.9)
    const qLA_R_bend = localQuatFromWorldDelta(lowerarmR, new Vector3(0, 1, 0), 0.9)
    const armArmClip = new AnimationClip('Synth_Arm_Through_Arm', 0.5, [
      new QuaternionKeyframeTrack(
        'upperarm_l.quaternion',
        [0, 0.25, 0.5],
        [
          qUA_L0.x, qUA_L0.y, qUA_L0.z, qUA_L0.w,
          qUA_L_fwd.x, qUA_L_fwd.y, qUA_L_fwd.z, qUA_L_fwd.w,
          qUA_L0.x, qUA_L0.y, qUA_L0.z, qUA_L0.w,
        ],
      ),
      new QuaternionKeyframeTrack(
        'upperarm_r.quaternion',
        [0, 0.25, 0.5],
        [
          qUA_R0.x, qUA_R0.y, qUA_R0.z, qUA_R0.w,
          qUA_R_fwd.x, qUA_R_fwd.y, qUA_R_fwd.z, qUA_R_fwd.w,
          qUA_R0.x, qUA_R0.y, qUA_R0.z, qUA_R0.w,
        ],
      ),
      new QuaternionKeyframeTrack(
        'lowerarm_l.quaternion',
        [0, 0.25, 0.5],
        [
          qLA_L0.x, qLA_L0.y, qLA_L0.z, qLA_L0.w,
          qLA_L_bend.x, qLA_L_bend.y, qLA_L_bend.z, qLA_L_bend.w,
          qLA_L0.x, qLA_L0.y, qLA_L0.z, qLA_L0.w,
        ],
      ),
      new QuaternionKeyframeTrack(
        'lowerarm_r.quaternion',
        [0, 0.25, 0.5],
        [
          qLA_R0.x, qLA_R0.y, qLA_R0.z, qLA_R0.w,
          qLA_R_bend.x, qLA_R_bend.y, qLA_R_bend.z, qLA_R_bend.w,
          qLA_R0.x, qLA_R0.y, qLA_R0.z, qLA_R0.w,
        ],
      ),
    ])

    // 3. Floor penetration: sink pelvis by 0.5m in world Y mid-clip
    const p0 = pelvis.position.clone()
    const p0World = pelvis.getWorldPosition(new Vector3())
    const pDropLocal = pelvis.parent!.worldToLocal(p0World.clone().add(new Vector3(0, -0.5, 0)))
    const floorClip = new AnimationClip('Synth_Floor_Plunge', 0.5, [
      new VectorKeyframeTrack(
        'pelvis.position',
        [0, 0.25, 0.5],
        [p0.x, p0.y, p0.z, pDropLocal.x, pDropLocal.y, pDropLocal.z, p0.x, p0.y, p0.z],
      ),
    ])

    // 4. Cyclic loop seam break (name ends in _Loop, start != end by 35 deg)
    const qSeamEnd = localQuatFromWorldDelta(upperarmL, new Vector3(0, 0, 1), (35 * Math.PI) / 180)
    const loopSeamClip = new AnimationClip('Synth_Bad_Loop', 0.5, [
      new QuaternionKeyframeTrack(
        'upperarm_l.quaternion',
        [0, 0.5],
        [qUA_L0.x, qUA_L0.y, qUA_L0.z, qUA_L0.w, qSeamEnd.x, qSeamEnd.y, qSeamEnd.z, qSeamEnd.w],
      ),
    ])

    // 5. Velocity / quaternion pop: single-step 150 deg snap between sample frames
    const qPop = localQuatFromWorldDelta(upperarmR, new Vector3(0, 0, 1), (150 * Math.PI) / 180)
    const popClip = new AnimationClip('Synth_Velocity_Pop', 0.5, [
      new QuaternionKeyframeTrack(
        'upperarm_r.quaternion',
        [0, 0.22, 0.23, 0.5],
        [
          qUA_R0.x, qUA_R0.y, qUA_R0.z, qUA_R0.w,
          qUA_R0.x, qUA_R0.y, qUA_R0.z, qUA_R0.w,
          qPop.x, qPop.y, qPop.z, qPop.w,
          qPop.x, qPop.y, qPop.z, qPop.w,
        ],
      ),
    ])

    const reports = auditRigClips(
      loaded.root,
      loaded.meshes,
      [armTorsoClip, armArmClip, floorClip, loopSeamClip, popClip],
      {
        rigId: 'ual1',
        ragdoll: loaded.ragdoll,
        proportions: athletic.proportions,
        sampleHz: 24,
      },
    )

    const byName = new Map(reports.map((r) => [r.clip, r]))

    const rTorso = byName.get('Synth_Arm_Through_Torso')!
    expect(rTorso.errors).toBeGreaterThanOrEqual(1)
    expect(
      rTorso.findings.some(
        (f) =>
          f.kind === 'self_collision' &&
          f.severity === 'error' &&
          f.pair.some((b) => b === 'lowerarm_l' || b === 'upperarm_l' || b === 'hand_l') &&
          f.pair.some((b) => b.startsWith('spine_') || b === 'pelvis'),
      ),
    ).toBe(true)

    const rArms = byName.get('Synth_Arm_Through_Arm')!
    expect(rArms.errors).toBeGreaterThanOrEqual(1)
    expect(
      rArms.findings.some(
        (f) =>
          f.kind === 'self_collision' &&
          f.severity === 'error' &&
          f.pair.some((b) => b.endsWith('_l')) &&
          f.pair.some((b) => b.endsWith('_r')),
      ),
    ).toBe(true)

    const rFloor = byName.get('Synth_Floor_Plunge')!
    expect(rFloor.errors).toBeGreaterThanOrEqual(1)
    expect(rFloor.minVertexY).toBeLessThan(-0.3)
    expect(rFloor.findings.some((f) => f.kind === 'floor_penetration' && f.severity === 'error')).toBe(true)

    const rSeam = byName.get('Synth_Bad_Loop')!
    expect(rSeam.errors).toBeGreaterThanOrEqual(1)
    expect(rSeam.findings.some((f) => f.kind === 'loop_seam_break' && f.severity === 'error' && f.maxJointDeg > 25)).toBe(true)

    const rPop = byName.get('Synth_Velocity_Pop')!
    expect(rPop.errors).toBeGreaterThanOrEqual(1)
    expect(rPop.findings.some((f) => f.kind === 'velocity_pop' && f.severity === 'error' && f.angularStepDeg > 75)).toBe(true)
  })

  it('passes all Dire Wolf (6 clips) and Giant Spider (5 clips) animations cleanly with zero errors', async () => {
    const packs = loadBuiltPacks()

    const wolf = findPreset(packs, 'monster_dire_wolf')
    const wolfLoaded = await loadPresetForAudit(wolf, packs, STAGE_DIR, cache)
    const wolfReports = auditRigClips(wolfLoaded.root, wolfLoaded.meshes, wolfLoaded.clips, {
      rigId: wolfLoaded.rigId,
      ragdoll: wolfLoaded.ragdoll,
      proportions: wolf.proportions,
      sampleHz: 24,
    })
    expect(wolfReports.map((r) => r.clip).sort()).toEqual(['Attack', 'Death', 'Howl', 'Idle', 'Run', 'Walk'])
    for (const report of wolfReports) {
      expect(report.errors, `Wolf clip ${report.clip}: ${JSON.stringify(report.findings)}`).toBe(0)
      expect(report.minVertexY, `Wolf clip ${report.clip} minVertexY`).toBeGreaterThanOrEqual(-0.025)
    }

    const spider = findPreset(packs, 'monster_giant_spider')
    const spiderLoaded = await loadPresetForAudit(spider, packs, STAGE_DIR, cache)
    const spiderReports = auditRigClips(spiderLoaded.root, spiderLoaded.meshes, spiderLoaded.clips, {
      rigId: spiderLoaded.rigId,
      ragdoll: spiderLoaded.ragdoll,
      proportions: spider.proportions,
      sampleHz: 24,
    })
    expect(spiderReports.map((r) => r.clip).sort()).toEqual(['Attack', 'Death', 'Idle', 'Run', 'Walk'])
    for (const report of spiderReports) {
      expect(report.errors, `Spider clip ${report.clip}: ${JSON.stringify(report.findings)}`).toBe(0)
      expect(report.minVertexY, `Spider clip ${report.clip} minVertexY`).toBeGreaterThanOrEqual(-0.025)
    }
  })

  it('passes clean UAL1 baseline clips and catches known-bad UAL1 clips (Roll, Sitting_Idle_Loop)', async () => {
    const packs = loadBuiltPacks()
    const athletic = findPreset(packs, 'core_athletic')
    const loaded = await loadPresetForAudit(athletic, packs, STAGE_DIR, cache)
    const wanted = new Set(['A_TPose', 'Sword_Idle', 'Sword_Attack', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Roll', 'Sitting_Idle_Loop'])
    const clips = loaded.clips.filter((c) => wanted.has(c.name))

    const reports = auditRigClips(loaded.root, loaded.meshes, clips, {
      rigId: 'ual1',
      ragdoll: loaded.ragdoll,
      proportions: athletic.proportions,
      sampleHz: 24,
    })
    const byName = new Map(reports.map((r) => [r.clip, r]))

    for (const cleanName of ['A_TPose', 'Sword_Idle', 'Sword_Attack', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot']) {
      const r = byName.get(cleanName)!
      expect(r.errors, `Expected clean UAL1 clip ${cleanName} to have 0 errors`).toBe(0)
      expect(r.minVertexY).toBeGreaterThanOrEqual(-0.025)
    }

    const roll = byName.get('Roll')!
    expect(roll.errors).toBeGreaterThan(0)
    expect(roll.minVertexY).toBeLessThan(-0.03)
    expect(roll.findings.some((f) => f.kind === 'floor_penetration')).toBe(true)

    const sit = byName.get('Sitting_Idle_Loop')!
    expect(sit.errors).toBeGreaterThan(0)
    expect(sit.findings.some((f) => f.kind === 'self_collision' && f.severity === 'error')).toBe(true)
  })

  it('keeps Pistol_* forearms uncrossed with support hand on the +X side on Field Officer (ww2_officer)', async () => {
    const packs = loadBuiltPacks()
    const officer = findPreset(packs, 'ww2_officer')
    const loaded = await loadPresetForAudit(officer, packs, STAGE_DIR, cache)
    const pistolNames = [
      'Pistol_Aim_Down',
      'Pistol_Aim_Neutral',
      'Pistol_Aim_Up',
      'Pistol_Idle_Loop',
      'Pistol_Reload',
      'Pistol_Shoot',
    ]
    const pistolClips = loaded.clips.filter((c) => pistolNames.includes(c.name))
    expect(pistolClips.map((c) => c.name).sort()).toEqual([...pistolNames].sort())

    const reports = auditRigClips(loaded.root, loaded.meshes, pistolClips, {
      rigId: 'ual1',
      ragdoll: loaded.ragdoll,
      proportions: officer.proportions,
      sampleHz: 24,
    })
    for (const report of reports) {
      expect(report.errors, `Officer clip ${report.clip}: ${JSON.stringify(report.findings)}`).toBe(0)
    }

    const fresh = await loadPresetForAudit(officer, packs, STAGE_DIR, cache)
    const lowerarmL = fresh.root.getObjectByName('lowerarm_l')!
    const lowerarmR = fresh.root.getObjectByName('lowerarm_r')!
    const handL = fresh.root.getObjectByName('hand_l')!
    const handR = fresh.root.getObjectByName('hand_r')!
    const pLL = new Vector3()
    const pLR = new Vector3()
    const pHL = new Vector3()
    const pHR = new Vector3()

    const mixer = new AnimationMixer(fresh.root)
    try {
      for (const clip of pistolClips) {
        const steps = clip.duration > 0.2 ? 16 : 2
        for (let s = 0; s <= steps; s++) {
          mixer.stopAllAction()
          mixer.clipAction(clip).reset().play()
          mixer.setTime((clip.duration * s) / steps)
          fresh.root.updateMatrixWorld(true)
          lowerarmL.getWorldPosition(pLL)
          lowerarmR.getWorldPosition(pLR)
          handL.getWorldPosition(pHL)
          handR.getWorldPosition(pHR)

          expect(pLL.x, `${clip.name}@${s}: lowerarm_l.x should stay left (+X) of lowerarm_r.x`).toBeGreaterThan(
            pLR.x + 0.08,
          )
          if (clip.name !== 'Pistol_Reload') {
            expect(pHL.x, `${clip.name}@${s}: hand_l.x should stay left (+X) of hand_r.x`).toBeGreaterThan(
              pHR.x + 0.06,
            )
            expect(pHL.distanceTo(pHR), `${clip.name}@${s}: support hand proximity`).toBeLessThan(0.22)
          }
        }
      }
    } finally {
      mixer.stopAllAction()
    }
  })
})

