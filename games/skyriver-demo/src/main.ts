/**
 * @file main.ts — Skyriver boot: scene + runner + traffic + camera + HUD + input, and the frame loop.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   T5 — "createSyncplayRunner offline + per-tick checksums; projection -> render with alpha; pure
 *     chase-cam smoothing with restore reset; touch/keyboard pulses; deduped events -> HUD;
 *     pause/resume burst guard".
 *   R5 — touch drag/hold on mobile, keyboard on desktop.
 *   R7 — quality tiers (DPR 1.5 -> 1.25 -> 1.0, cars 2400 -> 1200 -> 600, god rays on -> off),
 *     presentation-only.
 *   Design "Webview lifecycle" — visibility hidden pauses the runner; resume must not burst.
 *   A3 — load, canvas non-black, draw calls within budget, >= 2,000 car instances, cold start.
 *   A6 — resume after 30 s backgrounded shows frame jumps <= 2.
 *
 * Integration surfaces consumed (all public):
 *   src/render/scene.ts    — SkyriverScene {resize, setTier, addFrameListener, update, resetFrameClock,
 *                            debug, glDiagnostics, dispose}, SKYRIVER_QUALITY, tier helpers.
 *   src/render/traffic.ts  — createSkyriverTraffic({seed, quality, maxCarCount, maxThrusterBudget}),
 *                            .objects, .update({tick, alpha}, cameraPos), .setQuality, .stats.
 *   src/sim/session.ts     — createSkyriverRunnerSession (this task), pause/resume/update.
 *   src/render/cameraRig.ts— writeCameraPose / applyCameraPose (this task).
 *   src/ui/hud.ts          — createSkyriverHud (this task).
 */
import {
  SKYRIVER_QUALITY,
  SKYRIVER_FRAME_DRAW_CALL_CEILING,
  SkyriverQualityTier,
  SkyriverScene,
  skyriverNextTierDown,
  type SkyriverFrame,
} from './render/scene';
import { TRAFFIC_QUALITY_TIERS, createSkyriverTraffic } from './render/traffic';
import { deriveImpostorAttributes, impostorPosition } from './render/trafficStreams';
import type { SkyriverTraffic, TrafficQuality } from './render/trafficTypes';
import { createSkyriverShuttle } from './render/shuttle';
import { createFlightPresenter } from './render/flightPresentation';
import { warpCanyon } from './render/canyonWarp';
import {
  applyCameraPose,
  createCameraPoseScratch,
  writeCameraPose,
} from './render/cameraRig';
import {
  SKYRIVER_MAX_DELTA_MS,
  SKYRIVER_MAX_STEPS_PER_UPDATE,
  createSkyriverRunnerSession,
  type SkyriverHudEvent,
  type SkyriverRenderState,
  type SkyriverRunnerSession,
} from './sim/session';
import { createSkyriverHud, type SkyriverHud } from './ui/hud';
import * as THREE from 'three';

/** The demo's world. One constant, so every run and every probe sees the same city and swarm. */
export const SKYRIVER_DEMO_SEED = 424242;

/**
 * Boost fuel, seconds. Mirrors BOOST_MAX_SECONDS in src/sim/systems.ts, which does not export it;
 * it is only the HUD bar's full-scale, so a drift here mis-scales a bar and nothing else.
 */
const BOOST_CAPACITY_SECONDS = 3;

/** Lower third of the viewport: press and hold there to boost (plan R5, touch controls). */
const BOOST_ZONE_FRACTION = 2 / 3;

/** Keys that steer. Arrows and WASD, per the brief. */
const KEY_YAW_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_YAW_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const KEY_PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);

function fail(code: string): never {
  throw new Error(code);
}

/* -------------------------------------------------------------------------------------------------
 * Quality-tier reconciliation (T3 scene tiers <-> T4 traffic tiers)
 * ------------------------------------------------------------------------------------------------*/

