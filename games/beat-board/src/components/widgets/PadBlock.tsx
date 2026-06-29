/**
 * PadBlock — one 2×2 block of four variants from a single instrument family.
 *
 * Visual model (Groovepad-style, refined 2026-05-02):
 *
 *   IDLE         — neutral dark surface; small per-category corner accent
 *                  in the top-left (4×16px L-shape). Subtle 1px ring breath
 *                  pulses with the global beat clock.
 *   QUEUED       — vertical fill bar grows from bottom to top over the
 *                  wait window, in the category accent color. The OUTGOING
 *                  variant in the same block dims to 60% with a soft
 *                  outline pulse so the swap reads as "this is leaving."
 *   ACTIVE       — saturated category gradient fades in over 220ms while
 *                  the cell scales 0.96 → 1.0; layer label slides in from
 *                  4px below. The active border has a slow 1.5s breath of
 *                  glow (replaces the static white dot).
 *   FIRING       — one-shot only. Sharp 80ms scale to 1.06, 200ms ease-out
 *                  back to 1.0, plus a single 200ms white flash overlay.
 */

import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { Button } from '@modules/ui/skin'
import { createPunch } from '@modules/juice/punch/Punch'
import {
  PAD_PALETTE,
  type BlockQueueEntry,
  type PadState,
  usePadGridStore,
  padStateFor,
} from '../../stores/padGridStore'
import type { PadMeta } from '../../types/kit'
import { padPunchConfig } from '../../polish/animation-timing'
import {
  forceResumeFromUserGesture,
  initAudioMaster,
} from '../../audio/audio-master'
import {
  reinstallAllSourcesAfterResumeReturning,
  getPadPlaybackInfo,
} from '../../audio/pad-audio-graph'
import { PadWaveform } from './PadWaveform'

/** One bar at 84 BPM in seconds — used for loop bar-count derivation. */
const BAR_SECONDS = (60 / 84) * 4
import { syncFxBypassWetSends } from '../../audio/fx-bypass-wiring'

export interface PadBlockProps {
  pads: PadMeta[]
  interactive: boolean
}

/**
 * Module-level flag so the reinstall-all-sources + sync-wet-sends path
 * runs exactly once across the lifetime of the app — on the very first
 * pad tap. We must do it inside the user-gesture stack (when the
 * AudioContext can actually resume); after that the sources stay alive
 * and tap handlers can be plain ramps.
 */
let firstResumeHandled = false

export function PadBlock({ pads, interactive }: PadBlockProps) {
  const activePadIds = usePadGridStore((s) => s.activePadIds)
  const latchedPadIds = usePadGridStore((s) => s.latchedPadIds)
  const queued = usePadGridStore((s) => s.queued)
  const tapLoop = usePadGridStore((s) => s.tapLoop)
  const tapOneShot = usePadGridStore((s) => s.tapOneShot)

  const blockHasQueue = pads[0]
    ? queued[pads[0].bank][pads[0].blockId] !== null
    : false

  return (
    <div
      data-testid={`pad-block-${pads[0]?.bank}-${pads[0]?.blockId}`}
      data-pad-block={pads[0]?.blockId}
      data-block-has-queue={blockHasQueue ? 'true' : 'false'}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        // Tight within-block gap (4px) + bigger between-block gap (10px,
        // owned by the parent grid). The asymmetry helps the eye scan the
        // four variants as a unit.
        gap: 4,
        flex: '1 1 0',
        minHeight: 0,
      }}
    >
      {pads.map((pad) => {
        const state = padStateFor(pad, { activePadIds, latchedPadIds, queued })
        const queueEntry = queued[pad.bank][pad.blockId]
        const isQueuedHere = queueEntry?.padId === pad.padId
        // The OUTGOING pad in a block-with-queue is the currently-active
        // variant whose place is about to be taken. We dim it as the queue
        // sweeps to telegraph the impending swap.
        const isOutgoing =
          blockHasQueue && state === 'active' && queueEntry?.padId !== pad.padId
        // FTUE spotlight markers — the config in
        // `systems/ftue-config.ts` queries `[data-ftue="pad-cell-0"]`
        // (first drum) and `[data-ftue="pad-cell-5"]` (second-row
        // bass) to draw the tutorial spotlight. Without this the
        // selector finds nothing and the FTUE renders a uniform-dim
        // backdrop with a centered tooltip the player can easily
        // miss. Keyed off bank+block+variant so the markers stick to
        // the same physical pads as the FTUE config expects.
        const ftueMarker =
          pad.bank === 'A' && pad.blockId === 'block-0' && pad.variantIndex === 0
            ? 'pad-cell-0'
            : pad.bank === 'A' && pad.blockId === 'block-1' && pad.variantIndex === 1
            ? 'pad-cell-5'
            : undefined
        return (
          <PadVariantCell
            key={pad.padId}
            pad={pad}
            state={state}
            queueEntry={isQueuedHere ? queueEntry : null}
            outgoing={isOutgoing}
            interactive={interactive && pad.bufferUrl !== ''}
            stubbed={pad.bufferUrl === ''}
            ftueMarker={ftueMarker}
            onTap={() => {
              if (pad.bufferUrl === '') return
              if (pad.isOneShot) tapOneShot(pad.padId)
              else tapLoop(pad.padId)
            }}
          />
        )
      })}
    </div>
  )
}

