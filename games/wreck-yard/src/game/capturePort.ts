import type { CaptureFailure, FullscreenCapability, SurfaceCaps, SurfaceState } from './playGate';

/**
 * One interface over the surfaces that can (or cannot) go fullscreen and
 * capture the mouse. Inside RUN.world the game is a frame, and only the host
 * may do either: the host port uses the RUN SDK System API. At top level (local
 * dev, a plain browser) the browser port uses the DOM APIs with the same
 * all-or-nothing contract, so dev play behaves like the platform.
 */

/** Look and buttons while the HOST owns the lock. The wheel is not used. */
export type PortPointerInput =
  | { readonly type: 'move'; readonly movementX: number; readonly movementY: number }
  | { readonly type: 'button'; readonly button: number; readonly pressed: boolean };

export type CaptureResult = SurfaceState & { readonly reason?: CaptureFailure };

export interface CapturePort {
  readonly kind: 'host' | 'browser' | 'none';
  readonly caps: SurfaceCaps;
  getState(): Promise<SurfaceState>;
  /** Needs a gesture: await it FIRST in a click handler. */
  requestFullscreen(options: { readonly pointerLock: boolean }): Promise<CaptureResult>;
  /** true needs a gesture; false does not. */
  setPointerLock(locked: boolean): Promise<CaptureResult>;
  exitFullscreen(): Promise<SurfaceState>;
  /** Subscribing is the only lifecycle: a port holds no resources without listeners. */
  onState(listener: (state: SurfaceState) => void): () => void;
  /** Null: the caller reads DOM mouse events itself. */
  readonly onPointer: ((listener: (input: PortPointerInput) => void) => () => void) | null;
}

const WINDOWED: SurfaceState = { active: false, pointerLocked: false };
/** Both adapters give up after this long; the SDK's own mutation timeout is 5 s. */
export const CAPTURE_TIMEOUT_MS = 5000;
/** A host requestFullscreen this slow hit the SDK timeout, which reports no reason. */
const HOST_TIMEOUT_GUESS_MS = 4900;

const surface = (state: { readonly active: boolean; readonly pointerLocked: boolean }): SurfaceState => ({
  active: state.active === true,
  pointerLocked: state.pointerLocked === true,
});

// ---------------------------------------------------------------------------
// Host (RUN SDK)

/** The part of RundotAPI.system the host port uses. */
export interface HostSystemLike {
  getEnvironment(): { readonly capabilities: { readonly fullscreen: FullscreenCapability; readonly pointerLock: boolean } };
  requestFullscreen(options?: { pointerLock?: boolean }): Promise<SurfaceState>;
  exitFullscreen(): Promise<SurfaceState>;
  setPointerLock(locked: boolean): Promise<SurfaceState & { reason?: CaptureFailure }>;
  getFullscreenState(): Promise<SurfaceState>;
  onFullscreenStateChange(listener: (state: SurfaceState) => void): () => void;
  onPointerInput(listener: (input:
    | { type: 'move'; movementX: number; movementY: number }
    | { type: 'button'; button: number; pressed: boolean }
    | { type: 'wheel' }) => void): () => void;
}

export function hostPort(system: HostSystemLike, now: () => number = () => performance.now()): CapturePort {
  const { capabilities } = system.getEnvironment();
  return {
    kind: 'host',
    caps: { fullscreen: capabilities.fullscreen, pointerLock: capabilities.pointerLock },
    getState: async () => surface(await system.getFullscreenState()),
    async requestFullscreen(options) {
      const started = now();
      const state = surface(await system.requestFullscreen({ pointerLock: options.pointerLock }));
      if (!state.active && now() - started >= HOST_TIMEOUT_GUESS_MS) return { ...state, reason: 'timeout' };
      if (options.pointerLock && !state.pointerLocked) return { ...state, reason: 'refused' };
      return state;
    },
    async setPointerLock(locked) {
      const result = await system.setPointerLock(locked);
      return result.reason ? { ...surface(result), reason: result.reason } : surface(result);
    },
    exitFullscreen: async () => surface(await system.exitFullscreen()),
    onState: (listener) => system.onFullscreenStateChange((state) => listener(surface(state))),
    onPointer: (listener) => system.onPointerInput((input) => {
      if (input.type === 'move') listener({ type: 'move', movementX: input.movementX, movementY: input.movementY });
      else if (input.type === 'button') listener({ type: 'button', button: input.button, pressed: input.pressed });
    }),
  };
}

// ---------------------------------------------------------------------------
// Browser (DOM, top level only)

