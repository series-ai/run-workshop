/**
 * @smoke @remote-safe Audio-output regression spec.
 *
 * Catches the "tap a pad but no sound plays" bug class before the
 * player has to. Every previous instance of this bug has shipped to
 * the player because we relied on listening with our own ears.
 *
 * Approach:
 *   1. Load the app, dismiss FTUE via the seed-state debug bypass key
 *      (so we land on the Play screen with the hero pack ready).
 *   2. Click a pad cell (this is the user gesture that should resume
 *      the AudioContext).
 *   3. Poll `__GAME_DEBUG__.beatboard.audio.diagnose()` for ~3 seconds
 *      and assert that:
 *        - `master.contextState === 'running'` (the gesture unlocked
 *          the audio context)
 *        - `master.rmsEnergy > 0.001` at some point (audio is reaching
 *          the master output)
 *
 * If either check fails the audio chain is broken — the engine
 * scheduled the source but no signal reaches the destination, or the
 * audio context never resumed. Both are silent-tap regressions.
 *
 * Notes:
 *   - The 0.001 RMS threshold is well below the lofi pack's audible
 *     range (typically 0.05–0.20 once a loop kicks in) and well above
 *     numerical noise floor. Anything between is "not yet audible but
 *     not zero" — we keep polling until either the threshold trips or
 *     the budget runs out.
 *   - `evaluate()` calls `diagnose()` which reads the live AnalyserNode
 *     RMS — same surface the in-app debug HUD uses, so a passing test
 *     correlates with what the player would actually hear.
 *   - This test runs against the standalone built artifact / dev
 *     server. The CMUX embedded browser can't run it because audio in
 *     an iframe is governed by the host's autoplay-permission policy,
 *     not by our code.
 */

import { test, expect } from './fixtures'

const RMS_THRESHOLD = 0.001
const POLL_INTERVAL_MS = 100
const POLL_DEADLINE_MS = 3_000

interface AudioDiagnose {
  master: {
    contextState: string | null
    computedMasterGain: number
    rmsEnergy: number | null
    peakEnergy: number | null
    masterGainValue: number | null
    currentTime: number | null
  }
  padState: {
    activePadIds: string[]
  }
  padGraph: {
    contextState: string | null
    registeredPads: number
  }
}

test.describe('@smoke @remote-safe Audio output', () => {
  test('first pad tap drives audible RMS at the master output', async ({ gamePage }) => {
    const page = gamePage.page

    // Skip the FTUE so we land directly on a tappable pad grid.
    // (`ftue.complete` is the documented bypass key per CLAUDE.md
    // § Pipeline Integrity, and the core-loop smoke proves the FTUE
    // works through real UI.)
    gamePage.seedState('beatboard.ftue.complete')
    await gamePage.goto('/')

    await expect(page.locator('[data-testid="pad-grid-stage"]')).toBeVisible({
      timeout: 5_000,
    })

    // Sanity: the audio master should be initialised once a pad cell
    // is on screen. It may still be `suspended` until the click below.
    const beforeClick = await page.evaluate<AudioDiagnose | null>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__GAME_DEBUG__?.beatboard?.audio?.diagnose() ?? null,
    )
    expect(beforeClick).not.toBeNull()
    expect(beforeClick!.padGraph.registeredPads).toBeGreaterThan(0)

    // Tap a real pad cell. `pad-A-block-0-0` is the hero kit's drums-1
    // — the canonical first-tap target the FTUE-skip path lands on.
    const firstPad = page.locator('[data-testid="pad-A-block-0-0"]')
    await expect(firstPad).toBeVisible()
    await firstPad.click()

    // Poll master RMS until it crosses threshold OR the deadline
    // expires. The first audible bar can take up to COLD_START_HEAD_S
    // (120 ms) to schedule, plus the AudioContext's own resume
    // latency, so 3 s is generous but bounded.
    const start = Date.now()
    let lastDiag: AudioDiagnose | null = null
    let observedRms = 0
    while (Date.now() - start < POLL_DEADLINE_MS) {
      lastDiag = await page.evaluate<AudioDiagnose | null>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (window as any).__GAME_DEBUG__?.beatboard?.audio?.diagnose() ?? null,
      )
      if (lastDiag?.master.rmsEnergy != null && lastDiag.master.rmsEnergy > observedRms) {
        observedRms = lastDiag.master.rmsEnergy
      }
      if (
        lastDiag?.master.contextState === 'running' &&
        observedRms > RMS_THRESHOLD
      ) {
        break
      }
      await page.waitForTimeout(POLL_INTERVAL_MS)
    }

    // Failure surfaces the diagnose payload so the next debugger gets
    // the same view our manual checks use.
    const diagPayload = lastDiag ? JSON.stringify(lastDiag, null, 2) : '<null>'
    expect(
      lastDiag?.master.contextState,
      `AudioContext never resumed after pad tap. Diagnose: ${diagPayload}`,
    ).toBe('running')
    expect(
      observedRms,
      `Master RMS never crossed ${RMS_THRESHOLD} after pad tap (peak observed: ${observedRms.toFixed(6)}). The engine scheduled a source but no signal reached the destination. Diagnose: ${diagPayload}`,
    ).toBeGreaterThan(RMS_THRESHOLD)

    // The pad we tapped should have ended up active in the store.
    expect(lastDiag!.padState.activePadIds).toContain('A-block-0-0')
  })
})
