/**
 * KitCard — compact pack tile shared across:
 *   - PackDrawer (sectioned grid, default `size='card'`)
 *   - MyMixes (mix's source-pack chip, `size='mini'`)
 *   - KitDetail (full-bleed hero header, `size='hero'`)
 *
 * Render modes (per prd.md § Component Translation Table § KitCard +
 * issue beat-board-12-kit-card-widget acceptance criteria):
 *
 *   size='card'  — default. 4:5 aspect tile, hero art top, name + ownership
 *                  chip bottom. "NEW" dot in top-right when `isNew`.
 *   size='mini'  — single-line miniature for MyMixes mix-source chip:
 *                  smaller hero art + name only, no ownership chip.
 *   size='hero'  — full-bleed 16:9 hero band for KitDetail, no chip overlay.
 *
 * Animation intent (per prd.md § Component Translation Table):
 *   - Tap → 0.97 scale punch over 80ms via `juice/punch` (ease-out).
 *
 * Ownership chip (prop-driven — parent screens compute ownership from
 * `monetization/entitlements-service`):
 *   - 'free'  → "Free" status badge
 *   - 'owned' → "Owned" status badge (with check icon)
 *   - 'trial' → "Trial — Nh Mm left" countdown chip; consumes `ttlSeconds`
 *               and ticks each minute (not per-second; UI updates each
 *               minute per prd.md § Pack ownership and access tiers).
 *   - 'paid'  → `RunbucksPriceChip` with kit price (299 / 499 / 1499 per
 *               prd.md § IAP Pricing Table).
 *
 * data-skin-role coverage: panel.card (full surface), tag.status / chip.value
 * (ownership badges), button via the wrapping Button.Ghost.
 *
 * Backwards-compat: the legacy `variant: 'card' | 'chip'` prop is still
 * accepted ("chip" maps to size='mini'). Existing screens may continue to
 * pass `variant="chip"`; new call sites should use `size`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Badge, Icon, Panel, Tag } from '@modules/ui/skin'
import { createPunch, type Punch } from '../../modules/juice/punch/Punch'
import { RunbucksPriceChip } from './RunbucksPriceChip'
import type { KitMeta } from '../../stores/kitsStore'
import { useAssetUrl } from '../../preload/assets'
import {
  KIT_CARD_PUNCH_MS,
  kitCardPunchConfig,
} from '../../polish/animation-timing'

export type KitCardSize = 'card' | 'mini' | 'hero'
/** @deprecated Use `size` instead. Retained for backwards compatibility. */
export type KitCardVariant = 'card' | 'chip'

export interface KitCardProps {
  kit: KitMeta
  /** Render mode. Defaults to 'card' (full tile). */
  size?: KitCardSize
  /** @deprecated Legacy alias mapped to `size` ('chip' → 'mini'). */
  variant?: KitCardVariant
  /** Selected tile state for PackDrawer (highlighted border). */
  selected?: boolean
  /** Tap handler. Receives the kit id so parents can route by id. */
  onPress?: (kitId: string) => void
  /** Trial countdown remainder in seconds. Required when ownership === 'trial'. */
  ttlSeconds?: number
  /** Show "NEW" dot in top-right (driven by ui/badge-notifications or screen state). */
  isNew?: boolean
}

const PUNCH_DURATION_MS = KIT_CARD_PUNCH_MS
const PUNCH_TARGET_SCALE = 1 - kitCardPunchConfig.strength

function resolveSize(size: KitCardSize | undefined, variant: KitCardVariant | undefined): KitCardSize {
  if (size) return size
  if (variant === 'chip') return 'mini'
  return 'card'
}

/**
 * Hook: drives the juice/punch tap animation and exposes the current scale
 * value for the wrapping element. The punch envelope ramps to 0.97 then
 * back to 1.0 over PUNCH_DURATION_MS — see `modules/juice/punch/Punch.ts`.
 */
