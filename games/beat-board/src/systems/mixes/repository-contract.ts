/**
 * Repository contract suite — every `MixRepository` implementation MUST
 * pass this. Importable from per-impl test files so the same scenarios
 * run against InMemory and AppStorage.
 *
 * The factory passed to `runRepositoryContract` returns a fresh, empty
 * repository per test (so tests don't leak state into each other).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { MixRepository, MixSession } from './types'
import { MIX_SESSION_VERSION, type MixEvent } from './sessions/types'

export interface RepositoryFactory {
  create: () => Promise<MixRepository>
}

function buildSession(overrides: Partial<MixSession> = {}): MixSession {
  return {
    id: 'mix_test_1',
    title: 'Test Mix',
    kitId: 'kit_alpha',
    bpm: 84,
    durationBeats: 32,
    createdAtMs: 1_700_000_000_000,
    events: [
      { t: 0, type: 'pad_activate', padId: 'drums-1' },
      { t: 4, type: 'pad_activate', padId: 'bass-1' },
    ] satisfies MixEvent[],
    version: MIX_SESSION_VERSION,
    ...overrides,
  }
}

export function runRepositoryContract(label: string, factory: RepositoryFactory): void {
  describe(`MixRepository contract — ${label}`, () => {
    let repo: MixRepository

    beforeEach(async () => {
      repo = await factory.create()
    })

    it('get() on an unknown id returns null', async () => {
      expect(await repo.get('nope')).toBeNull()
    })

    it('list() on an empty repo returns []', async () => {
      expect(await repo.list()).toEqual([])
    })

    it('put + get round-trips a full session', async () => {
      const session = buildSession({ id: 'mix_a', title: 'Round-trip' })
      await repo.put(session)

      const got = await repo.get('mix_a')
      expect(got).not.toBeNull()
      expect(got).toEqual(session)
    })

    it('list() returns newest-first by createdAtMs', async () => {
      await repo.put(buildSession({ id: 'mix_old', createdAtMs: 1_000 }))
      await repo.put(buildSession({ id: 'mix_new', createdAtMs: 9_000 }))
      await repo.put(buildSession({ id: 'mix_mid', createdAtMs: 5_000 }))

      const list = await repo.list()
      expect(list.map((s) => s.id)).toEqual(['mix_new', 'mix_mid', 'mix_old'])
    })

    it('put with the same id overwrites the session', async () => {
      await repo.put(buildSession({ id: 'mix_x', title: 'v1', durationBeats: 8 }))
      await repo.put(buildSession({ id: 'mix_x', title: 'v2', durationBeats: 16 }))

      const got = await repo.get('mix_x')
      expect(got!.title).toBe('v2')
      expect(got!.durationBeats).toBe(16)
    })

    it('delete removes the session; subsequent get returns null', async () => {
      await repo.put(buildSession({ id: 'mix_d' }))
      await repo.delete('mix_d')
      expect(await repo.get('mix_d')).toBeNull()
      expect(await repo.list()).toEqual([])
    })

    it('delete is idempotent — deleting a missing id resolves silently', async () => {
      await expect(repo.delete('nope')).resolves.toBeUndefined()
    })

    it('patchTitle updates only the title', async () => {
      const session = buildSession({ id: 'mix_p', title: 'old' })
      await repo.put(session)
      await repo.patchTitle('mix_p', 'new')

      const got = await repo.get('mix_p')
      expect(got!.title).toBe('new')
      // Other fields untouched.
      expect(got!.events).toEqual(session.events)
      expect(got!.bpm).toBe(session.bpm)
    })

    it('patchTitle on unknown id is a no-op', async () => {
      await expect(repo.patchTitle('nope', 'x')).resolves.toBeUndefined()
    })

    it('survives all-fields round-trip including unicode + nested events', async () => {
      const session = buildSession({
        id: 'mix_full',
        title: 'Title — émoji 🎛 unicode',
        kitId: 'kit_zeta',
        bpm: 120,
        durationBeats: 16,
        createdAtMs: 1_700_000_000_001,
        events: [
          { t: 0, type: 'pad_activate', padId: 'drums-1' },
          { t: 1.5, type: 'pad_activate', padId: 'bass-2' },
          { t: 3, type: 'one_shot', padId: 'fx-1' },
          { t: 4, type: 'bank_switch', bank: 'B' },
          { t: 8, type: 'fx_bypass_toggle', bank: 'A', blockId: 'block-0' },
          { t: 12, type: 'pad_deactivate', padId: 'drums-1' },
        ],
      })
      await repo.put(session)
      const got = await repo.get('mix_full')
      expect(got).toEqual(session)
    })

    it('list reflects state after a put → delete → put cycle', async () => {
      await repo.put(buildSession({ id: 'mix_c', title: 'first' }))
      await repo.delete('mix_c')
      await repo.put(buildSession({ id: 'mix_c', title: 'reborn' }))

      const list = await repo.list()
      expect(list).toHaveLength(1)
      expect(list[0]!.title).toBe('reborn')
    })
  })
}
