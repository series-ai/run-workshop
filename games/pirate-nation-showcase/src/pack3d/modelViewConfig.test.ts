import { describe, expect, it } from 'vitest'
import {
  CHARACTER_MODEL_PREVIEW_YAW,
  DEFAULT_MODEL_PREVIEW_YAW,
  getModelPreviewYaw,
  MODEL_PREVIEW_YAW,
} from './modelViewConfig'

describe('modelViewConfig', () => {
  it('exposes standard model preview yaw', () => {
    expect(MODEL_PREVIEW_YAW).toBeCloseTo(Math.PI - Math.PI / 5)
    expect(DEFAULT_MODEL_PREVIEW_YAW).toBeCloseTo(Math.PI - Math.PI / 5)
  })

  it('provides character-specific yaw for characters-skins category', () => {
    expect(getModelPreviewYaw('characters-skins')).toBeCloseTo(CHARACTER_MODEL_PREVIEW_YAW)
    expect(getModelPreviewYaw('characters-skins')).toBeCloseTo(-Math.PI / 2 - Math.PI / 5)
  })

  it('provides default yaw for general categories', () => {
    expect(getModelPreviewYaw('ships')).toBeCloseTo(DEFAULT_MODEL_PREVIEW_YAW)
    expect(getModelPreviewYaw('buildings')).toBeCloseTo(DEFAULT_MODEL_PREVIEW_YAW)
    expect(getModelPreviewYaw('animals')).toBeCloseTo(DEFAULT_MODEL_PREVIEW_YAW)
    expect(getModelPreviewYaw(undefined)).toBeCloseTo(DEFAULT_MODEL_PREVIEW_YAW)
  })
})
