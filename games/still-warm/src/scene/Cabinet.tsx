import { COLORS } from "./palette";

export const CABINET_FALLEN = [0, -0.3, 0.13] as const;
export const CABINET_CLEAR = [-1.25, 0.05, -0.1] as const;
export const CABINET_GRIP = [-0.45, 0.04, 0.13] as const;

export function Cabinet() {
  return (
    <group name="medicine-cabinet">
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 1.45, 0.92]} />
        <meshStandardMaterial
          color="#241914"
          metalness={0.08}
          roughness={0.88}
        />
      </mesh>
      <mesh position={[0, 0.77, 0]} castShadow>
        <boxGeometry args={[0.72, 0.1, 1.02]} />
        <meshStandardMaterial color="#4a3022" roughness={0.82} />
      </mesh>
      <mesh position={[0, -0.75, 0]} castShadow>
        <boxGeometry args={[0.68, 0.08, 0.98]} />
        <meshStandardMaterial color="#1c1512" roughness={0.92} />
      </mesh>
      {/* Raised timber rails and corner posts. */}
      {[-0.38, 0.38].map((y) => (
        <mesh key={y} position={[0.325, y, 0]} castShadow>
          <boxGeometry args={[0.05, 0.08, 0.86]} />
          <meshStandardMaterial color="#4a3022" roughness={0.82} />
        </mesh>
      ))}
      {[-0.34, 0.34].map((z) => (
        <mesh key={z} position={[0.325, 0, z]} castShadow>
          <boxGeometry args={[0.05, 1.34, 0.07]} />
          <meshStandardMaterial color="#4a3022" roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0.31, 0, 0]} castShadow>
        <boxGeometry args={[0.025, 1.18, 0.72]} />
        <meshStandardMaterial color="#302219" roughness={0.9} />
      </mesh>
      <mesh position={[0.34, 0, 0]}>
        <boxGeometry args={[0.012, 1.16, 0.7]} />
        <meshStandardMaterial
          color={COLORS.glassAmber}
          metalness={0.2}
          roughness={0.15}
          transparent
          opacity={0.35}
        />
      </mesh>
      {[-0.35, 0.0, 0.35].map((y, i) => (
        <mesh key={i} position={[0.05, y, 0]} castShadow>
          <boxGeometry args={[0.42, 0.025, 0.82]} />
          <meshStandardMaterial
            color="#4a3022"
            metalness={0.08}
            roughness={0.84}
          />
        </mesh>
      ))}
      <mesh position={[0.08, 0.07, -0.22]} castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.16, 12]} />
        <meshStandardMaterial
          color={COLORS.glassAmber}
          roughness={0.2}
          transparent
          opacity={0.65}
        />
      </mesh>
      <mesh position={[0.08, 0.07, 0.22]} castShadow>
        <cylinderGeometry args={[0.06, 0.055, 0.19, 12]} />
        <meshStandardMaterial
          color={COLORS.cellarStone}
          roughness={0.4}
          metalness={0.4}
        />
      </mesh>
      {[-0.35, 0, 0.35].map((y) => (
        <mesh
          key={y}
          position={[0.365, y, 0]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
        >
          <torusGeometry args={[0.045, 0.012, 6, 12]} />
          <meshStandardMaterial
            color="#80613a"
            metalness={0.72}
            roughness={0.4}
          />
        </mesh>
      ))}
      {[-0.18, 0.18].map((x, i) =>
        [-0.38, 0.38].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, -0.78, z]} castShadow>
            <cylinderGeometry args={[0.055, 0.065, 0.16, 8]} />
            <meshStandardMaterial
              color="#34251c"
              metalness={0.08}
              roughness={0.9}
            />
          </mesh>
        )),
      )}
    </group>
  );
}
