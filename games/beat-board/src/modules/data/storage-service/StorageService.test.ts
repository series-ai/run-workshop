import { describe, it, expect, beforeEach } from 'vitest'
import { StorageService, MemoryStorageAdapter, createStorageService } from './StorageService'

function makeService(prefix = 'test-game') {
  const svc = new StorageService(prefix)
  svc.setAdapter(new MemoryStorageAdapter())
  return svc
}

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter

  beforeEach(() => { adapter = new MemoryStorageAdapter('pfx:') })

  it('returns null for missing key', async () => {
    expect(await adapter.getItem('foo')).toBeNull()
  })

  it('stores and retrieves value', async () => {
    await adapter.setItem('foo', 'bar')
    expect(await adapter.getItem('foo')).toBe('bar')
  })

  it('removes item', async () => {
    await adapter.setItem('foo', 'bar')
    await adapter.removeItem('foo')
    expect(await adapter.getItem('foo')).toBeNull()
  })

  it('clears all items', async () => {
    await adapter.setItem('a', '1')
    await adapter.setItem('b', '2')
    await adapter.clear()
    expect(await adapter.getItem('a')).toBeNull()
  })
})

describe('StorageService – string API', () => {
  let svc: StorageService

  beforeEach(() => { svc = makeService() })

  it('returns null for missing key', async () => {
    expect(await svc.getItem('missing')).toBeNull()
  })

  it('stores and retrieves', async () => {
    await svc.setItem('key', 'value')
    expect(await svc.getItem('key')).toBe('value')
  })

  it('removes item', async () => {
    await svc.setItem('key', 'value')
    await svc.removeItem('key')
    expect(await svc.getItem('key')).toBeNull()
  })

  it('returns scope storage adapters and debug key snapshots', async () => {
    svc.setGlobalAdapter(new MemoryStorageAdapter())
    svc.setDeviceAdapter(new MemoryStorageAdapter())

    await svc.getStorage('globalStorage').setItem('flag', '1')
    await svc.getStorage('deviceCache').setItem('session', 'abc')

    expect(await svc.globalStorage.getItem('flag')).toBe('1')
    expect(await svc.deviceCache.getItem('session')).toBe('abc')
    expect(svc.getDebugSnapshot('globalStorage', 'flag')).toEqual({
      scope: 'globalStorage',
      prefixedKey: 'test-game:global:flag',
    })
  })
})

describe('StorageService – JSON API', () => {
  let svc: StorageService

  beforeEach(() => { svc = makeService() })

  it('stores and retrieves JSON', async () => {
    await svc.setJSON('player', { gold: 100, level: 5 })
    const result = await svc.getJSON<{ gold: number; level: number }>('player')
    expect(result).toEqual({ gold: 100, level: 5 })
  })

  it('returns null for missing JSON key', async () => {
    expect(await svc.getJSON('nonexistent')).toBeNull()
  })

  it('returns null for malformed JSON', async () => {
    await svc.setItem('bad', 'not-json{{{')
    expect(await svc.getJSON('bad')).toBeNull()
  })
})

describe('createStorageService', () => {
  it('creates a service with given game ID prefix', () => {
    const svc = createStorageService('my-game')
    expect(svc).toBeInstanceOf(StorageService)
  })
})

describe('StorageService._reset', () => {
  it('clears all adapter references', () => {
    const svc = makeService()
    svc._reset()
    // After reset, appStorage getter would try to access RundotAPI — just verify no crash
    expect(() => svc._reset()).not.toThrow()
  })
})