/**
 * Maps a scene quality tier onto T4's TrafficQuality.
 *
 * `carCount` comes from T3's SKYRIVER_QUALITY (the scene owns the tier table, and its `cars` value is
 * what the draw-call estimate and the DPR clamp were budgeted against). `thrusterBudget` comes from
 * T4's TRAFFIC_QUALITY_TIERS, which is the only module that knows what its glow batch can hold.
 *
 * The two tables were authored independently, so this asserts they still agree on the car counts
 * rather than silently preferring one. A drift is a reconciliation bug and must be loud.
 */
export function trafficQualityForTier(tier: SkyriverQualityTier): TrafficQuality {
  const scene = SKYRIVER_QUALITY[tier];
  const traffic = TRAFFIC_QUALITY_TIERS[tier];
  if (traffic === undefined) fail(`SKYRIVER_TIER_UNMAPPED: ${tier}`);
  if (traffic.carCount !== scene.cars) {
    fail(
      `SKYRIVER_TIER_CAR_COUNT_DRIFT: ${tier} scene=${scene.cars} traffic=${traffic.carCount}`,
    );
  }
  return { carCount: scene.cars, thrusterBudget: traffic.thrusterBudget, trails: traffic.trails, impostors: traffic.impostors };
}

/* -------------------------------------------------------------------------------------------------
 * Frame-time tier manager
 * ------------------------------------------------------------------------------------------------*/

/** Rolling window length, milliseconds (plan: "rolling ~2 s frame-time average"). */
const TIER_WINDOW_MS = 2000;
/** Hard cap on retained samples, so a 240 Hz display cannot grow the ring. */
const TIER_WINDOW_SAMPLES = 512;
/** Downgrade when the windowed average falls below this frame rate. */
const TIER_DOWNGRADE_FPS = 50;
/** Upgrade only above this frame rate — the gap to the downgrade line is the hysteresis band. */
const TIER_UPGRADE_FPS = 58;
/** Sustained headroom required before an upgrade, milliseconds. Two full windows. */
const TIER_UPGRADE_SUSTAIN_MS = 4000;
/** Quiet period after any tier change, milliseconds. Stops a tier from oscillating. */
const TIER_COOLDOWN_MS = 3000;

const TIER_DOWNGRADE_FRAME_MS = 1000 / TIER_DOWNGRADE_FPS;
const TIER_UPGRADE_FRAME_MS = 1000 / TIER_UPGRADE_FPS;

/** Highest first; the reverse of skyriverNextTierDown's direction. */
const TIER_LADDER: readonly SkyriverQualityTier[] = Object.freeze([
  SkyriverQualityTier.High,
  SkyriverQualityTier.Medium,
  SkyriverQualityTier.Low,
]);

function nextTierUp(tier: SkyriverQualityTier): SkyriverQualityTier | null {
  const index = TIER_LADDER.indexOf(tier);
  return index > 0 ? TIER_LADDER[index - 1]! : null;
}

export interface SkyriverTierManager {
  /** Feeds one frame time, in milliseconds. Returns the tier to use from now on. */
  sample(frameMs: number): SkyriverQualityTier;
  readonly tier: SkyriverQualityTier;
  readonly averageFrameMs: number;
  readonly fps: number;
  /** True while the manager is allowed to change the tier. */
  readonly auto: boolean;
  /** Pins a tier and turns auto off. For T6's measurement runs and the browser probe. */
  pin(tier: SkyriverQualityTier): void;
  /** Re-enables automatic management from the current tier. */
  resumeAuto(): void;
  /** Drops the window. Call after a pause, a tier change, or anything that poisoned the samples. */
  reset(): void;
}

/**
 * Frame-time tier manager with hysteresis.
 *
 * Downgrades on one sustained window below TIER_DOWNGRADE_FPS; upgrades only after
 * TIER_UPGRADE_SUSTAIN_MS of continuous headroom above TIER_UPGRADE_FPS. The asymmetry is deliberate:
 * dropping a tier protects the frame rate now, while adding one back is a bet that has to be earned.
 */
