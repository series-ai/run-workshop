import { describe, expect, it } from 'vitest'
import {
  PFX_SDF_SHAPE_INDEX_MAP,
  PFX_SDF_SHAPE_SOFT,
  PFX_SDF_SHAPE_SMOKE,
  PFX_SDF_SHAPE_STREAK,
  PFX_SDF_SHAPE_LEAF,
  PFX_SDF_SHAPE_CHIP,
  PFX_SDF_SHAPE_RING,
  PFX_SDF_SHAPE_BUBBLE,
  PFX_SDF_SHAPE_DROPLET,
  PFX_SDF_SHAPE_GLINT,
  pfxSdfShapesGLSL,
  type PfxSdfShapeKind,
} from './sdfShapes.glsl'

describe('pfxSdfShapesGLSL', () => {
  it('defines 9 distinct procedural particle shape indices', () => {
    expect(PFX_SDF_SHAPE_SOFT).toBe(0)
    expect(PFX_SDF_SHAPE_SMOKE).toBe(1)
    expect(PFX_SDF_SHAPE_STREAK).toBe(2)
    expect(PFX_SDF_SHAPE_LEAF).toBe(3)
    expect(PFX_SDF_SHAPE_CHIP).toBe(4)
    expect(PFX_SDF_SHAPE_RING).toBe(5)
    expect(PFX_SDF_SHAPE_BUBBLE).toBe(6)
    expect(PFX_SDF_SHAPE_DROPLET).toBe(7)
    expect(PFX_SDF_SHAPE_GLINT).toBe(8)
  })

  it('maps all 9 semantic shape kinds to their respective indices', () => {
    const kinds: PfxSdfShapeKind[] = [
      'soft', 'smoke', 'streak', 'leaf', 'chip', 'ring', 'bubble', 'droplet', 'glint'
    ]
    for (let i = 0; i < kinds.length; i++) {
      expect(PFX_SDF_SHAPE_INDEX_MAP[kinds[i]]).toBe(i)
    }
  })

  it('includes Android WebView mediump precision safety guards', () => {
    expect(pfxSdfShapesGLSL).toContain('precision mediump float;')
    expect(pfxSdfShapesGLSL).toContain('#ifdef GL_FRAGMENT_PRECISION_HIGH')
  })

  it('contains the complete evaluation function for all 9 shapes', () => {
    expect(pfxSdfShapesGLSL).toContain('pfxSampleShapeMask')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 0')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 1')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 2')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 3')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 4')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 5')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 6')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 7')
    expect(pfxSdfShapesGLSL).toContain('shapeIndex == 8')
  })
})
