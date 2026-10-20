import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--require-success') { options.strict = true; continue; }
  assert.ok(['--sdk', '--out'].includes(flag), `Unknown option: ${flag}`);
  const value = process.argv[++i];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a path`);
  options[flag.slice(2)] = resolve(value);
}
const { sdk: sdkRoot, out: output } = options;
assert.ok(sdkRoot && output, 'Use --sdk <package directory> --out <new JSON file>.');
await mkdir(dirname(output), { recursive: true });
const sdk = await import(pathToFileURL(join(sdkRoot, 'dist/physics/3d.js')).href);
await sdk.initPhysics3D({ artifact: 'production' });
const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/world.mjs')).href);
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const sha = value => createHash('sha256').update(value).digest('hex');
const memory = () => JSON.parse(json(nativePhysicsInstanceMemory()));
const report = { schema: 'topology-edit-checkpoint-dependency-v1', sdkRoot, version: JSON.parse(await readFile(join(sdkRoot, 'package.json'))).version, date: new Date().toISOString(), cases: [] };
const definition = { tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
  restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 512, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 2 }, portalProxyCapacity: 1 };
const edge = .96, inertia = edge * edge / 6, floorY = -.86;
const body = i => ({ kind: 'dynamic', key: `box-${i}`, shape: { type: 'box', halfX: .48, halfY: .48, halfZ: .48 },
  position: { x: -13.1 + (i % 8 - 3.5) * edge, y: floorY + edge / 2 + Math.floor(i / 40) * edge, z: -20.7 + (Math.floor(i / 8) % 5 - 2) * edge },
  orientation: { x: 0, y: 0, z: 0, w: 1 }, mass: 1, inertia: { xx: inertia, yy: inertia, zz: inertia },
  linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, gravityScale: 1,
  linearDamping: .98, angularDamping: .945, friction: .72, restitution: .12, rollingResistance: 0,
  sleeping: true, sleepEnabled: true, sleepThreshold: .05, layer: 1, mask: 0xffffffff });
for (const retainedCheckpoint of [true, false]) {
  const row = { retainedCheckpoint }; report.cases.push(row);
  const world = sdk.createPhysicsWorld3D(definition);
  let checkpoint;
  const buffers = [new Float64Array(512 * 7), new Float64Array(512 * 6), new BigUint64Array(512), new Uint8Array(512), new Uint32Array(512)];
  const capture = () => {
    const { count } = world.writeBodyMotionInto(...buffers);
    const hash = createHash('sha256');
    for (const [i, size] of [7, 6, 1, 1, 1].entries()) hash.update(Buffer.from(buffers[i].buffer, 0, count * size * buffers[i].BYTES_PER_ELEMENT));
    return { count, frame: Number(world.latest().frame), digest: world.digest().toString(), motionSha256: hash.digest('hex'), native: memory(), topShape: world.resolveKey('box-399').shape };
  };
  const edit = () => {
    const old = world.resolveKey('box-399');
    try {
      world.edit(ops => ops.replaceBody(world.resolveBody(old.id), { ...body(399),
        shape: { type: 'box', halfX: .47, halfY: .48, halfZ: .48 },
        position: old.position, orientation: old.orientation, linearVelocity: old.linearVelocity, angularVelocity: old.angularVelocity, sleeping: false }));
      return { result: 'success' };
    } catch (error) { return { result: 'error', name: error.name, message: error.message }; }
  };
  try {
    const boxes = world.edit(ops => {
      ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
        position: { x: 0, y: floorY - .5, z: 0 }, friction: .82, restitution: .08, rollingResistance: 0, layer: 1, mask: 0xffffffff });
      return Array.from({ length: 400 }, (_, i) => ops.createBody(body(i)));
    }).created;
    for (let frame = 1; frame <= 240; frame++) {
      if (frame === 121) for (const box of boxes) world.wakeBody(box);
      world.step();
      if (frame === 120 && retainedCheckpoint) checkpoint = world.captureCheckpoint();
    }
    row.before = capture(); row.edit = edit(); row.after = capture();
    if (row.edit.result === 'error') row.failureAtomic = row.before.digest === row.after.digest && row.before.motionSha256 === row.after.motionSha256 && row.before.frame === row.after.frame && row.before.count === row.after.count;
    if (checkpoint && row.edit.result === 'error') {
      world.releaseCheckpoint(checkpoint); checkpoint = undefined;
      row.beforeRetry = capture(); row.retryAfterRelease = edit(); row.afterRetry = capture();
    }
  } catch (error) { row.error = { name: error.name, message: error.message }; process.exitCode = 1; }
  finally {
    try { if (checkpoint) world.releaseCheckpoint(checkpoint); } finally { world.dispose(); }
    row.afterDispose = memory();
    assert.equal(String(row.afterDispose.liveWorlds), '0'); assert.equal(String(row.afterDispose.liveSlots), '0'); assert.equal(String(row.afterDispose.retainedBytes), '0');
  }
}
report.fixtureSha256 = sha(await readFile(new URL(import.meta.url)));
report.requireSuccess = Boolean(options.strict);
report.pass = report.cases.every(row => !row.error && row.edit?.result === 'success');
if (options.strict && !report.pass) process.exitCode = 1;
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(json(report));
