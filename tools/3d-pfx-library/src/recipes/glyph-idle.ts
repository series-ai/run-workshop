import { authoredRecipe } from '../constants/01'

export default authoredRecipe('glyph-idle', 'Glyph idle', 'Glyph glow idle with symbol ring and dust.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'glyph-idle-element-traffic', tuning: { sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#ffb300', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'glyph-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffb300' } },
], 2, 0.68)
