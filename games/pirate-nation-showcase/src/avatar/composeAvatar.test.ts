import { describe, expect, it } from 'vitest'
import { AVATAR_BASE_NODE, AVATAR_PARTS } from './avatarCatalog.generated'
import {
  DEFAULT_HAIR_COLOR,
  DEFAULT_SKIN_COLOR,
  FULL_BODY_SPECIES,
  REQUIRED_SLOTS,
  isFullBodySpecies,
  speciesHasBuiltInFace,
  makeSequenceRng,
  randomAvatarSelection,
  resolvePartNodes,
  resolveThreePartNodes,
  toThreeNodeName,
  type AvatarSelection,
} from './composeAvatar'

const MINIMAL: AvatarSelection = { species: 1, face: 1, tops: 1, bottoms: 1, shoes: 1 }

describe('resolvePartNodes', () => {
  it('maps each selected slot index to its part node name', () => {
    const nodes = resolvePartNodes({ ...MINIMAL, hair: 3 })
    expect(nodes).toContain('species 1')
    expect(nodes).toContain('hair 3')
    expect(nodes).toContain('tops 1')
  })

  it('allows full-body species without clothing slots', () => {
    const nodes = resolvePartNodes({ species: 14 })
    expect(nodes).toEqual(['species 14'])
  })

  it('strips incompatible modular face and clothing slots from full-body species like Berserker', () => {
    const nodes = resolvePartNodes({
      species: 10, // Berserker bear
      face: 7,
      tops: 1,
      bottoms: 1,
      shoes: 1,
      hair: 3,
    })
    expect(nodes).toEqual(['species 10'])
  })

  it('strips modular eyebrow decals from species with built-in 3D eyebrows (Vampire, Zombie)', () => {
    const nodes = resolvePartNodes({
      ...MINIMAL,
      species: 3, // Vampire
      eyebrow: 5,
    })
    expect(nodes).toContain('species 3')
    expect(nodes.some((n) => n.startsWith('eyebrow'))).toBe(false)
  })

  it('hides hair when a full hat like headwear 70 is equipped', () => {
    const nodes = resolvePartNodes({
      ...MINIMAL,
      hair: 9,
      headwear: 70,
    })
    expect(nodes).toContain('headwear 70')
    expect(nodes.some((n) => n.startsWith('hair'))).toBe(false)
  })

  it('omits eyebrows when wearing a forehead-covering combo hat (e.g. headwear 68)', () => {
    const nodes = resolvePartNodes({
      ...MINIMAL,
      headwear: 68,
      eyebrow: 10,
    })
    expect(nodes).toContain('headwear 68')
    expect(nodes.some((n) => n.startsWith('eyebrow'))).toBe(false)
  })

  it('omits facial hair when wearing a beard-covering combo hat (e.g. headwear 68)', () => {
    const nodes = resolvePartNodes({
      ...MINIMAL,
      headwear: 68,
      facialhair: 4,
    })
    expect(nodes).toContain('headwear 68')
    expect(nodes.some((n) => n.startsWith('facialhair'))).toBe(false)
  })

  it('omits a slot the selection leaves out', () => {
    const nodes = resolvePartNodes(MINIMAL)
    expect(nodes.some((name) => name.startsWith('headwear'))).toBe(false)
  })

  it('omits a slot explicitly set to null', () => {
    const nodes = resolvePartNodes({ ...MINIMAL, headwear: null })
    expect(nodes.some((name) => name.startsWith('headwear'))).toBe(false)
  })

  it('throws for an index the slot does not have', () => {
    expect(() => resolvePartNodes({ ...MINIMAL, hair: 999 })).toThrow(/hair 999/)
  })

  it('throws when a required slot is missing for base bodies', () => {
    const { species, ...withoutSpecies } = MINIMAL
    expect(species).toBe(1)
    expect(() => resolvePartNodes(withoutSpecies as AvatarSelection)).toThrow(/species/)
    expect(() => resolvePartNodes({ species: 1 } as AvatarSelection)).toThrow(/face/)
  })

  it('returns no duplicate node names', () => {
    const nodes = resolvePartNodes({ ...MINIMAL, hair: 3, headwear: 2 })
    expect(new Set(nodes).size).toBe(nodes.length)
  })
})

