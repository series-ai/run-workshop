import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, PerspectiveCamera } from "three";
import type { LookInput } from "./look";
import { PRONE_EYES, type PatientPose } from "./PatientPose";
import { PATIENT_LAYOUT } from "./patientLayout";

interface Props {
  look: LookInput;
  pose: PatientPose;
  paused?: boolean;
}

export function CameraController({ look, pose, paused = false }: Props) {
  const target = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const fov = size.width < size.height ? 82 : 70;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (paused) return;
    camera.position
      .set(...PRONE_EYES)
      .lerp(target.set(...PATIENT_LAYOUT.eyes), pose.roll);
    camera.up.set(
      Math.sin(Math.PI * (1 - pose.roll)),
      Math.cos(Math.PI * (1 - pose.roll)),
      0,
    );
    const freedom = 0.12 + 0.88 * pose.roll;
    const yaw = look.yaw * freedom;
    const pitch =
      (-0.95 + look.pitch * 0.12) * (1 - pose.roll) + look.pitch * pose.roll;
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
