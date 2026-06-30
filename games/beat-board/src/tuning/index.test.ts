import { describe, expect, it } from 'vitest'
import * as tuning from './index'

describe('tuning public API', () => {
  it('exports registerTunable and TuningOverlay from the stable entry point', () => {
    expect(typeof tuning.registerTunable).toBe('function')
    expect(typeof tuning.TuningOverlay).toBe('function')
    expect(typeof tuning.setTuningOverlayEnabled).toBe('function')
    expect(typeof tuning.loadTuningOverlayPreference).toBe('function')
    expect(tuning.TUNING_OVERLAY_STORAGE_KEY).toBe(
      'series-game-core:tuning-overlay-enabled',
    )
  })
})
