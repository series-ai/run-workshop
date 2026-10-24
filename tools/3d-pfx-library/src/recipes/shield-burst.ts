import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shield-burst', 'Shield activation', 'A cyan hex shell expands into place. A bright rim and short surface sparks define the shield volume.', [
  {
    kind: 'shield-shell', role: 'aura', opacity: 0.84, scale: 0.7, phase: 'shield-burst-shell-flash',
    tuning: {
      meshShader: 'hex-shell', meshMotion: 'flash', window: 0.4, startScale: 0.24, colorOverride: '#199ed4',
      material: {
        rim: { power: 1.5, strength: { kind: 'life', values: [0.7, 1, 0] }, color: '#80eaff' },
        dissolve: {
          map: 'noise-a', progress: { kind: 'life', values: [-0.05, 0.15, 1.05] },
          softness: 0.05, edgeWidth: 0.04, edgeColor: '#bcefff',
        },
      },
    },
  },
  {
    kind: 'ring-field', role: 'aura', opacity: 0.74, scale: 0.86, phase: 'shield-burst-energy-latitude',
    tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#65d9f1', delay: 0.04, window: 0.3 },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.5, phase: 'shield-burst-surface-sparks',
    tuning: {
      motion: 'radial-burst', sprite: 'ember', blend: 'additive', colorOverride: '#80eaff', ramp: 'held',
      delay: 0.08, window: 0.14, lifeScale: 0.35, countScale: 0.35, spawnScale: 1.1,
      speedScale: 1.8, drag: 2, size: [0.04, 0.12, 0], stretch: 0.45,
      ease: 'snap', turbulenceScale: 0, spinScale: 0, gravity: 0, death: 'erode',
    },
  },
], 2, 1.3)
