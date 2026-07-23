import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-telegraph', 'Frost telegraph', 'Frost warning telegraph with chill warning and snow motes.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'frost-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00aaff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'frost-telegraph-warning-fill', tuning: { colorOverride: '#4db8f0' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'frost-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#7fd8ff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.15, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -0.5, spinScale: 0, blend: 'alpha' } },
], 2, 0.9)
