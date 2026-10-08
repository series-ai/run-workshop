/** R26 source contracts. These tests use actual seeded traffic, not GPU output. */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deriveTrafficParams } from '../src/sim/derive';
import { carTrafficPlan, type CarPlan } from '../src/render/traffic';
import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import {
  bakedPathRow, cpuHopShare, deriveImpostorAttributes, deriveImpostorCar,
  forkBump, forkBumpRate, hash01, IMPOSTOR_HOP_SHARE, INTERCHANGES,
  newFlowSample, newImpostorCar, renderTrafficModel, sampleStreamFlow,
  sampleStreamPath, STREAM_DESCRIPTORS, STREAMS, type RenderTrafficModel,
} from '../src/render/trafficStreams';

// Captured from immutable R25 source f779b2a8…8730b before R26 changes.
const BEFORE = [
  {
    "seed": 0,
    "carSalt": 2440226648,
    "impostorSalt": 1264006281,
    "placement": "e492857b4d355f4136378ce8c8b9da8a10c0656e76056b0546dabf641338eb76",
    "hops": "2e73c03500c649f20ed66dab908f9b810c2a61a48d8f1d6a21feb4dceedeeb71",
    "unchangedRows": "406ec8f8fdaaa0186759c4d8dc25444564771f516ea280f44326450e55f6c42b",
    "streamArcPhaseSeed": "7ff2955dcfa15cee3ae54c39a236e9dfb1921818a7d434e368e48e8be5e47171",
    "row": "37b6f97bbd489b20198e52b8f1f41967c81de1b9e0695f69edaceeec9394058f",
    "flow": "0e6a2ad02302972f66a15f5c1b3ae2fc97836db142144a551622cc686bc75ab7",
    "speedTraits": "5afb824c65e8bd7702bc328cbac6fef69e7c7ec509971f2726e5992d792061c2"
  },
  {
    "seed": 2147483647,
    "carSalt": 3318611861,
    "impostorSalt": 3553773543,
    "placement": "9e7aaf4c5db8bdc150e4d96d6e3cb2dae284a62130026d29c45b8092abd3d4a7",
    "hops": "2f2a2f29a85000eea88e6a37a92d73d046064179c4795b3047b568a84ac2e0c9",
    "unchangedRows": "406ec8f8fdaaa0186759c4d8dc25444564771f516ea280f44326450e55f6c42b",
    "streamArcPhaseSeed": "b6f8b688901719f877c84f3b058c9367fd07e636475a7a3506195c72f60c7bcd",
    "row": "6ca26df3f27fa9377c586247bd498a4868005b4e37edfe6cbb1cf6fc0bd1ac13",
    "flow": "2fc11a30f576d8cec30e6b45bd3c8abb1177e54e66454923451cc1ed62dc2c59",
    "speedTraits": "7184a8b33a46b8c4320482d3bc648028824ab589efee6f6414f2b142a0289358"
  },
  {
    "seed": 4294967295,
    "carSalt": 1330931300,
    "impostorSalt": 3741379470,
    "placement": "6230103c5e17a4f14278a8c296fb2478b896634c599bc7a8ca3695ad45c9bcd8",
    "hops": "513104246ce3a0a3fe3034058188ae89e2cb06d408f0a02bc1bcb6ad3f455587",
    "unchangedRows": "406ec8f8fdaaa0186759c4d8dc25444564771f516ea280f44326450e55f6c42b",
    "streamArcPhaseSeed": "138896b8444b294a51a8fbe58d94355ce25806c0a8839d845532c8ac211033da",
    "row": "2fba128e29f25016adc80d56e745580f279b45f79defdc457e7ceb891311e530",
    "flow": "e22f81bcf3fd717c2ceaa5cb271caf0ee98a67b79db9034c1a5840b4af20b51e",
    "speedTraits": "577597dfb22cc95aae5f9e17e1dbc8a9bf6c23ca96bde5e7c289bd5d87e2d90e"
  },
  {
    "seed": 424242,
    "carSalt": 1918265406,
    "impostorSalt": 324806894,
    "placement": "c67967afb8c3507f865849b02de40857393a708297037475393b100dbb6cec05",
    "hops": "7be7603a22fb7b7a40749e122ebeb07f3d7db816e0e83f1c2718aec5c68c2a5d",
    "unchangedRows": "406ec8f8fdaaa0186759c4d8dc25444564771f516ea280f44326450e55f6c42b",
    "streamArcPhaseSeed": "85b1a0b7045a61cbadac4f2bd94dbf7dc289383b14bae3202f11efa71aa80a13",
    "row": "88724d5856f15d643168f3f79660a5447a958aa87a3ab873567c6f910d332273",
    "flow": "52a7b2f98ccaef24fc9e8810e76e002abc2616ac66a32273e430b6063d607bc7",
    "speedTraits": "dc3166258c123718e0b0322fc0d24d3649c0bedafeb153c8e8b28950e6bcd479"
  }
] as const;
const L = CANYON_LOOP_LENGTH_M;
const POPULATION = 20000;
const sha = (value: string | ArrayBufferView): string => createHash('sha256').update(
  typeof value === 'string' ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength),
).digest('hex');
const wrap = (v: number): number => ((v % L) + L) % L;
function overlaps(a: number, na: number, b: number, nb: number): boolean {
  return wrap(b - a) < na || wrap(a - b) < nb;
}
// Frozen avalanche channels. A branch range change must keep each car's hash identity.
function decision(index: number, salt: number, channel: number): boolean {
  const mix = (input: number): number => {
    let x = input ^ (input >>> 16);
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
  };
  return mix((mix((index + salt) | 0) + Math.imul(channel, 0x9e3779b9)) | 0) / 4294967296 < 0.27;
}
function expectedBits(index: number, salt: number): number {
  return (decision(index, salt, 0x111) ? 1 : 0) | (decision(index, salt, 0x112) ? 2 : 0);
}
function unchangedRows(model: RenderTrafficModel): Float32Array {
  const stride = model.table.width * 4;
  const rows: number[] = [];
  for (let k = 0; k < 8; k += 1) rows.push(...model.table.data.subarray(k * 4 * stride, (k * 4 + 1) * stride));
  rows.push(...model.table.data.subarray(32 * stride));
  return Float32Array.from(rows);
}
function offset(model: RenderTrafficModel, path: number, node: number, arc: number) {
  const main = { cx: 0, cy: 0, sx: 0, sy: 0 };
  const branch = { ...main };
  sampleStreamPath(model.table, bakedPathRow(path, 0), wrap(arc) / 8, main);
  sampleStreamPath(model.table, bakedPathRow(path, 1 << node), wrap(arc) / 8, branch);
  return { x: branch.cx - main.cx, y: branch.cy - main.cy,
    sx: branch.sx - main.sx, sy: branch.sy - main.sy, main, branch };
}
const ramp = (u: number): number => u <= 0 ? 0 : u >= 1 ? 1 : u ** 3 * (10 - 15 * u + 6 * u ** 2);

