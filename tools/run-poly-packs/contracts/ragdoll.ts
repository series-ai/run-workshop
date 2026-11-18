import { z } from 'zod'
import { boneScaleFor, type ProportionLike } from './proportions'
import { ARACHNID_RIG, QUADRUPED_RIG, RIG_IDS, UAL1_RIG, type RigId } from './rig'

const vec3Schema = z.tuple([z.number(), z.number(), z.number()])
const quatSchema = z.tuple([z.number(), z.number(), z.number(), z.number()])
export type Vec3Tuple = [number, number, number]
export type QuatTuple = [number, number, number, number]

export const ragdollCapsuleSchema = z.object({
  type: z.literal('capsule'),
  /** Capsule endpoint A in bone-local metres. */
  a: vec3Schema,
  /** Capsule endpoint B in bone-local metres. */
  b: vec3Schema,
  /** Capsule radius in metres. */
  radius: z.number().positive(),
})
export type RagdollCapsule = z.infer<typeof ragdollCapsuleSchema>

export const ragdollColliderMapSchema = z.record(z.string(), ragdollCapsuleSchema)
export type RagdollColliderMap = z.infer<typeof ragdollColliderMapSchema>

export const ragdollJointConstraintSchema = z.object({
  type: z.enum(['cone_twist', 'hinge', 'fixed']),
  /** Primary hinge or cone axis in child bone-local space (unit vector). */
  axisLocal: vec3Schema,
  /** Secondary twist/orthogonal axis in child bone-local space (unit vector). */
  twistAxisLocal: vec3Schema,
  /** Cone swing half-angles [swing1Deg, swing2Deg], or hinge [minDeg, maxDeg]. */
  swingLimitsDeg: z.tuple([z.number(), z.number()]),
  /** Twist [minDeg, maxDeg] around bone axis. */
  twistLimitsDeg: z.tuple([z.number(), z.number()]),
  stiffness: z.number().nonnegative(),
  damping: z.number().nonnegative(),
})
export type RagdollJointConstraint = z.infer<typeof ragdollJointConstraintSchema>

export const ragdollBodySchema = z.object({
  bone: z.string().min(1),
  parentBody: z.string().nullable(),
  /** Joint pivot offset in `parentBody`-local coordinates (metres). */
  parentAnchor: vec3Schema,
  massKg: z.number().positive(),
  collider: ragdollCapsuleSchema,
  joint: ragdollJointConstraintSchema.nullable(),
  collisionGroup: z.number().int().nonnegative(),
})
export type RagdollBody = z.infer<typeof ragdollBodySchema>

export const characterRagdollSchema = z.object({
  version: z.literal(1),
  rigId: z.enum(RIG_IDS),
  totalMassKg: z.number().positive(),
  bodies: z.array(ragdollBodySchema).min(1),
  ignoreCollisionPairs: z.array(z.tuple([z.string(), z.string()])),
  groundContactBones: z.array(z.string()),
})
export type CharacterRagdollMetadata = z.infer<typeof characterRagdollSchema>

// ---- Bone-group collapse mapping (all rig joints -> physical ragdoll bodies) ----

const UAL1_FINGER_L = /^(thumb|index|middle|ring|pinky)_0[1-3]_l$/
const UAL1_FINGER_R = /^(thumb|index|middle|ring|pinky)_0[1-3]_r$/

export function ragdollGroupFor(rigId: RigId, boneName: string): string | null {
  if (boneName === 'root') return null
  if (rigId !== 'ual1') return boneName
  if (boneName === 'spine_02' || boneName === 'clavicle_l' || boneName === 'clavicle_r') return 'spine_03'
  if (boneName === 'neck_01') return 'Head'
  if (UAL1_FINGER_L.test(boneName)) return 'hand_l'
  if (UAL1_FINGER_R.test(boneName)) return 'hand_r'
  if (boneName === 'ball_l') return 'foot_l'
  if (boneName === 'ball_r') return 'foot_r'
  return boneName
}

// ---- Exact quaternion / vector math (zero external runtime deps) ----

function rotateVecByQuat(v: Vec3Tuple, q: QuatTuple): Vec3Tuple {
  const [vx, vy, vz] = v
  const [qx, qy, qz, qw] = q
  const ix = qw * vx + qy * vz - qz * vy
  const iy = qw * vy + qz * vx - qx * vz
  const iz = qw * vz + qx * vy - qy * vx
  const iw = -qx * vx - qy * vy - qz * vz
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ]
}

function invertQuat(q: QuatTuple): QuatTuple {
  return [-q[0], -q[1], -q[2], q[3]]
}

function round3(n: number): number {
  return Math.round(n * 10000) / 10000
}

function roundVec(v: Vec3Tuple): Vec3Tuple {
  return [round3(v[0]), round3(v[1]), round3(v[2])]
}

