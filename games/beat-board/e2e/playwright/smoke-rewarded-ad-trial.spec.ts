/**
 * @smoke @remote-safe Rewarded ad → 24h pack trial smoke spec.
 *
 * Issue beat-board-32-smoke-rewarded-ad-trial owns this file. Runs after
 * `smoke-core-loop.spec.ts` (which proves the UI-first FTUE path) so this
 * spec is authorised to use the `seedState('beatboard.ftue.complete')`
 * bypass key per CLAUDE.md § Pipeline Integrity #5.
 *
 * Verifies the rewarded-ad → trial path end-to-end:
 *   - Packs surfaces a Themed Pack (the kit catalog v1 ships
 *     `midnight-synthwave` as the themed-tier rotation slot;
 *     `pack_themed_neon_nights` is the prd.md product id).
 *   - Tapping the themed KitCard pushes KitDetail with the
 *     "Try for 24h — Watch ad" secondary CTA visible (canShow gate
 *     passes: ad-ready, no subscription, not owned, daily-cap not reached).
 *   - The rewarded affordance hides when:
 *       (a) the player owns / is trialling the pack,
 *       (b) the daily cap (3) is reached,
 *       (c) the player is a CORE+ subscriber (subscriber exemption).
 *   - After `simulateReward(packId)` the trial entitlement
 *     `pack_trial_<packId>` lands with TTL > 23h and KitDetail re-renders
 *     with the "Trial — Nh Mm left" + "Buy permanently" CTA cluster.
 *
 * Acceptance map (per the issue body):
 *   1. Packs displays a Themed Pack KitCard.
 *   2. Tapping the Themed Pack pushes KitDetail; the rewarded button
 *      ("Try for 24h — Watch ad") is visible when the readiness gate
 *      passes.
 *   3. The cap chip shows "Today: 0/3 watched" when no rewards have been
 *      delivered today (verified through the companion vitest suite +
 *      direct entitlement/dailyCount probes here).
 *   4. simulateReward(packId) grants the trial entitlement and bumps the
 *      daily counter — production parity with a real Watch ad → reward.
 *   5. After grant, KitDetail re-renders without the rewarded button and
 *      with the trial + buy-permanently CTAs.
 *   6. After 3 simulated watches in one day the rewarded affordance hides.
 *   7. Subscriber exemption: with `subscription.simulateTier('CORE')` the
 *      rewarded affordance is hidden on KitDetail.
 *   8. Analytics events (`rewarded_ad_offered`, `rewarded_ad_watched`,
 *      `entitlement_granted`) are exercised through the production code
 *      path; the analytics ordering proof lives in the companion vitest
 *      suite which mocks the analytics service directly.
 *
 * Notes on debug-API usage:
 *   - The issue authorises six debug endpoints
 *     (`beatboard.ftue.complete`, `beatboard.rewardedAd.simulateReady`,
 *     `beatboard.rewardedAd.simulateReward`, `beatboard.rewardedAd.dailyCount`,
 *     `beatboard.subscription.simulateTier`, `beatboard.entitlements.list`).
 *     They are used here as setup + introspection helpers only — every state
 *     assertion that has a UI surface goes through visible UI per CLAUDE.md
 *     § E2E Testing.
 *   - The companion vitest suite at
 *     `src/__tests__/accept-beat-board-32-smoke-rewarded-ad-trial.test.ts`
 *     covers the analytics ordering, toast copy, and confirm-sheet daily-cap
 *     chip that are not observable from a real browser without an analytics
 *     mock + a mounted modal host.
 *   - The KitDetail → RewardedAdConfirmSheet route opens a
 *     `rewardedAdConfirm` entry on `navigationStore.modalStack`. The modal
 *     host integration is owned by a later wiring issue, so the smoke spec
 *     drives the same `rewardedPlacements.rewardedAdFlow.simulateReward(...)`
 *     codepath the sheet would call. This still drives the full production
 *     entitlement-grant + cap-counter path through the real systems.
 */
import { test, expect } from './fixtures'

const THEMED_PACK_ID = 'midnight-synthwave'
const THEMED_PACK_NAME = 'Midnight Synthwave'

interface DebugEntitlement {
  itemId: string
  quantity: number
  expiresAt: number | null
}

