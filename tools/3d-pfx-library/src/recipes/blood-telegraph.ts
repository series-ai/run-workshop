import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blood-telegraph', 'Blood telegraph', 'Blood warning telegraph with pulse warning and droplet beats.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'blood-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#a80d18' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'blood-telegraph-warning-fill', tuning: { colorOverride: '#b5121f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'blood-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'splat', colorOverride: '#a80d18', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.65, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -1.5, spinScale: 0.85, blend: 'alpha' } },
], 2, 0.9)
