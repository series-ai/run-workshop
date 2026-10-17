// Drive real browser input. Read game state for evidence. Do not edit the simulation.
import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { cpus, loadavg, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const values = name => args.flatMap((arg, index) => arg === name ? [args[index + 1]] : arg.startsWith(`${name}=`) ? [arg.slice(name.length + 1)] : []);
const seeds = values('--seed').flatMap(value => String(value).split(',')).map(Number);
if (!seeds.length) seeds.push(5311, 9187);
assert.ok(seeds.every(seed => Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff), '--seed requires unsigned 32-bit integers');
const mobile = args.includes('--mobile');
const vehicleDiagnostics = args.includes('--vehicle-diagnostics');
const phaseNames = ['movement', 'tools', 'props', 'torch', 'portal', 'storage', 'vehicle', 'focus', 'pause', 'restart', 'random'];
const only = values('--only').flatMap(value => String(value).split(','));
assert.ok(only.every(name => phaseNames.includes(name)), `--only requires names from ${phaseNames.join(',')}`);
const randomActions = Number(values('--actions')[0] ?? 24);
assert.ok(Number.isSafeInteger(randomActions) && randomActions >= 1 && randomActions <= 200, '--actions must be between 1 and 200');
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4490';
const rootOut = process.env.MONKEY_OUT ?? fileURLToPath(new URL('../test-results/monkey-perf/', import.meta.url));
await mkdir(rootOut, { recursive: true });

const result = {
  started: new Date().toISOString(), url: base, seeds, mobile, randomActions, only, vehicleDiagnostics,
  machine: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(), loadStart: loadavg(), node: process.version },
  limits: ['A mobile layout in desktop Chrome does not establish phone performance.',
    'CPU phases are inclusive. Do not add their durations.',
    'Actions use real keyboard and pointer events. Deterministic aim uses the existing look control.',
    'Random action order is seeded. Physics outcomes can change with browser scheduling.',
    'Tab activation records actual blur and visibility delivery. If headless Chrome delivers neither, an explicit DOM blur event checks input clearing. This fallback does not prove operating-system focus delivery.'],
  runs: [], errors: [], passed: false,
};
let browser;
let page;
let currentRun;
let currentOut;
let currentSegment;
const pressed = new Set();
let primaryHeld = false;
let touchSession;
let touchPoint;

