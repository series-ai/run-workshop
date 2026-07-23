import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-telegraph', 'Flame telegraph', 'Flame warning telegraph with fire fan and warning ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'flame-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ff2600' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'flame-telegraph-warning-fill', tuning: { colorOverride: '#ff3d00' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'flame-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'fire', colorOverride: '#ff3d00', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0, flicker: 1.6 } },
], 2, 0.9)
