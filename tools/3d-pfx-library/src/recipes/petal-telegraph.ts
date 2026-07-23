import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-telegraph', 'Petal telegraph', 'Petal warning telegraph with blossom warning and perfume haze.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'petal-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ff3d8a' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'petal-telegraph-warning-fill', tuning: { colorOverride: '#f5549a' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'petal-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'debris', colorOverride: '#ff3d8a', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.5, gravity: -0.4, spinScale: 1.2, blend: 'alpha' } },
], 2, 0.8)
