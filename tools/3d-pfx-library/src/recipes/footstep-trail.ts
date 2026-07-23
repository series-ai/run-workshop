import { authoredRecipe } from '../constants/01'

export default authoredRecipe('footstep-trail', 'Footstep trail', 'Tiny repeatable traversal trail with heel puffs and grit.', [
  { kind: 'footprint-decal', role: 'trail', opacity: 0.75, scale: 1.1, phase: 'footstep-trail-ground-footprints', tuning: { colorOverride: '#9a7a3d' } },
  { kind: 'particles', role: 'impact', opacity: 0.85, scale: 0.5, phase: 'footstep-trail-ground-step-dust', tuning: { motion: 'ground-scuff', sprite: 'debris', blend: 'alpha', colorOverride: '#d8c8a8', ramp: 'held', death: 'erode', delay: 0.05, window: 0.5, lifeScale: 0.5, countScale: 0.3, speedScale: 1.2, speedJitter: 0.5, spinScale: 0.9, gravity: -2.4, turbulenceScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.42, phase: 'footstep-trail-ground-settle-puffs', tuning: { sprite: 'puff', blend: 'alpha', colorOverride: '#9a7a3d', ramp: 'held', death: 'erode', delay: 0.3, window: 0.5, lifeScale: 0.7, countScale: 0.1, speedScale: 0.3, turbulenceScale: 0.3, gravity: 0.3 } },
], 2, 1.6)
