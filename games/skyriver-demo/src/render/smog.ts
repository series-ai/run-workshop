/**
 * @file smog.ts — one instanced world-space smog batch: the drifting clouds R23 adds.
 *
 * One InstancedMesh, one material, one draw call, whatever the instance count. Every cloud is a
 * seeded world-space record — centre, ellipsoid size, drift axis, band drift rate, phase — and its
 * motion is a pure periodic function of presentation time, so two peers at the same tick draw the
 * same sky and a frozen frame never drifts.
 *
 * Drift is canyon-aligned at each cloud's own seeded centre, not a random world direction: the air
 * in a corridor moves along the corridor. The rate is per band, from one table, and the CPU twin and
 * the vertex shader both evaluate it from that one record — the shader has no drift uniform left to
 * disagree with.
 *
 * The quads turn to face the camera, but their CENTRES are world positions, so they show real
 * parallax: flying past a cloud moves it across the frame. They are low-energy additive, which
 * keeps overlapping instances order-independent and avoids stacking a second absorption layer on
 * top of the marched volume. The volume supplies the depth-aware light response; the smog supplies
 * low-contrast shape and drift.
 *
 * Placement deliberately avoids long, equally spaced horizontal rows: those read as road surfaces
 * in a canyon full of traffic lanes. Every centre is hash-jittered in all three axes and the
 * altitude bands are themselves jittered per instance.
 */
import * as THREE from 'three';

import { applySkyriverFog, skyriverFogUniforms } from './atmosphere';
import { CANYON_LOOP_LENGTH_M, warpCanyon, warpDirection, type WarpOut } from './canyonWarp';
import { SKYRIVER_DEPTH_FADE_GLSL, type SkyriverDepthSnapshot } from './depthFade';
import { skyriverDeclareStageRole } from './stageRoles';

/** The requested counts: 200-400 on high, half of that on medium, none on low. */
export const SKYRIVER_SMOG_HIGH_MIN = 200;
export const SKYRIVER_SMOG_HIGH_MAX = 400;

/** Base drift rate, metres per second. Slow enough to read as weather, not wind-tunnel motion. */
export const SKYRIVER_SMOG_DRIFT_MPS = 2.6;
/** Base drift period, seconds. The path is pure and periodic, so it never accumulates error. */
export const SKYRIVER_SMOG_DRIFT_PERIOD_S = 240;
/**
 * The thinner middle band drifts modestly faster, on its own shorter period.
 *
 * Parallax separation: a middle band sliding at the deck layer's rate and phase reads as one sheet
 * of air at two altitudes. A faster rate on a different period makes the two layers cross, which is
 * what gives the canyon depth when the shuttle flies through them. It is a RATE change only — the
 * path stays the same bounded periodic sine, and the amplitude stays rate x period / 2*pi.
 */
export const SKYRIVER_SMOG_MIDDLE_DRIFT_MPS = 4.1;
export const SKYRIVER_SMOG_MIDDLE_DRIFT_PERIOD_S = 170;

/**
 * Most clouds sit above the low deck; a thinner band threads the middle city.
 *
 * `driftMps` and `driftPeriodS` are per band, and they are the ONE place either is defined: the
 * cloud records carry them, `skyriverSmogCentreAt` evaluates from the record, and the vertex shader
 * reads the same two numbers off the `aDriftRate` instance attribute. There is no uniform that
 * could hold a third, different rate.
 */
export const SKYRIVER_SMOG_BANDS: readonly {
  readonly share: number;
  readonly minY: number;
  readonly maxY: number;
  readonly radiusM: readonly [number, number];
  readonly opacity: number;
  readonly driftMps: number;
  readonly driftPeriodS: number;
}[] = Object.freeze([
  // The deck smog layer: the thick warm air just over the service deck.
  Object.freeze({
    share: 0.56, minY: 90, maxY: 620, radiusM: Object.freeze([110, 320]) as readonly [number, number], opacity: 1,
    driftMps: SKYRIVER_SMOG_DRIFT_MPS, driftPeriodS: SKYRIVER_SMOG_DRIFT_PERIOD_S,
  }),
  // A thinner middle-city band, drifting modestly faster so it separates in parallax.
  Object.freeze({
    share: 0.3, minY: 700, maxY: 1650, radiusM: Object.freeze([140, 380]) as readonly [number, number], opacity: 0.62,
    driftMps: SKYRIVER_SMOG_MIDDLE_DRIFT_MPS, driftPeriodS: SKYRIVER_SMOG_MIDDLE_DRIFT_PERIOD_S,
  }),
  // A few high wisps against the pristine tops.
  Object.freeze({
    share: 0.14, minY: 1750, maxY: 2900, radiusM: Object.freeze([180, 460]) as readonly [number, number], opacity: 0.4,
    driftMps: SKYRIVER_SMOG_DRIFT_MPS, driftPeriodS: SKYRIVER_SMOG_DRIFT_PERIOD_S,
  }),
]);

