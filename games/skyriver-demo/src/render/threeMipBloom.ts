/**
 * @file threeMipBloom.ts — a local three-level bloom pass, so the R23 frame stays inside 32 draws.
 *
 * Three's own `UnrealBloomPass` allocates five blur levels and draws thirteen times: one bright
 * pass, five horizontal/vertical pairs, one composite and one additive blend. Its composite shader
 * declares and samples five textures unconditionally, so lowering `nMips` alone leaves three of its
 * samplers bound to nothing — that is not a valid three-level bloom and never was.
 *
 * This pass is the same algorithm at three levels: 1 + 6 + 1 + 1 = 9 draws. The composite declares
 * and samples exactly three blur textures, with three factors and three tints. The control contract
 * (`strength`, `radius`, `threshold`, `smoothWidth`, `setSize`) matches the pass it replaces, so the
 * scene's existing bloom wiring and the A/B evidence read the same fields.
 *
 * Nothing in `node_modules` is edited and no dependency is added: `CopyShader`,
 * `LuminosityHighPassShader`, `Pass` and `FullScreenQuad` are imported from the installed three.
 * The local `@types/three` declares `getSeperableBlurMaterial`/`getCompositeMaterial` without their
 * runtime arguments, so this file builds its own typed helpers rather than casting through those.
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { LuminosityHighPassShader } from 'three/examples/jsm/shaders/LuminosityHighPassShader.js';

/** Three levels. The whole point of the pass. */
export const SKYRIVER_BLOOM_MIPS = 3;
/** 1 bright + 3 x (horizontal + vertical) + 1 composite + 1 additive blend. */
export const SKYRIVER_BLOOM_DRAWS = 9;
/** Three's own five-level pass, for the A/B record. */
export const SKYRIVER_LEGACY_BLOOM_MIPS = 5;
export const SKYRIVER_LEGACY_BLOOM_DRAWS = 13;

/** The first three of three's own kernel radii, unchanged. */
export const SKYRIVER_BLOOM_KERNELS: readonly number[] = Object.freeze([3, 5, 7]);
/**
 * The first three of three's own weights. Deliberately NOT renormalised to recover the five-level
 * energy: that would be a guess. The halo proof calibrates them against measured images.
 */
export const SKYRIVER_BLOOM_FACTORS: readonly number[] = Object.freeze([1.0, 0.8, 0.6]);

