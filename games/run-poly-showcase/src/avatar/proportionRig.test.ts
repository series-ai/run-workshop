import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { Box3, Vector3, type Bone, type Object3D, type SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PROPORTION_DEFAULTS, type AvatarProportions } from '@poly/contracts/catalog'
import { applyProportionsToSkeleton, computeHeldSocketPosition, scaleAnimatedPelvis, unscaleAnimatedPelvis } from './proportionRig'

/**
 * These tests use the real UAL1 bind rig (plus built creature rigs when present) and real three.js skinning math.
 */
const SOURCE_RIG = resolve(import.meta.dirname, '../../../../tools/run-poly-packs/assets/source/ual1-base.glb')
const QUADRUPED_RIG = resolve(import.meta.dirname, '../../../../tools/run-poly-packs/out/jam-stage/run-poly-monsters/3D/characters/quadruped-rig.glb')
const ARACHNID_RIG = resolve(import.meta.dirname, '../../../../tools/run-poly-packs/out/jam-stage/run-poly-monsters/3D/characters/arachnid-rig.glb')

/** Remove materials and images. Node has no image decoder, and the tests do not use them. */
function withoutTextures(file: Buffer): ArrayBuffer {
  const jsonLength = file.readUInt32LE(12)
  const document = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'))
  for (const key of ['materials', 'textures', 'images', 'samplers']) delete document[key]
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material
  let json = Buffer.from(JSON.stringify(document), 'utf8')
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
  const binary = file.subarray(20 + jsonLength)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + json.length + binary.length, 8)
  header.writeUInt32LE(json.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  const out = Buffer.concat([header, json, binary])
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
}

interface Rig {
  root: Object3D
  body: SkinnedMesh
  bone: (name: string) => Bone
}

let glb: ArrayBuffer

async function loadRig(): Promise<Rig> {
  const gltf = await new GLTFLoader().parseAsync(glb.slice(0), '')
  const root = gltf.scene.getObjectByName('Jill_Rig')
  const body = gltf.scene.getObjectByName('Jill_Body') as SkinnedMesh | undefined
  if (!root || !body?.isSkinnedMesh) throw new Error('The source rig has no Jill_Rig or Jill_Body.')
  const bone = (name: string) => {
    const found = body.skeleton.bones.find((item) => item.name === name)
    if (!found) throw new Error(`Missing bone ${name}`)
    return found
  }
  return { root, body, bone }
}

function skinnedPositions(rig: Rig): Vector3[] {
  rig.root.updateMatrixWorld(true)
  rig.body.skeleton.update()
  const count = rig.body.geometry.getAttribute('position').count
  const points: Vector3[] = []
  for (let i = 0; i < count; i++) {
    // getVertexPosition returns mesh-local space. The body has an identity transform below the rig root.
    points.push(rig.body.getVertexPosition(i, new Vector3()).applyMatrix4(rig.body.matrixWorld))
  }
  return points
}

function bounds(points: Vector3[]): Box3 {
  return new Box3().setFromPoints(points)
}

function worldPosition(bone: Bone): Vector3 {
  return bone.getWorldPosition(new Vector3())
}

const with_ = (changes: Partial<AvatarProportions>): AvatarProportions => ({ ...PROPORTION_DEFAULTS, ...changes })

