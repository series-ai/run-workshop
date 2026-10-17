import { beginPhase, endPhase, perfCount } from '../../perf/recorder';
import { beginGpu, endGpu, finishPerfFrame } from '../../perf/render';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { ART_STYLE } from './artStyle';
import { InkShader } from './inkShader';
import { BloomShader } from './bloomShader';
import { AmbientOcclusionShader, BloomDownShader, BloomUpShader } from './postShaders';
import type { RenderQuality } from '../renderQuality';
import type { YardRender } from '../presentation';
import { useReducedMotionRef } from '../reducedMotion';
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
  readonly targetBytesEstimate: number;
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
  readonly portalPost: THREE.ShaderMaterial;
  readonly portalScratch: THREE.WebGLRenderTarget;
  readonly copyPortal: THREE.ShaderMaterial;
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
  composite.name = 'yard-ink-composite';
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
  const portalPost = composite.clone();
  portalPost.name = 'yard-portal-depth-style';
  portalPost.uniforms.tDiffuse!.value = scene.texture;
  portalPost.uniforms.tDepth!.value = depth;
  portalPost.uniforms.tAO!.value = ao ? ao.texture : white;
  portalPost.uniforms.uLinearOutput!.value = 1;
  portalPost.uniforms.uEnableBloom!.value = 0;
  const portalScratch = colorTarget(width, height);
  const copyPortal = passMaterial({
    uniforms: { tInput: { value: portalScratch.texture } },
    vertexShader: InkShader.vertexShader,
    fragmentShader: 'varying vec2 vUv; uniform sampler2D tInput; void main() { gl_FragColor = texture2D(tInput, vUv); }',
  });
  copyPortal.name = 'yard-portal-style-copy';
  copyPortal.uniforms.tInput!.value = portalScratch.texture;
  copyPortal.blending = THREE.NoBlending;
  copyPortal.stencilWrite = true;
  copyPortal.stencilFunc = THREE.EqualStencilFunc;
  copyPortal.stencilFail = THREE.KeepStencilOp;
  copyPortal.stencilZFail = THREE.KeepStencilOp;
  copyPortal.stencilZPass = THREE.KeepStencilOp;

  const quad = new THREE.Mesh(geometry, composite);
  quad.frustumCulled = false;
  const passScene = new THREE.Scene();
  passScene.add(quad);
  const materials = [extract, down, up, aoMaterial, composite, portalPost, copyPortal];
  return {
    targetBytesEstimate: width * height * (12 * (1 + samples) + 8)
      + [...bloomDown, ...bloomUp].reduce((bytes, target) => bytes + target.width * target.height * 8, 0)
      + (ao ? ao.width * ao.height * 4 : 0),
    scene, depth, bloomDown, bloomUp, ao, white, passScene, passCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad,
    extract, down, up, aoMaterial, composite, portalPost, portalScratch, copyPortal,
    dispose() {
      [scene, portalScratch, ...bloomDown, ...bloomUp, ...(ao ? [ao] : [])].forEach((target) => target.dispose());
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
  const reducedMotion = useReducedMotionRef();
  const transit = useRef({ slot: -1, counter: -1, frame: -1, startedAt: -Infinity });
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
  const inverseViewProjection = useMemo(() => new THREE.Matrix4(), []);
  const portalRects = useMemo(() => ({ viewport: new THREE.Vector4(), scissor: new THREE.Vector4() }), []);
  const portalHooks = useMemo(() => portalSurfaces
    ? createReturnsPortalHooks({ renderer: gl, scene, camera: portalCamera, eyeCamera: camera, surfaces: portalSurfaces,
      afterView(draw) {
        const previousTarget = gl.getRenderTarget();
        const viewport = gl.getViewport(portalRects.viewport);
        const scissor = gl.getScissor(portalRects.scissor);
        const scissorTest = gl.getScissorTest();
        const restrictPass = (target: THREE.WebGLRenderTarget, border: number) => {
          gl.setRenderTarget(target);
          const rect = draw.scissor;
          if (!rect) { gl.setScissorTest(false); return; }
          const left = Math.max(0, Math.floor((rect.minX + 1) * target.width / 2) - border);
          const bottom = Math.max(0, Math.floor((rect.minY + 1) * target.height / 2) - border);
          const right = Math.min(target.width, Math.ceil((rect.maxX + 1) * target.width / 2) + border);
          const top = Math.min(target.height, Math.ceil((rect.maxY + 1) * target.height / 2) + border);
          // Renderer scissor arguments use CSS pixels, including for a target.
          const ratio = gl.getPixelRatio();
          gl.setScissor(left / ratio, bottom / ratio, (right - left) / ratio, (top - bottom) / ratio);
          gl.setScissorTest(true);
        };
        try {
          inverseViewProjection.fromArray(draw.projection).invert();
          if (pipeline.ao) {
            const u = pipeline.aoMaterial.uniforms;
            (u.uResolution!.value as THREE.Vector2).set(pipeline.ao.width, pipeline.ao.height);
            (u.uInverseProjection!.value as THREE.Matrix4).copy(inverseViewProjection);
            u.uProjScale!.value = draw.projection[5]! * 0.5 * pipeline.ao.height;
            pipeline.quad.material = pipeline.aoMaterial;
            // AO reads the full depth texture. Only its output needs a border
            // for the composite's bilinear samples at the aperture edge.
            restrictPass(pipeline.ao, 3);
            gl.render(pipeline.passScene, pipeline.passCamera);
          }
          const u = pipeline.portalPost.uniforms;
          (u.uResolution!.value as THREE.Vector2).set(width, height);
          (u.uInverseProjection!.value as THREE.Matrix4).copy(inverseViewProjection);
          (u.uCameraWorld!.value as THREE.Matrix4).fromArray(draw.cameraWorldMatrix);
          u.uEnableInk!.value = enableInk ? 1 : 0;
          pipeline.quad.material = pipeline.portalPost;
          restrictPass(pipeline.portalScratch, 1);
          gl.render(pipeline.passScene, pipeline.passCamera);
          pipeline.copyPortal.stencilRef = draw.stencil.ref;
          pipeline.quad.material = pipeline.copyPortal;
          gl.setRenderTarget(previousTarget);
          if (previousTarget) restrictPass(previousTarget, 0);
          gl.render(pipeline.passScene, pipeline.passCamera);
        } finally {
          gl.setRenderTarget(previousTarget);
          gl.setViewport(viewport);
          gl.setScissor(scissor);
          gl.setScissorTest(scissorTest);
        }
      },
    })
    : null, [camera, enableInk, gl, height, inverseViewProjection, pipeline, portalCamera, portalRects, portalSurfaces, scene, width]);

  useFrame(({ gl, camera, clock }) => {
    try {
    perfCount('webgl.postTargetBytesEstimate', pipeline.targetBytesEstimate);
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
        const timing = beginPhase('render.main');
        const gpu = beginGpu(gl, 'render.main');
        try { gl.render(scene, camera); }
        finally { endGpu(gl, gpu); endPhase('render.main', timing); }
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
      const timing = beginPhase('post.ao');
      const gpu = beginGpu(gl, 'post.ao');
      try { pass(pipeline.aoMaterial, pipeline.ao); }
      finally { endGpu(gl, gpu); endPhase('post.ao', timing); }
    }

    // Bloom: bright-pass extract into the first level, then (high) down and back up.
    const bloomTiming = beginPhase('post.bloom');
    const bloomGpu = beginGpu(gl, 'post.bloom');
    try {
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

    } finally { endGpu(gl, bloomGpu); endPhase('post.bloom', bloomTiming); }
    const u = pipeline.composite.uniforms;
    const render = renderRef?.current;
    const player = render?.players.find((entry) => entry.slot === render.localSlot);
    const previous = transit.current;
    const counter = player?.portalTeleports ?? 0;
    if (!player || !render || previous.slot !== player.slot || render.frame < previous.frame || counter < previous.counter) {
      previous.startedAt = -Infinity;
    } else if (previous.counter >= 0 && counter > previous.counter) {
      previous.startedAt = clock.elapsedTime;
    }
    previous.slot = player?.slot ?? -1;
    previous.counter = player ? counter : -1;
    previous.frame = render?.frame ?? -1;
    const pulse = Math.max(0, 1 - (clock.elapsedTime - previous.startedAt) / 0.5);
    u.uPortalTransit!.value = pulse * pulse * (reducedMotion.current ? 0.35 : 1);
    u.uPortalDistortion!.value = reducedMotion.current ? 0 : pulse * pulse;
    u.uPortalTime!.value = clock.elapsedTime;
    (u.uResolution!.value as THREE.Vector2).set(width, height);
    u.uCameraNear!.value = perspective.near || 0.1;
    u.uCameraFar!.value = perspective.far || 100.0;
    (u.uInverseProjection!.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (u.uCameraWorld!.value as THREE.Matrix4).copy(camera.matrixWorld);
    u.uEnableInk!.value = enableInk ? 1.0 : 0.0;
    const compositeTiming = beginPhase('post.composite');
    const compositeGpu = beginGpu(gl, 'post.composite');
    try { pass(pipeline.composite, null); }
    finally { endGpu(gl, compositeGpu); endPhase('post.composite', compositeTiming); }
    } finally { finishPerfFrame(gl, renderRef?.current?.frame ?? -1); }
  }, 1);

  return null;
}
