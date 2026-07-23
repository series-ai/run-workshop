import { authoredRecipe } from '../constants/01'

export default authoredRecipe('meteor-burst', 'Meteor burst', 'Particle-first meteor collision: a descending hot contact, a ballistic molten ejecta fan, and a low ash-pressure resolve sell impact without a sculpted collision diorama.', [
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 1.12, phase: 'meteor-burst-particle-descent-contact',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff1b8', ramp: 'pinned-hot',
      lifecycle: 'meteor-burst-particle-collision', delay: 0, window: 0.12, lifeScale: 0.34,
      countScale: 0.42, speedScale: 3.4, speedJitter: 0.44, drag: 2.5, gravity: -0.2,
      spawnScale: 0.08, depthScale: 3, size: [0.22, 0.56, 0.16], spinScale: 0,
      death: 'erode', ease: 'snap', turbulenceScale: 0.02, positionOffset: [0, -0.08, 0],
      referenceSource: 'meteor-burst-impact-diorama-and-CC0-impact-sprite-language',
      referenceAdaptation: 'the faceted collision body becomes a brief white-hot contact pop that yields to the grounded ejecta',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 1, scale: 1.3, phase: 'meteor-burst-particle-molten-ejecta',
    tuning: {
      motion: 'meteor-impact', sprite: 'ember', blend: 'additive', colorOverride: '#ff6a16', ramp: 'hot',
      lifecycle: 'meteor-burst-particle-collision', delay: 0.015, window: 0.58, lifeScale: 0.82,
      countScale: 0.9, speedScale: 3.8, speedJitter: 0.5, drag: 0.38, gravity: -2.8,
      spawnScale: 0.16, spawnLift: 0.04, depthScale: 3.4, size: [0.14, 0.36, 0.1], spinScale: 0.82,
      death: 'erode', ease: 'snap', turbulenceScale: 0.03, impactVector: [0, 1, 0], spreadAngle: 1.05, positionOffset: [0, -0.72, 0],
      randomizeAzimuth: true,
      referenceSource: 'meteor-ring-ballistic-ejecta-and-CC0-ember-sprite-language',
      referenceAdaptation: 'the five-prong mesh crown becomes unequal hot debris arcs with independent depth and gravity-driven fall',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.72, scale: 1.42, phase: 'meteor-burst-particle-ash-resolve',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#744b3b', ramp: 'dark',
      lifecycle: 'meteor-burst-particle-collision', delay: 0.18, window: 0.46, lifeScale: 0.92,
      countScale: 0.56, speedScale: 1.8, speedJitter: 0.44, drag: 1.3, gravity: -0.42,
      spawnScale: 0.68, spawnLift: 0.03, depthScale: 3.4, size: [0.36, 0.82, 0.62], spinScale: 0.3,
      death: 'erode', turbulenceScale: 0.16, positionOffset: [0, -0.76, 0],
      referenceSource: 'meteor-burst-ground-front-and-CC0-smoke-variants',
      referenceAdaptation: 'the broken ground front becomes a low ash-pressure handoff so the meteor resolves into grounded matter',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.4)
