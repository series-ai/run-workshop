import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  portalExitClipPlane3D,
  portalTransformMatrix3D,
  type PortalPlane4,
} from '@series-inc/rundot-syncplay/physics/3d';
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
import { RETURNS_PAIR } from '../sim/returns';
import { portalEndClipPlane } from './portalScene';
import type { VoxelPortalCopy } from './VoxelVolumeRenderer';
import { CRATE_APPEARANCE } from './crateAppearance';

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
const cratePalette = palette.slice();
const crateWood = new THREE.Color(CRATE_APPEARANCE.wood).convertLinearToSRGB();
cratePalette.set([Math.round(crateWood.r * 255), Math.round(crateWood.g * 255), Math.round(crateWood.b * 255), 255], 2 * 4);
// Scorch voxels (SCORCH_MATERIAL) take their color and glow from the heat age in the shader.
function VoxelBody({ body, renderRef, worldOcclusion }: {
  body: YardBody;
  renderRef: MutableRefObject<YardRender | null>;
  worldOcclusion: WorldOcclusionRuntime;
}) {
  const group = useRef<THREE.Group>(null);
  const copiedWheels = useRef<THREE.Group>(null);
  const heatRef = useRef<BodyHeatLook>({ age: COLD_AGE, at: [0, 0, 0] });
  const portalClipRef = useRef<PortalPlane4 | null>(null);
  const wheelCopyClipRef = useRef<PortalPlane4 | null>(null);
  const portalCopyRef = useRef<VoxelPortalCopy | null>(null);
  const portalPieces = useMemo(() => {
    const ends = ['A', 'B'] as const;
    const entryClip: Record<(typeof ends)[number], PortalPlane4> = {
      A: portalEndClipPlane('A'),
      B: portalEndClipPlane('B'),
    };
    const copy: Record<(typeof ends)[number], VoxelPortalCopy> = {} as Record<(typeof ends)[number], VoxelPortalCopy>;
    for (const end of ends) {
      const exitPlane = portalExitClipPlane3D(RETURNS_PAIR, end);
      copy[end] = {
        transform: new THREE.Matrix4().fromArray(portalTransformMatrix3D(RETURNS_PAIR, end)),
        // Show the source half that extends through the exit.
        clipPlane: exitPlane,
      };
    }
    return { copy, entryClip };
  }, []);

  useFrame(() => {
    const render = renderRef.current;
    const heat = render ? heatOfBody(render.bodies, body.id) : null;
    heatRef.current.age = render ? heatAge(render.frame, heat) : COLD_AGE;
    if (heat) heatRef.current.at = [heat.at[0], heat.at[1], heat.at[2]];

    const straddler = render?.portalStraddlers?.find(
      (entry) => entry.bodyId === body.id && entry.pairId === RETURNS_PAIR.id,
    );
    const portalCopy = straddler ? portalPieces.copy[straddler.end] : null;
    portalClipRef.current = straddler ? portalPieces.entryClip[straddler.end] : null;
    portalCopyRef.current = portalCopy;
    wheelCopyClipRef.current = portalCopy?.clipPlane ?? null;

    const pose = render?.poses.get(body.id);
    if (!pose || !group.current) return;
    group.current.position.set(pose.position[0], pose.position[1], pose.position[2]);
    group.current.quaternion.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
    group.current.updateMatrix();
    group.current.updateWorldMatrix(true, true);

    if (copiedWheels.current) {
      copiedWheels.current.visible = Boolean(portalCopy && body.id === 'vehicle-chassis');
      if (portalCopy) {
        copiedWheels.current.matrix.copy(group.current.matrixWorld).invert()
          .multiply(portalCopy.transform)
          .multiply(group.current.matrixWorld);
      }
    }
  });

  return (
    <group ref={group}>
      {body.id === 'vehicle-chassis' && <BuggyWheels renderRef={renderRef} clipPlaneRef={portalClipRef} />}
      {body.id === 'vehicle-chassis' && (
        <group ref={copiedWheels} matrixAutoUpdate={false} visible={false}>
          <BuggyWheels renderRef={renderRef} clipPlaneRef={wheelCopyClipRef} />
        </group>
      )}
      <VoxelVolumeRenderer
        dims={body.dims}
        voxels={body.voxels}
        palette={body.storageBay ? cratePalette : palette}
        materialParams={materialParams}
        voxelSize={VOXEL_SIZE}
        heatRef={heatRef}
        worldOcclusion={worldOcclusion}
        portalClipRef={portalClipRef}
        portalCopyRef={portalCopyRef}
        portalStraddlerOnly={body.renderModel === 'shipping-crate'}
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
  const [straddlingIds, setStraddlingIds] = useState<ReadonlySet<string>>(() => new Set());
  const lastStraddlingIds = useRef('');
  useFrame(() => {
    const ids = (renderRef.current?.portalStraddlers ?? [])
      .filter((entry) => entry.pairId === RETURNS_PAIR.id)
      .map((entry) => entry.bodyId)
      .sort();
    const key = ids.join('\u0000');
    if (key !== lastStraddlingIds.current) {
      lastStraddlingIds.current = key;
      setStraddlingIds(new Set(ids));
    }
  });

  return (
    <>
      <HeatLights renderRef={renderRef} />
      {bodies.map((body) => body.renderModel === 'shipping-crate' && !straddlingIds.has(body.id)
        ? null
        : (
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
