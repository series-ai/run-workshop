import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  SKYRIVER_FOG_DITHER_LEVELS,
  SKYRIVER_FOG_MIDBAND,
  skyriverFogDither,
  skyriverFogMidbandResponse,
} from '../src/render/atmosphere';
import {
  SKYRIVER_CONTACT_AO,
  contactShadowFactor,
  contactTopEdgeFactor,
} from '../src/render/city';
import {
  SKYRIVER_VISIBILITY_FADE_METERS,
  SkyriverDepthSnapshot,
  depthBufferFromViewDepth,
  depthFadeDimension,
  depthVisibilityAlpha,
  linearViewDepth,
  readTargetFramebuffer,
  resolveDepthCopyPlan,
} from '../src/render/depthFade';

describe('R20 visibility response', () => {
  it('linearizes perspective depth across near, middle, and far view distances', () => {
    const near = 1;
    const far = 14000;
    for (const viewDepth of [near, 2, 12, 250, 2400, 9000, far]) {
      const encoded = depthBufferFromViewDepth(viewDepth, near, far);
      expect(encoded).toBeGreaterThanOrEqual(0);
      expect(encoded).toBeLessThanOrEqual(1);
      expect(linearViewDepth(encoded, near, far)).toBeCloseTo(viewDepth, 6);
    }
  });

  it('fades monotonically across a 60 m opaque intersection', () => {
    const near = 1;
    const far = 14000;
    const fragment = depthBufferFromViewDepth(500, near, far);
    expect(SKYRIVER_VISIBILITY_FADE_METERS).toBe(60);
    expect(depthVisibilityAlpha(fragment, depthBufferFromViewDepth(500, near, far), near, far)).toBe(0);
    expect(depthVisibilityAlpha(fragment, depthBufferFromViewDepth(530, near, far), near, far)).toBeCloseTo(0.5, 8);

    let previous = 0;
    for (let gap = 1; gap <= SKYRIVER_VISIBILITY_FADE_METERS; gap += 1) {
      const scene = depthBufferFromViewDepth(500 + gap, near, far);
      const alpha = depthVisibilityAlpha(fragment, scene, near, far);
      expect(alpha).toBeGreaterThanOrEqual(previous);
      previous = alpha;
    }
    expect(previous).toBe(1);
  });

  it('does not clip sky depth and returns full visibility when disabled', () => {
    const near = 1;
    const far = 14000;
    const fragment = depthBufferFromViewDepth(300, near, far);
    expect(depthVisibilityAlpha(fragment, 1, near, far)).toBe(1);
    expect(depthVisibilityAlpha(fragment, depthBufferFromViewDepth(301, near, far), near, far, false)).toBe(1);
  });

  it('uses integer drawing-buffer dimensions with a safe minimum', () => {
    expect(depthFadeDimension(1920.8)).toBe(1920);
    expect(depthFadeDimension(0)).toBe(1);
    expect(depthFadeDimension(Number.NaN)).toBe(1);
  });
});

