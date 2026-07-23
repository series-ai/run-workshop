import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-telegraph', 'Acid telegraph', 'Acid warning telegraph with corrosion warning and vapor wisp.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'acid-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00e800' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'acid-telegraph-warning-fill', tuning: { colorOverride: '#2fd943' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'acid-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'splat', colorOverride: '#00e800', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.65, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -1.2, spinScale: 0.85 } },
], 2, 0.9)
