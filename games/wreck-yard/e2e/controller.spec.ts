import { expect, test, type Locator, type Page } from '@playwright/test';
import type { YardInput } from '../src/sim/input';
import type { MatchSnapshot } from '../src/game/match';

type PadDevice = { connected: boolean; timestamp: number; axes: number[]; buttons: { pressed: boolean; value: number; touched: boolean }[] };
type Player = { slot: number; position: number[]; fuel: number; yaw: number; pitch: number; jetpackActive: boolean };
type Probe = Window & {
  __YARD_TEST_PAD__: PadDevice;
  __YARD_INPUT_SAMPLES__: { frame: number; input: YardInput }[];
  __CAPTURE_FAKE__?: { calls: string[] };
  __WRECK_YARD_CONTROLLER__: {
    input: YardInput;
    sampledInput: { input: YardInput; frame: number } | null;
    getRender(): { frame: number; players: Player[]; localSlot: number } | null;
    snapshot(): MatchSnapshot;
  };
};
const BUTTON = { a: 0, b: 1, x: 2, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;
type Button = keyof typeof BUTTON;
const ACTIONS = ['pressed', 'secondary', 'drop', 'use', 'jetpack'] as const;
test.use({ viewport: { width: 1440, height: 900 } });
const pageErrors = new WeakMap<Page, string[]>();
const pageConsole = new WeakMap<Page, string[]>();

async function installPad(page: Page, held?: Button) {
  // Replace only the browser device boundary. The SDK and room remain real.
  await page.addInitScript((heldIndex) => {
    const buttons = Array.from({ length: 17 }, (_, index) => ({ pressed: index === heldIndex, value: index === heldIndex ? 1 : 0, touched: index === heldIndex }));
    const pad = { id: 'Wreck Yard browser test controller', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pad.connected ? [pad] : [] });
    const probe = window as unknown as Probe;
    probe.__YARD_TEST_PAD__ = pad;
    probe.__YARD_INPUT_SAMPLES__ = [];
    let lastFrame = -1;
    function observe() {
      const sample = probe.__WRECK_YARD_CONTROLLER__?.sampledInput;
      if (sample && sample.frame !== lastFrame) {
        lastFrame = sample.frame;
        probe.__YARD_INPUT_SAMPLES__.push({ frame: sample.frame, input: { ...sample.input } });
        if (probe.__YARD_INPUT_SAMPLES__.length > 600) probe.__YARD_INPUT_SAMPLES__.shift();
      }
      requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  }, held === undefined ? -1 : BUTTON[held]);
}
async function frames(page: Page, count = 6) {
  await page.evaluate(async (count) => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame); }, count);
}
async function setButton(page: Page, button: Button, pressed: boolean) {
  await page.evaluate(({ index, pressed }) => {
    const pad = (window as unknown as Probe).__YARD_TEST_PAD__;
    pad.buttons[index] = { pressed, value: pressed ? 1 : 0, touched: pressed };
    pad.timestamp += 1;
  }, { index: BUTTON[button], pressed });
}
async function tap(page: Page, button: Button) {
  await setButton(page, button, true); await frames(page, 7);
  await setButton(page, button, false); await frames(page, 5);
}
async function axes(page: Page, values: number[]) {
  await page.evaluate(values => { const pad = (window as unknown as Probe).__YARD_TEST_PAD__; pad.axes.splice(0, 4, ...values); pad.timestamp += 1; }, values);
  await frames(page);
}
async function input(page: Page) { return page.evaluate(() => (window as unknown as Probe).__WRECK_YARD_CONTROLLER__.input); }
async function player(page: Page) {
  return page.evaluate(() => { const render = (window as unknown as Probe).__WRECK_YARD_CONTROLLER__.getRender()!; return render.players[render.localSlot]; });
}
async function clearSamples(page: Page) { await page.evaluate(() => { (window as unknown as Probe).__YARD_INPUT_SAMPLES__ = []; }); }
async function expectSample(page: Page, field: keyof YardInput, value: number | boolean) {
  await expect.poll(() => page.evaluate(({ field, value }) => (window as unknown as Probe).__YARD_INPUT_SAMPLES__.some(sample => sample.input[field] === value), { field, value })).toBe(true);
}
async function expectNeutral(page: Page, phase = 'neutral input') {
  await expect.poll(async () => { const value = await input(page); return [...ACTIONS.map(field => value[field]), value.moveX, value.moveZ]; }, { message: phase }).toEqual([false, false, false, false, false, 0, 0]);
}
async function boot(page: Page, capture = 'off', held?: Button) {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(String(error)));
  const messages: string[] = [];
  pageConsole.set(page, messages);
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') messages.push(message.text()); });
  await installPad(page, held);
  await page.goto(`/?capture=${capture}&quality=low`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await page.waitForFunction(() => ((window as unknown as Probe).__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 5);
  await expect(page.locator('.yard-crew')).toHaveText('Crew 1/4');
  await frames(page, 12);
}
const paused = (page: Page) => page.getByRole('region', { name: 'Paused', exact: true });

// Find a control with pad input. Do not set DOM focus from the fixture.
async function focusButton(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 70; attempt++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    const direction = await target.evaluate(element => {
      const goal = element.getBoundingClientRect();
      const current = document.activeElement?.getBoundingClientRect();
      if (!current || current.width === 0 || current.height === 0) return 'down';
      const dx = goal.x + goal.width / 2 - current.x - current.width / 2;
      const dy = goal.y + goal.height / 2 - current.y - current.height / 2;
      const centerX = current.x + current.width / 2;
      if (centerX < goal.left - 8 || centerX > goal.right + 8) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    });
    await tap(page, direction);
  }
  throw new Error(`Controller navigation did not reach ${await target.textContent()}; focused: ${await page.evaluate(() => document.activeElement?.outerHTML)}`);
}
async function activate(page: Page, target: Locator) { await focusButton(page, target); await tap(page, 'a'); }

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  await info.attach('controller-state', { body: JSON.stringify(await page.evaluate(() => {
    const probe = window as unknown as Probe;
    const snapshot = probe.__WRECK_YARD_CONTROLLER__?.snapshot();
    const match = snapshot ? { status: snapshot.status, roomCode: snapshot.roomCode, error: snapshot.error, errorDetails: snapshot.errorDetails, crew: snapshot.crew } : null;
    return { userAgent: navigator.userAgent, snapshot: match, input: probe.__WRECK_YARD_CONTROLLER__?.input, samples: probe.__YARD_INPUT_SAMPLES__, renderFrame: probe.__WRECK_YARD_CONTROLLER__?.getRender()?.frame, focused: document.activeElement?.textContent, capture: probe.__CAPTURE_FAKE__?.calls };
  }), null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('screen.png') });
  await info.attach('browser-messages', { body: JSON.stringify({ errors: pageErrors.get(page), console: pageConsole.get(page), url: page.url() }, null, 2), contentType: 'application/json' });
  if (info.status !== info.expectedStatus) {
    const health = [];
    for (const url of ['http://127.0.0.1:4398/', 'http://127.0.0.1:4399/rooms']) {
      try {
        const response = await page.request.get(url, { timeout: 5000 });
        health.push({ url, status: response.status(), body: url.endsWith('/rooms') ? await response.text() : 'HTTP app response' });
      } catch (error) { health.push({ url, error: String(error) }); }
    }
    await info.attach('local-authority-health', { body: JSON.stringify(health, null, 2), contentType: 'application/json' });
  }
  expect(pageErrors.get(page) ?? [], 'Browser page errors').toEqual([]);
});

