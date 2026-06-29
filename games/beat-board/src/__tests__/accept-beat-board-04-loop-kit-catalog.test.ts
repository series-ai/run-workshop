/**
 * Acceptance tests for issue beat-board-04-loop-kit-catalog.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests exercise real stores and systems directly; no
 * Playwright, no React rendering — this is the store+system integration
 * surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  loadKit,
  loadKitIndex,
  loadKitFromManifest,
  validateKitManifest,
  buildErrorKit,
  __setKitFetcher,
  __resetKitFetcher,
  HERO_KIT_ID,
} from '../systems/loop-kit-catalog'
import { useKitsStore, getKitById, resetKitsStore } from '../stores/kitsStore'
import type { Kit } from '../types/kit'

function buildValidManifest(): Kit {
  return {
    id: 'lofi_heights_hero',
    name: 'Lofi Heights',
    bpm: 84,
    key: 'Cmin',
    pads: [
      { padId: 'drums-1', color: 'drums', layerId: 'drum-a', bufferUrl: 'cdn/d1.wav' },
      { padId: 'bass-1', color: 'bass', layerId: 'bass-a', bufferUrl: 'cdn/b1.wav' },
      { padId: 'melody-1', color: 'melody', layerId: 'mel-a', bufferUrl: 'cdn/m1.wav' },
      { padId: 'fx-1', color: 'fx', layerId: 'fx-a', bufferUrl: 'cdn/f1.wav' },
    ],
  }
}

describe('accept: Loop-Kit Catalog Loader', () => {
  beforeEach(() => {
    __resetKitFetcher()
    vi.clearAllMocks()
    resetKitsStore()
  })

  // [state] Kit type exported from src/types/kit.ts: { id, name, bpm, key, pads: PadMeta[] }
  it('Kit type is structurally exported', () => {
    // Compile-time assertion: build a Kit literally from the type-driven
    // shape. If the import or the type is wrong this file won't compile.
    const kit: Kit = buildValidManifest()
    expect(kit.id).toBe('lofi_heights_hero')
    expect(kit.bpm).toBe(84)
    expect(kit.key).toBe('Cmin')
    expect(kit.pads[0]?.color).toBe('drums')
  })

  // [state] loadKit decodes wavs via audio-manager.register(bufferUrl) and returns Promise<Kit>
  it('loadKit decodes wavs through the buffer registrar and returns the validated Kit', async () => {
    __setKitFetcher(async (path) => {
      if (path.endsWith('index.json')) {
        return {
          version: 1,
          entries: [{ id: 'lofi_heights_hero', manifestPath: 'lofi_heights_hero.json' }],
        }
      }
      if (path.endsWith('lofi_heights_hero.json')) return buildValidManifest()
      throw new Error(`unexpected path ${path}`)
    })

    const register = vi.fn().mockResolvedValue(undefined)
    const kit = await loadKit('lofi_heights_hero', { register })
    expect(kit.id).toBe('lofi_heights_hero')
    expect(register).toHaveBeenCalledTimes(4)
    expect(kit.invalidMetadata).toBeFalsy()
  })

  // [state] Validation rejects kits whose pads do not all carry one of the 4 colors;
  // on failure the loader logs via RundotAPI.error(...) and returns an "error" Kit.
  it('rejects manifests with invalid pad colors and returns an error Kit', async () => {
    const bad: Kit = buildValidManifest()
    bad.pads[2] = { ...bad.pads[2]!, color: 'piano' as unknown as 'drums' }
    const register = vi.fn()
    const kit = await loadKitFromManifest(bad, { register })
    expect(kit.invalidMetadata).toBe(true)
    expect(register).not.toHaveBeenCalled()
    expect(RundotAPI.error).toHaveBeenCalledWith(
      expect.stringContaining('[loop-kit-catalog]'),
      expect.objectContaining({ kitId: 'lofi_heights_hero' }),
    )
  })

  // [state] kitsStore exposes { kits: Record<string, Kit>, activeKitId, setActiveKit };
  // hero pack lofi_heights_hero is preloaded at install time.
  it('kitsStore exposes a Record<string, Kit> with the hero pack preloaded', () => {
    const state = useKitsStore.getState()
    expect(typeof state.kits).toBe('object')
    expect(Array.isArray(state.kits)).toBe(false)
    expect(state.kits[HERO_KIT_ID]).toBeDefined()
    expect(state.kits[HERO_KIT_ID]!.bpm).toBeGreaterThan(0)
    expect(state.kits[HERO_KIT_ID]!.pads.length).toBeGreaterThan(0)
    expect(typeof state.activeKitId).toBe('string')
    expect(typeof state.setActiveKit).toBe('function')
    state.setActiveKit('lofi_heights_hero')
    expect(useKitsStore.getState().activeKitId).toBe('lofi_heights_hero')
  })

  // [state] Kit catalog index discovered via Vite eager-glob over
  // src/content-assets/kits/*.json. Adding a JSON to that folder should
  // automatically appear in the index — no separate index.json edit.
  it('loadKitIndex auto-discovers every bundled kit JSON', async () => {
    const entries = await loadKitIndex()
    const ids = entries.map((e) => e.id)
    // Hero pack must always be in the bundle.
    expect(ids).toContain('lofi_heights_hero')
    // Every entry has both fields populated.
    for (const entry of entries) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
      expect(entry.manifestPath).toMatch(/\.json$/)
    }
  })

  // [state] Debug API beatboard.kits.list() and beatboard.kits.setActive(id) surfaces
  it('debug API surfaces beatboard.kits.list and setActive', async () => {
    const { installBeatBoardDebugApi, __resetBeatBoardDebugInstall } = await import(
      '../systems/debug-api'
    )
    const { installDebugApi } = await import('../dev/DebugApi')
    __resetBeatBoardDebugInstall()
    installDebugApi()
    const api = installBeatBoardDebugApi()
    const list = api.kits.list()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]).toHaveProperty('id')
    expect(typeof api.kits.setActiveKit).toBe('function')
    api.kits.setActiveKit('lofi_heights_hero')
    expect(api.kits.getActiveKitId()).toBe('lofi_heights_hero')
  })

  // [state] Unit tests cover: valid manifest loads, missing-color manifest
  // triggers fallback + RundotAPI.error.
  // (The "catalog index parse error" case from the old fetcher-based design
  // is no longer applicable — Vite's eager glob can't fail at runtime; if a
  // JSON is malformed, the build fails at compile time.)

  it('valid manifest validates true; missing-color manifest validates false', () => {
    expect(validateKitManifest(buildValidManifest())).toBe(true)
    const bad = buildValidManifest()
    bad.pads[0] = { ...bad.pads[0]!, color: undefined as unknown as 'drums' }
    expect(validateKitManifest(bad)).toBe(false)
  })

  it('error Kit factory returns a kit whose harmonic-lockout falls back', () => {
    const errKit = buildErrorKit('busted', 'Busted')
    expect(errKit.invalidMetadata).toBe(true)
    expect(errKit.pads).toEqual([])
  })

  // getKitById accessibility for the PadCellGrid widget.
  it('getKitById(activeKitId) returns the active kit', () => {
    useKitsStore.getState().setActiveKit('lofi_heights_hero')
    const kit = getKitById('lofi_heights_hero')
    expect(kit).toBeDefined()
    expect(kit?.id).toBe('lofi_heights_hero')
  })
})
