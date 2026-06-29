/**
 * AppStorageMixRepository runs the shared MixRepository contract against
 * a stateful appStorage fake. Replaces the old IndexedDb contract test
 * since sessions are JSON-only — no blob layer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { AppStorageMixRepository } from '../app-storage-repo'
import { runRepositoryContract } from '../repository-contract'
import { MIX_SESSION_VERSION } from '../sessions/types'
import type { MixSession } from '../types'

function buildSession(overrides: Partial<MixSession> = {}): MixSession {
  return {
    id: 'mix_test_1',
    title: 'Test Mix',
    kitId: 'kit_alpha',
    bpm: 84,
    durationBeats: 32,
    createdAtMs: 1_700_000_000_000,
    events: [{ t: 0, type: 'pad_activate', padId: 'drums-1' }],
    version: MIX_SESSION_VERSION,
    ...overrides,
  }
}

function installStatefulAppStorage(): void {
  const store = new Map<string, string>()
  const api = RundotAPI as unknown as {
    appStorage: {
      getItem: (k: string) => Promise<string | null>
      setItem: (k: string, v: string) => Promise<void>
      removeItem: (k: string) => Promise<void>
    }
  }
  api.appStorage.getItem = vi.fn(async (k: string) => store.get(k) ?? null)
  api.appStorage.setItem = vi.fn(async (k: string, v: string) => {
    if (k.includes('.')) throw new Error(`appStorage rejects dotted key: ${k}`)
    store.set(k, v)
  })
  api.appStorage.removeItem = vi.fn(async (k: string) => {
    store.delete(k)
  })
}

beforeEach(() => {
  installStatefulAppStorage()
})

runRepositoryContract('AppStorageMixRepository', {
  create: async () => new AppStorageMixRepository(),
})

describe('AppStorageMixRepository H5 hydration behavior', () => {
  it('lists saved mixes after a fresh repository is created by reading the explicit index', async () => {
    const saved = buildSession({ id: 'mix_restart', title: 'Restarted App' })
    await new AppStorageMixRepository().put(saved)

    const reloadedRepo = new AppStorageMixRepository()

    await expect(reloadedRepo.list()).resolves.toEqual([saved])
    expect(RundotAPI.appStorage.getItem).toHaveBeenCalledWith('beatboard_mixes_index')
  })

  it('does not scan legacy mix keys when the explicit index is absent', async () => {
    const legacy = buildSession({ id: 'mix_legacy', title: 'Legacy Save' })
    await RundotAPI.appStorage.setItem('beatboard_mix_mix_legacy', JSON.stringify(legacy))

    const listed = await new AppStorageMixRepository().list()

    expect(listed).toEqual([])
    await expect(RundotAPI.appStorage.getItem('beatboard_mixes_index')).resolves.toBeNull()
  })
})
