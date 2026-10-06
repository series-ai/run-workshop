/**
 * @file shuttle.ts — the red transit shuttle the chase cam follows (T6, reworked in T6R).
 *
 * T6R root cause (P0 "pink block with legs"): the T6 `appendBox` destructured each face as
 * `[a, b, c]`, which shadowed the blue-channel parameter `b`. Every vertex got its corner index
 * (0..7) as blue, so the dark-red hull rendered fuchsia/white. The fog chunk and the colour-space
 * path were checked in a GPU browser and are not involved. The hull builder below takes colours as
 * one tuple, so a channel can no longer be shadowed by a loop variable.
 *
 * Cost: exactly 2 draw calls.
 *   (1) Hull: one merged, vertex-coloured MeshBasicMaterial. Regions are colour ranges, not
 *       materials: dark-red paint with baked face shading, near-black glazing, and HDR emissive
 *       values (> 1) for the taillight strip and nozzle throats. ACES rolls the HDR values off into
 *       a hot, saturated red instead of a clipped white.
 *   (2) Plume: one additive ShaderMaterial holding two axial-billboard flames (tapered, with a
 *       white-hot core) plus two camera-facing throat flares. It swells on boost.
 * Draw-call budget (plan R3 <= 16): 7 city/atmosphere + 4 traffic + 2 shuttle = 13.
 *
 * Unlit by design: the scene has no Light objects, so shading is baked per face from a fixed key
 * direction plus a cool rim from the overcast, like the city and the traffic.
 */
import * as THREE from 'three';

import { applySkyriverFog } from './atmosphere';

export interface SkyriverShuttleUpdate {
  /** Boost intensity from the projection: 1 at rest cruise, ~1.8 while boosting. */
  readonly boostIntensity: number;
  /** Continuous time in seconds (tick + alpha) for the plume flicker phase. */
  readonly time: number;
}

export interface SkyriverShuttle {
  readonly objects: readonly THREE.Object3D[];
  /** Direct pose write (sim turns: yaw/pitch/roll are revolutions). The plume rides the hull. */
  setPose(x: number, y: number, z: number, yawTurns: number, pitchTurns: number, rollTurns?: number): void;
  update(update: SkyriverShuttleUpdate): void;
  dispose(): void;
}

type Rgb = readonly [number, number, number];
type Vec3 = readonly [number, number, number];

/** Linear-space paint. The hull is a deep lacquered red, never pink. */
const PAINT: Rgb = [0.25, 0.012, 0.014];
const PAINT_DARK: Rgb = [0.09, 0.005, 0.007];
const GLAZING: Rgb = [0.012, 0.016, 0.024];
const TRIM: Rgb = [0.018, 0.018, 0.022];
/** HDR emissive: ACES maps this to a saturated, hot red. */
const TAILLIGHT: Rgb = [1.7, 0.02, 0.012];
const TAILLIGHT_SOFT: Rgb = [0.9, 0.01, 0.008];
const THROAT: Rgb = [2.6, 3.6, 5.2];
const MARKER: Rgb = [0.25, 1.6, 2.0];

/** Key light from above-front-right; a cool rim from the overcast on up-facing faces. */
const KEY: Vec3 = normalize3([0.35, 0.85, 0.4]);
const RIM: Rgb = [0.012, 0.022, 0.04];

function normalize3(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

interface HullBuild {
  readonly positions: number[];
  readonly colors: number[];
}

/** One flat-shaded triangle. `emissive` colours skip the baked shading entirely. */
function pushTri(build: HullBuild, a: Vec3, b: Vec3, c: Vec3, color: Rgb, emissive: boolean): void {
  const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = normalize3([
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ]);
  let rgb: Rgb = color;
  if (!emissive) {
    // Double-sided material, so shade on |n·L| — winding cannot flip a face dark.
    const key = Math.abs(n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]);
    const shade = 0.38 + 0.75 * key;
    const up = Math.max(0, Math.abs(n[1]));
    rgb = [
      color[0] * shade + RIM[0] * up,
      color[1] * shade + RIM[1] * up,
      color[2] * shade + RIM[2] * up,
    ];
  }
  for (const p of [a, b, c]) {
    build.positions.push(p[0], p[1], p[2]);
    build.colors.push(rgb[0], rgb[1], rgb[2]);
  }
}

