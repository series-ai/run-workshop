/**
 * PlayheadBar — thin horizontal progress bar at the bottom of an active
 * pad cell.
 *
 * Two modes share the same affordance:
 *
 *   • Loop mode (`isLoop=true`): the bar sweeps 0 → 1 over the current
 *     iteration of the pad's buffer, then wraps and starts over. Tick
 *     marks divide the bar into N equal segments where N = bar count
 *     (1× / 2× / 4× / 8× / 16×). A 4-bar vocal shows 4 segments — the
 *     count is read at-a-glance from the number of ticks. Implicitly
 *     elegant: the visual telegraphs both "where am I now" AND "how
 *     long is this loop" without an extra label.
 *
 *   • One-shot mode (`isLoop=false`): the bar fills 0 → 1 once over the
 *     firing window, then the parent unmounts the cell's "firing" state.
 *     No ticks — one-shots have no bar structure.
 *
 * Reads the AudioContext clock via rAF, throttled to ~24 fps. Purely
 * visual; the audio engine doesn't depend on it.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getAudioContextNow } from '../../audio/pad-audio-graph'

export interface PlayheadBarProps {
  /** AudioContext time the active source started (or, for one-shots, the firing began). */
  startsAt: number
  /** Loop iteration length in seconds (the buffer duration). */
  duration: number
  /** When `true`, wrap progress modulo duration; when `false`, clamp at 1. */
  isLoop: boolean
  /** Bar count per iteration (1, 2, 4, 8, 16). Only used in loop mode for tick marks. */
  bars?: number
  /** Accent color. Defaults to the warm amber accent. */
  color?: string
}

const TARGET_FPS = 24
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS

export function PlayheadBar({
  startsAt,
  duration,
  isLoop,
  bars,
  color = 'var(--ls-accent)',
}: PlayheadBarProps) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)

  useEffect(() => {
    function tick(t: number) {
      if (t - lastFrameRef.current >= FRAME_INTERVAL_MS) {
        lastFrameRef.current = t
        const ctxNow = getAudioContextNow()
        if (ctxNow !== null && duration > 0) {
          const elapsed = ctxNow - startsAt
          if (elapsed < 0) {
            setProgress(0)
          } else if (isLoop) {
            setProgress((elapsed % duration) / duration)
          } else {
            setProgress(Math.min(1, elapsed / duration))
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [startsAt, duration, isLoop])

  const trackStyle: CSSProperties = {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 4,
    height: 2,
    pointerEvents: 'none',
    background: 'var(--ls-playhead-track)',
    borderRadius: 1,
    overflow: 'visible',
  }

  const fillStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: `${progress * 100}%`,
    background: color,
    borderRadius: 1,
    // No CSS transition — we drive position imperatively via rAF for
    // smooth playhead motion. CSS easing would lag behind the audio.
  }

  // Tick marks at bar boundaries (loop mode only). Bars=4 → ticks at
  // 25%, 50%, 75% (3 ticks; the start and end are the cell edges).
  const ticks: CSSProperties[] = []
  if (isLoop && bars && bars > 1) {
    for (let i = 1; i < bars; i++) {
      ticks.push({
        position: 'absolute',
        left: `${(i / bars) * 100}%`,
        top: -1,
        bottom: -1,
        width: 1,
        background: 'var(--ls-playhead-tick)',
        pointerEvents: 'none',
      })
    }
  }

  return (
    <div aria-hidden data-testid="pad-playhead-bar" style={trackStyle}>
      <div style={fillStyle} />
      {ticks.map((tickStyle, idx) => (
        <div key={idx} style={tickStyle} />
      ))}
    </div>
  )
}
