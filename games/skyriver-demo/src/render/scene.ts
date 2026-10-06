/**
 * @file scene.ts — renderer, camera, quality tiers, and the frame pump the rest of the render layer
 *                  hangs off.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R3/R4 — <= 16 draw calls total; city and atmosphere are T3's, traffic is T4's <= 4.
 *   R7    — "Quality tiers: DPR 1.5 -> 1.25 -> 1.0, cars 2,400 -> 1,200 -> 600, god rays on -> off —
 *            presentation-only." Tier values below are exactly those.
 *   R9/A3 — Playwright smoke reads `renderer.info.render.calls` and the instance counts; `debug()`
 *           hands both over in one object.
 *   Design "Sim <-> render split" — `update()` consumes a SkyriverProjection and never writes back.
 *   T3    — "GPU adapter logging"; T5 owns the log line, this module supplies the strings.
 *
 * Ownership. T3 owns city.ts, atmosphere.ts and this file. T4 (traffic) and T5 (runner, camera rig,
 * HUD) do not exist yet, so the types they need are defined here:
 *   - `SkyriverQualityTier` / `SkyriverQualitySettings` / `SKYRIVER_QUALITY` — the tier table.
 *   - `SkyriverFrame` / `SkyriverFrameListener` — the per-frame contract.
 *   - `SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET` — T4's share of the budget.
 * T5 should reconcile these into their final home if the runner wiring wants them elsewhere; see the
 * worker report. Nothing here imports from a T4/T5 file.
 *
 * Camera ownership. This module creates and resizes the PerspectiveCamera but never moves it: the
 * chase-cam is T5's `cameraRig.ts`, and the plan requires that smoothing be a pure function of
 * (previous projection, current projection, alpha) with an explicit reset on restore. T5 writes
 * `scene.camera` before calling `update()`.
 *
 * WebGL is touched only inside the constructor, so importing this module under node (vitest) is
 * safe. The pure helpers (`skyriverQualityFor`, `skyriverDrawCallEstimate`) run anywhere.
 */
import * as THREE from 'three';

import { deriveCityLayout, type SkyriverCityLayout } from '../sim/derive';
import type { SkyriverProjection } from '../sim/runtime';
import { SKYRIVER_TICK_RATE } from '../sim/systems';
import { SkyriverAtmosphere, SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET } from './atmosphere';
import { SkyriverCity, SKYRIVER_CITY_DRAW_CALL_BUDGET } from './city';

/** Plan R3: 16 total. The approved night look spends less — the hard ceiling we hold to is 12. */
export const SKYRIVER_TOTAL_DRAW_CALL_BUDGET = 12;
/** T4's share (plan R4: "<= 4 traffic draw calls"). Defined here so T4 can import it on day one. */
export const SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET = 4;