describe('applyProportionsToSkeleton on the real UAL1 rig', () => {
  beforeAll(() => {
    glb = withoutTextures(readFileSync(SOURCE_RIG))
  })

  it('keeps the bind shape and the bone offsets for default proportions', async () => {
    const rig = await loadRig()
    const before = skinnedPositions(rig)
    const offsets = rig.body.skeleton.bones.map((bone) => bone.position.clone())
    applyProportionsToSkeleton(rig.root, with_({}))
    const after = skinnedPositions(rig)
    const worst = Math.max(...after.map((point, i) => point.distanceTo(before[i]!)))
    expect(worst).toBeLessThan(1e-4)
    rig.body.skeleton.bones.forEach((bone, i) => expect(bone.position.distanceTo(offsets[i]!)).toBeLessThan(1e-4))
    expect(rig.root.position.y).toBe(0)
  })

  it('scales stature with height while keeping head width, shoulder width, and soles grounded (no uniform zoom)', async () => {
    const rig = await loadRig()
    const base = bounds(skinnedPositions(rig))
    const headWidth = (pts: Vector3[]) => {
      const box = bounds(pts.filter((p) => p.y > base.max.y - 0.28))
      return box.max.x - box.min.x
    }
    const baseHeadW = headWidth(skinnedPositions(rig))
    const shoulderBefore = worldPosition(rig.bone('upperarm_l')).x
    applyProportionsToSkeleton(rig.root, with_({ height: 1.2 }))
    const pts = skinnedPositions(rig)
    const tall = bounds(pts)
    expect(tall.max.y).toBeCloseTo(base.max.y * 1.2, 2)
    expect(Math.abs(tall.min.y)).toBeLessThan(0.01)
    expect(rig.bone('root').scale.x).toBe(1)
    expect(worldPosition(rig.bone('upperarm_l')).x).toBeCloseTo(shoulderBefore, 4)
    const tallHeadBox = bounds(pts.filter((p) => p.y > tall.max.y - 0.28))
    expect(tallHeadBox.max.x - tallHeadBox.min.x).toBeCloseTo(baseHeadW, 3)
  })

  it('shifts hip height with legRatio while conserving overall height', async () => {
    const rig = await loadRig()
    const base = bounds(skinnedPositions(rig))
    const baseHipY = worldPosition(rig.bone('thigh_l')).y
    applyProportionsToSkeleton(rig.root, with_({ legRatio: 1.2 }))
    const longLegs = bounds(skinnedPositions(rig))
    expect(longLegs.max.y).toBeCloseTo(base.max.y, 2)
    expect(Math.abs(longLegs.min.y)).toBeLessThan(0.01)
    expect(worldPosition(rig.bone('thigh_l')).y).toBeGreaterThan(baseHipY + 0.1)
  })

  it.each([0.8, 1.3])('keeps the feet planted when limb thickness is %s', async (limbThickness) => {
    const rig = await loadRig()
    const base = bounds(skinnedPositions(rig))
    applyProportionsToSkeleton(rig.root, with_({ limbThickness, height: 1.1 }))
    const scaled = bounds(skinnedPositions(rig))
    expect(Math.abs(scaled.min.y - base.min.y)).toBeLessThan(0.005)
  })

  it('moves the shoulders out via clavicles with shoulderWidth and keeps arm length', async () => {
    const rig = await loadRig()
    rig.root.updateMatrixWorld(true)
    const shoulder = worldPosition(rig.bone('upperarm_l')).x
    const armLength = worldPosition(rig.bone('upperarm_l')).distanceTo(worldPosition(rig.bone('hand_l')))
    applyProportionsToSkeleton(rig.root, with_({ shoulderWidth: 1.3 }))
    const points = skinnedPositions(rig)
    expect(worldPosition(rig.bone('upperarm_l')).x).toBeGreaterThan(shoulder * 1.25)
    expect(worldPosition(rig.bone('upperarm_r')).x).toBeLessThan(-shoulder * 1.25)
    expect(worldPosition(rig.bone('upperarm_l')).distanceTo(worldPosition(rig.bone('hand_l')))).toBeCloseTo(armLength, 4)
    expect(points.every((point) => Number.isFinite(point.x + point.y + point.z))).toBe(true)
  })

  it('makes the torso deeper and wider with torsoBulk and waist scale, without a height change', async () => {
    const rig = await loadRig()
    const slice = (points: Vector3[], y: number) => bounds(points.filter((point) => Math.abs(point.y - y) < 0.02 && Math.abs(point.x) < 0.16))
    const before = skinnedPositions(rig)
    applyProportionsToSkeleton(rig.root, with_({ torsoBulk: 1.3, waistScale: 1.25 }))
    const after = skinnedPositions(rig)
    const depth = (box: Box3) => box.max.z - box.min.z
    expect(depth(slice(after, 1.44))).toBeGreaterThan(depth(slice(before, 1.44)) * 1.2)
    expect(depth(slice(after, 1.28))).toBeGreaterThan(depth(slice(before, 1.28)) * 1.15)
    expect(bounds(after).max.y).toBeCloseTo(bounds(before).max.y, 3)
  })

  it('gives the same result for a new rig and for a rig that had other proportions before', async () => {
    const target = with_({ height: 0.9, legRatio: 1.12, shoulderWidth: 1.2, torsoBulk: 1.1, waistScale: 0.9, headScale: 1.2, limbThickness: 1.15 })
    const fresh = await loadRig()
    applyProportionsToSkeleton(fresh.root, target)
    const used = await loadRig()
    applyProportionsToSkeleton(used.root, with_({ height: 1.2, legRatio: 0.85, shoulderWidth: 0.8, torsoBulk: 1.35, limbThickness: 0.8, headScale: 0.85 }))
    applyProportionsToSkeleton(used.root, target)
    applyProportionsToSkeleton(used.root, target)
    const a = skinnedPositions(fresh)
    const b = skinnedPositions(used)
    expect(Math.max(...a.map((point, i) => point.distanceTo(b[i]!)))).toBeLessThan(1e-5)
  })

  it('does not write the animated pelvis translation', async () => {
    const rig = await loadRig()
    const pelvis = rig.bone('pelvis')
    pelvis.position.set(0.1, 0.2, 0.7)
    applyProportionsToSkeleton(rig.root, with_({ waistScale: 1.3, height: 1.1 }))
    expect(pelvis.position.toArray()).toEqual([0.1, 0.2, 0.7])
  })

  it('scales the head around the head joint', async () => {
    const rig = await loadRig()
    const head = (points: Vector3[]) => bounds(points.filter((point) => point.y > 1.78))
    const before = head(skinnedPositions(rig))
    applyProportionsToSkeleton(rig.root, with_({ headScale: 1.3 }))
    const after = head(skinnedPositions(rig))
    expect(after.max.x - after.min.x).toBeGreaterThan((before.max.x - before.min.x) * 1.25)
    expect(worldPosition(rig.bone('Head')).y).toBeCloseTo(1.70581, 3)
  })

  it('extends the arms without moving shoulder joints when armLength increases', async () => {
    const rig = await loadRig()
    rig.root.updateMatrixWorld(true)
    const shoulderBefore = worldPosition(rig.bone('upperarm_l')).x
    const spanBefore = worldPosition(rig.bone('upperarm_l')).distanceTo(worldPosition(rig.bone('hand_l')))
    applyProportionsToSkeleton(rig.root, with_({ armLength: 1.32 }))
    rig.root.updateMatrixWorld(true)
    expect(worldPosition(rig.bone('upperarm_l')).x).toBeCloseTo(shoulderBefore, 4)
    expect(worldPosition(rig.bone('upperarm_l')).distanceTo(worldPosition(rig.bone('hand_l')))).toBeCloseTo(
      spanBefore * 1.32,
      3,
    )
  })

  it('widens pelvis X slightly to prevent inner-thigh crossover on narrow-waist thick-thigh builds', async () => {
    const narrowThin = await loadRig()
    applyProportionsToSkeleton(narrowThin.root, with_({ waistScale: 0.72, limbThickness: 1.0 }))
    const narrowHipX = worldPosition(narrowThin.bone('thigh_l')).x

    const narrowThick = await loadRig()
    applyProportionsToSkeleton(narrowThick.root, with_({ waistScale: 0.72, limbThickness: 1.5 }))
    const separatedHipX = worldPosition(narrowThick.bone('thigh_l')).x

    expect(separatedHipX).toBeGreaterThan(narrowHipX + 0.015)

    // Wide-waist builds without thick limbs keep legacy pelvis width.
    const wide = await loadRig()
    applyProportionsToSkeleton(wide.root, with_({ waistScale: 1.3, limbThickness: 1.0 }))
    expect(worldPosition(wide.bone('thigh_l')).x).toBeCloseTo(0.09428 * (1 + 0.45 * 0.3), 3)
  })

  it('keeps upperarms clear of deep chests even at narrow shoulderWidth=0.8, torsoBulk=1.5, waistScale=1.45', async () => {
    const rig = await loadRig()
    rig.root.updateMatrixWorld(true)
    const defaultUpperarmX = worldPosition(rig.bone('upperarm_l')).x
    applyProportionsToSkeleton(rig.root, with_({ shoulderWidth: 0.8, torsoBulk: 1.5, waistScale: 1.45 }))
    rig.root.updateMatrixWorld(true)
    const upperarmX = worldPosition(rig.bone('upperarm_l')).x
    // Clavicle must push upperarm_l outward beyond default instead of collapsing inward into the widened chest/ribs.
    expect(upperarmX).toBeGreaterThan(defaultUpperarmX + 0.02)
  })

  it('moderates pelvis stretch under legRatio=0.75 and legRatio=1.30 while conserving total standing height even at height=1.45', async () => {
    const baseRig = await loadRig()
    const baseMaxY = bounds(skinnedPositions(baseRig)).max.y
    const basePelvisSpan = worldPosition(baseRig.bone('spine_01')).y - worldPosition(baseRig.bone('thigh_l')).y

    for (const legRatio of [0.75, 1.3]) {
      const rig = await loadRig()
      applyProportionsToSkeleton(rig.root, with_({ legRatio }))
      const box = bounds(skinnedPositions(rig))
      expect(box.max.y).toBeCloseTo(baseMaxY, 2)
      expect(Math.abs(box.min.y)).toBeLessThan(0.01)
      // Real pelvis-to-spine_01 span stays moderated between 0.78x and 1.22x instead of squashing/stretching to torsoY extremes.
      const pelvisSpan = worldPosition(rig.bone('spine_01')).y - worldPosition(rig.bone('thigh_l')).y
      const effectivePelvisY = pelvisSpan / basePelvisSpan
      expect(effectivePelvisY).toBeGreaterThanOrEqual(0.78)
      expect(effectivePelvisY).toBeLessThanOrEqual(1.22)
    }

    // Tall avatars at height=1.45 must conserve the same standing stature across legRatio extremes.
    const tallShort = await loadRig()
    applyProportionsToSkeleton(tallShort.root, with_({ height: 1.45, legRatio: 0.75 }))
    const tallLong = await loadRig()
    applyProportionsToSkeleton(tallLong.root, with_({ height: 1.45, legRatio: 1.3 }))
    const maxShort = bounds(skinnedPositions(tallShort)).max.y
    const maxLong = bounds(skinnedPositions(tallLong)).max.y
    expect(Math.abs(maxShort - maxLong)).toBeLessThan(0.015)
  })

  it('maintains pelvis Z depth containment on narrow-waist thick-thigh builds', async () => {
    const baseRig = await loadRig()
    const pelvisVerts = (pts: Vector3[], minY: number, maxY: number) => pts.filter((p) => p.y >= minY && p.y <= maxY)
    const basePelvisDepth = (() => {
      const b = bounds(pelvisVerts(skinnedPositions(baseRig), 0.92, 1.18))
      return b.max.z - b.min.z
    })()

    const rig = await loadRig()
    applyProportionsToSkeleton(rig.root, with_({ waistScale: 0.8, limbThickness: 1.5 }))
    const scaledPelvisDepth = (() => {
      const b = bounds(pelvisVerts(skinnedPositions(rig), 0.92, 1.18))
      return b.max.z - b.min.z
    })()
    expect(scaledPelvisDepth).toBeGreaterThan(basePelvisDepth * 1.1)
  })

  it('dampens neck_01 stretch and prevents armReach explosion at extreme height=1.45 sliders', async () => {
    const baseRig = await loadRig()
    const baseNeckSpan = worldPosition(baseRig.bone('Head')).y - worldPosition(baseRig.bone('neck_01')).y
    const baseArmSpan = worldPosition(baseRig.bone('upperarm_l')).distanceTo(worldPosition(baseRig.bone('hand_l')))

    const extremeRig = await loadRig()
    applyProportionsToSkeleton(extremeRig.root, with_({ height: 1.45, legRatio: 0.75, armLength: 1.45 }))
    const tallNeckSpan = worldPosition(extremeRig.bone('Head')).y - worldPosition(extremeRig.bone('neck_01')).y
    const tallArmSpan = worldPosition(extremeRig.bone('upperarm_l')).distanceTo(worldPosition(extremeRig.bone('hand_l')))

    expect(tallNeckSpan / baseNeckSpan).toBeLessThanOrEqual(1.36)
    expect(tallArmSpan / baseArmSpan).toBeLessThanOrEqual(1.66)
  })
})

