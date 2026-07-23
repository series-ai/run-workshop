import { authoredRecipe } from '../constants/01'

// Screen-space spawn ping: cyan flash pop, reticle pulses, ping flecks
// converge — the HUD 'incoming' annotation, center-safe by construction.
export default authoredRecipe('spawn-screen', 'Spawn screen marker', 'Screen spawn assembly: cyan acquisition bloom, avatar lattice, converging data, and confirmation sparks.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.56, scale: 0.78, phase: 'spawn-screen-acquisition-bloom', tuning: { meshMotion: 'charge', lifecycle: 'spawn-screen-transition', blend: 'additive', colorOverride: '#2bbde8' } },
  { kind: 'ring-field', role: 'screen', opacity: 1, scale: 1.1, phase: 'spawn-screen-avatar-assembly-lattice', tuning: { meshGeometry: 'spawn-screen-reticle', meshMotion: 'charge', lifecycle: 'spawn-screen-transition', ringPurpose: 'glyph', blend: 'additive', colorOverride: '#35d8ff' } },
  { kind: 'particles', role: 'screen', opacity: 1, scale: 1.08, phase: 'spawn-screen-converging-data-fragments', tuning: { motion: 'converge-center', sprite: 'debris', blend: 'additive', lifecycle: 'spawn-screen-transition', colorOverride: '#a8f1ff', ramp: 'pinned-hot', death: 'erode', delay: 0, window: 0.46, lifeScale: 0.78, countScale: 1.4, speedScale: 1.55, speedJitter: 0.18, spawnScale: 1.1, spinScale: 0.18, turbulenceScale: 0, gravity: 0, size: [0.22, 0.38, 0.15] } },
], 2, 1.1)
