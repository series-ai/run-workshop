/**
 * @file shuttle.ts — the red transit shuttle the chase cam follows (T6).
 *
 * Succeeds the provisional single-mesh marker that lived in main.ts (T5): a dedicated module with
 * a refined hull, a true emissive taillight strip (the concept pair's signature read) and a pulsing
 * additive thruster plume that reacts to boost.
 *
 * Cost: exactly 2 draw calls — (1) merged hull+strip geometry with vertex colours, unlit like the
 * traffic hulls; (2) one additive plume material (three quads merged in a single geometry).
 * Draw-call budget (plan R3 ≤ 16): 7 city/atmosphere + 4 traffic + 2 shuttle = 13.
 *
 * Unlit-by-design: the scene has no Light objects — shading is baked in vertex colours, matching
 * city/traffic conventions. The fog chunk from atmosphere.ts is applied to both materials so the
 * shuttle sits in the Neon Rain haze like everything else.
 */
import * as THREE from 'three';

import { applySkyriverFog } from './atmosphere';

export interface SkyriverShuttleUpdate {
  /** Boost intensity from the projection: 1 at rest cruise, ~1.7 while boosting. */
  readonly boostIntensity: number;
  /** Continuous time in seconds (tick + alpha) for the plume pulse phase. */
  readonly time: number;
}

export interface SkyriverShuttle {
  readonly objects: readonly THREE.Object3D[];
  /** Direct pose write (sim turns: yaw/pitch are revolutions), copied to the plume on update(). */
  setPose(x: number, y: number, z: number, yawTurns: number, pitchTurns: number): void;
  update(update: SkyriverShuttleUpdate): void;
  dispose(): void;
}

/** Adds one axis-aligned box (12 triangles, flat colour) to the accumulating hull buffers. */
function appendBox(
  positions: number[],
  colors: number[],
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
  r: number, g: number, b: number,
): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const corners: readonly [number, number, number][] = [
    [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz],
  ];
  const faces: readonly [number, number, number][] = [
    [0, 2, 1], [0, 3, 2], // -Z (tail — what the chase cam sees)
    [4, 5, 6], [4, 6, 7], // +Z (nose)
    [0, 4, 7], [0, 7, 3], // -X
    [1, 2, 6], [1, 6, 5], // +X
    [0, 1, 5], [0, 5, 4], // -Y
    [3, 7, 6], [3, 6, 2], // +Y
  ];
  for (const [a, b, c] of faces) {
    for (const index of [a, b, c]) {
      const corner = corners[index]!;
      positions.push(corner[0], corner[1], corner[2]);
      colors.push(r, g, b);
    }
  }
}

/** A soft radial glow quad in the XZ-facing plane of the given nozzle, sized by (sx, sy). */
function appendPlumeQuad(
  positions: number[],
  uvs: number[],
  alphas: number[],
  cx: number, cy: number, cz: number,
  sx: number, sy: number,
): void {
  const hx = sx / 2;
  const hy = sy / 2;
  // Faced toward -Z (the chase cam); vertex alpha fades 1 (centre rows) to 0 (edges) in the shader.
  const verts: readonly [number, number, number, number][] = [
    [cx - hx, cy - hy, cz, 0],
    [cx + hx, cy - hy, cz, 0],
    [cx + hx, cy, cz, 1],
    [cx - hx, cy, cz, 1],
    [cx - hx, cy + hy, cz, 0],
    [cx + hx, cy + hy, cz, 0],
  ];
  const tris: readonly [number, number, number, number][] = [
    [0, 1, 4, 1], [1, 2, 4, 0.5], [2, 3, 4, 1], [3, 0, 4, 0.5],
  ];
  for (const [a, b, c, alpha] of tris) {
    for (const index of [a, b, c]) {
      const v = verts[index]!;
      positions.push(v[0], v[1], v[2]);
      uvs.push(v[0] - cx + hx, (v[1] - cy + hy));
      alphas.push(alpha);
    }
  }
}

const PLUME_FRAGMENT = `
  uniform float uOpacity;
  uniform float uCore;
  varying vec2 vUv2;
  varying float vAlpha;
  void main() {
    vec2 p = vUv2 - 0.5;
    float d = length(p) * 2.0;
    float core = 1.0 - smoothstep(0.0, uCore, d);
    float halo = 1.0 - smoothstep(0.0, 1.0, d);
    float a = (core * 0.9 + halo * 0.35) * vAlpha * uOpacity;
    vec3 col = mix(vec3(0.45, 0.85, 1.0), vec3(1.0), core);
    gl_FragColor = vec4(col * a, a);
  }`;