describe('applyProportionsToSkeleton on procedural creature rigs', () => {
  async function loadCreature(path: string, rigName: string, meshName: string): Promise<Rig> {
    const raw = withoutTextures(readFileSync(path))
    const gltf = await new GLTFLoader().parseAsync(raw, '')
    const root = gltf.scene.getObjectByName(rigName)
    const body = gltf.scene.getObjectByName(meshName) as SkinnedMesh | undefined
    if (!root || !body?.isSkinnedMesh) throw new Error(`Missing ${rigName} / ${meshName}`)
    const bone = (name: string) => {
      const found = body.skeleton.bones.find((item) => item.name === name)
      if (!found) throw new Error(`Missing bone ${name}`)
      return found
    }
    return { root, body, bone }
  }

  it.skipIf(!existsSync(QUADRUPED_RIG))('scales Dire Wolf legRatio and bodyLength while keeping paws grounded', async () => {
    const wolf = await loadCreature(QUADRUPED_RIG, 'Quadruped_Rig', 'body_dire_wolf')
    const base = bounds(skinnedPositions(wolf))
    applyProportionsToSkeleton(wolf.root, with_({ height: 1.15, legRatio: 1.2, bodyLength: 1.25, torsoBulk: 1.25, limbThickness: 1.2 }), 'quadruped')
    const scaled = bounds(skinnedPositions(wolf))
    expect(scaled.max.y).toBeGreaterThan(base.max.y * 1.2)
    expect(scaled.max.z - scaled.min.z).toBeGreaterThan((base.max.z - base.min.z) * 1.25)
    expect(Math.abs(scaled.min.y)).toBeLessThan(0.03)
  })

  it.skipIf(!existsSync(QUADRUPED_RIG))(
    'keeps Dire Wolf front and hind paws co-planar on y=0 under extreme torsoBulk and short legs',
    async () => {
      const wolf = await loadCreature(QUADRUPED_RIG, 'Quadruped_Rig', 'body_dire_wolf')
      applyProportionsToSkeleton(
        wolf.root,
        with_({ torsoBulk: 1.55, waistScale: 0.8, legRatio: 0.75, shoulderWidth: 1.35, bodyLength: 1.25 }),
        'quadruped',
      )
      const pts = skinnedPositions(wolf)
      const frontMinY = Math.min(...pts.filter((p) => p.z > 0.1).map((p) => p.y))
      const hindMinY = Math.min(...pts.filter((p) => p.z < -0.1).map((p) => p.y))
      expect(Math.abs(frontMinY - hindMinY)).toBeLessThan(0.005)
      expect(Math.abs(frontMinY)).toBeLessThan(0.01)
      expect(Math.abs(hindMinY)).toBeLessThan(0.01)
    },
  )

  it.skipIf(!existsSync(ARACHNID_RIG))('scales Giant Spider leg span and keeps leg tips pinned near y=0', async () => {
    const spider = await loadCreature(ARACHNID_RIG, 'Arachnid_Rig', 'body_giant_spider')
    const base = bounds(skinnedPositions(spider))
    applyProportionsToSkeleton(spider.root, with_({ height: 1.2, legRatio: 1.25, torsoBulk: 1.25, limbThickness: 1.2 }), 'arachnid')
    const scaled = bounds(skinnedPositions(spider))
    expect(scaled.max.y).toBeGreaterThan(base.max.y * 1.15)
    expect(scaled.max.x - scaled.min.x).toBeGreaterThan((base.max.x - base.min.x) * 1.35)
    expect(Math.abs(scaled.min.y)).toBeLessThan(0.02)
  })
})

