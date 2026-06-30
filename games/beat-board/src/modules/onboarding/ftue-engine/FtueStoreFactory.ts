/**
 * FTUE Store Factory
 *
 * Creates independent FTUE store instances. Each instance has its own
 * config, adapter, and persisted state — enabling multiple FTUE systems
 * to run side by side.
 *
 * Ported from battle_deck ftueStoreFactory.ts — game-specific fields stripped.
 */

import { create } from 'zustand'
import type { UseBoundStore, StoreApi } from 'zustand'
import type {
  FtueStore,
  FtueConfig,
  FtueAdapter,
  FtuePersistence,
} from './types'
import {
  validateFtueConfig,
  getPhaseSteps,
  getNextStep,
  getStepById,
  isPhaseComplete,
  areRequiredPhasesComplete,
  getNextPhase,
  resolveGates,
} from './FtueEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Factory types
// ─────────────────────────────────────────────────────────────────────────────

export interface ModalSuppressor {
  suppress: () => void
  unsuppress: () => void
}

export interface FtueStoreFactoryOptions {
  onStarted?: () => void
  onStepCompleted?: (stepId: string) => void
  onPhaseCompleted?: (phaseId: string, stepsCompleted: number) => void
  onSkipped?: (phaseId: string, stepsCompleted: number) => void
  onCompleted?: () => void
  persistence?: FtuePersistence
  /**
   * When provided, FTUE automatically suppresses modals on start and
   * unsuppresses on complete/skip. Pass `useModalStore.getState()` or
   * any object with `suppress()` and `unsuppress()`.
   */
  modalSuppressor?: ModalSuppressor
}

