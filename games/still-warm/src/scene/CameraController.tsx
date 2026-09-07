import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, PerspectiveCamera } from "three";
import type { PatientState } from "../game/model";
import type { LookInput } from "./look";
import { PATIENT_LAYOUT } from "./patientLayout";

interface Props {
  patient: PatientState;
  look: LookInput;
  elapsed: number;
  started: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

export function CameraController({
  patient,
  look,
  elapsed,
  started,
  reducedMotion = false,
  paused = false,
}: Props) {
  const target = useMemo(() => new Vector3(), []);
  const time = useRef(0);
  const breathPhase = useRef(0);
  useFrame(({ camera, size }, dt) => {
    if (paused || !(camera instanceof PerspectiveCamera)) return;
    time.current += dt;
    breathPhase.current += dt * (1.5 + patient.pain / 65);
    const fov = size.width < size.height ? 82 : 70;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const t = time.current;
    const breath = reducedMotion ? 0 : Math.sin(breathPhase.current) * 0.006;
    const impact = !reducedMotion && started ? Math.exp(-elapsed * 2.5) : 0;
    const tremor = reducedMotion ? 0 : (patient.pain / 100) * 0.002;
    camera.position.set(
      0,
      PATIENT_LAYOUT.eyes[1] + breath + Math.sin(elapsed * 23) * impact * 0.018,
      PATIENT_LAYOUT.eyes[2],
    );
    const yaw = look.yaw + Math.sin(t * 8.7) * tremor;
    const pitch = look.pitch + Math.sin(t * 11.3) * tremor;
    target
      .set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      .add(camera.position);
    camera.lookAt(target);
    if (!reducedMotion)
      camera.rotateZ(
        (Math.sin(t * 0.4) * patient.sedation) / 4500 +
          impact * Math.sin(elapsed * 15) * 0.015,
      );
  });
  return null;
}
