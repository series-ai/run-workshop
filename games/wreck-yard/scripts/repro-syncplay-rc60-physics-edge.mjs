import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  assert.ok(['--sdk', '--out'].includes(flag), `Unknown option: ${flag}`);
  const value = process.argv[++i];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a path`);
  assert.equal(args[flag.slice(2)], undefined, `Repeated option: ${flag}`);
  args[flag.slice(2)] = resolve(value);
}
const gameRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdkRoot = args.sdk ?? join(gameRoot, 'node_modules/@series-inc/rundot-syncplay');
const output = args.out ?? join(gameRoot, 'test-results/rc60-validation', `physics-edge-${Date.now()}-${process.pid}.json`);
await mkdir(dirname(output), { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, (_key, item) => {
  if (typeof item === 'bigint') return item.toString();
  if (typeof item === 'number') assert.ok(Number.isFinite(item), 'Non-finite output');
  return item;
});
const sourceHashes = {};
for (const name of ['package.json', 'core/native/physics/physics.cpp', 'core/native/physics/world.cpp', 'core/src/physics/physics-wasm-module.generated.mjs']) {
  sourceHashes[name] = sha(await readFile(join(sdkRoot, name)));
}
const sdk = await import(pathToFileURL(join(sdkRoot, 'dist/physics/3d.js')).href);
await sdk.initPhysics3D({ artifact: 'production' });
// The core import reads ownership counters only. All simulation calls use the public API.
const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/world.mjs')).href);
const definition = {
  tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
  restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 320, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 2 }, portalProxyCapacity: 1,
};
const report = {
  schema: 'checkpoint-discarded-future-independence-v1', sdkRoot,
  version: JSON.parse(await readFile(join(sdkRoot, 'package.json'))).version,
  fixtureSha256: sha(await readFile(fileURLToPath(import.meta.url))), sourceHashes, definition,
  contract: 'A fixed-topology checkpoint must produce identical motion, contacts, digest and serialized bytes after different discarded futures. The fixture uses 270 bodies and record geometry. It does not assert stack stability or a timing budget.',
  schedule: { checkpointFrame: 12, commonFrames: 60, impulseAtOffset: 1, branchFrames: 6, branches: ['compact-contacting', 'far-separated'] },
  environment: { node: process.version, platform: process.platform, arch: process.arch, load: os.loadavg(), freeBytes: os.freemem() },
  runs: [], pass: false,
};
const world = sdk.createPhysicsWorld3D(definition);
let checkpoint;
let ids = [];
const capacity = definition.capacity.bodies;
const buffers = [new Float64Array(capacity * 7), new Float64Array(capacity * 6), new BigUint64Array(capacity), new Uint8Array(capacity), new Uint32Array(capacity)];
const identity = { x: 0, y: 0, z: 0, w: 1 };
const handles = () => ids.map(id => world.resolveBody(id));
const motion = () => {
  const { count } = world.writeBodyMotionInto(...buffers);
  assert.equal(count, 270);
  for (const [index, stride] of [[0, 7], [1, 6]]) {
    for (const value of buffers[index].subarray(0, count * stride)) assert.ok(Number.isFinite(value));
  }
  return count;
};
const snapshotBytes = () => {
  const scratch = world.captureCheckpoint();
  try { return world.serializeCheckpoint(scratch); }
  finally { world.releaseCheckpoint(scratch); }
};
try {
  const created = world.edit(ops => {
    ops.createBody({ kind: 'static', key: 'floor', position: { x: 0, y: -.5, z: 0 },
      shape: { type: 'compound', children: [{ shape: { type: 'box', halfX: 100, halfY: .5, halfZ: 100 }, offset: { x: 0, y: 0, z: 0 } }] },
      friction: .82, restitution: .08, layer: 1, mask: 0xffffffff });
    const boxes = Array.from({ length: 16 }, (_, i) => ops.createBody({ kind: 'dynamic', key: `box-${i}`,
      shape: { type: 'box', halfX: .48, halfY: .48, halfZ: .48 },
      position: { x: (i % 4) * 1.3, y: .48, z: Math.floor(i / 4) * 1.3 },
      orientation: identity, mass: 1, inertia: { xx: .1536, yy: .1536, zz: .1536 },
      gravityScale: 1, linearDamping: .98, angularDamping: .945, friction: .72, restitution: .12,
      sleeping: true, sleepEnabled: true, sleepThreshold: .05, layer: 1, mask: 0xffffffff }));
    for (let i = 0; i < 253; i += 1) ops.createBody({ kind: 'static', key: `distant-${i}`,
      shape: { type: 'box', halfX: .5, halfY: .5, halfZ: .5 },
      position: { x: 300 + i * 3, y: 0, z: 300 }, layer: 2, mask: 0 });
    return boxes;
  }).created;
  ids = created.map(body => body.id);
  assert.equal(ids.length, 16);
  for (let frame = 1; frame <= 12; frame += 1) world.step();
  motion();
  checkpoint = world.captureCheckpoint();
  const checkpointSha = sha(world.serializeCheckpoint(checkpoint));
  report.checkpoint = { info: JSON.parse(json(world.checkpointInfo(checkpoint))), sha256: checkpointSha };
  const commonFuture = label => {
    const trace = createHash('sha256');
    let maximumContacts = 0;
    const bodies = handles();
    for (let offset = 1; offset <= 60; offset += 1) {
      if (offset === 1) world.applyImpulse(bodies[0], { x: 1.5, y: 0, z: .2 });
      world.step();
      const count = motion();
      for (const [index, stride] of [7, 6, 1, 1, 1].entries()) {
        trace.update(Buffer.from(buffers[index].buffer, 0, count * stride * buffers[index].BYTES_PER_ELEMENT));
      }
      const latest = world.latest();
      assert.equal(Number(latest.frame), 12 + offset);
      maximumContacts = Math.max(maximumContacts, latest.contacts.length);
      trace.update(json(latest));
      trace.update(world.digest().toString());
      trace.update(snapshotBytes());
    }
    assert.ok(maximumContacts > 0, 'The common future must exercise contacts');
    const result = { label, traceSha256: trace.digest('hex'), finalDigest: world.digest().toString(), maximumContacts };
    report.runs.push(result);
    assert.equal(sha(world.serializeCheckpoint(checkpoint)), checkpointSha, 'Retained checkpoint changed');
    return result;
  };
  const reference = commonFuture('reference');
  for (const branch of ['compact-contacting', 'far-separated']) {
    world.restoreCheckpoint(checkpoint);
    for (const [i, body] of handles().entries()) {
      const compact = branch === 'compact-contacting';
      world.setBodyTransform(body, { position: compact
        ? { x: (i % 4) * .94, y: .48, z: Math.floor(i / 4) * .94 }
        : { x: 40 + (i % 4) * 3, y: .48, z: 40 + Math.floor(i / 4) * 3 }, orientation: identity });
      world.setBodyLinearVelocity(body, { x: 0, y: 0, z: 0 });
      world.setBodyAngularVelocity(body, { x: 0, y: 0, z: 0 });
      world.wakeBody(body);
    }
    for (let frame = 0; frame < 6; frame += 1) { world.step(); motion(); }
    assert.equal(sha(world.serializeCheckpoint(checkpoint)), checkpointSha, 'Discarded future changed checkpoint');
    world.restoreCheckpoint(checkpoint);
    assert.equal(Number(world.latest().frame), 12);
    const replay = commonFuture(branch);
    assert.equal(replay.traceSha256, reference.traceSha256, `${branch}: future depends on discarded history`);
    assert.equal(replay.finalDigest, reference.finalDigest);
  }
  report.pass = true;
} catch (error) {
  report.error = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  try {
    try { if (checkpoint) world.releaseCheckpoint(checkpoint); }
    finally { world.dispose(); }
    report.afterDispose = JSON.parse(json(nativePhysicsInstanceMemory()));
    for (const key of ['liveWorlds', 'liveSlots', 'retainedBytes']) assert.equal(String(report.afterDispose[key]), '0', key);
  } catch (error) {
    report.cleanupError = { name: error.name, message: error.message };
    report.pass = false;
    process.exitCode = 1;
  }
  report.endLoad = os.loadavg();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
}
console.log(json({ version: report.version, pass: report.pass, runs: report.runs, error: report.error, output }));
