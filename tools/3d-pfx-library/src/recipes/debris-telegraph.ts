import { authoredRecipe } from '../constants/01'

export default authoredRecipe('debris-telegraph', 'Debris telegraph', 'Debris warning telegraph with chip warning and dust body.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.85, scale: 0.38, phase: 'debris-telegraph-ground-stamp', tuning: { meshMotion: 'flash', colorOverride: '#c2761f' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.75, phase: 'debris-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#c2761f' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'debris-telegraph-ground-urgency', tuning: { motion: 'column-rise', sprite: 'debris', colorOverride: '#8f6d33', ramp: 'pigment', delay: 0.12, window: 0.6, lifeScale: 1.0, countScale: 0.3, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: -2, spinScale: 0.9, blend: 'alpha' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.95, scale: 0.5, phase: 'debris-telegraph-ground-snapshot', tuning: { sprite: 'glow', delay: 0.9, window: 0.07, lifeScale: 0.12, ease: 'snap', speedScale: 1.8, colorOverride: '#fff1d8', ramp: 'held', countScale: 0.4, turbulenceScale: 0, gravity: 0 } },
], 2, 0.9)
