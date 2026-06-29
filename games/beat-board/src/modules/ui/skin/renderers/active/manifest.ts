import type { UiThemeDefinition } from '../types'

export const neutralBaseRendererManifest: UiThemeDefinition = {
  variantId: 'neutral-base',
  label: 'Flexible Baseline',
  summary:
    'Game-ready embossed baseline theme with candy-gradient buttons, thick ledge shadows, bold typography, and broad genre flexibility.',
  themeId: 'neutral-base',
  defaultIconAssetId: 'lucide',
  extendsVariantId: null,
  fontFamily: {
    body: "'Nunito', 'Trebuchet MS', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "'Nunito', 'Trebuchet MS', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  fontUrls: [
    'https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap',
  ],
  semanticCoverage: 'full',
}

export { neutralBaseRendererManifest as defaultActiveRendererManifest }
