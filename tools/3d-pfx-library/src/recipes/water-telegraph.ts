import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-telegraph', 'Water telegraph', 'Water warning telegraph with ripple warning and droplet gather.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'water-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#0095ff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'water-telegraph-warning-fill', tuning: { colorOverride: '#1fa8e8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'water-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'soft', colorOverride: '#1fa8e8', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -1, spinScale: 0 } },
], 2, 0.9)