function subVec(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function addVec(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function mulVec(a: Vec3Tuple, s: Vec3Tuple): Vec3Tuple {
  return [a[0] * s[0], a[1] * s[1], a[2] * s[2]]
}

function dotVec(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function lenVec(a: Vec3Tuple): number {
  return Math.hypot(a[0], a[1], a[2])
}

function normVec(a: Vec3Tuple, fallback: Vec3Tuple = [0, 1, 0]): Vec3Tuple {
  const l = lenVec(a)
  return l > 1e-6 ? [a[0] / l, a[1] / l, a[2] / l] : fallback
}

// ---- Rig templates ----

interface RigBodyTemplate {
  bone: string
  parentBody: string | null
  massFraction: number
  worldPos: Vec3Tuple
  bindQuat: QuatTuple
  defaultCollider: RagdollCapsule
  joint: RagdollJointConstraint | null
  collisionGroup: number
}

interface RigPhysicsTemplate {
  rigId: RigId
  defaultMassKg: number
  skeletonParents: Record<string, string | null>
  worldPositions: Record<string, Vec3Tuple>
  bodies: readonly RigBodyTemplate[]
  ignoreCollisionPairs: readonly [string, string][]
  groundContactBones: readonly string[]
}

const UAL1_BIND_DATA: Record<string, { pos: Vec3Tuple; quat: QuatTuple }> = {
  pelvis: { pos: [0.0, 1.032713, -0.044709], quat: [0.1258407, 0.0000002, 0.0, 0.9920505] },
  spine_01: { pos: [0.0, 1.276487, 0.018148], quat: [0.0613886, -0.0000001, 0.0, 0.9981139] },
  spine_03: { pos: [0.0, 1.465891, 0.024804], quat: [-0.0161976, 0.0, 0.0, 0.9998688] },
  Head: { pos: [0.0, 1.705806, 0.024926], quat: [0.0162604, -0.0000001, 0.0, 0.9998678] },
  upperarm_l: { pos: [0.107201, 1.523569, 0.048385], quat: [0.0102602, 0.0223669, -0.7070323, 0.7067529] },
  lowerarm_l: { pos: [0.419152, 1.523569, 0.043042], quat: [0.0120658, -0.0001243, -0.7070038, 0.7071068] },
  hand_l: { pos: [0.686682, 1.523569, 0.047655], quat: [0.0110903, 0.0110901, -0.7070198, 0.7070198] },
  upperarm_r: { pos: [-0.1072, 1.523569, 0.048385], quat: [0.0102603, -0.0223669, 0.7070323, 0.7067529] },
  lowerarm_r: { pos: [-0.419152, 1.523569, 0.043042], quat: [0.0120658, 0.0001245, 0.7070038, 0.7071068] },
  hand_r: { pos: [-0.686682, 1.523568, 0.047655], quat: [0.0110904, -0.0110901, 0.7070198, 0.7070198] },
  thigh_l: { pos: [0.094278, 1.083518, -0.020778], quat: [0.9999935, -0.000003, 0.0008608, -0.0034971] },
  calf_l: { pos: [0.094278, 0.626909, -0.023972], quat: [0.999192, -0.0001203, 0.003, -0.0400803] },
  foot_l: { pos: [0.094278, 0.160189, -0.061475], quat: [0.8689382, 0.0095647, 0.0168057, 0.4945427] },
  thigh_r: { pos: [-0.094278, 1.083518, -0.020778], quat: [0.9999935, 0.000003, -0.0008616, -0.0034966] },
  calf_r: { pos: [-0.094278, 0.626908, -0.023972], quat: [0.999192, 0.0001203, -0.003, -0.0400801] },
  foot_r: { pos: [-0.094278, 0.160189, -0.061475], quat: [0.8689376, -0.0095647, -0.0168056, 0.4945438] },
}

const UAL1_SKELETON_PARENTS: Record<string, string | null> = {
  root: null,
  pelvis: 'root',
  spine_01: 'pelvis',
  spine_02: 'spine_01',
  spine_03: 'spine_02',
  neck_01: 'spine_03',
  Head: 'neck_01',
  clavicle_l: 'spine_03',
  upperarm_l: 'clavicle_l',
  lowerarm_l: 'upperarm_l',
  hand_l: 'lowerarm_l',
  clavicle_r: 'spine_03',
  upperarm_r: 'clavicle_r',
  lowerarm_r: 'upperarm_r',
  hand_r: 'lowerarm_r',
  thigh_l: 'pelvis',
  calf_l: 'thigh_l',
  foot_l: 'calf_l',
  ball_l: 'foot_l',
  thigh_r: 'pelvis',
  calf_r: 'thigh_r',
  foot_r: 'calf_r',
  ball_r: 'foot_r',
}

function modelCapsToLocal(aModel: Vec3Tuple, bModel: Vec3Tuple, radius: number, worldPos: Vec3Tuple, bindQuat: QuatTuple): RagdollCapsule {
  const qInv = invertQuat(bindQuat)
  return {
    type: 'capsule',
    a: roundVec(rotateVecByQuat(subVec(aModel, worldPos), qInv)),
    b: roundVec(rotateVecByQuat(subVec(bModel, worldPos), qInv)),
    radius: round3(radius),
  }
}

const cone = (swing1: number, swing2: number, twist: number, stiffness = 24, damping = 4): RagdollJointConstraint => ({
  type: 'cone_twist',
  axisLocal: [0, 1, 0],
  twistAxisLocal: [1, 0, 0],
  swingLimitsDeg: [swing1, swing2],
  twistLimitsDeg: [-twist, twist],
  stiffness,
  damping,
})

const hinge = (minDeg: number, maxDeg: number, axis: Vec3Tuple = [1, 0, 0], stiffness = 12, damping = 2.5): RagdollJointConstraint => ({
  type: 'hinge',
  axisLocal: axis,
  twistAxisLocal: [0, 1, 0],
  swingLimitsDeg: [minDeg, maxDeg],
  twistLimitsDeg: [0, 0],
  stiffness,
  damping,
})

const UAL1_BODIES: RigBodyTemplate[] = [
  {
    bone: 'pelvis',
    parentBody: null,
    massFraction: 0.17,
    ...(() => {
      const b = UAL1_BIND_DATA.pelvis!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.06, 1.06, -0.01], [0.06, 1.06, -0.01], 0.11, b.pos, b.quat),
      }
    })(),
    joint: null,
    collisionGroup: 1,
  },
  {
    bone: 'spine_01',
    parentBody: 'pelvis',
    massFraction: 0.13,
    ...(() => {
      const b = UAL1_BIND_DATA.spine_01!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.055, 1.30, 0.01], [0.055, 1.30, 0.01], 0.105, b.pos, b.quat),
      }
    })(),
    joint: cone(25, 22, 25, 36, 5),
    collisionGroup: 1,
  },
  {
    bone: 'spine_03',
    parentBody: 'spine_01',
    massFraction: 0.18,
    ...(() => {
      const b = UAL1_BIND_DATA.spine_03!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.065, 1.48, 0.015], [0.065, 1.48, 0.015], 0.115, b.pos, b.quat),
      }
    })(),
    joint: cone(28, 24, 30, 36, 5),
    collisionGroup: 1,
  },
  {
    bone: 'Head',
    parentBody: 'spine_03',
    massFraction: 0.07,
    ...(() => {
      const b = UAL1_BIND_DATA.Head!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0, 1.78, 0.03], [0, 1.88, 0.03], 0.11, b.pos, b.quat),
      }
    })(),
    joint: cone(42, 35, 48, 22, 3.5),
    collisionGroup: 1,
  },
  {
    bone: 'upperarm_l',
    parentBody: 'spine_03',
    massFraction: 0.034,
    ...(() => {
      const b = UAL1_BIND_DATA.upperarm_l!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0.21, 1.525, 0.045], [0.36, 1.525, 0.045], 0.062, b.pos, b.quat),
      }
    })(),
    joint: cone(95, 80, 60, 16, 3),
    collisionGroup: 2,
  },
  {
    bone: 'lowerarm_l',
    parentBody: 'upperarm_l',
    massFraction: 0.022,
    ...(() => {
      const b = UAL1_BIND_DATA.lowerarm_l!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0.46, 1.525, 0.045], [0.63, 1.525, 0.045], 0.052, b.pos, b.quat),
      }
    })(),
    joint: hinge(0, 145, [0, 0, 1], 10, 2),
    collisionGroup: 2,
  },
  {
    bone: 'hand_l',
    parentBody: 'lowerarm_l',
    massFraction: 0.008,
    ...(() => {
      const b = UAL1_BIND_DATA.hand_l!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0.72, 1.525, 0.05], [0.87, 1.525, 0.05], 0.042, b.pos, b.quat),
      }
    })(),
    joint: cone(55, 30, 25, 8, 1.5),
    collisionGroup: 2,
  },
  {
    bone: 'upperarm_r',
    parentBody: 'spine_03',
    massFraction: 0.034,
    ...(() => {
      const b = UAL1_BIND_DATA.upperarm_r!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.21, 1.525, 0.045], [-0.36, 1.525, 0.045], 0.062, b.pos, b.quat),
      }
    })(),
    joint: cone(95, 80, 60, 16, 3),
    collisionGroup: 2,
  },
  {
    bone: 'lowerarm_r',
    parentBody: 'upperarm_r',
    massFraction: 0.022,
    ...(() => {
      const b = UAL1_BIND_DATA.lowerarm_r!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.46, 1.525, 0.045], [-0.63, 1.525, 0.045], 0.052, b.pos, b.quat),
      }
    })(),
    joint: hinge(0, 145, [0, 0, 1], 10, 2),
    collisionGroup: 2,
  },
  {
    bone: 'hand_r',
    parentBody: 'lowerarm_r',
    massFraction: 0.008,
    ...(() => {
      const b = UAL1_BIND_DATA.hand_r!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.72, 1.525, 0.05], [-0.87, 1.525, 0.05], 0.042, b.pos, b.quat),
      }
    })(),
    joint: cone(55, 30, 25, 8, 1.5),
    collisionGroup: 2,
  },
  {
    bone: 'thigh_l',
    parentBody: 'pelvis',
    massFraction: 0.105,
    ...(() => {
      const b = UAL1_BIND_DATA.thigh_l!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0.098, 0.96, -0.015], [0.098, 0.68, -0.02], 0.088, b.pos, b.quat),
      }
    })(),
    joint: cone(85, 55, 35, 22, 4),
    collisionGroup: 3,
  },
  {
    bone: 'calf_l',
    parentBody: 'thigh_l',
    massFraction: 0.048,
    ...(() => {
      const b = UAL1_BIND_DATA.calf_l!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0.096, 0.56, -0.028], [0.096, 0.23, -0.052], 0.068, b.pos, b.quat),
      }
    })(),
    joint: hinge(0, 140, [1, 0, 0], 14, 3),
    collisionGroup: 3,
  },
  {
    bone: 'foot_l',
    parentBody: 'calf_l',
    massFraction: 0.015,
    ...(() => {
      const b = UAL1_BIND_DATA.foot_l!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([0.094, 0.055, -0.075], [0.094, 0.055, 0.155], 0.055, b.pos, b.quat),
      }
    })(),
    joint: cone(45, 25, 20, 10, 2),
    collisionGroup: 3,
  },
  {
    bone: 'thigh_r',
    parentBody: 'pelvis',
    massFraction: 0.105,
    ...(() => {
      const b = UAL1_BIND_DATA.thigh_r!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.098, 0.96, -0.015], [-0.098, 0.68, -0.02], 0.088, b.pos, b.quat),
      }
    })(),
    joint: cone(85, 55, 35, 22, 4),
    collisionGroup: 3,
  },
  {
    bone: 'calf_r',
    parentBody: 'thigh_r',
    massFraction: 0.048,
    ...(() => {
      const b = UAL1_BIND_DATA.calf_r!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.096, 0.56, -0.028], [-0.096, 0.23, -0.052], 0.068, b.pos, b.quat),
      }
    })(),
    joint: hinge(0, 140, [1, 0, 0], 14, 3),
    collisionGroup: 3,
  },
  {
    bone: 'foot_r',
    parentBody: 'calf_r',
    massFraction: 0.015,
    ...(() => {
      const b = UAL1_BIND_DATA.foot_r!
      return {
        worldPos: b.pos,
        bindQuat: b.quat,
        defaultCollider: modelCapsToLocal([-0.094, 0.055, -0.075], [-0.094, 0.055, 0.155], 0.055, b.pos, b.quat),
      }
    })(),
    joint: cone(45, 25, 20, 10, 2),
    collisionGroup: 3,
  },
]

