import { authoredRecipe } from '../constants/01'

export default authoredRecipe('bubble-telegraph', 'Bubble telegraph', 'Bubble warning telegraph with pop warning and foam breath.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'bubble-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00a8f0' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'bubble-telegraph-warning-fill', tuning: { colorOverride: '#29b6f0' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'bubble-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'soft', colorOverride: '#29b6f0', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
], 2, 0.9)
