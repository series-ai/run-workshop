import { authoredRecipe } from '../constants/01'

export default authoredRecipe('debris-impact', "Debris impact", "Chunk breakup impact with hard flecks and dust body.", [
  { kind: 'particles', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'debris-impact-chip-burst', tuning: { countScale: 0.44, window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'dark', spinScale: 1.1, turbulenceScale: 0, sprite: 'debris', blend: 'alpha', gravity: -3.4 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.46, phase: 'debris-impact-dust-body', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'debris-impact-hard-glints', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'sparkle', gravity: -1.5 } },
], 2, 2.0)
