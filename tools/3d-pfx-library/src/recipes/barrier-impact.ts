import { authoredRecipe } from '../constants/01'

export default authoredRecipe('barrier-impact', "Barrier impact", "Barrier contact pulse with planar shimmer and edge sparks.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.56, phase: 'barrier-impact-panel-pulse', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.26, phase: 'barrier-impact-planar-shimmer', tuning: { meshMotion: 'flash' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'barrier-impact-edge-sparks', tuning: { window: 0.28, lifeScale: 0.85, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'glow', gravity: -1.2, delay: 0.26 } },
], 2, 2.0)
