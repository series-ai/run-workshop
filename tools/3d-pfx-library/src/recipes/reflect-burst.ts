import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reflect-burst', "Reflect burst", "Parry/reflect burst with return wave and defensive shards.", [
  { kind: 'shield-shell', role: 'aura', opacity: 0.65, scale: 0.62, phase: 'reflect-burst-shell-kick', tuning: { meshMotion: 'flash' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.46, scale: 0.88, phase: 'reflect-burst-return-wave', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.64, scale: 0.54, phase: 'reflect-burst-parry-shards', tuning: { window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'pinned-hot', spinScale: 1.1, turbulenceScale: 0, sprite: 'twirl', gravity: -2.8, delay: 0.12 } },
], 2, 1.45)
