import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-impact', "Holy impact", "Sacred contact flare with sanctified rays and grace motes.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.95, scale: 0.5, phase: 'holy-impact-sanctified-flare', tuning: { meshMotion: 'flash', colorOverride: '#fff6d8' } },
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.6, phase: 'holy-impact-grace-motes', tuning: { countScale: 0.55, delay: 0.26, window: 0.28, lifeScale: 0.85, ramp: 'held', death: 'erode', speedScale: 0.3, turbulenceScale: 0.4, sprite: 'sparkle', gravity: 1.0, spinScale: 1.2, colorOverride: '#fff2c0' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.75, scale: 0.7, phase: 'holy-impact-halo-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ffe9a3' } },
], 2, 1.8)
