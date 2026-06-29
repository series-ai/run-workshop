/**
 * Acceptance tests for issue beat-board-11-runbucks-price-chip-widget.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests render the real RunbucksPriceChip widget through the
 * @testing-library/react harness and exercise the useRunbucksIcon() hook.
 *
 * Authored as `.test.ts` (no JSX) to match the `owns` declaration in the
 * issue frontmatter exactly. React elements are constructed via
 * React.createElement so the file is a valid TypeScript module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import { RunbucksPriceChip } from '../components/widgets/RunbucksPriceChip'
import { useRunbucksIcon } from '../lib/use-runbucks-icon'

const h = React.createElement

beforeEach(() => {
  vi.clearAllMocks()
})

describe('accept: RunbucksPriceChip widget — inline price pill', () => {
  // ── Layout: amount right + currency icon left ────────────────────────────
  it('renders an inline pill with the currency icon left and amount right', () => {
    render(h(RunbucksPriceChip, { amount: 299 }))
    const chip = screen.getByTestId('runbucks-price-chip')
    expect(chip).toBeInTheDocument()

    // The amount text is present.
    expect(chip.textContent).toMatch(/299/)

    // The currency icon precedes the amount text in DOM order.
    const icon = chip.querySelector('[data-testid="runbucks-icon"]')
    const amount = chip.querySelector('[data-testid="runbucks-price-chip-amount"]')
    expect(icon).not.toBeNull()
    expect(amount).not.toBeNull()
    // compareDocumentPosition: bit 4 means amount follows icon (icon is "preceding").
    expect(icon!.compareDocumentPosition(amount!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // ── Currency icon via useRunbucksIcon() hook ─────────────────────────────
  it('renders the currency icon via the useRunbucksIcon() hook (not hardcoded)', () => {
    render(h(RunbucksPriceChip, { amount: 99 }))
    const chip = screen.getByTestId('runbucks-price-chip')
    const icon = chip.querySelector('[data-testid="runbucks-icon"]')
    expect(icon).not.toBeNull()
    // The icon must be rendered through the hook → element marked as such.
    expect(icon!.getAttribute('data-runbucks-icon-source')).toBe('hook')
  })

  // ── Variant prop ─────────────────────────────────────────────────────────
  it('default variant: data-variant="default"', () => {
    render(h(RunbucksPriceChip, { amount: 100 }))
    const chip = screen.getByTestId('runbucks-price-chip')
    expect(chip.getAttribute('data-runbucks-variant')).toBe('default')
  })

  it('cta variant: data-variant="cta" with bold weight for purchase CTA', () => {
    render(h(RunbucksPriceChip, { amount: 299, variant: 'cta' }))
    const chip = screen.getByTestId('runbucks-price-chip')
    expect(chip.getAttribute('data-runbucks-variant')).toBe('cta')

    const amount = chip.querySelector('[data-testid="runbucks-price-chip-amount"]') as HTMLElement
    expect(amount).not.toBeNull()
    // CTA variant uses bold weight.
    const fontWeight = amount.style.fontWeight
    expect(['700', '800', '900', 'bold']).toContain(fontWeight)
  })

  it('wallet variant: data-variant="wallet" with muted treatment for balance', () => {
    render(h(RunbucksPriceChip, { amount: 1499, variant: 'wallet' }))
    const chip = screen.getByTestId('runbucks-price-chip')
    expect(chip.getAttribute('data-runbucks-variant')).toBe('wallet')
  })

  // ── No animation in v1 ──────────────────────────────────────────────────
  it('does not apply transitions or animations (static in v1)', () => {
    render(h(RunbucksPriceChip, { amount: 299 }))
    const chip = screen.getByTestId('runbucks-price-chip')
    const inlineStyle = chip.getAttribute('style') ?? ''
    // No animation/transition properties are applied inline.
    expect(inlineStyle).not.toMatch(/animation:/)
    expect(inlineStyle).not.toMatch(/transition:/)
  })

  // ── Amount via formatBalance() — K/M abbreviation ────────────────────────
  it('renders raw integer for amounts < 1000', () => {
    render(h(RunbucksPriceChip, { amount: 999 }))
    const amount = screen.getByTestId('runbucks-price-chip-amount')
    expect(amount.textContent).toBe('999')
  })

  it('abbreviates 1000 → "1K" via formatBalance', () => {
    render(h(RunbucksPriceChip, { amount: 1000 }))
    const amount = screen.getByTestId('runbucks-price-chip-amount')
    expect(amount.textContent).toBe('1K')
  })

  it('abbreviates 1500 → "1.5K"', () => {
    render(h(RunbucksPriceChip, { amount: 1500 }))
    const amount = screen.getByTestId('runbucks-price-chip-amount')
    expect(amount.textContent).toBe('1.5K')
  })

  it('abbreviates 1_000_000 → "1M"', () => {
    render(h(RunbucksPriceChip, { amount: 1_000_000 }))
    const amount = screen.getByTestId('runbucks-price-chip-amount')
    expect(amount.textContent).toBe('1M')
  })

  // ── Aria label for screen readers ────────────────────────────────────────
  it('exposes an aria-label naming the currency for accessibility', () => {
    render(h(RunbucksPriceChip, { amount: 299 }))
    const chip = screen.getByTestId('runbucks-price-chip')
    const ariaLabel = chip.getAttribute('aria-label') ?? ''
    expect(ariaLabel).toMatch(/Runbucks/i)
    expect(ariaLabel).toMatch(/299/)
  })
})

describe('accept: useRunbucksIcon() hook — stable component reference', () => {
  it('returns a React component (function)', () => {
    const { result } = renderHook(() => useRunbucksIcon())
    expect(typeof result.current).toBe('function')
  })

  it('returns the same component reference across hook re-invocations', () => {
    const { result: r1 } = renderHook(() => useRunbucksIcon())
    const { result: r2 } = renderHook(() => useRunbucksIcon())
    expect(r1.current).toBe(r2.current)
  })

  it('returns the same component reference across re-renders of the same hook instance', () => {
    const { result, rerender } = renderHook(() => useRunbucksIcon())
    const first = result.current
    rerender()
    const second = result.current
    expect(first).toBe(second)
  })

  it('the component renders a non-null DOM node', () => {
    const { result } = renderHook(() => useRunbucksIcon())
    const Icon = result.current
    const { container } = render(h(Icon))
    expect(container.firstChild).not.toBeNull()
  })
})
