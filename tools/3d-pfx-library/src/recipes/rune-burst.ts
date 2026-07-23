import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-burst', "Rune burst", "Arcane burst with a script flash and readable magical falloff.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.62, scale: 0.72, phase: 'rune-burst-script-flash', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.58, scale: 0.54, phase: 'rune-burst-symbol-motes', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.7, ease: 'snap', turbulenceScale: 0, sprite: 'rune', blend: 'alpha', gravity: 0.8, spinScale: 0.7 } },
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.34, phase: 'rune-burst-arcane-pop', tuning: { meshMotion: 'flash' } },
], 2, 1.15)
