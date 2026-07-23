import { authoredRecipe } from '../constants/01'

export default authoredRecipe('healing-idle', 'Healing idle', 'Restoration idle with orbit motes and calm pulse.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'healing-idle-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#00d954', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'healing-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d954' } },
], 2, 0.5)
