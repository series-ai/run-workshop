/**
 * Avatar selection and visibility. Pure: which parts show is decided only by
 * each part entry's pack-qualified `rules`, never by a bare index, so parts
 * from different packs with the same index cannot share behaviour.
 */
import { AVATAR_SLOTS, type AvatarPartEntry, type AvatarPartRef, type AvatarSlot, type PackCatalog } from '@rvx/contracts/catalog'

export interface ModularBase {
  kind: 'modular'
  species: AvatarPartRef
  parts: Partial<Record<Exclude<AvatarSlot, 'species'>, AvatarPartRef>>
}

export interface SkinBase {
  kind: 'skin'
  /** Model id of a characters-skins entry (any pack, PN skins included). */
  skin: string
}

export interface AvatarSelection {
  base: ModularBase | SkinBase
  /** Model id of a held-items entry. */
  held: string | null
  skinColor: string
  hairColor: string
  clip: string
}

export const refKey = (ref: AvatarPartRef) => `${ref.pack}:${ref.slot}:${ref.index}`

export class PartIndex {
  private readonly byKey = new Map<string, AvatarPartEntry>()

  constructor(catalogs: readonly PackCatalog[]) {
    for (const catalog of catalogs) for (const part of catalog.avatar.parts) this.byKey.set(refKey(part.ref), part)
  }

  get(ref: AvatarPartRef): AvatarPartEntry {
    const part = this.byKey.get(refKey(ref))
    if (!part) throw new Error(`no avatar part ${ref.slot} ${ref.index} in pack ${ref.pack}`)
    return part
  }

  list(slot: AvatarSlot): AvatarPartEntry[] {
    return [...this.byKey.values()].filter((part) => part.ref.slot === slot)
  }
}

/** Parts to show for a modular avatar, after every selected part's rules. */
export function resolveVisibleParts(base: ModularBase, index: PartIndex): AvatarPartEntry[] {
  const species = index.get(base.species)
  const chosen = AVATAR_SLOTS.filter((slot): slot is Exclude<AvatarSlot, 'species'> => slot !== 'species')
    .map((slot) => base.parts[slot])
    .filter((ref): ref is AvatarPartRef => ref !== undefined)
    .map((ref) => index.get(ref))

  if (species.rules.fullBody) return [species, ...chosen.filter((part) => part.ref.slot === 'back')]

  const hidden = new Set<AvatarSlot>()
  if (species.rules.builtInFace) hidden.add('face')
  // Hide rules of the species count like those of any other part. Tucked hair
  // replaces chosen hair only, as in Pirate Nation (getEffectiveHairForHeadwear).
  let hairOverride: AvatarPartRef | undefined
  for (const part of [species, ...chosen]) {
    if (part.rules.hidesHair) hidden.add('hair')
    if (part.rules.hidesEyebrows) hidden.add('eyebrow')
    if (part.rules.hidesFacialHair) hidden.add('facialhair')
    hairOverride ??= part.rules.hairOverride
  }

  const visible = [species]
  for (const part of chosen) {
    if (hidden.has(part.ref.slot)) continue
    visible.push(part.ref.slot === 'hair' && hairOverride ? index.get(hairOverride) : part)
  }
  return visible
}

export function defaultSelection(): AvatarSelection {
  const pn = (slot: AvatarSlot, index: number): AvatarPartRef => ({ pack: 'pirate', slot, index })
  return {
    base: {
      kind: 'modular',
      species: pn('species', 1),
      parts: { face: pn('face', 1), eyebrow: pn('eyebrow', 1), hair: pn('hair', 1), tops: pn('tops', 1), bottoms: pn('bottoms', 1), shoes: pn('shoes', 1) },
    },
    held: null,
    skinColor: '#f2d5b4',
    hairColor: '#2c1b10',
    clip: '01_Idle_1',
  }
}

// ------------------------------------------------------------------ random roll

/** Random source: a float in [0, 1). Tests pass a fixed sequence. */
export type Rng = () => number

