import { authoredRecipe } from '../constants/01'

// Tempo compensates for removal of the particle cycleScale, 1.118082.
// The real getPfxBurstCycleSeconds remains exactly 1.08750643115942 seconds.
export default authoredRecipe('acid-burst', 'Acid burst', 'Thin acid erupts as three unequal torn lobes. Curved sheets roll at the rim and tear from the edge into fast rounded drops. Small vapor tufts disperse without a pool.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.96, scale: 1.18, phase: 'acid-burst-corrosive-splash', tuning: { meshShader: 'acid-burst-corrosive-splash', referenceSource: 'repo-original/acidBurstCorrosiveSplash', referenceAdaptation: 'Original curved sheet particles roll and tear through their outer edges, with narrow wet highlights and shaded drops.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'impact', opacity: 0.94, scale: 1.18, phase: 'acid-burst-caustic-spray', tuning: { meshShader: 'acid-burst-caustic-spray', referenceSource: 'repo-original/acidBurstCorrosiveSplash', referenceAdaptation: 'Original small vapor tufts and rupture bubbles use alpha blending.', referenceLicense: 'repo-original', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.001715437687039)
