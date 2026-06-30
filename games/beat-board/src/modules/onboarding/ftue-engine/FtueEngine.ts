/**
 * FTUE Engine
 *
 * Core engine: config validation, step graph walker, phase completion,
 * gate resolution, trigger evaluator, and condition runner.
 * Pure functions + thin orchestration. No React, no game imports.
 *
 * Ported from battle_deck ftueEngine.ts — game-specific fields stripped.
 */

import type {
  FtueConfig,
  FtueStepConfig,
  FtuePhaseConfig,
  FtueAdapter,
  FtueTriggerConfig,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Config validation
// ─────────────────────────────────────────────────────────────────────────────

const RESERVED_PHASE_IDS = new Set(['completed', 'skipped'])

export function validateFtueConfig(config: FtueConfig, adapter: FtueAdapter): void {
  const errors: string[] = []

  for (const phase of config.phases) {
    if (RESERVED_PHASE_IDS.has(phase.id)) {
      errors.push(`Phase ID "${phase.id}" is reserved (sentinel value)`)
    }
  }

  const phaseIds = new Set(config.phases.map(p => p.id))
  const stepIds = new Set<string>()
  const gateNames = new Set<string>()

  for (const step of config.steps) {
    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: "${step.id}"`)
    }
    stepIds.add(step.id)

    if (!phaseIds.has(step.phase)) {
      errors.push(`Step "${step.id}" references unknown phase "${step.phase}"`)
    }

    if (step.completion.type === 'event') {
      // Event-driven completion — the game advances this step by calling
      // `ftueStore.notifyEvent(params.eventName)`. No adapter condition is
      // needed; instead, `params.eventName` must be a non-empty string.
      const eventName = step.completion.params?.['eventName']
      if (typeof eventName !== 'string' || eventName.length === 0) {
        errors.push(
          `Step "${step.id}" has completion.type "event" but is missing a non-empty params.eventName`,
        )
      }
    } else if (step.completion.type === 'tap_target') {
      // Tap-target completion — the overlay calls completeCurrentStep when
      // the spotlight is clicked. No adapter condition needed.
    } else if (step.completion.type !== 'manual' && !(step.completion.type in adapter.conditions)) {
      errors.push(`Step "${step.id}" completion type "${step.completion.type}" not registered in adapter`)
    }

    const triggers = normalizeTriggers(step.trigger)
    for (const trigger of triggers) {
      if (trigger.condition && !(trigger.condition in adapter.conditions)) {
        errors.push(`Step "${step.id}" trigger condition "${trigger.condition}" not registered in adapter`)
      }
      if (trigger.mode === 'on_unlock') {
        if (!trigger.featureKey) {
          errors.push(`Step "${step.id}" on_unlock trigger is missing featureKey`)
        } else if (adapter.getKnownUnlockKeys) {
          const known = adapter.getKnownUnlockKeys()
          if (!known.includes(trigger.featureKey)) {
            errors.push(
              `Step "${step.id}" on_unlock featureKey "${trigger.featureKey}" is not declared in the game's progressive-unlocks gates. ` +
              `Known gates: [${known.join(', ')}]`,
            )
          }
        }
      }
    }

    if (step.next !== undefined && step.next !== null) {
      if (typeof step.next === 'string') {
        if (!config.steps.some(s => s.id === step.next)) {
          errors.push(`Step "${step.id}" references unknown next step "${step.next}"`)
        }
      } else if (typeof step.next === 'object') {
        if (!config.steps.some(s => s.id === (step.next as { step: string }).step)) {
          errors.push(`Step "${step.id}" references unknown conditional next step "${(step.next as { step: string }).step}"`)
        }
        if (!((step.next as { condition: string }).condition in adapter.conditions)) {
          errors.push(`Step "${step.id}" next condition "${(step.next as { condition: string }).condition}" not registered in adapter`)
        }
      }
    }

    if (step.guard && !(step.guard in adapter.conditions)) {
      errors.push(`Step "${step.id}" guard condition "${step.guard}" not registered in adapter`)
    }

    if (step.hint && !adapter.hints.includes(step.hint)) {
      errors.push(`Step "${step.id}" hint "${step.hint}" not in adapter's hint palette`)
    }

    if (step.gates) {
      for (const gate of step.gates) {
        if (gateNames.has(gate.name)) {
          errors.push(`Duplicate gate name: "${gate.name}" (step "${step.id}")`)
        }
        gateNames.add(gate.name)
      }
    }
  }

  // Cycle detection in next chains
  for (const step of config.steps) {
    const visited = new Set<string>()
    let current: string | null = step.id
    while (current) {
      if (visited.has(current)) {
        errors.push(`Cycle detected in next chain starting from "${step.id}"`)
        break
      }
      visited.add(current)
      const s = config.steps.find(x => x.id === current)
      if (!s) break
      if (s.next === undefined || s.next === null) break
      if (typeof s.next === 'string') {
        current = s.next
      } else if (typeof s.next === 'object') {
        current = s.next.step
      } else {
        break
      }
    }
  }

  // kitScreen is required when any phase is linear
  const hasLinearPhase = config.phases.some(p => p.mode === 'linear')
  if (hasLinearPhase && !config.kitScreen) {
    errors.push('Config has linear phase(s) but no kitScreen. Set kitScreen to the tab/screen the user must be on when startFtue() is called.')
  }

  // Every linear phase must declare at least one step. Without this,
  // startFtue() silently sets currentStepId=null and the engine never
  // advances — exactly the failure mode tiny-realms hit (post-mortem
  // 2026-04-18 #5: "phase=linear, step=null, never advances").
  for (const phase of config.phases) {
    if (phase.mode !== 'linear') continue
    const stepsForPhase = config.steps.filter(s => s.phase === phase.id)
    if (stepsForPhase.length === 0) {
      errors.push(
        `Linear phase "${phase.id}" has no steps. startFtue() would set ` +
        `currentStepId=null and the engine would never advance. Add at ` +
        `least one step with phase: "${phase.id}".`,
      )
    }
  }

  // alwaysShowSkip defaults to true — skip must be available from step 0
  if (config.alwaysShowSkip === false) {
    errors.push(
      'alwaysShowSkip is false — users can get trapped in the tutorial. ' +
      'Remove this or set to true. The skip button must be visible from step 0.'
    )
  }

  // Any step using on_unlock requires the adapter to implement subscribeUnlock,
  // otherwise the tutorial can never fire.
  const hasOnUnlockStep = config.steps.some(s =>
    normalizeTriggers(s.trigger).some(t => t.mode === 'on_unlock'),
  )
  if (hasOnUnlockStep && !adapter.subscribeUnlock) {
    errors.push(
      'Config uses on_unlock triggers but adapter does not implement subscribeUnlock(). ' +
      'Wire progressive-unlocks.subscribeUnlock through the FtueAdapter.',
    )
  }

  if (errors.length > 0) {
    throw new Error(`FTUE config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`)
  }
}

