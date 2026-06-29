/**
 * PadWaveform — radial mini-spectrogram of a pad's loop. Variable-
 * length spokes radiate outward from a hollow center; progress sweeps
 * clockwise from 12 o'clock so loops visibly "tick around the clock"
 * once per iteration.
 *
 *               ╲│╱
 *           ─── ⊙ ───
 *               ╱│╲
 *
 * Three modes:
 *
 *   IDLE    — spokes dimmed to ~10% white at 35% amplitude, suggestive
 *             of a static spectrogram dial. Per-pad shape comes from
 *             real peak amplitudes once the buffer has decoded
 *             (name-seeded synthetic shape until then).
 *
 *   ACTIVE  — spokes colored in the per-category neon accent. Spokes
 *             BEFORE the rotating playhead use full alpha; spokes
 *             AFTER use 40% alpha (`hex66`). Spoke lengths are
 *             STATIC — pure peak data, no synthetic modulation. Only
 *             color changes as the playhead sweeps; the dial does not
 *             "spin" or "breathe".
 *
 *   ONE-SHOT FIRING — same active rendering, single playhead sweep
 *             across the firing window.
 *
 * Cycle markers — for multi-bar loops, a thin radial divider sits at
 * each bar boundary (1/N, 2/N, ..., (N-1)/N of a full revolution),
 * spanning slightly past the inner and outer ring radii. A 4-bar loop
 * reads as four equal sectors.
 *
 * The progress source is the AudioContext clock (loops via
 * `getPadPlaybackInfo`, one-shots via the engine-written firing window
 * in padGridStore). rAF-throttled to ~30 fps.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAudioContextNow,
  getPadBufferDuration,
  getPadPeakSamples,
  getPadPlaybackInfo,
} from '../../audio/pad-audio-graph'
import { usePadGridStore } from '../../stores/padGridStore'
import { useKitsStore, getKitById } from '../../stores/kitsStore'
import { secondsPerBar } from '../../audio/beat-clock'
import type { PadMeta } from '../../types/kit'

const COLUMN_COUNT = 44
const TARGET_FPS = 30
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS

// Radial geometry — viewBox is 100×100. Center point 50,50.
// Inner radius leaves a hollow center; outer radius stops short of
// the viewBox edge so cycle-divider ticks (which extend slightly past
// the bar tips) stay inside the box.
const RADIAL_CENTER = 50
const RADIAL_INNER = 22
const RADIAL_BAR_MAX = 24
const RADIAL_OUTER_MAX = RADIAL_INNER + RADIAL_BAR_MAX
const RADIAL_TICK_INNER = RADIAL_INNER - 2
const RADIAL_TICK_OUTER = RADIAL_OUTER_MAX + 2
// Stroke widths for the spokes and tick dividers, tuned to read
// crisply at the typical 50-60 px on-screen size of a pad cell.
const RADIAL_BAR_STROKE = 1.5
const RADIAL_TICK_STROKE = 0.6

function seedOf(s: string): number {
  let total = 0
  for (let i = 0; i < s.length; i++) total += s.charCodeAt(i)
  return total
}

/**
 * Deterministic seeded waveform. Mock-derived: per-column amplitude in
 * [0.3, 1.0] from a triple-sine product. Stable across renders.
 */
function buildWaveData(seed: number, cols: number): number[] {
  const out = new Array<number>(cols)
  for (let i = 0; i < cols; i++) {
    const x = i + seed
    const a = Math.sin(x * 0.7)
    const b = Math.cos(x * 0.31)
    const c = Math.sin(x * 0.13 + 1.2)
    out[i] = 0.3 + 0.7 * Math.abs(a * b * c)
  }
  return out
}

export interface PadWaveformProps {
  pad: PadMeta
  /** True when a loop pad is latched (audibly playing). */
  isLatched: boolean
  /** True when a one-shot pad is in its firing window. */
  isFiring: boolean
  /** Per-category neon accent (#RRGGBB hex; we append `66` for inactive bars). */
  accent: string
}

