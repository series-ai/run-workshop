import { expect, test, type Page } from '@playwright/test';
import type { SyncplayRunnerSnapshot } from '@series-inc/rundot-syncplay/browser';
import type { MatchController } from '../src/game/match';
import type { YardRender } from '../src/render/presentation';

type Vec = readonly number[];
type Sample = { time: number; frame: number; position: Vec; rawFrame: number; rawPosition: Vec; alpha: number; confirmed: number };
type Probe = Pick<MatchController, 'snapshot' | 'getRender'> & {
  runner: { subscribe(listener: (snapshot: SyncplayRunnerSnapshot<YardRender>) => void): () => void };
};
type UiSample = { elapsedMs: number; status: string; frame: number | null; lampStatus: string | null };
type DiagnosticWindow = { __WRECK_YARD_CONTROLLER__: Probe; __yardCadence?: { stop(): Sample[] }; __yardUiWatch?: { stop(): UiSample[] } };
type Ticket = { action: string; roomCode?: string; reconnect?: boolean; profileId?: string };

async function state(page: Page) {
  return page.evaluate(() => {
    const controller = (window as unknown as DiagnosticWindow).__WRECK_YARD_CONTROLLER__;
    const snapshot = controller.snapshot();
    return { status: snapshot.status, error: snapshot.error, roomCode: snapshot.roomCode,
      slot: snapshot.localSlot, crew: snapshot.crew, frame: snapshot.render?.frame,
      players: snapshot.render?.players.map(player => ({ slot: player.slot, position: [...player.position] })) };
  });
}

async function live(page: Page, crew: number, timeout = 30_000) {
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.yard-crew')).toHaveText(`Crew ${crew}/4`, { timeout });
}

