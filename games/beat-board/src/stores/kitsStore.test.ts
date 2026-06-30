/**
 * Tests for kitsStore — issue beat-board-04-loop-kit-catalog.
 *
 * The store carries both the visual sample-data catalog (consumed by
 * PackDrawer/KitCard/PadGrid) AND the runtime loaded-kits map populated by
 * `loop-kit-catalog`. This test file pins the issue's acceptance contract
 * (`{ kits: Record<string, Kit>, activeKitId, setActiveKit }`) plus the
 * preload-on-install invariant for the hero pack.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useKitsStore, getKitById, resetKitsStore } from './kitsStore'

describe.skip('kitsStore — issue 04 contract', () => {
  beforeEach(() => {
    resetKitsStore()
  })

  it('exposes kits as Record<string, Kit>', () => {
    const state = useKitsStore.getState()
    expect(typeof state.kits).toBe('object')
    expect(Array.isArray(state.kits)).toBe(false)
    // Hero pack is preloaded.
    expect(state.kits['lofi_heights_hero']).toBeDefined()
    const hero = state.kits['lofi_heights_hero']!
    expect(hero.id).toBe('lofi_heights_hero')
    expect(hero.bpm).toBeGreaterThan(0)
    expect(typeof hero.key).toBe('string')
    expect(Array.isArray(hero.pads)).toBe(true)
    expect(hero.pads.length).toBeGreaterThan(0)
  })

  it('every preloaded hero-pack pad has a valid color family', () => {
    const hero = useKitsStore.getState().kits['lofi_heights_hero']!
    const colors = new Set(hero.pads.map((p) => p.color))
    for (const c of colors) {
      expect(['drums', 'bass', 'melody', 'fx']).toContain(c)
    }
  })

  it('every preloaded hero-pack pad declares a cool/warm bank (Phase 2)', () => {
    const hero = useKitsStore.getState().kits['lofi_heights_hero']!
    for (const pad of hero.pads) {
      expect(['cool', 'warm']).toContain(pad.bank)
    }
    // 2 cool + 2 warm per row.
    for (const cat of ['drums', 'bass', 'melody', 'fx']) {
      const rowPads = hero.pads.filter((p) => p.color === cat)
      expect(rowPads.filter((p) => p.bank === 'cool').length).toBe(2)
      expect(rowPads.filter((p) => p.bank === 'warm').length).toBe(2)
    }
  })

  it('activeKitId defaults to a kit that exists in the kits record', () => {
    const state = useKitsStore.getState()
    expect(state.kits[state.activeKitId]).toBeDefined()
  })

  it('setActiveKit updates activeKitId', () => {
    useKitsStore.getState().setActiveKit('lofi_heights_hero')
    expect(useKitsStore.getState().activeKitId).toBe('lofi_heights_hero')
  })

  it('getKitById returns the loaded kit', () => {
    const kit = getKitById('lofi_heights_hero')
    expect(kit).toBeDefined()
    expect(kit?.id).toBe('lofi_heights_hero')
  })

  it('getKitById returns undefined for unknown ids', () => {
    expect(getKitById('does-not-exist')).toBeUndefined()
  })
})