describe('randomAvatarSelection', () => {
  it('fills every required slot with a valid index for base species', () => {
    // Force roll to pick species 1
    const selection = randomAvatarSelection(() => 0.01)
    expect(selection.species).toBe(1)
    for (const slot of REQUIRED_SLOTS) {
      const index = selection[slot]
      expect(typeof index, slot).toBe('number')
      expect(AVATAR_PARTS[slot].some((part) => part.index === index), slot).toBe(true)
    }
  })

  it('always rolls a valid face with eyes and mouth', () => {
    for (let i = 0; i < 100; i++) {
      const selection = randomAvatarSelection()
      if (!isFullBodySpecies(selection.species) && !speciesHasBuiltInFace(selection.species)) {
        expect(typeof selection.face).toBe('number')
        expect([2, 5, 15, 16].includes(selection.face!)).toBe(false)
      } else if (speciesHasBuiltInFace(selection.species)) {
        expect(selection.face).toBeNull()
      }
    }
  })

  it('always rolls genuine eyebrows when eyebrow is equipped', () => {
    for (let i = 0; i < 100; i++) {
      const selection = randomAvatarSelection()
      if (typeof selection.eyebrow === 'number') {
        expect([2, 5, 15].includes(selection.eyebrow)).toBe(false)
      }
    }
  })

  it('omits overlapping clothing slots for full-body skins', () => {
    // Force roll to pick full body species (e.g. species 14)
    const selection = randomAvatarSelection(() => 0.7)
    if (isFullBodySpecies(selection.species)) {
      expect(selection.tops).toBeNull()
      expect(selection.bottoms).toBeNull()
      expect(selection.shoes).toBeNull()
    }
  })

  it('produces a selection that resolves without throwing', () => {
    const selection = randomAvatarSelection(makeSequenceRng([0.1, 0.9, 0.42, 0.7]))
    expect(() => resolvePartNodes(selection)).not.toThrow()
  })

  it('is deterministic for the same random sequence', () => {
    const a = randomAvatarSelection(makeSequenceRng([0.3, 0.6, 0.9]))
    const b = randomAvatarSelection(makeSequenceRng([0.3, 0.6, 0.9]))
    expect(a).toEqual(b)
  })

  it('differs for a different random sequence', () => {
    const a = randomAvatarSelection(makeSequenceRng([0.05]))
    const b = randomAvatarSelection(makeSequenceRng([0.95]))
    expect(a).not.toEqual(b)
  })

  it('drops every optional slot when the roll always exceeds its chance', () => {
    let call = 0
    // Call 1 is species (pick species 1), all other calls are 0.999
    const rng = () => (++call === 1 ? 0.01 : 0.999)
    const selection = randomAvatarSelection(rng)
    expect(selection.species).toBe(1)
    expect(selection.headwear ?? null).toBeNull()
    expect(selection.eyewear ?? null).toBeNull()
    expect(selection.back ?? null).toBeNull()
    expect(selection.hair ?? null).toBeNull()
    expect(selection.facialhair ?? null).toBeNull()
  })

  it('picks a color for both tint channels', () => {
    const selection = randomAvatarSelection(makeSequenceRng([0.5]))
    expect(selection.skinColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(selection.hairColor).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('toThreeNodeName', () => {
  it('rewrites the space in a part name to an underscore', () => {
    expect(toThreeNodeName('species 19')).toBe('species_19')
    expect(toThreeNodeName('tops 7')).toBe('tops_7')
  })

  it('leaves a name with no whitespace unchanged', () => {
    expect(toThreeNodeName('model')).toBe('model')
  })
})

describe('resolveThreePartNodes', () => {
  it('returns the loaded-scene form of every selected part node', () => {
    const nodes = resolveThreePartNodes({ ...MINIMAL, hair: 3 })
    expect(nodes).toContain('species_1')
    expect(nodes).toContain('hair_3')
  })

  it('matches resolvePartNodes one for one', () => {
    const selection = { ...MINIMAL, headwear: 2 }
    expect(resolveThreePartNodes(selection)).toEqual(
      resolvePartNodes(selection).map(toThreeNodeName),
    )
  })
})

describe('default colors', () => {
  it('exposes valid hex defaults for each tint channel', () => {
    expect(DEFAULT_SKIN_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
    expect(DEFAULT_HAIR_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
