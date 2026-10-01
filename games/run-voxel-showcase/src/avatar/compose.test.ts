import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AvatarPartEntry, PackCatalog } from '@rvx/contracts/catalog'
import { PartIndex, resolveVisibleParts, rollModular, type ModularBase, type Rng } from './compose'

const rules = (r: Partial<AvatarPartEntry['rules']> = {}) => ({ hidesHair: false, hidesEyebrows: false, hidesFacialHair: false, ...r })
const part = (pack: AvatarPartEntry['ref']['pack'], slot: AvatarPartEntry['ref']['slot'], index: number, r = rules()): AvatarPartEntry => ({
  ref: { pack, slot, index },
  nodeName: pack === 'pirate' ? `${slot} ${index}` : `${slot} ${pack}-${index}`,
  name: `${pack} ${slot} ${index}`,
  tints: [],
  rules: r,
})

function catalogs(): PackCatalog[] {
  const avatar = (pack: 'pirate' | 'fantasy', parts: AvatarPartEntry[]) =>
    ({ pack, label: pack, models: [], sprites: [], pfx: { pack, effects: [] }, avatar: { pack, partsModelPath: 'a.glb', clipsModelPath: 'a.glb', leaf: 'world', parts, clips: [] } }) as PackCatalog
  return [
    avatar('pirate', [
      part('pirate', 'species', 1),
      part('pirate', 'species', 7, rules({ fullBody: true })),
      part('pirate', 'species', 5, rules({ builtInFace: true })),
      part('pirate', 'species', 9, rules({ hidesHair: true, hidesFacialHair: true })),
      part('pirate', 'facialhair', 1),
      part('pirate', 'face', 1),
      part('pirate', 'hair', 1),
      part('pirate', 'hair', 4),
      part('pirate', 'eyebrow', 1),
      part('pirate', 'headwear', 1, rules({ hidesHair: true })),
      part('pirate', 'headwear', 4, rules({ hairOverride: { pack: 'pirate', slot: 'hair', index: 4 } })),
      part('pirate', 'back', 1),
    ]),
    avatar('fantasy', [part('fantasy', 'headwear', 1), part('fantasy', 'ears', 1)]),
  ]
}

const names = (base: ModularBase) => resolveVisibleParts(base, new PartIndex(catalogs())).map((p) => p.nodeName)
const base = (parts: ModularBase['parts'], species = 1): ModularBase => ({ kind: 'modular', species: { pack: 'pirate', slot: 'species', index: species }, parts })

describe('resolveVisibleParts', () => {
  const hair = { pack: 'pirate', slot: 'hair', index: 1 } as const
  it('keeps pack rules apart: PN headwear 1 hides hair, fantasy headwear 1 does not', () => {
    expect(names(base({ hair, headwear: { pack: 'pirate', slot: 'headwear', index: 1 } }))).not.toContain('hair 1')
    expect(names(base({ hair, headwear: { pack: 'fantasy', slot: 'headwear', index: 1 } }))).toEqual(['species 1', 'hair 1', 'headwear fantasy-1'])
  })
  it('applies a tucked-hair override and species rules', () => {
    expect(names(base({ hair, headwear: { pack: 'pirate', slot: 'headwear', index: 4 } }))).toContain('hair 4')
    expect(names(base({ hair, face: { pack: 'pirate', slot: 'face', index: 1 }, back: { pack: 'pirate', slot: 'back', index: 1 } }, 7))).toEqual(['species 7', 'back 1'])
    expect(names(base({ face: { pack: 'pirate', slot: 'face', index: 1 } }, 5))).toEqual(['species 5'])
  })
  it('applies every hide rule of the species, as of any other part', () => {
    const facialhair = { pack: 'pirate', slot: 'facialhair', index: 1 } as const
    expect(names(base({ hair, facialhair }))).toEqual(['species 1', 'hair 1', 'facialhair 1'])
    expect(names(base({ hair, facialhair }, 9))).toEqual(['species 9'])
  })
  it('swaps in tucked hair only when hair is chosen, as Pirate Nation does', () => {
    expect(names(base({ headwear: { pack: 'pirate', slot: 'headwear', index: 4 } }))).toEqual(['species 1', 'headwear 4'])
  })
  it('throws on an unknown part', () => {
    expect(() => names(base({ ears: { pack: 'fantasy', slot: 'ears', index: 9 } }))).toThrow(/no avatar part ears 9 in pack fantasy/)
  })
})

describe('rollModular', () => {
  const real = (): PackCatalog[] =>
    ['pirate', 'fantasy', 'space', 'monster', 'apocalypse'].map(
      (p) => JSON.parse(readFileSync(join(import.meta.dirname, `../../public/catalog/${p}/catalog.json`), 'utf8')) as PackCatalog,
    )
  const index = new PartIndex(real())
  const seeded = (seed: number): Rng => {
    let s = seed >>> 0
    return () => ((s = (1664525 * s + 1013904223) >>> 0) / 0x100000000)
  }

  it('always rolls a valid avatar: known parts, rules kept, no misnamed PN face or brow', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const base = rollModular(index, (['pirate', 'fantasy', 'space', 'monster', 'apocalypse'] as const)[seed % 5]!, seeded(seed))
      const species = index.get(base.species)
      expect(species.ref.pack).toBe('pirate')
      const parts = Object.values(base.parts).map((ref) => index.get(ref!))
      if (species.rules.fullBody) expect(Object.keys(base.parts).every((slot) => slot === 'back')).toBe(true)
      else {
        for (const slot of ['tops', 'bottoms', 'shoes'] as const) expect(base.parts[slot], `seed ${seed} ${slot}`).toBeDefined()
        expect(Boolean(base.parts.face)).toBe(!species.rules.builtInFace)
      }
      if (parts.some((p) => p.rules.hidesHair)) expect(base.parts.hair).toBeUndefined()
      const pn = (slot: 'face' | 'eyebrow') => (base.parts[slot]?.pack === 'pirate' ? base.parts[slot]!.index : 0)
      expect([2, 5, 15, 16]).not.toContain(pn('face'))
      expect([2, 5, 15, 20]).not.toContain(pn('eyebrow'))
      expect(() => resolveVisibleParts(base, index)).not.toThrow()
    }
  })

  it('favours the theme pack, and rolls Pirate Nation only for the pirate theme', () => {
    const packs = (theme: PackCatalog['pack']) => {
      const count = new Map<string, number>()
      for (let seed = 1; seed <= 200; seed += 1)
        for (const ref of Object.values(rollModular(index, theme, seeded(seed)).parts)) count.set(ref!.pack, (count.get(ref!.pack) ?? 0) + 1)
      return count
    }
    const fantasy = packs('fantasy')
    expect(fantasy.get('fantasy')!).toBeGreaterThan(fantasy.get('pirate')!)
    expect([...fantasy.keys()].sort()).toEqual(['fantasy', 'pirate'])
    expect([...packs('pirate').keys()]).toEqual(['pirate'])
  })
})
