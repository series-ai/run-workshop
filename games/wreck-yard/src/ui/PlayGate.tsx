import './Hud.css';
import { AudioControls } from './AudioControls';
import type { YardAudioControl } from '../audio/useYardAudio';
import { canExitFullscreen, cursorNeededNow, type GateNotice, type GateState } from '../game/playGate';
import type { RenderQuality } from '../render/renderQuality';
import type { PlayGateApi } from './usePlayGate';

function Key({ children }: { children: string }) {
  return <kbd className="yard-key yard-key--wide">{children}</kbd>;
}

function ControlsHint() {
  return (
    <div className="yard-gate__hint">
      <span><Key>Mouse</Key>Look</span>
      <span><Key>WASD</Key>Move</span>
      <span><Key>Esc</Key>Pause</span>
    </div>
  );
}

function NoticeLine({ notice, action }: { notice: GateNotice; action: 'Play' | 'Resume' }) {
  if (!notice) return null;
  const text = notice.kind === 'unavailable'
    ? 'Mouse capture is not available here.'
    : `The browser did not capture the mouse. Click ${action} again.`;
  return <div className="yard-notice" role="status">{text}</div>;
}

/** After two refusals, or when capture is not available, offer drag-to-look. */
function showDragFallback(notice: GateNotice): boolean {
  return notice !== null && (notice.kind === 'unavailable' || notice.attempts >= 2);
}

/** Which plate the gate shows; engaging keeps the plate it started from. */
function plateFor(state: GateState): 'start' | 'paused' | 'chip' | null {
  if (cursorNeededNow(state)) return null;
  if (state.look === 'drag') return state.view === 'paused' ? 'paused' : null;
  const view = state.view === 'engaging' ? state.engagedFrom : state.view;
  if (view === 'start') return 'start';
  if (view === 'paused') return 'paused';
  if (view === 'free-cursor' && !state.orbit) return 'chip';
  return null;
}

/**
 * The start plate and the pause menu (spec: .plans/wreck-yard-fullscreen-play-gate.html).
 * It draws nothing while the match menu or an error modal needs the cursor.
 */
export function PlayGate({ audio, gate, inRoom, quality, onQuality, onLeave, touchControls = false }: {
  audio?: YardAudioControl;
  touchControls?: boolean;
  gate: PlayGateApi;
  inRoom: boolean;
  quality: RenderQuality;
  onQuality: (quality: RenderQuality) => void;
  onLeave: () => void;
}) {
  const { state } = gate;
  const plate = plateFor(state);
  const busy = state.view === 'engaging';
  if (plate === null) return null;

  if (plate === 'chip') {
    return (
      <div className="yard-look-chip" data-gate-view={state.view} role="status">
        {busy ? 'Capturing the mouse…' : 'Click to look'}
      </div>
    );
  }

  if (plate === 'start') {
    return (
      <div className="yard-gate" data-gate-view={state.view}>
        <section className="yard-plate yard-plate--gate" aria-label="Start">
          <div className="yard-gate__stripe" aria-hidden="true" />
          <h1 className="yard-gate__title">Wreck<br />Yard</h1>
          <p className="yard-gate__welcome">
            Welcome to Wreck Yard, a multiplayer demo of the RUN Syncplay engine for fast, real-time, cross-platform multiplayer.
          </p>
          <NoticeLine notice={state.notice} action="Play" />
          <button type="button" className="yard-button yard-button--primary yard-button--big" disabled={busy} onClick={() => { void gate.engage(); }}>
            {busy ? <><span className="yard-spinner" aria-hidden="true" />Going fullscreen…</> : 'Click to play'}
          </button>
          {showDragFallback(state.notice) ? (
            <button type="button" className="yard-button" onClick={gate.chooseDrag}>Play in a window (drag to look)</button>
          ) : null}
          <ControlsHint />
        </section>
      </div>
    );
  }

  const fullscreen = state.surface.active || state.caps.fullscreen === 'always-on';
  return (
    <div className="yard-gate" data-gate-view={state.view}>
      <section className="yard-plate yard-plate--gate yard-plate--paused" aria-label="Paused">
        <div className="yard-gate__stripe" aria-hidden="true" />
        <h1 className="yard-gate__title yard-gate__title--small">Paused</h1>
        {inRoom
          ? <div className="yard-notice yard-notice--info">The match continues. You stand still until you resume.</div>
          : <div className="yard-gate__small">Solo is paused</div>}
        <NoticeLine notice={state.notice} action="Resume" />
        <button type="button" className="yard-button yard-button--primary yard-button--big" disabled={busy} onClick={() => { void gate.engage(); }}>
          {busy ? <><span className="yard-spinner" aria-hidden="true" />Capturing…</> : fullscreen || state.look === 'drag' ? 'Resume' : 'Resume fullscreen'}
        </button>
        {showDragFallback(state.notice) ? (
          <button type="button" className="yard-button" onClick={gate.chooseDrag}>Play in a window (drag to look)</button>
        ) : null}
        <div className="yard-gate__row">
          <button type="button" className="yard-button" aria-pressed={quality === 'high'} onClick={() => onQuality(quality === 'high' ? 'low' : 'high')}>
            Graphics: {quality === 'high' ? 'Hi' : 'Lo'}
          </button>
          {canExitFullscreen(state) ? (
            <button type="button" className="yard-button" onClick={() => { void gate.exitFullscreen(); }}>Exit fullscreen</button>
          ) : state.look === 'drag' && state.caps.fullscreen === 'toggleable' ? (
            <button type="button" className="yard-button" onClick={() => { void gate.toggleFullscreen(); }}>Fullscreen</button>
          ) : null}
        </div>
        {audio ? <AudioControls audio={audio} /> : null}
        <button type="button" className="yard-button yard-button--danger" onClick={onLeave}>Leave match</button>
        {canExitFullscreen(state) ? <div className="yard-gate__small">Esc again: leave fullscreen</div> : null}
        {touchControls ? <div className="yard-gate__hint">Left pad: move. Right side: drag to look.</div> : <ControlsHint />}
      </section>
    </div>
  );
}
