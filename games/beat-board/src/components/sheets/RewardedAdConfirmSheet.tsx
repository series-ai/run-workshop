/**
 * RewardedAdConfirmSheet — confirmation sheet shown when the player taps
 * "Try for 24h — Watch ad" on a not-yet-owned paid pack on KitDetail.
 *
 * Issue beat-board-14-rewarded-ad-flow owns this file.
 *
 * PRD references:
 *   - prd.md § Rewarded Ads — copy, daily cap, subscriber exemption
 *   - prd.md § Visual Style — bottom-anchored panel sheet, semantic Skin chrome
 *
 * Behaviour:
 *   - Title: "Try {packName} for 24 hours"
 *   - Body: "Watch a short ad to unlock 24 hours of access to this pack.
 *     Watch up to 3 ads per day."
 *   - Daily cap chip: `Badge.Counter` "Today: N/3 watched"
 *   - "Watch ad" → `rewardedPlacements.rewardedAdFlow.show({...})` →
 *     entitlements granted → toast → switch to Play tab → setActiveKit →
 *     dismiss. Disabled while the SDK is showing the ad.
 *   - "Cancel" → close immediately.
 *   - When `rewardedPlacements.rewardedAdFlow.isReady()` resolves false at
 *     mount, the sheet shows an inline "Ad not available right now — try
 *     again later" message and disables the Watch button.
 *   - On mount, fires `rewarded_ad_offered` analytics with the pack id.
 */

import { useEffect, useState } from 'react'
import { Badge, Button, Cluster, Label, Panel, Stack } from '@modules/ui/skin'
import {
  BONUS_COST_RUN_BITS,
  REWARDED_DAILY_LIMIT,
  REWARDED_PLACEMENT_ID,
  bonusMethod,
  rewardedPlacements,
  rewardIdForPack,
} from '../../systems/rewarded-placements'
import { useEntitlementsStore } from '../../stores/entitlementsStore'
import { useKitsStore } from '../../stores/kitsStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { useToastStore } from '../../modules/ui/toast-notifications/ToastNotifications'
import { analytics as analyticsModule } from '../../modules/data/analytics-service/AnalyticsService'

export interface RewardedAdConfirmSheetProps {
  packId: string
  packName: string
  onClose: () => void
}

export function RewardedAdConfirmSheet({ packId, packName, onClose }: RewardedAdConfirmSheetProps) {
  // Channel-static: 'ad' on ads-enabled channels, 'run_bits' on no-ads
  // channels (e.g. Steam) where the bonus is paid with 1 Runbuck instead.
  const method = bonusMethod()
  const isRunBits = method === 'run_bits'

  // Subscribe to entitlements + module-store-driven daily count via local state.
  const dailyCount = useDailyCount()

  // On the Runbucks path there is no ad to probe — treat as always "ready".
  const [adReady, setAdReady] = useState<boolean | null>(isRunBits ? true : null)
  const [busy, setBusy] = useState(false)

  // Fire the offered analytic on mount and, on the ad path only, probe SDK
  // ad readiness. The Runbucks path has no readiness gate.
  useEffect(() => {
    analyticsModule.track('rewarded_ad_offered', {
      placement: REWARDED_PLACEMENT_ID,
      pack_id: packId,
      method,
    })
    if (isRunBits) return
    let cancelled = false
    void rewardedPlacements.rewardedAdFlow.isReady().then((ready) => {
      if (!cancelled) setAdReady(ready)
    })
    return () => {
      cancelled = true
    }
  }, [packId, method, isRunBits])

  const handleWatch = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await rewardedPlacements.rewardedAdFlow.show({
        placementId: REWARDED_PLACEMENT_ID,
        rewardId: rewardIdForPack(packId),
        packId,
        packName,
      })
      if (!result.watched) {
        // Reward not delivered (ad dismissed, or Runbucks spend declined /
        // cancelled). The system already emitted the dismissal analytic.
        // Keep the sheet open so the player can retry.
        return
      }
      // Reward delivered: switch tabs, set active kit, toast, dismiss.
      useKitsStore.getState().setActiveKit(packId)
      useNavigationStore.getState().setActiveTab('play')
      useToastStore.getState().show({
        message: `${packName} unlocked for 24h`,
        severity: 'success',
        durationMs: 4000,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    if (busy) return
    onClose()
  }

  const capExhausted = !isRunBits && dailyCount >= REWARDED_DAILY_LIMIT
  const watchDisabled = busy || adReady === false || capExhausted

  // Player-facing copy. The Runbucks path must never reference ads.
  const bodyCopy = isRunBits
    ? `Spend ${BONUS_COST_RUN_BITS} Runbuck to unlock 24 hours of access to this pack.`
    : 'Watch a short ad to unlock 24 hours of access to this pack. Watch up to 3 ads per day.'
  const ctaIdleLabel = isRunBits ? `Spend ${BONUS_COST_RUN_BITS} Runbuck` : 'Watch ad'
  const ctaBusyLabel = isRunBits ? 'Unlocking…' : 'Showing ad…'

  return (
    <Panel.Modal
      data-testid="rewarded-ad-confirm-sheet"
      data-skin-role="panel.modal"
      data-bonus-method={method}
      title={`Try ${packName} for 24 hours`}
    >
      <Stack space="md">
        <Label.Section>{bodyCopy}</Label.Section>

        {/* Daily-cap chip is ad-specific (max 3 watches/day) — hidden on the
            Runbucks path, which has no cap. */}
        {!isRunBits ? (
          <Cluster space="sm" align="center">
            <Badge.Counter
              data-testid="rewarded-sheet-cap-chip"
              data-skin-role="badge.counter"
            >
              Today: {dailyCount}/{REWARDED_DAILY_LIMIT} watched
            </Badge.Counter>
          </Cluster>
        ) : null}

        {!isRunBits && adReady === false ? (
          <Label.Section data-testid="rewarded-sheet-error">
            Ad not available right now — try again later
          </Label.Section>
        ) : null}

        <Cluster space="sm" align="end" justify="end">
          <Button.Ghost
            data-testid="rewarded-sheet-cancel"
            onClick={handleCancel}
            disabled={busy}
          >
            Cancel
          </Button.Ghost>
          <Button.Primary
            data-testid="rewarded-sheet-watch"
            tone="yellow"
            onClick={() => {
              void handleWatch()
            }}
            disabled={watchDisabled}
            aria-busy={busy}
          >
            {busy ? ctaBusyLabel : ctaIdleLabel}
          </Button.Primary>
        </Cluster>
      </Stack>
    </Panel.Modal>
  )
}

/**
 * Subscribe to changes in the rewarded daily count. The module store the
 * counter lives in is internal to `rewarded-placements`, so we subscribe to
 * the entitlements store as a proxy for grant events (the counter only
 * advances after a successful grant), and re-read the count from the
 * canonical accessor on every render.
 */
function useDailyCount(): number {
  // Re-evaluate when entitlements change so the chip updates after a grant.
  useEntitlementsStore((s) => s.entitlements)
  return rewardedPlacements.rewardedAdFlow.dailyCount()
}
