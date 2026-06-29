import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClientSimulationEngine } from './provider'
import { mergeSimConfigs } from './merge'
import type { ClientSimulationConfig, SimulationState } from './types'

// Use a memory adapter for appStorage to keep tests isolated
vi.mock('@series-inc/rundot-game-sdk/api', () => {
  const storage = new Map<string, string>()
  return {
    default: {
      appStorage: {
        getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
        setItem: vi.fn((key: string, val: string) => { storage.set(key, val); return Promise.resolve() }),
        removeItem: vi.fn((key: string) => { storage.delete(key); return Promise.resolve() }),
      },
    },
  }
})

import RundotAPI from '@series-inc/rundot-game-sdk/api'

function requireDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  return value as T
}

function requireAt<T>(values: T[], index: number): T {
  const value = values[index]
  expect(value).toBeDefined()
  return value as T
}

function clearStorage() {
  const map = new Map<string, string>()
  const appStorage = RundotAPI['appStorage'] as unknown as {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
  }
  appStorage.getItem.mockImplementation((k: string) => Promise.resolve(map.get(k) ?? null))
  appStorage.setItem.mockImplementation((k: string, v: string) => {
    map.set(k, v)
    return Promise.resolve()
  })
  appStorage.removeItem.mockImplementation((k: string) => {
    map.delete(k)
    return Promise.resolve()
  })
}

/** Seed initial simulation state from config entity attributes. */
async function seedStateFromConfig(cfg: ClientSimulationConfig) {
  const state: SimulationState = {}
  for (const [id, entity] of Object.entries(cfg.entities)) {
    state[id] = { ...entity.attributes }
  }
  await RundotAPI.appStorage.setItem('sim_state', JSON.stringify(state))
}

const config: ClientSimulationConfig = {
  version: 1,
  entities: {
    player: { id: 'player', tags: [], attributes: { gold: 100 } },
    inventory: { id: 'inventory', tags: [], attributes: { sword: 0, potion: 0 } },
  },
  recipes: {
    earn_gold: {
      id: 'earn_gold',
      tags: [],
      beginEffects: [{ type: 'add', entityId: 'player', attribute: 'gold', value: 50 }],
    },
    spend_gold: {
      id: 'spend_gold',
      tags: [],
      guards: [{ entityId: 'player', attribute: 'gold', op: '>=', value: 30 }],
      beginEffects: [{ type: 'add', entityId: 'player', attribute: 'gold', value: -30 }],
    },
    grant_sword: {
      id: 'grant_sword',
      tags: [],
      beginEffects: [{ type: 'grant_item', entityId: 'inventory', attribute: 'sword' }],
    },
    remove_sword: {
      id: 'remove_sword',
      tags: [],
      beginEffects: [{ type: 'remove_item', entityId: 'inventory', attribute: 'sword' }],
    },
    set_gold: {
      id: 'set_gold',
      tags: [],
      beginEffects: [{ type: 'set', entityId: 'player', attribute: 'gold', value: 0 }],
    },
    loot_chest: {
      id: 'loot_chest',
      tags: [],
      beginEffects: [],
      outputs: [
        { entityId: 'loot_gold', quantity: 10, chance: 1.0 },   // always
        { entityId: 'loot_rare', quantity: 1, chance: 0.0 },     // never
        { entityId: 'loot_common', quantity: 5 },                // chance defaults to 1
      ],
    },
    chain_recipe: {
      id: 'chain_recipe',
      tags: [],
      beginEffects: [
        { type: 'add', entityId: 'player', attribute: 'gold', value: 10 },
        { type: 'trigger_recipe', recipeId: 'earn_gold' },
      ],
    },
    timed_forge: {
      id: 'timed_forge',
      tags: [],
      durationMs: 5000,
      beginEffects: [{ type: 'add', entityId: 'player', attribute: 'gold', value: -10 }],
      endEffects: [{ type: 'grant_item', entityId: 'inventory', attribute: 'sword' }],
    },
  },
}

