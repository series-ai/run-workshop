import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── SDK mock ──────────────────────────────────────────────────────────────────

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

import RundotAPI from '@series-inc/rundot-game-sdk/api'

const mockOnSleep = vi.mocked(RundotAPI.lifecycles.onSleep)
const mockOnQuit = vi.mocked(RundotAPI.lifecycles.onQuit)

import { PersistenceManager, createPersistenceManager } from './PersistenceManager'
import { StorageService, MemoryStorageAdapter } from './StorageService'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageService {
  const svc = new StorageService('test')
  svc.setAdapter(new MemoryStorageAdapter())
  return svc
}

interface CounterState {
  count: number
  label: string
}

function makeCounterStore() {
  let state: CounterState = { count: 0, label: 'default' }
  return {
    get: () => state,
    set: (patch: Partial<CounterState>) => { state = { ...state, ...patch } },
    reset: () => { state = { count: 0, label: 'default' } },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PersistenceManager', () => {
  let storage: StorageService
  let pm: PersistenceManager

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    storage = makeStorage()
    pm = createPersistenceManager(storage)
  })

  afterEach(() => {
    pm.destroy()
    vi.useRealTimers()
  })

  describe('register / unregister', () => {
    it('registers a store without error', () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })
      // No throw = success
    })

    it('unregister removes the key and cancels timer', () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })
      pm.markDirty('counter:v1')
      pm.unregister('counter:v1')
      // Advancing timers should not cause a flush for this key
      vi.advanceTimersByTime(1000)
    })
  })

  describe('markDirty + flush', () => {
    it('flush is a no-op when nothing is dirty', async () => {
      const spy = vi.spyOn(storage, 'setJSON')
      await pm.flush()
      expect(spy).not.toHaveBeenCalled()
    })

    it('markDirty on unregistered key is ignored', () => {
      pm.markDirty('nonexistent')
      // No throw, no timer started
    })

    it('flushes a single dirty key', async () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      store.set({ count: 42, label: 'test' })
      pm.markDirty('counter:v1')
      await pm.flush()

      const saved = await storage.getJSON<CounterState>('counter:v1')
      expect(saved).toEqual({ count: 42, label: 'test' })
    })

    it('batches multiple dirty keys into one flush', async () => {
      const storeA = makeCounterStore()
      const storeB = makeCounterStore()
      const storeC = makeCounterStore()

      pm.register('a:v1', {
        serialize: () => storeA.get(),
        deserialize: (data) => storeA.set(data as CounterState),
      })
      pm.register('b:v1', {
        serialize: () => storeB.get(),
        deserialize: (data) => storeB.set(data as CounterState),
      })
      pm.register('c:v1', {
        serialize: () => storeC.get(),
        deserialize: (data) => storeC.set(data as CounterState),
      })

      storeA.set({ count: 1, label: 'a' })
      storeB.set({ count: 2, label: 'b' })
      storeC.set({ count: 3, label: 'c' })

      pm.markDirty('a:v1')
      pm.markDirty('b:v1')
      pm.markDirty('c:v1')

      // All 3 flushed in one call
      await pm.flush()

      expect(await storage.getJSON('a:v1')).toEqual({ count: 1, label: 'a' })
      expect(await storage.getJSON('b:v1')).toEqual({ count: 2, label: 'b' })
      expect(await storage.getJSON('c:v1')).toEqual({ count: 3, label: 'c' })
    })

    it('5 rapid markDirty calls produce 1 flush after debounce', async () => {
      const store = makeCounterStore()
      const flushSpy = vi.spyOn(pm, 'flush')

      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      // 5 rapid mutations
      for (let i = 1; i <= 5; i++) {
        store.set({ count: i, label: `v${i}` })
        pm.markDirty('counter:v1')
      }

      expect(flushSpy).not.toHaveBeenCalled()

      // Advance past debounce
      vi.advanceTimersByTime(600)

      // flush was triggered once by the timer
      expect(flushSpy).toHaveBeenCalledTimes(1)

      // Wait for the async flush to complete
      await pm.flush()

      // Stored the latest value
      const saved = await storage.getJSON<CounterState>('counter:v1')
      expect(saved).toEqual({ count: 5, label: 'v5' })
    })

    it('respects per-registration debounceMs override', async () => {
      const store = makeCounterStore()
      const flushSpy = vi.spyOn(pm, 'flush')

      pm.register('fast:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
        debounceMs: 100,
      })

      store.set({ count: 1, label: 'fast' })
      pm.markDirty('fast:v1')

      vi.advanceTimersByTime(150)
      expect(flushSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('restoreAll', () => {
    it('restores persisted state into stores', async () => {
      // Pre-populate storage
      await storage.setJSON('counter:v1', { count: 99, label: 'restored' })

      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      await pm.restoreAll()

      expect(store.get()).toEqual({ count: 99, label: 'restored' })
    })

    it('skips restoration when storage has no data for a key', async () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      await pm.restoreAll()

      // Default state unchanged
      expect(store.get()).toEqual({ count: 0, label: 'default' })
    })

    it('restores multiple stores in parallel', async () => {
      await storage.setJSON('a:v1', { count: 10, label: 'aaa' })
      await storage.setJSON('b:v1', { count: 20, label: 'bbb' })

      const storeA = makeCounterStore()
      const storeB = makeCounterStore()

      pm.register('a:v1', {
        serialize: () => storeA.get(),
        deserialize: (data) => storeA.set(data as CounterState),
      })
      pm.register('b:v1', {
        serialize: () => storeB.get(),
        deserialize: (data) => storeB.set(data as CounterState),
      })

      await pm.restoreAll()

      expect(storeA.get()).toEqual({ count: 10, label: 'aaa' })
      expect(storeB.get()).toEqual({ count: 20, label: 'bbb' })
    })
  })

  describe('debug diagnostics', () => {
    it('reports registered, dirty, pending, and lifecycle state', async () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
        debounceMs: 100,
      })

      pm.markDirty('counter:v1')

      expect(pm.getDebugDiagnostics()).toEqual(
        expect.objectContaining({
          initialized: false,
          registeredKeys: ['counter:v1'],
          dirtyKeys: ['counter:v1'],
          pendingKeys: ['counter:v1'],
          lastRestoreAt: null,
          lastFlushAt: null,
        }),
      )

      await pm.flush()

      expect(pm.getDebugDiagnostics()).toEqual(
        expect.objectContaining({
          dirtyKeys: [],
          pendingKeys: [],
          lastFlushError: null,
          lastFlushAt: expect.any(Number),
        }),
      )

      await pm.initialize()

      expect(pm.getDebugDiagnostics()).toEqual(
        expect.objectContaining({
          initialized: true,
          lastRestoreError: null,
          lastRestoreAt: expect.any(Number),
        }),
      )
    })
  })

  describe('initialize', () => {
    it('restores state and registers lifecycle hooks', async () => {
      await storage.setJSON('counter:v1', { count: 77, label: 'init' })

      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      await pm.initialize()

      expect(store.get()).toEqual({ count: 77, label: 'init' })
      expect(mockOnSleep).toHaveBeenCalledOnce()
      expect(mockOnQuit).toHaveBeenCalledOnce()
    })

    it('onSleep triggers flush', async () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      // Capture the onSleep callback
      let sleepCallback: (() => void) | undefined
      mockOnSleep.mockImplementation((cb: () => void) => {
        sleepCallback = cb
        return { unsubscribe: vi.fn() }
      })

      await pm.initialize()

      // Mutate and mark dirty
      store.set({ count: 55, label: 'sleep' })
      pm.markDirty('counter:v1')

      // Trigger sleep (simulates app backgrounding)
      sleepCallback!()

      // Allow async flush to run
      await vi.advanceTimersByTimeAsync(0)
      await pm.flush()

      const saved = await storage.getJSON<CounterState>('counter:v1')
      expect(saved).toEqual({ count: 55, label: 'sleep' })
    })
  })

  describe('persistence round-trip', () => {
    it('mutate → flush → fresh manager → restore → state matches', async () => {
      // Phase 1: Write
      const store1 = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store1.get(),
        deserialize: (data) => store1.set(data as CounterState),
      })

      store1.set({ count: 123, label: 'round-trip' })
      pm.markDirty('counter:v1')
      await pm.flush()

      // Phase 2: Fresh manager (simulates app restart)
      const pm2 = createPersistenceManager(storage)
      const store2 = makeCounterStore()
      pm2.register('counter:v1', {
        serialize: () => store2.get(),
        deserialize: (data) => store2.set(data as CounterState),
      })

      await pm2.restoreAll()

      expect(store2.get()).toEqual({ count: 123, label: 'round-trip' })
      pm2.destroy()
    })
  })

  describe('error handling', () => {
    it('handles serialize errors without crashing', async () => {
      pm.register('bad:v1', {
        serialize: () => { throw new Error('serialize boom') },
        deserialize: () => {},
      })

      pm.markDirty('bad:v1')
      // Should not throw
      await pm.flush()
    })

    it('handles storage write errors without crashing', async () => {
      const store = makeCounterStore()
      pm.register('counter:v1', {
        serialize: () => store.get(),
        deserialize: (data) => store.set(data as CounterState),
      })

      // Make storage fail
      vi.spyOn(storage, 'setJSON').mockRejectedValueOnce(new Error('write fail'))

      pm.markDirty('counter:v1')
      await pm.flush() // Should not throw
    })
  })

  describe('createPersistenceManager', () => {
    it('returns a PersistenceManager instance', () => {
      const result = createPersistenceManager(storage)
      expect(result).toBeInstanceOf(PersistenceManager)
      result.destroy()
    })
  })
})
