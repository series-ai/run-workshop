/**
 * @file trafficNetwork.test.ts — R21 living traffic: the shared render traffic model.
 *
 * What this file holds:
 *   - the model builds on held-out seeds, and the simulation still rejects an invalid one;
 *   - every car's cruise speed sits in its class band, and a convoy runs at 70-85% of one;
 *   - the branch choice is independent of arc, phase, speed, sub-row and appearance;
 *   - a branch, a course change and the lap seam are continuous in position and in slope, forward
 *     and backward in time;
 *   - one completed course change per lap, and the hop share of each tier's stream cars;
 *   - the whole model clears the corridor and every drawn mass at <= 8 m spacing;
 *   - the CPU mirror and the vertex shader sample the baked table by the same rule.
 *
 * It proves source behaviour only. It is not a GPU proof: the actual shader output is captured
 * separately through transform feedback.
 */
import { describe, expect, it } from 'vitest';

import { deriveCityLayout, deriveTrafficParams } from '../src/sim/derive';
import { CANYON_LOOP_LENGTH_M, warpCanyon, type WarpOut } from '../src/render/canyonWarp';
import { createMassField } from '../src/render/clearance';
import { presentCityLayout } from '../src/render/presentationLayout';
import {
  IMPOSTOR_CANYON_ARC_GLSL,
  IMPOSTOR_POSITION_ANCHOR_GLSL,
  IMPOSTOR_VERTEX_GLSL,
  carTrafficPlan,
  trafficHopCensus,
  type CarPlan,
} from '../src/render/traffic';
import {
  CONVOY_PULSE_SHARE,
  CONVOY_RATIO_MIN,
  CONVOY_RATIO_SPAN,
  FORK_LATERAL_MIN_M,
  FORK_LATERAL_SPAN_M,
  FORK_LENGTH_MIN_M,
  FORK_LENGTH_SPAN_M,
  FORK_RAMP_M,
  FORK_STREAM_COUNT,
  FORK_VERTICAL_MIN_M,
  FORK_VERTICAL_SPAN_M,
  HOP_COHORT_BOUNDS,
  HOP_RAMP_MIN_M,
  HOP_RAMP_SPAN_M,
  IMPOSTOR_HOP_SHARE,
  IMPOSTOR_LANES,
  IMPOSTOR_PATHS,
  INTERCHANGES,
  INTERCHANGE_RAMP_M,
  LANE_ROW_0,
  SPEED_BANDS,
  STREAMS,
  STREAM_CORRIDOR_HALF_M,
  STREAM_DESCRIPTORS,
  STREAM_PASS_GAIN,
  STREAM_PASS_MAX_M,
  STREAM_PASS_PERIOD_MIN_S,
  STREAM_PASS_PERIOD_SPAN_S,
  STREAM_PATH_ROWS,
  STREAM_PATH_SAMPLES,
  STREAM_PATH_STEP_M,
  STREAM_VARIANTS,
  WARP_ROW,
  bakedPathRow,
  deriveImpostorAttributes,
  evaluateCanyonPose,
  forkBump,
  impostorFlow,
  impostorPosition,
  newCanyonPose,
  newFlowSample,
  newImpostorFlowReport,
  pathOfBakedRow,
  quintic,
  renderTrafficModel,
  sampleStreamPath,
  sampleWarpRow,
  scatterRowOf,
  wrapArc,
  type FlowSample,
  type ImpostorFlowReport,
  type RenderTrafficModel,
} from '../src/render/trafficStreams';

/** Seeds held out of the implementation: zero, max int32, max uint32, and the demo seed. */
const HELD_OUT_SEEDS: readonly number[] = [0, 2147483647, 4294967295, 424242];
const L = CANYON_LOOP_LENGTH_M;
/** Largest hull half-extent a car is drawn with: archetype half-length x the top size scale. */
const HULL_RADIUS_M = 8;

function wrappedIntervalsTouch(a0: number, la: number, b0: number, lb: number): boolean {
  return wrapArc(b0 - a0) < la || wrapArc(a0 - b0) < lb;
}

/** A hand-built flow, so a branch or a course change can be evaluated without hunting for a car. */
function syntheticFlow(
  model: RenderTrafficModel,
  path: number,
  forkBits: number,
  hopTarget: number | null,
  phase: number,
  appearanceSeed: number,
  speedMps = 100,
): FlowSample {
  const st = STREAM_DESCRIPTORS[path]!;
  const flow = newFlowSample();
  flow.path = path;
  flow.kind = st.kind;
  flow.direction = st.direction;
  flow.sampledCruiseMps = speedMps;
  flow.effectiveMps = speedMps;
  flow.convoy = false;
  flow.convoyRatio = 1;
  flow.passAmplitudeM = 0;
  flow.passPeriodS = 20;
  flow.forkBits = forkBits;
  flow.hop = hopTarget !== null;
  flow.hopTarget = hopTarget ?? path;
  flow.bakedRowA = bakedPathRow(path, forkBits);
  flow.bakedRowB = bakedPathRow(hopTarget ?? path, forkBits);
  const link = model.hops[path]!;
  flow.hopStartM = hopTarget === null ? 0 : link.startM;
  flow.hopRampM = hopTarget === null ? HOP_RAMP_MIN_M : link.rampM;
  flow.scatterRow = scatterRowOf(phase, appearanceSeed);
  return flow;
}