function buildCreatureTemplate(
  rigId: 'quadruped' | 'arachnid',
  contract: typeof QUADRUPED_RIG,
  defaultMassKg: number,
  groundContactBones: readonly string[],
  specFor: (bone: string) => { massFraction: number; collider: RagdollCapsule; joint: RagdollJointConstraint | null; group: number },
  extraIgnore: readonly [string, string][],
): RigPhysicsTemplate {
  const worldPositions: Record<string, Vec3Tuple> = {}
  for (const [k, v] of Object.entries(contract.worldPositions)) {
    worldPositions[k] = [v[0], v[1], v[2]]
  }
  const bodies: RigBodyTemplate[] = []
  const ignore: [string, string][] = [...extraIgnore]
  for (const bone of contract.joints) {
    if (bone === 'root') continue
    const rawParent = contract.parents[bone] ?? null
    const parentBody = rawParent === 'root' ? null : rawParent
    const s = specFor(bone)
    bodies.push({
      bone,
      parentBody,
      massFraction: s.massFraction,
      worldPos: worldPositions[bone]!,
      bindQuat: [0, 0, 0, 1],
      defaultCollider: s.collider,
      joint: s.joint,
      collisionGroup: s.group,
    })
    if (parentBody) {
      ignore.push([parentBody, bone])
    }
  }
  return {
    rigId,
    defaultMassKg,
    skeletonParents: contract.parents,
    worldPositions,
    bodies,
    ignoreCollisionPairs: ignore,
    groundContactBones,
  }
}

