// Live check for the breakables loop: for each floodlight, carry the nearest
// loose body to a point 8 m out from the lamp and punt it at the lens, until all
// four break. It captures the dark yard (lights out), waits for the lamps to
// flicker back on, punts a storage crate at a wall until it breaks, and punts a
// loose tire so it rolls. Needs the dev server on AUDIT_URL.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
/** Eye above the player position (src/sim/constants.ts PLAYER_EYE_OFFSET). */
const EYE_OFFSET = 1.55;
const MASTS = [[21.5, 21], [21.5, -21], [-21.5, -21], [-21.5, 21]];
const THROWABLE = /^(Scrap|Bowling Pin \d|Hazard Drum \d|Oil Drum|Slalom Drum \d|Ballast Box)$/;
const out = process.env.BREAKABLE_SHOTS ?? fileURLToPath(new URL('../test-results/breakables/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { shots: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(`console: ${message.text()}`); });
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const render = () => page.evaluate(() => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const status = controller.snapshot();
    if (status.status === 'error') throw new Error(`Session stopped: ${JSON.stringify(status.errorDetails ?? status.error)}`);
    const r = controller.getRender();
    const player = r.players.find((p) => p.slot === r.localSlot);
    return {
      frame: r.frame, lamps: r.contraptions.lamps, crateBreaks: r.contraptions.crateBreaks, lightsOutUntil: r.contraptions.lightsOutUntil, relitFrame: r.contraptions.relitFrame,
      stats: r.stats, player: player.position, grabbing: player.grabbing ?? null,
      bodies: r.bodies.map((b) => ({ id: b.id, label: b.label, storageBay: b.storageBay ?? null, position: r.poses.get(b.id)?.position ?? null })),
    };
  });
  const shot = async (name, pos, lookAt) => {
    await page.evaluate(([p, l]) => window.__SET_CAMERA_OVERRIDE__(p, l), [pos, lookAt]);
    await page.waitForTimeout(80);
    await page.locator('canvas').first().screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  };
  const setLook = (yaw, pitch) => page.evaluate(([a, b]) => window.__SET_LOOK_ANGLES__(a, b), [yaw, pitch]);
  const look = async (target) => {
    const p = (await render()).player;
    const dx = target[0] - p[0];
    const dz = target[2] - p[2];
    await setLook(Math.atan2(-dx, -dz), Math.atan2(target[1] - (p[1] + EYE_OFFSET), Math.hypot(dx, dz)));
  };
  /**
   * Walks with the look turned toward the target. When a prop blocks the way, it
   * strafes sideways for a moment and tries again, alternating sides.
   */
  const walkTo = async ([x, z], within = 0.5) => {
    let last = null;
    let stalled = 0;
    let escapes = 0;
    for (let step = 0; step < 400 && escapes < 8; step += 1) {
      const p = (await render()).player;
      const dx = x - p[0];
      const dz = z - p[2];
      if (Math.hypot(dx, dz) < within) break;
      await setLook(Math.atan2(-dx, -dz), 0);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(60);
      if (last) stalled = Math.hypot(p[0] - last[0], p[2] - last[2]) < 0.02 ? stalled + 1 : 0;
      last = p;
      if (stalled >= 6) {
        const side = escapes % 2 === 0 ? 'KeyD' : 'KeyA';
        await page.keyboard.up('KeyW');
        await page.keyboard.down(side);
        await page.waitForTimeout(450 + escapes * 150);
        await page.keyboard.up(side);
        escapes += 1;
        stalled = 0;
      }
    }
    await page.keyboard.up('KeyW');
  };
  /** Sounds the mixer has played so far. Its list keeps only the last 100 shots, so the run reads it after each event. */
  const heard = new Set();
  const listen = async () => {
    const played = await page.evaluate(() => window.__DEBUG_AUDIO__?.()?.played ?? []);
    for (const entry of played) heard.add(entry.sound);
  };
  const input = (action) => page.evaluate((a) => window.__SIMULATE_INPUT__(a), action);

  const floorY = (await render()).player[1];
  const lens = ([x, z]) => {
    const yaw = Math.atan2(-x, -z);
    return [x + Math.sin(yaw) * 0.43, floorY + 11.2, z + Math.cos(yaw) * 0.43];
  };
  /** The lamp state of MASTS[index], by its id (state.lamps is in setPieces.ts FLOODLIGHT_MASTS order). */
  const lampOf = (state, index) => {
    const [x, z] = MASTS[index];
    const lamp = state.lamps.find((entry) => entry.lampId === `set-mast-lens-${x}-${z}`);
    assert.ok(lamp, `no lamp for mast ${x}, ${z}`);
    return lamp;
  };
  /** The point 8 m out from a lamp, toward the yard centre, where the player stands to punt. */
  const standFor = ([x, z]) => {
    const at = lens([x, z]);
    const yaw = Math.atan2(-x, -z);
    return [at[0] + Math.sin(yaw) * 8, at[2] + Math.cos(yaw) * 8];
  };
  await shot('yard-lit', [0, floorY + 14, 26], [0, floorY + 2, -4]);

  // BREAKABLES_SKIP_LAMPS=1 skips the lamp and lights-out part, to check the crate and tire part on its own.
  if (!process.env.BREAKABLES_SKIP_LAMPS) {
    const used = new Set();
    for (let attempt = 0; attempt < 24; attempt++) {
      const state = await render();
      const target = MASTS.findIndex((_, index) => lampOf(state, index).brokenAt === null);
      if (target < 0) break;
      const stand = standFor(MASTS[target]);
      // The loose body nearest the stand point that this run has not thrown yet.
      const candidate = state.bodies
        .filter((b) => THROWABLE.test(b.label) && b.position && !used.has(b.id) && b.position[1] < floorY + 2)
        .sort((a, b) => Math.hypot(a.position[0] - stand[0], a.position[2] - stand[1]) - Math.hypot(b.position[0] - stand[0], b.position[2] - stand[1]))[0];
      assert.ok(candidate, 'no loose body left to throw');
      used.add(candidate.id);
      const near = [candidate.position[0], candidate.position[2]];
      // Stand 3.5 m from the body, on the side toward the stand point.
      const away = Math.atan2(stand[1] - near[1], stand[0] - near[0]);
      await walkTo([near[0] + Math.cos(away) * 3.5, near[1] + Math.sin(away) * 3.5], 0.6);
      await look(candidate.position);
      await input({ tool: 'hand' });
      await page.waitForTimeout(100);
      await input({ pressed: true });
      await page.waitForTimeout(300);
      if ((await render()).grabbing !== candidate.id) {
        results.shots.push({ lamp: target, body: candidate.label, skipped: 'grab failed', at: (await render()).player.map((v) => +v.toFixed(1)), bodyAt: candidate.position.map((v) => +v.toFixed(1)) });
        await input({ pressed: false });
        continue;
      }
      await walkTo(stand, 0.7);
      const reached = (await render()).player;
      if (Math.hypot(reached[0] - stand[0], reached[2] - stand[1]) > 1.2) {
        results.shots.push({ lamp: target, body: candidate.label, skipped: 'stand not reached', at: reached.map((v) => +v.toFixed(1)) });
        await input({ pressed: false });
        continue;
      }
      const goal = lens(MASTS[target]);
      // A punt sends the held body along the look direction from where it is. So the look follows
      // the line from the held body to the lens until the hold settles. At 8 m the punt lift cancels the drop.
      await look(goal);
      for (let pass = 0; pass < 8; pass++) {
        await page.waitForTimeout(250);
        const now = (await render()).bodies.find((b) => b.id === candidate.id)?.position;
        if (!now) break;
        const dx = goal[0] - now[0];
        const dz = goal[2] - now[2];
        await setLook(Math.atan2(-dx, -dz), Math.atan2(goal[1] - now[1], Math.hypot(dx, dz)));
      }
      const beforePunt = await render();
      const held = beforePunt.bodies.find((b) => b.id === candidate.id)?.position;
      const where = { player: beforePunt.player.map((v) => +v.toFixed(1)), held: held?.map((v) => +v.toFixed(1)), grabbing: beforePunt.grabbing, stand: stand.map((v) => +v.toFixed(1)) };
      await input({ secondary: true });
      await page.waitForTimeout(80);
      await input({ secondary: false, pressed: false });
      // Follow the body. Where it passes the lamp, the vertical miss corrects the next aim at this lamp.
      let closest = { distance: Infinity, dy: 0 };
      for (let poll = 0; poll < 40; poll++) {
        await page.waitForTimeout(50);
        const now = await render();
        if (lampOf(now, target).brokenAt !== null) break;
        const body = now.bodies.find((b) => b.id === candidate.id)?.position;
        if (!body) break;
        const distance = Math.hypot(body[0] - goal[0], body[2] - goal[2]);
        if (distance < closest.distance) closest = { distance, dy: body[1] - goal[1] };
      }
      const after = await render();
      const broke = lampOf(after, target).brokenAt !== null;
      results.shots.push({ lamp: target, body: candidate.label, where, broke, miss: broke ? null : { horizontal: +closest.distance.toFixed(2), vertical: +closest.dy.toFixed(2) } });
      await listen();
      if (broke && after.lamps.filter((lamp) => lamp.brokenAt !== null).length === 1) await shot('first-lamp-out', [0, floorY + 14, 26], [0, floorY + 2, -4]);
    }
    const dark = await render();
    assert.equal(dark.lamps.filter((lamp) => lamp.brokenAt !== null).length, 4, `not every lamp broke: ${JSON.stringify(results.shots)}`);
    assert.notEqual(dark.lightsOutUntil, null, 'lights out did not start');
    await page.waitForTimeout(900);
    await listen();
    await shot('lights-out', [0, floorY + 14, 26], [0, floorY + 2, -4]);
    results.lightsOutFrames = dark.lightsOutUntil - dark.frame;

    // Lights out lasts 40 s. Capture the lamps as they flicker back on.
    await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__.getRender().contraptions.lightsOutUntil === null, null, { timeout: 60000 }).catch(async (error) => {
      const now = await render();
      throw new Error(`lights out did not end: frame ${now.frame}, until ${now.lightsOutUntil}, lamps ${JSON.stringify(now.lamps)}`, { cause: error });
    });
    await page.waitForTimeout(150);
    await shot('relamp-flicker', [0, floorY + 14, 26], [0, floorY + 2, -4]);
    await page.waitForTimeout(1500);
    await listen();
    await shot('relit', [0, floorY + 14, 26], [0, floorY + 2, -4]);
    const relit = await render();
    assert.equal(relit.lamps.filter((lamp) => lamp.brokenAt !== null).length, 0, 'the lamps did not come back');
  }

  // A FRAGILE crate: pull a crate off the top of the storage stack from 9 m out. It hangs about 3 m in
  // front of the stack (the hold distance is at most 6 m), and the punt drives it back into the stack.
  // (The returns crates sit beside the returns portal, which carries a punted crate away.)
  for (let attempt = 0; attempt < 6 && !results.crateBreak?.broke; attempt++) {
    const state = await render();
    // Whole crates that still stand in the stack. Earlier throws can knock some crates down.
    const whole = state.bodies.filter((b) => b.storageBay === 'storage' && /^shipping-storage-\d+$/.test(b.id) && b.position && b.position[2] < -17.5);
    const frontZ = Math.max(...whole.map((b) => b.position[2]));
    // High crates in the front row, highest first.
    const crate = whole.filter((b) => b.position[2] > frontZ - 0.3 && b.position[1] > floorY + 4).sort((a, b) => b.position[1] - a.position[1])[attempt];
    if (!crate) { (results.crateAttempts ??= []).push({ attempt, skipped: 'no high front crate' }); break; }
    await walkTo([crate.position[0], frontZ + 9], 0.5);
    await look(crate.position);
    await input({ pressed: true });
    await page.waitForTimeout(500);
    // The ray can catch a neighbour of the aimed crate. Any whole storage crate will do.
    const grabbed = (await render()).grabbing;
    if (!grabbed || !/^shipping-storage-\d+$/.test(grabbed)) {
      (results.crateAttempts ??= []).push({ attempt, crate: crate.id, skipped: 'grab failed', grabbing: grabbed });
      await input({ pressed: false });
      continue;
    }
    // Yaw 0 looks north (-z), back at the stack, a little up so the crate clears the lower tiers' faces.
    await setLook(0, 0.15);
    await page.waitForTimeout(1500);
    const beforeCratePunt = await render();
    // Hold the punt long enough for the sim to sample it, then let go of the grab separately.
    await input({ secondary: true });
    await page.waitForTimeout(200);
    await input({ secondary: false });
    await input({ pressed: false });
    // A crate break stays in the state for 6 ticks (0.2 s), so the run polls for it.
    let record;
    // Only a break from the punt on counts. A crate that the hold knocked loose earlier does not.
    for (let poll = 0; poll < 20 && !record; poll++) {
      record = (await render()).crateBreaks.filter((entry) => entry.frame >= beforeCratePunt.frame).at(-1);
      if (!record) await page.waitForTimeout(30);
    }
    const afterPunt = await render();
    const feedback = await page.evaluate(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find((p) => p.slot === r.localSlot).feedback?.result ?? null; });
    results.crateBreak = {
      crate: grabbed, broke: Boolean(record), feedback, frames: [beforeCratePunt.frame, afterPunt.frame], playerAtPunt: beforeCratePunt.player.map((v) => +v.toFixed(1)),
      crateAfter: afterPunt.bodies.find((b) => b.id === grabbed)?.position?.map((v) => +v.toFixed(1)) ?? 'gone', broken: record?.crateId, at: record?.at.map((v) => +v.toFixed(1)),
      heldAtPunt: beforeCratePunt.grabbing, crateAtPunt: beforeCratePunt.bodies.find((b) => b.id === grabbed)?.position?.map((v) => +v.toFixed(1)),
    };
    (results.crateAttempts ??= []).push(results.crateBreak);
    // From in front of the stack, level with the break, while the pieces fall.
    if (record) await shot('crate-break', [record.at[0] + 2, record.at[1] - 1, record.at[2] + 7], [record.at[0], record.at[1] - 1.5, record.at[2]]);
    await page.waitForTimeout(300);
    await listen();
  }
  assert.ok(results.crateBreak?.broke, `no crate broke: ${JSON.stringify(results.crateAttempts)}; page errors: ${JSON.stringify(errors)}`);

  // A loose tire: grab the highest loose tire where it stands now, and punt it low across the open yard.
  const tires = (await render()).bodies.filter((b) => b.id.startsWith('loose-tire-') && b.position);
  const tire = tires.sort((a, b) => b.position[1] - a.position[1])[0];
  results.tireStack = tires.map((b) => ({ id: b.id, at: b.position.map((v) => +v.toFixed(2)) }));
  await walkTo([tire.position[0], tire.position[2] + 3], 0.5);
  await look(tire.position);
  await input({ pressed: true });
  await page.waitForTimeout(400);
  results.tireGrab = (await render()).grabbing;
  assert.match(results.tireGrab ?? '', /^loose-tire-/, `no tire grab: ${JSON.stringify({ player: (await render()).player, tire })}`);
  // Carry it to open ground, then punt it level to the west: it lands, bounces, and rolls.
  await walkTo([6, 9.5], 0.6);
  await setLook(Math.PI / 2, 0);
  await page.waitForTimeout(700);
  await input({ secondary: true });
  await page.waitForTimeout(80);
  await input({ secondary: false, pressed: false });
  const tireStart = (await render()).bodies.find((b) => b.id === results.tireGrab).position;
  await page.waitForTimeout(900);
  const tireMid = (await render()).bodies.find((b) => b.id === results.tireGrab).position;
  await shot('tire-rolling', [tireMid[0] + 2, floorY + 3.5, tireMid[2] + 6], tireMid);
  await page.waitForTimeout(600);
  const tireEnd = (await render()).bodies.find((b) => b.id === results.tireGrab).position;
  results.tireTravel = +Math.hypot(tireEnd[0] - tireStart[0], tireEnd[2] - tireStart[2]).toFixed(2);
  assert.ok(results.tireTravel > 5, `the tire did not roll on: ${results.tireTravel} m`);
  await shot('tire-stack', [8, floorY + 2.5, 9], [5, floorY + 0.6, 4.6]);

  await listen();
  results.soundsPlayed = [...heard].sort();
  console.log(JSON.stringify(results, null, 2));
  // Each new sound must have played at least once.
  for (const sound of ['glassBreak', 'lightsOut', 'relamp', 'crateBreak', 'rubber']) assert.ok(heard.has(sound), `${sound} did not play`);
  results.errors = errors;
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
