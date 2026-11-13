import { authoredRecipe } from '../constants/01'

// An impact opens a cavity in a low water surface and throws up a thin,
// connected crown. Unequal fingers grow from the rim and their tip beads
// pinch off and fall on gravity arcs. The sheet opens holes and slumps
// outward into a ring wave, a short rebound jet rises, and the surface
// settles and retires. cycleScale stays 1, so tempo 1.25 keeps the
// earlier 0.871 s cycle.
export default authoredRecipe('water-burst', 'Water burst', 'A thin splash crown with unequal fingers whose tip beads pinch off and fall, then a slump into ring waves, a rebound jet and a settling surface.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.96, scale: 1.3, phase: 'water-burst-splash-crown', tuning: { meshShader: 'water-burst-splash-crown', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'impact', opacity: 0.96, scale: 1.3, phase: 'water-burst-ballistic-droplets', tuning: { meshShader: 'water-burst-ballistic-droplets', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.25)
