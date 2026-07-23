import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-burst', "Target burst", "Target acquisition burst with a reticle opening and lock pips.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.58, scale: 0.68, phase: 'target-burst-reticle-open', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.44, scale: 0.42, phase: 'target-burst-lock-pips', tuning: { delay: 0.14, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0 } },
  { kind: 'beam-column', role: 'body', opacity: 0.6, scale: 0.46, phase: 'target-burst-anchor-tick', tuning: { meshMotion: 'flash' } },
], 2, 1.3)
