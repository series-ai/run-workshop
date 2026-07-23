import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dash-loop', 'Dash loop', 'Movement speed loop with afterimage haze and origin motes.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'dash-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#2f9dff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'dash-loop-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#2f9dff', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'dash-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#2f9dff' } },
], 2, 0.95)
