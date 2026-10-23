import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { cpus, freemem, loadavg, totalmem } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
const gameRoot = resolve(dirname(self), '..');
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  assert.ok(['--worker', '--sdk', '--output', '--outdir', '--rc54', '--rc55', '--game-root'].includes(flag), `Unknown option: ${flag}`);
  if (flag === '--worker') options.worker = true;
  else {
    const value = process.argv[++i];
    assert.ok(value && !value.startsWith('--'), `${flag} requires a path`);
    options[flag.slice(2)] = resolve(value);
  }
}
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const sha = value => createHash('sha256').update(value).digest('hex');
const summarize = values => {
  const ordered = [...values].sort((a, b) => a - b);
  const at = fraction => ordered[Math.floor((ordered.length - 1) * fraction)] ?? 0;
  return { count: ordered.length, min: ordered[0] ?? 0, p50: at(.5), p95: at(.95), max: ordered.at(-1) ?? 0,
    mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) };
};
const host = () => ({ date: new Date().toISOString(), load: loadavg(), freeBytes: freemem(), process: process.memoryUsage(), cpu: process.cpuUsage() });
const errorRecord = error => ({ name: error.name, message: error.message, stack: error.stack });
const save = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); };

async function runWorker() {
  assert.ok(options.sdk && options.output, '--worker requires --sdk and --output');
  const sdkRoot = options.sdk;
  const sdk = await import(pathToFileURL(join(sdkRoot, 'dist/physics/3d.js')).href);
  await sdk.initPhysics3D({ artifact: 'production' });
  const { nativePhysicsInstanceMemory } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/world.mjs')).href);
  const { physicsWasmMetadata, physicsWasmModuleBase64, physicsWasmUrl } = await import(pathToFileURL(join(sdkRoot, 'core/src/physics/physics-wasm-module.generated.mjs')).href);
  const memory = () => JSON.parse(json(nativePhysicsInstanceMemory()));
  const wasmBytes = typeof physicsWasmUrl === 'function'
    ? await readFile(physicsWasmUrl())
    : Buffer.from(physicsWasmModuleBase64, 'base64');
  const wasmSha256 = sha(wasmBytes);
  assert.equal(wasmSha256, physicsWasmMetadata.wasmSha256);
  const edge = .96, floorY = -.86, inertia = edge * edge / 6;
  const positions = Array.from({ length: 400 }, (_, i) => ({
    x: -13.1 + (i % 8 - 3.5) * edge,
    y: floorY + edge / 2 + Math.floor(i / 40) * edge,
    z: -20.7 + (Math.floor(i / 8) % 5 - 2) * edge,
  }));
  const body = (index, motion) => ({ kind: 'dynamic', key: `box-${index}`,
    shape: { type: 'box', halfX: edge / 2, halfY: edge / 2, halfZ: edge / 2 }, position: positions[index],
    orientation: { x: 0, y: 0, z: 0, w: 1 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 },
    mass: 1, inertia: { xx: inertia, yy: inertia, zz: inertia }, gravityScale: 1,
    linearDamping: .98, angularDamping: .945, friction: .72, restitution: .12, rollingResistance: 0,
    sleeping: true, sleepEnabled: true, sleepThreshold: .05, layer: 1, mask: 0xffffffff, ...motion });
  const definition = { tickRate: 30, initialGravity: { x: 0, y: -13.5, z: 0 }, substeps: 6, velocityIterations: 6,
    restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
    capacity: { bodies: 512, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 2 }, portalProxyCapacity: 1 };
  const limits = { maxShiftMeters: .05, wakeRecoveryFrame: 480, finalActiveBodies: 0 };
  const report = { schema: 'syncplay-rc55-native-stress-v1', sdkRoot,
    version: JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8')).version,
    fixtureSha256: sha(await readFile(self)), wasmSha256, metadata: physicsWasmMetadata,
    artifactSha256: sha(await readFile(join(sdkRoot, 'core/src/physics/physics-wasm-module.generated.mjs'))),
    nativeSourceSha256: sha(await readFile(join(sdkRoot, 'core/native/physics/physics.cpp'))),
    environment: { node: process.version, cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalBytes: totalmem(), start: host() },
    definition, limits, fixture: { bodies: 400, columns: 8, rows: 5, tiers: 10, edge,
      checkpointFrame: 120, wakeFrame: 121, shallowEditFrame: 241, neutralFramesAfterWake: 2400, finalFrame: 2520,
      shallowEdit: 'Remove .01 m from each X face of box399; keep current motion, mass, and inertia. Wake this edited body only.' },
    notes: ['All simulation operations use the public physics entry. Memory reads use a read-only local core diagnostic.',
      'Timings include the public facade. latest() creates output objects. Contact rows are not solver constraint counts.',
      'Forward timing excludes assertions, motion reads, hashes, edits, memory reads, and replay. These still affect host load.',
      'Physical gates use the existing ten-tier .05 m shift limit and recovery by frame480. A shallow top edit must also recover.',
      'Compare replay hashes only within one SDK version. Different physics epochs may have different correct results.'], cases: [] };
  const checkFrames = new Set([1, 120, 121, 150, 240, 241, 360, 480, 720, 1200, 1800, 2400, 2520]);
  for (const scenario of ['wake-once', 'shallow-edit']) {
    global.gc?.();
    const row = { scenario, samples: [], hostStart: host(), maximumShift: 0, memoryPeak: {}, neutralTailMaximumActive: 0 };
    report.cases.push(row);
    const world = sdk.createPhysicsWorld3D(definition);
    let checkpoint;
    let boxes = [];
    const buffers = { poses: new Float64Array(512 * 7), velocities: new Float64Array(512 * 6), ids: new BigUint64Array(512), status: new Uint8Array(512), teleports: new Uint32Array(512) };
    const times = { step: [], latest: [], paired: [], active: [], contacts: [], activeContacts: [] };
    try {
      boxes = world.edit(ops => {
        ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
          position: { x: 0, y: floorY - .5, z: 0 }, friction: .82, restitution: .08, rollingResistance: 0, layer: 1, mask: 0xffffffff });
        return positions.map((_position, index) => ops.createBody(body(index)));
      }).created;
      const sample = (frame, latest, hash) => {
        const { count } = world.writeBodyMotionInto(buffers.poses, buffers.velocities, buffers.ids, buffers.status, buffers.teleports);
        assert.equal(count, 401);
        assert.equal(Number(latest.frame), frame);
        let active = 0, maxSpeed = 0, maxShift = 0;
        const byId = new Map();
        for (let slot = 0; slot < count; slot++) {
          const pose = buffers.poses.subarray(slot * 7, slot * 7 + 7);
          const velocity = buffers.velocities.subarray(slot * 6, slot * 6 + 6);
          for (const value of [...pose, ...velocity]) assert.ok(Number.isFinite(value), `Nonfinite body at frame${frame}`);
          if ((buffers.status[slot] & 3) !== 1) continue;
          if (!(buffers.status[slot] & 0x10)) active++;
          maxSpeed = Math.max(maxSpeed, Math.hypot(...velocity.subarray(0, 3)));
          byId.set(buffers.ids[slot], slot);
        }
        boxes.forEach((box, index) => {
          const slot = byId.get(box.id);
          assert.notEqual(slot, undefined);
          const p = positions[index];
          maxShift = Math.max(maxShift, Math.hypot(buffers.poses[slot * 7] - p.x, buffers.poses[slot * 7 + 1] - p.y, buffers.poses[slot * 7 + 2] - p.z));
        });
        for (const [array, length] of [[buffers.poses, count * 7], [buffers.velocities, count * 6], [buffers.ids, count], [buffers.status, count], [buffers.teleports, count]]) {
          hash?.update(Buffer.from(array.buffer, array.byteOffset, length * array.BYTES_PER_ELEMENT));
        }
        const contacts = latest.contacts;
        const activeContacts = contacts.filter(c => c.type !== 'exit' && !c.trigger && !c.sensor).length;
        if (checkFrames.has(frame)) for (const c of contacts) for (const value of [c.normalImpulse, c.tangentImpulse1, c.tangentImpulse2, c.penetration, c.closingSpeed, c.point.x, c.point.y, c.point.z]) assert.ok(Number.isFinite(value));
        return { frame, active, maxSpeed, maxShift, contacts: contacts.length, activeContacts };
      };
      const advance = (from, through, record) => {
        const trace = createHash('sha256');
        for (let frame = from; frame <= through; frame++) {
          if (frame === 121) for (const box of boxes) world.wakeBody(box);
          if (scenario === 'shallow-edit' && frame === 241) {
            const old = world.resolveKey('box-399');
            assert.ok(old);
            world.edit(ops => ops.replaceBody(boxes[399], { ...body(399), shape: { type: 'box', halfX: .47, halfY: .48, halfZ: .48 },
              position: old.position, orientation: old.orientation, linearVelocity: old.linearVelocity, angularVelocity: old.angularVelocity, sleeping: false }));
            boxes = boxes.map(box => world.resolveBody(box.id));
          }
          const started = performance.now();
          world.step();
          const stepped = performance.now();
          const latest = world.latest();
          const ended = performance.now();
          const state = sample(frame, latest, trace);
          if (record) {
            row.maximumShift = Math.max(row.maximumShift, state.maxShift);
            if (frame >= 480) row.neutralTailMaximumActive = Math.max(row.neutralTailMaximumActive, state.active);
            if (frame > 120) {
              times.step.push(stepped - started); times.latest.push(ended - stepped); times.paired.push(ended - started);
              times.active.push(state.active); times.contacts.push(state.contacts); times.activeContacts.push(state.activeContacts);
            }
            if (checkFrames.has(frame)) {
              const native = memory();
              row.samples.push({ ...state, digest: world.digest().toString(), native, host: host() });
              for (const [key, value] of Object.entries(native)) if (typeof value === 'number' || /^\d+$/.test(String(value))) {
                if (BigInt(value) > BigInt(row.memoryPeak[key] ?? 0)) row.memoryPeak[key] = String(value);
              }
            }
          }
        }
        return { trace: trace.digest('hex'), digest: world.digest().toString(), final: sample(through, world.latest()) };
      };
      advance(1, 120, true);
      checkpoint = world.captureCheckpoint();
      row.checkpoint = { bytes: world.serializeCheckpoint(checkpoint).length, info: JSON.parse(json(world.checkpointInfo(checkpoint))) };
      const forward = advance(121, 2520, true);
      row.forward = forward;
      world.restoreCheckpoint(checkpoint);
      boxes = boxes.map(box => world.resolveBody(box.id));
      const replay = advance(121, 2520, false);
      row.replay = replay;
      assert.deepEqual(replay, forward, 'Replay must match every motion frame and the complete terminal digest.');
      row.gates = { finite: true, exactReplay: true, boundedShift: row.maximumShift < limits.maxShiftMeters,
        recoveryBy480AndStaysAsleep: row.neutralTailMaximumActive === 0, finalAsleep: forward.final.active === 0 };
      row.timings = { publicStepMs: summarize(times.step), latestMs: summarize(times.latest), stepAndLatestMs: summarize(times.paired),
        activeBodies: summarize(times.active), contacts: summarize(times.contacts), activeContacts: summarize(times.activeContacts),
        within33ms: times.paired.filter(t => t <= 1000 / 30).length / times.paired.length,
        within16ms: times.paired.filter(t => t <= 1000 / 60).length / times.paired.length };
    } catch (error) { row.error = errorRecord(error); process.exitCode = 1; }
    finally {
      try { if (checkpoint) world.releaseCheckpoint(checkpoint); }
      finally { world.dispose(); }
      row.nativeAfterDispose = memory();
      row.hostEnd = host();
      row.disposalZero = ['liveWorlds', 'liveSlots', 'retainedBytes'].every(key => String(row.nativeAfterDispose[key]) === '0') && row.nativeAfterDispose.imbalance === false;
      row.pass = !row.error && row.disposalZero && Object.values(row.gates ?? {}).every(Boolean);
      if (!row.pass) process.exitCode = 1;
      console.log(json({ version: report.version, scenario, pass: row.pass, gates: row.gates, final: row.forward?.final, timing: row.timings?.stepAndLatestMs, error: row.error }));
    }
  }
  report.environment.end = host();
  report.pass = report.cases.every(row => row.pass);
  await save(options.output, report);
}

