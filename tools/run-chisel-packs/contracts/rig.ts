import { z } from 'zod'
import aquaticJson from './data/aquatic-rig.json'
import arachnidJson from './data/arachnid-rig.json'
import avianJson from './data/avian-rig.json'
import dragonJson from './data/dragon-rig.json'
import kaijuJson from './data/kaiju-rig.json'
import quadrupedJson from './data/quadruped-rig.json'
import serpentJson from './data/serpent-rig.json'
import rigJson from './data/ual1-rig.json'

export const RIG_IDS = ['ual1', 'quadruped', 'arachnid', 'avian', 'dragon', 'kaiju', 'serpent', 'aquatic'] as const
export type RigId = (typeof RIG_IDS)[number]

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
export const AVIAN_RIG = creatureRigSchema.parse(avianJson)
export const DRAGON_RIG = creatureRigSchema.parse(dragonJson)
export const KAIJU_RIG = creatureRigSchema.parse(kaijuJson)
export const SERPENT_RIG = creatureRigSchema.parse(serpentJson)
export const AQUATIC_RIG = creatureRigSchema.parse(aquaticJson)

export interface RigSpec {
  id: RigId
  label: string
  contractId: string
  joints: readonly string[]
  clips: readonly string[]
  rootBone: string
  groundBones: readonly string[]
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
  avian: {
    id: 'avian',
    label: 'Avian (21j)',
    contractId: AVIAN_RIG.rigId,
    joints: AVIAN_RIG.joints,
    clips: AVIAN_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['foot_l', 'foot_r'],
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
  serpent: {
    id: 'serpent',
    label: 'Serpent (12j)',
    contractId: SERPENT_RIG.rigId,
    joints: SERPENT_RIG.joints,
    clips: SERPENT_RIG.clips.map((c) => c.name),
    rootBone: 'root',
    groundBones: ['pelvis', 'spine_01', 'spine_02', 'tail_01', 'tail_02', 'tail_03', 'tail_04', 'tail_tip'],
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
}

export function jointsForRig(rigId: RigId = 'ual1'): readonly string[] {
  return RIG_SPECS[rigId].joints
}

export function clipsForRig(rigId: RigId = 'ual1'): readonly string[] {
  return RIG_SPECS[rigId].clips
}
