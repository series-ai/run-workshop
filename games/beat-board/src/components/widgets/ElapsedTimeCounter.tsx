/**
 * ElapsedTimeCounter — `MM:SS` readout that ticks while a recording is in
 * flight.
 *
 * Subscribes to `recordingStore.elapsedSeconds` (written by recording-
 * capture's interval clock). Hidden when status !== 'capturing'. Visual
 * intent matches Groovepad's small unobtrusive counter
 * (research/groovepad/screens.md:255).
 */

import { useRecordingStore } from '../../stores/recordingStore'

/** Pure formatter — exported for unit tests. */
export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ElapsedTimeCounter() {
  const status = useRecordingStore((s) => s.status)
  const elapsed = useRecordingStore((s) => s.elapsedSeconds)
  if (status !== 'capturing') return null
  return (
    <span
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      data-testid="recording-elapsed"
      style={{
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--ui-color-danger)',
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
    >
      {formatElapsed(elapsed)}
    </span>
  )
}
