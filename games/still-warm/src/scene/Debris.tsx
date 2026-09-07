import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import { createBeamTexture } from "./beamTexture";
import { PATIENT_LAYOUT } from "./patientLayout";
import type { LiveHandSocket } from "./types";
import type { GameState } from "../game/model";

export function Debris({
  state,
  socket,
}: {
  state: GameState;
  socket: LiveHandSocket;
}) {
  const beam = useRef<Group>(null!);
  const wood = useMemo(createBeamTexture, []);
  useEffect(() => () => wood.dispose(), [wood]);
  useFrame((_, dt) => {
    if (state.paused) return;
    const lifting = state.pending?.action.kind === "lift_debris";
    const lift =
      lifting && socket.actionContact
        ? MathUtils.clamp(
            socket.gripPosition.y - PATIENT_LAYOUT.beamGripY,
            0,
            0.85,
          )
        : 0;
    const cleared =
      state.stage !== "pinned" ||
      (lifting && (state.pending?.progress ?? 0) > 0.8);
    beam.current.position.x = MathUtils.damp(
      beam.current.position.x,
      cleared ? 1.2 : 0,
      4,
      dt,
    );
    beam.current.position.y = MathUtils.damp(
      beam.current.position.y,
      cleared ? -0.76 : PATIENT_LAYOUT.beam[1] + lift,
      7,
      dt,
    );
    beam.current.rotation.z = MathUtils.damp(
      beam.current.rotation.z,
      cleared ? -0.5 : 0.08 + lift * 0.12,
      5,
      dt,
    );
  });
  return (
    <group
      name="fallen-ceiling-support"
      ref={beam}
      position={[...PATIENT_LAYOUT.beam]}
      rotation={[0.07, 0.25, 0.08]}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.24, 0.28]} />
        <meshStandardMaterial map={wood} roughness={0.95} metalness={0} />
      </mesh>
      {[-0.62, -0.25, 0.25, 0.62].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.055, 0.24, 0.29]} />
            <meshStandardMaterial
              color="#171821"
              metalness={0.65}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.025, 6]} />
            <meshStandardMaterial color="#73777a" metalness={0.5} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[-0.79 - i * 0.025, 0.035 * Math.sin(i), 0.025 * i]}
          rotation={[0.15 * i, 0, 0.3 * i]}
        >
          <boxGeometry args={[0.15, 0.02, 0.04]} />
          <meshStandardMaterial color="#514739" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