test('controller Start opens the real multiplayer pause menu', async ({ page }) => {
  let initialCreateTickets = 0;
  page.on('request', request => {
    if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/tickets') return;
    const body: unknown = request.postDataJSON();
    if (body && typeof body === 'object' && 'action' in body && body.action === 'create'
      && (!('reconnect' in body) || body.reconnect !== true)) initialCreateTickets++;
  });
  await boot(page);
  await tap(page, 'start');
  await expect(paused(page)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('textbox', { name: 'Your room code' })).toHaveValue(/^[A-Z0-9]{6}$/);
  expect(initialCreateTickets, 'One initial room create across React StrictMode').toBe(1);
  await test.info().attach('initial-create-count', { body: JSON.stringify({ initialCreateTickets }), contentType: 'application/json' });
  const before = await page.evaluate(() => (window as unknown as Probe).__WRECK_YARD_CONTROLLER__.getRender()!.frame);
  await expect.poll(() => page.evaluate(() => (window as unknown as Probe).__WRECK_YARD_CONTROLLER__.getRender()!.frame)).toBeGreaterThan(before + 3);
  await tap(page, 'start');
  await expect(paused(page)).toHaveCount(0);
});

test('controller LS reaches the real input producer with bounded integer movement', async ({ page }) => {
  await boot(page);
  const before = await player(page);
  await clearSamples(page);
  await axes(page, [.8, -.8, 0, 0]);
  await expect.poll(async () => { const value = await input(page); return [value.moveX, value.moveZ]; }, { timeout: 5000 }).toEqual([1, 1]);
  await expectSample(page, 'moveX', 1);
  await expectSample(page, 'moveZ', 1);
  await expect.poll(async () => { const after = await player(page); return Math.hypot(after.position[0] - before.position[0], after.position[2] - before.position[2]); }).toBeGreaterThan(.15);
  await axes(page, [.05, -.05, 0, 0]);
  await expect.poll(async () => { const value = await input(page); return [value.moveX, value.moveZ]; }).toEqual([0, 0]);
  await axes(page, [-.8, .8, 0, 0]);
  await expect.poll(async () => { const value = await input(page); return [value.moveX, value.moveZ]; }).toEqual([-1, -1]);
  await axes(page, [0, 0, 0, 0]);
});

