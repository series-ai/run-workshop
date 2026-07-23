import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-telegraph', 'Teleport telegraph', 'Teleport warning telegraph with anchor warning and shimmer breath.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.85, scale: 0.38, phase: 'teleport-telegraph-ground-stamp', tuning: { meshMotion: 'flash', colorOverride: '#0077ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'teleport-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#0077ff' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.28, scale: 0.7, phase: 'teleport-telegraph-warning-fill', tuning: { colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'teleport-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#4da6ff', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.15, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'teleport-telegraph-ground-snapshot', tuning: { sprite: 'glow', delay: 0.9, window: 0.07, lifeScale: 0.12, ease: 'snap', speedScale: 1.8, colorOverride: '#fff1d8', ramp: 'held', countScale: 0.4, turbulenceScale: 0, gravity: 0 } },
], 2, 0.6)
