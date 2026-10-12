import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { YardRender } from '../render/presentation';
import { installPerfApi } from './api';
import { GpuTimer, type GpuPhase } from './gpuTimer';
import { perfActive, perfCount, perfFrame, perfRecorder } from './recorder';
import { recordInputSubmission } from './localInput';

const timers = new WeakMap<THREE.WebGLRenderer, GpuTimer>();
let renderFrame = 0;
let restoreInfo: boolean | null = null;

export function beginGpu(renderer: THREE.WebGLRenderer, phase: GpuPhase): number {
  return perfActive() ? (timers.get(renderer)?.begin(phase, renderFrame) ?? -1) : -1;
}
export function endGpu(renderer: THREE.WebGLRenderer, token: number): void {
  if (token !== -1) timers.get(renderer)?.end(token);
}

export function finishPerfFrame(renderer: THREE.WebGLRenderer, simFrame: number): void {
  if (restoreInfo === null) return;
  try {
    perfCount('webgl.calls', renderer.info.render.calls);
    perfCount('webgl.triangles', renderer.info.render.triangles);
    perfCount('webgl.geometries', renderer.info.memory.geometries);
    perfCount('webgl.textures', renderer.info.memory.textures);
    perfCount('webgl.programs', renderer.info.programs?.length ?? 0);
    recordInputSubmission(simFrame);
  } finally {
    renderer.info.autoReset = restoreInfo;
    restoreInfo = null;
  }
}

export function PerfFrame({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const { gl, scene } = useThree();
  const previous = useRef(0);
  useEffect(() => {
    const timer = new GpuTimer(gl.getContext());
    timers.set(gl, timer);
    const uninstall = installPerfApi(window, perfRecorder, timer);
    return () => {
      perfRecorder.dispose();
      uninstall();
      timer.stop();
      timers.delete(gl);
      if (restoreInfo !== null) gl.info.autoReset = restoreInfo;
      restoreInfo = null;
    };
  }, [gl]);
  useFrame(() => {
    if (!perfActive()) { previous.current = 0; return; }
    const now = performance.now();
    renderFrame += 1;
    perfFrame(renderFrame, renderRef.current?.frame ?? -1);
    if (previous.current) perfCount('frame.intervalMs', now - previous.current);
    previous.current = now;
    timers.get(gl)?.poll(renderFrame);
    if (renderFrame % 60 === 0) {
      const arrays = new Set<ArrayBufferLike>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.geometry) return;
        for (const attribute of Object.values(mesh.geometry.attributes)) {
          if (attribute instanceof THREE.InterleavedBufferAttribute) arrays.add(attribute.data.array.buffer);
          else arrays.add(attribute.array.buffer);
        }
        if (mesh.geometry.index) arrays.add(mesh.geometry.index.array.buffer);
        const instances = object as THREE.InstancedMesh;
        if (instances.instanceMatrix) arrays.add(instances.instanceMatrix.array.buffer);
        if (instances.instanceColor) arrays.add(instances.instanceColor.array.buffer);
      });
      let bytes = 0;
      for (const array of arrays) bytes += array.byteLength;
      perfCount('webgl.ownedBufferBytes', bytes);
    }
    restoreInfo = gl.info.autoReset;
    gl.info.autoReset = false;
    gl.info.reset();
  }, -1000);
  return null;
}