export function createSkyriverTierManager(
  initialTier: SkyriverQualityTier,
  onChange: (tier: SkyriverQualityTier) => void,
): SkyriverTierManager {
  const samples = new Float64Array(TIER_WINDOW_SAMPLES);
  let head = 0;
  let count = 0;
  let windowMs = 0;
  let sum = 0;
  let headroomMs = 0;
  let cooldownMs = 0;
  let tier = initialTier;
  let auto = true;

  function reset(): void {
    head = 0;
    count = 0;
    windowMs = 0;
    sum = 0;
    headroomMs = 0;
  }

  function push(frameMs: number): void {
    if (count === TIER_WINDOW_SAMPLES) {
      // Full ring: drop the oldest sample to make room.
      const oldest = samples[head]!;
      sum -= oldest;
      windowMs -= oldest;
      samples[head] = frameMs;
      head = (head + 1) % TIER_WINDOW_SAMPLES;
    } else {
      samples[(head + count) % TIER_WINDOW_SAMPLES] = frameMs;
      count += 1;
    }
    sum += frameMs;
    windowMs += frameMs;

    // Trim the window back to TIER_WINDOW_MS of wall clock.
    while (count > 1 && windowMs - samples[head]! >= TIER_WINDOW_MS) {
      const oldest = samples[head]!;
      sum -= oldest;
      windowMs -= oldest;
      head = (head + 1) % TIER_WINDOW_SAMPLES;
      count -= 1;
    }
  }

  function change(next: SkyriverQualityTier): void {
    tier = next;
    cooldownMs = TIER_COOLDOWN_MS;
    // A tier change moves the DPR and the car count, so every retained sample describes a renderer
    // that no longer exists.
    reset();
    onChange(next);
  }

  return {
    sample(frameMs: number): SkyriverQualityTier {
      if (!Number.isFinite(frameMs) || frameMs <= 0) return tier;
      push(frameMs);
      if (cooldownMs > 0) cooldownMs -= frameMs;
      if (!auto || cooldownMs > 0 || windowMs < TIER_WINDOW_MS) return tier;

      const average = sum / count;
      if (average > TIER_DOWNGRADE_FRAME_MS) {
        headroomMs = 0;
        const down = skyriverNextTierDown(tier);
        if (down !== null) change(down);
        return tier;
      }

      if (average < TIER_UPGRADE_FRAME_MS) {
        headroomMs += frameMs;
        if (headroomMs >= TIER_UPGRADE_SUSTAIN_MS) {
          const up = nextTierUp(tier);
          headroomMs = 0;
          if (up !== null) change(up);
        }
        return tier;
      }

      // Inside the hysteresis band: hold the tier and forfeit accumulated headroom.
      headroomMs = 0;
      return tier;
    },

    get tier(): SkyriverQualityTier {
      return tier;
    },

    get averageFrameMs(): number {
      return count === 0 ? 0 : sum / count;
    },

    get fps(): number {
      const average = count === 0 ? 0 : sum / count;
      return average > 0 ? 1000 / average : 0;
    },

    get auto(): boolean {
      return auto;
    },

    pin(next: SkyriverQualityTier): void {
      auto = false;
      if (next !== tier) change(next);
    },

    resumeAuto(): void {
      auto = true;
      reset();
      cooldownMs = TIER_COOLDOWN_MS;
    },

    reset,
  };
}

/* -------------------------------------------------------------------------------------------------
 * The app
 * ------------------------------------------------------------------------------------------------*/

export interface SkyriverAppOptions {
  readonly root: HTMLElement;
  readonly seed?: number;
  readonly startMode?: 'autopilot' | 'freefly';
  readonly tier?: SkyriverQualityTier;
  readonly debug?: boolean;
  /**
   * R18 operator density test: draw exactly this many GPU impostor cars on every tier (capacity is
   * raised to fit). Undefined keeps the tier's own count.
   */
  readonly impostors?: number;
}

/** Live numbers for the HUD debug line, T6's measurements and the A3/A5/A6 browser probe. */
export interface SkyriverAppStats {
  readonly tick: number;
  readonly alpha: number;
  readonly mode: number;
  readonly speed: number;
  readonly boosting: boolean;
  readonly tier: SkyriverQualityTier;
  readonly fps: number;
  readonly averageFrameMs: number;
  readonly drawCalls: number;
  readonly drawCallBudget: number;
  readonly cars: number;
  readonly thrusters: number;
  readonly frames: number;
  readonly rollbacks: number;
  readonly paused: boolean;
  /** Largest tick advance seen in one rendered frame since the last resetTickJump(). A6 evidence. */
  readonly maxTickJump: number;
  /** performance.now() at the first fully rendered frame: cold load, navigation-relative. */
  readonly firstFrameMs: number | null;
  readonly adapter: string | null;
}

