import { describe, expect, it } from 'vitest';
import { BEACON_MIN_HEIGHT, buildCityBuilding, CITY_LAYERS, type CityBuilding } from './cityShapes';
import { computeShapeArea, SKYLINE_LAYERS } from './skylineShapes';

const all = CITY_LAYERS.flatMap((layer) => layer.buildings);

describe('city skyline', () => {
  it('sits behind the factory rings', () => {
    const farthestFactory = Math.max(...SKYLINE_LAYERS.map((layer) => layer.distance));
    for (const layer of CITY_LAYERS) expect(layer.distance).toBeGreaterThan(farthestFactory);
  });

  it('builds every building as one closed outline with positive area', () => {
    for (const building of all) expect(computeShapeArea(buildCityBuilding(building).shape), `${building.azimuthDeg}`).toBeGreaterThan(0);
  });

  it('keeps lit windows inside the building', () => {
    for (const building of all) {
      for (const lit of buildCityBuilding(building).windows) {
        expect(Math.abs(lit.x)).toBeLessThanOrEqual(building.width / 2);
        expect(Math.abs(lit.x + lit.width)).toBeLessThanOrEqual(building.width / 2);
        expect(lit.y).toBeGreaterThan(0);
        expect(lit.y + lit.height).toBeLessThan(building.height);
      }
    }
  });

  it('puts aviation lights only on the spires, crowns, and antennas of tall towers, above the roof', () => {
    let lights = 0;
    for (const building of all) {
      const { beacon } = buildCityBuilding(building);
      const expected = building.height >= BEACON_MIN_HEIGHT && (building.roof === 'spire' || building.roof === 'crown' || building.roof === 'antenna');
      expect(beacon !== null, `${building.roof} ${building.height}`).toBe(expected);
      if (beacon) { expect(beacon[1]).toBeGreaterThan(building.height); lights += 1; }
    }
    // Each light is a draw call.
    expect(lights).toBeGreaterThan(3);
    expect(lights).toBeLessThanOrEqual(16);
  });

  it('is taller downtown, ahead of the main view, than across the ring', () => {
    const downtown = CITY_LAYERS[0]!.buildings;
    const mean = (list: readonly CityBuilding[]) => list.reduce((sum, b) => sum + b.height, 0) / list.length;
    const ahead = downtown.filter((b) => Math.abs(b.azimuthDeg - 12) < 20);
    const side = downtown.filter((b) => Math.abs(Math.abs(b.azimuthDeg) - 90) < 20);
    expect(mean(ahead)).toBeGreaterThan(mean(side) * 1.6);
  });

  it('builds the same city on every load', () => {
    const building = all[7]!;
    const a = buildCityBuilding(building);
    const b = buildCityBuilding(building);
    expect(b.windows.length).toBe(a.windows.length);
    expect(b.shape.getPoints()).toEqual(a.shape.getPoints());
  });
});
