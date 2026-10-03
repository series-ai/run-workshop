import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { makeDemoMaterialParams, makeDemoPalette } from 'voxel-kit';
import { ART_STYLE, type PaletteKey } from './style/artStyle';
import { BuggyWheels } from './BuggyWheels';
import { HEAT, VOXEL_SIZE } from '../sim/constants';
import { rotate, type Vec3 } from '../sim/math';
import { PROP_COLOR, type PropColor } from '../sim/props';
import type { YardBody } from '../sim/state';
import { VoxelVolumeRenderer } from './VoxelVolumeRenderer';
import type { YardRender } from './presentation';
import type { WorldOcclusionRuntime } from './OcclusionUpdater';
import { COLD_AGE, heatAge, heatedBodies, heatGlow, heatOfBody, type BodyHeatLook } from './heatLook';

/** Heat lights: a fixed pool, so a new scorch never changes the light count (and recompiles shaders). */
const HEAT_LIGHTS = 3;
const HEAT_LIGHT_PEAK = 9;

const palette = makeDemoPalette();
const materialParams = makeDemoMaterialParams();
/** Prop and buggy palette band (sim/props.ts PROP_COLOR) to art colors. */
const PROP_ART: Record<PropColor, PaletteKey> = {
  orange: 'signalOrange', orangeShade: 'orangeShade', white: 'concreteLit', grey: 'concreteShade', teal: 'teal',
  mustard: 'mustard', rust: 'rust', ink: 'ink', spark: 'spark', glow: 'glow', metal: 'metal', red: 'dangerRed',
  burnt: 'burnt',
};
for (const [name, code] of Object.entries(PROP_COLOR) as [PropColor, number][]) {
  const color = new THREE.Color(ART_STYLE.palette[PROP_ART[name]]).convertLinearToSRGB();
  const offset = code * 4;
  palette.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255], offset);
  // Only the lens colors (spark, glow) emit light. Ink stays matte.
  const emissive = name === 'spark' || name === 'glow' ? 60 : 0;
  materialParams.set([190, name === 'ink' ? 20 : 70, emissive, 40], offset);
}
// Scorch voxels (SCORCH_MATERIAL) take their color and glow from the heat age in the shader.
function VoxelBody({ body, renderRef, worldOcclusion }: {
  body: YardBody;
  renderRef: MutableRefObject<YardRender | null>;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  const group = useRef<THREE.Group>(null);
  const heatRef = useRef<BodyHeatLook>({ age: COLD_AGE, at: [0, 0, 0] });

  useFrame(() => {
    const render = renderRef.current;
    const heat = render ? heatOfBody(render.bodies, body.id) : null;
    heatRef.current.age = render ? heatAge(render.frame, heat) : COLD_AGE;
    if (heat) heatRef.current.at = [heat.at[0], heat.at[1], heat.at[2]];
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
        heatRef={heatRef}
        worldOcclusion={worldOcclusion}
      />
    </group>
  );
}

/** Body-local position of a voxel-space point (voxel centers, as the collider and the volume use). */
function voxelToLocal(at: Vec3, dims: YardBody['dims']): Vec3 {
  return [(at[0] - (dims.x - 1) * 0.5) * VOXEL_SIZE, (at[1] - (dims.y - 1) * 0.5) * VOXEL_SIZE, (at[2] - (dims.z - 1) * 0.5) * VOXEL_SIZE];
}

/** Red light at the freshest scorches while they glow (heatLook.ts heatGlow). */
function HeatLights({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(() => {
    const render = renderRef.current;
    const glowing = render
      ? heatedBodies(render.bodies)
        .map((body) => ({ body, age: heatAge(render.frame, body.heat) }))
        .filter((entry) => entry.age < HEAT.glowSeconds)
        .sort((a, b) => a.age - b.age)
      : [];
    for (let index = 0; index < HEAT_LIGHTS; index += 1) {
      const light = lights.current[index];
      if (!light) continue;
      const entry = glowing[index];
      const pose = entry ? render?.poses.get(entry.body.id) : undefined;
      if (!entry || !pose) {
        light.intensity = 0;
        continue;
      }
      const offset = rotate(voxelToLocal(entry.body.heat!.at, entry.body.dims), pose.rotation);
      light.position.set(pose.position[0] + offset[0], pose.position[1] + offset[1], pose.position[2] + offset[2]);
      light.intensity = HEAT_LIGHT_PEAK * heatGlow(entry.age);
    }
  });

  return (
    <>
      {Array.from({ length: HEAT_LIGHTS }, (_, index) => (
        <pointLight key={index} ref={(light) => { lights.current[index] = light; }} intensity={0} distance={3.5} decay={1.8} color="#ff3b14" />
      ))}
    </>
  );
}

export function VoxelBodies({ bodies, renderRef, worldOcclusion }: {
  bodies: readonly YardBody[];
  renderRef: MutableRefObject<YardRender | null>;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  return (
    <>
      <HeatLights renderRef={renderRef} />
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
