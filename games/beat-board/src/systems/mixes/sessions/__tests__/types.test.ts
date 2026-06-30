import { describe, expect, it } from 'vitest'
import {
  beatsToSeconds,
  secondsToBeats,
  sessionDurationSeconds,
  MIX_SESSION_VERSION,
  type MixSession,
} from '../types'

describe('beatsToSeconds / secondsToBeats', () => {
  it('round-trips at 84 BPM', () => {
    const seconds = beatsToSeconds(8, 84)
    expect(seconds).toBeCloseTo(5.714, 3)
    expect(secondsToBeats(seconds, 84)).toBeCloseTo(8, 6)
  })
  it('round-trips at 120 BPM', () => {
    expect(beatsToSeconds(4, 120)).toBeCloseTo(2)
    expect(secondsToBeats(2, 120)).toBeCloseTo(4)
  })
  it('clamps non-positive BPM to 0 to avoid divide-by-zero', () => {
    expect(beatsToSeconds(8, 0)).toBe(0)
    expect(secondsToBeats(8, 0)).toBe(0)
    expect(beatsToSeconds(8, -84)).toBe(0)
  })
  it('zero beats / zero seconds is the identity', () => {
    expect(beatsToSeconds(0, 84)).toBe(0)
    expect(secondsToBeats(0, 84)).toBe(0)
  })
})

describe('sessionDurationSeconds', () => {
  function buildSession(overrides: Partial<MixSession> = {}): MixSession {
    return {
      id: 'mix_1',
      title: 't',
      kitId: 'kit_a',
      bpm: 84,
      durationBeats: 0,
      createdAtMs: 0,
      events: [],
      version: MIX_SESSION_VERSION,
      ...overrides,
    }
  }
  it('matches beatsToSeconds for the session bpm', () => {
    expect(sessionDurationSeconds(buildSession({ bpm: 84, durationBeats: 32 }))).toBeCloseTo(
      beatsToSeconds(32, 84),
    )
  })
  it('returns 0 for a zero-length session', () => {
    expect(sessionDurationSeconds(buildSession({ durationBeats: 0 }))).toBe(0)
  })
})