describe('R20 contact shading and haze', () => {
  it('softens the contact shadow over 60 m and keeps the legacy A/B response', () => {
    expect(SKYRIVER_CONTACT_AO.tunedMinimum).toBe(0.6);
    expect(SKYRIVER_CONTACT_AO.tunedHeightM).toBe(60);
    expect(contactShadowFactor(0)).toBe(0.6);
    expect(contactShadowFactor(30)).toBeGreaterThan(0.6);
    expect(contactShadowFactor(30)).toBeLessThan(1);
    expect(contactShadowFactor(60)).toBe(1);
    expect(contactShadowFactor(0, false)).toBe(0.35);
    expect(contactShadowFactor(40, false)).toBe(1);
  });

  it('adds only a subtle top edge shade in the tuned response', () => {
    expect(contactTopEdgeFactor(0)).toBeCloseTo(1 - SKYRIVER_CONTACT_AO.topEdgeDarken, 8);
    expect(contactTopEdgeFactor(SKYRIVER_CONTACT_AO.topEdgeWidthM)).toBe(1);
    expect(contactTopEdgeFactor(0, false)).toBe(1);
  });

  it('widens midband haze without lifting the low gate or changing the legacy path', () => {
    const oldAtHighMid = Math.exp(-(((1500 - SKYRIVER_FOG_MIDBAND.center) / SKYRIVER_FOG_MIDBAND.legacySpread) ** 2));
    expect(skyriverFogMidbandResponse(1500, false)).toBeCloseTo(oldAtHighMid, 12);
    expect(skyriverFogMidbandResponse(350)).toBeCloseTo(skyriverFogMidbandResponse(350, false), 12);
    expect(skyriverFogMidbandResponse(1500)).toBeGreaterThan(oldAtHighMid);
  });

  it('uses bounded three-tap dither with zero mean', () => {
    expect(SKYRIVER_FOG_DITHER_LEVELS).toBe(255);
    expect(skyriverFogDither([0.5, 0.5, 0.5], 1)).toBe(0);
    expect(Math.abs(skyriverFogDither([1, 0, 0], 1))).toBeLessThanOrEqual(0.5 / 255);
    expect(Math.abs(skyriverFogDither([0, 1, 1], 1))).toBeLessThanOrEqual(0.5 / 255);
    expect(skyriverFogDither([0, 0, 0], 0)).toBe(0);
    expect(skyriverFogDither([1, 0, 0], 1, 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R21 depth copy adapter. The fake renderer mirrors the r170 contract the adapter depends on:
// setting a render target allocates `__webglFramebuffer`, disposing a target deletes the record,
// and `properties.get` always answers with a record. Its GL context has no `getParameter` or
// `isFramebuffer`, so any per-frame query from the copy path fails the test instead of passing
// silently. Real-GPU verification stays with the coordinator's probe.
// ---------------------------------------------------------------------------

const GL_FRAMEBUFFER = 0x8d40;
const GL_READ_FRAMEBUFFER = 0x8ca8;
const GL_DRAW_FRAMEBUFFER = 0x8ca9;
const GL_DEPTH_BUFFER_BIT = 0x0100;
const GL_NEAREST = 0x2600;
const GL_INVALID_OPERATION = 0x0502;

type FakeBinding = { readonly target: number; readonly framebuffer: unknown };

function createFakeRenderer(options: { readonly isWebGL2?: boolean } = {}) {
  const records = new Map<unknown, Record<string, unknown>>();
  const tracked = new Set<THREE.WebGLRenderTarget>();
  const bindings: FakeBinding[] = [];
  const blits: number[][] = [];
  const copies: Array<{ readonly source: unknown; readonly destination: unknown }> = [];
  const errors: number[] = [];
  const failures = { blit: 0, copy: 0 };
  let errorCalls = 0;
  let handles = 0;
  let active: THREE.WebGLRenderTarget | null = null;

  function record(object: unknown): Record<string, unknown> {
    const found = records.get(object);
    if (found !== undefined) return found;
    const created: Record<string, unknown> = {};
    records.set(object, created);
    return created;
  }

  function setup(target: THREE.WebGLRenderTarget): void {
    if (!tracked.has(target)) {
      tracked.add(target);
      target.addEventListener('dispose', () => {
        records.delete(target);
        if (target.depthTexture !== null) records.delete(target.depthTexture);
      });
    }
    const entry = record(target);
    if (entry.__webglFramebuffer === undefined) {
      handles += 1;
      entry.__webglFramebuffer = { handle: handles };
    }
  }

  const gl = {
    NO_ERROR: 0,
    READ_FRAMEBUFFER: GL_READ_FRAMEBUFFER,
    DRAW_FRAMEBUFFER: GL_DRAW_FRAMEBUFFER,
    DEPTH_BUFFER_BIT: GL_DEPTH_BUFFER_BIT,
    NEAREST: GL_NEAREST,
    getError(): number {
      errorCalls += 1;
      return errors.length > 0 ? errors.shift()! : 0;
    },
    blitFramebuffer(...args: number[]): void {
      blits.push(args);
      if (failures.blit !== 0) {
        errors.push(failures.blit);
        failures.blit = 0;
      }
    },
    getParameter(name: number): never {
      throw new Error(`gl.getParameter(${name}) must not run in the depth snapshot path`);
    },
    isFramebuffer(): never {
      throw new Error('gl.isFramebuffer must not run in the depth snapshot path');
    },
  };

  const renderer = {
    capabilities: { isWebGL2: options.isWebGL2 ?? true },
    properties: { get: (object: unknown) => record(object) },
    state: {
      bindFramebuffer(target: number, framebuffer: unknown): void {
        bindings.push({ target, framebuffer });
      },
    },
    getContext: () => gl,
    getRenderTarget: () => active,
    setRenderTarget(target: THREE.WebGLRenderTarget | null): void {
      active = target;
      if (target !== null) setup(target);
    },
    copyTextureToTexture(source: unknown, destination: unknown): void {
      copies.push({ source, destination });
      if (failures.copy !== 0) {
        errors.push(failures.copy);
        failures.copy = 0;
      }
    },
  };

  return {
    renderer,
    asRenderer: renderer as unknown as THREE.WebGLRenderer,
    properties: renderer.properties,
    bindings,
    blits,
    copies,
    failures,
    record,
    handleOf: (target: THREE.WebGLRenderTarget) => record(target).__webglFramebuffer,
    errorCalls: () => errorCalls,
  };
}

/** Drives one composer frame: bind the source target, open the frame, then capture. */
function captureFrame(
  fake: ReturnType<typeof createFakeRenderer>,
  snapshot: SkyriverDepthSnapshot,
  source: THREE.WebGLRenderTarget,
  camera: THREE.PerspectiveCamera,
): void {
  fake.renderer.setRenderTarget(source);
  snapshot.beginSceneRender(camera);
  snapshot.capture(fake.asRenderer);
}

function createSnapshot(width = 8, height = 4, options: { readonly isWebGL2?: boolean } = {}) {
  const fake = createFakeRenderer(options);
  const source = new THREE.WebGLRenderTarget(width, height);
  const snapshot = new SkyriverDepthSnapshot(fake.asRenderer, [source]);
  snapshot.resize(width, height);
  return { fake, source, snapshot, camera: new THREE.PerspectiveCamera(60, 2, 1, 14000) };
}

function targetWithDepth(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height);
  const depth = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  depth.format = THREE.DepthFormat;
  target.depthBuffer = true;
  target.depthTexture = depth;
  return target;
}

describe('R21 depth copy plan boundary', () => {
  it('accepts a single-sample pair of owned targets and reports the blit rectangle', () => {
    const fake = createFakeRenderer();
    const source = targetWithDepth(8, 4);
    const destination = targetWithDepth(8, 4);
    fake.renderer.setRenderTarget(source);
    fake.renderer.setRenderTarget(destination);

    const plan = resolveDepthCopyPlan(fake.properties, source, destination);
    expect(plan).toEqual({
      method: 'blit',
      read: fake.handleOf(source),
      draw: fake.handleOf(destination),
      width: 8,
      height: 4,
    });
    expect(readTargetFramebuffer(fake.properties, source)).toBe(fake.handleOf(source));
  });

  it('falls back when either framebuffer handle is missing, malformed, or a layered layout', () => {
    const fake = createFakeRenderer();
    const source = targetWithDepth(8, 4);
    const destination = targetWithDepth(8, 4);

    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'source-framebuffer-unsupported',
    });
    expect(readTargetFramebuffer(fake.properties, source)).toBeUndefined();

    fake.renderer.setRenderTarget(source);
    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'destination-framebuffer-unsupported',
    });

    fake.renderer.setRenderTarget(destination);
    // Cube and mipmap-level layouts store one framebuffer per face or level.
    fake.record(source).__webglFramebuffer = [{ handle: 1 }, { handle: 2 }];
    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'source-framebuffer-unsupported',
    });

    fake.record(source).__webglFramebuffer = 7;
    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'source-framebuffer-unsupported',
    });
  });

  it('rejects a multisampled record even when the single-sample handle is present', () => {
    const fake = createFakeRenderer();
    const source = targetWithDepth(8, 4);
    const destination = targetWithDepth(8, 4);
    fake.renderer.setRenderTarget(source);
    fake.renderer.setRenderTarget(destination);

    fake.record(source).__webglMultisampledFramebuffer = { handle: 99 };
    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'source-framebuffer-unsupported',
    });

    delete fake.record(source).__webglMultisampledFramebuffer;
    fake.record(destination).__webglMultisampledFramebuffer = { handle: 98 };
    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'destination-framebuffer-unsupported',
    });
  });

  it('rejects layouts a depth blit cannot copy between', () => {
    const fake = createFakeRenderer();
    const destination = targetWithDepth(8, 4);
    fake.renderer.setRenderTarget(destination);

    const multisampled = targetWithDepth(8, 4);
    multisampled.samples = 4;
    const withoutDepth = new THREE.WebGLRenderTarget(8, 4);
    const unbufferedDepth = targetWithDepth(8, 4);
    unbufferedDepth.depthBuffer = false;
    const floatDepth = targetWithDepth(8, 4);
    floatDepth.depthTexture!.type = THREE.FloatType;
    const depthStencil = targetWithDepth(8, 4);
    depthStencil.depthTexture!.format = THREE.DepthStencilFormat;

    for (const source of [multisampled, withoutDepth, unbufferedDepth, floatDepth, depthStencil]) {
      fake.renderer.setRenderTarget(source);
      expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
        method: 'public-copy',
        reason: 'source-layout-unsupported',
      });
    }

    const source = targetWithDepth(8, 4);
    fake.renderer.setRenderTarget(source);
    expect(resolveDepthCopyPlan(fake.properties, source, multisampled)).toEqual({
      method: 'public-copy',
      reason: 'destination-layout-unsupported',
    });
  });

  it('rejects a size mismatch before reading any handle', () => {
    const fake = createFakeRenderer();
    const source = targetWithDepth(8, 4);
    const destination = targetWithDepth(8, 5);
    fake.renderer.setRenderTarget(source);
    fake.renderer.setRenderTarget(destination);

    expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
      method: 'public-copy',
      reason: 'size-mismatch',
    });
  });

  it('validates the handle against the platform constructor when the page exposes one', () => {
    const fake = createFakeRenderer();
    const source = targetWithDepth(8, 4);
    const destination = targetWithDepth(8, 4);
    fake.renderer.setRenderTarget(source);
    fake.renderer.setRenderTarget(destination);

    class FakeFramebuffer {}
    const scope = globalThis as { WebGLFramebuffer?: unknown };
    const original = scope.WebGLFramebuffer;
    scope.WebGLFramebuffer = FakeFramebuffer;
    try {
      expect(resolveDepthCopyPlan(fake.properties, source, destination)).toEqual({
        method: 'public-copy',
        reason: 'source-framebuffer-unsupported',
      });

      const read = new FakeFramebuffer();
      const draw = new FakeFramebuffer();
      fake.record(source).__webglFramebuffer = read;
      fake.record(destination).__webglFramebuffer = draw;
      expect(resolveDepthCopyPlan(fake.properties, source, destination)).toMatchObject({
        method: 'blit',
        read,
        draw,
      });
    } finally {
      if (original === undefined) delete scope.WebGLFramebuffer;
      else scope.WebGLFramebuffer = original;
    }
  });
});

