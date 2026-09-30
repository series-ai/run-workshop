/**
 * Catalog schemas shared by the pipeline (writer) and the showcase (reader).
 *
 * `VoxelModelEntry` is a superset of the Pirate Nation showcase's
 * `PirateNationModelEntry`, so PN entries adapt with `pack: 'pirate'` plus
 * the extra fields. The showcase parses every catalog with these schemas at
 * load time; nothing downstream re-checks the shape.
 */
import { z } from 'zod'
import { CATEGORIES } from './categories'
import avatarLayersJson from './data/avatar-layers.json'
import { LEAF_KINDS, LICENSES, PACK_KEYS } from './packs'

export const AVATAR_SLOTS = [
  'species',
  'face',
  'eyebrow',
  'hair',
  'facialhair',
  'ears',
  'eyewear',
  'headwear',
  'tops',
  'bottoms',
  'shoes',
  'back',
] as const
export type AvatarSlot = (typeof AVATAR_SLOTS)[number]

/** How far (voxels) each slot's faces sit outside the voxel grid (see data/avatar-layers.json). */
export const AVATAR_LAYER_VOXELS: Readonly<Record<AvatarSlot, number>> = (() => {
  const layers = avatarLayersJson.layers as Record<string, number>
  for (const slot of AVATAR_SLOTS) if (typeof layers[slot] !== 'number') throw new Error(`data/avatar-layers.json has no layer for slot "${slot}"`)
  return layers as Record<AvatarSlot, number>
})()

const vec3 = z.tuple([z.number(), z.number(), z.number()])
export const boundsSchema = z.object({ min: vec3, max: vec3, size: vec3 })
export type Bounds = z.infer<typeof boundsSchema>

const packKey = z.enum(PACK_KEYS)
const modelId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).brand<'ModelId'>()
export type ModelId = z.infer<typeof modelId>

export const PFX_TRIGGERS = ['idle', 'manual'] as const
export const pfxBindingSchema = z
  .object({
    /** A RUN voxel effect of the same pack (`rvx-<pack>-<name>`, tools/3d-pfx-library). */
    effectId: z.string().min(1),
    /** Socket node the effect follows; omitted = model origin. */
    socket: z.string().regex(/^socket-[a-z0-9-]+$/).optional(),
    /**
     * `idle` plays from the start, `manual` plays on demand, `clip:<name>`
     * plays with that clip. Loops run while their trigger is on; one-shots
     * fire once per trigger (per clip cycle for clips).
     */
    trigger: z.union([z.enum(PFX_TRIGGERS), z.string().regex(/^clip:.+$/)]),
    /**
     * Nominal effect size in model units (world assets: voxels; avatar-space
     * assets: avatar units). RVX effects are drawn at size 1: a flame's
     * height, a plume's width, a burst's diameter.
     */
    size: z.number().positive(),
    /** The effect's +Y (its aim: up for smoke, down the barrel for muzzles) in the socket's frame; omitted = up. */
    aim: vec3.refine((v) => Math.hypot(...v) > 1e-6, 'aim must not be zero').optional(),
    /** Where the effect's origin sits, in the socket's frame and model units (a blade trail starts at the guard); omitted = the socket. */
    offset: vec3.optional(),
    /** Seconds into the clip at which a one-shot fires (clip triggers only); omitted = 0. */
    at: z.number().nonnegative().optional(),
  })
  .refine((b) => b.at === undefined || b.trigger.startsWith('clip:'), 'at is for clip triggers only')
export type PfxBinding = z.infer<typeof pfxBindingSchema>

export const voxelModelEntrySchema = z.object({
  id: modelId,
  pack: packKey,
  name: z.string().min(1),
  category: z.string().min(1),
  filename: z.string().regex(/\.glb$/),
  /** Path inside the leaf, e.g. `props/fantasy-props-barrel.glb`. */
  relativePath: z.string().regex(/\.glb$/),
  leaf: z.enum(LEAF_KINDS),
  sizeBytes: z.number().int().nonnegative(),
  bounds: boundsSchema,
  normalizedShift: z.number(),
  space: z.enum(['world', 'avatar']),
  clips: z.array(z.string()),
  sockets: z.array(z.string().regex(/^socket-[a-z0-9-]+$/)),
  pfx: z.array(pfxBindingSchema),
  route: z.enum(['code', 'generated', 'upstream']),
  license: z.enum(LICENSES),
  copyright: z.string().min(1),
})
export type VoxelModelEntry = z.infer<typeof voxelModelEntrySchema>

