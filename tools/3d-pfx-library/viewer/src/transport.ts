// Deterministic preview transport for the PFX visualizer.
//
// 'live' is the pre-transport default: effects animate off the shared R3F
// clock exactly as before, so capture/profiling automation sees no behavior
// change until a human touches the transport. Once the user plays, pauses,
// stops, or scrubs, preview time becomes an explicit value fed into
// GamePfx's previewTimeSeconds — the same deterministic simulate(t) path the
// review pipeline's reviewTimeMs freeze-frame uses.

export const PFX_TRANSPORT_SPEEDS = [0.25, 0.5, 1, 2] as const

/** Fixed timestep so scrub positions are reproducible and frame-steppable. */
export const PFX_TRANSPORT_STEP_SECONDS = 1 / 60

/** Covers every lifecycle capture candidate (0-920ms) plus decay tails. */
const PFX_TRANSPORT_WINDOW_SECONDS = 2

export type PfxTransportStatus = 'live' | 'playing' | 'paused'

export interface PfxTransportState {
  status: PfxTransportStatus
  timeSeconds: number
  speed: number
  loop: boolean
  windowSeconds: number
}

export function createPfxTransportState(): PfxTransportState {
  return { status: 'live', timeSeconds: 0, speed: 1, loop: true, windowSeconds: PFX_TRANSPORT_WINDOW_SECONDS }
}

/** undefined = live clock drives the preview (legacy/default behavior). */
export function pfxTransportPreviewSeconds(state: PfxTransportState): number | undefined {
  return state.status === 'live' ? undefined : state.timeSeconds
}

export function advancePfxTransport(state: PfxTransportState, deltaSeconds: number): PfxTransportState {
  if (state.status !== 'playing' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state
  const advanced = state.timeSeconds + deltaSeconds * state.speed
  if (advanced < state.windowSeconds) return { ...state, timeSeconds: advanced }
  if (state.loop) return { ...state, timeSeconds: advanced % state.windowSeconds }
  return { ...state, status: 'paused', timeSeconds: state.windowSeconds }
}

export function scrubPfxTransport(state: PfxTransportState, timeSeconds: number): PfxTransportState {
  const clamped = Math.min(Math.max(Number.isFinite(timeSeconds) ? timeSeconds : 0, 0), state.windowSeconds)
  const quantized = Math.round(clamped / PFX_TRANSPORT_STEP_SECONDS) * PFX_TRANSPORT_STEP_SECONDS
  return { ...state, status: 'paused', timeSeconds: Math.min(quantized, state.windowSeconds) }
}

export function togglePfxTransport(state: PfxTransportState): PfxTransportState {
  if (state.status === 'playing') return { ...state, status: 'paused' }
  if (state.status === 'paused') return { ...state, status: 'playing' }
  return { ...state, status: 'playing', timeSeconds: 0 }
}

export function stopPfxTransport(state: PfxTransportState): PfxTransportState {
  return { ...state, status: 'paused', timeSeconds: 0 }
}

export function restartPfxTransport(state: PfxTransportState): PfxTransportState {
  return { ...state, status: 'playing', timeSeconds: 0 }
}
