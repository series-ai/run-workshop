import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AnimationMixer, Mesh, Vector3, type SkinnedMesh } from 'three'
import { z } from 'zod'
import { BUDGETS } from '../contracts/budgets'
import {
  BIPEDAL_MONSTER_CONTRACT,
  HUMANOID_HEADWEAR_VOXEL_SIZE,
  HUMANOID_PROPORTION_DEFAULTS,
  HUMANOID_SILHOUETTE,
  HUMANOID_VOXEL_SIZE,
  PROP_CRAFT,
  buildManifestSchema,
  type AvatarPartEntry,
  type CharacterPreset,
  type HeldItemEntry,
  type WorldPropEntry,
} from '../contracts/catalog'
import { leavesFor, PACK_DEFS, VOXCHAR_PACK_KEYS } from '../contracts/packs'
import { garmentRegionsBelowDarkFloor, MIN_GARMENT_LUMINANCE } from '../contracts/palette'
import { RAGDOLL_RIG_TEMPLATES } from '../contracts/ragdoll'
import { isAnimalRig, RIG_SPECS, UAL1_RIG, type RigId } from '../contracts/rig'
import {
  auditRigClips,
  loadGlbHeadless,
  loadPresetForAudit,
  restPoseVertices,
  serializeReportSummary,
} from '../src/animationAudit'
import { auditCreatureGlb, firstNonRigidVertex, restPose } from '../src/creatureAudit'
import { isIdentityTransform, nodeTriangleCount, parseGlb, readAccessor, type ParsedGlb } from '../src/glbInspect'
import { META_DIR, STAGE_DIR } from '../src/paths'
import { assertVehicleMotion } from '../src/vehicleAudit'

function assertOrthogonalVoxelNormals(glb: ParsedGlb, nodeName: string): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node || node.mesh === undefined) return
  const mesh = glb.doc.meshes?.[node.mesh]
  if (!mesh) return
  const prim = mesh.primitives[0]
  if (!prim || prim.attributes.NORMAL === undefined) return
  const normals = readAccessor(glb, prim.attributes.NORMAL)
  for (let i = 0; i < normals.length; i++) {
    const [nx = 0, ny = 0, nz = 0] = normals[i]!
    const absSum = Math.abs(nx) + Math.abs(ny) + Math.abs(nz)
    const maxAxis = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz))
    if (Math.abs(maxAxis - 1) > 0.02 || Math.abs(absSum - 1) > 0.02) {
      throw new Error(
        `Voxel mesh "${nodeName}" vertex ${i} has non-orthogonal normal (${nx.toFixed(3)}, ${ny.toFixed(3)}, ${nz.toFixed(3)}). Voxel meshes must use axis-aligned normals.`,
      )
    }
  }
}

function assertFiniteWeightsAndPositions(glb: ParsedGlb, nodeName: string, isSkinned: boolean, jointCount: number): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node || node.mesh === undefined) throw new Error(`Missing mesh node "${nodeName}"`)
  if (isSkinned && !isIdentityTransform(node)) {
    throw new Error(`Skinned node "${nodeName}" must have an identity local transform`)
  }
  const mesh = glb.doc.meshes?.[node.mesh]
  if (!mesh || mesh.primitives.length === 0) throw new Error(`Mesh "${nodeName}" has no primitives`)
  if (mesh.primitives.length > 1) {
    throw new Error(`Mesh "${nodeName}" has ${mesh.primitives.length} primitives (must be 1 shared material for S23 Ultra draw-call budget)`)
  }
  const prim = mesh.primitives[0]!
  const posIdx = prim.attributes.POSITION
  if (posIdx === undefined) throw new Error(`Mesh "${nodeName}" missing POSITION`)
  const positions = readAccessor(glb, posIdx)
  for (const row of positions) {
    if (row.some((v) => !Number.isFinite(v))) throw new Error(`Mesh "${nodeName}" has non-finite position`)
  }
  const normIdx = prim.attributes.NORMAL
  if (normIdx === undefined) throw new Error(`Mesh "${nodeName}" missing NORMAL`)
  const normals = readAccessor(glb, normIdx)
  for (const row of normals) {
    const len = Math.hypot(row[0] ?? 0, row[1] ?? 0, row[2] ?? 0)
    if (!Number.isFinite(len) || Math.abs(len - 1) > 0.05) {
      throw new Error(`Mesh "${nodeName}" has non-unit normal (len=${len})`)
    }
  }
  const uvIdx = prim.attributes.TEXCOORD_0
  if (uvIdx === undefined) throw new Error(`Mesh "${nodeName}" missing TEXCOORD_0 for 10-region UV palette`)
  const uvs = readAccessor(glb, uvIdx)
  for (const [u, v] of uvs) {
    if (!Number.isFinite(u) || !Number.isFinite(v) || u! < -0.01 || u! > 1.01 || v! < -0.01 || v! > 1.01) {
      throw new Error(`Mesh "${nodeName}" has out-of-range UV (${u}, ${v})`)
    }
  }
  const uv1Idx = prim.attributes.TEXCOORD_1
  if (uv1Idx === undefined) throw new Error(`Mesh "${nodeName}" missing TEXCOORD_1 for voxel micro-mottle grid`)
  const uv1s = readAccessor(glb, uv1Idx)
  for (const [u, v] of uv1s) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      throw new Error(`Mesh "${nodeName}" has non-finite TEXCOORD_1 (${u}, ${v})`)
    }
  }
  if (isSkinned) {
    if (node.skin === undefined) throw new Error(`Part "${nodeName}" must reference a skin`)
    const jIdx = prim.attributes.JOINTS_0
    const wIdx = prim.attributes.WEIGHTS_0
    if (jIdx === undefined || wIdx === undefined) throw new Error(`Part "${nodeName}" missing JOINTS_0 or WEIGHTS_0`)
    const joints = readAccessor(glb, jIdx)
    const weights = readAccessor(glb, wIdx)
    for (let i = 0; i < weights.length; i++) {
      const wRow = weights[i]!
      const jRow = joints[i]!
      const sum = wRow.reduce((a, b) => a + b, 0)
      if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-3 || wRow.some((w) => w < -1e-6)) {
        throw new Error(`Part "${nodeName}" vertex ${i} has unnormalized weights (sum=${sum})`)
      }
      if (jRow.some((j) => j < 0 || j >= jointCount)) {
        throw new Error(`Part "${nodeName}" vertex ${i} references out-of-range joint`)
      }
    }
    // A voxel segment is rigid (docs/art-direction.md section 3). A blend across a joint bends the cubes.
    const blended = firstNonRigidVertex(weights)
    if (blended >= 0) {
      throw new Error(`Part "${nodeName}" vertex ${blended} has a blended weight. Each voxel segment has weight 1 on one joint.`)
    }
  }
}

