// Profiles real simulation ticks. Bundle and run with a CPU profile:
//   npx esbuild scripts/profile-sim.ts --bundle --platform=node --format=esm \
//     --external:@series-inc/* --outfile=/tmp/profile-sim.mjs
//   node --cpu-prof --cpu-prof-dir=/tmp/sim-prof /tmp/profile-sim.mjs
// Prints per-scenario tick cost and the per-tick rollback costs (checkpoint,
// restore, state encoding) so SDK changes can be measured against it.
import '../src/deterministicMath';
import { encodeState, decodeState } from '../src/sim/codec';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from '../src/sim/input';
import { closeWorld, openWorld, physicsStateBodyById } from '../src/sim/physics';
import { createInitialState } from '../src/sim/presets';
import type { YardState } from '../src/sim/state';
import { stepYard } from '../src/sim/step';

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
function run(label: string, start: YardState, ticks: number, input: (tick: number, state: YardState) => YardInput): YardState {
  let state = start;
  const times: number[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const t0 = performance.now();
    state = stepYard(state, [input(tick, state)]);
    times.push(performance.now() - t0);
  }
  const slowest = times.indexOf(Math.max(...times));
  console.log(`${label.padEnd(26)} ${stats(times)}  slowest tick ${slowest}  bodies=${state.bodies.length}`);
  return state;
}

let state = createInitialState(1);
for (let i = 0; i < 60; i += 1) state = stepYard(state, [NEUTRAL_INPUT]);

state = run('idle', state, 300, () => NEUTRAL_INPUT);

const ballast = physicsStateBodyById(state.world, 'ballast-box')!;
const grab: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([ballast.x, ballast.y, ballast.z]) };
state = run('gravity gun holding', state, 300, (tick) =>
  tick === 0 ? grab : { ...grab, ...rayAt([ballast.x + Math.sin(tick / 12), ballast.y + 1.5, ballast.z + Math.cos(tick / 12)]) });
state = run('after release', state, 60, () => NEUTRAL_INPUT);

const gantry = physicsStateBodyById(state.world, 'steel-gantry')!;
// Same aim as the gantry cut test in step.test.ts, then fresh torch strokes on the pieces.
const cuts: number[] = [];
let lastCuts = state.stats.torchCuts + state.stats.fractures;
state = run('torch cutting', state, 150, (tick, current) => {
  const total = current.stats.torchCuts + current.stats.fractures;
  if (total > lastCuts) { cuts.push(tick); lastCuts = total; }
  const target = physicsStateBodyById(current.world, 'steel-gantry') ?? gantry;
  // Release for one tick every 20 ticks so each stroke starts a new cut.
  return { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: tick % 20 !== 19, ...torchAt([target.x + 0.2 - (tick % 20) * 0.03, target.y + 0.2, target.z]) };
});
console.log(`  cuts/fractures landed on ticks: ${cuts.join(', ') || 'none'}`);
state = run('after cutting (idle)', state, 150, () => NEUTRAL_INPUT);

// Per-tick costs the rollback design adds on top of the physics step.
const open: number[] = [];
const close: number[] = [];
const encode: number[] = [];
const decode: number[] = [];
let bytes = 0;
for (let i = 0; i < 100; i += 1) {
  let t0 = performance.now();
  const world = openWorld(state.world);
  open.push(performance.now() - t0);
  t0 = performance.now();
  closeWorld(world);
  close.push(performance.now() - t0);
  t0 = performance.now();
  const encoded = encodeState(state);
  encode.push(performance.now() - t0);
  bytes = encoded.byteLength;
  t0 = performance.now();
  decodeState(encoded);
  decode.push(performance.now() - t0);
}
console.log(`restore world from checkpoint  ${stats(open)}`);
console.log(`capture + serialize checkpoint ${stats(close)}`);
console.log(`encode full state              ${stats(encode)}`);
console.log(`decode full state              ${stats(decode)}`);
console.log(`physics checkpoint ${state.world.checkpoint.byteLength} bytes, full state ${bytes} bytes, ${state.world.bodies.length} physics bodies`);
