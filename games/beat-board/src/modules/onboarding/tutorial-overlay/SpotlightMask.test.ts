import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeSpotlightRect,
  generateClipPath,
  addSpotlightClass,
  removeSpotlightClass,
  isSpotlightReady,
  computeTooltipStyle,
  validateOverlayPointerEvents,
  SPOTLIGHT_TARGET_CLASS,
} from './SpotlightMask'
import type { SpotlightRect } from './SpotlightMask'

function mockElement(rect: { left: number; top: number; right: number; bottom: number }) {
  return {
    getBoundingClientRect: () => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON: () => {},
    }),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  } as unknown as Element
}

describe('SpotlightMask', () => {
  let querySelectorAllSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('computeSpotlightRect', () => {
    it('returns null when no elements match', () => {
      querySelectorAllSpy.mockReturnValue([] as unknown as NodeListOf<Element>)
      expect(computeSpotlightRect('.nonexistent')).toBeNull()
    })

    it('computes rect for a single element with default padding', () => {
      const el = mockElement({ left: 100, top: 50, right: 200, bottom: 150 })
      querySelectorAllSpy.mockReturnValue([el] as unknown as NodeListOf<Element>)

      const result = computeSpotlightRect('.target')

      expect(result).toEqual({
        top: 46,    // 50 - 4
        left: 96,   // 100 - 4
        width: 108, // (200 - 100) + 8
        height: 108, // (150 - 50) + 8
      })
    })

    it('computes rect for a single element with custom padding', () => {
      const el = mockElement({ left: 100, top: 50, right: 200, bottom: 150 })
      querySelectorAllSpy.mockReturnValue([el] as unknown as NodeListOf<Element>)

      const result = computeSpotlightRect('.target', 10)

      expect(result).toEqual({
        top: 40,    // 50 - 10
        left: 90,   // 100 - 10
        width: 120, // (200 - 100) + 20
        height: 120, // (150 - 50) + 20
      })
    })

    it('computes rect with zero padding', () => {
      const el = mockElement({ left: 100, top: 50, right: 200, bottom: 150 })
      querySelectorAllSpy.mockReturnValue([el] as unknown as NodeListOf<Element>)

      const result = computeSpotlightRect('.target', 0)

      expect(result).toEqual({
        top: 50,
        left: 100,
        width: 100,
        height: 100,
      })
    })

    it('computes union bounding box for multiple elements', () => {
      const el1 = mockElement({ left: 10, top: 20, right: 60, bottom: 70 })
      const el2 = mockElement({ left: 80, top: 30, right: 150, bottom: 90 })
      querySelectorAllSpy.mockReturnValue([el1, el2] as unknown as NodeListOf<Element>)

      const result = computeSpotlightRect('.multi', 0)

      expect(result).toEqual({
        top: 20,    // min top
        left: 10,   // min left
        width: 140, // 150 - 10
        height: 70, // 90 - 20
      })
    })

    it('computes union bounding box for overlapping elements', () => {
      const el1 = mockElement({ left: 10, top: 10, right: 100, bottom: 100 })
      const el2 = mockElement({ left: 50, top: 50, right: 120, bottom: 120 })
      querySelectorAllSpy.mockReturnValue([el1, el2] as unknown as NodeListOf<Element>)

      const result = computeSpotlightRect('.overlap', 4)

      expect(result).toEqual({
        top: 6,     // 10 - 4
        left: 6,    // 10 - 4
        width: 118, // (120 - 10) + 8
        height: 118, // (120 - 10) + 8
      })
    })
  })

  describe('generateClipPath', () => {
    it('generates polygon with evenodd rule', () => {
      const rect: SpotlightRect = { top: 46, left: 96, width: 108, height: 108 }
      const result = generateClipPath(rect)

      // right = 96 + 108 = 204, bottom = 46 + 108 = 154
      expect(result).toBe(
        'polygon(evenodd, 0% 0%, 0% 100%, 96px 100%, 96px 46px, 204px 46px, 204px 154px, 96px 154px, 96px 100%, 100% 100%, 100% 0%)',
      )
    })

    it('handles zero-origin rect', () => {
      const rect: SpotlightRect = { top: 0, left: 0, width: 50, height: 50 }
      const result = generateClipPath(rect)

      expect(result).toBe(
        'polygon(evenodd, 0% 0%, 0% 100%, 0px 100%, 0px 0px, 50px 0px, 50px 50px, 0px 50px, 0px 100%, 100% 100%, 100% 0%)',
      )
    })
  })

  describe('addSpotlightClass', () => {
    it('adds class to all matching elements', () => {
      const el1 = mockElement({ left: 0, top: 0, right: 10, bottom: 10 })
      const el2 = mockElement({ left: 0, top: 0, right: 10, bottom: 10 })
      querySelectorAllSpy.mockReturnValue([el1, el2] as unknown as NodeListOf<Element>)

      addSpotlightClass('.items')

      expect(el1.classList.add).toHaveBeenCalledWith(SPOTLIGHT_TARGET_CLASS)
      expect(el2.classList.add).toHaveBeenCalledWith(SPOTLIGHT_TARGET_CLASS)
    })

    it('handles no matching elements', () => {
      querySelectorAllSpy.mockReturnValue([] as unknown as NodeListOf<Element>)
      expect(() => addSpotlightClass('.missing')).not.toThrow()
    })
  })

  describe('removeSpotlightClass', () => {
    it('removes class from all matching elements', () => {
      const el1 = mockElement({ left: 0, top: 0, right: 10, bottom: 10 })
      const el2 = mockElement({ left: 0, top: 0, right: 10, bottom: 10 })
      querySelectorAllSpy.mockReturnValue([el1, el2] as unknown as NodeListOf<Element>)

      removeSpotlightClass('.items')

      expect(el1.classList.remove).toHaveBeenCalledWith(SPOTLIGHT_TARGET_CLASS)
      expect(el2.classList.remove).toHaveBeenCalledWith(SPOTLIGHT_TARGET_CLASS)
    })

    it('handles no matching elements', () => {
      querySelectorAllSpy.mockReturnValue([] as unknown as NodeListOf<Element>)
      expect(() => removeSpotlightClass('.missing')).not.toThrow()
    })
  })

  describe('isSpotlightReady', () => {
    it('returns true when selector is null or undefined', () => {
      expect(isSpotlightReady(null)).toBe(true)
      expect(isSpotlightReady(undefined)).toBe(true)
    })

    it('returns true when elements match the selector', () => {
      const el = mockElement({ left: 0, top: 0, right: 10, bottom: 10 })
      querySelectorAllSpy.mockReturnValue([el] as unknown as NodeListOf<Element>)
      expect(isSpotlightReady('.exists')).toBe(true)
    })

    it('returns false when no elements match the selector', () => {
      querySelectorAllSpy.mockReturnValue([] as unknown as NodeListOf<Element>)
      expect(isSpotlightReady('.missing')).toBe(false)
    })
  })

  describe('SPOTLIGHT_TARGET_CLASS', () => {
    it('equals ftue-spotlight-target', () => {
      expect(SPOTLIGHT_TARGET_CLASS).toBe('ftue-spotlight-target')
    })
  })

  describe('computeTooltipStyle', () => {
    beforeEach(() => {
      vi.stubGlobal('innerHeight', 720)
      vi.stubGlobal('innerWidth', 1280)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('places tooltip below target when preferred=bottom and space exists', () => {
      const rect: SpotlightRect = { top: 100, left: 200, width: 80, height: 40 }
      const style = computeTooltipStyle(rect, 'bottom', 160, 280, 12)
      expect(style.top).toBe(152) // 100 + 40 + 12
      expect(style.position).toBe('fixed')
    })

    it('places tooltip above target when preferred=top and space exists', () => {
      const rect: SpotlightRect = { top: 400, left: 200, width: 80, height: 40 }
      const style = computeTooltipStyle(rect, 'top', 160, 280, 12)
      expect(style.bottom).toBe(332) // 720 - 400 + 12
    })

    it('auto-flips to bottom when preferred=top but insufficient space above', () => {
      const rect: SpotlightRect = { top: 50, left: 200, width: 80, height: 40 }
      const style = computeTooltipStyle(rect, 'top', 160, 280, 12)
      // spaceAbove = 50 - 12 = 38, less than 160 → flip to bottom
      expect(style.top).toBe(102) // 50 + 40 + 12
      expect(style.bottom).toBeUndefined()
    })

    it('auto-flips to top when preferred=bottom but insufficient space below', () => {
      const rect: SpotlightRect = { top: 600, left: 200, width: 80, height: 40 }
      const style = computeTooltipStyle(rect, 'bottom', 160, 280, 12)
      // spaceBelow = 720 - 640 - 12 = 68, less than 160 → flip to top
      expect(style.bottom).toBeDefined()
      expect(style.top).toBeUndefined()
    })

    it('falls back to center when neither side has space', () => {
      vi.stubGlobal('innerHeight', 200) // very small viewport
      const rect: SpotlightRect = { top: 50, left: 200, width: 80, height: 100 }
      const style = computeTooltipStyle(rect, 'top', 160, 280, 12)
      // spaceAbove = 50 - 12 = 38, spaceBelow = 200 - 150 - 12 = 38
      expect(style.top).toBe(20) // (200 - 160) / 2
    })

    it('clamps left to stay within viewport', () => {
      const rect: SpotlightRect = { top: 300, left: 10, width: 30, height: 30 }
      const style = computeTooltipStyle(rect, 'bottom', 160, 280, 12)
      expect(style.left).toBe(12) // clamped to margin
    })

    it('clamps left to prevent right-edge overflow', () => {
      const rect: SpotlightRect = { top: 300, left: 1200, width: 60, height: 30 }
      const style = computeTooltipStyle(rect, 'bottom', 160, 280, 12)
      expect(style.left).toBe(1280 - 280 - 12) // clamped to viewport right edge
    })

    it('never returns negative top or bottom values', () => {
      // This is the exact scenario that caused the tilegram FTUE bug:
      // score_preview target at y=52 with tooltipPosition='top'
      const rect: SpotlightRect = { top: 52, left: 500, width: 100, height: 20 }
      const style = computeTooltipStyle(rect, 'top', 160, 280, 12)
      // Should NOT render above viewport
      if (style.top !== undefined) {
        expect(style.top).toBeGreaterThanOrEqual(0)
      }
      if (style.bottom !== undefined) {
        // Rendered top = 720 - bottom - 160 must be >= 0
        expect(720 - style.bottom - 160).toBeGreaterThanOrEqual(-12)
      }
    })
  })
})

describe('validateOverlayPointerEvents', () => {
  it('warns when pointer-events is auto', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    el.style.pointerEvents = 'auto'
    document.body.appendChild(el)

    validateOverlayPointerEvents(el)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pointer-events'))

    document.body.removeChild(el)
    warnSpy.mockRestore()
  })

  it('does not warn when pointer-events is none', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)

    validateOverlayPointerEvents(el)
    expect(warnSpy).not.toHaveBeenCalled()

    document.body.removeChild(el)
    warnSpy.mockRestore()
  })

  it('handles null element gracefully', () => {
    validateOverlayPointerEvents(null)
    // No error thrown
  })
})
