import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAGE_PANELS, type CagePanel } from '../sim/cage';
import type { YardRender } from './presentation';

/** Moving bodies and players this close to the cage (m) light it up. */
const GLOW_RANGE = 3;
/** Body speed (m/s) at which the glow is full; parked props near the walls stay dark. */
const GLOW_SPEED = 4;
const MAX_GLOWS = 8;

/**
 * One plane on the yard-facing side of a cage panel. Attributes: aSurface is
 * the 2D position on the panel in meters (for the hex grid), aRise the height
 * above the panel's bottom edge (for the fade where it meets the wall top).
 */
function panelFace(panel: CagePanel): THREE.BufferGeometry {
  const [sx, sy, sz] = panel.size;
  const [nx, ny, nz] = panel.inward;
  const face = new THREE.Vector3(panel.center[0] + (nx * sx) / 2, panel.center[1] + (ny * sy) / 2, panel.center[2] + (nz * sz) / 2);
  const ceiling = ny !== 0;
  const width = ceiling ? sx : nx !== 0 ? sz : sx;
  const height = ceiling ? sz : sy;
  const plane = new THREE.PlaneGeometry(width, height, 1, 1);
  const surface: number[] = [];
  const rise: number[] = [];
  const positions = plane.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const u = positions.getX(i);
    const v = positions.getY(i);
    const along = ceiling ? face.x + u : nx !== 0 ? face.z + u : face.x + u;
    const up = ceiling ? face.z + v : face.y + v;
    surface.push(along, up);
    rise.push(ceiling ? 100 : v + height / 2);
  }
  plane.setAttribute('aSurface', new THREE.Float32BufferAttribute(surface, 2));
  plane.setAttribute('aRise', new THREE.Float32BufferAttribute(rise, 1));
  // PlaneGeometry faces +Z; turn it to face the yard.
  plane.lookAt(new THREE.Vector3(nx, ny, nz));
  plane.translate(face.x, face.y, face.z);
  return plane;
}

const vertexShader = /* glsl */ `
  attribute vec2 aSurface;
  attribute float aRise;
  varying vec3 vWorld;
  varying vec2 vSurface;
  varying float vRise;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vSurface = aSurface;
    vRise = aRise;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec4 uGlows[${MAX_GLOWS}];
  uniform vec3 uColor;
  varying vec3 vWorld;
  varying vec2 vSurface;
  varying float vRise;

  // Distance from the nearest hex cell edge (0 on an edge), cells 2.4 m across.
  float hexEdge(vec2 p) {
    p /= 1.4;
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 a = mod(p, r) - r * 0.5;
    vec2 b = mod(p - r * 0.5, r) - r * 0.5;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    return 0.5 - max(dot(q, normalize(r)), q.x);
  }

  void main() {
    float edge = hexEdge(vSurface);
    float line = 1.0 - smoothstep(0.0, fwidth(edge) * 1.2 + 0.002, edge);

    float camDist = distance(cameraPosition, vWorld);
    // A faint grid fades in as you get near; far away the cage all but disappears.
    float presence = 0.035 * (1.0 - smoothstep(10.0, 40.0, camDist)) + 0.16 * exp(-camDist * camDist / 40.0);
    float glow = 0.0;
    for (int i = 0; i < ${MAX_GLOWS}; i++) {
      vec3 d = vWorld - uGlows[i].xyz;
      glow += uGlows[i].w * exp(-dot(d, d) / 5.0);
    }
    float strength = (presence + glow) * smoothstep(0.0, 1.5, vRise);
    float alpha = line * strength + glow * 0.05 * smoothstep(0.0, 1.5, vRise);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), clamp(glow, 0.0, 1.0) * 0.5) * alpha, 1.0);
  }
`;

/** Distance (m) from a point to the nearest cage panel (its box), so props parked below the cage stay dark. */
function distanceToCage(x: number, y: number, z: number): number {
  let best = Infinity;
  for (const panel of CAGE_PANELS) {
    const dx = Math.max(0, Math.abs(x - panel.center[0]) - panel.size[0] / 2);
    const dy = Math.max(0, Math.abs(y - panel.center[1]) - panel.size[1] / 2);
    const dz = Math.max(0, Math.abs(z - panel.center[2]) - panel.size[2] / 2);
    best = Math.min(best, Math.hypot(dx, dy, dz));
  }
  return best;
}

/**
 * The arena cage, like Rocket League's: a faint hex grid that you notice when
 * you are near it, and that lights up where bodies or players come close.
 * The colliders live in sim/cage.ts; this draws their yard-facing faces.
 */
export function ArenaCage({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const geometry = useMemo(() => {
    const faces = CAGE_PANELS.map(panelFace);
    const merged = mergeGeometries(faces, false);
    faces.forEach((face) => face.dispose());
    return merged;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uGlows: { value: Array.from({ length: MAX_GLOWS }, () => new THREE.Vector4(0, -1000, 0, 0)) },
      uColor: { value: new THREE.Color('#8fd8ff') },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  const lastPositions = useMemo(() => new Map<string, readonly [number, number, number]>(), []);
  useFrame((_, delta) => {
    const render = renderRef.current;
    const glows = material.uniforms.uGlows!.value as THREE.Vector4[];
    const near: [number, number, number, number][] = [];
    if (render) {
      for (const [id, pose] of render.poses) {
        const [x, y, z] = pose.position;
        const last = lastPositions.get(id);
        lastPositions.set(id, pose.position);
        const d = distanceToCage(x, y, z);
        if (d >= GLOW_RANGE || !last || delta <= 0) continue;
        const speed = Math.hypot(x - last[0], y - last[1], z - last[2]) / delta;
        const moving = Math.min(1, speed / GLOW_SPEED);
        // Rank by how close and how fast; strength carries both.
        if (moving > 0.05) near.push([x, y, z, d + (1 - moving) * GLOW_RANGE]);
      }
      for (const player of render.players) {
        const [x, y, z] = player.position;
        const d = distanceToCage(x, y + 1, z);
        if (d < GLOW_RANGE) near.push([x, y + 1, z, d]);
      }
      near.sort((a, b) => a[3] - b[3]);
    }
    for (let i = 0; i < MAX_GLOWS; i += 1) {
      const entry = near[i];
      if (entry) glows[i]!.set(entry[0], entry[1], entry[2], 1.4 * (1 - entry[3] / GLOW_RANGE));
      else glows[i]!.set(0, -1000, 0, 0);
    }
  });

  return <mesh geometry={geometry} material={material} renderOrder={9} frustumCulled={false} />;
}
