import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-idle', 'Scan idle', 'Scan idle with data sweep and sample points.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'scan-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00d9b0', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'scan-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d9b0' } },
], 2, 0.68)
