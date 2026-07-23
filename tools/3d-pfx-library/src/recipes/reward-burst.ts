import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reward-burst', "Reward burst", "Celebration burst for prizes and completion feedback.", [
  { kind: 'screen-plane', role: 'screen', opacity: 0.78, scale: 0.46, phase: 'reward-burst-screen-prize', tuning: { meshMotion: 'flash', colorOverride: '#fff0a8' } },
  { kind: 'particles', role: 'screen', opacity: 0.96, scale: 0.7, phase: 'reward-burst-confetti-motes', tuning: { delay: 0.14, window: 0.54, lifeScale: 1.2, ease: 'snap', turbulenceScale: 0.25, sprite: 'sparkle', blend: 'additive', colorOverride: '#ffd45e', ramp: 'pinned-hot', gravity: -1.2, spinScale: 1.8, countScale: 1.15, depthScale: 2.2, size: [0.24, 0.56, 0.16], positionOffset: [0, 0.36, 0], randomizeAzimuth: true, referenceSource: 'repo-original-reward-celebration-and-CC0-sparkle-sprite-language', referenceAdaptation: 'the old confetti motes become a seeded celebratory sparkle fan with a single hot flash behind it', referenceLicense: 'repo-original-and-CC0-1.0' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.46, scale: 0.72, phase: 'reward-burst-celebration-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ffc928' } },
], 2, 1.25)
