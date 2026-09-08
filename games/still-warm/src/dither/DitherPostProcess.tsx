// ── Custom PostProcessing Effect for R3F ──────────────────────────────
// Bridges the dither-effect module (pure TS uniforms + GLSL) into
// @react-three/postprocessing's EffectComposer pipeline.

import { useMemo, useEffect } from "react";
import { Uniform } from "three";
import { Effect } from "postprocessing";
import {
  getDitherUniforms,
  DITHER_FRAGMENT_SHADER,
  type DitherEffectConfig,
} from "dither-kit";

export class DitherEffect extends Effect {
  constructor(config: DitherEffectConfig) {
    const moduleUniforms = getDitherUniforms(config);

    const uniformMap = new Map<string, Uniform>();
    for (const [key, entry] of Object.entries(moduleUniforms)) {
      uniformMap.set(key, new Uniform(entry.value));
    }

    super("DitherEffect", DITHER_FRAGMENT_SHADER, { uniforms: uniformMap });
  }

  updateConfig(config: DitherEffectConfig): void {
    const moduleUniforms = getDitherUniforms(config);
    for (const [key, entry] of Object.entries(moduleUniforms)) {
      const u = this.uniforms.get(key);
      if (u) u.value = entry.value;
    }
  }
}

interface DitherPostProcessProps {
  config: DitherEffectConfig;
}

export function DitherPostProcess({ config }: DitherPostProcessProps) {
  const effect = useMemo(() => new DitherEffect(config), []);

  useEffect(() => {
    effect.updateConfig(config);
  }, [effect, config]);

  return <primitive object={effect} dispose={null} />;
}
