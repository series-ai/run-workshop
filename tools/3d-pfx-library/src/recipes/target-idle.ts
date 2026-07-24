import { authoredRecipe } from '../constants/01'

// Production standard §1: the reticle footprint IS the gameplay truth — a
// crisp ground scan disc with a few bright lock pips orbiting on it.
export default authoredRecipe('target-idle', 'Target idle', 'Targeting idle with reticle scan and lock pips.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.6, scale: 0.75, phase: 'target-idle-reticle-scan', tuning: { meshMotion: 'pulse', blend: 'alpha', colorOverride: '#0080ff', positionOffset: [0, -0.7, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.58, phase: 'target-idle-lock-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.3, 0.4, 0.24], colorOverride: '#66b3ff', ramp: 'held', countScale: 0.2, speedScale: 0.7, speedJitter: 0.1, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
], 2, 0.68)
