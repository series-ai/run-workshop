import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-telegraph', 'Curse telegraph', 'Curse warning telegraph with hex warning and glyph dust.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'curse-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#9d2bff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'curse-telegraph-warning-fill', tuning: { colorOverride: '#a855f5' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'curse-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'magic', colorOverride: '#9d2bff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
], 2, 0.8)
