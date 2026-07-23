import { authoredRecipe } from '../constants/01'

export default authoredRecipe('mud-telegraph', 'Mud telegraph', 'Mud warning telegraph with splat warning and slick ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'mud-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#7a3d0d' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'mud-telegraph-warning-fill', tuning: { colorOverride: '#8a4c1f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'mud-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'splat', colorOverride: '#8a4c1f', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.65, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -1.5, spinScale: 0.85, blend: 'alpha' } },
], 2, 0.8)
