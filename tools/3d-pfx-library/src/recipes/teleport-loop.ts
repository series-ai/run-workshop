import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-loop', 'Teleport loop', 'Arrival/departure loop with afterimage slice and stable anchor ring.', [
  { kind: 'magic-circle', role: 'aura', opacity: 0.8, scale: 0.75, phase: 'teleport-loop-anchor-ring', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#0077ff', positionOffset: [0, -0.7, 0] } },
  { kind: 'screen-plane', role: 'aura', opacity: 0.4, scale: 0.6, phase: 'teleport-loop-afterimage-slice', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#3399ff', positionOffset: [0, 0.5, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'teleport-loop-arrival-column', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.28, 0.4, 0.24], colorOverride: '#66aaff', ramp: 'held', countScale: 0.3, speedScale: 0.55, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0, spinScale: 0 } },
], 2, 0.8)
