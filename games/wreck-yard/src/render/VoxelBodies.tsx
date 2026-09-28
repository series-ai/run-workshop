import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { makeDemoMaterialParams, makeDemoPalette } from 'voxel-kit';
import { ART_STYLE, type PaletteKey } from './style/artStyle';
import { bodyOutlineColor } from './bodyOutline';
import { BuggyWheels } from './BuggyWheels';
import { VOXEL_SIZE } from '../sim/constants';
import { PROP_COLOR, type PropColor } from '../sim/props';
import type { YardBody } from '../sim/state';
import { VoxelVolumeRenderer } from './VoxelVolumeRenderer';
import type { YardRender } from './presentation';
import type { WorldOcclusionRuntime } from './OcclusionUpdater';

const palette = makeDemoPalette();
const materialParams = makeDemoMaterialParams();
/** Prop and buggy palette band (sim/props.ts PROP_COLOR) to art colors. */
const PROP_ART: Record<PropColor, PaletteKey> = {
  orange: 'signalOrange', orangeShade: 'orangeShade', white: 'concreteLit', grey: 'concreteShade', teal: 'teal',
  mustard: 'mustard', rust: 'rust', ink: 'ink', spark: 'spark', glow: 'glow', metal: 'metal',
};
for (const [name, code] of Object.entries(PROP_COLOR) as [PropColor, number][]) {
  const color = new THREE.Color(ART_STYLE.palette[PROP_ART[name]]).convertLinearToSRGB();
  const offset = code * 4;
  palette.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255], offset);
  // Only the lens colors (spark, glow) emit light. Ink stays matte.
  const emissive = name === 'spark' || name === 'glow' ? 60 : 0;
  materialParams.set([190, name === 'ink' ? 20 : 70, emissive, 40], offset);
}
// Reserve material 5 for cut surfaces.
materialParams[5 * 4 + 2] = 255;
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
  const selection = useRef<THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>>(null);
  const boxSize = useMemo(
    () => [body.dims.x * VOXEL_SIZE, body.dims.y * VOXEL_SIZE, body.dims.z * VOXEL_SIZE] as [number, number, number],
    [body.dims],
  );

  const selectionGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(...boxSize);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [boxSize]);
  useEffect(() => () => selectionGeometry.dispose(), [selectionGeometry]);

  useFrame(() => {
    const render = renderRef.current;
    const color = bodyOutlineColor(body.id, outline, render);
    if (selection.current) {
      selection.current.visible = color !== null;
      if (color) selection.current.material.color.set(color);
    }
    const pose = render?.poses.get(body.id);
    if (!pose || !group.current) return;
    group.current.position.set(pose.position[0], pose.position[1], pose.position[2]);
    group.current.quaternion.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
  });

  return (
    <group ref={group}>
      {body.id === 'vehicle-chassis' && <BuggyWheels renderRef={renderRef} />}
      <VoxelVolumeRenderer
        dims={body.dims}
        voxels={body.voxels}
        palette={palette}
        materialParams={materialParams}
        voxelSize={VOXEL_SIZE}
        worldOcclusion={worldOcclusion}
      />
      <mesh
        visible={false}
        onPointerOver={(event) => { event.stopPropagation(); onHover(body.id); }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={boxSize} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments ref={selection} visible={false} geometry={selectionGeometry} scale={[1.015, 1.015, 1.015]} raycast={noRaycast}>
        <lineBasicMaterial transparent opacity={0.75} depthWrite={false} />
      </lineSegments>
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