export interface SkyriverApp {
  readonly scene: SkyriverScene;
  readonly traffic: SkyriverTraffic;
  readonly session: SkyriverRunnerSession;
  readonly hud: SkyriverHud;
  readonly tiers: SkyriverTierManager;
  /** Boots the session and starts the frame loop. */
  start(): Promise<void>;
  /** Webview lifecycle (plan Design, A6). Both are idempotent. */
  suspend(): void;
  resume(): void;
  readonly suspended: boolean;
  stats(): SkyriverAppStats;
  resetTickJump(): void;
  /** The current interpolated render state, or null before the first frame. */
  renderState(): SkyriverRenderState | null;
  dispose(): void;
}

export function createSkyriverApp(options: SkyriverAppOptions): SkyriverApp {
  const root = options.root;
  const doc = root.ownerDocument;
  const seed = options.seed ?? SKYRIVER_DEMO_SEED;
  const startMode = options.startMode ?? 'autopilot';
  const initialTier = options.tier ?? SkyriverQualityTier.High;

  // Only a default: boot() pins the root to the viewport before calling in, and an embedding host may
  // have positioned it already. The HUD only needs *some* containing block.
  if (root.style.position === '') root.style.position = 'relative';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.overflow = 'hidden';
  root.style.background = '#04060b';

  const canvas = doc.createElement('canvas');
  canvas.id = 'skyriver-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  root.appendChild(canvas);

  const scene = new SkyriverScene({ canvas, seed, tier: initialTier });

  // Allocated once for the top tier, so a tier change never allocates (T4's contract).
  const topQuality = trafficQualityForTier(SkyriverQualityTier.High);
  const traffic = createSkyriverTraffic({
    seed,
    quality: trafficQualityForTier(initialTier),
    maxCarCount: topQuality.carCount,
    maxThrusterBudget: topQuality.thrusterBudget,
    maxImpostors: Math.max(topQuality.impostors, options.impostors ?? 0),
  });
  if (options.impostors !== undefined) traffic.setImpostorCount(options.impostors);
  for (const object of traffic.objects) scene.scene.add(object);

  const shuttle = createSkyriverShuttle();
  // T6R: the drawn shuttle pose. Autopilot rides a canyon-run track mapped 1:1 from the sim's own arc
  // length; free flight draws the sim pose (render/flightPresentation.ts). Pure, presentation-only.
  const presenter = createFlightPresenter(seed);
  for (const object of shuttle.objects) scene.scene.add(object);

  const session = createSkyriverRunnerSession(seed, startMode);

  const hud = createSkyriverHud({
    root,
    debug: options.debug === true,
    onModeTap: () => session.queueModeToggle(),
    onBoostDown: () => session.setBoost(true),
    onBoostUp: () => session.setBoost(false),
  });

  const tiers = createSkyriverTierManager(initialTier, (tier) => {
    scene.setTier(tier);
    traffic.setQuality(trafficQualityForTier(tier));
  });

  const poseScratch = createCameraPoseScratch();
  let renderState: SkyriverRenderState | null = null;
  let frames = 0;
  let maxTickJump = 0;
  let lastTick = -1;
  let firstFrameMs: number | null = null;
  let suspended = false;
  let running = false;
  let rafHandle: number | null = null;
  let lastFrameMs: number | null = null;
  let adapter: string | null = null;
  let eventCount = 0;

  // Traffic rides the scene's frame listener, so it updates with the same interpolated time the city
  // and the atmosphere use, after the camera is in place.
  const bufferSize = new THREE.Vector2();
  const onFrame = (frame: SkyriverFrame): void => {
    scene.renderer.getDrawingBufferSize(bufferSize);
    traffic.setPixelAngle(((frame.camera.fov * Math.PI) / 180) / Math.max(1, bufferSize.y));
    traffic.update({ tick: frame.tick, alpha: frame.alpha }, frame.camera.position);
  };
  scene.addFrameListener(onFrame);

  const unsubscribeEvents = session.runner.subscribeEvents((record) => {
    eventCount += 1;
    hud.showEvent(record.payload as SkyriverHudEvent);
  });

  /* ---- input ---------------------------------------------------------------------------------- */

  const heldKeys = new Set<string>();
  let dragPointerId: number | null = null;
  let dragLastX = 0;
  let dragLastY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let boostPointerId: number | null = null;

  function applyKeyAxes(): void {
    let yaw = 0;
    let pitch = 0;
    for (const code of heldKeys) {
      if (KEY_YAW_LEFT.has(code)) yaw -= 1;
      if (KEY_YAW_RIGHT.has(code)) yaw += 1;
      if (KEY_PITCH_UP.has(code)) pitch += 1;
      if (KEY_PITCH_DOWN.has(code)) pitch -= 1;
    }
    session.setSteerAxes(
      yaw === 0 ? 0 : yaw > 0 ? 1 : -1,
      pitch === 0 ? 0 : pitch > 0 ? 1 : -1,
    );
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.code === 'KeyM') {
      if (!event.repeat) session.queueModeToggle();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyB') {
      if (!event.repeat) session.setBoost(true);
      event.preventDefault();
      return;
    }
    if (event.code === 'F3' || event.code === 'Backquote') {
      if (!event.repeat) hud.toggleDebug();
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      session.setThrottle(1);
      return;
    }
    if (event.code === 'KeyZ') {
      session.setThrottle(-1);
      return;
    }
    if (
      KEY_YAW_LEFT.has(event.code) || KEY_YAW_RIGHT.has(event.code)
      || KEY_PITCH_UP.has(event.code) || KEY_PITCH_DOWN.has(event.code)
    ) {
      heldKeys.add(event.code);
      applyKeyAxes();
      event.preventDefault();
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'KeyB') {
      session.setBoost(false);
      return;
    }
    if (
      event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyZ'
    ) {
      session.setThrottle(0);
      return;
    }
    if (heldKeys.delete(event.code)) applyKeyAxes();
  }

  function onBlur(): void {
    heldKeys.clear();
    session.resetInput();
  }

  /**
   * Touch: a press in the lower third is a boost hold; anywhere else is a steering drag.
   *
   * The drag feeds the sim differently per mode, because the sim reads the axes differently (per
   * systems.ts): on autopilot the axes orbit the chase camera, so the drag sends per-tick orbit
   * pulses and a still finger stops orbiting; in free flight the axes are the stick, so the drag
   * sends the held offset from where the finger landed and a still finger keeps turning.
   */
  function onPointerDown(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (rect.height > 0 && y >= rect.height * BOOST_ZONE_FRACTION && boostPointerId === null) {
      boostPointerId = event.pointerId;
      session.setBoost(true);
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (dragPointerId !== null) return;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== dragPointerId) return;
    const freeFlight = renderState !== null && renderState.flight.mode === 1;
    if (freeFlight) {
      const rect = canvas.getBoundingClientRect();
      const span = Math.max(80, Math.min(rect.width, rect.height) * 0.35);
      session.setSteerAxes(
        Math.max(-1, Math.min(1, (event.clientX - dragStartX) / span)),
        Math.max(-1, Math.min(1, -(event.clientY - dragStartY) / span)),
      );
    } else {
      session.queueOrbitDelta(event.clientX - dragLastX, event.clientY - dragLastY);
    }
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId === boostPointerId) {
      boostPointerId = null;
      session.setBoost(false);
      return;
    }
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    session.setSteerAxes(0, 0);
    session.input.reset();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  doc.defaultView?.addEventListener('keydown', onKeyDown);
  doc.defaultView?.addEventListener('keyup', onKeyUp);
  doc.defaultView?.addEventListener('blur', onBlur);

  /* ---- resize --------------------------------------------------------------------------------- */

  function resize(): void {
    const width = root.clientWidth || doc.defaultView?.innerWidth || 1;
    const height = root.clientHeight || doc.defaultView?.innerHeight || 1;
    scene.resize(width, height);
  }

  const view = doc.defaultView;
  view?.addEventListener('resize', resize);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize());
  observer?.observe(root);
  resize();

  /* ---- webview lifecycle ---------------------------------------------------------------------- */

  function suspend(): void {
    if (suspended) return;
    suspended = true;
    session.pause();
    if (rafHandle !== null && view !== null) {
      view.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  function resume(): void {
    if (!suspended) return;
    suspended = false;
    session.resume();
    // Three clocks have to forget the gap, or the first frame back spikes:
    //   - lastFrameMs: our own delta, which would otherwise be the whole hidden period;
    //   - scene.resetFrameClock(): the renderer's dt, for the same reason;
    //   - the tier window: samples taken either side of a 30 s hole are not a frame rate.
    lastFrameMs = null;
    scene.resetFrameClock();
    tiers.reset();
    if (running) schedule();
  }

  function onVisibilityChange(): void {
    if (doc.visibilityState === 'hidden') suspend();
    else resume();
  }

  doc.addEventListener('visibilitychange', onVisibilityChange);

  /* ---- frame loop ----------------------------------------------------------------------------- */

  function frame(nowMs: number): void {
    rafHandle = null;
    if (!running || suspended) return;

    const rawDeltaMs = lastFrameMs === null ? SKYRIVER_MAX_DELTA_MS / 2 : nowMs - lastFrameMs;
    lastFrameMs = nowMs;
    // Clamped twice on purpose: here, so a long frame cannot ask for a burst, and inside the runner,
    // which also discards the excess accumulator (maxOfflineStepsPerUpdate). Plan A6.
    const deltaMs = rawDeltaMs < 0 ? 0 : Math.min(rawDeltaMs, SKYRIVER_MAX_DELTA_MS);

    session.update(deltaMs);

    if (session.runner.ready) {
      const state = session.runner.getRenderState();
      renderState = state;

      if (lastTick >= 0) {
        const jump = state.current.tick - lastTick;
        if (jump > maxTickJump) maxTickJump = jump;
      }
      lastTick = state.current.tick;

      const presented = presenter.present(state);
      scene.atmosphere.setBoost(presented.boostVisual);
      writeCameraPose(poseScratch, presented, state.camera, {
        boost: presented.boostVisual,
        time: (state.current.tick + state.alpha) / 30,
      });
      if (presented.revealWeight > 0.001) {
        // R12 landmark reveal: lean the aim toward the bend's floodlit mega-tower so its lit edge
        // frames one side of the view (at most ~35% of the way, eased in and out).
        // R13: a sustained 28% hold toward the tower at the showcase bend (weight 1), 15% elsewhere.
        // The target is re-projected to the boom's look-ahead distance so the lean is an angle, not
        // a zoom toward the tower.
        const k = 0.28 * presented.revealWeight;
        const ax = poseScratch.target.x - poseScratch.position.x;
        const az = poseScratch.target.z - poseScratch.position.z;
        const aimLen = Math.hypot(ax, az) || 1;
        let tx = presented.revealX - poseScratch.position.x;
        let tz = presented.revealZ - poseScratch.position.z;
        const tl = Math.hypot(tx, tz) || 1;
        tx = (tx / tl) * aimLen;
        tz = (tz / tl) * aimLen;
        poseScratch.target.x = poseScratch.position.x + ax + (tx - ax) * k;
        poseScratch.target.z = poseScratch.position.z + az + (tz - az) * k;
        // Tilt up toward the crown: up to ~12 degrees at the full hold.
        poseScratch.target.y += aimLen * 0.11 * presented.revealWeight;
      }
      applyCameraPose(scene.camera, poseScratch);

      // T6R-2: the drawn nose follows under half the climb angle (the sim allows 54 degrees), so the
      // chase view keeps reading the wedge from behind, never a capsule from above or a belly from below.
      shuttle.setPose(presented.x, presented.y, presented.z, presented.yaw, presented.pitch * 0.45, presented.roll);
      traffic.setAnchor(
        presented.x, presented.y, presented.z, presented.yaw,
        // 1.8 matches the sim's BOOST_MULTIPLIER (systems.ts).
        presented.speed * (presented.boostT > 0 ? 1.8 : 1),
        presented.canyonV, presented.canyonX,
      );
      shuttle.update({
        // 1.8 matches the sim's BOOST_MULTIPLIER (systems.ts); the plume pulse softens the edge.
        boostIntensity: state.flight.boostT > 0 ? 1.8 : 1.0,
        time: (state.current.tick + state.alpha) / 30,
      });

      scene.update(state.current.tick, state.current, state.alpha);

      hud.update({
        mode: state.flight.mode,
        // T7-3: the drawn ground speed (autopilot covers the long winding loop in one sim lap).
        speed: presented.speed,
        boosting: state.flight.boostT > 0,
        boostT: state.flight.boostT,
        boostCapacity: BOOST_CAPACITY_SECONDS,
        paused: suspended,
      });
    }

    frames += 1;
    if (firstFrameMs === null) {
      firstFrameMs = nowMs;
      if (adapter === null) {
        const diagnostics = scene.glDiagnostics();
        adapter = diagnostics.renderer;
        // One line, once: the GPU adapter string every performance claim has to be read against
        // (plan P1-9 — SwiftShader must never be mistaken for a GPU run).
        console.info(
          '[skyriver] gl adapter:', diagnostics.renderer ?? 'unavailable',
          '| vendor:', diagnostics.vendor ?? 'unavailable',
          '|', diagnostics.version ?? '',
          '| timer query:', diagnostics.timerQuery,
        );
      }
    }

    tiers.sample(deltaMs);

    hud.setFps(tiers.fps);

    if (hud.debugVisible) {
      const debug = scene.debug();
      const trafficStats = traffic.stats();
      hud.updateDebug({
        tier: tiers.tier,
        fps: tiers.fps,
        drawCalls: debug.calls,
        drawCallBudget: SKYRIVER_FRAME_DRAW_CALL_CEILING,
        cars: trafficStats.activeCars,
        tick: renderState?.current.tick ?? 0,
        alpha: renderState?.alpha ?? 0,
        adapter,
        rollbacks: session.runner.rollbackCount,
      });
    }

    schedule();
  }

  function schedule(): void {
    if (!running || suspended || rafHandle !== null || view === null) return;
    rafHandle = view.requestAnimationFrame(frame);
  }

  return {
    scene,
    traffic,
    session,
    hud,
    tiers,

    async start(): Promise<void> {
      await session.start();
      running = true;
      lastFrameMs = null;
      scene.resetFrameClock();
      schedule();
    },

    suspend,
    resume,

    get suspended(): boolean {
      return suspended;
    },

    stats(): SkyriverAppStats {
      const debug = scene.debug();
      const trafficStats = traffic.stats();
      return {
        tick: renderState?.current.tick ?? -1,
        alpha: renderState?.alpha ?? 0,
        mode: renderState?.flight.mode ?? -1,
        speed: renderState?.flight.speed ?? 0,
        boosting: (renderState?.flight.boostT ?? 0) > 0,
        tier: tiers.tier,
        fps: tiers.fps,
        averageFrameMs: tiers.averageFrameMs,
        drawCalls: debug.calls,
        drawCallBudget: SKYRIVER_FRAME_DRAW_CALL_CEILING,
        cars: trafficStats.activeCars,
        thrusters: trafficStats.activeThrusters,
        frames,
        rollbacks: session.runner.rollbackCount,
        paused: suspended,
        maxTickJump,
        firstFrameMs,
        adapter,
      };
    },

    resetTickJump(): void {
      maxTickJump = 0;
      lastTick = renderState?.current.tick ?? -1;
    },

    renderState(): SkyriverRenderState | null {
      return renderState;
    },

    dispose(): void {
      running = false;
      if (rafHandle !== null && view !== null) view.cancelAnimationFrame(rafHandle);
      rafHandle = null;
      unsubscribeEvents();
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      view?.removeEventListener('resize', resize);
      view?.removeEventListener('keydown', onKeyDown);
      view?.removeEventListener('keyup', onKeyUp);
      view?.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      observer?.disconnect();
      scene.removeFrameListener(onFrame);
      hud.dispose();
      void session.dispose();
      traffic.dispose();
      shuttle.dispose();
      scene.dispose();
      canvas.remove();
    },
  };
}

/** Events the HUD showed, for the probe's "exactly one event per toggle" assertion. */
export interface SkyriverProbeHandle extends SkyriverApp {
  readonly hudEventCount: number;
}

/**
 * Boots the demo into #app.
 *
 * The app handle is published on `window.__skyriver` because every A3/A5/A6 measurement is taken from
 * a real browser against the built bundle, and the probe needs the same numbers the HUD shows.
 */
export function boot(): SkyriverApp {
  const root = document.getElementById('app');
  if (root === null) fail('SKYRIVER_ROOT_MISSING: #app');

  // index.html is T1's and ships no stylesheet, so #app has no height of its own. The page layout is
  // applied here rather than there: it is this entry point's business how the demo fills the webview,
  // and createSkyriverApp stays embeddable in a host that sizes its own container.
  const html = document.documentElement;
  html.style.height = '100%';
  html.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.height = '100%';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';
  document.body.style.background = '#04060b';
  root.style.position = 'fixed';
  root.style.inset = '0';

  const params = new URLSearchParams(window.location.search);
  const app = createSkyriverApp({
    root,
    seed: SKYRIVER_DEMO_SEED,
    startMode: params.get('mode') === 'freefly' ? 'freefly' : 'autopilot',
    debug: params.get('debug') === '1',
    // R18 phone density test: ?impostors=N (0 = off) overrides the tier's GPU impostor count.
    ...(params.get('impostors') !== null && Number.isFinite(Number(params.get('impostors')))
      ? { impostors: Math.min(60000, Math.max(0, Math.floor(Number(params.get('impostors'))))) }
      : {}),
  });

  // T7 A/B evidence: ?bloom=0 renders the same frame without the post chain.
  if (params.get('bloom') === '0') app.scene.setBloomAllowed(false);
  // R14 device testing: ?tier=high|medium|low pins a quality tier (auto-tiering off), so each tier
  // can be checked on a phone deterministically without waiting for the frame-time manager.
  const tierParam = params.get('tier');
  if (tierParam === 'high' || tierParam === 'medium' || tierParam === 'low') {
    app.tiers.pin(tierParam === 'high' ? SkyriverQualityTier.High : tierParam === 'medium' ? SkyriverQualityTier.Medium : SkyriverQualityTier.Low);
  }
  // T7-4 A/B: ?interiors=0 renders the same frames with the emissive window term only.
  if (params.get('interiors') === '0') app.scene.setInteriorsAllowed(false);
  // R16 A/B and fill-rate probe: ?trails=0 draws no light trails (the lamp dots stay).
  if (params.get('trails') === '0') app.traffic.setTrailsAllowed(false);
  // R16 A/B and cost probe: ?farcity=geometry draws the far-city layers as R15's box masses.
  if (params.get('farcity') === 'geometry') app.scene.city.setFarMode('geometry');

  (window as unknown as { __skyriver?: SkyriverApp }).__skyriver = app;
  // T7-4 evidence hook (presentation-only, read-only): the canyon warp and a tower raycast, so the
  // browser probe can park a diagnostic camera at a real wall in the production build.
  (window as unknown as { __skyriverDiag?: unknown }).__skyriverDiag = {
    warpCanyon,
    // R18: the GPU impostor cars' CPU mirror (density and continuity probes).
    deriveImpostorAttributes,
    impostorPosition,
    raycastTowers(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): { x: number; y: number; z: number } | null {
      const ray = new THREE.Raycaster(new THREE.Vector3(ox, oy, oz), new THREE.Vector3(dx, dy, dz).normalize(), 0, 3000);
      const hit = ray.intersectObject(app.scene.city.towerMesh, false)[0];
      return hit === undefined ? null : { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    },
  };

  void app.start().catch((error: unknown) => {
    console.error('[skyriver] start failed', error);
    root.textContent = `Skyriver failed to start: ${String(error)}`;
  });

  return app;
}

if (typeof document !== 'undefined' && document.getElementById('app') !== null) {
  boot();
}
