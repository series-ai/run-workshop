// Vendored from venus/server ClientSimulationConfig pattern.
// These types define the shared contract for shop, catalog, recipe-system, and gacha.

export interface Entity {
  id: string
  tags: string[]
  attributes: Record<string, number | string | boolean>
  /** Read-only display/config data (displayName, icon, baseCost, etc.) — NOT simulation state */
  metadata?: Record<string, unknown>
}

export interface RecipeInput {
  entityId: string
  quantity: number
}

export interface RecipeOutput {
  entityId: string
  quantity: number
  /** 0–1 probability; defaults to 1 */
  chance?: number
}

export type EffectType =
  | 'set'
  | 'add'
  | 'multiply'
  | 'trigger_recipe'
  | 'grant_item'
  | 'remove_item'

export interface RecipeEffect {
  type: EffectType
  entityId?: string
  attribute?: string
  value?: number | string | boolean
  recipeId?: string
}

export interface Recipe {
  id: string
  tags: string[]
  /** Attribute keys that must be satisfied for canExecute */
  guards?: Array<{ entityId: string; attribute: string; op: '>=' | '<=' | '==' | '!='; value: number | string | boolean }>
  inputs?: RecipeInput[]
  outputs?: RecipeOutput[]
  beginEffects?: RecipeEffect[]
  endEffects?: RecipeEffect[]
  /** Duration in ms; 0 = instant */
  durationMs?: number
  /** Read-only display/config data (displayName, sortOrder, UI hints) — NOT simulation state */
  metadata?: Record<string, unknown>
  /** Re-execute automatically after collection (energy regen, resource production) */
  autoRestart?: boolean
  /** Max simultaneous active runs of this recipe (building upgrades) */
  maxConcurrency?: number
}

export interface ClientSimulationConfig {
  version: number
  entities: Record<string, Entity>
  recipes: Record<string, Recipe>
}

/** Flat map of entityId → attribute → value */
export type SimulationState = Record<string, Record<string, number | string | boolean>>

export interface ActiveRun {
  runId: string
  recipeId: string
  startedAt: number
  endsAt: number
}
