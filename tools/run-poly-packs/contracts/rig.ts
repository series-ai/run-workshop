import { z } from 'zod'
import rigJson from './data/ual1-rig.json'

const vec3 = z.tuple([z.number(), z.number(), z.number()])

const rigSchema = z.object({
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

export const UAL1_RIG = rigSchema.parse(rigJson)
export const UAL1_JOINTS: readonly string[] = UAL1_RIG.joints
export const UAL1_CLIPS: readonly string[] = UAL1_RIG.clips.map((c) => c.name)
export type Ual1ClipName = string