const partExtrasSchema = z
  .object({
    polyRegions: z.record(z.string(), z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])).optional(),
    polyCovers: z.array(z.string().min(1)).optional(),
    polyBakeAo: z.boolean().optional(),
  })
  .passthrough()

function assertBakedAo(glb: ParsedGlb, nodeName: string): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node) throw new Error(`Missing mesh node "${nodeName}"`)
  const extras = partExtrasSchema.parse(node.extras ?? {})
  if (extras.polyBakeAo === false) {
    throw new Error(
      `Mesh "${nodeName}" was built with bake_ao=False. Baked AO is mandatory on all characters, monsters, held items, and props.`,
    )
  }
}

function assertNoSelfCover(glb: ParsedGlb, nodeName: string): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node) throw new Error(`Missing mesh node "${nodeName}"`)
  const extras = partExtrasSchema.parse(node.extras ?? {})
  const own = Object.keys(extras.polyRegions ?? {}).filter((tag) => (extras.polyCovers ?? []).includes(tag))
  if (own.length > 0) {
    throw new Error(`Part "${nodeName}" covers its own regions (${own.join(', ')}). The runtime then hides them.`)
  }
}

const REQUIRED_BODY_MORPHS = ['body_slim', 'body_heavy']

function assertMorphAndLayerContracts(glb: ParsedGlb, part: AvatarPartEntry): void {
  if ((part.rigId ?? 'ual1') !== 'ual1') return
  const node = glb.doc.nodes?.find((n) => n.name === part.nodeName)
  if (!node || node.mesh === undefined) return
  const mesh = glb.doc.meshes?.[node.mesh]
  const targetNames = new Set(mesh?.extras?.targetNames ?? [])
  const extras = partExtrasSchema.parse(node.extras ?? {})

  if (part.slot === 'torso' || part.slot === 'legs' || part.slot === 'back') {
    const missing = REQUIRED_BODY_MORPHS.filter((name) => !targetNames.has(name))
    if (missing.length > 0) {
      throw new Error(`Part "${part.id}" (${part.slot}) is missing body morph targets: ${missing.join(', ')}`)
    }
  }
  if (part.slot === 'hair' && !(extras.polyCovers ?? []).includes('hair')) {
    throw new Error(`Hair "${part.id}" must include "hair" in polyCovers so headwear can hide hair cleanly`)
  }
  if (part.slot === 'torso' && !(extras.polyCovers ?? []).includes('chest')) {
    throw new Error(`Torso "${part.id}" must cover at least "chest"`)
  }
}

// ---- Sculpt lattice and canonical voxel silhouette contract (contracts/data/proportions.json) ----

interface Extent {
  min: [number, number, number]
  max: [number, number, number]
}

const size = (extent: Extent, axis: 0 | 1 | 2): number => extent.max[axis] - extent.min[axis]

const latticeExtrasSchema = z.object({
  polyLattice: z.object({ voxelSize: z.number().positive(), maxPad: z.number().nonnegative() }),
})

/** One voxel-human or bipedal-monster part in the sculpt pose: the rest pose of the rig with the default humanoid proportions. */
interface SculptedPart {
  part: AvatarPartEntry
  positions: Float64Array
  /** UAL1 joint index of each vertex. Voxel segments are rigid: joint slot 0 has weight 1. */
  joints: ArrayLike<number>
  voxelSize: number
  maxPad: number
}

const isSculptedMonsterBody = (part: AvatarPartEntry): boolean =>
  part.pack === 'creatures' || (part.slot === 'body' && /^body_(orc|troll|ogre|goblin|golem|demon|giant)_/.test(part.id))
const isVoxelHumanPart = (part: AvatarPartEntry): boolean => (part.rigId ?? 'ual1') === 'ual1' && !isSculptedMonsterBody(part)

