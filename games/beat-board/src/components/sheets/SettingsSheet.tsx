/**
 * SettingsSheet — bottom-sheet modal that exposes audio controls (master
 * volume + mute), the current subscription tier with management/purchase
 * affordance, and an "About" section linking to Credits and showing the
 * shipped version.
 *
 * Issue beat-board-24-settings-modal owns this file.
 *
 * PRD references:
 *   - prd.md § Screen: Settings — layout, copy, interactions
 *   - prd.md § Subscription Products — tier picker, CORE/PLUS surface
 *   - prd.md § Screen: Credits — Credits link
 *
 * Reachable from:
 *   - SettingsTabScreen (4th bottom-nav tab) — embeds SettingsSheet body
 *   - Any caller that pushes `navigationStore.openModal('settings')` via
 *     NavigationModalHost (preserved as a back-compat path; no production
 *     surface uses it after the 2026-04-26 nav simplification)
 *
 * The Settings modal sheet binds:
 *   - Volume slider → `ui/settings-overlay`'s `musicVolume` and `soundVolume`
 *     (audio-master subscribes to settings-overlay so the master gain follows
 *     the slider in real time without a direct setter call).
 *   - Mute toggle → `ui/settings-overlay`'s `soundEnabled` and `musicEnabled`
 *     (mute = both flags false).
 *   - Subscription tier label → `subscriptionStore.tier`
 *   - Manage subscription button → `RundotAPI.iap.openStore()` when subscribed,
 *     otherwise reveals an inline tier picker that calls
 *     `subscriptionStore.purchaseSubscription(tier, interval)`.
 *   - Credits link → `navigationStore.openModal('credits')`
 */

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ElementType } from 'react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  Button,
  Cluster,
  Label,
  NavClose,
  Panel,
  Settings,
  Slider,
  Stack,
  Switch,
} from '@modules/ui/skin'
import { useSettingsStore } from '../../modules/ui/settings-overlay/SettingsOverlay'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { analytics as analyticsModule } from '../../modules/data/analytics-service/AnalyticsService'
import pkg from '../../../package.json'
import type {
  SubscriptionTier,
  SubscriptionInterval,
} from '../../modules/monetization/subscription-sdk/types'

// ── Types ────────────────────────────────────────────────────────────────

export interface SettingsSheetProps {
  /** Called when the sheet should dismiss (drag handle, X button). */
  onClose: () => void
  /**
   * Hide the dismiss row (drag handle + close X). Used by the
   * `SettingsTabScreen` variant where Settings is its own bottom-nav
   * destination and there's nothing meaningful to dismiss to.
   */
  hideDismiss?: boolean
  /**
   * Optional override — when true, the tier label renders a skeleton state
   * instead of reading `subscriptionStore.tier`. Used while the SDK
   * `isUserSubscribed` resolution is still pending on first boot.
   */
  isSubscriptionLoading?: boolean
  /**
   * Optional override — when set, the tier label falls back to "—" and the
   * row exposes a retry affordance. Wired by the integrator that owns the
   * `subscriptionStore.syncFromPlatform` call.
   */
  subscriptionError?: string
  /**
   * Retry callback invoked when the user taps the inline retry button in the
   * subscription error state.
   */
  onRetrySubscription?: () => void
}

