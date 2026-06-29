import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  validateFtueConfig,
  shouldShowSkipButton,
  getStepById,
  getPhaseSteps,
  getChainProgress,
  getNextStep,
  isPhaseComplete,
  areRequiredPhasesComplete,
  getNextPhase,
  resolveGates,
  evaluateRoundEntryTriggers,
  evaluateOngoingTriggers,
  createConditionRunner,
} from './FtueEngine'
import { createFtueStoreInstance } from './FtueStoreFactory'
import type { FtueConfig, FtueAdapter } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

interface TestCtx {
  round: number
  sawShop: boolean
  sawSocial: boolean
  didAction: boolean
  gotReward: boolean
  isVip: boolean
  guardMet: boolean
}

const defaultCtx: TestCtx = {
  round: 1,
  sawShop: false,
  sawSocial: false,
  didAction: false,
  gotReward: false,
  isVip: false,
  guardMet: false,
}

function createTestAdapter(ctx: TestCtx = { ...defaultCtx }): FtueAdapter<TestCtx> {
  const subscribers: Array<() => void> = []
  return {
    conditions: {
      always: () => true,
      never: () => false,
      manual: () => false,
      first_action_done: (c) => c.didAction,
      reward_collected: (c) => c.gotReward,
      shop_browsed: (c) => c.sawShop,
      social_viewed: (c) => c.sawSocial,
      reached_shop: (c) => c.sawShop,
      reached_social: (c) => c.sawSocial,
      is_vip: (c) => c.isVip,
      guard_met: (c) => c.guardMet,
    },
    getContext: () => ctx,
    subscribe: (cb) => {
      subscribers.push(cb)
      return () => {
        const idx = subscribers.indexOf(cb)
        if (idx >= 0) subscribers.splice(idx, 1)
      }
    },
    isNewPlayer: () => ({ isLoaded: true, isNewPlayer: true }),
    hints: ['hint_a', 'hint_b'],
    getRound: () => ctx.round,
    _notify() { subscribers.forEach(cb => cb()) },
  } as FtueAdapter<TestCtx> & { _notify: () => void }
}

const TEST_SCREEN = 'game'

const linearConfig: FtueConfig = {
  kitScreen: TEST_SCREEN,
  phases: [
    { id: 'core', mode: 'linear', completesWhen: 'all_non_stub' },
  ],
  steps: [
    { id: 'step_a', phase: 'core', spotlight: null, message: 'Do A', completion: { type: 'first_action_done' } },
    { id: 'step_b', phase: 'core', spotlight: null, message: 'Do B', completion: { type: 'reward_collected' } },
  ],
}

const multiPhaseConfig: FtueConfig = {
  kitScreen: TEST_SCREEN,
  phases: [
    { id: 'core', mode: 'linear', completesWhen: 'all_non_stub' },
    { id: 'outer', mode: 'contextual' },
  ],
  steps: [
    { id: 'step_a', phase: 'core', spotlight: null, message: 'Do A', completion: { type: 'first_action_done' } },
    { id: 'step_b', phase: 'core', spotlight: null, message: 'Do B', completion: { type: 'reward_collected' } },
    {
      id: 'shop_tip', phase: 'outer', spotlight: 'shop', message: 'Shop!',
      completion: { type: 'shop_browsed' },
      trigger: { mode: 'ongoing', condition: 'reached_shop' },
    },
  ],
}

const gatedConfig: FtueConfig = {
  kitScreen: TEST_SCREEN,
  phases: [
    { id: 'core', mode: 'linear', completesWhen: 'all_non_stub' },
  ],
  steps: [
    {
      id: 'step_a', phase: 'core', spotlight: null, message: 'A',
      completion: { type: 'always' },
      gates: [
        { name: 'gate_reach', opensOn: 'reach' },
        { name: 'gate_complete', opensOn: 'complete' },
      ],
    },
    { id: 'step_b', phase: 'core', spotlight: null, message: 'B', completion: { type: 'always' } },
  ],
}

const stubConfig: FtueConfig = {
  kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
  steps: [
    { id: 'real_a', phase: 'core', spotlight: null, message: 'A', completion: { type: 'always' } },
    { id: 'stub_1', phase: 'core', spotlight: null, message: 'hidden', completion: { type: 'always' }, stub: true },
    { id: 'real_b', phase: 'core', spotlight: null, message: 'B', completion: { type: 'always' } },
  ],
}

const chainConfig: FtueConfig = {
  kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
  steps: [
    { id: 'chain_1', phase: 'core', spotlight: null, message: '1', completion: { type: 'always' }, next: 'chain_2' },
    { id: 'chain_2', phase: 'core', spotlight: null, message: '2', completion: { type: 'always' }, next: 'chain_3' },
    { id: 'chain_3', phase: 'core', spotlight: null, message: '3', completion: { type: 'always' } },
  ],
}

const terminatorConfig: FtueConfig = {
  kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
  steps: [
    { id: 'only', phase: 'core', spotlight: null, message: 'End here', completion: { type: 'always' }, next: null },
    { id: 'unreachable', phase: 'core', spotlight: null, message: 'Never', completion: { type: 'always' } },
  ],
}

const conditionalNextConfig: FtueConfig = {
  kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
  steps: [
    {
      id: 'branch_root', phase: 'core', spotlight: null, message: 'Choose',
      completion: { type: 'always' },
      next: { step: 'vip_path', condition: 'is_vip' },
    },
    { id: 'vip_path', phase: 'core', spotlight: null, message: 'VIP', completion: { type: 'always' } },
    { id: 'normal_path', phase: 'core', spotlight: null, message: 'Normal', completion: { type: 'always' } },
  ],
}

const guardedConfig: FtueConfig = {
  kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
  steps: [
    { id: 'step_a', phase: 'core', spotlight: null, message: 'A', completion: { type: 'always' } },
    { id: 'guarded', phase: 'core', spotlight: null, message: 'Guarded', completion: { type: 'always' }, guard: 'guard_met' },
  ],
}

