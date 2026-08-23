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

/**
 * Slots an avatar cannot render without. A pirate with no species has no
 * body, so a missing required slot is an error rather than a bare rig.
 */
export const REQUIRED_SLOTS = ['species', 'face', 'tops', 'bottoms', 'shoes'] as const

export type RequiredSlot = (typeof REQUIRED_SLOTS)[number]

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
 * Resolves a selection to the node names to show, base body first.
 * Throws when a required slot is missing or an index does not exist.
 */
export function resolvePartNodes(selection: AvatarSelection): string[] {
  for (const slot of REQUIRED_SLOTS) {
    const index = selection[slot]
    if (typeof index !== 'number') {
      throw new Error(`Pirate Nation avatar selection is missing required slot "${slot}"`)
    }
  }

  const nodes: string[] = [AVATAR_BASE_NODE]
  for (const slot of AVATAR_SLOTS) {
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
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!
}

function pickIndex(slot: AvatarSlot, rng: Rng): number {
  return pick(AVATAR_PARTS[slot], rng).index
}

/** Rolls a complete, renderable pirate. */
export function randomAvatarSelection(rng: Rng = Math.random): AvatarSelection {
  const selection: AvatarSelection = {
    skinColor: pick(SKIN_COLORS, rng),
    hairColor: pick(HAIR_COLORS, rng),
  }

  for (const slot of REQUIRED_SLOTS) {
    selection[slot] = pickIndex(slot, rng)
  }

  for (const [slot, chance] of Object.entries(OPTIONAL_SLOT_CHANCE)) {
    selection[slot as AvatarSlot] =
      rng() < chance ? pickIndex(slot as AvatarSlot, rng) : null
  }

  return selection
}
