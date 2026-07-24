import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-loop', 'Spawn loop', 'Active spawn marker with materialization motes and arrival column.', [
  { kind: 'beam-column', role: 'volume', opacity: 0.45, scale: 0.7, phase: 'spawn-loop-arrival-column', tuning: { meshShader: 'energy-column', meshMotion: 'pulse', widthScale: 0.4, blend: 'additive', colorOverride: '#0077ff', positionOffset: [0, 0.58, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'spawn-loop-materialize-motes', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.28, 0.4, 0.24], colorOverride: '#66aaff', ramp: 'held', countScale: 0.3, speedScale: 0.5, speedJitter: 0.2, turbulenceScale: 0.05, motion: 'column-rise', gravity: 0, spinScale: 0 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.7, scale: 0.72, phase: 'spawn-loop-origin-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'boundary', blend: 'additive', colorOverride: '#0077ff' } },
], 2, 0.8)
