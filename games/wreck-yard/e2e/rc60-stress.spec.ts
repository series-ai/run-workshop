import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { loadavg, freemem, totalmem } from 'node:os';
import {
  createSnapshotTransferCollector,
  decodeDeterministicLocalAuthorityWireEnvelope,
  decodeDeterministicSessionMessage,
  decodeDeterministicStateSnapshot,
  type SyncplayRunnerSnapshot,
} from '@series-inc/rundot-syncplay/browser';
import type { MatchController } from '../src/game/match';
import type { YardRender } from '../src/render/presentation';

type Snapshot = SyncplayRunnerSnapshot<YardRender>;
type ProbeController = Pick<MatchController, 'snapshot' | 'getRender' | 'sampledInput'> & {
  runner: { readonly ready: boolean; readonly appliedThrough: number; readonly predictedThrough: number; readonly netStats: Snapshot['netStats']; subscribe(listener: (snapshot: Snapshot) => void): () => void };
};
type BrowserAudit = { read(): unknown; stop(): unknown };
type AuditWindow = { __WRECK_YARD_CONTROLLER__: ProbeController; __RC60_AUDIT__?: BrowserAudit;
  __THREE_RENDERER__?: { getContext(): WebGLRenderingContext } };
type Metadata = Record<string, unknown>;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sessionText(payload: string | Buffer): string | undefined {
  let value: unknown = payload.toString();
  for (let depth = 0; depth < 5; depth++) {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return undefined; }
    }
    if (!object(value)) return undefined;
    if (value.protocol === 'rdm-local-authority/v2') return JSON.stringify(value);
    value = value.data ?? value.payload;
  }
  return undefined;
}

function resourceAddress(value: string) {
  try { const url = new URL(value); return { origin: url.origin, path: url.pathname }; }
  catch { return { origin: null, path: null }; }
}

function safeConsoleText(value: string) {
  return value.replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/g, address => {
    const source = resourceAddress(address);
    return source.origin === null ? '[invalid URL]' : `${source.origin}${source.path}`;
  }).slice(0, 1000);
}

