// Live Chrome check for the Returns Department and the storage elevator.
// Needs the development server on AUDIT_URL. It uses the real solo simulation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const out = process.env.ATTRACTION_SHOTS ?? fileURLToPath(new URL('../test-results/attractions/', import.meta.url));
const renderOnly = process.argv.includes('--render-only');
const cratePortalProof = process.argv.includes('--crate-portal-proof');
const FLOOR_Y = -0.86;
const FLOOR_GAP = 3.2;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { url: base, screenshots: [], errors: [], controls: [] };
let activePage;

function checkPage(page) {
  page.on('pageerror', (error) => results.errors.push(error.message));
}

async function waitForYard(page, quality = 'high') {
  await page.goto(`${base}/?quality=${quality}&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__SET_CAMERA_OVERRIDE__ && window.__SET_LOOK_ANGLES__, null, { timeout: 10000 });
}

async function readScene(page) {
  return page.evaluate(() => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const render = controller.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    const crates = render.bodies.filter((body) => body.renderModel === 'shipping-crate');
    const intact = crates.filter((body) => body.voxels.length === body.dims.x * body.dims.y * body.dims.z);
    const group = window.__DEBUG_THREE__.scene.getObjectByName('ShippingCrates');
    return {
      frame: render.frame,
      status: controller.snapshot().status,
      player: { position: player.position, grounded: player.grounded, ridingVehicle: player.ridingVehicle, fuel: player.fuel, jetpackActive: player.jetpackActive },
      elevator: render.attractions.elevator,
      resetFrame: render.attractions.resetFrame,
      resetStatus: render.attractions.resetStatus,
      crateCount: crates.length,
      storageCount: crates.filter((body) => body.storageBay === 'storage').length,
      returnsCount: crates.filter((body) => body.storageBay === 'returns').length,
      intactCount: intact.length,
      instanceCounts: group?.children.filter((object) => object.isInstancedMesh).map((object) => object.count) ?? [],
      portalCounters: player.portalTeleports,
    };
  });
}

async function setCamera(page, position, lookAt) {
  await page.evaluate(([p, target]) => window.__SET_CAMERA_OVERRIDE__(p, target), [position, lookAt]);
  await page.waitForTimeout(450);
}

async function capture(page, name, position, lookAt) {
  await setCamera(page, position, lookAt);
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  results.screenshots.push(path);
}

async function measureRenderFrames(page, name, { pauseSimulation = false } = {}) {
  const samples = await page.evaluate((pauseSimulation) => {
    const debug = window.__DEBUG_THREE__;
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const { gl, advance } = debug;
    const oldAutoReset = gl.info.autoReset;
    const wasPaused = controller.isPaused();
    if (pauseSimulation) controller.setPaused(true);
    gl.info.autoReset = false;
    const frames = [];
    try {
      for (let index = 0; index < 30; index += 1) {
        const start = performance.now();
        gl.info.reset();
        advance(start);
        gl.getContext().finish();
        frames.push({
          elapsedMs: performance.now() - start,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
        });
      }
    } finally {
      gl.info.autoReset = oldAutoReset;
      gl.info.reset();
      if (pauseSimulation) controller.setPaused(wasPaused);
    }
    return frames;
  }, pauseSimulation);
  const percentile = (values, fraction) => {
    const ordered = [...values].sort((left, right) => left - right);
    return ordered[Math.ceil((ordered.length - 1) * fraction)] ?? 0;
  };
  const elapsed = samples.map((sample) => sample.elapsedMs);
  const calls = samples.map((sample) => sample.drawCalls);
  const triangles = samples.map((sample) => sample.triangles);
  const summary = {
    frames: samples.length,
    simulationPaused: pauseSimulation,
    drawCallsMedian: percentile(calls, 0.5),
    drawCallsMin: Math.min(...calls),
    drawCallsMax: Math.max(...calls),
    trianglesMedian: percentile(triangles, 0.5),
    trianglesMin: Math.min(...triangles),
    trianglesMax: Math.max(...triangles),
    forcedFinishFrameMedianMs: percentile(elapsed, 0.5),
    forcedFinishFrameP90Ms: percentile(elapsed, 0.9),
    forcedFinishFrameMaxMs: Math.max(...elapsed),
  };
  results.renderFrames ??= {};
  results.renderFrames[name] = summary;
  return summary;
}

async function renderOnlyViews(page, label) {
  await waitForYard(page, label === 'mobile844-low' ? 'low' : 'high');
  const state = await readScene(page);
  assert.equal(state.status, 'live', `${label} match status is ${state.status}`);
  assert.equal(state.storageCount, 400, `${label} storage crate count is ${state.storageCount}`);
  assert.equal(state.returnsCount, 36, `${label} Returns crate count is ${state.returnsCount}`);
  const prefix = label === 'mobile844-low' ? 'mobile' : 'desktop';
  await capture(page, `${prefix}-storage-render-only`, [-9.5, 11.6, -5], [-10.5, 4.5, -20.7]);
  await measureRenderFrames(page, `${label}-storage`, { pauseSimulation: true });
  await capture(page, `${prefix}-portal-view-render-only`, [-2, 2.1, 14.5], [-2, 1.34, 20.3]);
  await measureRenderFrames(page, `${label}-delivery-portal`, { pauseSimulation: true });
}

async function walkTo(page, target, stopDistance = 0.42) {
  let last = null;
  let stalled = 0;
  let reached = false;
  for (let step = 0; step < 360; step += 1) {
    const state = await readScene(page);
    const [x, , z] = state.player.position;
    const dx = target[0] - x;
    const dz = target[1] - z;
    if (Math.hypot(dx, dz) < stopDistance) {
      reached = true;
      break;
    }
    await page.evaluate(([xStep, zStep]) => window.__SET_LOOK_ANGLES__(Math.atan2(-xStep, -zStep), 0), [dx, dz]);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(80);
    if (last && Math.hypot(x - last[0], z - last[1]) < 0.015) stalled += 1;
    else stalled = 0;
    last = [x, z];
    if (stalled > 20) break;
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);
  const final = await readScene(page);
  const distance = Math.hypot(target[0] - final.player.position[0], target[1] - final.player.position[2]);
  return { reached: reached || distance < stopDistance, distance, player: final.player };
}

async function crossDeliveryPortal(page) {
  const before = await readScene(page);
  for (let step = 0; step < 320; step += 1) {
    const state = await readScene(page);
    if (state.portalCounters > before.portalCounters) break;
    const dx = -2 - state.player.position[0];
    const dz = 22 - state.player.position[2];
    await page.evaluate(([xStep, zStep]) => window.__SET_LOOK_ANGLES__(Math.atan2(-xStep, -zStep), 0), [dx, dz]);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(80);
  }
  await page.keyboard.up('KeyW');
  await page.waitForFunction((previous) => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    return player.portalTeleports > previous;
  }, before.portalCounters, { timeout: 10000 });
  const state = await readScene(page);
  assert.ok(state.player.position[0] > 4 && state.player.position[2] < -15, `Delivery portal exit is unexpected: ${state.player.position}`);
  results.portalCrossing = { before: before.player.position, after: state.player.position, teleports: state.portalCounters };
  return state;
}

async function portalProofState(page) {
  return page.evaluate(() => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const render = controller.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    return {
      frame: render.frame,
      player: {
        position: player.position,
        grabbing: player.grabbing,
        portalTeleports: player.portalTeleports,
        activeTool: player.activeTool,
        yaw: player.yaw,
        pitch: player.pitch,
        feedback: player.feedback,
      },
      portalStraddlers: render.portalStraddlers ?? [],
      crates: render.bodies
        .filter((body) => body.storageBay === 'returns' && body.renderModel === 'shipping-crate')
        .map((body) => ({ id: body.id, position: render.poses.get(body.id)?.position ?? null })),
    };
  });
}

async function aimAt(page, playerPosition, targetPosition) {
  const dx = targetPosition[0] - playerPosition[0];
  const dz = targetPosition[2] - playerPosition[2];
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(targetPosition[1] - playerPosition[1] - 1.55, Math.hypot(dx, dz));
  await page.evaluate(([nextYaw, nextPitch]) => window.__SET_LOOK_ANGLES__(nextYaw, nextPitch), [yaw, pitch]);
}

async function captureHeldCratePortalProof(page) {
  await waitForYard(page);
  await page.locator('.yard-switch').click();
  await crossDeliveryPortal(page);

  // Stay west of the Returns stack and north of the portal plane.
  const approach = await walkTo(page, [6.8, -18.2], 0.3);
  assert.ok(approach.reached, `could not approach the Returns stack: ${JSON.stringify(approach)}`);
  const beforeGrab = await portalProofState(page);
  const eye = [beforeGrab.player.position[0], beforeGrab.player.position[1] + 1.55, beforeGrab.player.position[2]];
  const candidates = beforeGrab.crates
    .filter((crate) => crate.position && crate.position[0] > 8.8 && crate.position[0] < 10.8 && crate.position[1] > 2.3 && crate.position[2] > -17.4)
    .sort((left, right) => {
      const distance = (position) => Math.hypot(position[0] - eye[0], position[1] - eye[1], position[2] - eye[2]);
      return distance(left.position) - distance(right.position);
    });
  const target = candidates[0];
  assert.ok(target?.position, `no visible upper Returns crate was found: ${JSON.stringify(beforeGrab.crates)}`);
  results.crateTarget = { id: target.id, position: target.position, playerPosition: beforeGrab.player.position };

  await page.keyboard.press('Digit1');
  await aimAt(page, beforeGrab.player.position, target.position);
  const canvas = await page.locator('canvas').first().boundingBox();
  assert.ok(canvas, 'the game canvas is missing');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  try {
    await page.waitForFunction((id) => {
      const render = window.__WRECK_YARD_CONTROLLER__.getRender();
      const player = render.players.find((entry) => entry.slot === render.localSlot);
      return player.grabbing === id;
    }, target.id, { timeout: 5000 });
  } catch {
    results.failedGrabState = await portalProofState(page);
    throw new Error(`the live gravity gun did not hold ${target.id}: ${JSON.stringify(results.failedGrabState)}`);
  }
  const grabbed = await portalProofState(page);
  assert.equal(grabbed.player.grabbing, target.id, `the live gravity gun did not hold ${target.id}`);

  // Face south and carry the crate toward the Returns portal. Stop when native physics reports the straddler.
  const dx = 7 - grabbed.player.position[0];
  const dz = -21 - grabbed.player.position[2];
  const yaw = Math.atan2(-dx, -dz);
  // Aim up so the crate stays at its current height while the player stays north of the portal.
  await page.evaluate((nextYaw) => window.__SET_LOOK_ANGLES__(nextYaw, 0.4), yaw);
  const crossingHandle = await page.waitForFunction((args) => {
    const [id, previousTeleports] = args;
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const render = controller.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    const portalStraddler = (render.portalStraddlers ?? []).find((entry) => entry.bodyId === id) ?? null;
    if (portalStraddler) {
      controller.setPaused(true);
      return { frame: render.frame, player, portalStraddler };
    }
    if (player.portalTeleports > previousTeleports) return { teleported: true, frame: render.frame, player };
    return false;
  }, [target.id, grabbed.player.portalTeleports], { timeout: 15000, polling: 'raf' });
  const crossing = await crossingHandle.jsonValue();
  const crossingState = await portalProofState(page);
  const straddler = crossing.portalStraddler
    ?? crossingState.portalStraddlers.find((entry) => entry.bodyId === target.id)
    ?? null;
  assert.ok(straddler, `the held crate did not straddle the Returns portal: ${JSON.stringify(crossing)}`);
  assert.equal(crossing.player.grabbing, target.id, 'the crate was no longer held when it straddled the portal');

  await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__([7, 3.1, -12], [7, 1.2, -21]));
  await page.waitForTimeout(350);
  const screenshot = join(out, 'returns-crate-straddler.png');
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  results.screenshots.push(screenshot);
  results.cratePortalProof = {
    screenshot,
    crateId: target.id,
    initialCratePosition: target.position,
    playerBeforeGrab: beforeGrab.player.position,
    playerAtCrossing: crossing.player.position,
    heldBodyId: crossing.player.grabbing,
    cratePositionAtCrossing: crossingState.crates.find((crate) => crate.id === target.id)?.position ?? null,
    portalStraddler: straddler,
    frame: crossing.frame,
  };
  await page.mouse.up();
  await writeFile(join(out, 'crate-portal-proof-results.json'), `${JSON.stringify(results, null, 2)}\n`);
}

async function walkFromReturnsToElevator(page) {
  const clearFrame = await walkTo(page, [6.8, -19.8]);
  assert.ok(clearFrame.reached, `could not clear the Returns frame: ${JSON.stringify(clearFrame)}`);
  const passFrame = await walkTo(page, [-1, -19.8]);
  assert.ok(passFrame.reached, `could not pass west of the Returns frame: ${JSON.stringify(passFrame)}`);
  const passPanel = await walkTo(page, [-7.35, -19.8]);
  assert.ok(passPanel.reached, `could not pass west of the elevator panel: ${JSON.stringify(passPanel)}`);
  const approach = await walkTo(page, [-7.35, -20.7]);
  assert.ok(approach.reached, `could not reach elevator: ${JSON.stringify(approach)}`);
  return { clearFrame, passFrame, passPanel, approach };
}

async function waitForFloor(page, floor) {
  const expectedY = FLOOR_Y + FLOOR_GAP * floor;
  await page.waitForFunction((target) => {
    const elevator = window.__WRECK_YARD_CONTROLLER__.getRender().attractions.elevator;
    return elevator.target === target.floor
      && elevator.status === 'ready'
      && Math.abs(elevator.y - target.y) < 0.03;
  }, { floor, y: expectedY }, { timeout: 20000 });
  await page.waitForTimeout(150);
  const state = await readScene(page);
  assert.ok(Math.abs(state.elevator.y - expectedY) < 0.03, `floor ${floor} stopped at ${state.elevator.y}, expected ${expectedY}`);
  results.controls.push({ floor, elevatorY: state.elevator.y, playerY: state.player.position[1], grounded: state.player.grounded });
  return state;
}

async function chooseFloor(page, floor) {
  const label = floor === 0 ? 'Elevator floor ground' : `Elevator floor ${floor}`;
  const button = page.getByRole('button', { name: label, exact: true });
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
  await page.waitForFunction((target) => window.__WRECK_YARD_CONTROLLER__.getRender().attractions.elevator.target === target, floor, { timeout: 5000 });
  return waitForFloor(page, floor);
}

async function chooseRestack(page) {
  const before = await readScene(page);
  const button = page.getByRole('button', { name: 'RESTACK', exact: true });
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
  await page.waitForFunction((frame) => window.__WRECK_YARD_CONTROLLER__.getRender().attractions.resetFrame > frame, before.resetFrame, { timeout: 10000 });
  const after = await readScene(page);
  assert.equal(after.resetStatus, 'ready', `storage reset status is ${after.resetStatus}`);
  assert.equal(after.storageCount, 400, `storage body count after restack is ${after.storageCount}`);
  results.restack = { beforeFrame: before.resetFrame, afterFrame: after.resetFrame, storageCount: after.storageCount };
  return after;
}

try {
  if (cratePortalProof) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    activePage = page;
    checkPage(page);
    await captureHeldCratePortalProof(page);
    await context.close();
    assert.deepEqual(results.errors, [], `browser errors: ${results.errors.join('; ')}`);
  } else if (renderOnly) {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const desktop = await desktopContext.newPage();
    activePage = desktop;
    checkPage(desktop);
    await renderOnlyViews(desktop, 'desktop1440');
    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    });
    const mobile = await mobileContext.newPage();
    activePage = mobile;
    checkPage(mobile);
    await renderOnlyViews(mobile, 'mobile844-low');
    await mobileContext.close();
    assert.deepEqual(results.errors, [], `browser errors: ${results.errors.join('; ')}`);
    await writeFile(join(out, 'render-only-results.json'), `${JSON.stringify(results, null, 2)}\n`);
  } else {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const desktop = await desktopContext.newPage();
  activePage = desktop;
  checkPage(desktop);
  await waitForYard(desktop);

  const start = await readScene(desktop);
  assert.equal(start.status, 'live', `solo match status is ${start.status}`);
  assert.equal(start.storageCount, 400, `storage body count is ${start.storageCount}`);
  assert.equal(start.returnsCount, 36, `returns body count is ${start.returnsCount}`);
  assert.deepEqual(start.instanceCounts, [400, 400, 36, 36], `crate draw counts are ${start.instanceCounts}`);
  results.start = start;

  await capture(desktop, 'desktop-storage', [-9.5, 11.6, -5], [-10.5, 4.5, -20.7]);
  await measureRenderFrames(desktop, 'desktop1440-storage');
  await capture(desktop, 'desktop-portal-view', [-2, 2.1, 14.5], [-2, 1.34, 20.3]);
  await measureRenderFrames(desktop, 'desktop1440-delivery-portal');

  await desktop.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  await desktop.locator('.yard-switch').click();
  await desktop.waitForTimeout(350);
  await crossDeliveryPortal(desktop);
  results.desktopRoute = await walkFromReturnsToElevator(desktop);
  const approach = results.desktopRoute.approach;
  await desktop.getByRole('button', { name: 'Elevator floor 1', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  const atGround = await readScene(desktop);
  assert.ok(atGround.player.grounded, 'player is not standing on the elevator platform');
  assert.ok(Math.abs(atGround.player.position[1] - atGround.elevator.y - 0.4) < 1.5, 'player is outside elevator control range');

  const startY = atGround.elevator.y;
  const startPlayerY = atGround.player.position[1];
  const floor3 = await chooseFloor(desktop, 3);
  const elevatorDelta = floor3.elevator.y - startY;
  const playerDelta = floor3.player.position[1] - startPlayerY;
  assert.ok(Math.abs(playerDelta - elevatorDelta) < 0.16, `player did not ride with platform: elevator ${elevatorDelta}, player ${playerDelta}`);
  assert.ok(floor3.player.grounded, 'player left the platform at floor 3');
  await capture(desktop, 'elevator-floor-3', [-10.5, 14.8, -7], [-8.8, 5.7, -20.7]);

  await chooseFloor(desktop, 2);
  await chooseFloor(desktop, 1);
  const ground = await chooseFloor(desktop, 0);
  assert.ok(Math.abs(ground.player.position[1] - startPlayerY) < 0.16, 'player did not return to the ground with the platform');
  await capture(desktop, 'elevator-ground', [-10.5, 6.5, -7], [-8.8, -0.15, -20.7]);
  await desktop.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  const resetEast = await walkTo(desktop, [-7.8, -19.8]);
  assert.ok(resetEast.reached, `could not reach east of the landing sign: ${JSON.stringify(resetEast)}`);
  const resetNorth = await walkTo(desktop, [-7.8, -17.6]);
  assert.ok(resetNorth.reached, `could not pass north of the landing sign: ${JSON.stringify(resetNorth)}`);
  const resetControl = await walkTo(desktop, [-8.0, -17.6], 0.12);
  assert.ok(resetControl.reached, `could not reach RESTACK control: ${JSON.stringify(resetControl)}`);
  await desktop.waitForFunction((floorY) => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    const [x, y, z] = player.position;
    return x > -8.61
      && Math.hypot(x + 10.2, z + 16.8) < 2.6
      && Math.abs(y - floorY) < 2;
  }, FLOOR_Y, { timeout: 5000 });
  const resetPosition = await readScene(desktop);
  const resetDistance = Math.hypot(resetPosition.player.position[0] + 10.2, resetPosition.player.position[2] + 16.8);
  assert.ok(resetPosition.player.position[0] > -8.61, `player is inside the storage bay at x=${resetPosition.player.position[0].toFixed(2)}`);
  assert.ok(resetDistance < 2.6, `player is ${resetDistance.toFixed(2)} m from RESTACK range`);
  results.resetApproach = { distance: resetDistance, player: resetPosition.player.position };
  await chooseRestack(desktop);

  const mobileContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const mobile = await mobileContext.newPage();
  activePage = mobile;
  checkPage(mobile);
  await waitForYard(mobile, 'low');
  await capture(mobile, 'mobile-landscape-storage-overview', [-9.5, 11.6, -5], [-10.5, 4.5, -20.7]);
  await measureRenderFrames(mobile, 'mobile844-low-storage');
  await capture(mobile, 'mobile-portal-view', [-2, 2.1, 14.5], [-2, 1.34, 20.3]);
  await measureRenderFrames(mobile, 'mobile844-low-delivery-portal');
  await crossDeliveryPortal(mobile);
  results.mobileRoute = await walkFromReturnsToElevator(mobile);
  await mobile.getByRole('button', { name: 'Elevator floor 1', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  await capture(mobile, 'mobile-landscape-844x390', [-9.5, 11.6, -5], [-10.5, 4.5, -20.7]);
  await mobile.getByRole('button', { name: 'Elevator floor 3', exact: true }).tap();
  const mobileFloor3 = await waitForFloor(mobile, 3);
  assert.ok(mobileFloor3.player.grounded, 'mobile player left the platform at floor 3');
  await capture(mobile, 'mobile-landscape-elevator-controls', [-10.5, 14.8, -7], [-8.8, 5.7, -20.7]);
  await mobile.getByRole('button', { name: 'Elevator floor ground', exact: true }).tap();
  await waitForFloor(mobile, 0);
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.waitForTimeout(500);
  await capture(mobile, 'mobile-portrait-390x844', [-10.5, 6.5, -7], [-8.8, -0.15, -20.7]);
  await mobile.getByRole('button', { name: 'Elevator floor 1', exact: true }).tap();
  await waitForFloor(mobile, 1);
  await mobile.getByRole('button', { name: 'Elevator floor ground', exact: true }).tap();
  await waitForFloor(mobile, 0);
  await mobile.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  results.mobile = await readScene(mobile);

  await mobileContext.close();
  await desktopContext.close();
  assert.deepEqual(results.errors, [], `browser errors: ${results.errors.join('; ')}`);
  await writeFile(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  }
} catch (error) {
  console.log(JSON.stringify(results, null, 2));
  throw error;
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
