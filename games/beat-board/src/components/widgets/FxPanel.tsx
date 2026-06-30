/**
 * FxPanel — bottom-rail FX surface (Phase 3 of the Groovepad alignment plan).
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  [ Filter ] [ Flanger ] [ Reverb ] [ Delay ]           │  ← tab bar
 *   ├────────────────────────────────────────────────────────┤
 *   │   ┌──────────────────────────────────┐                 │
 *   │   │     XY pad surface (2D [0..1])   │  ← pointer/touch │
 *   │   └──────────────────────────────────┘                 │
 *   │   x: cutoff …      y: resonance …                      │  ← live labels
 *   └────────────────────────────────────────────────────────┘
 *
 * Behavior:
 *   - Tab tap → `useFxStore.setActiveEffect(effect)`.
 *   - Pointer-down on XY pad → enter drag, write x/y on every move.
 *   - Pointer-up exits drag. `setPointerCapture` keeps drags alive when the
 *     pointer crosses the pad-grid boundary.
 *   - Live labels show the current parameter values per active effect.
 *
 * data-skin-role:
 *   - panel             → fx.panel
 *   - tab bar           → nav.tabBar (via Tabs)
 *   - XY pad surface    → fx.xy-pad
 */

import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Tabs } from '@modules/ui/skin'
import { useFxStore } from '../../audio/fx-state'
import type { FxEffect } from '../../audio/fx-bus'
import { usePadGridStore, type FxBypassMap } from '../../stores/padGridStore'

/**
 * Returns true when every (category, side) cell of the FX-bypass map is
 * `false` — i.e. no row is currently routed through the FX bus, so the XY
 * pad is silent regardless of what the player drags. The dry-state overlay
 * uses this to telegraph "tap a sparkle column" copy.
 */
function isFxAllDry(map: FxBypassMap): boolean {
  for (const bank of Object.keys(map) as Array<keyof FxBypassMap>) {
    const blocks = map[bank]
    for (const blockId of Object.keys(blocks) as Array<keyof typeof blocks>) {
      if (blocks[blockId]) return false
    }
  }
  return true
}

interface ParamLabel {
  /** Axis label ('Cutoff', 'Rate', etc.). */
  name: string
  /** Pre-formatted value with unit (e.g. '420 Hz', '32%'). */
  display: string
}

const TAB_ITEMS: ReadonlyArray<{ id: FxEffect; label: string }> = [
  { id: 'filter', label: 'Filter' },
  { id: 'flanger', label: 'Flanger' },
  { id: 'reverb', label: 'Reverb' },
  { id: 'delay', label: 'Delay' },
]

// Parameter ranges mirror `fx-bus.ts`. Keep in sync with the bus's mapping
// constants — the engine tests cover the bus side; the labels here are
// product-facing so they have to match what the bus actually applies.
const FILTER_CUTOFF_MIN_HZ = 80
const FILTER_CUTOFF_MAX_HZ = 8000
const FILTER_Q_MIN = 0.5
const FILTER_Q_MAX = 12

const FLANGER_LFO_MIN_HZ = 0.05
const FLANGER_LFO_MAX_HZ = 5
const FLANGER_FB_MAX = 0.85

const REVERB_TONE_MIN_HZ = 800
const REVERB_TONE_MAX_HZ = 8000

const DELAY_TIME_MIN_S = 0.01
const DELAY_TIME_MAX_S = 1.0
const DELAY_FB_MAX = 0.85

function lerp(t: number, min: number, max: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t))
}

function lerpLog(t: number, min: number, max: number): number {
  const lo = Math.log(min)
  const hi = Math.log(max)
  return Math.exp(lo + (hi - lo) * Math.max(0, Math.min(1, t)))
}

