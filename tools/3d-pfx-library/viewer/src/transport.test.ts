import { describe, expect, it } from 'vitest'
import {
  PFX_TRANSPORT_SPEEDS,
  PFX_TRANSPORT_STEP_SECONDS,
  advancePfxTransport,
  createPfxTransportState,
  pfxTransportPreviewSeconds,
  restartPfxTransport,
  scrubPfxTransport,
  stopPfxTransport,
  togglePfxTransport,
} from './transport'

describe('PFX preview transport', () => {
  it('starts in live mode so existing clock-driven preview behavior is unchanged', () => {
    const state = createPfxTransportState()
    expect(state.status).toBe('live')
    expect(state.speed).toBe(1)
    expect(state.loop).toBe(true)
    expect(state.windowSeconds).toBeGreaterThanOrEqual(2)
    expect(pfxTransportPreviewSeconds(state)).toBeUndefined()
  })

  it('exposes discrete speed presets including slow motion', () => {
    expect(PFX_TRANSPORT_SPEEDS).toEqual([0.25, 0.5, 1, 2])
    expect(PFX_TRANSPORT_STEP_SECONDS).toBeCloseTo(1 / 60)
  })

  it('advances deterministically while playing and wraps at the loop window', () => {
    const playing = { ...createPfxTransportState(), status: 'playing' as const, timeSeconds: 0 }
    const advanced = advancePfxTransport(playing, 0.5)
    expect(advanced.timeSeconds).toBeCloseTo(0.5)
    expect(advanced.status).toBe('playing')

    const nearEnd = { ...playing, timeSeconds: playing.windowSeconds - 0.1 }
    const wrapped = advancePfxTransport(nearEnd, 0.3)
    expect(wrapped.timeSeconds).toBeCloseTo(0.2 % playing.windowSeconds, 5)
    expect(wrapped.status).toBe('playing')
  })

  it('honors playback speed when advancing', () => {
    const slow = { ...createPfxTransportState(), status: 'playing' as const, timeSeconds: 0, speed: 0.25 }
    expect(advancePfxTransport(slow, 1).timeSeconds).toBeCloseTo(0.25)
  })

  it('pauses at the window end when looping is off', () => {
    const oneShot = {
      ...createPfxTransportState(),
      status: 'playing' as const,
      loop: false,
      timeSeconds: createPfxTransportState().windowSeconds - 0.05,
    }
    const finished = advancePfxTransport(oneShot, 0.5)
    expect(finished.status).toBe('paused')
    expect(finished.timeSeconds).toBe(oneShot.windowSeconds)
  })

  it('does not advance in live or paused mode', () => {
    const live = createPfxTransportState()
    expect(advancePfxTransport(live, 1)).toEqual(live)
    const paused = { ...live, status: 'paused' as const, timeSeconds: 0.4 }
    expect(advancePfxTransport(paused, 1)).toEqual(paused)
  })

  it('scrubs to a clamped, frame-quantized pause time', () => {
    const state = createPfxTransportState()
    const scrubbed = scrubPfxTransport(state, 0.505)
    expect(scrubbed.status).toBe('paused')
    expect(scrubbed.timeSeconds).toBeCloseTo(Math.round(0.505 * 60) / 60)
    expect(scrubPfxTransport(state, -1).timeSeconds).toBe(0)
    expect(scrubPfxTransport(state, 99).timeSeconds).toBe(state.windowSeconds)
  })

  it('toggle enters play from live at t=0, pauses from playing, and resumes from paused', () => {
    const live = createPfxTransportState()
    const playing = togglePfxTransport(live)
    expect(playing).toMatchObject({ status: 'playing', timeSeconds: 0 })
    const paused = togglePfxTransport({ ...playing, timeSeconds: 0.7 })
    expect(paused).toMatchObject({ status: 'paused', timeSeconds: 0.7 })
    expect(togglePfxTransport(paused)).toMatchObject({ status: 'playing', timeSeconds: 0.7 })
  })

  it('stop parks paused at t=0 and restart replays from t=0', () => {
    const playing = { ...createPfxTransportState(), status: 'playing' as const, timeSeconds: 1.2 }
    expect(stopPfxTransport(playing)).toMatchObject({ status: 'paused', timeSeconds: 0 })
    expect(restartPfxTransport(playing)).toMatchObject({ status: 'playing', timeSeconds: 0 })
  })
})
