import { z } from 'zod'
import aquaticJson from './data/aquatic-rig.json'
import arachnidJson from './data/arachnid-rig.json'
import avianJson from './data/avian-rig.json'
import catJson from './data/cat-rig.json'
import corgiJson from './data/corgi-rig.json'
import dragonJson from './data/dragon-rig.json'
import foxJson from './data/fox-rig.json'
import gsdJson from './data/gsd-rig.json'
import horseJson from './data/horse-rig.json'
import kaijuJson from './data/kaiju-rig.json'
import pugJson from './data/pug-rig.json'
import quadrupedJson from './data/quadruped-rig.json'
import serpentJson from './data/serpent-rig.json'
import rigJson from './data/ual1-rig.json'
import wolfJson from './data/wolf-rig.json'

export const ANIMAL_RIG_IDS = [
  'fox',
  'horse',
  'wolf',
  'corgi',
  'pug',
  'gsd',
  'cat',
  'aquatic',
  'avian',
  'serpent',
  'dragon',
  'kaiju',
] as const
export type AnimalRigId = (typeof ANIMAL_RIG_IDS)[number]

export const RIG_IDS = ['ual1', 'quadruped', 'arachnid', ...ANIMAL_RIG_IDS] as const
export type RigId = (typeof RIG_IDS)[number]

const ANIMAL_RIG_SET = new Set<string>(ANIMAL_RIG_IDS)
export function isAnimalRig(rigId: RigId): rigId is AnimalRigId {
  return ANIMAL_RIG_SET.has(rigId)
}

const vec3 = z.tuple([z.number(), z.number(), z.number()])

const ual1RigSchema = z.object({
  version: z.literal(1),
  rigId: z.literal('quaternius-ual1-53'),
  source: z.string().min(1),
  jointCount: z.literal(53),
  joints: z.array(z.string().min(1)).length(53),
  worldPositions: z.record(z.string(), vec3),
  heldSockets: z.object({
    hand_r: z.object({ bone: z.literal('hand_r'), palmOffset: vec3, rotationEuler: vec3 }),
    hand_l: z.object({ bone: z.literal('hand_l'), palmOffset: vec3, rotationEuler: vec3 }),
  }),
  clips: z.array(z.object({ name: z.string().min(1), duration: z.number().nonnegative() })).min(40),
})

const creatureRigSchema = z.object({
  version: z.literal(1),
  rigId: z.string().min(1),
  source: z.string().min(1),
  jointCount: z.number().int().positive(),
  joints: z.array(z.string().min(1)),
  parents: z.record(z.string(), z.string().nullable()),
  worldPositions: z.record(z.string(), vec3),
  clips: z.array(z.object({ name: z.string().min(1), duration: z.number().nonnegative() })).min(1),
})

export const UAL1_RIG = ual1RigSchema.parse(rigJson)
export const UAL1_JOINTS: readonly string[] = UAL1_RIG.joints
export const UAL1_CLIPS: readonly string[] = UAL1_RIG.clips.map((c) => c.name)
export type Ual1ClipName = string

export const QUADRUPED_RIG = creatureRigSchema.parse(quadrupedJson)
export const ARACHNID_RIG = creatureRigSchema.parse(arachnidJson)
export const FOX_RIG = creatureRigSchema.parse(foxJson)
export const HORSE_RIG = creatureRigSchema.parse(horseJson)
export const WOLF_RIG = creatureRigSchema.parse(wolfJson)
export const CORGI_RIG = creatureRigSchema.parse(corgiJson)
export const PUG_RIG = creatureRigSchema.parse(pugJson)
export const GSD_RIG = creatureRigSchema.parse(gsdJson)
export const CAT_RIG = creatureRigSchema.parse(catJson)
export const AQUATIC_RIG = creatureRigSchema.parse(aquaticJson)
export const AVIAN_RIG = creatureRigSchema.parse(avianJson)
export const SERPENT_RIG = creatureRigSchema.parse(serpentJson)
export const DRAGON_RIG = creatureRigSchema.parse(dragonJson)
export const KAIJU_RIG = creatureRigSchema.parse(kaijuJson)

export const ANIMAL_RIG_CONTRACTS: Readonly<Record<AnimalRigId, typeof QUADRUPED_RIG>> = {
  fox: FOX_RIG,
  horse: HORSE_RIG,
  wolf: WOLF_RIG,
  corgi: CORGI_RIG,
  pug: PUG_RIG,
  gsd: GSD_RIG,
  cat: CAT_RIG,
  aquatic: AQUATIC_RIG,
  avian: AVIAN_RIG,
  serpent: SERPENT_RIG,
  dragon: DRAGON_RIG,
  kaiju: KAIJU_RIG,
}

export interface RigSpec {
  id: RigId
  label: string
  contractId: string
  joints: readonly string[]
  clips: readonly string[]
  rootBone: string
  groundBones: readonly string[]
  /** Extra Y rotation (radians) applied on the showcase/runtime root wrapper to orient +Z forward. */
  facingYaw?: number
}

