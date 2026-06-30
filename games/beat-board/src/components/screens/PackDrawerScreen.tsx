/**
 * PackDrawerScreen — content acquisition tab (PRD § Screen: Packs).
 *
 * Issue beat-board-22-packs-screen owns this file. Wires the visual scaffold
 * to real stores so entitlements, subscription state, and wallet balance
 * drive the three sections (Owned / Available / Subscriber Exclusive) and
 * the top-right Runbucks chip.
 *
 * Layout (PRD spec):
 *   ┌──────────────────────────────────────────┐
 *   │  Title           [Runbucks balance chip] │  ← top row
 *   ├──────────────────────────────────────────┤
 *   │  OWNED                                    │  ← hero pack + owned + trial
 *   │  → KitCard horizontal scroll              │
 *   ├──────────────────────────────────────────┤
 *   │  AVAILABLE                                │  ← paid kits not yet owned
 *   │  → KitCard horizontal scroll (themed first)│
 *   ├──────────────────────────────────────────┤
 *   │  SUBSCRIBER EXCLUSIVE                     │  ← only when isSubscribed('CORE')
 *   │  → KitCard horizontal scroll              │
 *   ├──────────────────────────────────────────┤
 *   │  Credits & Attribution link               │  ← opens CreditsSheet
 *   └──────────────────────────────────────────┘
 *
 * Section composition:
 *   - **Owned**: hero pack ALWAYS + every catalog-owned kit + every kit with
 *     a `pack_owned_<id>` entitlement + every kit with an active
 *     `pack_trial_<id>` entitlement (trial chip rendered via KitCard).
 *   - **Available**: paid kits (`ownership === 'paid'`) that are NOT owned
 *     and NOT in an active trial. Sorted by `tier === 'themed'` first so the
 *     featured Themed Pack lands at the head of the scroller.
 *   - **Subscriber Exclusive**: rendered iff `subscriptionStore.isSubscribed('CORE')`.
 *     Lists every kit with `tier === 'subscriber'` from the catalog.
 *
 * Interactions:
 *   - Tap KitCard → `pushScreen('kit-detail', { kitId })` + emit `store_opened`
 *     `{ source: 'kit_card_tap' }`.
 *   - Tap wallet chip → `RundotAPI.iap.openStore()` + emit `store_opened`
 *     `{ source: 'runbucks_chip' }`.
 *   - Long-press a Themed Pack card (≥ 500ms) → `rewardedPlacements.canShow`
 *     gate; on pass `openModal('rewardedAdConfirm', { packId })` and emit
 *     `rewarded_ad_offered { placement: 'rewarded_pack_trial' }`. On fail the
 *     gesture is silently dropped (no analytics, no modal).
 *   - Tap Credits link → push `<CreditsSheet />` into `useBottomSheetStore`.
 *
 * Analytics fired on mount:
 *   - `screen_viewed { screen: 'packs' }` (canonical event)
 *   - `store_opened { source: 'tab_tap' }` (Packs becomes visible)
 *
 * Loading state:
 *   - Renders `pack-drawer-skeleton` placeholders when the catalog is empty.
 * Error state:
 *   - Renders `pack-drawer-error-banner` + retry when entitlement load
 *     rejects.
 *
 * data-skin-role coverage: panel.section (sections), label.section (header),
 * button.ghost (Credits link), chip.currency + button.currency (wallet),
 * panel.card (KitCard tiles), tag.status (ownership chips).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Button, Header, Icon, Label, Panel, ScreenChrome, Stack } from '@modules/ui/skin'
import { KitCard } from '../widgets/KitCard'
import { RunbucksPriceChip } from '../widgets/RunbucksPriceChip'
import {
  useKitsStore,
  type KitMeta,
} from '../../stores/kitsStore'
import { useEntitlementsStore } from '../../stores/entitlementsStore'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import { useWalletStore } from '../../stores/walletStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { bonusMethod, rewardedPlacements } from '../../systems/rewarded-placements'
import {
  recordCustomEvent,
  recordScreenViewed,
} from '../../systems/analytics'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Constants ─────────────────────────────────────────────────────────────

/** Long-press threshold for the Try-for-24h gesture on themed packs (ms). */
const LONG_PRESS_MS = 500

/** Rewarded-ad placement id (must match prd.md § Rewarded Ads). */
const REWARDED_PLACEMENT_ID = 'rewarded_pack_trial'

