import { authoredRecipe } from '../constants/01'

// Reward spec LEVEL-UP template: motes gather at the feet (anticipation,
// ~270ms) -> a gold light pillar rises THROUGH the actor (energy-column
// grow envelope is the climax) -> narrow crown streaks fan outward-down as
// the payout. The old flashing column + floating chevrons read as nonsense
// (user round).
export default authoredRecipe('level-up-flare', "Level-up flare", "Level-up ceremony: floor motes gather, an asymmetric gold surge envelops the actor, and crown streaks pay the beat off.", [
  // Anticipation: soft round light moves inward along the floor. The broad
  // XZ distribution makes the beneficiary's footprint legible without a
  // generic ring, while real depth prevents a pasted-on screen halo.
  { kind: 'particles', role: 'aura', opacity: 0.94, scale: 0.96, phase: 'level-up-ground-gather', tuning: { motion: 'converge-center', sprite: 'glow', blend: 'additive', size: [0.3, 0.42, 0.2], colorOverride: '#ffe082', ramp: 'held', delay: 0, window: 0.24, lifeScale: 0.62, countScale: 0.96, speedScale: 1.55, speedJitter: 0.34, spawnScale: 1.75, depthScale: 2.4, spinScale: 0, turbulenceScale: 0.08, gravity: 0 } },
  // Climax: one semantic surface owns a closed tapered body plus offset
  // ribbons/crown geometry in the renderer. The lifecycle grows from the
  // planted base, holds a white-hot crest, then yields to the payout.
  { kind: 'beam-column', role: 'body', opacity: 0.92, scale: 0.88, phase: 'level-up-volumetric-surge', tuning: { widthScale: 3.6, meshShader: 'energy-column', meshMotion: 'charge', lifecycle: 'level-up-surge', colorOverride: '#ffc928', positionOffset: [0, 0.1, 0] } },
  // Resolution: narrow physical streaks fan from the crown, arc outward,
  // then fall. Alpha/pigment preserves gold instead of whitening the whole
  // frame; depth spread makes the payout orbit the actor from side views.
  { kind: 'particles', role: 'impact', opacity: 0.9, scale: 0.92, phase: 'level-up-crown-payout', tuning: { motion: 'cone-fountain', sprite: 'streak', blend: 'alpha', colorOverride: '#ffd45e', ramp: 'pigment', delay: 0.34, window: 0.15, lifeScale: 0.68, countScale: 0.72, speedScale: 2.8, speedJitter: 0.38, drag: 1.25, gravity: -3.2, positionOffset: [0, 0.84, 0], spawnScale: 0.22, depthScale: 2.4, spreadAngle: 0.86, spinScale: 0, stretch: 0.45, turbulenceScale: 0.14, size: [0.18, 0.38, 0.08], death: 'erode' } },
], 2, 1.05)
