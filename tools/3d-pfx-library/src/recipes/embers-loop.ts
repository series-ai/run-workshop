import { authoredRecipe } from '../constants/01'

export default authoredRecipe('embers-loop', 'Embers loop', 'Banked fire ambience with warm motes and a small persistent glow.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'embers-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ff6a00' } },
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.6, phase: 'embers-loop-rising-cinders', tuning: { motion: 'column-rise', sprite: 'glow', size: [0.35, 0.5, 0.3], colorOverride: '#ff6a00', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.5, spinScale: 0, turbulenceScale: 0.4, gravity: 0.5, flicker: 1.8 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.35, phase: 'embers-loop-heat-presence', tuning: { meshMotion: 'glow', colorOverride: '#ff6a00' } },
], 2, 0.95)