/** Presentation-only quality tiers (plan R7). Never reaches simulation. */
export enum SkyriverQualityTier {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export interface SkyriverQualitySettings {
  readonly tier: SkyriverQualityTier;
  /** Traffic instance count for T4. */
  readonly cars: number;
  /** God-ray pass on or off (plan R7). */
  readonly godRays: boolean;
  /** Screen-space rain streaks. Top tier only: it is the one effect that costs a full-screen pass. */
  readonly rainStreaks: boolean;
  /** Device-pixel-ratio clamp. */
  readonly dpr: number;
}

export const SKYRIVER_QUALITY: Readonly<Record<SkyriverQualityTier, SkyriverQualitySettings>> =
  Object.freeze({
    [SkyriverQualityTier.High]: Object.freeze({
      tier: SkyriverQualityTier.High,
      cars: 2400,
      godRays: true,
      rainStreaks: true,
      dpr: 1.5,
    }),
    [SkyriverQualityTier.Medium]: Object.freeze({
      tier: SkyriverQualityTier.Medium,
      cars: 1200,
      godRays: true,
      rainStreaks: false,
      dpr: 1.25,
    }),
    [SkyriverQualityTier.Low]: Object.freeze({
      tier: SkyriverQualityTier.Low,
      cars: 600,
      godRays: false,
      rainStreaks: false,
      dpr: 1.0,
    }),
  });

/** Highest first, so T6's degrade loop can walk it. */
export const SKYRIVER_QUALITY_ORDER: readonly SkyriverQualityTier[] = Object.freeze([
  SkyriverQualityTier.High,
  SkyriverQualityTier.Medium,
  SkyriverQualityTier.Low,
]);

export function skyriverQualityFor(tier: SkyriverQualityTier): SkyriverQualitySettings {
  return SKYRIVER_QUALITY[tier];
}

/** The next tier down, or null at the floor. */
export function skyriverNextTierDown(tier: SkyriverQualityTier): SkyriverQualityTier | null {
  const index = SKYRIVER_QUALITY_ORDER.indexOf(tier);
  if (index < 0 || index + 1 >= SKYRIVER_QUALITY_ORDER.length) return null;
  return SKYRIVER_QUALITY_ORDER[index + 1];
}

/**
 * What every render module gets each frame.
 *
 * One instance is reused for the life of the scene, so nothing in the update path allocates (plan
 * R7's CPU-millisecond budget). Treat it as valid only for the duration of the listener call.
 */
export interface SkyriverFrame {
  /** Confirmed sim tick (30 Hz). */
  readonly tick: number;
  /** Interpolation fraction into the next tick, 0 .. 1. T4 evaluates traffic at tick + alpha. */
  readonly alpha: number;
  /** Seconds of simulated time, `(tick + alpha) / SKYRIVER_TICK_RATE`. Drives every shader clock. */
  readonly time: number;
  /** Wall-clock seconds since the previous update, clamped. For cosmetic easing only. */
  readonly dt: number;
  /** Null before the runner produces its first projection. */
  readonly projection: SkyriverProjection | null;
  readonly camera: THREE.PerspectiveCamera;
  readonly quality: SkyriverQualitySettings;
}

export type SkyriverFrameListener = (frame: SkyriverFrame) => void;

type MutableFrame = {
  -readonly [K in keyof SkyriverFrame]: SkyriverFrame[K];
};

export interface SkyriverSceneOptions {
  readonly canvas: HTMLCanvasElement;
  /** Session seed. Drives `deriveCityLayout`, so every peer builds the same canyon. */
  readonly seed: number;
  readonly tier?: SkyriverQualityTier;
  /** Overrides the tier's DPR clamp. T6 uses this to walk DPR without changing tier. */
  readonly maxPixelRatio?: number;
}

export interface SkyriverDrawCallEstimate {
  readonly city: number;
  readonly atmosphere: number;
  /** T4's budget, not a measurement: traffic does not exist yet. */
  readonly trafficBudget: number;
  readonly total: number;
  readonly budget: number;
  readonly withinBudget: boolean;
}

/**
 * Reasoned draw-call maths, with no GL context needed.
 *
 * Every pass in T3 is a single instanced mesh with frustum culling off, so the count is fixed and
 * does not move with instance counts. That is deliberate: A3 asserts a draw-call ceiling, and a
 * count that drifts with the camera would make that assertion flaky.
 */
export function skyriverDrawCallEstimate(
  quality: SkyriverQualitySettings,
): SkyriverDrawCallEstimate {
  // towers + trim + neon signs
  const city = 3;
  // skydome + searchlights, plus god rays and rain streaks when the tier enables them
  const atmosphere = 2 + (quality.godRays ? 1 : 0) + (quality.rainStreaks ? 1 : 0);
  const total = city + atmosphere + SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET;
  return {
    city,
    atmosphere,
    trafficBudget: SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET,
    total,
    budget: SKYRIVER_TOTAL_DRAW_CALL_BUDGET,
    withinBudget: total <= SKYRIVER_TOTAL_DRAW_CALL_BUDGET,
  };
}

export interface SkyriverRenderDebug {
  /** Straight from `renderer.info.render` — what A3 asserts against. */
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly geometries: number;
  readonly textures: number;
  readonly instances: {
    readonly towers: number;
    readonly trims: number;
    readonly signs: number;
    readonly godRays: number;
    readonly searchlights: number;
  };
  readonly drawCalls: SkyriverDrawCallEstimate;
  readonly pixelRatio: number;
  readonly tier: SkyriverQualityTier;
}

/**
 * GPU identification for the plan's adapter log.
 *
 * EXT_debug expectation: P1-9 requires the adapter string in the A3/A4 evidence so a SwiftShader
 * run cannot be mistaken for a GPU-backed one, and R7 wants GPU milliseconds from
 * `EXT_disjoint_timer_query_webgl2` "where available". Both extensions are optional and absent in
 * an Android WebView more often than not, so every field here is nullable and `timerQuery` is a
 * capability flag, never an assumption. T5 owns the log line; this method only reports.
 */
export interface SkyriverGlDiagnostics {
  readonly vendor: string | null;
  readonly renderer: string | null;
  readonly version: string | null;
  readonly debugRendererInfo: boolean;
  readonly timerQuery: boolean;
}

/** Longest frame we will integrate. A backgrounded WebView must not produce one giant dt. */
const MAX_FRAME_DT_S = 1 / 15;

export class SkyriverScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly layout: SkyriverCityLayout;
  readonly city: SkyriverCity;
  readonly atmosphere: SkyriverAtmosphere;

