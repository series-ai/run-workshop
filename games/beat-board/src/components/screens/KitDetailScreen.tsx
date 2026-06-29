/**
 * KitDetailScreen — pushed pack-detail screen (PRD § Screen: KitDetail).
 *
 * Issue beat-board-21-kit-detail-screen owns this file. Wires the visual
 * scaffold to real stores (kitsStore + entitlementsStore + subscriptionStore
 * + navigationStore) and the rewarded-placements system.
 *
 * Layout (PRD spec):
 *   ┌──────────────────────────────────────────┐
 *   │  ◀ Back                                  │  ← top row
 *   ├──────────────────────────────────────────┤
 *   │     [16:9 hero band — kit gradient]      │  ← ~30% vertical
 *   ├──────────────────────────────────────────┤
 *   │  Pack Name        [BPM 80–95]            │
 *   │  [8 layers · 32 pads] (counter chip)     │
 *   ├──────────────────────────────────────────┤
 *   │     [PadCellGrid mode='preview' 1×4]     │  ← sample row
 *   ├──────────────────────────────────────────┤
 *   │  Description copy (1-2 sentences)        │
 *   ├──────────────────────────────────────────┤
 *   │  [Primary CTA — Play / Buy / Trial]      │  ← state-dependent
 *   │  [Secondary CTA — rewarded ad / buy now] │
 *   └──────────────────────────────────────────┘
 *
 * State-dependent CTA:
 *   - Owned (catalog or `pack_owned_<id>` entitlement) → "Play this pack"
 *     primary CTA → setActiveKit + switch to Play tab.
 *   - Trial active (`pack_trial_<id>` not yet expired) → secondary "Trial —
 *     Nh Mm left" + small primary "Buy permanently — N Runbucks".
 *   - Not owned → primary "Get [Pack] — N Runbucks" → opens
 *     `packPurchase` modal via `navigationStore.openModal`. If the rewarded
 *     ad is ready (and the player isn't a subscriber and doesn't already
 *     own/trial the pack), an additional outline "Try for 24h — Watch ad"
 *     button opens `rewardedAdConfirm`.
 *
 * The 1-bar audio sting is fire-and-forget — the audio runtime is not yet
 * connected to the screen, so we log + emit `pack_previewed` analytics and
 * let the PadCellGrid handle the visual flash. Once the audio engine wiring
 * lands, the `onPreviewSting` callback below is the single hook.
 *
 * data-skin-role coverage: panel.card (hero band), label.title (pack name),
 * badge.status (BPM range), badge.counter (layer chip), button.icon (back),
 * button.primary / button.secondary / button.outline (CTAs).
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Background,
  Badge,
  Button,
  Cluster,
  Label,
  ScreenChrome,
  Stack,
  Tag,
} from '@modules/ui/skin'
import { RunbucksPriceChip } from '../widgets/RunbucksPriceChip'
import { useKitsStore, type KitMeta } from '../../stores/kitsStore'
import { useEntitlementsStore } from '../../stores/entitlementsStore'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import { useNavigationStore } from '../../stores/navigationStore'
import {
  BONUS_COST_RUN_BITS,
  bonusMethod,
  rewardedPlacements,
} from '../../systems/rewarded-placements'
import { recordScreenViewed } from '../../systems/analytics'
import { useAssetUrl } from '../../preload/assets'

// ── Constants ─────────────────────────────────────────────────────────────

/** prd.md § Mechanics Detail § Pad grid — 4×4 grid = 16 pads × 2 (variants) = 32 pads per kit. */
const PADS_PER_KIT = 32

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build the SDK product id for a kit. Matches the convention used in the
 * IAP pricing table (e.g. `mellow-trap` → `pack_mellow_trap`). Hero / free
 * kits never reach this path because owned-CTA short-circuits first.
 */
function productIdForKit(kitId: string): string {
  return `pack_${kitId.replace(/-/g, '_')}`
}

/** "8 layers · 32 pads" copy used in the badge counter chip. */
function layerCounterCopy(kit: KitMeta): string {
  return `${kit.layers} layers · ${PADS_PER_KIT} pads`
}

