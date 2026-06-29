import type { UiThemeDefinition } from '../../types'

export const editorialNarrativeRendererManifest: UiThemeDefinition = {
  variantId: 'editorial-narrative',
  label: 'Editorial Narrative',
  summary:
    'Light editorial messenger styling with serif-led hierarchy, soft paper surfaces, restrained motion, and genre-neutral narrative clarity.',
  themeId: 'editorial-narrative',
  defaultIconAssetId: 'lucide',
  extendsVariantId: null,
  fontFamily: {
    body: "'DM Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "'Playfair Display', 'Georgia', 'Times New Roman', serif",
  },
  fontUrls: [
    'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap',
  ],
  semanticCoverage: 'full',
}
