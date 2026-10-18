import { expect, test, type Page } from '@playwright/test';

/** The fake capture port (src/game/capturePort.ts) that ?capture=fake puts on window. */
type Fake = {
  emit(state: { active: boolean; pointerLocked: boolean }): void;
  respond(result: { active: boolean; pointerLocked: boolean; reason?: string }): void;
  calls: string[];
};

const emit = (page: Page, active: boolean, pointerLocked: boolean) =>
  page.evaluate(([a, l]) => (window as unknown as { __CAPTURE_FAKE__: Fake }).__CAPTURE_FAKE__.emit({ active: a, pointerLocked: l }), [active, pointerLocked] as const);
const calls = (page: Page) => page.evaluate(() => [...(window as unknown as { __CAPTURE_FAKE__: Fake }).__CAPTURE_FAKE__.calls]);
const refuseNext = (page: Page) =>
  page.evaluate(() => (window as unknown as { __CAPTURE_FAKE__: Fake }).__CAPTURE_FAKE__.respond({ active: true, pointerLocked: false, reason: 'refused' }));

test('start plate, pause menu, resume, leave, and the drag-look fallback', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto('/?capture=fake', { waitUntil: 'networkidle' });

  // Start plate over the running yard.
  const gate = page.locator('[data-gate-view]');
  await expect(gate).toHaveAttribute('data-gate-view', 'start', { timeout: 15_000 });
  await expect(gate).toContainText('a multiplayer demo of the RUN Syncplay engine');
  await page.getByRole('button', { name: 'Click to play' }).click();
  await expect(gate).toHaveCount(0);
  expect(await calls(page)).toEqual(['requestFullscreen:true']);

  // Escape once: fullscreen with a free cursor opens the pause menu.
  await emit(page, true, false);
  await expect(gate).toHaveAttribute('data-gate-view', 'paused');
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await expect(gate).toContainText('Esc again: leave fullscreen');
  await expect(page.getByRole('navigation', { name: 'Tools' })).toHaveCount(0);

  // Escape twice: windowed, the menu stays, and Resume enters fullscreen again.
  await emit(page, false, false);
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume fullscreen' }).click();
  await expect(gate).toHaveCount(0);
  expect((await calls(page)).at(-1)).toBe('requestFullscreen:true');

  // Leave Match from the pause menu: the match menu shows with no gate over it.
  await emit(page, true, false);
  await page.getByRole('button', { name: 'Leave match' }).click();
  await expect(page.getByRole('button', { name: 'New room' })).toBeVisible();
  await expect(gate).toHaveCount(0);

  // New room captures in the same click, then the match goes live.
  await page.getByRole('button', { name: 'New room' }).click();
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 15_000 });
  await expect(gate).toHaveCount(0);
  expect(await calls(page)).toContain('setPointerLock:true');

  // Two refusals offer drag-to-look; that plays at once, and "Capture mouse" comes back.
  await emit(page, true, false);
  await refuseNext(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(gate).toContainText('Click Resume again');
  await refuseNext(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Play in a window (drag to look)' }).click();
  await expect(gate).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Capture mouse' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('four warm room starts keep the menu, capture, and simulation active', async ({ page }) => {
  const pageErrors: string[] = [];
  const cycles: Array<{ cycle: number; beforeCalls: number; startFrame?: number; endFrame?: number; captureCalls?: string[] }> = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto('/?capture=fake', { waitUntil: 'networkidle' });
  const gate = page.locator('[data-gate-view]');
  await expect(page.getByRole('button', { name: 'Click to play', exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Click to play', exact: true }).click();
  await expect(gate).toHaveCount(0);
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 15_000 });

  type WarmWindow = Window & {
    __CAPTURE_FAKE__: Fake & { getState(): Promise<{ active: boolean; pointerLocked: boolean }> };
    __WRECK_YARD_CONTROLLER__: { getRender(): { frame: number } | null; isPaused(): boolean };
  };
  const frame = () => page.evaluate(() => (window as WarmWindow).__WRECK_YARD_CONTROLLER__.getRender()?.frame ?? -1);

  try {
    for (let cycle = 1; cycle <= 4; cycle++) {
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Leave match', exact: true }).click();
      const play = page.getByRole('button', { name: 'New room', exact: true });
      await expect(play, `cycle ${cycle}: the match menu must return`).toBeVisible({ timeout: 10_000 });
      const record: (typeof cycles)[number] = { cycle, beforeCalls: (await calls(page)).length };
      cycles.push(record);
      await play.click();
      await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 15_000 });
      await expect(gate, `cycle ${cycle}: a successful capture must keep the gate closed`).toHaveCount(0);
      record.startFrame = await frame();
      expect(record.startFrame).toBeGreaterThanOrEqual(0);
      await expect.poll(frame, { message: `cycle ${cycle}: the real simulation must advance`, timeout: 10_000 })
        .toBeGreaterThan(record.startFrame + 5);
      record.endFrame = await frame();
      expect(await page.evaluate(() => (window as WarmWindow).__WRECK_YARD_CONTROLLER__.isPaused())).toBe(false);
      expect(await page.evaluate(() => (window as WarmWindow).__CAPTURE_FAKE__.getState()))
        .toEqual({ active: true, pointerLocked: true });
      record.captureCalls = (await calls(page)).slice(record.beforeCalls);
      expect(record.captureCalls.some(call => call === 'setPointerLock:true' || call === 'requestFullscreen:true')).toBe(true);
      expect(record.captureCalls, `cycle ${cycle}: start must not release its accepted capture`).not.toContain('setPointerLock:false');
      expect(record.captureCalls).not.toContain('exitFullscreen');
      await expect(gate).toHaveCount(0);
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await test.info().attach('warm-room-starts', { body: JSON.stringify({ cycles, calls: await calls(page), pageErrors }, null, 2), contentType: 'application/json' });
  }
});

test('Orbit can pause and resume without another capture request', async ({ page }) => {
  await page.goto('/?capture=fake&quality=low');
  await page.getByRole('button', { name: 'Click to play' }).click();
  const orbit = page.getByRole('button', { name: 'Orbit (O)', exact: true });
  await orbit.click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your room code' })).toBeVisible();
  const before = await calls(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(orbit).toHaveAttribute('aria-pressed', 'true');
  expect(await calls(page)).toEqual(before);
});

test('a refused capture cannot enable Join during a pending connection', async ({ page }) => {
  let release = () => {};
  const ready = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.goto('/?capture=fake&quality=low');
    await page.getByRole('button', { name: 'Click to play' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('textbox', { name: 'Join another room' }).fill('INVALID');
    await page.route('**/tickets', async route => { await ready; await route.continue(); });
    await refuseNext(page);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByText('Connecting to the room…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  } finally { release(); }
});