test.describe('@smoke @remote-safe Rewarded ad → 24h pack trial', () => {
  test.beforeEach(async ({ gamePage }) => {
    await gamePage.goto('/')
    // Wipe any leftover state from a previous run before each test so the
    // daily-cap counter, entitlement map, subscription tier, and
    // rewarded-ready flag all evaluate cleanly.
    await gamePage.resetAllState()
    await gamePage.page.evaluate((kitId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__GAME_DEBUG__?.beatboard?.kits.setOwnership(kitId, 'paid', 299)
    }, THEMED_PACK_ID)
    gamePage.seedState('beatboard.ftue.complete')
  })

  test('Themed Pack → KitDetail → rewarded affordance grants 24h trial entitlement', async ({
    gamePage,
  }) => {
    const page = gamePage.page

    // ── 1. App ready, FTUE bypassed via the authorised seed key ──────────
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
    await expect(page.locator('[data-testid="pad-grid-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.locator('[data-testid="ftue-tooltip"]')).not.toBeVisible()

    // ── 2. Force the rewarded-ready flag on so the affordance gate passes
    //       in headless without depending on the SDK readiness probe. ─────
    gamePage.seedState('beatboard.rewardedAd.simulateReady', true)
    await gamePage.wait(100)

    // Pre-condition sanity: dailyCount is 0 and no trial entitlement yet.
    const initialDailyCount = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__GAME_DEBUG__?.beatboard?.rewardedAd.dailyCount() ?? -1,
    )
    expect(initialDailyCount).toBe(0)

    const initialEntitlements = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => ((window as any).__GAME_DEBUG__?.beatboard?.entitlements.list() ?? []) as DebugEntitlement[],
    )
    expect(
      initialEntitlements.find((e) => e.itemId === `pack_trial_${THEMED_PACK_ID}`),
    ).toBeUndefined()

    // ── 3. Navigate to Packs through the bottom tab bar ──────────────────
    const packsTab = page.locator('[data-tab-id="packs"]').first()
    await expect(packsTab).toBeEnabled({ timeout: 5_000 })
    await packsTab.click()

    // Packs section landed; the Themed Pack KitCard is visible.
    await expect(page.locator('[data-testid="pack-drawer-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    const themedKitCard = page
      .locator(`[data-testid="kit-card-${THEMED_PACK_ID}"]`)
      .first()
    await expect(themedKitCard).toBeVisible({ timeout: 5_000 })

    // ── 4. Tap the Themed KitCard → KitDetail mounts ─────────────────────
    await themedKitCard.click()
    await expect(page.locator('[data-testid="kit-detail-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page.locator(`[data-testid="kit-detail-stage"][data-pack-id="${THEMED_PACK_ID}"]`),
    ).toBeVisible()

    // ── 5. The rewarded "Try for 24h — Watch ad" secondary CTA is visible ─
    const rewardedCta = page.locator('[data-testid="kit-detail-cta-rewarded"]')
    await expect(rewardedCta).toBeVisible({ timeout: 5_000 })
    await expect(rewardedCta).toContainText(/Try for 24h/i)

    // The buy CTA is the primary CTA on the not-owned state.
    await expect(page.locator('[data-testid="kit-detail-cta-buy"]')).toBeVisible()

    // ── 6. Drive the reward through the production rewarded-ad-flow via
    //       the debug surface. The KitDetail rewarded-CTA tap pushes the
    //       `rewardedAdConfirm` modal onto navigationStore.modalStack — the
    //       RewardedAdConfirmSheet host integration is owned by a later
    //       wiring issue, so the smoke spec exercises the same
    //       rewardedPlacements.rewardedAdFlow.simulateReward(...) the sheet
    //       would call. This drives the full production path: counter
    //       increment + entitlement grant + analytics fan-out (the
    //       companion vitest suite spies on the analytics module directly). ─
    await page.evaluate((packId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beat = (window as any).__GAME_DEBUG__?.beatboard
      beat?.rewardedAd.simulateReward(packId)
    }, THEMED_PACK_ID)

    // ── 7. Daily counter incremented to 1 ────────────────────────────────
    const afterDailyCount = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__GAME_DEBUG__?.beatboard?.rewardedAd.dailyCount() ?? -1,
    )
    expect(afterDailyCount).toBe(1)

    // ── 8. The pack_trial_<packId> entitlement landed with a 24h TTL ─────
    const afterEntitlements = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => ((window as any).__GAME_DEBUG__?.beatboard?.entitlements.list() ?? []) as DebugEntitlement[],
    )
    const trial = afterEntitlements.find(
      (e) => e.itemId === `pack_trial_${THEMED_PACK_ID}`,
    )
    expect(trial).toBeTruthy()
    expect(trial?.expiresAt).toBeTruthy()
    if (trial?.expiresAt) {
      const remainingMs = trial.expiresAt - Date.now()
      // 24h TTL minus a generous test wall-clock budget.
      expect(remainingMs).toBeGreaterThan(23 * 60 * 60 * 1000)
      expect(remainingMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
    }

    // ── 9. KitDetail re-renders with the trial CTA cluster ────────────────
    // The screen subscribes to entitlements changes so the trial-state CTA
    // cluster ("Trial — Nh Mm left" + "Buy permanently — N Runbucks") swaps
    // in. The rewarded button hides because canShow now reports false
    // (already trialling).
    const trialCta = page.locator('[data-testid="kit-detail-cta-trial"]')
    await expect(trialCta).toBeVisible({ timeout: 5_000 })
    await expect(trialCta).toContainText(/Trial\s*—\s*\d+h\s+\d+m\s+left/i)
    await expect(page.locator('[data-testid="kit-detail-cta-buy-permanent"]')).toBeVisible()
    await expect(page.locator('[data-testid="kit-detail-cta-rewarded"]')).not.toBeVisible()

    // ── 10. No console errors during the rewarded-ad → trial flow ─────────
    expect(gamePage.getConsoleErrors()).toEqual([])
  })

  test('Daily cap of 3: rewarded affordance hides after 3 simulated watches', async ({
    gamePage,
  }) => {
    const page = gamePage.page

    // ── 1. Force ready, then burn the daily cap via three simulated rewards
    //       on cap-burn pack ids so the THEMED pack is still neither owned
    //       nor trialled but the cap is exhausted. ───────────────────────
    await page.evaluate(() => {
      const rewardedAd = (window as any).__GAME_DEBUG__?.beatboard?.rewardedAd
      rewardedAd?.simulateReady(true)
      rewardedAd?.simulateReward('cap-burn-1')
      rewardedAd?.simulateReward('cap-burn-2')
      rewardedAd?.simulateReward('cap-burn-3')
    })

    const dailyCount = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__GAME_DEBUG__?.beatboard?.rewardedAd.dailyCount() ?? -1,
    )
    expect(dailyCount).toBe(3)

    // ── 2. Navigate to Packs → Themed Pack → KitDetail ────────────────────
    await page.locator('[data-tab-id="packs"]').first().click()
    await expect(page.locator('[data-testid="pack-drawer-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    await page.locator(`[data-testid="kit-card-${THEMED_PACK_ID}"]`).first().click()
    await expect(page.locator('[data-testid="kit-detail-stage"]')).toBeVisible({
      timeout: 5_000,
    })

    // ── 3. The rewarded affordance is hidden because cap is exhausted ────
    await expect(page.locator('[data-testid="kit-detail-cta-rewarded"]')).not.toBeVisible()
    // The buy CTA still renders — daily cap doesn't gate the IAP path.
    await expect(page.locator('[data-testid="kit-detail-cta-buy"]')).toBeVisible()

    // ── 4. No console errors during the cap-reached flow ──────────────────
    expect(gamePage.getConsoleErrors()).toEqual([])
  })

  test('Subscriber exemption: CORE tier hides the rewarded affordance entirely', async ({
    gamePage,
  }) => {
    const page = gamePage.page

    // ── 1. Force ready + activate CORE tier via the debug surface ────────
    gamePage.seedState('beatboard.rewardedAd.simulateReady', true)
    gamePage.seedState('beatboard.subscription.simulateTier', 'CORE')
    await gamePage.wait(100)

    // ── 2. Navigate to Packs → Themed Pack → KitDetail ────────────────────
    await page.locator('[data-tab-id="packs"]').first().click()
    await expect(page.locator('[data-testid="pack-drawer-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    await page.locator(`[data-testid="kit-card-${THEMED_PACK_ID}"]`).first().click()
    await expect(page.locator('[data-testid="kit-detail-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    // Smoke-out the pack name on KitDetail to confirm we're on the right pack.
    await expect(page.locator('[data-testid="kit-detail-title"]')).toContainText(
      THEMED_PACK_NAME,
    )

    // ── 3. The rewarded affordance is hidden for the CORE subscriber ──────
    await expect(page.locator('[data-testid="kit-detail-cta-rewarded"]')).not.toBeVisible()

    // ── 4. No console errors during the subscriber-exemption flow ─────────
    expect(gamePage.getConsoleErrors()).toEqual([])
  })
})
