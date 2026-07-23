import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-impact', "Frost impact", "Cold contact impact with crystal mist and small frost ring.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.55, scale: 0.46, phase: 'frost-impact-crystal-mist', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#bfe0f5' } },
  { kind: 'particles', role: 'volume', opacity: 0.95, scale: 0.6, phase: 'frost-impact-crystal-drift', tuning: { countScale: 0.5, delay: 0.26, window: 0.28, lifeScale: 0.85, blend: 'alpha', ramp: 'held', death: 'erode', speedScale: 0.3, turbulenceScale: 0.4, sprite: 'sparkle', gravity: -0.7, spinScale: 0.8, colorOverride: '#eaf8ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.7, scale: 0.55, phase: 'frost-impact-chill-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#9fd8ff' } },
], 2, 1.8)
