import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, PointLight, MeshStandardMaterial } from "three";

export function LanternModel({
  lit,
  paused,
}: {
  lit: boolean;
  paused: boolean;
}) {
  const initiallyLit = useRef(lit).current;
  const light = useRef<PointLight>(null!);
  const flame = useRef<MeshStandardMaterial>(null!);
  const time = useRef(0);
  useFrame((_, dt) => {
    if (paused) return;
    time.current += dt;
    const strength = lit ? 8 + Math.sin(time.current * 7) * 0.06 : 0;
    light.current.intensity = MathUtils.damp(
      light.current.intensity,
      strength,
      3,
      dt,
    );
    flame.current.emissiveIntensity = light.current.intensity * 0.6;
  });

  return (
    <group name="portable-lantern">
      <mesh position={[0, -0.075, 0]}>
        <cylinderGeometry args={[0.15, 0.17, 0.07, 12]} />
        <meshStandardMaterial color="#241b16" roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.005, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.12, 12]} />
        <meshStandardMaterial
          color="#4c3925"
          metalness={0.38}
          roughness={0.72}
        />
      </mesh>

      {/* Thick glass chimney and four dark guard rails read as one object. */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.075, 0.095, 0.22, 12, 1, true]} />
        <meshStandardMaterial
          color="#9c8d66"
          transparent
          opacity={0.28}
          roughness={0.3}
        />
      </mesh>
      {[
        [-0.07, 0],
        [0.07, 0],
        [0, -0.07],
        [0, 0.07],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.15, z]}>
          <boxGeometry
            args={[x === 0 ? 0.018 : 0.025, 0.23, z === 0 ? 0.018 : 0.025]}
          />
          <meshStandardMaterial
            color="#29231a"
            metalness={0.5}
            roughness={0.62}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0]} scale={[0.014, 0.04, 0.014]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          ref={flame}
          color="#362714"
          emissive="#ffd491"
          emissiveIntensity={initiallyLit ? 4.2 : 0}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <coneGeometry args={[0.1, 0.08, 12]} />
        <meshStandardMaterial
          color="#29231a"
          metalness={0.45}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, 0.325, 0]}>
        <torusGeometry args={[0.072, 0.012, 6, 16]} />
        <meshStandardMaterial
          color="#29231a"
          metalness={0.5}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <torusGeometry args={[0.045, 0.012, 6, 12]} />
        <meshStandardMaterial
          color="#4b3926"
          metalness={0.48}
          roughness={0.62}
        />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.17, 0]}
        color="#efc18a"
        intensity={initiallyLit ? 8 : 0}
        distance={1.65}
        decay={2}

        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
    </group>
  );
}