const roundTriggerConfig: FtueConfig = {
  kitScreen: TEST_SCREEN,
  phases: [
    { id: 'core', mode: 'linear', completesWhen: 'all_non_stub' },
    { id: 'tips', mode: 'contextual' },
  ],
  steps: [
    { id: 'intro', phase: 'core', spotlight: null, message: 'Intro', completion: { type: 'always' } },
    {
      id: 'round_tip', phase: 'tips', spotlight: null, message: 'Round tip!',
      completion: { type: 'manual' },
      trigger: { mode: 'on_round_entry', condition: 'always', roundMin: 2, roundMax: 5, priority: 10 },
    },
    {
      id: 'low_priority', phase: 'tips', spotlight: null, message: 'Low',
      completion: { type: 'manual' },
      trigger: { mode: 'on_round_entry', condition: 'always', roundMin: 2, roundMax: 5, priority: 1 },
    },
    {
      id: 'ongoing_tip', phase: 'tips', spotlight: null, message: 'Ongoing!',
      completion: { type: 'shop_browsed' },
      trigger: { mode: 'ongoing', condition: 'reached_shop' },
    },
  ],
}

const characterConfig: FtueConfig = {
  kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
  steps: [
    {
      id: 'char_step', phase: 'core', spotlight: null, message: 'Hi!',
      completion: { type: 'always' }, character: 'guide_npc',
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateFtueConfig', () => {
  let adapter: ReturnType<typeof createTestAdapter>

  beforeEach(() => { adapter = createTestAdapter() })

  it('passes for valid config', () => {
    expect(() => validateFtueConfig(linearConfig, adapter)).not.toThrow()
  })

  it('throws on reserved phase ID', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'completed', mode: 'linear' }],
      steps: [],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('reserved')
  })

  it('catches duplicate step IDs', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [
        { id: 'dup', phase: 'core', spotlight: null, message: 'A', completion: { type: 'always' } },
        { id: 'dup', phase: 'core', spotlight: null, message: 'B', completion: { type: 'always' } },
      ],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('Duplicate step ID')
  })

  it('catches unknown phase reference', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{ id: 's1', phase: 'nonexistent', spotlight: null, message: 'X', completion: { type: 'always' } }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('unknown phase')
  })

  it('catches unregistered completion type', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{ id: 's1', phase: 'core', spotlight: null, message: 'X', completion: { type: 'unknown_cond' } }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('not registered')
  })

  it('allows manual completion type without adapter registration', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{ id: 's1', phase: 'core', spotlight: null, message: 'X', completion: { type: 'manual' } }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).not.toThrow()
  })

  it('catches unregistered trigger condition', () => {
    const cfg: FtueConfig = {
      phases: [{ id: 'core', mode: 'contextual' }],
      steps: [{
        id: 's1', phase: 'core', spotlight: null, message: 'X',
        completion: { type: 'always' },
        trigger: { mode: 'ongoing', condition: 'unknown_trigger' },
      }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('trigger condition')
  })

  it('catches unknown next step reference', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{
        id: 's1', phase: 'core', spotlight: null, message: 'X',
        completion: { type: 'always' }, next: 'nonexistent',
      }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('unknown next step')
  })

  it('catches unregistered next condition', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{
        id: 's1', phase: 'core', spotlight: null, message: 'X',
        completion: { type: 'always' },
        next: { step: 's1', condition: 'unknown_cond' },
      }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('next condition')
  })

  it('catches unregistered guard condition', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{
        id: 's1', phase: 'core', spotlight: null, message: 'X',
        completion: { type: 'always' }, guard: 'unknown_guard',
      }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('guard condition')
  })

  it('catches hints not in palette', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{
        id: 's1', phase: 'core', spotlight: null, message: 'X',
        completion: { type: 'always' }, hint: 'unknown_hint',
      }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('hint')
  })

  it('catches duplicate gate names', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [
        {
          id: 's1', phase: 'core', spotlight: null, message: 'A',
          completion: { type: 'always' },
          gates: [{ name: 'dup_gate', opensOn: 'complete' }],
        },
        {
          id: 's2', phase: 'core', spotlight: null, message: 'B',
          completion: { type: 'always' },
          gates: [{ name: 'dup_gate', opensOn: 'reach' }],
        },
      ],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('Duplicate gate name')
  })

  it('detects cycles in next chains', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [
        { id: 'a', phase: 'core', spotlight: null, message: 'A', completion: { type: 'always' }, next: 'b' },
        { id: 'b', phase: 'core', spotlight: null, message: 'B', completion: { type: 'always' }, next: 'a' },
      ],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('Cycle detected')
  })

  it('requires kitScreen when linear phase exists', () => {
    const cfg: FtueConfig = {
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{ id: 's1', phase: 'core', spotlight: null, message: 'X', completion: { type: 'always' } }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('kitScreen')
  })

  it('allows omitting kitScreen when only contextual phases', () => {
    const cfg: FtueConfig = {
      phases: [{ id: 'tips', mode: 'contextual' }],
      steps: [{
        id: 's1', phase: 'tips', spotlight: null, message: 'X',
        completion: { type: 'always' },
        trigger: { mode: 'ongoing', condition: 'always' },
      }],
    }
    expect(() => validateFtueConfig(cfg, adapter)).not.toThrow()
  })

  it('rejects alwaysShowSkip: false — skip must always be available', () => {
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear' }],
      steps: [{ id: 's1', phase: 'core', spotlight: null, message: 'X', completion: { type: 'always' } }],
      alwaysShowSkip: false,
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow('alwaysShowSkip')
  })

  it('defaults alwaysShowSkip to true (skip from step 0)', () => {
    // Config without alwaysShowSkip field — should pass validation and show skip
    expect(() => validateFtueConfig(linearConfig, adapter)).not.toThrow()
    expect(shouldShowSkipButton(linearConfig)).toBe(true)
  })

  it('throws when a linear phase has no steps', () => {
    // tiny-realms post-mortem 2026-04-18 #5: silent currentStepId=null
    // failure mode. The validator must reject configs that would put the
    // engine into the never-advance state.
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'intro', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [],
    }
    expect(() => validateFtueConfig(cfg, adapter)).toThrow(
      /linear phase "intro" has no steps/i,
    )
  })

  it('passes when a non-linear phase has no steps', () => {
    // Open-mode phases (e.g., contextual hints triggered by adapter
    // conditions) legitimately may declare no steps under some configs.
    // Only linear phases must guarantee a startable step.
    const cfg: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [
        { id: 'core', mode: 'linear', completesWhen: 'all_non_stub' },
        { id: 'hints', mode: 'open' },
      ],
      steps: [
        {
          id: 'first',
          phase: 'core',
          target: 'orb',
          completion: { type: 'manual' },
          hint: 'hint_a',
        },
      ],
    }
    expect(() => validateFtueConfig(cfg, adapter)).not.toThrow()
  })
})

