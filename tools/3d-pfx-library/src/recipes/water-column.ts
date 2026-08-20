import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-column', 'Water column', 'Particle-first geyser: a low wet splash, a narrow rising water body, and light crest foam.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.86, scale: 2.15, phase: 'water-column-particle-ground-splash',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'glow', blend: 'additive', colorOverride: '#bdefff', ramp: 'held',
      lifecycle: 'water-column-particle-eruption', delay: 0, window: 0.18, lifeScale: 0.38,
      countScale: 1.3, speedScale: 2.8, speedJitter: 0.2, drag: 1.6, gravity: 0,
      spawnScale: 1.05, depthScale: 2.2, size: [0.12, 0.26, 0.1], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [0, 0, 0],
      referenceSource: 'water-burst-droplet-pop-and-CC0-splat-sprite-language',
      referenceAdaptation: 'the closed base splash becomes a low wet contact sheet',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.9, scale: 2.65, phase: 'water-column-particle-rise-body',
    tuning: {
      motion: 'column-rise', sprite: 'streak', blend: 'alpha', colorOverride: '#168fd1', ramp: 'held',
      lifecycle: 'water-column-particle-eruption', delay: 0.02, window: 0.68, lifeScale: 1.25,
      countScale: 3.6, speedScale: 9.2, speedJitter: 0.22, drag: 0.82, gravity: 0,
      spawnScale: 0.36, depthScale: 2.3, size: [0.1, 0.34, 0.1], spinScale: 0.12,
      stretch: 0.62, randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.05,
      positionOffset: [0, -0.22, 0],
      referenceSource: 'water-column-braided-streams-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the braided geyser becomes a narrow rising water body',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.42, scale: 1.85, phase: 'water-column-particle-foam-mist',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke', blend: 'alpha', colorOverride: '#bdefff', ramp: 'held',
      lifecycle: 'water-column-particle-eruption', delay: 0.28, window: 0.32, lifeScale: 0.7,
      countScale: 0.55, speedScale: 0.35, speedJitter: 0.22, drag: 1.6, gravity: -0.08,
      spawnScale: 0.55, depthScale: 2.2, size: [0.16, 0.32, 0.22], spinScale: 0.12,
      stretch: 0, death: 'erode', turbulenceScale: 0.1, positionOffset: [0, 0.62, 0],
      referenceSource: 'kenney-particle-pack-smoke-as-geyser-foam',
      referenceAdaptation: 'crest foam stays small and retires before it becomes a cloud',
      referenceLicense: 'CC0-1.0',
    },
  },
], 2, 0.6)
