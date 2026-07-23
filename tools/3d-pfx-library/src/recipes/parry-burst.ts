import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-burst', "Parry burst", "Fast combat timing confirm with a compact contact star.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.84, scale: 0.62, phase: 'parry-burst-contact-star', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'pinned-hot', spinScale: 0, turbulenceScale: 0, sprite: 'streak', stretch: 2.4, bands: 3, gravity: 0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.38, scale: 0.66, phase: 'parry-burst-timing-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'impact', opacity: 0.52, scale: 0.46, phase: 'parry-burst-metal-flecks', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'debris', blend: 'alpha', gravity: -3.5, spinScale: 1.1, ramp: 'dark' } },
], 2, 1.45)
