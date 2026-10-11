// Drive the live game with Chrome touchscreen events.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const output = new URL('../test-results/touch-controls/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { status: 'running', scope: process.env.AUDIT_SECTION === 'tools' ? 'tools' : 'full' };
let activePage;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const page = await context.newPage();
  activePage = page;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35, null, { timeout: 60000 });
  await page.getByLabel('Move pad', { exact: true }).waitFor();
  const input = () => page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.input);
  const local = () => page.evaluate(() => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    return render.players.find((player) => player.slot === render.localSlot);
  });
  const ticks = (n = 3) => page.waitForTimeout(n * 34);
  const cdp = await context.newCDPSession(page);
  const fingers = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers.values()] });
  const downAt = async (x, y, id) => {
    fingers.set(id, { x, y, id });
    await send('touchStart');
  };
  const down = async (label, id) => {
    const box = await page.getByLabel(label, { exact: true }).boundingBox();
    assert.ok(box, `${label} missing`);
    fingers.set(id, { x: box.x + box.width / 2, y: box.y + box.height * (label === 'Look pad' ? 0.2 : 0.5), id });
    await send('touchStart');
  };
  const move = async (id, dx, dy) => {
    const point = fingers.get(id);
    Object.assign(point, { x: point.x + dx, y: point.y + dy });
    await send('touchMove');
  };
  const up = async (id, wait = true) => { const point = fingers.get(id); fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [point] }); if (wait) await ticks(); };
  const tap = async (label, id = 90) => { await down(label, id); await up(id, false); };
  const stats = () => page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().stats);
  const reset = async () => {
    if (fingers.size) await cancel();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35, null, { timeout: 60000 });
    await page.getByLabel('Move pad', { exact: true }).waitFor();
  };
  const cancel = async () => { fingers.clear(); await send('touchCancel'); await ticks(); };
  const neutral = async () => {
    const value = await input();
    assert.equal(value.moveX, 0); assert.equal(value.moveZ, 0);
    for (const key of ['pressed', 'secondary', 'jetpack', 'use']) assert.equal(value[key], false, `${key} stuck`);
  };
  const walkTo = async (goal, stopDistance) => {
    let last = null;
    let stalled = 0;
    let jetHeld = false;
    await down('Move pad', 30); await move(30, 0, -40);
    for (let step = 0; step < 240; step += 1) {
      const [player, buggy] = await page.evaluate(() => {
        const render = window.__WRECK_YARD_CONTROLLER__.getRender();
        return [render.players.find((entry) => entry.slot === render.localSlot).position, render.poses.get('vehicle-chassis').position];
      });
      const target = goal ?? [buggy[0], buggy[2]];
      const dx = target[0] - player[0], dz = target[1] - player[2];
      if (Math.hypot(dx, dz) < stopDistance) break;
      stalled = last && Math.hypot(player[0] - last[0], player[2] - last[2]) < 0.025 ? stalled + 1 : 0;
      last = player;
      if (!jetHeld && stalled >= 3) { await down('Jet', 29); jetHeld = true; }
      if (jetHeld && player[1] > 3) { await up(29); jetHeld = false; }
      await page.evaluate(([x, z, offset]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z) + offset, 0), [dx, dz, stalled >= 3 ? 1.2 : 0]);
      await ticks(3);
    }
    await up(30);
    if (jetHeld) await up(29);
    await ticks(25);
  };
  if (process.env.AUDIT_SECTION !== 'tools') {
    // Movement, look, and thrust use independent fingers.
    const start = (await local()).position;
    await down('Move pad', 1); await move(1, 0, -40);
    await down('Look pad', 2); const yaw = (await input()).yaw; await move(2, 45, -15);
    await down('Jet', 3); await ticks(8);
    assert.equal((await input()).moveZ, 1);
    assert.equal((await input()).jetpack, true);
    assert.equal((await input()).pressed, false, 'Look touch fired the tool');
    assert.ok(Math.abs((await input()).yaw - yaw) > 50);
    const after = (await local()).position;
    assert.ok(Math.hypot(after[0] - start[0], after[2] - start[2]) > 0.4);
    assert.ok(after[1] > start[1] + 0.2);
    await up(2); assert.equal((await input()).moveZ, 1);
    await up(3); assert.equal((await input()).moveZ, 1); assert.equal((await input()).jetpack, false);
    await up(1); await neutral();
    results.threeFingers = { start, after };

    // The stick starts at the thumb position, with no movement on touchdown.
    const moveBox = await page.getByLabel('Move pad', { exact: true }).boundingBox();
    const anchor = { x: moveBox.x + 42, y: moveBox.y + 80 };
    await downAt(anchor.x, anchor.y, 4); await ticks();
    assert.equal((await input()).moveX, 0); assert.equal((await input()).moveZ, 0);
    const stickBox = await page.locator('.yard-touch-stick').boundingBox();
    assert.ok(Math.abs(stickBox.x + stickBox.width / 2 - anchor.x) < 2, 'Stick did not anchor at thumb X');
    assert.ok(Math.abs(stickBox.y + stickBox.height / 2 - anchor.y) < 2, 'Stick did not anchor at thumb Y');
    await move(4, 0, -40); await ticks(); assert.equal((await input()).moveZ, 1);
    await up(4); await neutral(); results.joystickAnchor = { anchor, stickBox };

    // A right-edge drag only aims. It cannot fire or move the player.
    const lookBox = await page.getByLabel('Look pad', { exact: true }).boundingBox();
    const lookYaw = (await input()).yaw;
    await downAt(382, lookBox.y + 32, 5); await move(5, -80, 15); await ticks();
    assert.ok(Math.abs((await input()).yaw - lookYaw) > 200, 'Right-edge drag did not aim');
    await neutral(); await up(5);
    assert.equal(await page.getByText('Drag to look', { exact: true }).count(), 0);
    results.rightEdgeLook = true;

    await reset();
    // Swap cancels outside its target. Its label identifies the other tool.
    const swapText = await page.getByLabel('Equip torch', { exact: true }).innerText();
    assert.match(swapText, /Torch/i);
    await down('Equip torch', 6); await move(6, -150, -60); await up(6);
    assert.equal((await input()).tool, 0, 'Drag-off Swap changed tool');
    await tap('Equip torch'); await ticks();
    assert.equal(await page.getByLabel('Push', { exact: true }).count(), 0);
    assert.match(await page.getByLabel('Equip gravity gun', { exact: true }).innerText(), /Gravity/i);
    const cutStart = (await local()).position;
    const cutYaw = (await input()).yaw;
    await down('Move pad', 7); await move(7, 0, -40);
    await down('Cut', 8); await move(8, -120, -65); await ticks(9);
    const cutInput = await input();
    assert.equal(cutInput.tool, 1); assert.equal(cutInput.pressed, true); assert.equal(cutInput.moveZ, 1);
    assert.ok(Math.abs(cutInput.yaw - cutYaw) > 350, 'Primary drag outside Cut did not aim');
    const cutAfter = (await local()).position;
    assert.ok(Math.hypot(cutAfter[0] - cutStart[0], cutAfter[2] - cutStart[2]) > 0.4, 'Two-thumb Cut did not move');
    assert.equal(cutInput.secondary, false); assert.equal(cutInput.use, false);
    await up(8); assert.equal((await input()).moveZ, 1); await up(7); await neutral();
    // Tool changes clear the held Cut before gravity input starts.
    await down('Cut', 9); await ticks(); await tap('Equip gravity gun'); await ticks();
    assert.equal((await input()).pressed, false); assert.equal((await input()).tool, 0);
    await up(9); await neutral();
    // Swap clears weapon input while movement and Jet keep their owners.
    await down('Move pad', 17); await move(17, -35, -35); await ticks();
    await tap('Equip torch'); await ticks();
    assert.equal((await input()).moveX, -1); assert.equal((await input()).moveZ, 1);
    assert.equal((await input()).tool, 1); assert.equal((await input()).pressed, false);
    await down('Jet', 18); await ticks();
    await tap('Equip gravity gun'); await ticks();
    assert.equal((await input()).moveX, -1); assert.equal((await input()).moveZ, 1);
    assert.equal((await input()).jetpack, true, 'Swap released the Jet pointer');
    assert.equal((await input()).tool, 0); assert.equal((await input()).pressed, false);
    await up(18); assert.equal((await input()).moveZ, 1);
    await up(17); await neutral(); results.moveAndSwap = true;
    await down('Move pad', 7); await move(7, 35, -35); await down('Grab', 8); await ticks();
    await cancel(); await neutral();
    results.toolsAndCancel = { cutStart, cutAfter, dragOffSwap: true };

    await reset();
    // Move and Jet use two thumbs. The Jet thumb also aims outside its button.
    const jetYaw = (await input()).yaw;
    await down('Move pad', 15); await move(15, 0, -40);
    await down('Jet', 16); await move(16, -70, -35); await ticks(6);
    assert.equal((await input()).jetpack, true); assert.equal((await input()).moveZ, 1);
    assert.ok(Math.abs((await input()).yaw - jetYaw) > 200, 'Jet drag did not aim');
    assert.equal((await input()).secondary, false, 'Jet drag activated Push');
    await up(16); assert.equal((await input()).moveZ, 1);
    await up(15); await neutral(); results.twoThumbJet = true;

    // Losing capture releases the action even without a pointer up.
    await page.evaluate(() => {
      document.querySelector('.yard-touch-action--jetpack').addEventListener('pointerdown', (event) => { window.__TOUCH_TEST_POINTER__ = event.pointerId; }, { once: true });
    });
    const penBox = await page.getByLabel('Jet', { exact: true }).boundingBox();
    const pen = { x: penBox.x + penBox.width / 2, y: penBox.y + penBox.height / 2, pointerType: 'pen' };
    await cdp.send('Input.dispatchMouseEvent', { ...pen, type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { ...pen, x: pen.x + 1, type: 'mouseMoved', button: 'left', buttons: 1 });
    await ticks(); assert.equal((await input()).jetpack, true);
    await page.evaluate(() => document.querySelector('.yard-touch-action--jetpack').releasePointerCapture(window.__TOUCH_TEST_POINTER__));
    await cdp.send('Input.dispatchMouseEvent', { ...pen, x: pen.x + 10, type: 'mouseMoved', button: 'left', buttons: 1 });
    await ticks(); assert.equal((await input()).jetpack, false);
    await cdp.send('Input.dispatchMouseEvent', { ...pen, type: 'mouseReleased', button: 'left', clickCount: 1 });
    // Blur and viewport changes clear held input.
    await down('Move pad', 10); await move(10, 0, -40); await down('Jet', 11); await ticks();
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await ticks(); await neutral(); await cancel();
    await down('Jet', 12); await ticks(); await page.setViewportSize({ width: 844, height: 390 }); await ticks(); await neutral(); await cancel();
    assert.equal(await page.getByRole('button', { name: 'Orbit', exact: true }).count(), 0);
    assert.equal(await page.getByRole('navigation', { name: 'Tools' }).count(), 0);
    assert.equal(await page.locator('.yard-hud-top--touch .yard-switch').count(), 0);
    await page.getByLabel('Move pad', { exact: true }).waitFor();
    await neutral(); results.lifecycle = true;

    // Drag mode has a real solo pause, with no stale inputs on resume.
    for (let repeat = 0; repeat < 2; repeat += 1) {
      await down('Jet', 13); await ticks(); await page.getByRole('button', { name: 'Pause', exact: true }).tap();
      await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
      if (repeat === 0) await page.screenshot({ path: fileURLToPath(new URL('pause.png', output)) });
      await ticks(); await neutral();
      const frame = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().frame);
      await ticks(8); assert.equal(await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().frame), frame);
      await up(13);
      await page.getByRole('button', { name: 'Resume', exact: true }).tap(); await ticks(); await neutral();
    }
    results.pauseResume = true;
    // Walk to the real buggy with the touch pad. The test sets only the view.
    await ticks(30);
    await walkTo([10, 6], 0.5);
    await walkTo([10, -10], 0.5);
    await walkTo(null, 1.8);
    const distance = await page.evaluate(() => {
      const render = window.__WRECK_YARD_CONTROLLER__.getRender();
      const player = render.players.find((entry) => entry.slot === render.localSlot).position;
      const buggy = render.poses.get('vehicle-chassis').position;
      return Math.hypot(buggy[0] - player[0], buggy[2] - player[2]);
    });
    assert.ok(distance < 1.8, `Could not reach buggy: ${distance}`);
    // A canceled short Use tap must not mount the buggy. Stop the real solo
    // clock while Chrome delivers down/cancel, so the queue stays pending.
    await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
    await down('Use', 35); await cancel();
    await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(false));
    await ticks(5); assert.equal((await local()).ridingVehicle, false);
    // This is a short Use tap. It must survive until a sim tick reads it.
    await down('Use', 31); await up(31);
    await page.waitForFunction(() => {
      const render = window.__WRECK_YARD_CONTROLLER__.getRender();
      return render.players.find((entry) => entry.slot === render.localSlot).ridingVehicle;
    }, null, { timeout: 5000 });
    await page.getByLabel('Drive pad', { exact: true }).waitFor();
    assert.equal(await page.locator('.yard-touch-action--swap').count(), 0);
    assert.equal(await page.getByLabel('Jet', { exact: true }).count(), 0);
    assert.equal(await page.locator('.yard-touch-action--main').getAttribute('aria-label'), 'Exit');
    await page.screenshot({ path: fileURLToPath(new URL('driving.png', output)) });
    const buggyPosition = () => page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().poses.get('vehicle-chassis').position);
    const mounted = await buggyPosition();
    await down('Drive pad', 32); await move(32, 30, -40); await ticks(20);
    assert.equal((await input()).moveZ, 1); assert.equal((await input()).moveX, 1);
    await up(32);
    const driven = await buggyPosition();
    assert.ok(Math.hypot(driven[0] - mounted[0], driven[2] - mounted[2]) > 0.5);
    await down('Drive pad', 33); await move(33, 0, 40); await ticks(25);
    assert.equal((await input()).moveZ, -1); await up(33);
    await down('Exit', 34); await up(34); await ticks(8);
    assert.equal((await local()).ridingVehicle, false);
    results.buggy = { distance, mounted, driven, reverse: true, exited: true };

    for (const size of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size); await ticks();
      const contextUse = await page.locator('.yard-touch-context button').boundingBox();
      assert.ok(contextUse, 'Context Use missing near the buggy');
      assert.ok(Math.abs(contextUse.x + contextUse.width / 2 - size.width / 2) < 1, 'Use is not centered');
      if (size.width > size.height) {
        const movePad = await page.locator('.yard-touch-stick').boundingBox();
        const actionGroup = await page.locator('.yard-touch-actions').boundingBox();
        assert.ok(contextUse.x > movePad.x + movePad.width && contextUse.x + contextUse.width < actionGroup.x, 'Use overlaps a control group');
        assert.ok(contextUse.y > size.height * 0.7, 'Use blocks the landscape view');
      }
      assert.equal(await page.locator('.yard-touch-fuel .yard-fuel').isVisible(), false);
      const primary = await page.locator('.yard-touch-action--main').boundingBox();
      assert.ok(primary.width >= 90 && primary.height >= 90);
      const targets = await page.locator('.yard-touch-action,.yard-hud-top--touch button').evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect(); return { label: button.getAttribute('aria-label') || button.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
      for (const target of targets) {
        assert.ok(target.width >= 48 && target.height >= 48, `Small target: ${target.label}`);
        assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.width <= size.width + 1 && target.y + target.height <= size.height + 1, `Clipped target: ${target.label}`);
      }
      await page.screenshot({ path: fileURLToPath(new URL(`${size.width}.png`, output)) });
      results[`layout${size.width}`] = targets;
    }
    // A connected mouse hides the pads. Touch input restores them.
    await page.mouse.click(400, 110); await ticks();
    assert.equal(await page.getByLabel('Touch controls', { exact: true }).count(), 0);
    await page.mouse.move(400, 150); await page.mouse.down(); await page.mouse.move(460, 170); await ticks();
    assert.equal((await input()).pressed, true);
    await page.mouse.up(); await ticks(); assert.equal((await input()).pressed, false);
    await page.screenshot({ path: fileURLToPath(new URL('desktop1440.png', output)) });
    await page.touchscreen.tap(480, 150); await ticks();
    await page.getByLabel('Move pad', { exact: true }).waitFor(); await neutral();
    results.hybridMouse = true;
    console.log('Movement, lifecycle, driving, layout, and mouse checks passed.');
  }
  // These checks use props in the real WASM world.
  await page.setViewportSize({ width: 390, height: 844 });
  await reset();
  const aim = (target) => page.evaluate((point) => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    const dx = point[0] - player.position[0], dy = point[1] - player.position[1] - 1.55, dz = point[2] - player.position[2];
    window.__SET_LOOK_ANGLES__(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  }, target);
  const targets = () => page.evaluate(() => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    return render.bodies.filter((body) => body.motion === 'dynamic' && body.id !== 'vehicle-chassis').map((body) => {
      const position = render.poses.get(body.id).position;
      return { id: body.id, position, distance: Math.hypot(position[0] - player.position[0], position[2] - player.position[2]) };
    }).filter((body) => body.distance > 1 && body.distance < 8).sort((a, b) => a.distance - b.distance);
  });
  const acquire = async (keepFinger = false) => {
    for (const body of (await targets()).slice(0, 8)) {
      await aim(body.position); await ticks();
      const before = (await stats()).throws;
      // Stop only the simulation clock. Chrome still delivers a short tap.
      await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
      await down('Grab', 40);
      assert.equal(await page.getByLabel('Throw', { exact: true }).count(), 0, 'Throw appeared before Grab reached the game');
      if (!keepFinger) await up(40, false);
      await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(false));
      await ticks(9);
      const grabbed = (await local()).grabbing;
      if (grabbed) {
        await page.getByLabel('Throw', { exact: true }).waitFor();
        assert.equal((await stats()).throws, before, 'Original Grab gesture threw the prop');
        return grabbed;
      }
      if (keepFinger) await up(40);
      await ticks(3);
    }
    assert.fail('Touch Grab did not hold a real prop');
  };
  const verifyGrabAndThrow = async (key, screenshot) => {
    const grabbed = await acquire(true);
    const grabThrows = (await stats()).throws;
    await move(40, -40, -20); await ticks(3);
    assert.equal((await stats()).throws, grabThrows, 'Original Grab drag became Throw');
    await up(40); await ticks(9);
    assert.equal((await local()).grabbing, grabbed, 'Grab did not persist after thumb release');
    assert.equal((await input()).pressed, true, 'Persistent Grab lost primary latch');
    await page.screenshot({ path: fileURLToPath(new URL(screenshot, output)) });
    // The Throw gesture can be canceled without releasing the prop.
    await down('Throw', 41); await move(41, -70, -20); await cancel();
    assert.equal((await local()).grabbing, grabbed, 'Canceled Throw released the prop');
    assert.equal((await stats()).throws, grabThrows, 'Canceled Throw applied force');
    // Release outside the original button. Preserve that aim until the tick.
    await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
    const beforeThrowYaw = (await input()).yaw;
    await down('Throw', 42); await move(42, -115, -45); await up(42, false); await ticks();
    const releaseInput = await input();
    const yawDifference = Math.atan2(Math.sin((releaseInput.yaw - beforeThrowYaw) / 1000), Math.cos((releaseInput.yaw - beforeThrowYaw) / 1000));
    assert.ok(yawDifference > 0.35 && yawDifference < 0.57, 'Throw did not use final drag aim');
    await down('Look pad', 44); await move(44, 50, 0); await up(44, false); await ticks();
    assert.equal((await input()).yaw, releaseInput.yaw, 'Free look changed queued Throw aim');
    const beforeThrowPosition = await page.evaluate((id) => window.__WRECK_YARD_CONTROLLER__.getRender().poses.get(id).position, grabbed);
    await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(false));
    await ticks(8);
    assert.equal((await local()).grabbing, null, 'Throw did not release prop');
    assert.equal((await stats()).throws, grabThrows + 1, 'Throw did not launch exactly once');
    const thrownPosition = await page.evaluate((id) => window.__WRECK_YARD_CONTROLLER__.getRender().poses.get(id)?.position, grabbed);
    assert.ok(thrownPosition, 'Thrown prop disappeared');
    const displacement = [thrownPosition[0] - beforeThrowPosition[0], thrownPosition[2] - beforeThrowPosition[2]];
    const length = Math.hypot(...displacement);
    assert.ok(length > 0.5, 'Throw did not move prop');
    const direction = [-Math.sin(releaseInput.yaw / 1000), -Math.cos(releaseInput.yaw / 1000)];
    assert.ok((displacement[0] * direction[0] + displacement[1] * direction[1]) / length > 0.85, 'Throw velocity did not follow release aim');
    await ticks(6); assert.equal((await stats()).throws, grabThrows + 1, 'Throw repeated after release');
    results[key] = { grabbed, releaseInput, displacement };
    console.log(`Grab, canceled Throw, and final release aim passed: ${key}`);

  };
  await verifyGrabAndThrow('persistentGrabAndThrow', 'holding.png');
  await page.setViewportSize({ width: 844, height: 390 });
  await reset();
  await verifyGrabAndThrow('landscapeGrabAndThrow', 'holding844.png');
  await page.setViewportSize({ width: 390, height: 844 });

  // Both short Push taps must reach the world, with a false tick between them.
  await reset();
  const pushTarget = (await targets()).find((entry) => entry.distance < 6);
  assert.ok(pushTarget, 'No real Push target');
  await aim(pushTarget.position); await ticks();
  const pushThrows = (await stats()).throws;
  await page.evaluate(() => {
    window.__PUSH_FEEDBACK_LOG__ = [];
    window.__PUSH_FEEDBACK_RECORDING__ = true;
    const record = () => {
      const render = window.__WRECK_YARD_CONTROLLER__.getRender();
      const feedback = render.players.find((entry) => entry.slot === render.localSlot).feedback;
      if (feedback && !window.__PUSH_FEEDBACK_LOG__.some((entry) => entry.frame === feedback.frame)) window.__PUSH_FEEDBACK_LOG__.push(feedback);
      if (window.__PUSH_FEEDBACK_RECORDING__) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
  await tap('Push', 45); await tap('Push', 46);
  await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(false));
  await ticks(10);
  const pushFeedback = await page.evaluate(() => {
    window.__PUSH_FEEDBACK_RECORDING__ = false;
    return window.__PUSH_FEEDBACK_LOG__;
  });
  assert.equal(pushFeedback.length, 2, 'Rapid short Push taps were lost or repeated');
  assert.ok(pushFeedback.every((entry) => ['punt', 'miss', 'blocked'].includes(entry.result)), 'Push fired another action');
  assert.ok((await stats()).throws > pushThrows, 'Short Push did not launch a real prop');
  await neutral(); results.rapidPush = { target: pushTarget.id, feedback: pushFeedback, throws: (await stats()).throws - pushThrows };
  console.log('Rapid short Push checks passed.');
  const canceledPushStats = (await stats()).throws;
  const canceledPushFrame = (await local()).feedback.frame;
  await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
  await down('Push', 47); await cancel();
  await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(false));
  await ticks(5);
  assert.equal((await stats()).throws, canceledPushStats, 'Canceled Push launched a prop');
  assert.equal((await local()).feedback.frame, canceledPushFrame, 'Canceled Push reached the simulation');
  results.canceledPush = true;

  // A touch reset releases the held prop without the throw path.
  for (const reason of ['cancel', 'blur', 'resize', 'pause', 'mouse', 'swap']) {
    await reset();
    const body = await acquire(reason === 'cancel');
    const before = (await stats()).throws;
    if (reason === 'cancel') await cancel();
    else if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else if (reason === 'resize') await page.setViewportSize({ width: 844, height: 390 });
    else if (reason === 'swap') {
      await tap('Equip torch'); await ticks();
      assert.equal((await input()).tool, 1);
      assert.equal((await input()).pressed, false, 'Swap fired the new tool');
    }
    else if (reason === 'pause') {
      await page.getByRole('button', { name: 'Pause', exact: true }).tap();
      await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
      await ticks();
      assert.equal((await stats()).throws, before, 'Pause threw before resume');
      await page.getByRole('button', { name: 'Resume', exact: true }).tap();
    } else {
      await page.mouse.click(180, 100);
      assert.equal(await page.getByLabel('Touch controls', { exact: true }).count(), 0, 'Mouse did not unmount touch controls');
    }
    await ticks(10);
    assert.equal((await local()).grabbing, null, `${reason} kept stale Grab`);
    assert.equal((await stats()).throws, before, `${reason} boosted held prop`);
    await neutral(); results[`heldReset_${reason}`] = { body, throws: before };
    console.log(`Held reset passed: ${reason}`);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  // Drop is explicit. Exact retained velocity is checked by the WASM test.
  await reset();
  const dropped = await acquire();
  const dropThrows = (await stats()).throws;
  await down('Drop', 48); await move(48, -140, -60); await up(48);
  assert.equal((await local()).grabbing, dropped, 'Drag-off Drop released the prop');
  assert.equal((await stats()).throws, dropThrows, 'Drag-off Drop added force');
  await tap('Drop'); await ticks(8);
  assert.equal((await local()).grabbing, null, 'Drop did not release prop');
  assert.equal((await stats()).throws, dropThrows, 'Drop used the throw path');
  await neutral(); results.drop = { body: dropped, throws: dropThrows };
  await tap('Equip torch'); await ticks();
  // A short Cut tap must emit a tool result in the real simulation.
  await page.evaluate(() => window.__SET_LOOK_ANGLES__(0, 1.1)); await ticks();
  const cutFeedbackFrame = (await local()).feedback?.frame ?? -1;
  await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
  await tap('Cut', 49);
  await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(false));
  await ticks(5);
  const shortCutFeedback = (await local()).feedback;
  assert.ok(shortCutFeedback.frame > cutFeedbackFrame, 'Short Cut tap did not reach a tick');
  assert.equal(shortCutFeedback.result, 'miss', 'Short Cut aimed at the sky fired another action');
  assert.equal((await input()).pressed, false, 'Short Cut stayed pressed');
  results.shortCut = shortCutFeedback;
  const nearest = (await targets())[0];
  const me = (await local()).position;
  if (nearest && nearest.distance > 2.3) {
    const dx = nearest.position[0] - me[0], dz = nearest.position[2] - me[2];
    const length = Math.hypot(dx, dz);
    await walkTo([nearest.position[0] - dx / length * 2.1, nearest.position[2] - dz / length * 2.1], 0.35);
  }
  const surfacePoint = (id) => page.evaluate(async (bodyId) => {
    const { rotate } = await import('/src/sim/math.ts');
    const { VOXEL_SIZE } = await import('/src/sim/constants.ts');
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const body = render.bodies.find((entry) => entry.id === bodyId);
    const pose = render.poses.get(bodyId);
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    const eye = [player.position[0], player.position[1] + 1.55, player.position[2]];
    let best = null, distance = Infinity;
    for (let index = 0; index < body.voxels.length; index += 1) {
      if (!body.voxels[index]) continue;
      const x = index % body.dims.x, y = Math.floor(index / body.dims.x) % body.dims.y, z = Math.floor(index / (body.dims.x * body.dims.y));
      const local = [(x - (body.dims.x - 1) / 2) * VOXEL_SIZE, (y - (body.dims.y - 1) / 2) * VOXEL_SIZE, (z - (body.dims.z - 1) / 2) * VOXEL_SIZE];
      const turned = rotate(local, pose.rotation);
      const point = turned.map((value, axis) => value + pose.position[axis]);
      const gap = Math.hypot(...point.map((value, axis) => value - eye[axis]));
      if (gap < distance) { distance = gap; best = point; }
    }
    return best;
  }, id);
  const cuts = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().stats.torchCuts);
  for (const body of (await targets()).filter((entry) => entry.distance < 3.3).slice(0, 5)) {
    await aim(await surfacePoint(body.id)); await down('Cut', 42); await ticks(12); await up(42);
    if (await page.evaluate((before) => window.__WRECK_YARD_CONTROLLER__.getRender().stats.torchCuts > before, cuts)) break;
  }
  const finalCuts = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().stats.torchCuts);
  assert.ok(finalCuts > cuts, 'Touch Cut did not remove voxels');
  results.realTools = { cuts: finalCuts - cuts };
  await down('Jet', 43); await ticks();
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page.getByRole('button', { name: 'Leave match', exact: true }).tap();
  await page.getByRole('button', { name: 'Play Solo', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Touch controls', { exact: true }).count(), 0);
  await up(43); await neutral();
  await page.getByRole('button', { name: 'Play Solo', exact: true }).tap();
  await page.getByLabel('Move pad', { exact: true }).waitFor();
  await ticks(); await neutral();
  results.matchRestart = true;
  assert.equal(await page.evaluate(() => document.pointerLockElement !== null), false);
  assert.deepEqual(errors, []); results.errors = errors;
  results.status = 'passed';
} catch (error) {
  results.status = 'failed';
  results.failure = { message: error.message, stack: error.stack };
  if (activePage) {
    results.failure.live = await activePage.evaluate(() => {
      const controller = window.__WRECK_YARD_CONTROLLER__;
      const render = controller?.getRender();
      return { input: controller?.input, frame: render?.frame, player: render?.players.find((entry) => entry.slot === render.localSlot), stats: render?.stats };
    }).catch(() => null);
    await activePage.screenshot({ path: fileURLToPath(new URL('failure.png', output)) }).catch(() => {});
  }
  throw error;
} finally {
  await writeFile(new URL(results.scope === 'tools' ? 'tools-results.json' : 'results.json', output), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results));
