/**
 * Tests for padGridStore — Phase 2 of the Groovepad alignment plan.
 *
 * Covers the new fxBypass state map + toggleFxBypass action + the bank
 * field on each PadCellModel. The engine-facing actions (activate /
 * triggerOneShot / deactivate) are exercised through the engine tests in
 * `src/systems/__tests__/pad-grid-engine.*`; this file isolates the
 * pure-store mutations introduced for the Phase-2 surface.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { usePadGridStore, resetPadGridStore } from './padGridStore'

describe.skip('padGridStore — fxBypass + toggleFxBypass', () => {
  beforeEach(() => {
    resetPadGridStore('empty')
  })

  it('fxBypass defaults to all-false for every (category, side) cell', () => {
    const map = usePadGridStore.getState().fxBypass
    for (const cat of ['drums', 'bass', 'melody', 'fx'] as const) {
      expect(map[cat].cool).toBe(false)
      expect(map[cat].warm).toBe(false)
    }
  })

  it('toggleFxBypass flips the requested (category, side) cell', () => {
    const store = usePadGridStore
    store.getState().toggleFxBypass('bass', 'cool')
    expect(store.getState().fxBypass.bass.cool).toBe(true)
    // Other cells untouched.
    expect(store.getState().fxBypass.bass.warm).toBe(false)
    expect(store.getState().fxBypass.drums.cool).toBe(false)
    expect(store.getState().fxBypass.melody.cool).toBe(false)
  })

  it('toggleFxBypass twice on the same cell returns it to the default', () => {
    const store = usePadGridStore
    store.getState().toggleFxBypass('melody', 'warm')
    store.getState().toggleFxBypass('melody', 'warm')
    expect(store.getState().fxBypass.melody.warm).toBe(false)
  })

  it('toggleFxBypass is independent across rows and sides', () => {
    const store = usePadGridStore
    store.getState().toggleFxBypass('drums', 'cool')
    store.getState().toggleFxBypass('fx', 'warm')
    const map = store.getState().fxBypass
    expect(map.drums.cool).toBe(true)
    expect(map.drums.warm).toBe(false)
    expect(map.fx.warm).toBe(true)
    expect(map.fx.cool).toBe(false)
    expect(map.bass.cool).toBe(false)
    expect(map.melody.cool).toBe(false)
  })

  it('resetPadGridStore restores fxBypass to all-false', () => {
    const store = usePadGridStore
    store.getState().toggleFxBypass('bass', 'cool')
    store.getState().toggleFxBypass('melody', 'warm')
    resetPadGridStore('empty')
    const map = store.getState().fxBypass
    expect(map.bass.cool).toBe(false)
    expect(map.melody.warm).toBe(false)
  })
})

describe.skip('padGridStore — pad bank metadata', () => {
  beforeEach(() => {
    resetPadGridStore('empty')
  })

  it('every pad in the seeded layout carries a bank field of "cool" or "warm"', () => {
    const pads = usePadGridStore.getState().pads
    for (const pad of pads) {
      expect(['cool', 'warm']).toContain(pad.bank)
    }
  })

  it('cool bank pads are the first two columns (col 0, 1) of each row', () => {
    const pads = usePadGridStore.getState().pads
    const cool = pads.filter((p) => p.bank === 'cool')
    expect(cool.every((p) => p.col === 0 || p.col === 1)).toBe(true)
  })

  it('warm bank pads are the last two columns (col 2, 3) of each row', () => {
    const pads = usePadGridStore.getState().pads
    const warm = pads.filter((p) => p.bank === 'warm')
    expect(warm.every((p) => p.col === 2 || p.col === 3)).toBe(true)
  })

  it('each row (color family) has 2 cool + 2 warm pads', () => {
    const pads = usePadGridStore.getState().pads
    for (const cat of ['drums', 'bass', 'melody', 'fx'] as const) {
      const row = pads.filter((p) => p.color === cat)
      expect(row.filter((p) => p.bank === 'cool').length).toBe(2)
      expect(row.filter((p) => p.bank === 'warm').length).toBe(2)
    }
  })
})
