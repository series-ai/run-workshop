/**
 * @file stageRoles.ts — declared opaque/transparent draw roles, and the two scene stages R23 needs.
 *
 * The volume pass has to blend between the opaque colour and the additive sources, so the scene is
 * drawn twice: once for the opaque roles, then the volume, then once for the transparent roles.
 * Each declared mesh draws exactly once across the two stages, so splitting the traversal costs no
 * extra draw calls. Frame listeners and every source update still run once, before the stages.
 *
 * Classification is DECLARED, not inferred. Each role is registered against an object reference at
 * creation, from the original constructor's own flags, and held in a map keyed by that reference. A
 * diagnostic that hides a layer, flips `visible`, or swaps in a source-ID material therefore cannot
 * reclassify anything.
 *
 * Mechanism. Stage selection uses two dedicated camera layers, not `visible`: the shuttle's
 * transparent plume is a CHILD of its opaque hull, and `visible = false` skips a whole subtree, so
 * hiding the hull would take the plume with it. Three filters layers per object and still descends
 * into children, which is exactly the behaviour a mixed-role parent needs. Every registered object
 * keeps its default layer 0, so the legacy single-pass path draws an unchanged scene.
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

import type { SkyriverDepthSnapshot } from './depthFade';

/**
 * The shared analytic-fog bypass, injected rather than imported.
 *
 * `atmosphere.ts` owns the uniform and `city.ts` reads the same gate, and both of those modules
 * declare their draw roles through this file. Taking the two functions as options keeps the
 * dependency one-way, and lets a node check drive a stage with a plain pair of closures.
 */
export interface SkyriverAnalyticFogControl {
  readonly set: (bypass: boolean) => void;
  readonly bypassed: () => boolean;
}

export type SkyriverStageRole = 'opaque' | 'transparent';

/** Dedicated channels, high in the mask, so a diagnostic using low layers cannot collide. */
export const SKYRIVER_OPAQUE_LAYER = 14;
export const SKYRIVER_TRANSPARENT_LAYER = 15;

/**
 * Where a constructor records its own draw role, so the module that builds a mesh is the module
 * that declares it.
 *
 * Traffic and the shuttle build their meshes outside this module and hand the scene a flat object
 * list. Declaring the role on the object itself at creation keeps the classification with the
 * constructor's own flags — rather than inferring it later from a material that a source-ID proof
 * may have swapped, or from a `visible` flag a layer proof may have cleared.
 */
export const SKYRIVER_STAGE_ROLE_KEY = 'skyriverStageRole';

/** Called by the constructor that builds the mesh. Idempotent; a conflicting re-declaration throws. */
export function skyriverDeclareStageRole(object: THREE.Object3D, role: SkyriverStageRole): void {
  const existing = object.userData[SKYRIVER_STAGE_ROLE_KEY] as SkyriverStageRole | undefined;
  if (existing !== undefined && existing !== role) {
    throw new Error(`SKYRIVER_STAGE_ROLE_REDECLARED:${object.name || object.uuid}:${existing}->${role}`);
  }
  object.userData[SKYRIVER_STAGE_ROLE_KEY] = role;
}

export function skyriverDeclaredStageRole(object: THREE.Object3D): SkyriverStageRole | null {
  const role = object.userData[SKYRIVER_STAGE_ROLE_KEY] as SkyriverStageRole | undefined;
  return role === 'opaque' || role === 'transparent' ? role : null;
}

/** Drawable classes. Anything of these in the graph must carry a declared role. */
function isDrawable(object: THREE.Object3D): boolean {
  const candidate = object as THREE.Object3D & {
    isMesh?: boolean;
    isPoints?: boolean;
    isLine?: boolean;
    isSprite?: boolean;
  };
  return candidate.isMesh === true
    || candidate.isPoints === true
    || candidate.isLine === true
    || candidate.isSprite === true;
}

