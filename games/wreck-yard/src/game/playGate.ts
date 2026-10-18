/**
 * The play gate: when the game captures the mouse, when it shows the start
 * plate or the pause menu, and when solo play stops. Pure: no DOM and no SDK.
 * The host (or browser) fullscreen state is the only truth about capture;
 * src/game/capturePort.ts reads it, and src/ui/usePlayGate.ts drives this.
 * Spec: .plans/wreck-yard-fullscreen-play-gate.html.
 */

export type FullscreenCapability = 'unavailable' | 'always-on' | 'toggleable';

export interface SurfaceCaps {
  readonly fullscreen: FullscreenCapability;
  readonly pointerLock: boolean;
}

export interface SurfaceState {
  readonly active: boolean;
  readonly pointerLocked: boolean;
}

export type CaptureFailure = 'unsupported' | 'not-fullscreen' | 'not-owner' | 'refused' | 'timeout';

/** How look works while playing: a captured mouse, or drag-to-look. */
export type LookMode = 'capture' | 'drag';

export type GateView =
  /** Before the first capture: the start plate. */
  | 'start'
  /** A capture request runs; the buttons are disabled. */
  | 'engaging'
  /** Captured, or any time in drag mode. */
  | 'playing'
  /** The cursor came free after play: the pause menu. */
  | 'paused'
  /** The orbit tool: the cursor is free on purpose, with no menu. */
  | 'free-cursor';

export type GateNotice = { readonly kind: 'refused' | 'unavailable'; readonly attempts: number } | null;

export type EngageOrigin = 'start' | 'paused' | 'free-cursor';

export interface GateState {
  readonly caps: SurfaceCaps;
  readonly look: LookMode;
  readonly view: GateView;
  readonly surface: SurfaceState;
  readonly notice: GateNotice;
  /** False until the first capture; until then a free cursor shows the start plate, not the pause menu. */
  readonly hasPlayed: boolean;
  /** The orbit tool is selected. */
  readonly orbit: boolean;
  /** The match menu or an error modal is visible. */
  readonly cursorNeeded: boolean;
  /** A match button captured; "connecting" does not need the cursor until the match settles. */
  readonly matchStarting: boolean;
  /** The request in flight; 0 when none. */
  readonly requestId: number;
  /** Where the running request started; null when none runs. */
  readonly engagedFrom: EngageOrigin | null;
}

