import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-telegraph', 'Glyph telegraph', 'Glyph warning telegraph with symbol warning and arcane dust.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'glyph-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffb300' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'glyph-telegraph-warning-fill', tuning: { colorOverride: '#ffc21f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'glyph-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'magic', colorOverride: '#ffb300', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.15, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
], 2, 0.9)
