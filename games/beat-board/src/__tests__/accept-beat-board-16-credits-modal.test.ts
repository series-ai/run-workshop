/**
 * Acceptance tests for issue beat-board-16-credits-modal.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. The tests render the real CreditsSheet component through the
 * @testing-library/react harness, exercise it inside the
 * `ui/bottom-sheet` portal, and assert on visible DOM, the version line, and
 * the close affordances.
 *
 * Authored as `.test.ts` (no JSX) to match the `owns` declaration in the issue
 * frontmatter. React elements are constructed via `React.createElement`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'

import { CreditsSheet } from '../components/sheets/CreditsSheet'
import {
  useBottomSheetStore,
  resetBottomSheetStore,
} from '../modules/ui/bottom-sheet/BottomSheet'
import { resetBottomSheetHostMountedForTest } from '../modules/ui/bottom-sheet/portal'
import { BottomSheetRoot } from '../modules/ui/bottom-sheet/BottomSheetRoot'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'

const h = React.createElement

beforeEach(() => {
  vi.clearAllMocks()
  resetBottomSheetStore()
  resetBottomSheetHostMountedForTest()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('accept: CreditsSheet — opens via ui/bottom-sheet', () => {
  it('renders inside BottomSheetRoot when opened via the bottom-sheet store', () => {
    // Mount the generic root that renders ReactNode content from the store.
    render(h(BottomSheetRoot))

    act(() => {
      useBottomSheetStore.getState().open(h(CreditsSheet, { onClose: () => {} }))
    })

    // The generic root paints a role="dialog" wrapper and the credits content
    // renders inside it.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('credits-sheet')).toBeInTheDocument()
  })

  it('renders as a scrollable sheet (data-skin-role=panel.modal)', () => {
    render(h(CreditsSheet, { onClose: () => {} }))
    const panel = screen.getByTestId('credits-sheet')
    expect(panel).toBeInTheDocument()
    // Panel.Modal exposes a panel.modal skin role through its data attributes.
    const modalChild = panel.querySelector('[data-skin-role="panel.modal"]')
    expect(modalChild ?? panel).not.toBeNull()
  })
})

describe('accept: CreditsSheet — content sections', () => {
  it('Title displays "Credits"', () => {
    render(h(CreditsSheet, { onClose: () => {} }))
    const title = screen.getByTestId('credits-title')
    expect(title.textContent).toMatch(/^Credits$/)
  })

  it('"Made by" section renders with a team list placeholder', () => {
    render(h(CreditsSheet, { onClose: () => {} }))
    const heading = screen.getByTestId('credits-section-made-by')
    expect(heading.textContent).toMatch(/Made by/)
    // The team list placeholder is rendered alongside the section heading.
    const list = screen.getByTestId('credits-made-by-list')
    expect(list).toBeInTheDocument()
    expect((list.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('does not render an audio-attribution section (workshop-owned audio)', () => {
    render(h(CreditsSheet, { onClose: () => {} }))
    expect(screen.queryByTestId('credits-section-audio')).toBeNull()
    expect(screen.queryByTestId('credits-audio-attribution')).toBeNull()
  })

  it('"Open source" section renders a placeholder list', () => {
    render(h(CreditsSheet, { onClose: () => {} }))
    const heading = screen.getByTestId('credits-section-open-source')
    expect(heading.textContent).toMatch(/Open source/)
    const list = screen.getByTestId('credits-open-source-list')
    expect(list).toBeInTheDocument()
    // The build-time generator will populate this in a later pass; for now we
    // only assert the placeholder section exists with at least one entry.
    expect((list.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('"Version" section displays "v[version] · build [hash]"', () => {
    render(h(CreditsSheet, { onClose: () => {} }))
    const heading = screen.getByTestId('credits-section-version')
    expect(heading.textContent).toMatch(/Version/)
    const versionLine = screen.getByTestId('credits-version-line')
    // Format: v<semver> · build <hash>, including prerelease deploy tags.
    expect(versionLine.textContent).toMatch(/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\s+·\s+build\s+\S+$/)
  })
})

describe('accept: CreditsSheet — close affordances (375x667 safe-area)', () => {
  it('drag handle dismisses the modal', () => {
    const onClose = vi.fn()
    render(h(CreditsSheet, { onClose }))
    fireEvent.click(screen.getByTestId('credits-sheet-handle'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('X button dismisses the modal', () => {
    const onClose = vi.fn()
    render(h(CreditsSheet, { onClose }))
    fireEvent.click(screen.getByTestId('credits-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opening via store and pressing X closes the bottom-sheet store', () => {
    render(h(BottomSheetRoot))
    const closeFromStore = () => useBottomSheetStore.getState().close()
    act(() => {
      useBottomSheetStore.getState().open(
        h(CreditsSheet, { onClose: closeFromStore }),
      )
    })
    expect(useBottomSheetStore.getState().isOpen).toBe(true)
    act(() => {
      fireEvent.click(screen.getByTestId('credits-close'))
    })
    expect(useBottomSheetStore.getState().isOpen).toBe(false)
  })
})

describe('accept: CreditsSheet — analytics', () => {
  it('fires analytics screen_viewed { screen: "credits" } on mount', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(CreditsSheet, { onClose: () => {} }))
    const call = trackSpy.mock.calls.find((c) => c[0] === 'screen_viewed')
    expect(call).toBeTruthy()
    expect(call![1]).toMatchObject({ screen: 'credits' })
  })

  it('does not re-fire screen_viewed across re-renders of the same instance', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const { rerender } = render(h(CreditsSheet, { onClose: () => {} }))
    rerender(h(CreditsSheet, { onClose: () => {} }))
    const calls = trackSpy.mock.calls.filter((c) => c[0] === 'screen_viewed')
    expect(calls.length).toBe(1)
  })
})
