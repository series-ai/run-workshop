import { authoredRecipe } from '../constants/01'

export default authoredRecipe('despawn-burst', "Despawn burst", "Clean entity removal burst with breakup particles and exit ring.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.54, phase: 'despawn-burst-collapse-body', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'particles', role: 'volume', opacity: 0.56, scale: 0.56, phase: 'despawn-burst-breakup-points', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0.8, spinScale: 1.0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.5, scale: 0.58, phase: 'despawn-burst-exit-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.1)