const QUADRUPED_TEMPLATE = buildCreatureTemplate(
  'quadruped',
  QUADRUPED_RIG,
  65,
  ['leg_fl_paw', 'leg_fr_paw', 'leg_bl_paw', 'leg_br_paw'],
  (bone) => {
    const pos = QUADRUPED_RIG.worldPositions[bone]!
    if (bone === 'pelvis') {
      return {
        massFraction: 0.14,
        collider: { type: 'capsule', a: [0, 0.04, -0.04], b: [0, 0.04, 0.14], radius: 0.14 },
        joint: null,
        group: 1,
      }
    }
    if (bone === 'spine_01' || bone === 'spine_02') {
      return {
        massFraction: 0.11,
        collider: { type: 'capsule', a: [0, 0.03, -0.05], b: [0, 0.04, 0.14], radius: 0.135 },
        joint: cone(25, 20, 20, 30, 4),
        group: 1,
      }
    }
    if (bone === 'chest') {
      return {
        massFraction: 0.20,
        collider: { type: 'capsule', a: [0, 0.02, -0.10], b: [0, 0.04, 0.14], radius: 0.175 },
        joint: cone(25, 20, 20, 32, 4),
        group: 1,
      }
    }
    if (bone === 'neck') {
      return {
        massFraction: 0.06,
        collider: { type: 'capsule', a: [0, -0.01, -0.04], b: [0, 0.06, 0.06], radius: 0.11 },
        joint: cone(40, 30, 35, 20, 3),
        group: 1,
      }
    }
    if (bone === 'head') {
      return {
        massFraction: 0.075,
        collider: { type: 'capsule', a: [0, 0.01, -0.03], b: [0, 0.0, 0.22], radius: 0.095 },
        joint: cone(40, 35, 40, 18, 3),
        group: 1,
      }
    }
    if (bone === 'jaw') {
      return {
        massFraction: 0.015,
        collider: { type: 'capsule', a: [0, 0.0, 0.02], b: [0, 0.0, 0.22], radius: 0.045 },
        joint: hinge(0, 55, [1, 0, 0], 10, 2),
        group: 1,
      }
    }
    if (bone.startsWith('tail_')) {
      return {
        massFraction: 0.015,
        collider: { type: 'capsule', a: [0, 0, -0.03], b: [0, -0.04, -0.14], radius: 0.06 },
        joint: cone(45, 45, 25, 6, 1.5),
        group: 4,
      }
    }
    if (bone.endsWith('_upper')) {
      const lower = QUADRUPED_RIG.worldPositions[bone.replace('_upper', '_lower')]!
      const rel = subVec([lower[0], lower[1], lower[2]], [pos[0], pos[1], pos[2]])
      return {
        massFraction: 0.04,
        collider: { type: 'capsule', a: [0, -0.04, 0], b: [rel[0] * 0.78, rel[1] * 0.78, rel[2] * 0.78], radius: 0.075 },
        joint: cone(75, 40, 25, 20, 3.5),
        group: 2,
      }
    }
    if (bone.endsWith('_lower')) {
      const paw = QUADRUPED_RIG.worldPositions[bone.replace('_lower', '_paw')]!
      const rel = subVec([paw[0], paw[1], paw[2]], [pos[0], pos[1], pos[2]])
      return {
        massFraction: 0.022,
        collider: { type: 'capsule', a: [0, -0.02, 0], b: [rel[0] * 0.85, rel[1] * 0.85, rel[2] * 0.85], radius: 0.05 },
        joint: hinge(-20, 125, [1, 0, 0], 14, 2.5),
        group: 2,
      }
    }
    // paw
    return {
      massFraction: 0.01,
      collider: { type: 'capsule', a: [0, -0.03, 0.0], b: [0, -0.03, 0.10], radius: 0.045 },
      joint: cone(45, 25, 15, 10, 2),
      group: 2,
    }
  },
  [
    ['spine_02', 'leg_fl_upper'],
    ['spine_02', 'leg_fr_upper'],
    ['spine_01', 'leg_bl_upper'],
    ['spine_01', 'leg_br_upper'],
    ['chest', 'head'],
    ['pelvis', 'tail_01'],
  ],
)

