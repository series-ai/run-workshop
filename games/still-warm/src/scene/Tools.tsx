import type { LiveHandSocket } from "./types";
import { useRef, useMemo } from "react";
import type { FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3, Quaternion, MathUtils, CatmullRomCurve3 } from "three";
import type { PointLight } from "three";
import type { GameState } from "../game/model";
import { getItemSlot, getItemOffset } from "./types";
import { COLORS } from "./palette";

interface ToolsProps {
  socket: LiveHandSocket;
  state: GameState;
  onInspectItem?: (itemId: string) => void;
  reducedMotion?: boolean;
}

// ── 3D Tool Primitives ──

const IRON = "#4b4d4b";
const IRON_HIGHLIGHT = "#797a72";
const BRASS = "#806744";
const BRASS_DARK = "#4b3927";
const WOOD = "#30251f";
const WOOD_LIGHT = "#5b4431";
const CLOTH = "#878478";
const CLOTH_DARK = "#5c5a52";
const GLASS = "#70532b";
const HAIR = "#211c19";

const IronMaterial: FC = () => (
  <meshStandardMaterial color={IRON} metalness={0.62} roughness={0.48} />
);

const BrassMaterial: FC = () => (
  <meshStandardMaterial color={BRASS} metalness={0.58} roughness={0.42} />
);

const ForcepsModel: FC = () => (
  <group rotation={[0, 0.4, 0]}>
    <mesh position={[-0.011, 0.005, 0.005]} rotation={[0, 0, 0.1]} castShadow>
      <boxGeometry args={[0.009, 0.006, 0.14]} />
      <IronMaterial />
    </mesh>
    <mesh position={[0.011, 0.005, 0.005]} rotation={[0, 0, -0.1]} castShadow>
      <boxGeometry args={[0.009, 0.006, 0.14]} />
      <IronMaterial />
    </mesh>
    <mesh
      position={[-0.006, 0.005, -0.076]}
      rotation={[0, -0.08, 0]}
      castShadow
    >
      <boxGeometry args={[0.006, 0.004, 0.05]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.7}
        roughness={0.34}
      />
    </mesh>
    <mesh position={[0.006, 0.005, -0.076]} rotation={[0, 0.08, 0]} castShadow>
      <boxGeometry args={[0.006, 0.004, 0.05]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.7}
        roughness={0.34}
      />
    </mesh>
    <mesh position={[0, 0.008, -0.01]} castShadow>
      <cylinderGeometry args={[0.007, 0.007, 0.008, 8]} />
      <BrassMaterial />
    </mesh>
    {[-0.021, 0.021].map((x) => (
      <mesh
        key={x}
        position={[x, 0.005, 0.072]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[0.013, 0.003, 6, 12]} />
        <IronMaterial />
      </mesh>
    ))}
  </group>
);

