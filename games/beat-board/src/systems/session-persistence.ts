/**
 * session-persistence — persist + hydrate the player's last-selected
 * pack across app launches.
 *
 * Persisted: `activeKitId` only. We deliberately do NOT remember which
 * pads were active — restoring pad activations on a cold load runs
 * into the audio-context user-gesture requirement (sources scheduled
 * before the player's first tap can't actually play), and the various
 * "ask before resuming" or "auto-resume after first tap" workarounds
 * have all introduced subtler bugs that silenced the audio path. The
 * pack restores; the groove is the player's to rebuild.
 *
 * Lifecycle:
 *   - `hydrateSession()` runs at app boot, reads `activeKitId` from
 *     `appStorage`, applies it via `kitsStore.setActiveKit(...)`.
 *   - `installSessionPersistence()` subscribes to `activeKitId`
 *     changes and writes a debounced snapshot to storage. Idempotent;
 *     PadGridScreen calls it after the kit's audio is ready.
 *
 * Storage scope: `appStorage` (cloud-synced via the Rundot SDK),
 * namespaced to the `beat-board` game id.
 */

import { createStorageService, type StorageService } from '../modules/data/storage-service/StorageService'
import { useKitsStore } from '../stores/kitsStore'
import { HERO_KIT_ID } from './loop-kit-catalog'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

const STORAGE_KEY = 'session/v1'
const GAME_ID = 'beat-board'

interface PersistedSession {
  activeKitId: string
}

let storage: StorageService | null = null
let installed = false

function getStorage(): StorageService {
  if (!storage) storage = createStorageService(GAME_ID)
  return storage
}

/**
 * Read the persisted blob from storage and restore `activeKitId`. Falls
 * back to the hero kit if the persisted id is no longer in the catalog.
 */
export async function hydrateSession(): Promise<void> {
  let raw: PersistedSession | null = null
  try {
    raw = await getStorage().getJSON<PersistedSession>(STORAGE_KEY)
  } catch (err) {
    RundotAPI.error('[session-persistence] hydrate read failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return
  }
  if (!raw || typeof raw.activeKitId !== 'string') return
  const kits = useKitsStore.getState().kits
  const restoredKitId = kits[raw.activeKitId] ? raw.activeKitId : HERO_KIT_ID
  useKitsStore.getState().setActiveKit(restoredKitId)
}

/**
 * No-op compatibility shim. Earlier iterations stashed pad activations
 * for the UI to consume; that path silenced the audio engine on cold
 * load (browser user-gesture rules) so the feature was removed.
 * Callers can keep invoking this safely.
 */
export function consumePendingSession(): null {
  return null
}

/**
 * Subscribe to `activeKitId` changes and write a debounced (250 ms)
 * snapshot to storage. Idempotent.
 */
export function installSessionPersistence(): void {
  if (installed) return
  installed = true

  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleWrite = (): void => {
    if (pendingTimer !== null) return
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      void writeSnapshot()
    }, 250)
  }

  useKitsStore.subscribe((state, prev) => {
    if (state.activeKitId !== prev.activeKitId) scheduleWrite()
  })
}

async function writeSnapshot(): Promise<void> {
  const blob: PersistedSession = {
    activeKitId: useKitsStore.getState().activeKitId,
  }
  try {
    await getStorage().setJSON(STORAGE_KEY, blob)
  } catch (err) {
    RundotAPI.error('[session-persistence] write failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/** Test helper — blow away the in-memory wired state. */
export function __resetSessionPersistenceForTest(): void {
  installed = false
  storage = null
}