/**
 * How far off the canyon's own direction a cloud's drift may lean, as a fraction of its along-canyon
 * component.
 *
 * The drift is canyon-aligned at the cloud's OWN seeded centre: the air in a canyon moves up or down
 * the corridor, not across it into a wall. A small across-canyon and vertical lean per cloud keeps
 * the band from looking like one rigid sheet without turning the motion into random weather.
 */
export const SKYRIVER_SMOG_DRIFT_ACROSS_LEAN = 0.26;
export const SKYRIVER_SMOG_DRIFT_RISE_LEAN = 0.16;
/** Low-energy additive scatter. Not a bright emissive sheet. */
export const SKYRIVER_SMOG_INTENSITY = 0.016;
/** Half-width of the canyon band clouds are seeded across, metres. */
export const SKYRIVER_SMOG_HALF_WIDTH_M = 520;

/** One seeded cloud, exactly as drawn. */
export interface SkyriverSmogCloud {
  readonly id: number;
  /** Seeded world centre at time zero. Drift is added on top of this, in world space. */
  readonly centre: readonly [number, number, number];
  /**
   * The canyon position the centre was seeded at, metres along the loop.
   *
   * Kept because it is what makes the drift axis checkable: the axis must be canyon-aligned at THIS
   * v, and the loop's heading turns a full lap, so a direction is parallel to the corridor
   * somewhere no matter how it was chosen. Only the heading here means anything.
   */
  readonly routeV: number;
  /** Ellipsoid half-extents, metres. */
  readonly size: readonly [number, number, number];
  /** Unit drift axis, canyon-aligned at this cloud's own centre. */
  readonly drift: readonly [number, number, number];
  readonly phase: number;
  readonly seed: number;
  readonly opacity: number;
  readonly band: number;
  /** This band's drift rate and period. The GPU reads the same two numbers per instance. */
  readonly driftMps: number;
  readonly driftPeriodS: number;
}

function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Builds the cloud records. Pure: same seed and count in, same records out, no GL and no Math.random.
 *
 * The canyon coordinate is warped into world space with the same `warpCanyon` the city and the
 * beams use, so the clouds follow the drawn canyon rather than a straight corridor.
 */
export function skyriverBuildSmogClouds(seed: number, count: number): readonly SkyriverSmogCloud[] {
  const clouds: SkyriverSmogCloud[] = [];
  const warp: WarpOut = { x: 0, z: 0, heading: 0 };
  const driftDirection = { x: 0, z: 0 };
  // Band boundaries as running cumulative shares, so a count change keeps the same proportions.
  const shares: number[] = [];
  let running = 0;
  for (const band of SKYRIVER_SMOG_BANDS) {
    running += band.share;
    shares.push(running);
  }

  for (let i = 0; i < count; i += 1) {
    const base = seed * 0.0013 + i * 1.7;
    const pick = hash1(base + 11.3) * running;
    let bandIndex = SKYRIVER_SMOG_BANDS.length - 1;
    for (let b = 0; b < shares.length; b += 1) {
      if (pick <= shares[b]!) {
        bandIndex = b;
        break;
      }
    }
    const band = SKYRIVER_SMOG_BANDS[bandIndex]!;

    // Along the loop: a hashed position, never an even step. Even steps make horizontal rows.
    const v = hash1(base + 2.9) * CANYON_LOOP_LENGTH_M - CANYON_LOOP_LENGTH_M * 0.5;
    const across = (hash1(base + 5.1) * 2 - 1) * SKYRIVER_SMOG_HALF_WIDTH_M;
    warpCanyon(across, v, warp);
    const y = band.minY + hash1(base + 7.7) * (band.maxY - band.minY);

    const radiusSpan = band.radiusM[1] - band.radiusM[0];
    const radius = band.radiusM[0] + hash1(base + 13.1) * radiusSpan;
    // Varied ellipsoids: wide and flat, or tall and narrow, never one repeated puff.
    const stretchX = 0.7 + hash1(base + 17.3) * 1.5;
    const stretchY = 0.26 + hash1(base + 19.7) * 0.5;
    const stretchZ = 0.7 + hash1(base + 23.9) * 1.5;

    // Canyon-aligned drift at THIS centre: along the corridor's own heading there, up or down it,
    // with a small per-cloud lean across and in height. `warp.heading` is the heading the same
    // `warpCanyon` call above returned for this cloud's v, so the direction follows the drawn bend
    // rather than a world compass angle.
    const along = hash1(base + 29.1) < 0.5 ? -1 : 1;
    const acrossLean = (hash1(base + 31.7) * 2 - 1) * SKYRIVER_SMOG_DRIFT_ACROSS_LEAN;
    const riseLean = (hash1(base + 37.3) * 2 - 1) * SKYRIVER_SMOG_DRIFT_RISE_LEAN;
    warpDirection(acrossLean * along, along, warp.heading, driftDirection);
    const driftLength = Math.hypot(driftDirection.x, riseLean, driftDirection.z);

    clouds.push({
      id: i,
      centre: [warp.x, y, warp.z],
      routeV: v,
      size: [radius * stretchX, radius * stretchY, radius * stretchZ],
      drift: [
        driftDirection.x / driftLength,
        riseLean / driftLength,
        driftDirection.z / driftLength,
      ],
      phase: hash1(base + 41.9) * Math.PI * 2,
      seed: hash1(base + 43.1),
      opacity: band.opacity * (0.6 + hash1(base + 47.3) * 0.7),
      band: bandIndex,
      driftMps: band.driftMps,
      driftPeriodS: band.driftPeriodS,
    });
  }
  return clouds;
}

