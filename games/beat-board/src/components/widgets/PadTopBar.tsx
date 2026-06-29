/**
 * PadTopBar — compact top header for the pad-grid screen.
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │  Lofi Heights        [A│B]   0:12   [● REC]    │
 *   └─────────────────────────────────────────────────┘
 *
 * 36px tall. Pack name in 16px bold (clear hierarchy). A/B toggle is a
 * sharp 2-segment pill. Record is an icon-only circular button — red
 * pulsing dot when active. The A/B toggle is hidden in landscape (where
 * both banks render side-by-side and the toggle is meaningless).
 *
 * The record button is wired to `useRecordingStore` (Groovepad-style):
 *   - tap while idle → start an open-ended capture
 *   - tap while capturing → stop, finalising the buffer, opening
 *     RecordingReview so the player can name + save
 *
 * The MM:SS counter sits between the bank toggle and the record button
 * while capturing, mirroring Groovepad's unobtrusive elapsed display.
 * (research/groovepad/screens.md:255)
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { Disc3 } from 'lucide-react'
import { useKitsStore, getKitById } from '../../stores/kitsStore'
import { usePadGridStore } from '../../stores/padGridStore'
import { useRecordingStore } from '../../stores/recordingStore'
import {
  isRecordButtonDisabled,
  subscribeRecordGate,
} from '../../systems/ftue-adapter'
import { ElapsedTimeCounter } from './ElapsedTimeCounter'
import { PitchPill } from './PitchPill'
import {
  forceResumeFromUserGesture,
  initAudioMaster,
} from '../../audio/audio-master'
import type { PadBank } from '../../types/kit'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

export interface PadTopBarProps {
  hideBankToggle?: boolean
}

export function PadTopBar({ hideBankToggle = false }: PadTopBarProps) {
  const activeKitId = useKitsStore((s) => s.activeKitId)
  const kit = getKitById(activeKitId)
  const currentBank = usePadGridStore((s) => s.currentBank)
  const setCurrentBank = usePadGridStore((s) => s.setCurrentBank)
  const recordingStatus = useRecordingStore((s) => s.status)
  const startRecording = useRecordingStore((s) => s.start)
  const stopRecording = useRecordingStore((s) => s.stop)
  const isRecording = recordingStatus === 'capturing'

  // FTUE record gate — disabled until the player has tapped two pads
  // (steps 1 and 2). Drives `aria-disabled` on the record button so the
  // FTUE's flow ordering is honoured at the actual affordance.
  const [recordDisabled, setRecordDisabled] = useState<boolean>(() =>
    isRecordButtonDisabled(),
  )
  useEffect(() => {
    setRecordDisabled(isRecordButtonDisabled())
    return subscribeRecordGate(setRecordDisabled)
  }, [])

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 10px',
    minHeight: 38,
    borderRadius: 'var(--radius-md, 14px)',
    background: 'var(--ui-panel-section-fill)',
    border: '1px solid var(--ui-panel-section-border)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  }

  const titleStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--ui-text-strong)',
    letterSpacing: 0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: '1 1 auto',
  }

  const recordStyle: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `1px solid ${isRecording ? 'var(--ui-color-danger)' : 'var(--ui-color-border)'}`,
    background: isRecording ? 'var(--ui-color-danger-soft)' : 'transparent',
    color: isRecording ? 'var(--ui-color-danger)' : 'var(--ui-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition:
      'background 200ms ease-out, ' +
      'border-color 200ms ease-out, ' +
      'color 200ms ease-out',
    animation: isRecording ? 'record-pulse 1200ms ease-in-out infinite' : 'none',
  }

  function handleRecordTap(): void {
    if (recordDisabled) return
    // Unlock the AudioContext from inside the user-gesture stack. PadBlock
    // taps already do this on mobile, but if the user's first interaction
    // post-load is the record button (e.g. FTUE bypassed, or coming back
    // after the modal), iOS Safari leaves the context suspended and live
    // pad audio during the take stays silent until the next pad tap.
    // Wrapped in try because in test/jsdom contexts the AudioContext
    // ctor throws; recording itself is timer-driven and doesn't need
    // audio to fire, so a failure here must NOT block the start path.
    try {
      initAudioMaster()
      forceResumeFromUserGesture()
    } catch (err) {
      RundotAPI.log('PadTopBar.audio-unlock failed (best-effort)', { err: String(err) })
    }
    if (isRecording) {
      stopRecording()
    } else {
      void startRecording().catch((err) => {
        RundotAPI.error('PadTopBar.startRecording failed', { err: String(err) })
      })
    }
  }

  return (
    <div data-testid="pad-top-bar" style={containerStyle}>
      <span data-testid="pad-top-bar-title" style={titleStyle}>
        {kit?.name ?? 'BeatBoard'}
      </span>
      {!hideBankToggle ? (
        <BankToggle current={currentBank} onSelect={setCurrentBank} />
      ) : null}
      <PitchPill />
      <ElapsedTimeCounter />
      <button
        type="button"
        data-testid="pad-top-bar-record"
        data-ftue="record-button"
        data-record-state={isRecording ? 'recording' : 'idle'}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        aria-pressed={isRecording}
        aria-disabled={recordDisabled}
        disabled={recordDisabled}
        onClick={handleRecordTap}
        style={{
          ...recordStyle,
          opacity: recordDisabled ? 0.4 : 1,
          cursor: recordDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        <Disc3 size={16} aria-hidden />
      </button>
    </div>
  )
}

/**
 * Bank toggle — iOS-switch-style: an "A" label on the left, a recessed
 * dark track with a circular white thumb that slides between two
 * positions, and a "B" label on the right. The active letter is
 * bright white; the inactive one is dimmed. Tapping anywhere on the
 * widget flips the bank — the affordance is unambiguously a switch,
 * not a 2-segment selector. The thumb's drop-shadow + the track's
 * inset shadow give the standard "raised pill in a recessed channel"
 * depth cue that reads as "this is a toggle."
 */
