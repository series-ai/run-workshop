/**
 * pitchStore — global one-shot pitch shift contract.
 *
 * Verifies:
 *   - Default is 0 semitones.
 *   - setOneShotSemitones clamps to ±MAX_PITCH_SEMITONES.
 *   - cents() returns semitones * 100.
 *   - Mutations push through to pad-audio-graph's module-level
 *     `oneShotDetuneCents`, so a one-shot tap fired immediately after
 *     a slider change uses the new value.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  usePitchStore,
  resetPitchStore,
  MAX_PITCH_SEMITONES,
} from '../pitchStore'
import { getOneShotDetuneCents } from '../../audio/pad-audio-graph'

beforeEach(() => {
  resetPitchStore()
})

afterEach(() => {
  resetPitchStore()
})

describe('pitchStore', () => {
  it('starts at 0 semitones', () => {
    expect(usePitchStore.getState().oneShotSemitones).toBe(0)
    expect(usePitchStore.getState().cents()).toBe(0)
  })

  it('cents() = semitones * 100', () => {
    usePitchStore.getState().setOneShotSemitones(3)
    expect(usePitchStore.getState().cents()).toBe(300)
    usePitchStore.getState().setOneShotSemitones(-2)
    expect(usePitchStore.getState().cents()).toBe(-200)
  })

  it('clamps above MAX_PITCH_SEMITONES', () => {
    usePitchStore.getState().setOneShotSemitones(MAX_PITCH_SEMITONES + 5)
    expect(usePitchStore.getState().oneShotSemitones).toBe(MAX_PITCH_SEMITONES)
  })

  it('clamps below -MAX_PITCH_SEMITONES', () => {
    usePitchStore.getState().setOneShotSemitones(-MAX_PITCH_SEMITONES - 5)
    expect(usePitchStore.getState().oneShotSemitones).toBe(-MAX_PITCH_SEMITONES)
  })

  it('rounds non-integer inputs to whole semitones', () => {
    usePitchStore.getState().setOneShotSemitones(2.4)
    expect(usePitchStore.getState().oneShotSemitones).toBe(2)
    usePitchStore.getState().setOneShotSemitones(-1.7)
    expect(usePitchStore.getState().oneShotSemitones).toBe(-2)
  })

  it('pushes the cents value to the audio-graph module', () => {
    usePitchStore.getState().setOneShotSemitones(4)
    expect(getOneShotDetuneCents()).toBe(400)
    usePitchStore.getState().setOneShotSemitones(0)
    expect(getOneShotDetuneCents()).toBe(0)
  })
})
