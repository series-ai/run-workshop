import * as THREE from 'three';

export const SKYRIVER_VISIBILITY_FADE_METERS = 60;

export const SKYRIVER_DEPTH_FADE_GLSL = /* glsl */ `
uniform sampler2D uVisibilityDepth;
uniform vec2 uVisibilityResolution;
uniform vec2 uVisibilityCameraRange;
uniform float uVisibilityFadeEnabled;

float skyriverLinearViewDepth( float depth01 ) {
  float nearPlane = uVisibilityCameraRange.x;
  float farPlane = uVisibilityCameraRange.y;
  return nearPlane * farPlane / max( farPlane - depth01 * ( farPlane - nearPlane ), 1e-6 );
}

float skyriverVisibilityFade() {
  if ( uVisibilityFadeEnabled < 0.5 ) return 1.0;
  float sceneDepth = texture2D( uVisibilityDepth, gl_FragCoord.xy / max( uVisibilityResolution, vec2( 1.0 ) ) ).r;
  if ( sceneDepth >= 0.9999999 ) return 1.0;
  float fragmentDepth = skyriverLinearViewDepth( gl_FragCoord.z );
  float opaqueDepth = skyriverLinearViewDepth( sceneDepth );
  return smoothstep( 0.0, ${SKYRIVER_VISIBILITY_FADE_METERS.toFixed(1)}, opaqueDepth - fragmentDepth );
}
`;

export function linearViewDepth(depth01: number, near: number, far: number): number {
  const depth = Math.min(1, Math.max(0, depth01));
  return (near * far) / (far - depth * (far - near));
}

export function depthBufferFromViewDepth(viewDepth: number, near: number, far: number): number {
  const depth = Math.min(far, Math.max(near, viewDepth));
  return (far * (depth - near)) / (depth * (far - near));
}

function smoothstep01(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function depthVisibilityAlpha(
  fragmentDepth01: number,
  sceneDepth01: number,
  near: number,
  far: number,
  enabled = true,
): number {
  if (!enabled || sceneDepth01 >= 0.9999999) return 1;
  const gap = linearViewDepth(sceneDepth01, near, far) - linearViewDepth(fragmentDepth01, near, far);
  return smoothstep01(gap / SKYRIVER_VISIBILITY_FADE_METERS);
}

export function depthFadeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1;
}

function depthTexture(width: number, height: number): THREE.DepthTexture {
  const texture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  texture.format = THREE.DepthFormat;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// ---------------------------------------------------------------------------
// r170 depth copy adapter
//
// R20: the public `renderer.copyTextureToTexture` reaches the same `gl.blitFramebuffer` call this
// adapter makes, but it first reads five UNPACK_* settings with `gl.getParameter` (three.module.js
// r170, `copyTextureToTexture`). Those reads are synchronous driver queries and none of them affect
// a depth blit, which never touches the unpack path. The adapter resolves the two owned framebuffer
// handles instead and submits the blit directly, so a frame costs no GL queries.
// ---------------------------------------------------------------------------

/** How the snapshot submitted its last copy. Reported in `stats()` for the GPU probes. */
export type SkyriverDepthCopyMethod = 'none' | 'blit' | 'public-copy';

/** Why a frame cannot blit. A closed set, so a probe or test can match on the exact cause. */
export type SkyriverDepthCopyFallback =
  | 'webgl2-unavailable'
  | 'blit-validation-failed'
  | 'source-layout-unsupported'
  | 'destination-layout-unsupported'
  | 'source-framebuffer-unsupported'
  | 'destination-framebuffer-unsupported'
  | 'size-mismatch';

/** A resolved copy plan. `blit` carries the validated framebuffer pair and the copy rectangle. */
export type SkyriverDepthCopyPlan =
  | {
    readonly method: 'blit';
    readonly read: WebGLFramebuffer;
    readonly draw: WebGLFramebuffer;
    readonly width: number;
    readonly height: number;
  }
  | { readonly method: 'public-copy'; readonly reason: SkyriverDepthCopyFallback };

/** The read-only slice of r170 `renderer.properties` (`WebGLProperties`) this adapter reads. */
export type SkyriverRendererProperties = { get(object: unknown): unknown };

/** The r170 render-target record fields the adapter reads. Both stay `unknown` until validated. */
type RenderTargetRecord = {
  readonly __webglFramebuffer?: unknown;
  readonly __webglMultisampledFramebuffer?: unknown;
};

function renderTargetRecord(
  properties: SkyriverRendererProperties,
  target: THREE.WebGLRenderTarget,
): RenderTargetRecord {
  const record = properties.get(target);
  return typeof record === 'object' && record !== null ? (record as RenderTargetRecord) : {};
}

/**
 * Reads a target's r170 framebuffer handle without validating it. r170 deletes the record and
 * builds a new handle whenever it sets a target up (`setupRenderTarget`, after a resize, dispose or
 * context restore), so an identity match proves a cached plan still describes live framebuffers.
 * That keeps `gl.getParameter` and `gl.isFramebuffer` out of the per-frame path.
 */
export function readTargetFramebuffer(
  properties: SkyriverRendererProperties,
  target: THREE.WebGLRenderTarget,
): unknown {
  return renderTargetRecord(properties, target).__webglFramebuffer;
}

/**
 * `WebGLFramebuffer` is an opaque host object with no own members, so a handle is checked against
 * the platform constructor where one exists (every browser) and by shape otherwise (node tests).
 * Arrays are rejected: r170 stores arrays for cube and mipmap-level layouts, which need a different
 * blit for every face or level.
 */
function isFramebufferHandle(value: unknown): value is WebGLFramebuffer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const handleType = (globalThis as { readonly WebGLFramebuffer?: unknown }).WebGLFramebuffer;
  return typeof handleType !== 'function' || value instanceof handleType;
}

