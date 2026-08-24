import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCollisionIndex,
  formatBytes,
  gridFootprint,
  isCollisionModel,
  loadModels,
  PACK_CDN_PREFIX,
  packAssetPath,
  resolvePackAssetUrl,
  runtimeAssetPath,
  setRunSdkReady,
  thumbnailPath,
  type PirateNationModelEntry,
} from './catalog'

const resolveAssetUrl = vi.fn()

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    get cdn() {
      return { resolveAssetUrl }
    },
  },
}))

// `runSdkReady` is module-level state, so reset it for every test — otherwise
// a suite that turns the SDK on leaks into the ones after it.
beforeEach(() => {
  resolveAssetUrl.mockReset()
  setRunSdkReady(false)
})

describe('pack paths', () => {
  it('builds runtime, pack, and thumbnail paths under the pack prefix', () => {
    expect(runtimeAssetPath({ relativePath: 'models/ships/ships-boat.glb' })).toBe(
      `${PACK_CDN_PREFIX}/runtime/models/ships/ships-boat.glb`,
    )
    expect(packAssetPath('runtime/models/characters-skins/x.glb')).toBe(
      `${PACK_CDN_PREFIX}/runtime/models/characters-skins/x.glb`,
    )
    expect(thumbnailPath('ships-boat')).toBe(`${PACK_CDN_PREFIX}/thumbnails/ships-boat.jpg`)
  })
})

describe('resolvePackAssetUrl', () => {
  it('serves cdn-assets/ directly when the SDK never initialized', async () => {
    await expect(resolvePackAssetUrl('pirate-nation/manifest.json')).resolves.toBe(
      'cdn-assets/pirate-nation/manifest.json',
    )
    expect(resolveAssetUrl).not.toHaveBeenCalled()
  })

  it('returns the URL the SDK resolves once it is ready', async () => {
    setRunSdkReady(true)
    resolveAssetUrl.mockResolvedValue('https://cdn.example/abc123/manifest.json')
    await expect(resolvePackAssetUrl('pirate-nation/manifest.json')).resolves.toBe(
      'https://cdn.example/abc123/manifest.json',
    )
    expect(resolveAssetUrl).toHaveBeenCalledWith('pirate-nation/manifest.json')
  })

  it('propagates a resolution failure once the SDK is ready', async () => {
    setRunSdkReady(true)
    resolveAssetUrl.mockRejectedValue(new Error('ASSET_NOT_FOUND'))
    await expect(resolvePackAssetUrl('pirate-nation/nope.json')).rejects.toThrow(/ASSET_NOT_FOUND/)
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
    expect(fetchMock).toHaveBeenCalledWith('cdn-assets/pirate-nation/runtime/models.json')
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
