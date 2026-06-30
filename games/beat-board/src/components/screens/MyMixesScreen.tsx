/**
 * MyMixesScreen — recording portfolio.
 *
 * Visual model: tile grid (auto-fill ~180px wide), same shape as
 * PackDrawerScreen. Each tile is purely visual:
 *   - 4:3 cover image (kit's coverArt or heroGradient fallback)
 *   - mix title
 *   - timestamp · duration
 *
 * Tapping a tile opens RecordingReview in replay mode — that modal
 * carries the play, share, rename, and delete affordances. Pulling
 * actions out of the tile keeps the grid scannable, prevents
 * multiple-mixes-playing-at-once (one detail modal at a time), and
 * matches the Packs → KitDetail navigation pattern.
 *
 * Layered architecture (see `src/systems/mixes/`):
 *   - `MixLibrary` is the source of truth.
 *   - `useMixesStore` mirrors the library's list for React.
 *   - This screen is pure render — every action routes through the
 *     detail modal.
 */

import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import {
  Button,
  Header,
  Icon,
  Panel,
  ScreenChrome,
  Tag,
} from '@modules/ui/skin'
import { useMixesStore, type MixSummary } from '../../stores/mixesStore'
import { getKitById } from '../../stores/kitsStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { recordScreenViewed } from '../../systems/analytics'
import {
  formatDurationLabel,
  formatRelativeTimestamp,
} from '../../systems/mixes'
import { useAssetUrl } from '../../preload/assets'

// ── Public component ─────────────────────────────────────────────────────

export function MyMixesScreen() {
  const mixes = useMixesStore((s) => s.mixes)
  const loadStatus = useMixesStore((s) => s.loadStatus)
  const setActiveTab = useNavigationStore((s) => s.setActiveTab)
  const clearBadge = useNavigationStore((s) => s.clearBadge)
  const focusedMixId = useNavigationStore((s) => s.focusedMixId)
  const openModal = useNavigationStore((s) => s.openModal)
  const setFocusedMix = useNavigationStore((s) => s.setFocusedMix)

  const badgeClearedRef = useRef(false)
  useEffect(() => {
    if (badgeClearedRef.current) return
    badgeClearedRef.current = true
    clearBadge('mixes')
  }, [clearBadge])

  const screenViewedFiredRef = useRef(false)
  useEffect(() => {
    if (screenViewedFiredRef.current) return
    screenViewedFiredRef.current = true
    recordScreenViewed({ screen: 'mixes' })
  }, [])

  useEffect(() => {
    if (!focusedMixId) return
    const focusedMix = mixes.find((mix) => mix.id === focusedMixId)
    if (!focusedMix) return
    openModal('recordingReview', { mixId: focusedMix.id, mode: 'replay' })
    setFocusedMix(null)
  }, [focusedMixId, mixes, openModal, setFocusedMix])

  if (loadStatus === 'hydrating' && mixes.length === 0) {
    return <MixesSkeleton />
  }

  if (mixes.length === 0) {
    return <MixesEmpty onOpenPlay={() => setActiveTab('play')} />
  }

  return (
    <ScreenChrome
      banner={
        <Header
          eyebrow="Library"
          title={`My Mixes (${mixes.length})`}
          subtitle="Tap a mix to replay, share, or tidy up."
        />
      }
    >
      <div
        data-testid="my-mixes-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))',
          gap: 12,
          width: '100%',
        }}
      >
        {mixes.map((mix) => (
          <MixTile key={mix.id} mix={mix} />
        ))}
      </div>
    </ScreenChrome>
  )
}

// ── States ───────────────────────────────────────────────────────────────

function MixesSkeleton() {
  return (
    <ScreenChrome
      banner={
        <Header eyebrow="Library" title="My Mixes" subtitle="Loading…" />
      }
    >
      <div
        data-testid="mixes-skeleton-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))',
          gap: 12,
        }}
      >
        {[0, 1, 2, 3].map((idx) => (
          <Panel.Card key={idx} data-skin-role="panel.card">
            <div
              data-testid={`mix-skeleton-${idx}`}
              style={{ padding: 8, display: 'grid', gap: 8 }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: 12,
                  background: 'var(--ui-panel-card-fill)',
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: '70%',
                  borderRadius: 6,
                  background: 'var(--ui-panel-card-fill)',
                  opacity: 0.5,
                }}
              />
            </div>
          </Panel.Card>
        ))}
      </div>
    </ScreenChrome>
  )
}