describe('R21 traffic model: seeds and placement', () => {
  it('keeps the simulation seed boundary and builds one cached model per held-out seed', () => {
    // The simulation boundary is unchanged: it still rejects a negative seed.
    expect(() => deriveTrafficParams(-1, 16)).toThrow('SKYRIVER_SEED_INVALID');
    expect(() => deriveCityLayout(-1)).toThrow('SKYRIVER_SEED_INVALID');
    // The render model validates the same range, loudly.
    expect(() => renderTrafficModel(-1)).toThrow('SKYRIVER_RENDER_SEED_INVALID');
    expect(() => renderTrafficModel(1.5)).toThrow('SKYRIVER_RENDER_SEED_INVALID');
    expect(() => renderTrafficModel(0x100000000)).toThrow('SKYRIVER_RENDER_SEED_INVALID');

    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      expect(model.seed).toBe(seed);
      // One model instance per seed, so neither population rebakes the ~1 MB table.
      expect(renderTrafficModel(seed)).toBe(model);
      expect(model.table.height).toBe(STREAM_PATH_ROWS);
      expect(model.table.width).toBe(STREAM_PATH_SAMPLES + 1);
      expect(STREAM_PATH_ROWS).toBe(STREAM_VARIANTS * STREAMS.length + IMPOSTOR_LANES.length + 1);
      expect(STREAM_PATH_ROWS).toBe(39);
      expect(model.table.data.length).toBe(STREAM_PATH_ROWS * (STREAM_PATH_SAMPLES + 1) * 4);
    }
  });

  it('never leaks one seed\'s branches into another, and rebuilds the same table', () => {
    const model0VariantRow = bakedPathRow(0, 1);
    const first = renderTrafficModel(HELD_OUT_SEEDS[0]!);
    const reference = Float32Array.from(first.table.data);
    const forks = JSON.stringify(first.forks);
    // Walk past the cache limit, so the first model is evicted and must be rebuilt.
    for (const seed of [1, 2, 3, 4, 5, ...HELD_OUT_SEEDS.slice(1)]) renderTrafficModel(seed);
    const rebuilt = renderTrafficModel(HELD_OUT_SEEDS[0]!);
    expect(Array.from(rebuilt.table.data)).toEqual(Array.from(reference));
    expect(JSON.stringify(rebuilt.forks)).toBe(forks);
    // Different seeds really do give different branch networks.
    const other = renderTrafficModel(HELD_OUT_SEEDS[1]!);
    expect(JSON.stringify(other.forks)).not.toBe(forks);
    // Row 0 is stream 0's main line, which no seed changes; row 1 is its first branch variant.
    const variantFrom = model0VariantRow * rebuilt.table.width * 4;
    const variantTo = variantFrom + rebuilt.table.width * 4;
    expect(Array.from(rebuilt.table.data.slice(0, rebuilt.table.width * 4)))
      .toEqual(Array.from(other.table.data.slice(0, other.table.width * 4)));
    expect(Array.from(other.table.data.slice(variantFrom, variantTo)))
      .not.toEqual(Array.from(reference.slice(variantFrom, variantTo)));
    // The warp row is shared geometry: it is identical for every seed.
    const warpFrom = WARP_ROW * rebuilt.table.width * 4;
    expect(Array.from(other.table.data.slice(warpFrom))).toEqual(Array.from(rebuilt.table.data.slice(warpFrom)));
  });

  it('places 1-2 forks and one course change per stream inside the stated geometry', () => {
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      expect(model.forks.length).toBe(FORK_STREAM_COUNT);
      expect(model.hops.length).toBe(FORK_STREAM_COUNT);
      for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
        const forks = model.forks[k]!;
        expect(forks.length === 1 || forks.length === 2).toBe(true);
        for (const fork of forks) {
          expect(fork.lengthM).toBeGreaterThanOrEqual(FORK_LENGTH_MIN_M);
          expect(fork.lengthM).toBeLessThanOrEqual(FORK_LENGTH_MIN_M + FORK_LENGTH_SPAN_M);
          // 1200 m of support holds two full 600 m ramps.
          expect(fork.lengthM).toBeGreaterThanOrEqual(2 * fork.rampM);
          expect(fork.rampM).toBe(FORK_RAMP_M);
          expect(Math.abs(fork.lateralM)).toBeGreaterThanOrEqual(FORK_LATERAL_MIN_M);
          expect(Math.abs(fork.lateralM)).toBeLessThanOrEqual(FORK_LATERAL_MIN_M + FORK_LATERAL_SPAN_M);
          expect(Math.abs(fork.verticalM)).toBeGreaterThanOrEqual(FORK_VERTICAL_MIN_M);
          expect(Math.abs(fork.verticalM)).toBeLessThanOrEqual(FORK_VERTICAL_MIN_M + FORK_VERTICAL_SPAN_M);
          expect(fork.startM).toBeGreaterThanOrEqual(0);
          expect(fork.startM).toBeLessThan(L);
        }
        // Two forks on one stream never overlap.
        if (forks.length === 2) {
          expect(wrappedIntervalsTouch(forks[0]!.startM, forks[0]!.lengthM, forks[1]!.startM, forks[1]!.lengthM)).toBe(false);
        }
        const hop = model.hops[k]!;
        expect(hop.a).toBe(k);
        expect(hop.b).not.toBe(k);
        // Same direction only: opposite streams are never blended.
        expect(STREAM_DESCRIPTORS[hop.b]!.direction).toBe(STREAM_DESCRIPTORS[k]!.direction);
        expect(hop.rampM).toBeGreaterThanOrEqual(HOP_RAMP_MIN_M);
        expect(hop.rampM).toBeLessThanOrEqual(HOP_RAMP_MIN_M + HOP_RAMP_SPAN_M);
        // The ramp sits strictly inside one lap, so the lap-parity flip is a join, not a step.
        expect(hop.startM).toBeGreaterThan(0);
        expect(hop.startM + hop.rampM).toBeLessThan(L);
        // A fork and a merge never share a stretch of the same stream.
        for (const fork of forks) {
          expect(wrappedIntervalsTouch(hop.startM, hop.rampM, fork.startM, fork.lengthM)).toBe(false);
        }
        // Forks and hop ramps stay out of every interchange ramp the stream rides, where the R15
        // sticky cars hand over.
        for (const [a, b, at] of INTERCHANGES) {
          for (const reserved of [wrapArc(at), wrapArc(at + L * 0.5)]) {
            if (k === a || k === b) {
              for (const fork of forks) {
                expect(wrappedIntervalsTouch(fork.startM, fork.lengthM, reserved, INTERCHANGE_RAMP_M)).toBe(false);
              }
            }
            if (k === a || k === b || hop.b === a || hop.b === b) {
              expect(wrappedIntervalsTouch(hop.startM, hop.rampM, reserved, INTERCHANGE_RAMP_M)).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('R21 speed bands, convoys and passing', () => {
  it('samples every cruise speed inside its class band and every convoy at 70-85% of one', () => {
    const seenKinds = new Set<string>();
    let convoyCars = 0;
    let bandCars = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const attrs = deriveImpostorAttributes(seed, 6000);
      const report = newImpostorFlowReport();
      for (let i = 0; i < attrs.count; i += 1) {
        const flow = impostorFlow(attrs, i, 11.5, report);
        seenKinds.add(flow.kind);
        expect([1, -1]).toContain(flow.direction);
        expect(flow.sampledCruiseMps).toBeGreaterThan(0);
        if (flow.convoy) {
          convoyCars += 1;
          expect(flow.convoyRatio).toBeGreaterThanOrEqual(CONVOY_RATIO_MIN);
          expect(flow.convoyRatio).toBeLessThanOrEqual(CONVOY_RATIO_MIN + CONVOY_RATIO_SPAN);
        } else {
          expect(flow.convoyRatio).toBe(1);
        }
        expect(flow.effectiveCruiseMps).toBeCloseTo(flow.sampledCruiseMps * flow.convoyRatio, 9);
        if (flow.normalBandMps === null) {
          expect(flow.kind === 'lane' || flow.kind === 'ring').toBe(true);
          continue;
        }
        bandCars += 1;
        const [low, high] = flow.normalBandMps;
        expect(flow.sampledCruiseMps).toBeGreaterThanOrEqual(low);
        expect(flow.sampledCruiseMps).toBeLessThanOrEqual(high);
      }
    }
    expect(seenKinds).toEqual(new Set(['freight', 'standard', 'express', 'lane', 'ring']));
    expect(bandCars).toBeGreaterThan(5000);
    // Convoys come from the density pulses, so their share follows CONVOY_PULSE_SHARE loosely.
    const convoyShare = convoyCars / (HELD_OUT_SEEDS.length * 6000);
    expect(convoyShare).toBeGreaterThan(CONVOY_PULSE_SHARE * 0.4);
    expect(convoyShare).toBeLessThan(CONVOY_PULSE_SHARE * 1.6);
  });

  it('reports the class bands the contract names', () => {
    expect(SPEED_BANDS.freight).toEqual({ minMps: 40, maxMps: 75 });
    expect(SPEED_BANDS.standard).toEqual({ minMps: 70, maxMps: 130 });
    expect(SPEED_BANDS.express).toEqual({ minMps: 150, maxMps: 195 });
    const kinds = STREAMS.map((_, k) => STREAM_DESCRIPTORS[k]!.kind);
    expect(kinds).toEqual(['freight', 'express', 'standard', 'standard', 'express', 'freight', 'standard', 'standard']);
  });

  it('advances nominal canyon progress at exactly the effective speed, apart from world speed', () => {
    const dt = 0.002;
    const a = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    const b = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    const lo = newImpostorFlowReport();
    const hi = newImpostorFlowReport();
    let worstProgressError = 0;
    let worstWorldRatio = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const attrs = deriveImpostorAttributes(seed, 1500);
      for (let i = 0; i < attrs.count; i += 1) {
        for (const t of [-7.25, 0, 19.5, 133.75]) {
          const low = impostorFlow(attrs, i, t - dt, lo);
          if (low.kind === 'ring') continue;
          const high = impostorFlow(attrs, i, t + dt, hi);
          const progress = low.direction * (high.unwrappedCanyonArcM - low.unwrappedCanyonArcM) / (2 * dt);
          worstProgressError = Math.max(worstProgressError, Math.abs(progress - low.effectiveCruiseMps));
          impostorPosition(attrs, i, t - dt, a);
          impostorPosition(attrs, i, t + dt, b);
          const world = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (2 * dt);
          worstWorldRatio = Math.max(worstWorldRatio, world / low.effectiveCruiseMps);
        }
      }
    }
    // Nominal progress is exact; world speed differs because the canyon curves and because a
    // branch, a course change and the passing offset add real lateral and vertical travel.
    expect(worstProgressError).toBeLessThan(1e-6);
    expect(worstWorldRatio).toBeGreaterThan(1);
    expect(worstWorldRatio).toBeLessThan(3);
  });

  it('keeps the passing offset signed, clamped to 12 m, and zero inside a convoy', () => {
    const report = newImpostorFlowReport();
    let clamped = 0;
    let positive = 0;
    let negative = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const attrs = deriveImpostorAttributes(seed, 4000);
      for (let i = 0; i < attrs.count; i += 1) {
        const flow = impostorFlow(attrs, i, 0, report);
        if (flow.kind === 'ring') continue;
        const amplitude = flow.traits.passAmplitudeM;
        const period = flow.traits.passPeriodS;
        expect(Math.abs(amplitude)).toBeLessThanOrEqual(STREAM_PASS_MAX_M + 1e-9);
        expect(period).toBeGreaterThanOrEqual(STREAM_PASS_PERIOD_MIN_S);
        expect(period).toBeLessThanOrEqual(STREAM_PASS_PERIOD_MIN_S + STREAM_PASS_PERIOD_SPAN_S);
        if (flow.convoy) {
          expect(amplitude).toBe(0);
          continue;
        }
        const median = flow.normalBandMps === null
          ? STREAM_DESCRIPTORS[flow.path]!.nominalMps
          : (flow.normalBandMps[0] + flow.normalBandMps[1]) / 2;
        const wanted = (flow.sampledCruiseMps - median) * STREAM_PASS_GAIN;
        expect(amplitude).toBeCloseTo(Math.max(-STREAM_PASS_MAX_M, Math.min(STREAM_PASS_MAX_M, wanted)), 6);
        if (Math.abs(amplitude) >= STREAM_PASS_MAX_M - 1e-9) clamped += 1;
        if (amplitude > 0) positive += 1;
        if (amplitude < 0) negative += 1;
      }
    }
    expect(positive).toBeGreaterThan(100);
    expect(negative).toBeGreaterThan(100);
    // The clamp really binds, so the 12 m limit is a limit and not decoration.
    expect(clamped).toBeGreaterThan(0);
  });
});

describe('R21 branch choice independence', () => {
  it('decorrelates the branch and the course change from every other channel', () => {
    const report = newImpostorFlowReport();
    for (const seed of HELD_OUT_SEEDS) {
      const attrs = deriveImpostorAttributes(seed, 20000);
      const columns: Record<string, number[]> = { forkBit0: [], forkBit1: [], hop: [], arc: [], phase: [], row: [], appearance: [], cruise: [] };
      const variants = [0, 0, 0, 0];
      for (let i = 0; i < attrs.count; i += 1) {
        const flow = impostorFlow(attrs, i, 0, report);
        if (flow.path >= FORK_STREAM_COUNT) continue;
        const bits = flow.traits.forkBits;
        variants[bits] = variants[bits]! + 1;
        columns.forkBit0!.push(bits & 1);
        columns.forkBit1!.push((bits >> 1) & 1);
        columns.hop!.push(flow.traits.hop);
        columns.arc!.push(flow.traits.arc);
        columns.phase!.push(flow.traits.phase);
        columns.row!.push(flow.traits.row);
        columns.appearance!.push(flow.traits.appearanceSeed);
        columns.cruise!.push(flow.sampledCruiseMps);
      }
      const n = columns.forkBit0!.length;
      expect(n).toBeGreaterThan(3000);
      const correlate = (a: number[], b: number[]): number => {
        let sa = 0;
        let sb = 0;
        for (let i = 0; i < n; i += 1) { sa += a[i]!; sb += b[i]!; }
        const ma = sa / n;
        const mb = sb / n;
        let cov = 0;
        let va = 0;
        let vb = 0;
        for (let i = 0; i < n; i += 1) {
          const da = a[i]! - ma;
          const db = b[i]! - mb;
          cov += da * db;
          va += da * da;
          vb += db * db;
        }
        return cov / Math.sqrt(va * vb);
      };
      for (const choice of ['forkBit0', 'forkBit1', 'hop']) {
        for (const other of ['arc', 'phase', 'row', 'appearance', 'cruise']) {
          expect(Math.abs(correlate(columns[choice]!, columns[other]!))).toBeLessThan(0.05);
        }
      }
      // The two bits are independent of each other, and all four variants are populated.
      expect(Math.abs(correlate(columns.forkBit0!, columns.forkBit1!))).toBeLessThan(0.05);
      for (const count of variants) expect(count / n).toBeGreaterThan(0.18);
      // The course-change share of GPU stream cars matches the model constant.
      const hopShare = columns.hop!.reduce((sum, v) => sum + v, 0) / n;
      expect(Math.abs(hopShare - IMPOSTOR_HOP_SHARE)).toBeLessThan(0.02);
    }
  });
});

describe('R21 fork geometry', () => {
  it('returns a branch exactly to the main line at both ends, in position and in slope', () => {
    const forked = newCanyonPose();
    const main = newCanyonPose();
    let worstPosition = 0;
    let worstSlope = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
        const forks = model.forks[k]!;
        for (let f = 0; f < forks.length; f += 1) {
          const fork = forks[f]!;
          const bits = 1 << f;
          for (const phase of [0.07, 0.61]) {
            for (const row of [0.05, 0.97]) {
              const withFork = syntheticFlow(model, k, bits, null, phase, row);
              const withoutFork = syntheticFlow(model, k, 0, null, phase, row);
              // Every endpoint of the support and of both ramps, plus the lap seam.
              const edges = [fork.startM, fork.startM + fork.rampM, fork.startM + fork.lengthM - fork.rampM, fork.startM + fork.lengthM, 0, L];
              for (const edge of edges) {
                const atEnd = Math.abs(wrapArc(edge - fork.startM)) < 1e-9
                  || Math.abs(wrapArc(edge - fork.startM) - fork.lengthM) < 1e-9
                  || forkBump(wrapArc(edge - fork.startM), fork.lengthM, fork.rampM) === 0;
                evaluateCanyonPose(model, withFork, wrapArc(edge), 3.5, phase, row, row, forked);
                evaluateCanyonPose(model, withoutFork, wrapArc(edge), 3.5, phase, row, row, main);
                if (!atEnd) continue;
                worstPosition = Math.max(worstPosition, Math.hypot(forked.x - main.x, forked.y - main.y));
                worstSlope = Math.max(worstSlope, Math.hypot(forked.dxdv - main.dxdv, forked.dydv - main.dydv));
              }
              // Inside the support the branch really leaves the main line.
              evaluateCanyonPose(model, withFork, wrapArc(fork.startM + fork.lengthM / 2), 3.5, phase, row, row, forked);
              evaluateCanyonPose(model, withoutFork, wrapArc(fork.startM + fork.lengthM / 2), 3.5, phase, row, row, main);
              expect(Math.hypot(forked.x - main.x, forked.y - main.y)).toBeGreaterThan(30);
              expect(forked.branchWeight).toBeGreaterThan(0.5);
            }
          }
        }
      }
    }
    // The table bakes main + envelope x offset, and the envelope is zero at both ends, so the
    // branch rows equal the main row there to float32 precision.
    expect(worstPosition).toBeLessThan(1e-4);
    expect(worstSlope).toBeLessThan(1e-6);
  });

  it('crosses every branch, course change and lap seam with bounded acceleration, both ways in time', () => {
    const dt = 1 / 240;
    const a = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    const samples: { x: number; y: number; z: number }[] = [];
    let worstJerkM = 0;
    let events = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      const attrs = deriveImpostorAttributes(seed, 4000);
      const report = newImpostorFlowReport();
      const seenPaths = new Set<number>();
      for (let i = 0; i < attrs.count; i += 1) {
        const flow = impostorFlow(attrs, i, 0, report);
        if (flow.kind === 'ring' || flow.path >= FORK_STREAM_COUNT) continue;
        // One forking car and one hopping car per stream is enough: the geometry is per stream.
        const key = flow.path * 2 + (flow.route.hop ? 1 : 0);
        if (seenPaths.has(key)) continue;
        seenPaths.add(key);
        const arc0 = flow.traits.arc * L;
        const speed = flow.effectiveCruiseMps;
        const targets: number[] = [0];
        for (let f = 0; f < model.forks[flow.path]!.length; f += 1) {
          if (((flow.route.forkBits >> f) & 1) === 0) continue;
          const fork = model.forks[flow.path]![f]!;
          targets.push(fork.startM, fork.startM + fork.rampM, fork.startM + fork.lengthM - fork.rampM, fork.startM + fork.lengthM);
        }
        if (flow.route.hop) targets.push(flow.route.hopStartM, flow.route.hopStartM + flow.route.hopRampM);
        for (const target of targets) {
          // No surge any more, so the time a car reaches an arc is exact, not a solve.
          for (const lap of [-2, 0, 1, 4]) {
            const t0 = (wrapArc(target) + lap * L - arc0) / (flow.direction * speed);
            events += 1;
            samples.length = 0;
            for (let j = -4; j <= 4; j += 1) {
              impostorPosition(attrs, i, t0 + j * dt, a);
              samples.push({ x: a.x, y: a.y, z: a.z });
            }
            for (let j = 1; j + 1 < samples.length; j += 1) {
              const p0 = samples[j - 1]!;
              const p1 = samples[j]!;
              const p2 = samples[j + 1]!;
              // Second difference: a position or slope break shows up here as metres per frame.
              worstJerkM = Math.max(worstJerkM, Math.hypot(
                p2.x - 2 * p1.x + p0.x,
                p2.y - 2 * p1.y + p0.y,
                p2.z - 2 * p1.z + p0.z,
              ));
            }
          }
        }
      }
    }
    expect(events).toBeGreaterThan(200);
    // A teleport would be tens of metres. What is left is the canyon's own curvature, the 8 m table
    // interpolation nodes, and the corridor guard where a stream's meander already reaches it.
    expect(worstJerkM).toBeLessThan(0.05);
  });
});

