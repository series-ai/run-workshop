import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  assert.ok(['--sdk', '--out'].includes(flag), `Unknown option: ${flag}`);
  const value = process.argv[++index];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a path`);
  options[flag.slice(2)] = resolve(value);
}
const { sdk: sdkRoot, out: output } = options;
assert.ok(sdkRoot && output, 'Use --sdk <package directory> --out <new JSON file>.');
await mkdir(dirname(output), { recursive: true });
const sdk = await import(pathToFileURL(join(sdkRoot, 'dist/physics/3d.js')).href);
await sdk.initPhysics3D({ artifact: 'production' });
const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/world.mjs')).href);
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const report = {
  schema: 'syncplay-latest-after-runtime-restore-v1',
  version: JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8')).version,
  sdkRoot,
  fixtureSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  note: 'The public installed runtime adapter owns restore. The core import reads disposal telemetry only.',
};
const world = sdk.createPhysicsWorld3D({ tickRate: 30, capacity: { bodies: 2, joints: 0, checkpoints: 8 } });
let lease;
let saved;
let advanced = [];
try {
  world.edit(ops => ops.createBody({
    key: 'body', kind: 'dynamic', shape: { type: 'box', halfX: .1, halfY: .1, halfZ: .1 },
    position: { x: 0, y: 2, z: 0 }, mass: 1,
  }));
  lease = sdk.createPhysicsInstalledRuntimeAdapter3D({
    identity: {
      abiVersion: 1, tickRate: 30, inputSchemaId: 'cache-input-1', stateSchemaId: 'cache-game-1',
      deterministicVersion: 'cache-repro-1', engineIdentityHash: 'a'.repeat(64),
      stateDigestDomain: 'syncplay.state-report/2',
    },
    sessionConfigBytes: new Uint8Array([1]), decodeCommand: value => value,
    world, worldOwnership: 'borrowed', expectedInitialPhysicsDigest: world.digest(),
    checkpointBudget: { maxLiveCheckpoints: 8, maxAdvanceBatch: 1, importScratch: 1 },
    createInitialGameState: () => Object.freeze({ frame: 0 }),
    stepGameState: ({ world: live, frame }) => {
      live.step();
      return Object.freeze({ frame });
    },
    gameCodec: {
      kind: 'bytes', maxBytes: 8,
      encode: game => {
        const bytes = new Uint8Array(8);
        new DataView(bytes.buffer).setFloat64(0, game.frame, true);
        return bytes;
      },
      decode: (frame, bytes) => {
        assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(0, true), frame);
        return Object.freeze({ frame });
      },
    },
  });
  saved = lease.runtime.capture();
  advanced = lease.runtime.advance([{ frame: 1, inputs: [], commands: [], checksum: false }]);
  const first = world.latest();
  report.before = {
    runtimeFrame: lease.runtime.currentFrame, nativeFrame: Number(world.info().frame), latestFrame: Number(first.frame),
  };
  assert.equal(report.before.latestFrame, 1);
  lease.runtime.restore(saved);
  const after = world.latest();
  report.after = {
    runtimeFrame: lease.runtime.currentFrame, nativeFrame: Number(world.info().frame),
    latestFrame: Number(after.frame), sameLatestObject: first === after,
  };
  report.pass = report.after.runtimeFrame === 0 && report.after.nativeFrame === 0 && report.after.latestFrame === 0;
  if (!report.pass) process.exitCode = 1;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  try {
    if (lease) {
      try {
        if (saved) lease.runtime.release(saved);
        for (const row of advanced) lease.runtime.release(row.checkpoint);
      } finally { await lease.dispose(); }
    }
  } finally { world.dispose(); }
  report.afterDispose = JSON.parse(json(nativePhysicsInstanceMemory()));
  for (const key of ['retainedBytes', 'liveSlots', 'liveWorlds']) assert.equal(Number(report.afterDispose[key]), 0);
  await writeFile(output, `${json(report)}\n`, { flag: 'wx' });
}
console.log(json(report));
