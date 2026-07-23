import { PfxSpriteName } from '../particleSprites'
import type { PfxPreset } from '../types/01'
import type { PfxParticleMotionKind, PfxRenderSurface } from '../types/02'

export function getPfxSpriteForSurface(
  preset: Pick<PfxPreset, 'effectId' | 'controls'>,
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase'>,
  motionKind: PfxParticleMotionKind,
): PfxSpriteName {
  const id = preset.effectId
  const phase = surface.phase ?? ''
  const has = (...names: string[]) => names.some((name) => id.includes(name) || phase.includes(name))

  if (surface.kind === 'impact-sparks') return has('electric', 'lightning', 'shock', 'thunder') ? 'spark' : 'twinkle'
  if (has('electric', 'lightning', 'thunder', 'zap')) return 'spark'
  if (has('fire', 'flame', 'burn', 'ember', 'lava', 'meteor', 'torch')) return motionKind === 'cone-fountain' ? 'flame' : 'fire'
  if (has('smoke', 'dust', 'cloud', 'fog', 'mist', 'poof', 'steam', 'poison', 'gas')) return 'smoke'
  if (has('magic', 'arcane', 'spell', 'rune', 'curse', 'holy', 'summon', 'portal')) {
    // The sun-ray flare only reads at large sizes; small orbiting/falling
    // motes need a compact sparkle.
    return motionKind === 'radial-burst' || motionKind === 'screen-fall' ? 'magic' : 'twinkle'
  }
  if (has('slash', 'blade', 'sword', 'claw')) return 'slash'
  if (has('debris', 'rock', 'shatter', 'break', 'crumble', 'dirt')) return 'debris'
  if (has('sparkle', 'star', 'glitter', 'pickup', 'coin', 'reward', 'loot', 'crit')) return 'sparkle'
  if (has('muzzle', 'gun', 'shot')) return 'muzzle'
  if (has('swirl', 'vortex', 'twirl', 'tornado', 'whirl')) return 'twirl'
  // Generic families deliberately prefer proven CC0 silhouettes from the
  // bundled Kenney atlas. Procedural cells remain for cases where the source
  // pack has no clean primitive (soft glows and single-line streaks).
  if (motionKind === 'drift-cloud') return 'smoke'
  if (motionKind === 'screen-fall') return 'sparkle'
  if (motionKind === 'orbit-ring') return 'rune'
  if (motionKind === 'trail-stream') return 'spark'
  if (motionKind === 'impact-burst') return 'twinkle'
  switch (preset.controls.texture) {
    case 'spark':
      return 'twinkle'
    case 'streak':
      return 'streak'
    case 'ring':
      return 'glow'
    case 'bubble':
      return 'soft'
    case 'square':
      return 'debris'
    default:
      return 'soft'
  }
}
