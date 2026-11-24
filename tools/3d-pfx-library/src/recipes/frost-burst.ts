import { authoredRecipe } from '../constants/01'

// A cold contact bites, then a fan of thin faceted ice blades grows out of
// it with fern side blades, at an uneven speed on each stem. The fan holds,
// then turns brittle: the outer pieces crack first, drift, turn and fall,
// and sublimate into thin cold vapor and tumbling flakes. Tempo keeps the
// earlier 1.070 s cycle.
export default authoredRecipe('frost-burst', 'Frost burst', 'A cold contact grows a fan of faceted rime blades and ferns, which crack, drift and sublimate into cold vapor and flakes.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.95, scale: 1.45, phase: 'frost-burst-rime-fan', tuning: { meshShader: 'frost-burst-crystal-fan', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.9, scale: 1.45, phase: 'frost-burst-sublimation-mist', tuning: { meshShader: 'frost-burst-freezing-mist', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.0)