interface PadVariantCellProps {
  pad: PadMeta
  state: PadState
  queueEntry: BlockQueueEntry | null
  outgoing: boolean
  interactive: boolean
  stubbed: boolean
  onTap: () => void
  ftueMarker?: string
}

function PadVariantCell({
  pad,
  state,
  queueEntry,
  outgoing,
  interactive,
  stubbed,
  onTap,
  ftueMarker,
}: PadVariantCellProps) {
  const palette = PAD_PALETTE[pad.color]
  const isLatched = state === 'active'
  const isFiring = state === 'firing'
  const isQueued = state === 'queued'
  const punch = usePunchOffset()

  const handleTap = () => {
    if (!interactive) return
    initAudioMaster()
    forceResumeFromUserGesture()
    if (!firstResumeHandled) {
      firstResumeHandled = true
      reinstallAllSourcesAfterResumeReturning()
      syncFxBypassWetSends()
    }
    punch.trigger()
    onTap()
  }

  // Surface fill — clean dark default at idle. Active loops get the
  // category-tinted neon gradient (subtle 22%-on-dark per the mock).
  // One-shots while firing get the same gradient (the LOOP·N badge
  // becomes FX·Ns and the dashed border tells one-shots apart).
  const surfaceFill = isLatched || (isFiring && pad.isOneShot)
    ? palette.activeBg
    : 'var(--ui-pad-cell-fill, #100a1a)'
  // Ring: full per-category neon when active or firing. Otherwise the
  // dark-purple hairline.
  const ringColor = isLatched || (isFiring && pad.isOneShot)
    ? palette.activeRing
    : 'var(--ls-stroke)'

  // Single-edge active treatment: 1px outer border (rendered via the
  // standard `borderColor` / `borderWidth` props) plus an outer halo
  // glow. Earlier versions also drew a `inset 0 0 0 1px` ring at 67%
  // alpha, but that visibly stacked with the outer border as two
  // concentric outlines on dashed (one-shot) cells especially. Halo
  // alone carries the "active" emphasis cleanly.
  const isActiveVisual = isLatched || (isFiring && pad.isOneShot)
  const activeGlow = isActiveVisual
    ? `0 0 24px -2px ${palette.activeRing}`
    : 'none'

  // One-shot cells use a DASHED outline so even at idle the player can
  // see "this is a fire-once pad, not a sustained loop." Loops solid.
  const borderStyle = pad.isOneShot ? 'dashed' : 'solid'

  const padStyle: CSSProperties & Record<string, string | number> = {
    width: '100%',
    height: '100%',
    minHeight: 0,
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
    background: surfaceFill,
    '--ui-button-fill': surfaceFill,
    '--ui-button-grid-fill': surfaceFill,
    '--ui-button-shadow': 'none',
    '--ui-button-grid-shadow': 'none',
    '--ui-button-active-shadow': 'none',
    '--ui-button-grid-active-shadow': 'none',
    // Suppress the Skin button's `::before` border (rendered as a 2px solid
    // line via `--ui-button-border-width`). PadBlock draws its own border on
    // the outer button so the Skin pseudo-border was stacking as a second
    // outline — solid even when the outer was dashed (one-shot cells).
    '--ui-button-border-width': '0px',
    '--ui-button-border': ringColor,
    '--ui-button-grid-border': ringColor,
    borderColor: ringColor,
    // 1px in every state — the inset 1px ring inside `activeGlow` plus
    // the outer halo carries the "active" emphasis. Bumping the outer
    // border to 2px on active stacks visibly with the inset ring and
    // reads as two concentric outlines.
    borderWidth: 1,
    borderStyle,
    borderRadius: 'var(--radius-md, 12px)',
    color: 'var(--ui-text-primary)',
    boxShadow: activeGlow,
    transition:
      'background 220ms ease-out, ' +
      'border-color 220ms ease-out, ' +
      'box-shadow 220ms ease-out, ' +
      'opacity 200ms ease-out, ' +
      'transform 60ms linear',
    transform: `scale(${(isLatched ? 1 : 0.985) + punch.offset})`,
    // Active state runs the ring-glow breath. The outgoing pad in a
    // queued block stays fully bright (it keeps PLAYING until the bar
    // boundary handoff); only the queued pad's fill-bar countdown
    // telegraphs which variant is taking over next.
    animation: isLatched ? 'pad-active-glow 1500ms ease-in-out infinite' : 'none',
    opacity: stubbed ? 0.35 : 1,
    cursor: stubbed ? 'not-allowed' : 'pointer',
  }

  return (
    <Button.Grid
      aria-label={`${palette.label} — ${pad.layerName}`}
      aria-pressed={isLatched || isFiring}
      data-testid={`pad-${pad.padId}`}
      data-pad-color={pad.color}
      data-pad-bank={pad.bank}
      data-pad-block={pad.blockId}
      data-pad-variant={pad.variantIndex}
      data-pad-state={state === 'idle' ? 'idle' : 'active'}
      data-pad-latched={isLatched ? 'true' : 'false'}
      data-pad-queued={isQueued ? 'true' : 'false'}
      data-pad-outgoing={outgoing ? 'true' : 'false'}
      data-pad-one-shot={pad.isOneShot ? 'true' : 'false'}
      data-pad-stubbed={stubbed ? 'true' : 'false'}
      data-ftue={ftueMarker}
      disabled={!interactive}
      onClick={handleTap}
      style={padStyle}
    >
      {/* LOOP·N / FX·Ns badge — top-left, mono uppercase. Per the mock,
          this is the cell's category-identity tag at idle (replaces the
          old L-shaped corner accent). Tints to the neon accent when
          active; muted purple-gray when idle. */}
      <PadKindBadge pad={pad} active={isActiveVisual} accent={palette.activeRing} />

      {/* Pulsing 6×6 dot — top-right, only when active. Mock-style. */}
      {isActiveVisual ? <PadActivePulse accent={palette.activeRing} /> : null}

      {/* Layer-name label */}
      <span
        aria-hidden
        data-testid={`pad-label-${pad.padId}`}
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 8,
          fontSize: 10,
          lineHeight: 1.15,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: isLatched ? 'var(--ui-text-strong)' : 'var(--ls-text-muted)',
          textShadow: isLatched ? 'var(--ui-pad-label-shadow)' : 'none',
          textAlign: 'left',
          maxWidth: '100%',
          // Allow up to 2 lines so labels like "Brushed Snare" /
          // "Whisper Hook" / "Vocal Chops" aren't truncated to ellipsis.
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          pointerEvents: 'none',
          transition: 'color 200ms ease-out, transform 220ms ease-out',
          transform: `translateY(${isLatched ? 0 : 0}px)`,
        }}
      >
        {pad.layerName}
      </span>

      {/* Queue fill bar — vertical bar grows from bottom to top over the
          wait window. Replaces the previous SVG ring. */}
      {isQueued && queueEntry ? (
        <QueueFillBar
          queuedAt={queueEntry.queuedAt}
          landsAt={queueEntry.landsAt}
          color={palette.activeRing}
        />
      ) : null}

      {/* Fire flash — sharp white flash for one-shots on the very first
          tap, fades over 200ms. The persistent playhead bar (below)
          carries the rest of the firing-state visual. */}
      {isFiring ? (
        <div
          aria-hidden
          data-testid={`pad-fire-flash-${pad.padId}`}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--ui-text-strong)',
            mixBlendMode: 'overlay',
            opacity: 0,
            animation: 'pad-fire-flash 250ms ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* Pad waveform — name-seeded mini spectrogram. Idle: quiet white
          at low alpha. Active: per-category neon, amplitude modulated
          by progress, full alpha before the playhead and 40% after. */}
      <PadWaveform
        pad={pad}
        isLatched={isLatched}
        isFiring={isFiring}
        accent={palette.activeRing}
      />
    </Button.Grid>
  )
}

