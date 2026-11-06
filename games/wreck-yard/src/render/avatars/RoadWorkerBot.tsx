import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PortalPlane4 } from '@series-inc/rundot-syncplay/physics/3d';
import { VOXEL_SIZE } from '../../sim/constants';
import type { Vec3 } from '../../sim/math';
import { ROAD_WORKER_PARTS, roadWorkerPreset, type RoadWorkerPart } from '../../sim/roadWorker';
import type { YardBody } from '../../sim/state';
import { createGravitySurfaceUniforms, createGravityToonMaterial } from '../gravitySurface';
import { getToonMaterial } from '../style/toonMaterial';
import type { VoxelPortalCopy } from '../VoxelVolumeRenderer';
import { getHazardMaterial, ROBOT_KIT, roundedBox } from './robots';

export const ROAD_WORKER_COLORS = {
  paint: ROBOT_KIT.bone,
  trim: '#547f79',
  ink: ROBOT_KIT.ink,
  steel: ROBOT_KIT.steel,
  hazard: ROBOT_KIT.hazard,
  glow: '#b7e9df',
} as const;

type Finish = keyof typeof ROAD_WORKER_COLORS;
interface IntactPart { readonly part: RoadWorkerPart; readonly offset: Vec3 }
interface TagStats { readonly count: number; readonly center: Vec3 }
export interface RoadWorkerLook {
  readonly voxels: Uint8Array;
  readonly hasVoxels: boolean;
  readonly parts: readonly IntactPart[];
}

function tagStats(voxels: Uint8Array, dims: YardBody['dims']): ReadonlyMap<number, TagStats> {
  const sums = new Map<number, { count: number; x: number; y: number; z: number }>();
  for (let index = 0; index < voxels.length; index += 1) {
    const code = voxels[index]!;
    if (!code) continue;
    const sum = sums.get(code) ?? { count: 0, x: 0, y: 0, z: 0 };
    sum.count += 1;
    sum.x += index % dims.x;
    sum.y += Math.floor(index / dims.x) % dims.y;
    sum.z += Math.floor(index / (dims.x * dims.y));
    sums.set(code, sum);
  }
  return new Map([...sums].map(([code, sum]) => [code, {
    count: sum.count,
    center: [
      (sum.x / sum.count - (dims.x - 1) / 2) * VOXEL_SIZE,
      (sum.y / sum.count - (dims.y - 1) / 2) * VOXEL_SIZE,
      (sum.z / sum.count - (dims.z - 1) / 2) * VOXEL_SIZE,
    ],
  }]));
}

const pristine = roadWorkerPreset();
const pristineTags = tagStats(pristine.voxels, pristine.dims);

/** Replace only complete native parts. Damaged cells keep their voxel display. */
export function roadWorkerLook(body: YardBody): RoadWorkerLook {
  const current = tagStats(body.voxels, body.dims);
  const parts: IntactPart[] = [];
  const intact = new Set<number>();
  for (const part of ROAD_WORKER_PARTS) {
    const before = pristineTags.get(part.code)!;
    const after = current.get(part.code);
    if (!after || after.count !== before.count) continue;
    parts.push({ part, offset: [after.center[0] - before.center[0], after.center[1] - before.center[1], after.center[2] - before.center[2]] });
    intact.add(part.code);
  }
  const voxels = parts.length ? body.voxels.slice() : body.voxels;
  let hasVoxels = false;
  for (let index = 0; index < voxels.length; index += 1) {
    if (intact.has(voxels[index]!)) voxels[index] = 0;
    else if (voxels[index]) hasVoxels = true;
  }
  return { voxels, hasVoxels, parts };
}

type Pieces = Record<Finish, THREE.BufferGeometry[]>;

/** Partition the actual tag cells. Later stamps can remove corners from a part. */
function partBoxes(part: RoadWorkerPart): readonly { center: Vec3; size: [number, number, number] }[] {
  const { dims, voxels } = pristine;
  const used = new Uint8Array(voxels.length);
  const indexOf = (x: number, y: number, z: number) => x + y * dims.x + z * dims.x * dims.y;
  const open = (x: number, y: number, z: number) => voxels[indexOf(x, y, z)] === part.code && !used[indexOf(x, y, z)];
  const boxes: { center: Vec3; size: [number, number, number] }[] = [];
  for (let y = 0; y < dims.y; y += 1) for (let z = 0; z < dims.z; z += 1) for (let x = 0; x < dims.x; x += 1) {
    if (!open(x, y, z)) continue;
    let width = 1;
    while (x + width < dims.x && open(x + width, y, z)) width += 1;
    let depth = 1;
    while (z + depth < dims.z && Array.from({ length: width }, (_, dx) => open(x + dx, y, z + depth)).every(Boolean)) depth += 1;
    let height = 1;
    while (y + height < dims.y && Array.from({ length: width * depth }, (_, cell) => open(x + cell % width, y + height, z + Math.floor(cell / width))).every(Boolean)) height += 1;
    for (let dy = 0; dy < height; dy += 1) for (let dz = 0; dz < depth; dz += 1) for (let dx = 0; dx < width; dx += 1) used[indexOf(x + dx, y + dy, z + dz)] = 1;
    boxes.push({
      center: [(x + width / 2 - dims.x / 2) * VOXEL_SIZE, (y + height / 2 - dims.y / 2) * VOXEL_SIZE, (z + depth / 2 - dims.z / 2) * VOXEL_SIZE],
      size: [width * VOXEL_SIZE, height * VOXEL_SIZE, depth * VOXEL_SIZE],
    });
  }
  return boxes;
}