/** Skin one part through the runtime path (`restPoseVertices`) with `HUMANOID_PROPORTION_DEFAULTS`. */
async function sculptPart(
  part: AvatarPartEntry,
  path: string,
  cache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<SculptedPart> {
  let gltf = cache.get(path)
  if (!gltf) {
    gltf = await loadGlbHeadless(path)
    cache.set(path, gltf)
  }
  const mesh = gltf.scene.getObjectByName(part.nodeName) as SkinnedMesh | undefined
  if (!mesh?.isSkinnedMesh) throw new Error(`Part "${part.id}" node "${part.nodeName}" is not a SkinnedMesh.`)
  const extras = latticeExtrasSchema.safeParse(mesh.userData)
  if (!extras.success) throw new Error(`Part "${part.id}" has no polyLattice extras. Sculpt it with build_core.skinned_mesh.`)
  const expectedVoxelSize = part.slot === 'headwear' ? HUMANOID_HEADWEAR_VOXEL_SIZE : HUMANOID_VOXEL_SIZE
  if (Math.abs(extras.data.polyLattice.voxelSize - expectedVoxelSize) > 1e-9) {
    throw new Error(`Part "${part.id}" has ${extras.data.polyLattice.voxelSize} m voxels. The contract is ${expectedVoxelSize} m.`)
  }
  const [posed] = restPoseVertices(gltf.scene, [mesh], HUMANOID_PROPORTION_DEFAULTS, 'ual1')
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const joints = Array.from({ length: skinIndex.count }, (_, i) => skinIndex.getX(i))
  return {
    part,
    positions: posed!.positions,
    joints,
    voxelSize: extras.data.polyLattice.voxelSize,
    maxPad: extras.data.polyLattice.maxPad,
  }
}

/**
 * Each face of a voxel human is on the half lattice of `HUMANOID_VOXEL_SIZE` (or full `HAT_VOX` for
 * `0.025 m` headwear) in the sculpt pose. A layer pad moves a face off the lattice by `maxPad` at most.
 * A vertex that is not on the lattice shows that the mesh was not sculpted for the default proportions:
 * the runtime then shows voxels that are not cubes.
 */
function assertOnSculptLattice(sculpted: SculptedPart): void {
  const step = Math.min(HUMANOID_VOXEL_SIZE / 2, sculpted.voxelSize)
  const tolerance = sculpted.maxPad + 5e-4
  for (let i = 0; i < sculpted.positions.length; i++) {
    const value = sculpted.positions[i]!
    const offset = Math.abs(value - Math.round(value / step) * step)
    if (offset > tolerance) {
      const vertex = Math.floor(i / 3)
      const at = [0, 1, 2].map((axis) => sculpted.positions[vertex * 3 + axis]!.toFixed(4)).join(', ')
      throw new Error(
        `Part "${sculpted.part.id}" vertex ${vertex} (${at}) is ${(offset * 1000).toFixed(1)} mm off the ${step} m sculpt lattice ` +
          `(tolerance ${(tolerance * 1000).toFixed(1)} mm). Sculpt the part on the lattice of build_core.py.`,
      )
    }
  }
}

/** Bounds of the vertices of one sculpted part that one joint owns. */
function jointExtent(sculpted: SculptedPart, jointName: string, minY = -Infinity): Extent {
  const joint = RIG_SPECS.ual1.joints.indexOf(jointName)
  if (joint < 0) throw new Error(`"${jointName}" is not a UAL1 joint`)
  const extent: Extent = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  let count = 0
  for (let i = 0; i < sculpted.joints.length; i++) {
    if (sculpted.joints[i] !== joint) continue
    if (sculpted.positions[i * 3 + 1]! < minY) continue
    count++
    for (const axis of [0, 1, 2] as const) {
      const value = sculpted.positions[i * 3 + axis]!
      if (value < extent.min[axis]) extent.min[axis] = value
      if (value > extent.max[axis]) extent.max[axis] = value
    }
  }
  if (count === 0) throw new Error(`Part "${sculpted.part.id}" has no vertices on joint "${jointName}"`)
  return extent
}

interface SilhouetteSample {
  id: string
  value: number
  height?: number
}

/** Measured widths of the human parts. The validator compares each head with each torso and each body. */
interface SilhouetteMeasures {
  faces: SilhouetteSample[]
  hair: SilhouetteSample[]
  headwear: SilhouetteSample[]
  chests: SilhouetteSample[]
  necks: SilhouetteSample[]
  arms: SilhouetteSample[]
}

/**
 * Face width of a head part: the width of the top face of its skin skull. The ears and a beard go out of
 * the skull lower on the head, thus the top face gives the skull only.
 */
function measureHead(sculpted: SculptedPart, measures: SilhouetteMeasures): void {
  const head = jointExtent(sculpted, 'Head')
  const faceWidth = size(jointExtent(sculpted, 'Head', head.max[1] - 1e-4), 0)
  const ratio = size(head, 1) / faceWidth
  if (ratio < HUMANOID_SILHOUETTE.minFacePortraitRatio) {
    throw new Error(
      `Head "${sculpted.part.id}" has a ${faceWidth.toFixed(3)} m wide face and is ${size(head, 1).toFixed(3)} m tall (ratio ${ratio.toFixed(2)} < ${HUMANOID_SILHOUETTE.minFacePortraitRatio}). Canonical voxel faces are long and thin.`,
    )
  }
  measures.faces.push({ id: sculpted.part.id, value: faceWidth })
}

function measureLowerLimb(sculpted: SculptedPart): void {
  const thigh = jointExtent(sculpted, 'thigh_l')
  const calf = jointExtent(sculpted, 'calf_l')
  const foot = jointExtent(sculpted, 'foot_l')
  const ball = jointExtent(sculpted, 'ball_l')
  const calfRatio = size(calf, 0) / size(thigh, 0)
  if (calfRatio < HUMANOID_SILHOUETTE.minCalfToThighWidth) {
    throw new Error(
      `Part "${sculpted.part.id}" calf (${size(calf, 0).toFixed(3)} m) is ${(calfRatio * 100).toFixed(0)}% of thigh (${size(thigh, 0).toFixed(3)} m). Minimum is ${(HUMANOID_SILHOUETTE.minCalfToThighWidth * 100).toFixed(0)}%.`,
    )
  }
  const heelOffset = Math.abs(foot.min[2] - calf.min[2])
  if (heelOffset > HUMANOID_SILHOUETTE.maxHeelBackOffset) {
    throw new Error(
      `Part "${sculpted.part.id}" shoe heel back (${foot.min[2].toFixed(3)} m) is ${(heelOffset * 1000).toFixed(1)} mm off calf back (${calf.min[2].toFixed(3)} m). Canonical voxel shoes sit flush at the calf back.`,
    )
  }
  const shoeLength = Math.max(foot.max[2], ball.max[2]) - Math.min(foot.min[2], ball.min[2])
  if (shoeLength < HUMANOID_SILHOUETTE.minShoeLength) {
    throw new Error(
      `Part "${sculpted.part.id}" shoe length is ${shoeLength.toFixed(3)} m < ${HUMANOID_SILHOUETTE.minShoeLength} m.`,
    )
  }
  const toeStep = ball.max[2] - foot.max[2]
  if (toeStep < HUMANOID_SILHOUETTE.minToeStep) {
    throw new Error(
      `Part "${sculpted.part.id}" sole toe overhang is ${toeStep.toFixed(3)} m < ${HUMANOID_SILHOUETTE.minToeStep} m.`,
    )
  }
}

function measureSilhouettePart(sculpted: SculptedPart, measures: SilhouetteMeasures): void {
  const { part } = sculpted
  if (part.slot === 'head') measureHead(sculpted, measures)
  if (part.slot === 'hair') measures.hair.push({ id: part.id, value: size(jointExtent(sculpted, 'Head'), 0) })
  if (part.slot === 'headwear') {
    const ext = jointExtent(sculpted, 'Head')
    measures.headwear.push({ id: part.id, value: size(ext, 0), height: size(ext, 1) })
  }
  if (part.slot === 'torso') measures.chests.push({ id: part.id, value: size(jointExtent(sculpted, 'spine_03'), 0) })
  if (part.slot === 'body') {
    measures.necks.push({ id: part.id, value: size(jointExtent(sculpted, 'neck_01'), 0) })
    measures.arms.push({ id: part.id, value: size(jointExtent(sculpted, 'upperarm_l'), 2) })
    measureLowerLimb(sculpted)
  }
  if (part.slot === 'legs') {
    measureLowerLimb(sculpted)
  }
}

function assertSilhouetteContract(measures: SilhouetteMeasures): void {
  const percent = (ratio: number): string => `${(ratio * 100).toFixed(0)}%`
  const [minFace, maxFace] = HUMANOID_SILHOUETTE.faceToChestWidth
  const [minEnvelope, maxEnvelope] = HUMANOID_SILHOUETTE.headEnvelopeToChestWidth
  const [minHat, maxHat] = HUMANOID_SILHOUETTE.headwearToChestWidth
  for (const chest of measures.chests) {
    for (const face of measures.faces) {
      const ratio = face.value / chest.value
      if (ratio < minFace || ratio > maxFace) {
        throw new Error(
          `Head "${face.id}" (${face.value.toFixed(3)} m face) is ${percent(ratio)} of the chest of "${chest.id}" (${chest.value.toFixed(3)} m). The range is ${percent(minFace)} to ${percent(maxFace)}.`,
        )
      }
    }
    for (const hair of measures.hair) {
      const ratio = hair.value / chest.value
      if (ratio < minEnvelope || ratio > maxEnvelope) {
        throw new Error(
          `Hair "${hair.id}" (${hair.value.toFixed(3)} m) is ${percent(ratio)} of the chest of "${chest.id}" (${chest.value.toFixed(3)} m). The head envelope range is ${percent(minEnvelope)} to ${percent(maxEnvelope)}.`,
        )
      }
    }
    for (const hat of measures.headwear) {
      const ratio = hat.value / chest.value
      if (ratio < minHat || ratio > maxHat) {
        throw new Error(
          `Headwear "${hat.id}" (${hat.value.toFixed(3)} m) is ${percent(ratio)} of the chest of "${chest.id}" (${chest.value.toFixed(3)} m). The headwear range is ${percent(minHat)} to ${percent(maxHat)}.`,
        )
      }
      if ((hat.height ?? 0) > HUMANOID_SILHOUETTE.maxHeadwearHeight) {
        throw new Error(
          `Headwear "${hat.id}" height (${hat.height!.toFixed(3)} m) exceeds maxHeadwearHeight (${HUMANOID_SILHOUETTE.maxHeadwearHeight} m).`,
        )
      }
    }
    for (const arm of measures.arms) {
      const ratio = arm.value / chest.value
      if (ratio < HUMANOID_SILHOUETTE.minArmToChestWidth) {
        throw new Error(
          `The bare arm of "${arm.id}" (${arm.value.toFixed(3)} m) is ${percent(ratio)} of the chest of "${chest.id}". The minimum is ${percent(HUMANOID_SILHOUETTE.minArmToChestWidth)}.`,
        )
      }
    }
  }
  for (const face of measures.faces) {
    for (const neck of measures.necks) {
      const ratio = neck.value / face.value
      if (ratio < HUMANOID_SILHOUETTE.minNeckToFaceWidth) {
        throw new Error(
          `The neck of "${neck.id}" (${neck.value.toFixed(3)} m) is ${percent(ratio)} of the face of "${face.id}". The minimum is ${percent(HUMANOID_SILHOUETTE.minNeckToFaceWidth)}.`,
        )
      }
    }
  }
}

function assertBipedalMonsterContract(sculpted: SculptedPart): void {
  const { silhouette } = BIPEDAL_MONSTER_CONTRACT
  const chest = jointExtent(sculpted, 'spine_03')
  const waist = jointExtent(sculpted, 'spine_02')
  const pelvis = jointExtent(sculpted, 'pelvis')
  const head = jointExtent(sculpted, 'Head')
  const foot = jointExtent(sculpted, 'foot_l')
  const ballIdx = RIG_SPECS.ual1.joints.indexOf('ball_l')
  const hasBall = ballIdx >= 0 && Array.from(sculpted.joints).includes(ballIdx)
  const ball = hasBall ? jointExtent(sculpted, 'ball_l') : foot

  const waistRatio = size(waist, 0) / size(chest, 0)
  if (waistRatio > silhouette.maxWaistToChestWidth) {
    throw new Error(
      `Monster "${sculpted.part.id}" waist/chest width ratio is ${waistRatio.toFixed(3)} > ${silhouette.maxWaistToChestWidth} (must V-taper, not read as a straight block)`,
    )
  }
  const headDepth = size(head, 2)
  if (headDepth < silhouette.minHeadDepthMeters) {
    throw new Error(
      `Monster "${sculpted.part.id}" head depth ${headDepth.toFixed(3)} m < minHeadDepthMeters (${silhouette.minHeadDepthMeters} m)`,
    )
  }
  const headCenterZ = (head.min[2] + head.max[2]) / 2
  const pelvisCenterZ = (pelvis.min[2] + pelvis.max[2]) / 2
  const forwardOffset = headCenterZ - pelvisCenterZ
  if (forwardOffset < silhouette.minHeadForwardOffset) {
    throw new Error(
      `Monster "${sculpted.part.id}" head forward offset ${forwardOffset.toFixed(3)} m < minHeadForwardOffset (${silhouette.minHeadForwardOffset} m)`,
    )
  }
  const footLength = Math.max(foot.max[2], ball.max[2]) - Math.min(foot.min[2], ball.min[2])
  if (footLength < silhouette.minFootLengthMeters) {
    throw new Error(
      `Monster "${sculpted.part.id}" foot length ${footLength.toFixed(3)} m < minFootLengthMeters (${silhouette.minFootLengthMeters} m)`,
    )
  }
}

function creatureSideSpec(rigId: RigId): { axis: 0 | 2; leftSign: 1 | -1; leftPattern: RegExp; rightPattern: RegExp } {
  if (rigId === 'quadruped') {
    return { axis: 0, leftSign: 1, leftPattern: /^leg_(fl|bl)_/, rightPattern: /^leg_(fr|br)_/ }
  }
  if (rigId === 'arachnid') {
    return { axis: 0, leftSign: 1, leftPattern: /^leg_[1-4]_l_/, rightPattern: /^leg_[1-4]_r_/ }
  }
  if (
    rigId === 'fox' ||
    rigId === 'horse' ||
    rigId === 'aquatic' ||
    rigId === 'avian' ||
    rigId === 'serpent' ||
    rigId === 'dragon' ||
    rigId === 'kaiju'
  ) {
    return { axis: 0, leftSign: 1, leftPattern: /_l$/, rightPattern: /_r$/ }
  }
  if (rigId === 'corgi') {
    return { axis: 0, leftSign: 1, leftPattern: /^Left/, rightPattern: /^Right/ }
  }
  if (rigId === 'gsd' || rigId === 'cat') {
    // Forward +X: character-left is -Z, character-right is +Z
    return { axis: 2, leftSign: -1, leftPattern: /\.L$/, rightPattern: /\.R$/ }
  }
  // wolf, pug: Forward +Z, .L / .R
  return { axis: 0, leftSign: 1, leftPattern: /\.L$/, rightPattern: /\.R$/ }
}

async function assertCreatureLegSides(
  partPath: string,
  nodeName: string,
  rigId: RigId,
  cache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  if (rigId === 'ual1') return
  let gltf = cache.get(partPath)
  if (!gltf) {
    gltf = await loadGlbHeadless(partPath)
    cache.set(partPath, gltf)
  }
  const mesh = gltf.scene.getObjectByName(nodeName) as SkinnedMesh | undefined
  if (!mesh?.isSkinnedMesh) return
  const rest = restPose(gltf.scene, mesh)
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const skinWeight = mesh.geometry.getAttribute('skinWeight')
  const bySanitized = new Map<string, string>()
  for (const jName of RIG_SPECS[rigId].joints) {
    bySanitized.set(jName.replace(/[. :/\[\]]/g, ''), jName)
  }
  const { axis, leftSign, leftPattern, rightPattern } = creatureSideSpec(rigId)
  const count = skinIndex.count
  for (let i = 0; i < count; i++) {
    const coord = rest.positions[i * 3 + axis]! * leftSign
    if (Math.abs(coord) < 0.08) continue
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k)
      if (w <= 0.1) continue
      const bone = mesh.skeleton.bones[skinIndex.getComponent(i, k)]
      const rawName = bone?.name ?? ''
      const jName = bySanitized.get(rawName) ?? rawName
      if (coord > 0.08 && rightPattern.test(jName)) {
        throw new Error(`Creature "${nodeName}" vertex ${i} on left side (${(coord * leftSign).toFixed(3)}) is weighted to right-side joint "${jName}"`)
      }
      if (coord < -0.08 && leftPattern.test(jName)) {
        throw new Error(`Creature "${nodeName}" vertex ${i} on right side (${(coord * leftSign).toFixed(3)}) is weighted to left-side joint "${jName}"`)
      }
    }
  }
}