describe('scaleAnimatedPelvis', () => {
  it('scales animated pelvis crouch/stride deltas around rest proportionally to UAL1 leg length', async () => {
    const rig = await loadRig()
    const pelvis = rig.bone('pelvis')
    const rest = pelvis.position.clone()
    const p = with_({ height: 1.25 })
    pelvis.position.set(rest.x + 0.04, rest.y - 0.1, rest.z - 0.1)
    scaleAnimatedPelvis(pelvis, rest, p, 'ual1')
    expect(pelvis.position.z).toBeLessThan(rest.z - 0.13)
    expect(pelvis.position.y).toBeLessThan(rest.y - 0.1)
    expect(pelvis.position.y).toBeGreaterThan(rest.y - 0.13)
  })

  it('lifts UAL1 lying/supine poses above y=0 and round-trips through unscaleAnimatedPelvis', async () => {
    const rig = await loadRig()
    const pelvis = rig.bone('pelvis')
    const rest = pelvis.position.clone()
    const applied = new Vector3(1, 1, 1)
    const rawZ = rest.z - 0.94
    pelvis.position.set(rest.x, rest.y + 0.55, rawZ)
    pelvis.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
    scaleAnimatedPelvis(pelvis, rest, with_({ torsoBulk: 1.4, headScale: 1.3 }), 'ual1', applied)
    expect(pelvis.position.z).toBeGreaterThan(rawZ + 0.12)
    unscaleAnimatedPelvis(pelvis, rest, applied)
    expect(pelvis.position.z).toBeCloseTo(rawZ, 5)
  })

  it.skipIf(!existsSync(QUADRUPED_RIG))('scales quadruped pelvis displacement by legRatio and bodyLength', async () => {
    const raw = withoutTextures(readFileSync(QUADRUPED_RIG))
    const gltf = await new GLTFLoader().parseAsync(raw, '')
    const root = gltf.scene.getObjectByName('Quadruped_Rig')!
    const pelvis = root.getObjectByName('pelvis')!
    const rest = pelvis.position.clone()
    pelvis.position.set(rest.x, rest.y - 0.1, rest.z + 0.2)
    scaleAnimatedPelvis(pelvis, rest, with_({ legRatio: 1.25, bodyLength: 1.3 }), 'quadruped')
    expect(pelvis.position.y).toBeCloseTo(rest.y - 0.125, 5)
    expect(pelvis.position.z).toBeCloseTo(rest.z + 0.26, 5)
  })

  it('never compounds pelvis displacement across repeated paused frames or preset switches', async () => {
    const rig = await loadRig()
    const pelvis = rig.bone('pelvis')
    const rest = pelvis.position.clone()
    const rawZ = rest.z - 0.1
    pelvis.position.set(rest.x, rest.y + 0.08, rawZ)
    const applied = new Vector3(1, 1, 1)

    for (let frame = 0; frame < 30; frame++) {
      unscaleAnimatedPelvis(pelvis, rest, applied)
      scaleAnimatedPelvis(pelvis, rest, with_({ height: 1.28 }), 'ual1', applied)
    }
    const once = pelvis.position.clone()

    // Switch back to default height while paused: must recover the exact raw clip pose.
    unscaleAnimatedPelvis(pelvis, rest, applied)
    scaleAnimatedPelvis(pelvis, rest, with_({ height: 1.0 }), 'ual1', applied)
    expect(pelvis.position.z).toBeCloseTo(rawZ, 5)
    expect(applied.toArray()).toEqual([1, 1, 1])

    // And a fresh single-frame scale matches 30 frames of Colossus.
    pelvis.position.set(rest.x, rest.y + 0.08, rawZ)
    scaleAnimatedPelvis(pelvis, rest, with_({ height: 1.28 }), 'ual1')
    expect(pelvis.position.distanceTo(once)).toBeLessThan(1e-5)
  })

  it.skipIf(!existsSync(QUADRUPED_RIG))('scales quadruped side-fall drop safely when torsoBulk is large and legs are short', async () => {
    const raw = withoutTextures(readFileSync(QUADRUPED_RIG))
    const gltf = await new GLTFLoader().parseAsync(raw, '')
    const root = gltf.scene.getObjectByName('Quadruped_Rig')!
    const pelvis = root.getObjectByName('pelvis')!
    const rest = pelvis.position.clone()
    const applied = new Vector3(1, 1, 1)
    pelvis.position.set(rest.x, rest.y - 0.374, rest.z)
    pelvis.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 1.5)
    scaleAnimatedPelvis(
      pelvis,
      rest,
      with_({ legRatio: 0.75, torsoBulk: 1.55, shoulderWidth: 1.55, headScale: 1.4, limbThickness: 1.5 }),
      'quadruped',
      applied,
    )
    expect(pelvis.position.y).toBeGreaterThan(rest.y - 0.15)
    unscaleAnimatedPelvis(pelvis, rest, applied)
    expect(pelvis.position.y).toBeCloseTo(rest.y - 0.374, 5)
  })

  it.skipIf(!existsSync(ARACHNID_RIG))('lifts inverted arachnid body cleanly and round-trips through unscaleAnimatedPelvis', async () => {
    const raw = withoutTextures(readFileSync(ARACHNID_RIG))
    const gltf = await new GLTFLoader().parseAsync(raw, '')
    const root = gltf.scene.getObjectByName('Arachnid_Rig')!
    const body = root.getObjectByName('body')!
    const rest = body.position.clone()
    const applied = new Vector3(1, 1, 1)
    body.position.set(rest.x, rest.y - 0.08, rest.z)
    body.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI)
    scaleAnimatedPelvis(body, rest, with_({ torsoBulk: 1.55, headScale: 1.4 }), 'arachnid', applied)
    expect(body.position.y).toBeGreaterThan(rest.y)
    unscaleAnimatedPelvis(body, rest, applied)
    expect(body.position.y).toBeCloseTo(rest.y - 0.08, 5)
  })

  it('adjusts only palm thickness for armFactor while scaling all axes for limbThickness on held sockets', () => {
    const palmOffset = [-0.0399, 0.09, 0.0053] as const
    const slim = computeHeldSocketPosition(palmOffset, 0.84, 1.0)
    expect(slim.x).toBeCloseTo(-0.0379, 5)
    expect(slim.y).toBeCloseTo(0.09, 5)
    expect(slim.z).toBeCloseTo(0.0053, 5)

    const orc = computeHeldSocketPosition([0.0399, 0.09, 0.0053], 1.24, 1.0)
    expect(orc.x).toBeCloseTo(0.0429, 5)
    expect(orc.y).toBeCloseTo(0.09, 5)
    expect(orc.z).toBeCloseTo(0.0053, 5)

    const thick = computeHeldSocketPosition(palmOffset, 1.0, 1.2)
    expect(thick.x).toBeCloseTo(-0.0399 * 1.07, 5)
    expect(thick.y).toBeCloseTo(0.09 * 1.07, 5)
    expect(thick.z).toBeCloseTo(0.0053 * 1.07, 5)
  })
})

