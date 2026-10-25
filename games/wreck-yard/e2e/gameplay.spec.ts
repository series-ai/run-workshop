import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const touchOptions = {
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
};

function watch(page: Page, errors: string[]) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|webgl|runtime.*failed/i.test(message.text())) errors.push(message.text());
  });
}

async function touchLive(page: Page) {
  await expect(page.getByLabel('Move pad', { exact: true })).toBeVisible({ timeout: 45_000 });
}

async function pause(page: Page) {
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await expect(page.getByRole('region', { name: 'Paused', exact: true })).toBeVisible();
}

async function roomCode(page: Page) {
  const code = await page.getByRole('textbox', { name: 'Your room code' }).inputValue();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}

async function join(page: Page, code: string) {
  await page.getByRole('textbox', { name: /^Join (?:another room|a room)$/ }).fill(code);
  await page.getByRole('button', { name: 'Join', exact: true }).tap();
  await touchLive(page);
}

async function holdTouch(page: Page, context: BrowserContext, label: string, durationMs: number) {
  const box = await page.getByLabel(label, { exact: true }).boundingBox();
  if (!box) throw new Error(`Control is not visible: ${label}`);
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForTimeout(durationMs);
  } finally {
    try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    finally { await cdp.detach(); }
  }
}

test('a desktop room accepts a touch peer, releases Jet, and supports leave and rejoin', async ({ page: host, browser, baseURL }) => {
  const errors: string[] = [];
  watch(host, errors);
  await host.goto('/?quality=low');
  await expect(host.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect(host.getByRole('button', { name: 'Click to play', exact: true })).toBeVisible();
  const code = (await host.locator('.yard-tape').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  const context = await browser.newContext({ ...touchOptions, baseURL, permissions: ['clipboard-read', 'clipboard-write'] });
  try {
    const guest = await context.newPage();
    watch(guest, errors);
    const url = `/?room=${code.toLowerCase()}&controls=touch&quality=low`;
    await guest.goto(url);
    await touchLive(guest);
    await expect(host.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await guest.bringToFront();
    await holdTouch(guest, context, 'Jet', 1200);
    const fuel = guest.locator('[aria-label^="Jet fuel "]');
    await expect.poll(async () => Number((await fuel.getAttribute('aria-label'))?.match(/\d+/)?.[0] ?? 100)).toBeLessThan(100);
    const usedFuel = Number((await fuel.getAttribute('aria-label'))!.match(/\d+/)![0]);
    await expect.poll(async () => Number((await fuel.getAttribute('aria-label'))?.match(/\d+/)?.[0] ?? 0), { timeout: 15_000 }).toBeGreaterThan(usedFuel);
    await guest.getByLabel('Equip torch', { exact: true }).tap();
    await expect(guest.getByLabel('Cut', { exact: true })).toBeVisible();
    await guest.getByLabel('Cut', { exact: true }).tap();
    await guest.getByLabel('Equip gravity gun', { exact: true }).tap();
    await expect(guest.getByLabel('Grab', { exact: true })).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await pause(guest);
    expect(await roomCode(guest)).toBe(code);
    await guest.getByRole('button', { name: 'Copy code', exact: true }).tap();
    await expect(guest.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    expect(await guest.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await guest.getByRole('button', { name: 'Leave match', exact: true }).tap();
    await expect(guest.getByRole('button', { name: 'New room', exact: true })).toBeVisible();
    await expect(host.locator('.yard-crew')).toHaveText('Crew 1/4', { timeout: 45_000 });
    await join(guest, code);
    await expect(host.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await pause(guest);
    expect(await roomCode(guest)).toBe(code);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('an invalid URL join retries and recovers to a new room', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...touchOptions, baseURL });
  const errors: string[] = [];
  try {
    const page = await context.newPage();
    watch(page, errors);
    await page.goto('/?room=INVALID&controls=touch&quality=low');
    const error = page.getByRole('alertdialog');
    await expect(error).toBeVisible({ timeout: 45_000 });
    await error.getByRole('button', { name: 'Retry', exact: true }).tap();
    await expect(error).toBeVisible({ timeout: 45_000 });
    await error.getByRole('button', { name: 'New room', exact: true }).tap();
    await touchLive(page);
    await expect(error).toHaveCount(0);
    await pause(page);
    const first = await roomCode(page);
    await page.getByRole('button', { name: 'Leave match', exact: true }).tap();
    await page.getByRole('button', { name: 'New room', exact: true }).tap();
    await touchLive(page);
    await pause(page);
    expect(await roomCode(page)).not.toBe(first);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Pause records, stops, and saves a local performance report', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 844, height: 390 }, hasTouch: true, acceptDownloads: true });
  const errors: string[] = [];
  try {
    const page = await context.newPage();
    watch(page, errors);
    await page.goto('/?controls=touch&quality=low');
    await touchLive(page);
    await pause(page);
    await page.getByText('Performance capture', { exact: true }).tap();
    await page.getByRole('button', { name: 'Record performance', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Resume(?: fullscreen)?$/ }).tap();
    await touchLive(page);
    await holdTouch(page, context, 'Jet', 700);
    await pause(page);
    await page.getByText('Performance capture', { exact: true }).tap();
    await page.getByRole('button', { name: 'Stop recording', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toHaveCount(0);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save report', exact: true }).tap();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^wreck-yard-performance-\d+\.json$/);
    const path = await download.path();
    if (!path) throw new Error('The performance report download has no file.');
    const report = JSON.parse(await readFile(path, 'utf8'));
    expect(report.schemaVersion).toBe(1);
    expect(report.totalRecords).toBeGreaterThan(0);
    expect(report.elapsedMs).toBeGreaterThan(0);
    expect(report.elapsedMs).toBeLessThanOrEqual(60_000);
    expect(report.phaseSummary['frame.pump'].count).toBeGreaterThan(0);
    expect(report.counterSummary['webgl.calls'].max).toBeGreaterThan(0);
    await testInfo.attach('performance-report', { path, contentType: 'application/json' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

type TestPad = { buttons: { pressed: boolean; touched: boolean; value: number }[]; timestamp: number };
type PadWindow = Window & { yardTestPad: TestPad };

async function pressPad(page: Page, button: number) {
  await page.evaluate(button => {
    const pad = (window as PadWindow).yardTestPad;
    pad.buttons[button] = { pressed: true, touched: true, value: 1 };
    pad.timestamp++;
  }, button);
  await page.waitForTimeout(300);
  await page.evaluate(button => {
    const pad = (window as PadWindow).yardTestPad;
    pad.buttons[button] = { pressed: false, touched: false, value: 0 };
    pad.timestamp++;
  }, button);
  await page.waitForTimeout(300);
}

test('a controller enters play, changes tools, and pauses without mouse capture', async ({ page }) => {
  const errors: string[] = [];
  watch(page, errors);
  await page.addInitScript(() => {
    const pad = { id: 'Wreck Yard test controller', index: 0, connected: true, mapping: 'standard', timestamp: 1,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: null };
    (window as PadWindow).yardTestPad = pad;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/?quality=low');
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('A Play · Dpad Navigate', { exact: true })).toBeVisible();
  await pressPad(page, 0);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await pressPad(page, 5);
  await expect(page.getByRole('button', { name: 'Plasma Torch (2)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pressPad(page, 9);
  await expect(page.getByRole('region', { name: 'Paused', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toHaveCount(0);
  await pressPad(page, 9);
  await expect(page.getByRole('region', { name: 'Paused', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => ({ fullscreen: Boolean(document.fullscreenElement), pointer: Boolean(document.pointerLockElement) })))
    .toEqual({ fullscreen: false, pointer: false });
  expect(errors).toEqual([]);
});
