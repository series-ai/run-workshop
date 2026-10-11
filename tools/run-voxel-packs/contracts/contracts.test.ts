import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { avatarClipOwner } from './clips'
import { parsePartNodeName, partNodeName } from './catalog'
import { leafFor, RVX_PACK_KEYS } from './packs'
import { paletteIndex, paletteRgb } from './palette'
import { CATEGORIES } from './categories'
import { checkScaleClass, scaleClassesFor, TILE_VOXELS } from './scale'

describe('contracts', () => {
  it('maps asset kinds to jam leaves', () => {
    expect(leafFor('fantasy', 'world')).toEqual({ path: '3D/fantasy', id: 'run-voxel-fantasy/3D/fantasy', license: 'LicenseRef-RUN-Repository-Supplemental-1.0' })
    expect(leafFor('space', 'world').path).toBe('3D/space-scifi')
    expect(leafFor('apocalypse', 'characters')).toEqual({ path: '3D/characters', id: 'run-voxel-post-apocalypse/3D/characters', license: 'LicenseRef-RUN-Repository-Supplemental-1.0' })
    expect(leafFor('monster', 'icons').path).toBe('icons')
  })
  it('owns avatar clip numbers per pack', () => {
    expect(avatarClipOwner('04_Walk')).toBe('pirate')
    expect(avatarClipOwner('33_Block')).toBe('fantasy')
    expect(avatarClipOwner('63_Crouch_Walk')).toBe('apocalypse')
    expect(() => avatarClipOwner('70_Nope')).toThrow(/outside every pack/)
  })
  it('round-trips part node names and keeps PN names', () => {
    expect(partNodeName({ pack: 'pirate', slot: 'headwear', index: 1 })).toBe('headwear 1')
    expect(partNodeName({ pack: 'fantasy', slot: 'headwear', index: 1 })).toBe('headwear fantasy-1')
    expect(parsePartNodeName('ears fantasy-2')).toEqual({ pack: 'fantasy', slot: 'ears', index: 2 })
    expect(() => parsePartNodeName('hat 3')).toThrow(/not a part node name/)
  })
  it('indexes the palette by ramp and shade', () => {
    expect(paletteIndex('wood', 3)).toBe(19)
    expect(paletteRgb(19)).toHaveLength(3)
    expect(() => paletteIndex('gray', 0)).toThrow(/reserved/)
    expect(() => paletteIndex('nope', 1)).toThrow(/unknown palette ramp/)
  })
})

describe('scale standard', () => {
  it('lists an allowed class for every world asset in each pack table', () => {
    for (const pack of RVX_PACK_KEYS) {
      const table = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'assets', pack, 'scale-classes.json'), 'utf8')) as Record<string, string>
      for (const [id, name] of Object.entries(table)) {
        const category = CATEGORIES.find((c) => id.startsWith(`${pack}-${c}-`))
        expect(category, id).toBeDefined()
        expect(scaleClassesFor(category!), id).toContain(name)
      }
    }
  })
  it('checks class ranges and whole-tile lengths', () => {
    expect(checkScaleClass('building', [110, 120, 96])).toEqual([])
    expect(checkScaleClass('building', [60, 50, 30])).toEqual(['height 50.0 is outside building 60–150', 'length 60.0 is outside building 66–180', 'width 30.0 is outside building 40–180'])
    expect(checkScaleClass('fence', [32, 20, 4])).toEqual([])
    expect(checkScaleClass('fence', [24, 20, 4])).toEqual([`length 24.0 is not a whole number of ${TILE_VOXELS}-voxel tiles`])
    expect(() => checkScaleClass('castle', [1, 1, 1])).toThrow(/unknown scale class/)
  })
})
