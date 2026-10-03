import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserPort,
  CAPTURE_TIMEOUT_MS,
  fakePort,
  hostPort,
  selectCapturePort,
  type FakeCapturePort,
  type HostSystemLike,
  type PortPointerInput,
} from './capturePort';
import type { SurfaceState } from './playGate';

afterEach(() => { vi.useRealTimers(); });

function stubSystem(overrides: Partial<HostSystemLike> = {}): HostSystemLike & { pointer?: (input: never) => void } {
  const stub: HostSystemLike & { pointer?: (input: never) => void } = {
    getEnvironment: () => ({ capabilities: { fullscreen: 'toggleable', pointerLock: true } }),
    requestFullscreen: async () => ({ active: true, pointerLocked: true }),
    exitFullscreen: async () => ({ active: false, pointerLocked: false }),
    setPointerLock: async (locked) => ({ active: true, pointerLocked: locked }),
    getFullscreenState: async () => ({ active: false, pointerLocked: false }),
    onFullscreenStateChange: () => () => {},
    onPointerInput: (listener) => { stub.pointer = listener as never; return () => {}; },
    ...overrides,
  };
  return stub;
}

describe('host port', () => {
  it('reads the caps from the SDK environment', () => {
    expect(hostPort(stubSystem()).caps).toEqual({ fullscreen: 'toggleable', pointerLock: true });
  });

  it('reports a timeout when requestFullscreen ran into the SDK limit, which gives no reason', async () => {
    let clock = 0;
    const system = stubSystem({ requestFullscreen: async () => { clock += 5000; return { active: false, pointerLocked: false }; } });
    const result = await hostPort(system, () => clock).requestFullscreen({ pointerLock: true });
    expect(result.reason).toBe('timeout');
  });

  it('reports a quick failure as refused', async () => {
    const system = stubSystem({ requestFullscreen: async () => ({ active: false, pointerLocked: false }) });
    expect((await hostPort(system, () => 0).requestFullscreen({ pointerLock: true })).reason).toBe('refused');
  });

  it('passes on setPointerLock reasons', async () => {
    const system = stubSystem({ setPointerLock: async () => ({ active: true, pointerLocked: false, reason: 'not-owner' }) });
    expect(await hostPort(system).setPointerLock(true)).toEqual({ active: true, pointerLocked: false, reason: 'not-owner' });
  });

  it('forwards look and buttons, and drops the wheel', () => {
    const system = stubSystem();
    const seen: PortPointerInput[] = [];
    hostPort(system).onPointer!((input) => seen.push(input));
    const send = system.pointer as unknown as (input: unknown) => void;
    send({ type: 'move', movementX: 3, movementY: -2, buttons: 0 });
    send({ type: 'button', button: 2, buttons: 2, pressed: true });
    send({ type: 'wheel', deltaX: 0, deltaY: 1, deltaZ: 0, deltaMode: 0 });
    expect(seen).toEqual([{ type: 'move', movementX: 3, movementY: -2 }, { type: 'button', button: 2, pressed: true }]);
  });
});

/** A document with only what the browser port touches. */
function fakeDocument(behavior: { lock: 'grant' | 'error' | 'silent'; fullscreen: 'grant' | 'deny' }) {
  const doc = new EventTarget() as EventTarget & {
    fullscreenElement: unknown; pointerLockElement: unknown; fullscreenEnabled: boolean;
    documentElement: { requestFullscreen(): Promise<void> }; exitFullscreen(): Promise<void>; exitPointerLock(): void;
  };
  const canvas = {
    requestPointerLock() {
      if (behavior.lock === 'grant') queueMicrotask(() => { doc.pointerLockElement = canvas; doc.dispatchEvent(new Event('pointerlockchange')); });
      if (behavior.lock === 'error') queueMicrotask(() => doc.dispatchEvent(new Event('pointerlockerror')));
      return undefined;
    },
  };
  doc.fullscreenElement = null;
  doc.pointerLockElement = null;
  doc.fullscreenEnabled = true;
  doc.documentElement = {
    async requestFullscreen() {
      if (behavior.fullscreen === 'deny') throw new Error('denied');
      doc.fullscreenElement = doc.documentElement;
      doc.dispatchEvent(new Event('fullscreenchange'));
    },
  };
  doc.exitFullscreen = async () => { doc.fullscreenElement = null; doc.dispatchEvent(new Event('fullscreenchange')); };
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatchEvent(new Event('pointerlockchange')); };
  return { doc, canvas };
}

const browser = (behavior: Parameters<typeof fakeDocument>[0]) => {
  const { doc, canvas } = fakeDocument(behavior);
  return { doc, port: browserPort(() => canvas as unknown as HTMLElement, doc as unknown as Document) };
};

