import { authoredRecipe } from '../constants/01'

export default authoredRecipe('blast-burst', 'Blast burst', 'Particle-first pressure rupture: a hot contact flash, hard radial slugs, and a low pressure front establish force without a disconnected plate mesh.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 0.86, phase: 'blast-burst-particle-pressure-core',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff0bd', ramp: 'pinned-hot',
      lifecycle: 'blast-burst-particle-rupture', delay: 0, window: 0.13, lifeScale: 0.42,
      countScale: 0.3, speedScale: 3.2, speedJitter: 0.42, drag: 2.4, gravity: -0.1,
      spawnScale: 0.08, depthScale: 2.6, size: [0.2, 0.46, 0.16], spinScale: 0,
      stretch: 0.4, death: 'erode', ease: 'snap', turbulenceScale: 0.02, positionOffset: [0, 0.22, 0],
      referenceSource: 'blast-burst-airborne-detonation-and-CC0-impact-sprite-language',
      referenceAdaptation: 'the bright pressure center becomes a short-lived additive particle contact instead of a central block',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.92, scale: 1.02, phase: 'blast-burst-particle-radial-slugs',
    tuning: {
      motion: 'radial-burst', sprite: 'debris', blend: 'alpha', colorOverride: '#b94b1f', ramp: 'pigment',
      lifecycle: 'blast-burst-particle-rupture', delay: 0.015, window: 0.34, lifeScale: 0.7,
      countScale: 0.52, speedScale: 4.1, speedJitter: 0.5, drag: 0.72, gravity: -2.7,
      spawnScale: 0.16, depthScale: 2.9, size: [0.12, 0.3, 0.1], spinScale: 1.2,
      stretch: 0.12, death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [0, 0.22, 0],
      referenceSource: 'blast-burst-pressure-plates-and-CC0-chunk-sprite-language',
      referenceAdaptation: 'hard slugs become uneven seeded debris trajectories with varied speed and depth rather than six repeated plates',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.62, scale: 1.22, phase: 'blast-burst-particle-ground-pressure',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'puff', blend: 'alpha', colorOverride: '#8e6957', ramp: 'dark',
      lifecycle: 'blast-burst-particle-rupture', delay: 0.18, window: 0.42, lifeScale: 0.82,
      countScale: 0.36, speedScale: 2.2, speedJitter: 0.42, drag: 1.3, gravity: -0.5,
      spawnScale: 0.7, spawnLift: 0.02, depthScale: 3.2, size: [0.26, 0.58, 0.42],
      spinScale: 0.26, death: 'erode', turbulenceScale: 0.14, positionOffset: [0, -0.48, 0],
      referenceSource: 'repo-original-pressure-front-and-CC0-puff-sprite-language',
      referenceAdaptation: 'the broken wake is reduced to a grounded pressure/dust handoff that anchors the airborne rupture',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.6)