/**
 * Featured Themed Pack rotation. The PRD references
 * `pack_themed_neon_nights` as the v1 rotation slot; the seeded catalog
 * fulfils that slot with `midnight-synthwave`. When the rotation lands as
 * data-driven content, this constant is replaced with a feature-flag read.
 */
const FEATURED_THEMED_TIER: KitMeta['tier'] = 'themed'

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Sort the Available section so the Themed Pack feature lands first. Stable
 * sort: ties broken by catalog insertion order.
 */
function sortAvailable(kits: KitMeta[]): KitMeta[] {
  return [...kits].sort((a, b) => {
    const aFeatured = a.tier === FEATURED_THEMED_TIER ? 0 : 1
    const bFeatured = b.tier === FEATURED_THEMED_TIER ? 0 : 1
    return aFeatured - bFeatured
  })
}

// ── Screen ────────────────────────────────────────────────────────────────

export function PackDrawerScreen() {
  const kitsRecord = useKitsStore((s) => s.kits)
  const entitlementsMap = useEntitlementsStore((s) => s.entitlements)
  const isSubscribed = useSubscriptionStore((s) => s.isActive)
  const balance = useWalletStore((s) => s.balance)
  const pushScreen = useNavigationStore((s) => s.pushScreen)
  const openModal = useNavigationStore((s) => s.openModal)

  const kits = useMemo(() => Object.values(kitsRecord), [kitsRecord])

  // ── Section partitioning ────────────────────────────────────────────────
  // Read entitlement helpers via getState() so they re-evaluate when the
  // entitlementsMap changes (the dependency keeps the memo fresh).
  const { ownedKits, availableKits, subscriberKits } = useMemo(() => {
    const entStore = useEntitlementsStore.getState()
    const owned: KitMeta[] = []
    const available: KitMeta[] = []
    const subscriber: KitMeta[] = []
    for (const kit of kits) {
      // Hide kits whose audio hasn't shipped yet — the player taps a
      // "coming soon" tile and gets a silent pack-detail page, which
      // reads as broken even with the badge. When the audio lands the
      // kit's `comingSoon` flag flips false and it shows up here
      // automatically.
      if (kit.comingSoon) continue
      // Subscriber-tier kits go to the subscriber section regardless of
      // ownership state. The section is hidden when not subscribed.
      if (kit.tier === 'subscriber') {
        subscriber.push(kit)
        continue
      }
      // Hero pack always lives in Owned.
      if (kit.tier === 'hero') {
        owned.push(kit)
        continue
      }
      const ownsViaEnt = entStore.ownsPack(kit.id)
      const trialActive = entStore.isTrialActive(kit.id)
      const ownsViaCatalog = kit.ownership === 'owned' || kit.ownership === 'free'
      if (ownsViaEnt || ownsViaCatalog) {
        // Catalog-owned: always in Owned.
        owned.push({ ...kit, ownership: 'owned' })
        continue
      }
      if (trialActive) {
        owned.push({ ...kit, ownership: 'trial' })
        continue
      }
      // Paid + not owned + not in trial → Available.
      if (kit.ownership === 'paid') {
        available.push(kit)
      }
    }
    return {
      ownedKits: owned,
      availableKits: sortAvailable(available),
      subscriberKits: subscriber,
    }
    // entitlementsMap dep keeps the memo re-running when grants land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kits, entitlementsMap])

  // ── Loading + error state ───────────────────────────────────────────────
  // The "Couldn't load pack catalog" banner is reserved for the case where
  // the pack catalog itself is unavailable. A failed entitlements refresh
  // does NOT block rendering — the catalog (kits) is statically seeded and
  // entitlements are an overlay. We surface the banner only when (a) the
  // entitlements load rejects AND (b) we have no kits to render.
  const [entitlementsLoadFailed, setEntitlementsLoadFailed] = useState(false)
  const isCatalogLoading = kits.length === 0
  const catalogError = entitlementsLoadFailed && kits.length === 0

  // Mount effect: refresh wallet, load entitlements, fire mount analytics.
  // Strict-mode safe: idempotent flag prevents double-fire.
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    recordScreenViewed({ screen: 'packs' })
    recordCustomEvent('store_opened', { source: 'tab_tap' })

    // Wallet refresh — tolerant of failures (walletStore.refresh swallows).
    void useWalletStore.getState().refresh()

    // Entitlement load — flips the soft "entitlements failed" flag on
    // rejection. The visible "Couldn't load pack catalog" banner only
    // surfaces when the catalog (kits) is also empty — see catalogError
    // derivation above.
    void useEntitlementsStore
      .getState()
      .loadEntitlements()
      .then(() => {
        setEntitlementsLoadFailed(false)
      })
      .catch((err) => {
        RundotAPI.error('PackDrawerScreen.loadEntitlements failed', { err: String(err) })
        setEntitlementsLoadFailed(true)
      })
  }, [])

  // ── Wallet chip handler ─────────────────────────────────────────────────
  const handleWalletPress = useCallback(() => {
    recordCustomEvent('store_opened', { source: 'runbucks_chip' })
    void RundotAPI.iap.openStore().catch((err: unknown) => {
      RundotAPI.error('PackDrawerScreen.openStore failed', { err: String(err) })
    })
  }, [])

  // ── KitCard tap handler ─────────────────────────────────────────────────
  const handleKitPress = useCallback(
    (kit: KitMeta) => {
      recordCustomEvent('store_opened', { source: 'kit_card_tap' })
      pushScreen('kit-detail', { kitId: kit.id })
    },
    [pushScreen],
  )

  // ── Long-press themed pack → rewarded ad sheet ──────────────────────────
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearLongPress()
  }, [clearLongPress])

  const handleThemedPointerDown = useCallback(
    (kit: KitMeta) => {
      longPressFiredRef.current = false
      clearLongPress()
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        // Run the rewarded-ad gate. Only on pass do we emit
        // rewarded_ad_offered and open the confirmation sheet.
        void rewardedPlacements
          .canShow(kit.id)
          .then((ready) => {
            if (!ready) return
            longPressFiredRef.current = true
            recordCustomEvent('rewarded_ad_offered', { placement: REWARDED_PLACEMENT_ID })
            openModal('rewardedAdConfirm', { packId: kit.id, packName: kit.name })
          })
          .catch((err) => {
            RundotAPI.error('PackDrawerScreen.rewardedAd canShow failed', { err: String(err) })
          })
      }, LONG_PRESS_MS)
    },
    [clearLongPress, openModal],
  )

  const handlePointerEnd = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  // ── Retry handler for the error banner ──────────────────────────────────
  const handleRetry = useCallback(() => {
    setEntitlementsLoadFailed(false)
    void useEntitlementsStore
      .getState()
      .loadEntitlements()
      .then(() => setEntitlementsLoadFailed(false))
      .catch(() => setEntitlementsLoadFailed(true))
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <ScreenChrome
      banner={
        <Header
          eyebrow="Pack drawer"
          title="Find your sound"
          subtitle="Hero, paid, and a fresh subscriber drop every month."
        />
      }
      currency={
        <Button.Currency data-skin-role="button.currency"
          aria-label={`Add Runbucks — current balance ${balance}`}
          data-testid="pack-drawer-wallet"
          supportingText={
            <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Add
            </span>
          }
          onClick={handleWalletPress}
        >
          <Icon name="coin" size={14} aria-hidden /> {balance.toLocaleString()}
        </Button.Currency>
      }
      footer={null}
    >
      <div
        data-testid="pack-drawer-stage"
        data-ftue="pack-drawer-root"
        data-skin-role="panel.section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          paddingBottom: 8,
          minHeight: 0,
        }}
      >
        {catalogError ? <ErrorBanner onRetry={handleRetry} /> : null}

        {isCatalogLoading ? (
          <PackSkeletonGrid />
        ) : (
          <>
            <KitSection
              id="owned"
              headline="Owned"
              subhead="Always available — your unlocked packs."
              kits={ownedKits}
              onKitPress={handleKitPress}
              renderTtl={(kit) => {
                if (kit.ownership !== 'trial') return undefined
                return useEntitlementsStore.getState().trialRemainingSeconds(kit.id)
              }}
            />
            <KitSection
              id="available"
              headline="Available"
              subhead={
                bonusMethod() === 'run_bits'
                  ? 'Spend Runbucks to buy, or 1 Runbuck to try for 24 hours.'
                  : 'Spend Runbucks or watch an ad to try for 24 hours.'
              }
              kits={availableKits}
              onKitPress={handleKitPress}
              renderTrailing={(kit) => <RunbucksPriceChip amount={kit.priceRunbucks} />}
              onLongPressKit={(kit, event) => {
                if (kit.tier !== 'themed') return
                event.preventDefault()
                handleThemedPointerDown(kit)
              }}
              onPointerEnd={handlePointerEnd}
            />
            {isSubscribed ? (
              <KitSection
                id="subscriber"
                headline="Subscriber Exclusive"
                subhead="A new generated kit lands every month for CORE+ members."
                kits={subscriberKits}
                onKitPress={handleKitPress}
              />
            ) : null}
          </>
        )}
      </div>
    </ScreenChrome>
  )
}

