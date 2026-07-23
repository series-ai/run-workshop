import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-telegraph', 'Spawn telegraph', 'Spawn warning telegraph with origin warning and ready motes.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'spawn-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#0077ff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'spawn-telegraph-warning-fill', tuning: { colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'spawn-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#4da6ff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.15, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
], 2, 0.9)
