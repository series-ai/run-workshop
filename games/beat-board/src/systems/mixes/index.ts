/**
 * Public surface of the mixes subsystem.
 *
 * Sessions-only architecture (mp4 blob storage was removed alongside
 * IndexedDB). The library singleton is constructed once at module load
 * and lives for the application's lifetime.
 */

import { AppStorageMixRepository } from './app-storage-repo'
import { MixLibrary } from './library'

export type { MixId, MixRepository, MixSession, SaveMixInput, MixEvent } from './types'
export type { MixSummary } from './library'
export { MixLibrary } from './library'
export { InMemoryMixRepository } from './in-memory-repo'
export { AppStorageMixRepository } from './app-storage-repo'
export {
  MIX_SESSION_VERSION,
  beatsToSeconds,
  secondsToBeats,
  sessionDurationSeconds,
} from './sessions/types'
export {
  createMixRecorder,
  setPadActionObserver,
  getPadActionObserver,
  notifyPadAction,
  type MixRecorder,
  type PadActionObserver,
} from './sessions/record-session'
export {
  createReplaySession,
  type ReplaySession,
  type ReplayState,
  type ReplayProgress,
  type PadActionEngine,
} from './sessions/replay-session'
export {
  formatDurationLabel,
  formatRelativeTimestamp,
} from './format'

let singleton: MixLibrary | null = null

export function getMixLibrary(): MixLibrary {
  if (!singleton) {
    singleton = new MixLibrary({ repository: new AppStorageMixRepository() })
  }
  return singleton
}

export function __setMixLibraryForTests(library: MixLibrary | null): void {
  if (singleton && singleton !== library) singleton.dispose()
  singleton = library
}
