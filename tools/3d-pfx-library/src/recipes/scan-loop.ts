import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-loop', 'Scan loop', 'Tactical scanning loop with sweep ribbon and data points.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'scan-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00d9b0' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'scan-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00d9b0', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'scan-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d9b0' } },
], 2, 0.8)
