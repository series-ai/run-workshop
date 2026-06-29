import { create } from 'zustand'
import type { UnlockGate, UnlockState } from './types'
import type { PersistenceManager } from '@modules/data/storage-service/PersistenceManager'

// NOTE: At the game-install-module step, this import path gets rewritten to:
// import type { PersistenceManager } from '../services/PersistenceManager'

type UnlockSubscriber = (featureKey: string) => void

interface UnlockStore extends UnlockState {
  checkUnlocks: (currentLevel: number, completedSteps: string[], gates: UnlockGate[]) => string[]
  unlock: (featureKey: string, celebrationText?: string) => void
  isUnlocked: (featureKey: string) => boolean
  hasPendingCelebration: () => boolean
  claimCelebration: (featureKey: string) => string | null
  reset: () => void
  subscribeUnlock: (cb: UnlockSubscriber) => () => void
  _gates: UnlockGate[]
  _unlockSubscribers: Set<UnlockSubscriber>
}

const PERSIST_KEY = 'progressive-unlocks:v1'

let _pm: PersistenceManager | undefined

const initialState: UnlockState = {
  unlockedFeatures: [],
  pendingCelebrations: [],
}

export const unlockStore = create<UnlockStore>((set, get) => ({
  ...initialState,
  _gates: [],
  _unlockSubscribers: new Set<UnlockSubscriber>(),

  checkUnlocks(currentLevel: number, completedSteps: string[], gates: UnlockGate[]): string[] {
    set({ _gates: gates })
    const { unlockedFeatures } = get()
    const newlyUnlockable: string[] = []

    for (const gate of gates) {
      if (unlockedFeatures.includes(gate.featureKey)) continue
      if (currentLevel < gate.requiredLevel) continue
      if (gate.requiredStep && !completedSteps.includes(gate.requiredStep)) continue
      newlyUnlockable.push(gate.featureKey)
    }

    return newlyUnlockable
  },

  unlock(featureKey: string, celebrationText?: string) {
    const wasUnlocked = get().unlockedFeatures.includes(featureKey)
    set(state => ({
      unlockedFeatures: wasUnlocked
        ? state.unlockedFeatures
        : [...state.unlockedFeatures, featureKey],
      pendingCelebrations: celebrationText && !state.pendingCelebrations.includes(featureKey)
        ? [...state.pendingCelebrations, featureKey]
        : state.pendingCelebrations,
    }))
    _pm?.markDirty(PERSIST_KEY)
    if (!wasUnlocked) {
      for (const cb of get()._unlockSubscribers) {
        cb(featureKey)
      }
    }
  },

  subscribeUnlock(cb: UnlockSubscriber) {
    const subs = get()._unlockSubscribers
    subs.add(cb)
    return () => {
      subs.delete(cb)
    }
  },

  isUnlocked(featureKey: string) {
    return get().unlockedFeatures.includes(featureKey)
  },

  hasPendingCelebration() {
    return get().pendingCelebrations.length > 0
  },

  claimCelebration(featureKey: string) {
    const { _gates, pendingCelebrations } = get()
    if (!pendingCelebrations.includes(featureKey)) return null
    const gate = _gates.find(g => g.featureKey === featureKey)
    set(state => ({
      pendingCelebrations: state.pendingCelebrations.filter(k => k !== featureKey),
    }))
    _pm?.markDirty(PERSIST_KEY)
    return gate?.celebrationText ?? null
  },

  reset() {
    set(initialState)
    _pm?.markDirty(PERSIST_KEY)
  },
}))

export function setupPersistence(pm: PersistenceManager): void {
  _pm = pm
  pm.register(PERSIST_KEY, {
    serialize: () => {
      const { unlockedFeatures, pendingCelebrations } = unlockStore.getState()
      return { unlockedFeatures, pendingCelebrations }
    },
    deserialize: (data: UnlockState) => {
      unlockStore.setState(data)
    },
  })
}
