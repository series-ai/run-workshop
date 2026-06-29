/**
 * In-memory `MixRepository` — used by unit tests and Storybook fixtures.
 *
 * Stores sessions as plain JSON-cloned values to mirror the appStorage
 * repo's serialise/deserialise round-trip (so a buggy non-serialisable
 * field surfaces in tests, not just in production).
 */

import type { MixId, MixRepository, MixSession } from './types'

export class InMemoryMixRepository implements MixRepository {
  private readonly entries = new Map<MixId, MixSession>()

  async put(session: MixSession): Promise<void> {
    this.entries.set(session.id, JSON.parse(JSON.stringify(session)) as MixSession)
  }

  async get(id: MixId): Promise<MixSession | null> {
    const session = this.entries.get(id)
    if (!session) return null
    return JSON.parse(JSON.stringify(session)) as MixSession
  }

  async list(): Promise<MixSession[]> {
    const records: MixSession[] = []
    for (const session of this.entries.values()) {
      records.push(JSON.parse(JSON.stringify(session)) as MixSession)
    }
    records.sort((a, b) => b.createdAtMs - a.createdAtMs)
    return records
  }

  async patchTitle(id: MixId, title: string): Promise<void> {
    const session = this.entries.get(id)
    if (!session) return
    this.entries.set(id, { ...session, title })
  }

  async delete(id: MixId): Promise<void> {
    this.entries.delete(id)
  }
}
