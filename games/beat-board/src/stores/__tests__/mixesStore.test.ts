/**
 * Zustand store wiring tests against an in-memory MixLibrary.
 *
 * Sessions-only (no blobs / no IDB). Imported share-link mixes are
 * regular saved mixes — there's no separate `imported` flag in the
 * new model.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InMemoryMixRepository } from '../../systems/mixes/in-memory-repo'
import { MixLibrary } from '../../systems/mixes/library'
import { __setMixLibraryForTests, MIX_SESSION_VERSION } from '../../systems/mixes'
import {
  deleteMix,
  hydrateMixesAtBoot,
  installMixLibraryBinding,
  renameMix,
  resetMixesStore,
  saveMix,
  useMixesStore,
} from '../mixesStore'

let library: MixLibrary

function buildSession(overrides: Partial<{ kitId: string; bpm: number; durationBeats: number; events: never[] }> = {}) {
  return {
    kitId: overrides.kitId ?? 'kit_alpha',
    bpm: overrides.bpm ?? 84,
    durationBeats: overrides.durationBeats ?? 32,
    createdAtMs: 0, // overwritten by library
    events: overrides.events ?? [],
    version: MIX_SESSION_VERSION,
  }
}

beforeEach(() => {
  library = new MixLibrary({
    repository: new InMemoryMixRepository(),
    now: () => 1_700_000_000_000,
  })
  __setMixLibraryForTests(library)
  resetMixesStore()
  installMixLibraryBinding()
})

afterEach(() => {
  __setMixLibraryForTests(null)
  resetMixesStore()
})

describe('useMixesStore', () => {
  it('starts empty after a fresh boot', () => {
    expect(useMixesStore.getState().mixes).toEqual([])
    expect(useMixesStore.getState().unviewedCount).toBe(0)
  })

  it('saveMix prepends a new row to the store', async () => {
    await saveMix({ title: 'Just saved', session: buildSession() })
    const state = useMixesStore.getState()
    expect(state.mixes).toHaveLength(1)
    expect(state.mixes[0]!.title).toBe('Just saved')
  })

  it('renameMix updates the title in the store', async () => {
    const summary = await saveMix({ title: 'orig', session: buildSession() })
    await renameMix(summary.id, 'updated')
    expect(useMixesStore.getState().getMix(summary.id)!.title).toBe('updated')
  })

  it('deleteMix removes the row from the store', async () => {
    const summary = await saveMix({ title: 'tmp', session: buildSession() })
    await deleteMix(summary.id)
    expect(useMixesStore.getState().mixes).toEqual([])
  })

  it('rows carry derived durationSeconds + serializedBytes', async () => {
    await saveMix({ title: 't', session: buildSession({ bpm: 120, durationBeats: 16 }) })
    const row = useMixesStore.getState().mixes[0]!
    expect(row.durationSeconds).toBeCloseTo((16 * 60) / 120, 3)
    expect(row.serializedBytes).toBeGreaterThan(0)
  })

  it('newest-first ordering across multiple saves', async () => {
    let t = 1_000
    library.dispose()
    library = new MixLibrary({
      repository: new InMemoryMixRepository(),
      now: () => (t += 100),
    })
    __setMixLibraryForTests(library)
    installMixLibraryBinding()
    await saveMix({ title: 'A', session: buildSession() })
    await saveMix({ title: 'B', session: buildSession() })
    await saveMix({ title: 'C', session: buildSession() })
    expect(useMixesStore.getState().mixes.map((m) => m.title)).toEqual(['C', 'B', 'A'])
  })

  it('hydrateMixesAtBoot pulls from the repo and flips loadStatus to ready', async () => {
    await library.save({ title: 'persisted', session: buildSession() })
    resetMixesStore()
    expect(useMixesStore.getState().mixes).toEqual([])
    expect(useMixesStore.getState().loadStatus).toBe('idle')

    await hydrateMixesAtBoot()
    expect(useMixesStore.getState().loadStatus).toBe('ready')
    expect(useMixesStore.getState().mixes).toHaveLength(1)
    expect(useMixesStore.getState().mixes[0]!.title).toBe('persisted')
  })

  it('markAllViewed clears unviewedCount', () => {
    useMixesStore.setState({
      mixes: [
        {
          id: 'mix_a',
          title: 'a',
          kitId: 'kit_a',
          bpm: 84,
          durationBeats: 8,
          durationSeconds: 5.7,
          createdAtMs: 1_000,
          serializedBytes: 100,
          isUnviewed: true,
        },
      ],
      unviewedCount: 1,
    })
    useMixesStore.getState().markAllViewed()
    expect(useMixesStore.getState().unviewedCount).toBe(0)
    expect(useMixesStore.getState().mixes.every((m) => !m.isUnviewed)).toBe(true)
  })
})