function pushQuad(build: HullBuild, a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Rgb, emissive = false): void {
  pushTri(build, a, b, c, color, emissive);
  pushTri(build, a, c, d, color, emissive);
}

/**
 * A ring is a trapezoid cross-section at one z: half-widths at the floor and the roof line.
 * Consecutive rings are lofted into side, roof and floor panels.
 */
interface Ring {
  readonly z: number;
  readonly yLow: number;
  readonly yHigh: number;
  readonly halfLow: number;
  readonly halfHigh: number;
}

function ringCorners(r: Ring): readonly [Vec3, Vec3, Vec3, Vec3] {
  return [
    [-r.halfLow, r.yLow, r.z],
    [r.halfLow, r.yLow, r.z],
    [r.halfHigh, r.yHigh, r.z],
    [-r.halfHigh, r.yHigh, r.z],
  ];
}

function loft(build: HullBuild, rings: readonly Ring[], side: Rgb, roof: Rgb, floor: Rgb): void {
  for (let i = 0; i + 1 < rings.length; i += 1) {
    const [a0, a1, a2, a3] = ringCorners(rings[i]!);
    const [b0, b1, b2, b3] = ringCorners(rings[i + 1]!);
    pushQuad(build, a1, b1, b2, a2, side); // starboard
    pushQuad(build, a3, b3, b0, a0, side); // port
    pushQuad(build, a2, b2, b3, a3, roof); // roof
    pushQuad(build, a0, b0, b1, a1, floor); // floor
  }
}

function capRing(build: HullBuild, ring: Ring, color: Rgb): void {
  const [c0, c1, c2, c3] = ringCorners(ring);
  pushQuad(build, c0, c1, c2, c3, color);
}

/** Axis-aligned box: centre and full extents. */
function pushBox(build: HullBuild, centre: Vec3, size: Vec3, color: Rgb, emissive = false): void {
  const [cx, cy, cz] = centre;
  const hx = size[0] / 2;
  const hy = size[1] / 2;
  const hz = size[2] / 2;
  const p = (sx: number, sy: number, sz: number): Vec3 => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  pushQuad(build, p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1), color, emissive); // -Z tail
  pushQuad(build, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), color, emissive); // +Z
  pushQuad(build, p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), color, emissive);
  pushQuad(build, p(1, -1, -1), p(1, -1, 1), p(1, 1, 1), p(1, 1, -1), color, emissive);
  pushQuad(build, p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1), color, emissive); // top
  pushQuad(build, p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), color, emissive);
}

/** Tail at z = TAIL_Z; the strip and the nozzles sit just behind it. */
const TAIL_Z = -5.6;
const NOZZLE_X = 1.65;
const NOZZLE_Y = -0.38;

function buildHull(): HullBuild {
  const build: HullBuild = { positions: [], colors: [] };

  // Low wedge body: widest over the rear deck, pinching to a blade nose. Nose at +Z.
  const body: Ring[] = [
    { z: TAIL_Z, yLow: -0.72, yHigh: 0.78, halfLow: 2.85, halfHigh: 2.6 },
    { z: -2.4, yLow: -0.82, yHigh: 0.86, halfLow: 3.0, halfHigh: 2.62 },
    { z: 1.6, yLow: -0.74, yHigh: 0.62, halfLow: 2.7, halfHigh: 2.2 },
    { z: 4.6, yLow: -0.58, yHigh: 0.2, halfLow: 2.0, halfHigh: 1.35 },
    { z: 6.6, yLow: -0.42, yHigh: -0.12, halfLow: 0.9, halfHigh: 0.5 },
  ];
  loft(build, body, PAINT, PAINT, PAINT_DARK);
  capRing(build, body[0]!, PAINT_DARK);
  capRing(build, body[body.length - 1]!, PAINT);

  // Fastback canopy: dark glazing, raked toward the nose.
  const canopy: Ring[] = [
    { z: -4.3, yLow: 0.78, yHigh: 1.02, halfLow: 2.2, halfHigh: 1.9 },
    { z: -2.0, yLow: 0.86, yHigh: 1.62, halfLow: 2.2, halfHigh: 1.55 },
    { z: 1.0, yLow: 0.66, yHigh: 1.5, halfLow: 2.0, halfHigh: 1.35 },
    { z: 3.2, yLow: 0.36, yHigh: 0.5, halfLow: 1.7, halfHigh: 1.5 },
  ];
  loft(build, canopy, GLAZING, GLAZING, GLAZING);
  capRing(build, canopy[0]!, GLAZING);

  // Rear deck lip above the strip, and the dark diffuser below it.
  pushBox(build, [0, 0.86, TAIL_Z + 0.1], [5.5, 0.16, 0.6], PAINT);
  pushBox(build, [0, -0.62, TAIL_Z - 0.02], [5.3, 0.22, 0.2], TRIM);

  // The signature: one hot horizontal taillight strip across the full tail, plus a softer
  // under-bar so the strip has a glow footprint even before the camera resolves its thickness.
  pushBox(build, [0, 0.46, TAIL_Z - 0.08], [5.4, 0.3, 0.1], TAILLIGHT, true);
  pushBox(build, [0, 0.24, TAIL_Z - 0.06], [4.6, 0.08, 0.08], TAILLIGHT_SOFT, true);

  // Twin thruster nozzles under the deck: dark collars with incandescent throats facing the camera.
  for (const side of [-1, 1]) {
    pushBox(build, [side * NOZZLE_X, NOZZLE_Y, TAIL_Z - 0.18], [1.35, 0.72, 0.5], TRIM);
    pushQuad(
      build,
      [side * NOZZLE_X - 0.48, NOZZLE_Y - 0.24, TAIL_Z - 0.45],
      [side * NOZZLE_X + 0.48, NOZZLE_Y - 0.24, TAIL_Z - 0.45],
      [side * NOZZLE_X + 0.48, NOZZLE_Y + 0.24, TAIL_Z - 0.45],
      [side * NOZZLE_X - 0.48, NOZZLE_Y + 0.24, TAIL_Z - 0.45],
      THROAT,
      true,
    );
  }

  // Side intakes and cyan cockpit markers: small cold accents that sell scale against the red.
  for (const side of [-1, 1]) {
    pushBox(build, [side * 2.92, -0.12, -1.6], [0.16, 0.42, 3.2], TRIM);
    pushBox(build, [side * 1.62, 1.08, -3.9], [0.12, 0.08, 0.8], MARKER, true);
  }

  return build;
}

// --- plume ------------------------------------------------------------------------------------------

/**
 * Three primitives share one draw call, selected by `aKind`:
 *   0 — flame: an axial billboard pinned to the nozzle axis (-Z in hull space) that spins about the
 *       axis to face the camera, tapered from the throat to a point.
 *   1 — flare: a camera-facing disc at the throat, the bright core the chase cam always sees, even
 *       when it looks straight down the flame axis.
 */
