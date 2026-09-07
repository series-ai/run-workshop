import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  MathUtils,
  type AmbientLight,
  type PointLight,
  type DirectionalLight,
} from "three";

export function SceneLighting({
  lit,
  paused,
}: {
  lit: boolean;
  paused: boolean;
}) {
  const ambient = useRef<AmbientLight>(null!);
  const face = useRef<PointLight>(null!);
  const body = useRef<PointLight>(null!);
  const rim = useRef<DirectionalLight>(null!);
  const reveal = useRef(0);
  useFrame((_, dt) => {
    if (paused) return;
    reveal.current = MathUtils.damp(reveal.current, lit ? 1 : 0, 1.8, dt);
    const light = reveal.current;
    ambient.current.intensity = 0.018 + light * 0.32;
    face.current.intensity = 0.025 + light * 2.4;
    body.current.intensity = light * 0.65;
    rim.current.intensity = 0.06 + light * 0.48;
  });
  return (
    <group name="cellar-lighting">
      <ambientLight ref={ambient} intensity={0.018} color="#8b9075" />
      <pointLight
        ref={face}
        position={[-0.35, 0.85, -0.85]}
        intensity={0.025}
        color="#d1bd8d"
        distance={5}
        decay={2}
      />
      <pointLight
        ref={body}
        position={[0.1, -0.08, -0.32]}
        intensity={0}
        color="#b3b39a"
        distance={2.5}
        decay={2}
      />
      <directionalLight
        ref={rim}
        position={[1.5, 2.4, 1.4]}
        intensity={0.06}
        color="#89968d"
      />
      <pointLight
        position={[1.35, -0.65, 2.1]}
        intensity={lit ? 0.24 : 0.035}
        color="#a89469"
        distance={1.8}
        decay={2}
      />
    </group>
  );
}
