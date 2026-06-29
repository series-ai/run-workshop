/** Configuration for spotlight targeting */
export interface SpotlightTarget {
  /** CSS selector to highlight */
  selector: string
  /** Padding around the target in px */
  padding?: number
}

/** Computed rectangle for the spotlight cutout */
export interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * CSS class name added to targeted elements to elevate them above the overlay.
 */
export const SPOTLIGHT_TARGET_CLASS = 'ftue-spotlight-target'

/**
 * Check whether a spotlight target exists in the DOM.
 * Use this before rendering the overlay — if the target doesn't exist,
 * the step should be deferred (call hideCurrentStep()) rather than
 * showing a dark backdrop with no way to advance.
 */
export function isSpotlightReady(selector: string | null | undefined): boolean {
  if (!selector) return true // Steps with no spotlight (centered tooltip) are always ready
  return document.querySelectorAll(selector).length > 0
}

/**
 * Compute bounding box for all elements matching a selector.
 * Returns null if no elements found.
 */
export function computeSpotlightRect(
  selector: string,
  padding: number = 4,
): SpotlightRect | null {
  const elements = document.querySelectorAll(selector)
  if (elements.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.right)
    maxY = Math.max(maxY, rect.bottom)
  })

  return {
    top: minY - padding,
    left: minX - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

/**
 * Generate a CSS clip-path polygon string that creates a rectangular cutout.
 * The polygon covers the full viewport with a hole at the given rect.
 */
export function generateClipPath(rect: SpotlightRect): string {
  const { top, left, width, height } = rect
  const right = left + width
  const bottom = top + height

  return `polygon(evenodd, 0% 0%, 0% 100%, ${left}px 100%, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px 100%, 100% 100%, 100% 0%)`
}

/**
 * Add the spotlight target class to all elements matching a selector.
 */
export function addSpotlightClass(selector: string): void {
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.add(SPOTLIGHT_TARGET_CLASS)
  })
}

/**
 * Remove the spotlight target class from all elements matching a selector.
 */
export function removeSpotlightClass(selector: string): void {
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.remove(SPOTLIGHT_TARGET_CLASS)
  })
}

/**
 * Dev-mode check: warns if the overlay container has pointer-events: auto,
 * which blocks all user interaction and soft-locks the app.
 *
 * Call this from useEffect in the overlay component:
 *   useEffect(() => validateOverlayPointerEvents(overlayRef.current), [step])
 */
export function validateOverlayPointerEvents(overlayElement: HTMLElement | null): void {
  if (!overlayElement) return
  if (typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'production') return
  const style = getComputedStyle(overlayElement)
  if (style.pointerEvents === 'auto' || style.pointerEvents === '') {
    // eslint-disable-next-line no-console
    console.warn(
      `[FTUE] Overlay container has pointer-events: "${style.pointerEvents}". ` +
      `This blocks ALL clicks and soft-locks the app. ` +
      `Set pointer-events: none on the overlay backdrop and pointer-events: auto ` +
      `only on interactive children (tooltip, skip button).`
    )
  }
}

export interface TooltipStyle {
  position: 'fixed'
  top?: number
  bottom?: number
  left: number
  width: number
}

/**
 * Compute viewport-safe tooltip positioning relative to a spotlight target.
 * Auto-flips when the tooltip would overflow the viewport edge.
 * Falls back to viewport-center when neither side has enough space.
 *
 * @param targetRect - The spotlight target's bounding rect
 * @param preferred - Preferred placement ('top' or 'bottom')
 * @param tooltipHeight - Estimated tooltip height in px (default 160)
 * @param tooltipWidth - Tooltip width in px (default 280)
 * @param margin - Gap between target and tooltip in px (default 12)
 */
export function computeTooltipStyle(
  targetRect: SpotlightRect,
  preferred: 'top' | 'bottom' = 'bottom',
  tooltipHeight: number = 160,
  tooltipWidth: number = 280,
  margin: number = 12,
): TooltipStyle {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280

  const spaceAbove = targetRect.top - margin
  const spaceBelow = vh - (targetRect.top + targetRect.height) - margin

  const fitsAbove = spaceAbove >= tooltipHeight
  const fitsBelow = spaceBelow >= tooltipHeight

  let placement: 'top' | 'bottom' | 'center'
  if (preferred === 'top' && fitsAbove) {
    placement = 'top'
  } else if (preferred === 'bottom' && fitsBelow) {
    placement = 'bottom'
  } else if (fitsBelow) {
    placement = 'bottom'
  } else if (fitsAbove) {
    placement = 'top'
  } else {
    placement = 'center'
  }

  const rawLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
  const left = Math.max(margin, Math.min(rawLeft, vw - tooltipWidth - margin))

  if (placement === 'top') {
    return { position: 'fixed', bottom: vh - targetRect.top + margin, left, width: tooltipWidth }
  }
  if (placement === 'bottom') {
    return { position: 'fixed', top: targetRect.top + targetRect.height + margin, left, width: tooltipWidth }
  }
  // center fallback — neither side has space
  return { position: 'fixed', top: Math.max(margin, (vh - tooltipHeight) / 2), left, width: tooltipWidth }
}
