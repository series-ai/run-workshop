import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-idle', 'Warning idle', 'Warning idle with alert breath and tick particles.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.5, scale: 0.7, phase: 'warning-idle-alert-breath', tuning: { meshMotion: 'breathe', blend: 'alpha', colorOverride: '#ff5500', flicker: 1.2, positionOffset: [0, -0.7, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.55, phase: 'warning-idle-tick-particles', tuning: { sprite: 'glow', blend: 'additive', size: [0.3, 0.42, 0.24], colorOverride: '#ff8a3d', ramp: 'held', countScale: 0.2, speedScale: 0.5, speedJitter: 0.5, turbulenceScale: 0.1, motion: 'danger-pulse', gravity: 0, spinScale: 0, flicker: 1.8 } },
], 2, 1.7)
