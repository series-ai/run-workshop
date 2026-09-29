import { useState, useCallback, type FC, type PointerEvent } from 'react'
import type { StageStats } from '../types'
import {
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
  IconCombat,
  IconParkour,
  IconReset,
} from './UIIcons'

export type InputAction =
  | 'left'
  | 'right'
  | 'forward'
  | 'back'
  | 'jump'
  | 'attack'
  | 'dash'
  | 'reset'

export function dispatchInklineInput(action: InputAction, pressed: boolean) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('inkline-input', {
      detail: { action, pressed },
    })
    window.dispatchEvent(event)
  }
}

export interface CombatControlsProps {
  mode: 'combat' | 'parkour'
  stats: StageStats | null
  onResetStage: () => void
}

export const UICombatControls: FC<CombatControlsProps> = ({
  mode,
  stats,
  onResetStage,
}) => {
  const [activeActions, setActiveActions] = useState<Record<string, boolean>>({})

  const handlePointer = useCallback(
    (action: InputAction, pressed: boolean, e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setActiveActions((prev) => ({ ...prev, [action]: pressed }))
      dispatchInklineInput(action, pressed)
    },
    []
  )

  const isCombat = mode === 'combat'

  return (
    <div className="ink-play-controls-panel" aria-label={`${isCombat ? 'Combat' : 'Parkour'} Controls and Telemetry`}>
      {/* HUD Telemetry Banner */}
      <section className="ink-hud-banner">
        <div className="ink-hud-left">
          <div className="ink-hud-mode-tag">
            {isCombat ? <IconCombat size={14} /> : <IconParkour size={14} />}
            <span>{isCombat ? 'COMBAT ARENA' : 'PARKOUR COURSE'}</span>
          </div>
          <div className="ink-hud-score-wrap">
            <span className="ink-hud-label">SCORE:</span>
            <span key={stats?.score ?? 0} className="ink-hud-score">{stats?.score ?? 0}</span>
          </div>
        </div>

        <div className="ink-hud-right">
          <span className="ink-hud-msg">
            {stats?.message && stats.message.trim() !== ''
              ? stats.message
              : 'Arena online. Ready for input.'}
          </span>
        </div>
      </section>

      {/* On-screen virtual gamepad (Touch & Pointer) */}
      <section className="ink-gamepad-deck" aria-label="Virtual Gamepad Controls">
        <div className="ink-gamepad-title">
          <span>ON-SCREEN INPUT CONTROLS (TOUCH & POINTER)</span>
        </div>

        <div className="ink-gamepad-layout">
          {/* Directional Pad */}
          <div className="ink-dpad" role="group" aria-label="Directional Controls">
            <div className="ink-dpad-row">
              <button
                type="button"
                className={`ink-dpad-btn up ${activeActions.forward ? 'pressed' : ''}`}
                onPointerDown={(e) => handlePointer('forward', true, e)}
                onPointerUp={(e) => handlePointer('forward', false, e)}
                onPointerCancel={(e) => handlePointer('forward', false, e)}
                onPointerLeave={(e) => handlePointer('forward', false, e)}
                aria-label="Move Forward (W / Up)"
              >
                <IconArrowUp size={16} />
              </button>
            </div>

            <div className="ink-dpad-row mid">
              <button
                type="button"
                className={`ink-dpad-btn left ${activeActions.left ? 'pressed' : ''}`}
                onPointerDown={(e) => handlePointer('left', true, e)}
                onPointerUp={(e) => handlePointer('left', false, e)}
                onPointerCancel={(e) => handlePointer('left', false, e)}
                onPointerLeave={(e) => handlePointer('left', false, e)}
                aria-label="Strafe Left (A / Left)"
              >
                <IconChevronLeft size={16} />
              </button>

              <div className="ink-dpad-center" aria-hidden="true" />

              <button
                type="button"
                className={`ink-dpad-btn right ${activeActions.right ? 'pressed' : ''}`}
                onPointerDown={(e) => handlePointer('right', true, e)}
                onPointerUp={(e) => handlePointer('right', false, e)}
                onPointerCancel={(e) => handlePointer('right', false, e)}
                onPointerLeave={(e) => handlePointer('right', false, e)}
                aria-label="Strafe Right (D / Right)"
              >
                <IconChevronRight size={16} />
              </button>
            </div>

            <div className="ink-dpad-row">
              <button
                type="button"
                className={`ink-dpad-btn down ${activeActions.back ? 'pressed' : ''}`}
                onPointerDown={(e) => handlePointer('back', true, e)}
                onPointerUp={(e) => handlePointer('back', false, e)}
                onPointerCancel={(e) => handlePointer('back', false, e)}
                onPointerLeave={(e) => handlePointer('back', false, e)}
                aria-label="Move Back (S / Down)"
              >
                <IconArrowDown size={16} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="ink-action-buttons-cluster" role="group" aria-label="Action Buttons">
            <button
              type="button"
              className={`ink-action-pad-btn action-jump ${activeActions.jump ? 'pressed' : ''}`}
              onPointerDown={(e) => handlePointer('jump', true, e)}
              onPointerUp={(e) => handlePointer('jump', false, e)}
              onPointerCancel={(e) => handlePointer('jump', false, e)}
              onPointerLeave={(e) => handlePointer('jump', false, e)}
              aria-label="Jump (Space)"
            >
              <span className="ink-action-key-name">JUMP</span>
              <span className="ink-action-key-hint">SPACE</span>
            </button>

            <button
              type="button"
              className={`ink-action-pad-btn action-attack ${activeActions.attack ? 'pressed' : ''}`}
              onPointerDown={(e) => handlePointer('attack', true, e)}
              onPointerUp={(e) => handlePointer('attack', false, e)}
              onPointerCancel={(e) => handlePointer('attack', false, e)}
              onPointerLeave={(e) => handlePointer('attack', false, e)}
              aria-label="Attack (J)"
            >
              <span className="ink-action-key-name">ATTACK</span>
              <span className="ink-action-key-hint">J</span>
            </button>

            <button
              type="button"
              className={`ink-action-pad-btn action-dash ${activeActions.dash ? 'pressed' : ''}`}
              onPointerDown={(e) => handlePointer('dash', true, e)}
              onPointerUp={(e) => handlePointer('dash', false, e)}
              onPointerCancel={(e) => handlePointer('dash', false, e)}
              onPointerLeave={(e) => handlePointer('dash', false, e)}
              aria-label="Dash (Shift)"
            >
              <span className="ink-action-key-name">DASH</span>
              <span className="ink-action-key-hint">SHIFT</span>
            </button>

            <button
              type="button"
              className={`ink-action-pad-btn action-reset ${activeActions.reset ? 'pressed' : ''}`}
              onPointerDown={(e) => handlePointer('reset', true, e)}
              onPointerUp={(e) => handlePointer('reset', false, e)}
              onPointerCancel={(e) => handlePointer('reset', false, e)}
              onPointerLeave={(e) => handlePointer('reset', false, e)}
              onClick={onResetStage}
              aria-label="Reset Run (R)"
            >
              <IconReset size={14} />
              <span className="ink-action-key-name">RESET</span>
              <span className="ink-action-key-hint">R</span>
            </button>
          </div>
        </div>
      </section>

      {/* Keyboard Legend Guide */}
      <section className="ink-control-section">
        <span className="ink-section-title">KEYBOARD CONTROL MAPPINGS</span>
        <div className="ink-key-mappings-grid">
          <div className="ink-key-row">
            <span className="ink-key-combo">
              <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>Arrows</kbd>
            </span>
            <span className="ink-key-effect">Move</span>
          </div>
          <div className="ink-key-row">
            <span className="ink-key-combo">
              <kbd>Space</kbd>
            </span>
            <span className="ink-key-effect">Jump</span>
          </div>
          <div className="ink-key-row">
            <span className="ink-key-combo">
              <kbd>J</kbd>
            </span>
            <span className="ink-key-effect">Punch / Primary Strike</span>
          </div>
          <div className="ink-key-row">
            <span className="ink-key-combo">
              <kbd>Shift</kbd>
            </span>
            <span className="ink-key-effect">Sprint</span>
          </div>
          <div className="ink-key-row">
            <span className="ink-key-combo">
              <kbd>R</kbd>
            </span>
            <span className="ink-key-effect">Reset Stage Position</span>
          </div>
        </div>
        <p className="ink-key-notice">
          Move with the arrow buttons. Hold DASH to run faster. Release a direction to stop.
        </p>
      </section>
    </div>
  )
}
