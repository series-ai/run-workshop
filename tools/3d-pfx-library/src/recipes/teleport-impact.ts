import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-impact', "Teleport impact", "Arrival contact with pop ring, shimmer, and anchor sparks.", [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.56, phase: 'teleport-impact-arrival-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.46, scale: 0.5, phase: 'teleport-impact-anchor-sparks', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0.4 } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.34, phase: 'teleport-impact-shimmer-puff', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
], 2, 2.0)