/**
 * Whether the skip button should be visible for the current FTUE state.
 * Default: always true (skip from step 0). Config.alwaysShowSkip controls this.
 */
export function shouldShowSkipButton(config: FtueConfig): boolean {
  return config.alwaysShowSkip !== false
}

// ─────────────────────────────────────────────────────────────────────────────
// Step graph
// ─────────────────────────────────────────────────────────────────────────────

export function getStepById(config: FtueConfig, stepId: string): FtueStepConfig | undefined {
  return config.steps.find(s => s.id === stepId)
}

export function getPhaseSteps(config: FtueConfig, phaseId: string): readonly FtueStepConfig[] {
  return config.steps.filter(s => s.phase === phaseId && !s.stub)
}

/**
 * Compute progress through a chain of steps linked by `next` pointers.
 * Walks backward to find the chain root, then forward to count total steps.
 */
export function getChainProgress(
  config: FtueConfig,
  currentStepId: string,
  completedSteps: ReadonlySet<string>,
): { current: number; total: number } | undefined {
  let rootId = currentStepId
  const visited = new Set<string>()
  while (true) {
    visited.add(rootId)
    const parent = config.steps.find(s => {
      if (s.stub || s.id === rootId || visited.has(s.id)) return false
      if (!completedSteps.has(s.id)) return false
      if (typeof s.next === 'string') return s.next === rootId
      if (s.next && typeof s.next === 'object') return s.next.step === rootId
      return false
    })
    if (!parent) break
    rootId = parent.id
  }

  const chain: string[] = []
  let currentId: string | null = rootId
  const forwardVisited = new Set<string>()
  while (currentId) {
    if (forwardVisited.has(currentId)) break
    forwardVisited.add(currentId)
    const step = getStepById(config, currentId)
    if (!step || step.stub) break
    chain.push(currentId)
    if (step.next === undefined || step.next === null) break
    if (typeof step.next === 'string') {
      currentId = step.next
    } else {
      break
    }
  }

  if (chain.length < 2) return undefined
  const idx = chain.indexOf(currentStepId)
  if (idx === -1) return undefined
  return { current: idx + 1, total: chain.length }
}

