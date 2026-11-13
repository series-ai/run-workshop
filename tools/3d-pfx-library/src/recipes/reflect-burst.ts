import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reflect-burst', 'Reflect burst', 'A hot contact opens a short soft impact fan. An incoming streak turns into clear return motion.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.94, scale: 1.15, phase: 'reflect-burst-parry-fan', tuning: { referenceSource: 'repo-original/reflectBurstRebound', referenceAdaptation: 'Original compact contact and wide soft impact crescent with dark cuts.', referenceLicense: 'repo-original', meshShader: 'reflect-burst-parry-fan', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.94, scale: 1.15, phase: 'reflect-burst-return-streaks', tuning: { referenceSource: 'repo-original/reflectBurstRebound', referenceAdaptation: 'Original incoming streak and contact-driven return particles.', referenceLicense: 'repo-original', meshShader: 'reflect-burst-return-streaks', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.45)
