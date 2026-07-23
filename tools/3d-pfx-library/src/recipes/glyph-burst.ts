import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-burst', "Glyph burst", "Spell glyph pop for cast confirmations, puzzle states, and pickups.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.7, phase: 'glyph-burst-bloom-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.56, scale: 0.5, phase: 'glyph-burst-letter-sparks', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'rune', blend: 'alpha', gravity: 0.7, spinScale: 0.8 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.5, scale: 0.62, phase: 'glyph-burst-ground-ripple', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.15)