export function PadWaveform({ pad, isLatched, isFiring, accent }: PadWaveformProps) {
  const oneShotWindow = usePadGridStore((s) =>
    pad.isOneShot ? s.oneShotWindows[pad.padId] : null,
  )
  const isActive = isLatched || (isFiring && pad.isOneShot)

  // Real waveform comes from the decoded buffer (peak-extracted on first
  // read, cached thereafter). Falls back to a name-seeded synthetic
  // shape until the buffer finishes decoding so the cell never renders
  // a flat line.
  const seed = useMemo(() => seedOf(pad.layerName ?? pad.padId), [pad.layerName, pad.padId])
  const seedShape = useMemo(() => buildWaveData(seed, COLUMN_COUNT), [seed])
  const peaks = usePadPeaks(pad.padId, COLUMN_COUNT)
  const data = peaks ?? seedShape

  // Bar-count derived from the decoded buffer length divided by the
  // active kit's seconds-per-bar. Reading the kit's BPM here (instead of
  // a hardcoded lofi default) is what makes a 16-bar phrase show 16
  // ticks at every tempo; without it a 120 BPM kit's 16-bar vocal
  // visibly renders as 11 ticks because we'd be dividing by a 84 BPM
  // bar duration. `peaks` and `kitBpm` are both in the dep list so the
  // bar-count refreshes the moment either the buffer or the active kit
  // changes.
  const kitBpm = useKitsStore((s) => getKitById(s.activeKitId)?.bpm ?? null)
  const bars = useMemo(() => {
    if (pad.isOneShot) return 1
    const dur = getPadBufferDuration(pad.padId)
    if (!dur || dur <= 0) return 1
    const bar = kitBpm && kitBpm > 0 ? secondsPerBar(kitBpm) : (60 / 84) * 4
    return Math.max(1, Math.round(dur / bar))
  }, [pad.isOneShot, pad.padId, peaks, kitBpm])

  const progress = useWaveProgress({ pad, isActive, oneShotWindow })

  // Pre-compute idle stroke once so we don't recompute on each spoke.
  const idleStroke = 'var(--na-wave-idle)'
  const inactiveStroke = `${accent}66`

  return (
    <div
      aria-hidden
      data-testid={`pad-waveform-${pad.padId}`}
      style={{
        position: 'absolute',
        // Centered in the cell, slightly biased upward to leave the
        // 16-px label area at the bottom uncovered. Square via aspect-
        // ratio; width clamps so the dial never grows past 60 px on
        // wide cells and never shrinks below 32 px on narrow ones.
        left: '50%',
        top: 'calc(50% - 6px)',
        transform: 'translate(-50%, -50%)',
        width: 'clamp(32px, 60%, 60px)',
        aspectRatio: '1 / 1',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {data.map((v, i) => {
          const fraction = i / data.length
          // Start at -π/2 (12 o'clock) and sweep clockwise so the
          // playhead motion matches a clock face and reads as "elapsed
          // time around a cycle".
          const angle = fraction * Math.PI * 2 - Math.PI / 2
          const passed = fraction <= progress
          // Static spoke length: pure peak data per bar. Only colour
          // changes with progress (full alpha for spokes the playhead
          // has passed, 40 % alpha for spokes ahead). Active state lifts
          // the overall scale; idle dims it to 35 %.
          const amp = isActive ? v : v * 0.35
          const len = Math.max(1.5, amp * RADIAL_BAR_MAX)
          const cosA = Math.cos(angle)
          const sinA = Math.sin(angle)
          const x1 = RADIAL_CENTER + RADIAL_INNER * cosA
          const y1 = RADIAL_CENTER + RADIAL_INNER * sinA
          const x2 = RADIAL_CENTER + (RADIAL_INNER + len) * cosA
          const y2 = RADIAL_CENTER + (RADIAL_INNER + len) * sinA
          const stroke = isActive ? (passed ? accent : inactiveStroke) : idleStroke
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={RADIAL_BAR_STROKE}
              strokeLinecap="round"
            />
          )
        })}

        {/* Cycle-divider ticks for multi-bar loops: a thin radial line
            at every bar boundary (1/N, 2/N, ..., (N-1)/N of a full
            revolution). Reinforces the LOOP·N badge by visually
            slicing the dial into N equal sectors. One-shots and
            1-bar loops render no ticks. */}
        {!pad.isOneShot && bars > 1 ? <RadialCycleTicks bars={bars} /> : null}
      </svg>
    </div>
  )
}

interface RadialCycleTicksProps {
  bars: number
}

function RadialCycleTicks({ bars }: RadialCycleTicksProps) {
  const ticks: number[] = []
  for (let i = 1; i < bars; i++) ticks.push(i / bars)
  return (
    <>
      {ticks.map((fraction, idx) => {
        const angle = fraction * Math.PI * 2 - Math.PI / 2
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        const x1 = RADIAL_CENTER + RADIAL_TICK_INNER * cosA
        const y1 = RADIAL_CENTER + RADIAL_TICK_INNER * sinA
        const x2 = RADIAL_CENTER + RADIAL_TICK_OUTER * cosA
        const y2 = RADIAL_CENTER + RADIAL_TICK_OUTER * sinA
        return (
          <line
            key={idx}
            data-testid={`pad-cycle-tick-${idx}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--ls-playhead-tick)"
            strokeWidth={RADIAL_TICK_STROKE}
            strokeLinecap="round"
          />
        )
      })}
    </>
  )
}

/**
 * Read this pad's peak-amplitude waveform if the buffer has decoded.
 * Returns `null` until the buffer is available; once available, the
 * cached peaks are returned and never recomputed (peaks are static
 * per buffer). Polls every 200 ms for up to 6 seconds after mount —
 * long enough to cover any slow-decode case but bounded so a
 * never-decoding pad stops polling.
 */
function usePadPeaks(padId: string, columns: number): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(() =>
    getPadPeakSamples(padId, columns),
  )

  useEffect(() => {
    if (peaks) return
    let attempts = 0
    const id = setInterval(() => {
      attempts++
      const next = getPadPeakSamples(padId, columns)
      if (next) {
        setPeaks(next)
        clearInterval(id)
      } else if (attempts >= 30) {
        clearInterval(id)
      }
    }, 200)
    return () => clearInterval(id)
  }, [padId, columns, peaks])

  return peaks
}

interface UseWaveProgressArgs {
  pad: PadMeta
  isActive: boolean
  oneShotWindow: { startsAt: number; endsAt: number } | null | undefined
}

function useWaveProgress({ pad, isActive, oneShotWindow }: UseWaveProgressArgs): number {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)

  useEffect(() => {
    if (!isActive) {
      setProgress(0)
      return
    }
    function tick(t: number) {
      if (t - lastFrameRef.current >= FRAME_INTERVAL_MS) {
        lastFrameRef.current = t
        const ctxNow = getAudioContextNow()
        if (ctxNow !== null) {
          if (pad.isOneShot && oneShotWindow) {
            const dur = oneShotWindow.endsAt - oneShotWindow.startsAt
            if (dur > 0) {
              const e = ctxNow - oneShotWindow.startsAt
              setProgress(Math.min(1, Math.max(0, e / dur)))
            }
          } else {
            const info = getPadPlaybackInfo(pad.padId)
            if (info && info.duration > 0) {
              const e = ctxNow - info.lastStartedAt
              if (e >= 0) setProgress((e % info.duration) / info.duration)
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isActive, pad.padId, pad.isOneShot, oneShotWindow])

  return progress
}