interface Counts { cars: number; nodes: number[]; any: number; }
function counts(model: RenderTrafficModel): Counts[] {
  return model.forks.map(nodes => ({ cars: 0, nodes: nodes.map(() => 0), any: 0 }));
}
function count(list: Counts[], path: number, bits: number): void {
  const row = list[path]!;
  row.cars += 1;
  const actual = bits & ((1 << row.nodes.length) - 1);
  if (actual !== 0) row.any += 1;
  for (let f = 0; f < row.nodes.length; f += 1) if ((actual & (1 << f)) !== 0) row.nodes[f]! += 1;
}

describe('R26 fork visibility contracts', () => {
  it('keeps all 80000 spawn, speed, convoy, passing and main-path records unchanged', () => {
    for (const before of BEFORE) {
      const model = renderTrafficModel(before.seed);
      const attrs = deriveImpostorAttributes(before.seed, POPULATION, model);
      expect(model.carSalt).toBe(before.carSalt);
      expect(model.impostorSalt).toBe(before.impostorSalt);
      expect(sha(JSON.stringify(model.forks.map(nodes => nodes.map(n => [n.startM, n.lengthM, n.rampM]))))).toBe(before.placement);
      expect(sha(JSON.stringify(model.hops))).toBe(before.hops);
      expect(sha(unchangedRows(model))).toBe(before.unchangedRows);
      expect(sha(attrs.streamArcPhaseSeed)).toBe(before.streamArcPhaseSeed);
      expect(sha(attrs.row)).toBe(before.row);
      expect(sha(attrs.flow)).toBe(before.flow);
      const speed = new Float64Array(POPULATION * 6);
      const car = newImpostorCar();
      for (let i = 0; i < POPULATION; i += 1) {
        deriveImpostorCar(model, i, car);
        speed.set([car.path, car.flow.sampledCruiseMps, car.flow.effectiveMps,
          car.flow.convoy ? 1 : 0, car.flow.convoyRatio, car.pulse], i * 6);
      }
      expect(sha(speed)).toBe(before.speedTraits);
    }
  });

  it('uses the same independent 0.27 decisions for CPU traits and uploaded GPU routes', () => {
    const gpuBySeed: Counts[][] = [];
    const cpuBySeed: Counts[][] = [];
    let wrong = 0;
    let straightCars = 0;
    let disabledCars = 0;
    for (const before of BEFORE) {
      const model = renderTrafficModel(before.seed);
      const attrs = deriveImpostorAttributes(before.seed, POPULATION, model);
      const car = newImpostorCar();
      const flow = newFlowSample();
      const gpu = counts(model);
      for (let i = 0; i < POPULATION; i += 1) {
        deriveImpostorCar(model, i, car);
        if (car.path >= 8) {
          straightCars += 1;
          if (car.flow.forkBits !== 0 || car.flow.hop) wrong += 1;
          continue;
        }
        const bits = expectedBits(i, model.impostorSalt);
        if (car.flow.forkBits !== bits || attrs.route[i * 4] !== bakedPathRow(car.path, bits)
          || attrs.route[i * 4 + 1] !== bakedPathRow(car.flow.hopTarget, bits)) wrong += 1;
        sampleStreamFlow(model, { path: car.path, index: i, salt: model.impostorSalt,
          pulse: car.pulse, row: car.row, phase: car.phase, appearanceSeed: car.appearanceSeed,
          hopShare: IMPOSTOR_HOP_SHARE, allowForks: true }, flow);
        if (flow.forkBits !== bits) wrong += 1;
        count(gpu, car.path, bits);
      }
      const cpu = counts(model);
      const params = deriveTrafficParams(before.seed, 2400);
      const plan: CarPlan = { role: 'free', stream: 255 };
      for (let i = 0; i < 2400; i += 1) {
        carTrafficPlan(before.seed, i, plan);
        if (plan.role !== 'stream') continue;
        const phase = params.phase[i]!;
        const input = { path: plan.stream, index: i, salt: model.carSalt,
          pulse: Math.floor(phase * STREAMS[plan.stream]![8]!), row: Math.fround(hash01(i ^ (before.seed | 0), 0x43)),
          phase, appearanceSeed: Math.fround(hash01(i ^ (before.seed | 0), 0x21)),
          hopShare: cpuHopShare(i), allowForks: true };
        sampleStreamFlow(model, input, flow);
        const bits = expectedBits(i, model.carSalt);
        if (flow.forkBits !== bits) wrong += 1;
        count(cpu, plan.stream, bits);
        sampleStreamFlow(model, { ...input, allowForks: false }, flow);
        disabledCars += 1;
        if (flow.forkBits !== 0 || flow.hop) wrong += 1;
      }
      gpuBySeed.push(gpu);
      cpuBySeed.push(cpu);
      // These are per-node decisions. Any fork has a different probability on two-node streams.
      for (const list of [gpu, cpu]) {
        for (let f = 0; f < 2; f += 1) {
          const rows = list.filter(p => p.nodes.length > f);
          const cars = rows.reduce((n, p) => n + p.cars, 0);
          const share = rows.reduce((n, p) => n + p.nodes[f]!, 0) / cars;
          expect(share).toBeGreaterThanOrEqual(0.25);
          expect(share).toBeLessThanOrEqual(0.30);
        }
        for (const p of list) {
          const target = 1 - 0.73 ** p.nodes.length;
          const tolerance = 4 * Math.sqrt(target * (1 - target) / p.cars);
          expect(Math.abs(p.any / p.cars - target)).toBeLessThan(tolerance);
        }
      }
    }
    // Pool the four seeds for each stream. Small individual CPU streams have sampling noise.
    for (const populations of [gpuBySeed, cpuBySeed]) {
      for (let path = 0; path < 8; path += 1) {
        for (let f = 0; f < 2; f += 1) {
          const rows = populations.map(p => p[path]!).filter(p => p.nodes.length > f);
          const cars = rows.reduce((n, p) => n + p.cars, 0);
          if (cars === 0) continue;
          const share = rows.reduce((n, p) => n + p.nodes[f]!, 0) / cars;
          if (populations === gpuBySeed) {
            expect(share).toBeGreaterThanOrEqual(0.25);
            expect(share).toBeLessThanOrEqual(0.30);
          } else {
            // CPU streams have 281–1295 cars here. Check their binomial sampling error.
            expect(Math.abs(share - 0.27)).toBeLessThan(4 * Math.sqrt(0.27 * 0.73 / cars));
          }
        }
      }
    }
    expect(wrong).toBe(0);
    expect(straightCars).toBeGreaterThan(40000);
    expect(disabledCars).toBeGreaterThan(7000);
  });

  it('bakes a first 60–100 m vertical branch and optional 30–60 m branch on every stream', () => {
    let nodes = 0;
    for (const before of BEFORE) {
      const model = renderTrafficModel(before.seed);
      expect(model.forks).toHaveLength(8);
      model.forks.forEach((forks, path) => {
        expect([1, 2]).toContain(forks.length);
        forks.forEach((fork, f) => {
          nodes += 1;
          expect(fork.rampM).toBe(600);
          expect(Math.abs(fork.lateralM)).toBeGreaterThanOrEqual(80);
          expect(Math.abs(fork.lateralM)).toBeLessThanOrEqual(160);
          expect(Math.abs(fork.verticalM)).toBeGreaterThanOrEqual(f === 0 ? 60 : 30);
          expect(Math.abs(fork.verticalM)).toBeLessThanOrEqual(f === 0 ? 100 : 60);
          expect(fork.lengthM).toBeGreaterThanOrEqual(1200);
          expect(fork.lengthM).toBeLessThanOrEqual(1500);
          const full = offset(model, path, f, fork.startM + 600);
          expect(full.x).toBeCloseTo(fork.lateralM, 3);
          expect(full.y).toBeCloseTo(fork.verticalM, 3);
        });
      });
    }
    expect(nodes).toBeGreaterThanOrEqual(32);
  });

  it('keeps mirrored 600 m ramps with continuous position, slope and analytic curvature', () => {
    for (const before of BEFORE) {
      const model = renderTrafficModel(before.seed);
      model.forks.forEach((forks, path) => forks.forEach((fork, f) => {
        for (const d of [0, 120, 240, 360, 480, 600]) {
          const entry = offset(model, path, f, fork.startM + d);
          const exit = offset(model, path, f, fork.startM + fork.lengthM - d);
          const weight = ramp(d / 600);
          expect(entry.x).toBeCloseTo(fork.lateralM * weight, 3);
          expect(entry.y).toBeCloseTo(fork.verticalM * weight, 3);
          expect(exit.x).toBeCloseTo(entry.x, 3);
          expect(exit.y).toBeCloseTo(entry.y, 3);
          expect(exit.sx).toBeCloseTo(-entry.sx, 6);
          expect(exit.sy).toBeCloseTo(-entry.sy, 6);
        }
        for (const d of [0, fork.lengthM]) {
          const end = offset(model, path, f, fork.startM + d);
          expect([end.x, end.y, end.sx, end.sy]).toEqual([0, 0, 0, 0]);
          expect(forkBump(d, fork.lengthM, 600)).toBe(0);
          expect(forkBumpRate(d, fork.lengthM, 600)).toBe(0);
          // The one-sided second derivative tends to zero. The table remains linearly sampled.
          for (const h of [0.1, 0.01]) {
            const inside = d === 0 ? h : d - h;
            const curvature = Math.abs(forkBumpRate(inside, fork.lengthM, 600) / h);
            expect(curvature).toBeLessThan(30 * h / 600 ** 3);
          }
        }
      }));
    }
  });

  it('keeps the prior corridor budget, flyable height and sticky handoff exclusions', () => {
    for (const before of BEFORE) {
      const model = renderTrafficModel(before.seed);
      model.forks.forEach((forks, path) => forks.forEach((fork, f) => {
        const st = STREAM_DESCRIPTORS[path]!;
        const reach = Math.max(st.widthM * 0.5 + (st.widthM / Math.max(1, st.rows - 1)) * 0.3, st.widthM * 0.5) + 12;
        let mainExcess = 0;
        let branchExcess = 0;
        for (let d = 0; d <= fork.lengthM; d += 8) {
          const pose = offset(model, path, f, fork.startM + d);
          mainExcess = Math.max(mainExcess, Math.abs(pose.main.cx) + reach - 340);
          branchExcess = Math.max(branchExcess, Math.abs(pose.branch.cx) + reach - 340);
          expect(pose.branch.cy - 8).toBeGreaterThanOrEqual(150);
          expect(pose.branch.cy + 8).toBeLessThanOrEqual(2600);
        }
        expect(branchExcess).toBeLessThanOrEqual(mainExcess + 0.001);
        for (const [a, b, at] of INTERCHANGES) {
          if (path !== a && path !== b) continue;
          for (const reserved of [wrap(at), wrap(at + L * 0.5)]) {
            expect(overlaps(fork.startM, fork.lengthM, reserved, 1100)).toBe(false);
          }
        }
      }));
    }
  });
});
