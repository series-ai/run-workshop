import { describe, expect, it } from 'vitest';
import {
  cursorNeededNow,
  engageCall,
  fullscreenToggleCall,
  initialGate,
  inputLive,
  reduceGate,
  soloPaused,
  type GateEffect,
  type GateEvent,
  type GateState,
  type SurfaceCaps,
  type SurfaceState,
} from './playGate';

const DESKTOP: SurfaceCaps = { fullscreen: 'toggleable', pointerLock: true };
const DECK: SurfaceCaps = { fullscreen: 'always-on', pointerLock: true };
const PHONE: SurfaceCaps = { fullscreen: 'unavailable', pointerLock: false };
const MOBILE_WEB: SurfaceCaps = { fullscreen: 'toggleable', pointerLock: false };

const WINDOWED: SurfaceState = { active: false, pointerLocked: false };
const FULL_FREE: SurfaceState = { active: true, pointerLocked: false };
const FULL_LOCKED: SurfaceState = { active: true, pointerLocked: true };

/** Applies events in order; returns the last state and every effect. */
function run(start: GateState, ...events: GateEvent[]): { state: GateState; effects: GateEffect[] } {
  let state = start;
  const effects: GateEffect[] = [];
  for (const event of events) {
    const next = reduceGate(state, event);
    state = next.state;
    effects.push(...next.effects);
  }
  return { state, effects };
}

/** A desktop gate whose match is live (the app reports cursor-needed off once the solo match runs). */
const liveDesktop = () => run(initialGate(DESKTOP, WINDOWED), { type: 'cursor-needed', on: false }).state;
/** Desktop, captured and playing. */
const playingDesktop = () => run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'engaged', requestId: 1, state: FULL_LOCKED }).state;

describe('initial gate', () => {
  it('starts at the gate on a surface that can capture, and plays at once on one that cannot', () => {
    expect(initialGate(DESKTOP, WINDOWED)).toMatchObject({ look: 'capture', view: 'start', hasPlayed: false });
    expect(initialGate(DECK, FULL_FREE)).toMatchObject({ look: 'capture', view: 'start' });
    expect(initialGate(PHONE, WINDOWED)).toMatchObject({ look: 'drag', view: 'playing' });
    expect(initialGate(MOBILE_WEB, WINDOWED)).toMatchObject({ look: 'drag', view: 'playing' });
  });

  it('treats the match as needing the cursor until the app says otherwise', () => {
    const gate = initialGate(DESKTOP, WINDOWED);
    expect(cursorNeededNow(gate)).toBe(true);
    expect(engageCall(gate)).toBe('none');
    expect(cursorNeededNow(liveDesktop())).toBe(false);
  });
});

describe('engaging', () => {
  it('enters fullscreen with capture when windowed, and only captures when already fullscreen or always-on', () => {
    expect(engageCall(liveDesktop())).toBe('request-fullscreen-lock');
    const fullscreen = run(liveDesktop(), { type: 'surface', state: FULL_FREE }).state;
    expect(engageCall(fullscreen)).toBe('lock');
    const deck = run(initialGate(DECK, FULL_FREE), { type: 'cursor-needed', on: false }).state;
    expect(engageCall(deck)).toBe('lock');
    expect(engageCall(initialGate(PHONE, WINDOWED))).toBe('none');
  });

  it('plays after a confirmed capture and marks the player as having played', () => {
    const { state } = run(liveDesktop(), { type: 'engage', requestId: 1 });
    expect(state).toMatchObject({ view: 'engaging', requestId: 1, engagedFrom: 'start' });
    const done = run(state, { type: 'engaged', requestId: 1, state: FULL_LOCKED }).state;
    expect(done).toMatchObject({ view: 'playing', hasPlayed: true, requestId: 0, engagedFrom: null, notice: null });
    expect(inputLive(done)).toBe(true);
  });

  it('ignores a second engage while one request runs', () => {
    const { state } = run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'engage', requestId: 2 });
    expect(state.requestId).toBe(1);
    expect(engageCall(state)).toBe('none');
  });

  it('drops a result for an old request', () => {
    const { state } = run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'engaged', requestId: 9, state: FULL_LOCKED });
    expect(state.view).toBe('engaging');
  });

  it('goes back to where it came from with a notice when the capture is refused, and counts the attempts', () => {
    const first = run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'engaged', requestId: 1, state: WINDOWED }).state;
    expect(first).toMatchObject({ view: 'start', notice: { kind: 'refused', attempts: 1 } });
    const second = run(first, { type: 'engage', requestId: 2 }, { type: 'engaged', requestId: 2, state: WINDOWED, reason: 'refused' }).state;
    expect(second.notice).toEqual({ kind: 'refused', attempts: 2 });
  });

  it('reports capture as unavailable for unsupported, timeout, and not-owner', () => {
    for (const reason of ['unsupported', 'timeout', 'not-owner'] as const) {
      const { state } = run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'engaged', requestId: 1, state: WINDOWED, reason });
      expect(state.notice?.kind).toBe('unavailable');
    }
  });

  it('treats not-fullscreen as windowed, so the next click enters fullscreen again', () => {
    const paused = run(playingDesktop(), { type: 'surface', state: FULL_FREE }).state;
    const { state } = run(paused, { type: 'engage', requestId: 2 }, { type: 'engaged', requestId: 2, state: FULL_FREE, reason: 'not-fullscreen' });
    expect(state).toMatchObject({ view: 'paused', surface: WINDOWED, notice: { kind: 'refused' } });
    expect(engageCall(state)).toBe('request-fullscreen-lock');
  });
});

