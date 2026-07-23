import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-telegraph', 'Poison telegraph', 'Poison warning telegraph with spore warning and hazard pulse.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'poison-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#3fe800' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'poison-telegraph-warning-fill', tuning: { colorOverride: '#55e51f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'poison-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'glow', colorOverride: '#3fe800', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0, flicker: 0.8 } },
], 2, 0.8)
