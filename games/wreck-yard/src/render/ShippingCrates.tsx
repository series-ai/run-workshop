import { beginPhase, endPhase, perfCount } from '../perf/recorder';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VOXEL_SIZE } from '../sim/constants';
import { voxelStats } from '../sim/physics';
import type { YardBody } from '../sim/state';
import type { YardRender } from './presentation';
import { getToonGradientMap } from './style/toonMaterial';

const CRATE_VOXELS = 12;
const MAX_INSTANCED_CRATES = 512;
const CRATE_SIZE = CRATE_VOXELS * VOXEL_SIZE;
const CRATE_BODY_SIZE = CRATE_SIZE - 0.016;
const FRAME_WIDTH = 0.064;
const noRaycast = () => null;

/** True only for a whole, solid 12-cubed shipping crate. */
export function isIntactShippingCrate(body: YardBody): boolean {
  if (body.renderModel !== 'shipping-crate') return false;
  if (body.dims.x !== CRATE_VOXELS || body.dims.y !== CRATE_VOXELS || body.dims.z !== CRATE_VOXELS) return false;
  const volume = CRATE_VOXELS ** 3;
  return body.voxels.length === volume && voxelStats(body.voxels, body.dims).occupiedCount === volume;
}

/** Keep the GPU instance count bounded. Crates above this limit use the voxel renderer. */
export function instancedShippingCrateIds(bodies: readonly YardBody[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const body of bodies) {
    if (ids.size >= MAX_INSTANCED_CRATES) break;
    if (isIntactShippingCrate(body)) ids.add(body.id);
  }
  return ids;
}

function crateFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('WRECK_YARD_CRATE_TEXTURE_CONTEXT');

  context.fillStyle = '#d8b77f';
  context.fillRect(0, 0, 512, 512);
  context.globalAlpha = 0.18;
  context.fillStyle = '#fff0ca';
  for (let y = 10; y < 512; y += 24) context.fillRect(0, y, 512, 2);
  context.globalAlpha = 1;

  context.strokeStyle = '#63452d';
  context.lineWidth = 12;
  context.strokeRect(13, 13, 486, 486);
  context.strokeStyle = '#9b734b';
  context.lineWidth = 3;
  context.strokeRect(28, 28, 456, 456);

  context.fillStyle = '#bd603a';
  context.fillRect(46, 55, 420, 100);
  context.fillStyle = '#fff0d2';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 58px Arial, sans-serif';
  context.fillText('FRAGILE', 256, 107, 396);

  context.strokeStyle = '#61442d';
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(256, 182);
  context.lineTo(256, 250);
  context.moveTo(256, 182);
  context.lineTo(225, 213);
  context.moveTo(256, 182);
  context.lineTo(287, 213);
  context.stroke();

  context.fillStyle = '#3b3328';
  context.font = 'bold 34px Arial, sans-serif';
  context.fillText('THIS SIDE UP', 256, 288, 420);
  context.font = 'bold 25px Arial, sans-serif';
  context.fillText('PLEASE HANDLE', 256, 358, 420);
  context.fillText('RESPONSIBLY', 256, 395, 420);

  context.fillStyle = '#63452d';
  for (let index = 0; index < 15; index += 1) {
    const width = index % 3 === 0 ? 5 : 2;
    context.fillRect(106 + index * 20, 440, width, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function crateFrameGeometry(): THREE.BufferGeometry {
  const half = CRATE_SIZE / 2;
  const inset = half - FRAME_WIDTH / 2;
  const parts: { size: readonly [number, number, number]; position: readonly [number, number, number] }[] = [];

  for (const x of [-inset, inset]) {
    for (const z of [-inset, inset]) parts.push({ size: [FRAME_WIDTH, CRATE_SIZE, FRAME_WIDTH], position: [x, 0, z] });
  }
  for (const y of [-inset, inset]) {
    for (const z of [-inset, inset]) parts.push({ size: [CRATE_SIZE, FRAME_WIDTH, FRAME_WIDTH], position: [0, y, z] });
    for (const x of [-inset, inset]) parts.push({ size: [FRAME_WIDTH, FRAME_WIDTH, CRATE_SIZE], position: [x, y, 0] });
  }
  for (const z of [-inset, inset]) parts.push({ size: [CRATE_SIZE * 0.88, FRAME_WIDTH * 0.52, FRAME_WIDTH * 0.28], position: [0, 0, z] });

  const geometries = parts.map(({ size, position }) => {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.translate(...position);
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('WRECK_YARD_CRATE_FRAME_GEOMETRY');
  merged.computeBoundingSphere();
  return merged;
}

function crateTint(body: YardBody): THREE.Color {
  let hash = 2166136261;
  for (let index = 0; index < body.id.length; index += 1) {
    hash = Math.imul(hash ^ body.id.charCodeAt(index), 16777619);
  }
  const variation = (hash >>> 0) % 5;
  const base = body.storageBay === 'returns' ? 0xd7c295 : 0xe4c38c;
  const shade = 1 - variation * 0.018;
  return new THREE.Color(base).multiplyScalar(shade);
}

export function ShippingCrates({ bodies, renderRef }: {
  bodies: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
}) {
  const bodyGeometry = useMemo(() => new THREE.BoxGeometry(CRATE_BODY_SIZE, CRATE_BODY_SIZE, CRATE_BODY_SIZE), []);
  const frameGeometry = useMemo(crateFrameGeometry, []);
  const texture = useMemo(crateFaceTexture, []);
  const bodyMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#ffffff', map: texture, gradientMap: getToonGradientMap() }), [texture]);
  const frameMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#49382b', gradientMap: getToonGradientMap() }), []);
  const ids = useMemo(() => instancedShippingCrateIds(bodies), [bodies]);
  const crates = useMemo(() => bodies.filter((body) => ids.has(body.id)), [bodies, ids]);
  const batches = useMemo(() => [
    crates.filter((body) => body.storageBay !== 'returns'),
    crates.filter((body) => body.storageBay === 'returns'),
  ], [crates]);
  useEffect(() => () => {
    bodyGeometry.dispose();
    frameGeometry.dispose();
    bodyMaterial.dispose();
    frameMaterial.dispose();
    texture.dispose();
  }, [bodyGeometry, frameGeometry, bodyMaterial, frameMaterial, texture]);

  return (
    <group name="ShippingCrates">
      {batches.map((batch, index) => <CrateBatch key={index} crates={batch} renderRef={renderRef}
        bodyGeometry={bodyGeometry} frameGeometry={frameGeometry} bodyMaterial={bodyMaterial} frameMaterial={frameMaterial} />)}
    </group>
  );
}

function CrateBatch({ crates, renderRef, bodyGeometry, frameGeometry, bodyMaterial, frameMaterial }: {
  crates: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
  bodyGeometry: THREE.BufferGeometry;
  frameGeometry: THREE.BufferGeometry;
  bodyMaterial: THREE.Material;
  frameMaterial: THREE.Material;
}) {
  const bodyMesh = useRef<THREE.InstancedMesh>(null);
  const frameMesh = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const previousPoses = useMemo(() => new Float64Array(MAX_INSTANCED_CRATES * 8).fill(NaN), [crates]);
  const previousMatrices = useMemo(() => new Float32Array(MAX_INSTANCED_CRATES * 16).fill(NaN), [crates]);

  useLayoutEffect(() => {
    if (!bodyMesh.current || !frameMesh.current) return;
    crates.forEach((body, index) => {
      const color = crateTint(body);
      bodyMesh.current!.setColorAt(index, color);
      frameMesh.current!.setColorAt(index, color);
    });
    if (bodyMesh.current.instanceColor) bodyMesh.current.instanceColor.needsUpdate = true;
    if (frameMesh.current.instanceColor) frameMesh.current.instanceColor.needsUpdate = true;
  }, [crates]);

  useFrame(() => {
    const render = renderRef.current;
    const bodyInstances = bodyMesh.current;
    const frameInstances = frameMesh.current;
    if (!bodyInstances || !frameInstances) return;

    const timing = beginPhase('crates.upload');
    bodyInstances.count = crates.length;
    frameInstances.count = crates.length;
    let writes = 0;
    let firstChanged = crates.length;
    let lastChanged = -1;
    for (let index = 0; index < crates.length; index += 1) {
      const pose = render?.poses.get(crates[index]!.id);
      const straddlingPortal = render?.portalStraddlers?.some((entry) => entry.bodyId === crates[index]!.id) ?? false;
      const hidden = !pose || straddlingPortal;
      const poseOffset = index * 8;
      if (previousPoses[poseOffset + 7] === Number(hidden) && (hidden || (
        pose!.position.every((value, axis) => value === previousPoses[poseOffset + axis])
        && pose!.rotation.every((value, axis) => value === previousPoses[poseOffset + 3 + axis])))) continue;
      previousPoses[poseOffset + 7] = Number(hidden);
      if (pose) {
        previousPoses.set(pose.position, poseOffset);
        previousPoses.set(pose.rotation, poseOffset + 3);
      }
      if (hidden) {
        transform.position.set(0, -1000, 0);
        transform.quaternion.identity();
        transform.scale.setScalar(0);
      } else {
        transform.position.set(pose.position[0], pose.position[1], pose.position[2]);
        transform.quaternion.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
        transform.scale.setScalar(1);
      }
      transform.updateMatrix();
      const offset = index * 16;
      const elements = transform.matrix.elements;
      let changed = false;
      for (let component = 0; component < 16; component += 1) {
        if (previousMatrices[offset + component] !== Math.fround(elements[component]!)) { changed = true; break; }
      }
      if (!changed) continue;
      previousMatrices.set(elements, offset);
      bodyInstances.setMatrixAt(index, transform.matrix);
      frameInstances.setMatrixAt(index, transform.matrix);
      firstChanged = Math.min(firstChanged, index);
      lastChanged = index;
      writes += 2;
    }
    if (lastChanged >= 0) {
      for (const mesh of [bodyInstances, frameInstances]) {
        mesh.computeBoundingSphere();
        const pending = mesh.instanceMatrix.updateRanges[0];
        const start = Math.min(firstChanged * 16, pending?.start ?? Infinity);
        const end = Math.max((lastChanged + 1) * 16, pending ? pending.start + pending.count : -1);
        // Keep changes from frames where this batch was outside the view.
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(start, end - start);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    perfCount('crates.instanceWrites', writes);
    endPhase('crates.upload', timing);
  });

  return (
    <>
      <instancedMesh
        ref={bodyMesh}
        args={[bodyGeometry, bodyMaterial, MAX_INSTANCED_CRATES]}
        count={crates.length}
        castShadow
        receiveShadow
        frustumCulled
        raycast={noRaycast}
      />
      <instancedMesh
        ref={frameMesh}
        args={[frameGeometry, frameMaterial, MAX_INSTANCED_CRATES]}
        count={crates.length}
        castShadow
        receiveShadow
        frustumCulled
        raycast={noRaycast}
      />
    </>
  );
}
