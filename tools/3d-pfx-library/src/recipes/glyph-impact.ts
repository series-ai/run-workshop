import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-impact', "Glyph impact", "Glyph contact impact with symbol glow and arcane dust.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.58, phase: 'glyph-impact-symbol-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.26, phase: 'glyph-impact-symbol-glow', tuning: { meshMotion: 'glow' } },
  { kind: 'particles', role: 'aura', opacity: 0.42, scale: 0.5, phase: 'glyph-impact-arcane-dust', tuning: { countScale: 0.34, delay: 0.26, window: 0.28, lifeScale: 0.85, blend: 'alpha', ramp: 'dark', death: 'erode', speedScale: 0.5, turbulenceScale: 0.4, sprite: 'magic', gravity: 0.5 } },
], 2, 2.0)
