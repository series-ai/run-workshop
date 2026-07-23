import { authoredRecipe } from '../constants/01'

export default authoredRecipe('electric-telegraph', 'Electric telegraph', 'Electric warning telegraph with voltage warning and charged motes.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'electric-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#009dff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'electric-telegraph-warning-fill', tuning: { colorOverride: '#0095ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'electric-telegraph-ground-urgency', tuning: { motion: 'ground-scuff', sprite: 'arc', colorOverride: '#009dff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, stretch: 1.3, spinScale: 0, flicker: 2.2 } },
], 2, 1.0)
