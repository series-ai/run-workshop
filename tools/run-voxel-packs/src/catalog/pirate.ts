/**
 * Adapts the Pirate Nation catalogs to the shared schema. PN's avatar rules
 * are index-keyed maps in the PN showcase (`composeAvatar.ts`); here they
 * become per-part `AvatarPartRules` with `pack: 'pirate'`, so composition
 * never reads a bare index.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AVATAR_ANIMATIONS,
  AVATAR_MODEL_PATH,
  AVATAR_PARTS,
  AVATAR_SLOTS,
} from '../../../../games/pirate-nation-showcase/src/avatar/avatarCatalog.generated'
import {
  FACES_WITH_BUILTIN_EYEBROWS,
  FULL_BODY_SPECIES,
  HEADWEAR_HAIR_MAP,
  HEADWEAR_HIDES_EYEBROWS,
  HEADWEAR_HIDES_FACIALHAIR,
  headwearHidesHair,
  SPECIES_WITH_BUILTIN_EYEBROWS,
  SPECIES_WITH_BUILTIN_FACE,
} from '../../../../games/pirate-nation-showcase/src/avatar/composeAvatar'
import type { AvatarPackCatalog, AvatarPartEntry, AvatarPartRules, SpriteEntry, VoxelModelEntry } from '../../contracts/catalog'
import { readGlbJson } from './glbJson'

export const PIRATE_SHOWCASE_CATALOG = join(import.meta.dirname, '../../../../games/pirate-nation-showcase/public/catalog/pirate-nation')

interface PirateModel {
  id: string
  name: string
  category: string
  filename: string
  relativePath: string
  sizeBytes: number
  bounds: VoxelModelEntry['bounds']
  normalizedShift: number
  license: string
  copyright: string
}

interface PirateSprite {
  id: string
  name: string
  category: 'icons' | 'ui' | 'branding'
  subCategory: string
  relativePath: string
  sizeBytes: number
  copyright: string
}

export function pirateModels(pirateModelsDir: string): VoxelModelEntry[] {
  const models = JSON.parse(readFileSync(join(PIRATE_SHOWCASE_CATALOG, 'models.json'), 'utf8')) as PirateModel[]
  return models.map((model) => {
    const relativePath = model.relativePath.replace(/^models\//, '')
    const json = readGlbJson(join(pirateModelsDir, relativePath))
    return {
      id: model.id as VoxelModelEntry['id'],
      pack: 'pirate',
      name: model.name,
      category: model.category,
      filename: model.filename,
      relativePath,
      leaf: 'world',
      sizeBytes: model.sizeBytes,
      bounds: model.bounds,
      normalizedShift: model.normalizedShift,
      space: model.category === 'characters-skins' ? 'avatar' : 'world',
      clips: (json.animations ?? []).map((a, i) => a.name ?? `clip-${i}`),
      sockets: [],
      pfx: [],
      route: 'upstream',
      license: 'MIT',
      copyright: model.copyright,
    }
  })
}

export function pirateSprites(): SpriteEntry[] {
  const sprites = JSON.parse(readFileSync(join(PIRATE_SHOWCASE_CATALOG, 'sprites.json'), 'utf8')) as PirateSprite[]
  return sprites.map((sprite) => ({
    id: sprite.id,
    pack: 'pirate',
    name: sprite.name,
    category: sprite.category,
    subCategory: sprite.subCategory,
    relativePath: sprite.relativePath.replace(/^sprites\/(?:icons|ui|branding)\//, ''),
    leaf: sprite.category === 'icons' ? 'icons' : 'ui',
    sizeBytes: sprite.sizeBytes,
    license: 'MIT',
    copyright: sprite.copyright,
  }))
}

/** PN's index-keyed composition rules as data on each part. */
export function piratePartRules(slot: string, index: number): AvatarPartRules {
  const rules: AvatarPartRules = { hidesHair: false, hidesEyebrows: false, hidesFacialHair: false }
  if (slot === 'headwear') {
    rules.hidesHair = headwearHidesHair(index)
    const tucked = HEADWEAR_HAIR_MAP[index]
    if (tucked !== undefined && tucked > 0) rules.hairOverride = { pack: 'pirate', slot: 'hair', index: tucked }
    rules.hidesEyebrows = HEADWEAR_HIDES_EYEBROWS.has(index)
    rules.hidesFacialHair = HEADWEAR_HIDES_FACIALHAIR.has(index)
  }
  if (slot === 'face') rules.hidesEyebrows = FACES_WITH_BUILTIN_EYEBROWS.has(index)
  if (slot === 'species') {
    rules.fullBody = FULL_BODY_SPECIES.has(index)
    rules.builtInFace = SPECIES_WITH_BUILTIN_FACE.has(index)
    rules.hidesEyebrows = SPECIES_WITH_BUILTIN_EYEBROWS.has(index)
  }
  return rules
}

export function pirateAvatar(): AvatarPackCatalog {
  const parts: AvatarPartEntry[] = AVATAR_SLOTS.flatMap((slot) =>
    AVATAR_PARTS[slot].map((part) => ({
      ref: { pack: 'pirate' as const, slot, index: part.index },
      nodeName: part.nodeName,
      name: `${slot} ${part.index}`,
      tints: [...part.tints],
      rules: piratePartRules(slot, part.index),
    })),
  )
  const path = AVATAR_MODEL_PATH.replace(/^runtime\/models\//, '')
  return { pack: 'pirate', partsModelPath: path, clipsModelPath: path, leaf: 'world', parts, clips: [...AVATAR_ANIMATIONS] }
}
