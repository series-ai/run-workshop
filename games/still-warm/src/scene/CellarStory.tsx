import { useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { COLORS } from "./palette";

interface CellarStoryProps {
  lit: boolean;
  paused: boolean;
  reducedMotion: boolean;
}

type Vec3 = [number, number, number];
type Fragment = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

const JOISTS: Fragment[] = [
  {
    position: [-0.94, 2.02, 0.25],
    rotation: [0.03, 0.04, -0.08],
    scale: [0.16, 0.15, 1.08],
  },
  {
    position: [-0.83, 2.01, 1.42],
    rotation: [-0.04, -0.05, 0.06],
    scale: [0.15, 0.14, 0.62],
  },
  {
    position: [0.91, 2.03, 0.12],
    rotation: [-0.03, -0.05, 0.08],
    scale: [0.17, 0.15, 0.96],
  },
  {
    position: [0.82, 2.0, 1.38],
    rotation: [0.04, 0.03, -0.07],
    scale: [0.16, 0.14, 0.68],
  },
  {
    position: [-1.46, 2.06, 0.86],
    rotation: [0.01, 0.02, -0.025],
    scale: [0.14, 0.14, 1.75],
  },
  {
    position: [1.45, 2.05, 0.82],
    rotation: [-0.02, -0.03, 0.03],
    scale: [0.14, 0.14, 1.7],
  },
];

const PLASTER_EDGE: Fragment[] = [
  {
    position: [-0.72, 1.99, 0.03],
    rotation: [0.08, 0.03, -0.14],
    scale: [0.2, 0.06, 0.34],
  },
  {
    position: [-0.67, 1.98, 0.42],
    rotation: [-0.05, 0.02, 0.1],
    scale: [0.16, 0.05, 0.24],
  },
  {
    position: [-0.7, 1.97, 0.83],
    rotation: [0.04, -0.04, -0.08],
    scale: [0.22, 0.06, 0.3],
  },
  {
    position: [-0.66, 1.98, 1.2],
    rotation: [-0.08, 0.03, 0.16],
    scale: [0.17, 0.05, 0.28],
  },
  {
    position: [0.72, 1.99, 0.1],
    rotation: [-0.04, 0.04, 0.1],
    scale: [0.2, 0.06, 0.3],
  },
  {
    position: [0.68, 1.98, 0.48],
    rotation: [0.08, -0.02, -0.12],
    scale: [0.15, 0.05, 0.25],
  },
  {
    position: [0.71, 1.97, 0.88],
    rotation: [-0.06, 0.04, 0.12],
    scale: [0.22, 0.06, 0.32],
  },
  {
    position: [0.67, 1.98, 1.22],
    rotation: [0.05, -0.03, -0.14],
    scale: [0.16, 0.05, 0.28],
  },
  {
    position: [-0.34, 1.98, -0.04],
    rotation: [0.06, 0.08, 0.18],
    scale: [0.3, 0.05, 0.13],
  },
  {
    position: [0.25, 1.98, -0.02],
    rotation: [-0.04, -0.06, -0.2],
    scale: [0.26, 0.05, 0.12],
  },
  {
    position: [-0.28, 1.98, 1.42],
    rotation: [-0.07, 0.03, -0.16],
    scale: [0.32, 0.05, 0.14],
  },
  {
    position: [0.3, 1.98, 1.4],
    rotation: [0.04, -0.08, 0.2],
    scale: [0.25, 0.05, 0.13],
  },
];

const LATHS: Fragment[] = [
  {
    position: [-0.54, 1.91, 0.16],
    rotation: [0.06, 0.12, -0.1],
    scale: [0.045, 0.07, 0.58],
  },
  {
    position: [-0.54, 1.91, 0.95],
    rotation: [-0.05, -0.1, 0.08],
    scale: [0.04, 0.07, 0.46],
  },
  {
    position: [0.53, 1.92, 0.25],
    rotation: [-0.04, 0.1, 0.12],
    scale: [0.045, 0.07, 0.52],
  },
  {
    position: [0.54, 1.91, 1.03],
    rotation: [0.05, -0.12, -0.08],
    scale: [0.04, 0.07, 0.38],
  },
  {
    position: [-0.22, 1.92, 1.52],
    rotation: [0.09, 0.06, -0.24],
    scale: [0.5, 0.06, 0.04],
  },
  {
    position: [0.28, 1.92, 1.5],
    rotation: [-0.08, -0.04, 0.18],
    scale: [0.42, 0.06, 0.04],
  },
];

const FLOOR_FRAGMENTS: Fragment[] = [
  {
    position: [-1.56, -0.85, -0.52],
    rotation: [0.1, 0.3, 0.2],
    scale: [0.17, 0.06, 0.13],
  },
  {
    position: [-1.42, -0.85, 0.28],
    rotation: [0.2, -0.4, -0.1],
    scale: [0.1, 0.05, 0.09],
  },
  {
    position: [-1.65, -0.85, 1.06],
    rotation: [-0.1, 0.5, 0.14],
    scale: [0.14, 0.06, 0.1],
  },
  {
    position: [1.55, -0.85, -0.42],
    rotation: [0.12, -0.3, -0.18],
    scale: [0.13, 0.05, 0.1],
  },
  {
    position: [1.48, -0.85, 0.42],
    rotation: [-0.1, 0.4, 0.16],
    scale: [0.18, 0.06, 0.12],
  },
  {
    position: [1.7, -0.85, 1.14],
    rotation: [0.18, 0.1, -0.24],
    scale: [0.11, 0.05, 0.08],
  },
  {
    position: [-0.78, -0.85, 1.82],
    rotation: [0.05, 0.4, 0.12],
    scale: [0.16, 0.05, 0.1],
  },
  {
    position: [0.78, -0.85, 1.86],
    rotation: [-0.12, -0.3, -0.2],
    scale: [0.12, 0.05, 0.09],
  },
];

const DUST: Vec3[] = [
  [-0.12, 0.62, 0.31],
  [0.16, 0.92, 0.58],
  [-0.08, 1.26, 0.74],
  [0.11, 1.52, 0.43],
  [-0.2, 1.78, 0.9],
  [0.22, 1.08, 0.98],
];

/** A collapsed ceiling vignette that frames the father's pinned body. */
export const CellarStory: FC<CellarStoryProps> = ({
  lit,
  paused,
  reducedMotion,
}) => {
  const dustRef = useRef<Group>(null!);

  useFrame(({ clock }) => {
    if (paused || reducedMotion || !dustRef.current) return;
    const time = clock.getElapsedTime();
    dustRef.current.children.forEach((particle, index) => {
      const [x, y, z] = DUST[index];
      particle.position.x = x + Math.sin(time * 0.27 + index) * 0.025;
      particle.position.y = y + Math.sin(time * 0.42 + index * 1.7) * 0.045;
      particle.position.z = z + Math.cos(time * 0.31 + index) * 0.02;
    });
  });

  return (
    <group name="cellar-story">
      {/* A dark, broken opening sits below the old ceiling ribs. */}
      <mesh position={[0, 2.015, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.38, 1.52]} />
        <meshStandardMaterial color={COLORS.bg} roughness={1} />
      </mesh>

      {/* The joists stop at different points. The uneven ends sell the collapse. */}
      {JOISTS.map((part, index) => (
        <mesh
          key={`joist-${index}`}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#3b2b22" roughness={0.92} />
        </mesh>
      ))}
      {PLASTER_EDGE.map((part, index) => (
        <mesh
          key={`plaster-${index}`}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? COLORS.bonePale : COLORS.boneShadow}
            roughness={1}
          />
        </mesh>
      ))}
      {LATHS.map((part, index) => (
        <mesh
          key={`lath-${index}`}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#6a5038" roughness={0.96} />
        </mesh>
      ))}

      {/* Fallen plaster stays at the room perimeter and leaves the body clear. */}
      {FLOOR_FRAGMENTS.map((part, index) => (
        <mesh
          key={`floor-fragment-${index}`}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={COLORS.boneShadow} roughness={1} />
        </mesh>
      ))}

      {lit && (
        <group name="cold-roof-shaft">
          {/* The shaft enters only through the collapsed opening. */}
          <mesh position={[0, 1.1, 0.7]}>
            <coneGeometry args={[0.48, 1.82, 16, 1, true]} />
            <meshStandardMaterial
              color="#b7c3ad"
              emissive="#64705f"
              emissiveIntensity={0.35}
              transparent
              opacity={0.02}
              depthWrite={false}
            />
          </mesh>
          <pointLight
            position={[0, 1.86, 0.7]}
            color="#b7c3ad"
            intensity={0.28}
            distance={3.6}
            decay={2}
          />
          <group ref={dustRef} name="roof-dust">
            {DUST.map(([x, y, z], index) => (
              <mesh key={`dust-${index}`} position={[x, y, z]}>
                <sphereGeometry args={[0.004, 6, 6]} />
                <meshBasicMaterial
                  color="#c7cfb7"
                  transparent
                  opacity={0.18}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        </group>
      )}
    </group>
  );
};

export default CellarStory;
