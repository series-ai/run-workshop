/**
 * FtueOverlayShell — Module-owned FTUE overlay with safety guarantees.
 *
 * This component handles ALL safety-critical FTUE behavior:
 * - Skip button (always visible, calls skipAll)
 * - Backdrop with spotlight cutout — covers the FULL viewport including
 *   the nav-zone (tab bar), portaled toasts, and any `position: fixed`
 *   product chrome. Uses `position: fixed; inset: 0` and a z-index above
 *   the toast stack so the "focus on this one element" promise holds.
 *   The spotlight cutout still aligns with the in-screen target because
 *   we measure the target and the overlay container in the same
 *   coordinate frame (both getBoundingClientRect) and subtract —
 *   robust against landscape sidebars, safe-area insets, and scrolled
 *   screen shells.
 * - Click-blocking with soft-lock escape (skip prompt after timeout)
 * - Correct Zustand selector patterns (no method calls in selectors)
 * - Contextual dismiss (X button) for dismissible steps
 *
 * Games render this and optionally customize the tooltip. They CANNOT
 * accidentally remove the skip button or break the escape hatch.
 *
 * Usage:
 *   <FtueOverlayShell useStore={useFtueStore} />
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FtueStepConfig } from './types'

// ─── Store contract ──────────────────────────────────────────────────────────
// The game passes its own Zustand hook. We read only primitive fields from
// selectors (never call methods inside selectors — causes infinite re-render).

/**
 * Minimal store contract. The shell avoids Zustand selectors for derived state
 * (which causes infinite re-renders if the method returns a new object). Instead
 * it subscribes to a single trigger key and reads everything else via getState().
 *
 * Required on the store:
 *   Fields:  currentStepId (string|number|null) — changes when step advances (trigger)
 *   Actions: skipAll(), completeCurrentStep()
 *   Methods: isOverlayActive?() | isActive?, getCurrentStepConfig?(), getSpotlightTarget?(),
 *            getGuideMessage?(), dismissContextual?()
 */
type FtueStoreState = Record<string, unknown> & {
  currentStepId?: string | number | null
  currentStep?: string | number | null
  isActive?: boolean
  isInitialized?: boolean
  initialized?: boolean
  currentPhase?: string
  status?: string
  isStepHidden?: boolean
  skipAll?: () => void
  skip?: () => void
  completeCurrentStep: () => void
  getCurrentStepConfig?: () => FtueStepConfig | null
  getSpotlightTarget?: () => string | null
  getGuideMessage?: () => string
  dismissContextual?: () => void
  isOverlayActive?: () => boolean
}

type FtueCompatStepConfig = FtueStepConfig & {
  completionType?: string
  dismissable?: boolean
}

type UseFtueStoreHook = {
  <T>(selector: (state: FtueStoreState) => T): T
  getState: () => FtueStoreState
}

// ─── Spotlight rect hook ─────────────────────────────────────────────────────

interface SpotlightRect {
  centerX: number
  centerY: number
  width: number
  height: number
}

/**
 * Measure the spotlight target's rect in the overlay container's own
 * coordinate frame. Subtracting `containerRect` from `targetRect` keeps
 * the spotlight cutout aligned regardless of where the overlay container
 * sits (`position: fixed` at viewport origin, `position: absolute` inside
 * a landscape game-zone offset by a sidebar rail, etc). The module ships
 * with `position: fixed`; the subtraction just costs nothing and makes
 * the rect math robust to future layout changes.
 */
function useSpotlightRect(
  selector: string | null,
  containerRef: React.RefObject<HTMLDivElement | null>,
): SpotlightRect | null {
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }

    function measure() {
      const el = document.querySelector(selector!)
      const container = containerRef.current
      if (el && container) {
        const targetRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setRect({
          centerX: targetRect.left + targetRect.width / 2 - containerRect.left,
          centerY: targetRect.top + targetRect.height / 2 - containerRect.top,
          width: targetRect.width,
          height: targetRect.height,
        })
      } else {
        setRect(null)
      }
      rafRef.current = requestAnimationFrame(measure)
    }
    measure()

    return () => cancelAnimationFrame(rafRef.current)
  }, [selector, containerRef])

  return rect
}

/**
 * Watch for stacked modals mounted above the FTUE. When a modal panel is
 * present we drop the backdrop's `pointer-events` to `none` so clicks
 * reach the modal — without this, a rare "modal during FTUE" interaction
 * (e.g., login intercept that can't be suppressed) soft-locks the app.
 */
function useHasStackedModal(): boolean {
  const [hasModal, setHasModal] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return
    }

    const check = () => {
      // Detect stacked modal panels via skin-role tags plus the convention
      // that any project-specific modal-backdrop class is named
      // `*-modal-backdrop` (the attribute-contains selector matches
      // `forge-modal-backdrop`, `x-modal-backdrop`, etc. without any
      // hardcoded per-project list).
      const found = document.querySelector(
        [
          '[data-skin-role="panel.modal"]',
          '[data-ui-modal-stack-host] [data-skin-role="modal.panel"]',
          '[class*="modal-backdrop"]',
        ].join(','),
      )
      setHasModal(Boolean(found))
    }

    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return hasModal
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface FtueOverlayShellProps {
  /** The game's Zustand FTUE store hook */
  useStore: UseFtueStoreHook
  /** Optional custom tooltip renderer. Receives step info, returns ReactNode.
   *  If not provided, renders a default callout. */
  renderTooltip?: (info: {
    step: FtueStepConfig
    message: string
    onDismiss: (() => void) | null
  }) => ReactNode
  /** Backdrop opacity (default: 0.7) */
  backdropOpacity?: number
  /** Skip button label (default: "Skip Tutorial") */
  skipLabel?: string
}