async function pause(page: Page) {
  if (!await page.getByRole('region', { name: 'Paused', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
  }
}

async function join(page: Page, code: string) {
  if ((await state(page)).status === 'live') await pause(page);
  const field = page.getByRole('textbox', { name: /^Join (?:another room|a room)$/ });
  await field.fill(code);
  await field.locator('..').getByRole('button', { name: 'Join', exact: true }).click();
}

async function leave(page: Page) {
  await pause(page);
  await page.getByRole('button', { name: 'Leave match', exact: true }).click();
  await expect.poll(async () => (await state(page)).status).toBe('idle');
}

async function startCadence(page: Page, slot: number) {
  // This diagnostic only subscribes to public SDK snapshots. It does not step or drain the runner.
  await page.evaluate(slot => {
    const target = window as unknown as DiagnosticWindow;
    let latest: SyncplayRunnerSnapshot<YardRender> | undefined;
    const samples: Sample[] = [];
    const unsubscribe = target.__WRECK_YARD_CONTROLLER__.runner.subscribe(snapshot => { latest = snapshot; });
    let request = 0;
    const sample = (time: number) => {
      const render = target.__WRECK_YARD_CONTROLLER__.getRender();
      const raw = latest?.renderState;
      if (render && raw && samples.length < 900) samples.push({ time, frame: render.frame,
        position: [...render.players[slot].position], rawFrame: raw.frame,
        rawPosition: [...raw.players[slot].position], alpha: latest!.renderAlpha,
        confirmed: latest!.appliedThrough });
      request = requestAnimationFrame(sample);
    };
    request = requestAnimationFrame(sample);
    target.__yardCadence = { stop() { cancelAnimationFrame(request); unsubscribe(); return samples; } };
  }, slot);
}

async function stopCadence(page: Page) {
  return page.evaluate(() => {
    const target = window as unknown as DiagnosticWindow;
    const samples = target.__yardCadence?.stop() ?? [];
    delete target.__yardCadence;
    return samples;
  });
}

function cadence(samples: Sample[]) {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const seconds = (last.time - first.time) / 1000;
  const distance = (a: Vec, b: Vec) => Math.hypot(...a.map((value, axis) => value - b[axis]));
  return { samples: samples.length, seconds, displaySampleHz: (samples.length - 1) / seconds,
    discreteFrameAdvanceHz: (last.rawFrame - first.rawFrame) / seconds,
    confirmedFrameHz: (last.confirmed - first.confirmed) / seconds,
    sameNativeFramePositionChanges: samples.slice(1).filter((next, index) => {
      const previous = samples[index];
      return next.rawFrame === previous.rawFrame && distance(next.rawPosition, previous.rawPosition) < 1e-9
        && distance(next.position, previous.position) > 1e-5 && Math.abs(next.alpha - previous.alpha) > 1e-5;
    }).length,
    fractionalInterpolatedSamples: samples.filter(sample => sample.alpha > 0 && sample.alpha < 1
      && distance(sample.position, sample.rawPosition) > 1e-5).length };
}

test('normal npm dev supports URL join, peer lifecycle, and display interpolation', async ({ page, context, browser }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const origins = new Set<string>();
  const tickets = { host: [] as Ticket[], guest: [] as Ticket[] };
  const report: Record<string, unknown> = { scope: 'normal npm dev; real local SDK authority and native Yard runtime',
    browserVersion: browser.version(), viewport: page.viewportSize(),
    diagnostic: 'read-only public runner subscription through the existing controller reference' };
  const observe = (peer: Page, list: Ticket[]) => {
    peer.on('pageerror', error => errors.push(String(error)));
    peer.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    peer.on('request', request => {
      const url = new URL(request.url());
      if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) origins.add(url.origin);
      if (url.pathname === '/tickets' && request.method() === 'POST') {
        const body: unknown = request.postDataJSON();
        if (body && typeof body === 'object' && 'action' in body) list.push(body as Ticket);
      }
    });
  };
  observe(page, tickets.host);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const guest = await context.newPage();
  observe(guest, tickets.guest);
  try {
    await page.goto('/?capture=off&quality=low');
    await live(page, 1);
    await pause(page);
    const code = await page.getByRole('textbox', { name: 'Your room code' }).inputValue();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await page.getByRole('button', { name: 'Copy code', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await guest.goto(`/?capture=off&quality=low&room=${encodeURIComponent(` ${code.toLowerCase()} `)}`);
    await live(guest, 2);
    await live(page, 2);
    const hostJoined = await state(page);
    const guestJoined = await state(guest);
    expect(guestJoined.roomCode).toBe(code);
    expect(guestJoined.slot).not.toBe(hostJoined.slot);
    expect(hostJoined.players).toHaveLength(4);
    expect(guestJoined.players).toHaveLength(4);
    const initialHost = tickets.host.filter(ticket => !ticket.reconnect);
    const initialGuest = tickets.guest.filter(ticket => !ticket.reconnect);
    expect(initialHost.map(ticket => ticket.action)).toEqual(['create']);
    expect(initialGuest.map(ticket => ticket.action)).toEqual(['joinByCode']);
    expect(initialGuest[0].roomCode).toBe(code);
    expect(initialHost[0].profileId).toBeTruthy();
    expect(initialGuest[0].profileId).not.toBe(initialHost[0].profileId);
    report.startup = { host: hostJoined, guest: guestJoined, hostActions: initialHost.map(ticket => ticket.action),
      guestActions: initialGuest.map(ticket => ticket.action), distinctTabIdentities: true, clipboardMatches: true };
    await page.screenshot({ path: testInfo.outputPath('host-joined.png') });
    await guest.screenshot({ path: testInfo.outputPath('guest-joined.png') });

    await guest.bringToFront();
    await guest.locator('canvas').click({ position: { x: 200, y: 200 } });
    const resume = guest.getByRole('button', { name: 'Resume', exact: true });
    if (await resume.isVisible()) await resume.click();
    await expect(guest.getByRole('region', { name: 'Paused', exact: true })).toHaveCount(0);
    const slot = guestJoined.slot;
    await guest.waitForTimeout(2500);
    await expect.poll(async () => Math.abs((await state(page)).frame! - (await state(guest)).frame!), { timeout: 30_000 }).toBeLessThan(9);
    const start = (await state(guest)).players![slot].position;
    await startCadence(page, slot);
    await startCadence(guest, slot);
    await guest.keyboard.down('KeyW');
    await guest.waitForTimeout(400);
    report.heldInput = await guest.evaluate(() => ({ sampled: (window as unknown as { __WRECK_YARD_CONTROLLER__: MatchController }).__WRECK_YARD_CONTROLLER__.sampledInput, focus: document.hasFocus(), activeElement: document.activeElement?.tagName, paused: Boolean(document.querySelector('[aria-label=Paused]')) }));
    await guest.waitForTimeout(1000);
    await guest.keyboard.up('KeyW');
    report.sampledInput = await guest.evaluate(() => (window as unknown as { __WRECK_YARD_CONTROLLER__: MatchController }).__WRECK_YARD_CONTROLLER__.sampledInput);
    const movedLocal = await state(guest);
    const movedRemote = await state(page);
    const displacement = (position: Vec) => Math.hypot(...position.map((value, axis) => value - start[axis]));
    report.firstMovement = { start, local: movedLocal, remote: movedRemote };
    expect(displacement(movedLocal.players![slot].position)).toBeGreaterThan(0.3);
    expect(displacement(movedRemote.players![slot].position)).toBeGreaterThan(0.3);
    await guest.keyboard.down('KeyS');
    await guest.waitForTimeout(1400);
    await guest.keyboard.up('KeyS');
    await guest.waitForTimeout(3000);
    const rawSamples = { host: await stopCadence(page), guest: await stopCadence(guest) };
    const rates = { host: cadence(rawSamples.host), guest: cadence(rawSamples.guest) };
    report.cadence = rates;
    console.log('Observed cadence:', JSON.stringify(rates));
    report.movement = { start, local: movedLocal, remote: movedRemote };
    await testInfo.attach('cadence-samples', { body: JSON.stringify(rawSamples), contentType: 'application/json' });
    for (const rate of Object.values(rates)) {
      expect(rate.samples).toBeGreaterThan(30);
      expect(rate.discreteFrameAdvanceHz).toBeGreaterThan(25);
      expect(rate.discreteFrameAdvanceHz).toBeLessThan(35);
      expect(rate.confirmedFrameHz).toBeGreaterThan(25);
      expect(rate.confirmedFrameHz).toBeLessThan(35);
      expect(rate.fractionalInterpolatedSamples).toBeGreaterThan(0);
    }

    expect(rates.host.sameNativeFramePositionChanges + rates.guest.sameNativeFramePositionChanges).toBeGreaterThan(0);

    const departureStarted = Date.now();
    await leave(guest);
    await live(page, 1, 45_000);
    report.departureLatencyMs = Date.now() - departureStarted;
    const afterLeave = await state(page);
    await expect.poll(async () => (await state(page)).frame).toBeGreaterThan(afterLeave.frame! + 8);
    await join(guest, code);
    await live(guest, 2);
    await live(page, 2);
    expect((await state(guest)).slot).toBe(slot);
    report.rejoin = { retainedOwnerSlot: slot, afterLeave, afterRejoin: await state(guest) };

    const invalidStart = tickets.guest.length;
    await guest.goto('/?capture=off&quality=low&room=ZZZZZZ');
    const modal = guest.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 45_000 });
    expect(tickets.guest.slice(invalidStart).filter(ticket => !ticket.reconnect).map(ticket => ticket.action)).toEqual(['joinByCode']);
    report.invalidQuery = await state(guest);
    await modal.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect.poll(() => tickets.guest.slice(invalidStart).filter(ticket => !ticket.reconnect).length).toBe(2);
    await expect(modal).toBeVisible({ timeout: 45_000 });
    expect(tickets.guest.slice(invalidStart).filter(ticket => !ticket.reconnect).map(ticket => ticket.action)).toEqual(['joinByCode', 'joinByCode']);
    report.retry = await state(guest);
    await modal.getByRole('button', { name: 'New room', exact: true }).click();
    await live(guest, 1);
    await live(page, 1, 45_000);
    expect((await state(guest)).roomCode).not.toBe(code);
    report.recovery = await state(guest);
    await join(guest, code);
    await live(guest, 2);
    await live(page, 2);
    expect((await state(guest)).slot).toBe(slot);
    report.switchBack = await state(guest);
    expect(errors).toEqual([]);
    expect([...origins].every(origin => /^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))).toBe(true);
  } finally {
    await guest.keyboard.up('KeyW').catch(() => {});
    await guest.keyboard.up('KeyS').catch(() => {});
    report.remainingCadence = { host: await stopCadence(page).catch(() => []), guest: await stopCadence(guest).catch(() => []) };
    report.dom = await domEvidence(guest).catch(() => null);
    await guest.screenshot({ path: testInfo.outputPath('guest-final.png'), timeout: 10_000 }).catch(() => {});
    report.final = { host: await state(page).catch(() => null), guest: await state(guest).catch(() => null) };
    report.pageErrors = errors;
    report.consoleErrors = consoleErrors;
    report.requestOrigins = [...origins].sort();
    report.ticketActions = Object.fromEntries(Object.entries(tickets).map(([peer, list]) => [peer,
      list.map(({ action, roomCode, reconnect }) => ({ action, roomCode, reconnect }))]));
    await testInfo.attach('dev-multiplayer-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    await guest.close();
  }
});

async function domEvidence(page: Page) {
  return page.evaluate(() => {
    const renderer = (window as unknown as { __THREE_RENDERER__?: { getContext(): WebGLRenderingContext } }).__THREE_RENDERER__;
    const gl = renderer?.getContext();
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl ? { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null } : null;
    return { gpu, url: location.href,
    appCount: document.querySelectorAll('.yard-app').length, canvasCount: document.querySelectorAll('canvas').length,
    lamps: [...document.querySelectorAll('[data-match-status]')].map(element => ({ html: element.outerHTML,
      display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility,
      box: element.getBoundingClientRect().toJSON() })),
    stylesheets: [...document.styleSheets].map(sheet => ({ href: sheet.href, disabled: sheet.disabled })),
    bodyText: document.body.innerText.slice(0, 6000), focus: document.hasFocus(),
    fullscreen: Boolean(document.fullscreenElement), pointerLock: Boolean(document.pointerLockElement) };
  });
}

async function watchUi(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as DiagnosticWindow;
    const started = performance.now();
    const samples: UiSample[] = [];
    const timer = window.setInterval(() => {
      if (samples.length >= 900) return;
      const snapshot = target.__WRECK_YARD_CONTROLLER__.snapshot();
      samples.push({ elapsedMs: performance.now() - started, status: snapshot.status,
        frame: snapshot.render?.frame ?? null,
        lampStatus: document.querySelector('[data-match-status]')?.getAttribute('data-match-status') ?? null });
    }, 100);
    target.__yardUiWatch = { stop() { clearInterval(timer); return samples; } };
  });
}

