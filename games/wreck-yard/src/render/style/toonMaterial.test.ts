import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ART_STYLE } from './artStyle';
import { getToonMaterial, getToonGradientMap } from './toonMaterial';

describe('toonMaterial (T5, R3, R4)', () => {
  it('creates and shares a single singleton gradient map', () => {
    const map1 = getToonGradientMap();
    const map2 = getToonGradientMap();
    expect(map1).toBe(map2);
    expect(map1.magFilter).toBe(THREE.NearestFilter);
    expect(map1.minFilter).toBe(THREE.NearestFilter);
    expect(map1.image.width).toBe(256);
  });

  it('samples correct stepped values matching ART_STYLE.ramp', () => {
    const map = getToonGradientMap();
    const data = map.image.data as Uint8Array;

    // Below edge 0: should be 0
    const uEdge0 = ART_STYLE.ramp.edges[0] * 0.5 + 0.5;
    const idxBeforeEdge0 = Math.floor((uEdge0 - 0.05) * 256);
    expect(data[idxBeforeEdge0]).toBe(0);

    // Between edge 0 and edge 1: should be halfLevel
    const uMid = ((ART_STYLE.ramp.edges[0] + ART_STYLE.ramp.edges[1]) * 0.5) * 0.5 + 0.5;
    const idxMid = Math.floor(uMid * 256);
    expect(data[idxMid]).toBe(Math.round(ART_STYLE.ramp.halfLevel * 255));

    // Above edge 1: should be 255
    const uAbove = (ART_STYLE.ramp.edges[1] + 0.1) * 0.5 + 0.5;
    const idxAbove = Math.floor(uAbove * 256);
    expect(data[idxAbove]).toBe(255);
  });

  it('caches materials by color and options', () => {
    const mat1 = getToonMaterial('#f97316');
    const mat2 = getToonMaterial('#f97316');
    const mat3 = getToonMaterial('#38bdf8');

    expect(mat1).toBe(mat2);
    expect(mat1).not.toBe(mat3);
    expect(mat1.gradientMap).toBe(getToonGradientMap());
  });
});