const skinBoxes = new Map(ROAD_WORKER_PARTS.map((part) => [part.code, partBoxes(part)]));

function skinGeometry(parts: readonly IntactPart[]): readonly { finish: Finish; geometry: THREE.BufferGeometry }[] {
  const pieces: Pieces = { paint: [], trim: [], ink: [], steel: [], hazard: [], glow: [] };
  for (const { part, offset } of parts) {
    const add = (finish: Finish, geometry: THREE.BufferGeometry) => {
      geometry.translate(offset[0], offset[1], offset[2]);
      pieces[finish].push(geometry);
    };
    const panel = (finish: Finish, center: Vec3, size: [number, number, number], radius = 0.018) => {
      add(finish, roundedBox(size, radius).clone().translate(...center));
    };
    const disc = (finish: Finish, center: Vec3, radius: number, depth: number, axis: 'x' | 'z') => {
      const geometry = new THREE.CylinderGeometry(radius, radius, depth, 16);
      if (axis === 'x') geometry.rotateZ(Math.PI / 2);
      else geometry.rotateX(Math.PI / 2);
      add(finish, geometry.translate(...center));
    };
    for (const box of skinBoxes.get(part.code)!) {
      const center: [number, number, number] = [...box.center];
      const size: [number, number, number] = [...box.size];
      if (part.name === 'head' || part.name === 'torso') {
        size[2] -= 0.04;
        center[2] -= 0.02;
      } else if (part.name === 'chassis') {
        size[2] -= 0.012;
        center[2] -= 0.006;
      } else if (part.name === 'cap') {
        size[1] -= 0.024;
        center[1] -= 0.012;
        size[2] -= 0.012;
        center[2] -= 0.006;
      }
      panel(part.finish, center, size, part.finish === 'ink' ? 0.045 : 0.018);
    }

    if (part.name === 'left-track' || part.name === 'right-track') {
      const x = part.name === 'left-track' ? -0.385 : 0.385;
      for (const z of [-0.2, 0, 0.2]) {
        disc('steel', [x, -0.4, z], 0.072, 0.025, 'x');
        disc('trim', [x + Math.sign(x) * 0.008, -0.4, z], 0.039, 0.01, 'x');
      }
      for (const z of [-0.25, -0.15, -0.05, 0.05, 0.15, 0.25]) panel('steel', [Math.sign(x) * 0.33, -0.252, z], [0.1, 0.012, 0.025], 0.003);
    }
    if (part.name === 'chassis') {
      panel('hazard', [0, -0.28, 0.233], [0.32, 0.06, 0.012], 0.004);
    }
    if (part.name === 'torso') {
      panel('trim', [0, 0, 0.151], [0.3, 0.23, 0.016]);
      for (const x of [-0.08, 0, 0.08]) panel('ink', [x, -0.025, 0.159], [0.035, 0.1, 0.002], 0.001);
      disc('steel', [0.105, 0.075, 0.159], 0.014, 0.002, 'z');
    }
    if (part.name === 'head') {
      panel('ink', [0, 0.36, 0.14], [0.425, 0.205, 0.035], 0.025);
      for (const eye of [{ x: -0.095, radius: 0.088 }, { x: 0.11, radius: 0.064 }]) {
        disc('steel', [eye.x, 0.36, 0.14], eye.radius, 0.035, 'z');
        disc('trim', [eye.x, 0.36, 0.153], eye.radius * 0.78, 0.008, 'z');
        disc('glow', [eye.x, 0.36, 0.158], eye.radius * 0.57, 0.004, 'z');
        disc('paint', [eye.x + 0.015, 0.38, 0.1595], 0.009, 0.001, 'z');
      }
    }
    if (part.name === 'cap') {
      panel('trim', [0, 0.54, 0.232], [0.58, 0.035, 0.016], 0.006);
      panel('steel', [0.19, 0.542, -0.23], [0.18, 0.014, 0.014], 0.005);
      disc('glow', [0.28, 0.542, -0.23], 0.014, 0.015, 'x');
    }
  }
  return (Object.entries(pieces) as [Finish, THREE.BufferGeometry[]][]).flatMap(([finish, geometries]) => {
    if (!geometries.length) return [];
    const normalized = geometries.map((geometry) => {
      if (!geometry.index) return geometry;
      const copy = geometry.toNonIndexed();
      geometry.dispose();
      return copy;
    });
    const geometry = mergeGeometries(normalized)!;
    geometry.name = `road-worker-${finish}-skin`;
    normalized.forEach((part) => part.dispose());
    return [{ finish, geometry }];
  });
}

