import { authoredRecipe } from '../constants/01'

export default authoredRecipe('landing-burst', 'Landing burst', 'Particle-first grounded landing: a low pressure puff spreads on contact, grit kicks outward, and a delayed dust bed resolves the weight.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.82, scale: 1.12, phase: 'landing-burst-particle-contact-puff',
    tuning: {
      motion: 'impact-burst', sprite: 'puff', blend: 'alpha', colorOverride: '#9b8a76', ramp: 'dark',
      lifecycle: 'landing-burst-particle-impact', delay: 0, window: 0.16, lifeScale: 0.48,
      countScale: 0.62, speedScale: 2.1, speedJitter: 0.44, drag: 1.6, gravity: -0.24,
      spawnScale: 0.2, spawnLift: 0.02, depthScale: 3.2, size: [0.28, 0.64, 0.5], spinScale: 0.3,
      death: 'erode', ease: 'snap', turbulenceScale: 0.12, positionOffset: [0, -0.82, 0],
      referenceSource: 'landing-burst-dust-puff-and-CC0-puff-sprite-language',
      referenceAdaptation: 'the cloud mesh becomes a low contact puff whose depth spread communicates weight from side views',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.78, scale: 1.18, phase: 'landing-burst-particle-pressure-fan',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'streak', blend: 'alpha', colorOverride: '#c1ad90', ramp: 'pigment',
      lifecycle: 'landing-burst-particle-impact', delay: 0.025, window: 0.32, lifeScale: 0.68,
      countScale: 0.58, speedScale: 2.8, speedJitter: 0.5, drag: 0.86, gravity: -1.2,
      spawnScale: 0.24, spawnLift: 0.02, depthScale: 3.2, size: [0.1, 0.34, 0.08], spinScale: 0.5,
      randomizeAzimuth: true, death: 'erode', ease: 'snap', turbulenceScale: 0.04, positionOffset: [0, -0.84, 0],
      referenceSource: 'landing-burst-pressure-ring-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the ring becomes an uneven low pressure fan that breaks instead of reading as a perfect circular boundary',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.5, scale: 1.2, phase: 'landing-burst-particle-ground-grit',
    tuning: {
      motion: 'ground-scuff', sprite: 'debris', blend: 'alpha', colorOverride: '#6f5d4e', ramp: 'dark',
      lifecycle: 'landing-burst-particle-impact', delay: 0.14, window: 0.42, lifeScale: 0.82,
      countScale: 0.48, speedScale: 2.2, speedJitter: 0.46, drag: 1.1, gravity: -2.7,
      spawnScale: 0.42, spawnLift: 0.01, depthScale: 3.2, size: [0.08, 0.2, 0.06], spinScale: 0.8,
      death: 'erode', turbulenceScale: 0.02, positionOffset: [0, -0.86, 0],
      referenceSource: 'landing-burst-ground-grit-and-CC0-debris-sprite-language',
      referenceAdaptation: 'small grit replaces the decorative ring and gives the landing a delayed physical resolution',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.35)