function assertHeldPalmClearance(glb: ParsedGlb, held: HeldItemEntry): void {
  const node = glb.doc.nodes?.find((n) => n.name === held.nodeName)
  if (!node || node.mesh === undefined) return
  const mesh = glb.doc.meshes?.[node.mesh]
  const prim = mesh?.primitives[0]
  if (!prim || prim.attributes.POSITION === undefined) return
  const pos = readAccessor(glb, prim.attributes.POSITION)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x = 0, y = 0, z = 0] of pos) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  if (held.gripStyle === 'forearm_shield') {
    if (held.hand !== 'hand_l') {
      throw new Error(`Forearm shield "${held.id}" must use hand_l, got ${held.hand}`)
    }
    if (maxX < 0.115 || minX < -0.05) {
      throw new Error(
        `Forearm shield "${held.id}" must mount flat on the outer left forearm (+X >= 0.115 m, minX >= -0.05 m; got X=[${minX.toFixed(3)}, ${maxX.toFixed(3)}])`,
      )
    }
    if (minZ > -0.14) {
      throw new Error(
        `Forearm shield "${held.id}" must extend up the forearm toward the elbow (-Z <= -0.14 m; got minZ=${minZ.toFixed(3)})`,
      )
    }
    if (minY > 0.04 || maxY < -0.04 || maxZ < -0.06) {
      throw new Error(`Forearm shield "${held.id}" grip origin (0,0,0) is far from geometry`)
    }
    return
  }
  const palmClear = held.hand === 'hand_r' ? minX >= -0.032 : maxX <= 0.032
  if (!palmClear) {
    throw new Error(
      `Held item "${held.id}" (${held.hand}) penetrates palm back (bounds X=[${minX.toFixed(3)}, ${maxX.toFixed(3)}])`,
    )
  }
  if (minY > 0.04 || maxY < -0.04 || minZ > 0.06 || maxZ < -0.06) {
    throw new Error(`Held item "${held.id}" grip origin (0,0,0) is far from geometry`)
  }
}

