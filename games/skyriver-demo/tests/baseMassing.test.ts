/**
 * @file baseMassing.test.ts — R27 low-city base sprawl independent contracts:
 * validates asymmetric skirts, lower infill subgrids, covered links, equipment,
 * corridor boundaries, and trim caps against real derived models across full-loop seeds.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { deriveCityLayout, type SkyriverTower } from '../src/sim/derive';
import {
  buildingSeedOf,
  deriveCityMasses,
  deriveCityTrims,
  deriveFacadeFaces,
  deriveFarTowers,
  deriveHeroBlades,
  deriveNeonSigns,
  isLowBaseMass,
  warpRigid,
  SKYRIVER_CITY,
  type SkyriverMass,
  type SkyriverLowBaseKind,
} from '../src/render/city';
import { presentCityLayout } from '../src/render/presentationLayout';
import r29Baseline from './fixtures/r29-city-baseline.json';
import r35Baseline from './fixtures/r35-roof-baseline.json';

const DEMO_SEED = 424242;
const TEST_SEEDS = [DEMO_SEED, 0, 2147483647, 4294967295] as const;

interface PlacedBox {
  readonly cx: number;
  readonly cz: number;
  readonly y0: number;
  readonly y1: number;
  readonly c: number;
  readonly s: number;
  readonly hx: number;
  readonly hz: number;
  readonly reach: number;
  readonly mass: SkyriverMass;
}

function placeBox(mass: SkyriverMass): PlacedBox {
  const boxWarp = { x: 0, z: 0, heading: 0 };
  warpRigid(mass.x, mass.z, mass.anchorV !== undefined ? mass.anchorV : mass.z, boxWarp);
  return {
    cx: boxWarp.x,
    cz: boxWarp.z,
    y0: mass.y0,
    y1: mass.y0 + mass.height,
    c: Math.cos(boxWarp.heading),
    s: Math.sin(boxWarp.heading),
    hx: mass.width * 0.5,
    hz: mass.depth * 0.5,
    reach: Math.hypot(mass.width, mass.depth) * 0.5,
    mass,
  };
}

function boxContainsPoint(b: PlacedBox, x: number, y: number, z: number, tolerance = 0.01): boolean {
  if (y < b.y0 - tolerance || y > b.y1 + tolerance) return false;
  const dx = x - b.cx;
  const dz = z - b.cz;
  const lx = Math.abs(dx * b.c - dz * b.s);
  const lz = Math.abs(dx * b.s + dz * b.c);
  return lx <= b.hx + tolerance && lz <= b.hz + tolerance;
}

function towerKey(tower: SkyriverTower): string {
  return `${tower.x.toFixed(2)}:${tower.z.toFixed(2)}`;
}

function sha256(data: unknown): string {
  // Material identity is checked separately. Keep all geometry and random results in this hash.
  return createHash('sha256').update(JSON.stringify(data, (key, value) =>
    key === 'materialOwner' ? undefined : value)).digest('hex');
}

describe('R27 base sprawl: legacy preservation and trim capacity', () => {
  it.each(TEST_SEEDS)('preserves old layout, hero blades, signs, and trim budgets for seed %i', (seed) => {
    const raw = deriveCityLayout(seed);
    const layout = presentCityLayout(raw);
    const masses = deriveCityMasses(layout);
    const trims = deriveCityTrims(layout);
    const heroes = deriveHeroBlades(layout);
    const signs = deriveNeonSigns(layout);
    const faces = deriveFacadeFaces(layout);
    const far = deriveFarTowers(layout);

    // Old active arrays and objects remain valid and populated
    expect(raw.towers.length).toBe(88);
    expect(layout.towers.length).toBeGreaterThanOrEqual(208);
    expect(heroes.length).toBe(42);
    expect(signs.count).toBeGreaterThan(300);
    expect(far.length).toBeGreaterThanOrEqual(130);
    expect(faces.length).toBeGreaterThanOrEqual(400);

    // Legacy masses prefix preserved without loss
    const legacyMasses = masses.filter((m) => !isLowBaseMass(m));
    expect(legacyMasses.length).toBeGreaterThanOrEqual(5800);

    // No trim cap loss: trim count stays within maxTrims
    expect(trims.count).toBeLessThan(SKYRIVER_CITY.maxTrims);
    expect(trims.count).toBeGreaterThan(legacyMasses.length);
  });

  it.each(TEST_SEEDS)('keeps all original model and random results for seed %i', seed => {
    const raw = deriveCityLayout(seed), layout = presentCityLayout(raw);
    const actual = { raw, layout, masses: deriveCityMasses(layout), trims: deriveCityTrims(layout),
      faces: deriveFacadeFaces(layout), far: deriveFarTowers(layout), heroes: deriveHeroBlades(layout), signs: deriveNeonSigns(layout) };
    const before = r29Baseline.find(record => record.seed === seed)!;
    for (const key of Object.keys(actual) as (keyof typeof actual)[]) {
      if (key !== 'trims') expect(sha256(actual[key]), key).toBe(before.hashes[key]);
    }
    // R35 appends dark props. The independent committed oracle keeps every old active byte.
    const frozen = r35Baseline.seeds.find(record => record.seed === seed)!;
    for (const key of ['cx', 'cy', 'cz', 'sx', 'sy', 'sz', 'kind', 'seedValue'] as const) {
      const array = actual.trims[key].subarray(0, frozen.trimCount);
      expect(createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex'), key).toBe(frozen.activeTrimArrayHashes[key]);
    }
    const exactHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(exactHash(actual.trims.owner.slice(0, frozen.trimCount))).toBe(frozen.hashes.trimOwner);
    expect(exactHash(actual.trims.spanTo.slice(0, frozen.trimCount))).toBe(frozen.hashes.trimSpanTo);
    expect(actual.trims.count).toBeGreaterThanOrEqual(frozen.trimCount);
  });

  it('matches saved baseline hashes on the canonical demo seed', () => {
    const layout = presentCityLayout(deriveCityLayout(DEMO_SEED));
    const heroes = deriveHeroBlades(layout);
    const faces = deriveFacadeFaces(layout);
    const far = deriveFarTowers(layout);

    const before = r29Baseline.find(record => record.seed === DEMO_SEED)!;
    expect(sha256(heroes)).toBe(before.hashes.heroes);
    expect(sha256(faces)).toBe(before.hashes.faces);
    expect(sha256(far)).toBe(before.hashes.far);
  });
});

describe('R27 base sprawl: metadata, canonical ownership and material anchors', () => {
  it.each(TEST_SEEDS)('guarantees valid baseRecord metadata and canonical tower anchors for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const towerMap = new Map(layout.towers.map((t) => [towerKey(t), t]));
    const baseMasses = masses.filter(isLowBaseMass);

    expect(baseMasses.length).toBeGreaterThan(500);

    const allowedKinds = new Set<SkyriverLowBaseKind>(['skirt', 'infill', 'link', 'equipment']);

    for (const mass of baseMasses) {
      const record = mass.baseRecord;
      expect(allowedKinds.has(record.kind)).toBe(true);
      expect(record.cluster).toBeGreaterThanOrEqual(0);
      expect(record.cluster).toBeLessThanOrEqual(3);

      const owner = towerMap.get(record.towerOwner);
      expect(owner).toBeDefined();
      if (!owner) continue;

      // Rigid frame anchorV must equal original tower.z
      expect(mass.anchorV).toBeDefined();
      expect(Math.abs((mass.anchorV ?? 0) - owner.z)).toBeLessThan(1e-4);

      // Building and materialOwner must match canonical buildingSeedOf(owner.x, owner.z)
      const expectedSeed = buildingSeedOf(owner.x, owner.z);
      expect(Math.abs((mass.building ?? 0) - expectedSeed)).toBeLessThan(1e-5);
      expect(Math.abs((mass.materialOwner ?? 0) - expectedSeed)).toBeLessThan(1e-5);
    }
  });
});

describe('R27 base sprawl: positive finite geometry and corridor clearance', () => {
  it.each(TEST_SEEDS)('enforces positive finite dimensions and flight corridor bounds for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const baseMasses = masses.filter(isLowBaseMass);

    for (const mass of baseMasses) {
      expect(Number.isFinite(mass.x)).toBe(true);
      expect(Number.isFinite(mass.y0)).toBe(true);
      expect(Number.isFinite(mass.z)).toBe(true);
      expect(Number.isFinite(mass.width)).toBe(true);
      expect(Number.isFinite(mass.height)).toBe(true);
      expect(Number.isFinite(mass.depth)).toBe(true);

      expect(mass.width).toBeGreaterThan(0);
      expect(mass.height).toBeGreaterThan(0);
      expect(mass.depth).toBeGreaterThan(0);

      // Low base altitude contract: roofs stay well below upper crowns (< 160m)
      expect(mass.y0 + mass.height).toBeLessThan(160);

      // Corridor safety: outside |x| >= 372 (and >= 405 within free-flight |z| < 650)
      const innerFaceX = Math.abs(mass.x) - mass.width * 0.5;
      const requiredX = Math.abs(mass.z) < 650 ? 405 : 372;
      expect(innerFaceX).toBeGreaterThanOrEqual(requiredX - 1e-4);
    }
  });
});

describe('R27 base sprawl: tower skirts asymmetry, heights and overshoot', () => {
  it.each(TEST_SEEDS)('provides 2-5 asymmetric skirts per tower with distinct offsets and overshoot for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const skirts = masses.filter(isLowBaseMass).filter((m) => m.baseRecord.kind === 'skirt');

    const skirtsByTower = new Map<string, SkyriverMass[]>();
    for (const s of skirts) {
      const key = s.baseRecord.towerOwner;
      const list = skirtsByTower.get(key) ?? [];
      list.push(s);
      skirtsByTower.set(key, list);
    }

    // Every presented tower receives skirts
    expect(skirtsByTower.size).toBe(layout.towers.length);

    let totalSunkSkirts = 0;
    let towersWithUnevenHeights = 0;

    for (const tower of layout.towers) {
      const key = towerKey(tower);
      const towerSkirts = skirtsByTower.get(key) ?? [];

      // Contract: 2-5 skirts per eligible tower
      expect(towerSkirts.length).toBeGreaterThanOrEqual(2);
      expect(towerSkirts.length).toBeLessThanOrEqual(5);

      const heights = new Set<number>();
      const offsets = new Set<string>();
      let hasOvershoot = false;
      const tLeft = tower.x - tower.width * 0.5;
      const tRight = tower.x + tower.width * 0.5;
      const tBack = tower.z - tower.depth * 0.5;
      const tFront = tower.z + tower.depth * 0.5;

      for (const s of towerSkirts) {
        // Height 10-40m
        expect(s.height).toBeGreaterThanOrEqual(10);
        expect(s.height).toBeLessThanOrEqual(40);

        const sb = placeBox(s);
        const sinksIntoDeck = masses.some((old) => {
          if (isLowBaseMass(old)) return false;
          const top = old.y0 + old.height;
          if (top > 160 || top <= s.y0 || top >= s.y0 + s.height) return false;
          const ob = placeBox(old);
          for (const u of [-0.4, 0, 0.4]) {
            for (const v of [-0.4, 0, 0.4]) {
              const px = sb.cx + u * s.width * sb.c + v * s.depth * sb.s;
              const pz = sb.cz - u * s.width * sb.s + v * s.depth * sb.c;
              if (boxContainsPoint(ob, px, top - 0.01, pz)) return true;
            }
          }
          return false;
        });
        if (sinksIntoDeck) totalSunkSkirts += 1;
        // Never wholly buried (reaches above -50m into low deck altitude band)
        expect(s.y0 + s.height).toBeGreaterThan(-50);

        heights.add(Math.round(s.height * 10) / 10);
        offsets.add(`${s.x.toFixed(2)}:${s.z.toFixed(2)}`);

        // Overshoot beyond nominal tower footprint in at least one direction
        const sLeft = s.x - s.width * 0.5;
        const sRight = s.x + s.width * 0.5;
        const sBack = s.z - s.depth * 0.5;
        const sFront = s.z + s.depth * 0.5;
        if (sLeft < tLeft - 0.5 || sRight > tRight + 0.5 || sBack < tBack - 0.5 || sFront > tFront + 0.5) {
          hasOvershoot = true;
        }
      }

      // Distinct horizontal offsets around tower
      expect(offsets.size).toBeGreaterThanOrEqual(2);
      const uniqueBoxes = new Set(towerSkirts.map((s) => `${s.x.toFixed(2)}:${s.y0.toFixed(2)}:${s.z.toFixed(2)}:${s.width.toFixed(2)}:${s.height.toFixed(2)}:${s.depth.toFixed(2)}`));
      expect(uniqueBoxes.size).toBe(towerSkirts.length);
      // Real pitch overshoot actually present
      expect(hasOvershoot).toBe(true);
      if (heights.size > 1) towersWithUnevenHeights += 1;
    }

    // Uneven heights present across the layout (>= 15 distinct heights in city, > 95% of towers have uneven skirts)
    expect(new Set(skirts.map((s) => s.height)).size).toBeGreaterThanOrEqual(15);
    expect(towersWithUnevenHeights / layout.towers.length).toBeGreaterThan(0.95);

    // Some sunk character present in the distribution
    expect(totalSunkSkirts).toBeGreaterThan(0);
  });
});

describe('R27 base sprawl: lower infill subgrid clusters', () => {
  it.each(TEST_SEEDS)('spawns 4 offset infill subgrid patterns at low altitudes for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const infills = masses.filter(isLowBaseMass).filter((m) => m.baseRecord.kind === 'infill');

    expect(infills.length).toBeGreaterThan(layout.towers.length * 0.2);

    const clustersFound = new Set(infills.map((m) => m.baseRecord.cluster));
    expect(clustersFound.size).toBe(4);
    for (const c of [0, 1, 2, 3] as const) {
      expect(clustersFound.has(c)).toBe(true);
    }

    for (const inf of infills) {
      expect(inf.height).toBeGreaterThanOrEqual(10);
      expect(inf.height).toBeLessThanOrEqual(50);
      expect(inf.y0 + inf.height).toBeLessThan(160);
    }
  });
});

describe('R27 base sprawl: low-roof equipment and clutter support', () => {
  it.each(TEST_SEEDS)('places equipment and new trims strictly within real base roof footprints for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const baseMasses = masses.filter(isLowBaseMass);
    const equipments = baseMasses.filter((m) => m.baseRecord.kind === 'equipment');
    const roofs = baseMasses.filter((m) => m.baseRecord.kind === 'skirt' || m.baseRecord.kind === 'infill');

    expect(equipments.length).toBeGreaterThan(50);

    for (const eq of equipments) {
      const eqLeft = eq.x - eq.width * 0.5;
      const eqRight = eq.x + eq.width * 0.5;
      const eqBack = eq.z - eq.depth * 0.5;
      const eqFront = eq.z + eq.depth * 0.5;

      const supporting = roofs.filter((r) => {
        const roofY = r.y0 + r.height;
        if (Math.abs(eq.y0 - (roofY - 0.5)) > 0.2 && Math.abs(eq.y0 - roofY) > 0.2) return false;
        const rLeft = r.x - r.width * 0.5;
        const rRight = r.x + r.width * 0.5;
        const rBack = r.z - r.depth * 0.5;
        const rFront = r.z + r.depth * 0.5;
        return eqLeft >= rLeft - 0.01 && eqRight <= rRight + 0.01 && eqBack >= rBack - 0.01 && eqFront <= rFront + 0.01;
      });

      expect(supporting.length).toBeGreaterThanOrEqual(1);
    }

    const trims = deriveCityTrims(layout);
    expect(trims.count).toBeLessThan(SKYRIVER_CITY.maxTrims);
  });
});

describe('R27 base sprawl: skirt roof exposure against old low architecture', () => {
  it.each(TEST_SEEDS)('ensures at least most skirts expose roof area against old architecture for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const allMasses = deriveCityMasses(layout);
    const oldMasses = allMasses.filter((m) => !isLowBaseMass(m));
    const skirts = allMasses.filter(isLowBaseMass).filter((m) => m.baseRecord.kind === 'skirt');

    const oldBoxes = oldMasses.map(placeBox);
    const skirtBoxes = skirts.map(placeBox);

    let exposedCount = 0;
    const N = 7;
    const totalPoints = N * N;

    for (const sb of skirtBoxes) {
      const py = sb.y1;
      const candidates = oldBoxes.filter((ob) => {
        if (ob.y0 > py || ob.y1 < py) return false;
        return Math.hypot(ob.cx - sb.cx, ob.cz - sb.cz) <= ob.reach + sb.reach;
      });

      let coveredPoints = 0;
      for (let ix = 0; ix < N; ix += 1) {
        const u = -1 + (2 * (ix + 0.5)) / N;
        for (let iz = 0; iz < N; iz += 1) {
          const v = -1 + (2 * (iz + 0.5)) / N;
          const px = sb.cx + u * sb.hx * sb.c + v * sb.hz * sb.s;
          const pz = sb.cz - u * sb.hx * sb.s + v * sb.hz * sb.c;
          for (const ob of candidates) {
            if (boxContainsPoint(ob, px, py, pz)) {
              coveredPoints += 1;
              break;
            }
          }
        }
      }

      if (coveredPoints / totalPoints < 0.99) {
        exposedCount += 1;
      }
    }

    // At least most skirts (> 80%) must expose real roof area outside old low architecture
    const exposedShare = exposedCount / skirts.length;
    expect(exposedShare).toBeGreaterThanOrEqual(0.80);
  });

  it.each(TEST_SEEDS)('strictly verifies zero skirts are wholly buried within old low architecture for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const allMasses = deriveCityMasses(layout);
    const oldMasses = allMasses.filter((m) => !isLowBaseMass(m));
    const skirts = allMasses.filter(isLowBaseMass).filter((m) => m.baseRecord.kind === 'skirt');

    const oldBoxes = oldMasses.map(placeBox);
    const skirtBoxes = skirts.map(placeBox);

    const buriedSkirts: Array<{
      towerOwner: string;
      skirt: { x: number; y0: number; z: number; width: number; height: number; depth: number };
      coveringMassesCount: number;
    }> = [];

    const N = 7;
    const totalPoints = N * N;

    for (const sb of skirtBoxes) {
      const py = sb.y1;
      const candidates = oldBoxes.filter((ob) => {
        if (ob.y0 > py || ob.y1 < py) return false;
        return Math.hypot(ob.cx - sb.cx, ob.cz - sb.cz) <= ob.reach + sb.reach;
      });

      let coveredPoints = 0;
      for (let ix = 0; ix < N; ix += 1) {
        const u = -1 + (2 * (ix + 0.5)) / N;
        for (let iz = 0; iz < N; iz += 1) {
          const v = -1 + (2 * (iz + 0.5)) / N;
          const px = sb.cx + u * sb.hx * sb.c + v * sb.hz * sb.s;
          const pz = sb.cz - u * sb.hx * sb.s + v * sb.hz * sb.c;
          for (const ob of candidates) {
            if (boxContainsPoint(ob, px, py, pz)) {
              coveredPoints += 1;
              break;
            }
          }
        }
      }

      const fractionCovered = coveredPoints / totalPoints;
      if (fractionCovered >= 0.99) {
        buriedSkirts.push({
          towerOwner: sb.mass.baseRecord?.towerOwner ?? '',
          skirt: {
            x: sb.mass.x,
            y0: sb.mass.y0,
            z: sb.mass.z,
            width: sb.mass.width,
            height: sb.mass.height,
            depth: sb.mass.depth,
          },
          coveringMassesCount: candidates.length,
        });
      }
    }

    // Exposure contract: Skirts must be exposed outside old low tier architecture (0 wholly buried roofs)
    expect(buriedSkirts).toEqual([]);
  });
});

describe('R27 base sprawl: short covered links physical contact', () => {
  it.each(TEST_SEEDS)('physically connects two base masses on opposing end faces at overlapping height for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const baseMasses = masses.filter(isLowBaseMass);
    const links = baseMasses.filter((m) => m.baseRecord.kind === 'link');
    const hostMasses = baseMasses.filter((m) => m.baseRecord.kind !== 'link');

    expect(links.length).toBeGreaterThan(20);

    const disconnectedLinks: Array<{
      link: { x: number; y0: number; z: number; width: number; height: number; depth: number; towerOwner: string };
      spans: 'X' | 'Z';
      touchingAnyCount: number;
      touchingEnd1Count: number;
      touchingEnd2Count: number;
    }> = [];

    for (const link of links) {
      const spansZ = link.depth > link.width;
      const ly0 = link.y0;
      const ly1 = link.y0 + link.height;
      const lx0 = link.x - link.width * 0.5;
      const lx1 = link.x + link.width * 0.5;
      const lz0 = link.z - link.depth * 0.5;
      const lz1 = link.z + link.depth * 0.5;

      const touchingAny: SkyriverMass[] = [];
      const touchingEnd1: SkyriverMass[] = [];
      const touchingEnd2: SkyriverMass[] = [];

      for (const m of hostMasses) {
        if (m.anchorV !== link.anchorV) continue;
        const my0 = m.y0;
        const my1 = m.y0 + m.height;
        const heightOverlap = Math.min(ly1, my1) - Math.max(ly0, my0);
        if (heightOverlap <= 0) continue;

        const mx0 = m.x - m.width * 0.5;
        const mx1 = m.x + m.width * 0.5;
        const mz0 = m.z - m.depth * 0.5;
        const mz1 = m.z + m.depth * 0.5;
        const xOverlap = Math.min(lx1, mx1) - Math.max(lx0, mx0);
        const zOverlap = Math.min(lz1, mz1) - Math.max(lz0, mz0);

        if (xOverlap >= -0.01 && zOverlap >= -0.01) {
          touchingAny.push(m);
          if (spansZ) {
            if (mz1 >= lz0 - 0.5 && mz0 <= lz0 + 0.5) touchingEnd1.push(m);
            if (mz0 <= lz1 + 0.5 && mz1 >= lz1 - 0.5) touchingEnd2.push(m);
          } else {
            if (mx1 >= lx0 - 0.5 && mx0 <= lx0 + 0.5) touchingEnd1.push(m);
            if (mx0 <= lx1 + 0.5 && mx1 >= lx1 - 0.5) touchingEnd2.push(m);
          }
        }
      }

      if (touchingAny.length < 2 || touchingEnd1.length === 0 || touchingEnd2.length === 0) {
        disconnectedLinks.push({
          link: {
            x: link.x,
            y0: link.y0,
            z: link.z,
            width: link.width,
            height: link.height,
            depth: link.depth,
            towerOwner: link.baseRecord.towerOwner,
          },
          spans: spansZ ? 'Z' : 'X',
          touchingAnyCount: touchingAny.length,
          touchingEnd1Count: touchingEnd1.length,
          touchingEnd2Count: touchingEnd2.length,
        });
      }
    }

    // Physical link contact contract: zero disconnected links
    expect(disconnectedLinks).toEqual([]);
  });
});


/** Positive world XZ area. Shared edges and shared faces have zero projected overlap. */
function roofFootprintsOverlap(a: PlacedBox, b: PlacedBox): boolean {
  const corners = (box: PlacedBox): readonly { x: number; z: number }[] => {
    const result: { x: number; z: number }[] = [];
    for (const u of [-1, 1]) {
      for (const v of [-1, 1]) {
        result.push({
          x: box.cx + u * box.hx * box.c + v * box.hz * box.s,
          z: box.cz - u * box.hx * box.s + v * box.hz * box.c,
        });
      }
    }
    return result;
  };
  const ac = corners(a);
  const bc = corners(b);
  const axes = [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]] as const;
  for (const [x, z] of axes) {
    const ap = ac.map(p => p.x * x + p.z * z);
    const bp = bc.map(p => p.x * x + p.z * z);
    const overlap = Math.min(Math.max(...ap), Math.max(...bp))
      - Math.max(Math.min(...ap), Math.min(...bp));
    // One micrometre absorbs float64 rotation noise at an exact shared edge.
    if (overlap <= 1e-6) return false;
  }
  return true;
}

