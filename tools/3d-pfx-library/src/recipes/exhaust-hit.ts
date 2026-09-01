import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-hit', 'Exhaust hit', 'Particle-first engine backfire: hot ignition core, directional flame jet, and a short connected smoke wake.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 1.2, phase: 'exhaust-hit-particle-ignition-core',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff3c4', ramp: 'pinned-hot',
      lifecycle: 'exhaust-hit-particle-backfire', delay: 0, window: 0.08, lifeScale: 0.24,
      countScale: 0.38, speedScale: 1.2, speedJitter: 0.18, drag: 2.4, gravity: 0,
      spawnScale: 0.08, depthScale: 2.2, size: [0.34, 0.7, 0.24], spinScale: 0,
      stretch: 0, death: 'erode', ease: 'snap', turbulenceScale: 0, positionOffset: [0, 0.08, 0],
      referenceSource: 'muzzle-flash-core-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the mechanical nozzle mesh becomes a compact additive ignition flash at the exhaust origin',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.96, scale: 1.34, phase: 'exhaust-hit-particle-flame-jet',
    tuning: {
      motion: 'radial-burst', sprite: 'flame', blend: 'additive', colorOverride: '#ff7a28', ramp: 'pinned-hot',
      lifecycle: 'exhaust-hit-particle-backfire', delay: 0.02, window: 0.16, lifeScale: 0.36,
      countScale: 0.78, speedScale: 3.6, speedJitter: 0.42, drag: 0.9, gravity: 0,
      spawnScale: 0.14, depthScale: 2.8, size: [0.22, 0.64, 0.14], spinScale: 0.25,
      stretch: 0.58, randomizeAzimuth: true, impactVector: [1, 0.08, 0.04], spreadAngle: 0.32,
      death: 'erode', ease: 'snap', turbulenceScale: 0.05, positionOffset: [0.22, 0.08, 0],
      referenceSource: 'kenney-particle-pack-flame-as-exhaust-jet',
      referenceAdaptation: 'the plasma-jet mesh becomes a short wide-base flame fan that dies by scale',
      referenceLicense: 'CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.62, scale: 1.28, phase: 'exhaust-hit-particle-smoke-wake',
    tuning: {
      motion: 'trail-stream', sprite: 'smoke', blend: 'alpha', colorOverride: '#8a6a52', ramp: 'dark',
      lifecycle: 'exhaust-hit-particle-backfire', delay: 0.08, window: 0.28, lifeScale: 0.62,
      countScale: 0.56, speedScale: 1.8, speedJitter: 0.36, drag: 1.35, gravity: 0,
      spawnScale: 0.28, depthScale: 2.6, size: [0.28, 0.7, 0.42], spinScale: 0.2,
      stretch: 0, impactVector: [1, 0.1, 0.08], spreadAngle: 0.34, death: 'erode',
      turbulenceScale: 0.14, positionOffset: [0.36, 0.06, 0],
      referenceSource: 'kenney-particle-pack-smoke-as-thermal-exhaust-wake',
      referenceAdaptation: 'the thin stamped smoke becomes a connected warm wake that grows while it fades',
      referenceLicense: 'CC0-1.0',
    },
  },
], 2, 1.4)
