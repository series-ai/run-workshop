import { authoredRecipe } from '../constants/01'

// Mirrors the user-approved acid-burst system (same splash physics and
// layer jobs), recolored: liquids share systems, palettes differ.
export default authoredRecipe('blood-burst', 'Blood burst', 'Visceral liquid splash mirroring the acid system: red splatter sheets, droplet specks, ground mark.', [
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.85,
    scale: 0.85,
    phase: 'blood-splash-splats',
    tuning: { sprite: 'splat', window: 0.05, lifeScale: 0.5, size: [1.9, 1.5, 0.5], spinScale: 0.5, countScale: 0.3, speedScale: 1.6, gravity: -2.6, drag: 1.1, stretch: 0, ramp: 'dark', death: 'erode', ease: 'snap', turbulenceScale: 0.3, colorOverride: '#b5121f', blend: 'alpha' },
  },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.9,
    scale: 0.55,
    phase: 'blood-droplet-specks',
    tuning: { sprite: 'glow', delay: 0.12, window: 0.14, lifeScale: 0.6, size: [0.36, 0.3, 0.1], spinScale: 0, speedScale: 2.2, gravity: -3.6, drag: 0.7, stretch: 0, ramp: 'dark', blend: 'alpha', colorOverride: '#a00e18', ease: 'snap', turbulenceScale: 0 },
  },
  { kind: 'ring-field', role: 'aura', opacity: 0.4, scale: 0.55, phase: 'blood-burst-ground-mark', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#7d0a12' } },
], 2, 1.3)
