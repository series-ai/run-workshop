import { authoredRecipe } from '../constants/01'

export default authoredRecipe('combo-burst', "Combo burst", "Score/combo emphasis burst with a readable UI pulse.", [
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.34, phase: 'combo-burst-ui-pulse', tuning: { meshMotion: 'flash' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.46, scale: 0.58, phase: 'combo-burst-score-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'screen', opacity: 0.52, scale: 0.46, phase: 'combo-burst-score-pips', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 1.2, spinScale: 1.3 } },
], 2, 1.35)