export function browserPort(lockTarget: () => HTMLElement | null, doc: Document = document): CapturePort {
  const listeners = new Set<(state: SurfaceState) => void>();
  const read = (): SurfaceState => ({
    active: doc.fullscreenElement !== null,
    pointerLocked: doc.pointerLockElement !== null && doc.pointerLockElement === lockTarget(),
  });
  let last = read();
  const emit = () => {
    const next = read();
    if (next.active === last.active && next.pointerLocked === last.pointerLocked) return;
    last = next;
    for (const listener of listeners) listener(next);
  };

  /** Settles on the first lock event, a rejected promise, or the timeout. Safari's requestPointerLock returns no promise. */
  const lock = (target: HTMLElement): Promise<CaptureResult> => new Promise((resolve) => {
    let settled = false;
    const finish = (result: CaptureResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      doc.removeEventListener('pointerlockchange', onChange);
      doc.removeEventListener('pointerlockerror', onError);
      resolve(result);
    };
    const onChange = () => { if (doc.pointerLockElement === target) finish(read()); };
    const onError = () => finish({ ...read(), reason: 'refused' });
    const timer = setTimeout(() => finish({ ...read(), reason: 'timeout' }), CAPTURE_TIMEOUT_MS);
    doc.addEventListener('pointerlockchange', onChange);
    doc.addEventListener('pointerlockerror', onError);
    try {
      const pending = target.requestPointerLock() as unknown as Promise<void> | undefined;
      pending?.catch?.(() => finish({ ...read(), reason: 'refused' }));
    } catch {
      finish({ ...read(), reason: 'refused' });
    }
  });

  const withTimeout = <T,>(promise: Promise<T>): Promise<T | 'timeout'> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), CAPTURE_TIMEOUT_MS);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });

  const canLock = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.requestPointerLock === 'function';
  return {
    kind: 'browser',
    caps: { fullscreen: doc.fullscreenEnabled ? 'toggleable' : 'unavailable', pointerLock: canLock },
    getState: async () => read(),
    async requestFullscreen(options) {
      const target = lockTarget();
      if (options.pointerLock && !target) return { ...read(), reason: 'unsupported' };
      // Both requests start in this call, while the click's activation is fresh. The lock
      // goes first: Chrome's requestFullscreen consumes the activation, and a lock request
      // after it fails with "A user gesture is required" (seen in about 1 of 4 tries).
      const locking = options.pointerLock && target ? lock(target) : null;
      const entering = doc.fullscreenElement ? Promise.resolve() : doc.documentElement.requestFullscreen();
      try {
        if ((await withTimeout(entering)) === 'timeout') return { ...read(), reason: 'timeout' };
      } catch {
        return { ...read(), reason: 'refused' };
      }
      if (!locking) return read();
      const locked = await locking;
      if (locked.pointerLocked) return read();
      // All or nothing, like the host: no fullscreen with a free cursor here.
      if (doc.fullscreenElement) await doc.exitFullscreen().catch(() => {});
      return { ...read(), reason: locked.reason ?? 'refused' };
    },
    async setPointerLock(locked) {
      const target = lockTarget();
      if (!locked) {
        if (doc.pointerLockElement) doc.exitPointerLock();
        return read();
      }
      if (!target) return { ...read(), reason: 'unsupported' };
      if (!doc.fullscreenElement) return { ...read(), reason: 'not-fullscreen' };
      return lock(target);
    },
    async exitFullscreen() {
      if (doc.fullscreenElement) await doc.exitFullscreen().catch(() => {});
      return read();
    },
    onState(listener) {
      // Document listeners live exactly as long as a subscriber (React may subscribe, unsubscribe, and subscribe again).
      if (listeners.size === 0) {
        last = read();
        doc.addEventListener('fullscreenchange', emit);
        doc.addEventListener('pointerlockchange', emit);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          doc.removeEventListener('fullscreenchange', emit);
          doc.removeEventListener('pointerlockchange', emit);
        }
      };
    },
    onPointer: null,
  };
}

export function noCapturePort(): CapturePort {
  return {
    kind: 'none',
    caps: { fullscreen: 'unavailable', pointerLock: false },
    getState: async () => WINDOWED,
    requestFullscreen: async () => ({ ...WINDOWED, reason: 'unsupported' }),
    setPointerLock: async () => ({ ...WINDOWED, reason: 'unsupported' }),
    exitFullscreen: async () => WINDOWED,
    onState: () => () => {},
    onPointer: null,
  };
}

// ---------------------------------------------------------------------------
// Selection

export interface CapturePortContext {
  /** RundotAPI.initializeAsync() finished. */
  readonly sdkReady: boolean;
  /** RundotAPI.isMock(): the playground or mock host, whose System API does nothing. */
  readonly isMock: boolean;
  readonly system: HostSystemLike | null;
  readonly win: Window;
  readonly lockTarget: () => HTMLElement | null;
}

export function selectCapturePort(context: CapturePortContext): CapturePort {
  const { win } = context;
  const params = new URLSearchParams(win.location.search);
  if (context.sdkReady && !context.isMock && context.system) return hostPort(context.system);
  const framed = (() => {
    try {
      return win.self !== win.top;
    } catch {
      return true;
    }
  })();
  const hosted = typeof (win as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView !== 'undefined'
    || params.has('_pid') || framed;
  if (hosted) return noCapturePort();
  return browserPort(context.lockTarget, win.document);
}