describe('R21 course changes', () => {
  it('completes exactly one stream change per lap and joins across the lap seam', () => {
    const pose = newCanyonPose();
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
        const hop = model.hops[k]!;
        const flow = syntheticFlow(model, k, 0, hop.b, 0.31, 0.44, 100);
        const direction = STREAM_DESCRIPTORS[k]!.direction;
        // Five laps of arc, stepped finely enough to catch the whole ramp.
        const step = 4;
        let crossings = 0;
        let previous = Number.NaN;
        let lastWeight = Number.NaN;
        let worstWeightStep = 0;
        for (let n = 0; n < (5 * L) / step; n += 1) {
          const arc = direction * n * step;
          evaluateCanyonPose(model, flow, arc, n * 0.01, 0.31, 0.44, 0.44, pose);
          const w = pose.hopWeight;
          expect(w).toBeGreaterThanOrEqual(-1e-12);
          expect(w).toBeLessThanOrEqual(1 + 1e-12);
          if (Number.isFinite(previous)) {
            worstWeightStep = Math.max(worstWeightStep, Math.abs(w - previous));
            const settledBefore = previous < 0.001 || previous > 0.999;
            const settledNow = w < 0.001 || w > 0.999;
            if (settledBefore && settledNow && Math.abs(w - previous) > 0.5) crossings += 1;
          }
          previous = w;
          lastWeight = w;
        }
        // The weight never steps: the ramp is the only place it moves.
        expect(worstWeightStep).toBeLessThan(0.02);
        expect(crossings).toBe(0);
        expect(Number.isFinite(lastWeight)).toBe(true);
        // Count completed transitions instead: one per lap, alternating A -> B then B -> A.
        let transitions = 0;
        for (let lap = -2; lap < 2; lap += 1) {
          // Indexed by arc, not by travel order: a backward stream visits the same laps in reverse.
          const before = lap * L + hop.startM - 1;
          const after = lap * L + hop.startM + hop.rampM + 1;
          evaluateCanyonPose(model, flow, before, 0, 0.31, 0.44, 0.44, pose);
          const w0 = pose.hopWeight;
          evaluateCanyonPose(model, flow, after, 0, 0.31, 0.44, 0.44, pose);
          const w1 = pose.hopWeight;
          expect(Math.min(w0, 1 - w0)).toBeLessThan(0.001);
          expect(Math.min(w1, 1 - w1)).toBeLessThan(0.001);
          if (Math.abs(w1 - w0) > 0.5) transitions += 1;
        }
        expect(transitions).toBe(4);
      }
    }
  });

  it('holds position, speed and route continuous through a course change and at the seam', () => {
    const dt = 1 / 240;
    const a = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    const b = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    const before = newImpostorFlowReport();
    const after = newImpostorFlowReport();
    let hoppers = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const attrs = deriveImpostorAttributes(seed, 4000);
      const report = newImpostorFlowReport();
      for (let i = 0; i < attrs.count; i += 1) {
        const flow = impostorFlow(attrs, i, 0, report);
        if (!flow.route.hop) continue;
        hoppers += 1;
        if (hoppers > 40) break;
        const arc0 = flow.traits.arc * L;
        const speed = flow.effectiveCruiseMps;
        for (const lap of [-1, 0, 1, 2]) {
          // The lap seam, where the ramp weight and the lap parity flip together.
          const seam = (lap * L - arc0) / (flow.direction * speed);
          impostorPosition(attrs, i, seam - dt, a);
          impostorPosition(attrs, i, seam + dt, b);
          const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
          expect(step).toBeLessThan(2 * speed * dt * 1.4);
          // The speed is the same on both sides of the change: one cruise sample owns the lap.
          const lowFlow = impostorFlow(attrs, i, seam - dt, before);
          const highFlow = impostorFlow(attrs, i, seam + dt, after);
          expect(lowFlow.effectiveCruiseMps).toBe(highFlow.effectiveCruiseMps);
          expect(lowFlow.route.bakedRowA).toBe(highFlow.route.bakedRowA);
          expect(lowFlow.route.bakedRowB).toBe(highFlow.route.bakedRowB);
        }
      }
    }
    expect(hoppers).toBeGreaterThan(20);
  });

  it('gives low tier no hops and medium and high 10-20% of their stream cars', () => {
    expect(HOP_COHORT_BOUNDS).toEqual([600, 1200]);
    for (const seed of HELD_OUT_SEEDS) {
      const low = trafficHopCensus(seed, 600);
      const medium = trafficHopCensus(seed, 1200);
      const high = trafficHopCensus(seed, 2400);
      // The low tier's 600 cars keep fixed trajectories, so nothing can snap at a tier switch.
      expect(low.hopCars).toBe(0);
      expect(low.streamCars).toBeGreaterThan(400);
      for (const tier of [medium, high]) {
        expect(tier.share).toBeGreaterThan(0.1);
        expect(tier.share).toBeLessThan(0.2);
      }
      // A larger tier is a superset: every smaller tier's hop set is a prefix of it.
      expect(high.hopCars).toBeGreaterThan(medium.hopCars);
      expect(high.streamCars).toBeGreaterThan(medium.streamCars);
    }
  });

  it('keeps a car\'s role, route and speed independent of the tier it is drawn in', () => {
    const plan: CarPlan = { role: 'free', stream: 255 };
    const other: CarPlan = { role: 'free', stream: 255 };
    for (const seed of HELD_OUT_SEEDS) {
      for (let car = 0; car < 2400; car += 1) {
        carTrafficPlan(seed, car, plan);
        carTrafficPlan(seed, car, other);
        expect(other.role).toBe(plan.role);
        expect(other.stream).toBe(plan.stream);
      }
      // GPU attributes for a smaller count are a prefix of a larger one.
      const big = deriveImpostorAttributes(seed, 4000);
      const small = deriveImpostorAttributes(seed, 900);
      expect(Array.from(small.streamArcPhaseSeed)).toEqual(Array.from(big.streamArcPhaseSeed.slice(0, 3600)));
      expect(Array.from(small.row)).toEqual(Array.from(big.row.slice(0, 900)));
      expect(Array.from(small.flow)).toEqual(Array.from(big.flow.slice(0, 3600)));
      expect(Array.from(small.route)).toEqual(Array.from(big.route.slice(0, 3600)));
      expect(small.seed).toBe(seed);
    }
  });
});

