import { describe, it, expect } from 'vitest'
import { createCatalog, createCatalogBuilder, loadCatalog, getEntitiesByTag, getRecipesByTag, getEntity, getRecipe } from './CatalogSystem'
import type { CatalogEntry, ClientSimulationConfig } from './types'

interface Card extends CatalogEntry {
  id: string
  name: string
  cost: number
}

function requireAt<T>(items: readonly T[], index: number, context: string): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`${context}: missing item at index ${index}`)
  }
  return item
}

const cardArray: Card[] = [
  { id: 'fireball', name: 'Fireball', cost: 3 },
  { id: 'ice-bolt', name: 'Ice Bolt', cost: 2 },
  { id: 'shield', name: 'Shield', cost: 1 },
]

describe('CatalogSystem.createCatalog', () => {
  it('creates catalog from array', () => {
    const catalog = createCatalog(cardArray)
    expect(Object.keys(catalog)).toHaveLength(3)
    expect(catalog['fireball']).toEqual(cardArray[0])
  })

  it('get by ID returns correct entry', () => {
    const catalog = createCatalog(cardArray)
    expect(catalog['ice-bolt']).toEqual(cardArray[1])
    expect(catalog['ice-bolt']?.['cost']).toBe(2)
  })

  it('get unknown ID returns undefined', () => {
    const catalog = createCatalog(cardArray)
    expect(catalog['unknown-id']).toBeUndefined()
  })
})

describe('CatalogSystem.createCatalogBuilder', () => {
  it('builder pattern adds and builds', () => {
    const builder = createCatalogBuilder<Card>()
    builder.add({ id: 'a', name: 'Card A', cost: 1 })
    builder.add({ id: 'b', name: 'Card B', cost: 2 })
    const catalog = builder.build()
    expect(Object.keys(catalog)).toHaveLength(2)
    expect(catalog['a']?.name).toBe('Card A')
  })

  it('get() on builder returns entry before build', () => {
    const builder = createCatalogBuilder<Card>()
    builder.add({ id: 'x', name: 'X', cost: 5 })
    expect(builder.get('x')?.name).toBe('X')
    expect(builder.get('missing')).toBeUndefined()
  })

  it('getAll() returns all added entries', () => {
    const builder = createCatalogBuilder<Card>()
    builder.add({ id: 'a', name: 'A', cost: 1 })
    builder.add({ id: 'b', name: 'B', cost: 2 })
    expect(builder.getAll()).toHaveLength(2)
  })
})

describe('CatalogSystem.loadCatalog', () => {
  it('async loader resolves correctly', async () => {
    const catalog = await loadCatalog(async () => cardArray)
    expect(catalog['fireball']).toEqual(cardArray[0])
    expect(catalog['shield']?.['cost']).toBe(1)
  })
})

// ── Simulation config helpers ─────────────────────────────────────────────────

const simConfig: ClientSimulationConfig = {
  version: 1,
  entities: {
    gem_pack: { id: 'gem_pack', tags: ['shop_section', 'premium'], attributes: { price: 99 } },
    coin_pack: { id: 'coin_pack', tags: ['shop_section'], attributes: { price: 49 } },
    player: { id: 'player', tags: ['character'], attributes: { level: 1 } },
  },
  recipes: {
    buy_gems: { id: 'buy_gems', tags: ['shop_offer', 'iap'], beginEffects: [] },
    daily_bonus: { id: 'daily_bonus', tags: ['reward', 'daily'], beginEffects: [] },
    craft_sword: { id: 'craft_sword', tags: ['crafting'], beginEffects: [] },
  },
}

describe('getEntitiesByTag', () => {
  it('returns entities matching tag', () => {
    const sections = getEntitiesByTag(simConfig, 'shop_section')
    expect(sections).toHaveLength(2)
    expect(sections.map(e => e.id)).toContain('gem_pack')
    expect(sections.map(e => e.id)).toContain('coin_pack')
  })

  it('returns empty array for unknown tag', () => {
    expect(getEntitiesByTag(simConfig, 'unknown_tag')).toHaveLength(0)
  })
})

describe('getRecipesByTag', () => {
  it('returns recipes matching tag', () => {
    const offers = getRecipesByTag(simConfig, 'shop_offer')
    expect(offers).toHaveLength(1)
    expect(requireAt(offers, 0, 'recipe offers').id).toBe('buy_gems')
  })

  it('supports multiple tag queries', () => {
    const rewards = getRecipesByTag(simConfig, 'reward')
    expect(requireAt(rewards, 0, 'reward recipes').id).toBe('daily_bonus')
  })
})

describe('getEntity / getRecipe', () => {
  it('getEntity returns the entity', () => {
    const e = getEntity(simConfig, 'player')
    expect(e?.id).toBe('player')
  })

  it('getEntity returns undefined for missing', () => {
    expect(getEntity(simConfig, 'ghost')).toBeUndefined()
  })

  it('getRecipe returns the recipe', () => {
    const r = getRecipe(simConfig, 'craft_sword')
    expect(r?.id).toBe('craft_sword')
  })
})
