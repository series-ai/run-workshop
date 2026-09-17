import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { fillWorldOcclusionVolume, hasWorldOcclusionPoseChanges, type WorldOcclusionBody, type WorldOcclusionPose, type WorldOcclusionSpec } from 'voxel-kit';
import { SHELL_BOXES, VOXEL_SIZE } from '../sim/constants';
import { WORLD_OCCLUSION_SPEC, WORLD_SUN_DIRECTION } from './viewConstants';
import type { YardRender } from './presentation';

export interface WorldOcclusionRuntime {
  readonly data: Uint8Array;
  readonly texture: THREE.Data3DTexture;
  readonly min: [number, number, number];
  readonly max: [number, number, number];
  readonly sunDirection: [number, number, number];
  readonly spec: WorldOcclusionSpec;
}

export function useWorldOcclusion(): WorldOcclusionRuntime {
  const runtime = useMemo<WorldOcclusionRuntime>(() => {
    const { dims } = WORLD_OCCLUSION_SPEC;
    const data = new Uint8Array(dims.x * dims.y * dims.z);
    const texture = new THREE.Data3DTexture(data, dims.x, dims.y, dims.z);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return { data, texture, min: WORLD_OCCLUSION_SPEC.min, max: WORLD_OCCLUSION_SPEC.max, sunDirection: WORLD_SUN_DIRECTION, spec: WORLD_OCCLUSION_SPEC };
  }, []);
  useEffect(() => () => runtime.texture.dispose(), [runtime]);
  return runtime;
}

export function OcclusionUpdater({ renderRef, worldOcclusion }: { renderRef: MutableRefObject<YardRender | null>; worldOcclusion: WorldOcclusionRuntime }) {
  const lastUpdate = useRef(-Infinity);
  const lastPoses = useRef<WorldOcclusionPose[]>([]);

  useFrame(({ clock }) => {
    const render = renderRef.current;
    if (!render) return;
    const poses: WorldOcclusionPose[] = render.bodies.map((body) => {
      const pose = render.poses.get(body.id)!;
      return { id: body.id, position: [...pose.position] as [number, number, number], rotation: [...pose.rotation] as [number, number, number, number] };
    });
    const now = clock.elapsedTime;
    const forceUpdate = lastPoses.current.length !== poses.length;
    // Throttle CPU occlusion calculation to at most 5 Hz to maintain 60 fps and prevent WebGL stalls
    if (!forceUpdate && (!hasWorldOcclusionPoseChanges(lastPoses.current, poses) || now - lastUpdate.current < 0.2)) return;
    const bodies: WorldOcclusionBody[] = render.bodies.map((body, index) => ({
      dims: body.dims,
      voxels: body.voxels,
      position: poses[index]!.position,
      rotation: poses[index]!.rotation,
    }));
    fillWorldOcclusionVolume(worldOcclusion.data, worldOcclusion.spec, bodies, SHELL_BOXES.map(({ center, size }) => ({ center, size })), VOXEL_SIZE);
    worldOcclusion.texture.needsUpdate = true;
    lastUpdate.current = now;
    lastPoses.current = poses;
  });

  return null;
}
