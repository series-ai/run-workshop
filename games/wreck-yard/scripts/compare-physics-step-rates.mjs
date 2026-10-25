// Run one arm per process. Run timing processes in sequence.
// Example: node --expose-gc scripts/compare-physics-step-rates.mjs --arm 30x6 --output test-results/rates-a.json
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, loadavg } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arms = { '30x6': { tickRate: 30, substeps: 6 }, '60x1': { tickRate: 60, substeps: 1 } };
const args = process.argv.slice(2);
let arm, output;
for (let index = 0; index < args.length; index += 2) {
  const value = args[index + 1];
  assert.ok(value && !value.startsWith('--'), 'Each option needs a value.');
  if (args[index] === '--arm') arm = value;
  else if (args[index] === '--output') output = resolve(value);
  else throw new Error(`Unknown option: ${args[index]}`);
}
assert.ok(Object.hasOwn(arms, arm), 'Use --arm 30x6 or --arm 60x1.');
assert.ok(output, 'Use --output with a new JSON file path.');
const sdkUrl = new URL('../node_modules/@series-inc/rundot-syncplay/', import.meta.url);
const { physicsWasmMetadata: metadata, physicsWasmUrl } = await import(new URL('core/src/physics/physics-wasm-module.generated.mjs', sdkUrl));
const sha = value => createHash('sha256').update(value).digest('hex');
const wasmSha256 = sha(await readFile(physicsWasmUrl()));
assert.equal(wasmSha256, metadata.wasmSha256);
assert.equal(metadata.artifact, 'production');
const sdk = await import(new URL('dist/physics/3d.js', sdkUrl));
await sdk.initPhysics3D({ artifact: 'production' });
const { nativePhysicsInstanceMemory: memory } = await import(new URL('core/src/physics/world.mjs', sdkUrl));
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const { tickRate, substeps } = arms[arm];
const definition = {
  tickRate, substeps, velocityIterations: 6, initialGravity: { x: 0, y: -13.5, z: 0 },
  restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 512, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 1 }, portalProxyCapacity: 1,
};
const warmSeconds = 4, measuredSeconds = 16, sampleRate = 30;
const stepsPerSample = tickRate / sampleRate;
// The native engine applies retention once per outer tick.
const linearDamping = .98 ** (30 / tickRate), angularDamping = .945 ** (30 / tickRate);
const edge = .96, floorY = -.86, inertia = edge * edge / 6;
const positions = Array.from({ length: 400 }, (_, index) => ({
  x: -13.1 + (index % 8 - 3.5) * edge,
  y: floorY + edge / 2 + Math.floor(index / 40) * edge,
  z: -20.7 + (Math.floor(index / 8) % 5 - 2) * edge,
}));
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return { count: values.length, sum, mean: sum / values.length,
    p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)], max: sorted.at(-1) };
}
const report = {
  schema: 'syncplay-step-rate-comparison-v1', arm, definition, wasmSha256,
  version: JSON.parse(await readFile(new URL('package.json', sdkUrl), 'utf8')).version,
  scriptSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  environment: { date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, loadStart: loadavg() },
  fixture: { boxes: 400, edge, floorY, friction: .85, restitution: .12, linearDamping, angularDamping,
    warmSeconds, measuredSeconds, sampleRate, shoveSpeedMetersPerSecond: 6, shoveBodies: 40 },
  notes: [
    'The public step call includes the SDK facade. These timings do not isolate native solver execution.',
    'Each physics tick also calls latest(). This matches the current game read frequency per simulation tick.',
    'Timing groups cover 1/30 second in both arms. The 60 Hz group has two steps and two output reads.',
    'Both arms have equal per-second damping. Sleep delay is 0.5 seconds in the native source.',
    'The same 400-box fixture uses current game stack friction. Bodies start asleep. Inputs use SI velocities.',
    'One checkpoint is held during forward timing. Capture, restore, replay, diagnostics, and hashes are not timed.',
    'Motion is checked at 30 Hz. Replay must match within an arm. Different arms need not have equal trajectories.',
    'This test excludes game logic, rendering, networking, vehicles, portals, cutting, and mobile hardware.',
  ], scenes: [],
};
function runScene(scene) {
  global.gc?.();
  const world = sdk.createPhysicsWorld3D(definition);
  const row = { scene, samples: [], hostStart: loadavg() };
  report.scenes.push(row);
  let checkpoint, boxes;
  const buffers = { poses: new Float64Array(512 * 7), velocities: new Float64Array(512 * 6),
    ids: new BigUint64Array(512), status: new Uint8Array(512), teleports: new Uint32Array(512) };
  try {
    boxes = world.edit(ops => {
      ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
        position: { x: 0, y: floorY - .5, z: 0 }, friction: .82, restitution: .08, layer: 1, mask: 0xffffffff });
      return positions.map((position, index) => ops.createBody({ kind: 'dynamic', key: `box-${index}`,
        shape: { type: 'box', halfX: edge / 2, halfY: edge / 2, halfZ: edge / 2 }, position,
        orientation: { x: 0, y: 0, z: 0, w: 1 }, mass: 1, inertia: { xx: inertia, yy: inertia, zz: inertia },
        gravityScale: 1, linearDamping, angularDamping, friction: .85, restitution: .12, rollingResistance: 0,
        sleeping: true, sleepEnabled: true, sleepThreshold: .05, layer: 1, mask: 0xffffffff }));
    }).created;
    const sample = hash => {
      const { count } = world.writeBodyMotionInto(buffers.poses, buffers.velocities, buffers.ids, buffers.status, buffers.teleports);
      assert.equal(count, 401);
      let active = 0, maxSpeed = 0, maxShift = 0, minY = Infinity;
      const slots = new Map();
      for (let slot = 0; slot < count; slot++) {
        if ((buffers.status[slot] & 3) === 1) {
          if (!(buffers.status[slot] & 0x10)) active++;
          slots.set(buffers.ids[slot], slot);
          maxSpeed = Math.max(maxSpeed, Math.hypot(...buffers.velocities.subarray(slot * 6, slot * 6 + 3)));
          minY = Math.min(minY, buffers.poses[slot * 7 + 1]);
        }
      }
      boxes.forEach((box, index) => {
        const slot = slots.get(box.id);
        assert.notEqual(slot, undefined);
        const p = positions[index], offset = slot * 7;
        maxShift = Math.max(maxShift, Math.hypot(buffers.poses[offset] - p.x, buffers.poses[offset + 1] - p.y, buffers.poses[offset + 2] - p.z));
      });
      for (const [array, length] of [[buffers.poses, count * 7], [buffers.velocities, count * 6], [buffers.ids, count], [buffers.status, count], [buffers.teleports, count]]) {
        if (array instanceof Float64Array) for (const value of array.subarray(0, length)) assert.ok(Number.isFinite(value));
        hash?.update(Buffer.from(array.buffer, array.byteOffset, length * array.BYTES_PER_ELEMENT));
      }
      return { active, maxSpeed, maxShift, minY };
    };
    for (let frame = 0; frame < warmSeconds * tickRate; frame++) { world.step(); world.latest(); }
    checkpoint = world.captureCheckpoint();
    const advance = record => {
      const trace = createHash('sha256'), stepTimes = [], latestTimes = [], groups = [];
      let maximumShift = 0, maximumSpeed = 0, minimumY = Infinity, finalActive = 0, lastActiveSeconds = 0;
      if (scene !== 'rest') for (const box of boxes) world.wakeBody(box);
      if (scene === 'shove') for (const box of boxes.slice(0, 40)) world.setLinearVelocity(box, { x: 0, y: 0, z: 6 });
      const start = performance.now();
      for (let group = 1; group <= measuredSeconds * sampleRate; group++) {
        let groupCost = 0;
        for (let step = 0; step < stepsPerSample; step++) {
          const before = performance.now();
          world.step();
          const after = performance.now();
          const latest = world.latest();
          const end = performance.now();
          assert.equal(Number(latest.frame), warmSeconds * tickRate + (group - 1) * stepsPerSample + step + 1);
          if (record) { stepTimes.push(after - before); latestTimes.push(end - after); groupCost += end - before; }
        }
        if (record) groups.push(groupCost);
        const state = sample(trace), seconds = group / sampleRate;
        maximumShift = Math.max(maximumShift, state.maxShift);
        maximumSpeed = Math.max(maximumSpeed, state.maxSpeed);
        minimumY = Math.min(minimumY, state.minY);
        finalActive = state.active;
        if (state.active) lastActiveSeconds = seconds;
        if (record && (group <= 2 || group % sampleRate === 0)) row.samples.push({ seconds, ...state });
        assert.ok(performance.now() - start < 180_000, 'Scene exceeded the 180 second wall limit.');
      }
      const result = { trace: trace.digest('hex'), digest: world.digest().toString(), maximumShift, maximumSpeed, minimumY, finalActive, lastActiveSeconds };
      if (record) {
        row.publicStepMs = summary(stepTimes);
        row.latestMs = summary(latestTimes);
        row.costPer30HzIntervalMs = summary(groups);
        row.apiMsPerSimulatedSecond = (row.publicStepMs.sum + row.latestMs.sum) / measuredSeconds;
        row.stepMsPerSimulatedSecond = row.publicStepMs.sum / measuredSeconds;
        row.latestMsPerSimulatedSecond = row.latestMs.sum / measuredSeconds;
      }
      return result;
    };
    row.forward = advance(true);
    world.restoreCheckpoint(checkpoint);
    boxes = boxes.map(box => world.resolveBody(box.id));
    row.replay = advance(false);
    assert.deepEqual(row.replay, row.forward, 'Replay must match motion samples and the terminal world digest.');
    row.gates = { finite: true, exactReplay: true, finalAsleep: row.forward.finalActive === 0,
      noFloorFallThrough: row.forward.minimumY >= floorY + edge / 2 - .05,
      ...(scene === 'wake' ? { wakeShiftBelow5cm: row.forward.maximumShift < .05, wakeRecoveryBy12Seconds: row.forward.lastActiveSeconds < 12 } : {}) };
  } catch (error) {
    row.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    try { if (checkpoint) world.releaseCheckpoint(checkpoint); }
    finally { world.dispose(); }
    row.nativeAfterDispose = JSON.parse(json(memory()));
    row.disposalZero = ['liveWorlds', 'liveSlots', 'retainedBytes'].every(key => String(row.nativeAfterDispose[key]) === '0') && !row.nativeAfterDispose.imbalance;
    row.pass = !row.error && row.disposalZero && Object.values(row.gates ?? {}).every(Boolean);
    if (!row.pass) process.exitCode = 1;
    row.hostEnd = loadavg();
    process.stdout.write(json({ arm, scene, pass: row.pass, apiMsPerSimulatedSecond: row.apiMsPerSimulatedSecond, forward: row.forward, gates: row.gates, error: row.error }) + '\n');
  }
}
try { for (const scene of ['rest', 'wake', 'shove']) runScene(scene); }
finally {
  report.environment.loadEnd = loadavg();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json(report) + '\n', { flag: 'wx' });
}
