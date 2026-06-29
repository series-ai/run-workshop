/**
 * PersistenceManager — batched, debounced, lifecycle-aware state persistence.
 *
 * Modules register their Zustand stores with a storage key and
 * serialize/deserialize pair. After mutations, they call `markDirty(key)`.
 * The manager coalesces dirty keys and flushes them to StorageService
 * on a debounce timer + lifecycle hooks (onSleep, onQuit).
 *
 * One PersistenceManager instance per game. Created at boot, initialized
 * after RundotAPI.initializeAsync(). All modules share the same instance.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { StorageService } from './StorageService'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PersistenceRegistration<T = unknown> {
  /** Extract the persistable slice from the current store state. */
  serialize: () => T
  /** Restore persisted state into the store. Called with parsed JSON. */
  deserialize: (data: T) => void
  /** Override the default debounce interval (ms). Default: 500. */
  debounceMs?: number
}

export interface PersistenceDebugDiagnostics {
  initialized: boolean
  registeredKeys: string[]
  dirtyKeys: string[]
  pendingKeys: string[]
  lastRestoreAt: number | null
  lastRestoreError: string | null
  lastFlushAt: number | null
  lastFlushError: string | null
}

// ── PersistenceManager ────────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 500

export class PersistenceManager {
  private readonly registrations = new Map<string, PersistenceRegistration>()
  private readonly dirtyKeys = new Set<string>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly storage: StorageService
  private flushPromise: Promise<void> | null = null
  private lifecycleDisposers: Array<{ unsubscribe(): void }> = []
  private initialized = false
  private lastRestoreAt: number | null = null
  private lastRestoreError: string | null = null
  private lastFlushAt: number | null = null
  private lastFlushError: string | null = null

  constructor(storage: StorageService) {
    this.storage = storage
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a store for persistence. Call once per module store,
   * typically in the factory function or module init.
   */
  register<T>(key: string, registration: PersistenceRegistration<T>): void {
    this.registrations.set(key, registration as PersistenceRegistration)
  }

  /** Unregister a store. Cancels any pending debounce timer. */
  unregister(key: string): void {
    this.registrations.delete(key)
    this.dirtyKeys.delete(key)
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  // ── Dirty tracking ────────────────────────────────────────────────────────

  /**
   * Mark a key as dirty. Starts/resets a debounce timer for that key.
   * Non-blocking — safe to call synchronously after Zustand `set()`.
   */
  markDirty(key: string): void {
    if (!this.registrations.has(key)) return
    this.dirtyKeys.add(key)

    // Clear existing timer for this key
    const existing = this.timers.get(key)
    if (existing) clearTimeout(existing)

    const reg = this.registrations.get(key)!
    const debounceMs = reg.debounceMs ?? DEFAULT_DEBOUNCE_MS

    const timer = setTimeout(() => {
      this.timers.delete(key)
      void this.flush()
    }, debounceMs)

    this.timers.set(key, timer)
  }

  // ── Flush ─────────────────────────────────────────────────────────────────

  /**
   * Flush all dirty keys to storage in a single pass.
   * Idempotent — no-op when nothing is dirty.
   */
  async flush(): Promise<void> {
    // If a flush is already in progress, chain onto it
    if (this.flushPromise) {
      await this.flushPromise
      // After the previous flush, check if new dirty keys accumulated
      if (this.dirtyKeys.size === 0) return
    }

    if (this.dirtyKeys.size === 0) return

    this.flushPromise = this._doFlush()
    try {
      await this.flushPromise
    } finally {
      this.flushPromise = null
    }
  }

  private async _doFlush(): Promise<void> {
    // Snapshot and clear dirty set
    const keys = [...this.dirtyKeys]
    this.dirtyKeys.clear()

    // Cancel all pending timers for flushed keys
    for (const key of keys) {
      const timer = this.timers.get(key)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(key)
      }
    }

    const flushErrors: string[] = []

    // Serialize and write each key
    const writes: Array<Promise<void>> = []
    for (const key of keys) {
      const reg = this.registrations.get(key)
      if (!reg) continue
      try {
        const data = reg.serialize()
        writes.push(this.storage.setJSON(key, data))
      } catch (err) {
        flushErrors.push(err instanceof Error ? err.message : String(err))
        try { RundotAPI.error(`[PersistenceManager] serialize failed for ${key}:`, err) }
        catch { /* SDK may not be available in tests */ }
      }
    }

    // Await all writes in parallel
    const results = await Promise.allSettled(writes)
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!
      if (result.status === 'rejected') {
        flushErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
        try { RundotAPI.error(`[PersistenceManager] write failed for ${keys[i]}:`, result.reason) }
        catch { /* SDK may not be available in tests */ }
      }
    }

    this.lastFlushAt = Date.now()
    this.lastFlushError = flushErrors[0] ?? null
  }

  // ── Restore ───────────────────────────────────────────────────────────────

  /**
   * Bulk-load all registered keys from storage and call deserializers.
   * Called once at boot before UI renders.
   */
  async restoreAll(): Promise<void> {
    const entries = [...this.registrations.entries()]
    const restoreErrors: string[] = []

    await Promise.allSettled(
      entries.map(async ([key, reg]) => {
        try {
          const data = await this.storage.getJSON(key)
          if (data !== null) {
            reg.deserialize(data)
          }
        } catch (err) {
          restoreErrors.push(err instanceof Error ? err.message : String(err))
          try { RundotAPI.error(`[PersistenceManager] restore failed for ${key}:`, err) }
          catch { /* SDK may not be available in tests */ }
        }
      }),
    )

    this.lastRestoreAt = Date.now()
    this.lastRestoreError = restoreErrors[0] ?? null
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the persistence manager. Call once after RundotAPI.initializeAsync().
   * 1. Restores all registered stores from storage
   * 2. Registers onSleep/onQuit lifecycle hooks for safety-net flushing
   */
  async initialize(): Promise<void> {
    await this.restoreAll()
    this.initialized = true

    // Register lifecycle hooks
    try {
      this.lifecycleDisposers.push(
        RundotAPI.lifecycles.onSleep(() => {
          void this.flush()
        }),
      )
      this.lifecycleDisposers.push(
        RundotAPI.lifecycles.onQuit(async () => {
          await this.flush()
        }),
      )
    } catch {
      // Lifecycle hooks may not be available in test environments
    }
  }

  /** Tear down lifecycle hooks and cancel all timers. For tests. */
  destroy(): void {
    for (const disposer of this.lifecycleDisposers) {
      disposer.unsubscribe()
    }
    this.lifecycleDisposers = []

    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.dirtyKeys.clear()
    this.registrations.clear()
    this.initialized = false
  }

  getDebugDiagnostics(): PersistenceDebugDiagnostics {
    return {
      initialized: this.initialized,
      registeredKeys: [...this.registrations.keys()].sort(),
      dirtyKeys: [...this.dirtyKeys].sort(),
      pendingKeys: [...this.timers.keys()].sort(),
      lastRestoreAt: this.lastRestoreAt,
      lastRestoreError: this.lastRestoreError,
      lastFlushAt: this.lastFlushAt,
      lastFlushError: this.lastFlushError,
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Create a PersistenceManager wired to a StorageService instance. */
export function createPersistenceManager(storage: StorageService): PersistenceManager {
  return new PersistenceManager(storage)
}
