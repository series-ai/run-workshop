import { authoredRecipe } from '../constants/01'

export default authoredRecipe('marker-impact', "Marker impact", "Placement contact ping with anchor mark and position motes.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.75, scale: 0.55, phase: 'marker-impact-anchor-ping', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#6fbcf5' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.6, phase: 'marker-impact-position-motes', tuning: { countScale: 0.5, delay: 0.26, window: 0.28, lifeScale: 0.85, ramp: 'held', death: 'erode', speedScale: 0.3, turbulenceScale: 0.4, sprite: 'sparkle', gravity: 0, colorOverride: '#c8e8ff', size: [0.4, 0.55, 0.3] } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.55, scale: 0.55, phase: 'marker-impact-ground-mark', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#6fbcf5' } },
], 2, 2.4)
