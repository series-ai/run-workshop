import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import { Cabinet, CABINET_FALLEN, CABINET_CLEAR } from "./Cabinet";
import type { LiveHandSocket } from "./types";
import type { GameState } from "../game/model";
import { supportMotion } from "./supportMotion";

export function Debris({
  state,
  socket,
}: {
  state: GameState;
  socket: LiveHandSocket;
}) {
  const cabinet = useRef<Group>(null!);
  const initiallyCleared = useRef(state.stage !== "pinned").current;
  useFrame((_, dt) => {
    if (state.paused) return;
    const { lift, cleared } = supportMotion(state, socket);
    const end = cleared ? CABINET_CLEAR : CABINET_FALLEN;
    cabinet.current.position.x = MathUtils.damp(
      cabinet.current.position.x,
      end[0],
      4,
      dt,
    );
    cabinet.current.position.y = MathUtils.damp(
      cabinet.current.position.y,
      end[1] + (cleared ? 0 : lift),
      5,
      dt,
    );
    cabinet.current.position.z = MathUtils.damp(
      cabinet.current.position.z,
      end[2],
      4,
      dt,
    );
    cabinet.current.rotation.z = MathUtils.damp(
      cabinet.current.rotation.z,
      cleared ? 0 : Math.PI / 2,
      4,
      dt,
    );
  });
  return (
    <group
      name="fallen-cabinet"
      ref={cabinet}
      position={initiallyCleared ? [...CABINET_CLEAR] : [...CABINET_FALLEN]}
      rotation={[0, 0.25, initiallyCleared ? 0 : Math.PI / 2]}
    >
      <Cabinet />
    </group>
  );
}
