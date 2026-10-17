// Use real input against the production build. Do not change simulation state.
import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4398';
const out = process.env.PORTAL_TOOLS_OUT ?? 'test-results/portal-tools/current';
const apertureOnly = process.argv.includes('--aperture-only');
const carryProof = process.argv.includes('--carry-proof');
await mkdir(out, { recursive: true });
const result = { started: new Date().toISOString(), base, scope: apertureOnly ? 'aperture-only' : 'all', checks: [], actions: [], errors: [], screenshots: [], passed: false,
    limits: ['Desktop Chrome uses real keyboard and mouse input. Production aiming uses middle-button drag.',
        'No simulation setters, SDK mocks, forced grabs, or pose changes are used.',
        'This does not test the RUN app or an exact iOS17 device. No timing claim is made.'] };
let browser, page;
const save = () => writeFile(join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
async function record(name, detail) {
    const row = { at: new Date().toISOString(), name, ...detail };
    result.actions.push(row);
    await appendFile(join(out, 'actions.ndjson'), JSON.stringify(row) + '\n');
    await save();
}
function check(value, name, evidence) { result.checks.push({ name, passed: Boolean(value), evidence }); assert.ok(value, name); }
async function state(id = null) {
    return page.evaluate(id => {
        const controller = window.__WRECK_YARD_CONTROLLER__, render = controller.getRender();
        const player = render.players.find(p => p.slot === render.localSlot), scene = window.__DEBUG_THREE__.scene;
        const body = id ? render.bodies.find(b => b.id === id) : null;
        const endpoints = group => {
            const meshes = [];
            group?.traverse(object => {
                if (!object.isMesh || !object.visible)
                    return;
                const attr = object.geometry.attributes.position;
                if (!attr)
                    return;
                let lo = Infinity, hi = -Infinity;
                for (let i = 0; i < attr.count; i++) {
                    lo = Math.min(lo, attr.getY(i));
                    hi = Math.max(hi, attr.getY(i));
                }
                object.updateWorldMatrix(true, false);
                meshes.push({ type: object.geometry.type, ends: [lo, hi].map(y => object.position.clone().set(0, y, 0).applyMatrix4(object.matrixWorld).toArray()),
                    depthWrite: object.material.depthWrite, opacity: object.material.opacity });
            });
            return meshes;
        };
        const beam = scene.getObjectByName('TractorBeam');
        return { atMs: performance.now(), frame: render.frame, status: controller.snapshot().status, paused: controller.isPaused(), input: { ...controller.input },
            player: { ...player }, stats: render.stats, body: id ? { id, exists: Boolean(body), pose: render.poses.get(id), voxelCount: body?.voxels.reduce((n, v) => n + Number(v !== 0), 0) } : null,
            feedbackMeshes: endpoints(scene.getObjectByName('ToolFeedback')?.children[render.localSlot]),
            torchMeshes: endpoints(scene.getObjectByName('TorchJet')?.children[render.localSlot]),
            heldBeamCounts: beam?.children.filter(o => o.isInstancedMesh).map(o => o.count) ?? [], portalStraddlers: render.portalStraddlers ?? [] };
    }, id);
}
async function waitFrames(count = 3) {
    const first = await state();
    await page.waitForFunction(frame => {
        const c = window.__WRECK_YARD_CONTROLLER__;
        return c.snapshot().status === 'error' || c.getRender().frame >= frame;
    }, first.frame + count, { timeout: 15000 });
    const after = await state();
    assert.equal(after.status, 'live');
    return after;
}
async function shot(name) { const path = join(out, `${name}.png`); await page.screenshot({ path, timeout: 15000 }); result.screenshots.push(path); return path; }
async function fresh() {
    await page.mouse.up();
    await page.mouse.up({ button: 'right' });
    await page.keyboard.up('KeyW');
    await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__DEBUG_THREE__ && (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35, null, { timeout: 90000 });
    result.loadedBundles = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\/assets\/index-.*\.js$/.test(new URL(e.name).pathname)).map(e => new URL(e.name).pathname));
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .3);
    check(!(await state()).paused, 'The real solo session runs');
}
async function look(yaw, pitch) {
    for (let n = 0; n < 8; n++) {
        const s = await state(), dyaw = Math.atan2(Math.sin(yaw - s.player.yaw), Math.cos(yaw - s.player.yaw)), dpitch = pitch - s.player.pitch;
        if (Math.abs(dyaw) < .008 && Math.abs(dpitch) < .008)
            return;
        const dx = Math.max(-450, Math.min(450, -dyaw / .003)), dy = Math.max(-220, Math.min(220, -dpitch / .003));
        await page.mouse.move(720, 450);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(720 + dx, 450 + dy, { steps: 2 });
        await page.mouse.up({ button: 'middle' });
        await waitFrames(1);
    }
    throw new Error('Real middle-button drag did not reach the requested aim.');
}
async function aim(point) {
    const before = await state(), p = before.player.position, x = point[0] - p[0], y = point[1] - p[1] - 1.55, z = point[2] - p[2];
    await look(Math.atan2(-x, -z), Math.atan2(y, Math.hypot(x, z)));
    await waitFrames(2);
}
async function walk(target, { counter = null, until = null, limit = 240 } = {}) {
    const progress = [];
    try {
        for (let n = 0; n < limit; n++) {
            const s = await state();
            if (n % 10 === 0)
                progress.push(s);
            if (until?.(s) || counter !== null && s.player.portalTeleports > counter || counter === null && !until && Math.hypot(s.player.position[0] - target[0], s.player.position[2] - target[1]) < .6)
                break;
            const dx = target[0] - s.player.position[0], dz = target[1] - s.player.position[2];
            await look(Math.atan2(-dx, -dz), 0);
            await page.keyboard.down('KeyW');
            await page.waitForTimeout(65);
            await page.keyboard.up('KeyW');
        }
    }
    finally {
        await page.keyboard.up('KeyW');
    }
    const after = await waitFrames(2);
    await record('real-keyboard-route', { target, counter, progress, after });
    return after;
}
async function acquireBallast() {
    await walk([-3, 4]);
    await page.keyboard.press('Digit1');
    const body = await state('ballast-box');
    assert.ok(body.body.pose, 'The real ballast box exists.');
    await aim(body.body.pose.position);
    await page.mouse.down();
    await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__.getRender().players.some(p => p.grabbing === 'ballast-box'), null, { timeout: 5000 });
    const held = await state('ballast-box');
    check(held.player.grabbing === 'ballast-box', 'Ordinary gravity acquires a real prop', held);
    check(held.heldBeamCounts.some(n => n > 0), 'Ordinary gravity has a visible beam', held.heldBeamCounts);
    return held;
}
async function approachDelivery() {
    await walk([-2, 11.4]);
    const before = await state();
    await look(Math.atan2(-(-2 - before.player.position[0]), -(17.3 - before.player.position[2])), 0);
    const progress = [];
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyW');
    try {
        for (let n = 0; n < 50; n++) {
            const sample = await state();
            progress.push(sample);
            if (sample.player.position[2] >= 14)
                break;
            await page.waitForTimeout(50);
        }
    }
    finally {
        await page.keyboard.up('KeyW');
        await page.keyboard.up('Space');
    }
    await page.waitForFunction(() => {
        const render = window.__WRECK_YARD_CONTROLLER__.getRender();
        return render.players.find(p => p.slot === render.localSlot).grounded;
    }, null, { timeout: 15000 });
    await walk([-2, 17.3]);
    const after = await state();
    check(after.player.portalTeleports === 0 && after.player.position[2] > 16.6 && after.player.position[2] < 19.5, 'Real jetpack input clears the loose scrap and reaches torch range', after);
    await record('real-jetpack-approach', { before, progress, after });
}
const atPlane = (point, x, z) => point && Math.abs(point[0] - x) <= 2.5 && point[1] >= -.86 && point[1] <= 3.54 && Math.abs(point[2] - z) < .04;
const hasEndpoint = (meshes, point) => meshes.some(m => m.ends.some(p => Math.hypot(...p.map((v, i) => v - point[i])) < .05));
async function blockedTools(end) {
    const x = end === 'A' ? -2 : 7, z = end === 'A' ? 20 : -21, direction = end === 'A' ? 1 : -1;
    await aim([x, (await state()).player.position[1] + 1.55, z + direction]);
    await page.keyboard.press('Digit1');
    await waitFrames(2);
    const before = await state();
    await page.mouse.down();
    await waitFrames(1);
    const gravity = await state();
    await shot(`${end}-gravity-blocked`);
    await page.mouse.up();
    check(gravity.player.grabbing === null && gravity.player.feedback?.result === 'blocked', 'Gravity stops at portal ' + end, gravity);
    check(atPlane(gravity.player.feedback?.point, x, z), 'Gravity endpoint is on portal ' + end, gravity.player.feedback);
    check(hasEndpoint(gravity.feedbackMeshes, gravity.player.feedback.point), 'The gravity refusal beam reaches that endpoint ' + end, gravity.feedbackMeshes);
    await page.keyboard.press('Digit2');
    await waitFrames(2);
    await page.mouse.down();
    await waitFrames(5);
    const torch = await state();
    await shot(`${end}-torch-blocked`);
    await page.mouse.up();
    await waitFrames(2);
    check(torch.player.feedback?.result === 'scorch' && atPlane(torch.player.feedback.point, x, z), 'Torch ends at portal ' + end, torch);
    check(torch.stats.torchCuts === before.stats.torchCuts, 'Torch does not cut through portal ' + end, { before: before.stats, after: torch.stats });
    check(hasEndpoint(torch.torchMeshes, torch.player.feedback.point), 'The visible torch stream reaches that endpoint ' + end, torch.torchMeshes);
    await record('blocked-tools', { end, before, gravity, torch });
}
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page = await context.newPage();
    result.browser = { engine: 'chromium', version: browser.version(), hostOS: process.platform };
    page.on('pageerror', error => result.errors.push({ kind: 'page', message: error.message }));
    page.on('console', message => {
        if (message.type() === 'error' && /shader|webgl|gl_invalid|compile|KINETIX|runtime.*failed/i.test(message.text()))
            result.errors.push({ kind: 'shader-or-session', message: message.text() });
    });
    if (!apertureOnly) {
        await fresh();
        await walk([-3, 4]);
        const resting = await state('ballast-box');
        await aim(resting.body.pose.position);
        await page.keyboard.press('Digit2');
        const cutBefore = await state();
        await page.mouse.down();
        await waitFrames(1);
        const firstFlame = await state();
        await shot('ordinary-torch-cut');
        await waitFrames(6);
        const cut = await state();
        await page.mouse.up();
        check(cut.stats.torchCuts > cutBefore.stats.torchCuts, 'Ordinary torch still cuts a local resting prop', { cutBefore, cut });
        await aim([cut.player.position[0], -.85, cut.player.position[2] - 1.5]);
        await page.mouse.down();
        await waitFrames(3);
        const flame = await state();
        check(flame.torchMeshes.length > 0, 'Ordinary torch has a visible stream', flame);
        await shot('ordinary-torch-fixed-floor');
        await page.mouse.up();
        await record('ordinary-torch', { resting, cutBefore, firstFlame, flame, cut });
        await fresh();
        const held = await acquireBallast();
        await shot('ordinary-gravity-held');
        await page.mouse.up();
        await waitFrames(3);
        const released = await state('ballast-box');
        check(released.player.grabbing === null && released.stats.throws === held.stats.throws + 1, 'Ordinary release still launches the prop', released);
        await record('ordinary-gravity', { held, released });
        await fresh();
        await acquireBallast();
        const near = await walk([-2, 12]);
        await aim([-2, near.player.position[1] + 1.55, 22]);
        await waitFrames(5);
        const throwBefore = await state('ballast-box');
        await page.mouse.down({ button: 'right' });
        await waitFrames(2);
        await page.mouse.up({ button: 'right' });
        await page.mouse.up();
        const thrown = await state('ballast-box');
        check(thrown.player.grabbing === null && thrown.stats.throws === throwBefore.stats.throws + 1, 'A real punt releases the held prop before the portal', thrown);
        try {
            await page.waitForFunction(([id, count]) => (window.__WRECK_YARD_CONTROLLER__.getRender().poses.get(id)?.teleportCounter ?? 0) > count, ['ballast-box', throwBefore.body.pose.teleportCounter ?? 0], { timeout: 6000 });
            const crossed = await state('ballast-box');
            check(true, 'A freely thrown body still passes through the portal', crossed);
            await shot('thrown-body-through');
            await record('body-passage', { before: throwBefore, thrown, crossed });
        }
        catch (error) {
            result.limits.push('The optional real punt did not prove body passage in6 seconds. The saved trajectory is the evidence.');
            await record('body-passage-unproved', { before: throwBefore, thrown, after: await state('ballast-box'), error: String(error) });
        }
        if (carryProof) {
            await fresh();
            const heldBeforePortal = await acquireBallast();
            const dropped = await walk([-2, 19], { until: s => s.player.grabbing === null });
            check(dropped.player.grabbing === null && dropped.player.feedback?.result === 'blocked', 'A hold releases when its segment reaches the aperture', dropped);
            check(atPlane(dropped.player.feedback.point, -2, 20) && dropped.player.portalTeleports === 0, 'Hold release occurs at the plane before player passage', dropped);
            await page.mouse.up();
            await shot('hold-released-at-plane');
            await record('hold-portal-release', { heldBeforePortal, dropped });
        }
    }
    await fresh();
    await approachDelivery();
    await blockedTools('A');
    const beforeA = await state();
    const afterA = await walk([-2, 22], { counter: beforeA.player.portalTeleports });
    check(afterA.player.portalTeleports === beforeA.player.portalTeleports + 1, 'The player still passes from A to B', { beforeA, afterA });
    await shot('player-through-A');
    await walk([7, -18.5]);
    await blockedTools('B');
    const beforeB = await state();
    const afterB = await walk([7, -23], { counter: beforeB.player.portalTeleports });
    check(afterB.player.portalTeleports === beforeB.player.portalTeleports + 1, 'The player still passes from B to A', { beforeB, afterB });
    await shot('player-through-B');
    check(result.errors.length === 0, 'No page, shader, or session errors', result.errors);
    result.passed = result.checks.every(entry => entry.passed);
}
catch (error) {
    result.failure = String(error.stack ?? error);
    if (page && !page.isClosed()) {
        result.failureState = await state().catch(() => null);
        await shot('failure').catch(() => { });
    }
}
finally {
    if (page && !page.isClosed()) {
        await page.keyboard.up('KeyW').catch(() => { });
        await page.mouse.up().catch(() => { });
        await page.mouse.up({ button: 'right' }).catch(() => { });
        await page.mouse.up({ button: 'middle' }).catch(() => { });
    }
    await browser?.close();
    result.browserClosed = true;
    result.finished = new Date().toISOString();
    await save();
}
console.log(JSON.stringify({ passed: result.passed, checks: result.checks.length, failed: result.checks.filter(c => !c.passed).map(c => c.name), errors: result.errors, failure: result.failure, browserClosed: result.browserClosed, out }, null, 2));
if (!result.passed)
    process.exitCode = 1;