function observeWire(page: Page, peer: string) {
  const started = Date.now();
  const events: Metadata[] = [];
  const bins = new Map<number, Metadata>();
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const resourceErrors: Metadata[] = [];
  let droppedResourceErrors = 0;
  const recordResourceError = (entry: Metadata) => {
    if (resourceErrors.length < 200) resourceErrors.push({ atMs: Date.now() - started, ...entry });
    else droppedResourceErrors++;
  };
  const origins = new Set<string>();
  let slot = -1;
  let authorityTick = -1;
  let confirmedThrough = -1;
  let droppedEvents = 0;
  const record = (entry: Metadata) => {
    if (events.length < 2000) events.push({ atMs: Date.now() - started, ...entry });
    else droppedEvents++;
  };
  const bin = () => {
    const second = Math.floor((Date.now() - started) / 1000);
    let value = bins.get(second);
    if (!value) { value = { second, sentInputs: 0, newConfirmed: 0, ownSubstitutions: 0 }; bins.set(second, value); }
    return value;
  };
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = safeConsoleText(message.text());
    consoleErrors.push(text);
    const location = message.location();
    recordResourceError({ kind: 'console', text, source: resourceAddress(location.url),
      line: location.lineNumber, column: location.columnNumber });
  });
  page.on('response', response => {
    if (response.status() >= 400) recordResourceError({ kind: 'http', source: resourceAddress(response.url()),
      method: response.request().method(), status: response.status() });
  });
  page.on('requestfailed', request => recordResourceError({ kind: 'request-failed',
    source: resourceAddress(request.url()), method: request.method(), error: request.failure()?.errorText }));
  page.on('request', request => { origins.add(new URL(request.url()).origin); });
  page.on('websocket', socket => {
    origins.add(new URL(socket.url()).origin);
    // Each observer holds at most the public collector's 4 MiB transfer ceiling.
    // Only decoded metadata is retained after transfer completion.
    const collectors = { sent: createSnapshotTransferCollector(), received: createSnapshotTransferCollector() };
    const receive = (direction: 'sent' | 'received', payload: string | Buffer) => {
      const text = sessionText(payload);
      if (!text) return;
      const decoded = decodeDeterministicSessionMessage(text);
      if (decoded.ok) {
        const message = decoded.message;
        const current = bin();
        if (message.kind === 'session-start') {
          slot = message.slot; confirmedThrough = -1;
          record({ direction, kind: message.kind, slot, playerCount: message.playerCount,
            tickRateHz: message.tickRateHz, identityTickRate: message.runtimeIdentity.tickRate,
            deterministicVersion: message.runtimeIdentity.deterministicVersion });
        } else if (message.kind === 'input') {
          current.sentInputs = Number(current.sentInputs) + 1;
          current.inputTickMin ??= message.tick;
          current.inputTickMax = message.tick;
        } else if (message.kind === 'confirmed-input') {
          authorityTick = Math.max(authorityTick, message.authorityTick);
          current.authorityTick = authorityTick;
          for (const frame of message.frames) if (frame.tick > confirmedThrough) {
            current.newConfirmed = Number(current.newConfirmed) + 1;
            current.ownSubstitutions = Number(current.ownSubstitutions) + Number(frame.substitutedSlots.includes(slot));
            confirmedThrough = frame.tick;
          }
          current.confirmedThrough = confirmedThrough;
        } else if (message.kind === 'time-sync-pong') {
          authorityTick = Math.max(authorityTick, message.authorityTick);
          current.authorityTick = authorityTick;
        } else if (message.kind === 'error' || message.kind === 'close') {
          record({ direction, ...message });
        } else if (message.kind === 'hydration-barrier') {
          record({ direction, kind: message.kind, snapshotTick: message.snapshotTick, throughTick: message.throughTick });
        }
        return;
      }
      try {
        const envelope = decodeDeterministicLocalAuthorityWireEnvelope(text);
        const data = envelope.payload;
        const metadata: Metadata = { direction, kind: envelope.kind, bytes: text.length };
        for (const key of ['minFrame', 'frame', 'transferId', 'chunkIndex', 'chunkCount', 'totalBytes', 'snapshotChecksum', 'chunkChecksum']) {
          if (typeof data[key] === 'number' || typeof data[key] === 'string') metadata[key] = data[key];
        }
        if (typeof data.minFrame === 'number') metadata.requestedTick = data.minFrame - 1;
        const collector = collectors[direction];
        if (envelope.kind === 'snapshot-offer') {
          const result = collector.offer(data);
          metadata.collectorAccepted = result.accepted;
          if (!result.accepted) metadata.collectorReason = result.reason;
        } else if (envelope.kind === 'snapshot-chunk') {
          metadata.chunkBytes = typeof data.chunk === 'string' ? data.chunk.length : null;
          const result = collector.chunk(data);
          if (!result.accepted) metadata.collectorReason = result.reason;
        } else if (envelope.kind === 'snapshot-complete') {
          const result = collector.complete(data);
          metadata.collectorAccepted = result.accepted;
          if (result.accepted) {
            const snapshot = decodeDeterministicStateSnapshot(result.transfer.snapshotBytes);
            metadata.snapshotDecoded = snapshot.ok;
            if (snapshot.ok) {
              metadata.snapshotTick = snapshot.snapshot.tick;
              metadata.sessionFrame = snapshot.snapshot.sessionFrame;
              metadata.runtimeBase64Length = snapshot.snapshot.runtimeBytes.length;
            } else metadata.snapshotDecodeReason = snapshot.reason;
          } else metadata.collectorReason = result.reason;
        }
        record(metadata);
      } catch (error) { record({ direction, kind: 'observer-decode-error', error: String(error) }); }
    };
    socket.on('framesent', frame => receive('sent', frame.payload));
    socket.on('framereceived', frame => receive('received', frame.payload));
    socket.on('socketerror', error => record({ kind: 'socketerror', error: String(error) }));
    socket.on('close', () => record({ kind: 'socket-close' }));
  });
  return { report: () => ({ peer, started, slot, latestObservedAuthorityTick: authorityTick,
    events, droppedEvents, bins: [...bins.values()], errors, consoleErrors, resourceErrors, droppedResourceErrors, origins: [...origins].sort(),
    limits: 'WS observation is read-only. Input bodies and checkpoint payloads are not retained. Latest authority tick comes from wire messages, not a runner getter. Authority snapshot rejection reasons may exist only in root-owned server logs. Observed frame advance is not a native solver-step timing.' }) };
}