  private quality: SkyriverQualitySettings;
  private maxPixelRatio: number;
  private readonly listeners: SkyriverFrameListener[] = [];
  private readonly frame: MutableFrame;
  private lastUpdateMs: number | null = null;
  private readonly scratchSize = new THREE.Vector2();
  private width = 1;
  private height = 1;

  constructor({ canvas, seed, tier = SkyriverQualityTier.High, maxPixelRatio }: SkyriverSceneOptions) {
    this.quality = SKYRIVER_QUALITY[tier];
    this.maxPixelRatio = maxPixelRatio ?? this.quality.dpr;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // Off on purpose: MSAA is the single most expensive thing we could switch on, and the night
      // look leans on dithering and the haze instead (plan R7, Galaxy S23 gate).
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
      // The smoke test reads back the canvas to prove it is not black.
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x04060b, 1);
    // ACES rolls the neon highlights off instead of clipping them to white.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // No render targets and no post chain anywhere in T3 (plan: mobile budget discipline).
    this.renderer.autoClear = true;

    this.scene = new THREE.Scene();
    this.scene.name = 'skyriver';

    // No Light objects: every T3 material is unlit or emissive, so lights would only force longer
    // shader permutations. T4 should stay unlit for the same reason.
    this.camera = new THREE.PerspectiveCamera(62, 1, 1, 14000);
    this.camera.name = 'skyriver.camera';

    this.layout = deriveCityLayout(seed);

    this.atmosphere = new SkyriverAtmosphere({ layout: this.layout, quality: this.quality });
    // The haze colour and depths density live on scene.fog, so three refreshes them into every
    // fogged material — including anything T4 builds from a built-in material.
    this.scene.fog = this.atmosphere.fog;
    this.scene.add(this.atmosphere.group);

    this.city = new SkyriverCity({ layout: this.layout, quality: this.quality });
    this.scene.add(this.city.group);

    this.frame = {
      tick: 0,
      alpha: 0,
      time: 0,
      dt: 0,
      projection: null,
      camera: this.camera,
      quality: this.quality,
    };