const PLUME_VERTEX = /* glsl */ `
attribute vec3 aNozzle;
attribute vec2 aTS;     // t along the flame 0..1, s across -1..1
attribute float aKind;

uniform float uLength;
uniform vec2 uStripSize;
uniform float uWidth;
uniform float uFlare;

varying vec2 vTS;
varying float vKind;

void main() {
  vec3 nozzle = ( modelMatrix * vec4( aNozzle, 1.0 ) ).xyz;
  vec3 axis = normalize( mat3( modelMatrix ) * vec3( 0.0, 0.0, -1.0 ) );
  vec3 world;
  if ( aKind < 0.5 ) {
    float t = aTS.x;
    vec3 centre = nozzle + axis * ( t * uLength );
    vec3 toCam = cameraPosition - centre;
    vec3 right = cross( axis, toCam );
    float len = length( right );
    right = len > 1e-4 ? right / len : vec3( 1.0, 0.0, 0.0 );
    // Bulb just behind the throat, then a long taper to a point.
    float width = uWidth * ( 0.75 + 0.55 * sin( min( t * 6.0, 3.14159 ) * 0.5 ) ) * ( 1.0 - t );
    world = centre + right * ( aTS.y * 0.5 * width );
  } else if ( aKind < 1.5 ) {
    vec3 toCam = normalize( cameraPosition - nozzle );
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    vec3 up = cross( toCam, right );
    world = nozzle + toCam * 0.4 + ( right * aTS.x + up * aTS.y ) * uFlare;
  } else {
    // Strip glow: a bar in the tail plane, a little proud of the strip, sized past its ends.
    vec3 right = normalize( mat3( modelMatrix ) * vec3( 1.0, 0.0, 0.0 ) );
    vec3 up = normalize( mat3( modelMatrix ) * vec3( 0.0, 1.0, 0.0 ) );
    world = nozzle + right * ( aTS.x * uStripSize.x * 0.5 ) + up * ( aTS.y * uStripSize.y * 0.5 );
  }
  vTS = aTS;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}
`;

const PLUME_FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uTime;

varying vec2 vTS;
varying float vKind;