const ARACHNID_TEMPLATE = buildCreatureTemplate(
  'arachnid',
  ARACHNID_RIG,
  95,
  [
    'leg_1_l_tibia',
    'leg_1_r_tibia',
    'leg_2_l_tibia',
    'leg_2_r_tibia',
    'leg_3_l_tibia',
    'leg_3_r_tibia',
    'leg_4_l_tibia',
    'leg_4_r_tibia',
  ],
  (bone) => {
    const pos = ARACHNID_RIG.worldPositions[bone]!
    if (bone === 'body') {
      return {
        massFraction: 0.24,
        collider: { type: 'capsule', a: [0, 0.0, -0.08], b: [0, 0.0, 0.10], radius: 0.12 },
        joint: null,
        group: 1,
      }
    }
    if (bone === 'head') {
      return {
        massFraction: 0.10,
        collider: { type: 'capsule', a: [0, -0.02, -0.02], b: [0, -0.03, 0.14], radius: 0.095 },
        joint: cone(30, 25, 20, 24, 3.5),
        group: 1,
      }
    }
    if (bone === 'abdomen') {
      return {
        massFraction: 0.30,
        collider: { type: 'capsule', a: [0, 0.04, -0.14], b: [0, 0.06, -0.44], radius: 0.21 },
        joint: cone(35, 30, 20, 26, 4),
        group: 1,
      }
    }
    if (bone.endsWith('_coxa')) {
      const femur = ARACHNID_RIG.worldPositions[bone.replace('_coxa', '_femur')]!
      const rel = subVec([femur[0], femur[1], femur[2]], [pos[0], pos[1], pos[2]])
      return {
        massFraction: 0.008,
        collider: { type: 'capsule', a: [0, 0, 0], b: rel, radius: 0.04 },
        joint: cone(45, 35, 25, 16, 3),
        group: 2,
      }
    }
    if (bone.endsWith('_femur')) {
      const tibia = ARACHNID_RIG.worldPositions[bone.replace('_femur', '_tibia')]!
      const rel = subVec([tibia[0], tibia[1], tibia[2]], [pos[0], pos[1], pos[2]])
      return {
        massFraction: 0.02,
        collider: { type: 'capsule', a: [rel[0] * 0.12, rel[1] * 0.12, rel[2] * 0.12], b: rel, radius: 0.046 },
        joint: hinge(-65, 65, [0, 0, 1], 14, 2.5),
        group: 2,
      }
    }
    // tibia (ends on floor near world y=0)
    return {
      massFraction: 0.017,
      collider: { type: 'capsule', a: [0, 0, 0], b: [pos[0] * 0.55, -pos[1] * 0.92, pos[2] * 0.5], radius: 0.03 },
      joint: hinge(-95, 70, [0, 0, 1], 12, 2),
      group: 2,
    }
  },
  [
    ['head', 'leg_1_l_coxa'],
    ['head', 'leg_1_r_coxa'],
    ['head', 'leg_1_l_femur'],
    ['head', 'leg_1_r_femur'],
    ['abdomen', 'leg_4_l_coxa'],
    ['abdomen', 'leg_4_r_coxa'],
    ['abdomen', 'leg_4_l_femur'],
    ['abdomen', 'leg_4_r_femur'],
    ['leg_1_l_coxa', 'leg_2_l_coxa'],
    ['leg_2_l_coxa', 'leg_3_l_coxa'],
    ['leg_3_l_coxa', 'leg_4_l_coxa'],
    ['leg_1_r_coxa', 'leg_2_r_coxa'],
    ['leg_2_r_coxa', 'leg_3_r_coxa'],
    ['leg_3_r_coxa', 'leg_4_r_coxa'],
    ['leg_1_l_coxa', 'leg_2_l_femur'],
    ['leg_1_l_femur', 'leg_2_l_coxa'],
    ['leg_2_l_coxa', 'leg_3_l_femur'],
    ['leg_2_l_femur', 'leg_3_l_coxa'],
    ['leg_3_l_coxa', 'leg_4_l_femur'],
    ['leg_3_l_femur', 'leg_4_l_coxa'],
    ['leg_1_r_coxa', 'leg_2_r_femur'],
    ['leg_1_r_femur', 'leg_2_r_coxa'],
    ['leg_2_r_coxa', 'leg_3_r_femur'],
    ['leg_2_r_femur', 'leg_3_r_coxa'],
    ['leg_3_r_coxa', 'leg_4_r_femur'],
    ['leg_3_r_femur', 'leg_4_r_coxa'],
  ],
)

