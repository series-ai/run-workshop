import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { decodeCityGraph } from '../src/render/citySnapshotCodec';
import { deriveSignMountSolids, installCitySnapshot, type SkyriverSignSolid } from '../src/render/city';
import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import {
  IMPOSTOR_PATHS, IMPOSTOR_RINGS, STREAM_DESCRIPTORS, STREAM_PATH_SAMPLES,
  STREAM_PATH_STEP_M, STREAM_VARIANTS, WARP_ROW, bakedPathRow,
  deriveImpostorAttributes, impostorPosition, pathOfBakedRow, renderTrafficModel,
  sampleStreamPath, sampleWarpRow, wrapArc, type RenderTrafficModel,
} from '../src/render/trafficStreams';

const SEEDS = [424242, 0, 2147483647, 4294967295] as const;
const GAME = join(__dirname, '..');
// Keep the existing trafficNetwork hull clearance limit.
const HULL_MARGIN_M = 8;
const CELL_M = 400;

interface Bounds {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}
interface Solid extends Bounds {
  readonly host: SkyriverSignSolid['host'];
  readonly footprint: SkyriverSignSolid['footprint'];
}
interface Probe { readonly kind: 'baked' | 'hop'; readonly row: number; readonly arcM: number; }
interface Hit extends Probe { readonly host: Solid['host']; readonly envelope: Bounds; readonly solid: Bounds; }

const sources = Object.fromEntries(['city.ts', 'trafficStreams.ts', 'canyonWarp.ts'].map(name => [name,
  createHash('sha256').update(readFileSync(join(GAME, 'src/render', name))).digest('hex')]));

function receipt(name: string, value: Readonly<Record<string, unknown>>): void {
  const directory = process.env.R42_RECEIPT_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name + '.json'), JSON.stringify({ sources, ...value }, null, 2) + '\n');
}

function drawnSolids(seed: number): readonly Solid[] {
  const layout = presentCityLayout(deriveCityLayout(seed));
  if (seed === 424242) {
    const envelope: unknown = JSON.parse(gunzipSync(readFileSync(join(GAME,
      'src/data/node/city-snapshot-424242.json.gz'))).toString());
    if (typeof envelope !== 'object' || envelope === null
      || Object.getPrototypeOf(envelope) !== Object.prototype
      || !Object.prototype.hasOwnProperty.call(envelope, 'payload')
      || !('payload' in envelope)) {
      throw new Error('R42_INVALID_SNAPSHOT_ENVELOPE');
    }
    installCitySnapshot(layout, decodeCityGraph(envelope.payload));
  }
  // This API uses draw exclusions and the production matrices rounded to Float32.
  // The oracle only uses the resulting corners. It does not use source collision code.
  return deriveSignMountSolids(layout).map(solid => ({ host: solid.host, footprint: solid.footprint,
    x0: Math.min(...solid.footprint.map(point => point[0])),
    x1: Math.max(...solid.footprint.map(point => point[0])),
    y0: solid.y0, y1: solid.y1,
    z0: Math.min(...solid.footprint.map(point => point[1])),
    z1: Math.max(...solid.footprint.map(point => point[1])),
  }));
}

function union(a: Bounds, b: Bounds): Bounds {
  return { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1),
    z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) };
}

function expanded(a: Bounds, margin: number): Bounds {
  return { x0: a.x0 - margin, x1: a.x1 + margin,
    y0: a.y0 - margin, y1: a.y1 + margin,
    z0: a.z0 - margin, z1: a.z1 + margin };
}

function positiveOverlap(a: Bounds, b: Bounds): boolean {
  return Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0)
    && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0)
    && Math.min(a.z1, b.z1) > Math.max(a.z0, b.z0);
}

function centreInsidePhysicalSolid(solid: Solid, point: { x: number; y: number; z: number }): boolean {
  if (!(point.y > solid.y0 && point.y < solid.y1)) return false;
  return solid.footprint.every((a, index) => {
    const b = solid.footprint[(index + 1) % solid.footprint.length]!;
    return (b[0] - a[0]) * (point.z - a[1]) - (b[1] - a[1]) * (point.x - a[0]) > 0;
  });
}

