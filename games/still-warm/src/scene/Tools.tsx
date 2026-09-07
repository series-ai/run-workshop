import type { LiveHandSocket } from "./types";
import { useRef, useMemo } from "react";
import type { FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3, Quaternion, MathUtils } from "three";
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
      <meshStandardMaterial color="#a4a59b" metalness={0.7} roughness={0.34} />
    </mesh>
    <mesh position={[0, 0.007, -0.098]} rotation={[0, -0.18, 0]} castShadow>
      <coneGeometry args={[0.006, 0.022, 4]} />
      <meshStandardMaterial color="#b2b3a9" metalness={0.72} roughness={0.3} />
    </mesh>
  </group>
);

const NeedleModel: FC = () => (
  <group rotation={[Math.PI / 2, 0, 0.5]}>
    <mesh castShadow>
      <torusGeometry args={[0.027, 0.0025, 8, 16, Math.PI * 1.15]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.72}
        roughness={0.35}
      />
    </mesh>
    <mesh position={[0.023, -0.021, 0]} rotation={[0, 0, -0.3]} castShadow>
      <coneGeometry args={[0.0025, 0.014, 5]} />
      <meshStandardMaterial color="#aaa99d" metalness={0.78} roughness={0.3} />
    </mesh>
    <mesh position={[0.023, -0.015, 0.002]} rotation={[0, 0, -0.3]}>
      <cylinderGeometry args={[0.001, 0.001, 0.078, 5]} />
      <meshStandardMaterial color={HAIR} roughness={0.86} />
    </mesh>
  </group>
);

const ClothModel: FC = () => (
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
    <mesh position={[0, 0.008, -0.038]}>
      <circleGeometry args={[0.018, 12]} />
      <meshStandardMaterial color="#697078" metalness={0.55} roughness={0.28} />
    </mesh>
    <mesh position={[0, 0.011, -0.038]} rotation={[0.1, 0, 0]}>
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

const WigModel: FC = () => (
  <group>
    <mesh position={[0, 0.025, 0]} castShadow>
      <sphereGeometry args={[0.046, 10, 7]} />
      <meshStandardMaterial color={HAIR} roughness={0.97} />
    </mesh>
    <mesh position={[0, 0.006, 0]}>
      <cylinderGeometry args={[0.037, 0.042, 0.012, 10]} />
      <meshStandardMaterial color={WOOD} roughness={0.9} />
    </mesh>
    {[-0.028, 0, 0.028].map((x, i) => (
      <mesh
        key={x}
        position={[x, 0.039, 0.012 * (i - 1)]}
        rotation={[0.2 * i, 0, 0]}
        castShadow
      >
        <torusGeometry args={[0.019, 0.009, 6, 10]} />
        <meshStandardMaterial
          color={i === 1 ? "#3a2f28" : HAIR}
          roughness={0.94}
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
    <mesh position={[0, 0.005, -0.068]} rotation={[0, 0.12, 0]} castShadow>
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

const ThreadModel: FC = () => (
  <group>
    <mesh position={[0, 0.022, 0]} castShadow>
      <cylinderGeometry args={[0.023, 0.023, 0.034, 12]} />
      <meshStandardMaterial color={WOOD_LIGHT} roughness={0.83} />
    </mesh>
    {[-0.012, 0.005, 0.022].map((y) => (
      <mesh key={y} position={[0, y + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.024, 0.0035, 6, 14]} />
        <meshStandardMaterial color={HAIR} roughness={0.92} />
      </mesh>
    ))}
    <mesh position={[0.014, 0.014, 0.014]} rotation={[0, 0, 0.5]}>
      <cylinderGeometry args={[0.001, 0.001, 0.07, 4]} />
      <meshStandardMaterial color={HAIR} roughness={0.92} />
    </mesh>
  </group>
);

const SutureModel: FC = () => (
  <group rotation={[Math.PI / 2, 0, 0.3]}>
    <mesh castShadow>
      <torusGeometry args={[0.027, 0.0025, 8, 16, Math.PI * 1.15]} />
      <meshStandardMaterial
        color={IRON_HIGHLIGHT}
        metalness={0.72}
        roughness={0.35}
      />
    </mesh>
    <mesh position={[0.025, -0.01, 0]} rotation={[0, 0, -0.4]}>
      <cylinderGeometry args={[0.0015, 0.0015, 0.1, 5]} />
      <meshStandardMaterial color={HAIR} roughness={0.9} />
    </mesh>
    <mesh position={[0.055, -0.045, 0]} rotation={[0, 0, -0.4]}>
      <cylinderGeometry args={[0.001, 0.001, 0.035, 4]} />
      <meshStandardMaterial color="#6e5844" roughness={0.88} />
    </mesh>
  </group>
);

const BandageModel: FC = () => (
  <group>
    <mesh position={[0, 0.021, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.026, 0.026, 0.062, 12]} />
      <meshStandardMaterial color={CLOTH_DARK} roughness={0.95} />
    </mesh>
    <mesh position={[0, 0.021, 0.002]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.026, 0.002, 6, 12]} />
      <meshStandardMaterial color={CLOTH} roughness={0.9} />
    </mesh>
    <mesh position={[0.022, 0.006, 0.021]} rotation={[0, -0.2, 0]} castShadow>
      <boxGeometry args={[0.046, 0.004, 0.054]} />
      <meshStandardMaterial color={CLOTH} roughness={0.94} />
    </mesh>
    <mesh position={[0.022, 0.009, 0.021]} rotation={[0, -0.2, 0]}>
      <boxGeometry args={[0.009, 0.001, 0.03]} />
      <meshStandardMaterial color={COLORS.bloodDried} roughness={0.86} />
    </mesh>
  </group>
);

const BowlModel: FC = () => (
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
    <mesh position={[0, 0.047, 0]}>
      <cylinderGeometry args={[0.059, 0.059, 0.004, 14]} />
      <meshStandardMaterial color="#323a38" metalness={0.18} roughness={0.26} />
    </mesh>
    <mesh position={[0, 0.047, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.061, 0.003, 6, 14]} />
      <BrassMaterial />
    </mesh>
  </group>
);

const BlanketModel: FC = () => (
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
  </group>
);

const CandleModel: FC<{ lit: boolean }> = ({ lit }) => {
  const flameRef = useRef<Group>(null!);
  useFrame(({ clock }) => {
    if (flameRef.current) {
      flameRef.current.scale.y =
        0.85 + Math.sin(clock.getElapsedTime() * 12) * 0.15;
    }
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
        <pointLight color="#ff9922" intensity={0.4} distance={1.2} decay={2} />
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

export const ItemModel: FC<{ id: string; lit?: boolean }> = ({
  id,
  lit = true,
}) => {
  switch (id) {
    case "forceps":
      return <ForcepsModel />;
    case "scalpel":
      return <ScalpelModel />;
    case "needle":
      return <NeedleModel />;
    case "cloth":
      return <ClothModel />;
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
      return <SutureModel />;
    case "bandage":
      return <BandageModel />;
    case "bowl":
      return <BowlModel />;
    case "blanket":
      return <BlanketModel />;
    case "candle":
      return <CandleModel lit={lit} />;
    default:
      return <GenericToolModel />;
  }
};

// ── Single Item Component ──

interface SingleItemProps {
  lit: boolean;
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
  lit,
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
      <ItemModel id={id} lit={lit} />
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
            lit={state.environment.lanternLit}
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