const UAL1_TEMPLATE: RigPhysicsTemplate = {
  rigId: 'ual1',
  defaultMassKg: 75,
  skeletonParents: UAL1_SKELETON_PARENTS,
  worldPositions: Object.fromEntries(
    Object.entries(UAL1_RIG.worldPositions).map(([k, v]) => [k, [v[0], v[1], v[2]]]),
  ),
  bodies: UAL1_BODIES,
  ignoreCollisionPairs: [
    ['pelvis', 'spine_01'],
    ['spine_01', 'spine_03'],
    ['spine_03', 'Head'],
    ['spine_03', 'upperarm_l'],
    ['upperarm_l', 'lowerarm_l'],
    ['lowerarm_l', 'hand_l'],
    ['spine_03', 'upperarm_r'],
    ['upperarm_r', 'lowerarm_r'],
    ['lowerarm_r', 'hand_r'],
    ['pelvis', 'thigh_l'],
    ['thigh_l', 'calf_l'],
    ['calf_l', 'foot_l'],
    ['pelvis', 'thigh_r'],
    ['thigh_r', 'calf_r'],
    ['calf_r', 'foot_r'],
  ],
  groundContactBones: ['foot_l', 'foot_r'],
}

export const RAGDOLL_RIG_TEMPLATES: Readonly<Record<RigId, RigPhysicsTemplate>> = {
  ual1: UAL1_TEMPLATE,
  quadruped: QUADRUPED_TEMPLATE,
  arachnid: ARACHNID_TEMPLATE,
}

// ---- Runtime blending, outfit merging & proportional collider resolution ----

