/// <reference path="./rundot-sdk.d.ts" />

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { SimulationState, ActiveRun, ClientSimulationConfig, Recipe } from './types'

// ── SimulationProvider interface ──────────────────────────────────────────────
//
// The contract for swapping between client-side and server-authoritative
// simulation. Config is an implementation detail — it lives in the client
// engine's closure or on the Rundot server, not in the method signatures.

export interface SimulationProvider {
  getState(): Promise<SimulationState>
  canExecute(recipeId: string): Promise<boolean>
  execute(recipeId: string): Promise<ActiveRun | null>
  collect(runId: string): Promise<SimulationState>
  subscribe(onUpdate: (state: SimulationState) => void): () => void
}

// ── ServerSimulationProvider ──────────────────────────────────────────────────
//
// Delegates every call to the Rundot server simulation API.
// Use this when the game needs server-authoritative validation, anti-cheat,
// or persistent server-side state. The server holds the config and validates
// all guards — no config needed on the client.

export const ServerSimulationProvider: SimulationProvider = {
  async getState(): Promise<SimulationState> {
    return (await RundotAPI.simulation.getStateAsync()) as SimulationState
  },

  async canExecute(_recipeId: string): Promise<boolean> {
    // Server validates guards on execute — optimistic pass on the client
    return true
  },

  async execute(recipeId: string): Promise<ActiveRun | null> {
    const result = await RundotAPI.simulation.executeRecipeAsync(recipeId)
    if (!result) return null
    return result as ActiveRun
  },

  async collect(runId: string): Promise<SimulationState> {
    return (await RundotAPI.simulation.collectRecipeAsync(runId)) as SimulationState
  },

  subscribe(onUpdate: (state: SimulationState) => void): () => void {
    let cancelled = false
    RundotAPI.simulation.subscribeAsync((state: unknown) => {
      if (!cancelled) onUpdate(state as SimulationState)
    })
    return () => { cancelled = true }
  },
}

// ── ClientSimulationEngine ────────────────────────────────────────────────────
//
// Runs the full simulation on-device. State persists in appStorage between
// sessions. Use this for games that don't need server validation — it is a
// production implementation, not a development stub.
//
// Hot-swap: replace with ServerSimulationProvider if server-auth is added later.
// The SimulationProvider interface is identical; callers need no changes.

const STATE_KEY = 'sim_state'
const RUNS_KEY = 'sim_runs'

// Canonical source: modules/algorithms/prng/src/Prng.ts
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

async function loadState(): Promise<SimulationState> {
  const raw = await RundotAPI.appStorage.getItem(STATE_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) as SimulationState } catch { return {} }
}

async function saveState(state: SimulationState): Promise<void> {
  await RundotAPI.appStorage.setItem(STATE_KEY, JSON.stringify(state))
}

function evaluateGuards(recipe: Recipe, state: SimulationState): boolean {
  if (!recipe.guards || recipe.guards.length === 0) return true
  return recipe.guards.every(g => {
    const val = state[g.entityId]?.[g.attribute]
    if (val === undefined) return false
    switch (g.op) {
      case '>=': return (val as number) >= (g.value as number)
      case '<=': return (val as number) <= (g.value as number)
      case '==': return val === g.value
      case '!=': return val !== g.value
    }
  })
}

function ensureEntityState(state: SimulationState, entityId: string): Record<string, number | string | boolean> {
  state[entityId] ??= {}
  return state[entityId] as Record<string, number | string | boolean>
}

function applyEffects(
  effects: Recipe['beginEffects'],
  state: SimulationState,
  rng: () => number,
  config: ClientSimulationConfig,
  depth = 0,
): SimulationState {
  if (!effects) return state
  const next: SimulationState = JSON.parse(JSON.stringify(state))
  for (const effect of effects) {
    switch (effect.type) {
      case 'set':
        if (!effect.entityId || !effect.attribute) break
        ensureEntityState(next, effect.entityId)[effect.attribute] = effect.value ?? 0
        break
      case 'add':
        if (!effect.entityId || !effect.attribute) break
        {
          const entityState = ensureEntityState(next, effect.entityId)
          entityState[effect.attribute] =
            ((entityState[effect.attribute] as number) ?? 0) + ((effect.value as number) ?? 0)
        }
        break
      case 'multiply':
        if (!effect.entityId || !effect.attribute) break
        {
          const entityState = ensureEntityState(next, effect.entityId)
          entityState[effect.attribute] =
            ((entityState[effect.attribute] as number) ?? 0) * ((effect.value as number) ?? 1)
        }
        break
      case 'grant_item':
        if (!effect.entityId || !effect.attribute) break
        {
          const entityState = ensureEntityState(next, effect.entityId)
          entityState[effect.attribute] = ((entityState[effect.attribute] as number) ?? 0) + 1
        }
        break
      case 'remove_item':
        if (!effect.entityId || !effect.attribute) break
        {
          const entityState = ensureEntityState(next, effect.entityId)
          entityState[effect.attribute] = Math.max(
            0,
            ((entityState[effect.attribute] as number) ?? 0) - 1,
          )
        }
        break
      case 'trigger_recipe':
        if (!effect.recipeId || depth >= 4) break
        {
          const sub = config.recipes[effect.recipeId]
          if (sub && evaluateGuards(sub, next)) {
            const after = applyEffects(sub.beginEffects, next, rng, config, depth + 1)
            const afterEnd = applyEffects(sub.endEffects, after, rng, config, depth + 1)
            Object.assign(next, afterEnd)
          }
        }
        break
    }
  }
  return next
}