describe('R27 base sprawl: added roof plane separation', () => {
  it.each(TEST_SEEDS)('separates overlapping added world roof planes by at least 0.25 m for seed %i', (seed) => {
    const layout = presentCityLayout(deriveCityLayout(seed));
    const masses = deriveCityMasses(layout);
    const boxes = masses.map((mass, index) => ({ box: placeBox(mass), index }))
      .filter(entry => isLowBaseMass(entry.box.mass));
    const conflicts: {
      a: number; b: number; aKind: SkyriverLowBaseKind; bKind: SkyriverLowBaseKind;
      aOwner: string; bOwner: string; roofSeparationM: number;
    }[] = [];

    // Check new versus new only. Old setback joins and half-sunk old/new joins stay valid.
    for (let i = 0; i < boxes.length; i += 1) {
      const a = boxes[i]!;
      for (let j = i + 1; j < boxes.length; j += 1) {
        const b = boxes[j]!;
        const separation = Math.abs(a.box.y1 - b.box.y1);
        if (separation >= 0.25) continue;
        if (Math.hypot(a.box.cx - b.box.cx, a.box.cz - b.box.cz) > a.box.reach + b.box.reach) continue;
        if (!roofFootprintsOverlap(a.box, b.box)) continue;
        const ar = a.box.mass.baseRecord!;
        const br = b.box.mass.baseRecord!;
        conflicts.push({
          a: a.index, b: b.index, aKind: ar.kind, bKind: br.kind,
          aOwner: ar.towerOwner, bOwner: br.towerOwner, roofSeparationM: separation,
        });
      }
    }
    expect(conflicts).toEqual([]);
  });
});
