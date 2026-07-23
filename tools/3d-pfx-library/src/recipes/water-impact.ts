import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-impact', "Water impact", "Readable splash impact with crown, droplets, and wake ring.", [
  { kind: 'particles', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'water-impact-splash-cap', tuning: { countScale: 0.3, window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'held', spinScale: 0.5, turbulenceScale: 0, sprite: 'splat', gravity: -2.4, colorOverride: '#5ec8f0', death: 'erode', delay: 0.12 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.58, phase: 'water-impact-ground-ripple-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.36, phase: 'water-impact-mist-pop', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
], 2, 1.9)