describe('shouldShowSkipButton', () => {
  it('returns true by default (no alwaysShowSkip field)', () => {
    const cfg: FtueConfig = { phases: [], steps: [] }
    expect(shouldShowSkipButton(cfg)).toBe(true)
  })

  it('returns true when alwaysShowSkip is explicitly true', () => {
    const cfg: FtueConfig = { phases: [], steps: [], alwaysShowSkip: true }
    expect(shouldShowSkipButton(cfg)).toBe(true)
  })

  it('returns false only when alwaysShowSkip is explicitly false', () => {
    const cfg: FtueConfig = { phases: [], steps: [], alwaysShowSkip: false }
    expect(shouldShowSkipButton(cfg)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Step graph tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Step graph', () => {
  const adapter = createTestAdapter()
  const evalCond = (key: string) => {
    const fn = adapter.conditions[key]
    return fn ? fn(adapter.getContext(), {}, null) : false
  }

  it('getStepById finds step', () => {
    expect(getStepById(linearConfig, 'step_a')?.id).toBe('step_a')
  })

  it('getStepById returns undefined for unknown', () => {
    expect(getStepById(linearConfig, 'nope')).toBeUndefined()
  })

  it('getPhaseSteps filters stubs', () => {
    const steps = getPhaseSteps(stubConfig, 'core')
    expect(steps.map(s => s.id)).toEqual(['real_a', 'real_b'])
  })

  it('getChainProgress returns current/total for linked chain', () => {
    const completed = new Set(['chain_1'])
    const progress = getChainProgress(chainConfig, 'chain_2', completed)
    expect(progress).toEqual({ current: 2, total: 3 })
  })

  it('getChainProgress returns undefined for single step', () => {
    const progress = getChainProgress(linearConfig, 'step_a', new Set())
    expect(progress).toBeUndefined()
  })

  it('getNextStep returns next in linear sequence', () => {
    const next = getNextStep(linearConfig, 'step_a', new Set(), evalCond)
    expect(next?.id).toBe('step_b')
  })

  it('getNextStep follows explicit string next', () => {
    const next = getNextStep(chainConfig, 'chain_1', new Set(), evalCond)
    expect(next?.id).toBe('chain_2')
  })

  it('getNextStep handles next: null terminator', () => {
    const next = getNextStep(terminatorConfig, 'only', new Set(), evalCond)
    expect(next).toBeUndefined()
  })

  it('getNextStep handles conditional next (true)', () => {
    const ctx: TestCtx = { ...defaultCtx, isVip: true }
    const vipAdapter = createTestAdapter(ctx)
    const vipEval = (key: string) => {
      const fn = vipAdapter.conditions[key]
      return fn ? fn(ctx, {}, null) : false
    }
    const next = getNextStep(conditionalNextConfig, 'branch_root', new Set(), vipEval)
    expect(next?.id).toBe('vip_path')
  })

  it('getNextStep handles conditional next (false) — returns undefined', () => {
    const next = getNextStep(conditionalNextConfig, 'branch_root', new Set(), evalCond)
    expect(next).toBeUndefined()
  })

  it('getNextStep skips stubs', () => {
    const next = getNextStep(stubConfig, 'real_a', new Set(), evalCond)
    expect(next?.id).toBe('real_b')
  })

  it('getNextStep skips completed steps', () => {
    const completed = new Set(['step_b'])
    const next = getNextStep(linearConfig, 'step_a', completed, evalCond)
    expect(next).toBeUndefined()
  })

  it('getNextStep skips triggered steps in contextual phases', () => {
    // shop_tip has a trigger, so it should not be returned by linear getNextStep
    const next = getNextStep(multiPhaseConfig, 'step_b', new Set(), evalCond)
    expect(next).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase completion tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase completion', () => {
  it('isPhaseComplete true when all non-stub steps done', () => {
    const completed = new Set(['real_a', 'real_b'])
    expect(isPhaseComplete(stubConfig, 'core', completed)).toBe(true)
  })

  it('isPhaseComplete false when steps remain', () => {
    expect(isPhaseComplete(stubConfig, 'core', new Set(['real_a']))).toBe(false)
  })

  it('isPhaseComplete false when no completesWhen', () => {
    const cfg: FtueConfig = {
      phases: [{ id: 'core', mode: 'contextual' }],
      steps: [{ id: 's1', phase: 'core', spotlight: null, message: 'X', completion: { type: 'always' } }],
    }
    expect(isPhaseComplete(cfg, 'core', new Set(['s1']))).toBe(false)
  })

  it('areRequiredPhasesComplete checks all phases with completesWhen', () => {
    const completed = new Set(['step_a', 'step_b'])
    expect(areRequiredPhasesComplete(multiPhaseConfig, completed)).toBe(true)
  })

  it('getNextPhase returns next', () => {
    expect(getNextPhase(multiPhaseConfig, 'core')?.id).toBe('outer')
  })

  it('getNextPhase returns undefined at end', () => {
    expect(getNextPhase(multiPhaseConfig, 'outer')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Gate resolution tests
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveGates', () => {
  it('opens reach gate when step is current', () => {
    const gates = resolveGates(gatedConfig, 'step_a', new Set(), 'core')
    expect(gates.has('gate_reach')).toBe(true)
    expect(gates.has('gate_complete')).toBe(false)
  })

  it('opens complete gate when step is completed', () => {
    const gates = resolveGates(gatedConfig, null, new Set(['step_a']), 'core')
    expect(gates.has('gate_reach')).toBe(true)
    expect(gates.has('gate_complete')).toBe(true)
  })

  it('opens all gates when FTUE is completed', () => {
    const gates = resolveGates(gatedConfig, null, new Set(), 'completed')
    expect(gates.has('gate_reach')).toBe(true)
    expect(gates.has('gate_complete')).toBe(true)
  })

  it('opens all gates when FTUE is skipped', () => {
    const gates = resolveGates(gatedConfig, null, new Set(), 'skipped')
    expect(gates.has('gate_reach')).toBe(true)
    expect(gates.has('gate_complete')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trigger evaluator tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Trigger evaluators', () => {
  it('evaluateRoundEntryTriggers fires on matching round', () => {
    const evalCond = () => true
    const result = evaluateRoundEntryTriggers(roundTriggerConfig, 3, new Set(), null, evalCond)
    expect(result?.id).toBe('round_tip') // higher priority
  })

  it('evaluateRoundEntryTriggers respects priority', () => {
    const evalCond = () => true
    const result = evaluateRoundEntryTriggers(roundTriggerConfig, 3, new Set(), null, evalCond)
    expect(result?.id).toBe('round_tip') // priority 10 > priority 1
  })

  it('evaluateRoundEntryTriggers skips out-of-range rounds', () => {
    const evalCond = () => true
    const result = evaluateRoundEntryTriggers(roundTriggerConfig, 1, new Set(), null, evalCond)
    expect(result).toBeUndefined()
  })

  it('evaluateRoundEntryTriggers skips completed steps', () => {
    const evalCond = () => true
    const completed = new Set(['round_tip', 'low_priority'])
    const result = evaluateRoundEntryTriggers(roundTriggerConfig, 3, completed, null, evalCond)
    expect(result).toBeUndefined()
  })

  it('evaluateOngoingTriggers fires when condition met', () => {
    const ctx: TestCtx = { ...defaultCtx, sawShop: true }
    const adapter = createTestAdapter(ctx)
    const evalCond = (key: string) => {
      const fn = adapter.conditions[key]
      return fn ? fn(ctx, {}, null) : false
    }
    const result = evaluateOngoingTriggers(roundTriggerConfig, new Set(), null, evalCond, 1)
    expect(result?.id).toBe('ongoing_tip')
  })

  it('evaluateOngoingTriggers skips when condition not met', () => {
    const adapter = createTestAdapter()
    const evalCond = (key: string) => {
      const fn = adapter.conditions[key]
      return fn ? fn(adapter.getContext(), {}, null) : false
    }
    const result = evaluateOngoingTriggers(roundTriggerConfig, new Set(), null, evalCond, 1)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Condition runner tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createConditionRunner', () => {
  afterEach(() => { vi.useRealTimers() })

  it('auto-completes active step when condition met', async () => {
    vi.useFakeTimers()
    const ctx: TestCtx = { ...defaultCtx }
    const adapter = createTestAdapter(ctx) as FtueAdapter<TestCtx> & { _notify: () => void }

    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    expect(store.getState().currentStepId).toBe('step_a')

    const runner = createConditionRunner(linearConfig, adapter, {
      getState: () => store.getState(),
      advanceStep: () => store.getState().advanceStep(),
      showStep: (id) => store.getState().showStep(id),
      hideCurrentStep: () => store.getState().hideCurrentStep(),
    }, { debounceMs: 0 })

    runner.start()

    // Condition becomes true
    ctx.didAction = true
    adapter._notify()
    vi.advanceTimersByTime(10)

    expect(store.getState().currentStepId).toBe('step_b')

    runner.stop()
  })

  it('fires ongoing triggers when not active', async () => {
    vi.useFakeTimers()
    const ctx: TestCtx = { ...defaultCtx }
    const adapter = createTestAdapter(ctx) as FtueAdapter<TestCtx> & { _notify: () => void }

    const { store } = createFtueStoreInstance()
    await store.getState().initialize(multiPhaseConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    // Complete linear phase
    ctx.didAction = true
    store.getState().advanceStep()
    ctx.gotReward = true
    store.getState().advanceStep()

    // Now in outer (contextual) phase, not active
    expect(store.getState().isActive).toBe(false)
    expect(store.getState().currentPhase).toBe('outer')

    const runner = createConditionRunner(multiPhaseConfig, adapter, {
      getState: () => store.getState(),
      advanceStep: () => store.getState().advanceStep(),
      showStep: (id) => store.getState().showStep(id),
      hideCurrentStep: () => store.getState().hideCurrentStep(),
    }, { debounceMs: 0 })

    runner.start()

    // Trigger condition met
    ctx.sawShop = true
    adapter._notify()
    vi.advanceTimersByTime(10)

    expect(store.getState().currentStepId).toBe('shop_tip')
    expect(store.getState().isActive).toBe(true)

    runner.stop()
  })

  it('stops cleanly', async () => {
    const adapter = createTestAdapter()
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)

    const runner = createConditionRunner(linearConfig, adapter, {
      getState: () => store.getState(),
      advanceStep: () => store.getState().advanceStep(),
      showStep: (id) => store.getState().showStep(id),
      hideCurrentStep: () => store.getState().hideCurrentStep(),
    })

    runner.start()
    runner.stop()
    // No error — clean shutdown
  })

  it('re-checks immediately after advance so a missing next spotlight hides on the next frame', async () => {
    vi.useFakeTimers()
    const ctx: TestCtx = { ...defaultCtx }
    const adapter = createTestAdapter(ctx) as FtueAdapter<TestCtx> & { _notify: () => void }
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame

    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((handle: number) =>
      clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame

    const spotlightAdvanceConfig: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [
        { id: 'step_a', phase: 'core', spotlight: null, message: 'A', completion: { type: 'first_action_done' } },
        { id: 'step_b', phase: 'core', spotlight: '#later', message: 'B', completion: { type: 'manual' } },
      ],
    }

    const { store } = createFtueStoreInstance()
    await store.getState().initialize(spotlightAdvanceConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    const runner = createConditionRunner(spotlightAdvanceConfig, adapter, {
      getState: () => store.getState(),
      advanceStep: () => store.getState().advanceStep(),
      showStep: (id) => store.getState().showStep(id),
      hideCurrentStep: () => store.getState().hideCurrentStep(),
    }, {
      debounceMs: 0,
      isSpotlightReady: (step) => step.id !== 'step_b',
    })

    try {
      runner.start()

      ctx.didAction = true
      adapter._notify()
      vi.runOnlyPendingTimers()

      expect(store.getState().currentStepId).toBe('step_b')
      expect(store.getState().isStepHidden).toBe(true)
    } finally {
      runner.stop()
      if (originalRaf) {
        globalThis.requestAnimationFrame = originalRaf
      } else {
        delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame
      }
      if (originalCancelRaf) {
        globalThis.cancelAnimationFrame = originalCancelRaf
      } else {
        delete (globalThis as Partial<typeof globalThis>).cancelAnimationFrame
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Store factory tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createFtueStoreInstance', () => {
  let adapter: ReturnType<typeof createTestAdapter>

  beforeEach(() => { adapter = createTestAdapter() })

  it('initialize + startFtue activates first linear step', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    expect(store.getState().isActive).toBe(true)
    expect(store.getState().currentStepId).toBe('step_a')
    expect(store.getState().currentPhase).toBe('core')
  })

  it('startFtue refuses to start on wrong screen', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue('wrong_screen')

    expect(store.getState().isActive).toBe(false)
    expect(store.getState().currentStepId).toBeNull()
  })

  it('advanceStep moves through linear phase', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().advanceStep()
    expect(store.getState().currentStepId).toBe('step_b')
    expect(store.getState().completedSteps.has('step_a')).toBe(true)
  })

  it('advanceStep completes FTUE when all done', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().advanceStep() // step_a -> step_b
    store.getState().advanceStep() // step_b -> done

    expect(store.getState().isActive).toBe(false)
    expect(store.getState().currentPhase).toBe('completed')
  })

  it('advanceStep transitions to next phase', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(multiPhaseConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().advanceStep() // step_a -> step_b
    store.getState().advanceStep() // step_b -> core done -> outer phase

    expect(store.getState().currentPhase).toBe('outer')
    expect(store.getState().isActive).toBe(false) // contextual phase doesn't auto-activate
  })

  it('advanceStep skips stub steps', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(stubConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    expect(store.getState().currentStepId).toBe('real_a')
    store.getState().advanceStep()
    // stub_1 should be auto-skipped
    expect(store.getState().currentStepId).toBe('real_b')
  })

  it('advanceStep pauses at guarded step when guard is false', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(guardedConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().advanceStep() // step_a -> guarded (guard false)
    expect(store.getState().isActive).toBe(false)
    expect(store.getState().currentStepId).toBeNull()
  })

  it('showStep activates a specific step', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(multiPhaseConfig, adapter)
    await store.getState().initialize(multiPhaseConfig, adapter) // idempotent

    // Start and complete linear
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    store.getState().advanceStep()

    // Manually show contextual step
    store.getState().showStep('shop_tip')
    expect(store.getState().isActive).toBe(true)
    expect(store.getState().currentStepId).toBe('shop_tip')
  })

  it('showStep ignores completed steps', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep() // completes step_a

    store.getState().showStep('step_a') // already completed
    expect(store.getState().currentStepId).toBe('step_b') // unchanged
  })

  it('hideCurrentStep hides without completing', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().hideCurrentStep()
    expect(store.getState().isStepHidden).toBe(true)
    expect(store.getState().currentStepId).toBe('step_a') // still active
  })

  it('pauseFtue deactivates', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().pauseFtue()
    expect(store.getState().isActive).toBe(false)
    expect(store.getState().currentStepId).toBeNull()
  })

  it('pauseFtue completes hidden step', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().hideCurrentStep()
    store.getState().pauseFtue()
    expect(store.getState().completedSteps.has('step_a')).toBe(true)
  })

  it('resumeLinearPhase reactivates', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().pauseFtue()

    store.getState().resumeLinearPhase()
    expect(store.getState().isActive).toBe(true)
    expect(store.getState().currentStepId).toBe('step_a')
  })

  it('resumeLinearPhase does nothing in contextual phase', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(multiPhaseConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    store.getState().advanceStep()

    // In contextual phase
    store.getState().resumeLinearPhase()
    expect(store.getState().isActive).toBe(false) // no change
  })

  it('notifyEvent advances an event-typed step when the event name matches', async () => {
    // Event-driven flow: steps complete via discrete named events the game
    // fires at the trigger moment. The correct primitive for creator tools,
    // arcade games, and any non-idle flow where "step completes on click X"
    // is the prevailing shape — polling game-state for a synthetic flag
    // is an anti-pattern.
    const eventConfig: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [
        {
          id: 'await_solve',
          phase: 'core',
          spotlight: '#accept',
          message: 'Accept',
          completion: { type: 'event', params: { eventName: 'solve_accepted' } },
        },
        {
          id: 'await_export',
          phase: 'core',
          spotlight: '#export',
          message: 'Export',
          completion: { type: 'event', params: { eventName: 'export_started' } },
        },
      ],
    }

    const { store } = createFtueStoreInstance()
    await store.getState().initialize(eventConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    expect(store.getState().currentStepId).toBe('await_solve')

    // Wrong event name — no-op.
    store.getState().notifyEvent('some_other_event')
    expect(store.getState().currentStepId).toBe('await_solve')

    // Matching event — advance.
    store.getState().notifyEvent('solve_accepted')
    expect(store.getState().currentStepId).toBe('await_export')
    expect(store.getState().completedSteps.has('await_solve')).toBe(true)

    store.getState().notifyEvent('export_started')
    expect(store.getState().currentPhase).toBe('completed')
    expect(store.getState().isActive).toBe(false)
  })

  it('notifyEvent is a no-op after skipAll and after completion (terminal-safe by construction)', async () => {
    const eventConfig: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [
        {
          id: 'await_x',
          phase: 'core',
          spotlight: '#x',
          message: 'Do X',
          completion: { type: 'event', params: { eventName: 'x_happened' } },
        },
      ],
    }

    const { store } = createFtueStoreInstance()
    await store.getState().initialize(eventConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().skipAll()
    expect(store.getState().currentPhase).toBe('skipped')

    // Hammer the notify after skip — must stay skipped.
    store.getState().notifyEvent('x_happened')
    store.getState().notifyEvent('x_happened')
    expect(store.getState().currentPhase).toBe('skipped')
    expect(store.getState().isActive).toBe(false)
  })

  it('validateFtueConfig rejects an event step missing params.eventName', () => {
    const badConfig: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [
        {
          id: 'broken_event',
          phase: 'core',
          spotlight: null,
          message: 'x',
          completion: { type: 'event' }, // ← missing params.eventName
        },
      ],
    }
    expect(() => validateFtueConfig(badConfig, adapter)).toThrow(/missing.*params\.eventName/)
  })

  it('validateFtueConfig accepts an event step with a valid eventName without requiring an adapter condition', () => {
    const okConfig: FtueConfig = {
      kitScreen: TEST_SCREEN,
      phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [
        {
          id: 'evt',
          phase: 'core',
          spotlight: null,
          message: 'x',
          completion: { type: 'event', params: { eventName: 'never_fires' } },
        },
      ],
    }
    // Explicitly use an adapter with NO conditions — the event type must
    // not route through the adapter at validate time.
    const emptyAdapter = createTestAdapter()
    emptyAdapter.conditions = {}
    expect(() => validateFtueConfig(okConfig, emptyAdapter)).not.toThrow()
  })

  it('skipAll marks as skipped', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().skipAll()
    expect(store.getState().currentPhase).toBe('skipped')
    expect(store.getState().isActive).toBe(false)
  })

  it('reset clears all state', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()

    store.getState().reset()
    expect(store.getState().isInitialized).toBe(false)
    expect(store.getState().completedSteps.size).toBe(0)
    expect(store.getState().currentStepId).toBeNull()
  })

  it('getGateOpen returns true when FTUE completed', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(gatedConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    store.getState().advanceStep()

    expect(store.getState().getGateOpen('gate_complete')).toBe(true)
  })

  it('getGateOpen returns true when FTUE skipped', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(gatedConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().skipAll()

    expect(store.getState().getGateOpen('gate_complete')).toBe(true)
  })

  it('completeCurrentStep delegates to advanceStep', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    store.getState().completeCurrentStep()
    expect(store.getState().currentStepId).toBe('step_b')
  })

  it('character field passes through step config', async () => {
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(characterConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)

    const step = getStepById(characterConfig, store.getState().currentStepId!)
    expect(step?.character).toBe('guide_npc')
  })

  // Lifecycle callbacks
  it('fires onStarted callback', async () => {
    const onStarted = vi.fn()
    const { store } = createFtueStoreInstance({ onStarted })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    expect(onStarted).toHaveBeenCalledOnce()
  })

  it('fires onStepCompleted callback', async () => {
    const onStepCompleted = vi.fn()
    const { store } = createFtueStoreInstance({ onStepCompleted })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    expect(onStepCompleted).toHaveBeenCalledWith('step_a')
  })

  it('fires onPhaseCompleted callback', async () => {
    const onPhaseCompleted = vi.fn()
    const { store } = createFtueStoreInstance({ onPhaseCompleted })
    await store.getState().initialize(multiPhaseConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    store.getState().advanceStep()
    expect(onPhaseCompleted).toHaveBeenCalledWith('core', expect.any(Number))
  })

  it('fires onCompleted callback', async () => {
    const onCompleted = vi.fn()
    const { store } = createFtueStoreInstance({ onCompleted })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    store.getState().advanceStep()
    expect(onCompleted).toHaveBeenCalledOnce()
  })

  it('fires onSkipped callback', async () => {
    const onSkipped = vi.fn()
    const { store } = createFtueStoreInstance({ onSkipped })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().skipAll()
    expect(onSkipped).toHaveBeenCalledWith('core', expect.any(Number))
  })

  // modalSuppressor
  it('modalSuppressor.suppress called on startFtue', async () => {
    const suppressor = { suppress: vi.fn(), unsuppress: vi.fn() }
    const { store } = createFtueStoreInstance({ modalSuppressor: suppressor })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    expect(suppressor.suppress).toHaveBeenCalledOnce()
  })

  it('modalSuppressor.unsuppress called on skipAll', async () => {
    const suppressor = { suppress: vi.fn(), unsuppress: vi.fn() }
    const { store } = createFtueStoreInstance({ modalSuppressor: suppressor })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().skipAll()
    expect(suppressor.unsuppress).toHaveBeenCalledOnce()
  })

  it('modalSuppressor.unsuppress called on FTUE completion', async () => {
    const suppressor = { suppress: vi.fn(), unsuppress: vi.fn() }
    const { store } = createFtueStoreInstance({ modalSuppressor: suppressor })
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    store.getState().advanceStep()
    store.getState().advanceStep()
    expect(store.getState().currentPhase).toBe('completed')
    expect(suppressor.unsuppress).toHaveBeenCalledOnce()
  })

  // showStep spotlight:null warning
  it('warns when showStep activates a spotlight:null step while active', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, adapter)
    store.getState().startFtue(TEST_SCREEN)
    // step_a has spotlight: null and FTUE is active
    store.getState().showStep('step_b')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('spotlight: null'))
    warnSpy.mockRestore()
  })

  // Persistence
  it('persistence round-trip', async () => {
    const storage = new Map<string, string>()
    const persistence = {
      load: (key: string) => {
        const raw = storage.get(key)
        return raw ? JSON.parse(raw) : null
      },
      save: (key: string, state: unknown) => {
        storage.set(key, JSON.stringify(state))
      },
      remove: (key: string) => { storage.delete(key) },
    }

    const configWithKey: FtueConfig = { ...linearConfig, storageKey: 'test_ftue' }

    // Create, advance, and persist
    const { store: store1 } = createFtueStoreInstance({ persistence })
    await store1.getState().initialize(configWithKey, adapter)
    store1.getState().startFtue(TEST_SCREEN)
    store1.getState().advanceStep()

    // New instance should restore
    const { store: store2 } = createFtueStoreInstance({ persistence })
    await store2.getState().initialize(configWithKey, adapter)

    expect(store2.getState().isInitialized).toBe(true)
    expect(store2.getState().completedSteps.has('step_a')).toBe(true)
  })

  it('persistence round-trip with async load', async () => {
    const storage = new Map<string, string>()
    const persistence = {
      load: async (key: string): Promise<unknown> => {
        // Simulate async storage (e.g. RundotAPI.appStorage)
        await new Promise(r => setTimeout(r, 1))
        const raw = storage.get(key)
        return raw ? JSON.parse(raw) : null
      },
      save: (key: string, state: unknown) => {
        storage.set(key, JSON.stringify(state))
      },
      remove: (key: string) => { storage.delete(key) },
    }

    const configWithKey: FtueConfig = { ...linearConfig, storageKey: 'test_ftue_async' }

    // Skip tutorial on first session
    const { store: store1 } = createFtueStoreInstance({ persistence })
    await store1.getState().initialize(configWithKey, adapter)
    store1.getState().startFtue(TEST_SCREEN)
    store1.getState().skipAll()
    expect(store1.getState().currentPhase).toBe('skipped')

    // New session — async load should restore 'skipped' state
    const { store: store2 } = createFtueStoreInstance({ persistence })
    await store2.getState().initialize(configWithKey, adapter)

    expect(store2.getState().isInitialized).toBe(true)
    expect(store2.getState().currentPhase).toBe('skipped')
    expect(store2.getState().isActive).toBe(false)
  })

  // Existing player skips FTUE
  it('initialize marks existing player as completed', async () => {
    const existingAdapter = {
      ...adapter,
      isNewPlayer: () => ({ isLoaded: true, isNewPlayer: false }),
    }
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, existingAdapter as FtueAdapter)
    expect(store.getState().currentPhase).toBe('completed')
    expect(store.getState().isInitialized).toBe(true)
  })

  // Unloaded player defers init
  it('initialize defers when player data not loaded', async () => {
    const unloadedAdapter = {
      ...adapter,
      isNewPlayer: () => ({ isLoaded: false, isNewPlayer: false }),
    }
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(linearConfig, unloadedAdapter as FtueAdapter)
    expect(store.getState().isInitialized).toBe(false)
  })

  // getConfig / getAdapter accessors
  it('getConfig and getAdapter return refs after init', async () => {
    const { store, getConfig, getAdapter } = createFtueStoreInstance()
    expect(getConfig()).toBeNull()
    expect(getAdapter()).toBeNull()

    await store.getState().initialize(linearConfig, adapter)
    expect(getConfig()).toBe(linearConfig)
    expect(getAdapter()).toBe(adapter)
  })

  // Structured completion with params
  it('structured completion with params works in config', () => {
    const paramConfig: FtueConfig = {
      kitScreen: TEST_SCREEN, phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [{
        id: 's1', phase: 'core', spotlight: null, message: 'X',
        completion: { type: 'always', params: { target: 'button_a' } },
      }],
    }
    expect(() => validateFtueConfig(paramConfig, adapter)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// on_unlock triggers, resume, queue, soft-lock guard
// ─────────────────────────────────────────────────────────────────────────────

describe('on_unlock triggers', () => {
  type UnlockCtx = { didReach: boolean }
  const UNLOCK_SCREEN = 'game'

  function wrapStoreAsApi(store: ReturnType<typeof createFtueStoreInstance>['store']) {
    return {
      getState: () => store.getState(),
      advanceStep: () => store.getState().advanceStep(),
      showStep: (id: string) => store.getState().showStep(id),
      hideCurrentStep: () => store.getState().hideCurrentStep(),
      markStepAutoSkipped: (id: string) => store.getState().markStepAutoSkipped(id),
    }
  }

  function makeUnlockAdapter(opts: {
    knownKeys?: readonly string[]
    unlockedKeys?: Set<string>
  } = {}): FtueAdapter<UnlockCtx> & { _notify: () => void; _emitUnlock: (key: string) => void; analytics: Array<{ event: string; payload: Record<string, unknown> }> } {
    const ctx: UnlockCtx = { didReach: false }
    const subs: Array<() => void> = []
    const unlockSubs: Array<(key: string) => void> = []
    const analytics: Array<{ event: string; payload: Record<string, unknown> }> = []
    const unlocked = opts.unlockedKeys ?? new Set<string>()
    return {
      conditions: { always: () => true, never: () => false, manual: () => false },
      getContext: () => ctx,
      subscribe: (cb) => {
        subs.push(cb)
        return () => {
          const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1)
        }
      },
      subscribeUnlock: (cb) => {
        unlockSubs.push(cb)
        return () => {
          const i = unlockSubs.indexOf(cb); if (i >= 0) unlockSubs.splice(i, 1)
        }
      },
      isFeatureUnlocked: (key) => unlocked.has(key),
      getKnownUnlockKeys: opts.knownKeys ? () => opts.knownKeys! : undefined,
      emitAnalytics: (event, payload) => { analytics.push({ event, payload }) },
      isNewPlayer: () => ({ isLoaded: true, isNewPlayer: true }),
      hints: [],
      getRound: () => 1,
      analytics,
      _notify: () => subs.forEach(cb => cb()),
      _emitUnlock: (key) => {
        unlocked.add(key)
        unlockSubs.forEach(cb => cb(key))
      },
    } as unknown as FtueAdapter<UnlockCtx> & { _notify: () => void; _emitUnlock: (key: string) => void; analytics: Array<{ event: string; payload: Record<string, unknown> }> }
  }

  const unlockConfig = (): FtueConfig => ({
    kitScreen: UNLOCK_SCREEN,
    phases: [
      { id: 'core', mode: 'linear', completesWhen: 'all_non_stub' },
      { id: 'outer', mode: 'contextual', completesWhen: 'all_non_stub' },
    ],
    steps: [
      {
        id: 'core-1', phase: 'core', spotlight: '[data-ftue="start"]',
        message: 'Start', completion: { type: 'always' },
      },
      {
        id: 'shop-tutorial', phase: 'outer', spotlight: '[data-ftue="shop-open"]',
        message: 'Shop here', completion: { type: 'manual' },
        featureKey: 'shop',
        trigger: { mode: 'on_unlock', featureKey: 'shop', priority: 1 },
      },
      {
        id: 'craft-tutorial', phase: 'outer', spotlight: '[data-ftue="craft-open"]',
        message: 'Craft here', completion: { type: 'manual' },
        featureKey: 'crafting',
        trigger: { mode: 'on_unlock', featureKey: 'crafting', priority: 0 },
      },
    ],
  })

  it('validateFtueConfig rejects on_unlock featureKey not in known set', () => {
    const bad: FtueConfig = {
      kitScreen: UNLOCK_SCREEN,
      phases: [{ id: 'core', mode: 'linear', completesWhen: 'all_non_stub' }],
      steps: [
        { id: 'x', phase: 'core', spotlight: null, message: 'X', completion: { type: 'always' } },
        { id: 'bad', phase: 'core', spotlight: '[data-ftue="y"]', message: 'Y', completion: { type: 'manual' },
          featureKey: 'ghost', trigger: { mode: 'on_unlock', featureKey: 'ghost' } },
      ],
    }
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'] })
    expect(() => validateFtueConfig(bad, adapter)).toThrow(/not declared in the game's progressive-unlocks gates/)
  })

  it('validateFtueConfig rejects on_unlock without adapter.subscribeUnlock', () => {
    const cfg = unlockConfig()
    const noSubAdapter: FtueAdapter<UnlockCtx> = {
      conditions: { always: () => true, never: () => false, manual: () => false },
      getContext: () => ({ didReach: false }),
      subscribe: () => () => {},
      isNewPlayer: () => ({ isLoaded: true, isNewPlayer: true }),
      hints: [],
      getRound: () => 1,
    }
    expect(() => validateFtueConfig(cfg, noSubAdapter)).toThrow(/does not implement subscribeUnlock/)
  })

  // Helper: initialize + advance past the core phase so we're sitting in the
  // `outer` contextual phase with core-1 completed and no active step.
  async function primeOuterPhase(store: ReturnType<typeof createFtueStoreInstance>['store'], cfg: FtueConfig, adapter: FtueAdapter<UnlockCtx>) {
    await store.getState().initialize(cfg, adapter)
    store.getState().startFtue(UNLOCK_SCREEN)
    // Completing core-1 (only linear step) transitions us to outer phase
    store.getState().completeCurrentStep()
    expect(store.getState().currentPhase).toBe('outer')
    expect(store.getState().isActive).toBe(false)
  }

  it('fires matching step on unlock event when spotlight is ready', async () => {
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'] })
    const cfg = unlockConfig()
    const { store } = createFtueStoreInstance()
    await primeOuterPhase(store, cfg, adapter)
    const runner = createConditionRunner(cfg, adapter, wrapStoreAsApi(store), {
      isSpotlightReady: (step) => step.id === 'shop-tutorial' || step.id === 'craft-tutorial',
      debounceMs: 0,
    })
    runner.start()
    adapter._emitUnlock('shop')
    expect(store.getState().currentStepId).toBe('shop-tutorial')
    expect(store.getState().isActive).toBe(true)
    runner.stop()
  })

  it('auto-skips a step when spotlight is missing at live unlock fire-time and emits analytics', async () => {
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'] })
    const cfg = unlockConfig()
    const { store } = createFtueStoreInstance()
    await primeOuterPhase(store, cfg, adapter)
    const runner = createConditionRunner(cfg, adapter, wrapStoreAsApi(store), {
      isSpotlightReady: () => false,
      debounceMs: 0,
    })
    runner.start()
    adapter._emitUnlock('shop')

    expect(store.getState().currentStepId).toBeNull()
    expect(store.getState().completedSteps.has('shop-tutorial')).toBe(true)
    expect(adapter.analytics.some(a =>
      a.event === 'ftue_feature_tutorial_skipped_target_missing' &&
      a.payload.feature_key === 'shop' && a.payload.step_id === 'shop-tutorial',
    )).toBe(true)
    runner.stop()
  })

  it('queues simultaneous unlocks in priority then definition order', async () => {
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'] })
    const cfg = unlockConfig()
    const { store } = createFtueStoreInstance()
    await primeOuterPhase(store, cfg, adapter)
    const runner = createConditionRunner(cfg, adapter, wrapStoreAsApi(store), {
      isSpotlightReady: () => true,
      debounceMs: 0,
    })
    runner.start()
    adapter._emitUnlock('shop')
    adapter._emitUnlock('crafting')
    expect(store.getState().currentStepId).toBe('shop-tutorial')
    // Complete the active step; the runner drains the queue on next state change.
    store.getState().completeCurrentStep()
    adapter._notify()
    expect(store.getState().currentStepId).toBe('craft-tutorial')
    runner.stop()
  })

  it('resume-on-init queues already-unlocked steps for fire on next spotlight-ready state change', async () => {
    const unlocked = new Set<string>(['shop'])
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'], unlockedKeys: unlocked })
    const cfg = unlockConfig()
    const { store } = createFtueStoreInstance()
    await primeOuterPhase(store, cfg, adapter)
    let spotlightReady = false
    const runner = createConditionRunner(cfg, adapter, wrapStoreAsApi(store), {
      isSpotlightReady: () => spotlightReady,
      debounceMs: 0,
    })
    runner.start()
    // Spotlight not ready → queued, not skipped
    expect(store.getState().currentStepId).toBeNull()
    expect(store.getState().completedSteps.has('shop-tutorial')).toBe(false)
    // Spotlight becomes ready (screen mount); next state change fires it
    spotlightReady = true
    adapter._notify()
    expect(store.getState().currentStepId).toBe('shop-tutorial')
    runner.stop()
  })

  it('markFeatureTutorialComplete marks every step with that featureKey complete; throws on unknown key', async () => {
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'] })
    const cfg = unlockConfig()
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(cfg, adapter)
    store.getState().markFeatureTutorialComplete('shop')
    expect(store.getState().completedSteps.has('shop-tutorial')).toBe(true)
    expect(store.getState().completedSteps.has('craft-tutorial')).toBe(false)
    expect(() => store.getState().markFeatureTutorialComplete('ghost')).toThrow(/no step declares this featureKey/)
  })

  it('isFeatureTutorialComplete returns true only once every step for featureKey is completed', async () => {
    const adapter = makeUnlockAdapter({ knownKeys: ['shop', 'crafting'] })
    const cfg = unlockConfig()
    const { store } = createFtueStoreInstance()
    await store.getState().initialize(cfg, adapter)
    // Before any tutorial is complete
    expect(store.getState().isFeatureTutorialComplete('shop')).toBe(false)
    expect(store.getState().isFeatureTutorialComplete('crafting')).toBe(false)
    // Complete the shop tutorial
    store.getState().markStepAutoSkipped('shop-tutorial')
    expect(store.getState().isFeatureTutorialComplete('shop')).toBe(true)
    expect(store.getState().isFeatureTutorialComplete('crafting')).toBe(false)
    // Unknown featureKey
    expect(store.getState().isFeatureTutorialComplete('ghost')).toBe(false)
  })
})
