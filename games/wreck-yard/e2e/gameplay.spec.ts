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

async function playerAvatarSlots(page: Page, visibleOnly = false): Promise<number[]> {
  return page.evaluate(async (visibleOnly) => {
    const moduleUrl = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/@react-three_fiber.js'))?.name;
    if (!moduleUrl) throw new Error('The scene module is not loaded.');
    const { _roots } = await import(/* @vite-ignore */ moduleUrl);
    const scene = _roots.get(document.querySelector('canvas'))?.store.getState().scene;
    if (!scene) throw new Error('The game scene is not mounted.');
    const slots: number[] = [];
    scene.traverse((object: { name: string; visible: boolean; userData: { slot?: number } }) => {
      if (/^player-robot-\d+$/.test(object.name) && typeof object.userData.slot === 'number'
        && (!visibleOnly || object.visible)) slots.push(object.userData.slot);
    });
    return slots.sort((a, b) => a - b);
  }, visibleOnly);
}

async function liquidAssetsScene(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/@react-three_fiber.js'))?.name;
    if (!moduleUrl) throw new Error('The scene module is not loaded.');
    const { _roots } = await import(/* @vite-ignore */ moduleUrl);
    const scene = _roots.get(document.querySelector('canvas'))?.store.getState().scene;
    if (!scene) throw new Error('The game scene is not mounted.');
    const basin = scene.getObjectByName('liquid-assets-lava');
    const hand = scene.getObjectByName('voxel-body-lava-hand');
    const geometryIds: string[] = [];
    hand?.traverse((object: { isMesh?: boolean; geometry?: { uuid: string } }) => {
      if (object.isMesh && object.geometry) geometryIds.push(object.geometry.uuid);
    });
    const result = {
      basin: Boolean(basin),
      surface: Boolean(basin?.getObjectByName('lava-surface')),
      hand: Boolean(hand),
      geometryIds: geometryIds.sort(),
    };
    return result;
  });
}

async function roadScene(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').find((entry) => entry.name.includes('/@react-three_fiber.js'))?.name;
    if (!moduleUrl) throw new Error('The scene module is not loaded.');
    const { _roots } = await import(/* @vite-ignore */ moduleUrl);
    const scene = _roots.get(document.querySelector('canvas'))?.store.getState().scene;
    const position = (name: string): number[] | null => scene?.getObjectByName(name)?.position.toArray() ?? null;
    const button = scene?.getObjectByName('Button-reset-car')?.children[0]?.position.toArray() ?? null;
    return { player: position('player-robot-0'), car: position('voxel-body-vehicle-chassis'), magnet: position('road-magnetic-claw'),
      worker: Boolean(scene?.getObjectByName('voxel-body-road-worker')), belt: Boolean(scene?.getObjectByName('road-supply-belt-surface')), button };
  });
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

