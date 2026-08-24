import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCollisionIndex,
  formatBytes,
  gridFootprint,
  isCollisionModel,
  loadModels,
  PACK_BASE_URL,
  packAssetUrl,
  runtimeAssetUrl,
  type PirateNationModelEntry,
} from './catalog'

describe('asset URL builders', () => {
  it('joins catalog relative paths under runtime/', () => {
    expect(runtimeAssetUrl({ relativePath: 'models/ships/ships-boat.glb' })).toBe(
      `${PACK_BASE_URL}/runtime/models/ships/ships-boat.glb`,
    )
  })

  it('joins pack-relative paths that already include runtime/', () => {
    expect(packAssetUrl('runtime/models/characters-skins/x.glb')).toBe(
      `${PACK_BASE_URL}/runtime/models/characters-skins/x.glb`,
    )
  })
})

describe('formatBytes', () => {
  it('renders bytes, KB, and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(12_430_000)).toBe('11.85 MB')
  })
})

describe('gridFootprint', () => {
  it('reads the footprint encoded in asset ids', () => {
    expect(gridFootprint('buildings-building-4x8-blacksmith')).toBe('4×8')
    expect(gridFootprint('world-bosses-creature-16x16-kraken')).toBe('16×16')
  })

  it('returns null when the id carries no footprint', () => {
    expect(gridFootprint('ships-boat')).toBeNull()
  })
})

describe('catalog loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the models catalog from the pack base URL', async () => {
    const payload = [{ id: 'ships-boat' }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Cache is module-level; use a unique path via loadModels once.
    const result = await loadModels()
    expect(fetchMock).toHaveBeenCalledWith(`${PACK_BASE_URL}/runtime/models.json`)
    expect(result).toEqual(payload)
  })

  it('throws a descriptive error when the catalog is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    // manifest.json is not cached yet in this test process.
    const { loadManifest } = await import('./catalog')
    await expect(loadManifest()).rejects.toThrow(/manifest\.json.*404/)
  })
})

function fakeModel(id: string): PirateNationModelEntry {
  return {
    id,
    name: id,
    category: 'ships',
    filename: `${id}.glb`,
    relativePath: `models/ships/${id}.glb`,
    sizeBytes: 1,
    bounds: { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1] },
    normalizedShift: 0,
    sourceRelativePath: `src/${id}.gltf`,
    license: 'MIT',
    copyright: 'test',
  }
}

describe('isCollisionModel', () => {
  it('detects the -collision id suffix', () => {
    expect(isCollisionModel(fakeModel('ships-raft-collision'))).toBe(true)
    expect(isCollisionModel(fakeModel('ships-raft'))).toBe(false)
  })
})

describe('buildCollisionIndex', () => {
  it('maps visual ids to their collision counterpart', () => {
    const raft = fakeModel('ships-raft')
    const raftCollision = fakeModel('ships-raft-collision')
    const buoy = fakeModel('world-buoy')
    const index = buildCollisionIndex([raft, raftCollision, buoy])
    expect(index.get('ships-raft')).toBe(raftCollision)
    expect(index.has('world-buoy')).toBe(false)
    expect(index.size).toBe(1)
  })

  it('skips collision entries with no visual counterpart', () => {
    const index = buildCollisionIndex([fakeModel('ghost-collision')])
    expect(index.size).toBe(0)
  })
})
