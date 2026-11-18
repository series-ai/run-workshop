import { z } from 'zod'
import { LICENSES, POLY_PACK_KEYS } from './packs'
import { paletteColorsSchema } from './palette'
import { characterRagdollSchema, ragdollColliderMapSchema } from './ragdoll'
import { RIG_IDS } from './rig'

export const AVATAR_SLOTS = ['body', 'head', 'hair', 'torso', 'legs', 'headwear', 'back'] as const
export type AvatarSlot = (typeof AVATAR_SLOTS)[number]

export const REQUIRED_SLOTS = ['body', 'head', 'torso', 'legs'] as const
export type RequiredSlot = (typeof REQUIRED_SLOTS)[number]

export const PROPORTION_DEFAULTS = {
  height: 1.0,
  legRatio: 1.0,
  build: 0.0,
  shoulderWidth: 1.0,
  torsoBulk: 1.0,
  waistScale: 1.0,
  headScale: 1.0,
  limbThickness: 1.0,
  armLength: 1.0,
  bodyLength: 1.0,
  neckScale: 1.0,
  handScale: 1.0,
  footScale: 1.0,
  faceJaw: 0.0,
  faceNose: 0.0,
  faceBrow: 0.0,
  faceSmile: 0.0,
  faceBlink: 0.0,
} as const

export const proportionSchema = z.object({
  height: z.number().min(0.65).max(1.55),
  legRatio: z.number().min(0.7).max(1.4).optional(),
  build: z.number().min(-1).max(1).optional(),
  shoulderWidth: z.number().min(0.7).max(1.75),
  torsoBulk: z.number().min(0.7).max(1.75),
  waistScale: z.number().min(0.7).max(1.65),
  headScale: z.number().min(0.75).max(1.5),
  limbThickness: z.number().min(0.7).max(1.75),
  armLength: z.number().min(0.75).max(1.55).optional(),
  bodyLength: z.number().min(0.7).max(1.45).optional(),
  neckScale: z.number().min(0.75).max(1.45).optional(),
  handScale: z.number().min(0.75).max(1.45).optional(),
  footScale: z.number().min(0.75).max(1.45).optional(),
  faceJaw: z.number().min(-1).max(1).optional(),
  faceNose: z.number().min(-1).max(1).optional(),
  faceBrow: z.number().min(-1).max(1).optional(),
  faceSmile: z.number().min(-1).max(1).optional(),
  faceBlink: z.number().min(0).max(1).optional(),
})
export type AvatarProportions = z.infer<typeof proportionSchema>

export const partRulesSchema = z.object({
  hidesHair: z.boolean().default(false),
  hidesLegsUpper: z.boolean().default(false),
})
export type PartRules = z.infer<typeof partRulesSchema>

export const avatarPartEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  pack: z.enum(POLY_PACK_KEYS),
  leaf: z.enum(['characters', 'world']),
  relativePath: z.string().regex(/\.glb$/),
  nodeName: z.string().min(1),
  slot: z.enum(AVATAR_SLOTS),
  label: z.string().min(1),
  triangles: z.number().int().positive(),
  rigId: z.enum(RIG_IDS).default('ual1'),
  rules: partRulesSchema,
  ragdollColliders: ragdollColliderMapSchema.optional(),
})
export type AvatarPartEntry = z.infer<typeof avatarPartEntrySchema>

export const heldItemEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  pack: z.enum(POLY_PACK_KEYS),
  leaf: z.enum(['characters', 'world']),
  relativePath: z.string().regex(/\.glb$/),
  nodeName: z.string().min(1),
  label: z.string().min(1),
  hand: z.enum(['hand_r', 'hand_l']),
  triangles: z.number().int().positive(),
})
export type HeldItemEntry = z.infer<typeof heldItemEntrySchema>

const vec3 = z.tuple([z.number(), z.number(), z.number()])
export const worldPropEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  pack: z.enum(POLY_PACK_KEYS),
  leaf: z.enum(['characters', 'world']),
  relativePath: z.string().regex(/\.glb$/),
  nodeName: z.string().min(1),
  label: z.string().min(1),
  triangles: z.number().int().positive(),
  bounds: z.object({ min: vec3, max: vec3, size: vec3 }),
})
export type WorldPropEntry = z.infer<typeof worldPropEntrySchema>

export const characterPresetSchema = z.object({
  id: z.string().min(1),
  pack: z.enum(POLY_PACK_KEYS),
  label: z.string().min(1),
  rigId: z.enum(RIG_IDS).default('ual1'),
  clip: z.string().min(1),
  body: z.string().min(1),
  head: z.string().nullable(),
  hair: z.string().nullable(),
  torso: z.string().nullable(),
  legs: z.string().nullable(),
  headwear: z.string().nullable(),
  back: z.string().nullable(),
  heldRight: z.string().nullable(),
  heldLeft: z.string().nullable(),
  palette: paletteColorsSchema,
  proportions: proportionSchema,
  ragdoll: characterRagdollSchema.optional(),
})
export type CharacterPreset = z.infer<typeof characterPresetSchema>

export const creatureRigEntrySchema = z.object({
  rigId: z.enum(RIG_IDS),
  rigModelPath: z.string().regex(/\.glb$/),
  clips: z.array(z.string().min(1)),
})
export type CreatureRigEntry = z.infer<typeof creatureRigEntrySchema>

export const packCatalogSchema = z.object({
  version: z.literal(1),
  pack: z.enum(POLY_PACK_KEYS),
  label: z.string().min(1),
  license: z.enum(LICENSES),
  rigModelPath: z.string().regex(/\.glb$/).optional(),
  creatureRigs: z.array(creatureRigEntrySchema).optional(),
  clips: z.array(z.string()),
  parts: z.array(avatarPartEntrySchema),
  heldItems: z.array(heldItemEntrySchema),
  props: z.array(worldPropEntrySchema),
  presets: z.array(characterPresetSchema),
})
export type PackCatalog = z.infer<typeof packCatalogSchema>
