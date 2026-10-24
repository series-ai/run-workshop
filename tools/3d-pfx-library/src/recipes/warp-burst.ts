import { authoredRecipe } from '../constants/01'

// A disc of space lattice pinches toward an off-centre crease, then snaps
// into an asymmetric Z-fold: the upper half rolls over toward the viewer and
// the halves shear apart. Traces release along the shear and shrink away,
// and the lattice tears from the crease outward. Tempo keeps the earlier
// 0.778 s cycle.
export default authoredRecipe('warp-burst', 'Warp burst', 'A space lattice pinches, then snaps into a sheared fold. Traces slide out along the shear while the lattice tears from the crease.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.95, scale: 1.3, phase: 'warp-burst-folding-lattice', tuning: { meshShader: 'warp-burst-fold-sheet', colorIndex: 1, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.95, scale: 1.3, phase: 'warp-burst-shear-traces', tuning: { meshShader: 'warp-burst-shear-traces', colorIndex: 1, turbulenceScale: 0 } },
], 2, 1.4)
