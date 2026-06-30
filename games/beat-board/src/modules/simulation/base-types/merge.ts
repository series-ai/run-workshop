import type { ClientSimulationConfig } from './types'

/**
 * Merge multiple simulation config fragments into one.
 * Later fragments overwrite earlier ones for duplicate entity/recipe IDs.
 */
export function mergeSimConfigs(...fragments: ClientSimulationConfig[]): ClientSimulationConfig {
  const merged: ClientSimulationConfig = {
    version: 0,
    entities: {},
    recipes: {},
  }
  for (const fragment of fragments) {
    merged.version = Math.max(merged.version, fragment.version)
    Object.assign(merged.entities, fragment.entities)
    Object.assign(merged.recipes, fragment.recipes)
  }
  return merged
}
