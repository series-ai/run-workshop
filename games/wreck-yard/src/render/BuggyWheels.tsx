import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUGGY_WHEELS } from '../sim/vehicle';
import type { YardRender } from './presentation';
import { Toon } from './style/toonMaterial';
import { ART_STYLE } from './style/artStyle';

const WHEEL_RADIUS = BUGGY_WHEELS[0]!.radius;
const TIRE_GEOMETRY = (() => {
  const core = new THREE.CylinderGeometry(WHEEL_RADIUS - 0.015, WHEEL_RADIUS - 0.015, 0.23, 16);
  core.rotateZ(Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [core];
  for (let i = 0; i < 16; i++) {
    const tread = new THREE.BoxGeometry(0.25, 0.035, 0.075);
    tread.translate(0, WHEEL_RADIUS - 0.012, 0);
    tread.rotateX(i * Math.PI / 8);
    parts.push(tread);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
})();
const RIM_GEOMETRY = new THREE.CylinderGeometry(0.18, 0.18, 0.242, 12).rotateZ(Math.PI / 2);
const HUB_GEOMETRY = new THREE.CylinderGeometry(0.065, 0.065, 0.252, 6).rotateZ(Math.PI / 2);

/** Draw all four wheels with three instanced meshes. */
export function BuggyWheels({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const tires = useRef<THREE.InstancedMesh>(null);
  const rims = useRef<THREE.InstancedMesh>(null);
  const hubs = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const wheels = renderRef.current?.buggyWheels;
    for (const [index, spec] of BUGGY_WHEELS.entries()) {
      const wheel = wheels?.[index];
      transform.position.set(spec.localAnchor.x, spec.localAnchor.y - spec.suspensionRestLength + (wheel?.compression ?? 0), spec.localAnchor.z);
      transform.rotation.set((wheel?.spinTurns ?? 0) * Math.PI * 2, (wheel?.steerAngleTurns ?? 0) * Math.PI * 2, 0, 'YXZ');
      transform.updateMatrix();
      tires.current?.setMatrixAt(index, transform.matrix);
      rims.current?.setMatrixAt(index, transform.matrix);
      hubs.current?.setMatrixAt(index, transform.matrix);
    }
    if (tires.current) tires.current.instanceMatrix.needsUpdate = true;
    if (rims.current) rims.current.instanceMatrix.needsUpdate = true;
    if (hubs.current) hubs.current.instanceMatrix.needsUpdate = true;
  });

  return <>
    <instancedMesh ref={tires} args={[TIRE_GEOMETRY, undefined, BUGGY_WHEELS.length]} frustumCulled={false} castShadow receiveShadow>
      <Toon color="#242827" />
    </instancedMesh>
    <instancedMesh ref={rims} args={[RIM_GEOMETRY, undefined, BUGGY_WHEELS.length]} frustumCulled={false} castShadow receiveShadow>
      <Toon color={ART_STYLE.palette.metal} />
    </instancedMesh>
    <instancedMesh ref={hubs} args={[HUB_GEOMETRY, undefined, BUGGY_WHEELS.length]} frustumCulled={false}>
      <Toon color={ART_STYLE.palette.signalOrange} />
    </instancedMesh>
  </>;
}
