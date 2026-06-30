/**
 * Storage service — namespaced adapter over RundotAPI storage surfaces.
 * Source: venus-content/H5/teahouse/src/_Teahouse/Scripts/Storage/RundotStorage.ts
 *
 * Provides three storage scopes from the Rundot SDK:
 * - appStorage  — game-specific, cloud-synced (primary use)
 * - globalStorage — cross-game shared data
 * - deviceCache — device-local only, not synced
 *
 * Keys are namespaced with a game prefix to avoid collisions.
 * In test environments, inject a MemoryStorageAdapter via setAdapter().
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StorageInterface {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

export type StorageScope = 'appStorage' | 'globalStorage' | 'deviceCache'

export interface StorageDebugSnapshot {
  scope: StorageScope
  prefixedKey: string
}

// ── Adapters ──────────────────────────────────────────────────────────────────

type RundotStorageSurface = {
  getItem(key: string): Promise<string | null | undefined>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear?: () => Promise<void>
}

/** In-memory adapter for testing. */
export class MemoryStorageAdapter implements StorageInterface {
  private readonly storage = new Map<string, string>()

  constructor(private readonly prefix = '') {}

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(this.prefix + key) ?? null
  }
  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(this.prefix + key, value)
  }
  async removeItem(key: string): Promise<void> {
    this.storage.delete(this.prefix + key)
  }
  async clear(): Promise<void> {
    this.storage.clear()
  }
}

class RundotStorageAdapter implements StorageInterface {
  constructor(
    private readonly surface: RundotStorageSurface,
    private readonly prefix: string,
  ) {}

  async getItem(key: string): Promise<string | null> {
    const value = await this.surface.getItem(this.prefix + key)
    return value ?? null
  }
  async setItem(key: string, value: string): Promise<void> {
    await this.surface.setItem(this.prefix + key, value)
  }
  async removeItem(key: string): Promise<void> {
    await this.surface.removeItem(this.prefix + key)
  }
  async clear(): Promise<void> {
    if (typeof this.surface.clear === 'function') {
      await this.surface.clear()
    } else {
      throw new Error('[StorageService] clear() not supported on this storage surface')
    }
  }
}

// ── Storage class ─────────────────────────────────────────────────────────────

export class StorageService {
  private _app: StorageInterface | null = null
  private _global: StorageInterface | null = null
  private _device: StorageInterface | null = null

  constructor(private readonly gamePrefix: string) {}

  private getScopePrefix(scope: StorageScope): string {
    if (scope === 'appStorage') {
      return `${this.gamePrefix}:`
    }

    if (scope === 'globalStorage') {
      return `${this.gamePrefix}:global:`
    }

    return `${this.gamePrefix}:device:`
  }

  private getSurface(scope: StorageScope): RundotStorageSurface {
    const api = RundotAPI as unknown as Record<string, unknown>
    const surface = api[scope] as RundotStorageSurface | undefined
    if (surface && typeof surface.getItem === 'function') return surface
    throw new Error(`[StorageService] RundotAPI.${scope} not available. Is the SDK initialized?`)
  }

  getStorage(scope: StorageScope): StorageInterface {
    if (scope === 'appStorage') {
      return this.appStorage
    }

    if (scope === 'globalStorage') {
      return this.globalStorage
    }

    return this.deviceCache
  }

  getDebugSnapshot(scope: StorageScope, key: string): StorageDebugSnapshot {
    return {
      scope,
      prefixedKey: `${this.getScopePrefix(scope)}${key}`,
    }
  }

  /** Inject a test adapter (memory-backed). Resets on _reset(). */
  setAdapter(adapter: StorageInterface): void { this._app = adapter }
  setGlobalAdapter(adapter: StorageInterface): void { this._global = adapter }
  setDeviceAdapter(adapter: StorageInterface): void { this._device = adapter }

  get appStorage(): StorageInterface {
    this._app ??= new RundotStorageAdapter(this.getSurface('appStorage'), `${this.gamePrefix}:`)
    return this._app
  }
  get globalStorage(): StorageInterface {
    this._global ??= new RundotStorageAdapter(this.getSurface('globalStorage'), `${this.gamePrefix}:global:`)
    return this._global
  }
  get deviceCache(): StorageInterface {
    this._device ??= new RundotStorageAdapter(this.getSurface('deviceCache'), `${this.gamePrefix}:device:`)
    return this._device
  }

  // ── Convenience (app storage) ───────────────────────────────────────────────

  async getItem(key: string): Promise<string | null> { return this.appStorage.getItem(key) }
  async setItem(key: string, value: string): Promise<void> { return this.appStorage.setItem(key, value) }
  async removeItem(key: string): Promise<void> { return this.appStorage.removeItem(key) }
  async clear(): Promise<void> { return this.appStorage.clear() }

  /** Get and JSON.parse. Returns null if missing or invalid JSON. */
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.getItem(key)
    if (raw === null) return null
    try { return JSON.parse(raw) as T }
    catch { return null }
  }

  /** JSON.stringify and set. */
  async setJSON<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value))
  }

  _reset(): void {
    this._app = null
    this._global = null
    this._device = null
  }
}

/** Create a storage service instance for your game. Pass your game ID as prefix. */
export function createStorageService(gameId: string): StorageService {
  return new StorageService(gameId)
}
