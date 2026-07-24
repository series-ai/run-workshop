import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-idle', 'Teleport idle', 'Teleport arrival hum with anchor ring and shimmer pips.', [
  { kind: 'magic-circle', role: 'aura', opacity: 0.75, scale: 0.72, phase: 'teleport-idle-anchor-ring', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#0077ff', positionOffset: [0, -0.7, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.8, scale: 0.58, phase: 'teleport-idle-shimmer-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.26, 0.38, 0.22], colorOverride: '#66aaff', ramp: 'held', countScale: 0.22, speedScale: 0.45, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0, spinScale: 0 } },
], 2, 0.68)
