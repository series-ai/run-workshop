import type { CSSProperties, ReactNode } from 'react'
import type { GeneratedRendererConfig, UiRendererVariantId, UiSkinIconAssetId, UiThemeId } from '../types'
import type { UiGeometryContract } from './geometry-contract'

export interface UiThemeContextValue {
  rendererVariantId: UiRendererVariantId
  themeId: UiThemeId
  iconAssetId: UiSkinIconAssetId
  requestedIconAssetId: UiSkinIconAssetId
  defaultIconAssetId: UiSkinIconAssetId
  fontFamily: { body: string; display: string }
  geometryContract?: UiGeometryContract
}

export interface UiThemeProviderProps {
  as?: keyof HTMLElementTagNameMap
  children?: ReactNode
  className?: string
  iconAssetId?: UiSkinIconAssetId
  rendererVariantId?: UiRendererVariantId
  style?: CSSProperties
  /**
   * Project-owned renderer config. When omitted, falls back to the module's
   * built-in default (for standalone/module-test usage). Consumer apps should
   * always pass their own generated config (typically `src/config/ui-renderer`).
   */
  config?: GeneratedRendererConfig
}