describe('pausing and resuming', () => {
  it('pauses when the cursor comes free, whatever the cause, and clears held input', () => {
    for (const surface of [FULL_FREE, WINDOWED]) {
      const { state, effects } = run(playingDesktop(), { type: 'surface', state: surface });
      expect(state.view).toBe('paused');
      expect(effects).toContain('clear-input');
      expect(inputLive(state)).toBe(false);
    }
  });

  it('resumes with a lock while fullscreen, and with fullscreen while windowed', () => {
    const fullscreen = run(playingDesktop(), { type: 'surface', state: FULL_FREE }).state;
    expect(engageCall(fullscreen)).toBe('lock');
    const windowed = run(fullscreen, { type: 'surface', state: WINDOWED }).state;
    expect(windowed.view).toBe('paused');
    expect(engageCall(windowed)).toBe('request-fullscreen-lock');
    const resumed = run(windowed, { type: 'engage', requestId: 5 }, { type: 'engaged', requestId: 5, state: FULL_LOCKED }).state;
    expect(resumed.view).toBe('playing');
  });

  it('plays when the host captures by itself', () => {
    const paused = run(playingDesktop(), { type: 'surface', state: FULL_FREE }).state;
    expect(run(paused, { type: 'surface', state: FULL_LOCKED }).state.view).toBe('playing');
    const atStart = run(liveDesktop(), { type: 'surface', state: FULL_LOCKED }).state;
    expect(atStart).toMatchObject({ view: 'playing', hasPlayed: true });
  });

  it('pauses solo only after first play, and while paused or resuming', () => {
    expect(soloPaused(liveDesktop())).toBe(false);
    expect(soloPaused(playingDesktop())).toBe(false);
    const paused = run(playingDesktop(), { type: 'surface', state: FULL_FREE }).state;
    expect(soloPaused(paused)).toBe(true);
    expect(soloPaused(run(paused, { type: 'engage', requestId: 3 }).state)).toBe(true);
  });

  it('keeps solo paused after a match-button capture is refused', () => {
    const paused = run(playingDesktop(), { type: 'surface', state: FULL_FREE }).state;
    const { state } = run(
      paused,
      { type: 'cursor-needed', on: true },
      { type: 'match-start' },
      { type: 'engage', requestId: 4 },
      { type: 'engaged', requestId: 4, state: FULL_FREE, reason: 'refused' },
      { type: 'match-settled' },
      { type: 'cursor-needed', on: false },
    );
    expect(state.view).toBe('paused');
    expect(soloPaused(state)).toBe(true);
  });
});

describe('the orbit tool', () => {
  it('frees the cursor without the pause menu, and asks for a click after it', () => {
    const { state, effects } = run(playingDesktop(), { type: 'orbit', on: true });
    expect(state.view).toBe('free-cursor');
    expect(effects).toContain('release-pointer');
    const unlocked = run(state, { type: 'surface', state: FULL_FREE }).state;
    expect(unlocked.view).toBe('free-cursor');
    expect(inputLive(unlocked)).toBe(true);
    const back = run(unlocked, { type: 'orbit', on: false }).state;
    expect(back).toMatchObject({ view: 'free-cursor', orbit: false });
    expect(engageCall(back)).toBe('lock');
    const engaged = run(back, { type: 'engage', requestId: 7 }, { type: 'engaged', requestId: 7, state: FULL_LOCKED }).state;
    expect(engaged.view).toBe('playing');
  });

  it('ignores the orbit tool behind the gate and the pause menu', () => {
    const paused = run(playingDesktop(), { type: 'surface', state: FULL_FREE }).state;
    expect(run(paused, { type: 'orbit', on: true }).state).toEqual(paused);
    expect(run(liveDesktop(), { type: 'orbit', on: true }).state).toEqual(liveDesktop());
  });
});

