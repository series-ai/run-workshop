import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { ART_STYLE } from './artStyle';
import { InkShader } from './inkShader';
import { BloomShader } from './bloomShader';
import { AmbientOcclusionShader, BloomDownShader, BloomUpShader } from './postShaders';
import type { RenderQuality } from '../renderQuality';
import type { YardRender } from '../presentation';
import {
  createReturnsPortalHooks,
  createReturnsPortalSurfaces,
  renderReturnsPortalViews,
} from '../portalScene';

export interface InkComposerProps {
  enableInk?: boolean;
  /** MSAA samples for the scene target. Phones use 0 to save fill rate. */
  samples: number;
  quality: RenderQuality;
  /** Present in the yard scene. Other InkComposer users keep a normal scene pass. */
  renderRef?: MutableRefObject<YardRender | null>;
}

/** Bloom chain levels on the high tier: 1/2, 1/4, 1/8, 1/16, 1/32 of the frame. */
const BLOOM_LEVELS = 5;

function colorTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  target.texture.generateMipmaps = false;
  return target;
}

function passMaterial(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }) {
  return new THREE.ShaderMaterial({
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(shader.uniforms),
    depthTest: false,
    depthWrite: false,
  });
}

interface Pipeline {
  readonly scene: THREE.WebGLRenderTarget;
  readonly depth: THREE.DepthTexture;
  /** Low: one 1/4 target. High: extract + 4 downsample levels, then 4 upsample levels. */
  readonly bloomDown: readonly THREE.WebGLRenderTarget[];
  readonly bloomUp: readonly THREE.WebGLRenderTarget[];
  readonly ao: THREE.WebGLRenderTarget | null;
  readonly white: THREE.DataTexture;
  readonly passScene: THREE.Scene;
  readonly passCamera: THREE.OrthographicCamera;
  readonly quad: THREE.Mesh;
  readonly extract: THREE.ShaderMaterial;
  readonly down: THREE.ShaderMaterial;
  readonly up: THREE.ShaderMaterial;
  readonly aoMaterial: THREE.ShaderMaterial;
  readonly composite: THREE.ShaderMaterial;
  dispose(): void;
}

function createPipeline(width: number, height: number, samples: number, quality: RenderQuality, portals: boolean): Pipeline {
  const depth = new THREE.DepthTexture(width, height, portals ? THREE.UnsignedInt248Type : THREE.UnsignedIntType);
  depth.format = portals ? THREE.DepthStencilFormat : THREE.DepthFormat;
  const scene = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthTexture: depth,
    stencilBuffer: portals,
    samples,
  });
  scene.texture.generateMipmaps = false;

  const high = quality === 'high';
  const bloomDown = high
    ? Array.from({ length: BLOOM_LEVELS }, (_, level) => colorTarget(Math.ceil(width / 2 ** (level + 1)), Math.ceil(height / 2 ** (level + 1))))
    : [colorTarget(Math.ceil(width / 4), Math.ceil(height / 4))];
  const bloomUp = high ? bloomDown.slice(0, -1).map((target) => colorTarget(target.width, target.height)) : [];
  const ao = high
    ? new THREE.WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
    : null;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const extract = passMaterial(BloomShader);
  extract.uniforms.uThreshold!.value = ART_STYLE.post.bloom.threshold;
  const down = passMaterial(BloomDownShader);
  const up = passMaterial(BloomUpShader);
  const aoMaterial = passMaterial(AmbientOcclusionShader);
  const post = ART_STYLE.post.ao;
  aoMaterial.uniforms.uRadius!.value = post.radius;
  aoMaterial.uniforms.uIntensity!.value = post.intensity;
  aoMaterial.uniforms.uBias!.value = post.bias;
  (aoMaterial.uniforms.uFade!.value as THREE.Vector2).set(post.fade[0], post.fade[1]);
  aoMaterial.uniforms.tDepth!.value = depth;
  const composite = passMaterial(InkShader);
  composite.uniforms.tDiffuse!.value = scene.texture;
  composite.uniforms.tDepth!.value = depth;
  const bloomResult = high ? bloomUp[0]! : bloomDown[0]!;
  composite.uniforms.tBloom!.value = bloomResult.texture;
  (composite.uniforms.uBloomTexel!.value as THREE.Vector2).set(1 / bloomResult.width, 1 / bloomResult.height);
  composite.uniforms.uBloomGain!.value = high ? ART_STYLE.post.bloom.gainHigh : ART_STYLE.post.bloom.gainLow;
  composite.uniforms.tAO!.value = ao ? ao.texture : white;
  if (ao) (composite.uniforms.uAOTexel!.value as THREE.Vector2).set(1 / ao.width, 1 / ao.height);
  composite.uniforms.uAOStrength!.value = ao ? post.strength : 0;
  composite.uniforms.uGrime!.value = high ? ART_STYLE.post.grime : 0;

  const quad = new THREE.Mesh(geometry, composite);
  quad.frustumCulled = false;
  const passScene = new THREE.Scene();
  passScene.add(quad);
  const materials = [extract, down, up, aoMaterial, composite];
  return {
    scene, depth, bloomDown, bloomUp, ao, white, passScene, passCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad,
    extract, down, up, aoMaterial, composite,
    dispose() {
      [scene, ...bloomDown, ...bloomUp, ...(ao ? [ao] : [])].forEach((target) => target.dispose());
      depth.dispose();
      white.dispose();
      geometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  };
}