/** Roll chance for each output entry and add to state. */
function applyOutputs(
  outputs: Recipe['outputs'],
  state: SimulationState,
  rng: () => number,
): SimulationState {
  if (!outputs || outputs.length === 0) return state
  const next: SimulationState = JSON.parse(JSON.stringify(state))
  for (const output of outputs) {
    const chance = output.chance ?? 1
    if (rng() > chance) continue
    const entityState = ensureEntityState(next, output.entityId)
    entityState['quantity'] = ((entityState['quantity'] as number) ?? 0) + output.quantity
  }
  return next
}

export function createClientSimulationEngine(
  config: ClientSimulationConfig,
  seed?: number,
): SimulationProvider {
  const rng = mulberry32(seed ?? Date.now())
  const listeners: Array<(s: SimulationState) => void> = []
  let runCounter = 0

  async function notify(): Promise<void> {
    const state = await loadState()
    listeners.forEach(fn => fn(state))
  }

  return {
    async getState(): Promise<SimulationState> {
      return loadState()
    },

    async canExecute(recipeId: string): Promise<boolean> {
      const recipe = config.recipes[recipeId]
      if (!recipe) return false
      const state = await loadState()
      return evaluateGuards(recipe, state)
    },

    async execute(recipeId: string): Promise<ActiveRun | null> {
      const recipe = config.recipes[recipeId]
      if (!recipe) return null
      const state = await loadState()
      if (!evaluateGuards(recipe, state)) return null

      // maxConcurrency check
      if (recipe.maxConcurrency !== null && recipe.maxConcurrency !== undefined) {
        const raw = await RundotAPI.appStorage.getItem(RUNS_KEY)
        const runs: Record<string, ActiveRun> = raw ? JSON.parse(raw) : {}
        const activeCount = Object.values(runs).filter(r => r.recipeId === recipeId).length
        if (activeCount >= recipe.maxConcurrency) return null
      }

      const now = Date.now()
      const durationMs = recipe.durationMs ?? 0
      const run: ActiveRun = {
        runId: `${now}_${runCounter++}_${recipeId}`,
        recipeId,
        startedAt: now,
        endsAt: now + durationMs,
      }

      const afterBegin = applyEffects(recipe.beginEffects, state, rng, config)
      const afterOutputs = applyOutputs(recipe.outputs, afterBegin, rng)

      if (durationMs === 0) {
        const final = applyEffects(recipe.endEffects, afterOutputs, rng, config)
        await saveState(final)
        await notify()
      } else {
        // Persist intermediate state; endEffects applied when collected
        await saveState(afterOutputs)
        await notify()
        const raw = await RundotAPI.appStorage.getItem(RUNS_KEY)
        const runs: Record<string, ActiveRun> = raw ? JSON.parse(raw) : {}
        runs[run.runId] = run
        await RundotAPI.appStorage.setItem(RUNS_KEY, JSON.stringify(runs))
      }

      return run
    },

    async collect(runId: string): Promise<SimulationState> {
      const raw = await RundotAPI.appStorage.getItem(RUNS_KEY)
      const runs: Record<string, ActiveRun> = raw ? JSON.parse(raw) : {}
      const run = runs[runId]
      if (!run) return loadState()

      // Timer hasn't expired yet — return current state without finalising
      if (Date.now() < run.endsAt) return loadState()

      delete runs[runId]
      await RundotAPI.appStorage.setItem(RUNS_KEY, JSON.stringify(runs))

      const recipe = config.recipes[run.recipeId]
      let final: SimulationState
      if (recipe?.endEffects?.length) {
        const state = await loadState()
        final = applyEffects(recipe.endEffects, state, rng, config)
        await saveState(final)
        await notify()
      } else {
        final = await loadState()
      }

      // autoRestart: re-execute if guards still pass
      if (recipe?.autoRestart) {
        const currentState = await loadState()
        if (evaluateGuards(recipe, currentState)) {
          const now = Date.now()
          const durationMs = recipe.durationMs ?? 0
          const restartRun: ActiveRun = {
            runId: `${now}_${recipe.id}`,
            recipeId: recipe.id,
            startedAt: now,
            endsAt: now + durationMs,
          }
          const afterBegin = applyEffects(recipe.beginEffects, currentState, rng, config)
          const afterOutputs = applyOutputs(recipe.outputs, afterBegin, rng)
          if (durationMs === 0) {
            const restartFinal = applyEffects(recipe.endEffects, afterOutputs, rng, config)
            await saveState(restartFinal)
            await notify()
          } else {
            await saveState(afterOutputs)
            await notify()
            const runsRaw = await RundotAPI.appStorage.getItem(RUNS_KEY)
            const runsMap: Record<string, ActiveRun> = runsRaw ? JSON.parse(runsRaw) : {}
            runsMap[restartRun.runId] = restartRun
            await RundotAPI.appStorage.setItem(RUNS_KEY, JSON.stringify(runsMap))
          }
        }
      }

      return final
    },

    subscribe(onUpdate: (state: SimulationState) => void): () => void {
      listeners.push(onUpdate)
      return () => {
        const idx = listeners.indexOf(onUpdate)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    },
  }
}