/** The single-sample depth-texture layout a `DEPTH_BUFFER_BIT` blit can copy between. */
function isBlitLayout(target: THREE.WebGLRenderTarget): boolean {
  const depth = target.depthTexture;
  return target.samples === 0
    && target.depthBuffer
    && depth !== null
    && depth.format === THREE.DepthFormat
    && depth.type === THREE.UnsignedIntType;
}

/**
 * Validates both owned targets at the adapter boundary and returns the plan capture must run. Pure:
 * it only reads. Call it when a target is set up or recreated, not every frame.
 */
export function resolveDepthCopyPlan(
  properties: SkyriverRendererProperties,
  source: THREE.WebGLRenderTarget,
  destination: THREE.WebGLRenderTarget,
): SkyriverDepthCopyPlan {
  if (!isBlitLayout(source)) return { method: 'public-copy', reason: 'source-layout-unsupported' };
  if (!isBlitLayout(destination)) return { method: 'public-copy', reason: 'destination-layout-unsupported' };
  if (source.width !== destination.width || source.height !== destination.height) {
    return { method: 'public-copy', reason: 'size-mismatch' };
  }

  const sourceRecord = renderTargetRecord(properties, source);
  const destinationRecord = renderTargetRecord(properties, destination);
  // A multisampled framebuffer means three draws into renderbuffers and resolves on unbind, so the
  // single-sample handle is not the live depth surface.
  if (!isFramebufferHandle(sourceRecord.__webglFramebuffer)
    || sourceRecord.__webglMultisampledFramebuffer !== undefined) {
    return { method: 'public-copy', reason: 'source-framebuffer-unsupported' };
  }
  if (!isFramebufferHandle(destinationRecord.__webglFramebuffer)
    || destinationRecord.__webglMultisampledFramebuffer !== undefined) {
    return { method: 'public-copy', reason: 'destination-framebuffer-unsupported' };
  }

  return {
    method: 'blit',
    read: sourceRecord.__webglFramebuffer,
    draw: destinationRecord.__webglFramebuffer,
    width: source.width,
    height: source.height,
  };
}

/** The handles a cached plan was built from. An identity change means three rebuilt the target. */
type DepthCopyRoute = {
  readonly sourceHandle: unknown;
  readonly destinationHandle: unknown;
  readonly plan: SkyriverDepthCopyPlan;
};

