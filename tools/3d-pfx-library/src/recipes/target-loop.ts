import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-loop', 'Target loop', 'Persistent target acquisition loop with reticle orbit and lock pips.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'target-loop-reticle-orbit', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', blend: 'additive', colorOverride: '#0080ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.58, phase: 'target-loop-lock-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.26, 0.36, 0.22], colorOverride: '#66b3ff', ramp: 'held', countScale: 0.22, speedScale: 0.6, speedJitter: 0.1, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.3, phase: 'target-loop-acquire-pulse', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#99ccff' } },
], 2, 0.8)
