import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rain-burst', 'Rain burst', 'Particle-first wet impact: compact contact flash, uneven jet spray, and retiring ground mist.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 1.18, phase: 'rain-burst-particle-contact-flash',
    tuning: {
      motion: 'impact-burst', sprite: 'splat', blend: 'additive', colorOverride: '#e7fbff', ramp: 'pinned-hot',
      lifecycle: 'rain-burst-particle-impact', delay: 0, window: 0.1, lifeScale: 0.28,
      countScale: 0.55, speedScale: 1.8, speedJitter: 0.28, drag: 2.2, gravity: 0,
      spawnScale: 0.14, depthScale: 2.6, size: [0.32, 0.72, 0.28], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [0, -0.52, 0],
      referenceSource: 'water-burst-droplet-pop-and-CC0-splat-sprite-language',
      referenceAdaptation: 'the closed water-crown mesh becomes a compact additive contact flash at the wet hit point',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 1.24, phase: 'rain-burst-particle-jet-spray',
    tuning: {
      motion: 'cone-fountain', sprite: 'streak', blend: 'alpha', colorOverride: '#7ad4f2', ramp: 'held',
      lifecycle: 'rain-burst-particle-impact', delay: 0.03, window: 0.28, lifeScale: 0.62,
      countScale: 1.05, speedScale: 2.6, speedJitter: 0.58, drag: 0.88, gravity: -2.2,
      spawnScale: 0.2, depthScale: 3.2, size: [0.16, 0.48, 0.16], spinScale: 0.4,
      stretch: 0, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.1,
      positionOffset: [0, -0.42, 0],
      referenceSource: 'rain-burst-water-jets-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the regular mesh lobes become uneven seeded water jets with independent azimuth and depth',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.58, scale: 1.32, phase: 'rain-burst-particle-wet-mist',
    tuning: {
      motion: 'ground-scuff', sprite: 'smoke', blend: 'alpha', colorOverride: '#3e88b0', ramp: 'dark',
      lifecycle: 'rain-burst-particle-impact', delay: 0.14, window: 0.32, lifeScale: 0.88,
      countScale: 0.62, speedScale: 0.48, speedJitter: 0.36, drag: 1.6, gravity: -0.12,
      spawnScale: 0.86, depthScale: 2.8, size: [0.42, 0.92, 0.62], spinScale: 0.22,
      stretch: 0, death: 'erode', turbulenceScale: 0.18, positionOffset: [0, -0.58, 0],
      referenceSource: 'kenney-particle-pack-smoke-as-wet-mist',
      referenceAdaptation: 'soft CC0 smoke cells tinted as cooling ground mist that grows while it fades',
      referenceLicense: 'CC0-1.0',
    },
  },
], 2, 1.18)