export interface SkyriverStageCoverage {
  readonly opaque: readonly string[];
  readonly transparent: readonly string[];
  /** Drawable objects in the graph with no declared role. Must be empty, or a mesh draws twice. */
  readonly unregistered: readonly string[];
  /** Registered objects no longer in the graph. Harmless, but reported so a leak is visible. */
  readonly detached: readonly string[];
}

/**
 * The one owner of draw roles.
 *
 * `register` is idempotent: registering the same object with the same role twice converges on the
 * same layer state. Registering it with a different role is a mistake and throws rather than
 * silently reclassifying a mesh mid-session.
 */
export class SkyriverStageRegistry {
  private readonly roles = new Map<THREE.Object3D, SkyriverStageRole>();

  register(object: THREE.Object3D, role: SkyriverStageRole): void {
    const existing = this.roles.get(object);
    if (existing !== undefined && existing !== role) {
      throw new Error(`SKYRIVER_STAGE_ROLE_CONFLICT:${object.name || object.uuid}:${existing}->${role}`);
    }
    this.roles.set(object, role);
    // Layer 0 stays enabled: the legacy single-pass path must draw the same scene it always did.
    object.layers.enable(role === 'opaque' ? SKYRIVER_OPAQUE_LAYER : SKYRIVER_TRANSPARENT_LAYER);
  }

  /** Registers every object of a group, all in the same role. */
  registerAll(objects: Iterable<THREE.Object3D>, role: SkyriverStageRole): void {
    for (const object of objects) this.register(object, role);
  }

  /**
   * Registers every drawable under `root` from the role its own constructor declared.
   *
   * A drawable with no declaration throws: a mesh that reaches the graph without a role would draw
   * in both stages, which is exactly the failure the one-draw-per-mesh check exists to catch.
   */
  registerDeclared(root: THREE.Object3D): void {
    const missing: string[] = [];
    root.traverse((object) => {
      if (!isDrawable(object)) return;
      const role = skyriverDeclaredStageRole(object);
      if (role === null) {
        missing.push(object.name || object.uuid);
        return;
      }
      this.register(object, role);
    });
    if (missing.length > 0) throw new Error(`SKYRIVER_STAGE_ROLE_MISSING:${missing.join(',')}`);
  }

  unregister(object: THREE.Object3D): void {
    const role = this.roles.get(object);
    if (role === undefined) return;
    object.layers.disable(role === 'opaque' ? SKYRIVER_OPAQUE_LAYER : SKYRIVER_TRANSPARENT_LAYER);
    this.roles.delete(object);
  }

  roleOf(object: THREE.Object3D): SkyriverStageRole | null {
    return this.roles.get(object) ?? null;
  }

  size(): number {
    return this.roles.size;
  }

  /** Every drawable in the graph, split by declared role, plus whatever is missing a role. */
  coverage(scene: THREE.Object3D): SkyriverStageCoverage {
    const opaque: string[] = [];
    const transparent: string[] = [];
    const unregistered: string[] = [];
    const seen = new Set<THREE.Object3D>();
    scene.traverse((object) => {
      if (!isDrawable(object)) return;
      seen.add(object);
      const role = this.roles.get(object);
      const label = object.name || object.uuid;
      if (role === 'opaque') opaque.push(label);
      else if (role === 'transparent') transparent.push(label);
      else unregistered.push(label);
    });
    const detached: string[] = [];
    for (const object of this.roles.keys()) {
      if (!seen.has(object)) detached.push(object.name || object.uuid);
    }
    return { opaque, transparent, unregistered, detached };
  }
}

/** What each stage actually did, captured DURING the draw — before `finally` restores it. */
export interface SkyriverStageFlags {
  readonly stage: 'opaque' | 'transparent';
  readonly autoClear: boolean;
  readonly cleared: boolean;
  readonly cameraLayerMask: number;
  readonly backgroundIsNull: boolean;
  readonly analyticFogBypassed: boolean;
  readonly depthBeginSuppressed: boolean;
  readonly targetUuid: string | null;
  readonly depthTextureUuid: string | null;
}

