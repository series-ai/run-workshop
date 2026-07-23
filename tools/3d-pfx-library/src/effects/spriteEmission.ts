import * as THREE from 'three'
import { PFX_FIREBALL_FLIPBOOK_ATLAS } from '../fireballFlipbook'
import { PFX_FLAME_FLIPBOOK_ATLAS } from '../flameFlipbook'
import { getPfxStyleRenderProfile } from '../constants/01'
import { PFX_SPRITE_PARTICLE_VERTEX, getPfxParticleShapeProfile, getPfxSharedFireballFlipbookTexture, getPfxSharedFlameFlipbookTexture, getPfxSharedSpriteAtlasTexture } from '../constants/04'
import { PFX_SPRITE_PARTICLE_FRAGMENT } from '../constants/05'
import { getPfxParticleColorRamp } from './particleColor'
import { getPfxSpriteVariantLayout } from './spriteVariant'
import type { PfxControls } from '../types/01'
import type { PfxParticleEmission, PfxRenderSurface, PfxSurfaceMaterialProps } from '../types/02'

export function createPfxSpriteEmissionMaterial(
  emission: PfxParticleEmission,
  controls: PfxControls,
  surface: PfxRenderSurface,
  materialProps: PfxSurfaceMaterialProps,
  feelVersion = 2,
  cycleScale = 1,
  tempo = 1,
): THREE.ShaderMaterial {
  const tuning = surface.tuning
  const flipbookAtlas = tuning?.flipbookAtlas === PFX_FIREBALL_FLIPBOOK_ATLAS.id
    ? PFX_FIREBALL_FLIPBOOK_ATLAS
    : PFX_FLAME_FLIPBOOK_ATLAS
  const usesAuthoredFlipbook = tuning?.flipbookAtlas === flipbookAtlas.id
  const animatesAuthoredFlipbook = usesAuthoredFlipbook && controls.flipbook !== 'none'
  const shape = getPfxParticleShapeProfile(emission.motionKind)
  const ramp = getPfxParticleColorRamp(controls, surface)
  const rampStyle =
    tuning?.ramp ??
    (emission.motionKind === 'orbit-ring' || emission.motionKind === 'drift-cloud' ? 'held' : 'hot')
  const mixStops = (from: [number, number, number], to: [number, number, number], amount: number): [number, number, number] => [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]
  if (rampStyle === 'held') {
    // Long-lived motes hold near the base tint; a full hot→dark sweep at
    // orbit/drift timescales reads as flicker. Tail stays AT the tint — any
    // darkening reads as the layer dying dirty instead of fading bright.
    ramp.hot = mixStops(ramp.base, ramp.hot, 0.45)
    ramp.tail = mixStops(ramp.base, ramp.tail, 0.1)
  } else if (rampStyle === 'pinned-hot') {
    // Cores never darken — they vanish while still bright.
    ramp.tail = mixStops(ramp.base, ramp.hot, 0.35)
  } else if (rampStyle === 'pigment') {
    // Saturated matter (blood, mud, slime gobs): the tint IS the read. Body
    // stays at the authored color; only a slight lit birth and a darker
    // death. Exempt from the alpha brightness lift below — the lift turns
    // deep pigments into pastel (blood rendered salmon, user-caught).
    ramp.hot = mixStops(ramp.base, [1, 1, 1], 0.22)
    ramp.tail = mixStops(ramp.base, [0.05, 0.02, 0.02], 0.35)
  } else if (rampStyle === 'dark') {
    // Matter family: desaturated, genuinely dark body — this layer exists to
    // give bright additive effects value contrast. Without the grey pull the
    // palette tint leaked through as bright khaki (round-5 fireball wake).
    const grey = (stop: [number, number, number], amount: number, level: number): [number, number, number] => {
      const luma = (stop[0] * 0.299 + stop[1] * 0.587 + stop[2] * 0.114) * level
      return [stop[0] + (luma - stop[0]) * amount, stop[1] + (luma - stop[1]) * amount, stop[2] + (luma - stop[2]) * amount]
    }
    ramp.hot = grey(mixStops(ramp.base, ramp.hot, 0.3), 0.6, 0.9)
    ramp.base = grey(ramp.base, 0.7, 0.72)
    ramp.tail = grey(mixStops(ramp.base, ramp.tail, 0.5), 0.8, 0.4)
  }
  if (materialProps.blending === 'additive' && (rampStyle === 'hot' || rampStyle === 'pinned-hot')) {
    // Additive ramps never darken into the tail: RGB lerping down through
    // low-sat tans reads as olive/khaki death (round-15). Die at locked hue;
    // alpha owns the exit.
    ramp.tail = mixStops(ramp.tail, ramp.base, rampStyle === 'hot' ? 0.7 : 1)
  }
  if (materialProps.blending !== 'additive' && rampStyle !== 'dark' && rampStyle !== 'pigment') {
    // Alpha-blended smoke/dust reads against dark scenes only when the whole
    // ramp stays in the bright half. 'dark' layers opt out — they ARE the
    // value contrast.
    const lift = (stop: [number, number, number], amount: number): [number, number, number] =>
      [stop[0] + (1 - stop[0]) * amount, stop[1] + (1 - stop[1]) * amount, stop[2] + (1 - stop[2]) * amount]
    ramp.hot = lift(ramp.hot, 0.45)
    ramp.base = lift(ramp.base, 0.52)
    ramp.tail = lift(ramp.tail, 0.6)
  }
  if (usesAuthoredFlipbook) {
    // The authored sheet already contains its white-hot-to-red temperature
    // ramp. Keep customization as a restrained glaze instead of multiplying
    // the source back into a flat red silhouette.
    const white: [number, number, number] = [1, 1, 1]
    ramp.hot = mixStops(white, ramp.hot, 0.08)
    ramp.base = mixStops(white, ramp.base, 0.22)
    ramp.tail = mixStops(white, ramp.tail, 0.3)
  }
  const variantLayout = getPfxSpriteVariantLayout(emission.sprite)
  const styleProfile = getPfxStyleRenderProfile(controls.style)
  const defines: Record<string, boolean> = {}
  if (emission.emissionWindow < 1) defines.BURST = true
  if (emission.motionKind === 'orbit-ring') defines.MOTION_ORBIT = true
  if (emission.motionKind === 'ground-ring') defines.MOTION_GROUND_RING = true
  if (emission.motionKind === 'healing-spiral') defines.MOTION_HEALING_SPIRAL = true
  if (emission.motionKind === 'helix-trail') defines.MOTION_HELIX_TRAIL = true
  if (emission.motionKind === 'danger-pulse') defines.MOTION_DANGER_PULSE = true
  if (emission.motionKind === 'shockwave-ground-burst') defines.MOTION_SHOCKWAVE_GROUND = true
  if (emission.motionKind === 'dust-loop') defines.MOTION_DUST_LOOP = true
  if (emission.motionKind === 'beam-telegraph-flow') defines.MOTION_BEAM_TELEGRAPH_FLOW = true
  if (emission.motionKind === 'laser-spray-ricochet') defines.MOTION_LASER_SPRAY_RICOCHET = true
  if (emission.motionKind === 'asymmetric-converge') defines.MOTION_FLAME_CHARGE_GATHER = true
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      // tempo pre-multiplies the clock: the whole effect time-lapses
      // uniformly (motion, spin, wobble, beats) per the recipe's tempo.
      uTiming: { value: Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo) },
      uLifetime: { value: Math.max(0.25, controls.lifetime) },
      uGravity: { value: controls.gravity * 0.85 * controls.scale + (tuning?.gravity ?? 0) * controls.scale },
      uTurbulence: { value: Math.max(0, controls.turbulence) * controls.scale },
      uSize: {
        value:
          0.44 *
          controls.scale *
          styleProfile.particleSizeMultiplier *
          (1 + controls.emissiveBloom * 0.2) *
          surface.scale,
      },
      uEmissionWindow: { value: emission.emissionWindow },
      uDelay: { value: tuning?.delay ?? 0 },
      uDrag: { value: tuning?.drag ?? 0 },
      uSizeRange: {
        value: tuning?.size
          ? new THREE.Vector2(tuning.size[0], tuning.size[2])
          : new THREE.Vector2(shape.sizeFrom, shape.sizeTo),
      },
      uSizeMid: { value: tuning?.size ? tuning.size[1] : (shape.sizeFrom + shape.sizeTo) / 2 },
      uFadeWindow: { value: new THREE.Vector2(shape.fadeIn, shape.fadeOut) },
      uStretch: { value: tuning?.stretch ?? shape.stretch },
      uAdditiveShrink: { value: materialProps.blending === 'additive' ? 1 : 0 },
      uAtlas: {
        value: usesAuthoredFlipbook
          ? flipbookAtlas.id === PFX_FIREBALL_FLIPBOOK_ATLAS.id
            ? getPfxSharedFireballFlipbookTexture()
            : getPfxSharedFlameFlipbookTexture()
          : getPfxSharedSpriteAtlasTexture(),
      },
      // 5% inset: hot texels at cell borders render hard rectangle edges.
      uUvOffset: {
        value: usesAuthoredFlipbook
          ? new THREE.Vector2(0, (flipbookAtlas.rows - 1) / flipbookAtlas.rows)
          : variantLayout.offset.clone().addScaledVector(variantLayout.cellScale, 0.05),
      },
      uUvScale: {
        value: usesAuthoredFlipbook
          ? new THREE.Vector2(1 / flipbookAtlas.columns, 1 / flipbookAtlas.rows)
          : variantLayout.cellScale.clone().multiplyScalar(0.9),
      },
      uUvCellStep: { value: variantLayout.cellScale },
      uVariantCount: { value: usesAuthoredFlipbook ? 1 : variantLayout.count },
      uVariantColumns: { value: variantLayout.columns },
      uVariantStartIndex: { value: variantLayout.startIndex },
      uVariantRowDirection: { value: variantLayout.rowDirection },
      uFlipbookColumns: { value: flipbookAtlas.columns },
      uFlipbookRows: { value: flipbookAtlas.rows },
      uFlipbookFrameCount: { value: animatesAuthoredFlipbook ? flipbookAtlas.frameCount : 1 },
      uFlipbookFrameRate: { value: animatesAuthoredFlipbook ? 22 : 0 },
      // FireBall01 contains useful luminance structure but its white center
      // clips when several camera-facing cards overlap. Grade that heat into
      // a bounded red/orange/gold palette and use normal alpha compositing;
      // the separate gather motes still provide additive energy sparkle.
      uFlipbookTemperatureGrade: {
        value: usesAuthoredFlipbook && flipbookAtlas.id === PFX_FIREBALL_FLIPBOOK_ATLAS.id ? 1 : 0,
      },
      uFlipbookTurbulentCells: {
        value: usesAuthoredFlipbook && flipbookAtlas.id === PFX_FIREBALL_FLIPBOOK_ATLAS.id ? 1 : 0,
      },
      uSpriteAspect: {
        value: usesAuthoredFlipbook
          ? (flipbookAtlas.width / flipbookAtlas.columns) /
            (flipbookAtlas.height / flipbookAtlas.rows)
          : 1,
      },
      uColorHot: { value: new THREE.Vector3(...ramp.hot) },
      uColorBase: { value: new THREE.Vector3(...ramp.base) },
      uColorTail: { value: new THREE.Vector3(...ramp.tail) },
      uOpacity: {
        value: Math.min(1, materialProps.opacity * (materialProps.blending === 'additive' ? 1.5 : 1.35)),
      },
      uAlphaGamma: {
        value: tuning?.alphaGamma ?? (materialProps.blending === 'additive' ? 1 : emission.motionKind === 'dust-loop' ? 0.82 : 0.72),
      },
      uSpriteColorMix: {
        value: usesAuthoredFlipbook || materialProps.blending === 'additive'
          ? 1
          : tuning?.spriteColorMix ??
            (emission.motionKind === 'dust-loop'
            ? 0.8
            : 0.3),
      },
      uTailSnap: { value: 1.3 },
      uAdditiveShrinkF: { value: materialProps.blending === 'additive' ? 1 : 0 },
      uSnapEase: { value: tuning?.ease === 'snap' ? 1 : 0 },
      uBands: { value: tuning?.bands ?? 0 },
      uErode: { value: tuning?.death === 'erode' ? 1 : 0 },
      uTurbulenceScale: { value: tuning?.turbulenceScale ?? 1 },
      uSpawnLift: { value: tuning?.spawnLift ?? 0 },
      uFlicker: { value: tuning?.flicker ?? 0 },
      uFreshness: { value: feelVersion >= 2 ? 1 : 0 },
      uCycleScale: { value: cycleScale },
    },
    defines,
    vertexShader: PFX_SPRITE_PARTICLE_VERTEX,
    fragmentShader: PFX_SPRITE_PARTICLE_FRAGMENT,
    transparent: true,
    blending: materialProps.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  })
  if (usesAuthoredFlipbook) {
    material.userData['pfxFlipbookAtlas'] = flipbookAtlas.id
    material.userData['pfxFlipbookLicense'] = flipbookAtlas.license
    material.userData['pfxFlipbookReducedMotion'] = animatesAuthoredFlipbook ? 'animated' : 'frozen-first-frame'
  }
  if (surface.phase === 'flame-charge-braided-fire-convergence') {
    material.userData['pfxFlameChargeGather'] = 'three-continuous-converging-lanes'
  }
  return material
}
