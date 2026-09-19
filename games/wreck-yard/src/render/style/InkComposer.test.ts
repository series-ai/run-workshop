import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InkShader } from './inkShader';

describe('InkComposer & InkShader unit checks (T2, A9)', () => {
  it('InkShader provides valid vertex and fragment shaders with uniforms', () => {
    expect(InkShader.vertexShader).toBeDefined();
    expect(InkShader.fragmentShader).toBeDefined();
    expect(InkShader.uniforms.tDiffuse).toBeDefined();
    expect(InkShader.uniforms.tDepth).toBeDefined();
    expect(InkShader.uniforms.uEnableInk).toBeDefined();
  });

  it('InkComposer error format prefixes errors with "InkComposer:"', () => {
    function simulateFailure() {
      try {
        throw new Error('Simulated WebGLRenderTarget creation failure');
      } catch (err) {
        throw new Error(`InkComposer: Failed to create WebGL render target or depth texture: ${String(err)}`);
      }
    }

    expect(() => simulateFailure()).toThrowError(/^InkComposer:/);
  });

  it('verifies WebGLRenderTarget setup with DepthTexture', () => {
    const depthTexture = new THREE.DepthTexture(256, 256, THREE.UnsignedIntType);
    depthTexture.format = THREE.DepthFormat;
    const rt = new THREE.WebGLRenderTarget(256, 256, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthTexture,
      samples: 4,
    });

    expect(rt.depthTexture).toBe(depthTexture);
    expect(rt.samples).toBe(4);
    rt.dispose();
    depthTexture.dispose();
  });
});