    this.resize(
      canvas.clientWidth || canvas.width || 1,
      canvas.clientHeight || canvas.height || 1,
    );
  }

  get currentQuality(): SkyriverQualitySettings {
    return this.quality;
  }

  /**
   * Vertical pixels per metre at one metre of view depth. The city shader uses it to fade procedural
   * detail out before it is too small to resolve, so it must track the drawing buffer, not the CSS
   * size — a DPR change moves it.
   */
  private projectionScale(): number {
    const target = this.renderer.getDrawingBufferSize(this.scratchSize);
    const fovRadians = (this.camera.fov * Math.PI) / 180;
    return target.y / (2 * Math.tan(fovRadians / 2));
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.maxPixelRatio));
    this.renderer.setSize(this.width, this.height, false);

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.atmosphere.resize(this.width, this.height);
    this.city.setProjectionScale(this.projectionScale());
  }

  /** Presentation-only (plan R7). Re-applies the tier's DPR unless one was pinned explicitly. */
  setTier(tier: SkyriverQualityTier, maxPixelRatio?: number): void {
    this.quality = SKYRIVER_QUALITY[tier];
    this.maxPixelRatio = maxPixelRatio ?? this.quality.dpr;
    this.frame.quality = this.quality;
    this.atmosphere.setQuality(this.quality);
    this.resize(this.width, this.height);
  }

  /**
   * Registers a per-frame listener. T4's traffic hooks in here, so it can update its instance
   * buffers before the draw without this module importing a file that does not exist yet.
   */
  addFrameListener(listener: SkyriverFrameListener): void {
    if (!this.listeners.includes(listener)) this.listeners.push(listener);
  }

  removeFrameListener(listener: SkyriverFrameListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  /**
   * Advances the presentation and draws one frame.
   *
   * `tick` and `projection` come from the runner's confirmed frame; `alpha` is the fraction into the
   * next tick, so a 30 Hz simulation renders smoothly at 60 Hz. The camera is already positioned by
   * T5 at this point. The projection is frozen sim state and is only ever read.
   */
  update(tick: number, projection: SkyriverProjection | null, alpha = 0): void {
    const nowMs = typeof performance === 'undefined' ? 0 : performance.now();
    const dt = this.lastUpdateMs === null
      ? 0
      : Math.min((nowMs - this.lastUpdateMs) / 1000, MAX_FRAME_DT_S);
    this.lastUpdateMs = nowMs;

    const frame = this.frame;
    frame.tick = tick;
    frame.alpha = alpha;
    frame.time = (tick + alpha) / SKYRIVER_TICK_RATE;
    frame.dt = dt;
    frame.projection = projection;

    this.atmosphere.update(frame);
    this.city.update(frame);
    for (let i = 0; i < this.listeners.length; i += 1) this.listeners[i](frame);

    this.renderer.render(this.scene, this.camera);
  }

  /** Called after a restore or a long background pause, so the next dt is not a spike. */
  resetFrameClock(): void {
    this.lastUpdateMs = null;
  }

  /** Debug getter for the smoke tests (plan A3). Reads `renderer.info` straight. */
  debug(): SkyriverRenderDebug {
    const info = this.renderer.info;
    const city = this.city.stats();
    const atmosphere = this.atmosphere.stats();
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      instances: {
        towers: city.towers,
        trims: city.trims,
        signs: city.signs,
        godRays: atmosphere.godRays,
        searchlights: atmosphere.searchlights,
      },
      drawCalls: skyriverDrawCallEstimate(this.quality),
      pixelRatio: this.renderer.getPixelRatio(),
      tier: this.quality.tier,
    };
  }

  /** See `SkyriverGlDiagnostics`. T5 logs this once at boot. */
  glDiagnostics(): SkyriverGlDiagnostics {
    const gl = this.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const timerQuery = gl.getExtension('EXT_disjoint_timer_query_webgl2') !== null;

    if (debugInfo === null) {
      return {
        vendor: null,
        renderer: null,
        version: asString(gl.getParameter(gl.VERSION)),
        debugRendererInfo: false,
        timerQuery,
      };
    }

    return {
      vendor: asString(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)),
      renderer: asString(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
      version: asString(gl.getParameter(gl.VERSION)),
      debugRendererInfo: true,
      timerQuery,
    };
  }

  dispose(): void {
    this.listeners.length = 0;
    this.city.dispose();
    this.atmosphere.dispose();
    this.renderer.dispose();
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Budget constants re-exported so T4/T5 need only one import for the whole render contract. */
export { SKYRIVER_CITY_DRAW_CALL_BUDGET, SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET };
