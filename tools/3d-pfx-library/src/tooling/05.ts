import * as THREE from 'three'
import { getPfxStyleRenderProfile } from '../constants/01'
import { roundMetric } from '../constants/03'
import { PFX_BURST_CYCLE_MULTIPLIER, createPfxFlameBurstRuntimeState } from '../constants/04'
import { createPfxAcidBurstLifecycle } from '../effects/acidBurst'
import { createPfxAcidIdleLifecycle } from '../effects/acidIdle'
import { createPfxAcidSpawnLifecycle } from '../effects/acidSpawn'
import { createPfxBlastBeamLifecycle } from '../effects/blastBeam'
import { createPfxBloodDeathLifecycle } from '../effects/bloodDeath'
import { createPfxCurseBurstLifecycle } from '../effects/curseBurst'
import { createPfxCurseColumnLifecycle } from '../effects/curseColumn'
import { createPfxCurseConeLifecycle } from '../effects/curseCone'
import { getPfxCycleScale } from '../effects/cycleScale'
import { createPfxDespawnImpactLifecycle } from '../effects/despawnImpact'
import { createPfxElectricTrailLifecycle } from '../effects/electricTrail'
import { createPfxGhostTrailLifecycle } from '../effects/ghostTrail'
import { createPfxGlyphRingLifecycle } from '../effects/glyphRing'
import { createPfxGlyphTrailLifecycle } from '../effects/glyphTrail'
import { createPfxHealingBurstLifecycle } from '../effects/healingBurst'
import { createPfxHealingLoopLifecycle } from '../effects/healingLoop'
import { createPfxHealingRestorationPulse } from '../effects/healingRestorationPulse'
import { createPfxHeldProjectileLifecycle } from '../effects/heldProjectile'
import { createPfxHologramAuraLifecycle } from '../effects/hologramAura'
import { createPfxHolyBurstLifecycle } from '../effects/holyBurst'
import { createPfxHolyReleaseLifecycle } from '../effects/holyRelease'
import { createPfxJumpPickupLifecycle } from '../effects/jumpPickup'
import { createPfxLeafBurstLifecycle } from '../effects/leafBurst'
import { createPfxLevelUpSurgeLifecycle } from '../effects/levelUpSurge'
import { createPfxMudBurstLifecycle } from '../effects/mudBurst'
import { createPfxMudChargeLifecycle } from '../effects/mudCharge'
import { createPfxPetalAmbientLifecycle } from '../effects/petalAmbient'
import { createPfxPetalBurstLifecycle } from '../effects/petalBurst'
import { createPfxPoisonBurstLifecycle } from '../effects/poisonBurst'
import { createPfxPortalChargeLifecycle } from '../effects/portalCharge'
import { createPfxPortalTelegraphLifecycle } from '../effects/portalTelegraph'
import { createPfxRainBurstLifecycle } from '../effects/rainBurst'
import { createPfxRewardTelegraphLifecycle } from '../effects/rewardTelegraph'
import { createPfxSandBurstLifecycle } from '../effects/sandBurst'
import { createPfxSandSprayLifecycle } from '../effects/sandSpray'
import { createPfxShadowBreakLifecycle } from '../effects/shadowBreak'
import { createPfxShadowBurstLifecycle } from '../effects/shadowBurst'
import { createPfxSlimeBurstLifecycle } from '../effects/slimeBurst'
import { createPfxSlimeRingLifecycle } from '../effects/slimeRing'
import { createPfxSnowBurstLifecycle } from '../effects/snowBurst'
import { createPfxSnowIdleLifecycle } from '../effects/snowIdle'
import { createPfxSpawnScreenLifecycle } from '../effects/spawnScreen'
import { createPfxTeleportHitLifecycle } from '../effects/teleportHit'
import { createPfxWaterColumnLifecycle } from '../effects/waterColumn'
import { createPfxWaterConeLifecycle } from '../effects/waterCone'
import { createPfxWindBeamLifecycle } from '../effects/windBeam'
import { createPfxWindBurstLifecycle } from '../effects/windBurst'
import { createPfxWindImpactLifecycle } from '../effects/windImpact'
import { getPfxRenderPlan } from './01'
import { createPfxSparkGapLoopState } from './04'
import type { PfxControls, PfxPreset } from '../types/01'
import type { PfxRenderSurface, PfxSurfaceAnimationProps } from '../types/02'