const ScalpelModel: FC = () => (
  <group rotation={[0, -0.2, 0]}>
    <mesh
      position={[0, 0.006, 0.022]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
    >
      <cylinderGeometry args={[0.009, 0.011, 0.078, 8]} />
      <meshStandardMaterial color={WOOD} roughness={0.82} />
    </mesh>
    <mesh
      position={[0, 0.006, -0.02]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
    >
      <cylinderGeometry args={[0.012, 0.009, 0.012, 8]} />
      <BrassMaterial />
    </mesh>
    <mesh position={[0, 0.007, -0.063]} rotation={[0, -0.18, 0]} castShadow>
      <boxGeometry args={[0.012, 0.0035, 0.062]} />
      <meshStandardMaterial color="#c6c5b8" metalness={0.35} roughness={0.4} />
    </mesh>
    <mesh
      position={[0, 0.007, -0.098]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
    >
      <coneGeometry args={[0.006, 0.022, 4]} />
      <meshStandardMaterial color="#d0cfbf" metalness={0.35} roughness={0.4} />
    </mesh>
  </group>
);

const SUTURE_TAIL = new CatmullRomCurve3([
  new Vector3(0.027, 0, 0),
  new Vector3(0.045, 0.007, 0),
  new Vector3(0.067, -0.006, 0),
  new Vector3(0.058, -0.034, 0),
  new Vector3(0.021, -0.045, 0),
  new Vector3(0.006, -0.066, 0),
]);

const NeedleModel: FC<{ threaded?: boolean }> = ({ threaded = false }) => (
  <group rotation={[Math.PI / 2, 0, 0.5]}>
    <mesh castShadow>
      <torusGeometry args={[0.027, 0.0025, 6, 24, Math.PI * 1.15]} />
      <meshStandardMaterial color="#aaa99d" metalness={0.4} roughness={0.4} />
    </mesh>
    <mesh
      position={[-0.02134, -0.0176, 0]}
      rotation={[0, 0, -2.67035]}
      castShadow
    >
      <coneGeometry args={[0.0025, 0.012, 6]} />
      <meshStandardMaterial color="#c6c5b8" metalness={0.4} roughness={0.4} />
    </mesh>
    <mesh position={[0.027, 0, 0]} scale={[0.7, 1, 1]}>
      <torusGeometry args={[0.0038, 0.0013, 5, 8]} />
      <meshStandardMaterial color="#aaa99d" metalness={0.4} roughness={0.4} />
    </mesh>
    {threaded && (
      <mesh name="thread-through-needle-eye" castShadow>
        <tubeGeometry args={[SUTURE_TAIL, 28, 0.0016, 5, false]} />
        <meshStandardMaterial color={HAIR} roughness={0.92} />
      </mesh>
    )}
  </group>
);

const FabricStains: FC<{ y: number; scale?: number }> = ({ y, scale = 1 }) => (
  <group position={[0, y, 0]} scale={scale}>
    {[
      [0.012, 0.006, 0.022],
      [-0.017, -0.019, 0.016],
      [0.025, -0.024, 0.009],
    ].map(([x, z, size], index) => (
      <mesh
        key={index}
        position={[x, index * 0.0002, z]}
        rotation={[-Math.PI / 2, 0, index * 0.7]}
        scale={[1, 0.7, 1]}
      >
        <circleGeometry args={[size, 7]} />
        <meshStandardMaterial
          color={index === 1 ? "#26251e" : COLORS.bloodDried}
          roughness={1}
        />
      </mesh>
    ))}
  </group>
);

const ClothModel: FC<{ clean: boolean }> = ({ clean }) => (
  <group>
    <mesh
      position={[0, 0.013, 0]}
      rotation={[0.04, 0, -0.03]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.095, 0.025, 0.115]} />
      <meshStandardMaterial color={CLOTH_DARK} roughness={0.96} />
    </mesh>
    <mesh
      position={[0.002, 0.027, 0.004]}
      rotation={[-0.03, 0, 0.02]}
      castShadow
    >
      <boxGeometry args={[0.086, 0.018, 0.094]} />
      <meshStandardMaterial color={CLOTH} roughness={0.94} />
    </mesh>
    {[-0.027, 0.005, 0.036].map((x) => (
      <mesh key={x} position={[x, 0.037, 0.004]}>
        <boxGeometry args={[0.0025, 0.003, 0.085]} />
        <meshStandardMaterial color={COLORS.bonePale} roughness={0.9} />
      </mesh>
    ))}
    {!clean && <FabricStains y={0.04} />}
  </group>
);

const MorphineModel: FC = () => (
  <group>
    <mesh position={[0, 0.032, 0]} castShadow>
      <cylinderGeometry args={[0.021, 0.018, 0.06, 10]} />
      <meshStandardMaterial color={GLASS} metalness={0.18} roughness={0.28} />
    </mesh>
    <mesh position={[0, 0.067, 0]} castShadow>
      <coneGeometry args={[0.014, 0.016, 10]} />
      <meshStandardMaterial color={GLASS} metalness={0.18} roughness={0.28} />
    </mesh>
    <mesh position={[0, 0.08, 0]} castShadow>
      <cylinderGeometry args={[0.01, 0.01, 0.012, 10]} />
      <meshStandardMaterial
        color={BRASS_DARK}
        metalness={0.5}
        roughness={0.48}
      />
    </mesh>
    <mesh position={[0, 0.033, 0.021]}>
      <boxGeometry args={[0.027, 0.034, 0.002]} />
      <meshStandardMaterial color={COLORS.bonePale} roughness={0.92} />
    </mesh>
    <mesh position={[0, 0.033, 0.0225]}>
      <boxGeometry args={[0.016, 0.003, 0.001]} />
      <meshStandardMaterial color={BRASS_DARK} roughness={0.65} />
    </mesh>
  </group>
);

const MirrorModel: FC = () => (
  <group rotation={[0, 0.3, 0]}>
    <mesh
      position={[0, 0.004, 0.028]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
    >
      <cylinderGeometry args={[0.008, 0.01, 0.11, 8]} />
      <meshStandardMaterial color={WOOD_LIGHT} roughness={0.78} />
    </mesh>
    <mesh position={[0, 0.004, -0.038]} castShadow>
      <cylinderGeometry args={[0.023, 0.023, 0.006, 12]} />
      <BrassMaterial />
    </mesh>
    <mesh position={[0, 0.008, -0.038]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.018, 12]} />
      <meshStandardMaterial color="#697078" metalness={0.55} roughness={0.28} />
    </mesh>
    <mesh position={[0, 0.009, -0.038]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.012, 12]} />
      <meshStandardMaterial color="#a6a99e" metalness={0.38} roughness={0.34} />
    </mesh>
  </group>
);

const ShardModel: FC = () => (
  <group rotation={[0.3, 0.4, 0.1]}>
    <mesh castShadow>
      <coneGeometry args={[0.022, 0.072, 5]} />
      <meshStandardMaterial color="#454845" metalness={0.68} roughness={0.42} />
    </mesh>
    <mesh position={[0.006, -0.012, 0.006]} rotation={[0, 0, 0.5]} castShadow>
      <boxGeometry args={[0.012, 0.008, 0.035]} />
      <meshStandardMaterial color="#252a27" metalness={0.7} roughness={0.46} />
    </mesh>
    <mesh position={[0.006, 0.006, 0.019]}>
      <boxGeometry args={[0.014, 0.002, 0.018]} />
      <meshStandardMaterial color={COLORS.bloodDried} roughness={0.8} />
    </mesh>
  </group>
);

const ReleaseModel: FC = () => (
  <group rotation={[0, -0.5, 0]}>
    <mesh position={[0, 0.006, 0]} rotation={[0, 0.02, 0]} castShadow>
      <boxGeometry args={[0.016, 0.01, 0.145]} />
      <IronMaterial />
    </mesh>
    <mesh
      position={[0, 0.009, 0.057]}
      rotation={[0, 0, Math.PI / 2]}
      castShadow
    >
      <cylinderGeometry args={[0.009, 0.009, 0.075, 8]} />
      <meshStandardMaterial color={WOOD_LIGHT} roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.006, -0.077]} castShadow>
      <boxGeometry args={[0.028, 0.014, 0.022]} />
      <BrassMaterial />
    </mesh>
    <mesh position={[0, 0.006, -0.09]} rotation={[0.2, 0, 0]} castShadow>
      <coneGeometry args={[0.009, 0.028, 5]} />
      <IronMaterial />
    </mesh>
  </group>
);

