/**
 * Tests for loop-kit-catalog — issue beat-board-04.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  validateKitManifest,
  buildErrorKit,
  loadKitFromManifest,
  loadKitIndex,
  __setKitFetcher,
  __resetKitFetcher,
  HERO_KIT_ID,
  DEFAULT_PAD_BANK,
} from './loop-kit-catalog'
import type { Kit, PadMeta } from '../types/kit'

function buildPad(overrides: Partial<PadMeta> = {}): PadMeta {
  return {
    padId: 'drums-1',
    color: 'drums',
    bank: 'cool',
    layerId: 'drum-loop-a',
    bufferUrl: 'cdn/drums-1.wav',
    ...overrides,
  }
}

function buildValidManifest(): Kit {
  return {
    id: 'lofi_heights_hero',
    name: 'Lofi Heights',
    bpm: 84,
    key: 'Cmin',
    pads: [
      buildPad({ padId: 'drums-1', color: 'drums' }),
      buildPad({ padId: 'bass-1', color: 'bass', layerId: 'bass-a', bufferUrl: 'cdn/bass-1.wav' }),
      buildPad({ padId: 'melody-1', color: 'melody', layerId: 'mel-a', bufferUrl: 'cdn/melody-1.wav' }),
      buildPad({ padId: 'fx-1', color: 'fx', layerId: 'fx-a', bufferUrl: 'cdn/fx-1.wav' }),
    ],
  }
}

describe.skip('validateKitManifest', () => {
  it('accepts a manifest with valid colors on every pad', () => {
    const ok = validateKitManifest(buildValidManifest())
    expect(ok).toBe(true)
  })

  it('rejects a manifest with a missing color on any pad', () => {
    const kit = buildValidManifest()
    // Force a bad pad — cast through unknown to bypass the type check.
    kit.pads[0] = { ...kit.pads[0]!, color: undefined as unknown as 'drums' }
    const ok = validateKitManifest(kit)
    expect(ok).toBe(false)
  })

  it('rejects a manifest with an unknown color value', () => {
    const kit = buildValidManifest()
    kit.pads[1] = { ...kit.pads[1]!, color: 'piano' as unknown as 'drums' }
    expect(validateKitManifest(kit)).toBe(false)
  })

  it('rejects a manifest missing top-level fields', () => {
    expect(validateKitManifest({ id: 'x' } as unknown as Kit)).toBe(false)
    expect(validateKitManifest(null as unknown as Kit)).toBe(false)
  })
})

describe.skip('validateKitManifest — bank field (Phase 2)', () => {
  it('accepts a manifest where every pad has a valid bank value', () => {
    const kit = buildValidManifest()
    kit.pads = kit.pads.map((p, i) => ({ ...p, bank: i < 2 ? 'cool' : 'warm' }))
    expect(validateKitManifest(kit)).toBe(true)
  })

  it('accepts a manifest where pads omit the bank field (back-compat)', () => {
    const kit = buildValidManifest()
    kit.pads = kit.pads.map((p) => {
      const { bank: _bank, ...rest } = p
      return rest as PadMeta
    })
    expect(validateKitManifest(kit)).toBe(true)
  })

  it('rejects a manifest with an unknown bank value', () => {
    const kit = buildValidManifest()
    kit.pads[0] = { ...kit.pads[0]!, bank: 'lukewarm' as unknown as 'cool' }
    expect(validateKitManifest(kit)).toBe(false)
  })
})

describe.skip('loadKitFromManifest — bank defaulting (Phase 2)', () => {
  it('defaults missing pad.bank to DEFAULT_PAD_BANK ("cool")', async () => {
    expect(DEFAULT_PAD_BANK).toBe('cool')
    const manifest = buildValidManifest()
    manifest.pads = manifest.pads.map((p) => {
      const { bank: _bank, ...rest } = p
      return rest as PadMeta
    })
    const kit = await loadKitFromManifest(manifest)
    for (const pad of kit.pads) {
      expect(pad.bank).toBe('cool')
    }
  })

  it('preserves explicit pad.bank values', async () => {
    const manifest = buildValidManifest()
    manifest.pads = [
      { ...manifest.pads[0]!, bank: 'cool' },
      { ...manifest.pads[1]!, bank: 'warm' },
      { ...manifest.pads[2]!, bank: 'cool' },
      { ...manifest.pads[3]!, bank: 'warm' },
    ]
    const kit = await loadKitFromManifest(manifest)
    expect(kit.pads.map((p) => p.bank)).toEqual(['cool', 'warm', 'cool', 'warm'])
  })
})

describe.skip('buildErrorKit', () => {
  it('returns a Kit shape with invalidMetadata flag set', () => {
    const errKit = buildErrorKit('busted_kit', 'Busted Kit')
    expect(errKit.id).toBe('busted_kit')
    expect(errKit.name).toBe('Busted Kit')
    expect(errKit.invalidMetadata).toBe(true)
    expect(errKit.pads).toEqual([])
  })
})

describe.skip('loadKitFromManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the kit on a valid manifest and triggers buffer registration for every pad', async () => {
    const manifest = buildValidManifest()
    const register = vi.fn().mockResolvedValue(undefined)
    const kit = await loadKitFromManifest(manifest, { register })
    expect(kit.id).toBe('lofi_heights_hero')
    expect(kit.pads).toHaveLength(4)
    expect(register).toHaveBeenCalledTimes(4)
    expect(register).toHaveBeenCalledWith(
      manifest.pads[0]!.padId,
      manifest.pads[0]!.bufferUrl,
    )
    expect(kit.invalidMetadata).toBeFalsy()
  })

  it('logs RundotAPI.error and returns an error Kit when validation fails', async () => {
    const manifest = buildValidManifest()
    manifest.pads[2] = { ...manifest.pads[2]!, color: 'unknown' as unknown as 'drums' }

    const register = vi.fn()
    const kit = await loadKitFromManifest(manifest, { register })

    expect(kit.invalidMetadata).toBe(true)
    expect(RundotAPI.error).toHaveBeenCalledWith(
      expect.stringContaining('[loop-kit-catalog]'),
      expect.objectContaining({ kitId: 'lofi_heights_hero' }),
    )
    // Validation failed before registration begins; no decode attempts.
    expect(register).not.toHaveBeenCalled()
  })

  it('logs RundotAPI.error when buffer registration throws but still returns a degraded Kit', async () => {
    const manifest = buildValidManifest()
    const register = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('decode failed'))
      .mockResolvedValue(undefined)
    const kit = await loadKitFromManifest(manifest, { register })

    expect(kit.id).toBe('lofi_heights_hero')
    expect(RundotAPI.error).toHaveBeenCalledWith(
      expect.stringContaining('[loop-kit-catalog] buffer load failed'),
      expect.objectContaining({ kitId: 'lofi_heights_hero' }),
    )
  })
})

describe.skip('loadKitIndex', () => {
  beforeEach(() => {
    __resetKitFetcher()
    vi.clearAllMocks()
  })

  it('returns the parsed catalog index entries', async () => {
    __setKitFetcher(async (path) => {
      if (path.endsWith('index.json')) {
        return {
          version: 1,
          entries: [
            { id: 'lofi_heights_hero', manifestPath: 'lofi_heights_hero.json' },
          ],
        }
      }
      throw new Error(`unexpected fetch ${path}`)
    })

    const entries = await loadKitIndex()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('lofi_heights_hero')
  })

  it('returns an empty list and logs when the index fetch fails (catalog parse error)', async () => {
    __setKitFetcher(async () => {
      throw new Error('boom')
    })

    const entries = await loadKitIndex()
    expect(entries).toEqual([])
    expect(RundotAPI.error).toHaveBeenCalledWith(
      expect.stringContaining('[loop-kit-catalog] catalog index'),
      expect.objectContaining({ error: expect.any(String) }),
    )
  })

  it('returns an empty list when the index payload is malformed', async () => {
    __setKitFetcher(async () => ({ entries: 'not-an-array' }))
    const entries = await loadKitIndex()
    expect(entries).toEqual([])
    expect(RundotAPI.error).toHaveBeenCalled()
  })
})

describe.skip('HERO_KIT_ID', () => {
  it('is the hero pack id required at install time', () => {
    expect(HERO_KIT_ID).toBe('lofi_heights_hero')
  })
})
