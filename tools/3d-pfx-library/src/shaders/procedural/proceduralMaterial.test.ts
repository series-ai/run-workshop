// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createPfxPreset, createPfxParticleEmission, getPfxRenderPlan, getPfxSurfaceMaterialProps } from '../../index'
import { createPfxSpriteEmissionMaterial } from '../../effects/spriteEmission'
import { PFX_SDF_SHAPE_CHIP, PFX_SDF_SHAPE_GLINT, PFX_SDF_SHAPE_SMOKE } from './sdfShapes.glsl'

describe('procedural particle material compilation', () => {
  it('correctly configures GLSL defines for procedural SDF shapes', () => {
    const preset = createPfxPreset('ice-burst')
    const plan = getPfxRenderPlan(preset)
    const surface = plan.surfaces[0]!
    const controls = preset.controls
    const emission = createPfxParticleEmission(preset, surface)
    const materialProps = getPfxSurfaceMaterialProps(surface, controls)

    // Material with procedural chip shape
    const procMat = createPfxSpriteEmissionMaterial(
      emission,
      controls,
      surface,
      materialProps,
      2,
      1,
      1,
    )
    expect(procMat.defines?.PFX_PROCEDURAL_SDF).toBe(true)
    expect(procMat.defines?.PFX_PROCEDURAL_SDF_SHAPE).toBe(PFX_SDF_SHAPE_CHIP)
    expect(procMat.uniforms.uTime).toBeDefined()

    // Non-procedural surface
    const legacySurface = {
      ...surface,
      tuning: {
        ...surface.tuning,
        proceduralShape: undefined,
      },
    }
    const legacyMat = createPfxSpriteEmissionMaterial(
      emission,
      controls,
      legacySurface,
      materialProps,
      2,
      1,
      1,
    )
    expect(legacyMat.defines?.PFX_PROCEDURAL_SDF).toBeUndefined()
  })

  it('verifies ice-burst preset has procedural shapes configured across its phases', () => {
    const preset = createPfxPreset('ice-burst')
    const plan = getPfxRenderPlan(preset)
    expect(plan.surfaces).toHaveLength(3)

    expect(plan.surfaces[0]!.tuning?.proceduralShape).toBe('chip')
    expect(plan.surfaces[1]!.tuning?.proceduralShape).toBe('glint')
    expect(plan.surfaces[2]!.tuning?.proceduralShape).toBe('smoke')
  })
})