describe('match menu and error modal', () => {
  it('moves the view at once, frees the cursor, and hides the gate', () => {
    const { state, effects } = run(playingDesktop(), { type: 'cursor-needed', on: true });
    expect(state.view).toBe('paused');
    expect(effects).toEqual(expect.arrayContaining(['release-pointer', 'clear-input']));
    expect(cursorNeededNow(state)).toBe(true);
    expect(soloPaused(state)).toBe(false);
    expect(engageCall(state)).toBe('none');
  });

  it('ends a running request and drops its late result', () => {
    const { state } = run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'cursor-needed', on: true }, { type: 'engaged', requestId: 1, state: FULL_LOCKED });
    expect(state).toMatchObject({ view: 'start', requestId: 0 });
  });

  it('releases a capture that arrives while the cursor is needed', () => {
    const needed = run(playingDesktop(), { type: 'cursor-needed', on: true }).state;
    const { effects } = run(needed, { type: 'surface', state: FULL_LOCKED });
    expect(effects).toContain('release-pointer');
  });

  it('keeps a match-button capture through "connecting", then plays', () => {
    const needed = run(playingDesktop(), { type: 'cursor-needed', on: true }).state;
    const { state, effects } = run(
      needed,
      { type: 'match-start' },
      { type: 'engage', requestId: 2 },
      { type: 'engaged', requestId: 2, state: FULL_LOCKED },
    );
    expect(effects).not.toContain('release-pointer');
    expect(state.view).toBe('playing');
    const live = run(state, { type: 'cursor-needed', on: false }, { type: 'match-settled' });
    expect(live.state.view).toBe('playing');
    expect(live.effects).not.toContain('release-pointer');
  });

  it('returns the menu to the player when the started match fails', () => {
    const starting = run(playingDesktop(), { type: 'cursor-needed', on: true }, { type: 'match-start' }, { type: 'engage', requestId: 2 }, { type: 'engaged', requestId: 2, state: FULL_LOCKED }).state;
    const { state, effects } = run(starting, { type: 'match-settled' });
    expect(cursorNeededNow(state)).toBe(true);
    expect(state.view).toBe('paused');
    expect(effects).toContain('release-pointer');
  });

  it('does not change the view when the menu closes', () => {
    const needed = run(liveDesktop(), { type: 'cursor-needed', on: true }).state;
    expect(run(needed, { type: 'cursor-needed', on: false }).state.view).toBe('start');
  });

  it('never shows a gate on a surface that cannot capture', () => {
    const phone = run(initialGate(PHONE, WINDOWED), { type: 'cursor-needed', on: false }, { type: 'cursor-needed', on: true }, { type: 'cursor-needed', on: false }).state;
    expect(phone.view).toBe('playing');
  });
});

describe('drag-look', () => {
  it('lets the player give up on capture, and take it back', () => {
    const refused = run(liveDesktop(), { type: 'engage', requestId: 1 }, { type: 'engaged', requestId: 1, state: WINDOWED }).state;
    const drag = run(refused, { type: 'choose-drag' }).state;
    expect(drag).toMatchObject({ look: 'drag', view: 'playing', notice: null });
    expect(inputLive(drag)).toBe(true);
    const capture = run(drag, { type: 'choose-capture' }).state;
    expect(capture).toMatchObject({ look: 'capture', view: 'paused' });
    expect(engageCall(capture)).toBe('request-fullscreen-lock');
  });

  it('ignores surface changes in drag mode', () => {
    const phone = run(initialGate(MOBILE_WEB, WINDOWED), { type: 'cursor-needed', on: false }).state;
    const fullscreen = run(phone, { type: 'surface', state: FULL_FREE }).state;
    expect(fullscreen).toMatchObject({ view: 'playing', surface: FULL_FREE });
  });

  it('gives mobile web a fullscreen toggle without a lock', () => {
    const phone = run(initialGate(MOBILE_WEB, WINDOWED), { type: 'cursor-needed', on: false }).state;
    expect(fullscreenToggleCall(phone)).toBe('request-fullscreen');
    expect(fullscreenToggleCall(run(phone, { type: 'surface', state: FULL_FREE }).state)).toBe('exit-fullscreen');
    expect(fullscreenToggleCall(liveDesktop())).toBe('none');
    expect(fullscreenToggleCall(initialGate(PHONE, WINDOWED))).toBe('none');
  });
});
