import { z } from 'zod'
import proportionsJson from './data/proportions.json'
import { LICENSES, VOXCHAR_PACK_KEYS } from './packs'
import { LEVEL_KIT_LEAF, LEVEL_PACK_KEYS } from './levelPacks'
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
} as const

const humanoidDefaultsSchema = z.object({
  height: z.number().min(0.65).max(1.55),
  legRatio: z.number().min(0.7).max(1.4),
  build: z.number().min(-1).max(1),
  shoulderWidth: z.number().min(0.7).max(1.75),
  torsoBulk: z.number().min(0.7).max(1.75),
  waistScale: z.number().min(0.7).max(1.65),
  headScale: z.number().min(0.75).max(1.5),
  limbThickness: z.number().min(0.7).max(1.75),
  armLength: z.number().min(0.75).max(1.55),
})

const ratioRange = z.tuple([z.number().positive(), z.number().positive()])

const proportionContract = z
  .object({
    version: z.literal(2),
    humanoid: z.object({
      voxelSize: z.number().positive(),
      headwearVoxelSize: z.number().positive(),
      defaults: humanoidDefaultsSchema,
      silhouette: z.object({
        faceToChestWidth: ratioRange,
        minFacePortraitRatio: z.number().positive(),
        headEnvelopeToChestWidth: ratioRange,
        headwearToChestWidth: ratioRange,
        maxHeadwearHeight: z.number().positive(),
        minNeckToFaceWidth: z.number().positive(),
        minArmToChestWidth: z.number().positive(),
        minCalfToThighWidth: z.number().positive(),
        minShoeLength: z.number().positive(),
        maxHeelBackOffset: z.number().nonnegative(),
        minToeStep: z.number().positive(),
      }),
    }),
    bipedalMonster: z.object({
      silhouette: z.object({
        maxWaistToChestWidth: z.number().positive(),
        minHeadDepthMeters: z.number().positive(),
        minHeadForwardOffset: z.number().positive(),
        minFootLengthMeters: z.number().positive(),
      }),
      requireBakedAo: z.boolean(),
    }),
    prop: z.object({
      minHeightMeters: z.number().positive(),
      minUniqueShades: z.number().int().positive(),
    }),
    quadruped: z.object({
      silhouette: z.object({
        faceToChestWidth: ratioRange,
        maxHeadToChestWidth: z.number().positive(),
        maxWaistToChestWidth: z.number().positive(),
        lowerLegSectionVoxels: z.number().int().positive(),
        pawToeStepVoxels: z.tuple([z.number().int().positive(), z.number().int().positive()]),
        maxLimbProudVoxels: z.number().int().nonnegative(),
        maxBrowOverhangVoxels: z.number().int().nonnegative(),
        maxPivotOutsideVoxels: z.number().nonnegative(),
        maxLimbOffCentreVoxels: z.number().nonnegative(),
      }),
    }),
    creature: z.object({
      motion: z.object({
        maxBoneStretch: z.number().positive(),
        maxSegmentGapVoxels: z.number().positive(),
        minAnimatedDegrees: z.number().positive(),
      }),
    }),
  })
  .parse(proportionsJson)

/** Edge length (metres) of one voxel of a voxel human: body, outfit, head and hair. */
export const HUMANOID_VOXEL_SIZE = proportionContract.humanoid.voxelSize

/** Edge length (metres) of one voxel of snug humanoid headwear (`HUMANOID_VOXEL_SIZE / 2`). */
export const HUMANOID_HEADWEAR_VOXEL_SIZE = proportionContract.humanoid.headwearVoxelSize

/**
 * Default proportions of the voxel humans (core, heist, industrial and security packs).
 *
 * The humanoid meshes are sculpted in this pose: with these proportions each voxel is a cube of
 * `HUMANOID_VOXEL_SIZE` on one lattice. `blender/build_core.py` reads the same file for the catalog presets.
 */
export const HUMANOID_PROPORTION_DEFAULTS = { ...PROPORTION_DEFAULTS, ...proportionContract.humanoid.defaults } as const

/**
 * Canonical silhouette ratios of the voxel humans. `scripts/validate.ts` measures them on the built meshes.
 *  - `faceToChestWidth`: skin skull width / garment chest width. Above the range the face reads wide and square.
 *  - `minFacePortraitRatio`: skin skull height / skin skull width. Below it the face reads squat.
 *  - `headEnvelopeToChestWidth`: width of the hair / garment chest width. Below the range the head reads as a pinhead.
 *  - `headwearToChestWidth`: width of headwear at `HUMANOID_HEADWEAR_VOXEL_SIZE` / garment chest width. Prevents mushroom lids and pinhead caps.
 *  - `maxHeadwearHeight`: max vertical span (metres) of headwear so helmets and brims never become towering blocks.
 *  - `minNeckToFaceWidth`: neck width / skin skull width. Below it the neck reads as a pencil.
 *  - `minArmToChestWidth`: bare arm thickness / garment chest width. Below it the arms read as matchsticks.
 *  - `minCalfToThighWidth`: calf width / thigh width. Below it the lower leg reads spindly (`2/3` bare, `1.0` trousers).
 *  - `minShoeLength`: combined Z length of `foot_l` and `ball_l` in metres (`4` voxels = `0.20 m`).
 *  - `maxHeelBackOffset`: max `|foot.minZ - calf.minZ|` in metres; keeps the shoe heel flush at the calf back.
 *  - `minToeStep`: minimum sole toe overhang (`ball.maxZ - foot.maxZ`) in metres (`1` voxel = `0.05 m`).
 */
export const HUMANOID_SILHOUETTE = proportionContract.humanoid.silhouette

/**
 * Canonical silhouette and shading rules of UAL1 bipedal monsters (orcs, trolls, ogres).
 */
