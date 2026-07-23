import { authoredRecipe } from '../constants/01'

export default authoredRecipe('plasma-burst', "Plasma burst", "Charged energy burst with a hot ion core and magnetic ring.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.66, scale: 0.3, phase: 'plasma-burst-ion-core', tuning: { meshMotion: 'flash' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.4, scale: 0.72, phase: 'plasma-burst-magnetic-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'impact', opacity: 0.58, scale: 0.58, phase: 'plasma-burst-energy-flares', tuning: { window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'pinned-hot', spinScale: 1.2, turbulenceScale: 0, sprite: 'fire', gravity: 0, delay: 0.12 } },
], 2, 1.3)
