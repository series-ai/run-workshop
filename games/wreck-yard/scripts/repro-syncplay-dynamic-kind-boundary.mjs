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
const output = args.out ?? join(gameRoot, 'test-results/rc60-validation', `dynamic-kind-${Date.now()}-${process.pid}.json`);
await mkdir(dirname(output), { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const sdk = await import(pathToFileURL(join(sdkRoot, 'dist/physics/3d.js')).href);
await sdk.initPhysics3D({ artifact: 'production' });
// The core import reads ownership counters only.
const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/world.mjs')).href);
const sourceHashes = {};
for (const name of ['core/native/physics/physics.cpp', 'core/src/physics/physics-wasm-module.generated.mjs']) {
  sourceHashes[name] = sha(await readFile(join(sdkRoot, name)));
}
const definition = { tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
  restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 512, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 2 }, portalProxyCapacity: 1 };
const floorY = -.86, edge = .96, identity = { x: 0, y: 0, z: 0, w: 1 };
const report = {
  schema: 'noncolliding-body-kind-boundary-v1', sdkRoot,
  version: JSON.parse(await readFile(join(sdkRoot, 'package.json'))).version,
  fixtureSha256: sha(await readFile(fileURLToPath(import.meta.url))), sourceHashes, definition,
  contract: 'Changing one distant body from static to sleeping dynamic must not alter the colliding column. All 259 distant bodies have mask 0 and must retain their initial poses and zero velocity. Total count, capacity, IDs and order stay fixed.',
  schedule: { totalBodies: 270, columnBodies: 10, distantBodies: 259, checkpoint: 120, wakeColumn: 121, through: 480, maximumColumnShift: .05 },
  environment: { node: process.version, date: new Date().toISOString(), load: os.loadavg(), freeBytes: os.freemem() },
  cases: [], pass: false,
};
const forwardRows = [];
for (const farDynamicCount of [6, 7]) {
  const row = { farDynamicCount, farStaticCount: 259 - farDynamicCount, totalDynamicCount: 10 + farDynamicCount,
    maximumShift: 0, samples: [], frameMotionHashes: [] };
  report.cases.push(row);
  const world = sdk.createPhysicsWorld3D(definition);
  let checkpoint;
  let boxIds = [], farIds = [];
  const buffers = [new Float64Array(512 * 7), new Float64Array(512 * 6), new BigUint64Array(512), new Uint8Array(512), new Uint32Array(512)];
  const farPositions = Array.from({ length: 259 }, (_, i) => [100 + i * 3, 0, 100]);
  const commonBody = { orientation: identity, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 },
    mass: 1, inertia: { xx: edge * edge / 6, yy: edge * edge / 6, zz: edge * edge / 6 },
    linearDamping: .98, angularDamping: .945, friction: .72, restitution: .12, rollingResistance: 0,
    sleeping: true, sleepEnabled: true, sleepThreshold: .05 };
  const columnRows = [];
  try {
    const created = world.edit(ops => {
      ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
        position: { x: 0, y: floorY - .5, z: 0 }, friction: .82, restitution: .08, rollingResistance: 0, layer: 1, mask: 0xffffffff });
      const boxes = Array.from({ length: 10 }, (_, i) => ops.createBody({ ...commonBody, kind: 'dynamic', key: `box-${i}`,
        shape: { type: 'box', halfX: .48, halfY: .48, halfZ: .48 },
        position: { x: 0, y: floorY + edge / 2 + i * edge, z: 0 }, gravityScale: 1, layer: 1, mask: 0xffffffff }));
      const far = farPositions.map(([x, y, z], i) => ops.createBody({ ...commonBody,
        kind: i < farDynamicCount ? 'dynamic' : 'static', key: `far-${i}`,
        shape: { type: 'box', halfX: .5, halfY: .5, halfZ: .5 },
        position: { x, y, z }, gravityScale: 0, layer: 2, mask: 0 }));
      return { boxes, far };
    }).created;
    boxIds = created.boxes.map(body => body.id);
    farIds = created.far.map(body => body.id);
    row.bodyIds = { column: boxIds.map(String), distant: farIds.map(String) };
    const advance = (from, through, record) => {
      const trace = createHash('sha256');
      let final;
      for (let frame = from; frame <= through; frame += 1) {
        if (frame === 121) for (const id of boxIds) world.wakeBody(world.resolveBody(id));
        world.step();
        const { count } = world.writeBodyMotionInto(...buffers);
        assert.equal(count, 270);
        assert.equal(Number(world.latest().frame), frame);
        const slots = new Map(Array.from(buffers[2].subarray(0, count), (id, index) => [id, index]));
        for (const [i, id] of farIds.entries()) {
          const slot = slots.get(id); assert.notEqual(slot, undefined);
          assert.deepEqual(Array.from(buffers[0].subarray(slot * 7, slot * 7 + 7)), [...farPositions[i], 0, 0, 0, 1], `far-${i} pose at ${frame}`);
          for (const value of buffers[1].subarray(slot * 6, slot * 6 + 6)) assert.equal(value, 0, `far-${i} velocity at ${frame}`);
        }
        let active = 0, maxShift = 0;
        const column = boxIds.map((id, i) => {
          const slot = slots.get(id); assert.notEqual(slot, undefined);
          const pose = Array.from(buffers[0].subarray(slot * 7, slot * 7 + 7));
          const velocity = Array.from(buffers[1].subarray(slot * 6, slot * 6 + 6));
          for (const value of [...pose, ...velocity]) assert.ok(Number.isFinite(value));
          if (!(buffers[3][slot] & 0x10)) active += 1;
          maxShift = Math.max(maxShift, Math.hypot(pose[0], pose[1] - (floorY + edge / 2 + i * edge), pose[2]));
          return [...pose, ...velocity, buffers[3][slot], buffers[4][slot]];
        });
        trace.update(json(column));
        trace.update(world.digest().toString());
        final = { frame, active, maxShift, digest: world.digest().toString() };
        if (record) {
          row.maximumShift = Math.max(row.maximumShift, maxShift);
          if ([120, 121, 240, 360, 480].includes(frame)) row.samples.push(final);
          if (frame >= 121) {
            columnRows.push(column);
            row.frameMotionHashes.push(sha(json(column)));
          }
        }
      }
      return { traceSha256: trace.digest('hex'), final };
    };
    advance(1, 120, true);
    checkpoint = world.captureCheckpoint();
    row.forward = advance(121, 480, true);
    world.restoreCheckpoint(checkpoint);
    row.replay = advance(121, 480, false);
    assert.deepEqual(row.forward, row.replay);
    row.replayExact = true;
    row.farBodiesUnchanged = true;
    row.stabilityPass = row.maximumShift < .05 && row.forward.final.active === 0;
  } catch (error) {
    row.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    try {
      try { if (checkpoint) world.releaseCheckpoint(checkpoint); }
      finally { world.dispose(); }
      row.afterDispose = JSON.parse(json(nativePhysicsInstanceMemory()));
      for (const key of ['liveWorlds', 'liveSlots', 'retainedBytes']) assert.equal(String(row.afterDispose[key]), '0', key);
    } catch (error) { row.cleanupError = { name: error.name, message: error.message }; process.exitCode = 1; }
  }
  forwardRows.push(columnRows);
}
if (report.cases.every(row => !row.error && !row.cleanupError)) {
  assert.deepEqual(report.cases[0].bodyIds, report.cases[1].bodyIds);
  const firstDifference = report.cases[0].frameMotionHashes.findIndex((hash, index) => hash !== report.cases[1].frameMotionHashes[index]);
  report.comparison = { collidingMotionEqual: firstDifference === -1,
    firstDivergenceFrame: firstDifference === -1 ? null : 121 + firstDifference,
    ...(firstDifference === -1 ? {} : { firstDivergenceMotion: { dynamic16: forwardRows[0][firstDifference], dynamic17: forwardRows[1][firstDifference] } }) };
}
report.pass = report.cases.every(row => row.replayExact && row.farBodiesUnchanged && row.stabilityPass && !row.cleanupError)
  && report.comparison?.collidingMotionEqual === true;
if (!report.pass) process.exitCode = 1;
report.endLoad = os.loadavg();
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(json({ version: report.version, pass: report.pass,
  cases: report.cases.map(({ totalDynamicCount, maximumShift, stabilityPass, replayExact, farBodiesUnchanged, forward, error, cleanupError }) => ({ totalDynamicCount, maximumShift, stabilityPass, replayExact, farBodiesUnchanged, final: forward?.final, error, cleanupError })),
  comparison: report.comparison && { collidingMotionEqual: report.comparison.collidingMotionEqual, firstDivergenceFrame: report.comparison.firstDivergenceFrame }, output }));
