import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PortalPlane4 } from '@series-inc/rundot-syncplay/physics/3d';
import { BUGGY_WHEELS } from '../sim/vehicle';
import type { YardRender } from './presentation';
import { getToonMaterial } from './style/toonMaterial';
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
const LINK_GEOMETRY = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
const UP = new THREE.Vector3(0, 1, 0);
const LINK_MOUNTS = [{ shock: true, x: 0.56, yOffset: 0 }, { shock: false, x: 0.48, yOffset: -0.38 }] as const;

/** Wheels and suspension links follow the same physics state. */
export function BuggyWheels({ renderRef, clipPlaneRef }: {
  renderRef: MutableRefObject<YardRender | null>;
  clipPlaneRef?: { readonly current: PortalPlane4 | null };
}) {
  const tires = useRef<THREE.InstancedMesh>(null);
  const rims = useRef<THREE.InstancedMesh>(null);
  const hubs = useRef<THREE.InstancedMesh>(null);
  const shocks = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const link = useMemo(() => new THREE.Object3D(), []);
  const pivot = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(), 1), []);
  const materials = useMemo(() => {
    const result = [
      getToonMaterial(ART_STYLE.palette.mustard).clone(),
      getToonMaterial(ART_STYLE.palette.metal).clone(),
      getToonMaterial('#242827').clone(),
      getToonMaterial(ART_STYLE.palette.metal).clone(),
      getToonMaterial(ART_STYLE.palette.signalOrange).clone(),
    ];
    for (const material of result) {
      material.clippingPlanes = [clipPlane];
      material.clipIntersection = false;
      material.needsUpdate = true;
    }
    return result;
  }, [clipPlane]);

  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  useFrame(() => {
    const plane = clipPlaneRef?.current;
    if (plane) {
      clipPlane.normal.set(plane[0], plane[1], plane[2]);
      clipPlane.constant = plane[3];
    } else {
      clipPlane.normal.set(0, 0, 0);
      clipPlane.constant = 1;
    }

    const wheels = renderRef.current?.buggyWheels;
    for (const [index, spec] of BUGGY_WHEELS.entries()) {
      const wheel = wheels?.[index];
      transform.position.set(spec.localAnchor.x, spec.localAnchor.y - spec.suspensionRestLength + (wheel?.compression ?? 0), spec.localAnchor.z);
      transform.rotation.set((wheel?.spinTurns ?? 0) * Math.PI * 2, (wheel?.steerAngleTurns ?? 0) * Math.PI * 2, 0, 'YXZ');
      transform.updateMatrix();
      tires.current?.setMatrixAt(index, transform.matrix);
      rims.current?.setMatrixAt(index, transform.matrix);
      hubs.current?.setMatrixAt(index, transform.matrix);
      for (const mount of LINK_MOUNTS) {
        const mesh = mount.shock ? shocks.current : arms.current;
        pivot.set(Math.sign(spec.localAnchor.x) * mount.x, spec.localAnchor.y + mount.yOffset, spec.localAnchor.z);
        direction.subVectors(transform.position, pivot);
        link.position.copy(pivot).add(transform.position).multiplyScalar(0.5);
        link.scale.set(1, direction.length(), 1);
        link.quaternion.setFromUnitVectors(UP, direction.normalize());
        link.updateMatrix();
        mesh?.setMatrixAt(index, link.matrix);
      }
    }
    if (tires.current) tires.current.instanceMatrix.needsUpdate = true;
    if (rims.current) rims.current.instanceMatrix.needsUpdate = true;
    if (hubs.current) hubs.current.instanceMatrix.needsUpdate = true;
    if (shocks.current) shocks.current.instanceMatrix.needsUpdate = true;
    if (arms.current) arms.current.instanceMatrix.needsUpdate = true;
  });

  return <>
    <instancedMesh ref={shocks} args={[LINK_GEOMETRY, materials[0], BUGGY_WHEELS.length]} frustumCulled={false} castShadow />
    <instancedMesh ref={arms} args={[LINK_GEOMETRY, materials[1], BUGGY_WHEELS.length]} frustumCulled={false} castShadow />
    <instancedMesh ref={tires} args={[TIRE_GEOMETRY, materials[2], BUGGY_WHEELS.length]} frustumCulled={false} castShadow receiveShadow />
    <instancedMesh ref={rims} args={[RIM_GEOMETRY, materials[3], BUGGY_WHEELS.length]} frustumCulled={false} castShadow receiveShadow />
    <instancedMesh ref={hubs} args={[HUB_GEOMETRY, materials[4], BUGGY_WHEELS.length]} frustumCulled={false} />
  </>;
}
