import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-telegraph', 'Holy telegraph', 'Holy warning telegraph with halo warning and grace motes.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'holy-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffc300' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'holy-telegraph-warning-fill', tuning: { colorOverride: '#ffc93d' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'holy-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#ffc300', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.15, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
], 2, 0.8)
