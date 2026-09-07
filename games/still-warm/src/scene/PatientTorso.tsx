import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, MeshStandardMaterial, MathUtils } from "three";
import { DRACO_PATH } from "./assets";
import type { GameState } from "../game/model";
import type { LiveHandSocket } from "./types";
import { supportMotion } from "./supportMotion";

interface Props {
  state: GameState;
  socket: LiveHandSocket;
  reducedMotion?: boolean;
}

function PatientBody({ state, socket, reducedMotion = false }: Props) {
  const source = useGLTF(
    `${import.meta.env.BASE_URL}assets/patient.glb`,
    DRACO_PATH,
  );
  const body = useMemo(() => {
    const scene = source.scene.clone(true);
    const skin: MeshStandardMaterial[] = [];
    const materials: MeshStandardMaterial[] = [];
    const morphs: Mesh[] = [];
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material instanceof MeshStandardMaterial) {
        node.material = node.material.clone();
        materials.push(node.material);
        if (node.material.name.startsWith("PatientSkin"))
          skin.push(node.material);
      }
      if (node.morphTargetDictionary) morphs.push(node);
    });
    const parts = Object.fromEntries(
      [
        "WoundOpen",
        "EmbeddedShard",
        "WoundCovered",
        "WoundClosed",
        "WoundDressed",
        "LegBrace",
        "BloodLoss",
        "LeftHand",
        "RightHand",
      ].map((name) => [name, scene.getObjectByName(name)!]),
    );
    return {
      scene,
      skin,
      morphs,
      parts,
      materials,
      leftHandY: parts.LeftHand.position.y,
      rightHandY: parts.RightHand.position.y,
    };
  }, [source.scene]);
  useEffect(
    () => () => body.materials.forEach((material) => material.dispose()),
    [body],
  );
  const time = useRef(0);
  const breathPhase = useRef(0);
  const crush = useRef(state.stage === "pinned" ? 1 : 0);
  const skinColor = useMemo(() => new Color(), []);
  const weakSkin = useMemo(() => new Color("#a4aab4"), []);

  const { stage, patient } = state;
  body.parts.WoundCovered.visible = stage === "pinned" || stage === "covered";
  body.parts.WoundOpen.visible = stage === "exposed" || stage === "extracted";
  body.parts.EmbeddedShard.visible = stage === "exposed";
  body.parts.WoundClosed.visible = stage === "closed";
  body.parts.WoundDressed.visible = stage === "dressed";
  body.parts.LegBrace.visible = state.restrained;
  body.parts.BloodLoss.visible = stage !== "dressed";

  useFrame((_, dt) => {
    if (state.paused) return;
    time.current += dt;
    const { lift, cleared } = supportMotion(state, socket);
    crush.current = MathUtils.damp(
      crush.current,
      cleared ? 0 : 1 - MathUtils.clamp(lift / 0.18, 0, 1),
      5,
      dt,
    );
    const rate = 1.4 + patient.pain / 60;
    breathPhase.current += dt * rate;
    const breath = reducedMotion
      ? 0
      : (Math.sin(breathPhase.current) + 1) * 0.5 * (1 - crush.current * 0.7);
    for (const mesh of body.morphs) {
      const keys = mesh.morphTargetDictionary!;
      const weights = mesh.morphTargetInfluences!;
      weights[keys.Breath] = breath;
      weights[keys.Crushed] = crush.current;
    }
    skinColor
      .set("white")
      .lerp(weakSkin, Math.min(1, (100 - patient.blood) / 75));
    for (const material of body.skin) material.color.copy(skinColor);
    // The fingers tighten slightly with pain. The arms stay on the floor.
    const tension = reducedMotion
      ? 0
      : Math.sin(time.current * 1.7) * patient.pain * 0.000015;
    body.parts.LeftHand.position.y = body.leftHandY + tension;
    body.parts.RightHand.position.y = body.rightHandY - tension;
  });
  return <primitive name="patient-body" object={body.scene} />;
}

export function PatientTorso(props: Props) {
  return (
    <Suspense fallback={null}>
      <PatientBody {...props} />
    </Suspense>
  );
}