const PLUME_VERTEX = `
  varying vec2 vUv2;
  varying float vAlpha;
  void main() {
    vUv2 = uv * 2.0;
    vAlpha = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export function createSkyriverShuttle(): SkyriverShuttle {
  // ---- Hull (1 draw call): refined silhouette, nose at +Z, matching the sim's forward basis.
  const positions: number[] = [];
  const colors: number[] = [];
  const RED: readonly [number, number, number] = [0.60, 0.10, 0.11];
  const RED_LIGHT: readonly [number, number, number] = [0.74, 0.16, 0.16];
  const DARK: readonly [number, number, number] = [0.16, 0.17, 0.20];
  const GLASS: readonly [number, number, number] = [0.13, 0.24, 0.33];

  appendBox(positions, colors, 0, 0, 1.2, 4.4, 2.2, 11.2, ...RED);            // hull
  appendBox(positions, colors, 0, 1.30, 0.3, 2.7, 0.6, 6.4, ...RED_LIGHT);     // spine
  appendBox(positions, colors, 0, 0.42, 4.6, 2.4, 1.1, 2.8, ...GLASS);         // canopy
  appendBox(positions, colors, -3.2, -0.14, -0.8, 2.3, 0.55, 5.6, ...RED);     // port wing
  appendBox(positions, colors, 3.2, -0.14, -0.8, 2.3, 0.55, 5.6, ...RED);      // starboard wing
  appendBox(positions, colors, -3.05, 0.35, -2.2, 0.5, 1.3, 0.5, ...DARK);     // wingtip fins
  appendBox(positions, colors, 3.05, 0.35, -2.2, 0.5, 1.3, 0.5, ...DARK);
  appendBox(positions, colors, -1.45, 0, -5.35, 1.35, 1.35, 1.35, ...DARK);    // nozzle collars
  appendBox(positions, colors, 1.45, 0, -5.35, 1.35, 1.35, 1.35, ...DARK);
  // The signature horizontal taillight strip across the tail — emissive red, what the camera sees
  // first in every approved concept frame.
  appendBox(positions, colors, 0, 0.55, -5.55, 7.6, 0.55, 0.35, 1.0, 0.05, 0.07);
  // Cockpit marker lights.
  appendBox(positions, colors, 0, 1.62, 3.9, 1.7, 0.16, 0.16, 0.35, 0.95, 1.0);

  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hullGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  hullGeometry.computeBoundingSphere();
  const hullMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  applySkyriverFog(hullMaterial);
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.name = 'skyriver.shuttle.hull';
  hull.rotation.order = 'YXZ';
  hull.frustumCulled = false;

  // ---- Plume (1 draw call): additive glow behind the two nozzles, reacts to boost.
  const plumePositions: number[] = [];
  const plumeUvs: number[] = [];
  const plumeAlphas: number[] = [];
  appendPlumeQuad(plumePositions, plumeUvs, plumeAlphas, -1.45, 0, -5.6, 3.4, 3.0);
  appendPlumeQuad(plumePositions, plumeUvs, plumeAlphas, 1.45, 0, -5.6, 3.4, 3.0);
  appendPlumeQuad(plumePositions, plumeUvs, plumeAlphas, 0, 0.15, -5.4, 5.2, 2.2);

  const plumeGeometry = new THREE.BufferGeometry();
  plumeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(plumePositions, 3));
  plumeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(plumeUvs, 2));
  plumeGeometry.setAttribute('alpha', new THREE.Float32BufferAttribute(plumeAlphas, 1));
  plumeGeometry.computeBoundingSphere();
  const plumeMaterial = new THREE.ShaderMaterial({
    vertexShader: PLUME_VERTEX,
    fragmentShader: PLUME_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uOpacity: { value: 0.75 },
      uCore: { value: 0.32 },
    },
  });
  const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
  plume.name = 'skyriver.shuttle.plume';
  plume.rotation.order = 'YXZ';
  plume.frustumCulled = false;

  let plumeOpacity = 0.75;

  return {
    objects: [hull, plume],
    setPose(x: number, y: number, z: number, yawTurns: number, pitchTurns: number): void {
      hull.position.set(x, y, z);
      hull.rotation.set(-pitchTurns * Math.PI * 2, yawTurns * Math.PI * 2, 0);
    },
    update({ boostIntensity, time }: SkyriverShuttleUpdate): void {
      // Pulse the plume with a slow deterministic-safe sinusoid of presentation time, swelling
      // with the boost level. Pure function of the arguments — no accumulators, restore-safe.
      const pulse = 0.85 + 0.15 * Math.sin(time * 9.0);
      const target = Math.min(1.6, 0.55 + 0.45 * boostIntensity) * pulse;
      plumeOpacity = target;
      plumeMaterial.uniforms.uOpacity!.value = plumeOpacity;
      const grow = 1.0 + 0.18 * (boostIntensity - 1.0);
      plume.scale.set(grow, grow, 1.0);
      plume.rotation.copy(hull.rotation);
      plume.position.copy(hull.position);
    },
    dispose(): void {
      hullGeometry.dispose();
      hullMaterial.dispose();
      plumeGeometry.dispose();
      plumeMaterial.dispose();
    },
  };
}
