import { authoredRecipe } from '../constants/01'

// A critical receipt must stay instantaneous and readable, but spectral
// identity comes from an asymmetric claw silhouette and a cold violet
// material handoff—not the stock radial star + shockwave vocabulary.
export default authoredRecipe('ghost-critical', 'Ghost critical', 'Particle-first spectral rupture: a cold soul tear leads an uneven spectral fan while a violet veil hangs behind the contact and erodes into depth.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 0.92, phase: 'ghost-critical-particle-soul-tear',
    tuning: {
      motion: 'impact-burst', sprite: 'twirl', blend: 'additive', colorOverride: '#e8ffff', ramp: 'pinned-hot',
      lifecycle: 'ghost-critical-particle-haunt', delay: 0, window: 0.16, lifeScale: 0.42,
      countScale: 0.42, speedScale: 3, speedJitter: 0.5, drag: 2.1, gravity: 0,
      spawnScale: 0.08, depthScale: 3.2, stretch: 0.5, spinScale: 0.7, size: [0.1, 0.34, 0.08],
      death: 'erode', ease: 'snap', turbulenceScale: 0.02, impactVector: [1, 0.12, 0.18], spreadAngle: 0.42, positionOffset: [0.02, 0.08, 0.28],
      referenceSource: 'ghost-critical-spectral-talons-and-CC0-twirl-sprite-language',
      referenceAdaptation: 'the talon silhouette becomes a short cold soul tear with a directional contact vector and real depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.92, scale: 1.18, phase: 'ghost-critical-particle-spectral-fan',
    tuning: {
      motion: 'radial-burst', sprite: 'twinkle', blend: 'additive', colorOverride: '#9f7cff', ramp: 'held',
      lifecycle: 'ghost-critical-particle-haunt', delay: 0.035, window: 0.32, lifeScale: 0.72,
      countScale: 0.78, speedScale: 2.4, speedJitter: 0.58, drag: 0.9, gravity: 0.12,
      spawnScale: 0.14, depthScale: 3.4, size: [0.14, 0.42, 0.1], spinScale: 0.7,
      randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.08, positionOffset: [0, 0.08, 0],
      referenceSource: 'ghost-critical-spectral-claw-and-CC0-twinkle-sprite-language',
      referenceAdaptation: 'the repeated claw fingers become an uneven seeded fan of cold spectral glints rather than a rigid mesh silhouette',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.62, scale: 1.22, phase: 'ghost-critical-particle-violet-veil',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#583a84', ramp: 'dark',
      lifecycle: 'ghost-critical-particle-haunt', delay: 0.14, window: 0.5, lifeScale: 1.04,
      countScale: 0.58, speedScale: 0.22, speedJitter: 0.44, drag: 1.45, gravity: 0.04,
      spawnScale: 0.76, spawnLift: 0.04, depthScale: 3.3, size: [0.36, 0.86, 0.64], spinScale: 0.28,
      death: 'erode', turbulenceScale: 0.22, positionOffset: [-0.08, -0.04, 0],
      referenceSource: 'ghost-critical-violet-veil-and-CC0-smoke-variants',
      referenceAdaptation: 'the translucent soul veil becomes delayed drifting spectral residue that preserves the resolution beat from side views',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.1)