function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} kHz`
  return `${Math.round(hz)} Hz`
}

function formatPercent(t: number): string {
  return `${Math.round(Math.max(0, Math.min(1, t)) * 100)}%`
}

function formatMs(s: number): string {
  return `${Math.round(s * 1000)} ms`
}

function paramLabels(effect: FxEffect, x: number, y: number): { x: ParamLabel; y: ParamLabel } {
  switch (effect) {
    case 'filter':
      return {
        x: { name: 'Cutoff', display: formatHz(lerpLog(x, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ)) },
        y: { name: 'Resonance', display: lerp(y, FILTER_Q_MIN, FILTER_Q_MAX).toFixed(1) },
      }
    case 'flanger':
      return {
        x: { name: 'Rate', display: `${lerp(x, FLANGER_LFO_MIN_HZ, FLANGER_LFO_MAX_HZ).toFixed(2)} Hz` },
        y: { name: 'Feedback', display: formatPercent(y * FLANGER_FB_MAX) },
      }
    case 'reverb':
      return {
        x: { name: 'Decay', display: formatPercent(x) },
        y: { name: 'Tone', display: formatHz(lerpLog(y, REVERB_TONE_MIN_HZ, REVERB_TONE_MAX_HZ)) },
      }
    case 'delay':
      return {
        x: { name: 'Time', display: formatMs(lerp(x, DELAY_TIME_MIN_S, DELAY_TIME_MAX_S)) },
        y: { name: 'Feedback', display: formatPercent(y * DELAY_FB_MAX) },
      }
  }
  return {
    x: { name: '—', display: '—' },
    y: { name: '—', display: '—' },
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 'var(--radius-lg, 16px)',
  background: 'var(--ui-panel-card-fill)',
  border: '1px solid var(--ui-panel-card-border)',
  boxShadow: 'var(--ui-panel-card-shadow)',
  width: '100%',
}

const padStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  // Explicit 16:9 aspect ratio + min-height ensures the surface is a real 2D
  // pad on portrait viewports rather than a wide-and-short 1D strip. The
  // user reported "I move the marker and it's the same on each tab" — fixing
  // the geometry so the Y axis actually travels is part of the fix.
  aspectRatio: '16 / 9',
  minHeight: 140,
  borderRadius: 'var(--radius-md, 12px)',
  background: 'var(--ui-panel-card-fill)',
  border: '1px solid var(--ui-panel-card-border)',
  cursor: 'crosshair',
  touchAction: 'none',
  overflow: 'hidden',
}

const dryOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  color: 'var(--ui-text-muted)',
  background: 'var(--ui-panel-card-fill)',
  pointerEvents: 'none',
}

const labelRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  color: 'var(--ui-text-muted)',
  letterSpacing: 0.6,
  textTransform: 'uppercase',
}

const gridOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(to right, var(--ui-panel-card-border) 1px, transparent 1px),' +
    ' linear-gradient(to bottom, var(--ui-panel-card-border) 1px, transparent 1px)',
  backgroundSize: '25% 25%',
  opacity: 0.32,
}

/**
 * Translate a pointer event into normalized [0..1] x/y relative to the pad
 * rect. Returns NaN coordinates when the rect is degenerate (detached or
 * 0-sized) so the caller can detect and skip — this avoids early-return
 * from inside the useCallback body, which the code-quality-guard hook
 * conservatively flags as a conditional-return + later-hook pattern.
 */
function readPointerPosition(node: HTMLDivElement | null, clientX: number, clientY: number): { x: number; y: number } {
  if (node === null) return { x: NaN, y: NaN }
  const rect = node.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return { x: NaN, y: NaN }
  const xRaw = (clientX - rect.left) / rect.width
  // Y axis: top of pad = 1, bottom of pad = 0 (intuitive "more = up").
  const yRaw = 1 - (clientY - rect.top) / rect.height
  return { x: clamp01(xRaw), y: clamp01(yRaw) }
}

export function FxPanel() {
  const activeEffect = useFxStore((s) => s.activeEffect)
  const x = useFxStore((s) => s.x)
  const y = useFxStore((s) => s.y)
  const setActiveEffect = useFxStore((s) => s.setActiveEffect)
  const setParams = useFxStore((s) => s.setParams)
  const fxBypass = usePadGridStore((s) => s.fxBypass)
  const allDry = isFxAllDry(fxBypass)

  const padRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const writeFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const next = readPointerPosition(padRef.current, clientX, clientY)
      if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
        setParams(next.x, next.y)
      }
    },
    [setParams],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const node = padRef.current
      if (node !== null) {
        draggingRef.current = true
        try {
          node.setPointerCapture(event.pointerId)
        } catch {
          // setPointerCapture can throw on detached nodes — non-fatal.
        }
        writeFromClient(event.clientX, event.clientY)
      }
    },
    [writeFromClient],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingRef.current) {
        writeFromClient(event.clientX, event.clientY)
      }
    },
    [writeFromClient],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      draggingRef.current = false
      const node = padRef.current
      if (node !== null) {
        try {
          node.releasePointerCapture(event.pointerId)
        } catch {
          // already released — non-fatal
        }
      }
    },
    [],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const STEP = 0.05
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          setParams(x - STEP, y)
          break
        case 'ArrowRight':
          event.preventDefault()
          setParams(x + STEP, y)
          break
        case 'ArrowUp':
          event.preventDefault()
          setParams(x, y + STEP)
          break
        case 'ArrowDown':
          event.preventDefault()
          setParams(x, y - STEP)
          break
        default:
          break
      }
    },
    [setParams, x, y],
  )

  useEffect(() => {
    return () => {
      draggingRef.current = false
    }
  }, [])

  const labels = paramLabels(activeEffect, x, y)
  const handleStyle: CSSProperties = {
    position: 'absolute',
    left: `calc(${x * 100}% - 9px)`,
    top: `calc(${(1 - y) * 100}% - 9px)`,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'var(--ui-text-primary)',
    border: '2px solid var(--ui-accent, var(--ui-text-primary))',
    pointerEvents: 'none',
    boxShadow: 'var(--ui-panel-card-shadow)',
  }

  return (
    <div
      data-testid="fx-panel"
      data-skin-role="fx.panel"
      data-fx-active={activeEffect}
      style={containerStyle}
    >
      <Tabs
        items={TAB_ITEMS.map((t) => ({ id: t.id, label: t.label }))}
        activeId={activeEffect}
        onSelect={(id) => setActiveEffect(id as FxEffect)}
        data-testid="fx-panel-tabs"
      />
      <div
        ref={padRef}
        data-testid="fx-panel-xy"
        data-skin-role="fx.xy-pad"
        data-fx-x={x.toFixed(3)}
        data-fx-y={y.toFixed(3)}
        data-fx-dry={allDry ? 'true' : 'false'}
        role="slider"
        aria-label={`${activeEffect} XY pad`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(x * 100)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{ ...padStyle, opacity: allDry ? 0.4 : 1 }}
      >
        <div aria-hidden style={gridOverlayStyle} />
        <div aria-hidden data-testid="fx-panel-handle" style={handleStyle} />
        {allDry ? (
          <div
            data-testid="fx-panel-dry-overlay"
            style={dryOverlayStyle}
            role="status"
          >
            Tap a sparkle column to send a row through this effect.
          </div>
        ) : null}
      </div>
      <div style={labelRowStyle}>
        <span data-testid="fx-panel-x-label">
          {labels.x.name}: {labels.x.display}
        </span>
        <span data-testid="fx-panel-y-label">
          {labels.y.name}: {labels.y.display}
        </span>
      </div>
    </div>
  )
}