function useTapPunch(): { scale: number; trigger: () => void } {
  const [scale, setScale] = useState(1)
  const punchRef = useRef<Punch | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  if (punchRef.current === null) {
    // Punch tuning lives in `src/polish/animation-timing.ts` so a single
    // edit re-tunes every kit-card tap. Strength is the *displacement from
    // rest*; rest scale is 1.0 and the target is 0.97 → strength = 0.03.
    // Vibrato 0.5 + elasticity 0 = a single half-oscillation that lands at
    // 0.97 then returns.
    punchRef.current = createPunch({ ...kitCardPunchConfig })
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const tick = useCallback(() => {
    const now = performance.now()
    const dt = (now - lastTimeRef.current) / 1000
    lastTimeRef.current = now

    const punch = punchRef.current!
    const state = punch.update(dt)
    // Punch.value is the offset from rest; subtract from 1.0 to get the
    // current scale. Math.abs makes the half-oscillation always shrink.
    const nextScale = 1 - Math.abs(state.value)
    setScale(nextScale)

    if (state.active) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      setScale(1)
      rafRef.current = null
    }
  }, [])

  const trigger = useCallback(() => {
    const punch = punchRef.current!
    punch.trigger()
    lastTimeRef.current = performance.now()
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  return { scale, trigger }
}

export function KitCard(props: KitCardProps) {
  const size = resolveSize(props.size, props.variant)
  if (size === 'mini') return <KitCardMini {...props} />
  if (size === 'hero') return <KitCardHero {...props} />
  return <KitCardTile {...props} />
}

function KitCardTile({
  kit,
  selected,
  onPress,
  ttlSeconds,
  isNew,
}: KitCardProps) {
  const { scale, trigger } = useTapPunch()

  // `comingSoon` kits keep their tap behaviour so the player can open
  // kit-detail for a preview ("here's what this pack will sound like").
  // The badge below telegraphs the unavailable-audio state; kit-detail
  // and downstream purchase flows handle the empty-pads case.
  const isComingSoon = kit.comingSoon === true

  const handleClick = useCallback(() => {
    trigger()
    onPress?.(kit.id)
  }, [kit.id, onPress, trigger])

  return (
    // Outer wrapper is a div role="button" rather than Button.Ghost: the
    // skin button shape wraps content in `ui-button__copy` flex slots sized
    // for text labels, which squashes the hero art + meta block into ~10–30px
    // vertical strips. The KitCard owns its own card chrome (Panel.Card +
    // hero gradient + meta column), so we route taps through a div with
    // role="button" for accessibility while keeping the punch animation
    // and aspect ratio under our own control.
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${kit.name} pack`}
      data-testid={`kit-card-${kit.id}`}
      data-kit-tier={kit.tier}
      data-kit-ownership={kit.ownership}
      data-kit-selected={selected ? 'true' : 'false'}
      data-kit-coming-soon={isComingSoon ? 'true' : 'false'}
      data-kit-size="card"
      data-kit-aspect="4 / 5"
      data-punch-duration-ms={String(PUNCH_DURATION_MS)}
      data-punch-target-scale={String(PUNCH_TARGET_SCALE)}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      style={{
        // No fixed width — the parent grid (PackDrawerScreen.KitSection)
        // sizes the column via `repeat(auto-fill, minmax(180px, 1fr))`,
        // so every tile is identical and the layout reflows on
        // viewport resize. The 4:5 aspect ratio still pins the tile
        // shape regardless of column width.
        width: '100%',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        opacity: isComingSoon ? 0.7 : 1,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        aspectRatio: '4 / 5',
      }}
    >
      <Panel.Card
        style={{
          width: '100%',
          height: '100%',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderColor: selected
            ? 'var(--ui-focus-ring, rgba(168,130,232,0.7))'
            : 'var(--ui-panel-card-border, rgba(255,255,255,0.18))',
          borderWidth: selected ? 2 : 1,
          // Fallback fill so the card is visible even if the renderer's
          // panel.card token resolves to transparent. Overlapping the
          // renderer's --ui-panel-card-fill is intentional — the renderer's
          // value takes precedence when it's a non-transparent color.
          background:
            'var(--ui-panel-card-fill, rgba(20, 24, 36, 0.92))',
          position: 'relative',
        }}
      >
        <KitHeroArt kit={kit} flex height={undefined} />
        {isNew ? <KitNewDot kitId={kit.id} /> : null}
        <div
          data-testid="kit-meta"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '12px 14px 14px',
            alignItems: 'flex-start',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: 15,
              lineHeight: 1.2,
              // Clamp every title to exactly two lines and reserve
              // that height even for short titles ("Lofi Heights")
              // so a 1-line tile and a 2-line tile ("Brooklyn Boom-
              // Bap") have identical total card heights in the grid.
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 'calc(15px * 1.2 * 2)',
            }}
          >{kit.name}</span>
          <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>
            {kit.bpmRange} BPM · {kit.layers} layers
          </span>
          {isComingSoon ? (
            <span
              data-testid={`kit-coming-soon-${kit.id}`}
              data-skin-role="tag.status"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: 'var(--ui-text-muted)',
                border: '1px solid var(--ui-color-border)',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              Coming soon
            </span>
          ) : (
            <KitOwnershipChip kit={kit} ttlSeconds={ttlSeconds} />
          )}
        </div>
      </Panel.Card>
    </div>
  )
}

function KitCardMini({ kit, onPress }: KitCardProps) {
  const { scale, trigger } = useTapPunch()

  const handleClick = useCallback(() => {
    trigger()
    onPress?.(kit.id)
  }, [kit.id, onPress, trigger])

  return (
    // Same rationale as KitCardTile: skin Button copy slots squash the
    // gradient swatch + label. A plain div with role="button" preserves
    // the chip shape and keeps the punch animation under our control.
    <div
      role="button"
      tabIndex={0}
      aria-label={`Source pack: ${kit.name}`}
      data-testid={`kit-chip-${kit.id}`}
      data-kit-size="mini"
      data-kit-tier={kit.tier}
      data-kit-ownership={kit.ownership}
      data-punch-duration-ms={String(PUNCH_DURATION_MS)}
      data-punch-target-scale={String(PUNCH_TARGET_SCALE)}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'transparent',
        border: '1px solid var(--ui-panel-card-border)',
        borderRadius: 'var(--radius-full, 9999px)',
        cursor: 'pointer',
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${kit.heroGradient[0]}, ${kit.heroGradient[1]})`,
          flex: '0 0 auto',
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 700 }}>{kit.name}</span>
    </div>
  )
}

