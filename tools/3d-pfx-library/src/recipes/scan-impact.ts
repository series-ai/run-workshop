import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-impact', "Scan impact", "Scan contact burst with data points and compact sweep ring.", [
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.6, phase: 'scan-impact-data-burst', tuning: { countScale: 0.5, window: 0.28, lifeScale: 0.85, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'sparkle', gravity: 0, flicker: 0.8, delay: 0.26, colorOverride: '#bff2e8', speedScale: 0.25, size: [0.4, 0.55, 0.3] } },
  { kind: 'ring-field', role: 'aura', opacity: 0.8, scale: 0.7, phase: 'scan-impact-sweep-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#5fd0be' } },
], 2, 2.4)