/**
 * Get the next step after the current one.
 * Handles explicit next, conditional next, and linear progression.
 */
export function getNextStep(
  config: FtueConfig,
  currentStepId: string,
  completedSteps: ReadonlySet<string>,
  evalCondition: (conditionName: string) => boolean,
): FtueStepConfig | undefined {
  const currentStep = getStepById(config, currentStepId)
  if (!currentStep) return undefined

  if (currentStep.next !== undefined) {
    if (currentStep.next === null) return undefined

    if (typeof currentStep.next === 'string') {
      const nextStep = getStepById(config, currentStep.next)
      if (nextStep && !completedSteps.has(nextStep.id) && !nextStep.stub) {
        return nextStep
      }
      return undefined
    }

    if (typeof currentStep.next === 'object') {
      if (evalCondition(currentStep.next.condition)) {
        const nextStep = getStepById(config, currentStep.next.step)
        if (nextStep && !completedSteps.has(nextStep.id) && !nextStep.stub) {
          return nextStep
        }
      }
      return undefined
    }
  }

  // Linear progression within same phase (skip completed, stubs, and triggered steps)
  const currentIndex = config.steps.findIndex(s => s.id === currentStepId)
  if (currentIndex === -1) return undefined

  for (let i = currentIndex + 1; i < config.steps.length; i++) {
    const step = config.steps[i]!
    if (completedSteps.has(step.id)) continue
    if (step.stub) continue
    if (step.phase !== currentStep.phase) continue
    const phase = config.phases.find(p => p.id === step.phase)
    if (phase?.mode === 'contextual' && step.trigger) continue
    return step
  }

  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase completion
// ─────────────────────────────────────────────────────────────────────────────

export function isPhaseComplete(config: FtueConfig, phaseId: string, completedSteps: ReadonlySet<string>): boolean {
  const phase = config.phases.find(p => p.id === phaseId)
  if (!phase || !phase.completesWhen) return false
  const steps = getPhaseSteps(config, phaseId)
  return steps.every(step => completedSteps.has(step.id))
}

export function areRequiredPhasesComplete(config: FtueConfig, completedSteps: ReadonlySet<string>): boolean {
  return config.phases
    .filter(p => p.completesWhen)
    .every(p => isPhaseComplete(config, p.id, completedSteps))
}

export function getNextPhase(config: FtueConfig, currentPhaseId: string): FtuePhaseConfig | undefined {
  const idx = config.phases.findIndex(p => p.id === currentPhaseId)
  if (idx === -1 || idx >= config.phases.length - 1) return undefined
  return config.phases[idx + 1]
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate resolution
// ─────────────────────────────────────────────────────────────────────────────

export function resolveGates(
  config: FtueConfig,
  currentStepId: string | null,
  completedSteps: ReadonlySet<string>,
  ftueStatus: string,
): Set<string> {
  const openGates = new Set<string>()

  // All gates open when FTUE is completed or skipped
  if (ftueStatus === 'completed' || ftueStatus === 'skipped') {
    for (const step of config.steps) {
      if (step.gates) {
        for (const gate of step.gates) {
          openGates.add(gate.name)
        }
      }
    }
    return openGates
  }

  for (const step of config.steps) {
    if (!step.gates) continue
    for (const gate of step.gates) {
      if (gate.opensOn === 'reach') {
        if (step.id === currentStepId || completedSteps.has(step.id)) {
          openGates.add(gate.name)
        }
      } else if (gate.opensOn === 'complete') {
        if (completedSteps.has(step.id)) {
          openGates.add(gate.name)
        }
      }
    }
  }

  return openGates
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger evaluator
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTriggers(trigger?: FtueTriggerConfig | FtueTriggerConfig[]): FtueTriggerConfig[] {
  if (!trigger) return []
  return Array.isArray(trigger) ? trigger : [trigger]
}

export function evaluateRoundEntryTriggers(
  config: FtueConfig,
  round: number,
  completedSteps: ReadonlySet<string>,
  currentStepId: string | null,
  evalCondition: (conditionName: string) => boolean,
): FtueStepConfig | undefined {
  const candidates: Array<{ step: FtueStepConfig; priority: number }> = []

  for (const step of config.steps) {
    if (completedSteps.has(step.id)) continue
    if (step.stub) continue
    if (step.id === currentStepId) continue
    if (step.guard && !evalCondition(step.guard)) continue

    const triggers = normalizeTriggers(step.trigger)
    for (const trigger of triggers) {
      if (trigger.mode !== 'on_round_entry') continue
      const min = trigger.roundMin ?? 0
      const max = trigger.roundMax ?? Infinity
      if (round < min || round > max) continue
      if (trigger.condition && !evalCondition(trigger.condition)) continue

      candidates.push({ step, priority: trigger.priority ?? 0 })
      break
    }
  }

  candidates.sort((a, b) => b.priority - a.priority)
  return candidates[0]?.step
}

/**
 * Return the highest-priority step eligible to fire for an on_unlock trigger matching
 * `featureKey`. Sorts by trigger priority (desc), then by definition order (asc) to
 * produce deterministic behavior when multiple steps target the same featureKey or
 * when several features unlock in the same tick. Returns undefined if no step matches.
 *
 * `featureKey` may be `null` to query the full set of on_unlock steps currently
 * eligible given `isFeatureUnlocked` (used for resume-on-init).
 */
export function evaluateOnUnlockTriggers(
  config: FtueConfig,
  completedSteps: ReadonlySet<string>,
  currentStepId: string | null,
  isFeatureUnlocked: (key: string) => boolean,
  featureKey: string | null,
): FtueStepConfig[] {
  const candidates: Array<{ step: FtueStepConfig; priority: number; index: number }> = []

  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i]!
    if (completedSteps.has(step.id)) continue
    if (step.stub) continue
    if (step.id === currentStepId) continue

    const triggers = normalizeTriggers(step.trigger)
    for (const trigger of triggers) {
      if (trigger.mode !== 'on_unlock') continue
      if (!trigger.featureKey) continue
      if (featureKey !== null && trigger.featureKey !== featureKey) continue
      if (featureKey === null && !isFeatureUnlocked(trigger.featureKey)) continue
      candidates.push({ step, priority: trigger.priority ?? 0, index: i })
      break
    }
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.index - b.index
  })
  return candidates.map(c => c.step)
}

