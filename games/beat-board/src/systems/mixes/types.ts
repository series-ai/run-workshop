/**
 * Mixes — types and repository contract.
 *
 * Layer 1 of the mix-library. The repository hides storage details (in-
 * memory for tests, appStorage in production) behind a small surface
 * every higher layer can mock.
 *
 * Mixes are now `MixSession` JSON — a timeline of pad-grid events. No
 * audio bytes are stored anywhere; replay drives the live audio engine
 * via `replay-session.ts`. This replaces the previous mp4-blob model.
 *
 * Why JSON-only:
 *   - per-mix size shrinks from MB to KB (a 30s take ≈ 1–4 KB)
 *   - no IndexedDB dependency — appStorage is the only backend
 *   - PLUS-tier players get cloud-synced libraries for free
 *   - share links can carry a full session in `shareParams` (~100 KB cap)
 */

import type { MixSession } from './sessions/types'

/** Stable id for a mix. */
export type MixId = string

export type { MixSession }
export type { MixEvent } from './sessions/types'

/** Argument to `library.save`. The library assigns the id + createdAtMs. */
export interface SaveMixInput {
  title: string
  /** Pre-built session timeline (kitId, bpm, events). */
  session: Omit<MixSession, 'id' | 'title'>
}

/** Argument to `library.importShared`. The library preserves/dedupes sourceMixId. */
export interface ImportSharedMixInput {
  sourceMixId: MixId
  title: string
  /** Share payload session timeline. Caller-supplied id/title are ignored. */
  session: MixSession
}

/**
 * Repository contract — the only surface MixLibrary depends on. Two impls:
 *   - `InMemoryMixRepository` for unit tests.
 *   - `AppStorageMixRepository` for production (`RundotAPI.appStorage`).
 *
 * `repository-contract.test.ts` runs the same suite against both impls.
 *
 * Error policy: every method either resolves with the documented value
 * or rejects with an Error. No silent null fallbacks.
 */
export interface MixRepository {
  /** Persist a session. Overwrites if id matches. */
  put(session: MixSession): Promise<void>
  /** Read one session by id. Resolves null if missing. */
  get(id: MixId): Promise<MixSession | null>
  /** List every session. Returns newest-first. */
  list(): Promise<MixSession[]>
  /** Update only the title; no-op if id is unknown. */
  patchTitle(id: MixId, title: string): Promise<void>
  /** Remove a session. Idempotent. */
  delete(id: MixId): Promise<void>
}

/** Helper — generate a fresh mix id using ms timestamp + 6 random chars. */
export function generateMixId(): MixId {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `mix_${ts}_${rand}`
}
