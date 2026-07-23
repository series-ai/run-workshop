import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rune-telegraph', 'Rune telegraph', 'Rune warning telegraph with script warning and casting ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'rune-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffa200' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'rune-telegraph-warning-fill', tuning: { colorOverride: '#ffb62f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'rune-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'rune', colorOverride: '#ffb62f', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.15, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
], 2, 0.9)
