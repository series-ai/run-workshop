// Run with esbuild, as for scripts/profile-sim.ts.
import '../src/deterministicMath';
import { cpus, loadavg, platform, release, totalmem } from 'node:os';
import { STORAGE } from '../src/sim/attractions';
import { TICK_RATE } from '../src/sim/constants';
import { NEUTRAL_INPUT } from '../src/sim/input';
import { fullPhysicsBodyById, physicsStateBodyById, removePhysicsBodies } from '../src/sim/physics';
import { YardSim } from '../src/sim/sim';
import { createCrateSpawns } from '../src/sim/storage';

const inputs = Array.from({ length: 4 }, () => NEUTRAL_INPUT);
const budget = 1000 / TICK_RATE;
function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  return { medianMs: sorted[sorted.length >> 1], p90Ms: sorted[Math.floor(sorted.length * 0.9)], maxMs: sorted.at(-1), samples: times.length, overBudget: times.filter((time) => time > budget).length };
}
function timed<T>(times: number[], action: () => T): T {
  const start = performance.now();
  const result = action();
  times.push(performance.now() - start);
  return result;
}
function measure(sim: YardSim, name: string, ticks: number) {
  const step: number[] = [], save: number[] = [], checksum: number[] = [], total: number[] = [];
  let checksumByteLength = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const start = performance.now();
    timed(step, () => sim.step(inputs));
    const checkpoint = timed(save, () => sim.save());
    try { checksumByteLength = timed(checksum, () => sim.checksumBytes(checkpoint)).byteLength; }
    finally { sim.release(checkpoint); }
    total.push(performance.now() - start);
  }
  const storageBoxes = sim.state.bodies.filter((body) => body.storageBay === 'storage');
  const sleepingStorageBoxes = storageBoxes.filter((body) => fullPhysicsBodyById(sim.physics, body.id)?.sleeping).length;
  const lateJoinEncode: number[] = [];
  let stateBytes = 0;
  const checkpoint = sim.save();
  try {
    for (let sample = 0; sample < 20; sample++) stateBytes = timed(lateJoinEncode, () => sim.encode(checkpoint)).byteLength;
  } finally { sim.release(checkpoint); }
  return { name, players: 4, physicsBodies: sim.state.world.bodies.length, storageBoxes: storageBoxes.length, sleepingStorageBoxes, stateBytes, checksumBytes: checksumByteLength, step: stats(step), checkpoint: stats(save), checksum: stats(checksum), stepCheckpointChecksum: stats(total), lateJoinEncode: stats(lateJoinEncode) };
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !/^--storage-count=\d+$/.test(args[0]!))) throw new Error('Use --storage-count=80 through --storage-count=400.');
const storageCount = args.length === 0 ? STORAGE.count : Number(args[0]!.split('=')[1]);
if (!Number.isInteger(storageCount) || storageCount < 80 || storageCount > STORAGE.count) throw new Error('Storage count must be 80 through 400.');
const sim = YardSim.create(4);
try {
  const spawns = createCrateSpawns('storage').slice(0, storageCount);
  const removedIds = new Set(createCrateSpawns('storage').slice(storageCount).map((spawn) => spawn.body.id));
  if (removedIds.size > 0) {
    sim.edit((physics) => removePhysicsBodies(physics, [...removedIds]));
    const saved = sim.save();
    try { sim.restore({ ...saved, state: { ...saved.state, bodies: saved.state.bodies.filter((body) => !removedIds.has(body.id)) } }); }
    finally { sim.release(saved); }
  }
  const environment = { date: new Date().toISOString(), platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: totalmem() / 2 ** 30, loadAverage: loadavg(), node: process.version, tickBudgetMs: budget };
  for (let tick = 0; tick < 180; tick++) sim.step(inputs);
  const maxRestDrift = Math.max(...spawns.map((spawn) => {
    const body = physicsStateBodyById(sim.state.world, spawn.body.id)!;
    return Math.hypot(body.x - spawn.position[0], body.y - spawn.position[1], body.z - spawn.position[2]);
  }));
  const rest = measure(sim, 'rest', 180);
  const topBefore = spawns.slice(-STORAGE.columns * STORAGE.rows).map((spawn) => ({ id: spawn.body.id, y: physicsStateBodyById(sim.state.world, spawn.body.id)!.y }));
  const bottomIds = new Set(spawns.slice(0, STORAGE.columns * STORAGE.rows).map((spawn) => spawn.body.id));
  sim.edit((physics) => removePhysicsBodies(physics, [...bottomIds]));
  const withoutSupports = sim.save();
  try { sim.restore({ ...withoutSupports, state: { ...withoutSupports.state, bodies: withoutSupports.state.bodies.filter((body) => !bottomIds.has(body.id)) } }); }
  finally { sim.release(withoutSupports); }
  const collapse = measure(sim, 'collapse', 180);
  const topBoxesDropped = topBefore.filter(({ id, y }) => physicsStateBodyById(sim.state.world, id)!.y < y - 0.5).length;
  const nativeRestore: number[] = [], decode: number[] = [], byteRestore: number[] = [];
  const checkpoint = sim.save();
  try {
    const bytes = sim.encode(checkpoint);
    for (let sample = 0; sample < 20; sample++) {
      timed(nativeRestore, () => sim.restore(checkpoint));
      const decoded = timed(decode, () => YardSim.decode(bytes));
      timed(byteRestore, () => sim.restore(decoded));
    }
  } finally { sim.release(checkpoint); }
  console.log(JSON.stringify({ environment, note: 'Wall-clock times include host contention. Tick totals measure step, checkpoint capture, and checksum bytes. Late-join encoding has 20 separate samples per scenario. This run does not establish a device-wide performance guarantee.', evidence: { maxRestDriftMeters: maxRestDrift, removedBottomSupports: bottomIds.size, topBoxesDroppedOverHalfMeter: topBoxesDropped }, scenarios: [rest, collapse], nativeRestore: stats(nativeRestore), decode: stats(decode), byteRestore: stats(byteRestore), finalLoadAverage: loadavg() }, null, 2));
} finally { sim.dispose(); }
