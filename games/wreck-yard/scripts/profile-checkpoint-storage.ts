// Bundle as for scripts/profile-sim.ts. This uses the real save policy.
import '../src/deterministicMath';
import assert from 'node:assert/strict';
import { cpus, loadavg, totalmem } from 'node:os';
import { pathToFileURL } from 'node:url';
import { NEUTRAL_INPUT } from '../src/sim/input';
import { setPhysicsBodyVelocity } from '../src/sim/physics';
import { YardSim, type YardSave } from '../src/sim/sim';

const { nativePhysicsInstanceMemory } = await import(pathToFileURL(`${process.cwd()}/node_modules/@series-inc/rundot-syncplay/core/src/physics/world.mjs`).href);
const sim = YardSim.create(4);
const saves: YardSave[] = [];
const inputs = Array.from({ length: 4 }, () => NEUTRAL_INPUT);
const tickMs: number[] = [];
const captureMs: number[] = [];
const samples: unknown[] = [];
let frame = 0;
let oldStateReplay = false;
let error: string | undefined;
let peakNativeSaves = 0;
let peakJsPhysicsBytes = 0;
const memory = () => JSON.parse(JSON.stringify(nativePhysicsInstanceMemory(), (_key, value) => typeof value === 'bigint' ? Number(value) : value));
const percentile = (values: readonly number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] ?? 0;
const stats = (values: readonly number[]) => ({ median: percentile(values, 0.5), p90: percentile(values, 0.9), max: Math.max(0, ...values), samples: values.length });
const storage = () => ({
  logicalSaves: saves.length,
  nativeSaves: saves.filter((save) => save.physics.kind === 'checkpoint').length,
  jsPhysicsBytes: saves.reduce((bytes, save) => bytes + (save.physics.kind === 'bytes' ? save.physics.bytes.byteLength : 0), 0),
});
const environment = { date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: totalmem() / 2 ** 30, startLoadAverage: loadavg() };

try {
  for (let tick = 1; tick <= 600; tick++) {
    if (tick === 31) {
      const bottom = sim.state.bodies.filter((body) => body.storageBay === 'storage').slice(0, 40);
      assert.equal(bottom.length, 40);
      sim.edit((physics) => {
        for (const body of bottom) setPhysicsBodyVelocity(physics, body.id, [0, 0, 0.2]);
      });
    }
    const start = performance.now();
    sim.step(inputs);
    const captureStart = performance.now();
    saves.push(sim.save());
    captureMs.push(performance.now() - captureStart);
    if (saves.length > 256) sim.release(saves.shift()!);
    frame = sim.state.frame;
    tickMs.push(performance.now() - start);
    const retained = storage();
    peakNativeSaves = Math.max(peakNativeSaves, retained.nativeSaves);
    peakJsPhysicsBytes = Math.max(peakJsPhysicsBytes, retained.jsPhysicsBytes);
    assert.ok(retained.nativeSaves <= 32, 'Native save count exceeded 32.');
    if (tick % 30 === 0) {
      const native = memory();
      assert.ok(native.liveSlots <= 32, 'Native live slots exceeded 32.');
      assert.ok(native.highWaterSlots <= 32, 'Native capture peak exceeded 32 before checksum imports.');
      assert.ok(native.retainedBytes < 160 * 1024 * 1024, 'Native retained memory reached its limit.');
      samples.push({ frame, ...retained, native, process: process.memoryUsage() });
    }
  }
  assert.equal(saves.length, 256);
  assert.equal(saves[0]!.physics.kind, 'bytes');
  const oldest = saves[0]!;
  const tail = saves.at(-1)!;
  const expectedChecksum = sim.checksumBytes(tail);
  const expectedLateJoin = sim.encode(tail);
  const oldestLateJoin = sim.encode(oldest);
  const decoded = YardSim.decode(oldestLateJoin);
  assert.deepEqual(sim.checksumBytes(decoded), sim.checksumBytes(oldest));
  sim.restore(oldest);
  for (let tick = oldest.state.frame; tick < 600; tick++) sim.step(inputs);
  const replay = sim.save();
  try {
    assert.deepEqual(sim.checksumBytes(replay), expectedChecksum);
    assert.deepEqual(sim.encode(replay), expectedLateJoin);
    oldStateReplay = true;
  } finally {
    sim.release(replay);
    sim.release(decoded);
  }
} catch (cause) {
  error = String(cause);
  samples.push({ frame, error, ...storage(), native: memory(), process: process.memoryUsage() });
} finally {
  try {
    for (const save of saves) sim.release(save);
  } finally {
    sim.dispose();
  }
}
const afterDispose = memory();
console.log(JSON.stringify({ environment, note: 'Capture time includes storage conversion. Raw JavaScript physics buffers exclude game state and garbage awaiting collection. WASM heap bytes can remain at their high-water size after disposal. Timings do not establish a device budget.', frame, error, oldStateReplay, peakNativeSaves, peakJsPhysicsBytes, tickMs: stats(tickMs), captureMs: stats(captureMs), samples, afterDispose, endLoadAverage: loadavg() }, null, 2));
assert.equal(afterDispose.liveSlots, 0);
assert.equal(afterDispose.retainedBytes, 0);
assert.equal(afterDispose.liveWorlds, 0);
assert.equal(afterDispose.imbalance, false);
if (error) process.exitCode = 1;
