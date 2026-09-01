/**
 * Turns a trait selection into the set of part nodes a Pirate Nation avatar
 * shows.
 *
 * Every part in the art file sits at an identity transform and binds to the
 * same 16-bone rig, so composing an avatar is picking a subset of node names.
 * There is no mesh merging and no rig retargeting to do.
 */
import {
  AVATAR_BASE_NODE,
  AVATAR_PARTS,
  AVATAR_SLOTS,
  type AvatarSlot,
} from './avatarCatalog.generated'

/** Full-body character skins that already include integrated outfit, pants, shoes, and face. */
export const FULL_BODY_SPECIES = new Set([5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19])

export function isFullBodySpecies(speciesIndex?: number | null): boolean {
  return typeof speciesIndex === 'number' && FULL_BODY_SPECIES.has(speciesIndex)
}

/**
 * Headwear to hair mapping from upstream Unity Headwear.json.
 * -1 or 0: hat encapsulates head and hides hair completely.
 * > 0: hat requires a specific low-profile tucked hair (e.g. hair 4) to prevent volume clipping.
 */
export const HEADWEAR_HAIR_MAP: Record<number, number> = {
  1: -1, 2: -1, 3: -1, 4: 4, 5: 4, 6: -1, 7: 4, 8: -1, 9: -1, 10: -1,
  11: -1, 12: -1, 13: -1, 14: -1, 15: -1, 16: -1, 17: 0, 18: 4, 19: -1, 20: -1,
  21: -1, 22: -1, 23: -1, 24: -1, 25: -1, 26: -1, 27: -1, 28: -1, 29: -1, 30: -1,
  31: -1, 32: -1, 33: -1, 34: -1, 35: -1, 36: -1, 37: -1, 38: 0, 39: -1, 40: -1,
  41: -1, 42: -1, 43: -1, 44: -1, 45: -1, 46: -1, 47: -1, 48: -1, 49: -1, 50: -1,
  51: -1, 52: -1, 53: -1, 54: -1, 70: -1,
}

export function getEffectiveHairForHeadwear(
  headwearIndex?: number | null,
  requestedHairIndex?: number | null,
): number | null {
  if (typeof headwearIndex !== 'number') return requestedHairIndex ?? null
  const rule = HEADWEAR_HAIR_MAP[headwearIndex]
  if (rule === undefined) {
    if (headwearIndex >= 55) return null
    return requestedHairIndex ?? null
  }
  if (rule <= 0) return null
  return requestedHairIndex ? rule : null
}

export function headwearHidesHair(headwearIndex?: number | null): boolean {
  if (typeof headwearIndex !== 'number') return false
  const rule = HEADWEAR_HAIR_MAP[headwearIndex]
  if (rule === undefined) return headwearIndex >= 55
  return rule <= 0
}

/** Face decals that already include integral eyebrows or are eyebrow decals themselves. */
export const FACES_WITH_BUILTIN_EYEBROWS = new Set([2, 5, 15, 16, 17, 18])

export function faceHasBuiltInEyebrows(faceIndex?: number | null): boolean {
  return typeof faceIndex === 'number' && FACES_WITH_BUILTIN_EYEBROWS.has(faceIndex)
}

/** Species skins that already contain integral stylized 3D eyebrows modeled into the skull. */
export const SPECIES_WITH_BUILTIN_EYEBROWS = new Set([3, 4])

export function speciesHasBuiltInEyebrows(speciesIndex?: number | null): boolean {
  return typeof speciesIndex === 'number' && SPECIES_WITH_BUILTIN_EYEBROWS.has(speciesIndex)
}

/**
 * Validates whether a modular slot applies to a particular species.
 * Full-body character models have integral 3D geometry for faces, clothing, and hair.
 * Species with built-in 3D eyebrows (Vampire, Zombie) do not take modular eyebrow decals.
 */