describe('ClientSimulationEngine – effects', () => {
  let engine: ReturnType<typeof createClientSimulationEngine>

  beforeEach(() => {
    clearStorage()
    engine = createClientSimulationEngine(config, 12345)
  })

  it('add effect increments attribute', async () => {
    await engine.execute('earn_gold')
    const state = await engine.getState()
    expect(state['player']?.['gold']).toBe(50)
  })

  it('guard prevents execution when not met', async () => {
    // Player has 0 gold, guard requires >= 30
    const result = await engine.execute('spend_gold')
    expect(result).toBeNull()
  })

  it('guard allows execution when met', async () => {
    await engine.execute('earn_gold')  // +50 gold
    const run = await engine.execute('spend_gold') // requires 30, -30
    expect(run).not.toBeNull()
    const state = await engine.getState()
    expect(state['player']?.['gold']).toBe(20)
  })

  it('set effect replaces value', async () => {
    await engine.execute('earn_gold')  // set gold=50
    await engine.execute('set_gold')   // set gold=0
    const state = await engine.getState()
    expect(state['player']?.['gold']).toBe(0)
  })

  it('grant_item increments by 1', async () => {
    await engine.execute('grant_sword')
    const state = await engine.getState()
    expect(state['inventory']?.['sword']).toBe(1)
  })

  it('remove_item decrements by 1, floored at 0', async () => {
    await engine.execute('grant_sword')
    await engine.execute('remove_sword')
    const state = await engine.getState()
    expect(state['inventory']?.['sword']).toBe(0)
    // Second remove — should not go negative
    await engine.execute('remove_sword')
    const state2 = await engine.getState()
    expect(state2['inventory']?.['sword']).toBe(0)
  })
})

describe('ClientSimulationEngine – loot table outputs', () => {
  let engine: ReturnType<typeof createClientSimulationEngine>

  beforeEach(() => {
    clearStorage()
    engine = createClientSimulationEngine(config, 99)
  })

  it('output with chance=1 is always granted', async () => {
    await engine.execute('loot_chest')
    const state = await engine.getState()
    expect(state['loot_gold']?.['quantity']).toBe(10)
  })

  it('output with chance=0 is never granted', async () => {
    await engine.execute('loot_chest')
    const state = await engine.getState()
    expect(state['loot_rare']?.['quantity']).toBeUndefined()
  })

  it('output without chance defaults to 1 (always granted)', async () => {
    await engine.execute('loot_chest')
    const state = await engine.getState()
    expect(state['loot_common']?.['quantity']).toBe(5)
  })
})

describe('ClientSimulationEngine – trigger_recipe', () => {
  let engine: ReturnType<typeof createClientSimulationEngine>

  beforeEach(() => {
    clearStorage()
    engine = createClientSimulationEngine(config, 7)
  })

  it('trigger_recipe chains into sub-recipe effects', async () => {
    await engine.execute('chain_recipe')
    const state = await engine.getState()
    // +10 from chain_recipe + +50 from triggered earn_gold
    expect(state['player']?.['gold']).toBe(60)
  })
})

