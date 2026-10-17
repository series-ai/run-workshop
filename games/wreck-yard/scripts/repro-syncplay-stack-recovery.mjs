import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, isAbsolute, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const gameRoot = fileURLToPath(new URL('../', import.meta.url));
const captureName = `native-small-stacks-${Date.now()}-${process.pid}.json`;
const options = { sdk: join(gameRoot, 'node_modules/@series-inc/rundot-syncplay'),
  entry: 'dist/physics/3d.js', out: join(gameRoot, 'test-results/mobile-repair', captureName), stable: false };
for (let index = 2; index < process.argv.length; index++) {
  const name = process.argv[index];
  if (name === '--require-stable') options.stable = true;
  else if (['--sdk', '--entry', '--out'].includes(name)) {
    const value = process.argv[++index];
    assert.ok(value && !value.startsWith('--'), `${name} requires a value`);
    options[name.slice(2)] = value;
  } else throw new Error(`Unknown argument: ${name}`);
}
assert.ok(!isAbsolute(options.entry) && !options.entry.split('/').includes('..'), '--entry must be relative to --sdk');
const sdkRoot = resolve(options.sdk), entry = options.entry, output = resolve(options.out);
await mkdir(dirname(output), { recursive: true });
const sdk = await import(pathToFileURL(join(sdkRoot, entry)).href);
await sdk.initPhysics3D({ artifact: 'production' });
const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/world.mjs')).href);
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const sha = value => createHash('sha256').update(value).digest('hex');
const { physicsWasmMetadata, physicsWasmModuleBase64 } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/physics-wasm-module.generated.mjs')).href);
const wasmSha256 = sha(Buffer.from(physicsWasmModuleBase64, 'base64'));
assert.equal(wasmSha256, physicsWasmMetadata.wasmSha256, 'WASM bytes must match the build metadata');
const memory = () => JSON.parse(JSON.stringify(nativePhysicsInstanceMemory(), (_key, value) => typeof value === 'bigint' ? Number(value) : value));
const definition = { tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
  restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 16, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 2 }, portalProxyCapacity: 1 };
const edge = .96, floorY = -.86, inertia = edge * edge / 6;
const position = index => ({ x: 0, y: floorY + edge / 2 + index * edge, z: 0 });
const body = (index, sleeping) => ({ kind: 'dynamic', key: `box-${index}`,
  shape: { type: 'box', halfX: edge / 2, halfY: edge / 2, halfZ: edge / 2 }, position: position(index),
  orientation: { x: 0, y: 0, z: 0, w: 1 }, mass: 1, inertia: { xx: inertia, yy: inertia, zz: inertia },
  linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, gravityScale: 1,
  linearDamping: .98, angularDamping: .945, friction: .72, restitution: .12, rollingResistance: 0,
  sleeping, sleepEnabled: true, sleepThreshold: .05, layer: 1, mask: 0xffffffff });
const stabilityLimits = { twoBoxMaxShiftMeters: .01, tenBoxMaxShiftMeters: .05, tenBoxSleepingByFrame: 480 };
const report = { note: 'Public API correctness fixture. No timings, app code, shove, histories, or solver setting changes. Created-asleep scenes wake once at frame121. Replay restores the frame120 native checkpoint. A source entry needs a TypeScript loader. Private memory reads are diagnostic only. Contact output row counts are not active solver constraint counts.',
  requireStable: options.stable, stabilityLimits,
  sdkRoot, entry, version: JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8')).version,
  wasmSha256, buildSourceHash: physicsWasmMetadata.sourceHash,
  compilerVersion: physicsWasmMetadata.compilerVersion, compilerFlags: physicsWasmMetadata.compilerFlags,
  artifactSha256: sha(await readFile(join(sdkRoot, 'core/src/physics/physics-wasm-module.generated.mjs'))),
  nativeSourceSha256: sha(await readFile(join(sdkRoot, 'core/native/physics/physics.cpp'))),
  fixtureSha256: sha(await readFile(new URL(import.meta.url))), definition, cases: [] };