describe('R21 clearance', () => {
  it('keeps the whole model inside the corridor and clear of every drawn mass at 8 m spacing', () => {
    const warp: WarpOut = { x: 0, z: 0, heading: 0 };
    const sample = { cx: 0, cy: 0, sx: 0, sy: 0 };
    let worstCorridorM = 0;
    let minGapM = Infinity;
    let points = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      const field = createMassField(presentCityLayout(deriveCityLayout(seed)));
      /** Every lateral and vertical extreme a car on this path can reach. */
      const probe = (path: number, row: number, cx: number, cy: number): void => {
        const st = STREAM_DESCRIPTORS[path]!;
        const spacing = st.widthM / Math.max(1, st.rows - 1);
        // Sub-row structure or the merge re-scatter, the jitter, the pass offset and the micro bob.
        const lateral = Math.max(st.widthM * 0.5 + spacing * 0.3, st.widthM * 0.5) + STREAM_PASS_MAX_M + 3;
        const vertical = 3 + 3 + 2;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const x = cx + sx * lateral;
            worstCorridorM = Math.max(worstCorridorM, Math.abs(x) - STREAM_CORRIDOR_HALF_M);
            const guarded = Math.max(-STREAM_CORRIDOR_HALF_M, Math.min(STREAM_CORRIDOR_HALF_M, x));
            warpCanyon(guarded, row, warp);
            minGapM = Math.min(minGapM, field.gap(warp.x, cy + sy * vertical, warp.z));
            points += 1;
          }
        }
      };
      // Every baked canyon row: 8 streams x 4 variants, then the 6 GPU-only lanes.
      for (let tableRow = 0; tableRow < WARP_ROW; tableRow += 1) {
        const path = pathOfBakedRow(tableRow);
        for (let i = 0; i <= STREAM_PATH_SAMPLES; i += 1) {
          const v = i * STREAM_PATH_STEP_M;
          sampleStreamPath(model.table, tableRow, i, sample);
          probe(path, v, sample.cx, sample.cy);
        }
      }
      // Every course-change envelope: the blend is convex, so its extremes are the two ends, but
      // sweep the interior anyway because each end carries its own row structure.
      const poseA = { cx: 0, cy: 0, sx: 0, sy: 0 };
      const poseB = { cx: 0, cy: 0, sx: 0, sy: 0 };
      for (const hop of model.hops) {
        for (let bits = 0; bits < STREAM_VARIANTS; bits += 1) {
          for (let d = 0; d <= hop.rampM; d += STREAM_PATH_STEP_M) {
            const v = wrapArc(hop.startM + d);
            sampleStreamPath(model.table, bakedPathRow(hop.a, bits), v / STREAM_PATH_STEP_M, poseA);
            sampleStreamPath(model.table, bakedPathRow(hop.b, bits), v / STREAM_PATH_STEP_M, poseB);
            for (let s = 0; s <= 10; s += 1) {
              const w = s / 10;
              probe(hop.a, v, poseA.cx + (poseB.cx - poseA.cx) * w, poseA.cy + (poseB.cy - poseA.cy) * w);
              probe(hop.b, v, poseA.cx + (poseB.cx - poseA.cx) * w, poseA.cy + (poseB.cy - poseA.cy) * w);
            }
          }
        }
      }
    }
    expect(points).toBeGreaterThan(900000);
    // The corridor guard is the last defence; the model does not rely on it for the row envelope.
    expect(worstCorridorM).toBeLessThan(120);
    expect(minGapM).toBeGreaterThan(HULL_RADIUS_M);
  });
});

