import { authoredRecipe } from '../constants/01'

// Production standard §2: an idle alert breathes, it does not strobe — the
// disc inhales/exhales while hot spark ticks fire on the danger pulse.
export default authoredRecipe('warning-idle', 'Warning idle', 'Warning idle with alert breath and tick particles.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.6, scale: 0.75, phase: 'warning-idle-alert-breath', tuning: { meshMotion: 'breathe', blend: 'alpha', colorOverride: '#ff5500', flicker: 1.2, positionOffset: [0, -0.7, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.58, phase: 'warning-idle-tick-particles', tuning: { sprite: 'spark', blend: 'additive', size: [0.36, 0.5, 0.26], colorOverride: '#ff8a3d', ramp: 'hot', countScale: 0.3, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.1, motion: 'danger-pulse', gravity: 0, spinScale: 0, flicker: 1.8 } },
], 2, 1.7)
