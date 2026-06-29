/**
 * MixLibrary unit tests against the in-memory repository.
 *
 * Behaviours that belong to the repo (durability, ordering) live in the
 * contract suite. This file covers what the library adds: cache state,
 * subscriber fan-out, idempotent hydrate, deterministic clock injection.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InMemoryMixRepository } from '../in-memory-repo'
import { MixLibrary, type MixSummary } from '../library'
import type { SaveMixInput } from '../types'
import { MIX_SESSION_VERSION } from '../sessions/types'

function buildSaveInput(overrides: Partial<SaveMixInput> = {}): SaveMixInput {
  return {
    title: 'Test Mix',
    session: {
      kitId: 'kit_alpha',
      bpm: 84,
      durationBeats: 32,
      createdAtMs: 0, // overwritten by library
      events: [
        { t: 0, type: 'pad_activate', padId: 'drums-1' },
        { t: 4, type: 'pad_activate', padId: 'bass-1' },
      ],
      version: MIX_SESSION_VERSION,
    },
    ...overrides,
  }
}

describe('MixLibrary', () => {
  let repo: InMemoryMixRepository
  let library: MixLibrary

  beforeEach(() => {
    repo = new InMemoryMixRepository()
    library = new MixLibrary({
      repository: repo,
      now: () => 1_700_000_000_000,
    })
  })

  afterEach(() => {
    library.dispose()
  })

  it('starts un-hydrated with an empty list', () => {
    expect(library.isHydrated()).toBe(false)
    expect(library.list()).toEqual([])
  })

  it('save() persists to the repo and prepends the row', async () => {
    const summary = await library.save(buildSaveInput({ title: 'first' }))
    expect(summary.title).toBe('first')
    expect(summary.id).toMatch(/^mix_/)
    expect(library.list()).toHaveLength(1)

    const fromRepo = await repo.get(summary.id)
    expect(fromRepo!.title).toBe('first')
    expect(fromRepo!.events).toHaveLength(2)
  })

  it('save uses the injected clock for createdAtMs', async () => {
    const summary = await library.save(buildSaveInput())
    expect(summary.createdAtMs).toBe(1_700_000_000_000)
  })

  it('importShared preserves source id and dedupes repeat imports', async () => {
    const first = await library.importShared({
      sourceMixId: 'mix_friend_001',
      title: 'Friend Mix',
      session: {
        id: 'mix_friend_001',
        title: 'Original title',
        kitId: 'kit_beta',
        bpm: 92,
        durationBeats: 16,
        createdAtMs: 1,
        events: [{ t: 0, type: 'pad_activate', padId: 'drums-1' }],
        version: MIX_SESSION_VERSION,
      },
    })
    const second = await library.importShared({
      sourceMixId: 'mix_friend_001',
      title: 'Friend Mix Again',
      session: {
        id: 'mix_friend_001',
        title: 'Different title',
        kitId: 'kit_beta',
        bpm: 92,
        durationBeats: 16,
        createdAtMs: 2,
        events: [],
        version: MIX_SESSION_VERSION,
      },
    })

    expect(first.id).toBe('mix_friend_001')
    expect(second.id).toBe(first.id)
    expect(library.list()).toHaveLength(1)
    expect(library.getSession(first.id)).toMatchObject({
      id: 'mix_friend_001',
      sourceMixId: 'mix_friend_001',
      title: 'Friend Mix',
      kitId: 'kit_beta',
      createdAtMs: 1_700_000_000_000,
    })
  })

  it('save populates a derived durationSeconds + serializedBytes', async () => {
    const summary = await library.save(buildSaveInput())
    expect(summary.durationSeconds).toBeCloseTo((32 * 60) / 84, 3)
    expect(summary.serializedBytes).toBeGreaterThan(50)
    expect(summary.serializedBytes).toBeLessThan(2_000)
  })

  it('list() returns newest-first', async () => {
    let t = 1_000
    const lib = new MixLibrary({
      repository: repo,
      now: () => (t += 100),
    })
    const a = await lib.save(buildSaveInput({ title: 'A' }))
    const b = await lib.save(buildSaveInput({ title: 'B' }))
    const c = await lib.save(buildSaveInput({ title: 'C' }))
    expect(lib.list().map((m) => m.id)).toEqual([c.id, b.id, a.id])
    lib.dispose()
  })

  it('subscribers fire on subscribe + save + rename + delete', async () => {
    const seen: MixSummary[][] = []
    const unsubscribe = library.subscribe((rows) => seen.push(rows))

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual([])

    const saved = await library.save(buildSaveInput({ title: 'first' }))
    expect(seen.at(-1)).toHaveLength(1)

    await library.rename(saved.id, 'renamed')
    expect(seen.at(-1)![0]!.title).toBe('renamed')

    await library.delete(saved.id)
    expect(seen.at(-1)).toEqual([])

    unsubscribe()
    await library.save(buildSaveInput({ title: 'silent' }))
    expect(seen.at(-1)).toEqual([])
  })

  it('hydrate() loads every persisted record into the cache', async () => {
    await repo.put({
      id: 'mix_seeded',
      title: 'seeded',
      kitId: 'kit_beta',
      bpm: 84,
      durationBeats: 8,
      createdAtMs: 5_000,
      events: [],
      version: MIX_SESSION_VERSION,
    })
    expect(library.list()).toEqual([])
    await library.hydrate()
    expect(library.isHydrated()).toBe(true)
    expect(library.list()).toHaveLength(1)
    expect(library.list()[0]!.title).toBe('seeded')
  })

  it('hydrate() is idempotent', async () => {
    await library.save(buildSaveInput({ title: 'one' }))
    await library.hydrate()
    expect(library.list()).toHaveLength(1)
    await library.hydrate()
    expect(library.list()).toHaveLength(1)
  })

  it('rename() trims and rejects empty titles', async () => {
    const saved = await library.save(buildSaveInput({ title: 'orig' }))
    expect(await library.rename(saved.id, '   ')).toBeNull()
    expect(library.get(saved.id)!.title).toBe('orig')
    expect(await library.rename(saved.id, '  Trimmed  ')).not.toBeNull()
    expect(library.get(saved.id)!.title).toBe('Trimmed')
  })

  it('rename() on unknown id resolves null', async () => {
    expect(await library.rename('nope', 'x')).toBeNull()
  })

  it('delete() is idempotent', async () => {
    const saved = await library.save(buildSaveInput())
    await library.delete(saved.id)
    await library.delete(saved.id)
    expect(library.list()).toEqual([])
  })

  it('getSession returns a deep-cloned session (mutating it does not leak)', async () => {
    const saved = await library.save(buildSaveInput())
    const session = library.getSession(saved.id)!
    session.title = 'mutated'
    session.events.push({ t: 99, type: 'one_shot', padId: 'fx-99' })
    const fresh = library.getSession(saved.id)!
    expect(fresh.title).toBe('Test Mix')
    expect(fresh.events).toHaveLength(2)
  })

  it('getSession on unknown id returns null', () => {
    expect(library.getSession('nope')).toBeNull()
  })

  it('get() returns a summary; getSession() returns full data', async () => {
    const saved = await library.save(buildSaveInput())
    expect(library.get(saved.id)).toMatchObject({
      id: saved.id,
      title: 'Test Mix',
    })
    expect(library.getSession(saved.id)!.events).toHaveLength(2)
  })
})
