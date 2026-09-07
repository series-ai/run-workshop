import { useRef, useMemo, useEffect } from "react";
import type { FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D, Vector3, MathUtils } from "three";
import type { SpotLight, Group } from "three";
import { COLORS } from "./palette";

import { PATIENT_LAYOUT } from "./patientLayout";

const CAST_IRON = "#252124";
const BRASS_OLD = "#80613a";

interface LampProps {
  mode: "wound" | "face" | "away";
  lit: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

const TARGETS: Record<"wound" | "face" | "away", Vector3> = {
  wound: new Vector3(...PATIENT_LAYOUT.wound),
  face: new Vector3(...PATIENT_LAYOUT.eyes),
  away: new Vector3(-1.1, 0.4, -0.2),
};

export const Lamp: FC<LampProps> = ({
  mode,
  lit,
  reducedMotion = false,
  paused = false,
}) => {
  const cowlRef = useRef<Group>(null!);
  const lightRef = useRef<SpotLight>(null!);
  const currentTargetPos = useRef<Vector3>(
    new Vector3(...PATIENT_LAYOUT.wound),
  );

  // Ephemeral dummy target object for Three.js SpotLight
  const lightTargetObj = useMemo(() => {
    const obj = new Object3D();
    obj.position.copy(TARGETS.wound);
    return obj;
  }, []);

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.target = lightTargetObj;
    }
  }, [lightTargetObj]);

  useFrame((_, dt) => {
    if (paused || !cowlRef.current || !lightRef.current) return;
    const dest = TARGETS[mode] ?? TARGETS.wound;

    if (reducedMotion) {
      currentTargetPos.current.copy(dest);
      lightTargetObj.position.copy(dest);
      cowlRef.current.lookAt(dest);
      return;
    }

    // Smoothly track the light target
    currentTargetPos.current.x = MathUtils.damp(
      currentTargetPos.current.x,
      dest.x,
      5,
      dt,
    );
    currentTargetPos.current.y = MathUtils.damp(
      currentTargetPos.current.y,
      dest.y,
      5,
      dt,
    );
    currentTargetPos.current.z = MathUtils.damp(
      currentTargetPos.current.z,
      dest.z,
      5,
      dt,
    );

    lightTargetObj.position.copy(currentTargetPos.current);
    lightTargetObj.updateMatrixWorld();

    // Orient cowl head towards current target
    cowlRef.current.lookAt(currentTargetPos.current);
  });

  // Base mount position in world space
  const mountPos: [number, number, number] = [0.15, 1.45, 0.2];

  return (
    <group name="surgical-lamp">
      {/* Target object added to scene hierarchy */}
      <primitive object={lightTargetObj} />

      {/* Ceiling mounting flange & pivot */}
      <mesh position={[mountPos[0], 1.7, mountPos[2]]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
        <meshStandardMaterial
          color={CAST_IRON}
          metalness={0.62}
          roughness={0.62}
        />
      </mesh>

      {/* Articulated suspension arm */}
      <group position={mountPos}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.25, 12]} />
          <meshStandardMaterial
            color={CAST_IRON}
            metalness={0.68}
            roughness={0.58}
          />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.052, 12, 12]} />
          <meshStandardMaterial
            color={BRASS_OLD}
            metalness={0.8}
            roughness={0.42}
          />
        </mesh>
        <mesh position={[0, 0.03, 0]} castShadow>
          <torusGeometry args={[0.052, 0.014, 8, 14]} />
          <meshStandardMaterial
            color={BRASS_OLD}
            metalness={0.72}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Lamp Cowl Head & Attached Light Source */}
      <group ref={cowlRef} position={mountPos}>
        {/* Cowl bell reflector */}
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.095, 0.22, 20, 1, true]} />
          <meshStandardMaterial
            color={BRASS_OLD}
            metalness={0.7}
            roughness={0.48}
            side={2}
          />
        </mesh>

        {/* Outer cowl rim */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.22, 0.022, 8, 24]} />
          <meshStandardMaterial
            color={BRASS_OLD}
            metalness={0.66}
            roughness={0.46}
          />
        </mesh>

        {/* Gas-lamp chimney collar and cast-iron guard. */}
        <mesh position={[0, 0, 0.29]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.07, 12]} />
          <meshStandardMaterial
            color={CAST_IRON}
            metalness={0.62}
            roughness={0.6}
          />
        </mesh>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
          <mesh
            key={angle}
            position={[Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, 0.1]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.022, 0.2, 0.022]} />
            <meshStandardMaterial
              color={CAST_IRON}
              metalness={0.65}
              roughness={0.58}
            />
          </mesh>
        ))}

        {/* Inner incandescent bulb */}
        <mesh position={[0, 0, 0.06]}>
          <sphereGeometry args={[0.052, 12, 12]} />
          <meshStandardMaterial
            color={COLORS.lampBulb}
            emissive={COLORS.lampBulb}
            emissiveIntensity={lit ? 1.8 : 0}
            roughness={0.1}
          />
        </mesh>

        {/* Directional SpotLight attached to cowl head */}
        <spotLight
          ref={lightRef}
          position={[0, 0, 0.08]}
          color={COLORS.lampBulb}
          intensity={lit ? (mode === "face" ? 3.8 : 2.8) : 0}
          distance={5.5}
          angle={Math.PI / 4.2}
          penumbra={0.65}
          decay={1.2}
          castShadow
          shadow-bias={-0.001}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
      </group>
    </group>
  );
};
