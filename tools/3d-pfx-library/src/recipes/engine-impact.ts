import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-impact', "Engine impact", "Mechanical contact with heat knock, soot points, and metal glint.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.42, phase: 'engine-impact-heat-knock', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'particles', role: 'impact', opacity: 0.42, scale: 0.5, phase: 'engine-impact-soot-points', tuning: { countScale: 0.21, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0.4, sprite: 'debris', blend: 'alpha', ramp: 'dark', gravity: 0.5 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'engine-impact-metal-glint', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'sparkle', gravity: -1.5 } },
], 2, 1.9)