async function state(page: Page) {
  return page.evaluate(() => {
    const controller = (window as unknown as AuditWindow).__WRECK_YARD_CONTROLLER__;
    const snapshot = controller.snapshot();
    const render = controller.getRender();
    return { at: Date.now(), status: snapshot.status, error: snapshot.error, roomCode: snapshot.roomCode,
      crew: snapshot.crew, slot: snapshot.localSlot, frame: render?.frame ?? -1,
      players: render?.players.map(player => ({ slot: player.slot, position: [...player.position], yaw: player.yaw,
        pitch: player.pitch, grabbing: player.grabbing, jetpackActive: player.jetpackActive })),
      sampled: controller.sampledInput, focus: document.hasFocus(), hidden: document.hidden,
      pausedMenu: Boolean(document.querySelector('[aria-label="Paused"]')),
      runner: { ready: controller.runner.ready, appliedThrough: controller.runner.appliedThrough, predictedThrough: controller.runner.predictedThrough, netStats: controller.runner.netStats } };
  });
}

async function installReadOnlyAudit(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as AuditWindow;
    const controller = target.__WRECK_YARD_CONTROLLER__;
    const started = performance.now();
    let latest: Snapshot | undefined;
    const unsubscribe = controller.runner.subscribe(snapshot => { latest = snapshot; });
    const samples: unknown[] = [];
    const longTasks: { at: number; duration: number }[] = [];
    const lifecycle: unknown[] = [];
    const rafBins = new Map<number, { second: number; count: number; maxGapMs: number }>();
    const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver(list => { for (const entry of list.getEntries()) if (longTasks.length < 2000) longTasks.push({ at: entry.startTime, duration: entry.duration }); }) : null;
    observer?.observe({ type: 'longtask', buffered: true });
    const recordLifecycle = (event: Event) => { if (lifecycle.length < 100) lifecycle.push({ at: performance.now(), event: event.type, focus: document.hasFocus(), hidden: document.hidden }); };
    window.addEventListener('blur', recordLifecycle); window.addEventListener('focus', recordLifecycle);
    document.addEventListener('visibilitychange', recordLifecycle);
    let prior = performance.now();
    let raf = 0;
    const tick = (time: number) => {
      const second = Math.floor((time - started) / 1000);
      const bin = rafBins.get(second) ?? { second, count: 0, maxGapMs: 0 };
      bin.count++; bin.maxGapMs = Math.max(bin.maxGapMs, time - prior); prior = time;
      rafBins.set(second, bin);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const interval = window.setInterval(() => {
      if (samples.length >= 2000) return;
      const render = controller.getRender();
      samples.push({ at: performance.now(), frame: render?.frame, appliedThrough: latest?.appliedThrough,
        predictedThrough: latest?.predictedThrough, renderAlpha: latest?.renderAlpha, ready: latest?.ready,
        netStats: latest?.netStats ? { ...latest.netStats } : null, connection: latest?.connection,
        presence: latest?.presence, sampled: controller.sampledInput, focus: document.hasFocus(), hidden: document.hidden,
        player: render?.players.find(player => player.slot === render.localSlot)?.position });
    }, 250);
    const read = () => {
      const gl = target.__THREE_RENDERER__?.getContext();
      const extension = gl?.getExtension('WEBGL_debug_renderer_info');
      return { started, ended: performance.now(), timeOrigin: performance.timeOrigin, samples, longTasks, lifecycle,
        rafBins: [...rafBins.values()], longTaskSupported: observer !== null,
        gpu: gl ? { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
          unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
          unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null } : null };
    };
    target.__RC60_AUDIT__ = { read, stop() { clearInterval(interval); cancelAnimationFrame(raf); observer?.disconnect(); unsubscribe();
      window.removeEventListener('blur', recordLifecycle); window.removeEventListener('focus', recordLifecycle);
      document.removeEventListener('visibilitychange', recordLifecycle); return read(); } };
  });
}