interface PadKindBadgeProps {
  pad: PadMeta
  active: boolean
  accent: string
}

/**
 * `LOOP·N` / `FX·Ns` mono badge in the cell's top-left. This is the
 * Neon Arcade replacement for the L-shaped corner mark — same role
 * (category-of-pad identifier at idle) but it also encodes the loop's
 * bar count or one-shot duration, which the mock uses to hint at a
 * pad's musical length without the player needing to fire it first.
 */
function PadKindBadge({ pad, active, accent }: PadKindBadgeProps) {
  const buf = getPadPlaybackInfo(pad.padId)
  // For loops: "LOOP·{bars}"; if buffer info is missing, fall back to
  // the meta-declared layer category. For one-shots: "FX·{secs}s".
  let text: string
  if (pad.isOneShot) {
    const sec = buf?.duration ?? 1
    text = `FX·${sec.toFixed(1)}s`
  } else {
    const bars = buf ? Math.max(1, Math.round(buf.duration / BAR_SECONDS)) : 1
    text = `LOOP·${bars}`
  }
  return (
    <span
      aria-hidden
      data-testid="pad-kind-badge"
      style={{
        position: 'absolute',
        top: 8,
        left: 10,
        fontSize: 10,
        fontFamily: 'var(--ui-font-mono)',
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: active ? accent : 'var(--ls-text-subtle, #5d4f7e)',
        pointerEvents: 'none',
        transition: 'color 220ms ease-out',
      }}
    >
      {text}
    </span>
  )
}