/** New-pack entries must use a known category; PN keeps its own 10. */
export const rvxModelEntrySchema = voxelModelEntrySchema.extend({
  category: z.enum(CATEGORIES),
  route: z.enum(['code', 'generated']),
})

export const avatarPartRefSchema = z.object({
  pack: packKey,
  slot: z.enum(AVATAR_SLOTS),
  index: z.number().int().positive(),
})
export type AvatarPartRef = z.infer<typeof avatarPartRefSchema>

/**
 * Pack-qualified composition rules. PN's index-keyed maps
 * (`HEADWEAR_HAIR_MAP`, `HEADWEAR_HIDES_*`) convert into this per part, so a
 * fantasy headwear 1 can never inherit PN headwear 1's behaviour.
 */
export const avatarPartRulesSchema = z.object({
  hidesHair: z.boolean(),
  /** Hair the part forces when it does not hide hair (PN "tucked hair"). */
  hairOverride: avatarPartRefSchema.optional(),
  hidesEyebrows: z.boolean(),
  hidesFacialHair: z.boolean(),
  /** Species only: the body mesh already includes outfit, face and hair (PN full-body skins). */
  fullBody: z.boolean().optional(),
  /** Species only: the body mesh has its own face, so the face slot does not apply. */
  builtInFace: z.boolean().optional(),
})
export type AvatarPartRules = z.infer<typeof avatarPartRulesSchema>

export const TINT_CHANNELS = ['skin', 'hair'] as const
export const avatarPartEntrySchema = z.object({
  ref: avatarPartRefSchema,
  /** `<slot> <index>` for PN, `<slot> <pack>-<index>` for RUN packs. */
  nodeName: z.string().min(1),
  name: z.string().min(1),
  tints: z.array(z.enum(TINT_CHANNELS)),
  rules: avatarPartRulesSchema,
})
export type AvatarPartEntry = z.infer<typeof avatarPartEntrySchema>

export const avatarPackCatalogSchema = z.object({
  pack: packKey,
  /** Leaf-relative path of the GLB holding this pack's part meshes. */
  partsModelPath: z.string().regex(/\.glb$/),
  /** Leaf-relative path of the GLB holding this pack's avatar clips (PN: the same avatar GLB). */
  clipsModelPath: z.string().regex(/\.glb$/),
  leaf: z.enum(LEAF_KINDS),
  parts: z.array(avatarPartEntrySchema),
  clips: z.array(z.string().regex(/^\d{2}_/)),
})
export type AvatarPackCatalog = z.infer<typeof avatarPackCatalogSchema>

export function partNodeName(ref: AvatarPartRef): string {
  return ref.pack === 'pirate' ? `${ref.slot} ${ref.index}` : `${ref.slot} ${ref.pack}-${ref.index}`
}

/** Parses a part node name back to its ref. Throws on a name outside the convention. */
export function parsePartNodeName(nodeName: string): AvatarPartRef {
  const match = /^([a-z]+) (?:([a-z]+)-)?(\d+)$/.exec(nodeName)
  const slot = match?.[1]
  if (!match || !slot || !(AVATAR_SLOTS as readonly string[]).includes(slot)) {
    throw new Error(`"${nodeName}" is not a part node name (<slot> [<pack>-]<index>)`)
  }
  return avatarPartRefSchema.parse({ pack: match[2] ?? 'pirate', slot, index: Number(match[3]) })
}

export const pfxCatalogSchema = z.object({
  pack: packKey,
  /** Effect ids the pack uses, from tools/3d-pfx-library. */
  effects: z.array(z.string().min(1)),
})
export type PfxCatalog = z.infer<typeof pfxCatalogSchema>

export const spriteEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  pack: packKey,
  name: z.string().min(1),
  category: z.enum(['icons', 'ui', 'branding']),
  subCategory: z.string().min(1),
  /** Path inside the leaf, e.g. `icon-fantasy-longsword.png`. */
  relativePath: z.string().regex(/\.png$/),
  leaf: z.enum(['icons', 'ui']),
  sizeBytes: z.number().int().nonnegative(),
  license: z.enum(LICENSES),
  copyright: z.string().min(1),
})
export type SpriteEntry = z.infer<typeof spriteEntrySchema>

/** One pack's full catalog as the showcase loads it: `catalog/<pack>/catalog.json`. */
export const packCatalogSchema = z.object({
  pack: packKey,
  label: z.string().min(1),
  models: z.array(voxelModelEntrySchema),
  avatar: avatarPackCatalogSchema,
  sprites: z.array(spriteEntrySchema),
  pfx: pfxCatalogSchema,
})
export type PackCatalog = z.infer<typeof packCatalogSchema>