test('normal dev leave and same-owner rejoin preserve room progress', async ({ page, context, browser }, testInfo) => {
  test.setTimeout(180_000);
  const guest = await context.newPage();
  const report: Record<string, unknown> = { browser: browser.version(), viewport: page.viewportSize() };
  const errors: string[] = [];
  for (const peer of [page, guest]) peer.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto('/?capture=off&quality=low');
    await live(page, 1);
    const code = (await state(page)).roomCode!;
    await guest.goto(`/?capture=off&quality=low&room=${code}`);
    await live(guest, 2);
    await live(page, 2);
    const joined = await state(guest);
    const started = Date.now();
    await leave(guest);
    await live(page, 1, 45_000);
    report.departureLatencyMs = Date.now() - started;
    const remaining = await state(page);
    await expect.poll(async () => (await state(page)).frame).toBeGreaterThan(remaining.frame! + 8);
    const rejoinStarted = Date.now();
    await watchUi(guest);
    await join(guest, code);
    await live(guest, 2);
    await live(page, 2);
    report.rejoinLatencyMs = Date.now() - rejoinStarted;
    const rejoined = await state(guest);
    expect(rejoined.slot).toBe(joined.slot);
    expect(rejoined.roomCode).toBe(code);
    expect(rejoined.players).toHaveLength(4);
    report.lifecycle = { joined, remaining, rejoined };
    expect(errors).toEqual([]);
  } finally {
    report.final = { host: await state(page).catch(() => null), guest: await state(guest).catch(() => null) };
    report.dom = await domEvidence(guest).catch(() => null);
    report.pageErrors = errors;
    await guest.screenshot({ path: testInfo.outputPath('rejoin-final.png') }).catch(() => {});
    report.uiSamples = await guest.evaluate(() => (window as unknown as DiagnosticWindow).__yardUiWatch?.stop() ?? []).catch(() => []);
    await testInfo.attach('lifecycle-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    await guest.close();
  }
});

