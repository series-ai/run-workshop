import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-telegraph', 'Slime telegraph', 'Slime warning telegraph with ooze warning and sticky beads.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'slime-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00d926' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'slime-telegraph-warning-fill', tuning: { colorOverride: '#2fd943' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'slime-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'splat', colorOverride: '#00d926', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.65, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -1, spinScale: 0.85 } },
], 2, 0.8)