export function evaluateOngoingTriggers(
  config: FtueConfig,
  completedSteps: ReadonlySet<string>,
  currentStepId: string | null,
  evalCondition: (conditionName: string) => boolean,
  round: number,
): FtueStepConfig | undefined {
  const candidates: Array<{ step: FtueStepConfig; priority: number }> = []

  for (const step of config.steps) {
    if (completedSteps.has(step.id)) continue
    if (step.stub) continue
    if (step.id === currentStepId) continue
    if (step.guard && !evalCondition(step.guard)) continue

    const triggers = normalizeTriggers(step.trigger)
    for (const trigger of triggers) {
      if (trigger.mode !== 'ongoing') continue
      const min = trigger.roundMin ?? 0
      const max = trigger.roundMax ?? Infinity
      if (round < min || round > max) continue
      if (trigger.condition && !evalCondition(trigger.condition)) continue

      candidates.push({ step, priority: trigger.priority ?? 0 })
      break
    }
  }

  candidates.sort((a, b) => b.priority - a.priority)
  return candidates[0]?.step
}

// ─────────────────────────────────────────────────────────────────────────────
// Condition runner
// ─────────────────────────────────────────────────────────────────────────────

interface FtueStoreAPI {
  getState: () => {
    currentStepId: string | null
    currentPhase: string
    completedSteps: ReadonlySet<string>
    isActive: boolean
    isStepHidden: boolean
  }
  advanceStep: () => void
  showStep: (stepId: string) => void
  hideCurrentStep: () => void
  /** Optional — present on stores returned by createFtueStoreInstance. Used by the
   * on_unlock runner to auto-skip steps whose spotlight is missing at fire-time. */
  markStepAutoSkipped?: (stepId: string) => void
}

export interface ConditionRunner {
  start: () => void
  stop: () => void
}

export interface ConditionRunnerOptions {
  /** Gate function controlling when triggers are evaluated. Default: () => true */
  shouldEvaluateTriggers?: (ctx: unknown) => boolean
  /** Whether to track round-based trigger dedup. Default: true */
  useRoundTracking?: boolean
  /** Debounce interval in ms for trigger evaluation. Default: 300 */
  debounceMs?: number
  /**
   * Check whether a step's spotlight target is present in the DOM.
   * Default: checks document.querySelector(step.spotlight).
   * When a step is active but its spotlight target is missing, the runner
   * hides the step and re-shows it when the target appears.
   */
  isSpotlightReady?: (step: FtueStepConfig) => boolean
}