interface PadActivePulseProps {
  accent: string
}

/**
 * 6×6 round dot in the cell's top-right that pulses opacity 0.4 → 1.0
 * with a soft glow halo. Only rendered while the pad is audibly active.
 */
function PadActivePulse({ accent }: PadActivePulseProps) {
  return (
    <span
      aria-hidden
      data-testid="pad-active-pulse"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 6,
        height: 6,
        borderRadius: 999,
        background: accent,
        boxShadow: `0 0 8px ${accent}`,
        animation: 'na-wfpulse 600ms ease-in-out infinite alternate',
        pointerEvents: 'none',
      }}
    />
  )
}

interface QueueFillBarProps {
  queuedAt: number
  landsAt: number
  color: string
}

/**
 * Vertical fill bar that grows from the bottom of the cell to the top
 * over the wait window. Uses a CSS scale-Y transform so it tightens when
 * the bar lands ("about to take over" feel) — the bar is at full height
 * exactly when the audio swap fires.
 */
function QueueFillBar({ queuedAt, landsAt, color }: QueueFillBarProps) {
  const durationMs = Math.max(1, (landsAt - queuedAt) * 1000)
  return (
    <span
      aria-hidden
      data-testid="pad-queue-fill"
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        background: color,
        opacity: 0.32,
        transformOrigin: 'bottom',
        transform: 'scaleY(0)',
        animation: `pad-queue-fill ${durationMs}ms cubic-bezier(0.6, 0.0, 0.2, 1) forwards`,
        pointerEvents: 'none',
      }}
    />
  )
}

function usePunchOffset() {
  const punchRef = useRef<ReturnType<typeof createPunch> | null>(null)
  const [offset, setOffset] = useState(0)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)

  if (punchRef.current === null) {
    punchRef.current = createPunch({ ...padPunchConfig })
  }

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const trigger = () => {
    punchRef.current?.trigger()
    if (rafRef.current !== null) return
    lastTickRef.current = performance.now()
    const tick = (t: number) => {
      const dt = (t - lastTickRef.current) / 1000
      lastTickRef.current = t
      const state = punchRef.current?.update(dt)
      if (state?.active) {
        setOffset(state.value)
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setOffset(0)
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  return { offset, trigger }
}