describe('ClientSimulationEngine – timed recipes and collect()', () => {
  let engine: ReturnType<typeof createClientSimulationEngine>

  beforeEach(() => {
    clearStorage()
    engine = createClientSimulationEngine(config, 42)
  })

  it('timed recipe returns an active run with future endsAt', async () => {
    const run = await engine.execute('timed_forge')
    expect(run).not.toBeNull()
    expect(run!.endsAt).toBeGreaterThan(Date.now())
  })

  it('collect() before timer expires returns current state without endEffects', async () => {
    const run = await engine.execute('timed_forge')
    const state = await engine.collect(run!.runId)
    // endEffects (grant_item sword) should NOT be applied yet
    expect(state['inventory']?.['sword']).toBeUndefined()
  })

  it('collect() after timer expires applies endEffects', async () => {
    vi.useFakeTimers()
    try {
      engine = createClientSimulationEngine(config, 42)
      clearStorage()

      const run = await engine.execute('timed_forge')
      vi.advanceTimersByTime(6000)
      const state = await engine.collect(run!.runId)
      expect(state['inventory']?.['sword']).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ClientSimulationEngine – canExecute', () => {
  let engine: ReturnType<typeof createClientSimulationEngine>

  beforeEach(() => {
    clearStorage()
    engine = createClientSimulationEngine(config, 1)
  })

  it('returns false for unknown recipe', async () => {
    expect(await engine.canExecute('nonexistent')).toBe(false)
  })

  it('returns true when guards met', async () => {
    await engine.execute('earn_gold') // give gold
    expect(await engine.canExecute('spend_gold')).toBe(true)
  })

  it('returns false when guards not met', async () => {
    expect(await engine.canExecute('spend_gold')).toBe(false)
  })
})

describe('ClientSimulationEngine – subscribe', () => {
  let engine: ReturnType<typeof createClientSimulationEngine>

  beforeEach(() => {
    clearStorage()
    engine = createClientSimulationEngine(config, 1)
  })

  it('notifies subscriber after execute', async () => {
    const received: SimulationState[] = []
    engine.subscribe(s => received.push(s))
    await engine.execute('earn_gold')
    expect(received).toHaveLength(1)
    expect(requireAt(received, 0)['player']?.['gold']).toBe(50)
  })

  it('unsubscribe stops notifications', async () => {
    const received: SimulationState[] = []
    const unsub = engine.subscribe(s => received.push(s))
    unsub()
    await engine.execute('earn_gold')
    expect(received).toHaveLength(0)
  })

  it('multiple subscribers each receive updates', async () => {
    const a: SimulationState[] = []
    const b: SimulationState[] = []
    engine.subscribe(s => a.push(s))
    engine.subscribe(s => b.push(s))
    await engine.execute('earn_gold')
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
  })
})

// ── metadata passthrough ────────────────────────────────────────────────────

describe('ClientSimulationEngine – metadata passthrough', () => {
  it('entity metadata is accessible on config but not in simulation state', async () => {
    const cfg: ClientSimulationConfig = {
      version: 1,
      entities: {
        building: {
          id: 'building',
          tags: ['building'],
          attributes: { level: 1 },
          metadata: { displayName: 'Headquarters', icon: 'hq.png' },
        },
      },
      recipes: {
        upgrade: {
          id: 'upgrade',
          tags: ['upgrade'],
          metadata: { sortOrder: 1, displayName: 'Upgrade HQ' },
          beginEffects: [{ type: 'add', entityId: 'building', attribute: 'level', value: 1 }],
        },
      },
    }
    clearStorage()
    const engine = createClientSimulationEngine(cfg, 1)
    await engine.execute('upgrade')
    const state = await engine.getState()
    const building = requireDefined(cfg.entities['building'])
    const upgrade = requireDefined(cfg.recipes['upgrade'])
    // metadata is on config, not in state
    expect(requireDefined(building.metadata)['displayName']).toBe('Headquarters')
    expect(requireDefined(upgrade.metadata)['sortOrder']).toBe(1)
    // state only has attributes
    expect(state['building']?.['level']).toBe(1)
    expect(state['building']?.['displayName']).toBeUndefined()
  })
})

// ── autoRestart ─────────────────────────────────────────────────────────────

const autoRestartConfig: ClientSimulationConfig = {
  version: 1,
  entities: {
    energy: { id: 'energy', tags: ['energy'], attributes: { current: 0, max: 3 } },
  },
  recipes: {
    energy_regen: {
      id: 'energy_regen',
      tags: ['regen'],
      durationMs: 1000,
      autoRestart: true,
      guards: [{ entityId: 'energy', attribute: 'current', op: '<=', value: 2 }],
      endEffects: [{ type: 'add', entityId: 'energy', attribute: 'current', value: 1 }],
    },
  },
}

describe('ClientSimulationEngine – autoRestart', () => {
  beforeEach(() => clearStorage())

  it('auto-restarts after collect when guards pass', async () => {
    vi.useFakeTimers()
    try {
      await seedStateFromConfig(autoRestartConfig)
      const engine = createClientSimulationEngine(autoRestartConfig, 1)
      const run = await engine.execute('energy_regen')
      expect(run).not.toBeNull()

      vi.advanceTimersByTime(1500)
      const state = await engine.collect(run!.runId)
      expect(state['energy']?.['current']).toBe(1)

      // A new run should have been created (autoRestart)
      const rawRuns = await RundotAPI.appStorage.getItem('sim_runs')
      const runs = JSON.parse(rawRuns!) as Record<string, { recipeId?: string }>
      const runIds = Object.keys(runs)
      expect(runIds).toHaveLength(1)
      expect(runs[requireAt(runIds, 0)]?.recipeId).toBe('energy_regen')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not restart when guard fails after collect', async () => {
    vi.useFakeTimers()
    try {
      await seedStateFromConfig(autoRestartConfig)
      const engine = createClientSimulationEngine(autoRestartConfig, 2)

      // Execute 3 times to fill energy to max (guard: current <= 2)
      const r1 = await engine.execute('energy_regen')
      vi.advanceTimersByTime(1500)
      await engine.collect(r1!.runId)

      // After first collect: current=1, autoRestart fires → new run
      const rawRuns1 = await RundotAPI.appStorage.getItem('sim_runs')
      const runs1 = JSON.parse(rawRuns1!)
      const r2Id = requireAt(Object.keys(runs1), 0)

      vi.advanceTimersByTime(1500)
      await engine.collect(r2Id)
      // current=2, autoRestart fires (guard <=2 passes)

      const rawRuns2 = await RundotAPI.appStorage.getItem('sim_runs')
      const runs2 = JSON.parse(rawRuns2!)
      const r3Id = requireAt(Object.keys(runs2), 0)

      vi.advanceTimersByTime(1500)
      await engine.collect(r3Id)
      // current=3, guard <=2 fails → no restart

      const rawRuns3 = await RundotAPI.appStorage.getItem('sim_runs')
      const runs3 = rawRuns3 ? JSON.parse(rawRuns3) : {}
      expect(Object.keys(runs3)).toHaveLength(0)

      const state = await engine.getState()
      expect(state['energy']?.['current']).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── maxConcurrency ──────────────────────────────────────────────────────────

const maxConcurrencyConfig: ClientSimulationConfig = {
  version: 1,
  entities: {
    builder: { id: 'builder', tags: [], attributes: { gold: 1000 } },
  },
  recipes: {
    build_upgrade: {
      id: 'build_upgrade',
      tags: ['upgrade'],
      durationMs: 5000,
      maxConcurrency: 2,
      beginEffects: [{ type: 'add', entityId: 'builder', attribute: 'gold', value: -100 }],
      endEffects: [{ type: 'add', entityId: 'builder', attribute: 'gold', value: 50 }],
    },
  },
}

describe('ClientSimulationEngine – maxConcurrency', () => {
  beforeEach(() => clearStorage())

  it('allows up to maxConcurrency simultaneous runs', async () => {
    const engine = createClientSimulationEngine(maxConcurrencyConfig, 1)
    const r1 = await engine.execute('build_upgrade')
    const r2 = await engine.execute('build_upgrade')
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
  })

  it('rejects execution beyond maxConcurrency limit', async () => {
    const engine = createClientSimulationEngine(maxConcurrencyConfig, 1)
    await engine.execute('build_upgrade')
    await engine.execute('build_upgrade')
    const r3 = await engine.execute('build_upgrade')
    expect(r3).toBeNull()
  })

  it('allows new execution after collecting a completed run', async () => {
    vi.useFakeTimers()
    try {
      const engine = createClientSimulationEngine(maxConcurrencyConfig, 1)
      const r1 = await engine.execute('build_upgrade')
      await engine.execute('build_upgrade')

      // At limit — should reject
      const r3 = await engine.execute('build_upgrade')
      expect(r3).toBeNull()

      // Collect first run
      vi.advanceTimersByTime(6000)
      await engine.collect(r1!.runId)

      // Now one slot is free
      const r4 = await engine.execute('build_upgrade')
      expect(r4).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── mergeSimConfigs ─────────────────────────────────────────────────────────

describe('mergeSimConfigs', () => {
  it('merges entities and recipes from multiple fragments', () => {
    const a: ClientSimulationConfig = {
      version: 1,
      entities: { gold: { id: 'gold', tags: [], attributes: { amount: 100 } } },
      recipes: { earn: { id: 'earn', tags: [], beginEffects: [] } },
    }
    const b: ClientSimulationConfig = {
      version: 2,
      entities: { gems: { id: 'gems', tags: [], attributes: { amount: 50 } } },
      recipes: { spend: { id: 'spend', tags: [], beginEffects: [] } },
    }
    const merged = mergeSimConfigs(a, b)
    expect(merged.version).toBe(2)
    expect(Object.keys(merged.entities)).toEqual(['gold', 'gems'])
    expect(Object.keys(merged.recipes)).toEqual(['earn', 'spend'])
  })

  it('later fragment overwrites duplicate IDs', () => {
    const a: ClientSimulationConfig = {
      version: 1,
      entities: { gold: { id: 'gold', tags: [], attributes: { amount: 100 } } },
      recipes: {},
    }
    const b: ClientSimulationConfig = {
      version: 1,
      entities: { gold: { id: 'gold', tags: ['currency'], attributes: { amount: 999 } } },
      recipes: {},
    }
    const merged = mergeSimConfigs(a, b)
    const goldEntity = requireDefined(merged.entities['gold'])
    expect(goldEntity.tags).toEqual(['currency'])
    expect(goldEntity.attributes['amount']).toBe(999)
  })

  it('handles empty fragments', () => {
    const empty: ClientSimulationConfig = { version: 0, entities: {}, recipes: {} }
    const a: ClientSimulationConfig = {
      version: 1,
      entities: { x: { id: 'x', tags: [], attributes: {} } },
      recipes: {},
    }
    const merged = mergeSimConfigs(empty, a, empty)
    expect(merged.version).toBe(1)
    expect(Object.keys(merged.entities)).toEqual(['x'])
  })
})
