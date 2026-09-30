import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { makeDemoMaterialParams, makeDemoPalette } from 'voxel-kit';
import { ART_STYLE, type PaletteKey } from './style/artStyle';
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
function VoxelBody({ body, renderRef, worldOcclusion }: {
  body: YardBody;
  renderRef: MutableRefObject<YardRender | null>;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const render = renderRef.current;
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
    </group>
  );
}

export function VoxelBodies({ bodies, renderRef, worldOcclusion }: {
  bodies: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  return (
    <>
      {bodies.map((body) => (
        <VoxelBody
          key={body.id}
          body={body}
          renderRef={renderRef}
          worldOcclusion={worldOcclusion}
        />
      ))}
    </>
  );
}
