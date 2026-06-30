/**
 * PitchPill — compact ± semitone control for one-shot pitch.
 *
 * Collapsed state: a small pill displaying the current offset
 * ("♪ +2"). Tap expands inline into a 3-button cluster
 * `[-] [+2 semis] [+]`. The buttons step ±1 semitone; long-tap is a
 * future polish if asked. Tapping the value resets to 0.
 *
 * Why a pill (not a popover) — the top bar is already short, real
 * estate is tight, and a popover with a backdrop is overkill for a
 * single integer value. The expanded form lives inside the bar's
 * normal flex flow, just wider.
 *
 * Why one-shot pitch only — see `pitchStore.ts`. Detuning a looping
 * source also changes its playback rate, which breaks the kit's
 * bar-aligned mix. One-shots are safe because they fire once and stop.
 */

import { useState, type CSSProperties } from 'react'
import { Music } from 'lucide-react'
import { usePitchStore, MAX_PITCH_SEMITONES } from '../../stores/pitchStore'

export function PitchPill() {
  const semis = usePitchStore((s) => s.oneShotSemitones)
  const setSemis = usePitchStore((s) => s.setOneShotSemitones)
  const [expanded, setExpanded] = useState(false)

  const display = formatSemis(semis)

  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    height: 28,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    border: `1px solid ${
      semis !== 0 ? 'var(--ui-color-accent-border)' : 'var(--ui-color-border)'
    }`,
    background:
      semis !== 0 ? 'var(--ui-color-accent-soft)' : 'var(--ui-panel-section-fill)',
    color: semis !== 0 ? 'var(--ui-color-accent)' : 'var(--ui-text-muted)',
    transition: 'background 200ms ease-out, border-color 200ms ease-out',
    userSelect: 'none',
  }

  if (!expanded) {
    return (
      <button
        type="button"
        data-testid="pitch-pill"
        aria-label={`One-shot pitch ${display} semitones. Tap to adjust.`}
        onClick={() => setExpanded(true)}
        style={baseStyle}
      >
        <Music size={12} aria-hidden />
        <span data-testid="pitch-pill-value">{display}</span>
      </button>
    )
  }

  const stepStyle: CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '1px solid var(--ui-color-border)',
    background: 'transparent',
    color: 'var(--ui-text-strong)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 14,
    padding: 0,
  }

  function decrement() {
    setSemis(semis - 1)
  }

  function increment() {
    setSemis(semis + 1)
  }

  function reset() {
    setSemis(0)
  }

  return (
    <span
      data-testid="pitch-pill-expanded"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 6px',
        borderRadius: 999,
        background: 'var(--ui-panel-section-fill)',
        border: '1px solid var(--ui-color-accent-border)',
      }}
      onMouseLeave={() => setExpanded(false)}
      onBlur={() => setExpanded(false)}
    >
      <button
        type="button"
        data-testid="pitch-pill-down"
        aria-label="Pitch one-shots one semitone down"
        onClick={decrement}
        disabled={semis <= -MAX_PITCH_SEMITONES}
        style={{
          ...stepStyle,
          opacity: semis <= -MAX_PITCH_SEMITONES ? 0.4 : 1,
          cursor: semis <= -MAX_PITCH_SEMITONES ? 'not-allowed' : 'pointer',
        }}
      >
        −
      </button>
      <button
        type="button"
        data-testid="pitch-pill-reset"
        aria-label="Reset one-shot pitch to 0"
        onClick={reset}
        style={{
          minWidth: 56,
          height: 24,
          padding: '0 8px',
          borderRadius: 999,
          background: 'transparent',
          border: 'none',
          color: semis !== 0 ? 'var(--ui-color-accent)' : 'var(--ui-text-strong)',
          fontWeight: 700,
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          cursor: 'pointer',
        }}
      >
        {display} {Math.abs(semis) === 1 ? 'semi' : 'semis'}
      </button>
      <button
        type="button"
        data-testid="pitch-pill-up"
        aria-label="Pitch one-shots one semitone up"
        onClick={increment}
        disabled={semis >= MAX_PITCH_SEMITONES}
        style={{
          ...stepStyle,
          opacity: semis >= MAX_PITCH_SEMITONES ? 0.4 : 1,
          cursor: semis >= MAX_PITCH_SEMITONES ? 'not-allowed' : 'pointer',
        }}
      >
        +
      </button>
    </span>
  )
}

function formatSemis(semis: number): string {
  if (semis === 0) return '±0'
  return semis > 0 ? `+${semis}` : `${semis}`
}
