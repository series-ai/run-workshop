import { useContext } from 'react'
import { DEFAULT_UI_ICON_PACK_ID, DEFAULT_UI_RENDERER_VARIANT_ID, DEFAULT_UI_THEME_ID } from '../types'
import { UiThemeContext } from './UiThemeProvider'
import type { UiThemeContextValue } from './theme-contract'

const fallback: UiThemeContextValue = {
  rendererVariantId: DEFAULT_UI_RENDERER_VARIANT_ID,
  themeId: DEFAULT_UI_THEME_ID,
  iconAssetId: DEFAULT_UI_ICON_PACK_ID,
  requestedIconAssetId: DEFAULT_UI_ICON_PACK_ID,
  defaultIconAssetId: DEFAULT_UI_ICON_PACK_ID,
  fontFamily: {
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    display: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
  },
}

export function useUiTheme(): UiThemeContextValue {
  return useContext(UiThemeContext) ?? fallback
}
