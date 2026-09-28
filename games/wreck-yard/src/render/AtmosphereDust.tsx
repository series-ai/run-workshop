import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WORLD_SUN_DIRECTION } from './viewConstants';
import { isMobileDevice } from './DynamicDpr';

const BOUNDS = {
  minX: -15,
  maxX: 35,
  minY: 0.6,
  maxY: 14.0,
  minZ: -15,
  maxZ: 35,
};

interface DustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
  phase: number;
}

export function AtmosphereDust() {
  const isMobile = isMobileDevice();
  const dustCount = isMobile ? 24 : 64;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Sun direction for forward Mie scattering calculation
  const sunDir = useMemo(
    () =>
      new THREE.Vector3(
        WORLD_SUN_DIRECTION[0],
        WORLD_SUN_DIRECTION[1],
        WORLD_SUN_DIRECTION[2],
      ).normalize(),
    [],
  );

  // Initialize randomized dust particles
  const particles = useMemo<DustParticle[]>(() => {
    const list: DustParticle[] = [];
    for (let i = 0; i < dustCount; i++) {
      list.push({
        x: BOUNDS.minX + Math.random() * (BOUNDS.maxX - BOUNDS.minX),
        y: BOUNDS.minY + Math.random() * (BOUNDS.maxY - BOUNDS.minY),
        z: BOUNDS.minZ + Math.random() * (BOUNDS.maxZ - BOUNDS.minZ),
        vx: (Math.random() - 0.5) * 0.15,
        vy: 0.12 + Math.random() * 0.18,
        vz: (Math.random() - 0.5) * 0.15,
        baseScale: 0.035 + Math.random() * 0.045,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return list;
  }, [dustCount]);

  const baseColor = useMemo(() => new THREE.Color('#ffdfa8'), []);
  const instanceColor = useMemo(() => new THREE.Color(), []);
  const viewDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }, delta) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    camera.getWorldDirection(viewDir);
    // Forward scattering peak when looking toward the sun
    const sunDot = Math.max(0, viewDir.dot(sunDir));
    const mie = Math.pow(sunDot, 4.0) * 1.8 + 0.65;

    for (let i = 0; i < dustCount; i++) {
      const p = particles[i]!;

      // Drift motion with gentle harmonic turbulence
      p.x += (p.vx + Math.sin(time * 0.8 + p.phase) * 0.08) * delta;
      p.y += p.vy * delta;
      p.z += (p.vz + Math.cos(time * 0.7 + p.phase) * 0.08) * delta;

      // Wrap around bounding box
      if (p.y > BOUNDS.maxY) p.y = BOUNDS.minY;
      if (p.x < BOUNDS.minX) p.x = BOUNDS.maxX;
      if (p.x > BOUNDS.maxX) p.x = BOUNDS.minX;
      if (p.z < BOUNDS.minZ) p.z = BOUNDS.maxZ;
      if (p.z > BOUNDS.maxZ) p.z = BOUNDS.minZ;

      // Pulse particle size gently
      const pulse = 1.0 + Math.sin(time * 2.0 + p.phase) * 0.25;
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(p.baseScale * pulse);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Modulate instance color with Mie sunlight
      instanceColor.copy(baseColor).multiplyScalar(mie);
      meshRef.current.setColorAt(i, instanceColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, dustCount]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.45}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
