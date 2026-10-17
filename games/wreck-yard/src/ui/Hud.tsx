import { useEffect, useRef, useState } from 'react';
import './Hud.css';
import type { MatchRequest, MatchSnapshot } from '../game/match';
import { TOOL_KEY_LABELS, type UiTool } from '../render/keyBindings';
import type { RenderQuality } from '../render/renderQuality';
import { withinBuggyMountRange } from '../sim/constants';
import { buttonWithinReach } from '../sim/contraptions';
import { canCapture, cursorNeededNow, fullscreenToggleCall } from '../game/playGate';
import type { PlayGateApi } from './usePlayGate';

const TOOL_NAMES: Readonly<Record<UiTool, string>> = { hand: 'Gravity Gun', torch: 'Plasma Torch', orbit: 'Orbit' };
const FUEL_SEGMENTS = 14;

function Key({ children, wide = false }: { children: string; wide?: boolean }) {
  return <kbd className={wide ? 'yard-key yard-key--wide' : 'yard-key'}>{children}</kbd>;
}

function StatusLamp({ status }: { status: MatchSnapshot['status'] }) {
  const label = status === 'live' ? 'Live' : status === 'error' ? 'Fault' : status === 'idle' ? 'Idle' : 'Linking';
  return (
    <span className={`yard-lamp yard-lamp--${status}`} data-match-status={status} aria-label={`Status: ${status}`}>
      <span className="yard-lamp__bulb" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Show used fuel. Pulse once on full recharge, then hide. */
function FuelGauge({ fuel, burning }: { fuel: number; burning: boolean }) {
  const lit = Math.round((fuel / 100) * FUEL_SEGMENTS);
  const low = fuel < 25;
  const full = !burning && fuel >= 100;
  const [phase, setPhase] = useState<'visible' | 'charged' | 'hidden'>(() => full ? 'hidden' : 'visible');
  useEffect(() => {
    setPhase((previous) => {
      if (!full) return 'visible';
      return previous === 'visible' ? 'charged' : previous;
    });
  }, [full]);
  const state = full ? phase : 'visible';
  return (
    <div className={`yard-fuel${low ? ' yard-fuel--low' : ''}`} data-state={state}
      aria-hidden={state === 'hidden'} aria-label={`Jet fuel ${Math.round(fuel)}%`}
      onAnimationEnd={(event) => {
        if (full && phase === 'charged' && event.target === event.currentTarget) setPhase('hidden');
      }}>
      <span className="yard-fuel__label">Jet</span>
      <span className="yard-fuel__cells" aria-hidden="true">
        {Array.from({ length: FUEL_SEGMENTS }, (_, index) => (
          <span key={index} className={index < lit ? 'yard-fuel__cell yard-fuel__cell--on' : 'yard-fuel__cell'} />
        ))}
      </span>
    </div>
  );
}

function Reticle({ tool, grabbing }: { tool: UiTool; grabbing: boolean }) {
  if (tool === 'torch') return <div className="yard-reticle yard-reticle--torch" aria-hidden="true"><span /></div>;
  return (
    <div className={`yard-reticle yard-reticle--gun${grabbing ? ' yard-reticle--locked' : ''}`} aria-hidden="true">
      <i /><i /><i /><i /><span />
    </div>
  );
}

export function Hud({ snapshot, tool, onTool, quality, onQuality, onStart, onStop, onRetry, gate, touchControls = false }: {
  touchControls?: boolean;
  quality: RenderQuality;
  onQuality: (quality: RenderQuality) => void;
  snapshot: MatchSnapshot;
  tool: UiTool;
  onTool: (tool: UiTool) => void;
  onStart: (request: MatchRequest) => void;
  onStop: () => void;
  /** Re-runs the last requested action after a terminal error. */
  onRetry: () => void;
  gate: PlayGateApi;
}) {
  const [code, setCode] = useState('');
  const pausePointerHandled = useRef(false);
  const render = snapshot.render;
  const live = snapshot.status === 'live';
  const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);
  const isGrabbing = Boolean(localPlayer?.grabbing);
  const isRiding = Boolean(localPlayer?.ridingVehicle);

  const buggyPose = render?.poses?.get('vehicle-chassis');
  const canMountBuggy = live && !isRiding && Boolean(localPlayer && buggyPose)
    && withinBuggyMountRange(localPlayer!.position, buggyPose!.position);
  // The sim checks a button before the buggy, so the prompt does too. E is use; Punt is the right mouse button.
  const reachableButton = live && !isRiding && localPlayer ? buttonWithinReach(localPlayer.position) : null;
  const prompt = reachableButton === 'dropper' ? 'Drop Drum'
    : reachableButton === 'catapult' ? 'Fire Catapult'
    : canMountBuggy ? 'Drive Buggy'
    : isGrabbing ? 'Punt' : null;
  // The start plate or the pause menu covers the yard (src/ui/PlayGate.tsx): its controls replace these.
  const gateState = gate.state;
  const behindGate = !cursorNeededNow(gateState)
    && (gateState.view === 'start' || gateState.view === 'paused' || gateState.view === 'engaging');
  const offerCapture = !touchControls && gateState.look === 'drag' && canCapture(gateState.caps);
  const fullscreenToggle = fullscreenToggleCall(gateState);
  const aiming = live && tool !== 'orbit' && !isRiding && !behindGate;

  return (
    <>
      <div className={`yard-hud-top${touchControls ? ' yard-hud-top--touch' : ''}`}>
        {live && !touchControls ? (
        <section className="yard-plate yard-plate--title">
          <div className="yard-title">
            <span className="yard-title__word">Wreck Yard</span>
          </div>
          <div className="yard-title__meta">
            <StatusLamp status={snapshot.status} />
            {snapshot.roomCode ? <span className="yard-tape" aria-label={`Room ${snapshot.roomCode}`}>{snapshot.roomCode}</span> : null}
            <span className="yard-crew">Crew {snapshot.crew.occupied ?? '…'}/{snapshot.crew.capacity}</span>
          </div>
          {live ? (
            <div className="yard-tally" aria-live="polite">
              <span><b>{render?.stats.torchCuts ?? 0}</b>Cuts</span>
              <span><b>{render?.stats.throws ?? 0}</b>Throws</span>
              {/* A broken floodlight lens counts as a break. */}
              <span><b>{(render?.stats.fractures ?? 0) + (render?.stats.lampsSmashed ?? 0)}</b>Breaks</span>
              <span><b>{render?.stats.explosions ?? 0}</b>Booms</span>
            </div>
          ) : null}
        </section>
        ) : null}

        {live && !behindGate && !touchControls ? (
          <nav className="yard-toolbar" aria-label="Tools">
            {(['hand', 'torch', 'orbit'] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                className={`yard-tab${tool === entry ? ' yard-tab--on' : ''}${entry === 'orbit' ? ' yard-tab--small' : ''}`}
                aria-label={touchControls ? TOOL_NAMES[entry] : `${TOOL_NAMES[entry]} (${TOOL_KEY_LABELS[entry]})`}
                aria-pressed={tool === entry}
                onClick={() => onTool(entry)}
                disabled={isRiding}
              >
                <Key>{TOOL_KEY_LABELS[entry]}</Key>
                <span>{touchControls && entry === 'hand' ? 'Grab' : touchControls && entry === 'torch' ? 'Torch' : TOOL_NAMES[entry]}</span>
              </button>
            ))}
          </nav>
        ) : null}

        {live && !behindGate ? (
          <div className="yard-corner">
            {offerCapture ? (
              <button type="button" className="yard-button" onClick={() => { void gate.chooseCapture(); }}>Capture mouse</button>
            ) : null}
            {!touchControls && fullscreenToggle !== 'none' ? (
              <button type="button" className="yard-button" aria-pressed={fullscreenToggle === 'exit-fullscreen'} onClick={() => { void gate.toggleFullscreen(); }}>
                {fullscreenToggle === 'exit-fullscreen' ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
            ) : null}
            {!touchControls ? <button type="button" className="yard-switch" aria-pressed={quality === 'high'} onClick={() => onQuality(quality === 'high' ? 'low' : 'high')}>
              <span className="yard-switch__label">Graphics</span>
              <span className="yard-switch__track"><span className={quality === 'high' ? 'is-on' : ''}>Hi</span><span className={quality === 'low' ? 'is-on' : ''}>Lo</span></span>
            </button> : null}
            {touchControls ? <button type="button" className="yard-button yard-touch-pause" aria-label="Pause"
              onPointerDown={(event) => {
                pausePointerHandled.current = event.pointerType === 'touch' || event.pointerType === 'pen';
                if (!pausePointerHandled.current) return;
                event.preventDefault();
                gate.pause();
              }}
              onClick={(event) => {
                const handled = pausePointerHandled.current;
                pausePointerHandled.current = false;
                if (event.detail === 0 || !handled) gate.pause();
              }}><span aria-hidden="true" /></button>
              : <button type="button" className="yard-button yard-button--danger" onClick={onStop}>Leave Match</button>}
          </div>
        ) : null}
      </div>

      {!live ? (
        <div className="yard-gate">
          <section className="yard-plate yard-plate--gate" aria-label="Start a match">
            <div className="yard-gate__stripe" aria-hidden="true" />
            <h1 className="yard-gate__title">Wreck<br />Yard</h1>
            <p className="yard-gate__sub">Torch it. Toss it. Sink it.</p>
            {snapshot.status !== 'idle' ? (
              <div className="yard-gate__status">
                <StatusLamp status={snapshot.status} />
                {snapshot.error ? <span className="yard-fault">{snapshot.error}</span> : null}
              </div>
            ) : null}
            {/* A match button already captured the mouse: only the status shows until the match settles. */}
            {gateState.matchStarting ? null : (<>
            <button type="button" className="yard-button yard-button--primary" onClick={() => onStart({ kind: 'solo' })}>Play Solo</button>
            <div className="yard-gate__row">
              <button type="button" className="yard-button" onClick={() => onStart({ kind: 'quick' })}>Quick Match</button>
              <button type="button" className="yard-button" onClick={() => onStart({ kind: 'create' })}>Create Room</button>
            </div>
            <div className="yard-gate__row">
              <input
                className="yard-input"
                aria-label="Room code"
                value={code}
                onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
                placeholder="ROOM CODE"
              />
              <button type="button" className="yard-button" onClick={() => onStart({ kind: 'join', code })} disabled={code.length === 0}>Join</button>
            </div>
            {snapshot.status === 'error' ? (
              <button type="button" className="yard-button yard-button--primary" onClick={onRetry}>Retry</button>
            ) : null}
            </>)}
          </section>
        </div>
      ) : null}

      {aiming ? (
        <div className="yard-center">
          <Reticle tool={tool} grabbing={isGrabbing} />
        </div>
      ) : null}

      {live && prompt && !touchControls ? (
        <div className="yard-prompt" data-prompt={prompt}>
          {/* E is use (buttons, the buggy); the punt is on the right mouse button. */}
          {touchControls ? null : prompt === 'Punt' ? <Key wide>RMB</Key> : <Key>E</Key>}
          <span>{prompt}</span>
        </div>
      ) : null}

      {live && tool !== 'orbit' && !isRiding ? (
        <div className={touchControls ? `yard-touch-fuel${canMountBuggy || reachableButton ? ' yard-touch-fuel--context' : ''}` : undefined}><FuelGauge fuel={localPlayer?.fuel ?? 100} burning={Boolean(localPlayer?.jetpackActive)} /></div>
      ) : null}

      {live && !touchControls ? (
        <div className={`yard-legend${isRiding ? ' yard-legend--driving' : ''}`}>
          {isRiding ? (
            <>
              <span className="yard-legend__tag">Driving</span>
              <span><Key>W</Key><Key>S</Key>Throttle</span>
              <span><Key>A</Key><Key>D</Key>Steer</span>
              <span><Key>E</Key>Hop out</span>
            </>
          ) : (
            <>
              <span><Key wide>WASD</Key>Move</span>
              <span><Key wide>Space</Key>Jet</span>
              <span><Key wide>LMB</Key>{tool === 'torch' ? 'Cut' : 'Grab'}</span>
              <span><Key wide>RMB</Key>Punt</span>
              <span><Key>E</Key>Use</span>
              <span><Key>O</Key>Orbit</span>
              {gateState.look === 'capture' ? <span><Key wide>Esc</Key>Pause</span> : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
