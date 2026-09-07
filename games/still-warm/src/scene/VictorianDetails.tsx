import type { FC } from "react";
import { COLORS } from "./palette";

const WOOD_DARK = "#241914";
const WOOD_EDGE = "#4a3022";
const BRASS_OLD = "#80613a";
const BRASS_DARK = "#4b3926";
const LINEN = "#39392c";
const LINEN_STAIN = "#4a2d28";
const PAPER = "#b0a489";

/** Static set dressing that gives the cellar a Victorian mortuary identity. */
export const VictorianDetails: FC = () => (
  <>
    {/* Tall, stained privacy screen behind the patient. */}
    <group name="stained-linen-screen" position={[-0.72, 0.7, 1.62]}>
      {/* The top rail and upright posts give the screen a clear dark outline. */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[1.72, 0.1, 0.09]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
      </mesh>
      {[-0.84, 0.84].map((x) => (
        <mesh key={x} position={[x, -0.02, 0]} castShadow>
          <boxGeometry args={[0.09, 1.56, 0.1]} />
          <meshStandardMaterial color={WOOD_EDGE} roughness={0.86} />
        </mesh>
      ))}
      <mesh position={[0, -0.72, 0]} castShadow>
        <boxGeometry args={[1.72, 0.08, 0.09]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
      </mesh>

      {/* Three linen leaves sit inside the wooden frame. */}
      {[-0.54, 0, 0.54].map((x, index) => (
        <group
          key={x}
          position={[x, -0.02, 0]}
          rotation={[0, 0, (index - 1) * 0.035]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 1.31, 0.045]} />
            <meshStandardMaterial color={LINEN} roughness={0.98} />
          </mesh>
          <mesh position={[0.08, 0.22, -0.026]}>
            <boxGeometry args={[0.16, 0.3, 0.01]} />
            <meshStandardMaterial
              color={LINEN_STAIN}
              roughness={1}
              transparent
              opacity={0.72}
            />
          </mesh>
          <mesh position={[-0.12, -0.34, -0.026]} rotation={[0, 0, -0.18]}>
            <boxGeometry args={[0.13, 0.2, 0.01]} />
            <meshStandardMaterial
              color={LINEN_STAIN}
              roughness={1}
              transparent
              opacity={0.55}
            />
          </mesh>
          <mesh position={[0, 0.57, -0.031]}>
            <boxGeometry args={[0.45, 0.035, 0.016]} />
            <meshStandardMaterial color={BRASS_DARK} metalness={0.45} roughness={0.62} />
          </mesh>
        </group>
      ))}
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, -0.78, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 10]} />
          <meshStandardMaterial
            color={BRASS_OLD}
            metalness={0.62}
            roughness={0.52}
          />
        </mesh>
      ))}
    </group>

    {/* A framed anatomical plate, built from simple bone forms. */}
    <group
      name="anatomical-bone-plate"
      position={[0, 0.68, 2.39]}
      rotation={[0, Math.PI, 0]}
    >
      <mesh position={[0, 0, 0.015]} castShadow>
        <boxGeometry args={[1.34, 1.5, 0.1]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0, 0.075]}>
        <boxGeometry args={[1.12, 1.3, 0.03]} />
        <meshStandardMaterial color={PAPER} roughness={0.92} />
      </mesh>
      {[
        [0, 0.64, 0],
        [0, -0.64, 0],
      ].map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]} castShadow>
          <boxGeometry args={[1.2, 0.07, 0.05]} />
          <meshStandardMaterial color={WOOD_EDGE} roughness={0.8} />
        </mesh>
      ))}
      {[
        [-0.58, 0, 0],
        [0.58, 0, 0],
      ].map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.07, 1.3, 0.05]} />
          <meshStandardMaterial color={WOOD_EDGE} roughness={0.8} />
        </mesh>
      ))}

      {/* A larger, high contrast ribcage reads after the dither pass. */}
      <group position={[0, 0, 0.11]}>
        <mesh position={[0, 0.44, 0]}>
          <sphereGeometry args={[0.16, 12, 8]} />
          <meshStandardMaterial color={COLORS.bonePale} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <boxGeometry args={[0.15, 0.07, 0.04]} />
          <meshStandardMaterial color={COLORS.boneShadow} roughness={0.92} />
        </mesh>
        {[-0.08, 0, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.15, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.39, 8]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.92} />
          </mesh>
        ))}
        {[0.26, 0.13, 0, -0.13, -0.26].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[0.2 - Math.abs(y) * 0.1, 0.016, 6, 16, Math.PI]}
            />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.92} />
          </mesh>
        ))}
        {[-0.11, 0.11].map((x) => (
          <mesh
            key={x}
            position={[x, -0.44, 0]}
            rotation={[0, 0, x < 0 ? -0.22 : 0.22]}
          >
            <cylinderGeometry args={[0.022, 0.018, 0.36, 8]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.92} />
          </mesh>
        ))}
      </group>
      {[-0.5, 0.5].map((x) =>
        [-0.53, 0.53].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.1]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial
              color={BRASS_OLD}
              metalness={0.62}
              roughness={0.48}
            />
          </mesh>
        )),
      )}
    </group>
  </>
);
