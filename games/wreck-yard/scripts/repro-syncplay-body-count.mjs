import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--require-stable') { options.strict = true; continue; }
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
const memory = () => JSON.parse(json(nativePhysicsInstanceMemory()));
const edge = .96, floorY = -.86, inertia = edge * edge / 6;
const definition = { tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
  restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 32, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 2 }, portalProxyCapacity: 1 };
const floor = { kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
  position: { x: 0, y: floorY - .5, z: 0 }, friction: .82, restitution: .08, rollingResistance: 0, layer: 1, mask: 0xffffffff };
const report = { schema: 'small-stack-global-body-count-boundary-v1', sdkRoot,
  version: JSON.parse(await readFile(join(sdkRoot, 'package.json'))).version, definition,
  fixture: 'Ten touching boxes and floor. Add five or six distant noncolliding static boxes. Wake the ten boxes once at frame121. Preserve .05m shift and sleep-by480 gates. Replay from frame120.', cases: [] };
for (const totalBodies of [16, 17]) {
  const row = { totalBodies, distantStaticBodies: totalBodies - 11, maximumShift: 0, samples: [] }; report.cases.push(row);
  const world = sdk.createPhysicsWorld3D(definition); let checkpoint;
  let boxes = [];
  const arrays = [new Float64Array(32 * 7), new Float64Array(32 * 6), new BigUint64Array(32), new Uint8Array(32), new Uint32Array(32)];
  try {
    boxes = world.edit(ops => {
      ops.createBody(floor);
      const column = Array.from({ length: 10 }, (_, i) => ops.createBody({ kind: 'dynamic', key: `box-${i}`,
        shape: { type: 'box', halfX: .48, halfY: .48, halfZ: .48 }, position: { x: 0, y: floorY + edge / 2 + i * edge, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 },
        mass: 1, inertia: { xx: inertia, yy: inertia, zz: inertia }, gravityScale: 1, linearDamping: .98, angularDamping: .945,
        friction: .72, restitution: .12, rollingResistance: 0, sleeping: true, sleepEnabled: true, sleepThreshold: .05, layer: 1, mask: 0xffffffff }));
      for (let i = 0; i < totalBodies - 11; i++) ops.createBody({ ...floor, key: `distant-${i}`,
        shape: { type: 'box', halfX: .5, halfY: .5, halfZ: .5 }, position: { x: 100 + i * 3, y: 0, z: 100 }, layer: 2, mask: 0 });
      return column;
    }).created;
    const advance = (from, through, record) => {
      const trace = createHash('sha256'); let final;
      for (let frame = from; frame <= through; frame++) {
        if (frame === 121) for (const box of boxes) world.wakeBody(box);
        world.step();
        const { count } = world.writeBodyMotionInto(...arrays);
        assert.equal(count, totalBodies); assert.equal(Number(world.latest().frame), frame);
        for (const [i, size] of [7, 6, 1, 1, 1].entries()) trace.update(Buffer.from(arrays[i].buffer, 0, count * size * arrays[i].BYTES_PER_ELEMENT));
        let active = 0, maxShift = 0;
        for (const [i, box] of boxes.entries()) {
          const slot = arrays[2].subarray(0, count).findIndex(id => id === box.id); assert.ok(slot >= 0);
          const pose = arrays[0].subarray(slot * 7, slot * 7 + 7), velocity = arrays[1].subarray(slot * 6, slot * 6 + 6);
          for (const value of [...pose, ...velocity]) assert.ok(Number.isFinite(value));
          if (!(arrays[3][slot] & 0x10)) active++;
          maxShift = Math.max(maxShift, Math.hypot(pose[0], pose[1] - (floorY + edge / 2 + i * edge), pose[2]));
        }
        final = { frame, active, maxShift, digest: world.digest().toString() };
        trace.update(json(final));
        if (record) {
          row.maximumShift = Math.max(row.maximumShift, maxShift);
          if ([120, 121, 240, 360, 480].includes(frame)) row.samples.push(final);
        }
      }
      return { trace: trace.digest('hex'), final };
    };
    advance(1, 120, true); checkpoint = world.captureCheckpoint();
    row.forward = advance(121, 480, true);
    world.restoreCheckpoint(checkpoint); boxes = boxes.map(box => world.resolveBody(box.id));
    row.replay = advance(121, 480, false);
    assert.deepEqual(row.forward, row.replay); row.replayExact = true;
    row.stabilityPass = row.maximumShift < .05 && row.forward.final.active === 0;
  } catch (error) { row.error = { name: error.name, message: error.message }; process.exitCode = 1; }
  finally {
    try { if (checkpoint) world.releaseCheckpoint(checkpoint); } finally { world.dispose(); }
    row.afterDispose = memory();
    assert.equal(String(row.afterDispose.liveWorlds), '0'); assert.equal(String(row.afterDispose.liveSlots), '0'); assert.equal(String(row.afterDispose.retainedBytes), '0');
  }
}
report.fixtureSha256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
report.requireStable = Boolean(options.strict);
report.pass = report.cases.every(row => !row.error && row.replayExact && row.stabilityPass);
if (options.strict && !report.pass) process.exitCode = 1;
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(json({ version: report.version, cases: report.cases.map(c => ({ totalBodies: c.totalBodies, maximumShift: c.maximumShift, final: c.forward?.final, replayExact: c.replayExact, stabilityPass: c.stabilityPass, error: c.error })) }));