function MixesEmpty({ onOpenPlay }: { onOpenPlay: () => void }) {
  return (
    <ScreenChrome
      banner={
        <Header
          eyebrow="Library"
          title="My Mixes"
          subtitle="Your saved beats will land here."
        />
      }
    >
      <div
        data-testid="mixes-empty-state"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: '64px 16px',
          textAlign: 'center',
          minHeight: 280,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--ui-button-primary-fill)',
            color: 'var(--ui-button-primary-text)',
          }}
        >
          <Icon name="play" size={42} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>No mixes yet</div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--ui-text-muted)',
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          Tap a few pads, hit Record, and save your first beat. It will show up here.
        </div>
        <Button.Primary
          data-skin-role="button.primary"
          data-testid="mixes-empty-cta"
          onClick={onOpenPlay}
        >
          Open the Pad Grid
        </Button.Primary>
      </div>
    </ScreenChrome>
  )
}

// ── Mix tile ─────────────────────────────────────────────────────────────

interface MixTileProps {
  mix: MixSummary
}

function MixTile({ mix }: MixTileProps) {
  const sourceKit = getKitById(mix.kitId)
  const openModal = useNavigationStore((s) => s.openModal)

  const timestampLabel = useMemo(
    () => formatRelativeTimestamp(mix.createdAtMs, Date.now()),
    [mix.createdAtMs],
  )
  const durationLabel = formatDurationLabel(mix.durationSeconds)

  const handleOpen = () => {
    openModal('recordingReview', { mixId: mix.id, mode: 'replay' })
  }

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpen()
    }
  }

  return (
    <Panel.Card data-skin-role="panel.card">
      <div
        role="button"
        tabIndex={0}
        data-testid={`mix-tile-${mix.id}`}
        aria-label={`Open ${mix.title}`}
        onClick={handleOpen}
        onKeyDown={handleKey}
        style={{
          padding: 8,
          display: 'grid',
          gap: 8,
          width: '100%',
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <MixCover kit={sourceKit} isUnviewed={mix.isUnviewed} />
        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <span
            data-testid={`mix-title-${mix.id}`}
            style={{
              fontWeight: 800,
              fontSize: 14,
              lineHeight: 1.2,
              color: 'var(--ui-text-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {mix.title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--ui-text-muted)',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <span>{timestampLabel}</span>
            <span aria-hidden>·</span>
            <span>{durationLabel}</span>
          </span>
        </div>
      </div>
    </Panel.Card>
  )
}

function MixCover({
  kit,
  isUnviewed,
}: {
  kit: ReturnType<typeof getKitById>
  isUnviewed: boolean
}) {
  const coverUrl = useAssetUrl(kit?.coverArt ?? null)
  const background = coverUrl
    ? `center / cover no-repeat url(${JSON.stringify(coverUrl)})`
    : kit
    ? `linear-gradient(135deg, ${kit.heroGradient[0]}, ${kit.heroGradient[1]})`
    : 'var(--ui-panel-card-fill)'
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        borderRadius: 12,
        overflow: 'hidden',
        background,
      }}
    >
      {/* Visual play affordance — the tile itself is the tap target. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ui-button-primary-text)',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--ui-button-primary-fill)',
            border: '1px solid var(--ui-button-primary-border)',
            boxShadow: 'var(--ui-button-primary-shadow)',
          }}
        >
          <Icon name="play" size={18} />
        </div>
      </div>
      {isUnviewed ? (
        <div style={{ position: 'absolute', top: 6, right: 6 }}>
          <Tag.Callout data-skin-role="tag.callout">NEW</Tag.Callout>
        </div>
      ) : null}
    </div>
  )
}
