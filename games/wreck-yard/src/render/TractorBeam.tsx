import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { MAX_PLAYERS } from '../sim/constants';
import type { UiTool } from './keyBindings';
import type { YardRender } from './presentation';
import { glowTexture } from './style/glowTexture';
import { bezierPoint, tractorControlPoint } from './toolFeedback';
import { toolMuzzleAndAim } from './toolMuzzle';

const SEGMENTS = 22;
const BEADS = 7;
const UP = new THREE.Vector3(0, 1, 0);
const ENERGY = new THREE.Color('#7dd3fc').multiplyScalar(2.2);
const CORE = new THREE.Color('#e0f7ff').multiplyScalar(2.6);

/**
 * Tractor beam while the gravity gun holds a body: a curve that leaves the
 * muzzle along the aim and bends into the held body, so a lagging body bends
 * the beam. Beads of energy flow along it toward the body.
 */
export function TractorBeam({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const { camera } = useThree();
  const sheath = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.InstancedMesh>(null);
  const beads = useRef<THREE.InstancedMesh>(null);
  const ends = useRef<(THREE.Sprite | null)[]>([]);
  const s = useMemo(() => ({
    muzzle: new THREE.Vector3(), aim: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
    a: new THREE.Vector3(), b: new THREE.Vector3(), dir: new THREE.Vector3(), object: new THREE.Object3D(),
  }), []);

  useFrame(({ clock }) => {
    const render = renderRef.current;
    const time = clock.elapsedTime;
    let segment = 0;
    let bead = 0;
    for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
      const glow = ends.current[slot];
      if (glow) glow.visible = false;
      const player = render?.players.find((p) => p.slot === slot);
      const pose = player?.grabbing ? render?.poses.get(player.grabbing) : undefined;
      if (!render || !player || !pose || player.ridingVehicle) continue;

      toolMuzzleAndAim(player, slot === render.localSlot && tool !== 'orbit', camera, s.muzzle, s.aim, s);
      const p0 = [s.muzzle.x, s.muzzle.y, s.muzzle.z] as const;
      const p2 = pose.position;
      const p1 = tractorControlPoint(p0, [s.aim.x, s.aim.y, s.aim.z], p2);

      // Sheath and core segments along the curve, with a small energy shimmer.
      for (let i = 0; i < SEGMENTS; i += 1) {
        s.a.fromArray(bezierPoint(p0, p1, p2, i / SEGMENTS));
        s.b.fromArray(bezierPoint(p0, p1, p2, (i + 1) / SEGMENTS));
        s.dir.subVectors(s.b, s.a);
        const length = s.dir.length();
        const shimmer = 1 + 0.35 * Math.sin(time * 24 - i * 0.9);
        s.object.position.copy(s.a).addScaledVector(s.dir, 0.5);
        s.object.quaternion.setFromUnitVectors(UP, s.dir.divideScalar(length));
        s.object.scale.set(shimmer, length, shimmer);
        s.object.updateMatrix();
        sheath.current?.setMatrixAt(segment, s.object.matrix);
        s.object.scale.set(1, length, 1);
        s.object.updateMatrix();
        core.current?.setMatrixAt(segment, s.object.matrix);
        segment += 1;
      }
      // Beads flow from the gun to the body.
      for (let i = 0; i < BEADS; i += 1) {
        const t = (time * 1.6 + i / BEADS) % 1;
        s.object.position.fromArray(bezierPoint(p0, p1, p2, t));
        s.object.quaternion.identity();
        s.object.scale.setScalar(0.5 + 0.5 * Math.sin(t * Math.PI));
        s.object.updateMatrix();
        beads.current?.setMatrixAt(bead, s.object.matrix);
        bead += 1;
      }
      if (glow) {
        glow.position.set(p2[0], p2[1], p2[2]);
        const size = 0.9 + 0.15 * Math.sin(time * 18);
        glow.scale.set(size, size, 1);
        glow.visible = true;
      }
    }
    for (const mesh of [sheath.current, core.current]) {
      if (!mesh) continue;
      mesh.count = segment;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (beads.current) {
      beads.current.count = bead;
      beads.current.instanceMatrix.needsUpdate = true;
    }
  });

  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const;
  return (
    <group name="TractorBeam">
      <instancedMesh ref={sheath} args={[undefined, undefined, SEGMENTS * MAX_PLAYERS]} frustumCulled={false} renderOrder={10}>
        <cylinderGeometry args={[0.055, 0.055, 1, 8, 1, true]} />
        <meshBasicMaterial color={ENERGY} opacity={0.28} {...additive} />
      </instancedMesh>
      <instancedMesh ref={core} args={[undefined, undefined, SEGMENTS * MAX_PLAYERS]} frustumCulled={false} renderOrder={11}>
        <cylinderGeometry args={[0.014, 0.014, 1, 6, 1, true]} />
        <meshBasicMaterial color={CORE} opacity={0.95} {...additive} />
      </instancedMesh>
      <instancedMesh ref={beads} args={[undefined, undefined, BEADS * MAX_PLAYERS]} frustumCulled={false} renderOrder={12}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshBasicMaterial color={CORE} opacity={0.9} {...additive} />
      </instancedMesh>
      {Array.from({ length: MAX_PLAYERS }, (_, slot) => (
        <sprite key={slot} ref={(sprite) => { ends.current[slot] = sprite; }} visible={false} renderOrder={12}>
          <spriteMaterial map={glowTexture()} color={ENERGY} opacity={0.55} {...additive} />
        </sprite>
      ))}
    </group>
  );
}
