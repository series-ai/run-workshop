import type { GeneratedRendererConfig } from './types'
import { DEFAULT_UI_RENDERER_VARIANT_ID } from './types'
import { defaultActiveRendererManifest } from './renderers/active/manifest'

export const generatedRendererConfig: GeneratedRendererConfig = {
  variantId: DEFAULT_UI_RENDERER_VARIANT_ID,
  themeId: defaultActiveRendererManifest.themeId,
  label: defaultActiveRendererManifest.label,
  iconAssetId: defaultActiveRendererManifest.defaultIconAssetId,
  defaultIconAssetId: defaultActiveRendererManifest.defaultIconAssetId,
  fontFamily: defaultActiveRendererManifest.fontFamily,
  fontUrls: defaultActiveRendererManifest.fontUrls,
}
