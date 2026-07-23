import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-telegraph', 'Wind telegraph', 'Wind warning telegraph with gust warning and dust draw.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'wind-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00d9a8' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'wind-telegraph-warning-fill', tuning: { colorOverride: '#2fd9b8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'wind-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'streak', colorOverride: '#00d9a8', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, stretch: 1.6, spinScale: 0 } },
], 2, 1.1)
