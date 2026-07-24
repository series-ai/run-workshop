import { authoredRecipe } from '../constants/01'

// Production standard §1/§4: the reticle ring is the focal read; lock pips
// orbit on it and a soft acquire pulse marks the center — support stays dim.
export default authoredRecipe('target-loop', 'Target loop', 'Persistent target acquisition loop with reticle orbit and lock pips.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.9, scale: 0.78, phase: 'target-loop-reticle-orbit', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', blend: 'additive', colorOverride: '#0080ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.6, phase: 'target-loop-lock-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.3, 0.4, 0.24], colorOverride: '#66b3ff', ramp: 'held', countScale: 0.28, speedScale: 0.75, speedJitter: 0.1, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.55, scale: 0.32, phase: 'target-loop-acquire-pulse', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#99ccff' } },
], 2, 0.8)