/**
 * A cloud's world centre at a presentation time. Pure, periodic, allocation-free into `out`.
 *
 * The same function the vertex shader runs, so a node check can assert the drift the GPU draws.
 */
export function skyriverSmogCentreAt(
  cloud: SkyriverSmogCloud,
  timeS: number,
  out: [number, number, number],
): [number, number, number] {
  const angle = (timeS / cloud.driftPeriodS) * Math.PI * 2 + cloud.phase;
  const travel = Math.sin(angle) * cloud.driftMps * cloud.driftPeriodS / (Math.PI * 2);
  out[0] = cloud.centre[0] + cloud.drift[0] * travel;
  out[1] = cloud.centre[1] + cloud.drift[1] * travel;
  out[2] = cloud.centre[2] + cloud.drift[2] * travel;
  return out;
}

const SMOG_VERTEX = /* glsl */ `
attribute vec3 aCentre;
attribute vec3 aSize;
attribute vec3 aDrift;
attribute vec2 aPhaseSeed;   // drift phase, per-cloud seed
attribute vec2 aDriftRate;   // this band's drift rate (m/s) and period (s)
attribute float aOpacity;

uniform float uTime;

varying vec2 vQuadUv;
varying float vSeed;
varying float vOpacity;

#include <fog_pars_vertex>

void main() {
  // The pure periodic drift path, from this cloud's own band rate and period. The CPU twin is
  // skyriverSmogCentreAt, and both read the same two numbers out of the same record.
  float angle = ( uTime / aDriftRate.y ) * 6.2831853 + aPhaseSeed.x;
  float travel = sin( angle ) * aDriftRate.x * aDriftRate.y / 6.2831853;
  vec3 centre = aCentre + aDrift * travel;

  // The quad turns to face the camera; its centre stays a world position, so it shows parallax.
  vec3 toCamera = cameraPosition - centre;
  float toCameraLength = length( toCamera );
  vec3 forward = toCameraLength > 1e-3 ? toCamera / toCameraLength : vec3( 0.0, 0.0, 1.0 );
  vec3 right = cross( vec3( 0.0, 1.0, 0.0 ), forward );
  float rightLength = length( right );
  right = rightLength > 1e-4 ? right / rightLength : vec3( 1.0, 0.0, 0.0 );
  vec3 up = cross( forward, right );

  // Ellipsoid extents projected onto the facing basis: a flat cloud stays flat from any angle.
  float halfWidth = length( vec3( right.x * aSize.x, right.y * aSize.y, right.z * aSize.z ) );
  float halfHeight = length( vec3( up.x * aSize.x, up.y * aSize.y, up.z * aSize.z ) );

  vQuadUv = position.xy * 2.0;
  vSeed = aPhaseSeed.y;
  vOpacity = aOpacity;

  vec3 world = centre + right * ( position.x * 2.0 * halfWidth ) + up * ( position.y * 2.0 * halfHeight );
  vec4 mvPosition = viewMatrix * vec4( world, 1.0 );
  #ifdef USE_FOG
    vFogDepth = - mvPosition.z;
    vSkyFogHeight = world.y;
  #endif
  gl_Position = projectionMatrix * mvPosition;
}
`;

