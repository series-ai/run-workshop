import type { UiThemeDefinition } from '../../types'

export const neonScifiRendererManifest: UiThemeDefinition = {
  variantId: 'neon-scifi',
  label: 'Neon Sci-Fi',
  summary:
    'Cyberpunk sci-fi treatment with asymmetric corner cuts, glitch motion, backdrop blur, and neon glow borders.',
  themeId: 'neon-scifi',
  defaultIconAssetId: 'phosphor',
  extendsVariantId: null,
  fontFamily: {
    body: "'Cyber', 'Trebuchet MS', 'Segoe UI', sans-serif",
    display: "'Cyber', 'Trebuchet MS', 'Segoe UI', sans-serif",
  },
  fontUrls: [
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap',
  ],
  semanticCoverage: 'full',
}
