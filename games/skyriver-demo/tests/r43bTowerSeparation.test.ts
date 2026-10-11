import { describe, expect, it } from 'vitest';
import { decodeCityGraph } from '../src/render/citySnapshotCodec';
import { buildingSeedOf, clearCitySnapshot, deriveCityMasses, installCitySnapshot,
  SKYRIVER_CITY_SHADER_SOURCE } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { quantize, windowCellProfile } from '../src/render/structureMaterial';
import { readActualCityAsset } from './support/r40AssetOracle';
import { withoutR43bWindowCells } from './support/r43bTowerSeparation';

const SEALED_GRAPH_HASHES = {
  node: '8274354bfae5f02aa6b7b7af1e60360cbbf8938280a65ac88a4c8c4582fe238e',
  browser: 'aac02ce040fff65ea202b509b5264c17d5d2fb1b339276fbba54be6886be1742',
} as const;

describe('R43b independent tower window contracts', () => {
  it('rejects an unapproved owner selector before the frozen R29 shader check', () => {
    const shader = SKYRIVER_CITY_SHADER_SOURCE.towerVertex;
    expect(shader).toContain('* 251.0 + 97.0');
    const changed = shader.replace('* 251.0 + 97.0', '* 250.0 + 97.0');
    expect(() => withoutR43bWindowCells(changed, 'towerVertex')).toThrow('R43B_WINDOW_DELTA_CHANGED');
  });

  it('keeps the sealed city graphs unchanged in both runtimes', () => {
    const project = new URL('..', import.meta.url).pathname;
    for (const runtime of ['node', 'browser'] as const) {
      const asset = readActualCityAsset(project, runtime);
      expect(asset.binding.payloadHash).toBe(SEALED_GRAPH_HASHES[runtime]);
      expect(Reflect.get(asset.envelope.payload as object, 'hash')).toBe(SEALED_GRAPH_HASHES[runtime]);
      expect(() => decodeCityGraph(asset.envelope.payload)).not.toThrow();
    }
  });

  it('varies both cell dimensions and pane aspect within every family at fixed pane area', () => {
    const widths: number[] = [], heights: number[] = [];
    for (let family = 0; family < 4; family += 1) {
      const cells = Array.from({ length: 64 }, (_, i) => windowCellProfile(family * 16384 + i * 251));
      for (const cell of cells) {
        expect(cell.family).toBe(family);
        expect(cell.widthM).toBeGreaterThan(0);
        expect(cell.heightM).toBeGreaterThan(0);
        expect(cell.paneHalfWidth).toBeGreaterThan(0);
        expect(cell.paneHalfHeight).toBeGreaterThan(0);
        expect(cell.paneHalfWidth).toBeLessThan(0.5);
        expect(cell.paneHalfHeight).toBeLessThan(0.5);
        expect(cell.paneHalfWidth * cell.paneHalfHeight).toBeCloseTo(0.41 * 0.29, 7);
      }
      for (const key of ['widthM', 'heightM', 'paneHalfWidth', 'paneHalfHeight'] as const) {
        expect(new Set(cells.map(cell => cell[key])).size, `family ${family} ${key}`).toBe(5);
      }
      widths.push(...cells.map(cell => cell.widthM));
      heights.push(...cells.map(cell => cell.heightM));
    }
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.5);
    expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(1.25);
  });

  it('matches fixed owner fixtures with independent cell and pane dimensions', () => {
    const fixtures = [
      [0, 0, 5, 4.75, 392 / 1024],
      [1, 0, 5.25, 4.75, 392 / 1024],
      [16384, 1, 10.25, 5.5, 474 / 1024],
      [32768, 2, 5, 9, 344 / 1024],
      [49152, 3, 7.25, 6, 428 / 1024],
      [65535, 3, 6.5, 5.25, 436 / 1024],
    ] as const;
    for (const [q, family, widthM, heightM, paneHalfWidth] of fixtures) {
      const cell = windowCellProfile(q);
      expect(cell.family).toBe(family);
      expect(cell.widthM).toBe(widthM);
      expect(cell.heightM).toBe(heightM);
      expect(cell.paneHalfWidth).toBe(paneHalfWidth);
      expect(cell.paneHalfHeight).toBeCloseTo(0.1189 / paneHalfWidth, 7);
    }
  });

  it('preserves owner cell identity through the real sealed snapshot path', () => {
    const layout = presentCityLayout(deriveCityLayout(424242));
    const asset = readActualCityAsset(new URL('..', import.meta.url).pathname, 'node');
    try {
      installCitySnapshot(layout, decodeCityGraph(asset.envelope.payload));
      const cellsByOwner = new Map<number, ReturnType<typeof windowCellProfile>>();
      let repeatedOwners = 0;
      for (const mass of deriveCityMasses(layout)) {
        const owner = Math.fround(mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z));
        const q = quantize(owner), cell = windowCellProfile(q);
        const previous = cellsByOwner.get(q);
        if (previous) {
          expect(cell).toEqual(previous);
          repeatedOwners += 1;
        } else cellsByOwner.set(q, cell);
        expect(windowCellProfile(quantize(Math.fround(owner)))).toEqual(cell);
      }
      expect(cellsByOwner.size).toBeGreaterThan(100);
      expect(repeatedOwners).toBeGreaterThan(100);
      expect(new Set([...cellsByOwner.values()].map(cell => cell.family)).size).toBe(4);
    } finally { clearCitySnapshot(layout.seed); }
  });

  it('uses the same cell dimensions for room rays, step masks, and floor bands', () => {
    const shader = SKYRIVER_CITY_SHADER_SOURCE.towerFragment;
    expect(shader).toContain('vec2 cellSize = vWindowCell.xy;');
    expect(shader).toContain('vec2 cellUv = vSurf / cellSize;');
    expect(shader).toContain('cell.y * cellSize.y');
    expect(shader).toContain('( cell.y + 1.0 ) * cellSize.y');
    expect(shader).toContain('vSurf.y / cellSize.y');
    expect(shader).toContain('dot( d, vTangentW ) / cellSize.x');
    expect(shader).toContain('d.y / cellSize.y');
    expect(shader).toContain('traceRoom( cellLocal, ray, room, mirror, fRatio, depth01 )');
    expect(shader).not.toContain('vSurf.y / uCellHeight');
    expect(shader).not.toContain('d.y / uCellHeight');
  });
});
