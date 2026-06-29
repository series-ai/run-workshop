/**
 * Mixes store — thin Zustand mirror of `MixLibrary.list()`.
 *
 * Sessions-only: each mix is a JSON timeline (no blobs anywhere). The
 * library is the source of truth; this store re-syncs via subscriber.
 *
 * Imported (shared-via-link) mixes are full sessions too — the share
 * payload carries the entire timeline, and the library records sourceMixId
 * so repeated link opens do not duplicate the same imported row.
 */

import { create } from 'zustand'
import {
  getMixLibrary,
  type MixSummary as LibraryMixSummary,
} from '../systems/mixes'

/** Row shape consumed by `MyMixesScreen`. */
export interface MixSummary {
  id: string
  title: string
  kitId: string
  bpm: number
  durationBeats: number
  durationSeconds: number
  createdAtMs: number
  serializedBytes: number
  /** True until the player taps the row. */
  isUnviewed: boolean
}

export type MixesLoadStatus = 'idle' | 'hydrating' | 'ready'

interface MixesState {
  mixes: MixSummary[]
  loadStatus: MixesLoadStatus
  unviewedCount: number
  markAllViewed: () => void
  getMix: (id: string) => MixSummary | undefined
}

function summaryFromLibrary(s: LibraryMixSummary): MixSummary {
  return {
    id: s.id,
    title: s.title,
    kitId: s.kitId,
    bpm: s.bpm,
    durationBeats: s.durationBeats,
    durationSeconds: s.durationSeconds,
    createdAtMs: s.createdAtMs,
    serializedBytes: s.serializedBytes,
    isUnviewed: false,
  }
}

export const useMixesStore = create<MixesState>((set, get) => ({
  mixes: [],
  loadStatus: 'idle',
  unviewedCount: 0,

  markAllViewed: () =>
    set({
      mixes: get().mixes.map((m) => ({ ...m, isUnviewed: false })),
      unviewedCount: 0,
    }),

  getMix: (id) => get().mixes.find((m) => m.id === id),
}))

// ── Library subscription ─────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null

export function installMixLibraryBinding(): () => void {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  unsubscribe = getMixLibrary().subscribe((rows) => {
    const merged = rows.map(summaryFromLibrary)
    useMixesStore.setState({
      mixes: merged,
      unviewedCount: merged.filter((m) => m.isUnviewed).length,
    })
  })
  return unsubscribe
}

export async function hydrateMixesAtBoot(): Promise<void> {
  installMixLibraryBinding()
  useMixesStore.setState({ loadStatus: 'hydrating' })
  try {
    await getMixLibrary().hydrate()
  } finally {
    useMixesStore.setState({ loadStatus: 'ready' })
  }
}

// ── Test helpers ─────────────────────────────────────────────────────────

export function resetMixesStore(): void {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  useMixesStore.setState({
    mixes: [],
    loadStatus: 'idle',
    unviewedCount: 0,
  })
}

// ── Mutation facades ─────────────────────────────────────────────────────

export async function saveMix(
  input: Parameters<ReturnType<typeof getMixLibrary>['save']>[0],
): Promise<MixSummary> {
  const summary = await getMixLibrary().save(input)
  return summaryFromLibrary(summary)
}

export async function importSharedMix(
  input: Parameters<ReturnType<typeof getMixLibrary>['importShared']>[0],
): Promise<MixSummary> {
  const summary = await getMixLibrary().importShared(input)
  return summaryFromLibrary(summary)
}

export async function renameMix(id: string, newTitle: string): Promise<void> {
  await getMixLibrary().rename(id, newTitle)
}

export async function deleteMix(id: string): Promise<void> {
  await getMixLibrary().delete(id)
}

/** Read the full session timeline for replay or share. Null if missing. */
export function getMixSession(id: string): ReturnType<ReturnType<typeof getMixLibrary>['getSession']> {
  return getMixLibrary().getSession(id)
}

// Module-load: install the binding so any caller that imports the store
// automatically sees the live library.
installMixLibraryBinding()