export const RIG_SPECS: Readonly<Record<RigId, RigSpec>> = {
  ual1: {
    id: 'ual1',
    label: 'UAL1 Biped (53j)',
    contractId: UAL1_RIG.rigId,
    joints: UAL1_JOINTS,
    clips: UAL1_CLIPS,
    rootBone: 'root',
    groundBones: ['foot_l', 'foot_r'],
  },
  quadruped: {
    id: 'quadruped',
    label: 'Quadruped (23j)',
    contractId: QUADRUPED_RIG.rigId,
    joints: QUADRUPED_RIG.joints,
    clips: QUADRUPED_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['leg_fl_paw', 'leg_fr_paw', 'leg_bl_paw', 'leg_br_paw'],
  },
  arachnid: {
    id: 'arachnid',
    label: 'Arachnid (28j)',
    contractId: ARACHNID_RIG.rigId,
    joints: ARACHNID_RIG.joints,
    clips: ARACHNID_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: [],
  },
  fox: {
    id: 'fox',
    label: 'Red Fox (53j)',
    contractId: FOX_RIG.rigId,
    joints: FOX_RIG.joints,
    clips: FOX_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['front_leg_foot_l', 'front_leg_foot_r', 'back_leg_toe_l', 'back_leg_toe_r'],
  },
  horse: {
    id: 'horse',
    label: 'Chestnut Horse (56j)',
    contractId: HORSE_RIG.rigId,
    joints: HORSE_RIG.joints,
    clips: HORSE_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['front_leg_foot_l', 'front_leg_foot_r', 'back_leg_toe_l', 'back_leg_toe_r'],
  },
  wolf: {
    id: 'wolf',
    label: 'Timber Wolf (51j)',
    contractId: WOLF_RIG.rigId,
    joints: WOLF_RIG.joints,
    clips: WOLF_RIG.clips.map((c) => c.name),
    rootBone: 'Body',
    groundBones: ['IKFrontLeg.L', 'IKFrontLeg.R', 'IKBackLeg.L', 'IKBackLeg.R'],
  },
  corgi: {
    id: 'corgi',
    label: 'Pembroke Corgi (16j)',
    contractId: CORGI_RIG.rigId,
    joints: CORGI_RIG.joints,
    clips: CORGI_RIG.clips.map((c) => c.name),
    rootBone: 'Root',
    groundBones: ['LeftLegF', 'RightLegF', 'LeftLegB', 'RightLegB'],
  },
  pug: {
    id: 'pug',
    label: 'Chonky Pug (24j)',
    contractId: PUG_RIG.rigId,
    joints: PUG_RIG.joints,
    clips: PUG_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['hand.L', 'hand.R', 'foot.L', 'foot.R'],
  },
  gsd: {
    id: 'gsd',
    label: 'K9 Shepherd (25j)',
    contractId: GSD_RIG.rigId,
    joints: GSD_RIG.joints,
    clips: GSD_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['paw.L', 'paw.R', 'hind_paw.L', 'hind_paw.R'],
    facingYaw: -Math.PI / 2,
  },
  cat: {
    id: 'cat',
    label: 'Ginger Cat (35j)',
    contractId: CAT_RIG.rigId,
    joints: CAT_RIG.joints,
    clips: CAT_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['wrist.L', 'wrist.R', 'hock.L', 'hock.R'],
    facingYaw: -Math.PI / 2,
  },
  aquatic: {
    id: 'aquatic',
    label: 'Aquatic (13j)',
    contractId: AQUATIC_RIG.rigId,
    joints: AQUATIC_RIG.joints,
    clips: AQUATIC_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: [],
  },
  avian: {
    id: 'avian',
    label: 'Avian (21j)',
    contractId: AVIAN_RIG.rigId,
    joints: AVIAN_RIG.joints,
    clips: AVIAN_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['foot_l', 'foot_r'],
  },
  serpent: {
    id: 'serpent',
    label: 'Serpent (12j)',
    contractId: SERPENT_RIG.rigId,
    joints: SERPENT_RIG.joints,
    clips: SERPENT_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['pelvis', 'spine_01', 'spine_02', 'tail_01', 'tail_02', 'tail_03', 'tail_04', 'tail_tip'],
  },
  dragon: {
    id: 'dragon',
    label: 'Dragon (28j)',
    contractId: DRAGON_RIG.rigId,
    joints: DRAGON_RIG.joints,
    clips: DRAGON_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['foreleg_foot_l', 'foreleg_foot_r', 'hindleg_foot_l', 'hindleg_foot_r'],
  },
  kaiju: {
    id: 'kaiju',
    label: 'Kaiju (22j)',
    contractId: KAIJU_RIG.rigId,
    joints: KAIJU_RIG.joints,
    clips: KAIJU_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['foot_l', 'foot_r'],
  },
}

export function jointsForRig(rigId: RigId = 'ual1'): readonly string[] {
  return RIG_SPECS[rigId].joints
}

export function clipsForRig(rigId: RigId = 'ual1'): readonly string[] {
  return RIG_SPECS[rigId].clips
}
