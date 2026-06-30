/**
 * DailyLoginBanner — subscriber-only inline banner rendered atop Play the
 * first time the player opens the app each day.
 *
 * Issue beat-board-13-subscription-and-daily-login owns this file.
 *
 * PRD references:
 *   - prd.md § Mechanics Detail § Daily login reward — visibility + claim flow
 *   - prd.md § Subscription Products — tier-specific reward amounts
 *   - prd.md § Visual Style § Component Translation Table — banner is a
 *     `Panel.Section` row above the pad grid
 *
 * Renderer / interaction:
 *   - Reads `subscriptionStore.tier`. When `'free'`, the banner returns
 *     `null` so the entire DOM subtree is removed (per the acceptance
 *     criterion "removes it from the DOM entirely").
 *   - On mount, calls `daily-login-banner.isVisible()` to check the
 *     once-per-day storage flag. Renders nothing while the read is in
 *     flight to avoid a flash of "+50 today".
 *   - Tap Claim → `daily-login-banner.claim()` → wallet refreshes →
 *     banner fades out (`isVisible` flips to false).
 *
 * Uses the platform-resolved `RunbucksPriceChip` for the amount (not a
 * hardcoded "Rb" suffix), per the project rule: prefer installed module
 * hooks over duplicated literals.
 *
 * data-skin-role coverage: panel.section + button.primary.
 */

import { useEffect, useState } from 'react'
import { Button, Label, Panel, Stack } from '@modules/ui/skin'
import { RunbucksPriceChip } from '../widgets/RunbucksPriceChip'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import {
  DAILY_LOGIN_REWARD_AMOUNTS,
  getDailyLoginBanner,
} from '../../systems/daily-login-banner'

export function DailyLoginBanner() {
  const tier = useSubscriptionStore((s) => s.tier)
  // null: visibility unknown (read in flight); false: hidden; true: render.
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    if (tier === 'free') {
      // Skip the storage round-trip — non-subscribers never see the banner.
      setVisible(false)
      return () => {
        cancelled = true
      }
    }
    setVisible(null)
    void getDailyLoginBanner()
      .isVisible()
      .then((v) => {
        if (!cancelled) setVisible(v)
      })
    return () => {
      cancelled = true
    }
  }, [tier])

  if (tier === 'free') return null
  if (!visible) return null

  const amount = DAILY_LOGIN_REWARD_AMOUNTS[tier]

  const handleClaim = async () => {
    const result = await getDailyLoginBanner().claim()
    if (result.amount > 0) {
      // Hide immediately — the storage flag is now persisted, so a
      // subsequent isVisible() read would also return false.
      setVisible(false)
    }
  }

  return (
    <Panel.Section
      data-testid="daily-login-banner"
      data-skin-role="panel.section"
    >
      <Stack space="xs">
        <Label.Section data-testid="daily-login-banner-eyebrow">Daily drop</Label.Section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            data-testid="daily-login-banner-amount"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 14 }}>+</span>
            <RunbucksPriceChip amount={amount} variant="default" />
            <span style={{ fontSize: 14, color: 'var(--ui-text-muted)' }}>today</span>
          </div>
          <Button.Primary
            aria-label={`Claim ${amount} Runbucks daily drop`}
            data-testid="daily-login-banner-claim"
            tone="yellow"
            onClick={() => {
              void handleClaim()
            }}
          >
            Claim
          </Button.Primary>
        </div>
      </Stack>
    </Panel.Section>
  )
}