export function getPfxSurfaceAnimationProps(
  surface: PfxRenderSurface,
  controls: Pick<PfxControls, 'timing' | 'turbulence' | 'velocity' | 'gravity' | 'lifetime' | 'style'>,
  elapsedSeconds: number,
  cycleScale = 1,
  tempo = 1,
  feelVersion = 2,
): PfxSurfaceAnimationProps {
  const styleProfile = getPfxStyleRenderProfile(controls.style)
  const t = elapsedSeconds * controls.timing * styleProfile.motionMultiplier
  const meshMotion = surface.tuning?.meshMotion
  if (surface.tuning?.lifecycle === 'flame-charge-compress') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const smooth = (value: number) => {
      const clamped = THREE.MathUtils.clamp(value, 0, 1)
      return clamped * clamped * (3 - 2 * clamped)
    }
    const energy = cycle < 0.18
      ? 0.6 + smooth(cycle / 0.18) * 0.4
      : cycle < 0.52
        ? 1
        : cycle < 0.64
          ? 0.62 + (1 - smooth((cycle - 0.52) / 0.12)) * 0.38
          : cycle < 0.66
            ? 0.62 * (1 - smooth((cycle - 0.64) / 0.02))
            : 0
    return {
      rotationZ: roundMetric(cycle * Math.PI * 0.24),
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric(0.18 + energy * 1.14),
      opacityMultiplier: roundMetric(energy),
      signature: `flame-charge-compress:${surface.phase ?? surface.role}`,
    }
  }
  if (surface.tuning?.lifecycle === 'jump-pickup-launch') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxJumpPickupLifecycle(cycle)
    const isCradle = surface.tuning?.meshGeometry === 'jump-pickup-launch-cradle'
    const isApex = surface.phase?.includes('reward-apex') ?? false
    const scaleMultiplier = isCradle
      ? lifecycle.compression
      : isApex
        ? 0.42 + lifecycle.energy * 0.82
        : 0.54 + lifecycle.energy * 0.52
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: isApex ? lifecycle.height : isCradle ? 0 : lifecycle.height * 0.16,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(scaleMultiplier),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(Math.pow(lifecycle.energy, 1.35)),
      signature: `jump-pickup:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'spawn-screen-transition') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxSpawnScreenLifecycle(cycle)
    const isReticle = surface.tuning?.meshGeometry === 'spawn-screen-reticle'
    const isBloom = surface.kind === 'screen-plane'
    const isSeed = surface.phase?.includes('materialization-seed') ?? false
    const surfaceScale = isReticle
      ? lifecycle.aperture
      : isBloom
        ? 0.34 + lifecycle.energy * 0.76
        : isSeed
          ? 0.38 + lifecycle.energy * 0.7
          : 0.52 + lifecycle.energy * 0.56
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(surfaceScale),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(Math.pow(lifecycle.energy, 1.45)),
      signature: `spawn-screen:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'curse-column-binding') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxCurseColumnLifecycle(cycle)
    const isSeal = surface.kind === 'magic-circle'
    const isCrown = surface.phase?.includes('crown') ?? false
    const surfaceScale = isSeal
      ? 0.45 + lifecycle.scale * 0.55
      : isCrown
        ? 0.28 + lifecycle.energy * 0.78
        : surface.kind === 'particles'
          ? 0.38 + lifecycle.energy * 0.62
          : lifecycle.scale
    const opacity = isCrown
      ? Math.pow(THREE.MathUtils.clamp((lifecycle.energy - 0.45) / 0.55, 0, 1), 1.2)
      : lifecycle.stage === 'collapse'
        ? Math.pow(lifecycle.energy, 1.35)
        : lifecycle.energy * lifecycle.energy
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: isCrown ? roundMetric((lifecycle.scale - 1) * 0.08) : 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(surfaceScale),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(opacity),
      signature: `curse-column:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'sand-spray-burst') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxSandSprayLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.28 + lifecycle.spread * 0.72),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(lifecycle.energy * lifecycle.energy),
      signature: `sand-spray:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'water-cone-surge') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxWaterConeLifecycle(cycle)
    const isSheet = surface.kind === 'water-cone-sheet'
    return {
      rotationZ: 0,
      xOffset: isSheet ? roundMetric((lifecycle.reach - 1) * 1.02) : 0,
      yOffset: 0,
      scaleMultiplier: isSheet ? lifecycle.reach : roundMetric(0.4 + lifecycle.energy * 0.72),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(lifecycle.energy * lifecycle.energy),
      signature: `water-cone:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'glyph-ring-inscription') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxGlyphRingLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : lifecycle.scale,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(lifecycle.energy * lifecycle.energy),
      signature: `glyph-ring:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'blast-beam-sustain') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxBlastBeamLifecycle(cycle)
    const isBeam = surface.kind === 'beam-column'
    return {
      rotationZ: 0,
      // Directed beam geometry runs from local -Y (source) to +Y (target)
      // and is rotated onto world +X by the renderer. Counter-translation
      // keeps the source planted while uniform reach grows toward the target.
      xOffset: isBeam ? roundMetric((lifecycle.reach - 1) * 1.05) : 0,
      yOffset: 0,
      scaleMultiplier: isBeam ? lifecycle.reach : roundMetric(0.28 + lifecycle.energy * 0.82),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.08 + lifecycle.energy * 0.92),
      signature: `blast-beam:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'hologram-aura-loop') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxHologramAuraLifecycle(cycle)
    const glitchSign = Math.sin(cycle * Math.PI * 34) >= 0 ? 1 : -1
    return {
      rotationZ: 0,
      xOffset: lifecycle.stage === 'glitch' ? roundMetric(glitchSign * (1 - lifecycle.energy) * 0.055) : 0,
      yOffset: lifecycle.stage === 'glitch' ? roundMetric(-glitchSign * (1 - lifecycle.energy) * 0.025) : 0,
      scaleMultiplier: lifecycle.scale,
      opacityMultiplier: roundMetric(0.22 + lifecycle.energy * 0.78),
      signature: `hologram-aura:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'reward-telegraph-beacon') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxRewardTelegraphLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.scale,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.06 + lifecycle.energy * 0.94),
      signature: `reward-telegraph:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'portal-charge-aperture') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxPortalChargeLifecycle(cycle)
    const isFace = surface.tuning?.meshShader === 'vortex-swirl'
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric((isFace ? 0.42 : 0.55) + lifecycle.aperture * (isFace ? 0.64 : 0.48)),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.48 + lifecycle.energy * 0.52),
      signature: `portal-charge:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'acid-idle-boil') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const lifecycle = createPfxAcidIdleLifecycle(elapsedSeconds * timeScale)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: roundMetric(lifecycle.energy * 0.015),
      scaleMultiplier: roundMetric(0.84 + lifecycle.energy * 0.18),
      opacityMultiplier: roundMetric(0.6 + lifecycle.energy * 0.4),
      signature: `acid-idle:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'wind-impact-shear') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxWindImpactLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric(0.5 + lifecycle.energy * 0.65),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.14 + lifecycle.energy * 0.86),
      signature: `wind-impact:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'wind-beam-surge') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxWindBeamLifecycle(cycle)
    const isLeaves = surface.tuning.meshGeometry === 'wind-beam-debris-leaves'
    return {
      rotationZ: roundMetric((isLeaves ? 0.035 : -0.01) * lifecycle.twist),
      xOffset: roundMetric(lifecycle.scatter * (isLeaves ? 0.08 : 0.04)),
      yOffset: roundMetric(isLeaves ? Math.sin(cycle * Math.PI * 2) * 0.025 * lifecycle.twist + lifecycle.scatter * 0.04 : 0),
      scaleMultiplier: lifecycle.stage === 'rest'
        ? 0
        : roundMetric((isLeaves ? 0.96 : 0.98) + lifecycle.energy * (isLeaves ? 0.04 : 0.02)),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.22 + lifecycle.energy * 0.78),
      signature: `wind-beam:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'petal-ambient-breeze-loop') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = 1.4
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxPetalAmbientLifecycle(cycle)
    const crestProgress = THREE.MathUtils.clamp((lifecycle.energy - 0.72) / 0.28, 0, 1)
    return {
      rotationZ: roundMetric((lifecycle.drift - 0.5) * 0.035),
      xOffset: roundMetric((lifecycle.drift - 0.5) * 0.025),
      yOffset: roundMetric((lifecycle.lift - 0.9) * 0.05),
      scaleMultiplier: roundMetric(0.75 + crestProgress * 0.33),
      opacityMultiplier: roundMetric(0.52 + crestProgress * 0.48),
      signature: `petal-ambient:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'sand-burst-ballistic') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxSandBurstLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: roundMetric(lifecycle.settle * 0.04),
      yOffset: roundMetric(-lifecycle.settle * 0.035),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.96 + lifecycle.energy * 0.04),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.12 + lifecycle.energy * lifecycle.energy * 0.88),
      signature: `sand-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'rain-burst-impact') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxRainBurstLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.splash * 0.02),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.22 + lifecycle.energy * 0.78),
      signature: `rain-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'snow-burst-impact') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxSnowBurstLifecycle(cycle)
    const isPowder = (surface.tuning?.meshGeometry as string | undefined) === 'snow-burst-powder-drift'
    return {
      rotationZ: roundMetric((isPowder ? -0.018 : 0.025) * lifecycle.spread),
      xOffset: roundMetric((isPowder ? -0.02 : 0.015) * lifecycle.spread),
      yOffset: roundMetric(-0.04 * (1 - lifecycle.energy)),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.spread * 0.04),
      opacityMultiplier: lifecycle.stage === 'rest'
        ? 0
        : roundMetric(isPowder ? 0.18 + lifecycle.powder * 0.82 : 0.16 + lifecycle.energy * 0.84),
      signature: `snow-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'wind-burst-release') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxWindBurstLifecycle(cycle)
    const isWake = (surface.tuning?.meshGeometry as string | undefined) === 'wind-burst-wake-wisps'
    return {
      rotationZ: roundMetric((isWake ? -0.018 : 0.012) * lifecycle.curl),
      xOffset: roundMetric(lifecycle.release * 0.025),
      yOffset: roundMetric(Math.sin(lifecycle.curl * Math.PI) * 0.018),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.release * 0.03),
      opacityMultiplier: lifecycle.stage === 'rest'
        ? 0
        : roundMetric(isWake ? 0.14 + lifecycle.energy * 0.86 : 0.2 + lifecycle.energy * 0.8),
      signature: `wind-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'leaf-burst-botanical-release') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxLeafBurstLifecycle(cycle)
    const isVein = (surface.tuning?.meshGeometry as string | undefined) === 'leaf-burst-vein-seed-curls'
    return {
      rotationZ: roundMetric((isVein ? -0.018 : 0.026) * lifecycle.flutter),
      xOffset: roundMetric(Math.sin(lifecycle.flutter * Math.PI) * 0.018),
      yOffset: roundMetric(-0.035 * (1 - lifecycle.energy)),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.spread * 0.03),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isVein ? 0.16 + lifecycle.energy * 0.84 : 0.2 + lifecycle.energy * 0.8),
      signature: `leaf-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'petal-burst-botanical-bloom') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxPetalBurstLifecycle(cycle)
    const isStamen = (surface.tuning?.meshGeometry as string | undefined) === 'petal-burst-stamen-pollen-calyx'
    return {
      rotationZ: roundMetric((isStamen ? -0.014 : 0.022) * lifecycle.flutter),
      xOffset: roundMetric(Math.sin(lifecycle.flutter * Math.PI) * 0.014),
      yOffset: roundMetric(-0.03 * (1 - lifecycle.energy)),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.spread * 0.03),
      opacityMultiplier: lifecycle.stage === 'rest'
        ? 0
        : lifecycle.stage === 'bud'
          ? roundMetric(isStamen ? 0.9 : 0.94)
          : roundMetric(isStamen ? 0.18 + lifecycle.energy * 0.82 : 0.26 + lifecycle.energy * 0.74),
      signature: `petal-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'mud-burst-grounded-eruption') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxMudBurstLifecycle(cycle)
    const isClod = (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-ballistic-clods'
    return {
      rotationZ: roundMetric((isClod ? -0.018 : 0.01) * lifecycle.settle),
      xOffset: roundMetric(Math.sin(lifecycle.settle * Math.PI) * 0.012),
      yOffset: roundMetric(-0.018 * lifecycle.settle),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.eruption * 0.03),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isClod ? 0.16 + lifecycle.energy * 0.84 : 0.2 + lifecycle.energy * 0.8),
      signature: `mud-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'slime-burst-elastic-splat') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxSlimeBurstLifecycle(cycle)
    const isBubble = (surface.tuning?.meshGeometry as string | undefined) === 'slime-burst-bubble-droplet-volume'
    return {
      rotationZ: roundMetric((isBubble ? -0.02 : 0.012) * lifecycle.stringing),
      xOffset: roundMetric(Math.sin(lifecycle.stringing * Math.PI) * 0.014),
      yOffset: roundMetric(-0.016 * lifecycle.stringing),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.rebound * 0.035),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isBubble ? 0.18 + lifecycle.energy * 0.82 : 0.3 + lifecycle.energy * 0.7),
      signature: `slime-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'poison-burst-toxic-rupture') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxPoisonBurstLifecycle(cycle)
    const isSpore = (surface.tuning?.meshGeometry as string | undefined) === 'poison-burst-spore-pod-volume'
    return {
      rotationZ: roundMetric((isSpore ? -0.022 : 0.014) * lifecycle.disperse),
      xOffset: roundMetric(Math.sin(lifecycle.disperse * Math.PI) * 0.018),
      yOffset: roundMetric(-0.012 * lifecycle.disperse),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.rupture * 0.04),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isSpore ? 0.16 + lifecycle.energy * 0.84 : 0.28 + lifecycle.energy * 0.72),
      signature: `poison-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'acid-burst-caustic-eruption') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxAcidBurstLifecycle(cycle)
    const isDroplet = (surface.tuning?.meshGeometry as string | undefined) === 'acid-burst-ballistic-droplet-volume'
    return {
      rotationZ: roundMetric((isDroplet ? -0.024 : 0.012) * lifecycle.collapse),
      xOffset: roundMetric(Math.sin(lifecycle.collapse * Math.PI) * 0.014),
      yOffset: roundMetric(-0.022 * lifecycle.collapse),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.eruption * 0.035),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isDroplet ? 0.18 + lifecycle.energy * 0.82 : 0.58 + lifecycle.energy * 0.42),
      signature: `acid-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'healing-burst-restoration-release') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxHealingBurstLifecycle(cycle)
    const isLeaf = (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-rising-leaf-volume'
    const isReferenceBloom = (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-reference-bloom'
    return {
      rotationZ: roundMetric((isLeaf ? -0.012 : 0.008) * lifecycle.lift),
      xOffset: roundMetric(Math.sin(lifecycle.lift * Math.PI) * (isLeaf ? 0.012 : 0.006)),
      yOffset: roundMetric((isLeaf ? 0.028 : -0.01) * lifecycle.lift),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isReferenceBloom ? 0.32 + lifecycle.bloom * 0.68 : 0.98 + lifecycle.bloom * 0.035),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isReferenceBloom ? 0.08 + lifecycle.energy * 0.92 : isLeaf ? 0.15 + lifecycle.energy * 0.85 : 0.2 + lifecycle.energy * 0.8),
      signature: `healing-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'holy-burst-consecration-release') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxHolyBurstLifecycle(cycle)
    const isFeather = (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-ascending-feather-volume'
    const isReferenceSun = (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-sanctity-sun'
    return {
      rotationZ: roundMetric((isFeather ? -0.014 : 0.006) * lifecycle.ascent),
      xOffset: roundMetric(Math.sin(lifecycle.ascent * Math.PI) * (isFeather ? 0.014 : 0.004)),
      yOffset: roundMetric((isFeather ? 0.032 : -0.008) * lifecycle.ascent),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isReferenceSun ? 0.42 + lifecycle.burst * 0.58 : 0.98 + lifecycle.burst * 0.035),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isReferenceSun ? 0.14 + lifecycle.energy * 0.86 : isFeather ? 0.14 + lifecycle.energy * 0.86 : 0.2 + lifecycle.energy * 0.8),
      signature: `holy-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'curse-burst-malediction-release') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxCurseBurstLifecycle(cycle)
    const isBinding = (surface.tuning?.meshGeometry as string | undefined) === 'curse-burst-snapped-binding-chains'
    return {
      rotationZ: roundMetric((isBinding ? 0.018 : -0.008) * lifecycle.escape),
      xOffset: roundMetric(Math.sin(lifecycle.escape * Math.PI) * (isBinding ? 0.012 : -0.004)),
      yOffset: roundMetric((isBinding ? 0.028 : -0.012) * lifecycle.escape),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.rupture * 0.04),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isBinding ? 0.48 + lifecycle.energy * 0.52 : 0.62 + lifecycle.energy * 0.38),
      signature: `curse-burst:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'shadow-burst-detonation') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxShadowBurstLifecycle(cycle)
    const isSplinters = (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-void-fragments'
    const isReferenceClaw = (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-reference-claw'
    return {
      rotationZ: roundMetric((isSplinters ? -0.012 : 0.006) * lifecycle.disperse),
      xOffset: roundMetric(Math.sin(lifecycle.disperse * Math.PI) * (isSplinters ? -0.01 : 0.004)),
      yOffset: roundMetric((isSplinters ? 0.024 : -0.01) * lifecycle.disperse),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.97 + lifecycle.rupture * 0.05),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(isSplinters ? 0.16 + lifecycle.energy * 0.84 : isReferenceClaw ? 0.38 + lifecycle.energy * 0.62 : 0.24 + lifecycle.energy * 0.76),
      signature: `shadow-burst:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'mud-charge-convergence') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxMudChargeLifecycle(cycle)
    return {
      rotationZ: roundMetric((1 - lifecycle.radius) * 0.025),
      xOffset: 0,
      yOffset: roundMetric(lifecycle.compression * 0.025),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.compression * 0.04),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.54 + lifecycle.energy * 0.46),
      signature: `mud-charge:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'mud-burst-reference-eruption') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxMudBurstLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: roundMetric(-0.01 + lifecycle.settle * 0.012),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.98 + lifecycle.eruption * 0.06),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.54 + lifecycle.energy * 0.46),
      signature: `mud-burst-reference:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'slime-ring-adhesion') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxSlimeRingLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: roundMetric(-0.015 + lifecycle.bubble * 0.015),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.46 + lifecycle.energy * 0.54),
      signature: `slime-ring:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'acid-spawn-eruption') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxAcidSpawnLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.5 + lifecycle.energy * 0.5),
      signature: `acid-spawn:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'healing-burst-reference-renewal') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxHealingBurstLifecycle(cycle)
    return {
      rotationZ: roundMetric((lifecycle.lift - 0.5) * 0.018),
      xOffset: roundMetric(Math.sin(lifecycle.lift * Math.PI) * 0.012),
      yOffset: roundMetric(-0.02 + lifecycle.lift * 0.04),
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.78 + lifecycle.bloom * 0.22),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.08 + lifecycle.energy * 0.92),
      signature: `healing-burst-reference:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'healing-loop-renewal') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.8, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxHealingLoopLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric(0.97 + lifecycle.grounding * 0.03),
      opacityMultiplier: roundMetric(0.82 + lifecycle.energy * 0.18),
      signature: `healing-loop:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'holy-release-cleansing') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxHolyReleaseLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.56 + lifecycle.energy * 0.44),
      signature: `holy-release:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'flame-burst-ignite-blossom-peel') {
    const lifecycle = createPfxFlameBurstRuntimeState(
      elapsedSeconds,
      controls.timing,
      controls.lifetime,
      tempo,
      styleProfile.motionMultiplier,
    )
    return {
      rotationZ: roundMetric((lifecycle.peel - 0.18) * 0.02),
      xOffset: roundMetric(lifecycle.peel * 0.012),
      yOffset: roundMetric(lifecycle.bloom * 0.025),
      scaleMultiplier: lifecycle.opacity === 0 ? 0 : roundMetric(0.78 + lifecycle.bloom * 0.22),
      opacityMultiplier: lifecycle.opacity,
      signature: `flame-burst:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'curse-cone-propagation') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxCurseConeLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.5 + lifecycle.energy * 0.5),
      signature: `curse-cone:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'shadow-break-rupture') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxShadowBreakLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.52 + lifecycle.energy * 0.48),
      signature: `shadow-break:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'blood-death-ballistic-collapse') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxBloodDeathLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.54 + lifecycle.energy * 0.46),
      signature: `blood-death:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'ghost-trail-procession') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxGhostTrailLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.5 + lifecycle.energy * 0.5),
      signature: `ghost-trail:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'portal-telegraph-countdown') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxPortalTelegraphLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.52 + lifecycle.energy * 0.48),
      signature: `portal-telegraph:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'teleport-hit-arrival') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxTeleportHitLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.5 + lifecycle.energy * 0.5),
      signature: `teleport-hit:${lifecycle.stage}`,
    }
  }
  if ((surface.tuning?.lifecycle as string | undefined) === 'despawn-impact-collapse') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxDespawnImpactLifecycle(cycle)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: lifecycle.stage === 'rest' ? 0 : 1,
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.48 + lifecycle.energy * 0.52),
      signature: `despawn-impact:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'electric-trail-propagation') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxElectricTrailLifecycle(cycle)
    const isWake = surface.tuning?.meshShader === 'electric-wake'
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: isWake ? 1 : roundMetric(0.48 + lifecycle.intensity * 0.62),
      opacityMultiplier: roundMetric(lifecycle.intensity),
      signature: `electric-trail:${lifecycle.decay > 0 ? 'recover' : lifecycle.reach < 0.9 ? 'charge' : 'propagate'}`,
    }
  }
  if (surface.tuning?.lifecycle === 'spark-gap-loop') {
    const lifecycle = createPfxSparkGapLoopState(elapsedSeconds * Math.max(0.1, tempo))
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric(0.78 + lifecycle.energy * 0.26),
      opacityMultiplier: roundMetric(lifecycle.energy),
      signature: `spark-gap-loop:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'level-up-surge') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    const lifecycle = createPfxLevelUpSurgeLifecycle(cycle)
    const scaleMultiplier = lifecycle.stage === 'rest' ? 0.08 : 0.28 + lifecycle.energy * 0.82
    // The modeled column is 2.5 units tall. Counter-translate half its lost
    // height so uniform growth remains planted on the shared ground plane.
    const anchoredYOffset = (scaleMultiplier - 1) * 1.25
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: roundMetric(anchoredYOffset),
      scaleMultiplier: roundMetric(scaleMultiplier),
      opacityMultiplier: lifecycle.stage === 'rest' ? 0 : roundMetric(0.08 + lifecycle.energy * 0.92),
      signature: `level-up-surge:${lifecycle.stage}`,
    }
  }
  if (surface.tuning?.lifecycle === 'dust-loop-breathing') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const cycle = (elapsedSeconds * timeScale) % 1.16
    const primaryRoll = Math.exp(-Math.pow((cycle - 0.3) / 0.15, 2))
    const trailingEddy = Math.exp(-Math.pow((cycle - 0.5) / 0.09, 2)) * 0.01
    const energy = Math.min(1, 0.22 + primaryRoll * 0.78 + trailingEddy)
    const energyAboveBed = energy - 0.22
    const isEnvelope = surface.role === 'aura'
    const isGrit = surface.role === 'trail'
    return {
      rotationZ: 0,
      xOffset: roundMetric(energyAboveBed * (isEnvelope ? -0.035 : isGrit ? 0.14 : 0.055)),
      yOffset: roundMetric(energyAboveBed * (isEnvelope ? 0.06 : isGrit ? 0.026 : 0.018)),
      scaleMultiplier: roundMetric(isEnvelope ? 0.72 + energy * 0.58 : isGrit ? 0.64 + energy * 0.58 : 0.76 + energy * 0.41),
      opacityMultiplier: roundMetric(0.18 + energy * 0.82),
      signature: `dust-loop:${primaryRoll > 0.62 ? 'roll' : trailingEddy > 0.006 ? 'eddy' : 'bed'}`,
    }
  }
  if (surface.tuning?.lifecycle === 'held-projectile-ignition') {
    const lifecycle = createPfxHeldProjectileLifecycle(elapsedSeconds)
    const energy = lifecycle.energy
    const phase = surface.phase ?? surface.kind
    const isTrail = surface.role === 'trail'
    const isGlow = surface.phase === 'heat-glow'
    const churn = elapsedSeconds * Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const scaleMultiplier = isTrail
      ? 0.5 + energy * 0.55
      : isGlow
        ? 0.6 + energy * 0.46 + Math.sin(churn * 5.6) * 0.012
        : 0.64 + energy * 0.42 + Math.sin(churn * 6.8) * 0.008
    const opacityMultiplier = isTrail
      ? 0.24 + energy * 0.76
      : isGlow
        ? 0.12 + energy * 0.88
        : 0.22 + energy * 0.78
    return {
      rotationZ: isTrail ? 0 : roundMetric(Math.sin(churn * 3.1) * 0.035 * energy),
      xOffset: 0,
      yOffset: roundMetric(Math.sin(churn * 2.3) * 0.025 * energy),
      scaleMultiplier: roundMetric(scaleMultiplier),
      opacityMultiplier: roundMetric(opacityMultiplier),
      signature: `projectile-lifecycle:${lifecycle.stage}:${phase}`,
    }
  }
  if (surface.tuning?.lifecycle === 'shockwave-spawn-arrival') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    if (cycle >= 0.36) {
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: 0.58,
        opacityMultiplier: 0,
        signature: `shockwave-spawn-arrival:rest:${surface.phase ?? surface.kind}`,
      }
    }
    const growthProgress = THREE.MathUtils.clamp((cycle - 0.055) / 0.09, 0, 1)
    const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
    const settle = THREE.MathUtils.clamp((cycle - 0.11) / 0.2, 0, 1)
    const release = Math.pow(1 - settle, 1.5)
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric(0.18 + growth * 0.88 - settle * 0.24),
      opacityMultiplier: roundMetric(growth * release),
      signature: `shockwave-spawn-arrival:${cycle < 0.18 ? 'arrival' : 'settle'}:${surface.phase ?? surface.kind}`,
    }
  }
  // Shader meshes with a BURST envelope (flash/shockwave/bloom) still need
  // the envelope's scale/opacity arc — returning static props left echo
  // shells permanently on. 'break' keeps its dedicated uBreak path.
  const shaderStatic = surface.tuning?.meshShader && (!meshMotion || meshMotion === 'break')
  if (shaderStatic) {
    // Shader-driven surfaces animate in GLSL from the burst clock — any CPU
    // transform on top (wobble, aura spin) fights the shader's own motion.
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: 1,
      opacityMultiplier: 1,
      signature: `shader:${surface.tuning.meshShader}${meshMotion === 'break' ? ':break' : ''}`,
    }
  }
  if (meshMotion || surface.tuning?.lifecycle === 'debris-release-ballistic' || surface.tuning?.lifecycle === 'spark-cone-burst' || surface.tuning?.lifecycle === 'ice-impact-contact') {
    const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
    const label = surface.phase ?? surface.kind
    if (surface.tuning?.lifecycle === 'barrier-low-health-failure-loop') {
      const beatClock = ((elapsedSeconds * timeScale) / 0.86) % 1
      const beatA = Math.exp(-Math.pow((beatClock - 0.2) / 0.075, 2))
      const beatB = Math.exp(-Math.pow((beatClock - 0.39) / 0.095, 2)) * 0.72
      const dangerBeat = Math.min(1, 0.26 + beatA + beatB)
      const breachEnergy = surface.tuning.meshGeometry === 'barrier-low-health-breach-ribs'
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        // Preserve the advertised protection volume while the material and
        // breach edges carry the alarm. A collapsing scale would imply the
        // shield's gameplay radius is changing.
        scaleMultiplier: roundMetric(breachEnergy ? 0.28 + dangerBeat * 1.3 : 0.985 + dangerBeat * 0.035),
        opacityMultiplier: roundMetric(breachEnergy ? 0.36 + dangerBeat * 0.64 : 0.4 + dangerBeat * 0.6),
        signature: `barrier-failure-loop:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'shockwave-spawn-pressure-release') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (cycle >= 0.46) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 1.22,
          opacityMultiplier: 0,
          signature: `shockwave-spawn-pressure-release:rest:${label}`,
        }
      }
      const growthProgress = THREE.MathUtils.clamp(cycle / 0.055, 0, 1)
      const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
      const releaseProgress = THREE.MathUtils.clamp((cycle - 0.16) / 0.3, 0, 1)
      const release = Math.pow(1 - releaseProgress, 1.2)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric(0.28 + growth * 0.78 + releaseProgress * 0.16),
        opacityMultiplier: roundMetric((0.24 + growth * 0.76) * release),
        signature: `shockwave-spawn-pressure-release:${cycle < 0.2 ? 'compress' : 'release'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'beam-telegraph-countdown') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (cycle >= 0.8) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 1.04,
          opacityMultiplier: 0,
          signature: `beam-telegraph-countdown:rest:${label}`,
        }
      }
      const charge = THREE.MathUtils.smoothstep(cycle, 0, 0.3)
      const release = 1 - THREE.MathUtils.smoothstep(cycle, 0.48, 0.78)
      const isAperture = surface.tuning.meshGeometry === 'beam-telegraph-source-aperture'
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: roundMetric(isAperture ? charge * 0.03 : 0),
        scaleMultiplier: roundMetric(((isAperture ? 0.72 : 0.9) + charge * (isAperture ? 0.34 : 0.14)) * (0.96 + release * 0.04)),
        opacityMultiplier: roundMetric((0.64 + charge * 0.36) * Math.pow(release, 0.82)),
        signature: `beam-telegraph-countdown:${cycle < 0.3 ? 'acquire' : cycle < 0.48 ? 'locked' : 'release'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'laser-spray-salvo') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (cycle >= 0.8) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 1,
          opacityMultiplier: 0,
          signature: `laser-spray-salvo:rest:${label}`,
        }
      }
      const build = THREE.MathUtils.smoothstep(cycle, 0, 0.28)
      const release = 1 - THREE.MathUtils.smoothstep(cycle, 0.45, 0.8)
      const recovery = THREE.MathUtils.smoothstep(cycle, 0.48, 0.8)
      const isNozzle = surface.tuning.meshGeometry === 'laser-spray-volumetric-nozzle'
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: roundMetric(isNozzle ? Math.sin(cycle * Math.PI * 8) * 0.012 * build : 0),
        scaleMultiplier: roundMetric(
          (isNozzle ? 0.78 + build * 0.28 : 0.94 + build * 0.08)
          * (isNozzle ? 1 - recovery * 0.08 : 1 - recovery * 0.18),
        ),
        opacityMultiplier: roundMetric((0.58 + build * 0.42) * Math.pow(release, 0.78)),
        signature: `laser-spray-salvo:${cycle < 0.28 ? 'spin-up' : cycle < 0.46 ? 'salvo' : 'recovery'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'plasma-hit-discharge') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (surface.tuning.meshShader === 'plasma-impact-flipbook') {
        const visible = cycle < 0.78
        const breakup = THREE.MathUtils.smoothstep(cycle, 0.36, 0.72)
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: roundMetric((0.9 + THREE.MathUtils.smoothstep(cycle, 0, 0.06) * 0.1) * (1 - breakup * 0.16)),
          opacityMultiplier: visible ? roundMetric(1 - breakup) : 0,
          signature: `plasma-hit-discharge:${visible ? 'authored-flipbook' : 'rest'}:${label}`,
        }
      }
      if (cycle >= 0.78) {
        return {
          rotationZ: 0,
          xOffset: -0.08,
          yOffset: 0,
          scaleMultiplier: 0.72,
          opacityMultiplier: 0,
          signature: `plasma-hit-discharge:rest:${label}`,
        }
      }
      const attack = THREE.MathUtils.smoothstep(cycle, 0, 0.08)
      const release = 1 - THREE.MathUtils.smoothstep(cycle, 0.22, 0.62)
      const breakup = THREE.MathUtils.smoothstep(cycle, 0.36, 0.72)
      return {
        rotationZ: roundMetric(breakup * 0.08),
        xOffset: roundMetric(-breakup * 0.12),
        yOffset: roundMetric(-breakup * 0.025),
        scaleMultiplier: roundMetric((0.9 + attack * 0.2) * (1 - breakup * 0.24)),
        opacityMultiplier: roundMetric((0.9 + attack * 0.1) * Math.pow(release, 0.9)),
        signature: `plasma-hit-discharge:${cycle < 0.08 ? 'contact' : cycle < 0.36 ? 'discharge' : 'ion-breakup'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'water-column-eruption') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const lifecycle = createPfxWaterColumnLifecycle(cycle)
      const isFoam = surface.tuning.meshGeometry === 'water-column-foam-spray'
      return {
        rotationZ: roundMetric((isFoam ? -0.025 : 0.018) * lifecycle.energy),
        xOffset: roundMetric(Math.sin(cycle * Math.PI * 2) * 0.018 * lifecycle.energy),
        yOffset: roundMetric((1 - lifecycle.height) * -0.08),
        scaleMultiplier: lifecycle.stage === 'rest'
          ? 0
          : roundMetric(lifecycle.height * (isFoam ? 1.04 : 1)),
        opacityMultiplier: lifecycle.stage === 'rest'
          ? 0
          : roundMetric(isFoam ? lifecycle.foam : lifecycle.energy),
        signature: `water-column-eruption:${lifecycle.stage}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'snow-idle-weather-loop') {
      const period = Math.max(0.8, Math.max(0.25, controls.lifetime)) * 2.6
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const lifecycle = createPfxSnowIdleLifecycle(cycle)
      const isGranules = surface.tuning.meshGeometry === 'snow-idle-depth-granules'
      return {
        rotationZ: roundMetric((isGranules ? 0.008 : -0.012) * lifecycle.gust),
        xOffset: roundMetric((isGranules ? -0.035 : 0.055) * Math.sin(cycle * Math.PI * 2) * lifecycle.gust),
        yOffset: roundMetric((isGranules ? -0.022 : -0.035) * lifecycle.fall),
        scaleMultiplier: roundMetric(isGranules ? 0.9 + lifecycle.density * 0.12 : 0.8 + lifecycle.density * 0.28),
        opacityMultiplier: roundMetric(isGranules ? 0.48 + lifecycle.density * 0.46 : 0.35 + lifecycle.density * 0.65),
        signature: `snow-idle-weather-loop:${lifecycle.stage}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'glyph-trail-inscription') {
      const period = 1.35 * Math.max(0.25, controls.lifetime)
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const lifecycle = createPfxGlyphTrailLifecycle(cycle)
      const cooling = THREE.MathUtils.smoothstep(cycle, .25, .68)
      const resting = cycle >= .72
      const visibleEnvelope = resting ? 0 : 1 - cooling * .35
      return {
        rotationZ: roundMetric(.018 * lifecycle.inscription - .012 * lifecycle.erode),
        xOffset: roundMetric(.035 * lifecycle.inscription - .08 * lifecycle.erode),
        yOffset: roundMetric((1 - lifecycle.inscription) * -.045 + lifecycle.erode * .025),
        scaleMultiplier: roundMetric(.58 + lifecycle.inscription * .42 - cooling * .12),
        opacityMultiplier: roundMetric((.65 + lifecycle.inscription * .35) * visibleEnvelope),
        signature: `glyph-trail-inscription:${lifecycle.stage}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'ice-impact-contact') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (cycle >= 0.76) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: -0.06,
          scaleMultiplier: 0.88,
          opacityMultiplier: 0,
          signature: `ice-impact-contact:rest:${label}`,
        }
      }
      const compression = THREE.MathUtils.smoothstep(cycle, 0, 0.075)
      const settle = THREE.MathUtils.smoothstep(cycle, 0.24, 0.68)
      const fade = 1 - THREE.MathUtils.smoothstep(cycle, 0.3, 0.74)
      return {
        rotationZ: roundMetric(-0.025 + compression * 0.025),
        xOffset: roundMetric((1 - compression) * -0.035),
        yOffset: roundMetric((1 - compression) * 0.025 - settle * 0.06),
        scaleMultiplier: roundMetric(0.4 + compression * 0.67 - settle * 0.17),
        opacityMultiplier: roundMetric((0.68 + compression * 0.32) * fade),
        signature: `ice-impact-contact:${cycle < 0.075 ? 'compression' : cycle < 0.3 ? 'splinter-crest' : 'frost-settle'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'shard-break-fracture') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const isIgnitionCore = surface.tuning.meshGeometry === 'shard-break-ignition-core'
      if (isIgnitionCore) {
        if (cycle >= 0.29) {
          return {
            rotationZ: 0,
            xOffset: 0,
            yOffset: 0,
            scaleMultiplier: 1,
            opacityMultiplier: 0,
            signature: `shard-break-fracture:core-rest:${label}`,
          }
        }
        const coreGrowth = THREE.MathUtils.smoothstep(cycle, 0, 0.14)
        const coreRelease = 1 - THREE.MathUtils.smoothstep(cycle, 0.08, 0.29)
        return {
          rotationZ: roundMetric(cycle * 0.24),
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: roundMetric(0.42 + coreGrowth * 0.58),
          opacityMultiplier: roundMetric(coreRelease),
          signature: `shard-break-fracture:${cycle < 0.08 ? 'seed' : 'core-release'}:${label}`,
        }
      }
      if (cycle >= 0.44) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: -0.3,
          scaleMultiplier: 1.12,
          opacityMultiplier: 0,
          signature: `shard-break-fracture:rest:${label}`,
        }
      }
      const growthProgress = THREE.MathUtils.clamp(cycle / 0.1, 0, 1)
      const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
      const fall = THREE.MathUtils.smoothstep(cycle, 0.16, 0.38)
      const fade = 1 - THREE.MathUtils.smoothstep(cycle, 0.17, 0.34)
      return {
        rotationZ: roundMetric(cycle * 0.16),
        xOffset: 0,
        yOffset: roundMetric(growth * 0.06 - fall * 0.32),
        scaleMultiplier: roundMetric(0.18 + growth * 0.92 - fall * 0.28),
        opacityMultiplier: roundMetric((0.78 + growth * 0.22) * fade),
        signature: `shard-break-fracture:${cycle < 0.1 ? 'crack' : cycle < 0.28 ? 'release' : 'fall'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'spark-cone-burst') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (cycle >= 0.46) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 1.08,
          opacityMultiplier: 0,
          signature: `spark-cone-burst:rest:${label}`,
        }
      }
      const growthProgress = THREE.MathUtils.clamp(cycle / 0.075, 0, 1)
      const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
      const fade = 1 - THREE.MathUtils.smoothstep(cycle, 0.3, 0.46)
      return {
        rotationZ: roundMetric(cycle * 0.08),
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric(0.28 + growth * 0.8),
        opacityMultiplier: roundMetric((0.22 + growth * 0.78) * fade),
        signature: `spark-cone-burst:${cycle < 0.12 ? 'ignite' : cycle < 0.3 ? 'release' : 'cool'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'debris-release-ballistic') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      // Particle-first debris uses authored stagger windows instead of the
      // retired mesh choreography's shared early clamp. Keep the lifecycle
      // phase-specific, but let each layer actually honor its delay/window.
      const delay = THREE.MathUtils.clamp(surface.tuning.delay ?? 0, 0, 0.95)
      const window = THREE.MathUtils.clamp(surface.tuning.window ?? 0.72, 0.08, 0.95)
      const local = cycle - delay
      if (local < 0 || local >= window) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 0.14,
          opacityMultiplier: 0,
          signature: `debris-release-ballistic:rest:${label}`,
        }
      }
      const progress = local / window
      const launchProgress = THREE.MathUtils.clamp(progress / 0.16, 0, 1)
      const launch = launchProgress * launchProgress * (3 - 2 * launchProgress)
      const streakLaunchProgress = THREE.MathUtils.clamp(progress / 0.07, 0, 1)
      const streakLaunch = streakLaunchProgress * streakLaunchProgress * (3 - 2 * streakLaunchProgress)
      const travel = 1 - Math.pow(1 - progress, 2.2)
      const settle = THREE.MathUtils.smoothstep(progress, 0.45, 0.82)
      const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.38, 0.72)
      const isHeroRocks = surface.phase === 'debris-release-hero-rocks'
      const isCounterChips = surface.phase === 'debris-release-counter-chips'
      const isDustSheet = surface.phase === 'debris-release-ground-dust-sheet'
      const isLaunchStreak = surface.phase === 'debris-release-launch-streaks'
      const direction = isCounterChips ? 1 : -1
      const launchStreakFade = 1
      const layerFade = isHeroRocks
        ? 1 - THREE.MathUtils.smoothstep(progress, 0.42, 0.52)
        : fade
      return {
        rotationZ: roundMetric(-travel * (isLaunchStreak ? 0.08 : 0.18)),
        xOffset: roundMetric(direction * travel * (isDustSheet ? 0.16 : isCounterChips ? 0.12 : isLaunchStreak ? 0.28 : 0.23)),
        yOffset: roundMetric(Math.sin(progress * Math.PI * 1.4) * (isDustSheet ? 0.14 : isLaunchStreak ? 0.38 : 0.32) - progress * progress * (isDustSheet ? 0.09 : 0.2)),
        scaleMultiplier: roundMetric(isHeroRocks ? 0.04 + launch * 1.26 - settle * 0.2 : isLaunchStreak ? 0.18 + launch * 1.02 - settle * 0.28 : isDustSheet ? 0.28 + launch * 0.92 - settle * 0.18 : 0.3 + launch * 0.9 - settle * 0.24),
        opacityMultiplier: roundMetric((isHeroRocks ? 0.38 + launch * 0.62 : isLaunchStreak ? streakLaunch : launch) * layerFade * launchStreakFade),
        signature: `debris-release-ballistic:${progress < 0.22 ? 'launch' : progress < 0.55 ? 'flight' : 'settle'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'impact-shard-burst') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const delay = THREE.MathUtils.clamp(surface.tuning.delay ?? 0, 0, 0.08)
      const window = THREE.MathUtils.clamp(surface.tuning.window ?? 0.68, 0.3, 0.72)
      const local = cycle - delay
      if (local < 0 || local >= window) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 0.18,
          opacityMultiplier: 0,
          signature: `impact-shard-burst:${label}`,
        }
      }
      const p = local / window
      const growthProgress = Math.min(1, p / 0.2)
      const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
      const startScale = surface.tuning.startScale ?? 0.42
      const release = p <= 0.35 ? 1 : Math.pow(Math.max(0, (1 - p) / 0.65), 0.42)
      const releaseScale = p <= 0.55 ? 1 : THREE.MathUtils.lerp(1, 0.3, (p - 0.55) / 0.45)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric((startScale + growth * (1.12 - startScale)) * releaseScale),
        opacityMultiplier: roundMetric(release),
        signature: `impact-shard-burst:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'meteor-impact-settle') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      if (cycle >= 0.985) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 0.84,
          opacityMultiplier: 0,
          signature: `meteor-impact-settle:rest:${label}`,
        }
      }
      const growthProgress = THREE.MathUtils.clamp((cycle - 0.07) / 0.1, 0, 1)
      const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
      const settle = THREE.MathUtils.clamp((cycle - 0.24) / 0.745, 0, 1)
      const fade = cycle <= 0.42
        ? 1
        : Math.pow(THREE.MathUtils.clamp((0.985 - cycle) / 0.565, 0, 1), 1.2)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric(0.18 + growth * 0.88 - settle * 0.22),
        opacityMultiplier: roundMetric(growth * fade),
        signature: `meteor-impact-settle:${cycle < 0.2 ? 'impact' : cycle < 0.5 ? 'hold' : 'cool'}:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'impact-afterglow') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const window = THREE.MathUtils.clamp(surface.tuning.window ?? 0.68, 0.45, 0.7)
      if (cycle >= window) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 0.15,
          opacityMultiplier: 0,
          signature: `impact-afterglow:${label}`,
        }
      }
      const p = cycle / window
      const riseProgress = Math.min(1, p / 0.22)
      const rise = riseProgress * riseProgress * (3 - 2 * riseProgress)
      const shrinkProgress = Math.max(0, (p - 0.22) / 0.78)
      const peakScale = (surface.tuning.startScale ?? 0.65) + rise * 0.55
      const scaleMultiplier = THREE.MathUtils.lerp(peakScale, 0.22, shrinkProgress * shrinkProgress)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric(scaleMultiplier),
        // Additive light stays chromatically clean and dies by coverage.
        opacityMultiplier: 1,
        signature: `impact-afterglow:${label}`,
      }
    }
    if (surface.tuning?.lifecycle === 'impact-core-flash') {
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
      const window = THREE.MathUtils.clamp(surface.tuning.window ?? 0.3, 0.2, 0.9)
      if (cycle >= window) {
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: 0.2,
          opacityMultiplier: 0,
          signature: `impact-core-flash:${label}`,
        }
      }
      const p = cycle / window
      // Reach the decisive contact shape early, then hold its coverage while
      // opacity releases near the end of the longer bridge window.
      const growthProgress = Math.min(1, p / 0.24)
      const growth = growthProgress * growthProgress * (3 - 2 * growthProgress)
      const heldOpacity = p <= 0.35 ? 1 : Math.pow(Math.max(0, (0.55 - p) / 0.2), 1.7)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric((surface.tuning.startScale ?? 0.35) + growth * 0.9),
        opacityMultiplier: roundMetric(heldOpacity),
        signature: `impact-core-flash:${label}`,
      }
    }
    if (meshMotion === 'pulse') {
      if (surface.tuning?.lifecycle === 'frost-aura-breathing-loop') {
        // A readable 640 ms cold-pressure cadence gives deterministic review
        // and gameplay a clear baseline -> crest -> recovery without ever
        // removing the persistent status marker.
        const breath = elapsedSeconds * timeScale * 3.472222 - 0.25
        const inhale = Math.sin(breath * Math.PI * 2)
        const secondary = Math.sin((breath + 0.1) * Math.PI * 4)
        return {
          rotationZ: 0,
          xOffset: roundMetric(secondary * 0.014),
          yOffset: roundMetric(inhale * 0.026),
          scaleMultiplier: roundMetric(0.94 + inhale * 0.16),
          opacityMultiplier: roundMetric(0.86 + inhale * 0.16 + secondary * 0.01),
          signature: `frost-aura-breath:${label}`,
        }
      }
      if (surface.tuning?.lifecycle === 'plasma-ambient-breathing-loop') {
        const breath = elapsedSeconds * timeScale
        return {
          rotationZ: roundMetric(breath * 0.16),
          xOffset: 0,
          yOffset: roundMetric(Math.sin(breath * 1.15) * 0.018),
          scaleMultiplier: roundMetric(0.97 + Math.sin(breath * 1.45 + 0.8) * 0.055),
          opacityMultiplier: roundMetric(0.72 + Math.sin(breath * 1.45 + 0.8) * 0.16),
          signature: `plasma-containment-breath:${label}`,
        }
      }
      if (surface.phase === 'healing-aura-ground-boundary') {
        const pulse = createPfxHealingRestorationPulse(elapsedSeconds)
        return {
          rotationZ: 0,
          xOffset: 0,
          yOffset: 0,
          scaleMultiplier: roundMetric(0.94 + pulse * 0.14),
          opacityMultiplier: roundMetric(0.32 + pulse * 0.68),
          signature: `restoration-boundary:${label}`,
        }
      }
      // Looping release beat (aura ground rings): expand + fade each cadence.
      // The beat is a design constant (~2.2s) — deriving it from the preset
      // lifetime produced 6s pulses that read as a frozen ring. The active
      // window is under half the beat: expand fast, gone, rest — a slow tail
      // reads as a static enclosure.
      const beat = (elapsedSeconds / 2.2) % 1
      const pulseWindow = 0.5
      const p = Math.min(1, beat / pulseWindow)
      const eased = 1 - Math.pow(1 - p, 3)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric(Math.max(0.2, 0.35 + eased * 1.1)),
        // Shallow fade (1.2) + high floor: the pulse must stay unmissable
        // through most of its window — round-4 review couldn't find it at all.
        opacityMultiplier: beat < pulseWindow && Math.pow(1 - p, 1.2) > 0.14 ? roundMetric(Math.pow(1 - p, 1.2) * Math.min(1, p / 0.03 + 0.6)) : 0,
        signature: `burst-pulse:${label}`,
      }
    }
    if (meshMotion === 'pickup') {
      const period = Math.max(0.55, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) / period) % 1
      const window = 0.58
      const p = Math.min(1, cycle / window)
      const alive = cycle < window
      return {
        rotationZ: roundMetric(p * Math.PI * 1.4),
        xOffset: roundMetric(Math.sin(p * Math.PI) * 0.16),
        yOffset: roundMetric(Math.sin(p * Math.PI * 0.82) * 0.68),
        scaleMultiplier: roundMetric((0.9 + Math.sin(Math.min(1, p * 1.8) * Math.PI * 0.5) * 0.22) * (1 - THREE.MathUtils.smoothstep(p, 0.7, 1) * 0.24)),
        opacityMultiplier: alive ? roundMetric(1 - THREE.MathUtils.smoothstep(p, 0.62, 1)) : 0,
        signature: `pickup-arc:${label}`,
      }
    }
    if (meshMotion === 'travel') {
      if (feelVersion >= 2) {
        // v2 held note: the preview shows the projectile in its OWN reference
        // frame (head anchored, trail streaming backward — the documented
        // firing-range read). The old ±0.38 slide dragged the head off its
        // origin-anchored emitters, decoupling body from flames. Energy in
        // flight lives in internal churn: silhouette breathing + a subtle
        // bob, never trajectory wobble (dodge honesty — the path is straight).
        const churn = elapsedSeconds * timeScale
        return {
          rotationZ: roundMetric(Math.sin(churn * 3.1) * 0.04),
          xOffset: 0,
          yOffset: roundMetric(Math.sin(churn * 2.3) * 0.04),
          scaleMultiplier: roundMetric(1 + Math.sin(churn * 6.8) * 0.05 + Math.sin(churn * 11.4) * 0.025),
          opacityMultiplier: 1,
          signature: `projectile-held:${label}`,
        }
      }
      const period = Math.max(0.55, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsedSeconds * timeScale) / period) % 1
      const window = 0.72
      const p = Math.min(1, cycle / window)
      const alive = cycle < window
      return {
        rotationZ: roundMetric(Math.sin(p * Math.PI) * 0.06),
        xOffset: roundMetric(-0.38 + p * 0.76),
        yOffset: roundMetric(Math.sin(p * Math.PI) * 0.12),
        scaleMultiplier: roundMetric(0.82 + Math.sin(Math.min(1, p * 1.8) * Math.PI * 0.5) * 0.24),
        opacityMultiplier: alive ? roundMetric(Math.max(0, 1 - Math.pow(Math.max(0, p - 0.62) / 0.38, 2))) : 0,
        signature: `projectile-travel:${label}`,
      }
    }
    if (meshMotion === 'glow') {
      if (surface.tuning?.lifecycle === 'plasma-ambient-breathing-loop') {
        const breath = elapsedSeconds * timeScale
        return {
          rotationZ: roundMetric(-breath * 0.1),
          xOffset: 0,
          yOffset: roundMetric(Math.sin(breath * 1.15) * 0.018),
          scaleMultiplier: roundMetric(0.98 + Math.sin(breath * 1.45) * 0.07),
          opacityMultiplier: roundMetric(0.9 + Math.sin(breath * 1.45) * 0.1),
          signature: `plasma-nucleus-breath:${label}`,
        }
      }
      // Persistent value-range glow riding a held-note body: gentle breathing
      // in scale and opacity at the body's churn cadence, never a burst
      // envelope — the glow exists exactly as long as the projectile does.
      const churn = elapsedSeconds * timeScale
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: roundMetric(Math.sin(churn * 2.3) * 0.04),
        scaleMultiplier: roundMetric(1 + Math.sin(churn * 5.6) * 0.06),
        opacityMultiplier: roundMetric(0.9 + Math.sin(churn * 7.7) * 0.1),
        signature: `held-glow:${label}`,
      }
    }
    if (meshMotion === 'countdown') {
      // Ground telegraph fill: preserve the advertised footprint while value
      // ramps decisively toward impact. Scaling this disc would imply a
      // changing hit radius; generic charge motion is reserved for bodies.
      const beat = ((elapsedSeconds * timeScale) / 0.72) % 1
      const urgency = beat * beat * (3 - 2 * beat)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: 1,
        opacityMultiplier: roundMetric(0.08 + urgency * 0.92),
        signature: `telegraph-countdown:${label}`,
      }
    }
    if (meshMotion === 'charge') {
      // A telegraph must communicate increasing urgency, not merely exist.
      // Quadratic compression accelerates into a hot, tight release point;
      // fragment bodies rise at the same cadence for spawn emergence.
      const beat = ((elapsedSeconds * timeScale) / 1.35) % 1
      const urgency = beat * beat
      const isEmergence = surface.kind === 'mesh-fragments'
      return {
        rotationZ: roundMetric(beat * Math.PI * 0.18),
        xOffset: 0,
        yOffset: isEmergence ? roundMetric(-0.42 + urgency * 0.9) : 0,
        scaleMultiplier: roundMetric(isEmergence ? 0.32 + urgency * 1.02 : 1.35 - urgency * 0.68),
        opacityMultiplier: roundMetric(0.24 + urgency * 0.76),
        signature: `charge-compress:${label}`,
      }
    }
    // Flash and shockwave sync to the sprite renderer's burst master cycle
    // (PFX_BURST_CYCLE_MULTIPLIER — MUST match the sprite shader; a mismatched multiplier
    // drifted every flash/ring out of sync with its particle burst).
    const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
    // Extended cycles rest after one base period — mesh beats keep their
    // wall-clock timing and stay dark until the wrap.
    const cycle = ((elapsedSeconds * timeScale) % (period * Math.max(1, cycleScale))) / period
    if (meshMotion === 'flash') {
      // Directional micro-bursts can author a slightly longer residual flame
      // so their decay preserves the peak silhouette. Other flashes retain
      // the production default instead of inheriting particle spawn timing.
      const flashWindow = THREE.MathUtils.clamp(surface.tuning?.window ?? 0.12, 0.04, 0.45)
      // tuning.delay shifts the flash inside the cycle (spawn spec: the
      // conceal flash fires at the BUILD PEAK, not at t=0; dark until then).
      const flashDelay = surface.tuning?.delay ?? 0
      const local = cycle - flashDelay
      const p = Math.min(1, Math.max(0, local) / flashWindow)
      const startScale = THREE.MathUtils.clamp(surface.tuning?.startScale ?? 0.55, 0.2, 1)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: 0,
        scaleMultiplier: roundMetric(Math.max(0.2, startScale + (1 - Math.pow(1 - p, 3)) * (1.45 - startScale))),
        opacityMultiplier: local >= 0 && local < flashWindow ? roundMetric(Math.max(0, 1 - p * p)) : 0,
        signature: `burst-flash:${label}`,
      }
    }
    if (meshMotion === 'bloom') {
      // One-shot volume puff: grows while fading, fully gone at rest —
      // a persistent cloud mesh reads as a fog decal baked into the ground.
      const bloomWindow = 0.55
      const p = Math.min(1, cycle / bloomWindow)
      return {
        rotationZ: 0,
        xOffset: 0,
        yOffset: p * 0.08,
        scaleMultiplier: roundMetric(Math.max(0.2, 0.5 + p * 0.9)),
        opacityMultiplier: cycle < bloomWindow ? roundMetric(Math.max(0, Math.pow(1 - p, 1.4) * Math.min(1, p / 0.07 + 0.4))) : 0,
        signature: `burst-bloom:${label}`,
      }
    }
    if (meshMotion === 'break') {
      const breakWindow = 0.68
      const p = Math.min(1, cycle / breakWindow)
      return {
        rotationZ: roundMetric(p * 0.08),
        xOffset: roundMetric(p * 0.08),
        yOffset: roundMetric(p * 0.34),
        scaleMultiplier: roundMetric(1 - p * 0.22),
        opacityMultiplier: cycle < breakWindow ? roundMetric(Math.max(0, 1 - p * p)) : 0,
        signature: `burst-break:${label}`,
      }
    }
    // Shockwave: opaque at birth, expands hard, gone fast — it must visibly
    // outrun everything else (fade-in ramps and slow tails made it read as a
    // hanging halo).
    // 0.24 of the cycle with a hard 15% alpha floor: long enough that strip
    // sampling reliably catches it, short enough not to hang as a halo.
    const waveWindow = THREE.MathUtils.clamp(surface.tuning?.window ?? 0.3, 0.22, 0.52)
    // tuning.delay shifts the wave inside the cycle (despawn spec: the
    // ground wave answers the fragments, it does not co-fire with them).
    const waveDelay = surface.tuning?.delay ?? 0
    const waveLocal = cycle - waveDelay
    const p = Math.min(1, Math.max(0, waveLocal) / waveWindow)
    const isShockwaveSpawnFront = surface.phase === 'shockwave-spawn-ground-front'
    // p^0.75: pure ease-out hit full radius inside the flash window — a
    // pop-in hoop no frame ever saw expanding (round-19).
    // Spawn uses a later acceleration so the fixed onset/peak/decay evidence
    // shows unmistakable propagation rather than three near-identical hoops.
    const eased = Math.pow(p, isShockwaveSpawnFront ? 1.2 : 0.75)
    const opacityMultiplier = isShockwaveSpawnFront
      ? waveLocal >= 0 && waveLocal < waveWindow
        ? roundMetric(1 - THREE.MathUtils.smoothstep(p, 0.3, 1) * 0.65)
        : 0
      : waveLocal >= 0 && waveLocal < waveWindow && Math.pow(1 - p, 1.5) > 0.16
        ? roundMetric(Math.min(1, 1.7 * Math.pow(1 - p, 1.5)))
        : 0
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: roundMetric(isShockwaveSpawnFront ? 0.18 + eased * 2.28 : Math.max(0.12, 0.12 + eased * 1.55)),
      // Hard floor: a ring below ~15% alpha lingers as a dirty ghost outline.
      opacityMultiplier,
      signature: `burst-shockwave:${label}`,
    }
  }
  // A reticle is gameplay geometry: its outer radius communicates the exact
  // affected footprint and must not inherit the generic aura wobble. Urgency
  // belongs to authored interior layers, never a breathing hit boundary.
  if (surface.kind === 'ring-field' && surface.tuning?.ringPurpose === 'reticle') {
    return {
      rotationZ: 0,
      xOffset: 0,
      yOffset: 0,
      scaleMultiplier: 1,
      opacityMultiplier: 1,
      signature: `stable-reticle:${surface.phase ?? surface.kind}`,
    }
  }
  const turbulence = Math.max(0.1, controls.turbulence)
  const velocity = Math.max(0, controls.velocity)
  let rotationZ = Math.sin(t * 0.8) * 0.08 * turbulence
  let xOffset = Math.sin(t * 1.2) * 0.018 * turbulence
  let yOffset = Math.sin(t * 1.4) * 0.018 * turbulence + controls.gravity * 0.04
  let scaleMultiplier = 1 + Math.sin(t * 1.6) * 0.035
  let opacityMultiplier = 1
  let family = 'base'
  const phase = surface.phase ?? ''

  if (surface.role === 'trail' || phase.includes('tail') || phase.includes('streak') || phase.includes('afterimage')) {
    family = 'trail-flow'
    xOffset -= 0.08 + velocity * 0.035
    rotationZ -= 0.18
    scaleMultiplier += 0.04 * Math.sin(t * 2.2)
    opacityMultiplier = 0.88 + 0.08 * Math.sin(t * 2)
  } else if (surface.role === 'aura' || phase.includes('ring') || phase.includes('shield') || phase.includes('rim')) {
    family = 'orbital-pulse'
    rotationZ += t * (0.22 + turbulence * 0.08)
    scaleMultiplier += 0.06 * Math.sin(t * 1.7)
    opacityMultiplier = 0.82 + 0.12 * Math.sin(t * 1.3)
  } else if (surface.role === 'screen' || phase.includes('flash') || phase.includes('glint') || phase.includes('vignette')) {
    family = 'screen-pulse'
    rotationZ = 0
    xOffset = 0
    yOffset = Math.sin(t * 2.6) * 0.01
    scaleMultiplier += 0.08 * Math.sin(t * 2.4)
    opacityMultiplier = 1.12 + 0.16 * Math.sin(t * 2.8)
  } else if (surface.role === 'volume' || phase.includes('cloud') || phase.includes('smoke') || phase.includes('mist')) {
    family = 'volume-drift'
    xOffset += Math.sin(t * 0.7) * 0.035
    yOffset += Math.cos(t * 0.55) * 0.025
    scaleMultiplier += 0.05 * Math.sin(t * 0.9)
    opacityMultiplier = 0.76 + 0.08 * Math.sin(t)
  } else if (surface.role === 'impact' || phase.includes('spark') || phase.includes('shard')) {
    family = 'impact-decay'
    rotationZ += t * 0.45
    scaleMultiplier += Math.min(0.18, elapsedSeconds / Math.max(0.2, controls.lifetime) * 0.18)
    opacityMultiplier = Math.max(0.55, 1 - elapsedSeconds / Math.max(0.35, controls.lifetime) * 0.35)
  }

  return {
    rotationZ: roundMetric(rotationZ),
    xOffset: roundMetric(xOffset),
    yOffset: roundMetric(yOffset),
    scaleMultiplier: roundMetric(Math.max(0.2, scaleMultiplier)),
    opacityMultiplier: roundMetric(Math.max(0.05, opacityMultiplier)),
    signature: `${family}:${surface.phase ?? surface.kind}`,
  }
}

export function getPfxBurstCycleSeconds(
  preset:
    | (Pick<PfxPreset, 'controls'> & Partial<Pick<PfxPreset, 'effectId' | 'implementationProfile'>>)
    | { controls: Pick<PfxControls, 'lifetime' | 'timing' | 'style'> },
): number {
  const styleProfile = getPfxStyleRenderProfile(preset.controls.style)
  const period = Math.max(0.3, Math.max(0.25, preset.controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
  const baseSeconds = period / (Math.max(0.05, preset.controls.timing) * styleProfile.motionMultiplier)
  // v2 recipes extend the cycle so every particle completes birth->death,
  // and the recipe's tempo compresses the whole clock.
  if ('effectId' in preset && preset.effectId && 'implementationProfile' in preset && preset.implementationProfile) {
    const plan = getPfxRenderPlan(preset as Pick<PfxPreset, 'effectId' | 'implementationProfile' | 'controls'>)
    const scaled = baseSeconds / Math.max(0.1, plan.tempo)
    if (plan.feelVersion >= 2) return scaled * getPfxCycleScale(plan.surfaces)
    return scaled
  }
  return baseSeconds
}

export function createPfxSparkGapGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const white: readonly [number, number, number] = [1, 1, 0.82]
  const gold: readonly [number, number, number] = [1, 0.58, 0.04]
  const orange: readonly [number, number, number] = [1, 0.18, 0.005]
  const branches = [
    [[-0.58, 0.02, 0.02], [-0.28, 0.13, 0.1], [-0.03, -0.08, -0.04], [0.27, 0.11, 0.08], [0.58, 0.01, -0.02]],
    [[-0.56, -0.05, 0.14], [-0.24, -0.17, 0.36], [0.04, 0.05, 0.1], [0.31, -0.1, -0.2], [0.56, 0.04, -0.08]],
    [[-0.54, 0.08, -0.48], [-0.3, 0.23, -0.18], [-0.02, -0.02, 0.04], [0.24, 0.18, 0.3], [0.54, -0.02, 0.55]],
  ] as const
  const push = (point: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(point.x, point.y, point.z)
    colors.push(...color)
  }
  const triangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    push(a, aColor)
    push(b, bColor)
    push(c, cColor)
  }
  const worldUp = new THREE.Vector3(0, 1, 0)
  const worldDepth = new THREE.Vector3(0, 0, 1)
  let segmentCount = 0
  for (const [branchIndex, branch] of branches.entries()) {
    for (let segment = 0; segment < branch.length - 1; segment += 1) {
      const start = new THREE.Vector3(...branch[segment]!)
      const end = new THREE.Vector3(...branch[segment + 1]!)
      const direction = end.clone().sub(start).normalize()
      const reference = Math.abs(direction.dot(worldUp)) > 0.86 ? worldDepth : worldUp
      const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
      const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
      const startWidth = 0.024 - branchIndex * 0.002
      const endWidth = startWidth * 0.7
      const ring = (center: THREE.Vector3, radius: number) => [
        center.clone().addScaledVector(tangent, radius).addScaledVector(bitangent, radius),
        center.clone().addScaledVector(tangent, -radius).addScaledVector(bitangent, radius),
        center.clone().addScaledVector(tangent, -radius).addScaledVector(bitangent, -radius),
        center.clone().addScaledVector(tangent, radius).addScaledVector(bitangent, -radius),
      ]
      const a = ring(start, startWidth)
      const b = ring(end, endWidth)
      const startColor = segment <= 1 ? gold : white
      const endColor = segment >= 2 ? orange : white
      for (let side = 0; side < 4; side += 1) {
        const next = (side + 1) % 4
        triangle(a[side]!, a[next]!, b[next]!, startColor, startColor, endColor)
        triangle(a[side]!, b[next]!, b[side]!, startColor, endColor, endColor)
      }
      triangle(a[0]!, a[2]!, a[1]!, startColor, startColor, startColor)
      triangle(a[0]!, a[3]!, a[2]!, startColor, startColor, startColor)
      triangle(b[0]!, b[1]!, b[2]!, endColor, endColor, endColor)
      triangle(b[0]!, b[2]!, b[3]!, endColor, endColor, endColor)
      segmentCount += 1
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSparkGapGeometry'] = 'single-draw-closed-volumetric-zig-zag-forks'
  geometry.userData['pfxSparkGapDrawCalls'] = 1
  geometry.userData['pfxSparkGapSegmentCount'] = segmentCount
  geometry.userData['pfxSparkGapDepthBranchCount'] = branches.filter((branch) => {
    const depths = branch.map((point) => point[2])
    return Math.max(...depths) - Math.min(...depths) > 0.45
  }).length
  geometry.userData['pfxSparkGapClosedFaces'] = true
  return geometry
}

export function createPfxSparkGapMaterial(opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  })
  material.userData['pfxSparkGapMaterial'] = 'additive-white-gold-closed-arc-forks'
  return material
}