function lerpCapsule(a: RagdollCapsule, b: RagdollCapsule, t: number): RagdollCapsule {
  const k = 1 - t
  return {
    type: 'capsule',
    a: [a.a[0] * k + b.a[0] * t, a.a[1] * k + b.a[1] * t, a.a[2] * k + b.a[2] * t],
    b: [a.b[0] * k + b.b[0] * t, a.b[1] * k + b.b[1] * t, a.b[2] * k + b.b[2] * t],
    radius: a.radius * k + b.radius * t,
  }
}

const MORPH_BUILD_BASE: Record<string, number> = {
  body_slim: -1,
  body_athletic: 0,
  body_heavy: 1,
}

/**
 * Blend bind-pose colliders along the continuous `build` morph (-1 slim .. 0 athletic .. +1 heavy)
 * when `body_slim` / `body_athletic` / `body_heavy` collider maps are supplied.
 */
export function interpolateBuildColliders(
  bodyId: string,
  build: number,
  variants: Partial<Record<'body_slim' | 'body_athletic' | 'body_heavy', RagdollColliderMap>>,
  fallback?: RagdollColliderMap,
): RagdollColliderMap {
  const base = MORPH_BUILD_BASE[bodyId]
  if (base === undefined || !variants.body_athletic || !variants.body_slim || !variants.body_heavy) {
    return fallback ?? {}
  }
  const target = Math.max(-1, Math.min(1, base + build))
  const from = target < 0 ? variants.body_slim : variants.body_athletic
  const to = target < 0 ? variants.body_athletic : variants.body_heavy
  const t = target < 0 ? target + 1 : target
  const out: RagdollColliderMap = {}
  for (const bone of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const ca = from[bone] ?? to[bone]!
    const cb = to[bone] ?? from[bone]!
    out[bone] = lerpCapsule(ca, cb, t)
  }
  return out
}

/**
 * Combine multiple part collider maps (e.g. body + head + armor + greaves) by taking the conservative
 * outer capsule radius and axial span when two parts define a capsule along aligned axes.
 */
export function mergeColliderMaps(maps: readonly (RagdollColliderMap | undefined)[]): RagdollColliderMap {
  const merged: RagdollColliderMap = {}
  for (const map of maps) {
    if (!map) continue
    for (const [bone, cap] of Object.entries(map)) {
      const prev = merged[bone]
      if (!prev) {
        merged[bone] = { type: 'capsule', a: [...cap.a], b: [...cap.b], radius: cap.radius }
        continue
      }
      const prevAxis = normVec(subVec(prev.b, prev.a), [0, 1, 0])
      const nextAxis = normVec(subVec(cap.b, cap.a), prevAxis)
      const alignment = Math.abs(dotVec(prevAxis, nextAxis))
      if (alignment > 0.85) {
        // Extend axial range along prevAxis and take outer radius
        const mid: Vec3Tuple = [(prev.a[0] + prev.b[0]) * 0.5, (prev.a[1] + prev.b[1]) * 0.5, (prev.a[2] + prev.b[2]) * 0.5]
        const proj = (p: Vec3Tuple) => dotVec(subVec(p, mid), prevAxis)
        const sVals = [proj(prev.a), proj(prev.b), proj(cap.a), proj(cap.b)]
        const sMin = Math.min(...sVals)
        const sMax = Math.max(...sVals)
        merged[bone] = {
          type: 'capsule',
          a: roundVec([mid[0] + prevAxis[0] * sMin, mid[1] + prevAxis[1] * sMin, mid[2] + prevAxis[2] * sMin]),
          b: roundVec([mid[0] + prevAxis[0] * sMax, mid[1] + prevAxis[1] * sMax, mid[2] + prevAxis[2] * sMax]),
          radius: round3(Math.max(prev.radius, cap.radius)),
        }
      } else {
        merged[bone] = {
          type: 'capsule',
          a: prev.a,
          b: prev.b,
          radius: round3(Math.max(prev.radius, cap.radius)),
        }
      }
    }
  }
  return merged
}

/**
 * Transform a bind-pose bone-local capsule under `proportionRig` non-uniform model-space scaling.
 * Identical algebraically to `proportionRig.ts`:
 *   p_boneLocal_scaled = R_bind^-1 * (S_model * (R_bind * p_boneLocal_bind))
 */
