import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import { withinBuggyMountRange } from '../sim/constants';
import { buttonWithinReach } from '../sim/contraptions';
import { inputLive } from '../game/playGate';
import type { MatchSnapshot } from '../game/match';
import type { UiTool } from '../render/keyBindings';
import type { PlayGateApi } from './usePlayGate';
import { VirtualJoystick } from './VirtualJoystick';
import { clearTouchInput, clearTouchWeapon, queueTouchCut, queueTouchShot, setTouchWeapon, touchAxis, type TouchInput, type TouchWeapon } from './touchInput';
import './TouchControls.css';

type GestureAction =
  | { kind: 'move' | 'look' | 'cut' | 'grab' | 'push' | 'drop' | 'jetpack' | 'use' | 'swap'; target: HTMLElement }
  | { kind: 'throw'; target: HTMLElement; bodyId: string };
type Gesture = GestureAction & { readonly pointerType: 'touch' | 'pen' };
type PointerPosition = { readonly pointerId: number; readonly clientX: number; readonly clientY: number };
const STICK_RADIUS = 46;

/** Each pointer keeps the action that was selected at its start. */
export function TouchControls({ input, snapshot, tool, gate, onTool }: {
  input: MutableRefObject<TouchInput>;
  snapshot: MatchSnapshot;
  tool: UiTool;
  gate: PlayGateApi;
  onTool(tool: UiTool): void;
}) {
  const stick = useRef(new VirtualJoystick({ baseRadiusPx: STICK_RADIUS, deadzone: 0.12 }));
  const gestures = useRef(new Map<number, Gesture>());
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const touchSequence = useRef(0);
  const touchCount = useRef(0);
  const orphanFrame = useRef<number | null>(null);
  const finishRef = useRef<(pointerId: number, commit: boolean, position?: PointerPosition) => void>(() => {});
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const [weapon, setWeapon] = useState<TouchWeapon>(input.current.weapon);
  const [lookLearned, setLookLearned] = useState(false);
  const live = snapshot.status === 'live' && inputLive(gate.state) && tool !== 'orbit';
  const player = snapshot.render?.players.find((entry) => entry.slot === snapshot.render?.localSlot);
  const riding = Boolean(player?.ridingVehicle);
  const buggy = snapshot.render?.poses.get('vehicle-chassis');
  const machine = player ? buttonWithinReach(player.position) : null;
  const canRide = Boolean(player && buggy && withinBuggyMountRange(player.position, buggy.position));
  const useLabel = machine === 'dropper' ? 'Drop' : machine === 'catapult' ? 'Fire' : canRide ? 'Ride' : null;
  const holding = weapon.kind === 'holding' || weapon.kind === 'releasing';
  const busy = weapon.kind === 'grab-pending' || weapon.kind === 'releasing' || input.current.dropQueued;

  const resetStick = () => {
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)';
    if (ring.current) { ring.current.style.left = ''; ring.current.style.top = ''; ring.current.style.bottom = ''; ring.current.dataset.active = 'false'; }
  };
  const cancelOrphanCheck = () => {
    touchSequence.current += 1;
    if (orphanFrame.current !== null) cancelAnimationFrame(orphanFrame.current);
    orphanFrame.current = null;
  };
  const clear = () => {
    cancelOrphanCheck();
    const captured = [...gestures.current.entries()];
    gestures.current.clear();
    for (const [id, gesture] of captured) {
      stick.current.onTouchEnd(id);
      if (gesture.target.hasPointerCapture(id)) gesture.target.releasePointerCapture(id);
    }
    look.current = null;
    clearTouchInput(input.current);
    resetStick();
  };
  const clearWeapon = () => {
    for (const [id, gesture] of [...gestures.current]) {
      if (gesture.kind === 'move' || gesture.kind === 'look' || gesture.kind === 'jetpack' || gesture.kind === 'use') continue;
      gestures.current.delete(id);
      if (look.current?.id === id) look.current = null;
      if (gesture.target.hasPointerCapture(id)) gesture.target.releasePointerCapture(id);
    }
    clearTouchWeapon(input.current);
  };
  useEffect(() => {
    input.current.onWeaponChange = setWeapon;
    setWeapon(input.current.weapon);
    const stop = gate.onClearInput(clear);
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    window.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear);
      document.removeEventListener('visibilitychange', visibility);
      input.current.onWeaponChange = null;
      clear();
    };
  }, [input, gate.onClearInput]);
  useEffect(() => { clear(); }, [live, riding, snapshot.roomCode]);
  useEffect(() => { clearWeapon(); }, [tool]);
  useEffect(() => {
    if (riding || useLabel !== null) return;
    for (const [id, gesture] of gestures.current) if (gesture.kind === 'use') gestures.current.delete(id);
    input.current.use = false;
    input.current.useQueued = false;
  }, [input, riding, useLabel]);

  const accept = (event: PointerEvent<HTMLElement>, gesture: GestureAction): boolean => {
    if (!live || (event.pointerType !== 'touch' && event.pointerType !== 'pen') || [...gestures.current.values()].some((active) => active.kind === gesture.kind)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch') cancelOrphanCheck();
    gestures.current.set(event.pointerId, { ...gesture, pointerType: event.pointerType });
    return true;
  };
  const startLook = (event: PointerEvent<HTMLElement>) => {
    look.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const moveLook = (event: PointerPosition) => {
    const previous = look.current;
    if (!previous || previous.id !== event.pointerId) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    input.current.lookX += dx;
    input.current.lookY += dy;
    look.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (dx !== 0 || dy !== 0) setLookLearned(true);
  };
  const inside = (event: PointerPosition, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  const requestDrop = () => {
    const current = input.current.weapon;
    input.current.dropQueued = true;
    input.current.shots = [];
    if (current.kind === 'holding' || current.kind === 'releasing') {
      setTouchWeapon(input.current, { kind: 'releasing', bodyId: current.bodyId, action: 'drop' });
    } else setTouchWeapon(input.current, { kind: 'idle' });
  };
  const finishOwner = (pointerId: number, commit: boolean, position?: PointerPosition) => {
    const gesture = gestures.current.get(pointerId);
    if (!gesture) return;
    gestures.current.delete(pointerId);
    if (commit && position) moveLook(position);
    if (look.current?.id === pointerId) look.current = null;
    if (gesture.target.hasPointerCapture(pointerId)) gesture.target.releasePointerCapture(pointerId);
    switch (gesture.kind) {
      case 'move':
        stick.current.onTouchEnd(pointerId);
        input.current.moveX = 0; input.current.moveZ = 0; resetStick();
        break;
      case 'cut':
        input.current.primary = false;
        if (!commit) {
          input.current.cutQueued = false;
          input.current.cutUntilFrame = null;
        }
        break;
      case 'grab':
        if (!commit) requestDrop();
        break;
      case 'throw': {
        const current = input.current.weapon;
        if (commit && current.kind === 'holding' && current.bodyId === gesture.bodyId) {
          queueTouchShot(input.current, 'throw');
          setTouchWeapon(input.current, { kind: 'releasing', bodyId: current.bodyId, action: 'throw' });
        }
        break;
      }
      case 'push':
        if (commit && position && inside(position, gesture.target)) queueTouchShot(input.current, 'push');
        break;
      case 'drop':
        if (commit && position && inside(position, gesture.target)) requestDrop();
        break;
      case 'jetpack': input.current.jetpack = false; break;
      case 'use':
        input.current.use = false;
        if (!commit) input.current.useQueued = false;
        break;
      case 'swap':
        if (commit && position && inside(position, gesture.target)) { clearWeapon(); onTool(tool === 'torch' ? 'hand' : 'torch'); }
        break;
      case 'look': break;
    }
  };
  finishRef.current = finishOwner;
  const release = (event: PointerEvent<HTMLElement>) => finishOwner(event.pointerId, event.type === 'pointerup', event);
  const releaseHandlers = { onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release };

  useEffect(() => {
    const finish = (event: globalThis.PointerEvent) => finishRef.current(event.pointerId, event.type === 'pointerup', event);
    const startTouch = (event: TouchEvent) => {
      touchCount.current = event.touches.length;
      cancelOrphanCheck();
    };
    const endTouch = (event: TouchEvent) => {
      touchCount.current = event.touches.length;
      cancelOrphanCheck();
      if (event.touches.length !== 0 || gestures.current.size === 0) return;
      const sequence = touchSequence.current;
      // Wait for normal pointerup before canceling any physical touch owners.
      orphanFrame.current = requestAnimationFrame(() => {
        orphanFrame.current = null;
        if (touchSequence.current !== sequence || touchCount.current !== 0) return;
        for (const [pointerId, gesture] of gestures.current) {
          if (gesture.pointerType === 'touch') finishRef.current(pointerId, false);
        }
      });
    };
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    window.addEventListener('lostpointercapture', finish, true);
    window.addEventListener('touchstart', startTouch, true);
    window.addEventListener('touchend', endTouch, true);
    window.addEventListener('touchcancel', endTouch, true);
    return () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('lostpointercapture', finish, true);
      window.removeEventListener('touchstart', startTouch, true);
      window.removeEventListener('touchend', endTouch, true);
      window.removeEventListener('touchcancel', endTouch, true);
      cancelOrphanCheck();
    };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preventGesture = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest('.yard-touch-look, .yard-touch-move, .yard-touch-action');
      if (event.cancelable && control && element.contains(control)) event.preventDefault();
    };
    // These controls use PointerEvents. They do not need compatibility clicks.
    element.addEventListener('touchstart', preventGesture, { passive: false });
    element.addEventListener('touchmove', preventGesture, { passive: false });
    return () => {
      element.removeEventListener('touchstart', preventGesture);
      element.removeEventListener('touchmove', preventGesture);
    };
  }, [live]);
  const startPrimary = (event: PointerEvent<HTMLButtonElement>) => {
    if (look.current || input.current.dropQueued) return;
    const current = input.current.weapon;
    const gesture: GestureAction | null = tool === 'torch' ? { kind: 'cut', target: event.currentTarget }
      : current.kind === 'idle' ? { kind: 'grab', target: event.currentTarget }
      : current.kind === 'holding' ? { kind: 'throw', bodyId: current.bodyId, target: event.currentTarget } : null;
    if (!gesture || !accept(event, gesture)) return;
    startLook(event);
    if (gesture.kind === 'cut') queueTouchCut(input.current);
    else if (gesture.kind === 'grab') setTouchWeapon(input.current, { kind: 'grab-pending', afterFeedbackFrame: input.current.feedbackFrame });
  };
  const actionButton = (kind: 'push' | 'drop' | 'jetpack' | 'use', label: string, main = false, caption?: string) => (
    <button type="button" className={`yard-touch-action yard-touch-action--${kind}${main ? ' yard-touch-action--main' : ''}`} aria-label={label}
      disabled={(kind === 'push' || kind === 'drop') && busy}
      onPointerDown={(event) => {
        if (!accept(event, { kind, target: event.currentTarget })) return;
        if (kind === 'jetpack') { input.current.jetpack = true; if (!look.current) startLook(event); }
        if (kind === 'use') { input.current.use = true; input.current.useQueued = true; }
      }} onPointerMove={kind === 'jetpack' ? moveLook : undefined} {...releaseHandlers} onContextMenu={(event) => event.preventDefault()}><span>{label}</span>{caption ? <small>{caption}</small> : null}</button>
  );
  if (!live) return null;
  return (
    <div ref={root} className="yard-touch" aria-label="Touch controls">
      <div className="yard-touch-look" aria-label="Look pad"
        onPointerDown={(event) => { if (!look.current && accept(event, { kind: 'look', target: event.currentTarget })) startLook(event); }}
        onPointerMove={moveLook} {...releaseHandlers}>
        {!lookLearned ? <span>Drag to look</span> : null}
      </div>
      <div className="yard-touch-move" aria-label={riding ? 'Drive pad' : 'Move pad'}
        onPointerDown={(event) => {
          if (!accept(event, { kind: 'move', target: event.currentTarget })) return;
          stick.current.onTouchStart('left', { x: event.clientX, y: event.clientY }, event.pointerId);
          const area = event.currentTarget.getBoundingClientRect();
          if (ring.current) {
            ring.current.style.left = `${event.clientX - area.left - 53}px`;
            ring.current.style.top = `${event.clientY - area.top - 53}px`;
            ring.current.style.bottom = 'auto'; ring.current.dataset.active = 'true';
          }
        }}
        onPointerMove={(event) => {
          if (gestures.current.get(event.pointerId)?.kind !== 'move') return;
          stick.current.onTouchMove(event.pointerId, { x: event.clientX, y: event.clientY });
          const vector = stick.current.vector('left');
          input.current.moveX = touchAxis(vector.x); input.current.moveZ = touchAxis(-vector.y);
          if (knob.current) knob.current.style.transform = `translate(${vector.x * STICK_RADIUS}px, ${vector.y * STICK_RADIUS}px)`;
        }} {...releaseHandlers}>
        <div ref={ring} className="yard-touch-stick"><span ref={knob} /></div>
      </div>
      <div className="yard-touch-actions">
        {riding ? actionButton('use', 'Exit', true, 'Buggy') : <>
          <button type="button" className="yard-touch-action yard-touch-action--main" aria-label={tool === 'torch' ? 'Cut' : holding ? 'Throw' : 'Grab'}
            aria-busy={busy} aria-disabled={busy} onPointerDown={startPrimary} onPointerMove={moveLook} {...releaseHandlers}
            onContextMenu={(event) => event.preventDefault()}>
            <span>{tool === 'torch' ? 'Cut' : holding ? 'Throw' : 'Grab'}</span><small>{tool === 'torch' ? 'Torch' : holding ? 'Release to throw' : 'Gravity'}</small>
          </button>
          {tool === 'hand' ? actionButton(holding ? 'drop' : 'push', holding ? 'Drop' : 'Push') : null}
          {actionButton('jetpack', 'Jet')}
          <button type="button" className="yard-touch-action yard-touch-action--swap" aria-label={tool === 'torch' ? 'Equip gravity gun' : 'Equip torch'}
            onPointerDown={(event) => accept(event, { kind: 'swap', target: event.currentTarget })} {...releaseHandlers}>
            <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {tool === 'torch' ? <><path d="M7 8v10a9 9 0 0 0 18 0V8M7 8h5v10a4 4 0 0 0 8 0V8h5M7 6h5M20 6h5" /></>
                : <><path d="M6 27l11-11 5 5-11 11M17 16l5-5M22 11l-1-7c7 2 10 5 6 9-2 2-4 0-5-2Z" /></>}
            </svg><small>{tool === 'torch' ? 'Gravity' : 'Torch'}</small>
          </button>
        </>}
      </div>
      {!riding && useLabel ? <div className="yard-touch-context">{actionButton('use', 'Use', false, useLabel)}</div> : null}
    </div>
  );
}