export const SKIN_COLORS = ['#f2d5b4', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#add8e6', '#7fffd4', '#008080', '#9acd32', '#f2f2f2']
export const HAIR_COLORS = ['#2c1b10', '#4b2e1f', '#8b4513', '#c76a1e', '#d9b382', '#e8e8e8', '#3b3b3b', '#7b2d8b', '#1f6f8b', '#a01f1f']

/** Chance each optional slot is filled on a roll (from the Pirate Nation showcase). */
const OPTIONAL_CHANCE: Record<'eyebrow' | 'hair' | 'facialhair' | 'ears' | 'eyewear' | 'headwear' | 'back', number> = {
  eyebrow: 0.9,
  hair: 0.8,
  facialhair: 0.35,
  ears: 0.5,
  eyewear: 0.25,
  headwear: 0.55,
  back: 0.15,
}
const REQUIRED: readonly OptionalSlot[] = ['face', 'tops', 'bottoms', 'shoes']
type OptionalSlot = Exclude<AvatarSlot, 'species'>

/**
 * PN species weights (Pirate Nation metadata): customisable bodies first,
 * full-body monolithic skins rare. The RUN packs add no species.
 */
const PN_SPECIES_WEIGHTS: Record<number, number> = { 1: 50, 2: 5, 3: 7, 4: 7, 5: 4, 6: 4, 12: 8, 13: 5, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1 }

/**
 * PN parts a roll never picks: misnamed files in the PN avatar glTF. Face 2, 5,
 * 15 and 16 are loose eyebrow models with no eyes or mouth; eyebrow 2 and 5 are
 * full face decals, 15 is an eye accent, 20 sits off the brow line. They stay
 * pickable by hand.
 */
const PN_ROLL_EXCLUDE: Partial<Record<AvatarSlot, readonly number[]>> = { face: [2, 5, 15, 16], eyebrow: [2, 5, 15, 20] }

const pick = <T>(items: readonly T[], rng: Rng): T => {
  if (items.length === 0) throw new Error('nothing to pick from')
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!
}

/**
 * A random, valid modular avatar. `theme` is the pack the roll favours: each
 * slot takes the theme pack's part 70% of the time when the pack has one for
 * that slot, else a Pirate Nation part. `theme: 'pirate'` rolls PN only.
 */
export function rollModular(index: PartIndex, theme: PackCatalog['pack'], rng: Rng): ModularBase {
  const rollable = (slot: AvatarSlot, pack: string) =>
    index.list(slot).filter((p) => p.ref.pack === pack && !(pack === 'pirate' && PN_ROLL_EXCLUDE[slot]?.includes(p.ref.index)))
  const partFor = (slot: OptionalSlot): AvatarPartRef => {
    const themed = theme === 'pirate' ? [] : rollable(slot, theme)
    const pool = themed.length > 0 && rng() < 0.7 ? themed : rollable(slot, 'pirate')
    return pick(pool.length > 0 ? pool : themed, rng).ref
  }

  const speciesParts = index.list('species').filter((p) => p.ref.pack === 'pirate')
  const weights = speciesParts.map((p) => PN_SPECIES_WEIGHTS[p.ref.index] ?? 1)
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  const species = speciesParts.find((_, i) => (r -= weights[i]!) <= 0) ?? speciesParts[0]!
  const parts: ModularBase['parts'] = {}
  const chance = (slot: keyof typeof OPTIONAL_CHANCE) => rng() < OPTIONAL_CHANCE[slot]

  if (species.rules.fullBody) {
    if (chance('back')) parts.back = partFor('back')
    return { kind: 'modular', species: species.ref, parts }
  }
  for (const slot of REQUIRED) if (!(slot === 'face' && species.rules.builtInFace)) parts[slot] = partFor(slot)
  if (chance('headwear')) parts.headwear = partFor('headwear')
  const hat = parts.headwear ? index.get(parts.headwear).rules : undefined
  const face = parts.face ? index.get(parts.face).rules : undefined
  if (!hat?.hidesHair && chance('hair')) parts.hair = partFor('hair')
  if (!hat?.hidesEyebrows && !face?.hidesEyebrows && !species.rules.hidesEyebrows && chance('eyebrow')) parts.eyebrow = partFor('eyebrow')
  if (!hat?.hidesFacialHair && chance('facialhair')) parts.facialhair = partFor('facialhair')
  for (const slot of ['ears', 'eyewear', 'back'] as const) if (chance(slot)) parts[slot] = partFor(slot)
  return { kind: 'modular', species: species.ref, parts }
}
