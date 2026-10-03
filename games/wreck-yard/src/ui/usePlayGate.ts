import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CapturePort } from '../game/capturePort';
import type { MatchController, MatchStatus } from '../game/match';
import {
  engageCall,
  fullscreenToggleCall,
  initialGate,
  reduceGate,
  soloPaused,
  type GateEvent,
  type GateState,
} from '../game/playGate';

export interface PlayGateApi {
  readonly state: GateState;
  readonly port: CapturePort;
  /** Play, Resume, the "Click to look" chip, or a canvas click. A click handler: the port call is its first await. */
  engage(): Promise<void>;
  /** A match button: capture in this click, then start the match. */
  engageForMatch(start: () => void): Promise<void>;
  exitFullscreen(): Promise<void>;
  /** Mobile web: fullscreen without a lock, on and off. */
  toggleFullscreen(): Promise<void>;
  chooseDrag(): void;
  chooseCapture(): Promise<void>;
  setOrbit(on: boolean): void;
  /** Called when held keys and buttons must be dropped. */
  onClearInput(listener: () => void): () => void;
}

/**
 * Wires the pure gate (src/game/playGate.ts) to a capture port and the match:
 * port state changes, the match status, and click handlers go in; pointer
 * release, input clearing, and the solo pause come out.
 */
export function usePlayGate(port: CapturePort, controller: MatchController, match: { readonly status: MatchStatus; readonly modalOpen: boolean }): PlayGateApi {
  const current = useRef<GateState>(initialGate(port.caps, { active: false, pointerLocked: false }));
  const [state, setState] = useState(current.current);
  const clearListeners = useRef(new Set<() => void>());
  const nextRequest = useRef(0);

  const dispatch = useCallback((event: GateEvent) => {
    const { state: next, effects } = reduceGate(current.current, event);
    current.current = next;
    setState(next);
    for (const effect of effects) {
      switch (effect) {
        case 'release-pointer':
          void port.setPointerLock(false);
          break;
        case 'clear-input':
          for (const listener of clearListeners.current) listener();
          break;
        default: {
          const unreachable: never = effect;
          throw new Error(`WRECK_YARD_GATE_EFFECT_INVALID: ${String(unreachable)}`);
        }
      }
    }
  }, [port]);

  // The port's state is the only truth about capture.
  useEffect(() => {
    let live = true;
    const stop = port.onState((surface) => dispatch({ type: 'surface', state: surface }));
    void port.getState().then((surface) => { if (live) dispatch({ type: 'surface', state: surface }); });
    return () => {
      live = false;
      stop();
    };
  }, [port, dispatch]);

  // The match menu and error modal need the cursor; a match start settles when it leaves "connecting".
  const lastStatus = useRef<MatchStatus>(match.status);
  useEffect(() => {
    const previous = lastStatus.current;
    lastStatus.current = match.status;
    if (previous === 'connecting' && match.status !== 'connecting') dispatch({ type: 'match-settled' });
    dispatch({ type: 'cursor-needed', on: match.status !== 'live' || match.modalOpen });
  }, [match.status, match.modalOpen, dispatch]);

  // Derived, not a one-shot effect, so a match start cannot undo it.
  useEffect(() => {
    controller.setPaused(soloPaused(state));
  }, [controller, state, match.status]);

  const engage = useCallback(async () => {
    const call = engageCall(current.current);
    if (call === 'none' || current.current.requestId !== 0) return;
    nextRequest.current += 1;
    const requestId = nextRequest.current;
    dispatch({ type: 'engage', requestId });
    const result = call === 'lock' ? await port.setPointerLock(true) : await port.requestFullscreen({ pointerLock: true });
    dispatch({
      type: 'engaged',
      requestId,
      state: { active: result.active, pointerLocked: result.pointerLocked },
      ...(result.reason ? { reason: result.reason } : {}),
    });
  }, [dispatch, port]);

  const engageForMatch = useCallback(async (start: () => void) => {
    dispatch({ type: 'match-start' });
    // engage() makes its port call before it yields, so the click still counts.
    const capture = engage();
    start();
    await capture;
  }, [dispatch, engage]);

  const exitFullscreen = useCallback(async () => {
    const surface = await port.exitFullscreen();
    dispatch({ type: 'surface', state: surface });
  }, [dispatch, port]);

  const toggleFullscreen = useCallback(async () => {
    const call = fullscreenToggleCall(current.current);
    if (call === 'none') return;
    const result = call === 'request-fullscreen' ? await port.requestFullscreen({ pointerLock: false }) : await port.exitFullscreen();
    dispatch({ type: 'surface', state: { active: result.active, pointerLocked: result.pointerLocked } });
  }, [dispatch, port]);

  const chooseDrag = useCallback(() => dispatch({ type: 'choose-drag' }), [dispatch]);

  const chooseCapture = useCallback(async () => {
    dispatch({ type: 'choose-capture' });
    await engage();
  }, [dispatch, engage]);

  const setOrbit = useCallback((on: boolean) => dispatch({ type: 'orbit', on }), [dispatch]);

  const onClearInput = useCallback((listener: () => void) => {
    clearListeners.current.add(listener);
    return () => { clearListeners.current.delete(listener); };
  }, []);

  return useMemo(() => ({
    state, port, engage, engageForMatch, exitFullscreen, toggleFullscreen, chooseDrag, chooseCapture, setOrbit, onClearInput,
  }), [state, port, engage, engageForMatch, exitFullscreen, toggleFullscreen, chooseDrag, chooseCapture, setOrbit, onClearInput]);
}
