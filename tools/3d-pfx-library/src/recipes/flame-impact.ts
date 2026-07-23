import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-impact', "Flame impact", "Fire contact impact with hot core and ember fan.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.6, scale: 0.5, phase: 'flame-impact-hot-core', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'impact', opacity: 0.62, scale: 0.56, phase: 'flame-impact-ember-fan', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'fire', spinScale: 1.3, gravity: -0.7 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'flame-impact-heat-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.0)
