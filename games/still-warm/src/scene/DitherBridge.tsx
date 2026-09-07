import { useRef, useMemo } from "react";
import type { FC } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import {
  DitherPostProcess,
  type DitherEffect,
} from "../dither/DitherPostProcess";
import type { DitherEffectConfig } from "dither-kit";
import { PALETTE } from "./palette";
import type { PatientState } from "../game/model";

interface DitherBridgeProps {
  patient: PatientState;
  reducedMotion?: boolean;
}

// Shared dither renderer with the approved olive and ivory palette.
export const DitherBridge: FC<DitherBridgeProps> = ({
  patient,
  reducedMotion = false,
}) => {
  const effectRef = useRef<DitherEffect | null>(null);

  const sedation = patient.sedation ?? 0;

  // Sedation changes the visual distortion.
  const config = useMemo<DitherEffectConfig>(() => {
    const sedationRatio = Math.min(Math.max(sedation / 100, 0), 1);

    return {
      algorithm: "bayer",
      bayerSize: 8,
      strength: 0.065,
      scale: 1,
      paletteColors: PALETTE.map((color) =>
        color.map(
          (channel) =>
            255 *
            (channel / 255 <= 0.04045
              ? channel / 255 / 12.92
              : Math.pow((channel / 255 + 0.055) / 1.055, 2.4)),
        ),
      ),
      paletteSize: PALETTE.length,
      animated: false,
      animationSpeed: 0.35,
      // Time-shift temporal noise, transitioning to perlin crawl under heavy sedation
      noiseMode: sedationRatio > 0.5 ? 2 : 1,
      // Sedation induces chromatic aberration ghosting and dreamlike glow
      chromatic: reducedMotion ? 0 : sedationRatio * 0.007,
      glow: reducedMotion ? 0 : sedationRatio * 0.22,
      // Ensure midtones remain readable and not crushed into deep black
      brightness: 0,
      contrast: 1.04,
      gamma: 1.0,
      threshold: 0.5,
    };
  }, [sedation, reducedMotion]);

  // Update dither uniform time for gentle grain drift
  useFrame((_, dt) => {
    if (!reducedMotion && effectRef.current) {
      effectRef.current.updateTime(dt);
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <DitherPostProcess ref={effectRef} config={config} />
    </EffectComposer>
  );
};