const ScissorsModel: FC = () => (
  <group rotation={[0, 0.2, 0]}>
    <mesh position={[-0.014, 0.005, 0.0]} rotation={[0, 0, 0.14]} castShadow>
      <boxGeometry args={[0.009, 0.005, 0.13]} />
      <IronMaterial />
    </mesh>
    <mesh position={[0.014, 0.005, 0.0]} rotation={[0, 0, -0.14]} castShadow>
      <boxGeometry args={[0.009, 0.005, 0.13]} />
      <IronMaterial />
    </mesh>
    <mesh position={[-0.014, 0.005, -0.062]} rotation={[0, 0, 0.14]}>
      <boxGeometry args={[0.005, 0.003, 0.058]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.7}
        roughness={0.34}
      />
    </mesh>
    <mesh position={[0.014, 0.005, -0.062]} rotation={[0, 0, -0.14]}>
      <boxGeometry args={[0.005, 0.003, 0.058]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.7}
        roughness={0.34}
      />
    </mesh>
    <mesh position={[0, 0.008, -0.008]} castShadow>
      <cylinderGeometry args={[0.007, 0.007, 0.009, 8]} />
      <BrassMaterial />
    </mesh>
    {[-0.025, 0.025].map((x) => (
      <mesh
        key={x}
        position={[x, 0.005, 0.074]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[0.014, 0.0035, 6, 12]} />
        <meshStandardMaterial
          color={BRASS_DARK}
          metalness={0.45}
          roughness={0.56}
        />
      </mesh>
    ))}
  </group>
);