describe('browser port', () => {
  it('enters fullscreen and captures in one request', async () => {
    const { port } = browser({ lock: 'grant', fullscreen: 'grant' });
    const states: SurfaceState[] = [];
    port.onState((state) => states.push(state));
    expect(await port.requestFullscreen({ pointerLock: true })).toEqual({ active: true, pointerLocked: true });
    expect(states.at(-1)).toEqual({ active: true, pointerLocked: true });
  });

  it('still reports changes after an unsubscribe and a new subscribe (React StrictMode)', async () => {
    const { port, doc } = browser({ lock: 'grant', fullscreen: 'grant' });
    port.onState(() => {})();
    const states: SurfaceState[] = [];
    port.onState((state) => states.push(state));
    await port.requestFullscreen({ pointerLock: true });
    doc.exitPointerLock();
    expect(states.at(-1)).toEqual({ active: true, pointerLocked: false });
  });

  it('is all or nothing: a refused lock leaves fullscreen again', async () => {
    const { port, doc } = browser({ lock: 'error', fullscreen: 'grant' });
    expect(await port.requestFullscreen({ pointerLock: true })).toEqual({ active: false, pointerLocked: false, reason: 'refused' });
    expect(doc.fullscreenElement).toBeNull();
  });

  it('reports a refused fullscreen', async () => {
    const { port } = browser({ lock: 'grant', fullscreen: 'deny' });
    expect((await port.requestFullscreen({ pointerLock: true })).reason).toBe('refused');
  });

  it('gives up on a lock that never answers', async () => {
    vi.useFakeTimers();
    const { port } = browser({ lock: 'silent', fullscreen: 'grant' });
    const pending = port.requestFullscreen({ pointerLock: true });
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS + 10);
    expect((await pending).reason).toBe('timeout');
  });

  it('captures again only while fullscreen, like the host', async () => {
    const { port } = browser({ lock: 'grant', fullscreen: 'grant' });
    expect((await port.setPointerLock(true)).reason).toBe('not-fullscreen');
    await port.requestFullscreen({ pointerLock: false });
    expect(await port.setPointerLock(true)).toEqual({ active: true, pointerLocked: true });
    expect(await port.setPointerLock(false)).toEqual({ active: true, pointerLocked: false });
  });
});

function fakeWindow(options: { search?: string; framed?: boolean; nativeView?: boolean } = {}): Window {
  const win: Record<string, unknown> = { location: { search: options.search ?? '' }, document: fakeDocument({ lock: 'grant', fullscreen: 'grant' }).doc };
  win.self = win;
  win.top = options.framed ? {} : win;
  if (options.nativeView) win.ReactNativeWebView = {};
  return win as unknown as Window;
}
const context = (win: Window, sdk: { sdkReady: boolean; isMock: boolean }) => ({ ...sdk, system: stubSystem(), win, lockTarget: () => null });

describe('port selection', () => {
  it('honours ?capture in every build, and puts the fake on window', () => {
    expect(selectCapturePort(context(fakeWindow({ search: '?capture=off' }), { sdkReady: true, isMock: false })).kind).toBe('none');
    const win = fakeWindow({ search: '?capture=fake' });
    const port = selectCapturePort(context(win, { sdkReady: true, isMock: false }));
    expect(port.kind).toBe('fake');
    expect((win as unknown as { __CAPTURE_FAKE__: FakeCapturePort }).__CAPTURE_FAKE__).toBe(port);
  });

  it('uses the host when the SDK works and is not the mock', () => {
    expect(selectCapturePort(context(fakeWindow({ framed: true }), { sdkReady: true, isMock: false })).kind).toBe('host');
  });

  it('never uses DOM fullscreen inside a host whose SDK does not work', () => {
    for (const win of [fakeWindow({ framed: true }), fakeWindow({ search: '?_pid=abc' }), fakeWindow({ nativeView: true })]) {
      expect(selectCapturePort(context(win, { sdkReady: false, isMock: false })).kind).toBe('none');
      expect(selectCapturePort(context(win, { sdkReady: true, isMock: true })).kind).toBe('none');
    }
  });

  it('uses the browser at top level outside a host (local dev, plain browser)', () => {
    expect(selectCapturePort(context(fakeWindow(), { sdkReady: true, isMock: true })).kind).toBe('browser');
    expect(selectCapturePort(context(fakeWindow(), { sdkReady: false, isMock: false })).kind).toBe('browser');
  });
});

describe('fake port', () => {
  it('captures by default, and answers a set result once', async () => {
    const port = fakePort();
    expect(await port.requestFullscreen({ pointerLock: true })).toEqual({ active: true, pointerLocked: true });
    port.respond({ active: true, pointerLocked: false, reason: 'refused' });
    expect((await port.setPointerLock(true)).reason).toBe('refused');
    expect(port.calls).toEqual(['requestFullscreen:true', 'setPointerLock:true']);
  });
});
