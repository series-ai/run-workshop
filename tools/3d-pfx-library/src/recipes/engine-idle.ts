import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-idle', 'Engine idle', 'Engine idle with heat tremor and carbon flecks.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'engine-idle-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#5a7ba8', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'engine-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5a7ba8' } },
], 2, 0.81)