function BankToggle({ current, onSelect }: { current: PadBank; onSelect: (bank: PadBank) => void }) {
  const isA = current === 'A'

  const TRACK_WIDTH = 38
  const TRACK_HEIGHT = 20
  const THUMB_SIZE = 14
  const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2
  const thumbX = isA ? THUMB_INSET : TRACK_WIDTH - THUMB_SIZE - THUMB_INSET

  const containerStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  const trackStyle: CSSProperties = {
    position: 'relative',
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 999,
    background: 'var(--ls-bg-recessed)',
    border: '1px solid var(--ls-stroke-strong)',
    boxShadow: 'var(--ui-input-shadow)',
    flexShrink: 0,
    transition: 'border-color 220ms ease-out',
  }

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: THUMB_INSET - 1,
    left: thumbX,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: '50%',
    background: 'var(--ui-text-strong)',
    boxShadow: 'var(--ui-button-icon-shadow)',
    transition: 'left 220ms cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
  }

  function labelStyle(active: boolean): CSSProperties {
    return {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 0.6,
      color: active ? 'var(--ui-text-strong)' : 'var(--ls-text-faint)',
      transition: 'color 220ms ease-out',
      pointerEvents: 'none',
      minWidth: 8,
      textAlign: 'center',
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!isA}
      aria-label={`Bank ${current} active. Tap to switch to bank ${isA ? 'B' : 'A'}.`}
      data-testid="pad-bank-toggle"
      data-bank={current}
      onClick={() => onSelect(isA ? 'B' : 'A')}
      style={containerStyle}
    >
      <span data-testid="pad-bank-toggle-A" style={labelStyle(isA)}>
        A
      </span>
      <span aria-hidden style={trackStyle}>
        <span aria-hidden style={thumbStyle} />
      </span>
      <span data-testid="pad-bank-toggle-B" style={labelStyle(!isA)}>
        B
      </span>
    </button>
  )
}
