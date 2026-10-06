/**
 * @file trafficTypes.ts — the public contract of the traffic swarm renderer (T4).
 *
 * Types only. The sole import is `import type`, so T5/T6 can depend on this contract without
 * pulling three.js into a node-side module. The implementation lives in ./traffic.ts, which
 * re-exports everything here.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R4 — ">= 2,000 flying vehicles as a street-free open-air swarm with Fifth Element altitude
 *     layers; 3 instanced archetypes + thruster quads; <= 4 traffic draw calls; transforms
 *     evaluated from float math at interpolated time tick + renderAlpha".
 *   Design "Sim <-> render split" — traffic is presentation-derived, pure f(seed, tick + alpha),
 *     and never feeds simulation.
 *   Design "Performance" — quality tiers cars 2,400 -> 1,200 -> 600, presentation-only.
 */
import type { Object3D } from 'three';

/**
 * Sim tick rate, hertz. Mirrors the `tickRate: 30` in the runtime identity (src/sim/identity.ts).
 * It is duplicated here, not imported, because the render layer must not reach into sim internals.
 */
export const TRAFFIC_TICK_RATE_HZ = 30;

/**
 * A quality tier. T3 owns the scene-wide quality enum; this is the slice traffic needs, declared
 * locally so T3 and T4 can land concurrently. T5 maps its scene tier onto this shape.
 */
export interface TrafficQuality {
  /** Cars evaluated and drawn. The plan's tiers are 2400 / 1200 / 600. */
  readonly carCount: number;
  /** Cars that draw head/tail light streaks this tier. T6R: equal to carCount (one cheap batch). */
  readonly thrusterBudget: number;
}

/** The XZ box the swarm flows inside. Matches the shape of the sim's CHASM_BOUNDS. */
export interface TrafficBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Render time, as either form the runner can supply:
 *   - a plain number: seconds of continuous render time;
 *   - `{ tick, alpha }`: the projection's sim tick plus the runner's interpolation fraction, which
 *     this module converts with (tick + alpha) / TRAFFIC_TICK_RATE_HZ.
 *
 * Both forms are continuous, which is what keeps a 30 Hz sim rendering smoothly at 60 Hz (R4).
 */
export type TrafficTime = number | { readonly tick: number; readonly alpha: number };

/** Minimal positional input. Accepts a THREE.Vector3 or any plain {x, y, z}. */
export interface TrafficPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Live counters, for the HUD and for T6's performance evidence. Read-only snapshot object. */
export interface TrafficStats {
  /** Cars evaluated and drawn this tier. */
  readonly activeCars: number;
  /** Cars whose light streaks were drawn on the last update(). */
  readonly activeThrusters: number;
  /** Draw calls this module adds to the frame: 3 archetypes + 1 light-streak batch. */
  readonly drawCalls: number;
  /** Triangles in one instance of each archetype, indexed by archetype id. */
  readonly trianglesPerArchetype: readonly number[];
  /** Triangles submitted this tier, across all four batches. */
  readonly trianglesDrawn: number;
  /** Retired with the T4 glow selection controller; always 0 since T6R (every car is lit). */
  readonly glowRadiusM: number;
}

export interface SkyriverTrafficOptions {
  /** The session seed. Drives deriveTrafficParams, so every peer sees the same swarm. */
  readonly seed: number;
  /** Starting tier. */
  readonly quality: TrafficQuality;
  /**
   * Highest carCount that setQuality() will ever be given. Buffers and per-car constants are
   * allocated once for this count, so tier changes allocate nothing. Defaults to quality.carCount.
   */
  readonly maxCarCount?: number;
  /**
   * Highest thrusterBudget that setQuality() will ever be given. The glow batch is allocated once for
   * this count. Defaults to quality.thrusterBudget.
   */
  readonly maxThrusterBudget?: number;
  /**
   * The volume the swarm flows inside, normally the sim's CHASM_BOUNDS (the default) or T3's city
   * layout bounding box. The swarm is inset from it so vehicles never clip the tower walls.
   */
  readonly bounds?: TrafficBounds;
}

/**
 * The traffic swarm. Construct with createSkyriverTraffic(); add `objects` to the scene; call
 * update() once per rendered frame.
 */
export interface SkyriverTraffic {
  /** The four meshes to add to the scene. Stable identities for the lifetime of the instance. */
  readonly objects: readonly Object3D[];

  /**
   * Re-evaluates every active car's transform and colour at continuous render time, and selects
   * the glow quads near the camera. Allocates nothing.
   *
   * @param time   continuous render time: seconds, or {tick, alpha} from the projection + runner.
   * @param camera the camera's world position, used for glow selection and distance fade.
   */
  update(time: TrafficTime, camera: TrafficPoint): void;

  /**
   * Radians per drawing-buffer pixel, vertically (field of view / buffer height). The light streaks
   * use it to keep a pixel-size floor, so distant rivers never alias away. Call on resize/DPR change.
   */
  setPixelAngle(radiansPerPixel: number): void;

  /** Switches tier. Allocation-free while quality.carCount <= the configured maxCarCount. */
  setQuality(quality: TrafficQuality): void;

  /** A fresh snapshot of the live counters. Not called per frame by this module. */
  stats(): TrafficStats;

  /** Releases geometries, materials and the generated glow texture. */
  dispose(): void;
}
