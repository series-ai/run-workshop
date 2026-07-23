import { authoredRecipe } from '../constants/01'

export default authoredRecipe('sand-impact', "Sand impact", "Grainy ground hit with sand burst and low settling haze.", [
  { kind: 'particles', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'sand-impact-grain-burst', tuning: { countScale: 0.3, window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'held', spinScale: 0.9, turbulenceScale: 0, sprite: 'debris', blend: 'alpha', colorOverride: '#c2a26a', gravity: -3.6, motion: 'ground-scuff', delay: 0.12, speedScale: 1.6, drag: 0.9, size: [0.4, 0.5, 0.18] } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.44, phase: 'sand-impact-settling-haze', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'sand-impact-ground-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.9)
