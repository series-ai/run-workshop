// ── Shared Control Panel ──────────────────────────────────────────────

import type { CSSProperties } from 'react';
import type { DitherEffectConfig, GpuDitherAlgorithm } from '../dither/DitherEffect';
import { GPU_DITHER_ALGORITHMS } from '../dither/DitherEffect';
import { ALL_PRESETS, PALETTE_PRESETS } from '../dither/presets';
import { colors, fonts } from './ui';

const GPU_ALGO_LABELS: Record<GpuDitherAlgorithm, string> = {
  'bayer': 'Bayer',
  'blue-noise': 'Blue Noise',
  'halftone-dot': 'Halftone Dot',
  'halftone-line': 'Halftone Line',
  'halftone-diamond': 'Halftone Diamond',
  'crosshatch': 'Crosshatch',
  'stipple': 'Stipple',
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  visible?: boolean;
}

function Slider({ label, value, min, max, step, onChange, visible = true }: SliderProps) {
  if (!visible) return null;
  return (
    <label style={styles.sliderLabel}>
      <span>
        {label}: <span style={styles.sliderValue}>{value.toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={styles.slider}
      />
    </label>
  );
}

export interface DitherControlsProps {
  config: DitherEffectConfig;
  onChange: (config: DitherEffectConfig) => void;
}

export function DitherControls({ config, onChange }: DitherControlsProps) {
  const set = (partial: Partial<DitherEffectConfig>) => onChange({ ...config, ...partial });
  const isHalftone = config.algorithm.startsWith('halftone');
  const isBayer = config.algorithm === 'bayer' || isHalftone;

  return (
    <div style={styles.panel}>
      <h3 style={styles.sectionTitle}>Preset</h3>
      <select
        value=""
        onChange={e => {
          const preset = ALL_PRESETS[Number(e.target.value)];
          if (preset) onChange(preset.config);
        }}
        style={styles.select}
      >
        <option value="" disabled>Apply preset...</option>
        {ALL_PRESETS.map((p, i) => (
          <option key={p.label} value={i}>{p.label}</option>
        ))}
      </select>

      <h3 style={styles.sectionTitle}>Algorithm</h3>
      <select
        value={config.algorithm}
        onChange={e => set({ algorithm: e.target.value as GpuDitherAlgorithm })}
        style={styles.select}
      >
        {GPU_DITHER_ALGORITHMS.map(a => (
          <option key={a} value={a}>{GPU_ALGO_LABELS[a]}</option>
        ))}
      </select>

      <h3 style={styles.sectionTitle}>Palette</h3>
      <select
        value=""
        onChange={e => {
          const p = PALETTE_PRESETS[Number(e.target.value)];
          if (p) set({ paletteColors: p.colors });
        }}
        style={styles.select}
      >
        <option value="" disabled>Change palette...</option>
        {PALETTE_PRESETS.map((p, i) => (
          <option key={p.label} value={i}>{p.label}</option>
        ))}
      </select>

      <h3 style={styles.sectionTitle}>Dither</h3>
      <Slider label="Strength" value={config.strength} min={0} max={1} step={0.01} onChange={v => set({ strength: v })} />
      <Slider label="Scale" value={config.scale ?? 1} min={1} max={8} step={1} onChange={v => set({ scale: v })} />
      <Slider label="Bayer Size" value={config.bayerSize ?? 8} min={2} max={16} step={2} onChange={v => set({ bayerSize: v })} visible={isBayer} />
      <Slider label="Halftone Angle" value={config.halftoneAngle ?? 0} min={0} max={90} step={1} onChange={v => set({ halftoneAngle: v })} visible={isHalftone} />

      <h3 style={styles.sectionTitle}>Pre-Processing</h3>
      <Slider label="Brightness" value={config.brightness ?? 0} min={-1} max={1} step={0.01} onChange={v => set({ brightness: v })} />
      <Slider label="Contrast" value={config.contrast ?? 1} min={0} max={3} step={0.01} onChange={v => set({ contrast: v })} />
      <Slider label="Gamma" value={config.gamma ?? 1} min={0.2} max={5} step={0.01} onChange={v => set({ gamma: v })} />
      <Slider label="Threshold" value={config.threshold ?? 0.5} min={0} max={1} step={0.01} onChange={v => set({ threshold: v })} />

      <h3 style={styles.sectionTitle}>Animation</h3>
      <label style={styles.checkLabel}>
        <input type="checkbox" checked={config.animated ?? false} onChange={e => set({ animated: e.target.checked })} />
        Animated
      </label>
      <Slider label="Speed" value={config.animationSpeed ?? 1} min={0.1} max={10} step={0.1} onChange={v => set({ animationSpeed: v })} visible={config.animated ?? false} />
      <Slider
        label="Noise Mode"
        value={config.noiseMode ?? 0}
        min={0}
        max={3}
        step={1}
        onChange={v => set({ noiseMode: v })}
        visible={config.animated ?? false}
      />

      <h3 style={styles.sectionTitle}>Post-Processing</h3>
      <Slider label="Chromatic" value={config.chromatic ?? 0} min={0} max={0.02} step={0.001} onChange={v => set({ chromatic: v })} />
      <Slider label="Glow" value={config.glow ?? 0} min={0} max={1} step={0.01} onChange={v => set({ glow: v })} />

      <h3 style={styles.sectionTitle}>Depth-Aware</h3>
      <label style={styles.checkLabel}>
        <input type="checkbox" checked={config.depthAware ?? false} onChange={e => set({ depthAware: e.target.checked })} />
        Surface-Stable (depth)
      </label>
      <Slider label="Depth Scale" value={config.depthScale ?? 3} min={0} max={10} step={0.1} onChange={v => set({ depthScale: v })} visible={config.depthAware ?? false} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px 20px',
    width: 236,
    minWidth: 236,
    height: '100%',
    overflowY: 'auto',
    background: colors.panel,
    borderRight: `1px solid ${colors.border}`,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    color: colors.accentMuted,
    margin: '10px 0 2px',
    paddingBottom: 4,
    borderBottom: `1px solid ${colors.border}`,
  },
  select: {
    background: colors.panelAlt,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 3,
    padding: '6px 8px',
    fontSize: 12,
    fontFamily: fonts.mono,
    width: '100%',
    cursor: 'pointer',
  },
  sliderLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textDim,
  },
  sliderValue: {
    color: colors.accent,
  },
  slider: {
    width: '100%',
    accentColor: colors.accent,
    cursor: 'pointer',
    margin: 0,
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textDim,
    cursor: 'pointer',
    accentColor: colors.accent,
  },
};
