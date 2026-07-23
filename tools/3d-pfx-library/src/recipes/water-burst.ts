import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-burst', "Water burst", "Splash burst with droplets, mist, and a clear surface ring.", [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.36, scale: 0.74, phase: 'water-burst-splash-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'impact', opacity: 0.8, scale: 0.66, phase: 'water-burst-droplet-pop', tuning: { sprite: 'splat', delay: 0.12, window: 0.14, lifeScale: 0.6, size: [1.7, 1.35, 0.45], spinScale: 0.5, countScale: 0.3, speedScale: 1.5, gravity: -2.2, drag: 1.1, stretch: 0, ramp: 'held', death: 'erode', ease: 'snap', turbulenceScale: 0.3, colorOverride: '#5ec8f0' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.48, phase: 'water-burst-mist-puff', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
], 2, 1.25)
