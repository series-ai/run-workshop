/**
 * `AppStorageMixRepository` — production `MixRepository`.
 *
 * Sessions are JSON in `RundotAPI.appStorage`. Cloud-synced for PLUS
 * players for free. No IndexedDB dependency anywhere — the move from
 * mp4 blobs to event-timeline sessions removed the only thing that
 * couldn't fit in appStorage's string-only API.
 *
 * Keys MUST NOT contain `.` per STORAGE.md — we use `beatboard_mix_<id>`.
 * The mix list is tracked through an explicit index so boot hydration reads
 * known save IDs directly instead of scanning the full storage bucket.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { MixId, MixRepository, MixSession } from './types'

const KEY_PREFIX = 'beatboard_mix_'
const INDEX_KEY = 'beatboard_mixes_index'

function metadataKey(id: MixId): string {
  return `${KEY_PREFIX}${id}`
}

interface AppStorage {
  setItem: (k: string, v: string) => Promise<void> | void
  getItem: (k: string) => Promise<string | null> | string | null
  removeItem: (k: string) => Promise<void> | void
}

function getAppStorage(): AppStorage {
  const api = RundotAPI as unknown as { appStorage?: AppStorage }
  if (!api.appStorage) {
    throw new Error('AppStorageMixRepository: RundotAPI.appStorage is unavailable')
  }
  return api.appStorage
}

function parseSession(raw: string | null | undefined): MixSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as MixSession
    if (!parsed?.id || !Array.isArray(parsed.events)) return null
    return parsed
  } catch (err) {
    RundotAPI.error('AppStorageMixRepository: parse failed', { err: String(err) })
    return null
  }
}

function parseIndex(raw: string | null | undefined): MixId[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return [
      ...new Set(parsed.filter((id): id is MixId => typeof id === 'string' && id.length > 0)),
    ]
  } catch (err) {
    RundotAPI.error('AppStorageMixRepository: index parse failed', { err: String(err) })
    return []
  }
}

async function readIndex(storage: AppStorage): Promise<{ found: boolean; ids: MixId[] }> {
  const raw = await storage.getItem(INDEX_KEY)
  if (!raw) return { found: false, ids: [] }
  return { found: true, ids: parseIndex(raw) }
}

async function writeIndex(storage: AppStorage, ids: MixId[]): Promise<void> {
  const uniqueIds = [...new Set(ids)]
  await storage.setItem(INDEX_KEY, JSON.stringify(uniqueIds))
}

function sortNewestFirst(sessions: MixSession[]): MixSession[] {
  return sessions.sort((a, b) => b.createdAtMs - a.createdAtMs)
}

export class AppStorageMixRepository implements MixRepository {
  async put(session: MixSession): Promise<void> {
    const storage = getAppStorage()
    await storage.setItem(metadataKey(session.id), JSON.stringify(session))
    const index = await readIndex(storage)
    await writeIndex(storage, [...index.ids.filter((id) => id !== session.id), session.id])
  }

  async get(id: MixId): Promise<MixSession | null> {
    const raw = await getAppStorage().getItem(metadataKey(id))
    return parseSession(raw)
  }

  async list(): Promise<MixSession[]> {
    const storage = getAppStorage()
    let index: { found: boolean; ids: MixId[] }
    try {
      index = await readIndex(storage)
    } catch (err) {
      RundotAPI.error('AppStorageMixRepository: index read failed', { err: String(err) })
      return []
    }
    const sessions: MixSession[] = []
    const liveIds: MixId[] = []
    for (const id of index.ids) {
      const session = parseSession(await storage.getItem(metadataKey(id)))
      if (!session) continue
      sessions.push(session)
      liveIds.push(session.id)
    }
    if (liveIds.length !== index.ids.length) {
      try {
        await writeIndex(storage, liveIds)
      } catch (err) {
        RundotAPI.error('AppStorageMixRepository: index cleanup failed', { err: String(err) })
      }
    }
    return sortNewestFirst(sessions)
  }

  async patchTitle(id: MixId, title: string): Promise<void> {
    const existing = await this.get(id)
    if (!existing) return
    await this.put({ ...existing, title })
  }

  async delete(id: MixId): Promise<void> {
    const storage = getAppStorage()
    await storage.removeItem(metadataKey(id))
    const index = await readIndex(storage)
    if (index.found) {
      await writeIndex(storage, index.ids.filter((indexedId) => indexedId !== id))
    }
  }
}
