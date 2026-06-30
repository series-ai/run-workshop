import type { Entity, Recipe, ClientSimulationConfig, CatalogEntry, CatalogDefinition, CatalogBuilder } from './types'

// ── Generic catalog helpers ───────────────────────────────────────────────────

export function createCatalog<T extends CatalogEntry>(entries: T[]): CatalogDefinition<T> {
  const catalog: CatalogDefinition<T> = {}
  for (const entry of entries) {
    catalog[entry.id] = entry
  }
  return catalog
}

export function createCatalogBuilder<T extends CatalogEntry>(): CatalogBuilder<T> {
  const entries: Map<string, T> = new Map()
  return {
    add(entry: T): void { entries.set(entry.id, entry) },
    build(): CatalogDefinition<T> {
      const catalog: CatalogDefinition<T> = {}
      for (const [id, entry] of entries) { catalog[id] = entry }
      return catalog
    },
    get(id: string): T | undefined { return entries.get(id) },
    getAll(): T[] { return [...entries.values()] },
  }
}

export async function loadCatalog<T extends CatalogEntry>(
  loader: () => Promise<T[]>,
): Promise<CatalogDefinition<T>> {
  const entries = await loader()
  return createCatalog(entries)
}

// ── Simulation-config catalog helpers ────────────────────────────────────────

/** Get all entities that have a given tag */
export function getEntitiesByTag(config: ClientSimulationConfig, tag: string): Entity[] {
  return Object.values(config.entities).filter(e => e.tags.includes(tag))
}

/** Get all recipes that have a given tag */
export function getRecipesByTag(config: ClientSimulationConfig, tag: string): Recipe[] {
  return Object.values(config.recipes).filter(r => r.tags.includes(tag))
}

/** Get a single entity by ID (returns undefined if not found) */
export function getEntity(config: ClientSimulationConfig, id: string): Entity | undefined {
  return config.entities[id]
}

/** Get a single recipe by ID (returns undefined if not found) */
export function getRecipe(config: ClientSimulationConfig, id: string): Recipe | undefined {
  return config.recipes[id]
}