const HAIR_LOCKS = Array.from({ length: 9 }, (_, index) => {
  const x = (index - 4) * 0.008;
  return new CatmullRomCurve3([
    new Vector3(x, 0.012, -0.04),
    new Vector3(x * 0.85, 0.044 - Math.abs(x) * 0.3, -0.017),
    new Vector3(x * 1.1, 0.034, 0.018),
    new Vector3(x + Math.sin(index * 1.7) * 0.009, 0.009, 0.05),
    new Vector3(x + Math.cos(index) * 0.012, 0.007, 0.065),
  ]);
});

const WigModel: FC = () => (
  <group>
    <mesh position={[0, 0.019, 0]} scale={[1, 0.48, 1.2]} castShadow>
      <sphereGeometry args={[0.041, 10, 6]} />
      <meshStandardMaterial color={HAIR} roughness={0.97} />
    </mesh>
    {HAIR_LOCKS.map((curve, index) => (
      <mesh key={index} castShadow>
        <tubeGeometry args={[curve, 18, 0.0034, 5, false]} />
        <meshStandardMaterial
          color={index % 3 === 0 ? "#696250" : "#383229"}
          roughness={0.95}
        />
      </mesh>
    ))}
  </group>
);

const BladeModel: FC = () => (
  <group rotation={[0, 0.35, 0]}>
    <mesh position={[0, 0.005, -0.016]} rotation={[0, 0.12, 0]} castShadow>
      <boxGeometry args={[0.009, 0.004, 0.092]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.7}
        roughness={0.35}
      />
    </mesh>
    <mesh
      position={[0, 0.005, -0.068]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
    >
      <coneGeometry args={[0.008, 0.03, 4]} />
      <meshStandardMaterial color="#a6a79d" metalness={0.72} roughness={0.32} />
    </mesh>
    <mesh position={[0, 0.005, 0.041]} castShadow>
      <boxGeometry args={[0.018, 0.009, 0.024]} />
      <meshStandardMaterial color={WOOD} roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.01, 0.03]}>
      <cylinderGeometry args={[0.009, 0.009, 0.006, 8]} />
      <BrassMaterial />
    </mesh>
  </group>
);

const LOOSE_THREAD = new CatmullRomCurve3([
  new Vector3(0.024, 0.006, 0),
  new Vector3(0.033, 0.006, 0.027),
  new Vector3(0.06, 0.006, 0.032),
  new Vector3(0.074, 0.006, 0.014),
]);

