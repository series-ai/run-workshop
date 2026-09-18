import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { UiTool } from './PointerInput';
import type { YardRender } from './presentation';

const SPARK_COUNT = 160;

export function TorchSparks({
  tool,
  renderRef,
}: {
  tool: UiTool;
  renderRef: React.MutableRefObject<YardRender | null>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Particle state arrays
  const particles = useMemo(() => {
    return Array.from({ length: SPARK_COUNT }, () => ({
      pos: new THREE.Vector3(0, -100, 0),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      scale: 0.02,
    }));
  }, []);

  const sparkColorHot = useMemo(() => new THREE.Color('#fffbeb'), []);
  const sparkColorOrange = useMemo(() => new THREE.Color('#f97316'), []);
  const sparkColorRed = useMemo(() => new THREE.Color('#dc2626'), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const render = renderRef.current;
    const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);
    const isTorching = tool === 'torch' && Boolean(localPlayer?.torching);

    // Compute player forward vector and torch tip position in world space
    let spawnOrigin: THREE.Vector3 | null = null;
    let spawnDir: THREE.Vector3 | null = null;

    if (isTorching && localPlayer) {
      const yaw = localPlayer.yaw;
      const pitch = localPlayer.pitch;
      const cy = Math.cos(pitch);
      const fx = -Math.sin(yaw) * cy;
      const fy = Math.sin(pitch);
      const fz = -Math.cos(yaw) * cy;

      // Player eye position
      const eyeX = localPlayer.position[0];
      const eyeY = localPlayer.position[1] + 1.55;
      const eyeZ = localPlayer.position[2];

      // Beam endpoint ~ 2.2m forward where it cuts voxels
      spawnOrigin = new THREE.Vector3(eyeX + fx * 2.2, eyeY + fy * 2.2, eyeZ + fz * 2.2);
      spawnDir = new THREE.Vector3(-fx, -fy, -fz); // Sparks spray backward / out from cut
    }

    let nextSpawnIdx = 0;

    for (let i = 0; i < SPARK_COUNT; i++) {
      const p = particles[i]!;

      if (p.life > 0) {
        p.life -= delta;
        p.pos.addScaledVector(p.vel, delta);
        p.vel.y -= 14.0 * delta; // Gravity
        p.vel.multiplyScalar(0.97); // Air drag

        // Floor bounce
        if (p.pos.y < 0.02) {
          p.pos.y = 0.02;
          p.vel.y = -p.vel.y * 0.45;
          p.vel.x *= 0.7;
          p.vel.z *= 0.7;
        }

        const t = Math.max(0, p.life / p.maxLife);
        const currentScale = p.scale * (0.3 + t * 0.7);

        dummy.position.copy(p.pos);
        dummy.scale.set(currentScale, currentScale * (1.0 + p.vel.length() * 0.15), currentScale);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.vel.clone().normalize());
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(i, dummy.matrix);

        // Color transitions from white-hot to red to dead
        const color = t > 0.7 ? sparkColorHot : t > 0.3 ? sparkColorOrange : sparkColorRed;
        meshRef.current.setColorAt(i, color);
      } else if (spawnOrigin && spawnDir && nextSpawnIdx < 8) {
        // Spawn fresh spark
        nextSpawnIdx++;
        p.pos.copy(spawnOrigin).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
        ));
        // High-velocity cone spray
        p.vel.copy(spawnDir)
          .multiplyScalar(4.0 + Math.random() * 8.0)
          .add(new THREE.Vector3(
            (Math.random() - 0.5) * 6.0,
            Math.random() * 5.0 + 1.0,
            (Math.random() - 0.5) * 6.0,
          ));
        p.maxLife = 0.25 + Math.random() * 0.45;
        p.life = p.maxLife;
        p.scale = 0.025 + Math.random() * 0.025;
      } else {
        // Inactive: hide away
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SPARK_COUNT]} frustumCulled={false}>
      <coneGeometry args={[0.024, 0.09, 4]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
