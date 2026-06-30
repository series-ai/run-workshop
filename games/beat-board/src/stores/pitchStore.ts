/**
 * pitchStore — global one-shot pitch shift, in semitones.
 *
 * Why one-shots only: detune on a looping source also affects its
 * playback rate, which would change the loop length and break the
 * bar-aligned mix. One-shots play once and stop, so they can be
 * pitched without sync consequences.
 *
 * Mental model: this is a single ±5 semitone slider that affects
 * EVERY one-shot pad (FX hits + drum fills). Not per-pad — Groovepad's
 * per-pad UI doesn't fit the cell density we have. Players who want
 * pitch variety can swap the slider between hits.
 *
 * Range is ±MAX_SEMITONES. The audio graph reads `cents()` (semis ×
 * 100) directly, so the WebAudio `AudioBufferSourceNode.detune` value
 * is correctly scaled.
 */

import { create } from 'zustand'
import { setOneShotDetuneCents } from '../audio/pad-audio-graph'

export const MAX_PITCH_SEMITONES = 12

interface PitchState {
  oneShotSemitones: number
  setOneShotSemitones: (next: number) => void
  cents: () => number
}

export const usePitchStore = create<PitchState>((set, get) => ({
  oneShotSemitones: 0,
  setOneShotSemitones: (next) => {
    const clamped = Math.max(
      -MAX_PITCH_SEMITONES,
      Math.min(MAX_PITCH_SEMITONES, Math.round(next)),
    )
    set({ oneShotSemitones: clamped })
    // Push to the audio graph synchronously so the next one-shot tap
    // picks up the new value — there's no per-tap store read inside the
    // audio module (it stays React-free).
    setOneShotDetuneCents(clamped * 100)
  },
  cents: () => get().oneShotSemitones * 100,
}))

/** Test helper — restore the slider baseline. */
export function resetPitchStore(): void {
  usePitchStore.setState({ oneShotSemitones: 0 })
}