export interface SkyriverOpaquePassOptions {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly registry: SkyriverStageRegistry;
  readonly depthFade: SkyriverDepthSnapshot;
  readonly analyticFog: SkyriverAnalyticFogControl;
  /** True while the R23 staged composition owns absorption. Off and Low never bypass. */
  readonly bypassAnalyticFog: () => boolean;
  /**
   * Diagnostic hook, called INSIDE this invocation right after the opaque depth capture.
   *
   * The documented depth-content procedure packs the attachment here and again after the volume
   * blend, both within one frame. A between-frames API cannot reach this moment, so without the
   * hook the two hashes would come from the same attachment state and compare it with itself.
   * Null by default: a normal frame pays one null check.
   */
  readonly onDepthCaptured?: () => void;
}

/**
 * Draws the opaque roles once into the composer's readBuffer, with the shared analytic haze and the
 * independent far-card layer haze bypassed, then captures the completed opaque depth snapshot.
 *
 * The capture is explicit and happens here, between the opaque draw and the volume: the volume
 * marches against finished depth, and the transparent stage's own callbacks reuse this same copy
 * rather than starting a second one.
 */
export class SkyriverOpaquePass extends Pass {
  private flags: SkyriverStageFlags | null = null;

  constructor(private readonly options: SkyriverOpaquePassOptions) {
    super();
    // The scene is drawn into readBuffer and stays there for the volume and transparent stages.
    this.needsSwap = false;
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    const { scene, camera, depthFade, analyticFog, bypassAnalyticFog } = this.options;
    const previousAutoClear = renderer.autoClear;
    const previousMask = camera.layers.mask;
    const previousBackground = scene.background;
    const previousBypass = analyticFog.bypassed();

    try {
      analyticFog.set(bypassAnalyticFog());
      camera.layers.set(SKYRIVER_OPAQUE_LAYER);
      renderer.autoClear = false;
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
      renderer.clear(true, true, true);

      this.flags = {
        stage: 'opaque',
        autoClear: renderer.autoClear,
        cleared: true,
        cameraLayerMask: camera.layers.mask,
        backgroundIsNull: scene.background === null,
        analyticFogBypassed: analyticFog.bypassed(),
        depthBeginSuppressed: depthFade.beginIsSuppressed(),
        targetUuid: readBuffer.texture.uuid,
        depthTextureUuid: readBuffer.depthTexture?.uuid ?? null,
      };

      renderer.render(scene, camera);
      // Completed opaque depth, captured once, explicitly, after the opaque roles and before the
      // volume. Adds no draw call: it is a framebuffer blit.
      depthFade.capture(renderer);
      // Diagnostic only, and inside the invocation: see `onDepthCaptured`.
      this.options.onDepthCaptured?.();
    } finally {
      // Exact restoration, on every path including a throw.
      camera.layers.mask = previousMask;
      scene.background = previousBackground;
      renderer.autoClear = previousAutoClear;
      analyticFog.set(previousBypass);
    }
  }

  /** The flags recorded inside the draw, not after restoration. */
  stageFlags(): SkyriverStageFlags | null {
    return this.flags;
  }
}

export interface SkyriverTransparentPassOptions {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly registry: SkyriverStageRegistry;
  readonly depthFade: SkyriverDepthSnapshot;
  readonly analyticFog: SkyriverAnalyticFogControl;
}

/**
 * Draws the transparent roles once over the volume result, into the same readBuffer and against the
 * same depth attachment.
 *
 * `autoClear` is false and the background is null, so nothing already composited is lost. These
 * meshes keep their own-depth analytic fog and penetration factors — that is R23's explicit
 * transparent approximation, and it is NOT marched absorption. The depth-begin reset is suppressed
 * for the duration, so the cloud, beam and plume callbacks reuse the completed opaque snapshot.
 */
export class SkyriverTransparentPass extends Pass {
  private flags: SkyriverStageFlags | null = null;

