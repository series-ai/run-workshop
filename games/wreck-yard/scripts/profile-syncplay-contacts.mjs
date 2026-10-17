// Run each SDK in a separate process. Do not run timing probes in parallel.
// Example: SYNCPLAY_CONTACTS_OUTPUT=test-results/monkey-perf/contacts-rc48-a.json node scripts/profile-syncplay-contacts.mjs --sdk /private/tmp/rc48/package
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { cpus, loadavg, totalmem } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function parseOptions(args) {
  let sdkRoot = fileURLToPath(new URL('../node_modules/@series-inc/rundot-syncplay/', import.meta.url));
  let output = process.env.SYNCPLAY_CONTACTS_OUTPUT;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag !== '--sdk' && flag !== '--output') throw new Error(`Unknown option: ${flag}. Use --sdk or --output.`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
    if (flag === '--sdk') {
      if (!isAbsolute(value)) throw new Error('--sdk must name an absolute package directory.');
      sdkRoot = value;
    } else output = value;
  }
  if (output !== undefined && output.trim() === '') throw new Error('The output path must not be empty.');
  return { sdkRoot: resolve(sdkRoot), output: output === undefined ? undefined : resolve(output) };
}

async function artifactMetadata(sdkRoot) {
  const file = await open(join(sdkRoot, 'core/src/physics/physics-wasm-module.generated.mjs'), 'r');
  try {
    const header = Buffer.alloc(16_384);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const text = header.subarray(0, bytesRead).toString('utf8');
    const stringField = (key) => {
      const match = text.match(new RegExp(`"${key}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
      if (!match) throw new Error(`Artifact metadata field is missing: ${key}.`);
      return JSON.parse(match[1]);
    };
    const numberField = (key) => {
      const match = text.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
      if (!match) throw new Error(`Artifact metadata field is missing: ${key}.`);
      return Number(match[1]);
    };
    // The exported-function flag can be large. Read the fixed fields before it.
    const metadata = Object.fromEntries(['sourceHash', 'wasmSha256', 'artifact', 'packageVersion', 'compilerVersion'].map((key) => [key, stringField(key)]));
    for (const key of ['sourceHash', 'wasmSha256']) assert.match(metadata[key], /^[a-f0-9]{64}$/);
    assert.equal(metadata.artifact, 'production');
    return { artifact: metadata.artifact, sourceHash: metadata.sourceHash, wasmSha256: metadata.wasmSha256,
      packageVersion: metadata.packageVersion, abiVersion: numberField('abiVersion'), worldAbiVersion: numberField('worldAbiVersion'),
      compilerVersion: metadata.compilerVersion, optimization: text.includes('"-O3"') ? 'O3' : 'not found in header' };
  } finally {
    await file.close();
  }
}

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
  return { count: values.length, min: sorted[0] ?? 0, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0,
    mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) };
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry);
const memoryRecord = (readMemory) => JSON.parse(json(readMemory()));
const FRAME_COUNT = 360;
const SETTLE_FRAMES = 120;
const CHECK_FRAMES = new Set([30, 120, 121, 180, 240, 360]);
const BOX_EDGE = 0.96;
const BOX_MASS = 1;
const BOX_INERTIA = BOX_MASS * BOX_EDGE * BOX_EDGE / 6;
const FLOOR_Y = -0.86;
const definition = {
  tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
  restitutionThreshold: 0.5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
  capacity: { bodies: 512, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 1 },
  portalProxyCapacity: 1,
};

function makeWorld(sdk) {
  const world = sdk.createPhysicsWorld3D(definition);
  try {
    const { created } = world.edit((ops) => {
      const floor = ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: 0.5, halfZ: 32 },
        position: { x: 0, y: FLOOR_Y - 0.5, z: 0 }, friction: 0.82, restitution: 0.08, rollingResistance: 0, layer: 1, mask: 0xffffffff });
      const boxes = [];
      for (let tier = 0; tier < 10; tier++) for (let row = 0; row < 5; row++) for (let column = 0; column < 8; column++) {
        const index = (tier * 5 + row) * 8 + column;
        boxes.push(ops.createBody({ kind: 'dynamic', key: `box-${index}`,
          shape: { type: 'box', halfX: BOX_EDGE / 2, halfY: BOX_EDGE / 2, halfZ: BOX_EDGE / 2 },
          position: { x: -13.1 + (column - 3.5) * BOX_EDGE, y: FLOOR_Y + BOX_EDGE / 2 + tier * BOX_EDGE, z: -20.7 + (row - 2) * BOX_EDGE },
          orientation: { x: 0, y: 0, z: 0, w: 1 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 },
          mass: BOX_MASS, inertia: { xx: BOX_INERTIA, yy: BOX_INERTIA, zz: BOX_INERTIA },
          gravityScale: 1, linearDamping: 0.98, angularDamping: 0.945,
          friction: 0.72, restitution: 0.12, rollingResistance: 0,
          sleeping: true, sleepEnabled: true, sleepThreshold: 0.05, layer: 1, mask: 0xffffffff }));
      }
      return { floor, boxes };
    });
    assert.equal(created.boxes.length, 400);
    return { world, boxes: created.boxes };
  } catch (error) {
    world.dispose();
    throw error;
  }
}

function sharedContacts(contacts) {
  return contacts.map((contact) => [contact.type, contact.bodyA.toString(), contact.bodyB.toString(),
    contact.bodyKeyA ?? null, contact.bodyKeyB ?? null, contact.trigger, contact.sensor,
    contact.normalImpulse, contact.tangentImpulse1, contact.tangentImpulse2,
    contact.point.x, contact.point.y, contact.point.z, contact.normal.x, contact.normal.y, contact.normal.z,
    contact.penetration, contact.closingSpeed]);
}

function captureComparison(world, latest, buffers) {
  const { count } = world.writeBodyMotionInto(buffers.poses, buffers.velocities, buffers.ids, buffers.status, buffers.teleports);
  assert.equal(count, 401);
  const hash = createHash('sha256');
  for (const [array, length] of [[buffers.poses, count * 7], [buffers.velocities, count * 6], [buffers.ids, count], [buffers.status, count], [buffers.teleports, count]]) {
    if (array instanceof Float64Array) {
      for (const value of array.subarray(0, length)) assert.ok(Number.isFinite(value), 'Body motion must stay finite.');
    }
    hash.update(Buffer.from(array.buffer, array.byteOffset, length * array.BYTES_PER_ELEMENT));
  }
  const contacts = sharedContacts(latest.contacts);
  for (const fields of contacts) for (const value of fields) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), 'Contact values must stay finite.');
  }
  let activeBodies = 0, sleepingBodies = 0;
  for (let index = 0; index < count; index++) {
    if ((buffers.status[index] & 3) !== 1) continue;
    if (buffers.status[index] & 0x10) sleepingBodies++; else activeBodies++;
  }
  return { frame: Number(latest.frame), bodyCount: count, activeBodies, sleepingBodies,
    contacts: latest.contacts.length,
    activeSolidContacts: latest.contacts.filter((contact) => contact.type !== 'exit' && !contact.trigger && !contact.sensor).length,
    motionSha256: hash.digest('hex'), commonContactSha256: sha256(json(contacts)) };
}

function runScene(sdk, readMemory, scene, scenes) {
  global.gc?.();
  const { world, boxes } = makeWorld(sdk);
  const row = { scene, loadStart: loadavg(), comparisons: [] };
  scenes.push(row);
  const stepTimes = [], latestTimes = [], pairedTimes = [], contactCounts = [], activeContactCounts = [];
  const buffers = { poses: new Float64Array(512 * 7), velocities: new Float64Array(512 * 6), ids: new BigUint64Array(512),
    status: new Uint8Array(512), teleports: new Uint32Array(512) };
  let measuredWallStart;
  try {
    for (let frame = 1; frame <= FRAME_COUNT; frame++) {
      if (frame === SETTLE_FRAMES + 1) {
        if (scene === 'shove') {
          for (const box of boxes) world.wakeBody(box);
          for (const box of boxes.slice(0, 40)) world.setLinearVelocity(box, { x: 0, y: 0, z: 6 });
        }
        measuredWallStart = performance.now();
      }
      const stepStart = performance.now();
      world.step();
      const latestStart = performance.now();
      const latest = world.latest();
      const end = performance.now();
      assert.equal(Number(latest.frame), frame);
      if (frame > SETTLE_FRAMES) {
        stepTimes.push(latestStart - stepStart);
        latestTimes.push(end - latestStart);
        pairedTimes.push(end - stepStart);
        contactCounts.push(latest.contacts.length);
        activeContactCounts.push(latest.contacts.filter((contact) => contact.type !== 'exit' && !contact.trigger && !contact.sensor).length);
      }
      if (CHECK_FRAMES.has(frame)) row.comparisons.push(captureComparison(world, latest, buffers));
    }
    row.measuredWallMs = performance.now() - measuredWallStart;
    row.measuredFrames = FRAME_COUNT - SETTLE_FRAMES;
    row.measuredTicksPerSecond = row.measuredFrames * 1000 / row.measuredWallMs;
    row.publicStepMs = summary(stepTimes);
    row.latestMs = summary(latestTimes);
    row.stepAndLatestMs = summary(pairedTimes);
    row.contactCounts = summary(contactCounts);
    row.activeSolidContactCounts = summary(activeContactCounts);
    row.nativeMemory = memoryRecord(readMemory);
    row.processMemory = process.memoryUsage();
    row.loadEnd = loadavg();
  } catch (error) {
    row.error = { name: error.name, message: error.message, stack: error.stack };
    throw error;
  } finally {
    world.dispose();
    row.disposed = true;
    row.nativeAfterDispose = memoryRecord(readMemory);
    assert.equal(row.nativeAfterDispose.liveSlots, '0');
    assert.equal(row.nativeAfterDispose.liveWorlds, '0');
    assert.equal(row.nativeAfterDispose.retainedBytes, '0');
    assert.equal(row.nativeAfterDispose.imbalance, false);
  }
  return row;
}

const options = parseOptions(process.argv.slice(2));
let output;
if (options.output) {
  await mkdir(dirname(options.output), { recursive: true });
  output = await open(options.output, 'wx');
}
const report = {
  schema: 'syncplay-common-contacts-v1', sdkRoot: options.sdkRoot,
  fixtureSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  environment: { date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model,
    logicalCpus: cpus().length, memoryGiB: totalmem() / 2 ** 30, gcAvailable: typeof global.gc === 'function', loadStart: loadavg() },
  definition,
  fixture: { boxes: 400, columns: 8, rows: 5, tiers: 10, edgeMeters: BOX_EDGE, spacingMeters: BOX_EDGE,
    boxMassKg: BOX_MASS, boxInertiaKgM2: BOX_INERTIA, floorY: FLOOR_Y, floorHalfExtents: [32, 0.5, 32],
    boxCoefficients: { friction: 0.72, restitution: 0.12, rollingResistance: 0 }, floorCoefficients: { friction: 0.82, restitution: 0.08, rollingResistance: 0 },
    linearDamping: 0.98, angularDamping: 0.945, sleepThresholdMetersPerSecond: 0.05, initialSleeping: true,
    frames: FRAME_COUNT, settleFrames: SETTLE_FRAMES, measuredFrames: [SETTLE_FRAMES + 1, FRAME_COUNT], shoveFrame: SETTLE_FRAMES + 1,
    shoveVelocityMetersPerSecond: [0, 0, 6], shoveBodies: 40, wakeBodies: 400, retainedCheckpoints: 0 },
  notes: [
    'The public step call includes SDK facade work. It does not isolate the compiled solver.',
    'The latest call reads and creates the full SDK output, including material data when supported.',
    'Motion and common contact hashes compare this fixture only. Material fields, checkpoint formats, and full game behavior are outside this parity check.',
    'Motion hashes use raw typed-array bytes. Contact hashes use ordered common field arrays in JSON. Contact JSON normalizes negative zero.',
    'The shove wakes all boxes once. It does not run the game stack wake policy or any game simulation.',
    'Memory uses a read-only local core diagnostic. It is not a public package export. All simulation operations use the public physics entry.',
    'Comparison hashes and motion reads run outside the timed API calls. Wall time also includes loop and comparison work. No histories are retained.',
    'GC runs before a scene only when Node starts with --expose-gc. Alternate SDK process order and repeat runs before claiming a timing change.',
  ],
  scenes: [],
};
try {
  const packageInfo = JSON.parse(await readFile(join(options.sdkRoot, 'package.json'), 'utf8'));
  assert.equal(packageInfo.name, '@series-inc/rundot-syncplay');
  assert.equal(typeof packageInfo.version, 'string');
  report.version = packageInfo.version;
  report.artifact = await artifactMetadata(options.sdkRoot);
  assert.equal(report.artifact.packageVersion, packageInfo.version);
  const sdk = await import(pathToFileURL(join(options.sdkRoot, 'dist/physics/3d.js')).href);
  await sdk.initPhysics3D({ artifact: 'production' });
  const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(options.sdkRoot, 'core/src/physics/world.mjs')).href);
  for (const scene of ['rest', 'shove']) runScene(sdk, nativePhysicsInstanceMemory, scene, report.scenes);
} catch (error) {
  report.error = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  report.environment.loadEnd = loadavg();
  const text = `${JSON.stringify(report, null, 2)}\n`;
  try {
    if (output) await output.writeFile(text);
    process.stdout.write(text);
  } finally {
    await output?.close();
  }
}
