import { authoredRecipe } from '../constants/01'

export default authoredRecipe('sand-telegraph', 'Sand telegraph', 'Sand warning telegraph with grain warning and low haze.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'sand-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#c28a26' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'sand-telegraph-warning-fill', tuning: { colorOverride: '#c2913f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'sand-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'debris', colorOverride: '#c2913f', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -2, spinScale: 0.85, blend: 'alpha' } },
], 2, 0.9)
