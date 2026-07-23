import { authoredRecipe } from '../constants/01'

// A fast electric wake is directional continuity, not crossed ribbon
// cards. The hero surface is one capped forked bolt volume whose shader
// propagates from the mover-facing source and erodes old charge from the
// tail. A compact contact core and sparse shed motes preserve the handoff
// without competing with the single dominant vector.
export default authoredRecipe('electric-trail', 'Electric trail', 'Propagating forked voltage wake with a hot source and clean tail-first dissipation.', [
  { kind: 'tapered-trail', role: 'trail', opacity: 0.94, scale: 1.08, phase: 'electric-trail-propagating-bolt', tuning: { meshShader: 'electric-wake', meshMotion: 'travel', lifecycle: 'electric-trail-propagation', colorOverride: '#087fff' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.58, scale: 0.14, phase: 'electric-trail-source-contact', tuning: { meshMotion: 'glow', lifecycle: 'electric-trail-propagation', colorOverride: '#dff8ff', positionOffset: [0.88, 0, 0] } },
  { kind: 'particles', role: 'trail', opacity: 0.72, scale: 0.54, phase: 'electric-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'glow', blend: 'additive', size: [0.12, 0.2, 0.07], colorOverride: '#71c7ff', ramp: 'held', delay: 0.045, window: 0.14, countScale: 0.26, lifeScale: 0.38, speedScale: 3.4, speedJitter: 0.5, streamSpread: 0.22, spawnOffset: [0.68, 0, 0], spawnScale: 0.08, depthScale: 2.1, turbulenceScale: 0.16, gravity: 0, stretch: 0, spinScale: 0, flicker: 2.8 } },
], 2, 1.6)
