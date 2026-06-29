import { describe, expect, it, vi } from 'vitest'
import { BUILTIN_UI_RENDERER_VARIANT_IDS, DEFAULT_UI_RENDERER_VARIANT_ID } from '@modules/ui/skin/types'
import {
  applyPreviewSelection,
  discoverScreens,
  isKnownScreen,
  readPreviewRequest,
} from './preview'

const MOCK_TABS = [
  { id: 'home', label: 'HOME' },
  { id: 'shop', label: 'SHOP' },
  { id: 'settings', label: 'SETTINGS' },
] as const

const PREVIEW_RENDERER_VARIANT_ID =
  BUILTIN_UI_RENDERER_VARIANT_IDS.find((variantId) => variantId !== DEFAULT_UI_RENDERER_VARIANT_ID)
  ?? DEFAULT_UI_RENDERER_VARIANT_ID

describe('preview', () => {
  describe('discoverScreens', () => {
    it('returns screen ids and labels from tab config', () => {
      expect(discoverScreens(MOCK_TABS)).toEqual([
        { id: 'home', label: 'HOME' },
        { id: 'shop', label: 'SHOP' },
        { id: 'settings', label: 'SETTINGS' },
      ])
    })

    it('returns an empty array for an empty app', () => {
      expect(discoverScreens([])).toEqual([])
    })
  })

  describe('isKnownScreen', () => {
    it('returns true for a known tab id', () => {
      expect(isKnownScreen('home', MOCK_TABS)).toBe(true)
      expect(isKnownScreen('shop', MOCK_TABS)).toBe(true)
    })

    it('returns false for an unknown screen id', () => {
      expect(isKnownScreen('unknown', MOCK_TABS)).toBe(false)
    })

    it('returns false when there are no tabs', () => {
      expect(isKnownScreen('home', [])).toBe(false)
    })
  })

  describe('readPreviewRequest', () => {
    it('parses preview and screen query params', () => {
      expect(readPreviewRequest(`?preview=board&screen=ignored&renderer=${PREVIEW_RENDERER_VARIANT_ID}&orientation=landscape`)).toEqual({
        previewId: 'board',
        screen: 'ignored',
        rendererVariantId: PREVIEW_RENDERER_VARIANT_ID,
        orientation: 'landscape',
      })
    })

    it('parses screen-only query params', () => {
      expect(readPreviewRequest('?screen=settings')).toEqual({
        previewId: null,
        screen: 'settings',
        rendererVariantId: null,
        orientation: null,
      })
    })

    it('returns all nulls for empty search', () => {
      expect(readPreviewRequest('')).toEqual({
        previewId: null,
        screen: null,
        rendererVariantId: null,
        orientation: null,
      })
    })

    it('parses orientation=portrait', () => {
      expect(readPreviewRequest('?preview=home&orientation=portrait')).toEqual({
        previewId: 'home',
        screen: null,
        rendererVariantId: null,
        orientation: 'portrait',
      })
    })
  })

  describe('applyPreviewSelection', () => {
    it('opens screen via ?preview=<id>', () => {
      const reset = vi.fn()
      const openScreen = vi.fn()

      applyPreviewSelection('?preview=board', { ui: { reset, openScreen } })

      expect(reset).toHaveBeenCalledTimes(1)
      expect(openScreen).toHaveBeenCalledWith('board')
    })

    it('falls back to ?screen=<id> when no preview id', () => {
      const reset = vi.fn()
      const openScreen = vi.fn()

      applyPreviewSelection('?screen=settings', { ui: { reset, openScreen } })

      expect(reset).toHaveBeenCalledTimes(1)
      expect(openScreen).toHaveBeenCalledWith('settings')
    })

    it('does nothing when no debug api is available', () => {
      // Should not throw
      applyPreviewSelection('?preview=home', null)
      applyPreviewSelection('?preview=home', undefined)
    })

    it('does nothing when no preview or screen params', () => {
      const reset = vi.fn()
      const openScreen = vi.fn()

      applyPreviewSelection('', { ui: { reset, openScreen } })

      expect(reset).not.toHaveBeenCalled()
      expect(openScreen).not.toHaveBeenCalled()
    })
  })
})
