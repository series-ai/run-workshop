import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-spawn', 'Acid spawn', 'One-draw corrosive emergence: a closed irregular aperture spreads across the ground while six integrated acid crowns stretch upward at staggered heights before draining back into the toxic pool.', [
  { kind: 'impact-shards', role: 'aura', opacity: 1, scale: 0.96, phase: 'acid-spawn-corrosive-aperture-crown', tuning: { meshGeometry: 'acid-spawn-corrosive-aperture', meshMotion: 'bloom', lifecycle: 'acid-spawn-eruption', blend: 'alpha', colorOverride: '#73f22f', positionOffset: [0, -0.72, 0] } },
], 2, 0.95)