// ── Section component ─────────────────────────────────────────────────────

interface KitSectionProps {
  id: string
  headline: string
  subhead: string
  kits: KitMeta[]
  onKitPress: (kit: KitMeta) => void
  /** Optional trailing chip rendered under each card (used for prices). */
  renderTrailing?: (kit: KitMeta) => React.ReactNode
  /** Resolve a TTL for the trial countdown chip in seconds (Owned section). */
  renderTtl?: (kit: KitMeta) => number | undefined
  /**
   * PointerDown handler invoked per-kit; the section forwards the
   * `pointerdown` event so screens can attach long-press behaviour to
   * specific tiers (Themed Pack only).
   */
  onLongPressKit?: (kit: KitMeta, event: ReactPointerEvent<HTMLDivElement>) => void
  /** Pointer up / leave / cancel — clears any pending long-press timer. */
  onPointerEnd?: () => void
}

function KitSection({
  id,
  headline,
  subhead,
  kits,
  onKitPress,
  renderTrailing,
  renderTtl,
  onLongPressKit,
  onPointerEnd,
}: KitSectionProps) {
  if (kits.length === 0) return null
  return (
    <section
      data-testid={`pack-section-${id}`}
      data-skin-role="panel.section"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Label.Section data-skin-role="label.section">{headline}</Label.Section>
        <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{subhead}</span>
      </div>
      <div
        style={{
          // Responsive auto-fill grid — every tile is exactly the same
          // size and rows wrap as the viewport changes width. Replaces
          // the previous horizontal flex scroller that turned tiny on
          // narrow screens and stretched a single row across desktop
          // viewports without any reflow.
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          paddingBottom: 6,
        }}
      >
        {kits.map((kit) => (
          <div
            key={kit.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minWidth: 0,
            }}
            onPointerDown={(event) => onLongPressKit?.(kit, event)}
            onPointerUp={onPointerEnd}
            onPointerLeave={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <KitCard
              kit={kit}
              onPress={() => onKitPress(kit)}
              ttlSeconds={renderTtl?.(kit)}
            />
            {renderTrailing ? renderTrailing(kit) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Skeleton placeholder ──────────────────────────────────────────────────

const SKELETON_STYLE: CSSProperties = {
  width: 188,
  aspectRatio: '4 / 5',
  borderRadius: 'var(--ui-panel-card-radius, 16px)',
  background:
    'linear-gradient(135deg, rgba(168,130,232,0.12), rgba(168,130,232,0.06))',
  flex: '0 0 auto',
}

function PackSkeletonGrid() {
  return (
    <div
      data-testid="pack-drawer-skeleton"
      data-skin-role="panel.section"
      style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      {(['owned', 'available'] as const).map((id) => (
        <section
          key={id}
          data-testid={`pack-skeleton-${id}`}
          data-skin-role="panel.section"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <Label.Section data-skin-role="label.section">{id === 'owned' ? 'Owned' : 'Available'}</Label.Section>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 6,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                data-testid={`pack-skeleton-tile-${id}-${i}`}
                style={SKELETON_STYLE}
                aria-hidden
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Error banner ──────────────────────────────────────────────────────────

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel.Card
      data-testid="pack-drawer-error-banner"
      data-skin-role="panel.banner"
      role="alert"
    >
      <Stack space="sm">
        <Label.Section data-skin-role="label.section">Couldn’t load pack catalog</Label.Section>
        <Button.Primary data-skin-role="button.primary"
          data-testid="pack-drawer-error-retry"
          onClick={onRetry}
        >
          Retry
        </Button.Primary>
      </Stack>
    </Panel.Card>
  )
}