test('controller look, tools, and actions reach the real sampler', async ({ page }) => {
  await boot(page);
  const beforeLook = await input(page);
  await axes(page, [0, 0, .7, -.6]);
  await expect.poll(async () => Math.abs((await input(page)).yaw - beforeLook.yaw)).toBeGreaterThan(20);
  await expect.poll(async () => Math.abs((await input(page)).pitch - beforeLook.pitch)).toBeGreaterThan(20);
  await axes(page, [0, 0, 0, 0]);
  await tap(page, 'rb');
  await expect.poll(async () => (await input(page)).tool).toBe(1);
  await tap(page, 'lb');
  await expect.poll(async () => (await input(page)).tool).toBe(0);
  for (const [button, field] of [['rt', 'pressed'], ['lt', 'secondary'], ['x', 'use'], ['b', 'drop']] as const) {
    await clearSamples(page);
    await setButton(page, button, true);
    await expectSample(page, field, true);
    await setButton(page, button, false);
    await frames(page);
    await expect.poll(async () => (await input(page))[field]).toBe(false);
  }
  const beforeJet = await player(page);
  await clearSamples(page);
  await setButton(page, 'a', true);
  await expectSample(page, 'jetpack', true);
  await expect.poll(async () => (await player(page)).fuel).toBeLessThan(beforeJet.fuel - .01);
  await setButton(page, 'a', false);
  await tap(page, 'select');
  await expect(page.getByRole('button', { name: 'Orbit (O)' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await input(page)).tool).toBe(2);
  await tap(page, 'select');
  await expect(page.getByRole('button', { name: 'Gravity Gun (1)' })).toHaveAttribute('aria-pressed', 'true');
});

test('controller enters and resumes without pointer capture', async ({ page }) => {
  await boot(page, 'fake');
  await expect(page.getByRole('button', { name: 'Click to play', exact: true })).toBeVisible();
  await tap(page, 'a');
  await expect(page.locator('[data-gate-view]')).toHaveCount(0);
  await expectNeutral(page);
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Capture mouse', exact: true })).toHaveCount(0);
  await tap(page, 'start');
  await expect(paused(page)).toBeVisible();
  await expect(paused(page).getByRole('button', { name: 'Fullscreen', exact: true })).toHaveCount(0);
  await expect(paused(page).getByRole('button', { name: 'Capture mouse', exact: true })).toHaveCount(0);
  await tap(page, 'b');
  await expect(paused(page)).toHaveCount(0);
  const capture = await page.evaluate(() => (window as unknown as Probe).__CAPTURE_FAKE__!.calls);
  expect(capture.filter(call => /(?:requestFullscreen|setPointerLock):true/.test(call))).toEqual([]);
});

test('controller requires neutral input after connect, pause, disconnect, and DOM focus events', async ({ page }) => {
  await boot(page, 'off', 'rt');
  await expectNeutral(page, 'connect-held');
  await setButton(page, 'rt', false); await frames(page);
  await setButton(page, 'rt', true);
  await expect.poll(async () => (await input(page)).pressed).toBe(true);
  await tap(page, 'start');
  await expect(paused(page)).toBeVisible();
  await expectNeutral(page, 'paused-held');
  // Keep RT held across resume. The menu must still accept Start.
  await tap(page, 'start');
  await expect(paused(page)).toHaveCount(0);
  await expectNeutral(page, 'resumed-held');
  await setButton(page, 'rt', false); await frames(page);
  await setButton(page, 'rt', true);
  await expect.poll(async () => (await input(page)).pressed).toBe(true);
  await page.evaluate(() => { const pad = (window as unknown as Probe).__YARD_TEST_PAD__; pad.connected = false; pad.timestamp++; });
  await expectNeutral(page, 'disconnect-held');
  await expect(paused(page)).toBeVisible();
  await page.evaluate(() => { const pad = (window as unknown as Probe).__YARD_TEST_PAD__; pad.connected = true; pad.timestamp++; });
  await frames(page, 10);
  await expectNeutral(page, 'reconnect-held');
  await setButton(page, 'rt', false); await frames(page);
  await tap(page, 'start');
  await expect(paused(page)).toHaveCount(0);
  await setButton(page, 'rt', true);
  await expect.poll(async () => (await input(page)).pressed).toBe(true);
  // Headless tab activation does not change focus. Test the DOM event boundary.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expectNeutral(page, 'DOM blur while held');
  await expect(paused(page)).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await frames(page, 10);
  await expectNeutral(page, 'DOM focus restored while held');
  await tap(page, 'start');
  await expect(paused(page)).toHaveCount(0);
  await expectNeutral(page, 'resume after DOM focus while held');
  await setButton(page, 'rt', false); await frames(page);
  await setButton(page, 'rt', true);
  await expect.poll(async () => (await input(page)).pressed).toBe(true);
  await setButton(page, 'rt', false);
});

test('controller changes and saves a sound slider', async ({ page }) => {
  await boot(page);
  await tap(page, 'start');
  const slider = page.getByRole('slider', { name: 'Ambience' });
  await focusButton(page, slider);
  const before = Number(await slider.inputValue());
  const direction = before < 90 ? 'right' : 'left';
  await tap(page, direction);
  const changed = Number(await slider.inputValue());
  expect(changed).toBe(direction === 'right' ? before + 1 : before - 1);
  await tap(page, 'b');
  await expect(paused(page)).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await frames(page, 20);
  await tap(page, 'start');
  await expect(paused(page)).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Ambience' })).toHaveValue(String(changed));
});

test('controller menu and keypad join a second real peer without text input', async ({ page, context }) => {
  test.setTimeout(120_000);
  await boot(page);
  await tap(page, 'start');
  const code = await page.getByRole('textbox', { name: 'Your room code' }).inputValue();
  const guest = await context.newPage();
  try {
    await guest.setViewportSize({ width: 390, height: 844 });
    await boot(guest);
    await tap(guest, 'start');
    await expect(paused(guest)).toBeVisible();
    await focusButton(guest, guest.getByRole('button', { name: 'Enter code', exact: true }));
    const firstFocus = await guest.evaluate(() => document.activeElement?.textContent);
    await axes(guest, [0, -.9, 0, 0]); await axes(guest, [0, 0, 0, 0]);
    expect(await guest.evaluate(() => document.activeElement?.textContent)).not.toBe(firstFocus);
    await activate(guest, guest.getByRole('button', { name: 'Enter code', exact: true }));
    const keypad = guest.getByRole('dialog', { name: 'Room code keypad' });
    await expect(keypad).toBeVisible();
    await tap(guest, 'b');
    await expect(keypad).toHaveCount(0);
    await activate(guest, guest.getByRole('button', { name: 'Enter code', exact: true }));
    await expect(keypad).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await activate(guest, keypad.getByRole('button', { name: 'A', exact: true }));
    await expect(guest.getByRole('textbox', { name: 'Join another room' })).toHaveValue('A');
    await activate(guest, keypad.getByRole('button', { name: '1', exact: true }));
    await expect(guest.getByRole('textbox', { name: 'Join another room' })).toHaveValue('A1');
    await activate(guest, keypad.getByRole('button', { name: 'Delete', exact: true }));
    await expect(guest.getByRole('textbox', { name: 'Join another room' })).toHaveValue('A');
    await activate(guest, keypad.getByRole('button', { name: 'Clear', exact: true }));
    await expect(guest.getByRole('textbox', { name: 'Join another room' })).toHaveValue('');
    for (const char of code) await activate(guest, keypad.getByRole('button', { name: char, exact: true }));
    await guest.screenshot({ path: test.info().outputPath('keypad.png') });
    await activate(guest, keypad.getByRole('button', { name: 'Join', exact: true }));
    await expect(guest.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await expect(page.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await tap(guest, 'start');
    await expect(guest.getByRole('textbox', { name: 'Your room code' })).toHaveValue(code);
    expect(await guest.evaluate(() => (window as unknown as Probe).__WRECK_YARD_CONTROLLER__.getRender()!.players.length)).toBe(4);
  } finally {
    await guest.screenshot({ path: test.info().outputPath('guest-final.png') });
    await test.info().attach('guest-state', { body: JSON.stringify({ errors: pageErrors.get(guest), console: pageConsole.get(guest), state: await guest.evaluate(() => ({ focus: document.activeElement?.outerHTML, html: document.body.innerHTML.slice(0, 3000), room: (() => { const value = (window as unknown as Probe).__WRECK_YARD_CONTROLLER__?.snapshot(); return value ? { status: value.status, roomCode: value.roomCode, error: value.error, errorDetails: value.errorDetails, crew: value.crew } : null; })() })) }, null, 2), contentType: 'application/json' });
    const errors = pageErrors.get(guest) ?? [];
    await guest.close();
    expect(errors, 'Guest browser page errors').toEqual([]);
  }
});