export function isSlotSupportedForSpecies(slot: AvatarSlot, speciesIndex?: number | null): boolean {
  if (slot === 'species' || slot === 'back') return true
  if (isFullBodySpecies(speciesIndex)) {
    return false
  }
  if (slot === 'eyebrow' && speciesHasBuiltInEyebrows(speciesIndex)) {
    return false
  }
  return true
}

/**
 * Slots a base body avatar cannot render without.
 * Full-body skins (species 7..11, 14..19) only require 'species'.
 */
export const REQUIRED_SLOTS = ['species', 'face', 'tops', 'bottoms', 'shoes'] as const

export type RequiredSlot = (typeof REQUIRED_SLOTS)[number]

export function getRequiredSlots(speciesIndex?: number | null): readonly AvatarSlot[] {
  if (isFullBodySpecies(speciesIndex)) {
    return ['species']
  }
  return REQUIRED_SLOTS
}

/** Chance each optional slot is filled when rolling a random pirate. */
const OPTIONAL_SLOT_CHANCE: Record<Exclude<AvatarSlot, RequiredSlot>, number> = {
  eyebrow: 0.9,
  hair: 0.8,
  facialhair: 0.35,
  ears: 0.5,
  eyewear: 0.25,
  headwear: 0.55,
  back: 0.15,
}

/** Skin tones from the upstream trait table. */
export const SKIN_COLORS = [
  '#f2d5b4', '#e0ac69', '#c68642', '#8d5524', '#5c3a21',
  '#add8e6', '#7fffd4', '#008080', '#9acd32', '#f2f2f2',
] as const

/** Hair tones from the upstream trait table. */
export const HAIR_COLORS = [
  '#2c1b10', '#4b2e1f', '#8b4513', '#c76a1e', '#d9b382',
  '#e8e8e8', '#3b3b3b', '#7b2d8b', '#1f6f8b', '#a01f1f',
] as const

export const DEFAULT_SKIN_COLOR = SKIN_COLORS[0]
export const DEFAULT_HAIR_COLOR = HAIR_COLORS[0]

/**
 * A chosen pirate. A slot maps to a part index, or to null/absent when the
 * pirate does not wear that slot.
 */
export type AvatarSelection = Partial<Record<AvatarSlot, number | null>> & {
  skinColor?: string
  hairColor?: string
}

function findPart(slot: AvatarSlot, index: number): string {
  const part = AVATAR_PARTS[slot].find((entry) => entry.index === index)
  if (!part) {
    throw new Error(
      `Pirate Nation avatar has no part "${slot} ${index}". ` +
        `Valid ${slot} indices: ${AVATAR_PARTS[slot].map((entry) => entry.index).join(', ')}`,
    )
  }
  return part.nodeName
}

/**
 * Resolves a selection to the node names to show.
 * Throws when a required slot is missing or an index does not exist.
 * Automatically filters out modular parts that are incompatible with full-body skins
 * or hair that is hidden beneath full headwear.
 */
export function resolvePartNodes(selection: AvatarSelection): string[] {
  if (typeof selection.species !== 'number') {
    throw new Error('Pirate Nation avatar selection is missing required slot "species"')
  }

  const required = getRequiredSlots(selection.species)
  for (const slot of required) {
    const index = selection[slot]
    if (typeof index !== 'number') {
      throw new Error(`Pirate Nation avatar selection is missing required slot "${slot}"`)
    }
  }

  const effectiveHair = getEffectiveHairForHeadwear(selection.headwear, selection.hair)
  const hideEyebrows = faceHasBuiltInEyebrows(selection.face)

  const nodes: string[] = []
  for (const slot of AVATAR_SLOTS) {
    if (!isSlotSupportedForSpecies(slot, selection.species)) continue
    if (slot === 'hair') {
      if (typeof effectiveHair === 'number') {
        nodes.push(findPart('hair', effectiveHair))
      }
      continue
    }
    if (slot === 'eyebrow' && hideEyebrows) continue
    const index = selection[slot]
    if (typeof index !== 'number') continue
    nodes.push(findPart(slot, index))
  }
  return nodes
}