async function campaign() {
  assert.ok(options.rc54 && options.rc55 && options.outdir, 'Use --rc54 <package> --rc55 <package> --outdir <directory> [--game-root <clean game>]');
  for (const sdk of [options.rc54, options.rc55]) assert.ok(isAbsolute(sdk));
  await mkdir(options.outdir, { recursive: true });
  const fixtures = options['game-root'] ?? gameRoot;
  const report = { schema: 'syncplay-rc55-native-campaign-v1', fixtureSha256: sha(await readFile(self)),
    gameRoot: fixtures, sdkRoots: { rc54: options.rc54, rc55: options.rc55 }, start: host(), runs: [] };
  const run = async (label, script, args) => {
    const command = [process.execPath, '--expose-gc', script, ...args];
    console.log(`Start ${label}.`);
    const started = performance.now();
    let stdout = '', stderr = '';
    const result = await new Promise((resolveResult, reject) => {
      const child = spawn(command[0], command.slice(1), { cwd: fixtures, env: { ...process.env, SYNCPLAY_SOURCE_OVERRIDE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', (code, signal) => resolveResult({ code, signal }));
    });
    await writeFile(join(options.outdir, `${label}.stdout.log`), stdout, { flag: 'wx' });
    await writeFile(join(options.outdir, `${label}.stderr.log`), stderr, { flag: 'wx' });
    const row = { label, command, ...result, wallMs: performance.now() - started, host: host() };
    report.runs.push(row);
    console.log(`Finish ${label}: exit${result.code}, ${(row.wallMs / 1000).toFixed(1)}s.`);
    await writeFile(join(options.outdir, 'campaign-progress.json'), `${JSON.stringify(report, null, 2)}\n`);
  };
  for (const version of ['rc54', 'rc55']) await run(`stacks-${version}`, join(fixtures, 'scripts/repro-syncplay-stack-recovery.mjs'), ['--sdk', options[version], '--out', join(options.outdir, `stacks-${version}.json`), '--require-stable']);
  for (const version of ['rc54', 'rc55']) await run(`stress-${version}`, self, ['--worker', '--sdk', options[version], '--output', join(options.outdir, `stress-${version}.json`)]);
  for (const [i, version] of ['rc54', 'rc55', 'rc55', 'rc54'].entries()) await run(`contacts-${i + 1}-${version}`, join(fixtures, 'scripts/profile-syncplay-contacts.mjs'), ['--sdk', options[version], '--output', join(options.outdir, `contacts-${i + 1}-${version}.json`)]);
  for (const version of ['rc54', 'rc55']) await run(`body-count-boundary-${version}`, join(gameRoot, 'scripts/repro-syncplay-body-count.mjs'), ['--sdk', options[version], '--out', join(options.outdir, `body-count-boundary-${version}.json`), '--require-stable']);
  await run('topology-confirmation-rc55', join(gameRoot, 'scripts/repro-syncplay-topology-bound.mjs'), ['--sdk', options.rc55, '--out', join(options.outdir, 'topology-confirmation-rc55.json'), '--require-success']);
  report.end = host();
  report.rc55Pass = report.runs.filter(row => row.label.endsWith('rc55')).every(row => row.code === 0);
  report.rc54ControlFailures = report.runs.filter(row => row.label.endsWith('rc54') && row.code !== 0).map(row => row.label);
  report.pass = report.runs.every(row => row.code === 0);
  await save(join(options.outdir, 'campaign.json'), report);
  if (!report.pass) process.exitCode = 1;
}

if (options.worker) await runWorker(); else await campaign();
