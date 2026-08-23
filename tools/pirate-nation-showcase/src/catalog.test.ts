import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatBytes,
  gridFootprint,
  loadModels,
  PACK_BASE_URL,
  packAssetUrl,
  runtimeAssetUrl,
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