export function scaleCapsuleForProportions(
  capsule: RagdollCapsule,
  boneName: string,
  proportions: ProportionLike,
  rigId: RigId,
  bindQuat: QuatTuple,
): { capsule: RagdollCapsule; volumeScale: number } {
  const sVec = { x: 1, y: 1, z: 1 }
  boneScaleFor(boneName, proportions, sVec, rigId)
  const rootUniform = rigId === 'ual1' ? 1 : proportions.height
  const s: Vec3Tuple = [sVec.x * rootUniform, sVec.y * rootUniform, sVec.z * rootUniform]
  const qInv = invertQuat(bindQuat)

  const aModel = rotateVecByQuat(capsule.a, bindQuat)
  const bModel = rotateVecByQuat(capsule.b, bindQuat)
  const aScaledModel = mulVec(aModel, s)
  const bScaledModel = mulVec(bModel, s)
  const aLocal = roundVec(rotateVecByQuat(aScaledModel, qInv))
  const bLocal = roundVec(rotateVecByQuat(bScaledModel, qInv))

  // Radial scale perpendicular to the model-space capsule axis
  const axisModel = normVec(subVec(bModel, aModel), [0, 1, 0])
  const ux = Math.abs(axisModel[0])
  const uy = Math.abs(axisModel[1])
  const uz = Math.abs(axisModel[2])
  // Effective perpendicular scale weighting the axes orthogonal to `axisModel`
  const perpWeight = 1 - ux * ux + (1 - uy * uy) + (1 - uz * uz)
  const rScale =
    perpWeight > 1e-4
      ? ((1 - ux * ux) * s[0] + (1 - uy * uy) * s[1] + (1 - uz * uz) * s[2]) / perpWeight
      : (s[0] + s[1] + s[2]) / 3

  return {
    capsule: {
      type: 'capsule',
      a: aLocal,
      b: bLocal,
      radius: round3(Math.max(0.012, capsule.radius * rScale)),
    },
    volumeScale: s[0] * s[1] * s[2],
  }
}

function scaledParentAnchor(
  childBone: string,
  parentBody: string,
  template: RigPhysicsTemplate,
  proportions: ProportionLike,
  parentBindQuat: QuatTuple,
): Vec3Tuple {
  const rootUniform = template.rigId === 'ual1' ? 1 : proportions.height
  // Walk skeleton chain from childBone up to parentBody
  const chain: string[] = []
  let cur: string | null = childBone
  while (cur && cur !== parentBody) {
    chain.push(cur)
    cur = template.skeletonParents[cur] ?? null
  }
  let offsetModel: Vec3Tuple = [0, 0, 0]
  for (const node of chain) {
    const skelParent = template.skeletonParents[node]
    if (!skelParent) break
    const childPos = template.worldPositions[node]!
    const parentPos = template.worldPositions[skelParent]!
    const sVec = { x: 1, y: 1, z: 1 }
    boneScaleFor(skelParent, proportions, sVec, template.rigId)
    const step = mulVec(subVec(childPos, parentPos), [sVec.x * rootUniform, sVec.y * rootUniform, sVec.z * rootUniform])
    offsetModel = addVec(offsetModel, step)
  }
  return roundVec(rotateVecByQuat(offsetModel, invertQuat(parentBindQuat)))
}

export interface ResolveRagdollOptions {
  rigId: RigId
  proportions: ProportionLike
  /** Bind-pose colliders mapped by bone name (e.g. merged from preset parts or body part). */
  bindColliders?: RagdollColliderMap
  /** Optional base archetype mass in kg before proportion scaling. */
  baseMassKg?: number
}

/**
 * Resolve complete, physics-engine-ready ragdoll metadata for any character preset or custom slider configuration.
 */
export function resolveCharacterRagdoll(options: ResolveRagdollOptions): CharacterRagdollMetadata {
  const { rigId, proportions, bindColliders, baseMassKg } = options
  const template = RAGDOLL_RIG_TEMPLATES[rigId]
  const totalBaseMass = baseMassKg ?? template.defaultMassKg
  const quatByBone = new Map(template.bodies.map((b) => [b.bone, b.bindQuat]))

  const rawMasses: number[] = []
  const resolvedBodies: RagdollBody[] = []

  for (const tpl of template.bodies) {
    const baseCap = bindColliders?.[tpl.bone] ?? tpl.defaultCollider
    const { capsule, volumeScale } = scaleCapsuleForProportions(baseCap, tpl.bone, proportions, rigId, tpl.bindQuat)
    const rawMass = Math.max(0.05, totalBaseMass * tpl.massFraction * volumeScale)
    rawMasses.push(rawMass)

    const parentAnchor: Vec3Tuple = tpl.parentBody
      ? scaledParentAnchor(tpl.bone, tpl.parentBody, template, proportions, quatByBone.get(tpl.parentBody)!)
      : [0, 0, 0]

    resolvedBodies.push({
      bone: tpl.bone,
      parentBody: tpl.parentBody,
      parentAnchor,
      massKg: round3(rawMass),
      collider: capsule,
      joint: tpl.joint,
      collisionGroup: tpl.collisionGroup,
    })
  }

  const totalMassKg = round3(rawMasses.reduce((sum, m) => sum + m, 0))
  return {
    version: 1,
    rigId,
    totalMassKg,
    bodies: resolvedBodies,
    ignoreCollisionPairs: template.ignoreCollisionPairs.map(([a, b]) => [a, b]),
    groundContactBones: [...template.groundContactBones],
  }
}
