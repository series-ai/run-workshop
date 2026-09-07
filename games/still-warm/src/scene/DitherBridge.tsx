import { useMemo } from "react";
import type { FC } from "react";
import { EffectComposer } from "@react-three/postprocessing";
import { DitherPostProcess } from "../dither/DitherPostProcess";
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
  const sedation = patient.sedation;

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
      // Sedation adds edge separation and a soft glow.
      chromatic: reducedMotion ? 0 : sedationRatio * 0.007,
      glow: reducedMotion ? 0 : sedationRatio * 0.22,
      // Ensure midtones remain readable and not crushed into deep black
      brightness: 0,
      contrast: 1.04,
      gamma: 1.0,
      threshold: 0.5,
    };
  }, [sedation, reducedMotion]);

  return (
    <EffectComposer multisampling={0}>
      <DitherPostProcess config={config} />
    </EffectComposer>
  );
};