async function live(page: Page, crew?: number) {
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  if (crew !== undefined) await expect(page.locator('.yard-crew')).toHaveText(`Crew ${crew}/4`, { timeout: 45_000 });
}

async function pause(page: Page) {
  if (!await page.getByRole('region', { name: 'Paused', exact: true }).isVisible()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
}

async function focusAndResume(page: Page) {
  await page.bringToFront();
  const resume = page.getByRole('button', { name: 'Resume', exact: true });
  if (await resume.isVisible()) await resume.click();
  await expect(page.getByRole('region', { name: 'Paused', exact: true })).toHaveCount(0);
}

function distance(a: readonly number[], b: readonly number[]) {
  return Math.hypot(...a.map((value, index) => value - b[index]));
}

async function saveBrowserEvidence(page: Page, name: string, testInfo: TestInfo) {
  const audit = await page.evaluate(() => (window as unknown as AuditWindow).__RC60_AUDIT__?.stop() ?? null).catch(() => null);
  const final = await state(page).catch(() => null);
  const dom = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale },
    bodyWidth: document.documentElement.scrollWidth, bodyHeight: document.documentElement.scrollHeight,
    lamps: [...document.querySelectorAll('[data-match-status]')].map(element => ({ html: element.outerHTML,
      display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility,
      box: element.getBoundingClientRect().toJSON() })), appCount: document.querySelectorAll('.yard-app').length,
    canvasCount: document.querySelectorAll('canvas').length, text: document.body.innerText.slice(0, 5000) })).catch(() => null);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), timeout: 10_000 }).catch(() => {});
  return { audit, final, dom };
}