// ─── Soft-lock escape timeout ────────────────────────────────────────────────
const SOFT_LOCK_TIMEOUT_MS = 5000

export function clickInteractiveDescendant(target: HTMLElement): void {
  const tag = target.tagName.toLowerCase()
  const isIntrinsicInteractive = tag === 'button' || (tag === 'a' && target.hasAttribute('href'))
  const hasInteractiveRole =
    target.getAttribute('role') === 'button' || target.getAttribute('role') === 'link'
  const hasInlineClickHandler =
    target.hasAttribute('onclick') ||
    typeof (target as HTMLElement & { onclick?: unknown }).onclick === 'function'

  if (isIntrinsicInteractive || hasInteractiveRole || hasInlineClickHandler) {
    target.click()
    return
  }

  const interactiveDescendant = target.querySelector<HTMLElement>([
    'button',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[data-skin-role*="button"]',
  ].join(','))
  if (interactiveDescendant) {
    interactiveDescendant.click()
    return
  }

  target.click()
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FtueOverlayShell({
  useStore,
  renderTooltip,
  backdropOpacity = 0.7,
  skipLabel = 'Skip Tutorial',
}: FtueOverlayShellProps) {
  // ── Single selector trigger: currentStepId changes when step advances ──
  // We subscribe to ONE primitive field to trigger re-renders. Everything else
  // is read via getState() in the component body — no method calls in selectors.
  const currentStepId = useStore((s: Record<string, unknown>) =>
    s['currentStepId'] ?? s['currentStep'] ?? null,
  )

  // ── Read all state via getState() — safe, no selector re-render issues ──
  const state = useStore.getState()
  const isActive: boolean = typeof state.isOverlayActive === 'function'
    ? state.isOverlayActive()
    : Boolean(state.isActive)
  const isInitialized: boolean = Boolean(state.isInitialized ?? state.initialized)
  const currentPhase: string = String(state.currentPhase ?? state.status ?? '')
  const isStepHidden: boolean = Boolean(state.isStepHidden)
  const doSkip: (() => void) | undefined = state.skipAll ?? state.skip
  const completeCurrentStep: () => void = state.completeCurrentStep
  const stepConfig: FtueStepConfig | null = state.getCurrentStepConfig?.() ?? null
  const spotlightSelector: string | null = state.getSpotlightTarget?.() ?? null
  const guideMessage: string = state.getGuideMessage?.() ?? ''
  const dismissContextual: (() => void) | undefined = state.dismissContextual

  const overlayContainerRef = useRef<HTMLDivElement | null>(null)

  const spotlightRect = useSpotlightRect(
    isActive && !isStepHidden ? spotlightSelector : null,
    overlayContainerRef,
  )

  const hasStackedModal = useHasStackedModal()

  // ── Soft-lock escape: if spotlight target not found for N seconds ──
  const [softLockVisible, setSoftLockVisible] = useState(false)
  const softLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isActive || isStepHidden || !spotlightSelector) {
      setSoftLockVisible(false)
      if (softLockTimerRef.current) clearTimeout(softLockTimerRef.current)
      return
    }

    // Start timer — if spotlight rect doesn't appear, show escape
    setSoftLockVisible(false)
    softLockTimerRef.current = setTimeout(() => {
      const el = document.querySelector(spotlightSelector)
      if (!el) setSoftLockVisible(true)
    }, SOFT_LOCK_TIMEOUT_MS)

    return () => {
      if (softLockTimerRef.current) clearTimeout(softLockTimerRef.current)
    }
  }, [isActive, isStepHidden, spotlightSelector, currentStepId])

  // Reset soft-lock when spotlight appears
  useEffect(() => {
    if (spotlightRect) setSoftLockVisible(false)
  }, [spotlightRect])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }, [])

  const handleSpotlightClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (spotlightSelector) {
        const target = document.querySelector(spotlightSelector)
        if (target instanceof HTMLElement) {
          clickInteractiveDescendant(target)
        }
      }
      // Handle both module (completion.type) and game-specific (completionType) field names
      const compatStepConfig = stepConfig as FtueCompatStepConfig | null
      const compType = compatStepConfig?.completion?.type ?? compatStepConfig?.completionType
      if (compType === 'tap_target') {
        completeCurrentStep()
      }
    },
    [spotlightSelector, stepConfig, completeCurrentStep],
  )

  const handleSkip = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      doSkip?.()
    },
    [doSkip],
  )

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      dismissContextual?.()
    },
    [dismissContextual],
  )

  // ── Don't render if not active ──
  if (!isInitialized || !isActive || isStepHidden) return null
  if (currentPhase === 'completed' || currentPhase === 'skipped') return null
  if (!stepConfig) return null

  // Handle both 'dismissible' (module) and 'dismissable' (game-specific) spellings
  const compatStepConfig = stepConfig as FtueCompatStepConfig
  const isDismissible = compatStepConfig.dismissible ?? compatStepConfig.dismissable
  const radius = spotlightRect
    ? Math.max(spotlightRect.width, spotlightRect.height) / 2 + 12
    : 0
  const allowPointerThrough = Boolean(stepConfig.completion.params?.allowPointerThrough)

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties = spotlightRect
    ? {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        ...(spotlightRect.centerY + radius + 200 > window.innerHeight
          ? { bottom: `${window.innerHeight - spotlightRect.centerY + radius + 16}px` }
          : { top: `${spotlightRect.centerY + radius + 16}px` }),
        maxWidth: '320px',
        width: '90%',
        zIndex: 210,
      }
    : {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '320px',
        width: '90%',
        zIndex: 210,
      }

  return (
    <div
      ref={overlayContainerRef}
      onClick={handleBackdropClick}
      style={{
        // Fixed + inset 0 so the backdrop covers the FULL viewport — the
        // nav-zone (tab bar), portaled toasts, landscape sidebars, and
        // anything else that sat outside the screen's game-zone under the
        // old `position: absolute` scoping. z-index 700 sits above the
        // toast stack (500) and just below the modal overlay (800); when
        // a modal is present (rare — `modalSuppressor` usually prevents
        // it) we drop `pointer-events` so clicks reach the modal.
        position: 'fixed',
        inset: 0,
        zIndex: 700,
        pointerEvents: hasStackedModal || allowPointerThrough ? 'none' : 'auto',
      }}
      data-testid="ftue-overlay"
      data-ftue-pointer-events={hasStackedModal || allowPointerThrough ? 'none' : 'auto'}
    >
      {/* Dark backdrop with spotlight cutout */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="ftue-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <circle
                cx={spotlightRect.centerX}
                cy={spotlightRect.centerY}
                r={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`rgba(0,0,0,${backdropOpacity})`}
          mask="url(#ftue-spotlight-mask)"
        />
      </svg>

      {/* Clickable spotlight area */}
      {spotlightRect && (
        <div
          onClick={handleSpotlightClick}
          className="absolute rounded-full"
          style={{
            top: spotlightRect.centerY - radius,
            left: spotlightRect.centerX - radius,
            width: radius * 2,
            height: radius * 2,
            // When the parent overlay drops pointer-events to none
            // (allowPointerThrough or stacked-modal), the spotlight-area
            // must follow suit. Leaving this 'auto' makes the spotlight
            // intercept clicks intended for the underlying pad even
            // though the rest of the overlay passes them through.
            pointerEvents:
              hasStackedModal || allowPointerThrough ? 'none' : 'auto',
            cursor:
              hasStackedModal || allowPointerThrough ? 'default' : 'pointer',
            zIndex: 205,
          }}
          data-testid="ftue-spotlight-area"
        />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        {renderTooltip ? (
          renderTooltip({
            step: stepConfig,
            message: guideMessage,
            onDismiss: isDismissible ? () => dismissContextual?.() : null,
          })
        ) : (
          <div
            style={{
              background: 'var(--ui-panel-card-fill, rgba(30,30,40,0.95))',
              borderRadius: 'var(--ui-panel-card-radius, 12px)',
              padding: '16px',
              color: 'var(--ui-text-primary, white)',
            }}
          >
            <div style={{ fontSize: '14px', lineHeight: 1.5 }}>{guideMessage}</div>
          </div>
        )}

        {/* Dismiss button for contextual steps */}
        {isDismissible && (
          <button
            onClick={handleDismiss}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--ui-panel-card-fill, rgba(30,30,40,0.95))',
              border: 'none',
              color: 'var(--ui-text-primary, white)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              zIndex: 211,
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── SKIP BUTTON (always visible, cannot be removed) ── */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          padding: '8px 16px',
          borderRadius: 'var(--ui-button-radius, 8px)',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          color: 'var(--ui-text-primary, white)',
          fontSize: 13,
          cursor: 'pointer',
          zIndex: 215,
          pointerEvents: 'auto',
          minHeight: 44,
          minWidth: 44,
        }}
        data-testid="ftue-skip-button"
        aria-label={skipLabel}
      >
        {skipLabel}
      </button>

      {/* ── SOFT-LOCK ESCAPE (shown when spotlight target not found) ── */}
      {softLockVisible && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 220,
          }}
        >
          <div
            style={{
              background: 'var(--ui-panel-card-fill, rgba(30,30,40,0.95))',
              borderRadius: 12,
              padding: '24px',
              color: 'var(--ui-text-primary, white)',
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 12, opacity: 0.8 }}>
              Tutorial step unavailable
            </div>
            <button
              onClick={handleSkip}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: 'var(--ui-accent-fill, #3b82f6)',
                border: 'none',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              {skipLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
