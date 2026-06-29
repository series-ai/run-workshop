import type { UiThemeDefinition } from '../../types'

export const evergroveRendererManifest: UiThemeDefinition = {
  variantId: 'evergrove',
  label: 'Evergrove',
  summary:
    'Nature-forward casual styling with bold rounded typography, wooden borders, teal action buttons, and lush green atmospherics.',
  themeId: 'evergrove',
  defaultIconAssetId: 'heroicons',
  extendsVariantId: null,
  fontFamily: {
    body: "'Righteous', 'Trebuchet MS', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "'Righteous', 'Trebuchet MS', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  fontUrls: [
    'https://fonts.googleapis.com/css2?family=Righteous&display=swap',
  ],
  semanticCoverage: 'full',
}
