/**
 * @smoke @remote-safe FTUE skip-path smoke spec.
 *
 * Issue beat-board-30-smoke-ftue-skip owns this file. Runs after
 * `smoke-core-loop.spec.ts` proves the UI-first FTUE path so this spec is
 * authorised to use the `seedState('beatboard.ftue.complete')` bypass key
 * per CLAUDE.md § Pipeline Integrity #5 — the Skip-equivalent terminal
 * state has already been validated end-to-end through the UI.
 *
 * Acceptance map (per the issue body):
 *   1. App launches → Play with FTUE step 1 active.
 *   2. Shell "Skip" button is visible; tap dismisses every FTUE overlay.
 *   3. Post-Skip the tab bar becomes interactive (gate.tabBar.disabled =
 *      false) and Record button becomes enabled (gate.recordButton.disabled =
 *      false) within 500ms — asserted through the visible
 *      `disabled` / `aria-disabled` attributes the UI exposes.
 *   4. When Skip is reverted via `beatboard.ftue.reset()` the next reload
 *      restores step 1.
 *   5. `seedState('beatboard.ftue.complete')` (called against a freshly
 *      reset state) replicates the post-Skip state — Play mounts with no
 *      FTUE overlay and tab bar interactive.
 *   6. Analytics `ftue_completed` fires with `{ skipped: true }` after the
 *      Skip path — covered by the vitest companion at
 *      `src/__tests__/accept-beat-board-30-smoke-ftue-skip.test.ts`. The
 *      Playwright lane proves the UI-side Skip dispatch, not the analytics
 *      payload (analytics calls go through the mocked SDK and are not
 *      observable from a real browser without an analytics mock).
 */
import { test, expect } from './fixtures'

const SKIP_GATE_DEADLINE_MS = 500

test.describe('@smoke @remote-safe FTUE skip path', () => {
  test('Skip on step 1 dismisses every FTUE overlay and unlocks the gates', async ({
    gamePage,
  }) => {
    const page = gamePage.page

    // ── 1. App launches with FTUE step 1 active on Play ───────────────────
    await gamePage.goto('/')
    gamePage.seedState('beatboard.ftue.reset')
    await gamePage.reload()

    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
    await expect(page.locator('[data-testid="pad-grid-stage"]')).toBeVisible({
      timeout: 5_000,
    })

    // FTUE step 1 tooltip is on screen, anchored to pad-cell-0.
    const tooltip = page.locator('[data-testid="ftue-tooltip"]')
    await expect(tooltip).toBeVisible({ timeout: 5_000 })
    await expect(tooltip).toHaveAttribute('data-ftue-step', 'tap_first_pad')

    // The shell-owned Skip button is visible exactly when FTUE is active.
    const skipButton = page.locator('[data-testid="ftue-skip-button"]')
    await expect(skipButton).toBeVisible()

    // Tab bar is gated disabled while step 1 is up — at least one tab button
    // exposes `disabled` so taps are ignored.
    const firstTab = page.locator('[data-tab-id]').first()
    await expect(firstTab).toBeDisabled({ timeout: 2_000 })

    // Record button is gated disabled too.
    const recordBtn = page.locator('[data-testid="pad-top-bar-record"]').first()
    await expect(recordBtn).toBeDisabled()

    // ── 2. Tap Skip → every FTUE overlay dismisses ────────────────────────
    await skipButton.click()

    // Tooltip + always-visible shell skip button both unmount.
    await expect(tooltip).not.toBeVisible({ timeout: 2_000 })
    await expect(skipButton).not.toBeVisible()

    // ── 3. Gates flip to interactive within 500ms of the Skip tap ─────────
    await expect(firstTab).toBeEnabled({ timeout: SKIP_GATE_DEADLINE_MS })
    await expect(recordBtn).toBeEnabled({ timeout: SKIP_GATE_DEADLINE_MS })

    // Record button no longer reports the disabled visual either.
    await expect(recordBtn).toHaveAttribute('data-record-state', 'idle')

    // ── 4. After ftue.reset() → reload restores step 1 (Skip reverted) ────
    gamePage.seedState('beatboard.ftue.reset')
    await gamePage.reload()
    await expect(page.locator('[data-testid="pad-grid-stage"]')).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.locator('[data-testid="ftue-tooltip"]')).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.locator('[data-testid="ftue-tooltip"]')).toHaveAttribute(
      'data-ftue-step',
      'tap_first_pad',
    )
    await expect(page.locator('[data-testid="ftue-skip-button"]')).toBeVisible()
  })

  test('seedState beatboard.ftue.complete reaches the post-Skip state with no overlay', async ({
    gamePage,
  }) => {
    const page = gamePage.page

    // Start clean — wipe any leftover persisted FTUE state from a previous
    // Playwright run before the spec drives the bypass key.
    await gamePage.goto('/')
    gamePage.seedState('beatboard.ftue.reset')
    await gamePage.reload()

    // FTUE step 1 should be active before the bypass.
    await expect(page.locator('[data-testid="ftue-tooltip"]')).toBeVisible({
      timeout: 5_000,
    })

    // Drive the authorised bypass key (smoke-core-loop already proved this
    // terminal state through the UI).
    gamePage.seedState('beatboard.ftue.complete')

    // Overlay dismisses + gates flip interactive.
    await expect(page.locator('[data-testid="ftue-tooltip"]')).not.toBeVisible({
      timeout: 2_000,
    })
    await expect(page.locator('[data-testid="ftue-skip-button"]')).not.toBeVisible()
    await expect(page.locator('[data-tab-id]').first()).toBeEnabled({
      timeout: SKIP_GATE_DEADLINE_MS,
    })
    await expect(
      page.locator('[data-testid="pad-top-bar-record"]').first(),
    ).toBeEnabled({ timeout: SKIP_GATE_DEADLINE_MS })
  })
})