test('normal dev invalid URL retries the join and recovers before switching rooms', async ({ page, context, browser }, testInfo) => {
  test.setTimeout(180_000);
  const guest = await context.newPage();
  const actions: string[] = [];
  const errors: string[] = [];
  const report: Record<string, unknown> = { browser: browser.version(), viewport: page.viewportSize() };
  guest.on('request', request => {
    if (new URL(request.url()).pathname === '/tickets' && request.method() === 'POST') {
      const body: unknown = request.postDataJSON();
      if (body && typeof body === 'object' && 'action' in body && typeof body.action === 'string'
        && !('reconnect' in body && body.reconnect)) actions.push(body.action);
    }
  });
  for (const peer of [page, guest]) peer.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto('/?capture=off&quality=low');
    await live(page, 1);
    const code = (await state(page)).roomCode!;
    await guest.goto('/?capture=off&quality=low&room=ZZZZZZ');
    const modal = guest.getByRole('alertdialog');
    await expect(modal).toBeVisible({ timeout: 45_000 });
    expect(actions).toEqual(['joinByCode']);
    report.invalid = await state(guest);
    await modal.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect.poll(() => actions.length).toBe(2);
    await expect(modal).toBeVisible({ timeout: 45_000 });
    expect(actions).toEqual(['joinByCode', 'joinByCode']);
    report.retry = await state(guest);
    await modal.getByRole('button', { name: 'New room', exact: true }).click();
    await live(guest, 1);
    expect(actions).toEqual(['joinByCode', 'joinByCode', 'create']);
    const recovered = await state(guest);
    expect(recovered.roomCode).not.toBe(code);
    report.recovered = recovered;
    await join(guest, code);
    await live(guest, 2);
    await live(page, 2);
    expect((await state(guest)).roomCode).toBe(code);
    expect(actions).toEqual(['joinByCode', 'joinByCode', 'create', 'joinByCode']);
    report.switched = await state(guest);
    expect(errors).toEqual([]);
  } finally {
    report.actions = actions;
    report.final = { host: await state(page).catch(() => null), guest: await state(guest).catch(() => null) };
    report.dom = await domEvidence(guest).catch(() => null);
    report.pageErrors = errors;
    await guest.screenshot({ path: testInfo.outputPath('recovery-final.png') }).catch(() => {});
    await testInfo.attach('recovery-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    await guest.close();
  }
});
