/**
 * @smoke @remote-safe Mixes persistence + replay-fires proof.
 *
 * Sessions-only architecture: a saved mix is a JSON timeline of pad
 * actions, not an mp4 blob. This spec proves the full lifecycle:
 *
 *   1. Activate pads + record + capture pad-action events into the
 *      session via the debug API (same path as the real UI).
 *   2. Save → mix lands in `MixLibrary`.
 *   3. Reload the page → the mix is still there.
 *   4. Open the Mixes tab → mix tile is visible → tap → review modal
 *      reopens in replay mode.
 *   5. Press Play → replay drives padGridStore mutations within a
 *      generous deadline. THIS IS THE PROOF that the play-button bug
 *      stays fixed.
 *
 * `seedState('beatboard.ftue.complete')` is permitted here per CLAUDE.md
 * because smoke-core-loop.spec.ts already proved FTUE works UI-first.
 *
 * Why we exercise the recording path through the debug API rather than
 * pad clicks: the debug functions call the same `padGridStore.tapLoop`
 * that the UI calls, so the recorder observer captures them identically.
 * Headless browsers throttle the AudioContext warm-up, but the engine's
 * store mutations fire regardless of whether audio actually emits — and
 * store mutations are what we assert against.
 */

import { test, expect } from './fixtures'

const REPLAY_FIRE_DEADLINE_MS = 6_000

test.describe('@smoke @remote-safe Mixes persistence + replay', () => {
  test('save → reload → tile visible → Play drives the engine', async ({
    gamePage,
  }) => {
    const page = gamePage.page

    await gamePage.goto('/')
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()

    await gamePage.seedState('beatboard.ftue.complete')

    // Wipe any persisted mixes from previous runs. `mixes.reset()` fires
    // async deletes; we wait for the in-memory list to drain before
    // saving so the new mix is the only one in the library.
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beat = (window as any).__GAME_DEBUG__?.beatboard
      const ids: string[] = beat?.mixes.list().map((m: { id: string }) => m.id) ?? []
      // The mixes namespace's `delete` is not exposed on the debug API by
      // design; we drive deletion through the library directly via the
      // window-bound store. Falls back to mixes.reset() for the side-effect.
      beat?.mixes.reset()
      // Poll until the in-memory list drains.
      const start = Date.now()
      while (Date.now() - start < 5_000) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remaining = (window as any).__GAME_DEBUG__?.beatboard?.mixes.list() ?? []
        if (remaining.length === 0) return
        await new Promise((r) => setTimeout(r, 50))
      }
      throw new Error(`mixes did not drain (started with ${ids.length})`)
    })

    await expect(page.locator('[data-testid="pad-grid-stage"]')).toBeVisible({
      timeout: 5_000,
    })

    // Block-0 + block-1 hold loops in every kit (drums + bass). These
    // ids are part of the kit-id contract, so hard-coding them here
    // mirrors how production callers depend on them.
    const padIds = ['A-block-0-0', 'A-block-1-0'] as const
    const [firstPad, secondPad] = padIds

    // ── 1. Start recording, then capture two pad-tap events through the
    //       debug API. Each tapLoop call routes through the recorder
    //       observer (same path as a UI tap).
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beat = (window as any).__GAME_DEBUG__?.beatboard
      await beat?.recording.start()
    })
    await page.waitForTimeout(150)
    await page.evaluate((id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beat = (window as any).__GAME_DEBUG__?.beatboard
      beat?.padGrid.tapLoop(id)
    }, firstPad)
    await page.waitForTimeout(200)
    await page.evaluate((id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beat = (window as any).__GAME_DEBUG__?.beatboard
      beat?.padGrid.tapLoop(id)
    }, secondPad)
    await page.waitForTimeout(200)

    // Stop the recording. The modal opens with the pendingSession ready.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beat = (window as any).__GAME_DEBUG__?.beatboard
      beat?.recording.stop()
    })

    const modal = page.locator('[data-testid="recording-review-modal"]')
    await expect(modal).toBeVisible({ timeout: 10_000 })

    // ── 2. Save persists the mix.
    await page.locator('[data-testid="recording-review-save"]').click()
    await expect(page.locator('[data-testid="recording-review-play"]')).toBeVisible({
      timeout: 5_000,
    })

    const beforeReload = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__GAME_DEBUG__?.beatboard?.mixes.list() ?? [],
    )
    expect(beforeReload.length).toBe(1)
    const savedId = beforeReload[0].id as string

    // Close the modal so the reload starts from a clean Play screen.
    await page.locator('[data-testid="recording-review-close"]').click()
    await expect(modal).not.toBeVisible({ timeout: 5_000 })

    // ── 3. Reload → mix survives (appStorage round-trip).
    await page.reload()
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()

    await expect
      .poll(
        async () =>
          page.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => (window as any).__GAME_DEBUG__?.beatboard?.mixes.list() ?? [],
          ),
        { timeout: 10_000 },
      )
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: savedId })]))

    // ── 4. Open Mixes tab → tap the tile → review modal reopens in
    //       replay mode.
    await gamePage.openScreen('mixes')
    const tile = page.locator(`[data-testid="mix-tile-${savedId}"]`)
    await expect(tile).toBeVisible({ timeout: 5_000 })
    await tile.click()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // After mount the modal hard-cuts any live pads (replay must start
    // from a clean engine — see RecordingReviewScreen mount effect).
    await expect
      .poll(
        async () =>
          page.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () =>
              (window as any).__GAME_DEBUG__?.beatboard?.padGrid
                .snapshot()
                .activePadIds.length ?? 0,
          ),
        { timeout: 3_000 },
      )
      .toBe(0)

    // ── 5. Press Play → replay schedules engine.tapLoop events on its
    //       internal timeline. Within REPLAY_FIRE_DEADLINE_MS we expect
    //       at least one of the originally-recorded pads to land back
    //       in `activePadIds`. THIS is the proof the Play button works.
    const playButton = page.locator('[data-testid="recording-review-play"]')
    await expect(playButton).toBeEnabled()
    await playButton.click()

    await expect
      .poll(
        async () =>
          page.evaluate(
            (pads: readonly string[]) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const beat = (window as any).__GAME_DEBUG__?.beatboard
              const active: string[] = beat?.padGrid.snapshot().activePadIds ?? []
              return pads.some((p) => active.includes(p))
            },
            padIds as readonly string[],
          ),
        {
          timeout: REPLAY_FIRE_DEADLINE_MS,
          message:
            'Replay never re-activated any of the recorded pads. Play button is broken.',
        },
      )
      .toBe(true)

    // No application-side console errors during the round-trip. The
    // fixture's auto-assertion at teardown enforces this; an explicit
    // assertion here would duplicate that check.
  })
})