interface PickerEntry {
  tier: SubscriptionTier
  interval: SubscriptionInterval
  label: string
  /** Display price string — falls back to a generic label if the SDK omits price metadata. */
  price: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a sound/music volume pair from the settings-overlay store
 * (each in the [0, 1] range) into the [0, 100] surface that the slider
 * exposes to the player. We treat the maximum of the two underlying
 * volumes as "the master volume the user perceives" so reading after a
 * partial mute (e.g. soundVolume = 0 because the audio engine paused FX)
 * still returns the player's intended level.
 */
function toSliderValue(soundVolume: number, musicVolume: number): number {
  const max = Math.max(soundVolume, musicVolume)
  return Math.round(Math.min(1, Math.max(0, max)) * 100)
}

/** Format a SubscriptionPackage price into a localized-looking string. */
function formatPrice(pkg: { price: number; currencyCode: string; description: string }): string {
  if (pkg.description && pkg.description.length > 0) return pkg.description
  if (pkg.currencyCode === 'USD') return `$${pkg.price.toFixed(2)}`
  return `${pkg.price.toFixed(2)} ${pkg.currencyCode}`
}

/** Tier label as shown in the Subscription row. */
function tierLabel(tier: 'free' | 'CORE' | 'PLUS'): string {
  if (tier === 'free') return 'Free'
  return tier
}

// ── Component ────────────────────────────────────────────────────────────

export function SettingsSheet({
  onClose,
  hideDismiss = false,
  isSubscriptionLoading = false,
  subscriptionError,
  onRetrySubscription,
}: SettingsSheetProps) {
  // settings-overlay primitives — slider + mute bindings.
  const soundVolume = useSettingsStore((s) => s.soundVolume)
  const musicVolume = useSettingsStore((s) => s.musicVolume)
  const soundEnabled = useSettingsStore((s) => s.soundEnabled)
  const musicEnabled = useSettingsStore((s) => s.musicEnabled)
  const setVolume = useSettingsStore((s) => s.setVolume)
  const toggleSetting = useSettingsStore((s) => s.toggle)

  // Subscription primitives.
  const tier = useSubscriptionStore((s) => s.tier)
  const isActive = useSubscriptionStore((s) => s.isActive)

  // ── Local state ───────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerEntries, setPickerEntries] = useState<PickerEntry[]>([])
  const [purchasing, setPurchasing] = useState(false)

  // ── Analytics: screen_viewed on mount (idempotent) ────────────────────
  const screenViewedFiredRef = useRef(false)
  useEffect(() => {
    if (screenViewedFiredRef.current) return
    screenViewedFiredRef.current = true
    analyticsModule.track('screen_viewed', { screen: 'settings' })
  }, [])

  // ── Volume slider handler ─────────────────────────────────────────────
  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value) / 100
    // Drive both the sound and music dials in lockstep so the slider reads
    // as a "master volume" surface to the player (audio-master derives the
    // effective gain from min(soundVolume, musicVolume) × enable-flags).
    setVolume('sound', next)
    setVolume('music', next)
  }

  // ── Mute toggle handler ───────────────────────────────────────────────
  const isMuted = !soundEnabled || !musicEnabled
  const handleMuteToggle = (): void => {
    if (isMuted) {
      // Unmute: re-enable any flag that is currently false.
      if (!soundEnabled) toggleSetting('soundEnabled')
      if (!musicEnabled) toggleSetting('musicEnabled')
    } else {
      // Mute: flip both flags off.
      if (soundEnabled) toggleSetting('soundEnabled')
      if (musicEnabled) toggleSetting('musicEnabled')
    }
  }

  // ── Manage subscription handler ───────────────────────────────────────
  const handleManageSubscription = async (): Promise<void> => {
    if (isActive) {
      try {
        await RundotAPI.iap.openStore()
      } catch (err) {
        RundotAPI.error('SettingsSheet.openStore failed', { err: String(err) })
      }
      return
    }
    // Free user → reveal the tier picker. We fetch packages on first reveal
    // and cache them locally.
    setPickerOpen(true)
    if (pickerEntries.length === 0) {
      try {
        const subs = await RundotAPI.iap.getSubscriptions()
        const entries: PickerEntry[] = []
        // BeatBoard surfaces only CORE + PLUS (per prd.md § Subscription
        // Products). PRIME/ULTIMATE collapse server-side and are hidden here.
        for (const tierKey of ['CORE', 'PLUS'] as const) {
          const packages = subs[tierKey] ?? []
          for (const pkgEntry of packages) {
            entries.push({
              tier: tierKey,
              interval: pkgEntry.interval,
              label: `${tierKey} · ${pkgEntry.interval.toLowerCase()}`,
              price: formatPrice(pkgEntry),
            })
          }
        }
        setPickerEntries(entries)
      } catch (err) {
        RundotAPI.error('SettingsSheet.getSubscriptions failed', { err: String(err) })
      }
    }
  }

  // ── Buy a tier from the picker ────────────────────────────────────────
  const handleBuyTier = async (
    pickTier: SubscriptionTier,
    pickInterval: SubscriptionInterval,
  ): Promise<void> => {
    if (purchasing) return
    setPurchasing(true)
    try {
      const result = await useSubscriptionStore
        .getState()
        .purchaseSubscription(pickTier, pickInterval)
      if (result.success) {
        setPickerOpen(false)
      }
    } finally {
      setPurchasing(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  const sliderValue = toSliderValue(soundVolume, musicVolume)

  // When the screen is used as a tab (hideDismiss=true) the outer
  // Panel.Modal chrome stacks visually with the Settings.Section
  // chrome inside it — three concentric rounded-rectangle panels of
  // similar fill and border that read as "skins fighting each other".
  // Drop the modal shell in tab mode and let the sections own the
  // surface chrome on their own.
  const Shell: ElementType = hideDismiss ? 'div' : Panel.Modal
  const shellProps = hideDismiss
    ? {
        'data-testid': 'settings-sheet',
        style: { width: '100%' } as CSSProperties,
      }
    : {
        'data-testid': 'settings-sheet',
        'data-skin-role': 'panel.modal',
      }

  return (
    <Shell {...shellProps}>
      <Stack space="md">
        {/* Top affordances: drag handle (left) + close X (right).
            Suppressed when `hideDismiss` is set — the tab variant has
            no dismiss target, so neither affordance is meaningful. */}
        {hideDismiss ? null : (
          <Cluster justify="between" align="center">
            <button
              type="button"
              data-testid="settings-sheet-handle"
              aria-label="Dismiss"
              onClick={onClose}
              style={{
                width: 48,
                height: 6,
                borderRadius: 3,
                background: 'var(--ui-color-border)',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
            />
            <NavClose
              data-testid="settings-close"
              onClick={onClose}
              aria-label="Close settings"
            />
          </Cluster>
        )}

        {/* Title. */}
        <Label.Title data-testid="settings-title">Settings</Label.Title>

        {/* Audio section. */}
        <Settings.Section title="Audio" data-testid="settings-section-audio">
          <Settings.Row
            title="Volume"
            description="Master volume for pads and recording playback."
            controlPlacement="stacked"
            control={
              <Slider
                data-testid="settings-volume-slider"
                min={0}
                max={100}
                step={1}
                value={sliderValue}
                onChange={handleVolumeChange}
                aria-label="Volume"
                showValue
              />
            }
          />
          <Settings.Row
            title="Mute"
            description="Silence all audio without losing your slider position."
            control={
              <Switch
                data-testid="settings-mute-toggle"
                checked={isMuted}
                onChange={handleMuteToggle}
                aria-label="Mute audio"
              />
            }
          />
        </Settings.Section>

        {/* Subscription section. */}
        <Settings.Section title="Subscription" data-testid="settings-section-subscription">
          <Settings.Row
            title="Current tier"
            description="Active subscription benefits apply across BeatBoard."
            control={
              <Label.Value
                data-testid="settings-tier-label"
                data-state={
                  isSubscriptionLoading
                    ? 'loading'
                    : subscriptionError
                      ? 'error'
                      : 'ready'
                }
              >
                {isSubscriptionLoading
                  ? '…'
                  : subscriptionError
                    ? '—'
                    : tierLabel(tier)}
              </Label.Value>
            }
          />
          {subscriptionError && onRetrySubscription ? (
            <Cluster justify="end" align="center">
              <Button.Ghost
                data-testid="settings-tier-retry"
                onClick={onRetrySubscription}
              >
                Retry
              </Button.Ghost>
            </Cluster>
          ) : null}
          <Cluster justify="end" align="center">
            <Button.Secondary
              data-testid="settings-manage-subscription"
              onClick={() => {
                void handleManageSubscription()
              }}
              disabled={purchasing}
            >
              {isActive ? 'Manage subscription' : 'View plans'}
            </Button.Secondary>
          </Cluster>

          {/* Tier picker — visible only when free + after the user taps
              "View plans". Each row triggers `purchaseSubscription`. */}
          {pickerOpen && !isActive ? (
            <Stack space="xs" data-testid="settings-tier-picker">
              <Label.Section>Choose a plan</Label.Section>
              {pickerEntries.length === 0 ? (
                <Label.Section data-testid="settings-tier-picker-empty">
                  Loading plans…
                </Label.Section>
              ) : (
                pickerEntries.map((entry) => (
                  <Button.Secondary
                    key={`${entry.tier}-${entry.interval}`}
                    data-testid={`settings-buy-${entry.tier}-${entry.interval}`}
                    onClick={() => {
                      void handleBuyTier(entry.tier, entry.interval)
                    }}
                    disabled={purchasing}
                  >
                    {entry.label} · {entry.price}
                  </Button.Secondary>
                ))
              )}
            </Stack>
          ) : null}
        </Settings.Section>

        <Settings.Section title="About" data-testid="settings-section-about">
          <Stack space="xs">
            <Button.Ghost
              data-testid="settings-credits-link"
              onClick={() => useNavigationStore.getState().openModal('credits')}
            >
              Credits
            </Button.Ghost>
            <Label.Section
              data-testid="settings-version-line"
              data-skin-role="label.section"
            >
              {`v${pkg.version}`}
            </Label.Section>
          </Stack>
        </Settings.Section>
      </Stack>
    </Shell>
  )
}
