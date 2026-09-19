import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { makeDemoMaterialParams, makeDemoPalette } from 'voxel-kit';
import { VOXEL_SIZE } from '../sim/constants';
import type { YardBody } from '../sim/state';
import { VoxelVolumeRenderer } from './VoxelVolumeRenderer';
import type { YardRender } from './presentation';
import type { WorldOcclusionRuntime } from './OcclusionUpdater';

const palette = makeDemoPalette();
const materialParams = makeDemoMaterialParams();
const noRaycast = () => null;

export type HoverHandler = (bodyId: string | null) => void;

function VoxelBody({ body, renderRef, outline, onHover, worldOcclusion }: {
  body: YardBody;
  renderRef: MutableRefObject<YardRender | null>;
  outline: string | null;
  onHover: HoverHandler;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  const group = useRef<THREE.Group>(null);
  const boxSize = useMemo(
    () => [body.dims.x * VOXEL_SIZE, body.dims.y * VOXEL_SIZE, body.dims.z * VOXEL_SIZE] as [number, number, number],
    [body.dims],
  );

  useFrame(() => {
    const pose = renderRef.current?.poses.get(body.id);
    if (!pose || !group.current) return;
    group.current.position.set(pose.position[0], pose.position[1], pose.position[2]);
    group.current.quaternion.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
  });

  return (
    <group ref={group}>
      <VoxelVolumeRenderer
        dims={body.dims}
        voxels={body.voxels}
        palette={palette}
        materialParams={materialParams}
        voxelSize={VOXEL_SIZE}
        worldOcclusion={worldOcclusion}
      />
      <mesh
        onPointerOver={(event) => { event.stopPropagation(); onHover(body.id); }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={boxSize} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {outline ? (
        <mesh scale={[1.035, 1.035, 1.035]} raycast={noRaycast}>
          <boxGeometry args={boxSize} />
          <meshBasicMaterial color={outline} wireframe transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function VoxelBodies({ bodies, renderRef, outlines, onHover, worldOcclusion }: {
  bodies: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
  outlines: ReadonlyMap<string, string>;
  onHover: HoverHandler;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  return (
    <>
      {bodies.map((body) => (
        <VoxelBody
          key={body.id}
          body={body}
          renderRef={renderRef}
          outline={outlines.get(body.id) ?? null}
          onHover={onHover}
          worldOcclusion={worldOcclusion}
        />
      ))}
    </>
  );
}