// Run only against the root-owned normal local server. This test does not start a server.
test('rc60 low-FPS input recovery and an aged room snapshot use real peers', async ({ page, context, browser }, testInfo) => {
  test.setTimeout(360_000);
  const guest = await context.newPage();
  const hostWire = observeWire(page, 'host');
  const guestWire = observeWire(guest, 'guest');
  const report: Metadata = { browser: browser.version(), viewport: page.viewportSize(), quality: 'low',
    scope: 'real local SDK authority and native Yard WASM; no physics setters', hostLoadStart: loadavg(),
    memoryStart: { free: freemem(), total: totalmem(), process: process.memoryUsage() }, phases: [] };
  const phases = report.phases as Metadata[];
  const record = async (phase: string) => { phases.push({ phase, at: Date.now(), host: await state(page), guest: await state(guest), load: loadavg() }); };
  const cdp = await context.newCDPSession(guest);
  try {
    const roomStarted = Date.now();
    await page.goto('/?capture=off&quality=low'); await live(page, 1); await installReadOnlyAudit(page);
    const code = (await state(page)).roomCode!;
    await guest.goto(`/?capture=off&quality=low&room=${code}`); await live(guest, 2); await live(page, 2);
    await installReadOnlyAudit(guest);
    expect(hostWire.report().events.find(event => event.kind === 'session-start')?.deterministicVersion).toContain('rc.60');
    expect(guestWire.report().events.find(event => event.kind === 'session-start')?.deterministicVersion).toContain('rc.60');
    await focusAndResume(guest);
    await guest.locator('canvas').click({ position: { x: 180, y: 160 } }); await focusAndResume(guest);
    const slot = (await state(guest)).slot;
    await record('joined');
    await guest.mouse.move(180, 160); await guest.mouse.down(); await guest.mouse.move(210, 170, { steps: 6 }); await guest.mouse.up();
    await guest.waitForTimeout(500); await record('real-mouse-drag-release');
    report.artificialThrottle = { api: 'CDP Emulation.setCPUThrottlingRate', rate: 6, durationMs: 6000, physicalDevice: false };
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await guest.keyboard.down('KeyS'); await guest.waitForTimeout(3000); await record('throttled-key-held');
    await guest.keyboard.up('KeyS'); await guest.waitForTimeout(3000); await record('throttled-key-released');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await focusAndResume(guest);
    await expect.poll(async () => (await state(guest)).sampled?.input.moveZ, { timeout: 10_000 }).toBe(0);
    await guest.waitForTimeout(2000); await record('throttle-cleared-neutral');
    const before = await state(guest);
    await guest.keyboard.down('KeyW'); await guest.waitForTimeout(1200); await record('unthrottled-key-held');
    await guest.keyboard.up('KeyW'); await guest.waitForTimeout(500);
    const moved = await state(guest); const remote = await state(page);
    report.recoveredMovement = { before, moved, remote };
    expect.soft(distance(before.players![slot].position, moved.players![slot].position)).toBeGreaterThan(0.3);
    expect.soft(distance(before.players![slot].position, remote.players![slot].position)).toBeGreaterThan(0.3);
    await expect.poll(async () => (await state(guest)).sampled?.input.moveZ, { timeout: 10_000 }).toBe(0);
    await pause(guest); await record('pause');
    const pausedFrame = (await state(guest)).frame;
    await expect.poll(async () => (await state(guest)).frame, { timeout: 10_000 }).toBeGreaterThan(pausedFrame + 8);
    await focusAndResume(page); await focusAndResume(guest); await record('actual-page-focus-and-resume');
    while (Date.now() - roomStarted < 130_000) {
      await guest.waitForTimeout(Math.min(30_000, 130_000 - (Date.now() - roomStarted)));
      await record('real-time-room-soak');
      console.log('rc60 room age seconds:', Math.round((Date.now() - roomStarted) / 1000));
    }
    report.roomAgeBeforeLeaveMs = Date.now() - roomStarted;
    await pause(guest); const leftAt = Date.now();
    await guest.getByRole('button', { name: 'Leave match', exact: true }).click();
    await expect.poll(async () => (await state(guest)).status).toBe('idle');
    await expect(page.locator('.yard-crew')).toHaveText('Crew 1/4', { timeout: 45_000 });
    report.departureLatencyMs = Date.now() - leftAt;
    const field = guest.getByRole('textbox', { name: 'Join a room', exact: true });
    await field.fill(code); const rejoinAt = Date.now();
    await field.locator('..').getByRole('button', { name: 'Join', exact: true }).click();
    await live(guest, 2); await live(page, 2);
    report.rejoinLatencyMs = Date.now() - rejoinAt; await record('aged-room-rejoined');
    expect.soft(hostWire.report().errors).toEqual([]); expect.soft(guestWire.report().errors).toEqual([]);
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await guest.keyboard.up('KeyS').catch(() => {}); await guest.keyboard.up('KeyW').catch(() => {}); await guest.mouse.up().catch(() => {});
    report.host = await saveBrowserEvidence(page, 'aged-host', testInfo);
    report.guest = await saveBrowserEvidence(guest, 'aged-guest', testInfo);
    report.wire = { host: hostWire.report(), guest: guestWire.report() };
    report.hostLoadEnd = loadavg(); report.memoryEnd = process.memoryUsage();
    await testInfo.attach('rc60-aged-room-report', { body: JSON.stringify(report), contentType: 'application/json' });
    await cdp.detach().catch(() => {}); await guest.close();
  }
});

async function mobileReady(page: Page) {
  await expect(page.getByLabel('Move pad', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect.poll(async () => (await state(page)).status, { timeout: 45_000 }).toBe('live');
  const before = await state(page);
  await expect.poll(async () => (await state(page)).frame, { timeout: 10_000 }).toBeGreaterThan(before.frame + 8);
}

async function mobileReport(page: Page) {
  return { state: await state(page), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    scale: visualViewport?.scale, scrollWidth: document.documentElement.scrollWidth,
    coarse: matchMedia('(pointer: coarse)').matches, touchControls: Boolean(document.querySelector('.yard-touch')) })) };
}

