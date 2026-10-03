import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { MAX_DROPPED_DRUMS } from '../sim/contraptions';
import { TICK_RATE } from '../sim/constants';
import { FUEL_DRUM } from '../sim/fuelDrum';
import type { YardRender } from './presentation';
import { glowTexture, smokeTexture } from './style/glowTexture';

/** Damage share from which a drum vents smoke, and from which it glows red hot. */
const VENT_SHARE = 0.4;
const HOT_SHARE = 0.75;
const PUFFS = 140;
const SPARKS = 160;
/** Top of the drum above its center (the drum is 0.96 m tall). */
const CAP = 0.5;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const particles = (count: number): Particle[] => Array.from({ length: count }, () => ({
  position: new THREE.Vector3(0, -100, 0), velocity: new THREE.Vector3(), life: 0, maxLife: 1,
}));

/**
 * How close each fuel drum is to going off (sim/fuelDrum.ts): a damaged drum
 * vents smoke, a badly damaged one glows red hot, and a lit drum flashes
 * faster as its fuse runs out and throws sparks from its cap.
 */
export function FuelDrumFx({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const glows = useRef<(THREE.Sprite | null)[]>([]);
  const puffMesh = useRef<THREE.InstancedMesh>(null);
  const sparkMesh = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => particles(PUFFS), []);
  const sparks = useMemo(() => particles(SPARKS), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const owed = useRef({ puffs: 0, sparks: 0 });
  const clock = useRef(0);
  const sparkColor = useMemo(() => new THREE.Color(2.4, 1.2, 0.35), []);

  useFrame(({ camera }, delta) => {
    clock.current += delta;
    const render = renderRef.current;
    const drums = render?.contraptions.drums ?? [];
    const emitters: { at: THREE.Vector3; share: number; lit: boolean }[] = [];

    for (let index = 0; index < MAX_DROPPED_DRUMS; index += 1) {
      const sprite = glows.current[index];
      if (!sprite) continue;
      const drum = drums[index];
      const pose = drum ? render?.poses.get(drum.bodyId) : undefined;
      if (!drum || !pose || !render) {
        sprite.visible = false;
        continue;
      }
      const share = drum.damage / FUEL_DRUM.maxDamage;
      const at = new THREE.Vector3(pose.position[0], pose.position[1], pose.position[2]);
      const lit = drum.detonateAt !== null;
      emitters.push({ at, share, lit });
      if (!lit && share < HOT_SHARE) {
        sprite.visible = false;
        continue;
      }
      // Lit: the pulse speeds up from 3 Hz to 15 Hz as the fuse runs out.
      const fuseLeft = lit ? Math.max(0, (drum.detonateAt! - render.frame) / TICK_RATE) : 0;
      const hertz = lit ? 3 + 12 * (1 - Math.min(1, fuseLeft / (FUEL_DRUM.fuseTicks / TICK_RATE))) : 1.2;
      const pulse = 0.5 + 0.5 * Math.sin(clock.current * hertz * Math.PI * 2);
      sprite.visible = true;
      sprite.position.copy(at);
      sprite.scale.setScalar(lit ? 1.5 + pulse * 0.6 : 1.3);
      sprite.material.opacity = lit ? 0.45 + 0.55 * pulse : 0.25 + 0.2 * pulse;
    }

    owed.current.puffs += emitters.reduce((sum, e) => sum + (e.share >= VENT_SHARE || e.lit ? (e.lit ? 18 : 3 + 8 * e.share) * delta : 0), 0);
    owed.current.sparks += emitters.reduce((sum, e) => sum + (e.lit ? 70 * delta : 0), 0);
    const venting = emitters.filter((e) => e.share >= VENT_SHARE || e.lit);
    const lit = emitters.filter((e) => e.lit);

    const puffMeshNow = puffMesh.current;
    if (puffMeshNow) {
      for (let index = 0; index < PUFFS; index += 1) {
        const puff = puffs[index]!;
        if (puff.life <= 0 && owed.current.puffs >= 1 && venting.length > 0) {
          owed.current.puffs -= 1;
          const source = venting[Math.floor(Math.random() * venting.length)]!;
          puff.maxLife = 1.2 + Math.random() * 0.8;
          puff.life = puff.maxLife;
          puff.position.copy(source.at).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, CAP, (Math.random() - 0.5) * 0.3));
          puff.velocity.set((Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4);
        }
        if (puff.life > 0) {
          puff.life -= delta;
          puff.position.addScaledVector(puff.velocity, delta);
          const t = 1 - Math.max(0, puff.life / puff.maxLife);
          dummy.position.copy(puff.position);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.setScalar(0.18 + t * 0.6);
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0);
        }
        dummy.updateMatrix();
        puffMeshNow.setMatrixAt(index, dummy.matrix);
      }
      puffMeshNow.instanceMatrix.needsUpdate = true;
    }
    owed.current.puffs = Math.min(owed.current.puffs, 4);

    const sparkMeshNow = sparkMesh.current;
    if (sparkMeshNow) {
      for (let index = 0; index < SPARKS; index += 1) {
        const spark = sparks[index]!;
        if (spark.life <= 0 && owed.current.sparks >= 1 && lit.length > 0) {
          owed.current.sparks -= 1;
          const source = lit[Math.floor(Math.random() * lit.length)]!;
          spark.maxLife = 0.35 + Math.random() * 0.35;
          spark.life = spark.maxLife;
          spark.position.copy(source.at).add(new THREE.Vector3(0, CAP, 0));
          spark.velocity.set((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3);
        }
        if (spark.life > 0) {
          spark.life -= delta;
          spark.position.addScaledVector(spark.velocity, delta);
          spark.velocity.y -= 12 * delta;
          const size = 0.05 * Math.max(0.2, spark.life / spark.maxLife);
          dummy.position.copy(spark.position);
          dummy.quaternion.setFromUnitVectors(up, spark.velocity.clone().normalize());
          dummy.scale.set(size, size * 3, size);
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0);
        }
        dummy.updateMatrix();
        sparkMeshNow.setMatrixAt(index, dummy.matrix);
      }
      sparkMeshNow.instanceMatrix.needsUpdate = true;
    }
    owed.current.sparks = Math.min(owed.current.sparks, 6);
  });

  return (
    <group>
      {Array.from({ length: MAX_DROPPED_DRUMS }, (_, index) => (
        <sprite key={index} ref={(sprite) => { glows.current[index] = sprite; }} visible={false} renderOrder={12}>
          <spriteMaterial map={glowTexture()} color={new THREE.Color(2.4, 0.55, 0.18)} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
      <instancedMesh ref={puffMesh} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={smokeTexture()} color="#a39c95" transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={sparkMesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <coneGeometry args={[0.3, 1, 4]} />
        <meshBasicMaterial color={sparkColor} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
