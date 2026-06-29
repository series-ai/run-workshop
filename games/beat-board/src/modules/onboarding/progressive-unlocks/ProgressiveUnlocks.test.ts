import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    isMock: () => true,
    error: vi.fn(),
    lifecycles: {
      onSleep: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      onQuit: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    },
  },
}))

import { unlockStore, setupPersistence } from './ProgressiveUnlocks'
import type { UnlockGate } from './types'
import { StorageService, MemoryStorageAdapter } from '@modules/data/storage-service/StorageService'
import { createPersistenceManager } from '@modules/data/storage-service/PersistenceManager'

const gates: UnlockGate[] = [
  { featureKey: 'shop', requiredLevel: 2, celebrationText: 'Shop unlocked!' },
  { featureKey: 'pvp', requiredLevel: 5, requiredStep: 'tutorial_complete', celebrationText: 'PvP unlocked!' },
  { featureKey: 'crafting', requiredLevel: 3 },
]

beforeEach(() => {
  unlockStore.getState().reset()
  unlockStore.setState({ _gates: gates })
})

describe('ProgressiveUnlocks', () => {
  it('isUnlocked false initially', () => {
    expect(unlockStore.getState().isUnlocked('shop')).toBe(false)
  })

  it('checkUnlocks returns features at correct level', () => {
    const result = unlockStore.getState().checkUnlocks(2, [], gates)
    expect(result).toContain('shop')
    expect(result).not.toContain('pvp') // pvp requires step
  })

  it('checkUnlocks requires completed step', () => {
    const result = unlockStore.getState().checkUnlocks(5, ['tutorial_complete'], gates)
    expect(result).toContain('pvp')
  })

  it('checkUnlocks does not return already unlocked features', () => {
    unlockStore.getState().unlock('shop')
    const result = unlockStore.getState().checkUnlocks(5, [], gates)
    expect(result).not.toContain('shop')
  })

  it('unlock marks feature', () => {
    unlockStore.getState().unlock('shop')
    expect(unlockStore.getState().isUnlocked('shop')).toBe(true)
  })

  it('claimCelebration returns and removes pending', () => {
    unlockStore.getState().unlock('shop', 'Shop unlocked!')
    expect(unlockStore.getState().hasPendingCelebration()).toBe(true)
    const text = unlockStore.getState().claimCelebration('shop')
    expect(text).toBe('Shop unlocked!')
    expect(unlockStore.getState().hasPendingCelebration()).toBe(false)
  })

  it('checkUnlocks seeds gate metadata for later claim text', () => {
    unlockStore.getState().reset()

    const result = unlockStore.getState().checkUnlocks(2, [], gates)
    expect(result).toContain('shop')

    unlockStore.getState().unlock('shop', 'Shop unlocked!')
    const text = unlockStore.getState().claimCelebration('shop')
    expect(text).toBe('Shop unlocked!')
  })

  it('claimCelebration returns null if not pending', () => {
    const text = unlockStore.getState().claimCelebration('shop')
    expect(text).toBeNull()
  })

  describe('subscribeUnlock', () => {
    it('notifies subscriber synchronously when a feature transitions locked → unlocked', () => {
      const fired: string[] = []
      const unsubscribe = unlockStore.getState().subscribeUnlock((key) => fired.push(key))

      unlockStore.getState().unlock('shop')

      expect(fired).toEqual(['shop'])
      unsubscribe()
    })

    it('fires synchronously before unlock() returns (no microtask delay)', () => {
      const fired: string[] = []
      unlockStore.getState().subscribeUnlock((key) => fired.push(key))

      unlockStore.getState().unlock('crafting')
      // No await; must be present synchronously
      expect(fired).toEqual(['crafting'])
    })

    it('does not refire when already-unlocked feature is re-unlocked', () => {
      const fired: string[] = []
      unlockStore.getState().subscribeUnlock((key) => fired.push(key))

      unlockStore.getState().unlock('shop')
      unlockStore.getState().unlock('shop')
      unlockStore.getState().unlock('shop', 'Shop unlocked!')

      expect(fired).toEqual(['shop'])
    })

    it('unsubscribe stops notifications', () => {
      const fired: string[] = []
      const unsubscribe = unlockStore.getState().subscribeUnlock((key) => fired.push(key))

      unlockStore.getState().unlock('shop')
      unsubscribe()
      unlockStore.getState().unlock('crafting')

      expect(fired).toEqual(['shop'])
    })

    it('multiple subscribers each receive the event', () => {
      const a: string[] = []
      const b: string[] = []
      unlockStore.getState().subscribeUnlock((key) => a.push(key))
      unlockStore.getState().subscribeUnlock((key) => b.push(key))

      unlockStore.getState().unlock('shop')

      expect(a).toEqual(['shop'])
      expect(b).toEqual(['shop'])
    })

    it('reset() clears the unlocked set so a subsequent unlock fires again', () => {
      const fired: string[] = []
      unlockStore.getState().subscribeUnlock((key) => fired.push(key))

      unlockStore.getState().unlock('shop')
      unlockStore.getState().reset()
      // After reset, gates needs to be reseated for this test's beforeEach, but unlock itself should still fire
      unlockStore.getState().unlock('shop')

      expect(fired).toEqual(['shop', 'shop'])
    })
  })

  describe('persistence round-trip', () => {
    it('survives flush → restore cycle', async () => {
      const storage = new StorageService('test')
      storage.setAdapter(new MemoryStorageAdapter())
      const pm = createPersistenceManager(storage)

      setupPersistence(pm)

      unlockStore.getState().unlock('shop', 'Shop unlocked!')
      unlockStore.getState().unlock('crafting')

      await pm.flush()

      unlockStore.getState().reset()
      await pm.restoreAll()

      expect(unlockStore.getState().unlockedFeatures).toContain('shop')
      expect(unlockStore.getState().unlockedFeatures).toContain('crafting')
      expect(unlockStore.getState().pendingCelebrations).toContain('shop')

      pm.destroy()
    })
  })
})