function KitCardHero({ kit, onPress, isNew }: KitCardProps) {
  const { scale, trigger } = useTapPunch()

  const handleClick = useCallback(() => {
    trigger()
    onPress?.(kit.id)
  }, [kit.id, onPress, trigger])

  return (
    <div
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      data-testid={`kit-hero-tile-${kit.id}`}
      data-kit-size="hero"
      data-kit-aspect="16 / 9"
      data-kit-tier={kit.tier}
      data-kit-ownership={kit.ownership}
      data-punch-duration-ms={String(PUNCH_DURATION_MS)}
      data-punch-target-scale={String(PUNCH_TARGET_SCALE)}
      onClick={onPress ? handleClick : undefined}
      onKeyDown={
        onPress
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--ui-panel-card-radius, 16px)',
        cursor: onPress ? 'pointer' : 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}
    >
      <KitHeroArt kit={kit} flex height={undefined} />
      {isNew ? <KitNewDot kitId={kit.id} /> : null}
    </div>
  )
}

function KitOwnershipChip({ kit, ttlSeconds }: { kit: KitMeta; ttlSeconds?: number }) {
  if (kit.ownership === 'free') {
    return (
      <span data-testid={`kit-ownership-${kit.id}`} data-ownership="free">
        <Tag.Status>Free</Tag.Status>
      </span>
    )
  }
  if (kit.ownership === 'owned') {
    return (
      <span data-testid={`kit-ownership-${kit.id}`} data-ownership="owned">
        <Tag.Status>
          <Icon name="check" size={11} aria-hidden /> Owned
        </Tag.Status>
      </span>
    )
  }
  if (kit.ownership === 'trial') {
    return (
      <span
        data-testid={`kit-ownership-${kit.id}`}
        data-ownership="trial"
        style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
      >
        <Tag.Callout>
          Trial — <TrialCountdown ttlSeconds={ttlSeconds} fallback={kit.trialRemaining} />
        </Tag.Callout>
      </span>
    )
  }
  // ownership === 'paid'
  return (
    <span data-testid={`kit-ownership-${kit.id}`} data-ownership="paid">
      <RunbucksPriceChip amount={kit.priceRunbucks} />
    </span>
  )
}