function assertPropCraft(glb: ParsedGlb, prop: WorldPropEntry): void {
  const height = prop.bounds.max[1] - prop.bounds.min[1]
  if (height < PROP_CRAFT.minHeightMeters) {
    throw new Error(`Prop "${prop.id}" height ${height.toFixed(3)} m < minHeightMeters (${PROP_CRAFT.minHeightMeters} m)`)
  }
  const node = glb.doc.nodes?.find((n) => n.name === prop.nodeName)
  if (!node || node.mesh === undefined) return
  const prim = glb.doc.meshes?.[node.mesh]?.primitives[0]
  if (!prim || prim.attributes.TEXCOORD_0 === undefined) return
  const uvs = readAccessor(glb, prim.attributes.TEXCOORD_0)
  const shades = new Set<string>()
  for (const [u = 0, v = 0] of uvs) {
    shades.add(`${Math.round(u * 256)}:${Math.round(v * 256)}`)
  }
  if (shades.size < PROP_CRAFT.minUniqueShades) {
    throw new Error(`Prop "${prop.id}" has only ${shades.size} unique UV shade(s); minimum is ${PROP_CRAFT.minUniqueShades}`)
  }
}

async function assertHeldPresetClips(
  presets: readonly CharacterPreset[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  const heldPresets = presets.filter((p) => (p.rigId ?? 'ual1') === 'ual1' && (p.heldRight || p.heldLeft))
  if (heldPresets.length === 0) return
  const coreRel = '3D/characters/core-rig.glb'
  const corePath = join(STAGE_DIR, PACK_DEFS.core.dir, coreRel)
  let coreGltf = auditCache.get(corePath)
  if (!coreGltf) {
    coreGltf = await loadGlbHeadless(corePath)
    auditCache.set(corePath, coreGltf)
  }
  const root = coreGltf.scene
  const handR = root.getObjectByName('hand_r')
  const handL = root.getObjectByName('hand_l')
  const mid3R = root.getObjectByName('middle_03_r')
  const mid3L = root.getObjectByName('middle_03_l')
  if (!handR || !handL || !mid3R || !mid3L) throw new Error('core-rig.glb missing hand/finger bones for held audit')
  const sockets = UAL1_RIG.heldSockets
  const dummyR = new Mesh()
  dummyR.position.fromArray(sockets.hand_r.palmOffset)
  dummyR.rotation.set(sockets.hand_r.rotationEuler[0], sockets.hand_r.rotationEuler[1], sockets.hand_r.rotationEuler[2], 'XYZ')
  const dummyL = new Mesh()
  dummyL.position.fromArray(sockets.hand_l.palmOffset)
  dummyL.rotation.set(sockets.hand_l.rotationEuler[0], sockets.hand_l.rotationEuler[1], sockets.hand_l.rotationEuler[2], 'XYZ')
  handR.add(dummyR)
  handL.add(dummyL)
  const mixer = new AnimationMixer(root)
  const pR = new Vector3()
  const pL = new Vector3()
  const tip = new Vector3()
  try {
    for (const preset of heldPresets) {
      const clip = coreGltf.animations.find((c) => c.name === preset.clip)
      if (!clip) throw new Error(`Preset "${preset.id}" references missing clip "${preset.clip}"`)
      for (let step = 0; step < 8; step++) {
        mixer.stopAllAction()
        mixer.clipAction(clip).reset().play()
        mixer.setTime((clip.duration * step) / 8)
        root.updateMatrixWorld(true)
        dummyR.getWorldPosition(pR)
        dummyL.getWorldPosition(pL)
        if (preset.heldRight) {
          mid3R.getWorldPosition(tip).applyMatrix4(dummyR.matrixWorld.clone().invert())
          if (tip.z > 0.05) {
            throw new Error(`Preset "${preset.id}" holds ${preset.heldRight} in open-hand clip "${preset.clip}" (mid3.z=${tip.z.toFixed(3)})`)
          }
        }
        if (preset.heldLeft) {
          mid3L.getWorldPosition(tip).applyMatrix4(dummyL.matrixWorld.clone().invert())
          if (tip.z > 0.05) {
            throw new Error(`Preset "${preset.id}" holds ${preset.heldLeft} in open-hand clip "${preset.clip}" (mid3.z=${tip.z.toFixed(3)})`)
          }
        }
        if (preset.heldRight && preset.heldLeft) {
          const dist = pR.distanceTo(pL)
          if (dist < 0.25) {
            throw new Error(`Preset "${preset.id}" two-handed clip "${preset.clip}" brings held sockets too close (${dist.toFixed(3)}m < 0.25m)`)
          }
        }
      }
    }
  } finally {
    mixer.stopAllAction()
    handR.remove(dummyR)
    handL.remove(dummyL)
  }
}

function assertRigSkeleton(glb: ParsedGlb, fileLabel: string, rigId: RigId): void {
  const expected = RIG_SPECS[rigId].joints
  const skins = glb.doc.skins ?? []
  if (skins.length !== 1) throw new Error(`${fileLabel}: expected exactly 1 skin, found ${skins.length}`)
  const joints = skins[0]!.joints.map((idx) => glb.doc.nodes?.[idx]?.name ?? '')
  if (joints.length !== expected.length) {
    throw new Error(`${fileLabel} (${rigId}): expected ${expected.length} joints, found ${joints.length}`)
  }
  for (let i = 0; i < expected.length; i++) {
    if (joints[i] !== expected[i]) {
      throw new Error(`${fileLabel} (${rigId}): joint[${i}] is "${joints[i]}", expected "${expected[i]}"`)
    }
  }
}

async function main(): Promise<void> {
  const manifestPath = join(META_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error(`Missing build manifest: ${manifestPath}. Run npm run build first.`)
  const manifest = buildManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))

  let totalModels = 0
  let totalParts = 0

  for (const pack of VOXCHAR_PACK_KEYS) {
    for (const leaf of leavesFor(pack)) {
      const licPath = join(STAGE_DIR, leaf.id, 'License.txt')
      if (!existsSync(licPath)) throw new Error(`Missing License.txt in ${leaf.id}`)
    }
  }

  const allParts = manifest.packs.flatMap((p) => p.parts)
  const allHeld = manifest.packs.flatMap((p) => p.heldItems)
  const silhouette: SilhouetteMeasures = { faces: [], hair: [], headwear: [], chests: [], necks: [], arms: [] }
  const sculptCache = new Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>()
  const creatureAudits: string[] = []

  for (const cat of manifest.packs) {
    const charLeafDir = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === 'characters')!.id)
    if (cat.pack === 'core') {
      if (!cat.rigModelPath) throw new Error('core pack missing rigModelPath')
      const rigPath = join(charLeafDir, cat.rigModelPath)
      const glb = parseGlb(rigPath)
      assertRigSkeleton(glb, rigPath, 'ual1')
      const anims = new Set((glb.doc.animations ?? []).map((a) => a.name ?? ''))
      for (const reqClip of RIG_SPECS.ual1.clips) {
        if (!anims.has(reqClip)) throw new Error(`core-rig.glb missing required UAL1 clip "${reqClip}"`)
      }
      if ((glb.doc.materials?.length ?? 0) > 1) {
        throw new Error(`core-rig.glb has ${glb.doc.materials?.length} materials; S23 Ultra budget allows 1`)
      }
    }

    for (const creatureRig of cat.creatureRigs ?? []) {
      const rigPath = join(charLeafDir, creatureRig.rigModelPath)
      const glb = parseGlb(rigPath)
      assertRigSkeleton(glb, rigPath, creatureRig.rigId)
      const anims = new Set((glb.doc.animations ?? []).map((a) => a.name ?? ''))
      for (const reqClip of RIG_SPECS[creatureRig.rigId].clips) {
        if (!anims.has(reqClip)) {
          throw new Error(`${creatureRig.rigModelPath} missing required ${creatureRig.rigId} clip "${reqClip}"`)
        }
      }
      if ((glb.doc.materials?.length ?? 0) > 1) {
        throw new Error(`${creatureRig.rigModelPath} has ${glb.doc.materials?.length} materials; S23 Ultra budget allows 1`)
      }
    }

    const partsBySlot = new Map<string, AvatarPartEntry[]>()
    const glbCache = new Map<string, ParsedGlb>()
    const loadCached = (leafKind: 'characters' | 'world', rel: string): ParsedGlb => {
      const leafDir = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === leafKind)!.id)
      const full = join(leafDir, rel)
      let hit = glbCache.get(full)
      if (!hit) {
        hit = parseGlb(full)
        glbCache.set(full, hit)
      }
      return hit
    }

    for (const part of cat.parts) {
      totalParts++
      const rigId = part.rigId ?? 'ual1'
      const glb = loadCached(part.leaf, part.relativePath)
      assertRigSkeleton(glb, part.relativePath, rigId)
      assertFiniteWeightsAndPositions(glb, part.nodeName, true, RIG_SPECS[rigId].joints.length)
      if (!isAnimalRig(rigId)) {
        assertOrthogonalVoxelNormals(glb, part.nodeName)
      }
      if (part.pack !== 'creatures') {
        assertBakedAo(glb, part.nodeName)
      }
      assertNoSelfCover(glb, part.nodeName)
      assertMorphAndLayerContracts(glb, part)
      const partPath = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === part.leaf)!.id, part.relativePath)
      if (isVoxelHumanPart(part)) {
        const sculpted = await sculptPart(part, partPath, sculptCache)
        assertOnSculptLattice(sculpted)
        measureSilhouettePart(sculpted, silhouette)
      } else if (part.pack !== 'creatures' && isSculptedMonsterBody(part)) {
        const sculpted = await sculptPart(part, partPath, sculptCache)
        assertOnSculptLattice(sculpted)
        if (BIPEDAL_MONSTER_CONTRACT.requireBakedAo) {
          assertBakedAo(glb, part.nodeName)
        }
        assertBipedalMonsterContract(sculpted)
      }
      await assertCreatureLegSides(partPath, part.nodeName, rigId, sculptCache)
      if (rigId !== 'ual1') {
        // World lattice, rest-pose normals, grounded feet, the quadruped silhouette and the motion of each clip.
        const audit = await auditCreatureGlb(partPath, {
          nodeName: part.nodeName,
          contractQuadruped: rigId === 'quadruped',
          allowFloating: rigId === 'aquatic',
        })
        if (audit.problems.length > 0) {
          throw new Error(`Creature "${part.id}" (${rigId}) breaks ${audit.problems.length} rule(s):\n  - ${audit.problems.join('\n  - ')}`)
        }
        creatureAudits.push(`${part.id} ${audit.segments} segments, ${audit.clips.length} clips, max gap ${Math.max(0, ...audit.clips.map((c) => c.gap)).toFixed(2)} voxels`)
      }
      if (!part.ragdollColliders || Object.keys(part.ragdollColliders).length === 0) {
        throw new Error(`Part "${part.id}" is missing mesh-measured ragdollColliders`)
      }
      if (part.slot === 'body') {
        const expectedBodies = RAGDOLL_RIG_TEMPLATES[rigId].bodies.length
        const foundBodies = Object.keys(part.ragdollColliders).length
        if (foundBodies !== expectedBodies) {
          throw new Error(`Body part "${part.id}" (${rigId}) has ${foundBodies} ragdollColliders, expected ${expectedBodies}`)
        }
      }
      const node = glb.doc.nodes!.find((n) => n.name === part.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      const budget = BUDGETS.classes[part.slot]
      if (tris > budget.maxTriangles) {
        throw new Error(`Part "${part.id}" has ${tris} tris > budget ${budget.maxTriangles}`)
      }
      const arr = partsBySlot.get(part.slot) ?? []
      arr.push(part)
      partsBySlot.set(part.slot, arr)
    }

    for (const held of cat.heldItems) {
      totalModels++
      const glb = loadCached(held.leaf, held.relativePath)
      assertFiniteWeightsAndPositions(glb, held.nodeName, false, 0)
      assertOrthogonalVoxelNormals(glb, held.nodeName)
      assertBakedAo(glb, held.nodeName)
      assertHeldPalmClearance(glb, held)
      const node = glb.doc.nodes!.find((n) => n.name === held.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      if (tris > BUDGETS.classes.held.maxTriangles) {
        throw new Error(`Held "${held.id}" has ${tris} tris > budget ${BUDGETS.classes.held.maxTriangles}`)
      }
      const bytes = statSync(join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === held.leaf)!.id, held.relativePath)).size
      if (bytes > (BUDGETS.classes.held.maxBytes ?? Infinity)) {
        throw new Error(`Held "${held.id}" is ${bytes} bytes > budget`)
      }
    }

    for (const prop of [...cat.props, ...cat.levelKitProps]) {
      totalModels++
      const glb = loadCached(prop.leaf, prop.relativePath)
      assertFiniteWeightsAndPositions(glb, prop.nodeName, false, 0)
      assertOrthogonalVoxelNormals(glb, prop.nodeName)
      assertBakedAo(glb, prop.nodeName)
      assertPropCraft(glb, prop)
      const node = glb.doc.nodes!.find((n) => n.name === prop.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      const budget = prop.relativePath.startsWith('level-kit/') ? BUDGETS.classes.levelProp : BUDGETS.classes.prop
      if (tris > budget.maxTriangles) {
        throw new Error(`Prop "${prop.id}" has ${tris} tris > budget ${budget.maxTriangles}`)
      }
      const leaf = leavesFor(cat.pack).find((candidate) => candidate.kind === prop.leaf)!
      const bytes = statSync(join(STAGE_DIR, leaf.id, prop.relativePath)).size
      if (bytes > (budget.maxBytes ?? Infinity)) {
        throw new Error(`Prop "${prop.id}" is ${bytes} bytes > budget`)
      }
      if (Math.abs(prop.bounds.min[1]) > 0.015) {
        throw new Error(`Prop "${prop.id}" not grounded on y=0 (min.y=${prop.bounds.min[1]})`)
      }
    }

    for (const { leaf: kind, motion } of cat.levelKitProps) {
      if (!motion) continue
      const leaf = leavesFor(cat.pack).find((candidate) => candidate.kind === kind)!
      await assertVehicleMotion(join(STAGE_DIR, leaf.id, motion.relativePath), motion)
    }

    for (const preset of cat.presets) {
      const rigId = preset.rigId ?? 'ual1'
      if (!preset.ragdoll) {
        throw new Error(`Preset "${preset.id}" is missing ragdoll physics metadata`)
      }
      const expectedBodies = RAGDOLL_RIG_TEMPLATES[rigId].bodies.length
      if (preset.ragdoll.rigId !== rigId || preset.ragdoll.bodies.length !== expectedBodies) {
        throw new Error(
          `Preset "${preset.id}" ragdoll has ${preset.ragdoll.bodies.length} bodies (${preset.ragdoll.rigId}), expected ${expectedBodies} (${rigId})`,
        )
      }
      const crushed = garmentRegionsBelowDarkFloor(preset.palette)
      if (crushed.length > 0) {
        throw new Error(
          `Preset "${preset.id}" palette regions ${crushed.join(', ')} are below the dark-albedo floor (relative luminance ${MIN_GARMENT_LUMINANCE}). The voxel facets of a darker garment are not visible.`,
        )
      }
      const seenBodies = new Set<string>()
      for (const body of preset.ragdoll.bodies) {
        if (body.parentBody && !seenBodies.has(body.parentBody)) {
          throw new Error(`Preset "${preset.id}" ragdoll body "${body.bone}" references unknown/out-of-order parent "${body.parentBody}"`)
        }
        seenBodies.add(body.bone)
      }

      const headwear = preset.headwear ? allParts.find((p) => p.id === preset.headwear) : undefined
      const hideHair = headwear?.rules.hidesHair ?? false
      const partIds = [
        preset.body,
        preset.head,
        hideHair ? null : preset.hair,
        preset.torso,
        preset.legs,
        preset.headwear,
        preset.back,
      ].filter((x): x is string => Boolean(x))
      let sum = partIds.reduce((acc, id) => {
        const found = allParts.find((p) => p.id === id)
        if (!found) throw new Error(`Preset "${preset.id}" references missing part "${id}"`)
        return acc + found.triangles
      }, 0)
      for (const heldId of [preset.heldRight, preset.heldLeft]) {
        if (!heldId) continue
        const found = allHeld.find((h) => h.id === heldId)
        if (!found) throw new Error(`Preset "${preset.id}" references missing held item "${heldId}"`)
        sum += found.triangles
      }
      if (sum > BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar) {
        throw new Error(
          `Preset "${preset.id}" composed triangles with held (${sum}) exceed S23 Ultra cap (${BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar})`,
        )
      }
    }
  }

  assertSilhouetteContract(silhouette)
  const least = (samples: SilhouetteSample[]): number => Math.min(...samples.map((s) => s.value))
  const most = (samples: SilhouetteSample[]): number => Math.max(...samples.map((s) => s.value))
  const chestWidth = most(silhouette.chests)
  console.log(
    `Sculpt lattice: ${HUMANOID_VOXEL_SIZE} m voxels, all voxel-human parts are on the lattice in the default pose. ` +
      `Silhouette: face ${most(silhouette.faces).toFixed(3)} m / chest ${chestWidth.toFixed(3)} m = ${((most(silhouette.faces) / chestWidth) * 100).toFixed(0)}%, ` +
      `hair ${least(silhouette.hair).toFixed(3)} m = ${((least(silhouette.hair) / chestWidth) * 100).toFixed(0)}%, ` +
      `neck ${least(silhouette.necks).toFixed(3)} m, bare arm ${least(silhouette.arms).toFixed(3)} m.`,
  )

  console.log(`Creature lattice, silhouette and motion: ${creatureAudits.join('; ')}.`)

  const auditCache = new Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>()
  const allPresets = manifest.packs.flatMap((p) => p.presets)
  await assertHeldPresetClips(allPresets, auditCache)

  for (const preset of allPresets) {
    const rigId = preset.rigId ?? 'ual1'
    if (isAnimalRig(rigId)) continue
    const loaded = await loadPresetForAudit(preset, manifest.packs, STAGE_DIR, auditCache)
    const clipsToCheck = rigId === 'ual1'
      ? loaded.clips.filter((c) => c.name === 'A_TPose' || c.name === preset.clip)
      : loaded.clips
    const reports = auditRigClips(loaded.root, loaded.meshes, clipsToCheck, {
      rigId: loaded.rigId,
      ragdoll: loaded.ragdoll,
      proportions: preset.proportions,
      sampleHz: preset.rigId === 'ual1' ? 12 : 24,
    })
    for (const report of reports) {
      if (report.errors > 0) {
        throw new Error(`Animation audit failed on ${preset.id} ${serializeReportSummary(report)}`)
      }
      if (report.minVertexY < -0.025) {
        throw new Error(`Animation floor penetration on ${preset.id} ${serializeReportSummary(report)}`)
      }
    }
  }

  console.log(`Validation passed: ${manifest.packs.length} packs, ${totalParts} avatar parts, ${totalModels} held/world models, ${allPresets.length} presets audited.`)
}

void main()