const SMOG_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uTint;

varying vec2 vQuadUv;
varying float vSeed;
varying float vOpacity;

#include <fog_pars_fragment>
${SKYRIVER_DEPTH_FADE_GLSL}

void main() {
  // A soft radial puff. vQuadUv reaches 1 at the quad's edge midpoints, so the Gaussian is
  // windowed to exactly zero there: without the window its edge value (~0.09) would draw the
  // billboard's own outline, and a canyon full of overlapping outlines reads as hard geometry.
  float r = length( vQuadUv );
  float body = exp( - r * r * 3.0 ) * ( 1.0 - smoothstep( 0.7, 1.0, r ) );
  if ( body < 0.0015 ) discard;

  float breathe = 0.86 + 0.14 * sin( uTime * 0.21 + vSeed * 6.2831853 );
  vec3 colour = uTint * ( body * vOpacity * breathe * uIntensity );

  gl_FragColor = vec4( colour, 1.0 );

  #ifdef USE_FOG
    // Own-depth analytic attenuation: the stated transparent approximation, not marched absorption.
    gl_FragColor.rgb *= 1.0 - skyriverFogFactor();
  #endif
  // R20 depth soft fade: a cloud intersecting a wall fades instead of showing a cut edge.
  gl_FragColor.rgb *= skyriverVisibilityFade();
}
`;

/**
 * The smog fragment source, exported so a node check can assert it keeps its own-depth analytic
 * attenuation and the R20 depth fade. That attenuation is R23's stated transparent approximation,
 * not marched absorption.
 */
export const SKYRIVER_SMOG_FRAGMENT_SOURCE = SMOG_FRAGMENT;

/**
 * The smog vertex source, exported so a node check can assert the GPU path evaluates the drift from
 * the same per-instance rate record the CPU twin uses, and from no uniform.
 */
export const SKYRIVER_SMOG_VERTEX_SOURCE = SMOG_VERTEX;

export interface SkyriverSmogOptions {
  readonly seed: number;
  readonly depthFade: SkyriverDepthSnapshot;
  /** Instance capacity. Allocated once at the high count so a tier change never rebuilds the batch. */
  readonly capacity?: number;
}

export interface SkyriverSmogStats {
  readonly capacity: number;
  readonly drawn: number;
  readonly draws: number;
  readonly visible: boolean;
  readonly driftTimeS: number;
  readonly intensity: number;
  readonly bandCounts: readonly number[];
  /** The drift rate and period actually carried by the drawn instances of each band. */
  readonly bandDrift: readonly {
    readonly band: number;
    readonly driftMps: number;
    readonly driftPeriodS: number;
    readonly travelAmplitudeM: number;
  }[];
}

/** One instanced batch. The count changes with the tier; the batch and its material never do. */
export class SkyriverSmog {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly clouds: readonly SkyriverSmogCloud[];
  private readonly centreAttr: THREE.InstancedBufferAttribute;
  private driftTimeS = 0;
  private drawn = 0;

  constructor(options: SkyriverSmogOptions) {
    const capacity = Math.max(1, Math.round(options.capacity ?? SKYRIVER_SMOG_HIGH_MAX));
    this.clouds = skyriverBuildSmogClouds(options.seed, capacity);

    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));

    const centre = new Float32Array(capacity * 3);
    const size = new Float32Array(capacity * 3);
    const drift = new Float32Array(capacity * 3);
    const phaseSeed = new Float32Array(capacity * 2);
    const driftRate = new Float32Array(capacity * 2);
    const opacity = new Float32Array(capacity);
    for (let i = 0; i < capacity; i += 1) {
      const cloud = this.clouds[i]!;
      centre[i * 3] = cloud.centre[0];
      centre[i * 3 + 1] = cloud.centre[1];
      centre[i * 3 + 2] = cloud.centre[2];
      size[i * 3] = cloud.size[0];
      size[i * 3 + 1] = cloud.size[1];
      size[i * 3 + 2] = cloud.size[2];
      drift[i * 3] = cloud.drift[0];
      drift[i * 3 + 1] = cloud.drift[1];
      drift[i * 3 + 2] = cloud.drift[2];
      phaseSeed[i * 2] = cloud.phase;
      phaseSeed[i * 2 + 1] = cloud.seed;
      driftRate[i * 2] = cloud.driftMps;
      driftRate[i * 2 + 1] = cloud.driftPeriodS;
      opacity[i] = cloud.opacity;
    }
    this.centreAttr = new THREE.InstancedBufferAttribute(centre, 3);
    this.geometry.setAttribute('aCentre', this.centreAttr);
    this.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
    this.geometry.setAttribute('aDrift', new THREE.InstancedBufferAttribute(drift, 3));
    this.geometry.setAttribute('aPhaseSeed', new THREE.InstancedBufferAttribute(phaseSeed, 2));
    this.geometry.setAttribute('aDriftRate', new THREE.InstancedBufferAttribute(driftRate, 2));
    this.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
    this.geometry.instanceCount = capacity;
    this.drawn = capacity;

    this.material = new THREE.ShaderMaterial({
      name: 'skyriver.smog',
      vertexShader: SMOG_VERTEX,
      fragmentShader: SMOG_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: SKYRIVER_SMOG_INTENSITY },
        // A near-neutral grey at the grime air's own tone: shape and drift, not a colour wash.
        uTint: { value: new THREE.Vector3(0.74, 0.76, 0.82) },
        ...options.depthFade.uniforms,
        ...skyriverFogUniforms(),
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: true,
    });
    applySkyriverFog(this.material);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'skyriver.smog';
    // Rebuilt in world space in the vertex shader: object-space bounds are meaningless, and culling
    // off keeps the draw count fixed for the A3 assertion.
    this.mesh.frustumCulled = false;
    // After the opaque city, before the main beam batch (renderOrder 5).
    this.mesh.renderOrder = 3;
    // R23 draw role: transparent additive, depthWrite off.
    skyriverDeclareStageRole(this.mesh, 'transparent');
    // R23 captures the opaque depth explicitly after the opaque stage, so this callback only ever
    // reuses that completed snapshot. On the legacy off/Low path it is the first transparent draw
    // and starts the capture, exactly as the beams and the plume already do.
    this.mesh.onBeforeRender = (renderer) => options.depthFade.capture(renderer);
    quad.dispose();
  }

  /** The drawn instance count. Zero hides the batch; the mesh and material stay allocated. */
  setCount(count: number): void {
    const clamped = Math.max(0, Math.min(this.clouds.length, Math.round(count)));
    this.geometry.instanceCount = clamped;
    this.drawn = clamped;
    this.mesh.visible = clamped > 0;
  }

  update(timeS: number): void {
    this.driftTimeS = timeS;
    this.material.uniforms.uTime!.value = timeS;
  }

  records(): readonly SkyriverSmogCloud[] {
    return this.clouds.slice(0, this.drawn);
  }

  /** Drawn centres at the bound drift time. Evidence that the clouds move in world space. */
  drawnCentres(): readonly { readonly id: number; readonly centre: readonly [number, number, number] }[] {
    const out: { id: number; centre: readonly [number, number, number] }[] = [];
    const scratch: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < this.drawn; i += 1) {
      const cloud = this.clouds[i]!;
      skyriverSmogCentreAt(cloud, this.driftTimeS, scratch);
      out.push({ id: cloud.id, centre: [scratch[0], scratch[1], scratch[2]] });
    }
    return out;
  }

  stats(): SkyriverSmogStats {
    const bandCounts = SKYRIVER_SMOG_BANDS.map(() => 0);
    for (let i = 0; i < this.drawn; i += 1) bandCounts[this.clouds[i]!.band] += 1;
    return {
      capacity: this.clouds.length,
      drawn: this.drawn,
      draws: this.drawn > 0 ? 1 : 0,
      visible: this.mesh.visible,
      driftTimeS: this.driftTimeS,
      intensity: this.material.uniforms.uIntensity!.value as number,
      bandCounts,
      bandDrift: SKYRIVER_SMOG_BANDS.map((band, index) => ({
        band: index,
        driftMps: band.driftMps,
        driftPeriodS: band.driftPeriodS,
        // The bound on |centre - seeded centre|: rate x period / 2*pi, from the sine path itself.
        travelAmplitudeM: (band.driftMps * band.driftPeriodS) / (Math.PI * 2),
      })),
    };
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
