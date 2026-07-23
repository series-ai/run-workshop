import { authoredRecipe } from '../constants/01'

export default authoredRecipe('leaf-telegraph', 'Leaf telegraph', 'Leaf warning telegraph with canopy warning and green eddy.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'leaf-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#3fb800' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'leaf-telegraph-warning-fill', tuning: { colorOverride: '#55c21f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'leaf-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'debris', colorOverride: '#55c21f', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.5, gravity: -0.6, spinScale: 1.3, blend: 'alpha' } },
], 2, 0.9)
