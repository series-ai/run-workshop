import { authoredRecipe } from '../constants/01'

// Tempo preserves the earlier 0.897423141975923 second period.
export default authoredRecipe('rune-burst', 'Rune burst', 'Angular inscription strokes assemble in depth, activate once, and release small glyph fragments.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.96, scale: 1.18, phase: 'rune-burst-body', tuning: { meshShader: 'rune-burst-inscription', referenceSource: 'repo-original/runeBurstInscription', referenceAdaptation: 'Original spatial inscription strokes assemble, activate and separate.', referenceLicense: 'repo-original', colorIndex: 1, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.88, scale: 1.18, phase: 'rune-burst-accents', tuning: { meshShader: 'rune-burst-glyph-fragments', referenceSource: 'repo-original/runeBurstInscription', referenceAdaptation: 'Original glyph stroke particles turn and fall after activation.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.15)