test('rc60 Chrome touch movement releases through pause and resume', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const wire = observeWire(page, 'touch');
  const cdp = await context.newCDPSession(page);
  const report: Metadata = { browserVersion: browser.version(), limitation: 'Desktop Chrome touch emulation is not physical-phone proof.' };
  try {
    await page.goto(`${testInfo.project.use.baseURL}/?capture=off&quality=low&controls=touch`); await mobileReady(page); await installReadOnlyAudit(page);
    expect(wire.report().events.find(event => event.kind === 'session-start')?.deterministicVersion).toContain('rc.60');
    await page.getByLabel('Move pad', { exact: true }).waitFor();
    const before = await mobileReport(page); report.before = before;
    const box = await page.getByLabel('Move pad', { exact: true }).boundingBox(); expect(box).not.toBeNull();
    const point = { x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.5, id: 11 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 42 }] });
    await page.waitForTimeout(1000); report.held = await mobileReport(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await state(page)).sampled?.input.moveZ).toBe(0);
    const after = await mobileReport(page); report.released = after;
    expect.soft(distance(before.state.players![before.state.slot].position, after.state.players![after.state.slot].position)).toBeGreaterThan(0.3);
    const cancelPoint = { ...point, id: 12 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [cancelPoint] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...cancelPoint, x: cancelPoint.x + 42 }] });
    await expect.poll(async () => Math.abs((await state(page)).sampled?.input.moveX ?? 0)).toBeGreaterThan(0);
    report.beforeTouchCancel = await mobileReport(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(async () => {
      const input = (await state(page)).sampled?.input;
      return input ? [input.moveX, input.moveZ] : null;
    }).toEqual([0, 0]);
    const cancelled = await state(page);
    await expect.poll(async () => (await state(page)).frame).toBeGreaterThan(cancelled.frame + 8);
    report.afterTouchCancel = await mobileReport(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    await expect(page.getByRole('region', { name: 'Paused', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).tap();
    await expect(page.getByRole('region', { name: 'Paused', exact: true })).toHaveCount(0);
    await page.getByLabel('Jet', { exact: true }).tap();
    await expect.poll(async () => (await state(page)).sampled?.input.jetpack).toBe(false);
    report.final = await mobileReport(page);
    const final = await mobileReport(page);
    expect.soft(final.viewport.scale).toBe(1); expect.soft(final.viewport.scrollWidth).toBeLessThanOrEqual(390);
    expect.soft(wire.report().errors).toEqual([]);
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {});
    report.browser = await saveBrowserEvidence(page, 'chrome-touch', testInfo); report.wire = wire.report();
    await testInfo.attach('rc60-touch-report', { body: JSON.stringify(report), contentType: 'application/json' });
    await cdp.detach().catch(() => {}); await context.close();
  }
});