describe('R21 stated limits', () => {
  it('holds the course-change climb and the world-speed spike inside the reported bounds', () => {
    const a = { cx: 0, cy: 0, sx: 0, sy: 0 };
    const b = { cx: 0, cy: 0, sx: 0, sy: 0 };
    let worstSlope = 0;
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      for (const hop of model.hops) {
        for (let bits = 0; bits < STREAM_VARIANTS; bits += 1) {
          let worstDelta = 0;
          for (let d = 0; d <= hop.rampM; d += STREAM_PATH_STEP_M) {
            const f = wrapArc(hop.startM + d) / STREAM_PATH_STEP_M;
            sampleStreamPath(model.table, bakedPathRow(hop.a, bits), f, a);
            sampleStreamPath(model.table, bakedPathRow(hop.b, bits), f, b);
            worstDelta = Math.max(worstDelta, Math.hypot(b.cx - a.cx, b.cy - a.cy));
          }
          // The quintic's peak derivative is 15/8, so this is the steepest the ramp can get.
          worstSlope = Math.max(worstSlope, (worstDelta * 1.875) / hop.rampM);
        }
      }
    }
    // The ramp length is fixed at 600-900 m by the contract and the shelf separation is fixed by
    // R11, so this is the steepest climb the model can produce. It is reported, not hidden.
    expect(worstSlope).toBeLessThan(2);
    expect(worstSlope).toBeGreaterThan(0.5);
  });

  it('never makes the corridor guard work harder on a branch than on the main line', () => {
    const sample = { cx: 0, cy: 0, sx: 0, sy: 0 };
    for (const seed of HELD_OUT_SEEDS) {
      const model = renderTrafficModel(seed);
      for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
        const st = STREAM_DESCRIPTORS[k]!;
        const spacing = st.widthM / Math.max(1, st.rows - 1);
        const reach = Math.max(st.widthM * 0.5 + spacing * 0.3, st.widthM * 0.5) + STREAM_PASS_MAX_M + 3;
        const excess = (bits: number): { samples: number; worst: number } => {
          let samples = 0;
          let worst = 0;
          for (let i = 0; i <= STREAM_PATH_SAMPLES; i += 1) {
            sampleStreamPath(model.table, bakedPathRow(k, bits), i, sample);
            for (const sgn of [-1, 1]) {
              const over = Math.abs(sample.cx + sgn * reach) - STREAM_CORRIDOR_HALF_M;
              if (over > 0) { samples += 1; worst = Math.max(worst, over); }
            }
          }
          return { samples, worst };
        };
        const main = excess(0);
        for (let bits = 1; bits < STREAM_VARIANTS; bits += 1) {
          const branch = excess(bits);
          // The branch lateral sign points inward, so a branch can only reduce guard activity.
          expect(branch.samples).toBeLessThanOrEqual(main.samples);
          expect(branch.worst).toBeLessThanOrEqual(main.worst + 1e-6);
        }
      }
    }
  });
});

