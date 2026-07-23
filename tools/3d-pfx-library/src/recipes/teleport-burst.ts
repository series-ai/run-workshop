import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-burst', "Teleport burst", "Arrival/departure confirmation with compact spatial afterimage.", [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.42, scale: 0.68, phase: 'teleport-burst-arrival-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'core-sphere', role: 'screen', opacity: 0.6, scale: 0.34, phase: 'teleport-burst-afterimage-slice', tuning: { meshMotion: 'glow', colorOverride: '#7fd8ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.56, scale: 0.52, phase: 'teleport-burst-space-flecks', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0.5, spinScale: 1.2 } },
], 2, 1.35)
