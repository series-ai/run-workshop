import { authoredRecipe } from '../constants/01'

export default authoredRecipe('beam-burst', "Beam burst", "Short beam discharge with a core lance and muzzle ring.", [
  { kind: 'beam-column', role: 'body', opacity: 0.62, scale: 0.9, phase: 'beam-burst-core-lance', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'body', opacity: 0.52, scale: 0.5, phase: 'beam-burst-edge-sparks', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'streak', stretch: 1.8, gravity: 0, spinScale: 0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.5, scale: 0.6, phase: 'beam-burst-muzzle-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.3)
