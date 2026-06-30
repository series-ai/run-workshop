import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useSyncExternalStore } from 'react'

export interface DebugSimulationRecipeOption {
  id: string
  label: string
}

export interface DebugSimulationSnapshot {
  recipeOptions: DebugSimulationRecipeOption[]
  activeRuns: Array<{ runId: string }>
  entityCount: number
  lastUpdatedAt: number | null
  lastError: string | null
}

type Listener = () => void

const listeners = new Set<Listener>()

let simulationSnapshot: DebugSimulationSnapshot = {
  recipeOptions: [],
  activeRuns: [],
  entityCount: 0,
  lastUpdatedAt: null,
  lastError: null,
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

function countEntities(state: unknown): number {
  if (!state || typeof state !== 'object') {
    return 0
  }

  const entities = (state as { entities?: unknown }).entities
  if (!entities || typeof entities !== 'object') {
    return 0
  }

  return Object.keys(entities as Record<string, unknown>).length
}

function normalizeRecipeOptions(raw: unknown): DebugSimulationRecipeOption[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const recipe = entry as { id?: unknown; label?: unknown; name?: unknown }
      if (typeof recipe.id !== 'string' || recipe.id.length === 0) {
        return null
      }

      const label = typeof recipe.label === 'string'
        ? recipe.label
        : typeof recipe.name === 'string'
          ? recipe.name
          : recipe.id

      return {
        id: recipe.id,
        label,
      }
    })
    .filter((entry): entry is DebugSimulationRecipeOption => entry !== null)
}

function normalizeActiveRuns(raw: unknown): Array<{ runId: string }> {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const run = entry as { runId?: unknown; id?: unknown }
      const runId = typeof run.runId === 'string'
        ? run.runId
        : typeof run.id === 'string'
          ? run.id
          : null

      return runId ? { runId } : null
    })
    .filter((entry): entry is { runId: string } => entry !== null)
}

export function getDebugSimulationSnapshot(): DebugSimulationSnapshot {
  return simulationSnapshot
}

export function subscribeToDebugSimulationSnapshot(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDebugSimulationSnapshot(): DebugSimulationSnapshot {
  return useSyncExternalStore(
    subscribeToDebugSimulationSnapshot,
    getDebugSimulationSnapshot,
    getDebugSimulationSnapshot,
  )
}

export function resetDebugSimulationSnapshot(): void {
  simulationSnapshot = {
    recipeOptions: [],
    activeRuns: [],
    entityCount: 0,
    lastUpdatedAt: null,
    lastError: null,
  }
  notify()
}

export async function refreshDebugSimulationSnapshot(): Promise<DebugSimulationSnapshot> {
  try {
    const [recipesResponse, state, activeRuns] = await Promise.all([
      RundotAPI.simulation.getAvailableRecipesAsync(),
      RundotAPI.simulation.getStateAsync(),
      RundotAPI.simulation.getActiveRunsAsync(),
    ])

    simulationSnapshot = {
      recipeOptions: normalizeRecipeOptions((recipesResponse as { recipes?: unknown })?.recipes),
      activeRuns: normalizeActiveRuns(activeRuns),
      entityCount: countEntities(state),
      lastUpdatedAt: Date.now(),
      lastError: null,
    }
    notify()
    return simulationSnapshot
  } catch (error) {
    simulationSnapshot = {
      ...simulationSnapshot,
      lastError: error instanceof Error ? error.message : String(error),
      lastUpdatedAt: Date.now(),
    }
    notify()
    return simulationSnapshot
  }
}

export async function executeDebugSimulationRecipe(recipeId: string): Promise<unknown> {
  const result = await RundotAPI.simulation.executeRecipeAsync(recipeId)
  await refreshDebugSimulationSnapshot()
  return result
}

export async function collectDebugSimulationRun(runId: string): Promise<unknown> {
  const result = await RundotAPI.simulation.collectRecipeAsync(runId)
  await refreshDebugSimulationSnapshot()
  return result
}