describe('R21 depth snapshot capture', () => {
  it('blits depth once per frame with no GL queries and no render-target change', () => {
    const { fake, source, snapshot, camera } = createSnapshot();

    captureFrame(fake, snapshot, source, camera);
    const queriesAfterValidation = fake.errorCalls();

    expect(fake.blits).toEqual([[0, 0, 8, 4, 0, 0, 8, 4, GL_DEPTH_BUFFER_BIT, GL_NEAREST]]);
    expect(fake.copies).toEqual([]);
    expect(snapshot.stats()).toMatchObject({
      copied: true,
      enabled: true,
      copyMethod: 'blit',
      copyFallback: null,
      copyValidated: true,
      copyCount: 1,
      copyError: null,
      width: 8,
      height: 4,
    });
    expect(snapshot.uniforms.uVisibilityFadeEnabled!.value).toBe(1);
    // The blit source is the active render target, so the active target is never set again.
    expect(fake.renderer.getRenderTarget()).toBe(source);

    // A second capture in the same frame is a no-op, and later frames stop querying GL entirely.
    snapshot.capture(fake.asRenderer);
    captureFrame(fake, snapshot, source, camera);
    expect(fake.blits).toHaveLength(2);
    expect(snapshot.stats().copyCount).toBe(2);
    expect(fake.errorCalls()).toBe(queriesAfterValidation);
  });

  it('restores three framebuffer bindings through renderer.state', () => {
    const { fake, source, snapshot, camera } = createSnapshot();
    const read = fake.handleOf(source);
    fake.bindings.length = 0;

    captureFrame(fake, snapshot, source, camera);

    const draw = fake.bindings[1]!.framebuffer;
    expect(fake.bindings).toEqual([
      { target: GL_READ_FRAMEBUFFER, framebuffer: read },
      { target: GL_DRAW_FRAMEBUFFER, framebuffer: draw },
      { target: GL_READ_FRAMEBUFFER, framebuffer: null },
      { target: GL_DRAW_FRAMEBUFFER, framebuffer: read },
    ]);
    expect(draw).not.toBe(read);
    expect(fake.bindings.some((binding) => binding.target === GL_FRAMEBUFFER)).toBe(false);
  });

  it('revalidates the handles when a resize recreates the snapshot target', () => {
    const { fake, source, snapshot, camera } = createSnapshot();
    captureFrame(fake, snapshot, source, camera);
    const firstDraw = fake.bindings[1]!.framebuffer;

    // The composer resizes its targets first, then the scene resizes the snapshot.
    source.setSize(16, 8);
    snapshot.resize(16, 8);
    fake.bindings.length = 0;
    captureFrame(fake, snapshot, source, camera);

    expect(fake.blits[1]).toEqual([0, 0, 16, 8, 0, 0, 16, 8, GL_DEPTH_BUFFER_BIT, GL_NEAREST]);
    expect(fake.bindings[0]!.framebuffer).toBe(fake.handleOf(source));
    expect(fake.bindings[1]!.framebuffer).not.toBe(firstDraw);
    expect(snapshot.stats()).toMatchObject({ copyMethod: 'blit', copied: true, width: 16, height: 8 });
    expect(fake.copies).toEqual([]);
  });

  it('uses the public copy path for a layout the adapter does not own', () => {
    const fake = createFakeRenderer();
    const source = new THREE.WebGLRenderTarget(8, 4);
    source.samples = 4;
    const snapshot = new SkyriverDepthSnapshot(fake.asRenderer, [source]);
    snapshot.resize(8, 4);
    const camera = new THREE.PerspectiveCamera(60, 2, 1, 14000);

    captureFrame(fake, snapshot, source, camera);

    expect(fake.blits).toEqual([]);
    expect(fake.copies).toEqual([{ source: source.depthTexture, destination: snapshot.uniforms.uVisibilityDepth!.value }]);
    expect(snapshot.stats()).toMatchObject({
      copied: true,
      enabled: true,
      copyMethod: 'public-copy',
      copyFallback: 'source-layout-unsupported',
      copyCount: 1,
    });
    // three's copy path leaves both bindings at null, so the active target is set again.
    expect(fake.renderer.getRenderTarget()).toBe(source);
  });

  it('falls back to the public copy path once when the first blit reports a GL error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fake, source, snapshot, camera } = createSnapshot();
      fake.failures.blit = GL_INVALID_OPERATION;

      captureFrame(fake, snapshot, source, camera);
      expect(fake.blits).toHaveLength(1);
      expect(snapshot.stats()).toMatchObject({
        copied: false,
        enabled: false,
        copyMethod: 'blit',
        copyCount: 0,
        copyError: GL_INVALID_OPERATION,
      });
      expect(snapshot.uniforms.uVisibilityFadeEnabled!.value).toBe(0);
      expect(warn.mock.calls[0]![0]).toContain('blit rejected');

      captureFrame(fake, snapshot, source, camera);
      expect(fake.blits).toHaveLength(1);
      expect(fake.copies).toHaveLength(1);
      expect(snapshot.stats()).toMatchObject({
        copied: true,
        enabled: true,
        copyMethod: 'public-copy',
        copyFallback: 'blit-validation-failed',
        copyCount: 1,
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('disables the fade when the public copy path fails too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fake, source, snapshot, camera } = createSnapshot();
      fake.failures.blit = GL_INVALID_OPERATION;
      captureFrame(fake, snapshot, source, camera);
      fake.failures.copy = GL_INVALID_OPERATION;
      captureFrame(fake, snapshot, source, camera);

      expect(snapshot.stats()).toMatchObject({ copied: false, enabled: false, copyMethod: 'public-copy', copyCount: 0 });
      expect(warn.mock.calls.at(-1)![0]).toContain('depth visibility fade disabled');

      // Disabled for good: later frames stop submitting copies of either kind.
      captureFrame(fake, snapshot, source, camera);
      expect(fake.copies).toHaveLength(1);
      expect(fake.blits).toHaveLength(1);
      expect(snapshot.stats().enabled).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('disables the fade when the renderer layout cannot be read at all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fake, source, snapshot, camera } = createSnapshot();
      captureFrame(fake, snapshot, source, camera);
      expect(snapshot.stats().enabled).toBe(true);

      // A context restore replaces renderer.properties, so the adapter reads it every frame.
      fake.renderer.properties.get = () => {
        throw new Error('properties unavailable');
      };
      captureFrame(fake, snapshot, source, camera);

      expect(snapshot.stats()).toMatchObject({ copied: false, enabled: false, copyMethod: 'blit', copyCount: 1 });
      expect(warn.mock.calls.at(-1)![0]).toContain('depth visibility fade disabled');
      expect(fake.blits).toHaveLength(1);
      expect(fake.copies).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the fade off and copies nothing without WebGL 2', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fake, source, snapshot, camera } = createSnapshot(8, 4, { isWebGL2: false });
      captureFrame(fake, snapshot, source, camera);

      expect(fake.blits).toEqual([]);
      expect(fake.copies).toEqual([]);
      expect(snapshot.stats()).toMatchObject({ supported: false, copied: false, enabled: false, copyMethod: 'none' });
    } finally {
      warn.mockRestore();
    }
  });

  it('skips the copy when the frame does not own the active render target', () => {
    const { fake, source, snapshot, camera } = createSnapshot();
    const other = new THREE.WebGLRenderTarget(8, 4);

    fake.renderer.setRenderTarget(source);
    snapshot.beginSceneRender(camera);
    fake.renderer.setRenderTarget(other);
    snapshot.capture(fake.asRenderer);

    expect(fake.blits).toEqual([]);
    expect(snapshot.stats()).toMatchObject({ copied: false, enabled: false });

    snapshot.setAllowed(false);
    captureFrame(fake, snapshot, source, camera);
    expect(fake.blits).toEqual([]);
    expect(snapshot.stats()).toMatchObject({ allowed: false, copied: false, enabled: false });
  });
});
