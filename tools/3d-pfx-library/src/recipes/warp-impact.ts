import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-impact', "Warp impact", "Space-warp contact with lens ring and displaced motes.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.58, phase: 'warp-impact-lens-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.42, scale: 0.5, phase: 'warp-impact-displaced-motes', tuning: { countScale: 0.3, delay: 0.26, window: 0.28, lifeScale: 0.85, blend: 'alpha', ramp: 'dark', death: 'erode', speedScale: 0.5, turbulenceScale: 0.4, sprite: 'sparkle', gravity: 0, spinScale: 1.4 } },
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.24, phase: 'warp-impact-space-slice', tuning: { meshMotion: 'glow' } },
], 2, 2.0)