describe('R21 shared sampling and shader contract', () => {
  it('samples the baked table by the same rule on the CPU and in the shader', () => {
    const model = renderTrafficModel(HELD_OUT_SEEDS[3]!);
    const sample = { cx: 0, cy: 0, sx: 0, sy: 0 };
    const warp = { x: 0, z: 0, cos: 0, sin: 0 };
    /** The shader's pathAt(), transcribed from IMPOSTOR_VERTEX_GLSL. */
    const pathAt = (row: number, f: number): number[] => {
      const i0 = Math.min(Math.floor(f), STREAM_PATH_SAMPLES - 1);
      const fr = f - i0;
      const out: number[] = [];
      for (let c = 0; c < 4; c += 1) {
        const a = model.table.data[(row * model.table.width + i0) * 4 + c]!;
        const b = model.table.data[(row * model.table.width + i0 + 1) * 4 + c]!;
        out.push(a + (b - a) * fr);
      }
      return out;
    };
    for (let row = 0; row < WARP_ROW; row += 1) {
      for (const v of [0, 3.5, 8, 11.25, 4000.5, L - 0.5, L - STREAM_PATH_STEP_M]) {
        const f = v / STREAM_PATH_STEP_M;
        const shader = pathAt(row, f);
        sampleStreamPath(model.table, row, f, sample);
        expect(sample.cx).toBe(shader[0]);
        expect(sample.cy).toBe(shader[1]);
        expect(sample.sx).toBe(shader[2]);
        expect(sample.sy).toBe(shader[3]);
      }
    }
    for (const v of [0, 3.5, 8, 11.25, 4000.5, L - 0.5]) {
      const shader = pathAt(WARP_ROW, v / STREAM_PATH_STEP_M);
      sampleWarpRow(model.table, v / STREAM_PATH_STEP_M, warp);
      const length = Math.hypot(shader[2]!, shader[3]!);
      expect(warp.x).toBe(shader[0]);
      expect(warp.z).toBe(shader[1]);
      expect(warp.cos).toBeCloseTo(shader[2]! / length, 12);
      expect(warp.sin).toBeCloseTo(shader[3]! / length, 12);
    }
  });

  it('exposes one position capture anchor with the canyon progress variable in scope', () => {
    const source = IMPOSTOR_VERTEX_GLSL;
    expect(source.split(IMPOSTOR_POSITION_ANCHOR_GLSL).length).toBe(2);
    expect(IMPOSTOR_CANYON_ARC_GLSL).toBe('canyonArcM');
    // Declared at function scope before both position branches, so a transform-feedback probe can
    // read it at the anchor, and assigned on both branches.
    const declaration = source.indexOf(`float ${IMPOSTOR_CANYON_ARC_GLSL} = 0.0;`);
    const anchor = source.indexOf(IMPOSTOR_POSITION_ANCHOR_GLSL);
    expect(declaration).toBeGreaterThan(0);
    expect(declaration).toBeLessThan(anchor);
    expect(source.indexOf('ringPose( k - NSTREAMS, pos, dir, canyonArcM )')).toBeGreaterThan(declaration);
    expect(source.indexOf('canyonArcM = q;')).toBeGreaterThan(declaration);
    expect(source.indexOf('canyonArcM = q;')).toBeLessThan(anchor);
    // The R18 surge and the nominal-speed formula are gone, so a probe cannot read stale metadata.
    expect(source).not.toContain('st.y * ( 0.9 + 0.2 * row )');
    expect(source).toContain('float speed = aFlow.y;');
    // The attributes the model ships, and no extra draw: one quad per impostor as before.
    expect(source).toContain('attribute vec4 aFlow;');
    expect(source).toContain('attribute vec4 aRoute;');
    expect(source).not.toContain('aImpRow');
  });

  it('matches the shader ramp algebra on the CPU', () => {
    // The GLSL quintic is the same polynomial, so a branch profile is identical on both sides.
    expect(IMPOSTOR_VERTEX_GLSL).toContain('return c * c * c * ( 10.0 - 15.0 * c + 6.0 * c * c );');
    expect(IMPOSTOR_VERTEX_GLSL).toContain('return 30.0 * u * u * k * k;');
    for (const u of [-0.5, 0, 0.001, 0.25, 0.5, 0.75, 0.999, 1, 1.5]) {
      const c = Math.min(1, Math.max(0, u));
      expect(quintic(u)).toBeCloseTo(c * c * c * (10 - 15 * c + 6 * c * c), 12);
    }
    expect(quintic(0)).toBe(0);
    expect(quintic(1)).toBe(1);
    // A 1200 m support with two 600 m ramps peaks at 1 exactly once and ends at zero.
    expect(forkBump(0, 1200, 600)).toBe(0);
    expect(forkBump(600, 1200, 600)).toBeCloseTo(1, 12);
    expect(forkBump(1200, 1200, 600)).toBe(0);
    expect(forkBump(1300, 1200, 600)).toBe(0);
    expect(forkBump(750, 1500, 600)).toBeCloseTo(1, 12);
  });
});
