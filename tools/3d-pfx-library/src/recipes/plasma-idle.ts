import { authoredRecipe } from '../constants/01'

export default authoredRecipe('plasma-idle', 'Plasma idle', 'Magnetic plasma idle with ion core and orbit flecks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'plasma-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#0077ff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'plasma-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#0077ff', flicker: 1.4 } },
], 2, 0.81)