const ThreadModel: FC = () => (
  <group>
    {[0, 1, 2].map((index) => (
      <mesh
        key={index}
        position={[index * 0.003, 0.004 + index * 0.002, 0]}
        rotation={[Math.PI / 2, 0, index * 0.3]}
        scale={[1, 0.8, 1]}
        castShadow
      >
        <torusGeometry args={[0.024, 0.0018, 5, 20]} />
        <meshStandardMaterial color={HAIR} roughness={0.92} />
      </mesh>
    ))}
    <mesh castShadow>
      <tubeGeometry args={[LOOSE_THREAD, 18, 0.0016, 5, false]} />
      <meshStandardMaterial color={HAIR} roughness={0.92} />
    </mesh>
  </group>
);

const BandageModel: FC<{ clean: boolean }> = ({ clean }) => (
  <group>
    <mesh position={[0, 0.021, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.026, 0.026, 0.062, 12]} />
      <meshStandardMaterial color={CLOTH_DARK} roughness={0.95} />
    </mesh>
    <mesh position={[0.031, 0.021, 0.002]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[0.026, 0.002, 6, 12]} />
      <meshStandardMaterial color={CLOTH} roughness={0.9} />
    </mesh>
    <mesh position={[0.022, 0.006, 0.021]} rotation={[0, -0.2, 0]} castShadow>
      <boxGeometry args={[0.046, 0.004, 0.054]} />
      <meshStandardMaterial color={CLOTH} roughness={0.94} />
    </mesh>
    {!clean && (
      <group position={[0.022, 0, 0.021]}>
        <FabricStains y={0.0085} scale={0.65} />
      </group>
    )}
  </group>
);

const BowlModel: FC<{ waterLevel: number }> = ({ waterLevel }) => (
  <group>
    <mesh position={[0, 0.025, 0]} castShadow>
      <cylinderGeometry args={[0.066, 0.045, 0.045, 14, 1, true]} />
      <meshStandardMaterial
        color={BRASS_DARK}
        metalness={0.56}
        roughness={0.48}
        side={2}
      />
    </mesh>
    <mesh position={[0, 0.005, 0]}>
      <cylinderGeometry args={[0.045, 0.045, 0.006, 14]} />
      <meshStandardMaterial color={IRON} metalness={0.58} roughness={0.48} />
    </mesh>
    {waterLevel > 0 && (
      <mesh name="bowl-water" position={[0, 0.013 + waterLevel * 0.03, 0]}>
        <cylinderGeometry
          args={[
            0.046 + waterLevel * 0.013,
            0.046 + waterLevel * 0.013,
            0.004,
            14,
          ]}
        />
        <meshStandardMaterial
          color="#323a38"
          metalness={0.18}
          roughness={0.26}
        />
      </mesh>
    )}
    <mesh position={[0, 0.047, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.061, 0.003, 6, 14]} />
      <BrassMaterial />
    </mesh>
  </group>
);

const BlanketModel: FC<{ clean: boolean }> = ({ clean }) => (
  <group>
    <mesh
      position={[0, 0.029, 0]}
      rotation={[0.02, 0.04, -0.02]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.16, 0.056, 0.22]} />
      <meshStandardMaterial color="#4b5047" roughness={0.98} />
    </mesh>
    <mesh position={[0.012, 0.06, 0.005]} rotation={[0, 0.04, 0]} castShadow>
      <boxGeometry args={[0.14, 0.018, 0.19]} />
      <meshStandardMaterial color={CLOTH_DARK} roughness={0.98} />
    </mesh>
    <mesh position={[0, 0.071, 0.002]}>
      <boxGeometry args={[0.13, 0.002, 0.17]} />
      <meshStandardMaterial color="#747362" roughness={0.96} />
    </mesh>
    {!clean && <FabricStains y={0.073} scale={1.6} />}
  </group>
);