export interface FtueStoreInstance {
  store: UseBoundStore<StoreApi<FtueStore>>
  getConfig: () => FtueConfig | null
  getAdapter: () => FtueAdapter | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createFtueStoreInstance(options?: FtueStoreFactoryOptions): FtueStoreInstance {
  let _config: FtueConfig | null = null
  let _adapter: FtueAdapter | null = null

  const getConfig = (): FtueConfig | null => _config
  const getAdapter = (): FtueAdapter | null => _adapter

  const store = create<FtueStore>((set, get) => {
    const _updateGates = (): void => {
      if (!_config) return
      const s = get()
      const gates = resolveGates(_config, s.currentStepId, s.completedSteps, s.currentPhase)
      set({ openGates: gates })
    }

    const _persist = (): void => {
      if (!_config?.storageKey || !options?.persistence) return
      const s = get()
      options.persistence.save(_config.storageKey, {
        currentPhase: s.currentPhase,
        currentStepId: s.currentStepId,
        completedSteps: Array.from(s.completedSteps),
        openGates: Array.from(s.openGates),
        isActive: s.isActive,
      })
    }

    const _evalCondition = (conditionName: string): boolean => {
      if (!_adapter) return false
      const evaluator = _adapter.conditions[conditionName]
      if (!evaluator) return false
      const ctx = _adapter.getContext()
      return evaluator(ctx, {}, null)
    }

    return {
      // Initial state
      currentPhase: '',
      currentStepId: null,
      completedSteps: new Set<string>(),
      openGates: new Set<string>(),
      isActive: false,
      isStepHidden: false,
      isInitialized: false,

      initialize: async (config: FtueConfig, adapter: FtueAdapter) => {
        const state = get()
        if (state.isInitialized) return

        validateFtueConfig(config, adapter)

        // Runtime wiring audit — throw if adapter is missing completion handlers.
        // This fires at init, not at step-advance, so builders see it immediately.
        // Event-driven, manual, and tap_target steps do not route through
        // `adapter.conditions` at all, so they are exempt from this audit.
        const runnerSkipTypes = new Set(['manual', 'event', 'tap_target'])
        const missingConditions: string[] = []
        for (const step of config.steps) {
          if (runnerSkipTypes.has(step.completion.type)) continue
          if (!(step.completion.type in adapter.conditions)) {
            missingConditions.push(`step "${step.id}": completion type "${step.completion.type}"`)
          }
        }
        if (missingConditions.length > 0) {
          throw new Error(
            `FTUE adapter is missing condition handlers for ${missingConditions.length} step(s):\n` +
            missingConditions.map(m => `  - ${m}`).join('\n') + '\n' +
            'Wire ALL completion conditions in your FtueAdapter before calling initialize().'
          )
        }

        _config = config
        _adapter = adapter

        // Try to restore persisted state
        if (config.storageKey && options?.persistence) {
          const persisted = await options.persistence.load(config.storageKey)

          if (persisted) {
            const phase = persisted.currentPhase ?? config.phases[0]?.id ?? ''
            const completed = new Set(persisted.completedSteps ?? [])
            const gates = new Set(persisted.openGates ?? [])

            if (phase === 'completed' || phase === 'skipped') {
              set({
                currentPhase: phase,
                currentStepId: null,
                completedSteps: completed,
                openGates: gates,
                isInitialized: true,
              })
              return
            }

            // If a step was active when we persisted, deactivate and let
            // condition runner re-trigger it
            if (persisted.currentStepId && persisted.isActive) {
              set({
                currentPhase: phase,
                currentStepId: null,
                completedSteps: completed,
                openGates: gates,
                isActive: false,
                isInitialized: true,
              })
              _persist()
              return
            }

            if (completed.size > 0) {
              set({
                currentPhase: phase,
                currentStepId: persisted.currentStepId ?? null,
                completedSteps: completed,
                openGates: gates,
                isActive: persisted.isActive ?? false,
                isInitialized: true,
              })
              return
            }
          }
        }

        const { isLoaded, isNewPlayer } = adapter.isNewPlayer()

        if (!isLoaded) {
          _config = null
          _adapter = null
          return
        }

        if (!isNewPlayer) {
          set({
            isInitialized: true,
            currentPhase: 'completed',
            currentStepId: null,
            isActive: false,
          })
          _persist()
          return
        }

        const firstPhaseId = config.phases[0]?.id ?? ''
        set({ isInitialized: true, currentPhase: firstPhaseId })
      },

      startFtue: (currentScreen: string) => {
        if (!_config) return

        const state = get()

        // Terminal-safety: never re-activate a finished or skipped flow.
        // Re-anchoring a completed FTUE re-mounts the overlay on top of normal
        // gameplay and re-disables project gates.
        if (state.currentPhase === 'completed' || state.currentPhase === 'skipped') {
          return
        }

        // Refuse to start if caller is on the wrong screen
        if (_config.kitScreen && currentScreen !== _config.kitScreen) {
          return
        }

        const linearPhase = _config.phases.find(p => p.mode === 'linear')
        if (!linearPhase) return

        const steps = getPhaseSteps(_config, linearPhase.id)
        const firstStep = steps[0]
        if (!firstStep) {
          // Belt-and-suspenders against config that bypasses the validator
          // (e.g., dynamic step removal at runtime). validateFtueConfig
          // rejects this at init, but throw here too so a fresh-session
          // FTUE never ends up in the silent isActive=true,currentStepId=null
          // state observed in tiny-realms (post-mortem 2026-04-18 #5).
          throw new Error(
            `[ftue-engine] startFtue: linear phase "${linearPhase.id}" has ` +
            `no steps. Cannot start the tutorial. Add at least one step ` +
            `with phase: "${linearPhase.id}".`,
          )
        }

        // Resume at the first step the player hasn't finished yet — NOT
        // unconditionally at step 0. A returning player whose progress
        // persisted (but whose phase never advanced to 'completed') would
        // otherwise be re-anchored onto an already-completed step. The engine
        // suppresses that step's spotlight (isStepHidden), so the overlay
        // renders nothing while project gates (e.g. the tab bar) stay
        // disabled off the step id — a silent lockout.
        const firstIncompleteStep = steps.find(s => !state.completedSteps.has(s.id))
        if (!firstIncompleteStep) {
          // Every linear step is already done. If all required phases are
          // complete, finalize so downstream gates open and the overlay stays
          // dormant. Don't re-emit onStarted/onCompleted — completion happened
          // in a prior session and re-emitting would log bogus analytics.
          if (areRequiredPhasesComplete(_config, state.completedSteps)) {
            set({
              currentPhase: 'completed',
              currentStepId: null,
              isActive: false,
              isStepHidden: false,
            })
            _updateGates()
            _persist()
          }
          return
        }
        const stepId = firstIncompleteStep.id

        options?.modalSuppressor?.suppress()
        options?.onStarted?.()

        set({
          currentPhase: linearPhase.id,
          currentStepId: stepId,
          isActive: true,
          isStepHidden: false,
        })

        _updateGates()
        _persist()
      },

      advanceStep: () => {
        if (!_config) return
        const state = get()
        if (!state.isActive || !state.currentStepId) return

        options?.onStepCompleted?.(state.currentStepId)

        const newCompletedSteps = new Set(state.completedSteps)
        newCompletedSteps.add(state.currentStepId)

        let nextStep = getNextStep(_config, state.currentStepId, newCompletedSteps, _evalCondition)
        while (nextStep?.stub) {
          newCompletedSteps.add(nextStep.id)
          nextStep = getNextStep(_config, nextStep.id, newCompletedSteps, _evalCondition)
        }

        if (nextStep) {
          if (nextStep.guard && _adapter) {
            const evaluator = _adapter.conditions[nextStep.guard]
            if (evaluator && !evaluator(_adapter.getContext(), {}, null)) {
              set({
                currentStepId: null,
                completedSteps: newCompletedSteps,
                isActive: false,
                isStepHidden: false,
              })
              _updateGates()
              _persist()
              return
            }
          }

          if (nextStep.phase !== state.currentPhase) {
            options?.onPhaseCompleted?.(state.currentPhase, newCompletedSteps.size)
          }

          set({
            currentStepId: nextStep.id,
            currentPhase: nextStep.phase,
            completedSteps: newCompletedSteps,
            isStepHidden: false,
          })
          _updateGates()
          _persist()
          return
        }

        const currentPhase = _config.phases.find(p => p.id === state.currentPhase)

        if (currentPhase && isPhaseComplete(_config, currentPhase.id, newCompletedSteps)) {
          options?.onPhaseCompleted?.(currentPhase.id, newCompletedSteps.size)

          // Transition to next phase first — only mark completed if no more phases
          const next = getNextPhase(_config, currentPhase.id)
          if (next) {
            set({
              currentStepId: null,
              currentPhase: next.id,
              isActive: false,
              completedSteps: newCompletedSteps,
            })
            _updateGates()
            _persist()
            return
          }

          if (areRequiredPhasesComplete(_config, newCompletedSteps)) {
            options?.modalSuppressor?.unsuppress()
            options?.onCompleted?.()
            set({
              currentStepId: null,
              currentPhase: 'completed',
              isActive: false,
              completedSteps: newCompletedSteps,
            })
            _updateGates()
            _persist()
            return
          }
        }

        set({
          currentStepId: null,
          isActive: false,
          completedSteps: newCompletedSteps,
        })

        if (areRequiredPhasesComplete(_config, newCompletedSteps)) {
          options?.modalSuppressor?.unsuppress()
          options?.onCompleted?.()
          set({ currentPhase: 'completed' })
        }

        _updateGates()
        _persist()
      },

      completeCurrentStep: () => {
        get().advanceStep()
      },

      notifyEvent: (name: string) => {
        // Event-driven completion: if the current step is waiting on
        // `name` (completion.type === 'event' + params.eventName === name),
        // route through advanceStep — which itself bails with
        // `if (!state.isActive || !state.currentStepId) return` so the
        // call is terminal-safe after skipAll / flow completion. The
        // canonical anti-pattern is hand-rolling
        // `notifyX()` / `notifyY()` setters with no terminal guard; this
        // primitive replaces that class of code and forces discrete-event
        // flows through the module's existing safety.
        if (!_config) return
        const state = get()
        if (!state.isActive || !state.currentStepId) return
        const step = getStepById(_config, state.currentStepId)
        if (!step) return
        if (step.completion.type !== 'event') return
        const expected = step.completion.params?.['eventName']
        if (typeof expected !== 'string' || expected.length === 0) return
        if (expected !== name) return
        get().advanceStep()
      },

      skipAll: () => {
        const state = get()
        options?.modalSuppressor?.unsuppress()
        options?.onSkipped?.(state.currentPhase, state.completedSteps.size)

        set({
          currentStepId: null,
          currentPhase: 'skipped',
          isActive: false,
          isStepHidden: false,
        })
        _updateGates()
        _persist()
      },

      reset: () => {
        if (_config?.storageKey && options?.persistence?.remove) {
          options.persistence.remove(_config.storageKey)
        }
        _adapter?.resetState?.()
        _config = null
        _adapter = null

        set({
          currentPhase: '',
          currentStepId: null,
          completedSteps: new Set(),
          openGates: new Set(),
          isActive: false,
          isStepHidden: false,
          isInitialized: false,
        })
      },

      showStep: (stepId: string) => {
        if (!_config) return
        const step = getStepById(_config, stepId)
        if (!step || step.stub) return

        const state = get()
        if (state.completedSteps.has(stepId)) return

        // Warn if activating a spotlight step whose target won't be found —
        // the overlay will render a full-screen backdrop with no cutout,
        // soft-locking the app.
        if (step.spotlight === null && state.isActive) {
          // eslint-disable-next-line no-console
          console.warn(
            `[FTUE] showStep("${stepId}") has spotlight: null while FTUE is active. ` +
            `The overlay component must return null for non-spotlight steps ` +
            `(e.g., onboarding screens handled by a dedicated component). ` +
            `If this step should show the overlay, set a spotlight selector.`
          )
        }

        set({
          currentStepId: stepId,
          currentPhase: step.phase,
          isActive: true,
          isStepHidden: false,
        })

        _updateGates()
        _persist()
      },

      hideCurrentStep: () => {
        set({ isStepHidden: true })
      },

      pauseFtue: () => {
        const state = get()
        if (!state.isActive || !state.currentStepId) return

        const newCompleted = state.isStepHidden
          ? new Set([...state.completedSteps, state.currentStepId])
          : state.completedSteps

        set({
          isActive: false,
          currentStepId: null,
          isStepHidden: false,
          completedSteps: newCompleted,
        })

        _updateGates()
        _persist()
      },

      resumeLinearPhase: () => {
        if (!_config) return
        const state = get()
        if (state.isActive) return

        const phase = _config.phases.find(p => p.id === state.currentPhase)
        if (!phase || phase.mode !== 'linear') return

        const steps = getPhaseSteps(_config, phase.id)
        const nextStep = steps.find(s => !state.completedSteps.has(s.id))

        if (nextStep) {
          if (nextStep.guard && _adapter) {
            const evaluator = _adapter.conditions[nextStep.guard]
            if (evaluator && !evaluator(_adapter.getContext(), {}, null)) {
              return
            }
          }

          set({
            currentStepId: nextStep.id,
            isActive: true,
            isStepHidden: false,
          })
          _updateGates()
          _persist()
        } else {
          const next = getNextPhase(_config, phase.id)
          if (next) {
            set({
              currentStepId: null,
              currentPhase: next.id,
              isActive: false,
            })
          } else {
            set({
              currentStepId: null,
              currentPhase: 'completed',
              isActive: false,
            })
          }
          _updateGates()
          _persist()
        }
      },

      getGateOpen: (gateName: string): boolean => {
        const state = get()
        if (state.currentPhase === 'completed' || state.currentPhase === 'skipped') return true
        return state.openGates.has(gateName)
      },

      isFeatureTutorialComplete: (featureKey: string): boolean => {
        if (!_config) return false
        const state = get()
        if (state.currentPhase === 'completed' || state.currentPhase === 'skipped') return true
        const featureSteps = _config.steps.filter((s) => s.featureKey === featureKey)
        if (featureSteps.length === 0) return false
        return featureSteps.every((s) => state.completedSteps.has(s.id))
      },

      markStepAutoSkipped: (stepId: string): void => {
        if (!_config) return
        const step = getStepById(_config, stepId)
        if (!step) return
        const state = get()
        if (state.completedSteps.has(stepId)) return
        const newCompletedSteps = new Set(state.completedSteps)
        newCompletedSteps.add(stepId)
        set({ completedSteps: newCompletedSteps })
        _updateGates()
        _persist()
      },

      markFeatureTutorialComplete: (featureKey: string): void => {
        if (!_config) {
          throw new Error(
            `[ftue-engine] markFeatureTutorialComplete("${featureKey}") called before initialize()`,
          )
        }
        const featureSteps = _config.steps.filter((s) => s.featureKey === featureKey)
        if (featureSteps.length === 0) {
          const known = [...new Set(_config.steps.map((s) => s.featureKey).filter(Boolean))]
          throw new Error(
            `[ftue-engine] markFeatureTutorialComplete("${featureKey}") — no step declares this featureKey. ` +
            `Configured featureKeys: [${known.join(', ') || '(none)'}]`,
          )
        }
        const state = get()
        const newCompletedSteps = new Set(state.completedSteps)
        for (const s of featureSteps) newCompletedSteps.add(s.id)
        const currentStepWasCleared =
          state.currentStepId !== null && newCompletedSteps.has(state.currentStepId)
        set({
          completedSteps: newCompletedSteps,
          currentStepId: currentStepWasCleared ? null : state.currentStepId,
          isActive: currentStepWasCleared ? false : state.isActive,
        })
        _updateGates()
        _persist()
      },
    }
  })

  return { store, getConfig, getAdapter }
}