export type GateEvent =
  | { readonly type: 'surface'; readonly state: SurfaceState }
  | { readonly type: 'engage'; readonly requestId: number }
  | { readonly type: 'engaged'; readonly requestId: number; readonly state: SurfaceState; readonly reason?: CaptureFailure }
  | { readonly type: 'orbit'; readonly on: boolean }
  | { readonly type: 'cursor-needed'; readonly on: boolean }
  | { readonly type: 'match-start' }
  | { readonly type: 'match-settled' }
  | { readonly type: 'choose-drag' }
  | { readonly type: 'choose-capture' }
  | { readonly type: 'choose-touch' }
  | { readonly type: 'choose-controller' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' };

export type GateEffect = 'release-pointer' | 'clear-input';

export type EngageCall = 'request-fullscreen-lock' | 'lock' | 'none';
export type FullscreenToggleCall = 'request-fullscreen' | 'exit-fullscreen' | 'none';

const WINDOWED: SurfaceState = { active: false, pointerLocked: false };

/** A surface where the game can capture the mouse at all. */
export function canCapture(caps: SurfaceCaps): boolean {
  return caps.pointerLock && caps.fullscreen !== 'unavailable';
}

export function initialGate(caps: SurfaceCaps, surface: SurfaceState, preferDrag = false): GateState {
  const look: LookMode = !preferDrag && canCapture(caps) ? 'capture' : 'drag';
  return {
    caps,
    look,
    view: look === 'drag' ? 'playing' : 'start',
    surface,
    notice: null,
    hasPlayed: false,
    orbit: false,
    // The app creates a room on load. Show the menu until the room is live.
    cursorNeeded: true,
    matchStarting: false,
    requestId: 0,
    engagedFrom: null,
  };
}

export function cursorNeededNow(state: GateState): boolean {
  return state.cursorNeeded && !state.matchStarting;
}

/** Input reaches the sim only while playing or orbiting, and not under a menu. */
export function inputLive(state: GateState): boolean {
  return (state.view === 'playing' || state.view === 'free-cursor') && !cursorNeededNow(state);
}

/** Solo stops behind the pause menu and while a resume runs. */
export function soloPaused(state: GateState): boolean {
  return state.hasPlayed && !cursorNeededNow(state)
    && (state.view === 'paused' || state.view === 'engaging');
}

/** The port call that an engage click makes. */
export function engageCall(state: GateState): EngageCall {
  if (state.look !== 'capture' || cursorNeededNow(state)) return 'none';
  if (state.view !== 'start' && state.view !== 'paused' && state.view !== 'free-cursor') return 'none';
  if (state.caps.fullscreen === 'always-on') return 'lock';
  return state.surface.active ? 'lock' : 'request-fullscreen-lock';
}

/** Mobile web: fullscreen without a lock, as a toggle. */
export function fullscreenToggleCall(state: GateState): FullscreenToggleCall {
  if (state.caps.fullscreen !== 'toggleable' || state.look !== 'drag') return 'none';
  return state.surface.active ? 'exit-fullscreen' : 'request-fullscreen';
}

/** The pause menu's Exit Fullscreen button. */
export function canExitFullscreen(state: GateState): boolean {
  return state.caps.fullscreen === 'toggleable' && state.surface.active;
}

interface Step {
  readonly state: GateState;
  readonly effects: readonly GateEffect[];
}

/** The view the player returns to when the cursor is needed, or after a request. */
function restingView(state: GateState): GateView {
  if (state.look === 'drag') return state.view === 'paused' ? 'paused' : 'playing';
  return state.hasPlayed ? 'paused' : 'start';
}

function notice(previous: GateNotice, kind: 'refused' | 'unavailable'): GateNotice {
  return { kind, attempts: (previous?.kind === kind ? previous.attempts : 0) + 1 };
}

/**
 * Applies the rules that depend on cursor-needed: when it turns on, the view
 * moves at once, a running request ends, and a capture is released.
 */
function settleCursorNeed(previous: GateState, next: GateState, effects: GateEffect[]): Step {
  if (!cursorNeededNow(next)) return { state: next, effects };
  let state = next;
  if (!cursorNeededNow(previous)) {
    if (previous.view === 'playing' || previous.view === 'free-cursor') effects.push('clear-input');
    state = { ...state, view: restingView(state), requestId: 0, engagedFrom: null };
  }
  if (state.surface.pointerLocked && !effects.includes('release-pointer')) effects.push('release-pointer');
  return { state, effects };
}

export function reduceGate(state: GateState, event: GateEvent): Step {
  const effects: GateEffect[] = [];
  switch (event.type) {
    case 'surface': {
      const next = { ...state, surface: event.state };
      if (state.look === 'drag') {
        if (event.state.pointerLocked) effects.push('release-pointer');
        return { state: next, effects };
      }
      if (cursorNeededNow(state)) {
        if (event.state.pointerLocked) effects.push('release-pointer');
        return { state: next, effects };
      }
      if (state.view === 'playing' && !event.state.pointerLocked) {
        effects.push('clear-input');
        return { state: { ...next, view: 'paused' }, effects };
      }
      if ((state.view === 'start' || state.view === 'paused' || state.view === 'free-cursor') && event.state.pointerLocked) {
        if (state.orbit) {
          effects.push('release-pointer');
          return { state: next, effects };
        }
        return { state: { ...next, view: 'playing', hasPlayed: true, notice: null }, effects };
      }
      return { state: next, effects };
    }
    case 'engage': {
      if (engageCall(state) === 'none' || state.requestId !== 0) return { state, effects };
      const origin = state.view as EngageOrigin;
      return { state: { ...state, view: 'engaging', requestId: event.requestId, engagedFrom: origin }, effects };
    }
    case 'engaged': {
      if (state.view !== 'engaging' || event.requestId !== state.requestId) return { state, effects };
      const origin = state.engagedFrom ?? restingView(state);
      const base = { ...state, requestId: 0, engagedFrom: null, surface: event.state };
      if (event.state.pointerLocked) {
        return settleCursorNeed(state, { ...base, view: 'playing', hasPlayed: true, notice: null }, effects);
      }
      switch (event.reason) {
        case 'not-fullscreen':
          return { state: { ...base, view: origin, surface: WINDOWED, notice: notice(state.notice, 'refused') }, effects };
        case 'unsupported':
        case 'timeout':
        case 'not-owner':
          return { state: { ...base, view: origin, notice: notice(state.notice, 'unavailable') }, effects };
        case 'refused':
        case undefined:
          return { state: { ...base, view: origin, notice: notice(state.notice, 'refused') }, effects };
        default: {
          const unreachable: never = event.reason;
          throw new Error(`WRECK_YARD_CAPTURE_REASON_INVALID: ${String(unreachable)}`);
        }
      }
    }
    case 'orbit': {
      if (state.look === 'drag') return { state: { ...state, orbit: event.on }, effects };
      if (state.view === 'playing' && event.on) {
        effects.push('release-pointer');
        return { state: { ...state, view: 'free-cursor', orbit: true }, effects };
      }
      if (state.view === 'free-cursor') return { state: { ...state, orbit: event.on }, effects };
      return { state, effects };
    }
    case 'cursor-needed':
      return settleCursorNeed(state, { ...state, cursorNeeded: event.on }, effects);
    case 'match-start':
      return settleCursorNeed(state, { ...state, matchStarting: true, ...(state.look === 'drag' ? { view: 'playing' as const } : {}) }, effects);
    case 'match-settled':
      return settleCursorNeed(state, { ...state, matchStarting: false }, effects);
    case 'choose-drag': {
      if (state.view !== 'start' && state.view !== 'paused') return { state, effects };
      return { state: { ...state, look: 'drag', view: 'playing', notice: null }, effects };
    }
    case 'choose-controller':
    case 'choose-touch': {
      if (state.look === 'drag') return { state, effects };
      effects.push('clear-input');
      if (state.surface.pointerLocked) effects.push('release-pointer');
      const view = state.view === 'paused' ? 'paused' : event.type === 'choose-controller' && state.view === 'start' ? 'start' : 'playing';
      return { state: { ...state, look: 'drag', view, requestId: 0, engagedFrom: null, notice: null }, effects };
    }
    case 'choose-capture': {
      if (state.look !== 'drag' || !canCapture(state.caps)) return { state, effects };
      return { state: { ...state, look: 'capture', view: 'paused', hasPlayed: true, notice: null }, effects };
    }
    case 'pause': {
      if (!inputLive(state)) return { state, effects };
      effects.push('clear-input');
      if (state.surface.pointerLocked) effects.push('release-pointer');
      return { state: { ...state, view: 'paused', hasPlayed: true }, effects };
    }
    case 'resume': {
      if ((state.look !== 'drag' && !state.orbit) || (state.view !== 'paused' && state.view !== 'start') || cursorNeededNow(state)) return { state, effects };
      effects.push('clear-input');
      return { state: { ...state, hasPlayed: true, view: state.orbit && state.look === 'capture' ? 'free-cursor' : 'playing' }, effects };
    }
    default: {
      const unreachable: never = event;
      throw new Error(`WRECK_YARD_GATE_EVENT_INVALID: ${JSON.stringify(unreachable)}`);
    }
  }
}