/** This frame's copy inputs, proven non-null and owned by this snapshot. */
type DepthCaptureTargets = {
  readonly source: THREE.WebGLRenderTarget;
  readonly sourceDepth: THREE.DepthTexture;
  readonly destination: THREE.WebGLRenderTarget;
  readonly destinationDepth: THREE.DepthTexture;
};

function asWebGL2(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGL2RenderingContext | null {
  return 'blitFramebuffer' in gl && typeof gl.blitFramebuffer === 'function' ? gl : null;
}

function drainGlErrors(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  for (let i = 0; i < 16; i += 1) {
    if (gl.getError() === gl.NO_ERROR) break;
  }
}

export interface SkyriverDepthSnapshotStats {
  readonly supported: boolean;
  readonly allowed: boolean;
  /** Set by a reader other than the beam fade (the R23 volume) that needs the copy. */
  readonly snapshotRequired: boolean;
  readonly copied: boolean;
  readonly enabled: boolean;
  /** A capture can succeed on this context: WebGL 2 and no rejected copy. */
  readonly canCapture: boolean;
  /** This frame holds a usable copy. Independent of the beam-fade A/B switch. */
  readonly snapshotValid: boolean;
  readonly copyMethod: SkyriverDepthCopyMethod;
  readonly copyFallback: SkyriverDepthCopyFallback | null;
  readonly copyValidated: boolean;
  readonly copyCount: number;
  readonly copyError: number | null;
  readonly width: number;
  readonly height: number;
}

/** Copies the completed opaque depth once per scene render for the additive visibility shaders. */
export class SkyriverDepthSnapshot {
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly supported: boolean;

  private readonly snapshotTarget: THREE.WebGLRenderTarget | null;
  private readonly snapshotDepth: THREE.DepthTexture | null;
  private readonly fallbackDepth: THREE.DataTexture;
  private readonly sources: readonly THREE.WebGLRenderTarget[];
  private readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  private readonly gl2: WebGL2RenderingContext | null;
  private readonly routes = new WeakMap<THREE.WebGLRenderTarget, DepthCopyRoute>();
  private readonly validated = new Set<SkyriverDepthCopyMethod>();
  private sourceTarget: THREE.WebGLRenderTarget | null = null;
  private sourceDepth: THREE.DepthTexture | null = null;
  private copied = false;
  private allowed = true;
  private snapshotRequired = false;
  private copyFailed = false;
  private blitRejected = false;
  private copyMethod: SkyriverDepthCopyMethod = 'none';
  private copyFallback: SkyriverDepthCopyFallback | null = null;
  private copyError: number | null = null;
  private copyCount = 0;
  private beginSuppressed = false;
  private width = 1;
  private height = 1;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    composerTargets: readonly THREE.WebGLRenderTarget[],
  ) {
    this.supported = renderer.capabilities.isWebGL2;
    this.sources = [...composerTargets];
    this.gl = renderer.getContext();
    this.gl2 = asWebGL2(this.gl);
    this.fallbackDepth = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    this.fallbackDepth.minFilter = THREE.NearestFilter;
    this.fallbackDepth.magFilter = THREE.NearestFilter;
    this.fallbackDepth.generateMipmaps = false;
    this.fallbackDepth.needsUpdate = true;

    if (this.supported) {
      for (const target of this.sources) {
        target.depthBuffer = true;
        target.depthTexture = depthTexture(target.width, target.height);
      }
      this.snapshotTarget = new THREE.WebGLRenderTarget(1, 1, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
      });
      this.snapshotDepth = depthTexture(1, 1);
      this.snapshotTarget.depthTexture = this.snapshotDepth;
    } else {
      this.snapshotTarget = null;
      this.snapshotDepth = null;
      console.warn('[skyriver] depth visibility fade disabled: WebGL 2 is not available');
    }

    this.uniforms = {
      uVisibilityDepth: { value: this.snapshotDepth ?? this.fallbackDepth },
      uVisibilityResolution: { value: new THREE.Vector2(1, 1) },
      uVisibilityCameraRange: { value: new THREE.Vector2(1, 14000) },
      uVisibilityFadeEnabled: { value: 0 },
    };

    if (this.supported) {
      for (const target of this.sources) this.prepareTarget(target);
      if (this.snapshotTarget !== null) this.prepareTarget(this.snapshotTarget);
      this.primeRoutes();
    }
  }

  /**
   * Makes r170 allocate a target's framebuffer and depth attachment. Setting the render target is
   * the only public way to do it; the active target is restored, and a second call is a no-op.
   */
  private prepareTarget(target: THREE.WebGLRenderTarget): void {
    const previous = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(target);
    } finally {
      this.renderer.setRenderTarget(previous);
    }
  }

  /** Validates the owned handles once per setup, so the usual frame reaches a cached plan. */
  private primeRoutes(): void {
    const destination = this.snapshotTarget;
    if (destination === null) return;
    for (const source of this.sources) this.copyPlan(source, destination);
  }

  /**
   * The BEAM-FADE A/B switch. It gates the fade the additive shaders apply, and nothing else.
   *
   * It deliberately does NOT gate the capture any more. The R23 volume marcher needs a valid
   * opaque depth snapshot to know where the surfaces are, so tying the snapshot to this switch made
   * one A/B change two things: turning the beam fade off also made the marcher run every ray
   * through the walls. The copy is now requested independently — see `setSnapshotRequired` — and
   * the volume reads `opaqueSnapshotValid`, not this flag.
   */
  setAllowed(allowed: boolean): void {
    this.allowed = allowed;
    this.updateEnabledUniform();
  }

  /**
   * Declares that something OTHER than the beam fade needs the opaque depth copy this frame.
   *
   * The R23 staged chain sets it from the composition plan. With it set, the capture runs even
   * while the beam-fade A/B is off, so the two switches are independent again. It costs the same
   * one framebuffer blit the fade already paid for, and no draw call.
   */
  setSnapshotRequired(required: boolean): void {
    this.snapshotRequired = required;
  }

  /**
   * Whether a capture CAN succeed on this context: WebGL 2, and no copy has been rejected.
   *
   * This is a capability, readable before the frame's own capture has run, which is what a plan
   * has to decide on. `opaqueSnapshotValid` is the stronger per-frame fact.
   */
  canCaptureOpaqueDepth(): boolean {
    return this.supported && !this.copyFailed;
  }

  /**
   * Whether THIS frame holds a usable opaque depth copy, independent of the beam-fade A/B switch.
   *
   * The volume marcher's precondition. `depthIsValid` answers the different question "is the beam
   * fade live", which also requires `allowed`.
   */
  opaqueSnapshotValid(): boolean {
    return this.supported && !this.copyFailed && this.copied;
  }

  resize(width: number, height: number): void {
    this.width = depthFadeDimension(width);
    this.height = depthFadeDimension(height);
    (this.uniforms.uVisibilityResolution!.value as THREE.Vector2).set(this.width, this.height);
    if (this.snapshotTarget === null) return;

    // setSize disposes the target when the size changes, which deletes the framebuffer: prepare it
    // again and revalidate both handles before the next capture.
    this.snapshotTarget.setSize(this.width, this.height);
    this.prepareTarget(this.snapshotTarget);
    this.primeRoutes();
  }

  /**
   * R23: suppresses the per-render reset for the duration of one stage.
   *
   * The R23 transparent stage is a second `renderer.render` call on the same frame, which fires
   * `scene.onBeforeRender` again. Letting it reset would drop the completed opaque snapshot and
   * make the first transparent draw start a fresh copy lifecycle against a depth buffer that now
   * holds nothing new. With the reset suppressed, the cloud, beam and plume callbacks reuse the
   * snapshot captured explicitly after the opaque stage, and no second blit happens.
   */
  setBeginSuppressed(suppressed: boolean): void {
    this.beginSuppressed = suppressed;
  }

  /** Whether the per-render reset is currently suppressed. Reported in the stage evidence. */
  beginIsSuppressed(): boolean {
    return this.beginSuppressed;
  }

  /**
   * The owned COPY of the completed opaque depth: what the additive shaders sample and what the R23
   * volume marches against. Null when unsupported.
   *
   * This is not the attachment the scene drew into. For that, see `opaqueDepthAttachment`.
   */
  depthTexture(): THREE.Texture | null {
    return (this.uniforms.uVisibilityDepth!.value as THREE.Texture | null) ?? null;
  }

  /**
   * The ORIGINAL opaque depth attachment: the depth texture of the composer target this frame's
   * scene render was drawn into, or null when no render has claimed one (unsupported context, or
   * before the first scene render).
   *
   * Nothing samples this during a frame. It is the surface a diagnostic has to pack and hash to
   * show that the volume blend left the real depth buffer's CONTENT alone — comparing the copy
   * against itself cannot show that.
   */
  opaqueDepthAttachment(): THREE.DepthTexture | null {
    return this.sourceDepth;
  }

  /** True when this frame actually holds a usable opaque depth copy. */
  depthIsValid(): boolean {
    return (this.uniforms.uVisibilityFadeEnabled!.value as number) > 0.5;
  }

  beginSceneRender(camera: THREE.Camera): void {
    if (this.beginSuppressed) return;
    const target = this.renderer.getRenderTarget();
    this.sourceTarget = this.supported && target !== null ? target : null;
    this.sourceDepth = this.sourceTarget?.depthTexture ?? null;
    this.copied = false;
    const range = this.uniforms.uVisibilityCameraRange!.value as THREE.Vector2;
    if (camera instanceof THREE.PerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera;
      range.set(perspective.near, perspective.far);
    }
    this.updateEnabledUniform();
  }

  capture(renderer: THREE.WebGLRenderer): void {
    const targets = this.copied ? null : this.captureTargets(renderer);
    if (targets === null) {
      this.updateEnabledUniform();
      return;
    }

    // `method` stays 'none' until a plan is resolved, so a throw from the boundary itself disables
    // the fade instead of demoting the blit.
    let method: SkyriverDepthCopyMethod = 'none';
    try {
      const plan = this.copyPlan(targets.source, targets.destination);
      method = plan.method;
      this.copyMethod = method;
      this.copyFallback = plan.method === 'public-copy' ? plan.reason : null;

      const validate = !this.validated.has(method);
      if (validate) drainGlErrors(this.gl);
      if (plan.method === 'blit') this.blitDepth(plan);
      else this.publicCopyDepth(renderer, targets);
      if (validate) {
        this.validated.add(method);
        const error = this.gl.getError();
        if (error !== this.gl.NO_ERROR) {
          this.rejectCopy(method, error);
          this.updateEnabledUniform();
          return;
        }
      }
      this.copied = true;
      this.copyCount += 1;
    } catch {
      if (method !== 'none') this.validated.add(method);
      this.rejectCopy(method, null);
    }
    this.updateEnabledUniform();
  }

  /**
   * One framebuffer blit, submitted with no GL queries. Both bindings go through `renderer.state`,
   * so three's framebuffer cache keeps matching the driver: the read binding returns to null like
   * three's own copy path, and the draw binding returns to the blit source, which `captureTargets`
   * proved is the active render target. The active target itself never changes, so three keeps its
   * current material bindings.
   *
   * Like three's copy path, the blit is subject to the scissor box; both owned targets render with
   * `scissorTest` false over the full target, so the copy covers the whole depth buffer.
   */
  private blitDepth(plan: Extract<SkyriverDepthCopyPlan, { method: 'blit' }>): void {
    const gl = this.gl2;
    if (gl === null) throw new Error('[skyriver] depth snapshot blit needs a WebGL 2 context');
    const state = this.renderer.state;
    try {
      state.bindFramebuffer(gl.READ_FRAMEBUFFER, plan.read);
      state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, plan.draw);
      gl.blitFramebuffer(
        0, 0, plan.width, plan.height,
        0, 0, plan.width, plan.height,
        gl.DEPTH_BUFFER_BIT,
        gl.NEAREST,
      );
    } finally {
      state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, plan.read);
    }
  }

  /** Documented fallback for renderer layouts the adapter does not own. */
  private publicCopyDepth(renderer: THREE.WebGLRenderer, targets: DepthCaptureTargets): void {
    const activeTarget = renderer.getRenderTarget();
    try {
      renderer.copyTextureToTexture(targets.sourceDepth, targets.destinationDepth);
    } finally {
      // three's copy path leaves both framebuffer bindings at null, so the active target must be set
      // again rather than rebound by handle.
      renderer.setRenderTarget(activeTarget);
    }
  }

  /**
   * A failed copy keeps the one-time validation: a rejected blit falls back to the public copy path
   * (validated once in turn), and a rejected public copy disables the fade.
   */
  private rejectCopy(method: SkyriverDepthCopyMethod, error: number | null): void {
    this.copyError = error;
    const reported = error === null ? 'threw' : `gl error ${error}`;
    if (method === 'blit') {
      this.blitRejected = true;
      console.warn(`[skyriver] depth snapshot blit rejected (${reported}); using renderer.copyTextureToTexture`);
      return;
    }
    this.copyFailed = true;
    console.warn(`[skyriver] depth visibility fade disabled: depth snapshot copy failed (${method}, ${reported})`);
  }

  /**
   * The plan for this frame. The cached plan is reused while both framebuffer handles keep their
   * identity; a resize, dispose or context restore replaces a handle and revalidates the boundary.
   */
  private copyPlan(
    source: THREE.WebGLRenderTarget,
    destination: THREE.WebGLRenderTarget,
  ): SkyriverDepthCopyPlan {
    if (this.gl2 === null) return { method: 'public-copy', reason: 'webgl2-unavailable' };
    if (this.blitRejected) return { method: 'public-copy', reason: 'blit-validation-failed' };

    const properties = this.renderer.properties;
    const sourceHandle = readTargetFramebuffer(properties, source);
    let destinationHandle = readTargetFramebuffer(properties, destination);
    if (destinationHandle === undefined) {
      // The snapshot target has no GL resources yet (first frame, or a context restore wiped them).
      this.prepareTarget(destination);
      destinationHandle = readTargetFramebuffer(properties, destination);
    }

    const cached = this.routes.get(source);
    if (cached !== undefined
      && cached.sourceHandle === sourceHandle
      && cached.destinationHandle === destinationHandle) {
      return cached.plan;
    }

    const plan = resolveDepthCopyPlan(properties, source, destination);
    this.routes.set(source, { sourceHandle, destinationHandle, plan });
    return plan;
  }

  /** This frame's copy inputs, or null when the frame must not copy. */
  private captureTargets(renderer: THREE.WebGLRenderer): DepthCaptureTargets | null {
    // The fade's own A/B switch no longer gates the copy on its own: a reader that declared it
    // needs the snapshot (the R23 volume) keeps it alive. See `setSnapshotRequired`.
    if (!(this.allowed || this.snapshotRequired) || !this.supported || this.copyFailed) return null;
    if (renderer !== this.renderer) return null;

    const source = this.sourceTarget;
    const sourceDepth = this.sourceDepth;
    const destination = this.snapshotTarget;
    const destinationDepth = this.snapshotDepth;
    if (source === null || sourceDepth === null || destination === null || destinationDepth === null) return null;
    if (source !== renderer.getRenderTarget()) return null;
    if (source.width !== this.width || source.height !== this.height) return null;

    return { source, sourceDepth, destination, destinationDepth };
  }

  private updateEnabledUniform(): void {
    this.uniforms.uVisibilityFadeEnabled!.value = this.allowed
      && this.supported
      && !this.copyFailed
      && this.copied
      ? 1
      : 0;
  }

  stats(): SkyriverDepthSnapshotStats {
    return {
      supported: this.supported,
      allowed: this.allowed,
      snapshotRequired: this.snapshotRequired,
      copied: this.copied,
      enabled: this.uniforms.uVisibilityFadeEnabled!.value === 1,
      canCapture: this.canCaptureOpaqueDepth(),
      snapshotValid: this.opaqueSnapshotValid(),
      copyMethod: this.copyMethod,
      copyFallback: this.copyFallback,
      copyValidated: this.validated.has(this.copyMethod),
      copyCount: this.copyCount,
      copyError: this.copyError,
      width: this.width,
      height: this.height,
    };
  }

  dispose(): void {
    this.snapshotTarget?.dispose();
    this.fallbackDepth.dispose();
  }
}