test('Liquid Assets renders lava and updates the surviving hand during erosion', async ({ page }) => {
  const errors: string[] = [];
  watch(page, errors);
  await page.goto('/?quality=low');
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect.poll(async () => {
    const scene = await liquidAssetsScene(page);
    return { basin: scene.basin, surface: scene.surface, hand: scene.hand, mesh: scene.geometryIds.length > 0 };
  }).toEqual({ basin: true, surface: true, hand: true, mesh: true });
  const initial = await liquidAssetsScene(page);
  await expect.poll(async () => {
    const scene = await liquidAssetsScene(page);
    return scene.hand && scene.geometryIds.length > 0
      && scene.geometryIds.join(',') !== initial.geometryIds.join(',');
  }, { timeout: 15_000, intervals: [100, 250, 500] }).toBe(true);
  const surviving = await liquidAssetsScene(page);
  expect(surviving.hand).toBe(true);
  expect(surviving.geometryIds.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a short reset key tap calls the claw and delivers a car', async ({ page }) => {
  const errors: string[] = [];
  watch(page, errors);
  await page.goto('/?controls=touch&quality=low');
  await touchLive(page);
  const initial = await roadScene(page);
  expect(initial.worker && initial.belt && initial.button && initial.magnet && initial.car).toBeTruthy();
  const target = initial.button!;
  await page.keyboard.down('Space');
  await page.waitForTimeout(1800);
  await page.keyboard.up('Space');
  try {
    for (const [axis, key, reached] of [
      [0, 'KeyD', (value: number) => value > target[0]! - 0.3],
      [2, 'KeyW', (value: number) => value < target[2]! + 0.4],
    ] as const) {
      await page.keyboard.down(key);
      for (let step = 0; step < 80; step++) {
        const position = (await roadScene(page)).player!;
        if (reached(position[axis]!)) break;
        if (position[1]! < 8) await page.keyboard.down('Space');
        else if (position[1]! > 12) await page.keyboard.up('Space');
        await page.waitForTimeout(100);
      }
      await page.keyboard.up(key);
      await page.keyboard.up('Space');
    }
  } finally {
    for (const key of ['Space', 'KeyD', 'KeyW']) await page.keyboard.up(key);
  }
  await page.waitForTimeout(2500);
  for (let pass = 0; pass < 4; pass++) {
    for (const axis of [0, 2] as const) {
      const start = (await roadScene(page)).player!;
      const error = target[axis]! - start[axis]!;
      if (Math.abs(error) < 0.7) continue;
      const direction = Math.sign(error);
      const key = axis === 0 ? (direction > 0 ? 'KeyD' : 'KeyA') : (direction > 0 ? 'KeyS' : 'KeyW');
      await page.keyboard.down(key);
      try {
        for (let step = 0; step < 50; step++) {
          const position = (await roadScene(page)).player!;
          if ((target[axis]! - position[axis]!) * direction < 0.8) break;
          await page.waitForTimeout(100);
        }
      } finally { await page.keyboard.up(key); }
      await page.waitForTimeout(650);
    }
    const position = (await roadScene(page)).player!;
    if (Math.hypot(position[0]! - target[0]!, position[2]! - target[2]!) < 1.6 && position[1]! - target[1]! < 1) break;
  }
  const atButton = (await roadScene(page)).player!;
  expect(Math.hypot(atButton[0]! - target[0]!, atButton[2]! - target[2]!)).toBeLessThan(2.5);
  // Both events occur before the browser can sample another frame.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
  });
  await expect.poll(async () => (await roadScene(page)).car![0]!, { timeout: 5000 }).toBeGreaterThan(initial.car![0]! + 3);
  await expect.poll(async () => (await roadScene(page)).magnet![0]!, { timeout: 5000 }).toBeLessThan(initial.magnet![0]! - 2);
  await expect.poll(async () => {
    const scene = await roadScene(page);
    return Math.hypot(scene.car![0]! - initial.car![0]!, scene.car![2]! - initial.car![2]!) < 0.8
      && scene.car![1]! < initial.car![1]! + 0.5
      && Math.hypot(...scene.magnet!.map((value, axis) => value - initial.magnet![axis]!)) < 0.1;
  }, { timeout: 8000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('a desktop room accepts a touch peer, releases Jet, and supports leave and rejoin', async ({ page: host, browser, baseURL }) => {
  const errors: string[] = [];
  watch(host, errors);
  await host.goto('/?quality=low');
  await expect(host.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect(host.getByRole('button', { name: 'Click to play', exact: true })).toBeVisible();
  await expect.poll(() => playerAvatarSlots(host)).toHaveLength(1);
  await expect.poll(() => playerAvatarSlots(host, true)).toEqual([]);
  const hostSlot = (await playerAvatarSlots(host))[0]!;
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
    await expect.poll(() => playerAvatarSlots(host)).toHaveLength(2);
    await expect.poll(() => playerAvatarSlots(guest)).toEqual(await playerAvatarSlots(host));
    const guestSlot = (await playerAvatarSlots(host)).find((slot) => slot !== hostSlot)!;
    await expect.poll(() => playerAvatarSlots(host, true)).toEqual([guestSlot]);
    await expect.poll(() => playerAvatarSlots(guest, true)).toEqual([hostSlot]);
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
    await expect.poll(() => playerAvatarSlots(host)).toEqual([hostSlot]);
    await expect.poll(() => playerAvatarSlots(host, true)).toEqual([]);
    await join(guest, code);
    await expect(host.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await expect.poll(() => playerAvatarSlots(host)).toHaveLength(2);
    await pause(guest);
    expect(await roomCode(guest)).toBe(code);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('a touch peer can join a room after its first minute', async ({ page: host, browser, baseURL }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  watch(host, errors);
  await host.goto('/?quality=low');
  await expect(host.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  const code = (await host.locator('.yard-tape').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await host.waitForTimeout(65_000);

  const context = await browser.newContext({ ...touchOptions, baseURL });
  try {
    const guest = await context.newPage();
    watch(guest, errors);
    await guest.goto(`/?room=${code}&controls=touch&quality=low`);
    await touchLive(guest);
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