function defaultIsSpotlightReady(step: FtueStepConfig): boolean {
  if (!step.spotlight) return true
  if (typeof document === 'undefined') return true
  return document.querySelectorAll(step.spotlight).length > 0
}

export function createConditionRunner(
  config: FtueConfig,
  adapter: FtueAdapter,
  store: FtueStoreAPI,
  options?: ConditionRunnerOptions,
): ConditionRunner {
  let unsubscribe: (() => void) | null = null
  let unsubscribeUnlock: (() => void) | null = null
  let prevCtx: unknown = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let postAdvanceRafHandle: number | null = null
  const lastTriggeredRound = new Set<number>()
  const pendingUnlockSteps = new Set<string>()

  const shouldEvaluate = options?.shouldEvaluateTriggers ?? (() => true)
  const useRoundTracking = options?.useRoundTracking !== false
  const debounceMs = options?.debounceMs ?? 300
  const isSpotlightReady = options?.isSpotlightReady ?? defaultIsSpotlightReady

  function schedulePostAdvanceReTick(): void {
    if (typeof requestAnimationFrame === 'undefined') return
    if (postAdvanceRafHandle !== null) return
    postAdvanceRafHandle = requestAnimationFrame(() => {
      postAdvanceRafHandle = null
      onStateChange()
    })
  }

  function evalCondition(conditionName: string): boolean {
    const evaluator = adapter.conditions[conditionName]
    if (!evaluator) return false
    const ctx = adapter.getContext()
    return evaluator(ctx, {}, prevCtx)
  }

  function onStateChange(): void {
    const state = store.getState()
    const ctx = adapter.getContext()
    const round = adapter.getRound()

    if (useRoundTracking && round === 1) {
      lastTriggeredRound.clear()
    }

    if (state.currentPhase === 'completed' || state.currentPhase === 'skipped') {
      prevCtx = ctx
      return
    }

    // Check active step
    if (state.isActive && state.currentStepId) {
      const step = getStepById(config, state.currentStepId)

      // Spotlight guard: hide step if its target element is not in the DOM
      if (step && !isSpotlightReady(step)) {
        if (!state.isStepHidden) {
          store.hideCurrentStep()
        }
        prevCtx = ctx
        return
      }

      // Spotlight target appeared — un-hide the step
      if (step && state.isStepHidden && isSpotlightReady(step)) {
        store.showStep(state.currentStepId)
        prevCtx = ctx
        return
      }

      // Auto-complete check. Skip `'manual'` (UI dismiss handler advances),
      // `'event'` (game code calls `notifyEvent` at the trigger moment), and
      // `'tap_target'` (overlay click handler advances). All other types are
      // adapter-registered conditions, polled here.
      const runnerSkipTypes = new Set(['manual', 'event', 'tap_target'])
      if (step && !runnerSkipTypes.has(step.completion.type)) {
        const evaluator = adapter.conditions[step.completion.type]
        if (evaluator) {
        const params = step.completion.params ?? {}
        if (evaluator(ctx, params, prevCtx)) {
          prevCtx = ctx
          store.advanceStep()
          schedulePostAdvanceReTick()
          return
        }
      }
      }
    }

    // On_unlock runner: try to fire the highest-priority pending unlock step.
    // Eligible when FTUE is not currently showing a step AND at least one queued
    // step's spotlight is ready. Leaves remaining steps queued for later state
    // changes (R2 resume-on-mount semantics).
    if (!state.isActive && pendingUnlockSteps.size > 0) {
      const eligible = [...pendingUnlockSteps]
        .map((id) => {
          const step = getStepById(config, id)
          const index = config.steps.findIndex((s) => s.id === id)
          return { id, step, index }
        })
        .filter((e): e is { id: string; step: FtueStepConfig; index: number } =>
          !!e.step && !state.completedSteps.has(e.id),
        )
        .sort((a, b) => {
          const aPri = onUnlockPriority(a.step)
          const bPri = onUnlockPriority(b.step)
          if (aPri !== bPri) return bPri - aPri
          return a.index - b.index
        })

      // Prune any step that is already completed (defensive)
      for (const id of pendingUnlockSteps) {
        if (state.completedSteps.has(id)) pendingUnlockSteps.delete(id)
      }

      const top = eligible[0]
      if (top && isSpotlightReady(top.step)) {
        pendingUnlockSteps.delete(top.id)
        store.showStep(top.id)
        prevCtx = ctx
        return
      }
      // else: wait for next state change (spotlight not ready yet)
    }

    // Check contextual triggers and guarded linear steps
    if (!state.isActive) {
      const phase = config.phases.find(p => p.id === state.currentPhase)
      const canEvaluate = shouldEvaluate(ctx)

      if (phase?.mode === 'contextual' && canEvaluate) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          const freshState = store.getState()
          if (freshState.isActive) return

          const currentRound = adapter.getRound()

          if (useRoundTracking && !lastTriggeredRound.has(currentRound)) {
            const roundStep = evaluateRoundEntryTriggers(
              config, currentRound, freshState.completedSteps,
              freshState.currentStepId, evalCondition,
            )
            if (roundStep) {
              lastTriggeredRound.add(currentRound)
              store.showStep(roundStep.id)
              prevCtx = ctx
              return
            }
          }

          const ongoingStep = evaluateOngoingTriggers(
            config, freshState.completedSteps,
            freshState.currentStepId, evalCondition, currentRound,
          )
          if (ongoingStep) {
            store.showStep(ongoingStep.id)
          }
        }, debounceMs)
      } else if (phase?.mode === 'linear' && canEvaluate) {
        const steps = getPhaseSteps(config, phase.id)
        const nextStep = steps.find(s => !state.completedSteps.has(s.id))
        if (nextStep?.guard) {
          const evaluator = adapter.conditions[nextStep.guard]
          if (evaluator && evaluator(ctx, {}, prevCtx)) {
            store.showStep(nextStep.id)
          }
        }
      }
    }

    prevCtx = ctx
  }

  function onUnlockEvent(featureKey: string): void {
    const state = store.getState()
    const matching = evaluateOnUnlockTriggers(
      config,
      state.completedSteps,
      state.currentStepId,
      () => true, // we're responding to a specific unlock event; isFeatureUnlocked gate is implicit
      featureKey,
    )
    if (matching.length === 0) return

    if (state.isActive) {
      // Queue behind the currently-active step; onStateChange will drain the queue.
      for (const step of matching) pendingUnlockSteps.add(step.id)
      return
    }

    // Try to fire the highest-priority eligible step immediately. If spotlight is
    // missing at fire-time (R4 soft-lock guard), auto-skip and emit analytics;
    // otherwise fire. Remaining steps queue behind the active one.
    const top = matching[0]!
    if (isSpotlightReady(top)) {
      store.showStep(top.id)
      for (let i = 1; i < matching.length; i++) pendingUnlockSteps.add(matching[i]!.id)
    } else {
      if (store.markStepAutoSkipped) {
        store.markStepAutoSkipped(top.id)
      }
      adapter.emitAnalytics?.('ftue_feature_tutorial_skipped_target_missing', {
        feature_key: top.featureKey ?? featureKey,
        step_id: top.id,
      })
      // Remaining same-feature steps queue for next state change.
      for (let i = 1; i < matching.length; i++) pendingUnlockSteps.add(matching[i]!.id)
    }
  }

  return {
    start() {
      prevCtx = adapter.getContext()

      // Resume-on-init (R2): any on_unlock step whose featureKey is already
      // unlocked and whose step hasn't completed enters the pending queue. It
      // fires when the screen containing its spotlight next mounts (detected
      // via the existing state-change loop).
      const initialState = store.getState()
      if (adapter.isFeatureUnlocked) {
        const resumeSteps = evaluateOnUnlockTriggers(
          config,
          initialState.completedSteps,
          initialState.currentStepId,
          adapter.isFeatureUnlocked,
          null,
        )
        for (const step of resumeSteps) pendingUnlockSteps.add(step.id)
      }

      unsubscribe = adapter.subscribe(onStateChange)
      if (adapter.subscribeUnlock) {
        unsubscribeUnlock = adapter.subscribeUnlock(onUnlockEvent)
      }
      onStateChange()
    },
    stop() {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (unsubscribeUnlock) {
        unsubscribeUnlock()
        unsubscribeUnlock = null
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      if (postAdvanceRafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(postAdvanceRafHandle)
        postAdvanceRafHandle = null
      }
      lastTriggeredRound.clear()
      pendingUnlockSteps.clear()
      prevCtx = null
    },
  }
}

function onUnlockPriority(step: FtueStepConfig): number {
  if (!step.trigger) return 0
  const triggers = Array.isArray(step.trigger) ? step.trigger : [step.trigger]
  for (const t of triggers) {
    if (t.mode === 'on_unlock' && t.priority !== undefined) return t.priority
  }
  return 0
}
