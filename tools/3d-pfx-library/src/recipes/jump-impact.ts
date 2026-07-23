import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-impact', "Jump impact", "Jump contact with lift burst, air pips, and landing guide ring.", [
  { kind: 'beam-column', role: 'body', opacity: 0.22, scale: 0.5, phase: 'jump-impact-lift-burst' },
  { kind: 'particles', role: 'body', opacity: 0.42, scale: 0.5, phase: 'jump-impact-air-pips', tuning: { countScale: 0.26, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: 1.5 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'jump-impact-guide-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.9)
