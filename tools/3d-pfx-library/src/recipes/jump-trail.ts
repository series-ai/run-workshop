import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-trail', 'Jump trail', 'Vertical lift trail with takeoff stream and pad motes.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.7, phase: 'jump-trail-speed-ribbon', tuning: { motion: 'trail-stream', sprite: 'streak', stretch: 1.8, colorOverride: '#5ac8ff', ramp: 'held', countScale: 0.6, speedScale: 7, speedJitter: 0.4, streamSpread: 0.08, spinScale: 0, turbulenceScale: 0, gravity: 0 } },
  { kind: 'particles', role: 'impact', opacity: 0.85, scale: 0.45, phase: 'jump-trail-origin-kick', tuning: { motion: 'radial-burst', sprite: 'puff', blend: 'alpha', colorOverride: '#8a92a0', ramp: 'held', window: 0.1, lifeScale: 0.4, ease: 'snap', countScale: 0.15, speedScale: 0.8, spawnScale: 0.3, spawnOffset: [0.7, -0.2, 0], turbulenceScale: 0.2, gravity: 0.3 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.4, phase: 'jump-trail-speedline-flecks', tuning: { sprite: 'sparkle', colorOverride: '#eaf8ff', ramp: 'held', delay: 0.2, window: 0.5, lifeScale: 0.6, countScale: 0.12, speedScale: 0.5, turbulenceScale: 0.2, gravity: 0 } },
], 2, 2.0)
