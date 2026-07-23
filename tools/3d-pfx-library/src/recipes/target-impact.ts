import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-impact', "Target impact", "Lock-on hit confirmation with reticle pop and target pips.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'target-impact-reticle-pop', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.46, scale: 0.5, phase: 'target-impact-lock-pips', tuning: { countScale: 0.26, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'target-impact-confirm-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.4)