/**
 * Takes over the frame (priority 1): scene -> HDR target, optional AO and
 * bloom chain, then one composite pass with ink, cavity, bloom, and grade.
 */
export function InkComposer({ enableInk = false, samples, quality, renderRef }: InkComposerProps) {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();
  const width = Math.max(1, Math.floor(size.width * dpr));
  const height = Math.max(1, Math.floor(size.height * dpr));

  const pipeline = useMemo(() => {
    try {
      return createPipeline(width, height, samples, quality, Boolean(renderRef));
    } catch (err) {
      throw new Error(`InkComposer: Failed to create WebGL render target or depth texture: ${String(err)}`);
    }
  }, [width, height, samples, quality, renderRef]);
  useEffect(() => () => pipeline.dispose(), [pipeline]);

  const portalSurfaces = useMemo(() => renderRef ? createReturnsPortalSurfaces() : null, [renderRef]);
  useEffect(() => () => portalSurfaces?.dispose(), [portalSurfaces]);
  const portalCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  const portalHooks = useMemo(() => portalSurfaces
    ? createReturnsPortalHooks({ renderer: gl, scene, camera: portalCamera, eyeCamera: camera, surfaces: portalSurfaces })
    : null, [camera, gl, portalCamera, portalSurfaces, scene]);

  useFrame(({ gl, camera }) => {
    const perspective = camera as THREE.PerspectiveCamera;
    const pass = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      pipeline.quad.material = material;
      gl.setRenderTarget(target);
      gl.render(pipeline.passScene, pipeline.passCamera);
    };

    const previousAutoClear = gl.autoClear;
    const previousLocalClipping = gl.localClippingEnabled;
    gl.setRenderTarget(pipeline.scene);
    try {
      gl.localClippingEnabled = true;
      if (portalHooks && renderRef) {
        renderReturnsPortalViews({ renderer: gl, scene, eyeCamera: camera, hooks: portalHooks });
      } else {
        gl.clear(true, true, true);
        gl.render(scene, camera);
      }
    } finally {
      gl.autoClear = previousAutoClear;
      gl.localClippingEnabled = previousLocalClipping;
    }

    if (pipeline.ao) {
      const u = pipeline.aoMaterial.uniforms;
      (u.uResolution!.value as THREE.Vector2).set(pipeline.ao.width, pipeline.ao.height);
      (u.uInverseProjection!.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
      u.uProjScale!.value = camera.projectionMatrix.elements[5]! * 0.5 * pipeline.ao.height;
      u.uCameraNear!.value = perspective.near;
      u.uCameraFar!.value = perspective.far;
      pass(pipeline.aoMaterial, pipeline.ao);
    }

    // Bloom: bright-pass extract into the first level, then (high) down and back up.
    const [first, ...rest] = pipeline.bloomDown;
    pipeline.extract.uniforms.tDiffuse!.value = pipeline.scene.texture;
    (pipeline.extract.uniforms.uResolution!.value as THREE.Vector2).set(first!.width, first!.height);
    pass(pipeline.extract, first!);
    let source = first!;
    for (const target of rest) {
      pipeline.down.uniforms.tInput!.value = source.texture;
      (pipeline.down.uniforms.uSourceTexel!.value as THREE.Vector2).set(1 / source.width, 1 / source.height);
      pass(pipeline.down, target);
      source = target;
    }
    for (let level = pipeline.bloomUp.length - 1; level >= 0; level -= 1) {
      pipeline.up.uniforms.tInput!.value = source.texture;
      pipeline.up.uniforms.tAdd!.value = pipeline.bloomDown[level]!.texture;
      (pipeline.up.uniforms.uSourceTexel!.value as THREE.Vector2).set(1 / source.width, 1 / source.height);
      pass(pipeline.up, pipeline.bloomUp[level]!);
      source = pipeline.bloomUp[level]!;
    }

    const u = pipeline.composite.uniforms;
    (u.uResolution!.value as THREE.Vector2).set(width, height);
    u.uCameraNear!.value = perspective.near || 0.1;
    u.uCameraFar!.value = perspective.far || 100.0;
    (u.uInverseProjection!.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (u.uCameraWorld!.value as THREE.Matrix4).copy(camera.matrixWorld);
    u.uEnableInk!.value = enableInk ? 1.0 : 0.0;
    pass(pipeline.composite, null);
  }, 1);

  return null;
}
