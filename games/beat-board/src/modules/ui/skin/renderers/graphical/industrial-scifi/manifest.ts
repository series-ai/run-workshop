import type { UiThemeDefinition } from '../../types'

export const industrialScifiRendererManifest: UiThemeDefinition = {
  variantId: 'industrial-scifi',
  label: 'Industrial Sci-Fi',
  summary:
    'Matte industrial sci-fi treatment with tactile beveled buttons, physical press states, and warm neutral surfaces on dark housing.',
  themeId: 'industrial-scifi',
  defaultIconAssetId: 'tabler',
  extendsVariantId: null,
  fontFamily: {
    body: "'Montserrat', 'Trebuchet MS', 'Segoe UI', sans-serif",
    display: "'Montserrat', 'Trebuchet MS', 'Segoe UI', sans-serif",
  },
  fontUrls: [
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
  ],
  semanticCoverage: 'full',
}
