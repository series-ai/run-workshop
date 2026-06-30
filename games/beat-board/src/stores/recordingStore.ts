/**
 * Recording store — drives BeatBoard's session-based recording state.
 *
 * No MediaRecorder, no blob, no mp4. Recording captures a `MixSession`
 * (timeline of pad events) via `record-session.ts`. Replay drives the
 * live audio engine — the player hears the take through their own
 * audio graph.
 *
 *   {
 *     status: 'idle' | 'capturing' | 'completing' | 'error'
 *     elapsedSeconds: number   // 0 when idle, ticks while capturing
 *     pendingSession?: MixSession metadata when finalised, null otherwise
 *     error?: string
 *     start(): Promise<void>
 *     stop(): void
 *     cancel(): void
 *   }
 */
import { create } from 'zustand'
import type { MixSession } from '../systems/mixes'
import { getRecordingCapture } from '../systems/recording-capture'

export type RecordingStatus = 'idle' | 'capturing' | 'completing' | 'error'

export interface RecordingState {
  status: RecordingStatus
  /** Seconds since the recorder started. 0 when idle. */
  elapsedSeconds: number
  /** Human-readable error string (set when status === 'error'). */
  error?: string
  /**
   * Finalised session metadata (everything except `id` + `title`) set when
   * status transitions to 'idle' on success. The RecordingReview modal
   * picks this up to drive Save.
   */
  pendingSession?: Omit<MixSession, 'id' | 'title'>
  /** Begin a new open-ended recording. */
  start: () => Promise<void>
  /** Stop the recording and finalise the session — opens RecordingReview. */
  stop: () => void
  /** Discard the in-flight recording. Drops the buffer; no save. */
  cancel: () => void
}

const INITIAL_STATE: Omit<RecordingState, 'start' | 'stop' | 'cancel'> = {
  status: 'idle',
  elapsedSeconds: 0,
}

export const useRecordingStore = create<RecordingState>((_set, _get) => ({
  ...INITIAL_STATE,
  start: async () => {
    await getRecordingCapture().start()
  },
  stop: () => {
    getRecordingCapture().stop()
  },
  cancel: () => {
    getRecordingCapture().cancel()
  },
}))

export function resetRecordingStore(): void {
  useRecordingStore.setState({
    status: 'idle',
    elapsedSeconds: 0,
    error: undefined,
    pendingSession: undefined,
  })
}
