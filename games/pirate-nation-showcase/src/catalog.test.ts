import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  audioAssetReference,
  avatarAssetReference,
  buildCollisionIndex,
  formatBytes,
  gridFootprint,
  isCollisionModel,
  loadModels,
  menuBackgroundAssetReference,
  modelAssetReference,
  spriteAssetReference,
  thumbnailAssetReference,
  type PirateNationModelEntry,
} from './catalog'
describe('asset references', () => {
  it('maps a model entry to the models pack', () => {
    expect(modelAssetReference({ relativePath: 'models/ships/ship.glb' })).toEqual({
      pack: 'models',
      path: 'ships/ship.glb',
    })
  })

  it('maps an avatar path to the models pack', () => {
    expect(avatarAssetReference('runtime/models/characters-skins/avatar.glb')).toEqual({
      pack: 'models',
      path: 'characters-skins/avatar.glb',
    })
  })

  it('derives a model preview path beside its category', () => {
    expect(thumbnailAssetReference({
      id: 'ships-ship-pirate-xl',
      relativePath: 'models/ships/ships-ship-pirate-xl.glb',
    })).toEqual({
      pack: 'models',
      path: 'ships/Previews/ships-ship-pirate-xl.jpg',
    })
  })

  it('maps icons and UI sprites to their respective packs', () => {
    expect(spriteAssetReference({
      category: 'icons',
      relativePath: 'sprites/icons/coin.png',
    })).toEqual({ pack: 'icons', path: 'coin.png' })
    expect(spriteAssetReference({
      category: 'ui',
      relativePath: 'sprites/ui/button.png',
    })).toEqual({ pack: 'ui', path: 'button.png' })
  })

  it('maps audio metadata to the CDN MP3 path', () => {
    expect(audioAssetReference({ relativePath: 'audio/music/track.wav' })).toEqual({
      pack: 'audio',
      path: 'music/track.mp3',
    })
  })

  it('maps the Home menu background to the pinned UI pack', () => {
    expect(menuBackgroundAssetReference()).toEqual({
      pack: 'ui',
      path: 'branding-menu-background.png',
    })
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

  it('fetches the models catalog from the local catalog path', async () => {
    const payload = [{ id: 'ships-boat' }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Cache is module-level; use a unique path via loadModels once.
    const result = await loadModels()
    expect(fetchMock).toHaveBeenCalledWith('catalog/pirate-nation/models.json')
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