export const BIPEDAL_MONSTER_CONTRACT = proportionContract.bipedalMonster

/**
 * Craft rules for static world props (`minHeightMeters`, `minUniqueShades`).
 */
export const PROP_CRAFT = proportionContract.prop

/**
 * Canonical silhouette rules of a voxel quadruped. The Guard Hound is the reference (`docs/art-direction.md`
 * section 10). `blender/creature_kit.py` checks them on the voxel cells of a sculpt and `src/creatureAudit.ts`
 * measures them on the built mesh. Widths are in voxels of the creature.
 *  - `faceToChestWidth`: head width on the eye row / chest width (`5 / 9`). Above the range the head reads as a bobblehead.
 *  - `maxHeadToChestWidth`: width of the head segment with its ears and fur / chest width.
 *  - `maxWaistToChestWidth`: narrowest trunk section / chest width (`5 / 9`). Above it the trunk reads as a box.
 *  - `lowerLegSectionVoxels`: the lower leg is a square column of this width (`2 x 2`).
 *  - `pawToeStepVoxels`: the paw ends this many voxels in front of the lower leg (the L step).
 *  - `maxLimbProudVoxels`: a shoulder plate or a haunch goes at most this many voxels out of the chest side.
 *  - `maxBrowOverhangVoxels`: the brow bar goes at most this many voxels in front of the eyes.
 *  - `maxPivotOutsideVoxels`: a joint is at most this far outside the cells of its segment and of the segment of
 *    its parent (Y and Z).
 *  - `maxLimbOffCentreVoxels`: the lower-leg columns are centred on the leg joint within this distance on X.
 */
export const QUADRUPED_SILHOUETTE = proportionContract.quadruped.silhouette

/**
 * Motion rules of each rigid-segment voxel creature. `src/creatureAudit.ts` measures them on each clip.
 *  - `maxBoneStretch`: scale or shear of a bone that owns voxels. Above it the voxels are not cubes.
 *  - `maxSegmentGapVoxels`: gap that a clip opens between a segment and the segment that holds it (the segment
 *    of its nearest parent joint that owns voxels). Above it the segments tear apart in the clip.
 *  - `minAnimatedDegrees`: a joint that a clip turns by this angle or more is animated. `blender/creature_kit.py`
 *    stops a build that has no segment on an animated joint between two segments.
 */
export const CREATURE_MOTION = proportionContract.creature.motion

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
})
export type AvatarProportions = z.infer<typeof proportionSchema>

export const partRulesSchema = z.object({
  hidesHair: z.boolean().default(false),
  hidesLegsUpper: z.boolean().default(false),
})
export type PartRules = z.infer<typeof partRulesSchema>

export const avatarPartEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  pack: z.enum(VOXCHAR_PACK_KEYS),
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
  pack: z.enum(VOXCHAR_PACK_KEYS),
  leaf: z.enum(['characters', 'world']),
  relativePath: z.string().regex(/\.glb$/),
  nodeName: z.string().min(1),
  label: z.string().min(1),
  hand: z.enum(['hand_r', 'hand_l']),
  gripStyle: z.enum(['handle', 'forearm_shield']).default('handle'),
  triangles: z.number().int().positive(),
})
export type HeldItemEntry = z.infer<typeof heldItemEntrySchema>

const vec3 = z.tuple([z.number(), z.number(), z.number()])
export const worldPropEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  pack: z.enum(VOXCHAR_PACK_KEYS),
  leaf: z.enum(['characters', 'world']),
  relativePath: z.string().regex(/\.glb$/),
  nodeName: z.string().min(1),
  label: z.string().min(1),
  triangles: z.number().int().positive(),
  bounds: z.object({ min: vec3, max: vec3, size: vec3 }),
})
export type WorldPropEntry = z.infer<typeof worldPropEntrySchema>

export const levelPropEntrySchema = worldPropEntrySchema.extend({
  pack: z.enum(LEVEL_PACK_KEYS),
  leaf: z.literal(LEVEL_KIT_LEAF),
  relativePath: z.string().regex(/^level-kit\/[a-z0-9_]+\.glb$/),
  palette: paletteColorsSchema.partial().strict().optional(),
  surface: z.enum(['water', 'glass']).optional(),
  motion: z.object({
    relativePath: z.string().regex(/^vehicles\/[a-z0-9_]+\.glb$/),
    clips: z.array(z.string().min(1)).min(1).refine((clips) => new Set(clips).size === clips.length),
    lights: z.array(z.string().regex(/^[a-z0-9_]+_light$/)).refine((lights) => new Set(lights).size === lights.length).default([]),
  }).optional(),
})
export type LevelPropEntry = z.infer<typeof levelPropEntrySchema>
export const characterLevelPropEntrySchema = levelPropEntrySchema.extend({ pack: z.enum(VOXCHAR_PACK_KEYS) })

export const characterPresetSchema = z.object({
  id: z.string().min(1),
  pack: z.enum(VOXCHAR_PACK_KEYS),
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
  pack: z.enum(VOXCHAR_PACK_KEYS),
  label: z.string().min(1),
  license: z.enum(LICENSES),
  rigModelPath: z.string().regex(/\.glb$/).optional(),
  creatureRigs: z.array(creatureRigEntrySchema).optional(),
  clips: z.array(z.string()),
  parts: z.array(avatarPartEntrySchema),
  heldItems: z.array(heldItemEntrySchema),
  props: z.array(worldPropEntrySchema),
  levelKitProps: z.array(characterLevelPropEntrySchema).default([]),
  presets: z.array(characterPresetSchema),
})
export type PackCatalog = z.infer<typeof packCatalogSchema>

export const buildManifestSchema = z.object({
  version: z.literal(1),
  packs: z.array(packCatalogSchema),
})
