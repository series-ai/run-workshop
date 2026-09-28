import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { fillWorldOcclusionVolume, type WorldOcclusionBody, type WorldOcclusionSpec } from 'voxel-kit';
import { SHELL_BOXES, VOXEL_SIZE } from '../sim/constants';
import type { YardBody } from '../sim/state';
import { WORLD_OCCLUSION_SPEC, WORLD_SUN_DIRECTION } from './viewConstants';
import type { RenderPose, YardRender } from './presentation';

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

export class PoseCache {
  private buffer = new Float32Array(64 * 7);
  private ids: string[] = [];
  private volumes: Uint8Array[] = [];

  hasChanges(
    bodies: readonly YardBody[],
    poses: ReadonlyMap<string, RenderPose>,
    posTol = 0.035,
    rotTol = 0.9994,
  ): boolean {
    if (this.ids.length !== bodies.length) return true;

    const posTolSq = posTol * posTol;
    let offset = 0;
    for (let i = 0; i < bodies.length; i++) {
      const id = bodies[i]!.id;
      if (this.ids[i] !== id || this.volumes[i] !== bodies[i]!.voxels) return true;
      const pose = poses.get(id);
      if (!pose) return true;

      const px = pose.position[0];
      const py = pose.position[1];
      const pz = pose.position[2];
      const rx = pose.rotation[0];
      const ry = pose.rotation[1];
      const rz = pose.rotation[2];
      const rw = pose.rotation[3];

      const dx = this.buffer[offset] - px;
      const dy = this.buffer[offset + 1] - py;
      const dz = this.buffer[offset + 2] - pz;
      if (!Number.isFinite(dx) || dx * dx + dy * dy + dz * dz > posTolSq) return true;

      const dot = Math.abs(
        this.buffer[offset + 3] * rx +
        this.buffer[offset + 4] * ry +
        this.buffer[offset + 5] * rz +
        this.buffer[offset + 6] * rw,
      );
      if (dot < rotTol) return true;

      offset += 7;
    }
    return false;
  }

  update(bodies: readonly YardBody[], poses: ReadonlyMap<string, RenderPose>): void {
    if (this.buffer.length < bodies.length * 7) {
      this.buffer = new Float32Array(Math.max(this.buffer.length * 2, bodies.length * 7));
    }
    this.ids = bodies.map((b) => b.id);
    this.volumes = bodies.map((b) => b.voxels);
    let offset = 0;
    for (let i = 0; i < bodies.length; i++) {
      const pose = poses.get(bodies[i]!.id);
      if (!pose) {
        this.buffer.fill(NaN, offset, offset + 7);
        offset += 7;
        continue;
      }
      this.buffer[offset] = pose.position[0];
      this.buffer[offset + 1] = pose.position[1];
      this.buffer[offset + 2] = pose.position[2];
      this.buffer[offset + 3] = pose.rotation[0];
      this.buffer[offset + 4] = pose.rotation[1];
      this.buffer[offset + 5] = pose.rotation[2];
      this.buffer[offset + 6] = pose.rotation[3];
      offset += 7;
    }
  }
}

export function OcclusionUpdater({ renderRef, worldOcclusion }: { renderRef: MutableRefObject<YardRender | null>; worldOcclusion: WorldOcclusionRuntime }) {
  const lastUpdate = useRef(-Infinity);
  const poseCache = useRef(new PoseCache());

  useFrame(({ clock }) => {
    const render = renderRef.current;
    if (!render) return;

    const now = clock.elapsedTime;
    // Rebuild the shared volume at most five times per second.
    if (now - lastUpdate.current < 0.2) return;

    // Compare positions and voxel references before rebuilding the volume.
    if (!poseCache.current.hasChanges(render.bodies, render.poses)) return;

    const bodies: WorldOcclusionBody[] = render.bodies.map((body) => {
      const pose = render.poses.get(body.id)!;
      return {
        dims: body.dims,
        voxels: body.voxels,
        position: pose.position as [number, number, number],
        rotation: pose.rotation as [number, number, number, number],
      };
    });

    fillWorldOcclusionVolume(worldOcclusion.data, worldOcclusion.spec, bodies, SHELL_BOXES.map(({ center, size }) => ({ center, size })), VOXEL_SIZE);
    worldOcclusion.texture.needsUpdate = true;
    lastUpdate.current = now;
    poseCache.current.update(render.bodies, render.poses);
  });

  return null;
}
