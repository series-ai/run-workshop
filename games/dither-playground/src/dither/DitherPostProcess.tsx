// ── Custom PostProcessing Effect for R3F ──────────────────────────────
// Bridges the dither-effect module (pure TS uniforms + GLSL) into
// @react-three/postprocessing's EffectComposer pipeline.

import { forwardRef, useMemo, useEffect } from 'react';
import { Uniform } from 'three';
import { Effect } from 'postprocessing';
import {
  getDitherUniforms,
  DITHER_FRAGMENT_SHADER,
  type DitherEffectConfig,
} from 'dither-kit';

export class DitherEffect extends Effect {
  constructor(config: DitherEffectConfig) {
    const moduleUniforms = getDitherUniforms(config);

    const uniformMap = new Map<string, Uniform>();
    for (const [key, entry] of Object.entries(moduleUniforms)) {
      uniformMap.set(key, new Uniform(entry.value));
    }

    super('DitherEffect', DITHER_FRAGMENT_SHADER, { uniforms: uniformMap });
  }

  updateConfig(config: DitherEffectConfig): void {
    const moduleUniforms = getDitherUniforms(config);
    for (const [key, entry] of Object.entries(moduleUniforms)) {
      const u = this.uniforms.get(key);
      if (u) u.value = entry.value;
    }
  }

  updateTime(dt: number): void {
    const u = this.uniforms.get('uTime');
    if (u && typeof u.value === 'number') {
      u.value += dt;
    }
  }
}

interface DitherPostProcessProps {
  config: DitherEffectConfig;
}

export const DitherPostProcess = forwardRef<DitherEffect, DitherPostProcessProps>(
  function DitherPostProcess({ config }, ref) {
    const effect = useMemo(() => new DitherEffect(config), []);

    useEffect(() => {
      effect.updateConfig(config);
    }, [effect, config]);

    // Expose effect ref for useFrame time updates
    useEffect(() => {
      if (typeof ref === 'function') ref(effect);
      else if (ref) ref.current = effect;
    }, [effect, ref]);

    return <primitive object={effect} dispose={null} />;
  },
);
