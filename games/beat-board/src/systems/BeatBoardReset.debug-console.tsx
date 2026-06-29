/**
 * BeatBoardReset.debug-console — surfaces the beat-board reset actions
 * inside the in-app DebugConsole (three-finger long-tap to open).
 *
 * The previous reset story was "open the dev tools and run
 * `window.__GAME_DEBUG__.beatboard.ftue.reset()`" — fine on desktop
 * with devtools, useless on mobile where you'd need remote inspect.
 * This panel exposes the same actions as plain buttons.
 *
 * Each row is intentionally surgical (only the namespace it names),
 * with a "Reset everything" button at the bottom that walks every
 * namespace's `.reset()` and reloads the page so the engines pick up
 * the cleared state.
 */
import { Button, Settings } from '@modules/ui/skin/semantic'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { DebugConsoleModuleFactoryExport } from '../debug-console/types'

interface BeatBoardDebug {
  ftue?: { reset: () => Promise<void> | void; complete: () => Promise<void> }
  mixes?: { reset: () => void }
  entitlements?: { reset?: () => void }
  rewardedAd?: { reset: () => void }
  recording?: { reset: () => void }
  reset?: () => void
}

function getBeat(): BeatBoardDebug | undefined {
  const w = window as unknown as {
    __GAME_DEBUG__?: { beatboard?: BeatBoardDebug }
  }
  return w.__GAME_DEBUG__?.beatboard
}

async function reloadAfter<T>(action: () => Promise<T> | T): Promise<void> {
  try {
    await Promise.resolve(action())
  } catch (err) {
    RundotAPI.error('[BeatBoardReset] action threw', { err: String(err) })
  }
  // Engines read persistence at boot, so a reload is the cleanest way
  // to materialise a reset across every subscriber.
  if (typeof window !== 'undefined') window.location.reload()
}

function BeatBoardResetSection() {
  const beat = getBeat()
  if (!beat) {
    return (
      <Settings.Section title="BeatBoard Reset">
        <Settings.Row
          title="Status"
          control={<span>__GAME_DEBUG__.beatboard not installed yet</span>}
        />
      </Settings.Section>
    )
  }

  return (
    <Settings.Section title="BeatBoard Reset">
      <Settings.Row
        title="Reset FTUE"
        control={
          <Button.Ghost
            data-testid="dbg-reset-ftue"
            onClick={() => void reloadAfter(() => beat.ftue?.reset())}
          >
            Reset FTUE + reload
          </Button.Ghost>
        }
      />
      <Settings.Row
        title="Skip FTUE"
        control={
          <Button.Ghost
            data-testid="dbg-skip-ftue"
            onClick={() => void reloadAfter(() => beat.ftue?.complete())}
          >
            Mark FTUE done + reload
          </Button.Ghost>
        }
      />
      <Settings.Row
        title="Wipe saved mixes"
        control={
          <Button.Ghost
            data-testid="dbg-reset-mixes"
            onClick={() => void reloadAfter(() => beat.mixes?.reset())}
          >
            Reset Mixes + reload
          </Button.Ghost>
        }
      />
      <Settings.Row
        title="Reset everything"
        control={
          <Button.Secondary
            data-testid="dbg-reset-all"
            onClick={() => void reloadAfter(() => beat.reset?.())}
          >
            Reset all state + reload
          </Button.Secondary>
        }
      />
    </Settings.Section>
  )
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] =
  () => ({
    id: 'beatboard-reset',
    title: 'BeatBoard Reset',
    // Order 0 puts this above Navigation/Performance/etc — when state
    // gets stuck, this is what you reach for first, so it should be
    // the first thing you see when the console opens.
    order: 0,
    render: () => <BeatBoardResetSection />,
  })
