import { authoredRecipe } from '../constants/01'

export default authoredRecipe('target-idle', 'Target idle', 'Targeting idle with reticle scan and lock pips.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.55, scale: 0.7, phase: 'target-idle-reticle-scan', tuning: { meshMotion: 'pulse', blend: 'alpha', colorOverride: '#0080ff', positionOffset: [0, -0.7, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.55, phase: 'target-idle-lock-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.24, 0.34, 0.2], colorOverride: '#66b3ff', ramp: 'held', countScale: 0.16, speedScale: 0.55, speedJitter: 0.1, turbulenceScale: 0, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
], 2, 0.68)