const CandleModel: FC<{
  lit: boolean;
  paused: boolean;
  reducedMotion: boolean;
}> = ({ lit, paused, reducedMotion }) => {
  const flameRef = useRef<Group>(null!);
  const lightRef = useRef<PointLight>(null!);
  const time = useRef(0);
  useFrame((_, dt) => {
    if (!lit || paused) return;
    if (reducedMotion) {
      flameRef.current.scale.y = 0.9;
      lightRef.current.intensity = 1.05;
      return;
    }
    time.current += dt;
    const flicker = Math.sin(time.current * 12);
    flameRef.current.scale.y = 0.85 + flicker * 0.15;
    lightRef.current.intensity = 1.05 + flicker * 0.1;
  });

  return (
    <group>
      <mesh position={[0, 0.007, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.021, 0.012, 10]} />
        <meshStandardMaterial
          color={BRASS_DARK}
          metalness={0.48}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 0.047, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.019, 0.078, 10]} />
        <meshStandardMaterial color={COLORS.bonePale} roughness={0.88} />
      </mesh>
      <mesh position={[0.014, 0.052, 0.002]} castShadow>
        <coneGeometry args={[0.004, 0.018, 6]} />
        <meshStandardMaterial color={COLORS.boneShadow} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.091, 0]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.01, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <group ref={flameRef} position={[0, 0.102, 0]} visible={lit}>
        <mesh>
          <coneGeometry args={[0.006, 0.018, 8]} />
          <meshStandardMaterial
            color="#ffaa33"
            emissive="#ff8811"
            emissiveIntensity={2.5}
            roughness={0.1}
          />
        </mesh>
        <pointLight
          ref={lightRef}
          color="#ff9922"
          intensity={1.05}
          distance={1.8}
          decay={2}
        />
      </group>
    </group>
  );
};

const GenericToolModel: FC = () => (
  <group>
    <mesh position={[0, 0.01, 0.012]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.009, 0.011, 0.082, 8]} />
      <meshStandardMaterial color={WOOD} roughness={0.84} />
    </mesh>
    <mesh
      position={[0, 0.01, -0.039]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
    >
      <cylinderGeometry args={[0.011, 0.009, 0.013, 8]} />
      <BrassMaterial />
    </mesh>
    <mesh position={[0, 0.01, -0.084]} castShadow>
      <boxGeometry args={[0.012, 0.004, 0.05]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.68}
        roughness={0.38}
      />
    </mesh>
  </group>
);

export const ItemModel: FC<{
  id: string;
  lit?: boolean;
  waterLevel?: number;
  clean?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
}> = ({
  id,
  lit = true,
  waterLevel = 1,
  clean = true,
  paused = false,
  reducedMotion = false,
}) => {
  switch (id) {
    case "forceps":
      return <ForcepsModel />;
    case "scalpel":
      return <ScalpelModel />;
    case "needle":
      return <NeedleModel />;
    case "cloth":
      return <ClothModel clean={clean} />;
    case "morphine":
      return <MorphineModel />;
    case "mirror":
      return <MirrorModel />;
    case "shard":
      return <ShardModel />;
    case "release":
      return <ReleaseModel />;
    case "scissors":
      return <ScissorsModel />;
    case "wig":
      return <WigModel />;
    case "blade":
      return <BladeModel />;
    case "thread":
      return <ThreadModel />;
    case "suture":
      return <NeedleModel threaded />;
    case "bandage":
      return <BandageModel clean={clean} />;
    case "bowl":
      return <BowlModel waterLevel={waterLevel} />;
    case "blanket":
      return <BlanketModel clean={clean} />;
    case "candle":
      return (
        <CandleModel lit={lit} paused={paused} reducedMotion={reducedMotion} />
      );
    default:
      return <GenericToolModel />;
  }
};

// ── Single Item Component ──

interface SingleItemProps {
  clean: boolean;
  lit: boolean;
  waterLevel: number;
  paused: boolean;
  socket: LiveHandSocket;
  id: string;
  location: string;
  isHeld: boolean;
  collectAtContact: boolean;
  releaseAtContact: boolean;
  onInspect?: () => void;
  reducedMotion?: boolean;
}