void main() {
  vec3 outer = vec3( 0.18, 0.5, 1.0 );
  vec3 hot = vec3( 0.85, 0.95, 1.0 );
  vec3 color;
  if ( vKind < 0.5 ) {
    float t = vTS.x;
    float s = vTS.y;
    float halo = exp( - s * s * 2.6 );
    float core = exp( - s * s * 26.0 ) * pow( 1.0 - t, 2.2 );
    float along = smoothstep( 0.0, 0.03, t ) * pow( 1.0 - t, 1.25 );
    // Shock diamonds drifting down the jet.
    float diamonds = 0.82 + 0.18 * sin( t * 46.0 - uTime * 70.0 );
    color = ( outer * halo * along * 0.7 + hot * core * 1.6 ) * diamonds;
  } else if ( vKind < 1.5 ) {
    float r = length( vTS );
    float disc = exp( - r * r * 5.0 );
    float pin = exp( - r * r * 40.0 );
    color = outer * disc * 0.55 + hot * pin * 1.4;
  } else {
    // The taillight strip's bloom: a hot red bar fading out vertically and at the ends.
    float across = exp( - vTS.y * vTS.y * 7.0 );
    float ends = 1.0 - smoothstep( 0.72, 1.0, abs( vTS.x ) );
    color = vec3( 1.0, 0.04, 0.03 ) * across * ends * 0.55 / max( uIntensity, 0.001 );
  }
  gl_FragColor = vec4( color * uIntensity, 1.0 );
}
`;

function buildPlumeGeometry(): THREE.BufferGeometry {
  const nozzle: number[] = [];
  const ts: number[] = [];
  const kind: number[] = [];
  const index: number[] = [];
  let vertex = 0;
  const SEGMENTS = 10;

  for (const side of [-1, 1]) {
    const nx = side * NOZZLE_X;
    const nz = TAIL_Z - 0.5;
    // Flame strip: SEGMENTS quads along t.
    const base = vertex;
    for (let i = 0; i <= SEGMENTS; i += 1) {
      for (const s of [-1, 1]) {
        nozzle.push(nx, NOZZLE_Y, nz);
        ts.push(i / SEGMENTS, s);
        kind.push(0);
        vertex += 1;
      }
    }
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    // Throat flare quad.
    const flare = vertex;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      nozzle.push(nx, NOZZLE_Y, nz);
      ts.push(u, v);
      kind.push(1);
      vertex += 1;
    }
    index.push(flare, flare + 1, flare + 2, flare, flare + 2, flare + 3);
  }
  // Strip glow bar, centred on the taillight strip just behind the tail.
  const strip = vertex;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    nozzle.push(0, 0.42, TAIL_Z - 0.3);
    ts.push(u, v);
    kind.push(2);
    vertex += 1;
  }
  index.push(strip, strip + 1, strip + 2, strip, strip + 2, strip + 3);

  const geometry = new THREE.BufferGeometry();
  // three requires a `position` attribute to size the draw; the shader builds positions itself.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertex * 3), 3));
  geometry.setAttribute('aNozzle', new THREE.Float32BufferAttribute(nozzle, 3));
  geometry.setAttribute('aTS', new THREE.Float32BufferAttribute(ts, 2));
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geometry.setIndex(index);
  return geometry;
}

/** Cruise and boost plume shapes, metres. Boost roughly doubles the jet and brightens the core. */
const PLUME_CRUISE = Object.freeze({ length: 8, width: 1.5, flare: 1.5, intensity: 1.0 });
const PLUME_BOOST = Object.freeze({ length: 19, width: 2.3, flare: 2.6, intensity: 1.9 });

export function createSkyriverShuttle(): SkyriverShuttle {
  const build = buildHull();
  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(build.positions, 3));
  hullGeometry.setAttribute('color', new THREE.Float32BufferAttribute(build.colors, 3));
  hullGeometry.computeBoundingSphere();
  const hullMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide });
  hullMaterial.name = 'skyriver.shuttle.hull';
  applySkyriverFog(hullMaterial);
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.name = 'skyriver.shuttle.hull';
  hull.rotation.order = 'YXZ';
  hull.frustumCulled = false;

  const plumeGeometry = buildPlumeGeometry();
  const plumeMaterial = new THREE.ShaderMaterial({
    name: 'skyriver.shuttle.plume',
    vertexShader: PLUME_VERTEX,
    fragmentShader: PLUME_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uLength: { value: PLUME_CRUISE.length },
      uWidth: { value: PLUME_CRUISE.width },
      uFlare: { value: PLUME_CRUISE.flare },
      uIntensity: { value: PLUME_CRUISE.intensity },
      uTime: { value: 0 },
      uStripSize: { value: new THREE.Vector2(8.6, 2.4) },
    },
  });
  // The plume is parented to the hull, so the hull's pose is its pose — no copy per frame.
  const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
  plume.name = 'skyriver.shuttle.plume';
  plume.frustumCulled = false;
  plume.renderOrder = 12;
  hull.add(plume);

  return {
    objects: [hull],
    setPose(x: number, y: number, z: number, yawTurns: number, pitchTurns: number, rollTurns = 0): void {
      hull.position.set(x, y, z);
      hull.rotation.set(-pitchTurns * Math.PI * 2, yawTurns * Math.PI * 2, rollTurns * Math.PI * 2);
    },
    update({ boostIntensity, time }: SkyriverShuttleUpdate): void {
      // Pure function of the arguments: no accumulators, so a restore cannot leave a stale flare.
      const boost = Math.min(1, Math.max(0, (boostIntensity - 1) / 0.8));
      const flicker = 0.92 + 0.08 * Math.sin(time * 37.0) * Math.sin(time * 11.0);
      const u = plumeMaterial.uniforms;
      u.uLength!.value = THREE.MathUtils.lerp(PLUME_CRUISE.length, PLUME_BOOST.length, boost) * (0.95 + 0.05 * flicker);
      u.uWidth!.value = THREE.MathUtils.lerp(PLUME_CRUISE.width, PLUME_BOOST.width, boost);
      u.uFlare!.value = THREE.MathUtils.lerp(PLUME_CRUISE.flare, PLUME_BOOST.flare, boost) * flicker;
      u.uIntensity!.value = THREE.MathUtils.lerp(PLUME_CRUISE.intensity, PLUME_BOOST.intensity, boost) * flicker;
      u.uTime!.value = time;
    },
    dispose(): void {
      hullGeometry.dispose();
      hullMaterial.dispose();
      plumeGeometry.dispose();
      plumeMaterial.dispose();
    },
  };
}