for (const count of [2, 10]) for (const start of ['created-awake', 'wake-once']) {
  const row = { count, start, samples: [], maximumShift: 0 }; report.cases.push(row);
  const world = sdk.createPhysicsWorld3D(definition);
  let checkpoint;
  try {
    const { created: boxes } = world.edit(ops => {
      ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
        position: { x: 0, y: floorY - .5, z: 0 }, friction: .82, restitution: .08, rollingResistance: 0, layer: 1, mask: 0xffffffff });
      return Array.from({ length: count }, (_, index) => ops.createBody(body(index, start === 'wake-once')));
    });
    const buffers = { poses: new Float64Array(16 * 7), velocities: new Float64Array(16 * 6), ids: new BigUint64Array(16), status: new Uint8Array(16) };
    const snapshot = expectedFrame => {
      const batch = world.writeBodyMotionInto(buffers.poses, buffers.velocities, buffers.ids, buffers.status);
      assert.equal(batch.count, count + 1);
      const motions = boxes.map((handle, index) => {
        const slot = buffers.ids.subarray(0, batch.count).findIndex(id => id === handle.id);
        assert.ok(slot >= 0);
        const pose = [...buffers.poses.subarray(slot * 7, slot * 7 + 7)];
        const velocity = [...buffers.velocities.subarray(slot * 6, slot * 6 + 6)];
        for (const number of [...pose, ...velocity]) assert.ok(Number.isFinite(number));
        const original = position(index);
        return { index, pose, velocity, sleeping: Boolean(buffers.status[slot] & 0x10),
          shift: Math.hypot(pose[0] - original.x, pose[1] - original.y, pose[2] - original.z) };
      });
      const latest = world.latest();
      assert.equal(Number(latest.frame), expectedFrame, 'public output frame must match the stepped frame');
      return { frame: Number(latest.frame), active: motions.filter(item => !item.sleeping).length,
        contacts: latest.contacts.length, maxSpeed: Math.max(...motions.map(item => Math.hypot(...item.velocity.slice(0, 3)))),
        maxShift: Math.max(...motions.map(item => item.shift)), motions, digest: world.digest().toString() };
    };
    const advance = (from, to, sample) => {
      const trace = createHash('sha256');
      for (let frame = from; frame <= to; frame++) {
        if (frame === 121 && start === 'wake-once') for (const handle of boxes) world.wakeBody(handle);
        world.step();
        const state = snapshot(frame);
        trace.update(json(state));
        if (sample) row.maximumShift = Math.max(row.maximumShift, state.maxShift);
        if (sample && [1, 30, 120, 121, 122, 150, 180, 240, 360, 480].includes(frame)) row.samples.push(state);
      }
      return trace.digest('hex');
    };
    advance(1, 120, true);
    checkpoint = world.captureCheckpoint();
    row.forwardTraceSha256 = advance(121, 480, true);
    const final = snapshot(480);
    world.restoreCheckpoint(checkpoint);
    for (let index = 0; index < boxes.length; index++) boxes[index] = world.resolveBody(boxes[index].id);
    row.replayTraceSha256 = advance(121, 480, false);
    const replay = snapshot(480);
    assert.deepEqual(replay, final);
    assert.equal(row.replayTraceSha256, row.forwardTraceSha256, 'all replay frames must match');
    row.replayExact = true;
    row.finalMotionSha256 = sha(json(final.motions));
    const maximumShift = row.maximumShift;
    const limit = count === 2 ? stabilityLimits.twoBoxMaxShiftMeters : stabilityLimits.tenBoxMaxShiftMeters;
    row.stability = { maximumShift, limit, finalActive: final.active,
      pass: maximumShift < limit && (count === 2 || final.active === 0) };
    if (options.stable) assert.ok(row.stability.pass, `${count}-box ${start} failed the fixed stability limits: ${json(row.stability)}`);
  } catch (error) {
    row.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    try { if (checkpoint) world.releaseCheckpoint(checkpoint); } finally { world.dispose(); }
    row.afterDispose = memory();
    assert.equal(row.afterDispose.retainedBytes, 0); assert.equal(row.afterDispose.liveWorlds, 0); assert.equal(row.afterDispose.liveSlots, 0);
  }
  console.log(json({ count, start, final: row.samples.at(-1) && { ...row.samples.at(-1), motions: undefined }, replayExact: row.replayExact, stability: row.stability, error: row.error }));
}
await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