/** Format remaining trial time as "Nh Mm left". */
function formatTrialRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '0h 0m left'
  const totalMinutes = Math.floor(remainingSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m left`
}

// ── Screen ────────────────────────────────────────────────────────────────

export function KitDetailScreen() {
  // Resolve which kit to show — modal params pushed by the entry caller, or
  // fall back to the active kit. Reading `modalParams` rather than
  // `getModalParams` so the selector returns a primitive-ish reference and
  // avoids the zustand-selector-method-call lint.
  const modalParams = useNavigationStore((s) => s.modalParams)
  const activeKitId = useKitsStore((s) => s.activeKitId)
  const targetKitId =
    (modalParams['kit-detail'] as { kitId?: string } | undefined)?.kitId ?? activeKitId

  const kit = useKitsStore((s) => s.kits[targetKitId])

  const setActiveKit = useKitsStore((s) => s.setActiveKit)
  const setActiveTab = useNavigationStore((s) => s.setActiveTab)
  const navigateBack = useNavigationStore((s) => s.navigateBack)
  const openModal = useNavigationStore((s) => s.openModal)

  // Ownership resolution — entitlement service is authoritative; catalog
  // ownership ('hero') maps to "owned" so the hero pack always shows Play.
  // Subscribe to the underlying entitlement map so React re-renders when a
  // grant lands.
  const entitlementsMap = useEntitlementsStore((s) => s.entitlements)
  const ownsViaEntitlement = useMemo(() => {
    if (!kit) return false
    return useEntitlementsStore.getState().ownsPack(kit.id)
    // entitlementsMap dependency keeps this re-evaluating when grants land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementsMap, kit?.id])
  const trialActive = useMemo(() => {
    if (!kit) return false
    return useEntitlementsStore.getState().isTrialActive(kit.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementsMap, kit?.id])
  const trialRemainingSeconds = useMemo(() => {
    if (!kit) return 0
    return useEntitlementsStore.getState().trialRemainingSeconds(kit.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementsMap, kit?.id])

  // Subscriber gating for the rewarded-ad affordance — read the boolean
  // surface so React subscribes to the change.
  const subscriptionActive = useSubscriptionStore((s) => s.isActive)

  const ownsKit = useMemo(() => {
    if (!kit) return false
    if (kit.tier === 'hero') return true
    if (kit.ownership === 'owned' || kit.ownership === 'free') return true
    return ownsViaEntitlement
  }, [kit, ownsViaEntitlement])

  // Rewarded-ad readiness probed once on mount (and whenever the kit /
  // subscriber state flips). Default to false until the async probe resolves.
  const [rewardedReady, setRewardedReady] = useState(false)
  useEffect(() => {
    if (!kit || ownsKit || trialActive) {
      setRewardedReady(false)
      return
    }
    let cancelled = false
    void rewardedPlacements
      .canShow(kit.id)
      .then((ready) => {
        if (!cancelled) setRewardedReady(ready)
      })
      .catch(() => {
        if (!cancelled) setRewardedReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [kit, ownsKit, trialActive, subscriptionActive])

  // Analytics — `screen_viewed { screen: 'kit_detail', source: 'packs' }`
  // fires once per mount.
  useEffect(() => {
    recordScreenViewed({ screen: 'kit_detail', source: 'packs' } as never)
  }, [])

  // (Sample-pad sting handler removed in the 6-block redesign — KitDetail
  // now shows a poster grid, not an interactive preview row.)

  // ── Error state ────────────────────────────────────────────────────────
  if (!kit) {
    return (
      <ScreenChrome back onBack={() => navigateBack()}>
        <div
          data-testid="kit-detail-error"
          role="alert"
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: 'var(--ui-text-primary)',
            maxWidth: 520,
            width: '100%',
            marginInline: 'auto',
          }}
        >
          <Stack space="sm">
            <Label.Title data-skin-role="label.title">Pack unavailable</Label.Title>
            <Label.Section data-skin-role="label.section">
              We couldn&rsquo;t load this pack. Try going back and tapping it again.
            </Label.Section>
            <Button.Primary data-skin-role="button.primary"
              data-testid="kit-detail-error-back"
              onClick={() => navigateBack()}
            >
              Back to Packs
            </Button.Primary>
          </Stack>
        </div>
      </ScreenChrome>
    )
  }

  // ── CTA handlers ───────────────────────────────────────────────────────
  const handlePlay = () => {
    setActiveKit(kit.id)
    setActiveTab('play')
  }

  const handleBuy = () => {
    openModal('packPurchase', {
      packId: kit.id,
      packName: kit.name,
      productId: productIdForKit(kit.id),
      priceRunbucks: kit.priceRunbucks,
      whatsInside: `${kit.layers} layers · ${PADS_PER_KIT} pads · BPM ${kit.bpmRange}`,
    })
  }

  const handleRewardedAd = () => {
    openModal('rewardedAdConfirm', { packId: kit.id, packName: kit.name })
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <ScreenChrome back onBack={() => navigateBack()}>
      <div
        data-testid="kit-detail-stage"
        data-pack-id={kit.id}
        data-pack-tier={kit.tier}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 8,
          minHeight: 0,
          // Constrain the kit-detail body to a phone-column on
          // landscape so the hero, sample-pad row, description and
          // CTA don't stretch into a billboard. The pack drawer, pad
          // grid and other screens fill the viewport unchanged.
          maxWidth: 520,
          width: '100%',
          marginInline: 'auto',
        }}
      >
        {/* Hero panel — 16:9 gradient band per Component Translation Table. */}
        <KitHero kit={kit} />

        {/* Title row — pack name + BPM range badge. */}
        <Stack space="xs">
          <Cluster space="sm" align="center" justify="between">
            <Label.Title data-skin-role="label.title" data-testid="kit-detail-title">{kit.name}</Label.Title>
            <span data-testid="kit-detail-bpm-badge">
              <Badge.Status data-skin-role="badge.status">BPM {kit.bpmRange}</Badge.Status>
            </span>
          </Cluster>
          <span data-testid="kit-detail-layers-chip">
            <Badge.Counter data-skin-role="badge.counter">{layerCounterCopy(kit)}</Badge.Counter>
          </span>
        </Stack>

        {/* Description copy. */}
        <p
          data-testid="kit-detail-description"
          data-skin-role="label.section"
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.45,
            color: 'var(--ui-text-primary)',
          }}
        >
          {kit.flavor}
        </p>

        {/* CTA area. */}
        <KitDetailCta
          kit={kit}
          owns={ownsKit}
          trialActive={trialActive}
          trialRemainingSeconds={trialRemainingSeconds}
          rewardedReady={rewardedReady}
          onPlay={handlePlay}
          onBuy={handleBuy}
          onRewardedAd={handleRewardedAd}
        />
      </div>
    </ScreenChrome>
  )
}

// ── Hero panel ────────────────────────────────────────────────────────────

function KitHero({ kit }: { kit: KitMeta }) {
  // Cover art (asset-bot-generated /images/packs/<id>.png) takes
  // priority over the placeholder gradient. Same pattern KitHeroArt
  // uses on the Pack Drawer tile — keep the gradient as the underlay
  // so the slot reads as deliberate while the image loads, and as
  // the fallback for kits without artwork yet.
  const heroStyle: CSSProperties = {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 'var(--ui-panel-card-radius, 16px)',
    background: kit.coverArt
      ? `url('${kit.coverArt}') center/cover no-repeat, linear-gradient(135deg, ${kit.heroGradient[0]}, ${kit.heroGradient[1]})`
      : `linear-gradient(135deg, ${kit.heroGradient[0]}, ${kit.heroGradient[1]})`,
    position: 'relative',
    overflow: 'hidden',
  }
  return (
    <div
      data-testid="kit-detail-hero"
      data-skin-role="panel.card"
      data-kit-aspect="16 / 9"
      data-pack-id={kit.id}
      style={heroStyle}
      aria-hidden
    >
      {kit.coverArt ? (
        <KitDetailCoverImage path={kit.coverArt} />
      ) : (
        // Only render the tier-label/orb chrome when we don't have a
        // generated cover. With real artwork the label competes with
        // the image's own composition.
        <Background>
          <span aria-hidden className="kit-detail-tier-label">
            {tierLabel(kit)}
          </span>
          <span aria-hidden className="kit-detail-hero-orb" />
        </Background>
      )}
    </div>
  )
}

function KitDetailCoverImage({ path }: { path: string }) {
  const url = useAssetUrl(path)
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
    />
  )
}

function tierLabel(kit: KitMeta): string {
  switch (kit.tier) {
    case 'hero':
      return 'Hero · Lofi'
    case 'genre':
      return 'Genre Pack'
    case 'themed':
      return 'Themed Pack'
    case 'subscriber':
      return 'Subscriber'
    case 'pack-pass':
      return 'Pack Pass'
  }
}

// ── CTA cluster ───────────────────────────────────────────────────────────

interface KitDetailCtaProps {
  kit: KitMeta
  owns: boolean
  trialActive: boolean
  trialRemainingSeconds: number
  rewardedReady: boolean
  onPlay: () => void
  onBuy: () => void
  onRewardedAd: () => void
}

function KitDetailCta({
  kit,
  owns,
  trialActive,
  trialRemainingSeconds,
  rewardedReady,
  onPlay,
  onBuy,
  onRewardedAd,
}: KitDetailCtaProps) {
  // 1) Owned — single primary "Play this pack".
  if (owns) {
    return (
      <Stack space="sm">
        <Button.Primary data-skin-role="button.primary"
          data-testid="kit-detail-cta-play"
          onClick={onPlay}
          style={{ width: '100%' }}
        >
          Play this pack
        </Button.Primary>
      </Stack>
    )
  }

  // 2) Trial active — secondary trial countdown + small permanent buy primary.
  if (trialActive) {
    return (
      <Stack space="sm">
        <Button.Secondary data-skin-role="button.secondary"
          data-testid="kit-detail-cta-trial"
          onClick={onPlay}
          style={{ width: '100%' }}
        >
          <Cluster space="xs" align="center" justify="between">
            <span>Trial — {formatTrialRemaining(trialRemainingSeconds)}</span>
            <Tag.Callout data-skin-role="tag.callout">Active</Tag.Callout>
          </Cluster>
        </Button.Secondary>
        <Button.Primary data-skin-role="button.primary"
          data-testid="kit-detail-cta-buy-permanent"
          onClick={onBuy}
          style={{ width: '100%' }}
        >
          <Cluster space="xs" align="center" justify="center">
            <span>Buy permanently —</span>
            <RunbucksPriceChip amount={kit.priceRunbucks} variant="cta" />
          </Cluster>
        </Button.Primary>
      </Stack>
    )
  }

  // 3) Not owned — primary buy CTA + optional rewarded ad outline.
  return (
    <Stack space="sm">
      <Button.Primary data-skin-role="button.primary"
        data-testid="kit-detail-cta-buy"
        onClick={onBuy}
        style={{ width: '100%' }}
      >
        <Cluster space="xs" align="center" justify="center">
          <span>Get {kit.name} —</span>
          <RunbucksPriceChip amount={kit.priceRunbucks} variant="cta" />
        </Cluster>
      </Button.Primary>
      {rewardedReady ? (
        <Button.Ghost data-skin-role="button.ghost"
          data-testid="kit-detail-cta-rewarded"
          data-cta-variant="outline"
          data-bonus-method={bonusMethod()}
          onClick={onRewardedAd}
          style={{ width: '100%' }}
        >
          {bonusMethod() === 'run_bits' ? (
            // No-ads channel: pay 1 Runbuck. Reuse the currency chip so this
            // reads exactly like the game's other purchase CTAs — no ad copy.
            <Cluster space="xs" align="center" justify="center">
              <span>Try for 24h —</span>
              <RunbucksPriceChip amount={BONUS_COST_RUN_BITS} variant="cta" />
            </Cluster>
          ) : (
            'Try for 24h — Watch ad'
          )}
        </Button.Ghost>
      ) : null}
    </Stack>
  )
}
