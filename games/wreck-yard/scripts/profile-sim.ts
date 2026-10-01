// Profiles real simulation ticks: npm run profile:sim. For a CPU profile:
//   npm run profile:sim
//   node --cpu-prof --cpu-prof-dir=test-results/sim-prof test-results/profile-sim.mjs
// Prints per-scenario tick cost and the rollback costs (native save and
// restore, state encoding) so SDK changes can be measured against it.
import '../src/deterministicMath';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from '../src/sim/input';
import { physicsStateBodyById } from '../src/sim/physics';
import { YardSim } from '../src/sim/sim';
import type { YardState } from '../src/sim/state';

const aimFrom = (height: number) => (t: readonly [number, number, number]) => {
  const o = [t[0], t[1] + height, t[2] + 0.001] as const;
  return quantizeRay(o, [t[0] - o[0], t[1] - o[1], t[2] - o[2]]);
};
const rayAt = aimFrom(6);
/** Inside TORCH_RANGE. */
const torchAt = aimFrom(2);
const stats = (times: number[]) => {
  const sorted = [...times].sort((a, b) => a - b);
  return `median ${sorted[sorted.length >> 1]!.toFixed(2)} ms, p90 ${sorted[Math.floor(sorted.length * 0.9)]!.toFixed(2)} ms, max ${sorted.at(-1)!.toFixed(2)} ms`;
};
const sim = YardSim.create(1);
function run(label: string, ticks: number, input: (tick: number, state: YardState) => YardInput): YardState {
  let state = sim.state;
  const times: number[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const t0 = performance.now();
    state = sim.step([input(tick, state)]);
    times.push(performance.now() - t0);
  }
  const slowest = times.indexOf(Math.max(...times));
  console.log(`${label.padEnd(26)} ${stats(times)}  slowest tick ${slowest}  bodies=${state.bodies.length}`);
  return state;
}

for (let i = 0; i < 60; i += 1) sim.step([NEUTRAL_INPUT]);

let state = run('idle', 300, () => NEUTRAL_INPUT);

const ballast = physicsStateBodyById(state.world, 'ballast-box')!;
const grab: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([ballast.x, ballast.y, ballast.z]) };
state = run('gravity gun holding', 300, (tick) =>
  tick === 0 ? grab : { ...grab, ...rayAt([ballast.x + Math.sin(tick / 12), ballast.y + 1.5, ballast.z + Math.cos(tick / 12)]) });
state = run('after release', 60, () => NEUTRAL_INPUT);

const gantry = physicsStateBodyById(state.world, 'steel-gantry')!;
// Same aim as the gantry cut test in step.test.ts, then fresh torch strokes on the pieces.
const cuts: number[] = [];
let lastCuts = state.stats.torchCuts + state.stats.fractures;
state = run('torch cutting', 150, (tick, current) => {
  const total = current.stats.torchCuts + current.stats.fractures;
  if (total > lastCuts) { cuts.push(tick); lastCuts = total; }
  const target = physicsStateBodyById(current.world, 'steel-gantry') ?? gantry;
  // Release for one tick every 20 ticks so each stroke starts a new cut.
  return { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: tick % 20 !== 19, ...torchAt([target.x + 0.2 - (tick % 20) * 0.03, target.y + 0.2, target.z]) };
});
console.log(`  cuts/fractures landed on ticks: ${cuts.join(', ') || 'none'}`);
state = run('after cutting (idle)', 150, () => NEUTRAL_INPUT);

// Costs the rollback design adds on top of the physics step. Every tick pays
// a native save; a rollback pays a restore; peers pay an encode to checksum.
const saveTimes: number[] = [];
const restoreTimes: number[] = [];
const encodeTimes: number[] = [];
const decodeTimes: number[] = [];
const restoreBytesTimes: number[] = [];
let bytes = new Uint8Array(0);
for (let i = 0; i < 100; i += 1) {
  let t0 = performance.now();
  const save = sim.save();
  saveTimes.push(performance.now() - t0);
  t0 = performance.now();
  sim.restore(save);
  restoreTimes.push(performance.now() - t0);
  t0 = performance.now();
  bytes = sim.encode(save);
  encodeTimes.push(performance.now() - t0);
  t0 = performance.now();
  const decoded = YardSim.decode(bytes);
  decodeTimes.push(performance.now() - t0);
  t0 = performance.now();
  sim.restore(decoded);
  restoreBytesTimes.push(performance.now() - t0);
  sim.release(save);
}
console.log(`save (native checkpoint)       ${stats(saveTimes)}`);
console.log(`restore native checkpoint      ${stats(restoreTimes)}`);
console.log(`encode full state              ${stats(encodeTimes)}`);
console.log(`decode full state              ${stats(decodeTimes)}`);
console.log(`restore from bytes             ${stats(restoreBytesTimes)}`);
console.log(`full state ${bytes.byteLength} bytes, ${state.world.bodies.length} physics bodies`);
sim.dispose();
