// NOTE: When installed into a game project, this import must be rewritten to
// point to the simulation types at their installed location (e.g., '../simulation-provider/types').
// See game-install-module SKILL.md § Step 5: Rewrite cross-module imports.
export type { Entity, Recipe, ClientSimulationConfig } from '@modules/simulation/base-types/types'

/** Generic entry for non-simulation catalogs */
export interface CatalogEntry { id: string; [key: string]: unknown }
export type CatalogDefinition<T extends CatalogEntry> = Record<string, T>
export interface CatalogBuilder<T extends CatalogEntry> {
  add(entry: T): void
  build(): CatalogDefinition<T>
  get(id: string): T | undefined
  getAll(): T[]
}
