/**
 * Acceptance tests for issue beat-board-12-kit-card-widget.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests render the real KitCard widget through the
 * @testing-library/react harness and assert on visible DOM, ownership chip
 * branches, the juice/punch tap animation, the trial countdown, and the
 * "NEW" indicator.
 *
 * Authored as `.test.ts` (no JSX) to match the `owns` declaration in the
 * issue frontmatter exactly. React elements are constructed via
 * `React.createElement` so the file is a valid TypeScript module.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { KitCard } from '../components/widgets/KitCard'
import type { KitMeta } from '../stores/kitsStore'

const h = React.createElement

const PADS_EMPTY = [] as const

function makeKit(overrides: Partial<KitMeta> = {}): KitMeta {
  return {
    id: 'sample-kit',
    name: 'Sample Kit',
    bpm: 90,
    key: 'Cmin',
    pads: [...PADS_EMPTY],
    flavor: 'Sample flavor.',
    bpmRange: '90',
    layers: 8,
    ownership: 'paid',
    priceRunbucks: 299,
    tier: 'genre',
    heroGradient: ['#aaa', '#444'],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('accept: KitCard widget — pack tile + ownership chip', () => {
  // ── 4:5 aspect tile + structural layout ──────────────────────────────────
  it('renders a 4:5 aspect tile with hero art on top and name + ownership chip below (size="card")', () => {
    const kit = makeKit({ id: 'kit-card-aspect', tier: 'genre', ownership: 'paid' })
    render(h(KitCard, { kit }))

    const tile = screen.getByTestId(`kit-card-${kit.id}`)
    expect(tile).toBeInTheDocument()

    // 4:5 aspect ratio is declared on the tile (or its inner Panel.Card surface).
    const aspectHost = tile.querySelector('[data-kit-aspect]') ?? tile
    const aspect =
      aspectHost.getAttribute('data-kit-aspect') ??
      (aspectHost as HTMLElement).style.aspectRatio
    expect(aspect).toMatch(/4\s*\/\s*5/)

    // Hero art sits above the meta block (DOM order = visual order).
    const hero = tile.querySelector(`[data-testid="kit-hero-${kit.id}"]`)
    const meta = tile.querySelector('[data-testid="kit-meta"]')
    expect(hero).not.toBeNull()
    expect(meta).not.toBeNull()
    expect(hero!.compareDocumentPosition(meta!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Pack name renders inside the meta block.
    expect(meta!.textContent).toMatch(/Sample Kit/)
  })

  // ── Tap animation via juice/punch (0.97 scale, 80ms) ─────────────────────
  it('tap fires onPress(kitId) after a juice/punch 0.97 scale punch over 80ms', async () => {
    vi.useFakeTimers()
    const onPress = vi.fn()
    const kit = makeKit({ id: 'kit-tap-press' })
    render(h(KitCard, { kit, onPress }))

    const tile = screen.getByTestId(`kit-card-${kit.id}`)

    // Click triggers the animation; declared duration / strength must match
    // the PRD spec (0.97 scale punch over 80ms via juice/punch).
    expect(tile.getAttribute('data-punch-duration-ms')).toBe('80')
    expect(tile.getAttribute('data-punch-target-scale')).toBe('0.97')

    act(() => {
      fireEvent.click(tile)
    })

    // Punch animation runs and onPress fires with the kit id.
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith(kit.id)
  })

  // ── Ownership chip: free → "Free" badge ──────────────────────────────────
  it('ownership="free" renders a "Free" status badge', () => {
    const kit = makeKit({ id: 'kit-free', ownership: 'free', tier: 'genre', priceRunbucks: 0 })
    render(h(KitCard, { kit }))
    const chip = screen.getByTestId(`kit-ownership-${kit.id}`)
    expect(chip.getAttribute('data-ownership')).toBe('free')
    expect(chip.textContent).toMatch(/Free/i)
  })

  // ── Ownership chip: owned → "Owned" badge ────────────────────────────────
  it('ownership="owned" renders an "Owned" status badge', () => {
    const kit = makeKit({ id: 'kit-owned', ownership: 'owned', tier: 'genre' })
    render(h(KitCard, { kit }))
    const chip = screen.getByTestId(`kit-ownership-${kit.id}`)
    expect(chip.getAttribute('data-ownership')).toBe('owned')
    expect(chip.textContent).toMatch(/Owned/i)
  })

  // ── Ownership chip: trial → countdown chip with ttlSeconds ───────────────
  it('ownership="trial" renders a "Trial — Nh Mm left" chip computed from ttlSeconds', () => {
    const kit = makeKit({ id: 'kit-trial', ownership: 'trial', tier: 'genre' })
    // 3h 25m → 3 * 3600 + 25 * 60 = 12300 seconds.
    render(h(KitCard, { kit, ttlSeconds: 12300 }))

    const chip = screen.getByTestId(`kit-ownership-${kit.id}`)
    expect(chip.getAttribute('data-ownership')).toBe('trial')
    // Rendering can cross a minute boundary between mount and assertion.
    expect(chip.textContent).toMatch(/Trial/i)
    expect(chip.textContent).toMatch(/3h\s*(24|25)m/i)
    expect(chip.textContent).toMatch(/left/i)
  })

  it('ownership="trial" countdown updates each minute (not per-second)', () => {
    vi.useFakeTimers()
    const kit = makeKit({ id: 'kit-trial-tick', ownership: 'trial', tier: 'genre' })
    // Start at 1h 1m 30s remaining.
    render(h(KitCard, { kit, ttlSeconds: 3690 }))

    const initialChip = screen.getByTestId(`kit-ownership-${kit.id}`)
    const initialText = initialChip.textContent ?? ''
    expect(initialText).toMatch(/1h\s*1m/i)

    // Advance 30 seconds — should NOT change the visible minute.
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    const afterShort = screen.getByTestId(`kit-ownership-${kit.id}`).textContent ?? ''
    expect(afterShort).toMatch(/1h\s*1m/i)

    // Advance another 31 seconds (61s total) — minute should tick down.
    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    const afterMinute = screen.getByTestId(`kit-ownership-${kit.id}`).textContent ?? ''
    expect(afterMinute).toMatch(/1h\s*0m/i)
  })

  // ── Ownership chip: paid → RunbucksPriceChip ─────────────────────────────
  it('ownership="paid" displays a RunbucksPriceChip with the kit price', () => {
    const kit = makeKit({ id: 'kit-paid-299', ownership: 'paid', priceRunbucks: 299 })
    render(h(KitCard, { kit }))
    const chip = screen.getByTestId(`kit-ownership-${kit.id}`)
    expect(chip.getAttribute('data-ownership')).toBe('paid')
    const priceChip = chip.querySelector('[data-testid="runbucks-price-chip"]')
    expect(priceChip).not.toBeNull()
    expect(priceChip!.textContent).toMatch(/299/)
  })

  it('ownership="paid" renders the 499 Runbucks price for themed packs', () => {
    const kit = makeKit({
      id: 'kit-paid-499',
      ownership: 'paid',
      priceRunbucks: 499,
      tier: 'themed',
    })
    render(h(KitCard, { kit }))
    const chip = screen.getByTestId(`kit-ownership-${kit.id}`)
    const priceChip = chip.querySelector('[data-testid="runbucks-price-chip"]')
    expect(priceChip).not.toBeNull()
    expect(priceChip!.textContent).toMatch(/499/)
  })

  it('ownership="paid" renders the 1499 Runbucks price for premium packs', () => {
    const kit = makeKit({
      id: 'kit-paid-1499',
      ownership: 'paid',
      priceRunbucks: 1499,
      tier: 'pack-pass',
    })
    render(h(KitCard, { kit }))
    const chip = screen.getByTestId(`kit-ownership-${kit.id}`)
    const priceChip = chip.querySelector('[data-testid="runbucks-price-chip"]')
    expect(priceChip).not.toBeNull()
    // formatBalance abbreviates: 1499 stays as raw integer (< 10K threshold).
    expect(priceChip!.textContent).toMatch(/1499|1\.4K|1\.5K/)
  })

  // ── Mini variant (Mixes mix-source chip) ─────────────────────────────────
  it('size="mini" renders the mini chip with smaller hero art, name only, no ownership chip', () => {
    const kit = makeKit({ id: 'kit-mini', name: 'Mini Kit', ownership: 'paid' })
    render(h(KitCard, { kit, size: 'mini' }))

    // Mini chip uses a distinct testid so we can scope assertions.
    const chip = screen.getByTestId(`kit-chip-${kit.id}`)
    expect(chip).toBeInTheDocument()
    expect(chip.getAttribute('data-kit-size')).toBe('mini')
    expect(chip.textContent).toMatch(/Mini Kit/)

    // No ownership chip in mini variant.
    expect(chip.querySelector(`[data-testid="kit-ownership-${kit.id}"]`)).toBeNull()
    // No RunbucksPriceChip in mini variant.
    expect(chip.querySelector('[data-testid="runbucks-price-chip"]')).toBeNull()
  })

  // ── Hero variant (KitDetail full-bleed band) ─────────────────────────────
  it('size="hero" renders a full-bleed 16:9 hero band with no chip overlay', () => {
    const kit = makeKit({ id: 'kit-hero', ownership: 'paid' })
    render(h(KitCard, { kit, size: 'hero' }))

    const heroTile = screen.getByTestId(`kit-hero-tile-${kit.id}`)
    expect(heroTile).toBeInTheDocument()
    expect(heroTile.getAttribute('data-kit-size')).toBe('hero')

    // 16:9 aspect declared on the hero band.
    const aspect =
      heroTile.getAttribute('data-kit-aspect') ?? (heroTile as HTMLElement).style.aspectRatio
    expect(aspect).toMatch(/16\s*\/\s*9/)

    // No ownership chip overlays the hero art.
    expect(heroTile.querySelector(`[data-testid="kit-ownership-${kit.id}"]`)).toBeNull()
  })

  // ── isNew prop → "NEW" dot top-right ─────────────────────────────────────
  it('isNew=true displays a "NEW" dot in the top-right of the tile', () => {
    const kit = makeKit({ id: 'kit-new', ownership: 'paid' })
    render(h(KitCard, { kit, isNew: true }))
    const dot = screen.getByTestId(`kit-new-dot-${kit.id}`)
    expect(dot).toBeInTheDocument()
    expect(dot.textContent).toMatch(/NEW/i)
  })

  it('isNew=false (default) does not render the NEW dot', () => {
    const kit = makeKit({ id: 'kit-no-new', ownership: 'paid' })
    render(h(KitCard, { kit }))
    expect(screen.queryByTestId(`kit-new-dot-${kit.id}`)).toBeNull()
  })
})
