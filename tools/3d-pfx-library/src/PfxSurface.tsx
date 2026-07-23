import * as THREE from 'three'
import { RefObject, useEffect, useMemo, useRef } from 'react'
import { PFX_SPRITE_SLICES } from './particleSprites'
import { useFrame } from '@react-three/fiber'
import { getPfxStyleRenderProfile } from './constants/01'
import { roundMetric } from './constants/03'
import { PFX_BURST_CYCLE_MULTIPLIER, PFX_PARTICLE_BASE_SIZE, buildPfxSpriteEmissionGeometry, createPfxFlameBurstGeometry, createPfxFlameBurstRuntimeState, createPfxMeteorBurstGeometry, getPfxSharedParticleTexture, getPfxSharedSpriteAtlasTexture } from './constants/04'
import { PFX_ARC_INNER_RADIUS, PFX_ARC_OUTER_RADIUS, PFX_ARC_THETA_LENGTH, PFX_ARC_THETA_START, createPfxComboRingMaterial, createPfxExhaustTelegraphMaterial, createPfxHologramBreakMaterial, createPfxMarkerReleaseMaterial, createPfxScanConeMaterial, createPfxTargetSpawnMaterial, createPfxThrusterTrailMaterial, createPfxUiPickupMaterial, createPfxWarningLoopMaterial, getPfxSharedGradientTexture, isPfxOmniLightRead } from './constants/05'
import { buildPfxMeshShaderMaterial, createPfxFlameBurstMaterial, createPfxHologramBreakRuntimeState, createPfxMarkerReleaseRuntimeState, createPfxMeteorBurstMaterial, createPfxScanConeRuntimeState, createPfxThrusterTrailRuntimeState, createPfxWarningLoopRuntimeState } from './constants/06'
import { PFX_PROJECTILE_COMET_TAIL_LOBES, PFX_SMOKE_BILLOW_LOBES, PFX_SPAWN_VOXEL_LAYOUT, createPfxComboRingRuntimeState, createPfxExhaustTelegraphRuntimeState, createPfxMeteorBurstRuntimeState, createPfxTargetSpawnRuntimeState, createPfxUiPickupRuntimeState, shouldApplyPfxSurfaceCameraFacing, shouldRotatePfxBurstPattern } from './constants/07'
import { createPfxAcidBurstCrownGeometry, createPfxAcidBurstCrownMaterial } from './effects/acidBurstCrown'
import { createPfxAcidBurstDropletGeometry, createPfxAcidBurstDropletMaterial } from './effects/acidBurstDroplet'
import { applyPfxAcidBurstMaterialAppearance } from './effects/acidBurstMaterial'
import { createPfxAcidPoolGeometry } from './effects/acidPool'
import { createPfxAcidSpawnGeometry, createPfxAcidSpawnMaterial } from './effects/acidSpawn'
import { applyPfxAcidSpawnMaterialAppearance } from './effects/acidSpawnMaterial'
import { createPfxArcSweepErosionStrength } from './effects/arcSweepErosionStrength'
import { createPfxBarrierBreachRibGeometry, createPfxBarrierBreachRibMaterial } from './effects/barrierBreachRib'
import { createPfxBarrierColumnGeometry, createPfxBarrierColumnMaterial } from './effects/barrierColumn'
import { applyPfxBarrierColumnMaterialAppearance } from './effects/barrierColumnMaterial'
import { createPfxBarrierLowHealthGeometry, createPfxBarrierLowHealthMaterial } from './effects/barrierLowHealth'
import { createPfxBeamTelegraphMaterial } from './effects/beamTelegraph'
import { createPfxBeamTelegraphApertureGeometry } from './effects/beamTelegraphAperture'
import { createPfxBeamTelegraphLaneGeometry } from './effects/beamTelegraphLane'
import { applyPfxBeamTelegraphMaterialAppearance } from './effects/beamTelegraphMaterial'
import { createPfxBlastBeamGeometry } from './effects/blastBeam'
import { createPfxBlastBurstGeometry, createPfxBlastBurstMaterial, createPfxBlastBurstRuntimeState } from './effects/blastBurst'
import { createPfxBloodDeathGeometry, createPfxBloodDeathMaterial } from './effects/bloodDeath'
import { applyPfxBloodDeathMaterialAppearance } from './effects/bloodDeathMaterial'
import { createPfxCoinGoldMaterial } from './effects/coinGold'
import { createPfxCoinRewardBurstGeometry, createPfxCoinRewardBurstMaterial } from './effects/coinRewardBurst'
import { createPfxCurseBurstBindingGeometry, createPfxCurseBurstBindingMaterial } from './effects/curseBurstBinding'
import { createPfxCurseBurstEffigyGeometry, createPfxCurseBurstEffigyMaterial } from './effects/curseBurstEffigy'
import { applyPfxCurseBurstMaterialAppearance } from './effects/curseBurstMaterial'
import { createPfxCurseColumnGeometry } from './effects/curseColumn'
import { createPfxCurseConeGeometry, createPfxCurseConeMaterial } from './effects/curseCone'
import { applyPfxCurseConeMaterialAppearance } from './effects/curseConeMaterial'
import { createPfxDashIdleGeometry, createPfxDashIdleMaterial } from './effects/dashIdle'
import { applyPfxDashIdleMaterialAppearance } from './effects/dashIdleMaterial'
import { createPfxDebrisBurstGeometry, createPfxDebrisBurstMaterial, createPfxDebrisBurstRuntimeState } from './effects/debrisBurst'
import { createPfxDebrisMissFragmentGeometry, createPfxDebrisMissFragmentMaterial } from './effects/debrisMissFragment'
import { createPfxDebrisReleaseFragmentGeometry, createPfxDebrisReleaseFragmentMaterial } from './effects/debrisReleaseFragment'
import { createPfxDespawnImpactGeometry, createPfxDespawnImpactMaterial } from './effects/despawnImpact'
import { applyPfxDespawnImpactMaterialAppearance } from './effects/despawnImpactMaterial'
import { createPfxDustBurstGeometry, createPfxDustBurstMaterial, createPfxDustBurstRuntimeState } from './effects/dustBurst'
import { applyPfxElectricCriticalAppearance, createPfxElectricCriticalMaterial } from './effects/electricCritical'
import { createPfxElectricCriticalNexusGeometry, createPfxElectricCriticalNexusMaterial } from './effects/electricCriticalNexus'
import { createPfxElectricCriticalVoltageCageGeometry } from './effects/electricCriticalVoltageCage'
import { createPfxElectricTrailLifecycle } from './effects/electricTrail'
import { createPfxElectricWakeGeometry } from './effects/electricWake'
import { createPfxEmberFragmentGeometry, createPfxEmberFragmentMaterial } from './effects/emberFragment'
import { createPfxEmberIgnitionGeometry, createPfxEmberIgnitionMaterial } from './effects/emberIgnition'
import { createPfxExhaustHitNozzleGeometry, createPfxExhaustHitNozzleMaterial } from './effects/exhaustHitNozzle'
import { createPfxFlameChargeCrucibleGeometry, createPfxFlameChargeCrucibleMaterial } from './effects/flameChargeCrucible'
import { getPfxFlameChargeLightProfile } from './effects/flameChargeLightProfile'
import { createPfxFlameChargeTendrilGeometry, createPfxFlameChargeTendrilMaterial } from './effects/flameChargeTendril'
import { getPfxFlipbookFrameProps } from './effects/flipbookFrameProps'
import { createPfxFootstepAmbientGeometry, createPfxFootstepAmbientMaterial } from './effects/footstepAmbient'
import { applyPfxFootstepAmbientMaterialAppearance } from './effects/footstepAmbientMaterial'
import { createPfxFrostAuraGeometry, createPfxFrostAuraMaterial } from './effects/frostAura'
import { createPfxFrostAuraCrystalGlintMaterial } from './effects/frostAuraCrystalGlint'
import { applyPfxFrostAuraMaterialCycle, applyPfxFrostAuraMaterialOpacity } from './effects/frostAuraMaterial'
import { createPfxGhostCriticalTalonGeometry, createPfxGhostCriticalTalonMaterial } from './effects/ghostCriticalTalon'
import { createPfxGhostTrailGeometry, createPfxGhostTrailMaterial } from './effects/ghostTrail'
import { applyPfxGhostTrailMaterialAppearance } from './effects/ghostTrailMaterial'
import { createPfxGlyphTrailMaterial } from './effects/glyphTrail'
import { createPfxGlyphTrailLeadSigilGeometry } from './effects/glyphTrailLeadSigil'
import { applyPfxGlyphTrailMaterialCycle, applyPfxGlyphTrailMaterialOpacity } from './effects/glyphTrailMaterial'
import { createPfxGlyphTrailRuneChainGeometry } from './effects/glyphTrailRuneChain'
import { createPfxHealingBurstBloomGeometry, createPfxHealingBurstBloomMaterial } from './effects/healingBurstBloom'
import { createPfxHealingBurstLeafGeometry, createPfxHealingBurstLeafMaterial } from './effects/healingBurstLeaf'
import { applyPfxHealingBurstMaterialAppearance } from './effects/healingBurstMaterial'
import { createPfxHealingBurstReferenceGeometry, createPfxHealingBurstReferenceMaterial } from './effects/healingBurstReference'
import { createPfxHealingFocalGeometry, createPfxHealingFocalMaterial } from './effects/healingFocal'
import { createPfxHealingGlyphGeometry, createPfxHealingGlyphLayout, createPfxHealingGlyphMaterial } from './effects/healingGlyph'
import { createPfxHealingLeafEdgeMaterial } from './effects/healingLeafEdge'
import { createPfxHealingLeafHelixLayout } from './effects/healingLeafHelix'
import { createPfxHealingLoopGeometry, createPfxHealingLoopMaterial } from './effects/healingLoop'
import { applyPfxHealingLoopMaterialAppearance } from './effects/healingLoopMaterial'
import { createPfxHealingSparkleGeometry, createPfxHealingSparkleLayout } from './effects/healingSparkle'
import { createPfxHealingVineGeometry, createPfxHealingVineMaterial } from './effects/healingVine'
import { createPfxHolyBurstFeatherGeometry, createPfxHolyBurstFeatherMaterial } from './effects/holyBurstFeather'
import { applyPfxHolyBurstMaterialAppearance } from './effects/holyBurstMaterial'
import { createPfxHolyBurstReferenceGeometry, createPfxHolyBurstReferenceMaterial } from './effects/holyBurstReference'
import { createPfxHolyBurstSunGeometry, createPfxHolyBurstSunMaterial } from './effects/holyBurstSun'
import { createPfxHolyReleaseGeometry, createPfxHolyReleaseMaterial } from './effects/holyRelease'
import { applyPfxHolyReleaseMaterialAppearance } from './effects/holyReleaseMaterial'
import { applyPfxIceImpactAppearance, createPfxIceImpactGeometry, createPfxIceImpactMaterial } from './effects/iceImpact'
import { createPfxImpactCoreGeometry, createPfxImpactCoreMaterial } from './effects/impactCore'
import { createPfxImpactShardBurstGeometry, createPfxImpactShardBurstMaterial } from './effects/impactShardBurst'
import { createPfxJumpBeamGeometry, createPfxJumpBeamMaterial } from './effects/jumpBeam'
import { applyPfxJumpBeamMaterialAppearance } from './effects/jumpBeamMaterial'
import { createPfxJumpPickupCradleGeometry, createPfxJumpPickupCradleMaterial } from './effects/jumpPickupCradle'
import { createPfxJumpPickupRewardGemGeometry, createPfxJumpPickupRewardGemMaterial } from './effects/jumpPickupRewardGem'
import { createPfxLaserSprayMaterial } from './effects/laserSpray'
import { createPfxLaserSprayBoltRackGeometry } from './effects/laserSprayBoltRack'
import { applyPfxLaserSprayMaterialAppearance } from './effects/laserSprayMaterial'
import { createPfxLaserSprayNozzleGeometry } from './effects/laserSprayNozzle'
import { createPfxLeafBurstCanopyGeometry, createPfxLeafBurstCanopyMaterial } from './effects/leafBurstCanopy'
import { applyPfxLeafBurstMaterialAppearance } from './effects/leafBurstMaterial'
import { createPfxLeafBurstVeinGeometry, createPfxLeafBurstVeinMaterial } from './effects/leafBurstVein'
import { createPfxMagicCircleGeometry, createPfxMagicCircleMaterial } from './effects/magicCircle'
import { getPfxMeshBreakProgress } from './effects/meshBreak'
import { createPfxMeteorChunkGeometry, createPfxMeteorChunkLayout, createPfxMeteorChunkMaterial } from './effects/meteorChunk'
import { createPfxMeteorHeatFrontGeometry } from './effects/meteorHeatFront'
import { applyPfxMeteorImpactAppearance, createPfxMeteorImpactGeometry, createPfxMeteorImpactMaterial } from './effects/meteorImpact'
import { getPfxMeteorImpactLightProfile } from './effects/meteorImpactLightProfile'
import { createPfxMudBurstClodGeometry, createPfxMudBurstClodMaterial } from './effects/mudBurstClod'
import { createPfxMudBurstCrownGeometry, createPfxMudBurstCrownMaterial } from './effects/mudBurstCrown'
import { applyPfxMudBurstMaterialAppearance } from './effects/mudBurstMaterial'
import { createPfxMudBurstReferenceGeometry, createPfxMudBurstReferenceMaterial } from './effects/mudBurstReference'
import { createPfxMudChargeGeometry, createPfxMudChargeMaterial } from './effects/mudCharge'
import { applyPfxMudChargeMaterialAppearance } from './effects/mudChargeMaterial'
import { createPfxMuzzleFlameGeometry, createPfxMuzzleFlameMaterial } from './effects/muzzleFlame'
import { createPfxPetalAmbientGeometry, createPfxPetalAmbientMaterial } from './effects/petalAmbient'
import { applyPfxPetalAmbientMaterialAppearance } from './effects/petalAmbientMaterial'
import { createPfxPetalBurstCanopyGeometry, createPfxPetalBurstCanopyMaterial } from './effects/petalBurstCanopy'
import { applyPfxPetalBurstMaterialAppearance } from './effects/petalBurstMaterial'
import { createPfxPetalBurstStamenGeometry, createPfxPetalBurstStamenMaterial } from './effects/petalBurstStamen'
import { createPfxPickupBurstGeometry, createPfxPickupBurstMaterial } from './effects/pickupBurst'
import { applyPfxPickupBurstMaterialAppearance } from './effects/pickupBurstMaterial'
import { createPfxPlasmaAmbientCoreGeometry, createPfxPlasmaAmbientCoreMaterial } from './effects/plasmaAmbientCore'
import { createPfxPlasmaAmbientOrbitGeometry, createPfxPlasmaAmbientOrbitMaterial } from './effects/plasmaAmbientOrbit'
import { createPfxPlasmaHitMaterial } from './effects/plasmaHit'
import { createPfxPlasmaHitContactGeometry } from './effects/plasmaHitContact'
import { createPfxPlasmaHitFluxGeometry } from './effects/plasmaHitFlux'
import { applyPfxPlasmaHitMaterialAppearance } from './effects/plasmaHitMaterial'
import { applyPfxPlasmaImpactFlipbookAppearance, createPfxPlasmaImpactFlipbookMaterial } from './effects/plasmaImpactFlipbook'
import { createPfxPlasmaImpactVolumeGeometry } from './effects/plasmaImpactVolume'
import { createPfxPoisonBurstBloomGeometry, createPfxPoisonBurstBloomMaterial } from './effects/poisonBurstBloom'
import { applyPfxPoisonBurstMaterialAppearance } from './effects/poisonBurstMaterial'
import { createPfxPoisonBurstSporeGeometry, createPfxPoisonBurstSporeMaterial } from './effects/poisonBurstSpore'
import { createPfxPortalTelegraphGeometry, createPfxPortalTelegraphMaterial } from './effects/portalTelegraph'
import { applyPfxPortalTelegraphMaterialAppearance } from './effects/portalTelegraphMaterial'
import { createPfxPortalThroatGeometry } from './effects/portalThroat'
import { createPfxProjectileWakeGeometry } from './effects/projectileWake'
import { createPfxProjectileWakeEnvelope } from './effects/projectileWakeEnvelope'
import { createPfxRainBurstGeometry, createPfxRainBurstMaterial } from './effects/rainBurst'
import { createPfxRainBurstFoamGeometry, createPfxRainBurstFoamMaterial } from './effects/rainBurstFoam'
import { applyPfxRainBurstMaterialAppearance } from './effects/rainBurstMaterial'
import { createPfxRewardChargeGeometry, createPfxRewardChargeMaterial } from './effects/rewardCharge'
import { applyPfxRewardChargeMaterialAppearance } from './effects/rewardChargeMaterial'
import { getPfxRewardGemFacetColors } from './effects/rewardGemFacetColors'
import { getPfxRingPlaneRotation } from './effects/ringPlaneRotation'
import { createPfxSandBurstGeometry, createPfxSandBurstMaterial } from './effects/sandBurst'
import { applyPfxSandBurstMaterialAppearance } from './effects/sandBurstMaterial'
import { createPfxScreenVignetteMaterial } from './effects/screenVignette'
import { createPfxShadowBreakGeometry, createPfxShadowBreakMaterial } from './effects/shadowBreak'
import { applyPfxShadowBreakMaterialAppearance } from './effects/shadowBreakMaterial'
import { createPfxShadowBurstClawGeometry, createPfxShadowBurstClawMaterial } from './effects/shadowBurstClaw'
import { createPfxShadowBurstFragmentGeometry, createPfxShadowBurstFragmentMaterial } from './effects/shadowBurstFragment'
import { applyPfxShadowBurstMaterialAppearance } from './effects/shadowBurstMaterial'
import { createPfxShadowBurstReferenceGeometry, createPfxShadowBurstReferenceMaterial } from './effects/shadowBurstReference'
import { createPfxShardBreakFragmentGeometry, createPfxShardBreakFragmentMaterial } from './effects/shardBreakFragment'
import { createPfxShardBreakIgnitionCoreGeometry } from './effects/shardBreakIgnitionCore'
import { applyPfxShardBreakMaterialOpacity } from './effects/shardBreakMaterial'
import { createPfxShieldFragmentGeometry, createPfxShieldFragmentMaterial } from './effects/shieldFragment'
import { createPfxShockwaveBurstGeometry, createPfxShockwaveBurstMaterial, createPfxShockwaveBurstRuntimeState } from './effects/shockwaveBurst'
import { createPfxShockwaveSpawnArrivalFlareGeometry, createPfxShockwaveSpawnArrivalFlareMaterial } from './effects/shockwaveSpawnArrivalFlare'
import { createPfxShockwaveSpawnPressureFrontGeometry, createPfxShockwaveSpawnPressureFrontMaterial } from './effects/shockwaveSpawnPressureFront'
import { createPfxSlashArcGeometry } from './effects/slashArc'
import { createPfxSlimeBurstBubbleGeometry, createPfxSlimeBurstBubbleMaterial } from './effects/slimeBurstBubble'
import { createPfxSlimeBurstCrownGeometry, createPfxSlimeBurstCrownMaterial } from './effects/slimeBurstCrown'
import { applyPfxSlimeBurstMaterialAppearance } from './effects/slimeBurstMaterial'
import { createPfxSlimeRingGeometry, createPfxSlimeRingMaterial } from './effects/slimeRing'
import { applyPfxSlimeRingMaterialAppearance } from './effects/slimeRingMaterial'
import { createPfxSnowBurstCrystalGeometry, createPfxSnowBurstCrystalMaterial } from './effects/snowBurstCrystal'
import { applyPfxSnowBurstMaterialAppearance } from './effects/snowBurstMaterial'
import { createPfxSnowBurstPowderGeometry, createPfxSnowBurstPowderMaterial } from './effects/snowBurstPowder'
import { createPfxSnowIdleFlurryGeometry, createPfxSnowIdleFlurryMaterial } from './effects/snowIdleFlurry'
import { createPfxSnowIdleGranuleGeometry, createPfxSnowIdleGranuleMaterial } from './effects/snowIdleGranule'
import { applyPfxSnowIdleMaterialAppearance } from './effects/snowIdleMaterial'
import { createPfxSnowSpawnCradleGeometry, createPfxSnowSpawnCradleMaterial } from './effects/snowSpawnCradle'
import { applyPfxSparkConeMaterialOpacity } from './effects/sparkConeMaterial'
import { createPfxSparkConeStreakGeometry, createPfxSparkConeStreakMaterial } from './effects/sparkConeStreak'
import { createPfxSpawnScreenReticleGeometry, createPfxSpawnScreenReticleMaterial } from './effects/spawnScreenReticle'
import { createPfxSpriteEmissionMaterial } from './effects/spriteEmission'
import { getPfxSurfaceMaterialProps } from './effects/surfaceMaterialProps'
import { getPfxSurfacePositionOffset } from './effects/surfacePositionOffset'
import { applyPfxSurfaceRotation } from './effects/surfaceRotation'
import { getPfxSurfaceSpatialPolicy } from './effects/surfaceSpatialPolicy'
import { createPfxTargetBreakFragmentGeometry, createPfxTargetBreakFragmentMaterial } from './effects/targetBreakFragment'
import { createPfxTargetBreakReticleGeometry, createPfxTargetBreakReticleMaterial } from './effects/targetBreakReticle'
import { createPfxTargetLockShellGeometry } from './effects/targetLockShell'
import { createPfxTeleportHitGeometry, createPfxTeleportHitMaterial } from './effects/teleportHit'
import { applyPfxTeleportHitMaterialAppearance } from './effects/teleportHitMaterial'
import { createPfxWarpSprayFacetGeometry, createPfxWarpSprayFacetMaterial } from './effects/warpSprayFacet'
import { createPfxWaterColumnGeometry, createPfxWaterColumnMaterial } from './effects/waterColumn'
import { createPfxWaterColumnFoamGeometry, createPfxWaterColumnFoamMaterial } from './effects/waterColumnFoam'
import { applyPfxWaterColumnMaterialAppearance } from './effects/waterColumnMaterial'
import { createPfxWaterConeGeometry } from './effects/waterCone'
import { createPfxWindBeamLeafGeometry, createPfxWindBeamLeafMaterial } from './effects/windBeamLeaf'
import { applyPfxWindBeamLeafMaterialAppearance } from './effects/windBeamLeafMaterial'
import { createPfxWindBeamPressureGeometry, createPfxWindBeamPressureMaterial } from './effects/windBeamPressure'
import { applyPfxWindBeamPressureMaterialAppearance } from './effects/windBeamPressureMaterial'
import { applyPfxWindBurstMaterialAppearance } from './effects/windBurstMaterial'
import { createPfxWindBurstPressureGeometry, createPfxWindBurstPressureMaterial } from './effects/windBurstPressure'
import { createPfxWindBurstWakeGeometry, createPfxWindBurstWakeMaterial } from './effects/windBurstWake'
import { createPfxWindPressureGeometry, createPfxWindPressureMaterial } from './effects/windPressure'
import { createPfxParticleEmission } from './tooling/01'
import { createPfxSparkGapGeometry, createPfxSparkGapMaterial, getPfxSurfaceAnimationProps } from './tooling/05'
import type { PfxControls } from './types/01'
import type { PfxBlastBurstRuntimeState, PfxComboRingRuntimeState, PfxDebrisBurstRuntimeState, PfxDustBurstRuntimeState, PfxExhaustTelegraphRuntimeState, PfxFlameBurstRuntimeState, PfxHologramBreakRuntimeState, PfxImplementationProfile, PfxMarkerReleaseRuntimeState, PfxMeteorBurstRuntimeState, PfxRenderSurface, PfxScanConeRuntimeState, PfxShockwaveBurstRuntimeState, PfxTargetSpawnRuntimeState, PfxThrusterTrailRuntimeState, PfxUiPickupRuntimeState, PfxWarningLoopRuntimeState } from './types/02'

