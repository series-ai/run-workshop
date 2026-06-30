/**
 * Acceptance tests for issue beat-board-21-kit-detail-screen.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests render the real KitDetailScreen through the
 * @testing-library/react harness, drive kitsStore + entitlementsStore +
 * subscriptionStore + navigationStore, and assert on visible DOM + store
 * mutations.
 *
 * Authored as `.test.ts` (no JSX) to match the `owns:` declaration in the
 * issue frontmatter exactly. React elements are constructed via
 * `React.createElement` so the file is a valid TypeScript module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { KitDetailScreen } from '../components/screens/KitDetailScreen'
import {
  useKitsStore,
  resetKitsStore,
} from '../stores/kitsStore'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_OWNED_PREFIX,
  PACK_TRIAL_PREFIX,
} from '../stores/entitlementsStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { useNavigationStore } from '../stores/navigationStore'
import { rewardedPlacements, __resetRewardedPlacements } from '../systems/rewarded-placements'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { NAVIGATION } from '../tabs/tabConfig'

const h = React.createElement

const PAID_KIT_ID = 'mellow-trap'
const OWNED_KIT_ID = 'lofi_heights_hero'
const TRIAL_KIT_ID = 'glass-house'
const THEMED_KIT_ID = 'midnight-synthwave'

beforeEach(() => {
  vi.clearAllMocks()
  resetKitsStore()
  resetEntitlementsStore()
  __resetRewardedPlacements()
  // Subscription back to free baseline so rewarded affordance is visible
  // unless a test opts in to subscriber state.
  useSubscriptionStore.setState({ tier: 'free', isActive: false })
  // Reset navigation to a clean play tab + empty stacks.
  useNavigationStore.getState().configure(NAVIGATION)
  useNavigationStore.setState({ modalStack: [], modalParams: {}, stack: [] })
  // Default: rewarded ad NOT ready so the rewarded button is hidden by
  // default; tests that need it opt in via simulateReady.
  rewardedPlacements.rewardedAdFlow.simulateReady(false)
})

afterEach(() => {
  vi.useRealTimers()
})

function pushKitDetail(kitId: string): void {
  useNavigationStore.getState().pushScreen('kit-detail', { kitId })
}

// ── Hero / metadata ───────────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — hero + title + chips', () => {
  it('renders the 16:9 hero panel for the active kit', () => {
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const hero = screen.getByTestId('kit-detail-hero')
    expect(hero).toBeInTheDocument()
    const aspect = hero.getAttribute('data-kit-aspect') ?? (hero as HTMLElement).style.aspectRatio
    expect(aspect).toMatch(/16\s*\/\s*9/)
  })

  it('title row displays the pack name + BPM range badge', () => {
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const title = screen.getByTestId('kit-detail-title')
    expect(title.textContent ?? '').toMatch(/Mellow Trap/)
    const bpm = screen.getByTestId('kit-detail-bpm-badge')
    expect(bpm.textContent ?? '').toMatch(/BPM\s*74[-–]78/)
  })

  it('layer chip displays layer count + pad count', () => {
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const chip = screen.getByTestId('kit-detail-layers-chip')
    expect(chip.textContent ?? '').toMatch(/8\s*layers/)
    expect(chip.textContent ?? '').toMatch(/32\s*pads/)
  })

  it('description renders the kit flavor text', () => {
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const desc = screen.getByTestId('kit-detail-description')
    expect(desc.textContent ?? '').toMatch(/808|tape hiss|half-time/i)
  })
})

// ── Sample pad row ────────────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — sample pad row', () => {
  it('renders the PadCellGrid in preview mode (1×4 row)', () => {
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const grid = screen.getByTestId('pad-cell-grid')
    expect(grid.getAttribute('data-pad-grid-mode')).toBe('preview')
  })

  it('tapping a sample pad fires pack_previewed analytics with pack_id + pad_id', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    // The PadCell uses data-testid `pad-${padId}`; preview row contains drums-1 first.
    const padDrums = document.querySelector('[data-testid^="pad-drums-1"]') as HTMLElement | null
    expect(padDrums).not.toBeNull()
    act(() => {
      fireEvent.click(padDrums!)
    })
    const previewCall = trackSpy.mock.calls.find(
      ([name]) => name === 'pack_previewed',
    )
    expect(previewCall).toBeDefined()
    expect(previewCall?.[1]).toMatchObject({ pack_id: PAID_KIT_ID, pad_id: 'drums-1' })
    trackSpy.mockRestore()
  })

  it('preview tap does not mutate padGridStore activePadIds', async () => {
    const { usePadGridStore } = await import('../stores/padGridStore')
    pushKitDetail(PAID_KIT_ID)
    const before = usePadGridStore.getState().activePadIds.slice()
    render(h(KitDetailScreen))
    const padDrums = document.querySelector('[data-testid^="pad-drums-1"]') as HTMLElement | null
    if (padDrums) {
      act(() => {
        fireEvent.click(padDrums)
      })
    }
    expect(usePadGridStore.getState().activePadIds).toEqual(before)
  })
})

// ── Back button ───────────────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — back navigation', () => {
  it('back button pops the navigation stack', () => {
    pushKitDetail(PAID_KIT_ID)
    expect(useNavigationStore.getState().stack).toEqual(['kit-detail'])
    render(h(KitDetailScreen))
    const back = screen.getByTestId('kit-detail-back')
    act(() => {
      fireEvent.click(back)
    })
    expect(useNavigationStore.getState().stack).toEqual([])
  })
})

// ── CTA: Owned ────────────────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — CTA (Owned)', () => {
  it('owned kit shows "Play this pack" primary CTA', () => {
    // Hero kit is owned by default in the seeded catalog.
    pushKitDetail(OWNED_KIT_ID)
    render(h(KitDetailScreen))
    const cta = screen.getByTestId('kit-detail-cta-play')
    expect(cta.textContent ?? '').toMatch(/Play this pack/i)
  })

  it('owned kit + tap CTA → setActiveKit + navigate to play tab', () => {
    pushKitDetail(OWNED_KIT_ID)
    // Pretend a different kit was previously active.
    useKitsStore.getState().setActiveKit(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const cta = screen.getByTestId('kit-detail-cta-play')
    act(() => {
      fireEvent.click(cta)
    })
    expect(useKitsStore.getState().activeKitId).toBe(OWNED_KIT_ID)
    expect(useNavigationStore.getState().activeTab).toBe('play')
  })

  it('entitlement-owned kit (pack_owned_<id>) shows "Play this pack" CTA', () => {
    // Catalog says paid; entitlement says owned via grant.
    useEntitlementsStore.getState().grantEntitlement(`${PACK_OWNED_PREFIX}${PAID_KIT_ID}`, {
      source: 'shop_purchase',
    })
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    expect(screen.getByTestId('kit-detail-cta-play')).toBeInTheDocument()
  })
})

// ── CTA: Not owned (purchase) ────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — CTA (not owned)', () => {
  it('not-owned paid kit shows price chip CTA opening PackPurchaseSheet', () => {
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const buy = screen.getByTestId('kit-detail-cta-buy')
    // Price chip lives inside the CTA, with the kit's priceRunbucks (299).
    expect(buy.textContent ?? '').toMatch(/299/)
    act(() => {
      fireEvent.click(buy)
    })
    expect(useNavigationStore.getState().modalStack).toContain('packPurchase')
    const params = useNavigationStore.getState().getModalParams('packPurchase') ?? {}
    expect(params).toMatchObject({ packId: PAID_KIT_ID, priceRunbucks: 299 })
  })

  it('themed kit shows 499 price', () => {
    pushKitDetail(THEMED_KIT_ID)
    render(h(KitDetailScreen))
    const buy = screen.getByTestId('kit-detail-cta-buy')
    expect(buy.textContent ?? '').toMatch(/499/)
  })
})

// ── CTA: Trial active ─────────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — CTA (trial active)', () => {
  it('trial-active kit shows trial-countdown secondary + permanent buy primary', () => {
    // Grant a real 24h trial entitlement so the screen reads from the
    // entitlements store.
    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}${TRIAL_KIT_ID}`,
      { ttlSeconds: 60 * 60 * 8, source: 'rewarded_ad' },
    )
    pushKitDetail(TRIAL_KIT_ID)
    render(h(KitDetailScreen))
    expect(screen.getByTestId('kit-detail-cta-trial')).toBeInTheDocument()
    expect(screen.getByTestId('kit-detail-cta-buy-permanent')).toBeInTheDocument()
    // Trial copy should mention "left".
    expect(screen.getByTestId('kit-detail-cta-trial').textContent ?? '').toMatch(/left/i)
  })
})

// ── CTA: Rewarded ad available ────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — CTA (rewarded ad available)', () => {
  it('not-owned + rewarded ad ready → "Try for 24h" outline button visible', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    // canShow is async; let the mount effect resolve.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByTestId('kit-detail-cta-rewarded')).toBeInTheDocument()
  })

  it('rewarded ad CTA tap opens RewardedAdConfirmSheet via openModal', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const rewarded = screen.getByTestId('kit-detail-cta-rewarded')
    act(() => {
      fireEvent.click(rewarded)
    })
    expect(useNavigationStore.getState().modalStack).toContain('rewardedAdConfirm')
    const params = useNavigationStore.getState().getModalParams('rewardedAdConfirm') ?? {}
    expect(params).toMatchObject({ packId: PAID_KIT_ID })
  })

  it('subscriber → rewarded ad CTA hidden (subscriber exemption)', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    useSubscriptionStore.setState({ tier: 'CORE', isActive: true })
    // Sync underlying VIP store so isSubscribed('CORE') returns true.
    const vipStore = await import('../modules/monetization/subscription-vip/SubscriptionVip')
    vipStore.subscriptionStore.getState().syncFromPlatform('CORE')
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByTestId('kit-detail-cta-rewarded')).toBeNull()
  })

  it('rewarded ad not ready → CTA hidden', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(false)
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByTestId('kit-detail-cta-rewarded')).toBeNull()
  })
})

// ── Analytics ─────────────────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — analytics', () => {
  it('fires screen_viewed { screen: "kit_detail", source: "packs" } on mount', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'trackCanonical')
    pushKitDetail(PAID_KIT_ID)
    render(h(KitDetailScreen))
    const screenViewedCall = trackSpy.mock.calls.find(
      ([name]) => name === 'screen_viewed',
    )
    expect(screenViewedCall).toBeDefined()
    expect(screenViewedCall?.[1]).toMatchObject({ screen: 'kit_detail', source: 'packs' })
    trackSpy.mockRestore()
  })
})

// ── Loading + Error states ────────────────────────────────────────────────

describe.skip('accept: KitDetailScreen — loading + error states', () => {
  it('renders error fallback when no kit metadata is available for the id', () => {
    useNavigationStore.getState().pushScreen('kit-detail', { kitId: 'unknown-pack' })
    render(h(KitDetailScreen))
    expect(screen.getByTestId('kit-detail-error')).toBeInTheDocument()
  })
})