const fail = (message, evidence, engineFault = false) => {
  const error = new Error(message);
  if (evidence !== undefined) error.evidence = evidence;
  error.engineFault = engineFault;
  throw error;
};
const requireChange = (condition, message, evidence) => { if (!condition) fail(message, evidence); };
const persist = () => writeFile(join(rootOut, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`);

async function journal(entry) {
  const record = { at: new Date().toISOString(), ...entry };
  currentRun.actions.push(record);
  await appendFile(join(currentOut, 'actions.ndjson'), `${JSON.stringify(record)}\n`);
  await persist();
  return record;
}

async function read() {
  const snapshot = await page.evaluate(() => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const status = controller?.snapshot();
    if (!controller || !status) return { fault: 'controller unavailable' };
    if (status.status === 'error') return { fault: 'session error', details: status.errorDetails ?? String(status.error) };
    const render = controller.getRender();
    if (!render) return { fault: 'render state unavailable', status: status.status };
    const player = render.players.find(entry => entry.slot === render.localSlot);
    const invalid = [];
    for (const entry of render.players) if (!entry.position.every(Number.isFinite)) invalid.push(`player:${entry.slot}`);
    for (const [id, pose] of render.poses) if (![...pose.position, ...pose.rotation].every(Number.isFinite)) invalid.push(id);
    const buggy = render.poses.get('vehicle-chassis');
    const input = controller.input;
    return { status: status.status, frame: render.frame, generation: controller.sessionGeneration,
      invalid, paused: controller.isPaused(), bodyCount: render.bodies.length,
      player: player ? { position: player.position, yaw: player.yaw, pitch: player.pitch, fuel: player.fuel,
        grounded: player.grounded, jetpackActive: player.jetpackActive, grabbing: player.grabbing,
        ridingVehicle: player.ridingVehicle, activeTool: player.activeTool, portalTeleports: player.portalTeleports,
        feedback: player.feedback ? { frame: player.feedback.frame, result: player.feedback.result, point: player.feedback.point } : null } : null,
      buggy: buggy ? { position: buggy.position, rotation: buggy.rotation } : null,
      stats: render.stats, input: { tool: input.tool, moveX: input.moveX, moveZ: input.moveZ,
        pressed: input.pressed, secondary: input.secondary, jetpack: input.jetpack, use: input.use },
      heap: performance.memory ? { usedBytes: performance.memory.usedJSHeapSize, totalBytes: performance.memory.totalJSHeapSize, limitBytes: performance.memory.jsHeapSizeLimit } : { status: 'unavailable' },
      wasmBytes: window.__WRECK_WASM_MEMORY_BYTES__?.() ?? null };
  });
  if (snapshot.fault) fail(snapshot.fault, snapshot, snapshot.fault === 'session error');
  if (snapshot.status !== 'live' || !snapshot.player) fail('Session is not live.', snapshot);
  if (snapshot.invalid.length) fail('A render pose has a non-finite value.', snapshot, true);
  if (result.errors.length) fail('A browser or shader error occurred.', result.errors, true);
  return snapshot;
}

async function waitFor(predicate, name, timeoutMs = 12000) {
  const started = performance.now();
  let last;
  let lastFrame;
  let progressedAt = started;
  while (performance.now() - started < timeoutMs) {
    last = await read();
    if (predicate(last)) return last;
    if (last.frame !== lastFrame) { lastFrame = last.frame; progressedAt = performance.now(); }
    else if (!last.paused && performance.now() - progressedAt > 8000) fail(`Frame progress stopped during ${name}.`, last, true);
    await page.waitForTimeout(75);
  }
  fail(`Timed out during ${name}.`, last);
}

async function frames(count, timeoutMs = 20000) {
  const start = await read();
  return waitFor(state => state.generation === start.generation && state.frame >= start.frame + count, `${count} simulation frames`, timeoutMs);
}

async function key(code, down) {
  if (down) { pressed.add(code); await page.keyboard.down(code); }
  else { pressed.delete(code); await page.keyboard.up(code); }
}

async function tapKey(code, count = 4) {
  await key(code, true);
  try { await frames(count); }
  finally { await key(code, false); }
}

async function holdKeys(codes, count) {
  for (const code of codes) await key(code, true);
  try { return await frames(count); }
  finally { for (const code of codes) await key(code, false); }
}

async function clickControl(label) {
  const control = page.getByLabel(label, { exact: true });
  if (mobile) await control.tap();
  else await control.click();
}

async function canvasButton(button, down) {
  const box = await page.locator('canvas').first().boundingBox();
  assert.ok(box, 'The canvas is missing.');
  // The host badge covers the center of a narrow canvas. Aim is camera-based.
  if (down && !primaryHeld) await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
  if (down) await page.mouse.down({ button });
  else await page.mouse.up({ button });
  if (button === 'left') primaryHeld = down;
}

async function touchHold(label) {
  assert.equal(touchPoint, undefined, 'A touch action is already active.');
  touchSession ??= await page.context().newCDPSession(page);
  const box = await page.getByLabel(label, { exact: true }).boundingBox();
  assert.ok(box, `${label} is missing.`);
  touchPoint = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 21 };
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
}

async function touchUp() {
  if (!touchPoint) return;
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  touchPoint = undefined;
}

async function neutral() {
  await touchUp().catch(() => {});
  for (const code of [...pressed]) await key(code, false).catch(() => {});
  for (const button of ['left', 'right', 'middle']) await page.mouse.up({ button }).catch(() => {});
  primaryHeld = false;
}

async function look(yaw, pitch = 0) {
  await page.evaluate(([yaw, pitch]) => window.__SET_LOOK_ANGLES__(yaw, pitch), [yaw, pitch]);
}

async function aim(point) {
  const state = await read();
  const [x, y, z] = state.player.position;
  const dx = point[0] - x, dz = point[2] - z;
  await look(Math.atan2(-dx, -dz), Math.atan2(point[1] - y - 1.55, Math.hypot(dx, dz)));
}

async function body(id) {
  await read();
  return page.evaluate(id => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const selected = render.bodies.find(entry => entry.id === id);
    const pose = render.poses.get(id);
    return selected && pose ? { id, position: pose.position, rotation: pose.rotation, label: selected.label,
      storageBay: selected.storageBay, model: selected.renderModel, dims: selected.dims,
      occupied: selected.voxels.reduce((count, value) => count + Number(value !== 0), 0) } : null;
  }, id);
}

async function targets(kind, limit = 12) {
  await read();
  return page.evaluate(({ kind, limit }) => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find(entry => entry.slot === render.localSlot);
    return render.bodies.filter(entry => entry.motion === 'dynamic' && entry.id !== 'vehicle-chassis'
      && (kind === 'storage' ? entry.storageBay === 'storage' : kind === 'returns' ? entry.storageBay === 'returns' : !entry.storageBay))
      .map(entry => ({ id: entry.id, position: render.poses.get(entry.id)?.position, dims: entry.dims }))
      .filter(entry => entry.position && Math.hypot(...entry.position.map((value, axis) => value - player.position[axis])) < 9)
      .sort((a, b) => Math.hypot(...a.position.map((value, axis) => value - player.position[axis])) - Math.hypot(...b.position.map((value, axis) => value - player.position[axis])))
      .slice(0, limit);
  }, { kind, limit });
}

async function tool(name) {
  const activeName = name === 'hand' ? 'gravity' : name;
  if (mobile && name !== 'orbit') {
    const current = await read();
    if (current.input.tool === 2) await tapKey('KeyO', 2);
    if ((await read()).player.activeTool !== activeName) await clickControl(name === 'hand' ? 'Equip gravity gun' : 'Equip torch');
  } else {
    const button = name === 'hand' ? /Gravity Gun/i : name === 'torch' ? /Plasma Torch/i : 'Orbit (O)';
    await page.getByRole('button', { name: button, exact: name === 'orbit' }).click();
  }
  await frames(2);
}

async function beginGrab() {
  if (mobile) await clickControl('Grab');
  else await canvasButton('left', true);
}

async function releaseGrab(punt = false) {
  if (mobile) {
    const held = (await read()).player.grabbing;
    await clickControl(held ? 'Throw' : 'Push');
  } else if (punt) {
    await canvasButton('right', true);
    await frames(3);
    await canvasButton('right', false);
    await canvasButton('left', false);
  } else await canvasButton('left', false);
}

async function acquire(kind = 'prop', required = true) {
  await tool('hand');
  const attempts = [];
  for (const candidate of await targets(kind)) {
    const live = await body(candidate.id);
    if (!live) continue;
    await aim(live.position);
    await frames(2);
    await beginGrab();
    await frames(5);
    const state = await read();
    attempts.push({ id: candidate.id, result: state.player.feedback?.result, held: state.player.grabbing });
    if (state.player.grabbing) {
      const held = await body(state.player.grabbing);
      if (kind === 'prop' ? !held?.storageBay : held?.storageBay === kind) return { ...held, attempts };
    }
    if (state.player.grabbing) await releaseGrab();
    else if (!mobile) await canvasButton('left', false);
    await frames(3);
  }
  if (required) fail(`No ${kind} body was held.`, attempts);
  return { refused: true, attempts };
}

async function walkTo(target, radius = 0.5, crossingCounter = null) {
  let previous;
  let stalls = 0;
  let escapes = 0;
  try {
    for (let step = 0; step < 320; step++) {
      const state = await read();
      const [x, , z] = state.player.position;
      if (crossingCounter !== null && state.player.portalTeleports > crossingCounter) return state;
      if (crossingCounter === null && Math.hypot(target[0] - x, target[1] - z) < radius) return state;
      stalls = previous && Math.hypot(x - previous[0], z - previous[1]) < 0.02 ? stalls + 1 : 0;
      previous = [x, z];
      await look(Math.atan2(-(target[0] - x), -(target[1] - z)));
      await key('KeyW', true);
      await page.waitForTimeout(65);
      if (stalls >= 8) {
        await key('KeyW', false);
        const side = escapes++ % 2 ? 'KeyA' : 'KeyD';
        await holdKeys([side, ...(escapes > 2 ? ['Space'] : [])], 8);
        stalls = 0;
        if (escapes > 8) break;
      }
    }
  } finally { await key('KeyW', false); }
  fail('A targeted walking route did not reach its destination.', { target, state: await read() });
}

async function shot(name) {
  const path = join(currentOut, `${currentSegment === 'vehicle-warm' ? 'warm-' : ''}${name}.png`);
  await page.screenshot({ path, animations: 'disabled', timeout: 15000 });
  currentRun.screenshots.push(path);
  return path;
}

async function beamState() {
  return page.evaluate(() => {
    const scene = window.__DEBUG_THREE__.scene;
    const root = scene.getObjectByName('TractorBeam');
    const meshes = root?.children.filter(entry => entry.isInstancedMesh) ?? [];
    const widths = meshes.map(mesh => Math.hypot(...mesh.instanceMatrix.array.slice(0, 3)));
    const materialState = root?.children.filter(entry => entry.material).map(entry => ({ depthWrite: entry.material.depthWrite,
      depthTest: entry.material.depthTest, blending: entry.material.blending })) ?? [];
    const sheath = scene.getObjectByName('tractor-beam-sheath');
    const beads = scene.getObjectByName('tractor-beam-beads');
    let beadFraction = null;
    if (sheath?.count >= 22 && beads?.count > 0) {
      const first = sheath.instanceMatrix.array, endOffset = 21 * 16;
      const p0 = [0, 1, 2].map(axis => first[12 + axis] - first[4 + axis] * 0.5);
      const p2 = [0, 1, 2].map(axis => first[endOffset + 12 + axis] + first[endOffset + 4 + axis] * 0.5);
      const t = 1 / 22;
      const p1 = [0, 1, 2].map(axis => (first[12 + axis] + first[4 + axis] * 0.5 - (1 - t) ** 2 * p0[axis] - t * t * p2[axis]) / (2 * (1 - t) * t));
      const point = beads.instanceMatrix.array.slice(12, 15);
      let nearest = Infinity;
      for (let index = 0; index <= 2000; index++) {
        const fraction = index / 2000;
        const distance = Math.hypot(...p0.map((value, axis) => (1 - fraction) ** 2 * value + 2 * (1 - fraction) * fraction * p1[axis] + fraction ** 2 * p2[axis] - point[axis]));
        if (distance < nearest) { nearest = distance; beadFraction = fraction; }
      }
    }
    let selectedSurfaces = 0;
    scene.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material?.uniforms?.uGravityHeld?.value > 0) selectedSurfaces++;
        const uniforms = material?.userData.gravitySurfaceUniforms;
        if (uniforms && (uniforms.uGravityHeld.value > 0 || uniforms.uGravityHeldIndices.value.toArray().some(index => index >= 0))) selectedSurfaces++;
      }
    });
    return { present: Boolean(root), instances: meshes.map(mesh => mesh.count), widths, materialState, beadFraction, selectedSurfaces,
      endpoints: root?.children.filter(entry => entry.isSprite && entry.visible).map(entry => entry.scale.toArray()) ?? [] };
  });
}

async function beamProof(label) {
  const first = await beamState();
  requireChange(first.present && first.instances.every(count => count > 0) && first.selectedSurfaces > 0
    && first.materialState.every(material => !material.depthWrite && material.depthTest && material.blending === 2), 'Beam and object shader did not render together.', first);
  await frames(4);
  const next = await beamState();
  requireChange(first.widths.every((value, index) => Math.abs(value - next.widths[index]) < 1e-5)
    && JSON.stringify(first.endpoints) === JSON.stringify(next.endpoints), 'Beam width or endpoint size changed during hold.', { first, next });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frames(4);
  const reducedBefore = await beamState();
  await frames(8);
  const reducedAfter = await beamState();
  requireChange(reducedBefore.beadFraction !== null && Math.abs(reducedBefore.beadFraction - reducedAfter.beadFraction) <= 0.002,
    'Reduced motion did not stop bead flow.', { reducedBefore, reducedAfter });
  await shot(`${label}-beam-reduced`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return { first, next, reducedBefore, reducedAfter };
}

async function action(name, work, options = {}) {
  const before = await read();
  const id = currentRun.actions.filter(entry => entry.stage === 'start').length + 1;
  await journal({ id, stage: 'start', name, before });
  try {
    const details = await work(before);
    const after = await read();
    if (!options.allowNoProgress && after.generation === before.generation && after.frame <= before.frame) await frames(1);
    await journal({ id, stage: 'complete', name, after: await read(), details });
    return details;
  } catch (error) {
    await journal({ id, stage: 'failed', name, error: String(error.stack ?? error), evidence: error.evidence });
    throw error;
  }
}

function summarize(report, before, after, wallMs) {
  const intervals = report.records.filter(entry => entry.kind === 'counter' && entry.label === 'frame.intervalMs').map(entry => entry.value);
  const steps = report.records.filter(entry => entry.kind === 'counter' && entry.label === 'sim.steps').reduce((sum, entry) => sum + entry.value, 0);
  return { wallMs, frameStart: before.frame, frameEnd: after?.frame, generationStart: before.generation, generationEnd: after?.generation,
    observedSimSteps: steps, simTicksPerWallSecond: steps / (wallMs / 1000),
    frameIntervals: report.counterSummary['frame.intervalMs'],
    stalls: { over50Ms: intervals.filter(value => value > 50).length, over100Ms: intervals.filter(value => value > 100).length, over250Ms: intervals.filter(value => value > 250).length },
    cpuPhases: report.phaseSummary, gpuPhases: report.gpuPhaseSummary,
    counters: report.counterSummary, heap: report.jsHeap, wasm: report.wasmMemory, webgl: report.webglResources,
    gpu: { status: report.gpu.status, reason: report.gpu.reason, lostQueries: report.gpu.lostQueryCount },
    elapsedMs: report.elapsedMs, overwrittenRecords: report.overwrittenRecords,
    truncated: report.overwrittenRecords > 0 || wallMs > report.elapsedMs + 1500,
    inputLatency: report.inputLatencySummary };
}

async function startVehicleDiagnostics(name) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', categories: 'devtools.timeline,v8,disabled-by-default-v8.gc,blink.user_timing,gpu' });
  await page.evaluate(() => {
    const renderer = window.__DEBUG_THREE__.gl, gl = renderer.getContext();
    const data = { timeOrigin: performance.timeOrigin, calls: {}, slowCalls: [], renders: [] };
    const originals = new Map();
    for (const name of ['shaderSource', 'compileShader', 'linkProgram', 'getProgramInfoLog', 'getShaderInfoLog', 'getProgramParameter', 'getShaderParameter', 'texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'bufferData', 'bufferSubData', 'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = gl[name];
      originals.set(name, original);
      gl[name] = function (...args) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally {
          const ms = performance.now() - start;
          const entry = data.calls[name] ??= { count: 0, totalMs: 0, maxMs: 0 };
          entry.count++; entry.totalMs += ms; entry.maxMs = Math.max(entry.maxMs, ms);
          if (ms >= 0.5) data.slowCalls.push({ name, startMs: start, durationMs: ms, stack: new Error().stack });
        }
      };
    }
    const originalRender = renderer.render;
    renderer.render = function (scene, camera) {
      const start = performance.now(), programs = renderer.info.programs.length;
      try { return originalRender.call(this, scene, camera); }
      finally {
        const ms = performance.now() - start;
        if (ms >= 5) {
          const entry = { startMs: start, durationMs: ms, mainScene: scene === window.__DEBUG_THREE__.scene,
            target: renderer.getRenderTarget()?.uuid ?? null, programsBefore: programs, programsAfter: renderer.info.programs.length,
            frame: window.__WRECK_YARD_CONTROLLER__.getRender()?.frame, position: camera.position.toArray() };
          data.renders.push(entry);
          performance.measure('monkey.render', { start, end: start + ms, detail: entry });
        }
      }
    };
    window.__MONKEY_DIAGNOSTICS__ = { data, restore() { for (const [name, original] of originals) gl[name] = original; renderer.render = originalRender; } };
  });
  return async () => {
    try {
      const data = await page.evaluate(() => {
        const probe = window.__MONKEY_DIAGNOSTICS__;
        probe.restore(); delete window.__MONKEY_DIAGNOSTICS__;
        return probe.data;
      });
      await writeFile(join(currentOut, `${name}-webgl.json`), JSON.stringify(data, null, 2));
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(join(currentOut, `${name}.cpuprofile`), JSON.stringify(profile));
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      const { stream } = await complete;
      const chunks = [];
      for (;;) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        chunks.push(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : Buffer.from(chunk.data));
        if (chunk.eof) break;
      }
      await cdp.send('IO.close', { handle: stream });
      await writeFile(join(currentOut, `${name}-trace.json`), Buffer.concat(chunks));
      currentRun.diagnostics ??= [];
      currentRun.diagnostics.push({ name, methods: '1 ms CPU sampling; Chrome timeline/GC/GPU trace; timed WebGL calls and render calls',
        limits: 'Instrumentation adds cost. The first visible resources and route state are not fully isolated.' });
    } finally { await cdp.detach(); }
  };
}

async function segment(name, work) {
  const before = await read();
  const started = performance.now();
  await page.evaluate(() => window.__WRECK_YARD_PERF__.start({ capacity: 65536, maxDurationMs: 60000 }));
  currentSegment = name;
  const stopDiagnostics = vehicleDiagnostics && name.startsWith('vehicle') ? await startVehicleDiagnostics(name) : null;
  let error;
  try { await work(); }
  catch (cause) { error = cause; }
  finally {
    const wallMs = performance.now() - started;
    const report = await page.evaluate(() => window.__WRECK_YARD_PERF__.stop()).catch(() => null);
    const after = await read().catch(() => null);
    if (stopDiagnostics) await stopDiagnostics();
    if (report) {
      const path = join(currentOut, `${name}-perf.json`);
      await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
      currentRun.segments.push({ name, passed: !error, report: path, summary: summarize(report, before, after, wallMs) });
    } else currentRun.segments.push({ name, passed: false, error: 'The recorder report was unavailable.', wallMs });
    currentSegment = undefined;
    await persist();
  }
  if (error) throw error;
}

async function startSession() {
  await page.goto(`${base}/?quality=${mobile ? 'low' : 'high'}&capture=off&record`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__WRECK_YARD_PERF__ && window.__SET_LOOK_ANGLES__
    && (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 90000 });
  return read();
}

async function restart() {
  await neutral();
  if (await page.locator('[aria-label="Paused"]').count() === 0 && mobile) await clickControl('Pause');
  const leave = page.getByRole('button', { name: /^Leave match$/i });
  if (mobile) await leave.tap(); else await leave.click();
  await page.getByRole('button', { name: 'Play Solo', exact: true }).waitFor();
  if (mobile) await page.getByRole('button', { name: 'Play Solo', exact: true }).tap();
  else await page.getByRole('button', { name: 'Play Solo', exact: true }).click();
  await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__?.snapshot().status === 'live'
    && (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 5, null, { timeout: 90000 });
  await frames(8);
}

const targeted = {
  movement: async () => {
    await action('walk-and-strafe', async before => {
      await look(0);
      await holdKeys(['KeyW'], 12);
      await holdKeys(['KeyD'], 10);
      const after = await read();
      const moved = Math.hypot(after.player.position[0] - before.player.position[0], after.player.position[2] - before.player.position[2]);
      requireChange(moved > 0.5, 'Movement did not change player position.', { before, after });
      return { movedMeters: moved };
    });
    await action('jetpack', async before => {
      const during = await holdKeys(['Space'], 15);
      requireChange(during.player.jetpackActive && during.player.position[1] > before.player.position[1] + 0.2, 'Jetpack did not lift the player.', { before, during });
      await frames(20);
      return { during };
    });
  },
  tools: async () => {
    await action('hud-tool-and-orbit-switch', async () => {
      await tool('torch');
      requireChange((await read()).player.activeTool === 'torch', 'Torch HUD selection failed.');
      if (mobile) {
        await journal({ stage: 'observation', name: 'mobile-orbit-unavailable', reason: 'The touch UI does not offer Orbit. Desktop runs verify the Orbit contract.' });
      } else {
        await tapKey('KeyO', 3);
        requireChange((await read()).input.tool === 2, 'Orbit did not activate.');
        await tapKey('KeyO', 3);
        requireChange((await read()).player.activeTool === 'torch', 'Orbit did not return to the torch.');
      }
      await tool('hand');
      requireChange((await read()).player.activeTool === 'gravity', 'Gravity HUD selection failed.');
      return { tools: mobile ? ['torch', 'hand'] : ['torch', 'orbit', 'torch', 'hand'] };
    });
  },
  props: async () => {
    await action('prop-grab-hold-and-release', async () => {
      const held = await acquire();
      const before = await read();
      await shot('prop-held');
      const beam = await beamProof('prop');
      await look(before.player.yaw + 0.3, before.player.pitch + 0.08);
      await frames(12);
      const moved = await body(held.id);
      requireChange((await read()).player.grabbing === held.id && moved
        && Math.hypot(...moved.position.map((value, axis) => value - held.position[axis])) > 0.05, 'The held prop did not follow the aim.');
      await releaseGrab();
      const released = await waitFor(state => !state.player.grabbing && state.stats.throws > before.stats.throws, 'prop release');
      await frames(2);
      const clearedBeam = await beamState();
      requireChange(clearedBeam.instances.every(count => count === 0) && clearedBeam.endpoints.length === 0, 'Released beam did not clear.', clearedBeam);
      await shot('prop-released');
      return { held, moved, beam, released };
    });
    await action('prop-punt', async before => {
      const held = await acquire();
      await releaseGrab(true);
      const after = await waitFor(state => !state.player.grabbing && state.stats.throws > before.stats.throws, 'prop punt');
      return { held, feedback: after.player.feedback };
    });
  },
  torch: async () => {
    await action('torch-real-cut', async () => {
      const target = await body('steel-case');
      requireChange(target, 'The torch target is missing.');
      await walkTo([target.position[0], target.position[2] + 2.0], 0.45);
      await tool('torch');
      const before = await read();
      let after = before;
      if (mobile) await touchHold('Cut'); else await canvasButton('left', true);
      try {
        for (let stroke = 0; stroke < 20; stroke++) {
          const live = await body(target.id);
          await aim([live?.position[0] ?? target.position[0], (live?.position[1] ?? target.position[1]) + 0.12,
            (live?.position[2] ?? target.position[2]) + (stroke % 5 - 2) * 0.06]);
          await frames(3);
          after = await read();
          if (after.stats.torchCuts > before.stats.torchCuts || after.stats.fractures > before.stats.fractures) break;
        }
      } finally { if (mobile) await touchUp(); else await canvasButton('left', false); }
      requireChange(after.stats.torchCuts > before.stats.torchCuts || after.stats.fractures > before.stats.fractures, 'The torch produced no real cut.', { before, after });
      await shot('torch-cut');
      return { target, statsBefore: before.stats, statsAfter: after.stats };
    });
  },
  portal: async () => {
    await action('portal-passage-a', async before => {
      const crossed = await walkTo([-2, 22], 0.4, before.player.portalTeleports);
      requireChange(crossed.player.position[0] > 4 && crossed.player.position[2] < -15, 'Portal passage reached an unexpected exit.', crossed);
      await shot('portal-crossed');
      return { before: before.player, after: crossed.player };
    });
  },
  storage: async () => {
    await action('storage-route', async before => {
      await walkTo([-2, 22], 0.4, before.player.portalTeleports);
      for (const target of [[6.8, -19.8], [-1, -19.8], [-7.35, -19.8], [-7.8, -17.6]]) await walkTo(target, 0.5);
    });
    await action('shipping-stack-grab-wake-and-punt', async before => {
      const held = await acquire('storage');
      await shot('storage-held');
      const beam = await beamProof('storage');
      const state = await read();
      await look(state.player.yaw + 0.45, state.player.pitch + 0.2);
      await frames(20);
      const moved = await body(held.id);
      requireChange(moved && Math.hypot(...moved.position.map((value, axis) => value - held.position[axis])) > 0.05, 'The storage crate did not move.', { held, moved });
      await releaseGrab(true);
      const after = await waitFor(snapshot => !snapshot.player.grabbing && snapshot.stats.throws > before.stats.throws, 'shipping crate punt');
      await frames(60, 45000);
      await shot('storage-after-punt');
      return { held, moved, beam, after };
    });
  },
  vehicle: async () => {
    await action('buggy-route-and-mount', async () => {
      for (const target of [[10, 6], [10, -10]]) await walkTo(target, 0.7);
      const buggy = (await read()).buggy;
      await walkTo([buggy.position[0] - 1.3, buggy.position[2]], 0.5);
      await tapKey('KeyE', 5);
      const mounted = await waitFor(state => state.player.ridingVehicle, 'buggy mount', 8000);
      await shot('buggy-mounted');
      return { mounted };
    });
    await action('buggy-drive-and-steer', async before => {
      await holdKeys(['KeyW'], 30);
      await holdKeys(['KeyW', 'KeyD'], 20);
      const after = await read();
      const moved = Math.hypot(after.buggy.position[0] - before.buggy.position[0], after.buggy.position[2] - before.buggy.position[2]);
      requireChange(moved > 0.7, 'The buggy did not move under real drive input.', { before, after });
      await shot('buggy-driven');
      await tapKey('Backspace', 4);
      await waitFor(state => !state.player.ridingVehicle, 'buggy dismount');
      return { movedMeters: moved };
    });
  },
  focus: async () => {
    await action('focus-loss-clears-input', async () => {
      await page.evaluate(() => {
        window.__MONKEY_FOCUS_EVENTS__ = { blur: 0, hidden: 0, visible: 0 };
        window.addEventListener('blur', () => { window.__MONKEY_FOCUS_EVENTS__.blur++; });
        document.addEventListener('visibilitychange', () => {
          window.__MONKEY_FOCUS_EVENTS__[document.hidden ? 'hidden' : 'visible']++;
        });
      });
      await key('KeyW', true);
      await frames(4);
      const other = await page.context().newPage();
      try {
        await other.goto('about:blank');
        await other.bringToFront();
        await page.waitForTimeout(250);
        await page.bringToFront();
        await frames(3);
        const delivery = await page.evaluate(() => ({ ...window.__MONKEY_FOCUS_EVENTS__, hasFocus: document.hasFocus(), hiddenNow: document.hidden }));
        const tabDelivered = delivery.blur > 0 || delivery.hidden > 0;
        if (!tabDelivered) {
          await journal({ stage: 'observation', name: 'headless-focus-delivery', delivered: false, delivery });
          // Exercise the lifecycle handler separately when headless tab activation emits no event.
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          await frames(3);
        }
        const cleared = await read();
        requireChange(cleared.input.moveZ === 0 && !cleared.input.pressed && !cleared.input.secondary, 'Focus loss retained tool or move input.', cleared);
        return { cleared, delivery, method: tabDelivered ? 'real-tab-lifecycle-event' : 'explicit-dom-blur-fallback' };
      } finally { await key('KeyW', false); await other.close(); }
    });
  },
  pause: async () => {
    await action('pause-and-resume', async () => {
      if (mobile) await clickControl('Pause'); else await page.keyboard.press('Escape');
      await page.locator('[aria-label="Paused"]').waitFor({ timeout: 8000 });
      await page.waitForTimeout(150);
      const paused = await read();
      await page.waitForTimeout(350);
      const still = await read();
      requireChange(paused.paused && still.frame === paused.frame, 'Solo did not pause.', { paused, still });
      const resume = page.getByRole('button', { name: /^Resume(?: fullscreen)?$/ });
      if (mobile) await resume.tap(); else await resume.click();
      await page.locator('[aria-label="Paused"]').waitFor({ state: 'hidden', timeout: 8000 });
      const resumed = await frames(4);
      return { paused, resumed };
    });
  },
  restart: async () => {
    await action('restart-and-advance-past-frame-330', async before => {
      await restart();
      const restarted = await read();
      requireChange(restarted.generation > before.generation && restarted.frame < before.frame + 30, 'The solo session did not restart.', { before, restarted });
      const after = await waitFor(state => state.frame > 330, 'restarted session past frame 330', 60000);
      await shot('restarted-after-frame-330');
      // A second exit also checks that the menu clears the prior start state.
      await restart();
      const second = await read();
      return { restarted, after, second };
    });
  },
};

function randomSource(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000; };
}

async function randomBlock(seed) {
  const random = randomSource(seed);
  const operations = ['walk', 'strafe', 'jetpack', 'aim', 'switch', 'grab', 'release', 'punt', 'torch', 'orbit'];
  for (let index = 0; index < randomActions; index++) {
    const name = operations[Math.floor(random() * operations.length)];
    const yaw = (random() * 2 - 1) * Math.PI;
    const pitch = random() * 0.8 - 0.4;
    const duration = 3 + Math.floor(random() * 10);
    await action(`random-${index}-${name}`, async before => {
      await look(yaw, pitch);
      if (name === 'walk') await holdKeys(['KeyW'], duration);
      else if (name === 'strafe') await holdKeys([random() < 0.5 ? 'KeyA' : 'KeyD'], duration);
      else if (name === 'jetpack') await holdKeys(['Space'], duration);
      else if (name === 'switch') await tool(random() < 0.5 ? 'hand' : 'torch');
      else if (name === 'grab') {
        if (!before.player.grabbing) return acquire('prop', false);
      } else if (name === 'release' || name === 'punt') {
        await tool('hand');
        if (before.player.grabbing) await releaseGrab(name === 'punt');
        else if (name === 'punt') {
          if (mobile) await clickControl('Push');
          else { await canvasButton('right', true); await frames(duration); await canvasButton('right', false); }
        }
      } else if (name === 'torch') {
        await tool('torch');
        if (mobile) await touchHold('Cut'); else await canvasButton('left', true);
        try { await frames(duration); }
        finally { if (mobile) await touchUp(); else await canvasButton('left', false); }
      } else if (name === 'orbit') {
        if (mobile) return { seed, index, refusal: true, reason: 'Orbit is unavailable in the touch UI.' };
        await tapKey('KeyO', 2);
        await tapKey('KeyO', 2);
      } else await frames(duration);
      const after = await read();
      return { seed, index, yaw, pitch, duration, result: after.player.feedback?.result ?? null,
        heldBefore: before.player.grabbing, heldAfter: after.player.grabbing,
        refusal: ['miss', 'blocked'].includes(after.player.feedback?.result) };
    });
  }
  await neutral();
  if ((await read()).player.grabbing) await releaseGrab();
  await frames(4);
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-precise-memory-info'] });
  for (const [runIndex, seed] of seeds.entries()) {
    currentOut = join(rootOut, `${seed}-${mobile ? 'mobile' : 'desktop'}`);
    await mkdir(currentOut, { recursive: true });
    await writeFile(join(currentOut, 'actions.ndjson'), '');
    currentRun = { seed, mobile, actions: [], segments: [], screenshots: [], failures: [], passed: false };
    result.runs.push(currentRun);
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
      ...(mobile ? { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' } : {}) });
    page = await context.newPage();
    page.on('pageerror', error => result.errors.push({ seed, segment: currentSegment, kind: 'page', message: error.message }));
    page.on('console', message => {
      if (message.type() === 'error' && /shader|webgl|gl_invalid|compile|KINETIX|physics\.checkpoint|runtime.*failed/i.test(message.text())) {
        result.errors.push({ seed, segment: currentSegment, kind: 'console', message: message.text() });
      }
    });
    page.on('crash', () => result.errors.push({ seed, segment: currentSegment, kind: 'page-crash' }));
    await startSession();
    currentRun.hardware = await page.evaluate(() => {
      const renderer = window.__DEBUG_THREE__.gl;
      const gl = renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
        dpr: renderer.getPixelRatio(), drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        shadows: renderer.shadowMap.enabled, userAgent: navigator.userAgent };
    });
    // Targeted cases run once. Each random seed starts from a fresh session.
    if (runIndex === 0) for (const [name, work] of Object.entries(targeted)) {
      if (only.length && !only.includes(name)) continue;
      if (currentRun.segments.length) await startSession();
      try {
        await segment(name, work);
        if (vehicleDiagnostics && name === 'vehicle') {
          await neutral();
          await frames(8);
          await segment('vehicle-warm', work);
        }
      }
      catch (error) {
        if (error.engineFault) throw error;
        currentRun.failures.push({ phase: name, message: String(error.stack ?? error), evidence: error.evidence });
        await shot(`${name}-failure`).catch(() => {});
        await neutral();
        continue;
      }
      await neutral();
      await frames(3);
      const state = await read();
      requireChange(state.input.moveX === 0 && state.input.moveZ === 0 && !state.input.pressed
        && !state.input.secondary && !state.input.jetpack, 'A targeted phase left input active.', state);
    }
    if (!only.length || only.includes('random')) {
      if (currentRun.segments.length) await startSession();
      await segment(`random-${seed}`, () => randomBlock(seed));
    }
    currentRun.final = await read();
    currentRun.passed = currentRun.failures.length === 0;
    await context.close();
    touchSession = undefined;
    touchPoint = undefined;
    await persist();
  }
  result.passed = result.runs.every(run => run.passed);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  result.failure = { message: String(error.stack ?? error), evidence: error.evidence, segment: currentSegment };
  if (page && !page.isClosed()) {
    result.failure.state = await read().catch(cause => ({ error: String(cause), evidence: cause.evidence }));
    await shot('failure').catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await neutral().catch(() => {});
  try { await browser?.close(); }
  finally {
    result.finished = new Date().toISOString();
    result.machine.loadEnd = loadavg();
    await persist();
  }
}
console.log(JSON.stringify({ passed: result.passed, seeds, mobile, actions: result.runs.reduce((sum, run) => sum + run.actions.filter(entry => entry.stage === 'complete').length, 0),
  segments: result.runs.flatMap(run => run.segments.map(segment => ({ seed: run.seed, name: segment.name, passed: segment.passed,
    intervalP50: segment.summary?.frameIntervals?.p50, intervalP95: segment.summary?.frameIntervals?.p95,
    simTicksPerWallSecond: segment.summary?.simTicksPerWallSecond, stalls: segment.summary?.stalls }))),
  errors: result.errors, failure: result.failure, output: rootOut }, null, 2));