/**
 * TrialCountdown — renders "Nh Mm left", ticking once per minute. Per
 * prd.md § Pack ownership and access tiers, the UI updates each minute
 * (not per-second) so this hook reads the wall clock once a minute and
 * re-renders.
 */
function TrialCountdown({
  ttlSeconds,
  fallback,
}: {
  ttlSeconds: number | undefined
  fallback: string | undefined
}) {
  // Anchor the deadline at mount time (epoch ms). Keep it stable across
  // re-renders — only `ttlSeconds` changes recompute the deadline.
  const deadline = useMemo(() => {
    if (typeof ttlSeconds !== 'number') return null
    return Date.now() + ttlSeconds * 1000
  }, [ttlSeconds])

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === null) return
    // Tick once per minute (not per-second) per prd.md § Pack ownership and
    // access tiers — UI updates each minute. Anchoring at a 60s interval
    // means the visible "Nh Mm" string changes whenever the next 60-second
    // window crosses a minute boundary on the deadline.
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [deadline])

  if (deadline === null) {
    return <>{fallback ?? '24h left'}</>
  }

  const remainingMs = Math.max(0, deadline - now)
  const totalMinutes = Math.floor(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return <>{`${hours}h ${minutes}m left`}</>
}

function KitNewDot({ kitId }: { kitId: string }) {
  return (
    <span
      data-testid={`kit-new-dot-${kitId}`}
      style={{
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 1,
      }}
    >
      <Badge.New>NEW</Badge.New>
    </span>
  )
}

function KitHeroArt({
  kit,
  height,
  flex,
}: {
  kit: KitMeta
  height: number | undefined
  flex?: boolean
}) {
  // SkinPanel renders children inside `.ui-panel__body` which is
  // `display: grid` — `flex: 1 1 auto` collapses to 0 px there, which
  // is why the hero used to vanish on the pack tile and the cover
  // image had no slot to live in. Use a definite size: when `flex` is
  // requested by the caller (pack tile + kit-detail tile), pin a
  // 4:3 aspect ratio so the hero is the dominant element of the
  // card; otherwise honour the legacy fixed `height` (mixes mini
  // poster, etc.).
  const heroStyle: CSSProperties = {
    width: '100%',
    height: flex ? undefined : (height ?? 104),
    aspectRatio: flex ? '4 / 3' : undefined,
    // Gradient is the underlay — visible while a coverArt <img> is
    // loading and as the permanent fallback for kits without art.
    background: `linear-gradient(135deg, ${kit.heroGradient[0]}, ${kit.heroGradient[1]})`,
    position: 'relative',
    overflow: 'hidden',
  }
  return (
    <div data-testid={`kit-hero-${kit.id}`} style={heroStyle}>
      <KitCoverImage path={kit.coverArt} />
      {kit.coverArt ? null : <KitHeroChrome kit={kit} />}
    </div>
  )
}

// Soft circular accent + tier label — only rendered as placeholder
// chrome when no coverArt PNG is available. Kept out of KitHeroArt's
// JSX so the rgba/gradient values it relies on (legacy theme tokens)
// stay in one isolated function rather than fighting the cover image.
// Pulls `kit.coverArt` (a path relative to `cdn-assets/`, e.g.
// `images/packs/glass_house.png`) through the Rundot CDN client so
// the image lives on the deployed CDN in production. Renders nothing
// until the SDK has resolved the blob URL — the parent's gradient
// underlay covers the loading window.
function KitCoverImage({ path }: { path?: string | null }) {
  const url = useAssetUrl(path ?? null)
  if (!path || !url) return null
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

function KitHeroChrome({ kit }: { kit: KitMeta }) {
  return (
    <>
      {/* Soft circular accent — visually echoes the pad-grid dot motif. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -24,
          bottom: -24,
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 14,
          top: 14,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.86)',
        }}
      >
        {tierLabel(kit)}
      </span>
    </>
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
