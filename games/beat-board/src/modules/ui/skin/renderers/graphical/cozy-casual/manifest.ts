import type { UiThemeDefinition } from '../../types'

export const cozyCasualRendererManifest: UiThemeDefinition = {
  variantId: 'cozy-casual',
  label: 'Cozy Casual',
  summary:
    'Warm tabletop-inspired casual styling with paper panels, tile-forward controls, light surfaces, and calm scenic contrast.',
  themeId: 'cozy-casual',
  defaultIconAssetId: 'heroicons',
  extendsVariantId: null,
  fontFamily: {
    body: "'Nunito', 'Trebuchet MS', 'Segoe UI', sans-serif",
    display: "'Bree Serif', 'Georgia', 'Times New Roman', serif",
  },
  fontUrls: [
    'https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@600;700;800&display=swap',
  ],
  semanticCoverage: 'full',
}
