import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ART_STYLE } from './artStyle';
import { createInvertedHullMaterial } from './invertedHullMaterial';

describe('invertedHullMaterial (T1, R1)', () => {
  it('creates a shader material configured for inverted hull backface extrusion', () => {
    const mat = createInvertedHullMaterial();
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.depthTest).toBe(true);
    expect(mat.depthWrite).toBe(true);
    expect(mat.polygonOffset).toBe(true);
  });

  it('sets expected uniforms for thickness, color, and alpha', () => {
    const customThickness = 0.035;
    const customColor = '#000000';
    const customAlpha = 0.8;
    const mat = createInvertedHullMaterial(customThickness, customColor, customAlpha);

    expect(mat.uniforms.uThickness.value).toBe(customThickness);
    expect(mat.uniforms.uAlpha.value).toBe(customAlpha);
    expect((mat.uniforms.uColor.value as THREE.Color).getHexString()).toBe('000000');
    expect(mat.transparent).toBe(true);
  });

  it('uses ART_STYLE ink palette as default color', () => {
    const mat = createInvertedHullMaterial();
    const expectedHex = new THREE.Color(ART_STYLE.palette.ink).getHexString();
    expect((mat.uniforms.uColor.value as THREE.Color).getHexString()).toBe(expectedHex);
  });
});
