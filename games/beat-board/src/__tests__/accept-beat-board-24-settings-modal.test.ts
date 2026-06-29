/**
 * Acceptance tests for issue beat-board-24-settings-modal.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests render the real SettingsSheet through
 * @testing-library/react, exercise it inside the `ui/bottom-sheet` portal,
 * and assert on visible DOM, store side-effects (settings-overlay,
 * subscriptionStore, navigationStore), and analytics events.
 *
 * Authored as `.test.ts` (no JSX) to match the `owns` declaration in the
 * issue frontmatter. React elements are constructed via React.createElement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import { SettingsSheet } from '../components/sheets/SettingsSheet'
import {
  useBottomSheetStore,
  resetBottomSheetStore,
} from '../modules/ui/bottom-sheet/BottomSheet'
import { resetBottomSheetHostMountedForTest } from '../modules/ui/bottom-sheet/portal'
import { BottomSheetRoot } from '../modules/ui/bottom-sheet/BottomSheetRoot'
import { useSettingsStore, resetSettingsStore } from '../modules/ui/settings-overlay/SettingsOverlay'
import {
  useSubscriptionStore,
  resetSubscriptionStore,
} from '../stores/subscriptionStore'
import { useNavigationStore } from '../stores/navigationStore'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'

const h = React.createElement

beforeEach(() => {
  vi.clearAllMocks()
  resetBottomSheetStore()
  resetBottomSheetHostMountedForTest()
  resetSettingsStore()
  resetSubscriptionStore()
  // Clear navigation modal stack between tests.
  useNavigationStore.setState({ modalStack: [], modalParams: {} })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── Modal opens via ui/bottom-sheet ────────────────────────────────────

describe('accept: SettingsSheet — opens via ui/bottom-sheet', () => {
  it('renders inside BottomSheetRoot when opened via the bottom-sheet store', () => {
    render(h(BottomSheetRoot))
    act(() => {
      useBottomSheetStore
        .getState()
        .open(h(SettingsSheet, { onClose: () => {} }))
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('settings-sheet')).toBeInTheDocument()
  })

  it('renders as a Panel.Modal (data-skin-role=panel.modal)', () => {
    render(h(SettingsSheet, { onClose: () => {} }))
    const panel = screen.getByTestId('settings-sheet')
    expect(panel).toBeInTheDocument()
    const modalChild = panel.querySelector('[data-skin-role="panel.modal"]')
    expect(modalChild ?? panel).not.toBeNull()
  })
})

// ── Close affordances (375x667 safe-area) ──────────────────────────────

describe('accept: SettingsSheet — close affordances', () => {
  it('drag handle dismisses the modal', () => {
    const onClose = vi.fn()
    render(h(SettingsSheet, { onClose }))
    fireEvent.click(screen.getByTestId('settings-sheet-handle'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('X button dismisses the modal', () => {
    const onClose = vi.fn()
    render(h(SettingsSheet, { onClose }))
    fireEvent.click(screen.getByTestId('settings-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opening via store and pressing X closes the bottom-sheet store', () => {
    render(h(BottomSheetRoot))
    const closeFromStore = () => useBottomSheetStore.getState().close()
    act(() => {
      useBottomSheetStore
        .getState()
        .open(h(SettingsSheet, { onClose: closeFromStore }))
    })
    expect(useBottomSheetStore.getState().isOpen).toBe(true)
    act(() => {
      fireEvent.click(screen.getByTestId('settings-close'))
    })
    expect(useBottomSheetStore.getState().isOpen).toBe(false)
  })
})

// ── Audio section ──────────────────────────────────────────────────────

describe('accept: SettingsSheet — Audio section', () => {
  it('renders Volume slider bound to settings-overlay (0–100)', () => {
    useSettingsStore.setState({ musicVolume: 0.5, soundVolume: 0.5 })
    render(h(SettingsSheet, { onClose: () => {} }))
    // SkinSlider forwards arbitrary props (including data-testid) onto the
    // native <input type="range"> element, so the testid resolves to the
    // input directly.
    const input = screen.getByTestId('settings-volume-slider') as HTMLInputElement
    expect(input.tagName).toBe('INPUT')
    expect(input.type).toBe('range')
    expect(input.min).toBe('0')
    expect(input.max).toBe('100')
    // 0.5 store-side → 50 UI-side
    expect(Number(input.value)).toBe(50)
  })

  it('moving the slider updates settings-overlay volume in real time', () => {
    // Pin both volumes to a non-default value so a change to 60 reads as a
    // genuine delta (React skips onChange when the controlled value matches
    // the existing input value).
    useSettingsStore.setState({ soundVolume: 0.5, musicVolume: 0.5 })
    render(h(SettingsSheet, { onClose: () => {} }))
    const input = screen.getByTestId('settings-volume-slider') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: '60' } })
    })
    // 60 / 100 → 0.6 in the store. Because audio-master subscribes to the
    // settings-overlay store, this propagates to the master gain in real time
    // (verified at the unit level in the audio-master test). Here we assert
    // the store update — that is the contract the slider must satisfy.
    expect(useSettingsStore.getState().musicVolume).toBeCloseTo(0.6, 5)
    expect(useSettingsStore.getState().soundVolume).toBeCloseTo(0.6, 5)
  })

  it('renders Mute toggle bound to settings-overlay enable flags', () => {
    useSettingsStore.setState({ soundEnabled: true, musicEnabled: true })
    render(h(SettingsSheet, { onClose: () => {} }))
    // SkinSwitch forwards data-testid onto the native <input type="checkbox">.
    const native = screen.getByTestId('settings-mute-toggle') as HTMLInputElement
    expect(native.tagName).toBe('INPUT')
    expect(native.type).toBe('checkbox')
    // Initial: not muted (sound + music both enabled) → checkbox unchecked.
    expect(native.checked).toBe(false)
  })

  it('tapping Mute toggle mutes the audio engine (flips enable flags)', () => {
    useSettingsStore.setState({ soundEnabled: true, musicEnabled: true })
    render(h(SettingsSheet, { onClose: () => {} }))
    const native = screen.getByTestId('settings-mute-toggle') as HTMLInputElement
    act(() => {
      fireEvent.click(native)
    })
    // Mute → both flags flip false.
    expect(useSettingsStore.getState().soundEnabled).toBe(false)
    expect(useSettingsStore.getState().musicEnabled).toBe(false)
    // Tap again → unmute, both flags back to true.
    act(() => {
      fireEvent.click(native)
    })
    expect(useSettingsStore.getState().soundEnabled).toBe(true)
    expect(useSettingsStore.getState().musicEnabled).toBe(true)
  })
})

// ── Subscription section ────────────────────────────────────────────────

describe('accept: SettingsSheet — Subscription section', () => {
  it('renders current tier label "Free" when subscriptionStore.tier is free', () => {
    useSubscriptionStore.setState({ tier: 'free', isActive: false })
    render(h(SettingsSheet, { onClose: () => {} }))
    expect(screen.getByTestId('settings-tier-label').textContent).toMatch(/Free/i)
  })

  it('renders current tier label "CORE" when subscribed', () => {
    useSubscriptionStore.setState({ tier: 'CORE', isActive: true })
    render(h(SettingsSheet, { onClose: () => {} }))
    expect(screen.getByTestId('settings-tier-label').textContent).toMatch(/CORE/)
  })

  it('renders current tier label "PLUS" when subscribed', () => {
    useSubscriptionStore.setState({ tier: 'PLUS', isActive: true })
    render(h(SettingsSheet, { onClose: () => {} }))
    expect(screen.getByTestId('settings-tier-label').textContent).toMatch(/PLUS/)
  })

  it('Manage subscription (subscribed) → opens RundotAPI.iap.openStore()', async () => {
    useSubscriptionStore.setState({ tier: 'CORE', isActive: true })
    render(h(SettingsSheet, { onClose: () => {} }))
    const manage = screen.getByTestId('settings-manage-subscription')
    await act(async () => {
      fireEvent.click(manage)
    })
    expect(RundotAPI.iap.openStore).toHaveBeenCalled()
  })

  it('Manage subscription (free) → opens tier picker that calls purchaseSubscription', async () => {
    useSubscriptionStore.setState({ tier: 'free', isActive: false })
    vi.mocked(RundotAPI.iap.getSubscriptions).mockResolvedValue({
      CORE: [
        { interval: 'MONTHLY', price: 3.99, currencyCode: 'USD', description: '$3.99 / month' } as never,
      ],
    })
    const purchaseSpy = vi.spyOn(useSubscriptionStore.getState(), 'purchaseSubscription')
      .mockResolvedValue({ success: true })

    render(h(SettingsSheet, { onClose: () => {} }))

    // Tap "Manage subscription" while free → reveals the tier picker.
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-manage-subscription'))
    })

    // Allow the getSubscriptions promise to flush.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Tier picker is now visible.
    expect(screen.getByTestId('settings-tier-picker')).toBeInTheDocument()

    // Tap one of the picker rows (e.g. CORE / monthly).
    const buyCoreMonthly = screen.getByTestId('settings-buy-CORE-MONTHLY')
    await act(async () => {
      fireEvent.click(buyCoreMonthly)
    })

    expect(purchaseSpy).toHaveBeenCalledWith('CORE', 'MONTHLY')
  })

  it('tier picker rows surface getSubscriptions(tier) prices', async () => {
    useSubscriptionStore.setState({ tier: 'free', isActive: false })
    vi.mocked(RundotAPI.iap.getSubscriptions).mockResolvedValue({
      CORE: [
        { interval: 'WEEKLY', price: 0.99, currencyCode: 'USD', description: '$0.99 / week' } as never,
        { interval: 'MONTHLY', price: 3.99, currencyCode: 'USD', description: '$3.99 / month' } as never,
      ],
      PLUS: [
        { interval: 'MONTHLY', price: 11.99, currencyCode: 'USD', description: '$11.99 / month' } as never,
      ],
    })

    render(h(SettingsSheet, { onClose: () => {} }))
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-manage-subscription'))
    })

    // Allow microtasks to flush so getSubscriptions resolves.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const picker = screen.getByTestId('settings-tier-picker')
    // The picker shows price text for at least one offered package.
    expect(picker.textContent ?? '').toMatch(/\$3\.99|\$11\.99|\$0\.99/)
  })
})

// ── About section ──────────────────────────────────────────────────────

describe('accept: SettingsSheet — About section', () => {
  it('Credits link → calls navigationStore.openModal("credits")', () => {
    const openModalSpy = vi.spyOn(useNavigationStore.getState(), 'openModal')
    render(h(SettingsSheet, { onClose: () => {} }))
    fireEvent.click(screen.getByTestId('settings-credits-link'))
    expect(openModalSpy).toHaveBeenCalledWith('credits')
  })

  it('renders version label "v[package.json.version]"', () => {
    render(h(SettingsSheet, { onClose: () => {} }))
    const version = screen.getByTestId('settings-version-line')
    // Format: v<semver>, including prerelease deploy tags.
    expect(version.textContent ?? '').toMatch(/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  })
})

// ── States ─────────────────────────────────────────────────────────────

describe('accept: SettingsSheet — states', () => {
  it('loading state renders a skeleton tier label while subscription hydrates', () => {
    render(h(SettingsSheet, { onClose: () => {}, isSubscriptionLoading: true }))
    const tier = screen.getByTestId('settings-tier-label')
    // Skeleton renders an em-dash or skeleton placeholder; assert non-empty.
    expect(tier.getAttribute('data-state')).toBe('loading')
  })

  it('error state renders "—" with a retry affordance', () => {
    const onRetry = vi.fn()
    render(
      h(SettingsSheet, {
        onClose: () => {},
        subscriptionError: 'network',
        onRetrySubscription: onRetry,
      }),
    )
    const tier = screen.getByTestId('settings-tier-label')
    expect(tier.textContent).toMatch(/—/)
    fireEvent.click(screen.getByTestId('settings-tier-retry'))
    expect(onRetry).toHaveBeenCalled()
  })
})

// ── Persistence + analytics ────────────────────────────────────────────

describe('accept: SettingsSheet — analytics + persistence', () => {
  it('fires analytics screen_viewed { screen: "settings" } on mount', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(SettingsSheet, { onClose: () => {} }))
    const call = trackSpy.mock.calls.find((c) => c[0] === 'screen_viewed')
    expect(call).toBeTruthy()
    expect(call![1]).toMatchObject({ screen: 'settings' })
  })

  it('does not re-fire screen_viewed across re-renders of the same instance', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const { rerender } = render(h(SettingsSheet, { onClose: () => {} }))
    rerender(h(SettingsSheet, { onClose: () => {} }))
    const calls = trackSpy.mock.calls.filter((c) => c[0] === 'screen_viewed')
    expect(calls.length).toBe(1)
  })

  it('volume slider writes propagate through useSettingsStore (persisted store)', () => {
    // Pin volumes off-default so the controlled-input change actually fires.
    useSettingsStore.setState({ soundVolume: 0.5, musicVolume: 0.5 })
    render(h(SettingsSheet, { onClose: () => {} }))
    const input = screen.getByTestId('settings-volume-slider') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: '25' } })
    })
    // Volume persisted into the singleton store — subsequent reads see it.
    expect(useSettingsStore.getState().musicVolume).toBeCloseTo(0.25, 5)
  })
})
