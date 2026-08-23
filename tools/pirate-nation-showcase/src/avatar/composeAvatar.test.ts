import { describe, expect, it } from 'vitest'
import { AVATAR_BASE_NODE, AVATAR_PARTS } from './avatarCatalog.generated'
import {
  DEFAULT_HAIR_COLOR,
  DEFAULT_SKIN_COLOR,
  REQUIRED_SLOTS,
  makeSequenceRng,
  randomAvatarSelection,
  resolvePartNodes,
  resolveThreePartNodes,
  toThreeNodeName,
  type AvatarSelection,
} from './composeAvatar'

const MINIMAL: AvatarSelection = { species: 1, face: 1, tops: 1, bottoms: 1, shoes: 1 }

describe('resolvePartNodes', () => {
  it('always includes the base body node', () => {
    expect(resolvePartNodes(MINIMAL)).toContain(AVATAR_BASE_NODE)
  })

  it('maps each selected slot index to its part node name', () => {
    const nodes = resolvePartNodes({ ...MINIMAL, hair: 3 })
    expect(nodes).toContain('species 1')
    expect(nodes).toContain('hair 3')
    expect(nodes).toContain('tops 1')
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

  it('throws when a required slot is missing rather than rendering a partial body', () => {
    const { species, ...withoutSpecies } = MINIMAL
    expect(species).toBe(1)
    expect(() => resolvePartNodes(withoutSpecies as AvatarSelection)).toThrow(/species/)
  })

  it('returns no duplicate node names', () => {
    const nodes = resolvePartNodes({ ...MINIMAL, hair: 3, headwear: 2 })
    expect(new Set(nodes).size).toBe(nodes.length)
  })
})

describe('randomAvatarSelection', () => {
  it('fills every required slot with a valid index', () => {
    const selection = randomAvatarSelection(makeSequenceRng([0.5]))
    for (const slot of REQUIRED_SLOTS) {
      const index = selection[slot]
      expect(typeof index, slot).toBe('number')
      expect(AVATAR_PARTS[slot].some((part) => part.index === index), slot).toBe(true)
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
    const selection = randomAvatarSelection(makeSequenceRng([0.999]))
    expect(selection.headwear ?? null).toBeNull()
    expect(selection.eyewear ?? null).toBeNull()
    expect(selection.back ?? null).toBeNull()
  })

  it('picks a color for both tint channels', () => {
    const selection = randomAvatarSelection(makeSequenceRng([0.5]))
    expect(selection.skinColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(selection.hairColor).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('toThreeNodeName', () => {
  /**
   * three.js `PropertyBinding.sanitizeNodeName` rewrites whitespace to an
   * underscore while loading, so catalog names never match the loaded scene
   * unless they go through the same rule.
   */
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
    expect(nodes).toContain(AVATAR_BASE_NODE)
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
