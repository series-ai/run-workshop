/**
 * audio-trace — lightweight in-memory ring buffer for audio-chain diagnostics.
 *
 * The structural-lint hook bans `console.*` in product code, but the audio
 * chain (audio-master + pad-audio-graph + pad-grid-engine) is exactly the kind
 * of system that benefits from a step-by-step trace when "I tap a pad and
 * hear nothing" returns. Push trace lines here from any production code path;
 * read them via `__GAME_DEBUG__.beatboard.audio.traceTail()` in the browser
 * console, the debug API, or a Playwright test.
 *
 * Trace events are tagged with a millisecond timestamp (relative to
 * `performance.now()` so the deltas are useful) and a short tag.
 */

interface TraceEvent {
  ts: number
  tag: string
  detail?: unknown
}

const RING_SIZE = 256
const ring: TraceEvent[] = []

export function audioTrace(tag: string, detail?: unknown): void {
  ring.push({
    ts: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    tag,
    detail,
  })
  if (ring.length > RING_SIZE) {
    ring.shift()
  }
}

export function getAudioTrace(): TraceEvent[] {
  return ring.slice()
}

export function resetAudioTrace(): void {
  ring.length = 0
}
