import { INSTRUMENT_TRAY } from "./types";
import { useRef } from "react";
import type { FC } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, PointLight } from "three";
import type { GameState } from "../game/model";
import { COLORS } from "./palette";
import { VictorianDetails } from "./VictorianDetails";

interface RoomProps {
  environment?: GameState["environment"];
  reducedMotion?: boolean;
  paused?: boolean;
}

// Victorian mortuary architecture with gothic masonry, a timber cabinet, Mayo tray,
// static anatomical dressing, animated environmental fire, and responsive cellar door.
export const Room: FC<RoomProps> = ({
  environment,
  reducedMotion = false,
  paused = false,
}) => {
  const doorRef = useRef<Group>(null!);
  const fireLightRef = useRef<PointLight>(null!);
  const flameGroupRef = useRef<Group>(null!);

  const fire = environment?.fire ?? 0;
  const doorState = environment?.door ?? "quiet";

  useFrame(({ clock }) => {
    if (paused) return;
    const t = clock.getElapsedTime();

    // Animate door knocking shudder
    if (doorRef.current) {
      if (doorState === "knocking" && !reducedMotion) {
        // Rhythmic violent thumping bursts
        const thump = Math.sin(t * 16);
        const impulse = thump > 0.7 ? (thump - 0.7) * 0.08 : 0;
        doorRef.current.position.z = -0.07 - impulse;
        doorRef.current.rotation.y = impulse * 0.5;
      } else {
        doorRef.current.position.z = -0.07;
        doorRef.current.rotation.y = 0;
      }
    }

    // Animate fire flicker and light
    if (fire > 0 && flameGroupRef.current && fireLightRef.current) {
      if (!reducedMotion) {
        const flicker = 0.8 + Math.sin(t * 22) * 0.15 + Math.cos(t * 35) * 0.08;
        flameGroupRef.current.scale.y = flicker * (0.5 + fire / 100);
        flameGroupRef.current.scale.x = 1.0 + Math.sin(t * 18) * 0.1;
        fireLightRef.current.intensity =
          (0.8 + Math.sin(t * 20) * 0.3) * (0.5 + fire / 70);
      }
    }
  });

  return (
    <group name="cellar-room">
      {/* ── Floor with Drainage ── */}
      <mesh
        position={[0, -0.9, 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[7, 7]} />
        <meshStandardMaterial
          color={COLORS.cellarStone}
          roughness={0.88}
          metalness={0.12}
        />
      </mesh>

      {/* Floor blood drain grill */}
      <group position={[0, -0.895, 0.35]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color={COLORS.tileGrout} roughness={0.95} />
        </mesh>
        {[-0.2, -0.1, 0, 0.1, 0.2].map((x, i) => (
          <mesh key={i} position={[x, 0.005, 0]} receiveShadow>
            <boxGeometry args={[0.035, 0.016, 0.46]} />
            <meshStandardMaterial
              color="#303133"
              metalness={0.48}
              roughness={0.62}
            />
          </mesh>
        ))}
        <mesh position={[0.08, 0.002, 0.04]} rotation={[-Math.PI / 2, 0, 0.3]}>
          <circleGeometry args={[0.38, 16]} />
          <meshStandardMaterial
            color={COLORS.bloodDried}
            roughness={0.95}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ── Back Wall with Gothic Tiles ── */}
      <mesh position={[0, 0.6, 2.6]} receiveShadow>
        <boxGeometry args={[6.5, 3.2, 0.2]} />
        <meshStandardMaterial
          color={COLORS.tiledWall}
          roughness={0.78}
          metalness={0.15}
        />
      </mesh>
      {[-1.8, -0.9, 0, 0.9, 1.8].map((x, i) => (
        <mesh key={i} position={[x, 0.6, 2.49]} receiveShadow>
          <boxGeometry args={[0.08, 3.2, 0.04]} />
          <meshStandardMaterial color={COLORS.tileGrout} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 2.49]} receiveShadow>
        <boxGeometry args={[6.5, 0.06, 0.04]} />
        <meshStandardMaterial color={COLORS.tileGrout} roughness={0.9} />
      </mesh>

      {/* ── Gothic Cellar Door (Knocking & Barricaded States) ── */}
      <group position={[1.45, 0.45, 2.45]}>
        {/* Door stone arch frame */}
        <mesh position={[0, 0, 0.04]} receiveShadow>
          <boxGeometry args={[0.96, 1.9, 0.1]} />
          <meshStandardMaterial color={COLORS.cellarStone} roughness={0.88} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.82, 1.76, 0.08]} />
          <meshStandardMaterial color={COLORS.cellarMortar} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.84, 0.08]} castShadow>
          <torusGeometry args={[0.42, 0.08, 8, 18, Math.PI]} />
          <meshStandardMaterial color={COLORS.cellarStone} roughness={0.88} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.03, 0.08]} castShadow>
            <boxGeometry args={[0.1, 1.86, 0.12]} />
            <meshStandardMaterial color={COLORS.cellarStone} roughness={0.88} />
          </mesh>
        ))}

        {/* Moving door panel */}
        <group ref={doorRef} position={[0, 0, 0]}>
          {/* Heavy timber plank door */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.78, 1.72, 0.04]} />
            <meshStandardMaterial
              color={COLORS.apronLeather}
              roughness={0.85}
            />
          </mesh>
          {/* Iron decorative strap bands */}
          {[-0.6, 0.0, 0.6].map((y, i) => (
            <mesh key={i} position={[0, y, 0.023]} castShadow>
              <boxGeometry args={[0.74, 0.07, 0.025]} />
              <meshStandardMaterial
                color="#303133"
                metalness={0.55}
                roughness={0.58}
              />
            </mesh>
          ))}
          {/* Heavy iron door ring handle */}
          <mesh position={[-0.24, 0.0, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.014, 6, 12]} />
            <meshStandardMaterial
              color="#303133"
              metalness={0.55}
              roughness={0.58}
            />
          </mesh>
        </group>

        {/* Barricaded state: heavy reinforced wooden cross-beams bolted over door */}
        {doorState === "barricaded" && (
          <group position={[0, 0, 0.07]}>
            {/* Horizontal locking beam */}
            <mesh position={[0, 0.1, 0]} castShadow>
              <boxGeometry args={[1.05, 0.12, 0.06]} />
              <meshStandardMaterial color="#3a2f26" roughness={0.9} />
            </mesh>
            {/* Diagonal brace timber */}
            <mesh position={[0, -0.1, 0]} rotation={[0, 0, 0.45]} castShadow>
              <boxGeometry args={[1.1, 0.1, 0.05]} />
              <meshStandardMaterial color="#2d251e" roughness={0.9} />
            </mesh>
            {/* Iron wall mounting brackets */}
            {[-0.45, 0.45].map((x, i) => (
              <mesh key={i} position={[x, 0.1, 0.03]} castShadow>
                <boxGeometry args={[0.08, 0.16, 0.03]} />
                <meshStandardMaterial
                  color={COLORS.tableMetal}
                  metalness={0.85}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* ── Left Wall with Alcove ── */}
      <mesh
        position={[-2.2, 0.6, 0.4]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[5.2, 3.2, 0.2]} />
        <meshStandardMaterial color={COLORS.cellarStone} roughness={0.85} />
      </mesh>

      {/* ── Right Wall with Conduit Pipes ── */}
      <mesh
        position={[2.2, 0.6, 0.4]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[5.2, 3.2, 0.2]} />
        <meshStandardMaterial color={COLORS.cellarStone} roughness={0.85} />
      </mesh>
      <mesh position={[2.08, 0.6, 0.1]} receiveShadow>
        <cylinderGeometry args={[0.045, 0.045, 3.2, 12]} />
        <meshStandardMaterial
          color="#252628"
          metalness={0.48}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[2.08, 0.6, 0.25]} receiveShadow>
        <cylinderGeometry args={[0.028, 0.028, 3.2, 12]} />
        <meshStandardMaterial
          color="#5a482f"
          metalness={0.5}
          roughness={0.58}
        />
      </mesh>
      {[0.1, 0.95, 1.8].map((z) => (
        <mesh key={z} position={[2.03, 0.6, z]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.06]} />
          <meshStandardMaterial color="#252628" roughness={0.72} />
        </mesh>
      ))}

      {/* ── Victorian Mortuary Dressing ── */}
      <VictorianDetails />

      {/* ── Vaulted Gothic Ceiling Ribs ── */}
      {[-0.6, 0.6, 1.8].map((z, i) => (
        <mesh
          key={i}
          position={[0, 2.05, z]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[2.1, 0.07, 10, 24, Math.PI]} />
          <meshStandardMaterial color={COLORS.cellarStone} roughness={0.82} />
        </mesh>
      ))}

      {/* Uneven stone joints and fallen plaster frame the body on the floor. */}
      {[-1.2, -0.6, 0, 0.6, 1.2, 1.8].map((z) => (
        <mesh key={z} position={[0, -0.897, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.8, 0.009]} />
          <meshStandardMaterial color="#090b09" />
        </mesh>
      ))}
      {[-1.6, -0.8, 0.8, 1.6].map((x) => (
        <mesh
          key={x}
          position={[x, -0.897, 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.009, 3.6]} />
          <meshStandardMaterial color="#090b09" />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <mesh
          key={i}
          position={[
            0.58 + Math.sin(i * 7) * 0.3,
            -0.875,
            0.4 + Math.cos(i * 4) * 0.6,
          ]}
          rotation={[i * 0.3, i * 0.7, 0]}
          scale={[0.08 + 0.008 * i, 0.018, 0.07]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#59574a" roughness={1} />
        </mesh>
      ))}

      {/* ── Medicine / Tool Cabinet (Left) ── */}
      <group position={[-1.25, 0.05, -0.1]} rotation={[0, 0.25, 0]}>
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

      {/* ── Environmental Fire and Smoke (Near Cabinet) ── */}
      {fire > 0 && (
        <group position={[-1.25, -0.85, 0.45]}>
          {/* Scorched floor mark */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <circleGeometry args={[0.3, 16]} />
            <meshStandardMaterial color="#080809" roughness={0.98} />
          </mesh>

          {/* Animated fire tongues */}
          <group ref={flameGroupRef}>
            <mesh position={[0, 0.06, 0]}>
              <coneGeometry args={[0.07, 0.2, 8]} />
              <meshStandardMaterial
                color="#ff8811"
                emissive="#ff5500"
                emissiveIntensity={2.5}
                roughness={0.1}
              />
            </mesh>
            <mesh position={[0.04, 0.05, 0.03]} rotation={[0, 0, -0.2]}>
              <coneGeometry args={[0.05, 0.16, 7]} />
              <meshStandardMaterial
                color="#ffaa22"
                emissive="#ff6611"
                emissiveIntensity={2.2}
                roughness={0.1}
              />
            </mesh>
            <mesh position={[-0.03, 0.04, -0.02]} rotation={[0, 0, 0.25]}>
              <coneGeometry args={[0.04, 0.14, 6]} />
              <meshStandardMaterial
                color="#ff4400"
                emissive="#ff2200"
                emissiveIntensity={2.8}
                roughness={0.1}
              />
            </mesh>
          </group>

          {/* Rising dark smoke puffs */}
          <group position={[0, 0.28, 0]}>
            <mesh position={[0.02, 0, 0.01]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial
                color="#1a1816"
                roughness={0.9}
                transparent
                opacity={0.6}
              />
            </mesh>
            <mesh position={[-0.03, 0.08, 0]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial
                color="#22201e"
                roughness={0.9}
                transparent
                opacity={0.4}
              />
            </mesh>
            <mesh position={[0.01, 0.18, -0.02]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial
                color="#2d2b28"
                roughness={0.9}
                transparent
                opacity={0.25}
              />
            </mesh>
          </group>

          {/* Dynamic flame point light */}
          <pointLight
            ref={fireLightRef}
            color="#ff6611"
            intensity={1.2}
            distance={3.2}
            decay={2}
          />
        </group>
      )}

      <InstrumentStand />
    </group>
  );
};

export function InstrumentStand() {
  return (
    <group
      position={[
        INSTRUMENT_TRAY[0],
        INSTRUMENT_TRAY[1] - 0.03,
        INSTRUMENT_TRAY[2],
      ]}
    >
      <mesh position={[0, -0.27, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.28, 0.06, 12]} />
        <meshStandardMaterial
          color="#292b2b"
          metalness={0.52}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[0, -0.14, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.25, 12]} />
        <meshStandardMaterial
          color="#4d4b44"
          metalness={0.58}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[0, -0.15, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
        <meshStandardMaterial
          color={COLORS.toolBrass}
          metalness={0.52}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[0.11, -0.08, 0.15]} rotation={[0, 0.63, 0]} castShadow>
        <boxGeometry args={[0.07, 0.06, 0.43]} />
        <meshStandardMaterial color="#4d4b44" metalness={0.5} roughness={0.6} />
      </mesh>
      <group position={[0, 0, 0]}>
        {/* A shallow basin and thick rim make the tray readable at a distance. */}
        <mesh position={[-0.02, 0.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.035, 0.64]} />
          <meshStandardMaterial
            color="#66645b"
            metalness={0.5}
            roughness={0.56}
          />
        </mesh>
        <mesh position={[-0.02, 0.026, 0]}>
          <boxGeometry args={[0.32, 0.018, 0.54]} />
          <meshStandardMaterial
            color="#282a2a"
            metalness={0.28}
            roughness={0.78}
          />
        </mesh>
        {[
          [0.17, 0, 0.0, 0.04, 0.66],
          [-0.21, 0, 0.0, 0.04, 0.66],
          [-0.02, 0, 0.29, 0.36, 0.04],
          [-0.02, 0, -0.29, 0.36, 0.04],
        ].map(([x, y, z, sx, sz], i) => (
          <mesh key={i} position={[x, y + 0.045, z]} castShadow>
            <boxGeometry args={[sx, 0.055, sz]} />
            <meshStandardMaterial
              color="#4d4b44"
              metalness={0.52}
              roughness={0.54}
            />
          </mesh>
        ))}
        <mesh position={[-0.02, 0.09, 0]} castShadow>
          <boxGeometry args={[0.09, 0.035, 0.18]} />
          <meshStandardMaterial
            color={COLORS.toolBrass}
            metalness={0.48}
            roughness={0.58}
          />
        </mesh>
      </group>
    </group>
  );
}
