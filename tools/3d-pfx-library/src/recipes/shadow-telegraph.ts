import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-telegraph', 'Shadow telegraph', 'Shadow warning telegraph with void warning and ink wake.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'shadow-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#6a26e8' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'shadow-telegraph-warning-fill', tuning: { colorOverride: '#7a3ff0' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'shadow-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'twirl', colorOverride: '#6a26e8', ramp: 'dark', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0.7, blend: 'alpha' } },
], 2, 0.7)