test('rc60 WebKit startup and touch taps use the real Yard runtime', async ({ browser, browserName }, testInfo) => {
  test.setTimeout(90_000); expect(browserName).toBe('webkit');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const wire = observeWire(page, 'webkit-touch');
  const report: Metadata = { browserVersion: browser.version(), limitation: 'Desktop WebKit mobile layout is not physical-iPhone proof. Complete taps only; no CDP drag.' };
  try {
    await page.goto(`${testInfo.project.use.baseURL}/?capture=off&quality=low&controls=touch`); await mobileReady(page); await installReadOnlyAudit(page);
    expect(wire.report().events.find(event => event.kind === 'session-start')?.deterministicVersion).toContain('rc.60');
    await expect(page.getByLabel('Move pad', { exact: true })).toBeVisible(); report.before = await mobileReport(page);
    await page.getByLabel('Jet', { exact: true }).tap();
    await expect.poll(async () => (await state(page)).sampled?.input.jetpack).toBe(false);
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    await expect(page.getByRole('region', { name: 'Paused', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).tap();
    await expect(page.getByRole('region', { name: 'Paused', exact: true })).toHaveCount(0);
    const before = await state(page);
    await expect.poll(async () => (await state(page)).frame).toBeGreaterThan(before.frame + 8);
    const after = await mobileReport(page); report.after = after;
    expect.soft(after.viewport.scale).toBe(1); expect.soft(after.viewport.scrollWidth).toBeLessThanOrEqual(390);
    expect.soft(wire.report().errors).toEqual([]);
  } finally {
    report.browser = await saveBrowserEvidence(page, 'webkit-touch', testInfo); report.wire = wire.report();
    await testInfo.attach('rc60-webkit-report', { body: JSON.stringify(report), contentType: 'application/json' });
    await context.close();
  }
});

test('rc60 short reverse-path recovery measures catch-up after low FPS', async ({ page, context, browser }, testInfo) => {
  test.setTimeout(180_000);
  const guest = await context.newPage(); const cdp = await context.newCDPSession(guest);
  const hostWire = observeWire(page, 'reverse-host'); const guestWire = observeWire(guest, 'reverse-guest');
  const report: Metadata = { browserVersion: browser.version(), artificialThrottle: { rate: 6, durationMs: 6000 },
    scope: 'One short confirmation. Reverse KeyW uses the route traversed by KeyS. Original aged-room failure remains retained.' };
  try {
    await page.goto('/?capture=off&quality=low'); await live(page, 1); await installReadOnlyAudit(page);
    const code = (await state(page)).roomCode!;
    await guest.goto(`/?capture=off&quality=low&room=${code}`); await live(guest, 2); await installReadOnlyAudit(guest);
    expect(guestWire.report().events.find(event => event.kind === 'session-start')?.deterministicVersion).toContain('rc.60');
    await focusAndResume(guest); report.beforeThrottle = await state(guest);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await guest.keyboard.down('KeyS'); await guest.waitForTimeout(3000); report.throttledHeld = await state(guest);
    await guest.keyboard.up('KeyS'); await guest.waitForTimeout(3000); report.throttledReleased = await state(guest);
    const clearStarted = Date.now();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await focusAndResume(guest); await guest.waitForTimeout(2000);
    const before = await state(guest); report.immediateBefore = { host: await state(page), guest: before };
    await guest.keyboard.down('KeyW'); await guest.waitForTimeout(1200); report.immediateHeld = await state(guest);
    await guest.keyboard.up('KeyW'); await guest.waitForTimeout(500);
    const immediate = await state(guest); const remote = await state(page);
    report.immediateAfter = { host: remote, guest: immediate };
    report.immediateDisplacement = { local: distance(before.players![before.slot].position, immediate.players![before.slot].position),
      remote: distance(before.players![before.slot].position, remote.players![before.slot].position) };
    await expect.poll(async () => Math.abs((await state(page)).frame - (await state(guest)).frame), { timeout: 45_000 }).toBeLessThan(9);
    report.actualFrameGapRecoveryMs = Date.now() - clearStarted;
    const recovered = await state(guest); report.caughtUp = { host: await state(page), guest: recovered };
    await guest.keyboard.down('KeyW'); await guest.waitForTimeout(1200); report.recoveredHeld = await state(guest);
    await guest.keyboard.up('KeyW'); await guest.waitForTimeout(500);
    const moved = await state(guest); const observed = await state(page);
    report.recoveredAfter = { host: observed, guest: moved };
    expect.soft(distance(recovered.players![recovered.slot].position, moved.players![recovered.slot].position)).toBeGreaterThan(0.3);
    expect.soft(distance(recovered.players![recovered.slot].position, observed.players![recovered.slot].position)).toBeGreaterThan(0.3);
    await expect.poll(async () => (await state(guest)).sampled?.input.moveZ, { timeout: 10_000 }).toBe(0);
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await guest.keyboard.up('KeyS').catch(() => {}); await guest.keyboard.up('KeyW').catch(() => {});
    report.host = await saveBrowserEvidence(page, 'reverse-host', testInfo);
    report.guest = await saveBrowserEvidence(guest, 'reverse-guest', testInfo);
    report.wire = { host: hostWire.report(), guest: guestWire.report() };
    await testInfo.attach('rc60-reverse-recovery-report', { body: JSON.stringify(report), contentType: 'application/json' });
    await cdp.detach().catch(() => {}); await guest.close();
  }
});
