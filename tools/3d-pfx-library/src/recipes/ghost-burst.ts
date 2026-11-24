import { authoredRecipe } from '../constants/01'

// Torn wisps spiral into one point and a hooded spectral mask condenses
// from its face outward. It shrieks, then drifts up and away while its
// tattered shroud curls behind it. The shroud tears from the tails up and
// the face goes last. Tempo keeps the earlier 1.62 s cycle.
export default authoredRecipe('ghost-burst', 'Ghost burst', 'Torn wisps spiral into a hooded spectral mask. It shrieks, drifts away, and its shroud tears from the tails to the face.', [
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.9, scale: 0.92, phase: 'ghost-burst-torn-wisps', tuning: { meshShader: 'ghost-burst-wisps', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'shield-shell', role: 'body', opacity: 0.95, scale: 0.92, phase: 'ghost-burst-spectral-apparition', tuning: { meshShader: 'ghost-burst-apparition', colorIndex: 0, turbulenceScale: 0 } },
], 2, 0.80698)
