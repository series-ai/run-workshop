import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, PerspectiveCamera } from "three";
import type { LookInput } from "./look";
import { PRONE_EYES, type PatientPose } from "./PatientPose";
import { PATIENT_LAYOUT } from "./patientLayout";
import type { GameState } from "../game/model";

interface Props {
  look: LookInput;
  pose: PatientPose;
  state?: GameState;
  paused?: boolean;
}

export function CameraController({ look, pose, state, paused = false }: Props) {
  const target = useMemo(() => new Vector3(), []);
  const proneTarget = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const fov = size.width < size.height ? 82 : 70;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (paused) return;

    // When the cabinet is lifted off but the patient is still face down:
    // The crushing weight is gone. His cheek rests against the cold flagstones,
    // and he can now see the stone floor spread out directly in front of him.
    const isClearedProne =
      state !== undefined
        ? state.stage !== "pinned" && state.posture === "prone"
        : false;

    const pronePos: [number, number, number] = isClearedProne
      ? [0, -0.73, -0.45]
      : [...PRONE_EYES];

    proneTarget.set(...pronePos).lerp(target.set(...PATIENT_LAYOUT.eyes), pose.roll);
    camera.position.copy(proneTarget);

    const baseProneUp = isClearedProne
      ? new Vector3(0.35, 0.94, 0)
      : new Vector3(
          Math.sin(Math.PI * (1 - pose.roll)),
          Math.cos(Math.PI * (1 - pose.roll)),
          0,
        );

    camera.up.copy(baseProneUp).lerp(new Vector3(0, 1, 0), pose.roll).normalize();

    const freedom = isClearedProne
      ? 0.35 + 0.65 * pose.roll
      : 0.12 + 0.88 * pose.roll;

    const yaw = look.yaw * freedom;
    const pronePitch = isClearedProne
      ? -0.38 + look.pitch * 0.22
      : -0.95 + look.pitch * 0.12;

    const pitch = pronePitch * (1 - pose.roll) + look.pitch * pose.roll;

    target
      .set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      .add(camera.position);
    camera.lookAt(target);
  });
  return null;
}
