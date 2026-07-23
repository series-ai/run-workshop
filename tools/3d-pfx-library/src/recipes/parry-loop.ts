import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-loop', 'Parry loop', 'Timing window loop with compact contact star and readiness ticks.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'parry-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffb300' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'parry-loop-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#ffb300', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'parry-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffb300' } },
], 2, 0.8)
