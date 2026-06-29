import { createContext, createElement } from 'react'
import type { CSSProperties, HTMLAttributes } from 'react'
import { generatedRendererConfig as defaultGeneratedRendererConfig } from '../generatedRendererConfig'
import { resolveUiSkinIconPack } from '../icons/registry'
import { getUiRendererDefinition } from '../renderers/registry'
import { UI_GEOMETRY_CONTRACT } from './geometry-contract'
import type { UiThemeContextValue, UiThemeProviderProps } from './theme-contract'
import '../renderers/shared/styles/base.css'

export const UiThemeContext = createContext<UiThemeContextValue | null>(null)

function joinClassName(...values: Array<string | undefined>): string | undefined {
  const result = values.filter(Boolean).join(' ').trim()
  return result || undefined
}

export interface UiThemeProviderElementProps extends UiThemeProviderProps, Omit<HTMLAttributes<HTMLElement>, 'style'> {
  style?: CSSProperties
}

// Consumer apps pass their generated `config` (from `src/config/ui-renderer`)
// and import renderer `theme.css` + project `ui-overrides.css` at their entry
// point. Standalone module tests omit `config` and fall back to the default.
export function UiThemeProvider({
  as = 'div',
  children,
  className,
  iconAssetId,
  rendererVariantId,
  style,
  config,
  ...rest
}: UiThemeProviderElementProps) {
  const generatedRendererConfig = config ?? defaultGeneratedRendererConfig
  const themeDefinition = rendererVariantId ? getUiRendererDefinition(rendererVariantId) : generatedRendererConfig
  const fallbackIconAssetId = themeDefinition.defaultIconAssetId ?? generatedRendererConfig.defaultIconAssetId
  const requestedIconAssetId = iconAssetId ?? (rendererVariantId ? themeDefinition.defaultIconAssetId : generatedRendererConfig.iconAssetId)
  const resolvedIconPack = resolveUiSkinIconPack(requestedIconAssetId, fallbackIconAssetId)
  const themeValue: UiThemeContextValue = {
    rendererVariantId: themeDefinition.variantId,
    themeId: themeDefinition.themeId,
    iconAssetId: resolvedIconPack.id,
    requestedIconAssetId,
    defaultIconAssetId: themeDefinition.defaultIconAssetId,
    fontFamily: themeDefinition.fontFamily,
    geometryContract: UI_GEOMETRY_CONTRACT,
  }

  return createElement(
    as,
    {
      ...rest,
      className: joinClassName('ui-theme-root', className),
      'data-ui-theme': themeValue.themeId,
      'data-ui-icon-pack': themeValue.iconAssetId,
      'data-ui-icon-pack-requested': themeValue.requestedIconAssetId,
      'data-ui-renderer-variant': themeDefinition.variantId,
      style: {
        '--ui-font-body': themeValue.fontFamily.body,
        '--ui-font-display': themeValue.fontFamily.display,
        ...style,
      } as CSSProperties,
    },
    <UiThemeContext.Provider value={themeValue}>
      {children}
    </UiThemeContext.Provider>,
  )
}