const SingleItem: FC<SingleItemProps> = ({
  clean,
  lit,
  waterLevel,
  socket,
  paused,
  id,
  location,
  isHeld,
  collectAtContact,
  releaseAtContact,
  onInspect,
  reducedMotion = false,
}) => {
  const groupRef = useRef<Group>(null!);
  const restingRotation = useMemo(() => new Quaternion(), []);

  const targetPos = useMemo(() => {
    const slot = getItemSlot(location);
    const offset = getItemOffset(id);
    return new Vector3(
      slot[0] + offset[0],
      slot[1] + offset[1],
      slot[2] + offset[2],
    );
  }, [id, location, isHeld]);

  useFrame((_, dt) => {
    if (!groupRef.current || paused) return;

    // When held by the character, bind dynamically to live hand socket in world space
    if (
      (isHeld && !(releaseAtContact && socket.actionContact)) ||
      (collectAtContact && socket.actionContact)
    ) {
      if (socket.isTracking) {
        groupRef.current.position.copy(socket.gripPosition);
        groupRef.current.quaternion.copy(socket.quaternion);
        // Point instrument working tip forward/down from palm toward wound
        groupRef.current.rotateX(-0.55);
        return;
      }
    }

    groupRef.current.quaternion.slerp(
      restingRotation,
      reducedMotion ? 1 : 1 - Math.exp(-dt * 8),
    );
    if (reducedMotion) {
      groupRef.current.position.copy(targetPos);
      return;
    }

    // Smooth resting damp toward location slot
    groupRef.current.position.x = MathUtils.damp(
      groupRef.current.position.x,
      targetPos.x,
      8,
      dt,
    );
    groupRef.current.position.y = MathUtils.damp(
      groupRef.current.position.y,
      targetPos.y,
      8,
      dt,
    );
    groupRef.current.position.z = MathUtils.damp(
      groupRef.current.position.z,
      targetPos.z,
      8,
      dt,
    );
  });

  return (
    <group
      ref={groupRef}
      position={[targetPos.x, targetPos.y, targetPos.z]}
      onClick={(e) => {
        e.stopPropagation();
        onInspect?.();
      }}
      name={`tool-${id}`}
    >
      <ItemModel
        id={id}
        lit={lit}
        waterLevel={waterLevel}
        clean={clean}
        paused={paused}
        reducedMotion={reducedMotion}
      />
    </group>
  );
};

// ── All Tools Container ──

export const Tools: FC<ToolsProps> = ({
  state,
  socket,
  onInspectItem,
  reducedMotion = false,
}) => {
  const items = useMemo(() => {
    return Object.entries(state.items ?? {});
  }, [state.items]);

  return (
    <group name="surgery-tools">
      {items.map(([id, itemState]) => {
        if (id === "lamp") return null;
        if (itemState.location === "consumed") return null;
        // The patient asset owns the attached dressing.
        if (
          state.stage === "dressed" &&
          itemState.location === "patient" &&
          (id === "cloth" || id === "bandage")
        )
          return null;
        if (
          id === "shard" &&
          itemState.location === "patient" &&
          state.stage === "exposed"
        ) {
          return null;
        }

        const isHeld = state.holding === id;
        const action = state.pending?.action;
        const collectAtContact =
          action?.kind === "pick_up" && action.item === id;
        const releaseAtContact = action?.kind === "place" && action.item === id;
        const currentLocation = releaseAtContact
          ? action.location
          : itemState.location;

        return (
          <SingleItem
            clean={itemState.clean}
            lit={id === "candle" && state.candleLit}
            waterLevel={state.waterPortions / 3}
            key={id}
            socket={socket}
            paused={state.paused}
            id={id}
            location={currentLocation}
            isHeld={isHeld}
            collectAtContact={collectAtContact}
            releaseAtContact={releaseAtContact}
            onInspect={() => onInspectItem?.(id)}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </group>
  );
};
