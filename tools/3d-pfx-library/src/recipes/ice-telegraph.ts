import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-telegraph', 'Ice telegraph', 'Ice warning telegraph with crystal warning and cold mist.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'ice-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#009dff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'ice-telegraph-warning-fill', tuning: { colorOverride: '#00aaff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'ice-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'twirl', colorOverride: '#7fd8ff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -0.8, spinScale: 0.9, blend: 'alpha' } },
], 2, 0.9)