export function PfxSurface({
  surface,
  geometry,
  particleMaterial,
  coreMaterial,
  accentMaterial,
  controls,
  effectId,
  profile,
  previewTimeSeconds,
  feelVersion = 2,
  cycleScale = 1,
  tempo = 1,
  parentCameraPinned = false,
}: {
  surface: PfxRenderSurface
  geometry: THREE.BufferGeometry
  particleMaterial: THREE.PointsMaterial
  coreMaterial: THREE.MeshBasicMaterial
  accentMaterial: THREE.MeshBasicMaterial
  controls: PfxControls
  effectId: string
  profile: PfxImplementationProfile
  previewTimeSeconds?: number
  /** REVIEW SCAFFOLD: legacy (1) vs remediated (2) looks — delete the legacy
   * branches once the batch review is approved and merged. */
  feelVersion?: number
  /** Base periods per full cycle so long-lived particles complete (v2). */
  cycleScale?: number
  /** Whole-effect clock multiplier from the recipe. */
  tempo?: number
  /** UI-space parents already own the camera quaternion. */
  parentCameraPinned?: boolean
}) {
  const object = useRef<THREE.Object3D>(null)
  const comboRuntimeState = useRef<PfxComboRingRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    stage: 'rest',
  })
  const uiPickupRuntimeState = useRef<PfxUiPickupRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    rise: 0,
    stage: 'rest',
  })
  const targetSpawnRuntimeState = useRef<PfxTargetSpawnRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    lift: 0,
    stage: 'rest',
  })
  const warningLoopRuntimeState = useRef<PfxWarningLoopRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    pulse: 0,
    lift: 0,
    stage: 'inhale',
  })
  const markerReleaseRuntimeState = useRef<PfxMarkerReleaseRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    expansion: 0,
    lift: 0,
    stage: 'clamp',
  })
  const scanConeRuntimeState = useRef<PfxScanConeRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    sweep: 0,
    range: 0,
    stage: 'acquire',
  })
  const hologramBreakRuntimeState = useRef<PfxHologramBreakRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    breakAmount: 0,
    scan: 0,
    collapse: 0,
    stage: 'stabilize',
  })
  const thrusterTrailRuntimeState = useRef<PfxThrusterTrailRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    flow: 0,
    thrust: 0,
    cutoff: 0,
    stage: 'ignite',
  })
  const exhaustTelegraphRuntimeState = useRef<PfxExhaustTelegraphRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    urgency: 0,
    ventOpen: 0,
    release: 0,
    stage: 'arm',
  })
  const flameBurstRuntimeState = useRef<PfxFlameBurstRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    bloom: 0,
    heat: 0,
    peel: 0,
    cool: 0,
    stage: 'ignite',
  })
  const meteorBurstRuntimeState = useRef<PfxMeteorBurstRuntimeState>({
    cycle: 0,
    periodSeconds: 0,
    progress: 0,
    opacity: 0,
    impact: 0,
    flash: 0,
    scatter: 0,
    cool: 0,
    head: 0,
    stage: 'descent',
  })
  const blastBurstRuntimeState = useRef<PfxBlastBurstRuntimeState>({
    cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, breach: 0, flash: 0, scatter: 0, vacuum: 0, stage: 'compression',
  })
  const shockwaveBurstRuntimeState = useRef<PfxShockwaveBurstRuntimeState>({
    cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, expansion: 0, front: 0, attenuation: 0, stage: 'compression',
  })
  const dustBurstRuntimeState = useRef<PfxDustBurstRuntimeState>({
    cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, roll: 0, loft: 0, settle: 0, stage: 'contact',
  })
  const debrisBurstRuntimeState = useRef<PfxDebrisBurstRuntimeState>({
    cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, fracture: 0, eject: 0, fall: 0, darken: 0, stage: 'fracture',
  })
  const surfaceParentWorldQuaternion = useRef(new THREE.Quaternion())
  const materialProps = getPfxSurfaceMaterialProps(surface, controls)
  const styleProfile = getPfxStyleRenderProfile(controls.style)
  const spatialPolicy = getPfxSurfaceSpatialPolicy(surface)
  const positionOffset = getPfxSurfacePositionOffset(surface)
  const segmentCount = styleProfile.geometrySegments
  const isSimulatedPoints = surface.kind === 'particles' || surface.kind === 'impact-sparks'
  const emission = useMemo(
    () =>
      isSimulatedPoints
        ? createPfxParticleEmission({ effectId, controls, implementationProfile: profile }, surface)
        : null,
    [controls, effectId, isSimulatedPoints, profile, surface],
  )
  const isMeteorChunkEmission = emission?.motionKind === 'meteor-impact'
  const spriteGeometry = useMemo(
    () => (emission && !isMeteorChunkEmission ? buildPfxSpriteEmissionGeometry(emission) : null),
    [emission, isMeteorChunkEmission],
  )
  const meteorChunkGeometry = useMemo(
    () => isMeteorChunkEmission ? createPfxMeteorChunkGeometry() : null,
    [isMeteorChunkEmission],
  )
  const meteorChunkMaterial = useMemo(
    () => isMeteorChunkEmission ? createPfxMeteorChunkMaterial() : null,
    [isMeteorChunkEmission],
  )
  const meteorHeatFrontGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'meteor-ring-heat-front'
      ? createPfxMeteorHeatFrontGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const shockwaveSpawnPressureFrontGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'shockwave-spawn-pressure-front'
      ? createPfxShockwaveSpawnPressureFrontGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const shockwaveSpawnPressureFrontMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'shockwave-spawn-pressure-front'
      ? createPfxShockwaveSpawnPressureFrontMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.tuning?.meshGeometry],
  )
  const meteorChunkMatrixObject = useMemo(() => new THREE.Object3D(), [])
  const meteorChunkColor = useMemo(() => new THREE.Color(), [])
  const plasmaAmbientCoreGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'plasma-ambient-contained-core'
      ? createPfxPlasmaAmbientCoreGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const plasmaAmbientOrbitGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'plasma-ambient-broken-orbits'
      ? createPfxPlasmaAmbientOrbitGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const snowSpawnCradleGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'snow-spawn-frost-cradle'
      ? createPfxSnowSpawnCradleGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const muzzleFlameGeometry = useMemo(
    () => surface.kind === 'muzzle-cone' && !surface.phase?.includes('crown') ? createPfxMuzzleFlameGeometry() : null,
    [surface.kind, surface.phase],
  )
  const impactCoreGeometry = useMemo(
    () => surface.kind === 'impact-core'
      ? surface.tuning?.meshGeometry === 'exhaust-hit-mechanical-nozzle'
        ? createPfxExhaustHitNozzleGeometry()
        : surface.phase === 'ember-ignition-core'
          ? createPfxEmberIgnitionGeometry()
          : createPfxImpactCoreGeometry()
      : null,
    [surface.kind, surface.phase, surface.tuning?.meshGeometry],
  )
  const impactShardGeometry = useMemo(
    () => surface.kind === 'impact-shards' || (surface.tuning?.meshGeometry as string | undefined) === 'dust-burst-grounded-crown'
        ? surface.tuning?.meshGeometry === 'flame-burst-folded-tongues' || surface.tuning?.meshGeometry === 'holy-burst-reference-sacred-flame'
        ? createPfxFlameBurstGeometry()
        : surface.tuning?.meshGeometry === 'meteor-burst-impact-diorama'
        ? createPfxMeteorBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'blast-burst-airborne-detonation'
        ? createPfxBlastBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'shockwave-burst-broken-pressure-dome'
        ? createPfxShockwaveBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'dust-burst-grounded-crown'
        ? createPfxDustBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'debris-burst-fractured-mass'
        ? createPfxDebrisBurstGeometry()
        : surface.tuning?.meshGeometry === 'flame-charge-convergence-tendrils'
        ? createPfxFlameChargeTendrilGeometry()
        : surface.tuning?.meshGeometry === 'meteor-ring-impact-crater'
          ? createPfxMeteorImpactGeometry()
        : surface.tuning?.meshGeometry === 'shockwave-spawn-arrival-flare'
          ? createPfxShockwaveSpawnArrivalFlareGeometry()
        : surface.tuning?.meshGeometry === 'shard-break-crystal-fragments'
        ? createPfxShardBreakFragmentGeometry()
        : surface.tuning?.meshGeometry === 'shard-break-ignition-core'
        ? createPfxShardBreakIgnitionCoreGeometry()
        : surface.tuning?.meshGeometry === 'ice-impact-grounded-splinters'
        ? createPfxIceImpactGeometry()
        : surface.tuning?.meshGeometry === 'frost-aura-crystal-crown'
        ? createPfxFrostAuraGeometry()
        : surface.tuning?.meshGeometry === 'frost-aura-crystal-glint'
        ? createPfxFrostAuraGeometry()
        : surface.tuning?.meshGeometry === 'water-column-churning-body'
        ? createPfxWaterColumnGeometry()
        : surface.tuning?.meshGeometry === 'water-column-foam-spray'
        ? createPfxWaterColumnFoamGeometry()
        : surface.tuning?.meshGeometry === 'snow-idle-flurry-field'
        ? createPfxSnowIdleFlurryGeometry()
        : surface.tuning?.meshGeometry === 'snow-idle-depth-granules'
        ? createPfxSnowIdleGranuleGeometry()
        : surface.tuning?.meshGeometry === 'wind-beam-debris-leaves'
        ? createPfxWindBeamLeafGeometry()
        : surface.tuning?.meshGeometry === 'petal-ambient-drifting-blossoms'
        ? createPfxPetalAmbientGeometry()
        : surface.tuning?.meshGeometry === 'sand-burst-sculpted-fan'
        ? createPfxSandBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'rain-burst-water-crown'
        ? createPfxRainBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'rain-burst-rain-foam'
        ? createPfxRainBurstFoamGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'snow-burst-crystal-bloom'
        ? createPfxSnowBurstCrystalGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'snow-burst-powder-drift'
        ? createPfxSnowBurstPowderGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'wind-burst-pressure-rosette'
        ? createPfxWindBurstPressureGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'wind-burst-wake-wisps'
        ? createPfxWindBurstWakeGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'leaf-burst-sculpted-canopy'
        ? createPfxLeafBurstCanopyGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'leaf-burst-vein-seed-curls'
        ? createPfxLeafBurstVeinGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'petal-burst-sculpted-corolla'
        ? createPfxPetalBurstCanopyGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'petal-burst-stamen-pollen-calyx'
        ? createPfxPetalBurstStamenGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-sculpted-crown'
        ? createPfxMudBurstCrownGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-ballistic-clods'
        ? createPfxMudBurstClodGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'slime-burst-sculpted-gel-crown'
        ? createPfxSlimeBurstCrownGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'slime-burst-bubble-droplet-volume'
        ? createPfxSlimeBurstBubbleGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'poison-burst-vapor-lobe-cluster'
        ? createPfxPoisonBurstBloomGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'poison-burst-spore-pod-volume'
        ? createPfxPoisonBurstSporeGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'acid-burst-sculpted-splash-crown'
        ? createPfxAcidBurstCrownGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'acid-burst-ballistic-droplet-volume'
        ? createPfxAcidBurstDropletGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-renewal-bloom'
        ? createPfxHealingBurstBloomGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-rising-leaf-volume'
        ? createPfxHealingBurstLeafGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-cleansing-sunburst'
        ? createPfxHolyBurstSunGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-ascending-feather-volume'
        ? createPfxHolyBurstFeatherGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'curse-burst-malediction-effigy'
        ? createPfxCurseBurstEffigyGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'curse-burst-snapped-binding-chains'
        ? createPfxCurseBurstBindingGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-spectral-claw'
        ? createPfxShadowBurstClawGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-void-fragments'
        ? createPfxShadowBurstFragmentGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-splash-crown'
        ? createPfxMudBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-clod-eruption'
        ? createPfxMudBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-earth-crown'
        ? createPfxMudBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-wet-clot-splash'
        ? createPfxMudBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-reference-helix'
        ? createPfxHealingBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-reference-bloom'
        ? createPfxHealingBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-sacred-flame'
        ? createPfxHolyBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-sanctity-sun'
        ? createPfxHolyBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-mandorla'
        ? createPfxHolyBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-reference-claw'
        ? createPfxShadowBurstReferenceGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-reference-fracture'
        ? createPfxShadowBurstReferenceGeometry()
        : surface.tuning?.meshGeometry === 'mud-charge-sculpted-clods'
        ? createPfxMudChargeGeometry()
        : surface.tuning?.meshGeometry === 'slime-ring-viscous-annulus'
        ? createPfxSlimeRingGeometry()
        : surface.tuning?.meshGeometry === 'acid-spawn-corrosive-aperture'
        ? createPfxAcidSpawnGeometry()
        : surface.tuning?.meshGeometry === 'healing-loop-renewal-helix'
        ? createPfxHealingLoopGeometry()
        : surface.tuning?.meshGeometry === 'holy-release-radiant-mandorla'
        ? createPfxHolyReleaseGeometry()
        : surface.tuning?.meshGeometry === 'curse-cone-twisted-thorn-fan'
        ? createPfxCurseConeGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-break-rupture-cluster'
        ? createPfxShadowBreakGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'blood-death-pigment-rupture'
        ? createPfxBloodDeathGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'ghost-trail-spectral-procession'
        ? createPfxGhostTrailGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'portal-telegraph-countdown-aperture'
        ? createPfxPortalTelegraphGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'warp-spray-displaced-facets'
        ? createPfxWarpSprayFacetGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'teleport-hit-arrival-scar'
        ? createPfxTeleportHitGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'barrier-column-fortified-pillar'
        ? createPfxBarrierColumnGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'dash-idle-vector-reservoir'
        ? createPfxDashIdleGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'jump-beam-updraft-accelerator'
        ? createPfxJumpBeamGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'footstep-ambient-cadence-wake'
        ? createPfxFootstepAmbientGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'pickup-burst-reward-receipt'
        ? createPfxPickupBurstGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'reward-charge-gilded-capacitor'
        ? createPfxRewardChargeGeometry()
        : (surface.tuning?.meshGeometry as string | undefined) === 'despawn-impact-absence-cage'
        ? createPfxDespawnImpactGeometry()
        : surface.tuning?.meshGeometry === 'glyph-trail-rune-chain'
        ? createPfxGlyphTrailRuneChainGeometry()
        : surface.tuning?.meshGeometry === 'glyph-trail-lead-sigil'
        ? createPfxGlyphTrailLeadSigilGeometry()
        : surface.tuning?.meshGeometry === 'beam-telegraph-warning-lane'
        ? createPfxBeamTelegraphLaneGeometry()
        : surface.tuning?.meshGeometry === 'beam-telegraph-source-aperture'
        ? createPfxBeamTelegraphApertureGeometry()
        : surface.tuning?.meshGeometry === 'laser-spray-volumetric-nozzle'
        ? createPfxLaserSprayNozzleGeometry()
        : surface.tuning?.meshGeometry === 'laser-spray-bolt-rack'
        ? createPfxLaserSprayBoltRackGeometry()
        : surface.tuning?.meshGeometry === 'plasma-hit-contact-bloom'
        ? createPfxPlasmaHitContactGeometry()
        : surface.tuning?.meshGeometry === 'plasma-hit-broken-flux-arcs'
        ? createPfxPlasmaHitFluxGeometry()
        : surface.tuning?.meshGeometry === 'electric-critical-faceted-nexus'
        ? createPfxElectricCriticalNexusGeometry()
        : surface.tuning?.meshGeometry === 'electric-critical-diagonal-discharge' || surface.tuning?.meshGeometry === 'electric-critical-impact-starburst' || surface.tuning?.meshGeometry === 'electric-critical-voltage-cage'
        ? createPfxElectricCriticalVoltageCageGeometry()
        : surface.tuning?.meshGeometry === 'spark-cone-streak-prisms'
        ? createPfxSparkConeStreakGeometry()
        : surface.tuning?.meshGeometry === 'debris-release-rock-fragments'
        ? createPfxDebrisReleaseFragmentGeometry()
        : surface.tuning?.meshGeometry === 'debris-miss-rock-fragments'
        ? createPfxDebrisMissFragmentGeometry()
        : surface.tuning?.meshGeometry === 'barrier-low-health-breach-ribs'
          ? createPfxBarrierBreachRibGeometry()
        : surface.tuning?.meshGeometry === 'ghost-critical-spectral-talons'
          ? createPfxGhostCriticalTalonGeometry()
        : surface.phase === 'spark-gap-fork-volume'
        ? createPfxSparkGapGeometry()
        : surface.phase === 'ember-ballistic-launch'
          ? createPfxEmberFragmentGeometry()
          : createPfxImpactShardBurstGeometry()
      : null,
    [surface.kind, surface.phase, surface.tuning?.meshGeometry],
  )
  const coinRewardBurstGeometry = useMemo(
    () => surface.kind === 'coin-reward-burst' ? createPfxCoinRewardBurstGeometry() : null,
    [surface.kind],
  )
  const shieldFragmentGeometry = useMemo(
    () => surface.kind === 'shield-fragments'
      ? surface.tuning?.meshGeometry === 'target-break-honeycomb-fragments'
        ? createPfxTargetBreakFragmentGeometry()
        : createPfxShieldFragmentGeometry()
      : null,
    [surface.kind, surface.tuning?.meshGeometry],
  )
  const targetLockShellGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'target-break-lock-shell'
      ? createPfxTargetLockShellGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const barrierLowHealthGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'barrier-low-health-fractured-shell'
      ? createPfxBarrierLowHealthGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const flameChargeCrucibleGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'flame-charge-trefoil-crucible'
      ? createPfxFlameChargeCrucibleGeometry()
      : null,
    [surface.tuning?.meshGeometry],
  )
  const targetBreakReticleGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'target-break-ground-reticle'
      ? createPfxTargetBreakReticleGeometry(materialProps.color)
      : null,
    [materialProps.color, surface.tuning?.meshGeometry],
  )
  const portalThroatGeometry = useMemo(
    () => surface.tuning?.meshShader === 'portal-throat' ? createPfxPortalThroatGeometry() : null,
    [surface.tuning?.meshShader],
  )
  const projectileWakeGeometry = useMemo(
    () => surface.tuning?.meshShader === 'projectile-wake' ? createPfxProjectileWakeGeometry() : null,
    [surface.tuning?.meshShader],
  )
  const electricWakeGeometry = useMemo(
    () => surface.tuning?.meshShader === 'electric-wake' ? createPfxElectricWakeGeometry() : null,
    [surface.tuning?.meshShader],
  )
  const windPressureGeometry = useMemo(
    () => surface.kind === 'wind-streaks'
      ? surface.tuning?.meshGeometry === 'wind-beam-pressure-ribbons'
        ? createPfxWindBeamPressureGeometry()
        : createPfxWindPressureGeometry()
      : null,
    [surface.kind, surface.tuning?.meshGeometry],
  )
  const acidPoolGeometry = useMemo(
    () => surface.kind === 'acid-pool' ? createPfxAcidPoolGeometry() : null,
    [surface.kind],
  )
  const blastBeamGeometry = useMemo(
    () => surface.kind === 'beam-column' && surface.tuning?.lifecycle === 'blast-beam-sustain'
      ? createPfxBlastBeamGeometry()
      : null,
    [surface.kind, surface.tuning?.lifecycle],
  )
  const curseColumnGeometry = useMemo(
    () => surface.kind === 'beam-column' && surface.tuning?.meshGeometry === 'curse-twisted-spire'
      ? createPfxCurseColumnGeometry(surface.tuning.widthScale)
      : null,
    [surface.kind, surface.tuning?.meshGeometry, surface.tuning?.widthScale],
  )
  const magicCircleStyle = surface.tuning?.meshGeometry === 'curse-binding-seal'
    ? 'curse-binding' as const
    : 'standard' as const
  const magicCircleGeometry = useMemo(
    () => surface.kind === 'magic-circle' ? createPfxMagicCircleGeometry(materialProps.color, magicCircleStyle) : null,
    [magicCircleStyle, materialProps.color, surface.kind],
  )
  const magicCircleMaterial = useMemo(
    () => surface.kind === 'magic-circle' ? createPfxMagicCircleMaterial(materialProps.opacity, magicCircleStyle) : null,
    [magicCircleStyle, materialProps.opacity, surface.kind],
  )
  const spawnScreenReticleGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'spawn-screen-reticle'
      ? createPfxSpawnScreenReticleGeometry(materialProps.color)
      : null,
    [materialProps.color, surface.tuning?.meshGeometry],
  )
  const spawnScreenReticleMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'spawn-screen-reticle'
      ? createPfxSpawnScreenReticleMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.tuning?.meshGeometry],
  )
  const jumpPickupCradleGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'jump-pickup-launch-cradle'
      ? createPfxJumpPickupCradleGeometry(materialProps.color)
      : null,
    [materialProps.color, surface.tuning?.meshGeometry],
  )
  const jumpPickupCradleMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'jump-pickup-launch-cradle'
      ? createPfxJumpPickupCradleMaterial(materialProps.color, materialProps.opacity)
      : null,
    [materialProps.color, materialProps.opacity, surface.tuning?.meshGeometry],
  )
  const jumpPickupRewardGemGeometry = useMemo(
    () => surface.tuning?.meshGeometry === 'jump-pickup-reward-gem'
      ? createPfxJumpPickupRewardGemGeometry(materialProps.color)
      : null,
    [materialProps.color, surface.tuning?.meshGeometry],
  )
  const jumpPickupRewardGemMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'jump-pickup-reward-gem'
      ? createPfxJumpPickupRewardGemMaterial(materialProps.color, materialProps.opacity)
      : null,
    [materialProps.color, materialProps.opacity, surface.tuning?.meshGeometry],
  )
  const waterConeGeometry = useMemo(
    () => surface.kind === 'water-cone-sheet' ? createPfxWaterConeGeometry() : null,
    [surface.kind],
  )
  const spriteMaterial = useMemo(
    () => (emission && !isMeteorChunkEmission
      ? createPfxSpriteEmissionMaterial(emission, controls, surface, materialProps, feelVersion, cycleScale, tempo)
      : null),
    // materialProps is derived from controls + surface; keying on its fields
    // avoids a new material every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emission, controls, surface, materialProps.opacity, materialProps.color, materialProps.blending, isMeteorChunkEmission],
  )
  useEffect(
    () => () => {
      spriteGeometry?.dispose()
      spriteMaterial?.dispose()
      meteorChunkGeometry?.dispose()
      meteorChunkMaterial?.dispose()
      meteorHeatFrontGeometry?.dispose()
      shockwaveSpawnPressureFrontGeometry?.dispose()
      shockwaveSpawnPressureFrontMaterial?.dispose()
      plasmaAmbientCoreGeometry?.dispose()
      plasmaAmbientOrbitGeometry?.dispose()
      snowSpawnCradleGeometry?.dispose()
      muzzleFlameGeometry?.dispose()
      impactCoreGeometry?.dispose()
      impactShardGeometry?.dispose()
      coinRewardBurstGeometry?.dispose()
      shieldFragmentGeometry?.dispose()
      targetBreakReticleGeometry?.dispose()
      targetLockShellGeometry?.dispose()
      barrierLowHealthGeometry?.dispose()
      flameChargeCrucibleGeometry?.dispose()
      portalThroatGeometry?.dispose()
      projectileWakeGeometry?.dispose()
      electricWakeGeometry?.dispose()
      windPressureGeometry?.dispose()
      acidPoolGeometry?.dispose()
      blastBeamGeometry?.dispose()
      curseColumnGeometry?.dispose()
      magicCircleGeometry?.dispose()
      magicCircleMaterial?.dispose()
      spawnScreenReticleGeometry?.dispose()
      spawnScreenReticleMaterial?.dispose()
      jumpPickupCradleGeometry?.dispose()
      jumpPickupCradleMaterial?.dispose()
      jumpPickupRewardGemGeometry?.dispose()
      jumpPickupRewardGemMaterial?.dispose()
      waterConeGeometry?.dispose()
    },
    [acidPoolGeometry, barrierLowHealthGeometry, blastBeamGeometry, coinRewardBurstGeometry, curseColumnGeometry, electricWakeGeometry, flameChargeCrucibleGeometry, impactCoreGeometry, impactShardGeometry, jumpPickupCradleGeometry, jumpPickupCradleMaterial, jumpPickupRewardGemGeometry, jumpPickupRewardGemMaterial, magicCircleGeometry, magicCircleMaterial, meteorChunkGeometry, meteorChunkMaterial, meteorHeatFrontGeometry, muzzleFlameGeometry, plasmaAmbientCoreGeometry, plasmaAmbientOrbitGeometry, portalThroatGeometry, projectileWakeGeometry, shieldFragmentGeometry, shockwaveSpawnPressureFrontGeometry, shockwaveSpawnPressureFrontMaterial, snowSpawnCradleGeometry, spawnScreenReticleGeometry, spawnScreenReticleMaterial, spriteGeometry, spriteMaterial, targetBreakReticleGeometry, targetLockShellGeometry, waterConeGeometry, windPressureGeometry],
  )
  const coreSurfaceMaterial = useMemo(() => {
    const next = coreMaterial.clone()
    next.opacity = materialProps.opacity
    next.color.set(materialProps.color)
    next.alphaTest = roundMetric(materialProps.edgeHardness * 0.04)
    next.map =
      surface.kind === 'core-sphere'
        ? getPfxSharedGradientTexture('radial-glow')
        : surface.kind === 'cloud-volume' || surface.kind === 'smoke-billows'
          ? getPfxSharedGradientTexture('soft-smoke')
          : null
    return next
  }, [coreMaterial, materialProps.color, materialProps.edgeHardness, materialProps.opacity, surface.kind])
  const solidSurfaceMaterial = useMemo(() => {
    const next = coreMaterial.clone()
    next.opacity = materialProps.opacity
    next.color.set(materialProps.color)
    next.map = null
    next.alphaTest = 0
    return next
  }, [coreMaterial, materialProps.color, materialProps.opacity])
  const rewardGemFacetColors = useMemo(
    () => getPfxRewardGemFacetColors(materialProps.color),
    [materialProps.color],
  )
  const rewardGemShadowMaterial = useMemo(() => {
    if (surface.kind !== 'reward-gem') return null
    const next = solidSurfaceMaterial.clone()
    next.color.set(rewardGemFacetColors.shadow)
    next.blending = THREE.NormalBlending
    return next
  }, [rewardGemFacetColors.shadow, solidSurfaceMaterial, surface.kind])
  const rewardGemBodyMaterial = useMemo(() => {
    if (surface.kind !== 'reward-gem') return null
    const next = solidSurfaceMaterial.clone()
    next.color.set(rewardGemFacetColors.body)
    next.blending = THREE.NormalBlending
    return next
  }, [rewardGemFacetColors.body, solidSurfaceMaterial, surface.kind])
  // The gallery virtualizer remounts tiles on every scroll step; undisposed
  // clones accumulate for the life of the tab.
  useEffect(() => () => coreSurfaceMaterial.dispose(), [coreSurfaceMaterial])
  useEffect(() => () => solidSurfaceMaterial.dispose(), [solidSurfaceMaterial])
  useEffect(() => () => rewardGemShadowMaterial?.dispose(), [rewardGemShadowMaterial])
  useEffect(() => () => rewardGemBodyMaterial?.dispose(), [rewardGemBodyMaterial])
  const accentSurfaceMaterial = useMemo(() => {
    const next = accentMaterial.clone()
    next.opacity = materialProps.opacity
    next.color.set(materialProps.color)
    next.blending = materialProps.blending === 'multiply' ? THREE.MultiplyBlending : THREE.AdditiveBlending
    next.alphaTest = roundMetric(materialProps.edgeHardness * 0.05)
    next.map =
      surface.kind === 'trail-ribbon'
        ? getPfxSharedGradientTexture('trail-fade')
        : surface.kind === 'beam-column'
          ? getPfxSharedGradientTexture('beam-fade')
          : surface.kind === 'screen-plane'
            ? getPfxSharedGradientTexture('screen-vignette')
            : surface.kind === 'ring-field' || surface.kind === 'shockwave-ring' || surface.kind === 'shield-shell'
              ? getPfxSharedGradientTexture('ring-glow')
              : null
    return next
  }, [accentMaterial, materialProps.blending, materialProps.color, materialProps.edgeHardness, materialProps.opacity, surface.kind])
  useEffect(() => () => accentSurfaceMaterial.dispose(), [accentSurfaceMaterial])
  const plasmaAmbientCoreMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'plasma-ambient-contained-core'
      ? createPfxPlasmaAmbientCoreMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.tuning?.meshGeometry],
  )
  const plasmaAmbientOrbitMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'plasma-ambient-broken-orbits'
      ? createPfxPlasmaAmbientOrbitMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.tuning?.meshGeometry],
  )
  const snowSpawnCradleMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'snow-spawn-frost-cradle'
      ? createPfxSnowSpawnCradleMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => plasmaAmbientCoreMaterial?.dispose(), [plasmaAmbientCoreMaterial])
  useEffect(() => () => plasmaAmbientOrbitMaterial?.dispose(), [plasmaAmbientOrbitMaterial])
  useEffect(() => () => snowSpawnCradleMaterial?.dispose(), [snowSpawnCradleMaterial])
  const rewardGemHighlightMaterial = useMemo(() => {
    if (surface.kind !== 'reward-gem') return null
    const next = accentSurfaceMaterial.clone()
    next.color.set(rewardGemFacetColors.highlight)
    next.blending = THREE.AdditiveBlending
    return next
  }, [accentSurfaceMaterial, rewardGemFacetColors.highlight, surface.kind])
  useEffect(() => () => rewardGemHighlightMaterial?.dispose(), [rewardGemHighlightMaterial])
  const coinGoldMaterial = useMemo(
    () => surface.kind === 'coin-medallion'
      ? createPfxCoinGoldMaterial(materialProps.opacity, materialProps.color)
      : null,
    [materialProps.color, materialProps.opacity, surface.kind],
  )
  const coinFaceMaterial = useMemo(() => {
    if (!coinGoldMaterial) return null
    const next = coinGoldMaterial.clone()
    next.color.set('#ffd34f')
    next.metalness = 0.72
    next.roughness = 0.3
    next.emissive.set('#5a3200')
    next.emissiveIntensity = 0.38
    return next
  }, [coinGoldMaterial])
  const coinCrestMaterial = useMemo(() => {
    if (!coinGoldMaterial) return null
    const next = coinGoldMaterial.clone()
    next.color.set('#fff0a8')
    next.metalness = 0.58
    next.roughness = 0.18
    next.emissive.set('#9d6200')
    next.emissiveIntensity = 0.58
    return next
  }, [coinGoldMaterial])
  useEffect(() => () => coinGoldMaterial?.dispose(), [coinGoldMaterial])
  useEffect(() => () => coinFaceMaterial?.dispose(), [coinFaceMaterial])
  useEffect(() => () => coinCrestMaterial?.dispose(), [coinCrestMaterial])
  const muzzleFlameMaterial = useMemo(
    () => surface.kind === 'muzzle-cone' && !surface.phase?.includes('crown')
      ? createPfxMuzzleFlameMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.kind, surface.phase],
  )
  useEffect(() => () => muzzleFlameMaterial?.dispose(), [muzzleFlameMaterial])
  const impactCoreMaterial = useMemo(
    () => surface.kind === 'impact-core'
      ? surface.tuning?.meshGeometry === 'exhaust-hit-mechanical-nozzle'
        ? createPfxExhaustHitNozzleMaterial(materialProps.opacity)
        : surface.phase === 'ember-ignition-core'
          ? createPfxEmberIgnitionMaterial(materialProps.opacity)
          : createPfxImpactCoreMaterial(materialProps.opacity, materialProps.color)
      : null,
    [materialProps.color, materialProps.opacity, surface.kind, surface.phase, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => impactCoreMaterial?.dispose(), [impactCoreMaterial])
  const windPressureMaterial = useMemo(
    () => surface.kind === 'wind-streaks'
      ? surface.tuning?.meshGeometry === 'wind-beam-pressure-ribbons'
        ? createPfxWindBeamPressureMaterial(materialProps.opacity, controls.color[0] ?? '#d8fff4', controls.color[1] ?? '#b8e6ff', controls.density, styleProfile.edgeHardness)
        : createPfxWindPressureMaterial(materialProps.opacity, materialProps.color)
      : null,
    [controls.color, controls.density, materialProps.color, materialProps.opacity, styleProfile.edgeHardness, surface.kind, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => windPressureMaterial?.dispose(), [windPressureMaterial])
  const impactShardMaterial = useMemo(
    () => surface.kind === 'impact-shards'
      ? surface.tuning?.meshGeometry === 'flame-burst-folded-tongues'
        ? null
        : surface.tuning?.meshGeometry === 'meteor-burst-impact-diorama'
        ? null
        : (surface.tuning?.meshGeometry as string | undefined) === 'blast-burst-airborne-detonation'
        ? null
        : (surface.tuning?.meshGeometry as string | undefined) === 'shockwave-burst-broken-pressure-dome'
        ? null
        : (surface.tuning?.meshGeometry as string | undefined) === 'dust-burst-grounded-crown'
        ? null
        : (surface.tuning?.meshGeometry as string | undefined) === 'debris-burst-fractured-mass'
        ? null
        : surface.tuning?.meshGeometry === 'flame-charge-convergence-tendrils'
        ? null
        : surface.tuning?.meshGeometry === 'meteor-ring-impact-crater'
          ? createPfxMeteorImpactMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'shockwave-spawn-arrival-flare'
          ? createPfxShockwaveSpawnArrivalFlareMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'shard-break-crystal-fragments'
        ? createPfxShardBreakFragmentMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'shard-break-ignition-core'
        ? createPfxShardBreakFragmentMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'ice-impact-grounded-splinters'
        ? createPfxIceImpactMaterial(materialProps.opacity, controls.color[0] ?? '#7ddfff', controls.color[1] ?? '#e9fcff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'frost-aura-crystal-crown'
        ? createPfxFrostAuraMaterial(materialProps.opacity, controls.color[0] ?? '#8ee8ff', controls.color[1] ?? '#e8fbff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'frost-aura-crystal-glint'
        ? createPfxFrostAuraCrystalGlintMaterial(materialProps.opacity, controls.color[0] ?? '#8ee8ff', controls.color[1] ?? '#e8fbff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'water-column-churning-body'
        ? createPfxWaterColumnMaterial(materialProps.opacity, controls.color[0] ?? '#168fd1', controls.color[1] ?? '#bdefff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'water-column-foam-spray'
        ? createPfxWaterColumnFoamMaterial(materialProps.opacity, controls.color[0] ?? '#168fd1', controls.color[1] ?? '#bdefff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'snow-idle-flurry-field'
        ? createPfxSnowIdleFlurryMaterial(materialProps.opacity, controls.color[0] ?? '#edfaff', controls.color[1] ?? '#bfeeff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'snow-idle-depth-granules'
        ? createPfxSnowIdleGranuleMaterial(materialProps.opacity, controls.color[0] ?? '#edfaff', controls.color[1] ?? '#bfeeff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'wind-beam-debris-leaves'
        ? createPfxWindBeamLeafMaterial(materialProps.opacity, controls.color[0] ?? '#d8fff4', controls.color[1] ?? '#b8e6ff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'petal-ambient-drifting-blossoms'
        ? createPfxPetalAmbientMaterial(materialProps.opacity, controls.color[0] ?? '#f47cab', controls.color[1] ?? '#ffd0c4', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'sand-burst-sculpted-fan'
        ? createPfxSandBurstMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'rain-burst-water-crown'
        ? createPfxRainBurstMaterial(materialProps.opacity, controls.color[0] ?? '#2d8fd3', controls.color[1] ?? '#c7f5ff', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'rain-burst-rain-foam'
        ? createPfxRainBurstFoamMaterial(materialProps.opacity, controls.color[0] ?? '#2d8fd3', controls.color[1] ?? '#c7f5ff', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'snow-burst-crystal-bloom'
        ? createPfxSnowBurstCrystalMaterial(materialProps.opacity, controls.color[0] ?? '#edfaff', controls.color[1] ?? '#5bbde8', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'snow-burst-powder-drift'
        ? createPfxSnowBurstPowderMaterial(materialProps.opacity, controls.color[0] ?? '#edfaff', controls.color[1] ?? '#5bbde8', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'wind-burst-pressure-rosette'
        ? createPfxWindBurstPressureMaterial(materialProps.opacity, controls.color[0] ?? '#dff9ff', controls.color[1] ?? '#72cde8', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'wind-burst-wake-wisps'
        ? createPfxWindBurstWakeMaterial(materialProps.opacity, controls.color[0] ?? '#dff9ff', controls.color[1] ?? '#72cde8', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'leaf-burst-sculpted-canopy'
        ? createPfxLeafBurstCanopyMaterial(materialProps.opacity, controls.color[0] ?? '#69a83e', controls.color[1] ?? '#d8f29a', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'leaf-burst-vein-seed-curls'
        ? createPfxLeafBurstVeinMaterial(materialProps.opacity, controls.color[0] ?? '#69a83e', controls.color[1] ?? '#d8f29a', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'petal-burst-sculpted-corolla'
        ? createPfxPetalBurstCanopyMaterial(materialProps.opacity, controls.color[0] ?? '#f48fb1', controls.color[1] ?? '#ffe4d6', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'petal-burst-stamen-pollen-calyx'
        ? createPfxPetalBurstStamenMaterial(materialProps.opacity, controls.color[0] ?? '#f48fb1', controls.color[1] ?? '#ffe4d6', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-sculpted-crown'
        ? createPfxMudBurstCrownMaterial(materialProps.opacity, controls.color[0] ?? '#2a170c', controls.color[1] ?? '#6f4526', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-ballistic-clods'
        ? createPfxMudBurstClodMaterial(materialProps.opacity, controls.color[0] ?? '#2a170c', controls.color[1] ?? '#6f4526', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'slime-burst-sculpted-gel-crown'
        ? createPfxSlimeBurstCrownMaterial(materialProps.opacity, controls.color[0] ?? '#2c8f45', controls.color[1] ?? '#b8ff75', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'slime-burst-bubble-droplet-volume'
        ? createPfxSlimeBurstBubbleMaterial(materialProps.opacity, controls.color[0] ?? '#2c8f45', controls.color[1] ?? '#b8ff75', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'poison-burst-vapor-lobe-cluster'
        ? createPfxPoisonBurstBloomMaterial(materialProps.opacity, controls.color[0] ?? '#6b2a8e', controls.color[1] ?? '#9cff57', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'poison-burst-spore-pod-volume'
        ? createPfxPoisonBurstSporeMaterial(materialProps.opacity, controls.color[0] ?? '#6b2a8e', controls.color[1] ?? '#9cff57', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'acid-burst-sculpted-splash-crown'
        ? createPfxAcidBurstCrownMaterial(materialProps.opacity, controls.color[0] ?? '#3f9f2f', controls.color[1] ?? '#d9ff47', controls.density, styleProfile.edgeHardness, controls.color[2] ?? '#67e8f9')
        : (surface.tuning?.meshGeometry as string | undefined) === 'acid-burst-ballistic-droplet-volume'
        ? createPfxAcidBurstDropletMaterial(materialProps.opacity, controls.color[0] ?? '#3f9f2f', controls.color[1] ?? '#d9ff47', controls.density, styleProfile.edgeHardness, controls.color[2] ?? '#67e8f9')
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-renewal-bloom'
        ? createPfxHealingBurstBloomMaterial(materialProps.opacity, controls.color[0] ?? '#37d982', controls.color[1] ?? '#ffd166', controls.color[2] ?? '#b7f7d0', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-rising-leaf-volume'
        ? createPfxHealingBurstLeafMaterial(materialProps.opacity, controls.color[0] ?? '#37d982', controls.color[1] ?? '#ffd166', controls.color[2] ?? '#b7f7d0', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-cleansing-sunburst'
        ? createPfxHolyBurstSunMaterial(materialProps.opacity, controls.color[0] ?? '#fff1b8', controls.color[1] ?? '#ffd24a', controls.color[2] ?? '#7dd3fc', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-ascending-feather-volume'
        ? createPfxHolyBurstFeatherMaterial(materialProps.opacity, controls.color[0] ?? '#fff1b8', controls.color[1] ?? '#ffd24a', controls.color[2] ?? '#7dd3fc', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'curse-burst-malediction-effigy'
        ? createPfxCurseBurstEffigyMaterial(materialProps.opacity, controls.color[0] ?? '#2e0249', controls.color[1] ?? '#a855f7', controls.color[2] ?? '#bef264', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'curse-burst-snapped-binding-chains'
        ? createPfxCurseBurstBindingMaterial(materialProps.opacity, controls.color[0] ?? '#2e0249', controls.color[1] ?? '#a855f7', controls.color[2] ?? '#bef264', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-spectral-claw'
        ? createPfxShadowBurstClawMaterial(materialProps.opacity, controls.color[0] ?? '#101018', controls.color[1] ?? '#4a4560', controls.color[2] ?? '#b6c2d8', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-void-fragments'
        ? createPfxShadowBurstFragmentMaterial(materialProps.opacity, controls.color[0] ?? '#101018', controls.color[1] ?? '#4a4560', controls.color[2] ?? '#b6c2d8', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-splash-crown'
        ? createPfxMudBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#4a2417', controls.color[1] ?? '#8a522e', controls.color[2] ?? '#d3a070')
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-clod-eruption'
        ? createPfxMudBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#3b2113', controls.color[1] ?? '#7b4a2d', controls.color[2] ?? '#c18a60')
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-earth-crown'
        ? createPfxMudBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#2a170c', controls.color[1] ?? '#6f4526', controls.color[2] ?? '#b98a62')
        : (surface.tuning?.meshGeometry as string | undefined) === 'mud-burst-reference-wet-clot-splash'
        ? createPfxMudBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#2b1a14', controls.color[1] ?? '#6f4b35', controls.color[2] ?? '#a87856')
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-reference-helix'
        ? createPfxHealingBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#37d982', controls.color[1] ?? '#d7f8df', controls.color[2] ?? '#fff0b0', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'healing-burst-reference-bloom'
        ? createPfxHealingBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#37d982', controls.color[1] ?? '#d7f8df', controls.color[2] ?? '#fff0b0', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-sacred-flame'
        ? createPfxHolyBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#fff1b8', controls.color[1] ?? '#ffd24a', controls.color[2] ?? '#7dd3fc', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-sanctity-sun'
        ? createPfxHolyBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#fff1b8', controls.color[1] ?? '#ffd24a', controls.color[2] ?? '#7dd3fc', controls.density, styleProfile.edgeHardness)
        : (surface.tuning?.meshGeometry as string | undefined) === 'holy-burst-reference-mandorla'
        ? createPfxHolyBurstReferenceMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-reference-claw'
        ? createPfxShadowBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#0d0b16', controls.color[1] ?? '#4a5669', controls.color[2] ?? '#9ab4c9')
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-burst-reference-fracture'
        ? createPfxShadowBurstReferenceMaterial(materialProps.opacity, controls.color[0] ?? '#304353', controls.color[1] ?? '#56687a', controls.color[2] ?? '#9ab4c9')
        : surface.tuning?.meshGeometry === 'mud-charge-sculpted-clods'
        ? createPfxMudChargeMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'slime-ring-viscous-annulus'
        ? createPfxSlimeRingMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'acid-spawn-corrosive-aperture'
        ? createPfxAcidSpawnMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'healing-loop-renewal-helix'
        ? createPfxHealingLoopMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'holy-release-radiant-mandorla'
        ? createPfxHolyReleaseMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'curse-cone-twisted-thorn-fan'
        ? createPfxCurseConeMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'shadow-break-rupture-cluster'
        ? createPfxShadowBreakMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'blood-death-pigment-rupture'
        ? createPfxBloodDeathMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'ghost-trail-spectral-procession'
        ? createPfxGhostTrailMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'portal-telegraph-countdown-aperture'
        ? createPfxPortalTelegraphMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'warp-spray-displaced-facets'
        ? createPfxWarpSprayFacetMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'teleport-hit-arrival-scar'
        ? createPfxTeleportHitMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'barrier-column-fortified-pillar'
        ? createPfxBarrierColumnMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'dash-idle-vector-reservoir'
        ? createPfxDashIdleMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'jump-beam-updraft-accelerator'
        ? createPfxJumpBeamMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'footstep-ambient-cadence-wake'
        ? createPfxFootstepAmbientMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'pickup-burst-reward-receipt'
        ? createPfxPickupBurstMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'reward-charge-gilded-capacitor'
        ? createPfxRewardChargeMaterial(materialProps.opacity)
        : (surface.tuning?.meshGeometry as string | undefined) === 'despawn-impact-absence-cage'
        ? createPfxDespawnImpactMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'glyph-trail-rune-chain'
        ? createPfxGlyphTrailMaterial(materialProps.opacity, controls.color[0] ?? '#61e7ff', controls.color[1] ?? '#a78bfa', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'glyph-trail-lead-sigil'
        ? createPfxGlyphTrailMaterial(materialProps.opacity, controls.color[0] ?? '#61e7ff', controls.color[1] ?? '#a78bfa', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'beam-telegraph-warning-lane'
        ? createPfxBeamTelegraphMaterial(materialProps.opacity, 'lane', controls.color[0] ?? '#f04418', controls.color[1] ?? '#8eefff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'beam-telegraph-source-aperture'
        ? createPfxBeamTelegraphMaterial(materialProps.opacity, 'aperture', controls.color[0] ?? '#f04418', controls.color[1] ?? '#8eefff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'laser-spray-volumetric-nozzle'
        ? createPfxLaserSprayMaterial(materialProps.opacity, 'nozzle', controls.color[0] ?? '#ff3d1f', controls.color[1] ?? '#ffb23c', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'laser-spray-bolt-rack'
        ? createPfxLaserSprayMaterial(materialProps.opacity, 'bolts', controls.color[0] ?? '#ff3d1f', controls.color[1] ?? '#ffb23c', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'plasma-hit-contact-bloom'
        ? createPfxPlasmaHitMaterial(materialProps.opacity, 'contact', controls.color[0] ?? '#4ff7ff', controls.color[1] ?? '#8a42ff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'plasma-hit-broken-flux-arcs'
        ? createPfxPlasmaHitMaterial(materialProps.opacity, 'filament', controls.color[0] ?? '#4ff7ff', controls.color[1] ?? '#8a42ff', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'electric-critical-faceted-nexus'
        ? createPfxElectricCriticalNexusMaterial(materialProps.opacity, controls.color[0] ?? '#5eeaff', controls.color[1] ?? '#ffd45a', controls.density, styleProfile.edgeHardness)
        : surface.tuning?.meshGeometry === 'electric-critical-diagonal-discharge' || surface.tuning?.meshGeometry === 'electric-critical-impact-starburst' || surface.tuning?.meshGeometry === 'electric-critical-voltage-cage'
        ? createPfxElectricCriticalMaterial(
          materialProps.opacity,
          surface.tuning.blend === 'additive' ? 'halo' : 'core',
          controls.color[0] ?? '#5eeaff',
          controls.color[1] ?? '#ffd45a',
          controls.density,
          styleProfile.edgeHardness,
        )
        : surface.tuning?.meshGeometry === 'spark-cone-streak-prisms'
        ? createPfxSparkConeStreakMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'debris-release-rock-fragments'
        ? createPfxDebrisReleaseFragmentMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'debris-miss-rock-fragments'
        ? createPfxDebrisMissFragmentMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'barrier-low-health-breach-ribs'
          ? createPfxBarrierBreachRibMaterial(materialProps.opacity)
        : surface.tuning?.meshGeometry === 'ghost-critical-spectral-talons'
          ? createPfxGhostCriticalTalonMaterial(materialProps.opacity)
        : surface.phase === 'spark-gap-fork-volume'
        ? createPfxSparkGapMaterial(materialProps.opacity)
        : surface.phase === 'ember-ballistic-launch'
          ? createPfxEmberFragmentMaterial(materialProps.opacity, materialProps.color)
          : createPfxImpactShardBurstMaterial(materialProps.opacity, materialProps.color)
      : null,
    [controls.color[0], controls.color[1], controls.color[2], controls.density, materialProps.color, materialProps.opacity, styleProfile.edgeHardness, surface.kind, surface.phase, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => impactShardMaterial?.dispose(), [impactShardMaterial])
  const coinRewardBurstMaterial = useMemo(
    () => surface.kind === 'coin-reward-burst' ? createPfxCoinRewardBurstMaterial(materialProps.opacity, materialProps.color) : null,
    [materialProps.color, materialProps.opacity, surface.kind],
  )
  useEffect(() => () => coinRewardBurstMaterial?.dispose(), [coinRewardBurstMaterial])
  const shieldFragmentMaterial = useMemo(
    () => surface.kind === 'shield-fragments'
      ? surface.tuning?.meshGeometry === 'target-break-honeycomb-fragments'
        ? createPfxTargetBreakFragmentMaterial(materialProps.opacity)
        : createPfxShieldFragmentMaterial(materialProps.opacity, materialProps.color)
      : null,
    [materialProps.color, materialProps.opacity, surface.kind, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => shieldFragmentMaterial?.dispose(), [shieldFragmentMaterial])
  const targetBreakReticleMaterial = useMemo(
    () => surface.tuning?.meshGeometry === 'target-break-ground-reticle'
      ? createPfxTargetBreakReticleMaterial(materialProps.opacity)
      : null,
    [materialProps.opacity, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => targetBreakReticleMaterial?.dispose(), [targetBreakReticleMaterial])
  const glyphCircleMaterial = useMemo(() => {
    if (!(feelVersion >= 2 && surface.kind === 'ring-field' && surface.tuning?.ringPurpose === 'glyph')) return null
    // The shared atlas loads async — cloning it pre-load orphans the clone
    // with no pixels (invisible runes). Use it as-is; the slice rect lives
    // in the plane geometry's UVs instead of a texture transform.
    return new THREE.MeshBasicMaterial({
      map: getPfxSharedSpriteAtlasTexture(),
      color: materialProps.color,
      transparent: true,
      opacity: materialProps.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }, [feelVersion, materialProps.color, materialProps.opacity, surface.kind, surface.tuning?.ringPurpose])
  useEffect(() => () => glyphCircleMaterial?.dispose(), [glyphCircleMaterial])
  const glyphQuadGeometry = useMemo(() => {
    if (!glyphCircleMaterial) return null
    const slice = PFX_SPRITE_SLICES['rune']
    const geometry = new THREE.PlaneGeometry(0.72, 0.8)
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, slice.u + uv.getX(i) * slice.w, slice.v + uv.getY(i) * slice.h)
    }
    uv.needsUpdate = true
    return geometry
  }, [glyphCircleMaterial])
  useEffect(() => () => glyphQuadGeometry?.dispose(), [glyphQuadGeometry])
  const plasmaImpactFlipbookMaterial = useMemo(
    () => surface.tuning?.meshShader === 'plasma-impact-flipbook'
      ? createPfxPlasmaImpactFlipbookMaterial(materialProps.opacity, controls.color[0] ?? '#4ff7ff', controls.color[1] ?? '#8a42ff', controls.density, styleProfile.edgeHardness)
      : null,
    [controls.color[0], controls.color[1], controls.density, materialProps.opacity, styleProfile.edgeHardness, surface.tuning?.meshShader],
  )
  useEffect(() => () => plasmaImpactFlipbookMaterial?.dispose(), [plasmaImpactFlipbookMaterial])
  const plasmaImpactVolumeGeometry = useMemo(
    () => surface.tuning?.meshShader === 'plasma-impact-flipbook'
      ? createPfxPlasmaImpactVolumeGeometry()
      : null,
    [surface.tuning?.meshShader],
  )
  useEffect(() => () => plasmaImpactVolumeGeometry?.dispose(), [plasmaImpactVolumeGeometry])
  const flashGlowMaterial = useMemo(
    () =>
      isPfxOmniLightRead(surface.tuning) && feelVersion >= 2
        ? (() => {
            const next = coreMaterial.clone()
            next.opacity = materialProps.opacity
            next.color.set(materialProps.color)
            // blend 'alpha' + a dark colorOverride = Leroy's SHADOW layer:
            // darkening behind the glow buys contrast headroom. Additive is
            // the default light card.
            next.blending = materialProps.blending === 'alpha' ? THREE.NormalBlending : THREE.AdditiveBlending
            next.map = getPfxSharedParticleTexture('soft-disc')
            next.depthWrite = false
            return next
          })()
        : null,
    [coreMaterial, materialProps.blending, materialProps.color, materialProps.opacity, surface.tuning?.meshMotion],
  )
  useEffect(() => () => flashGlowMaterial?.dispose(), [flashGlowMaterial])
  const healingGlyphMaterial = useMemo(
    () => surface.kind === 'healing-glyphs'
      ? createPfxHealingGlyphMaterial(materialProps.opacity, materialProps.color)
      : null,
    [materialProps.color, materialProps.opacity, surface.kind],
  )
  useEffect(() => () => healingGlyphMaterial?.dispose(), [healingGlyphMaterial])
  const healingLeafEdgeMaterial = useMemo(
    () => surface.kind === 'healing-glyphs'
      ? createPfxHealingLeafEdgeMaterial(materialProps.opacity, materialProps.color)
      : null,
    [materialProps.color, materialProps.opacity, surface.kind],
  )
  useEffect(() => () => healingLeafEdgeMaterial?.dispose(), [healingLeafEdgeMaterial])
  const healingGlyphGeometry = useMemo(
    () => surface.kind === 'healing-glyphs' ? createPfxHealingGlyphGeometry() : null,
    [surface.kind],
  )
  useEffect(() => () => healingGlyphGeometry?.dispose(), [healingGlyphGeometry])
  const healingVineMaterial = useMemo(
    () => surface.kind === 'healing-glyphs'
      ? createPfxHealingVineMaterial(materialProps.opacity, materialProps.color)
      : null,
    [materialProps.color, materialProps.opacity, surface.kind],
  )
  useEffect(() => () => healingVineMaterial?.dispose(), [healingVineMaterial])
  const healingVineGeometry = useMemo(
    () => surface.kind === 'healing-glyphs' ? createPfxHealingVineGeometry() : null,
    [surface.kind],
  )
  useEffect(() => () => healingVineGeometry?.dispose(), [healingVineGeometry])
  const healingFocalGeometry = useMemo(
    () => surface.kind === 'healing-glyphs' ? createPfxHealingFocalGeometry() : null,
    [surface.kind],
  )
  useEffect(() => () => healingFocalGeometry?.dispose(), [healingFocalGeometry])
  const healingSparkleGeometry = useMemo(
    () => surface.kind === 'healing-glyphs' ? createPfxHealingSparkleGeometry() : null,
    [surface.kind],
  )
  useEffect(() => () => healingSparkleGeometry?.dispose(), [healingSparkleGeometry])
  const healingFocalMaterial = useMemo(
    () => surface.kind === 'healing-glyphs' ? createPfxHealingFocalMaterial(materialProps.opacity) : null,
    [materialProps.opacity, surface.kind],
  )
  useEffect(() => () => healingFocalMaterial?.dispose(), [healingFocalMaterial])
  const healingLeafMatrixObject = useMemo(() => new THREE.Object3D(), [])
  const hotCoreMaterial = useMemo(
    () =>
      surface.kind === 'projectile-comet' && feelVersion >= 2
        ? (() => {
            // Hot point discipline: the projectile core is the brightest pixel
            // of the whole effect — the palette hue pushed most of the way to
            // white, sitting inside the saturated hue shell.
            const next = coreMaterial.clone()
            next.color.set(materialProps.color)
            next.color.lerp(new THREE.Color('#ffffff'), 0.55)
            next.opacity = Math.min(1, materialProps.opacity * 1.1)
            next.map = null
            next.alphaTest = 0
            return next
          })()
        : null,
    [coreMaterial, feelVersion, materialProps.color, materialProps.opacity, surface.kind],
  )
  useEffect(() => () => hotCoreMaterial?.dispose(), [hotCoreMaterial])
  const meshShader = surface.tuning?.meshShader
  const screenVignetteMaterial = useMemo(
    () => surface.tuning?.screenShader === 'danger-vignette'
      ? createPfxScreenVignetteMaterial(materialProps)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface.tuning?.screenShader, materialProps.color, materialProps.opacity],
  )
  useEffect(() => () => screenVignetteMaterial?.dispose(), [screenVignetteMaterial])
  const slashArcGeometry = useMemo(
    () => meshShader === 'arc-sweep' ? createPfxSlashArcGeometry() : null,
    [meshShader],
  )
  useEffect(() => () => slashArcGeometry?.dispose(), [slashArcGeometry])
  const meshShaderMaterial = useMemo(
    () => (meshShader && meshShader !== 'plasma-impact-flipbook'
      ? surface.tuning?.meshGeometry === 'flame-charge-convergence-tendrils'
        ? createPfxFlameChargeTendrilMaterial(materialProps.opacity, materialProps.color)
      : surface.tuning?.meshGeometry === 'flame-charge-trefoil-crucible'
        ? createPfxFlameChargeCrucibleMaterial(materialProps.opacity, materialProps.color)
      : meshShader === 'barrier-failure-shell'
        ? createPfxBarrierLowHealthMaterial(materialProps.opacity, materialProps.color)
      : meshShader === 'combo-ring-meter'
        ? createPfxComboRingMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
            surface.tuning?.comboMultiplier ?? 3,
          )
      : meshShader === 'ui-pickup-receipt'
        ? createPfxUiPickupMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'target-spawn-reticle' || meshShader === 'target-spawn-pin'
        ? createPfxTargetSpawnMaterial(
            meshShader === 'target-spawn-reticle' ? 'reticle' : 'pin',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'warning-loop-panel' || meshShader === 'warning-loop-beacon'
        ? createPfxWarningLoopMaterial(
            meshShader === 'warning-loop-panel' ? 'panel' : 'beacon',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'marker-release-ground' || meshShader === 'marker-release-badge'
        ? createPfxMarkerReleaseMaterial(
            meshShader === 'marker-release-ground' ? 'ground' : 'badge',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'scan-cone-footprint' || meshShader === 'scan-cone-volume'
        ? createPfxScanConeMaterial(
            meshShader === 'scan-cone-footprint' ? 'footprint' : 'volume',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'hologram-break-figure' || meshShader === 'hologram-break-projector'
        ? createPfxHologramBreakMaterial(
            meshShader === 'hologram-break-figure' ? 'figure' : 'projector',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'thruster-trail-plume' || meshShader === 'thruster-trail-nozzle'
        ? createPfxThrusterTrailMaterial(
            meshShader === 'thruster-trail-plume' ? 'plume' : 'nozzle',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? controls.color[0] ?? materialProps.color,
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'exhaust-telegraph-lane' || meshShader === 'exhaust-telegraph-vent'
        ? createPfxExhaustTelegraphMaterial(
            meshShader === 'exhaust-telegraph-lane' ? 'lane' : 'vent',
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? (meshShader === 'exhaust-telegraph-lane' ? '#fff0c2' : '#ffcf85'),
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'flame-burst-blossom' && surface.tuning?.meshGeometry === 'holy-burst-reference-sacred-flame'
        ? createPfxHolyBurstReferenceMaterial(
            materialProps.opacity,
            controls.color[0] ?? '#fff1b8',
            controls.color[1] ?? '#ffd24a',
            controls.color[2] ?? '#7dd3fc',
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'flame-burst-blossom'
        ? createPfxFlameBurstMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? '#ffd166',
            controls.density,
            styleProfile.edgeHardness,
          )
      : meshShader === 'meteor-burst-collision'
        ? createPfxMeteorBurstMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? '#ffd166',
            controls.density,
            styleProfile.edgeHardness,
          )
      : (meshShader as string | undefined) === 'blast-burst-pressure-fracture'
        ? createPfxBlastBurstMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? '#ffd166',
            controls.density,
            styleProfile.edgeHardness,
          )
      : (meshShader as string | undefined) === 'shockwave-burst-pressure-front'
        ? createPfxShockwaveBurstMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? '#ffd166',
            controls.density,
            styleProfile.edgeHardness,
          )
      : (meshShader as string | undefined) === 'dust-burst-pigment-roll'
        ? createPfxDustBurstMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? '#e2c99b',
            controls.density,
            styleProfile.edgeHardness,
          )
      : (meshShader as string | undefined) === 'debris-burst-ballistic-breakup'
        ? createPfxDebrisBurstMaterial(
            materialProps.opacity,
            controls.color[0] ?? surface.tuning?.colorOverride ?? materialProps.color,
            controls.color[1] ?? '#c7a676',
            controls.density,
            styleProfile.edgeHardness,
          )
        : buildPfxMeshShaderMaterial(meshShader, materialProps)
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controls.color, controls.density, meshShader, materialProps.opacity, materialProps.color, styleProfile.edgeHardness, surface.tuning?.colorOverride, surface.tuning?.meshGeometry],
  )
  useEffect(() => () => meshShaderMaterial?.dispose(), [meshShaderMaterial])
  // fire-body heads carry a companion eroded-alpha shell (same surface, no
  // extra draw-call accounting — meshes within a surface are free).
  const fireErodeMaterial = useMemo(
    () => (meshShader === 'fire-body' ? buildPfxMeshShaderMaterial('fire-erode', materialProps) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meshShader, materialProps.opacity, materialProps.color],
  )
  useEffect(() => () => fireErodeMaterial?.dispose(), [fireErodeMaterial])

  useFrame((state) => {
    if (!object.current) return
    const elapsed = previewTimeSeconds ?? state.clock.elapsedTime
    if (screenVignetteMaterial) {
      screenVignetteMaterial.uniforms.uTime!.value = elapsed * Math.max(0.1, tempo)
      // Persistent status UI must never inherit a one-shot surface envelope.
      // The shader owns its restrained two-beat cadence and steady baseline.
      screenVignetteMaterial.uniforms.uOpacity!.value = materialProps.opacity
      return
    }
    if (spriteMaterial) {
      spriteMaterial.uniforms.uTime!.value = elapsed
    }
    if (meshShaderMaterial) {
      if (meshShader === 'warning-loop-panel' || meshShader === 'warning-loop-beacon') {
        const warningState = createPfxWarningLoopRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          warningLoopRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uCycle!.value = warningState.cycle
        meshShaderMaterial.uniforms.uPulse!.value = warningState.pulse
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * warningState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0) + (meshShader === 'warning-loop-beacon' ? -0.06 + warningState.lift * 0.06 : 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        if (meshShader === 'warning-loop-beacon') {
          const shaderParentWorldQuaternion = object.current.parent
            ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
            : undefined
          applyPfxSurfaceRotation(
            object.current,
            state.camera.quaternion,
            true,
            0,
            shaderParentWorldQuaternion,
          )
        }
        return
      }
      if (meshShader === 'marker-release-ground' || meshShader === 'marker-release-badge') {
        const releaseState = createPfxMarkerReleaseRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          markerReleaseRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = releaseState.progress
        meshShaderMaterial.uniforms.uExpansion!.value = releaseState.expansion
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * releaseState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0) + (meshShader === 'marker-release-badge' ? releaseState.lift * 0.62 : 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        if (meshShader === 'marker-release-badge') {
          const shaderParentWorldQuaternion = object.current.parent
            ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
            : undefined
          applyPfxSurfaceRotation(object.current, state.camera.quaternion, true, 0, shaderParentWorldQuaternion)
        }
        return
      }
      if (meshShader === 'scan-cone-footprint' || meshShader === 'scan-cone-volume') {
        const scanState = createPfxScanConeRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          scanConeRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = scanState.progress
        meshShaderMaterial.uniforms.uSweep!.value = scanState.sweep
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * scanState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        return
      }
      if (meshShader === 'hologram-break-figure' || meshShader === 'hologram-break-projector') {
        const hologramState = createPfxHologramBreakRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          hologramBreakRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = hologramState.progress
        meshShaderMaterial.uniforms.uBreakAmount!.value = hologramState.breakAmount
        meshShaderMaterial.uniforms.uScan!.value = hologramState.scan
        meshShaderMaterial.uniforms.uCollapse!.value = hologramState.collapse
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * hologramState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0) - (meshShader === 'hologram-break-figure' ? hologramState.collapse * 0.28 : 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        if (meshShader === 'hologram-break-figure') {
          const shaderParentWorldQuaternion = object.current.parent
            ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
            : undefined
          applyPfxSurfaceRotation(object.current, state.camera.quaternion, true, 0, shaderParentWorldQuaternion)
        }
        return
      }
      if (meshShader === 'thruster-trail-plume' || meshShader === 'thruster-trail-nozzle') {
        const thrusterState = createPfxThrusterTrailRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          thrusterTrailRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = thrusterState.progress
        meshShaderMaterial.uniforms.uFlow!.value = thrusterState.flow
        meshShaderMaterial.uniforms.uThrust!.value = thrusterState.thrust
        meshShaderMaterial.uniforms.uCutoff!.value = thrusterState.cutoff
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * thrusterState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        return
      }
      if (meshShader === 'exhaust-telegraph-lane' || meshShader === 'exhaust-telegraph-vent') {
        const exhaustState = createPfxExhaustTelegraphRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          exhaustTelegraphRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = exhaustState.progress
        meshShaderMaterial.uniforms.uUrgency!.value = exhaustState.urgency
        meshShaderMaterial.uniforms.uVentOpen!.value = exhaustState.ventOpen
        meshShaderMaterial.uniforms.uRelease!.value = exhaustState.release
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * exhaustState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        return
      }
      if (meshShader === 'flame-burst-blossom') {
        const flameState = createPfxFlameBurstRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          flameBurstRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = flameState.progress
        meshShaderMaterial.uniforms.uBloom!.value = flameState.bloom
        meshShaderMaterial.uniforms.uHeat!.value = flameState.heat
        meshShaderMaterial.uniforms.uPeel!.value = flameState.peel
        meshShaderMaterial.uniforms.uCool!.value = flameState.cool
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * flameState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        return
      }
      if (meshShader === 'meteor-burst-collision') {
        const meteorState = createPfxMeteorBurstRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          meteorBurstRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = meteorState.progress
        meshShaderMaterial.uniforms.uImpact!.value = meteorState.impact
        meshShaderMaterial.uniforms.uFlash!.value = meteorState.flash
        meshShaderMaterial.uniforms.uScatter!.value = meteorState.scatter
        meshShaderMaterial.uniforms.uCool!.value = meteorState.cool
        meshShaderMaterial.uniforms.uHead!.value = meteorState.head
        meshShaderMaterial.uniforms.uOpacity!.value = meteorState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        return
      }
      if ((meshShader as string | undefined) === 'blast-burst-pressure-fracture') {
        const blastState = createPfxBlastBurstRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          blastBurstRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uProgress!.value = blastState.progress
        meshShaderMaterial.uniforms.uCompression!.value = blastState.compression
        meshShaderMaterial.uniforms.uBreach!.value = blastState.breach
        meshShaderMaterial.uniforms.uFlash!.value = blastState.flash
        meshShaderMaterial.uniforms.uScatter!.value = blastState.scatter
        meshShaderMaterial.uniforms.uVacuum!.value = blastState.vacuum
        meshShaderMaterial.uniforms.uOpacity!.value = blastState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        return
      }
      if ((meshShader as string | undefined) === 'shockwave-burst-pressure-front') {
        const shockState = createPfxShockwaveBurstRuntimeState(elapsed, controls.timing, controls.lifetime, tempo, styleProfile.motionMultiplier, shockwaveBurstRuntimeState.current)
        meshShaderMaterial.uniforms.uProgress!.value = shockState.progress
        meshShaderMaterial.uniforms.uCompression!.value = shockState.compression
        meshShaderMaterial.uniforms.uExpansion!.value = shockState.expansion
        meshShaderMaterial.uniforms.uFront!.value = shockState.front
        meshShaderMaterial.uniforms.uAttenuation!.value = shockState.attenuation
        meshShaderMaterial.uniforms.uOpacity!.value = shockState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3; const manual = surface.tuning?.positionOffset
        object.current.position.set(bp.x + positionOffset[0] + (manual?.[0] ?? 0), bp.y + positionOffset[1] + (manual?.[1] ?? 0), bp.z + positionOffset[2] + (manual?.[2] ?? 0))
        return
      }
      if ((meshShader as string | undefined) === 'dust-burst-pigment-roll') {
        const dustState = createPfxDustBurstRuntimeState(elapsed, controls.timing, controls.lifetime, tempo, styleProfile.motionMultiplier, dustBurstRuntimeState.current)
        meshShaderMaterial.uniforms.uProgress!.value = dustState.progress
        meshShaderMaterial.uniforms.uCompression!.value = dustState.compression
        meshShaderMaterial.uniforms.uRoll!.value = dustState.roll
        meshShaderMaterial.uniforms.uLoft!.value = dustState.loft
        meshShaderMaterial.uniforms.uSettle!.value = dustState.settle
        meshShaderMaterial.uniforms.uOpacity!.value = dustState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3; const manual = surface.tuning?.positionOffset
        object.current.position.set(bp.x + positionOffset[0] + (manual?.[0] ?? 0), bp.y + positionOffset[1] + (manual?.[1] ?? 0), bp.z + positionOffset[2] + (manual?.[2] ?? 0))
        return
      }
      if ((meshShader as string | undefined) === 'debris-burst-ballistic-breakup') {
        const debrisState = createPfxDebrisBurstRuntimeState(elapsed, controls.timing, controls.lifetime, tempo, styleProfile.motionMultiplier, debrisBurstRuntimeState.current)
        meshShaderMaterial.uniforms.uProgress!.value = debrisState.progress
        meshShaderMaterial.uniforms.uFracture!.value = debrisState.fracture
        meshShaderMaterial.uniforms.uEject!.value = debrisState.eject
        meshShaderMaterial.uniforms.uFall!.value = debrisState.fall
        meshShaderMaterial.uniforms.uDarken!.value = debrisState.darken
        meshShaderMaterial.uniforms.uOpacity!.value = debrisState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3; const manual = surface.tuning?.positionOffset
        object.current.position.set(bp.x + positionOffset[0] + (manual?.[0] ?? 0), bp.y + positionOffset[1] + (manual?.[1] ?? 0), bp.z + positionOffset[2] + (manual?.[2] ?? 0))
        return
      }
      if (meshShader === 'target-spawn-reticle' || meshShader === 'target-spawn-pin') {
        const targetState = createPfxTargetSpawnRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          targetSpawnRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uCycle!.value = targetState.cycle
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * targetState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0) + (meshShader === 'target-spawn-pin' ? -0.18 + targetState.lift * 0.18 : 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        if (meshShader === 'target-spawn-pin') {
          const shaderParentWorldQuaternion = object.current.parent
            ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
            : undefined
          applyPfxSurfaceRotation(
            object.current,
            state.camera.quaternion,
            true,
            0,
            shaderParentWorldQuaternion,
          )
        }
        return
      }
      if (meshShader === 'ui-pickup-receipt') {
        const pickupState = createPfxUiPickupRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          uiPickupRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uCycle!.value = pickupState.cycle
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * pickupState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0) - 0.26 + pickupState.rise * 0.26,
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        const shaderCameraFacing = shouldApplyPfxSurfaceCameraFacing(surface, feelVersion, parentCameraPinned)
        const shaderParentWorldQuaternion = shaderCameraFacing && object.current.parent
          ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
          : undefined
        applyPfxSurfaceRotation(
          object.current,
          state.camera.quaternion,
          shaderCameraFacing,
          0,
          shaderParentWorldQuaternion,
        )
        return
      }
      if (meshShader === 'combo-ring-meter') {
        const comboState = createPfxComboRingRuntimeState(
          elapsed,
          controls.timing,
          controls.lifetime,
          tempo,
          styleProfile.motionMultiplier,
          comboRuntimeState.current,
        )
        meshShaderMaterial.uniforms.uCycle!.value = comboState.cycle
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * comboState.opacity
        const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
        if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
        const bp = object.current.userData['basePosition'] as THREE.Vector3
        const manual = surface.tuning?.positionOffset
        object.current.position.set(
          bp.x + positionOffset[0] + (manual?.[0] ?? 0),
          bp.y + positionOffset[1] + (manual?.[1] ?? 0),
          bp.z + positionOffset[2] + (manual?.[2] ?? 0),
        )
        const shaderCameraFacing = shouldApplyPfxSurfaceCameraFacing(surface, feelVersion, parentCameraPinned)
        const shaderParentWorldQuaternion = shaderCameraFacing && object.current.parent
          ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
          : undefined
        applyPfxSurfaceRotation(
          object.current,
          state.camera.quaternion,
          shaderCameraFacing,
          0,
          shaderParentWorldQuaternion,
        )
        return
      }
      // Same burst master cycle as the sprite renderer and meshMotion clocks.
      const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycle = ((elapsed * timeScale) % (period * Math.max(1, cycleScale))) / period
      meshShaderMaterial.uniforms.uTime!.value = elapsed * timeScale
      meshShaderMaterial.uniforms.uCycle!.value = cycle
      meshShaderMaterial.uniforms.uArcErosion!.value = meshShader === 'arc-sweep' ? createPfxArcSweepErosionStrength(cycle) : 0
      meshShaderMaterial.uniforms.uWakeEnvelope!.value = meshShader === 'projectile-wake'
        ? createPfxProjectileWakeEnvelope(cycle)
        : 1
      const electricLifecycle = meshShader === 'electric-wake'
        ? createPfxElectricTrailLifecycle(cycle)
        : null
      meshShaderMaterial.uniforms.uElectricReach!.value = electricLifecycle?.reach ?? 1
      meshShaderMaterial.uniforms.uElectricDecay!.value = electricLifecycle?.decay ?? 0
      if (surface.kind === 'projectile-comet' && (surface.tuning?.spinScale ?? 0) > 0) {
        // The head rolls around its travel axis as it flies.
        object.current.rotation.x = elapsed * timeScale * (surface.tuning?.spinScale ?? 0) * 2.2
      }
      if (meshShaderMaterial.uniforms.uConeFlow) {
        meshShaderMaterial.uniforms.uConeFlow.value = surface.tuning?.lifecycle === 'level-up-surge'
          ? 3
          : surface.tuning?.lifecycle === 'blast-beam-sustain'
            ? surface.phase === 'blast-beam-hot-core' ? 2 : 1.5
          : surface.tuning?.lifecycle === 'water-cone-surge'
            ? 1.25
          : surface.phase?.includes('crown')
            ? 1
            : surface.phase?.includes('water-surface')
              ? 2
              : 0
      }
      // Shader meshes must honor semantic anchors too — this branch returns
      // early and never reached the offset assignment below. Anchors ADD to
      // the authored JSX position (stomping it shifted the slash arc group
      // 0.78 up and orphaned its contact glint — user-caught).
      const basePosition = object.current.userData['basePosition'] as THREE.Vector3 | undefined
      if (!basePosition) object.current.userData['basePosition'] = object.current.position.clone()
      const bp = object.current.userData['basePosition'] as THREE.Vector3
      const manual = surface.tuning?.positionOffset
      object.current.position.set(
        bp.x + positionOffset[0] + (manual?.[0] ?? 0),
        bp.y + positionOffset[1] + (manual?.[1] ?? 0),
        bp.z + positionOffset[2] + (manual?.[2] ?? 0),
      )
      if (surface.phase?.includes('column-crown')) {
        // The crown rides the surge: it bobs with the column's breathing.
        object.current.position.y = bp.y + positionOffset[1] + Math.sin(elapsed * timeScale * 1.9) * 0.055
      }
      if (fireErodeMaterial) {
        fireErodeMaterial.uniforms.uTime!.value = elapsed * timeScale
        fireErodeMaterial.uniforms.uOpacity!.value = meshShaderMaterial.uniforms.uOpacity!.value
      }
      // Break envelope: intact through the first 12% (impact flash from the
      // other layers), shatters across the next 45%, dead until cycle reset.
      meshShaderMaterial.uniforms.uBreak!.value =
        surface.tuning?.meshMotion === 'break' ? getPfxMeshBreakProgress(surface, cycle) : 0
      // Burst envelopes (flash/shockwave/bloom) animate shader meshes too:
      // scale + opacity arc, else echo shells render permanently.
      const shaderMotion = surface.tuning?.meshMotion
      if (shaderMotion && shaderMotion !== 'break') {
        const motion = getPfxSurfaceAnimationProps(surface, controls, elapsed, cycleScale, tempo, feelVersion)
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity * motion.opacityMultiplier
        const base = object.current.userData['baseScale'] as THREE.Vector3 | undefined
        if (!base) object.current.userData['baseScale'] = object.current.scale.clone()
        const origin = (object.current.userData['baseScale'] as THREE.Vector3).clone()
        object.current.scale.copy(origin.multiplyScalar(motion.scaleMultiplier))
        if (
          surface.tuning?.lifecycle === 'level-up-surge' ||
          surface.tuning?.lifecycle === 'blast-beam-sustain' ||
          surface.tuning?.lifecycle === 'hologram-aura-loop' ||
          surface.tuning?.lifecycle === 'water-cone-surge'
        ) {
          object.current.position.x += motion.xOffset
          object.current.position.y += motion.yOffset
        }
        // Companion NON-shader child materials (bubble highlight dots etc.)
        // must die with the envelope too — the early return below skipped
        // them and they hung on screen forever (bubble-burst review).
        object.current.traverse((child) => {
          if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || child.material === meshShaderMaterial) return
          if (child.userData['pfxBaseOpacity'] == null) child.userData['pfxBaseOpacity'] = child.material.opacity
          child.material.opacity = (child.userData['pfxBaseOpacity'] as number) * motion.opacityMultiplier
        })
      } else {
        meshShaderMaterial.uniforms.uOpacity!.value = materialProps.opacity
      }
      const shaderCameraFacing = shouldApplyPfxSurfaceCameraFacing(surface, feelVersion, parentCameraPinned)
      const shaderParentWorldQuaternion = shaderCameraFacing && object.current.parent
        ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
        : undefined
      applyPfxSurfaceRotation(
        object.current,
        state.camera.quaternion,
        shaderCameraFacing,
        0,
        shaderParentWorldQuaternion,
      )
      return
    }
    const motion = getPfxSurfaceAnimationProps(surface, controls, elapsed, cycleScale, tempo, feelVersion)
    const flipbook = getPfxFlipbookFrameProps(controls, elapsed)
    // turbulenceScale 0 layers are ballistic: the idle group wobble
    // (sinusoidal rotationZ + drift) visibly bent their straight paths into
    // rotated directions no thrown object follows.
    const groupWobble = surface.tuning?.turbulenceScale ?? 1
    // Per-cycle PATTERN rotation (freshness): burst layers land each repeat
    // at a new azimuth — the OBJECT rotates rigidly, so the star/pattern
    // keeps its exact shape (a shader-side attempt sheared streak
    // orientation against position; review verdict: mess of lines).
    let patternSpin = 0
    if (shouldRotatePfxBurstPattern(surface, feelVersion)) {
      const timeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const period = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const cycleIndex = Math.floor((elapsed * timeScale) / (period * Math.max(1, cycleScale)))
      const hashed = Math.sin(cycleIndex * 47.13 + 3.7) * 43758.5453
      patternSpin = (hashed - Math.floor(hashed)) * Math.PI * 2
    }
    const manualOffset = surface.tuning?.positionOffset
    object.current.position.x = positionOffset[0] + (manualOffset?.[0] ?? 0) + motion.xOffset * groupWobble
    object.current.position.y = positionOffset[1] + (manualOffset?.[1] ?? 0) + motion.yOffset * groupWobble
    object.current.position.z = positionOffset[2] + (manualOffset?.[2] ?? 0)
    // v2 flashes billboard: omnidirectional light reads from every angle.
    const cameraFacing = !isMeteorChunkEmission
      && surface.tuning?.meshShader !== 'plasma-impact-flipbook'
      && shouldApplyPfxSurfaceCameraFacing(surface, feelVersion, parentCameraPinned)
    // Particle systems must NEVER rigidly rotate as a group (v2): the aura
    // and impact animation families carry a continuous rotationZ that spun
    // whole emitters around their axis — bubbles corkscrewed, flame licks
    // orbited. Rotation belongs to per-particle motion; groups only keep
    // the per-cycle patternSpin azimuth re-roll for bursts. Meshes retain
    // their authored JSX orientation before this runtime rotation is added.
    const continuousSpin = feelVersion >= 2 && isSimulatedPoints ? 0 : motion.rotationZ * groupWobble
    const parentWorldQuaternion = cameraFacing && object.current.parent
      ? object.current.parent.getWorldQuaternion(surfaceParentWorldQuaternion.current)
      : undefined
    applyPfxSurfaceRotation(
      object.current,
      state.camera.quaternion,
      cameraFacing,
      cameraFacing ? motion.rotationZ * groupWobble : continuousSpin + patternSpin,
      parentWorldQuaternion,
    )
    const baseScale = object.current.userData['baseScale'] as THREE.Vector3 | undefined
    if (!baseScale) {
      object.current.userData['baseScale'] = object.current.scale.clone()
    }
    const originScale = (object.current.userData['baseScale'] as THREE.Vector3).clone()
    object.current.scale.copy(originScale.multiplyScalar(motion.scaleMultiplier))

    if (surface.kind === 'healing-glyphs') {
      const heroPose = createPfxHealingGlyphLayout(elapsed)[0]!
      const hero = object.current.getObjectByName('pfx-healing-hero')
      hero?.position.set(...heroPose.position)
      hero?.rotation.set(0, heroPose.rotationY, 0)
      hero?.scale.setScalar(heroPose.scale)
      const leafField = object.current.getObjectByName('pfx-healing-leaf-helix') as THREE.InstancedMesh | undefined
      if (leafField) {
        if (!leafField.userData['pfxHealingDynamicDraw']) {
          leafField.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          leafField.userData['pfxHealingDynamicDraw'] = true
        }
        const leafLayout = createPfxHealingLeafHelixLayout(elapsed)
        leafLayout.forEach((pose, index) => {
          healingLeafMatrixObject.position.set(...pose.position)
          healingLeafMatrixObject.rotation.set(...pose.rotation)
          healingLeafMatrixObject.scale.setScalar(pose.scale)
          healingLeafMatrixObject.updateMatrix()
          leafField.setMatrixAt(index, healingLeafMatrixObject.matrix)
        })
        leafField.count = leafLayout.length
        leafField.instanceMatrix.needsUpdate = true
      }
      const sparkleField = object.current.getObjectByName('pfx-healing-vine-sparkles') as THREE.InstancedMesh | undefined
      if (sparkleField) {
        const sparkleLayout = createPfxHealingSparkleLayout(elapsed)
        sparkleLayout.forEach((pose, index) => {
          healingLeafMatrixObject.position.set(...pose.position)
          healingLeafMatrixObject.rotation.set(...pose.rotation)
          healingLeafMatrixObject.scale.setScalar(pose.scale)
          healingLeafMatrixObject.updateMatrix()
          sparkleField.setMatrixAt(index, healingLeafMatrixObject.matrix)
        })
        sparkleField.count = sparkleLayout.length
        sparkleField.instanceMatrix.needsUpdate = true
      }
    }

    const meteorChunkField = object.current instanceof THREE.InstancedMesh && object.current.userData['pfxMeteorChunkField']
      ? object.current
      : undefined
    if (meteorChunkField && emission) {
      if (!meteorChunkField.userData['pfxMeteorChunkDynamicDraw']) {
        meteorChunkField.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        meteorChunkField.userData['pfxMeteorChunkDynamicDraw'] = true
      }
      const chunkLayout = createPfxMeteorChunkLayout(
        emission,
        controls,
        elapsed * Math.max(0.1, tempo),
      )
      chunkLayout.forEach((pose, index) => {
        meteorChunkMatrixObject.position.set(...pose.position)
        meteorChunkMatrixObject.rotation.set(...pose.rotation)
        const [scaleX, scaleY, scaleZ] = pose.visible ? pose.scale : [0, 0, 0]
        meteorChunkMatrixObject.scale.set(scaleX, scaleY, scaleZ)
        meteorChunkMatrixObject.updateMatrix()
        meteorChunkField.setMatrixAt(index, meteorChunkMatrixObject.matrix)
        meteorChunkColor.setRGB(...pose.color)
        meteorChunkField.setColorAt(index, meteorChunkColor)
      })
      meteorChunkField.count = chunkLayout.length
      meteorChunkField.instanceMatrix.needsUpdate = true
      if (meteorChunkField.instanceColor) meteorChunkField.instanceColor.needsUpdate = true
    }

    if (object.current instanceof THREE.Group) {
      object.current.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return
        if (child.userData['pfxBaseOpacity'] == null) child.userData['pfxBaseOpacity'] = child.material.opacity
        child.material.opacity =
          (child.userData['pfxBaseOpacity'] as number) * motion.opacityMultiplier * flipbook.opacityMultiplier
      })
    }

    const flameChargeLight = object.current.getObjectByName('pfx-flame-charge-light') as THREE.PointLight | undefined
    if (flameChargeLight) {
      flameChargeLight.intensity = getPfxFlameChargeLightProfile().intensity * motion.opacityMultiplier
    }
    const meteorImpactLight = object.current.getObjectByName('pfx-meteor-impact-light') as THREE.PointLight | undefined
    if (meteorImpactLight) {
      meteorImpactLight.intensity = getPfxMeteorImpactLightProfile().intensity * motion.opacityMultiplier
    }

    if (plasmaImpactFlipbookMaterial) {
      const plasmaTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const plasmaPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const plasmaCycle = ((elapsed * plasmaTimeScale) % (plasmaPeriod * Math.max(1, cycleScale))) / plasmaPeriod
      applyPfxPlasmaImpactFlipbookAppearance(
        plasmaImpactFlipbookMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        plasmaCycle,
      )
      return
    }

    if (spawnScreenReticleMaterial) {
      spawnScreenReticleMaterial.uniforms.uOpacity!.value =
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier
      spawnScreenReticleMaterial.uniforms.uTime!.value = elapsed * Math.max(0.05, controls.timing)
      return
    }

    if (windPressureMaterial?.userData['pfxWindBeamPressureMaterial']) {
      const windTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const windPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const windCycle = ((elapsed * windTimeScale) % (windPeriod * Math.max(1, cycleScale))) / windPeriod
      applyPfxWindBeamPressureMaterialAppearance(
        windPressureMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        windCycle,
      )
      return
    }

    if (magicCircleMaterial) {
      const opacity = materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier
      if (magicCircleMaterial instanceof THREE.ShaderMaterial) {
        magicCircleMaterial.uniforms.uOpacity!.value = opacity
      } else {
        magicCircleMaterial.opacity = opacity
      }
      return
    }
    if (shockwaveSpawnPressureFrontMaterial) {
      shockwaveSpawnPressureFrontMaterial.uniforms.uOpacity!.value =
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxElectricCriticalMaterial']
    ) {
      const voltageTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const voltagePeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const voltageCycle = ((elapsed * voltageTimeScale) % (voltagePeriod * Math.max(1, cycleScale))) / voltagePeriod
      applyPfxElectricCriticalAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        voltageCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxAcidSpawnMaterial']
    ) {
      const acidTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const acidPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const acidCycle = ((elapsed * acidTimeScale) % (acidPeriod * Math.max(1, cycleScale))) / acidPeriod
      applyPfxAcidSpawnMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        acidCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxHealingLoopMaterial']
    ) {
      const healingTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const healingPeriod = Math.max(
        surface.tuning?.lifecycle === 'healing-burst-reference-renewal' ? 0.3 : 0.8,
        Math.max(0.25, controls.lifetime),
      ) * PFX_BURST_CYCLE_MULTIPLIER
      const healingCycle = ((elapsed * healingTimeScale) % (healingPeriod * Math.max(1, cycleScale))) / healingPeriod
      applyPfxHealingLoopMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        healingCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxHolyReleaseMaterial']
    ) {
      const holyTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const holyPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const holyCycle = ((elapsed * holyTimeScale) % (holyPeriod * Math.max(1, cycleScale))) / holyPeriod
      applyPfxHolyReleaseMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        holyCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxCurseConeMaterial']
    ) {
      const curseTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const cursePeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const curseCycle = ((elapsed * curseTimeScale) % (cursePeriod * Math.max(1, cycleScale))) / cursePeriod
      applyPfxCurseConeMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        curseCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxShadowBreakMaterial']
    ) {
      const shadowTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const shadowPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const shadowCycle = ((elapsed * shadowTimeScale) % (shadowPeriod * Math.max(1, cycleScale))) / shadowPeriod
      applyPfxShadowBreakMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        shadowCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxBloodDeathMaterial']
    ) {
      const bloodTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const bloodPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const bloodCycle = ((elapsed * bloodTimeScale) % (bloodPeriod * Math.max(1, cycleScale))) / bloodPeriod
      applyPfxBloodDeathMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        bloodCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxGhostTrailMaterial']
    ) {
      const ghostTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const ghostPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const ghostCycle = ((elapsed * ghostTimeScale) % (ghostPeriod * Math.max(1, cycleScale))) / ghostPeriod
      applyPfxGhostTrailMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        ghostCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxPortalTelegraphMaterial']
    ) {
      const portalTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const portalPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const portalCycle = ((elapsed * portalTimeScale) % (portalPeriod * Math.max(1, cycleScale))) / portalPeriod
      applyPfxPortalTelegraphMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        portalCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxTeleportHitMaterial']
    ) {
      const teleportTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const teleportPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const teleportCycle = ((elapsed * teleportTimeScale) % (teleportPeriod * Math.max(1, cycleScale))) / teleportPeriod
      applyPfxTeleportHitMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        teleportCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxDashIdleMaterial']
    ) {
      const dashTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const dashPeriod = Math.max(0.8, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const dashCycle = ((elapsed * dashTimeScale) % (dashPeriod * Math.max(1, cycleScale))) / dashPeriod
      applyPfxDashIdleMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        dashCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxJumpBeamMaterial']
    ) {
      const jumpTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const jumpPeriod = Math.max(0.8, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const jumpCycle = ((elapsed * jumpTimeScale) % (jumpPeriod * Math.max(1, cycleScale))) / jumpPeriod
      applyPfxJumpBeamMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        jumpCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxFootstepAmbientMaterial']
    ) {
      const footstepTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const footstepPeriod = Math.max(0.8, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const footstepCycle = ((elapsed * footstepTimeScale) % (footstepPeriod * Math.max(1, cycleScale))) / footstepPeriod
      applyPfxFootstepAmbientMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        footstepCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxPickupBurstMaterial']
    ) {
      const pickupTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const pickupPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const pickupCycle = ((elapsed * pickupTimeScale) % (pickupPeriod * Math.max(1, cycleScale))) / pickupPeriod
      applyPfxPickupBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        pickupCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxRewardChargeMaterial']
    ) {
      const rewardTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const rewardPeriod = Math.max(0.8, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const rewardCycle = ((elapsed * rewardTimeScale) % (rewardPeriod * Math.max(1, cycleScale))) / rewardPeriod
      applyPfxRewardChargeMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        rewardCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxBarrierColumnMaterial']
    ) {
      const barrierTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const barrierPeriod = Math.max(0.8, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const barrierCycle = ((elapsed * barrierTimeScale) % (barrierPeriod * Math.max(1, cycleScale))) / barrierPeriod
      applyPfxBarrierColumnMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        barrierCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxDespawnImpactMaterial']
    ) {
      const despawnTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const despawnPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const despawnCycle = ((elapsed * despawnTimeScale) % (despawnPeriod * Math.max(1, cycleScale))) / despawnPeriod
      applyPfxDespawnImpactMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        despawnCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxPlasmaHitMaterial']
    ) {
      const plasmaTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const plasmaPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const plasmaCycle = ((elapsed * plasmaTimeScale) % (plasmaPeriod * Math.max(1, cycleScale))) / plasmaPeriod
      applyPfxPlasmaHitMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        plasmaCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxLaserSprayMaterial']
    ) {
      const sprayTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const sprayPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const sprayCycle = ((elapsed * sprayTimeScale) % (sprayPeriod * Math.max(1, cycleScale))) / sprayPeriod
      applyPfxLaserSprayMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        sprayCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxBeamTelegraphMaterial']
    ) {
      const warningTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const warningPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const warningCycle = ((elapsed * warningTimeScale) % (warningPeriod * Math.max(1, cycleScale))) / warningPeriod
      applyPfxBeamTelegraphMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        warningCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxGlyphTrailMaterial']
    ) {
      const glyphTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const glyphPeriod = 1.35 * Math.max(0.25, controls.lifetime)
      const glyphCycle = ((elapsed * glyphTimeScale) % (glyphPeriod * Math.max(1, cycleScale))) / glyphPeriod
      applyPfxGlyphTrailMaterialOpacity(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
      )
      applyPfxGlyphTrailMaterialCycle(impactShardMaterial, glyphCycle)
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxIceImpactMaterial']
    ) {
      const iceTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const icePeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const iceCycle = ((elapsed * iceTimeScale) % (icePeriod * Math.max(1, cycleScale))) / icePeriod
      applyPfxIceImpactAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        iceCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxFrostAuraMaterial']
    ) {
      const frostTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      applyPfxFrostAuraMaterialOpacity(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
      )
      applyPfxFrostAuraMaterialCycle(impactShardMaterial, elapsed * frostTimeScale * 0.42)
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxWaterColumnMaterial']
    ) {
      const waterTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const waterPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const waterCycle = ((elapsed * waterTimeScale) % (waterPeriod * Math.max(1, cycleScale))) / waterPeriod
      applyPfxWaterColumnMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        waterCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxSnowIdleMaterial']
    ) {
      const snowTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const snowPeriod = Math.max(0.8, Math.max(0.25, controls.lifetime)) * 2.6
      const snowCycle = ((elapsed * snowTimeScale) % (snowPeriod * Math.max(1, cycleScale))) / snowPeriod
      applyPfxSnowIdleMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        snowCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxWindBeamLeafMaterial']
    ) {
      const windTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const windPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const windCycle = ((elapsed * windTimeScale) % (windPeriod * Math.max(1, cycleScale))) / windPeriod
      applyPfxWindBeamLeafMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        windCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxPetalAmbientMaterial']
    ) {
      const petalTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const petalPeriod = 1.4
      const petalCycle = ((elapsed * petalTimeScale) % (petalPeriod * Math.max(1, cycleScale))) / petalPeriod
      applyPfxPetalAmbientMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        petalCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxSandBurstMaterial']
    ) {
      const sandTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const sandPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const sandCycle = ((elapsed * sandTimeScale) % (sandPeriod * Math.max(1, cycleScale))) / sandPeriod
      applyPfxSandBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        sandCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxRainBurstMaterial']
    ) {
      const rainTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const rainPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const rainCycle = ((elapsed * rainTimeScale) % (rainPeriod * Math.max(1, cycleScale))) / rainPeriod
      applyPfxRainBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        rainCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxSnowBurstMaterial']
    ) {
      const snowBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const snowBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const snowBurstCycle = ((elapsed * snowBurstTimeScale) % (snowBurstPeriod * Math.max(1, cycleScale))) / snowBurstPeriod
      applyPfxSnowBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        snowBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxWindBurstMaterial']
    ) {
      const windBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const windBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const windBurstCycle = ((elapsed * windBurstTimeScale) % (windBurstPeriod * Math.max(1, cycleScale))) / windBurstPeriod
      applyPfxWindBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        windBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxLeafBurstMaterial']
    ) {
      const leafBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const leafBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const leafBurstCycle = ((elapsed * leafBurstTimeScale) % (leafBurstPeriod * Math.max(1, cycleScale))) / leafBurstPeriod
      applyPfxLeafBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        leafBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxPetalBurstMaterial']
    ) {
      const petalBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const petalBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const petalBurstCycle = ((elapsed * petalBurstTimeScale) % (petalBurstPeriod * Math.max(1, cycleScale))) / petalBurstPeriod
      applyPfxPetalBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        petalBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxMudBurstMaterial']
    ) {
      const mudBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const mudBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const mudBurstCycle = ((elapsed * mudBurstTimeScale) % (mudBurstPeriod * Math.max(1, cycleScale))) / mudBurstPeriod
      applyPfxMudBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        mudBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxSlimeBurstMaterial']
    ) {
      const slimeBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const slimeBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const slimeBurstCycle = ((elapsed * slimeBurstTimeScale) % (slimeBurstPeriod * Math.max(1, cycleScale))) / slimeBurstPeriod
      applyPfxSlimeBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        slimeBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxPoisonBurstMaterial']
    ) {
      const poisonBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const poisonBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const poisonBurstCycle = ((elapsed * poisonBurstTimeScale) % (poisonBurstPeriod * Math.max(1, cycleScale))) / poisonBurstPeriod
      applyPfxPoisonBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        poisonBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxAcidBurstMaterial']
    ) {
      const acidBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const acidBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const acidBurstCycle = ((elapsed * acidBurstTimeScale) % (acidBurstPeriod * Math.max(1, cycleScale))) / acidBurstPeriod
      applyPfxAcidBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        acidBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxHealingBurstMaterial']
    ) {
      const healingBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const healingBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const healingBurstCycle = ((elapsed * healingBurstTimeScale) % (healingBurstPeriod * Math.max(1, cycleScale))) / healingBurstPeriod
      applyPfxHealingBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        healingBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxHolyBurstMaterial']
    ) {
      const holyBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const holyBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const holyBurstCycle = ((elapsed * holyBurstTimeScale) % (holyBurstPeriod * Math.max(1, cycleScale))) / holyBurstPeriod
      applyPfxHolyBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        holyBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxCurseBurstMaterial']
    ) {
      const curseBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const curseBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const curseBurstCycle = ((elapsed * curseBurstTimeScale) % (curseBurstPeriod * Math.max(1, cycleScale))) / curseBurstPeriod
      applyPfxCurseBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        curseBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxShadowBurstMaterial']
    ) {
      const shadowBurstTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const shadowBurstPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const shadowBurstCycle = ((elapsed * shadowBurstTimeScale) % (shadowBurstPeriod * Math.max(1, cycleScale))) / shadowBurstPeriod
      applyPfxShadowBurstMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        shadowBurstCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxMudChargeMaterial']
    ) {
      const mudTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const mudPeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const mudCycle = ((elapsed * mudTimeScale) % (mudPeriod * Math.max(1, cycleScale))) / mudPeriod
      applyPfxMudChargeMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        mudCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxSlimeRingMaterial']
    ) {
      const slimeTimeScale = Math.max(0.05, controls.timing) * styleProfile.motionMultiplier * Math.max(0.1, tempo)
      const slimePeriod = Math.max(0.3, Math.max(0.25, controls.lifetime)) * PFX_BURST_CYCLE_MULTIPLIER
      const slimeCycle = ((elapsed * slimeTimeScale) % (slimePeriod * Math.max(1, cycleScale))) / slimePeriod
      applyPfxSlimeRingMaterialAppearance(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
        slimeCycle,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxShardBreakMaterial']
    ) {
      applyPfxShardBreakMaterialOpacity(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxSparkConeMaterial']
    ) {
      applyPfxSparkConeMaterialOpacity(
        impactShardMaterial,
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier,
      )
      return
    }
    if (
      impactShardMaterial instanceof THREE.ShaderMaterial &&
      impactShardMaterial.userData['pfxShockwaveSpawnArrivalFlare']
    ) {
      impactShardMaterial.uniforms.uOpacity!.value =
        materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier
      impactShardMaterial.uniforms.uTime!.value = elapsed * Math.max(0.05, controls.timing)
      impactShardMaterial.uniforms.uBurstProgress!.value = THREE.MathUtils.clamp(
        (motion.scaleMultiplier - 0.88) / 0.18,
        0,
        1.8,
      )
      return
    }
    if (spriteMaterial) {
      spriteMaterial.uniforms.uOpacity!.value =
        Math.min(1, materialProps.opacity * 1.25) * motion.opacityMultiplier * flipbook.opacityMultiplier
      return
    }
    const material =
      object.current instanceof THREE.Points
        ? object.current.material
        : object.current instanceof THREE.Mesh
          ? object.current.material
          : null
    if (material && !Array.isArray(material)) {
      const isMeteorImpactMaterial =
        material instanceof THREE.MeshStandardMaterial &&
        material.userData['pfxMaterial'] === 'meteor-ring-molten-impact'
      if (isMeteorImpactMaterial) {
        const appearance = applyPfxMeteorImpactAppearance(material, motion.opacityMultiplier)
        object.current.visible = appearance.visible
      } else {
        material.opacity = materialProps.opacity * motion.opacityMultiplier * flipbook.opacityMultiplier
      }
      if (material instanceof THREE.PointsMaterial) {
        material.size =
          PFX_PARTICLE_BASE_SIZE *
          controls.scale *
          materialProps.particleSizeMultiplier *
          (1 + controls.emissiveBloom * 0.22) *
          flipbook.sizeMultiplier
      }
    }
  })

  if (screenVignetteMaterial) {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        material={screenVignetteMaterial}
        frustumCulled={false}
        renderOrder={1000}
      >
        <planeGeometry args={[2, 2]} />
      </mesh>
    )
  }

  if (meteorChunkGeometry && meteorChunkMaterial && emission) {
    return (
      <instancedMesh
        ref={object as RefObject<THREE.InstancedMesh>}
        args={[meteorChunkGeometry, meteorChunkMaterial, emission.count]}
        frustumCulled={false}
        userData={{ pfxMeteorChunkField: true }}
      />
    )
  }

  if (spriteGeometry && spriteMaterial) {
    return <mesh ref={object as RefObject<THREE.Mesh>} geometry={spriteGeometry} material={spriteMaterial} frustumCulled={false} />
  }

  if (meshShaderMaterial) {
    if (meshShader === 'flame-burst-blossom' || meshShader === 'meteor-burst-collision' || (meshShader as string | undefined) === 'blast-burst-pressure-fracture' || (meshShader as string | undefined) === 'shockwave-burst-pressure-front' || (meshShader as string | undefined) === 'dust-burst-pigment-roll' || (meshShader as string | undefined) === 'debris-burst-ballistic-breakup') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={impactShardGeometry ?? undefined}
          material={meshShaderMaterial}
          scale={surface.scale}
          frustumCulled={(meshShader as string | undefined) !== 'debris-burst-ballistic-breakup'}
        />
      )
    }
    if (meshShader === 'exhaust-telegraph-lane') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.5, 1.8]} />
        </mesh>
      )
    }
    if (meshShader === 'exhaust-telegraph-vent') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.36, 0.36, 0.16, 12, 1, false]} />
        </mesh>
      )
    }
    if (meshShader === 'thruster-trail-plume') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.38, 2.8, 12, 6, true]} />
        </mesh>
      )
    }
    if (meshShader === 'thruster-trail-nozzle') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.42, 12]} />
        </mesh>
      )
    }
    if (meshShader === 'hologram-break-figure') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale}>
          <planeGeometry args={[1.5, 2.4]} />
        </mesh>
      )
    }
    if (meshShader === 'hologram-break-projector') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.1, 2.1]} />
        </mesh>
      )
    }
    if (meshShader === 'scan-cone-footprint') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 2.3]} />
        </mesh>
      )
    }
    if (meshShader === 'scan-cone-volume') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.95, 2.4, 12, 1, true, -0.7, 1.4]} />
        </mesh>
      )
    }
    if (meshShader === 'warning-loop-panel') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.3, 2.3]} />
        </mesh>
      )
    }
    if (meshShader === 'warning-loop-beacon') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale}>
          <planeGeometry args={[1.05, 1.4]} />
        </mesh>
      )
    }
    if (meshShader === 'marker-release-ground') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.2, 2.2]} />
        </mesh>
      )
    }
    if (meshShader === 'marker-release-badge') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale}>
          <planeGeometry args={[1.15, 1.45]} />
        </mesh>
      )
    }
    if (meshShader === 'target-spawn-reticle') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.25, 2.25]} />
        </mesh>
      )
    }
    if (meshShader === 'target-spawn-pin') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale}>
          <planeGeometry args={[1.15, 2]} />
        </mesh>
      )
    }
    if (meshShader === 'ui-pickup-receipt') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale * 1.42}>
          <planeGeometry args={[2.2, 1.25]} />
        </mesh>
      )
    }
    if (meshShader === 'combo-ring-meter') {
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale * 1.42}>
          <planeGeometry args={[1.8, 1.8]} />
        </mesh>
      )
    }
    if (surface.tuning?.meshGeometry === 'flame-charge-convergence-tendrils') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={impactShardGeometry ?? undefined}
          material={meshShaderMaterial}
          scale={surface.scale}
          rotation={[0.08, 0.16, -0.06]}
        />
      )
    }
    if (meshShader === 'fire-body' && flameChargeCrucibleGeometry) {
      const light = getPfxFlameChargeLightProfile()
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={flameChargeCrucibleGeometry}
          material={meshShaderMaterial}
          scale={surface.scale}
          rotation={[0.18, 0.28, -0.08]}
        >
          <pointLight
            name="pfx-flame-charge-light"
            color={light.color}
            intensity={light.intensity}
            distance={light.distance}
            decay={light.decay}
          />
        </mesh>
      )
    }
    if (meshShader === 'acid-pool') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={acidPoolGeometry ?? undefined}
          material={meshShaderMaterial}
          position={[0, 0, 0]}
          scale={surface.scale}
        />
      )
    }
    if (meshShader === 'fire-body' && surface.tuning?.meshMotion !== 'travel') {
      // UPRIGHT FLAME (element pass): a standing fire is a teardrop — wide
      // base, tapering tip — never a ball. Comets keep the travel squash
      // below; loops and idles burn upward.
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          <mesh material={meshShaderMaterial} scale={[0.78, 1.35, 0.78]}>
            <sphereGeometry args={[0.5, Math.max(24, segmentCount), Math.max(16, Math.floor(segmentCount * 0.66))]} />
          </mesh>
          <mesh material={meshShaderMaterial} position={[0, 0.52, 0]} scale={[0.42, 0.95, 0.42]}>
            <sphereGeometry args={[0.5, Math.max(20, segmentCount), 12]} />
          </mesh>
          {fireErodeMaterial ? (
            <>
              <mesh material={fireErodeMaterial} scale={[0.86, 1.45, 0.86]}>
                <sphereGeometry args={[0.5, Math.max(24, segmentCount), Math.max(16, Math.floor(segmentCount * 0.66))]} />
              </mesh>
              <mesh material={fireErodeMaterial} position={[0, 0.56, 0]} scale={[0.48, 1.02, 0.48]}>
                <sphereGeometry args={[0.5, 16, 10]} />
              </mesh>
            </>
          ) : null}
        </group>
      )
    }
    if (meshShader === 'fire-body') {
      // Single burning sphere: the lobe chain read as croissant segments at
      // close range (review); the helix strands wrapping behind the head now
      // carry the taper, so geometry stays one clean mass.
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          {/* Velocity squash: stretched along the travel axis, flattened
              across it — a still-perfect sphere reads parked. */}
          <mesh material={meshShaderMaterial} scale={[1.16, 0.9, 0.9]}>
            <sphereGeometry args={[0.5, Math.max(24, segmentCount), Math.max(16, Math.floor(segmentCount * 0.66))]} />
          </mesh>
          {/* Eroded-alpha shell: hard-edged holes advecting nose-to-tail —
              the surface itself streams backward (review-directed). */}
          {fireErodeMaterial ? (
            <mesh material={fireErodeMaterial} scale={[1.24, 0.98, 0.98]}>
              <sphereGeometry args={[0.5, Math.max(24, segmentCount), Math.max(16, Math.floor(segmentCount * 0.66))]} />
            </mesh>
          ) : null}
        </group>
      )
    }
    if (surface.kind === 'bubble-shells') {
      const bubbles: Array<[number, number, number, number]> = [
        [-0.34, -0.42, 0.18, 0.18], [0.28, -0.12, -0.24, 0.12], [-0.16, 0.16, 0.28, 0.22],
        [0.34, 0.46, 0.12, 0.15], [-0.26, 0.72, -0.16, 0.11], [0.08, 1.02, 0.2, 0.19],
      ]
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          {bubbles.map(([x, y, z, size], index) => (
            <group key={index} position={[x, y, z]} scale={size}>
              <mesh material={meshShaderMaterial}><sphereGeometry args={[1, 24, 16]} /></mesh>
              <mesh material={solidSurfaceMaterial} position={[-0.34, 0.36, 0.58]} scale={0.1}>
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      )
    }
    if (meshShader === 'trail-flow') {
      // Spec F1: the hero wake is ONE ribbon, not a particle spray. Crossed
      // pair keeps the read from every angle; taper + erosion live in-shader.
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          <mesh material={meshShaderMaterial} position={[-0.55, 0, 0]}>
            <planeGeometry args={[2.2, 0.5, 24, 1]} />
          </mesh>
          <mesh material={meshShaderMaterial} position={[-0.55, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.2, 0.5, 24, 1]} />
          </mesh>
        </group>
      )
    }
    if (meshShader === 'projectile-wake') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={projectileWakeGeometry ?? undefined}
          material={meshShaderMaterial}
          position={[-1.42 * surface.scale, 0, 0]}
          scale={surface.scale}
        />
      )
    }
    if (meshShader === 'electric-wake') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={electricWakeGeometry ?? undefined}
          material={meshShaderMaterial}
          position={[-0.12 * surface.scale, 0, 0]}
          scale={surface.scale}
        />
      )
    }
    if (meshShader === 'water-flow' && surface.kind === 'water-cone-sheet') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={waterConeGeometry ?? undefined}
          material={meshShaderMaterial}
          rotation={[0, 0, -Math.PI / 2]}
          scale={surface.scale}
        />
      )
    }
    if (meshShader === 'water-flow' && surface.phase?.includes('water-surface')) {
      // A body of water is a SURFACE, not a spout: flat disc on the ground
      // wearing the canonical water-flow shader in radial pool mode.
      return (
        <group ref={object as RefObject<THREE.Group>} position={[0, -0.87, 0]} scale={surface.scale}>
          <mesh material={meshShaderMaterial} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1, Math.max(48, segmentCount)]} />
          </mesh>
        </group>
      )
    }
    if ((meshShader === 'energy-column' || meshShader === 'water-flow') && surface.phase?.includes('crown')) {
      // Crown funnel: open cone flaring upward at the column apex, wearing
      // the flow shader. (The muzzle-cone branch is unreachable for
      // shader-carrying layers — the router owns them; crown lives here.)
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} rotation={[Math.PI, 0, 0]} scale={surface.scale}>
          <coneGeometry args={[0.78, 0.5, Math.max(24, segmentCount), 2, true]} />
        </mesh>
      )
    }
    if (meshShader === 'energy-column' && surface.tuning?.lifecycle === 'blast-beam-sustain') {
      const widthScale = surface.tuning?.widthScale ?? 1
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={blastBeamGeometry ?? undefined}
          material={meshShaderMaterial}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[surface.scale * widthScale, surface.scale, surface.scale * widthScale]}
        />
      )
    }
    if (meshShader === 'energy-column' && surface.tuning?.lifecycle === 'curse-column-binding') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={curseColumnGeometry ?? undefined}
          material={meshShaderMaterial}
          rotation={[0, 0.16, 0]}
          scale={[surface.scale, surface.scale * 1.1, surface.scale]}
        />
      )
    }
    if (meshShader === 'energy-column' && surface.tuning?.lifecycle === 'level-up-surge') {
      const widthScale = surface.tuning?.widthScale ?? 1
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale} rotation={[0, 0.18, 0]}>
          {/* Closed tapered heart: broad enough to pass through the actor,
              with a warm base and narrow crown instead of a needle. */}
          <mesh material={meshShaderMaterial} scale={[0.19 * widthScale, 1, 0.19 * widthScale]}>
            <cylinderGeometry args={[0.16, 0.42, 2.5, Math.max(24, segmentCount), 5, false]} />
          </mesh>
          {/* Offset faceted mantle breaks rotational symmetry, creating real
              parallax and the rising ceremonial silhouette missing from the
              baseline's camera-invariant tube. */}
          <mesh material={meshShaderMaterial} position={[-0.18, -0.08, 0.12]} rotation={[0.05, 0.42, -0.1]} scale={[0.16 * widthScale, 0.92, 0.13 * widthScale]}>
            <coneGeometry args={[0.48, 2.28, 7, 4, true]} />
          </mesh>
          <mesh material={meshShaderMaterial} position={[0.24, -0.18, -0.14]} rotation={[-0.04, -0.52, 0.14]} scale={[0.1 * widthScale, 0.72, 0.085 * widthScale]}>
            <coneGeometry args={[0.4, 2.12, 6, 3, true]} />
          </mesh>
          {/* Integrated upward crest: the shaft grows out of the same energy
              body and the arrowhead states progression without borrowing a
              loot gem from a different material language. */}
          <mesh material={meshShaderMaterial} position={[0.11, 0.86, 0.07]} rotation={[0.04, 0.12, -0.06]}>
            <cylinderGeometry args={[0.08, 0.11, 0.42, 10, 2, false]} />
          </mesh>
          <mesh material={meshShaderMaterial} position={[0.11, 1.13, 0.07]} rotation={[0.04, 0.12, -0.06]}>
            <coneGeometry args={[0.24, 0.42, 10, 3, false]} />
          </mesh>
        </group>
      )
    }
    if (meshShader === 'energy-column' || meshShader === 'water-flow') {
      const widthScale = surface.tuning?.widthScale ?? 1
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          <mesh material={meshShaderMaterial} scale={[0.34 * widthScale, 1.45, 0.34 * widthScale]}>
            <cylinderGeometry args={[0.035, 0.13, 1.7, Math.max(24, segmentCount), 4, true]} />
          </mesh>
          <mesh material={meshShaderMaterial} rotation={[0, Math.PI / 3, 0]} scale={[0.18 * widthScale, 1.18, 0.18 * widthScale]}>
            <cylinderGeometry args={[0.025, 0.1, 1.7, Math.max(18, segmentCount), 3, true]} />
          </mesh>
        </group>
      )
    }
    if (meshShader === 'toxic-pool') {
      return (
        <group ref={object as RefObject<THREE.Group>} position={[0, -0.87, 0]} scale={surface.scale}>
          <mesh material={meshShaderMaterial} rotation={[-Math.PI / 2, 0, 0]} scale={[1.22, 0.9, 1]}>
            <circleGeometry args={[0.82, Math.max(48, segmentCount)]} />
          </mesh>
          <mesh material={meshShaderMaterial} position={[0.18, 0.018, -0.14]} rotation={[-Math.PI / 2, 0, 0.4]} scale={[0.72, 0.48, 1]}>
            <circleGeometry args={[0.82, Math.max(40, segmentCount)]} />
          </mesh>
        </group>
      )
    }
    if (meshShader === 'energy-trail') {
      const trails: Array<[number, number, number, number]> = [
        [-0.48, 0, 0, 1], [-0.68, 0.12, 0.14, 0.68], [-0.72, -0.11, -0.16, 0.56],
      ]
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale} rotation={[0, 0.34, 0.04]}>
          {trails.map(([x, y, z, size], index) => (
            <mesh key={index} material={meshShaderMaterial} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} scale={[size * 0.28, size * 1.18, size * 0.28]}>
              <coneGeometry args={[0.36, 1.35, 20, 3, true]} />
            </mesh>
          ))}
        </group>
      )
    }
    if (meshShader === 'energy-chevron') {
      const heights = [-0.52, 0.02, 0.56]
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          {heights.flatMap((y, level) => [-1, 1].map((side) => (
            <mesh
              key={`${level}-${side}`}
              material={meshShaderMaterial}
              position={[side * 0.25, y, level * -0.14]}
              rotation={[0, level * 0.2, side * -0.7]}
              scale={[0.09, 0.58, 0.09]}
            >
              <coneGeometry args={[0.5, 1, 12, 2, true]} />
            </mesh>
          )))}
        </group>
      )
    }
    if (meshShader === 'hologram-shell') {
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale * 1.24} position={[0, 0.08, 0]}>
          {/* The outer scan cage is an actual ellipsoid around the projected
              object; the inner faceted core makes "holographic object" read
              even without a game mesh mounted inside the reusable aura. */}
          <mesh material={meshShaderMaterial} scale={[0.82, 1.16, 0.82]}>
            <sphereGeometry args={[0.72, 40, 28]} />
          </mesh>
          <mesh material={meshShaderMaterial} rotation={[0.08, 0.42, -0.06]} scale={[0.42, 0.68, 0.42]}>
            <icosahedronGeometry args={[0.72, 1]} />
          </mesh>
        </group>
      )
    }
    if (meshShader === 'fresnel-shell' || meshShader === 'hex-shell' || meshShader === 'barrier-failure-shell' || meshShader === 'force-field-shell' || meshShader === 'heal-wave') {
      if (barrierLowHealthGeometry) {
        return (
          <mesh
            ref={object as RefObject<THREE.Mesh>}
            geometry={barrierLowHealthGeometry}
            material={meshShaderMaterial}
            scale={[surface.scale * 1.18, surface.scale * 1.34, surface.scale * 1.18]}
          />
        )
      }
      if (targetLockShellGeometry) {
        return (
          <mesh
            ref={object as RefObject<THREE.Mesh>}
            geometry={targetLockShellGeometry}
            material={meshShaderMaterial}
            scale={surface.scale * 1.3}
          />
        )
      }
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial} scale={surface.scale * 1.3}>
          <sphereGeometry args={[0.72, 48, 32]} />
        </mesh>
      )
    }
    if (meshShader === 'vortex-swirl') {
      // The swirl shader IS the portal — bare accent toruses around it read
      // as untextured magenta donuts (user round: "missing textures").
      // Billboarded plane keeps the read from every angle.
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale * 1.4}>
          <mesh material={meshShaderMaterial}>
            <planeGeometry args={[1.6, 1.6]} />
          </mesh>
        </group>
      )
    }
    if (meshShader === 'portal-throat') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          material={meshShaderMaterial}
          geometry={portalThroatGeometry ?? undefined}
          position={[0, 0, 0.02 * surface.scale]}
          scale={surface.scale * 1.25}
        />
      )
    }
    if (meshShader === 'arc-sweep') {
      return (
        <group
          ref={object as RefObject<THREE.Group>}
          position={[0, -0.78, 0]}
          rotation={[0, 0.55, 0.5]}
          scale={surface.scale * 1.25}
        >
          <mesh material={meshShaderMaterial} geometry={slashArcGeometry ?? undefined} />
        </group>
      )
    }
    return (
      <group
        ref={object as RefObject<THREE.Group>}
        position={[0, -0.78, 0]}
        rotation={[0, 0, 0.5]}
        scale={surface.scale * 1.25}
      >
        {[
          { depth: -spatialPolicy.minimumDepth * 0.38, rotationY: 0, scale: 1 },
          { depth: spatialPolicy.minimumDepth * 0.38, rotationY: 1.15, scale: 0.78 },
        ].map((sweep) => (
          <mesh
            key={sweep.rotationY}
            material={meshShaderMaterial}
            position={[0, 0, sweep.depth]}
            rotation={[0, sweep.rotationY, 0]}
            scale={sweep.scale}
          >
            <ringGeometry
              args={[PFX_ARC_INNER_RADIUS, PFX_ARC_OUTER_RADIUS, 72, 1, PFX_ARC_THETA_START, PFX_ARC_THETA_LENGTH]}
            />
          </mesh>
        ))}
      </group>
    )
  }

  // v2 omnidirectional light reads are keyed to the MESH MOTION, not the
  // kind — kind-scoped fixes let barrier-burst's shield-shell flash regress
  // to an angle-dependent mesh (review caught the same bug twice).
  if (
    (surface.kind === 'core-sphere' || surface.kind === 'shield-shell' || surface.kind === 'screen-plane') &&
    isPfxOmniLightRead(surface.tuning) &&
    feelVersion >= 2 &&
    !surface.tuning?.meshShader
  ) {
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={flashGlowMaterial ?? coreSurfaceMaterial} scale={surface.scale}>
        <planeGeometry args={[1.9, 1.9]} />
      </mesh>
    )
  }

  if (surface.kind === 'impact-core') {
    if (surface.tuning?.meshGeometry === 'exhaust-hit-mechanical-nozzle') {
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={impactCoreGeometry ?? undefined}
          material={impactCoreMaterial ?? solidSurfaceMaterial}
          scale={surface.scale}
        />
      )
    }
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={impactCoreGeometry ?? undefined}
        material={impactCoreMaterial ?? solidSurfaceMaterial}
        rotation={[0.08, -0.12, -0.04]}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'impact-shards') {
    if (surface.tuning?.meshGeometry === 'meteor-ring-impact-crater') {
      const light = getPfxMeteorImpactLightProfile()
      return (
        <mesh
          ref={object as RefObject<THREE.Mesh>}
          geometry={impactShardGeometry ?? undefined}
          material={impactShardMaterial ?? solidSurfaceMaterial}
          rotation={[0, 0, 0]}
          scale={surface.scale}
        >
          <pointLight
            name="pfx-meteor-impact-light"
            color={light.color}
            intensity={light.intensity}
            distance={light.distance}
            decay={light.decay}
            position={[0, 0.32, 0]}
          />
        </mesh>
      )
    }
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={impactShardGeometry ?? undefined}
        material={impactShardMaterial ?? solidSurfaceMaterial}
        rotation={
          surface.tuning?.meshGeometry === 'ice-impact-grounded-splinters' ||
          surface.tuning?.meshGeometry === 'frost-aura-crystal-crown' ||
          surface.tuning?.meshGeometry === 'water-column-churning-body' ||
          surface.tuning?.meshGeometry === 'water-column-foam-spray' ||
          surface.tuning?.meshGeometry === 'snow-idle-flurry-field' ||
          surface.tuning?.meshGeometry === 'snow-idle-depth-granules' ||
          surface.tuning?.meshGeometry === 'wind-beam-debris-leaves' ||
          (surface.tuning?.meshGeometry as string | undefined) === 'barrier-column-fortified-pillar' ||
          (surface.tuning?.meshGeometry as string | undefined) === 'dash-idle-vector-reservoir' ||
          (surface.tuning?.meshGeometry as string | undefined) === 'jump-beam-updraft-accelerator' ||
          (surface.tuning?.meshGeometry as string | undefined) === 'footstep-ambient-cadence-wake' ||
          (surface.tuning?.meshGeometry as string | undefined) === 'pickup-burst-reward-receipt' ||
          (surface.tuning?.meshGeometry as string | undefined) === 'reward-charge-gilded-capacitor'
            ? [0, 0, 0]
            : [0.02, -0.08, 0.035]
        }
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'coin-reward-burst') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={coinRewardBurstGeometry ?? undefined}
        material={coinRewardBurstMaterial ?? solidSurfaceMaterial}
        rotation={[0.06, 0.14, -0.035]}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'shield-fragments') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={shieldFragmentGeometry ?? undefined}
        material={shieldFragmentMaterial ?? solidSurfaceMaterial}
        rotation={[0.08, 0.18, -0.06]}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'beam-column' && surface.tuning?.meshGeometry === 'curse-twisted-spire') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={curseColumnGeometry ?? undefined}
        material={solidSurfaceMaterial}
        rotation={[0, 0.16, 0]}
        scale={[surface.scale, surface.scale * 1.14, surface.scale]}
      />
    )
  }

  if (surface.kind === 'core-sphere' && surface.tuning?.meshShader === 'plasma-impact-flipbook') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={plasmaImpactVolumeGeometry ?? undefined}
        material={plasmaImpactFlipbookMaterial ?? flashGlowMaterial ?? coreSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'core-sphere' && surface.tuning?.meshGeometry === 'plasma-ambient-contained-core') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={plasmaAmbientCoreGeometry ?? undefined}
        material={plasmaAmbientCoreMaterial ?? solidSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'core-sphere') {
    if (isPfxOmniLightRead(surface.tuning) && feelVersion >= 2) {
      // v2: camera-facing soft glow card — omnidirectional read. 'flash' is
      // the burst-envelope pop; 'glow' is the persistent held-note halo.
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={flashGlowMaterial ?? coreSurfaceMaterial} scale={surface.scale}>
          <planeGeometry args={[1.9, 1.9]} />
        </mesh>
      )
    }
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={coreSurfaceMaterial} scale={surface.scale}>
        <sphereGeometry args={[0.58, Math.max(16, segmentCount), Math.max(10, Math.floor(segmentCount * 0.66))]} />
      </mesh>
    )
  }

  if (surface.kind === 'projectile-comet') {
    if (feelVersion >= 2 && hotCoreMaterial) {
      // v2: one coherent volume — a ROUND head with a rear taper aimed
      // exactly down the trail axis (-x) — instead of the legacy lobe chain
      // (read as a string of bokeh balls). No group yaw: any off-axis tilt
      // points the taper away from the wake and breaks the projectile read.
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          {/* Normal-blend shell: additive orange stacked over the glow
              saturates to yellow-white — solid orange keeps the fireball HUE
              while the small additive core inside carries the hot point. */}
          <mesh material={solidSurfaceMaterial} scale={[1.02, 0.96, 0.96]}>
            <sphereGeometry args={[0.5, Math.max(20, segmentCount), Math.max(14, Math.floor(segmentCount * 0.66))]} />
          </mesh>
          {/* Volumetric rear taper: shrinking sphere lobes survive every
              camera angle — an open cone reads as a flat paper wedge
              (round-20 verdict, re-confirmed in the projectile review). */}
          <mesh material={solidSurfaceMaterial} position={[-0.34, 0, 0]} scale={0.7}>
            <sphereGeometry args={[0.5, Math.max(16, segmentCount), Math.max(10, Math.floor(segmentCount * 0.66))]} />
          </mesh>
          <mesh material={solidSurfaceMaterial} position={[-0.6, 0, 0]} scale={0.44}>
            <sphereGeometry args={[0.5, Math.max(16, segmentCount), Math.max(10, Math.floor(segmentCount * 0.66))]} />
          </mesh>
          <mesh material={hotCoreMaterial} position={[0.12, 0, 0]} scale={[0.5, 0.46, 0.46]}>
            <sphereGeometry args={[0.5, Math.max(16, segmentCount), Math.max(10, Math.floor(segmentCount * 0.66))]} />
          </mesh>
        </group>
      )
    }
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale} rotation={[0, 0.42, 0.08]}>
        <mesh material={solidSurfaceMaterial} position={[0.2, 0, 0]} scale={[0.58, 0.46, 0.46]}>
          <icosahedronGeometry args={[0.58, 2]} />
        </mesh>
        {PFX_PROJECTILE_COMET_TAIL_LOBES.map(({ offset, size }, index) => (
          <mesh
            key={index}
            material={accentSurfaceMaterial}
            position={[offset[0], offset[1], offset[2]]}
            scale={[size * 1.25, size, size]}
          >
            <icosahedronGeometry args={[0.5, 2]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'projectile-head') {
    if (feelVersion >= 2) {
      // Round head + shrinking sphere lobes down the trail axis — the
      // fireball-proven volume. The legacy octahedron+open-cone dart read
      // as "a weird mesh" (trail review).
      return (
        <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
          <mesh material={solidSurfaceMaterial} scale={[1.04, 0.94, 0.94]}>
            <sphereGeometry args={[0.42, Math.max(20, segmentCount), 14]} />
          </mesh>
          <mesh material={solidSurfaceMaterial} position={[-0.3, 0, 0]} scale={0.68}>
            <sphereGeometry args={[0.42, Math.max(16, segmentCount), 10]} />
          </mesh>
          <mesh material={solidSurfaceMaterial} position={[-0.52, 0, 0]} scale={0.4}>
            <sphereGeometry args={[0.42, 12, 8]} />
          </mesh>
        </group>
      )
    }
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale} rotation={[0, 0, -Math.PI / 2]}>
        <mesh material={solidSurfaceMaterial} scale={[0.36, 0.72, 0.36]}><octahedronGeometry args={[0.58, 0]} /></mesh>
        <mesh material={accentSurfaceMaterial} position={[0, -0.38, 0]} scale={[0.5, 0.8, 0.5]}><coneGeometry args={[0.42, 0.8, 12, 1, true]} /></mesh>
      </group>
    )
  }

  if (surface.kind === 'smoke-billows') {
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {PFX_SMOKE_BILLOW_LOBES.map(({ offset, size }, index) => (
          <mesh
            key={index}
            material={coreSurfaceMaterial}
            position={[offset[0], offset[1], offset[2]]}
            rotation={[index * 0.37, index * 0.23, index * 0.19]}
            scale={size}
          >
            <dodecahedronGeometry args={[0.68, 1]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'mesh-fragments') {
    const fragments: Array<[number, number, number, number]> = [
      [-0.42, 0.08, 0.16, 0.9], [0.38, 0.16, -0.12, 0.72], [0.08, 0.44, 0.2, 0.64],
      [-0.18, -0.34, -0.2, 0.76], [0.3, -0.3, 0.18, 0.58], [-0.46, 0.36, -0.14, 0.52],
    ]
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {fragments.map(([x, y, z, size], index) => (
          <mesh
            key={index}
            material={coreSurfaceMaterial}
            position={[x, y, z]}
            rotation={[index * 0.73, index * 1.13, index * 0.41]}
            scale={size}
          >
            <icosahedronGeometry args={[0.22, 0]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'trail-ribbon') {
    // Crossed planes wearing the trail-fade gradient — the old bare
    // boxGeometry read as an untextured slab from every angle (user round:
    // 'they are a box shape and it is not working'). Legacy baselines
    // still route here, so the fallback must read as a ribbon.
    return (
      <group ref={object as RefObject<THREE.Group>} rotation={[0, 0, -0.18]} scale={[surface.scale, spatialPolicy.minimumDepth * controls.scale, spatialPolicy.minimumDepth * controls.scale]}>
        <mesh material={accentSurfaceMaterial}>
          <planeGeometry args={[1.25, 1]} />
        </mesh>
        <mesh material={accentSurfaceMaterial} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.25, 1]} />
        </mesh>
      </group>
    )
  }

  if (surface.kind === 'tapered-trail') {
    const trails: Array<[number, number, number, number]> = [
      [-0.48, 0, 0, 1], [-0.62, 0.13, 0.12, 0.7], [-0.68, -0.12, -0.14, 0.58],
    ]
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale} rotation={[0, 0.28, 0]}>
        {trails.map(([x, y, z, size], index) => (
          <mesh key={index} material={accentSurfaceMaterial} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} scale={[size * 0.25, size * 1.1, size * 0.25]}>
            <coneGeometry args={[0.34, 1.2, 16, 1, true]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'magic-circle') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={magicCircleGeometry ?? undefined}
        material={magicCircleMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.tuning?.meshGeometry === 'target-break-ground-reticle') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={targetBreakReticleGeometry ?? undefined}
        material={targetBreakReticleMaterial ?? accentSurfaceMaterial}
        rotation={getPfxRingPlaneRotation(surface)}
        scale={surface.scale}
      />
    )
  }

  if (surface.tuning?.meshGeometry === 'meteor-ring-heat-front') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={meteorHeatFrontGeometry ?? undefined}
        material={accentSurfaceMaterial}
        rotation={getPfxRingPlaneRotation(surface)}
        scale={surface.scale}
      />
    )
  }

  if (surface.tuning?.meshGeometry === 'shockwave-spawn-pressure-front') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={shockwaveSpawnPressureFrontGeometry ?? undefined}
        material={shockwaveSpawnPressureFrontMaterial ?? accentSurfaceMaterial}
        rotation={getPfxRingPlaneRotation(surface)}
        scale={surface.scale}
      />
    )
  }

  if (
    (surface.kind === 'shockwave-ring' || (surface.kind === 'ring-field' && surface.tuning?.meshMotion === 'shockwave')) &&
    feelVersion >= 2
  ) {
    // v2: a shockwave is a pressure wave, not a hoop — a flat disc carrying
    // the soft radial ring-glow gradient reads like a sound wave (bright
    // soft band, feathered edges) from every angle.
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} rotation={getPfxRingPlaneRotation(surface)} scale={surface.scale}>
        <circleGeometry args={[0.78, Math.max(32, segmentCount)]} />
      </mesh>
    )
  }

  if (surface.kind === 'ring-field' && surface.tuning?.meshGeometry === 'plasma-ambient-broken-orbits') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={plasmaAmbientOrbitGeometry ?? undefined}
        material={plasmaAmbientOrbitMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'ring-field' && surface.tuning?.meshGeometry === 'snow-spawn-frost-cradle') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={snowSpawnCradleGeometry ?? undefined}
        material={snowSpawnCradleMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'ring-field' && surface.tuning?.meshGeometry === 'spawn-screen-reticle') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={spawnScreenReticleGeometry ?? undefined}
        material={spawnScreenReticleMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'ring-field' && surface.tuning?.meshGeometry === 'jump-pickup-launch-cradle') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={jumpPickupCradleGeometry ?? undefined}
        material={jumpPickupCradleMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'ring-field' && surface.tuning?.meshGeometry === 'jump-pickup-reward-gem') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={jumpPickupRewardGemGeometry ?? undefined}
        material={jumpPickupRewardGemMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'ring-field' || surface.kind === 'shockwave-ring') {
    if (feelVersion >= 2 && surface.tuning?.ringPurpose === 'glyph' && surface.kind === 'ring-field') {
      // Rune/glyph circle: FLAT drawn glyphs lying on the anchor plane,
      // arranged in a circle; the group's z-rotation (driven by useFrame)
      // spins the inscription around the vertical axis.
      const runeSlice = PFX_SPRITE_SLICES['rune']
      return (
        <group ref={object as RefObject<THREE.Group>} rotation={[-Math.PI / 2, 0, 0]} scale={surface.scale}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} material={glyphCircleMaterial ?? accentSurfaceMaterial} geometry={glyphQuadGeometry ?? undefined} position={[Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0]} rotation={[0, 0, a - Math.PI / 2]} />
            )
          })}
        </group>
      )
    }
    if (feelVersion >= 2 && (surface.tuning?.ringPurpose === 'reticle' || surface.tuning?.ringPurpose === 'boundary')) {
      // Marker reticles AND boundary rings are DRAWN rings: the ring-glow
      // texture on a flat ground quad, not a torus tube (telegraph review:
      // "an actual ring texture not a mesh"; ring-field review: every
      // ring-field wears a ring texture). Charge/pulse motion animates the
      // group, so boundary shrink-in reads survive.
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} rotation={getPfxRingPlaneRotation(surface)} scale={surface.scale * 1.5}>
          <planeGeometry args={[1.6, 1.6]} />
        </mesh>
      )
    }
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} rotation={[Math.PI / 2, 0, 0]} scale={surface.scale}>
        <torusGeometry args={[0.62, 0.05, 10, Math.max(24, segmentCount)]} />
      </mesh>
    )
  }

  if (surface.kind === 'telegraph-disc') {
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} rotation={[-Math.PI / 2, 0, 0]} scale={surface.scale}>
        <circleGeometry args={[0.62, Math.max(32, segmentCount)]} />
      </mesh>
    )
  }

  if (surface.kind === 'scuff-wedge') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        material={accentSurfaceMaterial}
        rotation={[-Math.PI / 2, 0, Math.PI * 0.5]}
        scale={[surface.scale * 1.7, surface.scale * 0.62, 1]}
      >
        <circleGeometry args={[0.62, 36, -Math.PI / 2, Math.PI]} />
      </mesh>
    )
  }

  if (surface.kind === 'footprint-decal') {
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {[
          [-0.26, -0.08, -0.16], [0.24, 0.08, 0.16],
        ].map(([x, z, rotation], index) => (
          <mesh
            key={index}
            material={accentSurfaceMaterial}
            position={[x, 0, z]}
            rotation={[-Math.PI / 2, 0, rotation]}
            scale={[0.23, 0.5, 1]}
          >
            <circleGeometry args={[0.45, 28]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'healing-glyphs') {
    const hero = createPfxHealingGlyphLayout(previewTimeSeconds ?? 0.2)[0]!
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        <group name="pfx-healing-hero" position={hero.position} rotation={[0, hero.rotationY, 0]} scale={hero.scale}>
          <group name="pfx-healing-vines">
            <mesh material={healingVineMaterial ?? coreSurfaceMaterial} geometry={healingVineGeometry ?? undefined} />
          </group>
          <group name="pfx-healing-restorative-star" position={[0, 1.14, 0]}>
            <mesh material={healingFocalMaterial ?? coreSurfaceMaterial} geometry={healingFocalGeometry ?? undefined} />
            <mesh material={healingFocalMaterial ?? coreSurfaceMaterial} geometry={healingFocalGeometry ?? undefined} rotation={[0, Math.PI / 2, 0]} />
          </group>
          <instancedMesh
            name="pfx-healing-leaf-helix"
            args={[healingGlyphGeometry!, [healingGlyphMaterial!, healingLeafEdgeMaterial!], 22]}
            frustumCulled={false}
          />
          <instancedMesh
            name="pfx-healing-vine-sparkles"
            args={[healingSparkleGeometry!, healingFocalMaterial!, 12]}
            frustumCulled={false}
          />
        </group>
      </group>
    )
  }

  if (surface.kind === 'spawn-voxels') {
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {PFX_SPAWN_VOXEL_LAYOUT.map(([x, y, z, size], index) => (
          <mesh
            key={index}
            material={coreSurfaceMaterial}
            position={[x, y, z]}
            rotation={[index * 0.37, index * 0.61, index * 0.23]}
            scale={size * 0.12}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'muzzle-cone') {
    if (surface.phase?.includes('crown')) {
      // Geyser/beam crown: vertical funnel flaring OPEN at the top — wears
      // the layer's mesh shader (eroded flowing water), never a flat cone.
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={meshShaderMaterial ?? accentSurfaceMaterial} rotation={[Math.PI, 0, 0]} scale={surface.scale}>
          <coneGeometry args={[0.72, 0.45, Math.max(20, segmentCount), 1, true]} />
        </mesh>
      )
    }
    return (
      <group
        ref={object as RefObject<THREE.Group>}
        position={[0.02 * surface.scale, 0, 0]}
        scale={surface.scale}
      >
        <mesh
          material={muzzleFlameMaterial ?? accentSurfaceMaterial}
        >
          <primitive attach="geometry" object={muzzleFlameGeometry!} />
        </mesh>
      </group>
    )
  }

  if (surface.kind === 'toxic-pool') {
    const bubbles: Array<[number, number, number, number]> = [
      [-0.46, 0.08, 0.18, 0.2], [0.34, 0.1, -0.28, 0.16], [0.08, 0.06, 0.4, 0.13],
      [0.5, 0.05, 0.22, 0.1], [-0.16, 0.05, -0.4, 0.12],
    ]
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {[
          [0, 0, 0, 1.15, 0.82], [-0.46, 0.01, 0.1, 0.62, 0.48], [0.42, 0.015, -0.18, 0.7, 0.42],
          [0.08, 0.02, 0.42, 0.54, 0.38],
        ].map(([x, y, z, width, depth], index) => (
          <mesh key={index} material={accentSurfaceMaterial} position={[x, y, z]} rotation={[0, index * 0.7, 0]} scale={[width, 0.1, depth]}>
            <sphereGeometry args={[0.72, Math.max(18, segmentCount), 10]} />
          </mesh>
        ))}
        {bubbles.map(([x, y, z, size], index) => (
          <mesh key={index} material={coreSurfaceMaterial} position={[x, y, z]} scale={size}>
            <sphereGeometry args={[1, 16, 10]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'bubble-shells') {
    const bubbles: Array<[number, number, number, number]> = [
      [-0.34, -0.42, 0.18, 0.18], [0.28, -0.12, -0.24, 0.12], [-0.16, 0.16, 0.28, 0.22],
      [0.34, 0.46, 0.12, 0.15], [-0.26, 0.72, -0.16, 0.11], [0.08, 1.02, 0.2, 0.19],
    ]
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {bubbles.map(([x, y, z, size], index) => (
          <group key={index} position={[x, y, z]} scale={size} rotation={[index * 0.31, index * 0.47, 0]}>
            <mesh material={accentSurfaceMaterial}><sphereGeometry args={[1, 20, 14]} /></mesh>
            <mesh material={coreSurfaceMaterial} position={[-0.32, 0.34, 0.48]} scale={0.13}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          </group>
        ))}
      </group>
    )
  }

  if (surface.kind === 'dissolve-voxels') {
    const voxels: Array<[number, number, number, number]> = [
      [-0.08, 0.82, 0, 0.16], [0.1, 0.8, 0.02, 0.15], [-0.12, 0.62, -0.02, 0.14], [0.1, 0.6, 0.04, 0.14],
      [-0.18, 0.38, 0.02, 0.15], [0.02, 0.4, -0.04, 0.16], [0.2, 0.36, 0.04, 0.14],
      [-0.2, 0.14, -0.02, 0.14], [0, 0.16, 0.04, 0.15], [0.18, 0.12, -0.04, 0.13],
      [-0.42, 0.34, 0.06, 0.11], [-0.58, 0.18, -0.02, 0.1], [0.4, 0.3, -0.05, 0.11], [0.56, 0.14, 0.04, 0.09],
      [-0.14, -0.12, 0.02, 0.14], [0.12, -0.14, -0.02, 0.13], [-0.18, -0.4, -0.02, 0.12], [0.16, -0.42, 0.02, 0.11],
      [-0.2, -0.66, 0.03, 0.1], [0.18, -0.68, -0.03, 0.1],
    ]
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {voxels.map(([x, y, z, size], index) => (
          <mesh key={index} material={coreSurfaceMaterial} position={[x, y, z]} rotation={[index * 0.21, index * 0.37, index * 0.18]} scale={size}>
            <boxGeometry args={[1, 1.2, 0.72]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (surface.kind === 'wind-streaks') {
    return (
      <mesh
        ref={object as RefObject<THREE.Mesh>}
        geometry={windPressureGeometry ?? undefined}
        material={windPressureMaterial ?? accentSurfaceMaterial}
        scale={surface.scale}
      />
    )
  }

  if (surface.kind === 'reward-gem') {
    // An unlit single octahedron reads as a flat SQUARE plate from level
    // angles (silhouette-only, no facet shading). Two yaw-crossed tall
    // octahedra give an 8-pointed compound silhouette from every angle,
    // and a brighter inner core fakes the facet depth.
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        <mesh material={rewardGemShadowMaterial ?? coreSurfaceMaterial} scale={[0.4, 0.92, 0.4]}>
          <octahedronGeometry args={[0.65, 0]} />
        </mesh>
        <mesh material={rewardGemBodyMaterial ?? coreSurfaceMaterial} rotation={[0, Math.PI / 4, 0]} scale={[0.4, 0.92, 0.4]}>
          <octahedronGeometry args={[0.65, 0]} />
        </mesh>
        <mesh material={rewardGemHighlightMaterial ?? accentSurfaceMaterial} scale={[0.2, 0.52, 0.2]}>
          <octahedronGeometry args={[0.65, 0]} />
        </mesh>
      </group>
    )
  }

  if (surface.kind === 'coin-medallion') {
    // Compact three-value metallic hierarchy: dark milled edge, warm face,
    // and a pale raised crest/highlight. All details share the disc's actual
    // front plane, so the coin keeps coherent thickness and occlusion at side
    // angles instead of becoming a floating white UI ring.
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale} rotation={[0, 0.24, 0]}>
        <mesh material={coinGoldMaterial ?? solidSurfaceMaterial} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.16, Math.max(28, segmentCount)]} />
        </mesh>
        <mesh material={coinFaceMaterial ?? solidSurfaceMaterial} position={[0, 0, 0.086]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.43, 0.43, 0.025, Math.max(28, segmentCount)]} />
        </mesh>
        <mesh material={coinCrestMaterial ?? accentSurfaceMaterial} position={[0, 0, 0.105]}>
          <torusGeometry args={[0.33, 0.024, 8, Math.max(28, segmentCount)]} />
        </mesh>
        <mesh name="pfx-coin-crest" material={coinCrestMaterial ?? accentSurfaceMaterial} position={[0, 0, 0.125]} scale={[0.23, 0.3, 0.045]}>
          <octahedronGeometry args={[0.62, 0]} />
        </mesh>
      </group>
    )
  }

  if (surface.kind === 'celebration-chevrons') {
    const heights = [-0.48, 0.02, 0.52]
    return (
      <group ref={object as RefObject<THREE.Group>} scale={surface.scale}>
        {heights.flatMap((y, level) => [-1, 1].map((side) => (
          <mesh key={`${level}-${side}`} material={accentSurfaceMaterial} position={[side * 0.24, y, level * -0.12]} rotation={[0, level * 0.18, side * -0.72]} scale={[0.08, 0.54, 0.08]}>
            <coneGeometry args={[0.5, 1, 10, 1, true]} />
          </mesh>
        )))}
      </group>
    )
  }

  if (surface.kind === 'shield-shell') {
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} scale={surface.scale * 1.24}>
        <sphereGeometry args={[0.62, Math.max(16, segmentCount), Math.max(10, Math.floor(segmentCount * 0.66))]} />
      </mesh>
    )
  }

  if (surface.kind === 'beam-column') {
    const widthScale = surface.tuning?.widthScale ?? 1
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} scale={[0.22 * controls.scale * widthScale, surface.scale * 1.5, 0.22 * controls.scale * widthScale]}>
        <cylinderGeometry args={[0.08, 0.16, 1.6, Math.max(8, segmentCount), 1, true]} />
      </mesh>
    )
  }

  if (surface.kind === 'cloud-volume') {
    if (feelVersion >= 2) {
      // v2: camera-facing soft-smoke card — the UV-mapped dodecahedron's
      // gradient only reads from the texture-center side (angle-dependent,
      // same class as the core-sphere light reads; user-caught 3x).
      return (
        <mesh ref={object as RefObject<THREE.Mesh>} material={coreSurfaceMaterial} scale={surface.scale}>
          <planeGeometry args={[1.9, 1.55]} />
        </mesh>
      )
    }
    return (
      <mesh ref={object as RefObject<THREE.Mesh>} material={coreSurfaceMaterial} scale={[surface.scale * 1.15, surface.scale * 0.78, surface.scale * 0.82]}>
        <dodecahedronGeometry args={[0.72, 1]} />
      </mesh>
    )
  }

  return (
    <mesh ref={object as RefObject<THREE.Mesh>} material={accentSurfaceMaterial} scale={[surface.scale * 0.9, surface.scale * 0.72, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
