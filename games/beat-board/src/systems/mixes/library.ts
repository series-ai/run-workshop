/**
 * MixLibrary — the only surface UI code talks to for saved mixes.
 *
 * Pure orchestrator: takes a `MixRepository`, exposes
 * `save / list / get / rename / delete / hydrate` and a subscriber list
 * so consumers (Zustand store, dev panels) stay in sync.
 *
 * No object-URL lifetime tracking, no blob caching — sessions are JSON;
 * `getSession(id)` returns the timeline and the UI hands it to
 * `replay-session.ts` to drive the live engine.
 */

import {
  generateMixId,
  type ImportSharedMixInput,
  type MixId,
  type MixRepository,
  type MixSession,
  type SaveMixInput,
} from './types'

export interface MixSummary {
  id: MixId
  title: string
  kitId: string
  bpm: number
  durationBeats: number
  durationSeconds: number
  createdAtMs: number
  /** Bytes count for the serialized session — surfaced for share-payload limits. */
  serializedBytes: number
}

type Listener = (summaries: MixSummary[]) => void

function summarize(session: MixSession): MixSummary {
  const json = JSON.stringify(session)
  return {
    id: session.id,
    title: session.title,
    kitId: session.kitId,
    bpm: session.bpm,
    durationBeats: session.durationBeats,
    durationSeconds: session.bpm > 0 ? (session.durationBeats * 60) / session.bpm : 0,
    createdAtMs: session.createdAtMs,
    serializedBytes: json.length,
  }
}

export interface MixLibraryOptions {
  repository: MixRepository
  /** Inject a clock for deterministic createdAtMs in tests. */
  now?: () => number
}

export class MixLibrary {
  private readonly repo: MixRepository
  private readonly now: () => number
  private readonly cache = new Map<MixId, MixSession>()
  private readonly listeners = new Set<Listener>()
  private hydrated = false

  constructor(options: MixLibraryOptions) {
    this.repo = options.repository
    this.now = options.now ?? (() => Date.now())
  }

  // ── Public surface ────────────────────────────────────────────────────

  async hydrate(): Promise<void> {
    const sessions = await this.repo.list()
    this.cache.clear()
    for (const session of sessions) {
      this.cache.set(session.id, session)
    }
    this.hydrated = true
    this.emit()
  }

  isHydrated(): boolean {
    return this.hydrated
  }

  async save(input: SaveMixInput): Promise<MixSummary> {
    const id = generateMixId()
    const session: MixSession = {
      ...input.session,
      id,
      title: input.title,
      createdAtMs: this.now(),
    }
    await this.repo.put(session)
    this.cache.set(id, session)
    this.emit()
    return summarize(session)
  }

  async importShared(input: ImportSharedMixInput): Promise<MixSummary> {
    const existing = this.findImportedSession(input.sourceMixId)
    if (existing) return summarize(existing)

    const session: MixSession = {
      ...input.session,
      id: input.sourceMixId,
      sourceMixId: input.sourceMixId,
      title: input.title.trim() || 'Shared mix',
      createdAtMs: this.now(),
    }
    await this.repo.put(session)
    this.cache.set(session.id, session)
    this.emit()
    return summarize(session)
  }

  async rename(id: MixId, newTitle: string): Promise<MixSummary | null> {
    const trimmed = newTitle.trim()
    if (trimmed.length === 0) return null
    const existing = this.cache.get(id)
    if (!existing) return null
    const updated: MixSession = { ...existing, title: trimmed }
    this.cache.set(id, updated)
    await this.repo.patchTitle(id, trimmed)
    this.emit()
    return summarize(updated)
  }

  async delete(id: MixId): Promise<void> {
    this.cache.delete(id)
    await this.repo.delete(id)
    this.emit()
  }

  list(): MixSummary[] {
    return [...this.cache.values()]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map(summarize)
  }

  get(id: MixId): MixSummary | null {
    const session = this.cache.get(id)
    return session ? summarize(session) : null
  }

  /** Read the full session for replay / share. Null if missing. */
  getSession(id: MixId): MixSession | null {
    const session = this.cache.get(id)
    return session ? { ...session, events: session.events.map((e) => ({ ...e })) } : null
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.list())
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.cache.clear()
    this.listeners.clear()
    this.hydrated = false
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private emit(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) listener(snapshot)
  }

  private findImportedSession(sourceMixId: MixId): MixSession | null {
    return (
      this.cache.get(sourceMixId) ??
      [...this.cache.values()].find((session) => session.sourceMixId === sourceMixId) ??
      null
    )
  }
}