function setClip(plane: THREE.Plane, value: PortalPlane4 | null): void {
  if (value) {
    plane.normal.set(value[0], value[1], value[2]);
    plane.constant = value[3];
  } else {
    plane.normal.set(0, 0, 0);
    plane.constant = 1;
  }
}

export function RoadWorkerBot({ parts, gravityRef, portalClipRef, portalCopyRef }: {
  parts: readonly IntactPart[];
  gravityRef: { readonly current: { readonly held: boolean; readonly time: number } };
  portalClipRef: { readonly current: PortalPlane4 | null };
  portalCopyRef: { readonly current: VoxelPortalCopy | null };
}) {
  const root = useRef<THREE.Group>(null);
  const copy = useRef<THREE.Group>(null);
  const geometries = useMemo(() => skinGeometry(parts), [parts]);
  const surface = useMemo(() => {
    const uniforms = createGravitySurfaceUniforms();
    const sourcePlane = new THREE.Plane(new THREE.Vector3(), 1);
    const copyPlane = new THREE.Plane(new THREE.Vector3(), 1);
    const hazard = getHazardMaterial().clone();
    hazard.map = hazard.map!.clone();
    hazard.map.repeat.set(4, 1);
    hazard.map.needsUpdate = true;
    const sources: Record<Finish, THREE.MeshToonMaterial> = {
      paint: getToonMaterial(ROAD_WORKER_COLORS.paint),
      trim: getToonMaterial(ROAD_WORKER_COLORS.trim),
      ink: getToonMaterial(ROAD_WORKER_COLORS.ink),
      steel: getToonMaterial(ROAD_WORKER_COLORS.steel),
      hazard,
      glow: getToonMaterial(ROAD_WORKER_COLORS.glow, { emissive: ROAD_WORKER_COLORS.glow, emissiveIntensity: 0.6, toneMapped: false }),
    };
    const materials = (plane: THREE.Plane) => Object.fromEntries((Object.entries(sources) as [Finish, THREE.MeshToonMaterial][]).map(([finish, source]) => {
      const material = createGravityToonMaterial(source, uniforms);
      material.clippingPlanes = [plane];
      material.clipShadows = true;
      return [finish, material];
    })) as Record<Finish, THREE.MeshToonMaterial>;
    return { uniforms, sourcePlane, copyPlane, source: materials(sourcePlane), copy: materials(copyPlane), hazard };
  }, []);
  useFrame(() => {
    surface.uniforms.uGravityHeld.value = gravityRef.current.held ? 1 : 0;
    surface.uniforms.uGravityTime.value = gravityRef.current.time;
    setClip(surface.sourcePlane, portalClipRef.current);
    const portal = portalCopyRef.current;
    setClip(surface.copyPlane, portal?.clipPlane ?? null);
    if (!root.current || !copy.current) return;
    copy.current.visible = portal !== null;
    if (portal) {
      root.current.updateWorldMatrix(true, false);
      copy.current.matrix.copy(root.current.matrixWorld).invert().multiply(portal.transform).multiply(root.current.matrixWorld);
      copy.current.matrixWorldNeedsUpdate = true;
    }
  });
  useEffect(() => () => geometries.forEach(({ geometry }) => geometry.dispose()), [geometries]);
  useEffect(() => () => {
    Object.values(surface.source).forEach((material) => material.dispose());
    Object.values(surface.copy).forEach((material) => material.dispose());
    surface.hazard.map!.dispose();
    surface.hazard.dispose();
  }, [surface]);
  return (
    <group ref={root} name="road-worker-bot">
      <group name="road-worker-original-skin">
        {geometries.map(({ finish, geometry }) => <mesh key={finish} name={`road-worker-skin-${finish}`} geometry={geometry} material={surface.source[finish]} castShadow receiveShadow />)}
      </group>
      <group ref={copy} name="road-worker-portal-skin" matrixAutoUpdate={false} visible={false}>
        {geometries.map(({ finish, geometry }) => <mesh key={finish} geometry={geometry} material={surface.copy[finish]} castShadow receiveShadow />)}
      </group>
    </group>
  );
}
