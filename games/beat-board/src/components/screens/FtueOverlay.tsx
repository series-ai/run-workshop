/**
 * FtueOverlay — full-screen FTUE overlay rendered above Play.
 *
 * Issue beat-board-25-ftue-engine owns this file. The overlay binds the
 * project-side `useFtueStore` (from `ftue-adapter.ts`) into the module's
 * `FtueOverlayShell`, which provides:
 *   - Spotlight cutout aligned with `[data-ftue="…"]`
 *   - Always-visible Skip button
 *   - Soft-lock escape if the spotlight target never appears
 *   - Outside-spotlight tap = no-op (stays on the current step)
 *
 * BeatBoard-specific:
 *   - Custom tooltip uses `Panel.Card` semantic chrome with prompt copy;
 *     step 1 includes a "Skip" `Text.Hint` link bottom-center.
 *   - On mount, ensures `useFtueStore.initialize()` has been called and
 *     calls `startFtue('play')` for new players when `currentScreen` is
 *     'play'. Idempotent — `startFtue` is a no-op once FTUE is started.
 *   - Per prd.md § Component Translation Table § FtueOverlay, spotlight
 *     interpolates 240ms when target changes; tooltip animates in 180ms.
 *     The shell renders the spotlight; the tooltip animation lives here.
 *
 * data-skin-role coverage: ftue.tooltip (tooltip card), button.primary
 * ("Got it") and ftue.callout for skip hint.
 */
import { useEffect, useRef } from 'react'
import { Panel, NavClose } from '@modules/ui/skin'
import { FtueOverlayShell } from '../../modules/onboarding/ftue-engine/FtueOverlayShell'
import {
  useFtueStore,
  setMixSavedToastListener,
} from '../../systems/ftue-adapter'
import { useToastStore } from '../../modules/ui/toast-notifications/ToastNotifications'

const TOAST_MESSAGE = 'Nice — your first mix is saved.'

/**
 * Top-level FTUE overlay. Mounts once at App level. The shell renders only
 * when `isOverlayActive()` is true, so this component's tree is otherwise
 * inert.
 */
export function FtueOverlay() {
  const isInitialized = useFtueStore((s) => s.isInitialized)
  const initialize = useFtueStore((s) => s.initialize)

  // Hook the toast listener exactly once. The adapter fires the listener
  // when capture finishes after step 3.
  useEffect(() => {
    setMixSavedToastListener(() => {
      useToastStore.getState().show({
        message: TOAST_MESSAGE,
        severity: 'success',
        durationMs: 3500,
      })
    })
    return () => {
      setMixSavedToastListener(null)
    }
  }, [])

  // Initialise on mount.
  useEffect(() => {
    if (!isInitialized) {
      void initialize()
    }
  }, [isInitialized, initialize])

  return (
    <FtueOverlayShell
      useStore={useFtueStore as unknown as Parameters<typeof FtueOverlayShell>[0]['useStore']}
      backdropOpacity={0.7}
      skipLabel="Skip"
      renderTooltip={({ step, message, onDismiss }) => (
        <FtueTooltip step={step.id} message={message} onDismiss={onDismiss} />
      )}
    />
  )
}

/** Step ids that show the bottom-center "Skip" hint link. */

/**
 * Project-flavored tooltip — semantic Panel.Card with prompt copy and an
 * X dismiss affordance for dismissible (contextual) steps. Animation
 * (`fade-in over 180ms`) is rendered via inline keyframes.
 */
function FtueTooltip({
  step,
  message,
  onDismiss,
}: {
  step: string
  message: string
  onDismiss: (() => void) | null
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  return (
    <div
      ref={ref}
      data-testid="ftue-tooltip"
      data-skin-role="ftue.tooltip"
      data-ftue-step={step}
      style={{
        animation: 'ftue-tooltip-fade-in 180ms ease-out forwards',
      }}
    >
      <Panel.Card data-skin-role="panel.card">
        <div
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            minWidth: 200,
          }}
        >
          {onDismiss ? (
            <div style={{ position: 'absolute', top: 6, right: 6 }}>
              <NavClose
                aria-label="Dismiss tip"
                data-testid="ftue-tooltip-dismiss"
                onClick={onDismiss}
              />
            </div>
          ) : null}
          <span
            data-testid="ftue-tooltip-message"
            style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ui-text-primary)' }}
          >
            {message}
          </span>
          {/* The previous step-1 inline "Skip" link (a div role="button"
              with stopPropagation + skipAll) didn't fire reliably on
              mobile and confused players who saw it next to the always-
              visible Skip button at the bottom-right of the FtueOverlay-
              Shell. Single skip affordance — the shell's button — is
              less ambiguous. */}
        </div>
      </Panel.Card>
    </div>
  )
}