  constructor(private readonly options: SkyriverTransparentPassOptions) {
    super();
    this.needsSwap = false;
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    const { scene, camera, depthFade, analyticFog } = this.options;
    const previousAutoClear = renderer.autoClear;
    const previousMask = camera.layers.mask;
    const previousBackground = scene.background;
    const previousBypass = analyticFog.bypassed();
    const previousSuppressed = depthFade.beginIsSuppressed();

    try {
      // Own-source analytic fog stays on for these draws: the bypass is an opaque-stage control.
      analyticFog.set(false);
      depthFade.setBeginSuppressed(true);
      camera.layers.set(SKYRIVER_TRANSPARENT_LAYER);
      scene.background = null;
      renderer.autoClear = false;
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);

      this.flags = {
        stage: 'transparent',
        autoClear: renderer.autoClear,
        cleared: false,
        cameraLayerMask: camera.layers.mask,
        backgroundIsNull: scene.background === null,
        analyticFogBypassed: analyticFog.bypassed(),
        depthBeginSuppressed: depthFade.beginIsSuppressed(),
        targetUuid: readBuffer.texture.uuid,
        depthTextureUuid: readBuffer.depthTexture?.uuid ?? null,
      };

      renderer.render(scene, camera);
    } finally {
      depthFade.setBeginSuppressed(previousSuppressed);
      camera.layers.mask = previousMask;
      scene.background = previousBackground;
      renderer.autoClear = previousAutoClear;
      analyticFog.set(previousBypass);
    }
  }

  stageFlags(): SkyriverStageFlags | null {
    return this.flags;
  }
}

/**
 * A separate GPU depth-pack probe: writes the active depth attachment into its own colour target so
 * a readback can hash it.
 *
 * Diagnostic only. It owns its target, its draws are probes outside the normal call count and every
 * timing result, and it restores the render target it found. Comparing texture UUIDs alone does not
 * prove the depth CONTENT survived the volume blend; hashing a packed readback before and after
 * does.
 */
export class SkyriverDepthProbe {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private draws = 0;

  constructor(width = 1, height = 1) {
    this.target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    this.target.texture.name = 'skyriver.depthProbe';
    this.material = new THREE.ShaderMaterial({
      name: 'skyriver.depthProbe.pack',
      depthTest: false,
      depthWrite: false,
      uniforms: { uDepth: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      // 24 bits of the depth value across RGB, so a byte readback is a stable content hash.
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uDepth;
        void main() {
          float depth = clamp( texture2D( uDepth, vUv ).r, 0.0, 1.0 );
          vec3 packed = fract( depth * vec3( 1.0, 255.0, 65025.0 ) );
          packed -= packed.yzz * vec3( 1.0 / 255.0, 1.0 / 255.0, 0.0 );
          gl_FragColor = vec4( packed, 1.0 );
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(width: number, height: number): void {
    this.target.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
  }

  /** Packs `depth` and reads it back. Restores the render target it found. */
  pack(renderer: THREE.WebGLRenderer, depth: THREE.Texture): {
    readonly bytes: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly sourceUuid: string;
    readonly packingShader: string;
    readonly quantization: string;
    readonly probeDraws: number;
  } {
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    try {
      this.material.uniforms.uDepth!.value = depth;
      renderer.autoClear = false;
      renderer.setRenderTarget(this.target);
      this.quad.render(renderer);
      this.draws += 1;
      const bytes = new Uint8Array(this.target.width * this.target.height * 4);
      renderer.readRenderTargetPixels(this.target, 0, 0, this.target.width, this.target.height, bytes);
      return {
        bytes,
        width: this.target.width,
        height: this.target.height,
        sourceUuid: depth.uuid,
        packingShader: this.material.fragmentShader,
        quantization: '24-bit depth packed across RGB, 8 bits per channel, unsigned byte readback',
        probeDraws: this.draws,
      };
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget);
    }
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
    // See volumeFog.ts on FullScreenQuad.dispose() and three's shared fullscreen triangle.
  }
}