function solidGrid(solids: readonly Solid[]): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  solids.forEach((solid, index) => {
    for (let x = Math.floor(solid.x0 / CELL_M); x <= Math.floor(solid.x1 / CELL_M); x += 1) {
      for (let z = Math.floor(solid.z0 / CELL_M); z <= Math.floor(solid.z1 / CELL_M); z += 1) {
        const key = `${x}:${z}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(index);
      }
    }
  });
  return grid;
}

function nearby(grid: Map<string, number[]>, bounds: Bounds): readonly number[] {
  const indices = new Set<number>();
  for (let x = Math.floor(bounds.x0 / CELL_M); x <= Math.floor(bounds.x1 / CELL_M); x += 1) {
    for (let z = Math.floor(bounds.z0 / CELL_M); z <= Math.floor(bounds.z1 / CELL_M); z += 1) {
      for (const index of grid.get(`${x}:${z}`) ?? []) indices.add(index);
    }
  }
  return [...indices];
}

function pathEnvelope(model: RenderTrafficModel, row: number, arcM: number): Bounds {
  const centre = { cx: 0, cy: 0, sx: 0, sy: 0 };
  const warp = { x: 0, z: 0, cos: 0, sin: 0 };
  const f = wrapArc(arcM) / STREAM_PATH_STEP_M;
  sampleStreamPath(model.table, row, f, centre);
  sampleWarpRow(model.table, f, warp);
  const stream = STREAM_DESCRIPTORS[pathOfBakedRow(row)]!;
  const spacing = stream.widthM / Math.max(1, stream.rows - 1);
  // Full sub-row and re-scatter range, seeded jitter, passing and drift.
  const lateral = Math.max(stream.widthM / 2 + spacing * 0.3, stream.widthM / 2) + 12 + 3;
  const lo = Math.max(-340, Math.min(340, centre.cx - lateral));
  const hi = Math.max(-340, Math.min(340, centre.cx + lateral));
  const x = [warp.x + lo * warp.cos, warp.x + hi * warp.cos];
  const z = [warp.z - lo * warp.sin, warp.z - hi * warp.sin];
  return { x0: Math.min(...x), x1: Math.max(...x),
    y0: centre.cy - 8, y1: centre.cy + 8,
    z0: Math.min(...z), z1: Math.max(...z) };
}

function clearanceAudit(seed: number) {
  const solids = drawnSolids(seed), model = renderTrafficModel(seed), grid = solidGrid(solids);
  let probes = 0, hitCount = 0;
  const hits: Hit[] = [];
  const check = (envelope: Bounds, probe: Probe): void => {
    probes += 1;
    const full = expanded(envelope, HULL_MARGIN_M);
    for (const index of nearby(grid, full)) {
      const solid = solids[index]!;
      if (!positiveOverlap(full, solid)) continue;
      hitCount += 1;
      if (hits.length < 200) hits.push({ ...probe, host: solid.host, envelope: full, solid });
    }
  };
  for (let row = 0; row < WARP_ROW; row += 1) {
    for (let sample = 0; sample <= STREAM_PATH_SAMPLES; sample += 1) {
      const arcM = sample * STREAM_PATH_STEP_M;
      check(pathEnvelope(model, row, arcM), { kind: 'baked', row, arcM });
    }
  }
  for (const hop of model.hops) {
    for (let bits = 0; bits < STREAM_VARIANTS; bits += 1) {
      const from = bakedPathRow(hop.a, bits), to = bakedPathRow(hop.b, bits);
      for (let d = 0; d < hop.rampM; d += STREAM_PATH_STEP_M) {
        const arcM = wrapArc(hop.startM + d);
        // A union AABB includes all interpolation weights, not only selected weights.
        check(union(pathEnvelope(model, from, arcM), pathEnvelope(model, to, arcM)),
          { kind: 'hop', row: from, arcM });
      }
      const arcM = wrapArc(hop.startM + hop.rampM);
      check(union(pathEnvelope(model, from, arcM), pathEnvelope(model, to, arcM)),
        { kind: 'hop', row: from, arcM });
    }
  }
  return { seed, stepM: STREAM_PATH_STEP_M, marginM: HULL_MARGIN_M,
    scope: 'Full conservative envelope at table resolution. AABBs include empty space outside turned boxes. No swept-segment, GPU, visibility or pop claim.',
    solidCount: solids.length, massCount: solids.filter(solid => solid.host.kind === 'mass').length,
    trimCount: solids.filter(solid => solid.host.kind === 'trim').length,
    probes, hitCount, hitSampleLimit: 200, hits };
}

describe('R42 independent full drawn-solid path clearance', () => {
  it.each(SEEDS)('clears full stream, lane, fork and hop envelopes for seed %i', seed => {
    const audit = clearanceAudit(seed);
    receipt(`paths-${seed}`, audit);
    expect(audit.massCount).toBeGreaterThan(0);
    expect(audit.trimCount).toBeGreaterThan(0);
    expect(audit.probes).toBeGreaterThan(60000);
    expect(audit.hitCount, JSON.stringify(audit.hits.slice(0, 3))).toBe(0);
  }, 60000);

  it.each(SEEDS)('keeps every ring floor above all drawn solids for seed %i', seed => {
    const solids = drawnSolids(seed);
    const cityTop = Math.max(...solids.map(solid => solid.y1));
    const ringFloors = IMPOSTOR_RINGS.map(ring => {
      const spacing = ring[4]! / Math.max(1, ring[3]! - 1);
      return ring[1]! - ring[7]! - 12 - 15 - 6 - (ring[4]! / 2 + spacing * 0.3);
    });
    const minimumFloor = Math.min(...ringFloors);
    receipt(`rings-${seed}`, { seed, cityTop, ringFloors, minimumFloor, marginM: HULL_MARGIN_M });
    expect(minimumFloor - HULL_MARGIN_M).toBeGreaterThan(cityTop);
  }, 60000);

  it('rejects real moved-solid penetration and accepts exact margin contact', () => {
    const model = renderTrafficModel(424242), solids = drawnSolids(424242);
    const envelope = expanded(pathEnvelope(model, 0, 1000), HULL_MARGIN_M);
    const original = solids.find(solid => solid.host.kind === 'trim')!;
    const dy = original.y1 - original.y0, dz = original.z1 - original.z0;
    const contact = { ...original, x0: envelope.x1, x1: envelope.x1 + original.x1 - original.x0,
      y0: envelope.y0, y1: envelope.y0 + dy, z0: envelope.z0, z1: envelope.z0 + dz };
    const penetration = { ...contact, x0: contact.x0 - 0.25, x1: contact.x1 - 0.25 };
    expect(positiveOverlap(envelope, contact)).toBe(false);
    expect(positiveOverlap(envelope, penetration)).toBe(true);
    receipt('fault-controls', { host: original.host, contact, penetration, envelope,
      exactContactAccepted: !positiveOverlap(envelope, contact), penetrationRejected: positiveOverlap(envelope, penetration) });
  });

  it('checks actual seeded lane cars near the held baseline arc', () => {
    const seed = 424242, model = renderTrafficModel(seed), solids = drawnSolids(seed), grid = solidGrid(solids);
    const attrs = deriveImpostorAttributes(seed, 20000, model);
    const pose = { x: 0, y: 0, z: 0, dx: 0, dz: 0, dy: 0 };
    let samples = 0, hitCount = 0, physicalCentrePenetrations = 0;
    const hits: unknown[] = [];
    const physicalCentreWitnesses: unknown[] = [];
    for (let car = 0; car < attrs.count; car += 1) {
      const path = attrs.streamArcPhaseSeed[car * 4]!;
      if (path !== 8) continue;
      const arc0 = attrs.streamArcPhaseSeed[car * 4 + 1]! * CANYON_LOOP_LENGTH_M;
      const speed = attrs.flow[car * 4 + 1]!, direction = IMPOSTOR_PATHS[path]![2]!;
      for (let lap = 0; lap < 3; lap += 1) {
        for (let arcM = 11448; arcM <= 11576; arcM += 4) {
          const timeS = (arcM + direction * lap * CANYON_LOOP_LENGTH_M - arc0) / (direction * speed);
          if (timeS < 0) continue;
          impostorPosition(attrs, car, timeS, pose);
          samples += 1;
          const bounds = expanded({ x0: pose.x, x1: pose.x, y0: pose.y, y1: pose.y, z0: pose.z, z1: pose.z }, HULL_MARGIN_M);
          for (const index of nearby(grid, bounds)) {
            const solid = solids[index]!;
            if (!positiveOverlap(bounds, solid)) continue;
            hitCount += 1;
            const witness = { car, path, timeS, arcM, lap, position: { ...pose },
              attributes: { aImp: Array.from(attrs.streamArcPhaseSeed.slice(car * 4, car * 4 + 4)),
                aFlow: Array.from(attrs.flow.slice(car * 4, car * 4 + 4)), row: attrs.row[car] },
              host: solid.host, bounds, solid };
            if (hits.length < 100) hits.push(witness);
            // This diagnostic uses the physical polygon, not its conservative AABB.
            if (centreInsidePhysicalSolid(solid, pose)) {
              physicalCentrePenetrations += 1;
              if (physicalCentreWitnesses.length < 10) physicalCentreWitnesses.push(witness);
            }
          }
        }
      }
    }
    receipt('spawned-lane-witnesses', { seed, samples, hitCount, hitSampleLimit: 100, hits,
      physicalCentrePenetrations, physicalCentreWitnesses,
      scope: 'Actual seeded positions and 8 m margin versus full drawn AABBs. No GPU visibility or physical lamp-volume claim.' });
    expect(samples).toBeGreaterThan(1000);
    expect(hitCount, JSON.stringify(hits.slice(0, 3))).toBe(0);
  }, 60000);
});
