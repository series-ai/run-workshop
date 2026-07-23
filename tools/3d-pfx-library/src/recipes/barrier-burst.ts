import { authoredRecipe } from '../constants/01'

export default authoredRecipe('barrier-burst', "Barrier burst", "Particle-first defensive ward: a vertical orbit boundary flashes, breach fragments kick outward, and a short blue haze keeps the shield readable from every angle.", [
  {
    kind: 'particles', role: 'aura', opacity: 0.94, scale: 1.02, phase: 'barrier-burst-particle-orbit-ward',
    tuning: {
      motion: 'orbit-ring', sprite: 'streak', blend: 'alpha', colorOverride: '#63c8ff', ramp: 'held',
      lifecycle: 'barrier-burst-particle-ward', delay: 0, window: 0.28, lifeScale: 0.84,
      countScale: 0.76, speedScale: 0.46, speedJitter: 0.3, drag: 1.25, gravity: 0,
      spawnScale: 1.08, depthScale: 2.8, size: [0.12, 0.36, 0.1], spinScale: 0,
      death: 'erode', turbulenceScale: 0.08,
      referenceSource: 'barrier-burst-shield-shell-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the invisible shell becomes a depth-bearing orbit of short boundary streaks instead of a transparent sphere',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.9, scale: 0.94, phase: 'barrier-burst-particle-breach-fragments',
    tuning: {
      motion: 'impact-burst', sprite: 'twirl', blend: 'additive', colorOverride: '#d9f4ff', ramp: 'pinned-hot',
      lifecycle: 'barrier-burst-particle-ward', delay: 0.1, window: 0.2, lifeScale: 0.52,
      countScale: 0.48, speedScale: 2.8, speedJitter: 0.5, drag: 2.1, gravity: -0.8,
      spawnScale: 0.28, depthScale: 2.8, size: [0.1, 0.28, 0.08], stretch: 0.5,
      spinScale: 1.1, death: 'erode', ease: 'snap', turbulenceScale: 0.03,
      impactVector: [0.6, 0.28, 0.72], spreadAngle: 0.62,
      referenceSource: 'barrier-burst-fractured-shell-and-CC0-shard-sprite-language',
      referenceAdaptation: 'shield cracks become sparse breach fragments that launch from one causal contact instead of a decorative floor ring',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.54, scale: 1.12, phase: 'barrier-burst-particle-ward-haze',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#326a91', ramp: 'held',
      lifecycle: 'barrier-burst-particle-ward', delay: 0.28, window: 0.36, lifeScale: 0.9,
      countScale: 0.42, speedScale: 0.22, speedJitter: 0.42, drag: 1.5, gravity: 0.02,
      spawnScale: 0.76, depthScale: 3.1, size: [0.24, 0.58, 0.48], spinScale: 0.26,
      death: 'erode', turbulenceScale: 0.18, positionOffset: [0, 0.04, 0],
      referenceSource: 'repo-original-barrier-energy-haze-and-CC0-smoke-variants',
      referenceAdaptation: 'the shell afterglow becomes a cool low-density haze that supports the orbit boundary without hiding it',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.25)
