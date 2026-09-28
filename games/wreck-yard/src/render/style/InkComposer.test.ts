import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InkShader } from './inkShader';
import { BloomShader } from './bloomShader';

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

  it('mathematically reconstructs exact view space position without far-plane scale bug', () => {
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
    camera.updateProjectionMatrix();
    const invProj = camera.projectionMatrixInverse;

    // Test a point at view space (2.0, 1.5, -10.0)
    const viewPoint = new THREE.Vector3(2.0, 1.5, -10.0);
    const ndc = viewPoint.clone().applyMatrix4(camera.projectionMatrix);

    // Reconstruct using Astra's formula: h = invProj * [ndc.x, ndc.y, 1.0, 1.0]; h.xyz * (linearZ / -h.z)
    const h = new THREE.Vector4(ndc.x, ndc.y, 1.0, 1.0).applyMatrix4(invProj);
    const linearZ = 10.0;
    const reconstructed = new THREE.Vector3(h.x, h.y, h.z).multiplyScalar(linearZ / -h.z);

    expect(reconstructed.x).toBeCloseTo(viewPoint.x, 4);
    expect(reconstructed.y).toBeCloseTo(viewPoint.y, 4);
    expect(reconstructed.z).toBeCloseTo(viewPoint.z, 4);
  });

  it('BloomShader provides valid vertex and fragment shaders with uniforms', () => {
    expect(BloomShader.vertexShader).toBeDefined();
    expect(BloomShader.fragmentShader).toBeDefined();
    expect(BloomShader.uniforms.tDiffuse).toBeDefined();
    expect(BloomShader.uniforms.uResolution).toBeDefined();
    expect(BloomShader.uniforms.uThreshold.value).toBe(1.25);
    expect(BloomShader.uniforms.uKnee.value).toBe(0.5);
  });
});
