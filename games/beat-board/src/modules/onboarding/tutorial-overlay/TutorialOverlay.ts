import { create } from 'zustand'
import type { TutorialStep, TutorialState } from './types'

interface TutorialStore extends TutorialState {
  start: () => void
  advance: () => void
  dismiss: () => void
  getCurrentTarget: () => string | null
  reset: () => void
  _steps: TutorialStep[]
}

const initialState: TutorialState = {
  isActive: false,
  currentStep: null,
  stepIndex: 0,
  totalSteps: 0,
}

export function createTutorialStore(steps: TutorialStep[]) {
  return create<TutorialStore>((set, get) => ({
    ...initialState,
    totalSteps: steps.length,
    _steps: steps,

    start() {
      if (steps.length === 0) return
      set({ isActive: true, stepIndex: 0, currentStep: steps[0] })
    },

    advance() {
      const { stepIndex, _steps } = get()
      const nextIndex = stepIndex + 1
      if (nextIndex >= _steps.length) {
        set({ isActive: false, currentStep: null })
        return
      }
      set({ stepIndex: nextIndex, currentStep: _steps[nextIndex] })
    },

    dismiss() {
      const current = get().currentStep
      if (current && current.dismissible === false) return
      set({ isActive: false, currentStep: null })
    },

    getCurrentTarget() {
      return get().currentStep?.targetElementId ?? null
    },

    reset() {
      set({ ...initialState, totalSteps: steps.length })
    },
  }))
}