function blurMaterial(kernelRadius: number): THREE.ShaderMaterial {
  const coefficients: number[] = [];
  for (let i = 0; i < kernelRadius; i += 1) {
    coefficients.push(0.39894 * Math.exp((-0.5 * i * i) / (kernelRadius * kernelRadius)) / kernelRadius);
  }

  return new THREE.ShaderMaterial({
    name: `skyriver.bloom3.blur${kernelRadius}`,
    defines: { KERNEL_RADIUS: kernelRadius },
    uniforms: {
      colorTexture: { value: null },
      invSize: { value: new THREE.Vector2(0.5, 0.5) },
      direction: { value: new THREE.Vector2(0.5, 0.5) },
      gaussianCoefficients: { value: coefficients },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      varying vec2 vUv;
      uniform sampler2D colorTexture;
      uniform vec2 invSize;
      uniform vec2 direction;
      uniform float gaussianCoefficients[KERNEL_RADIUS];

      void main() {
        float weightSum = gaussianCoefficients[0];
        vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
        for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {
          float x = float( i );
          float w = gaussianCoefficients[i];
          vec2 uvOffset = direction * invSize * x;
          vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
          vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
          diffuseSum += ( sample1 + sample2 ) * w;
          weightSum += 2.0 * w;
        }
        gl_FragColor = vec4( diffuseSum / weightSum, 1.0 );
      }`,
  });
}

/** Exactly three declared samplers, three factors, three tints. No unbound fourth or fifth. */
function compositeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'skyriver.bloom3.composite',
    defines: { NUM_MIPS: SKYRIVER_BLOOM_MIPS },
    uniforms: {
      blurTexture1: { value: null },
      blurTexture2: { value: null },
      blurTexture3: { value: null },
      bloomStrength: { value: 1.0 },
      bloomFactors: { value: null },
      bloomTintColors: { value: null },
      bloomRadius: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D blurTexture1;
      uniform sampler2D blurTexture2;
      uniform sampler2D blurTexture3;
      uniform float bloomStrength;
      uniform float bloomRadius;
      uniform float bloomFactors[NUM_MIPS];
      uniform vec3 bloomTintColors[NUM_MIPS];

      float lerpBloomFactor( const in float factor ) {
        float mirrorFactor = 1.2 - factor;
        return mix( factor, mirrorFactor, bloomRadius );
      }

      void main() {
        gl_FragColor = bloomStrength * (
          lerpBloomFactor( bloomFactors[0] ) * vec4( bloomTintColors[0], 1.0 ) * texture2D( blurTexture1, vUv ) +
          lerpBloomFactor( bloomFactors[1] ) * vec4( bloomTintColors[1], 1.0 ) * texture2D( blurTexture2, vUv ) +
          lerpBloomFactor( bloomFactors[2] ) * vec4( bloomTintColors[2], 1.0 ) * texture2D( blurTexture3, vUv ) );
      }`,
  });
}

/** Never zero, so a one-pixel or odd drawing buffer still allocates a valid chain. */
function mipDimension(value: number): number {
  return Math.max(1, Math.round(value));
}

export interface SkyriverBloomSamplerRecord {
  readonly name: string;
  readonly uuid: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface SkyriverBloomEvidence {
  readonly implementation: 'skyriver.threeMipBloom' | 'three.UnrealBloomPass';
  readonly mips: number;
  readonly draws: number;
  readonly compositeSource: string;
  readonly strength: number;
  readonly radius: number;
  readonly threshold: number;
  readonly smoothWidth: number;
  readonly factors: readonly number[];
  readonly samplers: readonly SkyriverBloomSamplerRecord[];
  /** False when any declared sampler is unbound — the state `nMips = 3` alone would leave behind. */
  readonly complete: boolean;
}

export class SkyriverThreeMipBloomPass extends Pass {
  strength: number;
  radius: number;
  threshold: number;

  readonly materialHighPassFilter: THREE.ShaderMaterial;
  readonly resolution = new THREE.Vector2(1, 1);

  private readonly renderTargetBright: THREE.WebGLRenderTarget;
  private readonly renderTargetsHorizontal: THREE.WebGLRenderTarget[] = [];
  private readonly renderTargetsVertical: THREE.WebGLRenderTarget[] = [];
  private readonly separableBlurMaterials: THREE.ShaderMaterial[] = [];
  private readonly composite: THREE.ShaderMaterial;
  private readonly blendMaterial: THREE.ShaderMaterial;
  private readonly basic = new THREE.MeshBasicMaterial();
  /**
   * Built with a REAL owned material, declared above this line so it already exists here.
   *
   * `render` assigns one of the owned materials before every draw, but the quad must never hold a
   * null material in between: a double cast through `null as unknown as THREE.Material` makes an
   * illegal state representable and hides it from the type system until a draw dereferences it.
   */
  private readonly quad = new FullScreenQuad(this.basic);
  private readonly bloomTintColors: THREE.Vector3[] = [];
  private readonly clearColor = new THREE.Color(0, 0, 0);
  private readonly oldClearColor = new THREE.Color();
  private oldClearAlpha = 1;

  constructor(resolution: THREE.Vector2, strength: number, radius: number, threshold: number) {
    super();
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    this.resolution.set(resolution.x, resolution.y);
    this.needsSwap = false;

    let resx = mipDimension(this.resolution.x / 2);
    let resy = mipDimension(this.resolution.y / 2);

    this.renderTargetBright = new THREE.WebGLRenderTarget(resx, resy, { type: THREE.HalfFloatType });
    this.renderTargetBright.texture.name = 'skyriver.bloom3.bright';
    this.renderTargetBright.texture.generateMipmaps = false;

    for (let i = 0; i < SKYRIVER_BLOOM_MIPS; i += 1) {
      const horizontal = new THREE.WebGLRenderTarget(resx, resy, { type: THREE.HalfFloatType });
      horizontal.texture.name = `skyriver.bloom3.h${i}`;
      horizontal.texture.generateMipmaps = false;
      this.renderTargetsHorizontal.push(horizontal);

      const vertical = new THREE.WebGLRenderTarget(resx, resy, { type: THREE.HalfFloatType });
      vertical.texture.name = `skyriver.bloom3.v${i}`;
      vertical.texture.generateMipmaps = false;
      this.renderTargetsVertical.push(vertical);

      resx = mipDimension(resx / 2);
      resy = mipDimension(resy / 2);
    }

    const highPassUniforms = THREE.UniformsUtils.clone(LuminosityHighPassShader.uniforms);
    highPassUniforms['luminosityThreshold']!.value = threshold;
    highPassUniforms['smoothWidth']!.value = 0.01;
    this.materialHighPassFilter = new THREE.ShaderMaterial({
      name: 'skyriver.bloom3.highPass',
      uniforms: highPassUniforms,
      vertexShader: LuminosityHighPassShader.vertexShader,
      fragmentShader: LuminosityHighPassShader.fragmentShader,
    });

    resx = mipDimension(this.resolution.x / 2);
    resy = mipDimension(this.resolution.y / 2);
    for (let i = 0; i < SKYRIVER_BLOOM_MIPS; i += 1) {
      const material = blurMaterial(SKYRIVER_BLOOM_KERNELS[i]!);
      (material.uniforms.invSize!.value as THREE.Vector2).set(1 / resx, 1 / resy);
      this.separableBlurMaterials.push(material);
      resx = mipDimension(resx / 2);
      resy = mipDimension(resy / 2);
    }

    this.composite = compositeMaterial();
    this.composite.uniforms.blurTexture1!.value = this.renderTargetsVertical[0]!.texture;
    this.composite.uniforms.blurTexture2!.value = this.renderTargetsVertical[1]!.texture;
    this.composite.uniforms.blurTexture3!.value = this.renderTargetsVertical[2]!.texture;
    this.composite.uniforms.bloomStrength!.value = strength;
    this.composite.uniforms.bloomRadius!.value = 0.1;
    this.composite.uniforms.bloomFactors!.value = [...SKYRIVER_BLOOM_FACTORS];
    for (let i = 0; i < SKYRIVER_BLOOM_MIPS; i += 1) this.bloomTintColors.push(new THREE.Vector3(1, 1, 1));
    this.composite.uniforms.bloomTintColors!.value = this.bloomTintColors;

    const copyUniforms = THREE.UniformsUtils.clone(CopyShader.uniforms);
    this.blendMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.bloom3.blend',
      uniforms: copyUniforms,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
  }

  /** Matches `UnrealBloomPass.materialHighPassFilter.uniforms.smoothWidth`. */
  get smoothWidth(): number {
    return this.materialHighPassFilter.uniforms['smoothWidth']!.value as number;
  }

  set smoothWidth(value: number) {
    this.materialHighPassFilter.uniforms['smoothWidth']!.value = value;
  }

  /**
   * The material the fullscreen quad holds right now. Never null, from construction onward.
   *
   * Evidence for the one invariant the quad has: it is built with a real owned material, so there
   * is no window in which a draw could dereference a null one.
   */
  boundQuadMaterial(): THREE.Material {
    return this.quad.material;
  }

  setSize(width: number, height: number): void {
    let resx = mipDimension(width / 2);
    let resy = mipDimension(height / 2);
    this.resolution.set(Math.max(1, width), Math.max(1, height));
    this.renderTargetBright.setSize(resx, resy);

    for (let i = 0; i < SKYRIVER_BLOOM_MIPS; i += 1) {
      this.renderTargetsHorizontal[i]!.setSize(resx, resy);
      this.renderTargetsVertical[i]!.setSize(resx, resy);
      (this.separableBlurMaterials[i]!.uniforms.invSize!.value as THREE.Vector2).set(1 / resx, 1 / resy);
      resx = mipDimension(resx / 2);
      resy = mipDimension(resy / 2);
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    renderer.getClearColor(this.oldClearColor);
    this.oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(this.clearColor, 0);

    if (this.renderToScreen) {
      this.quad.material = this.basic;
      this.basic.map = readBuffer.texture;
      renderer.setRenderTarget(null);
      renderer.clear();
      this.quad.render(renderer);
    }

    // 1. Bright pass.
    this.materialHighPassFilter.uniforms['tDiffuse']!.value = readBuffer.texture;
    this.materialHighPassFilter.uniforms['luminosityThreshold']!.value = this.threshold;
    this.quad.material = this.materialHighPassFilter;
    renderer.setRenderTarget(this.renderTargetBright);
    renderer.clear();
    this.quad.render(renderer);

    // 2. Three horizontal/vertical blur pairs: six draws.
    let input = this.renderTargetBright;
    for (let i = 0; i < SKYRIVER_BLOOM_MIPS; i += 1) {
      const material = this.separableBlurMaterials[i]!;
      this.quad.material = material;

      material.uniforms.colorTexture!.value = input.texture;
      (material.uniforms.direction!.value as THREE.Vector2).set(1, 0);
      renderer.setRenderTarget(this.renderTargetsHorizontal[i]!);
      renderer.clear();
      this.quad.render(renderer);

      material.uniforms.colorTexture!.value = this.renderTargetsHorizontal[i]!.texture;
      (material.uniforms.direction!.value as THREE.Vector2).set(0, 1);
      renderer.setRenderTarget(this.renderTargetsVertical[i]!);
      renderer.clear();
      this.quad.render(renderer);

      input = this.renderTargetsVertical[i]!;
    }

    // 3. Composite the three levels into the pass's own target.
    this.quad.material = this.composite;
    this.composite.uniforms.bloomStrength!.value = this.strength;
    this.composite.uniforms.bloomRadius!.value = this.radius;
    renderer.setRenderTarget(this.renderTargetsHorizontal[0]!);
    renderer.clear();
    this.quad.render(renderer);

    // 4. Additive blend over the input, exactly where the legacy pass writes it.
    this.quad.material = this.blendMaterial;
    this.blendMaterial.uniforms['tDiffuse']!.value = this.renderTargetsHorizontal[0]!.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    this.quad.render(renderer);

    renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  /** Every declared composite sampler and its bound texture. Three complete bindings, or it fails. */
  evidence(): SkyriverBloomEvidence {
    const samplers: SkyriverBloomSamplerRecord[] = [];
    for (let i = 0; i < SKYRIVER_BLOOM_MIPS; i += 1) {
      const name = `blurTexture${i + 1}`;
      const texture = this.composite.uniforms[name]?.value as THREE.Texture | null | undefined;
      const target = this.renderTargetsVertical[i]!;
      samplers.push({
        name,
        uuid: texture?.uuid ?? null,
        width: texture === null || texture === undefined ? null : target.width,
        height: texture === null || texture === undefined ? null : target.height,
      });
    }
    return {
      implementation: 'skyriver.threeMipBloom',
      mips: SKYRIVER_BLOOM_MIPS,
      draws: SKYRIVER_BLOOM_DRAWS,
      compositeSource: this.composite.fragmentShader,
      strength: this.strength,
      radius: this.radius,
      threshold: this.threshold,
      smoothWidth: this.smoothWidth,
      factors: [...(this.composite.uniforms.bloomFactors!.value as number[])],
      samplers,
      complete: samplers.every((sampler) => sampler.uuid !== null),
    };
  }

  dispose(): void {
    for (const target of this.renderTargetsHorizontal) target.dispose();
    for (const target of this.renderTargetsVertical) target.dispose();
    this.renderTargetBright.dispose();
    for (const material of this.separableBlurMaterials) material.dispose();
    this.composite.dispose();
    this.blendMaterial.dispose();
    this.materialHighPassFilter.dispose();
    this.basic.dispose();
    // See volumeFog.ts: FullScreenQuad.dispose() releases three's shared fullscreen triangle, which
    // other passes still use. Every target and material this pass owns is released above.
  }
}

/**
 * The legacy five-level pass's own sampler bindings, for the A/B record.
 *
 * All five are read. A comparison that reports only the three levels the new pass has is not a safe
 * bloom comparison, and `nMips = 3` on this pass would leave samplers 4 and 5 bound to the targets
 * it no longer blurs.
 */
export function skyriverLegacyBloomEvidence(pass: {
  readonly compositeMaterial: THREE.ShaderMaterial;
  readonly renderTargetsVertical: readonly THREE.WebGLRenderTarget[];
  readonly nMips: number;
  readonly strength: number;
  readonly radius: number;
  readonly threshold: number;
  readonly materialHighPassFilter: THREE.ShaderMaterial;
}): SkyriverBloomEvidence {
  const samplers: SkyriverBloomSamplerRecord[] = [];
  for (let i = 0; i < SKYRIVER_LEGACY_BLOOM_MIPS; i += 1) {
    const name = `blurTexture${i + 1}`;
    const texture = pass.compositeMaterial.uniforms[name]?.value as THREE.Texture | null | undefined;
    const target = pass.renderTargetsVertical[i];
    samplers.push({
      name,
      uuid: texture?.uuid ?? null,
      width: target?.width ?? null,
      height: target?.height ?? null,
    });
  }
  return {
    implementation: 'three.UnrealBloomPass',
    mips: pass.nMips,
    draws: 1 + pass.nMips * 2 + 2,
    compositeSource: pass.compositeMaterial.fragmentShader,
    strength: pass.strength,
    radius: pass.radius,
    threshold: pass.threshold,
    smoothWidth: pass.materialHighPassFilter.uniforms['smoothWidth']!.value as number,
    factors: [...((pass.compositeMaterial.uniforms.bloomFactors!.value as number[]) ?? [])],
    samplers,
    complete: samplers.every((sampler) => sampler.uuid !== null),
  };
}
