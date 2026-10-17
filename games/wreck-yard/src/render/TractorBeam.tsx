import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { MAX_PLAYERS } from '../sim/constants';
import type { UiTool } from './keyBindings';
import type { YardRender } from './presentation';
import { useReducedMotionRef } from './reducedMotion';
import { glowTexture } from './style/glowTexture';
import { toolMuzzleAndAim } from './toolMuzzle';

const SEGMENTS = 22;
const BEADS = 7;
const UP = new THREE.Vector3(0, 1, 0);
const ENERGY = new THREE.Color('#7dd3fc').multiplyScalar(2.2);
const CORE = new THREE.Color('#e0f7ff').multiplyScalar(2.6);
const ADDITIVE = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false } as const;
const noRaycast = () => null;

function curvePoint(out: THREE.Vector3, start: THREE.Vector3, control: THREE.Vector3, end: THREE.Vector3, t: number): void {
  const remaining = 1 - t;
  out.copy(start).multiplyScalar(remaining * remaining)
    .addScaledVector(control, 2 * remaining * t)
    .addScaledVector(end, t * t);
}

function uploadInstances(mesh: THREE.InstancedMesh | null, count: number): void {
  if (!mesh) return;
  mesh.count = count;
  if (count > 0) mesh.instanceMatrix.needsUpdate = true;
}

/** A fixed pool draws each held body's beam. Width and endpoint size stay constant. */
export function TractorBeam({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const { camera } = useThree();
  const reducedMotion = useReducedMotionRef();
  const sheath = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.InstancedMesh>(null);
  const beads = useRef<THREE.InstancedMesh>(null);
  const ends = useRef<(THREE.Sprite | null)[]>(Array.from({ length: MAX_PLAYERS }, () => null));
  const flow = useRef(0);
  const scratch = useMemo(() => ({
    muzzle: new THREE.Vector3(), aim: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
    control: new THREE.Vector3(), target: new THREE.Vector3(),
    a: new THREE.Vector3(), b: new THREE.Vector3(), direction: new THREE.Vector3(), transform: new THREE.Object3D(),
  }), []);

  useLayoutEffect(() => {
    sheath.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    core.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    beads.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  useFrame((_, delta) => {
    const render = renderRef.current;
    if (!render) flow.current = 0;
    else if (!reducedMotion.current) flow.current = (flow.current + Math.min(delta, 0.1) * 1.6) % 1;
    let segmentCount = 0;
    let beadCount = 0;
    for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
      const glow = ends.current[slot];
      if (glow) glow.visible = false;
    }
    if (render) {
      const s = scratch;
      for (const player of render.players) {
        const pose = player.grabbing ? render.poses.get(player.grabbing) : undefined;
        if (!pose || player.ridingVehicle) continue;
        toolMuzzleAndAim(player, player.slot === render.localSlot && tool !== 'orbit', camera, s.muzzle, s.aim, s);
        s.target.fromArray(pose.position);
        const reach = s.muzzle.distanceTo(s.target);
        if (reach < 1e-4) continue;
        s.control.copy(s.muzzle).addScaledVector(s.aim, reach * 0.55);
        s.a.copy(s.muzzle);
        for (let index = 0; index < SEGMENTS; index += 1) {
          curvePoint(s.b, s.muzzle, s.control, s.target, (index + 1) / SEGMENTS);
          s.direction.subVectors(s.b, s.a);
          const length = s.direction.length();
          if (length > 1e-5) {
            s.transform.position.copy(s.a).addScaledVector(s.direction, 0.5);
            s.transform.quaternion.setFromUnitVectors(UP, s.direction.divideScalar(length));
            s.transform.scale.set(1, length, 1);
            s.transform.updateMatrix();
            sheath.current?.setMatrixAt(segmentCount, s.transform.matrix);
            core.current?.setMatrixAt(segmentCount, s.transform.matrix);
            segmentCount += 1;
          }
          s.a.copy(s.b);
        }
        s.transform.quaternion.identity();
        s.transform.scale.setScalar(0.8);
        for (let index = 0; index < BEADS; index += 1) {
          curvePoint(s.transform.position, s.muzzle, s.control, s.target, (flow.current + index / BEADS) % 1);
          s.transform.updateMatrix();
          beads.current?.setMatrixAt(beadCount, s.transform.matrix);
          beadCount += 1;
        }
        const glow = ends.current[player.slot];
        if (glow) {
          glow.position.copy(s.target);
          glow.visible = true;
        }
      }
    }
    uploadInstances(sheath.current, segmentCount);
    uploadInstances(core.current, segmentCount);
    uploadInstances(beads.current, beadCount);
  });

  return (
    <group name="TractorBeam">
      <instancedMesh name="tractor-beam-sheath" ref={sheath} args={[undefined, undefined, SEGMENTS * MAX_PLAYERS]}
        count={0} frustumCulled={false} raycast={noRaycast} renderOrder={10}>
        <cylinderGeometry args={[0.055, 0.055, 1, 8, 1, true]} />
        <meshBasicMaterial name="tractor-beam-sheath-material" color={ENERGY} opacity={0.28} {...ADDITIVE} />
      </instancedMesh>
      <instancedMesh name="tractor-beam-core" ref={core} args={[undefined, undefined, SEGMENTS * MAX_PLAYERS]}
        count={0} frustumCulled={false} raycast={noRaycast} renderOrder={11}>
        <cylinderGeometry args={[0.014, 0.014, 1, 6, 1, true]} />
        <meshBasicMaterial name="tractor-beam-core-material" color={CORE} opacity={0.95} {...ADDITIVE} />
      </instancedMesh>
      <instancedMesh name="tractor-beam-beads" ref={beads} args={[undefined, undefined, BEADS * MAX_PLAYERS]}
        count={0} frustumCulled={false} raycast={noRaycast} renderOrder={12}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshBasicMaterial name="tractor-beam-beads-material" color={CORE} opacity={0.9} {...ADDITIVE} />
      </instancedMesh>
      {Array.from({ length: MAX_PLAYERS }, (_, slot) => (
        <sprite key={slot} name={`tractor-beam-end-${slot}`} ref={(sprite) => { ends.current[slot] = sprite; }}
          scale={[0.9, 0.9, 1]} visible={false} raycast={noRaycast} renderOrder={12}>
          <spriteMaterial name={`tractor-beam-end-material-${slot}`} map={glowTexture()} color={ENERGY} opacity={0.55} {...ADDITIVE} />
        </sprite>
      ))}
    </group>
  );
}