/**
 * Rewrites a catalog node name the way three.js does while loading.
 *
 * `GLTFLoader` passes every node name through
 * `PropertyBinding.sanitizeNodeName`, which replaces whitespace with an
 * underscore. Catalog names carry the glTF spelling (`species 19`), so they
 * must go through the same rule before matching a loaded scene.
 */
export function toThreeNodeName(nodeName: string): string {
  return nodeName.replace(/\s/g, '_')
}

/** Resolves a selection to node names as they appear in a loaded three.js scene. */
export function resolveThreePartNodes(selection: AvatarSelection): string[] {
  return resolvePartNodes(selection).map(toThreeNodeName)
}

/** Random source. Returns a float in [0, 1). */
export type Rng = () => number

/**
 * Builds an RNG that replays a fixed sequence, looping when it runs out.
 * Keeps avatar rolls reproducible in tests and in shareable seeds.
 */
export function makeSequenceRng(values: readonly number[]): Rng {
  if (values.length === 0) throw new Error('makeSequenceRng needs at least one value')
  let cursor = 0
  return () => values[cursor++ % values.length]!
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!
}

/**
 * Face parts in the glTF that are actual faces with eyes and mouth.
 * (Indices 2, 5, 15, 16 are loose eyebrow scratch models with no eyes or mouth).
 */
export const VALID_FACE_PARTS = AVATAR_PARTS.face.filter((part) =>
  [1, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20].includes(part.index),
)

/**
 * Rolls a complete, valid avatar selection from the catalog.
 *
 * Uses the supplied RNG so rolls can be replayed in tests.
 */
export function randomAvatarSelection(rng: Rng = Math.random): AvatarSelection {
  const selection: AvatarSelection = {
    species: pick(AVATAR_PARTS.species, rng).index,
    skinColor: pick(SKIN_COLORS, rng),
    hairColor: pick(HAIR_COLORS, rng),
  }

  const isFullBody = isFullBodySpecies(selection.species)

  if (isFullBody) {
    // Full body skins (species 7..11, 14..19) already have integrated clothing & geometry.
    selection.face = null
    selection.tops = null
    selection.bottoms = null
    selection.shoes = null
    selection.hair = null
    selection.facialhair = null
    selection.eyebrow = null
    selection.headwear = null
    selection.ears = null
    selection.eyewear = null
    selection.back = rng() < OPTIONAL_SLOT_CHANCE.back ? pick(AVATAR_PARTS.back, rng).index : null
    return selection
  }

  // Base bodies require face, tops, bottoms, and shoes
  for (const slot of REQUIRED_SLOTS) {
    if (slot === 'species') continue
    if (slot === 'face') {
      selection.face = pick(VALID_FACE_PARTS, rng).index
      continue
    }
    selection[slot] = pick(AVATAR_PARTS[slot], rng).index
  }

  // Roll headwear first to check if hair is hidden or tailored
  if (rng() < OPTIONAL_SLOT_CHANCE.headwear) {
    selection.headwear = pick(AVATAR_PARTS.headwear, rng).index
  } else {
    selection.headwear = null
  }

  for (const [slot, chance] of Object.entries(OPTIONAL_SLOT_CHANCE) as [
    Exclude<AvatarSlot, RequiredSlot>,
    number,
  ][]) {
    if (slot === 'headwear') continue
    if (slot === 'hair' && headwearHidesHair(selection.headwear)) {
      selection.hair = null
      continue
    }
    if (slot === 'eyebrow' && faceHasBuiltInEyebrows(selection.face)) {
      selection.eyebrow = null
      continue
    }
    if (rng() < chance) {
      selection[slot] = pick(AVATAR_PARTS[slot], rng).index
    } else {
      selection[slot] = null
    }
  }

  return selection
}
