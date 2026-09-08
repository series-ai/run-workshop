import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, PointLight, MeshStandardMaterial } from "three";

export function WorkbenchLantern({
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
    const strength = lit ? 7 + Math.sin(time.current * 7) * 0.12 : 0;
    light.current.intensity = MathUtils.damp(
      light.current.intensity,
      strength,
      3,
      dt,
    );
    flame.current.emissiveIntensity = light.current.intensity * 0.6;
  });

  return (
    <group position={[-1, 0.17, 0.4]} name="workbench-lantern">
      {/* Broad feet keep the lantern grounded on the workbench. */}
      <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.06, 0.4]} />
        <meshStandardMaterial color="#30251c" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.075, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.07, 12]} />
        <meshStandardMaterial color="#241b16" roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.005, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.12, 12]} />
        <meshStandardMaterial color="#4c3925" metalness={0.38} roughness={0.72} />
      </mesh>

      {/* Thick glass chimney and four dark guard rails read as one object. */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.095, 0.22, 12, 1, true]} />
        <meshStandardMaterial
          color="#9c8d66"
          transparent
          opacity={0.28}
          roughness={0.3}
        />
      </mesh>
      {[[-0.07, 0], [0.07, 0], [0, -0.07], [0, 0.07]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.15, z]} castShadow>
          <boxGeometry args={[x === 0 ? 0.018 : 0.025, 0.23, z === 0 ? 0.018 : 0.025]} />
          <meshStandardMaterial color="#29231a" metalness={0.5} roughness={0.62} />
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
      <mesh position={[0, 0.28, 0]} castShadow>
        <coneGeometry args={[0.1, 0.08, 12]} />
        <meshStandardMaterial color="#29231a" metalness={0.45} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.325, 0]}>
        <torusGeometry args={[0.072, 0.012, 6, 16]} />
        <meshStandardMaterial color="#29231a" metalness={0.5} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <torusGeometry args={[0.045, 0.012, 6, 12]} />
        <meshStandardMaterial color="#4b3926" metalness={0.48} roughness={0.62} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.17, 0]}
        color="#efc18a"
        intensity={initiallyLit ? 7 : 0}
        distance={5}
        decay={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}
