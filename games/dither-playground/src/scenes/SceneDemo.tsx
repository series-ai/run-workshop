// ── 3D Scene Mode: GPU Dithering via PostProcessing ───────────────────

import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { DitherControls } from '../components/DitherControls';
import { DitherEffectUpdater } from '../components/DitherEffectUpdater';
import { DitherPostProcess, type DitherEffect } from '../dither/DitherPostProcess';
import { PRESET_GAMEBOY_CLASSIC } from 'dither-kit';
import { Button, ControlsDrawer, buttonStyle, colors, fonts, useHover, useIsMobile } from '../components/ui';
import type { CompareCellAlgorithm, DitherEffectConfig } from 'dither-kit';
import type { Mesh } from 'three';

const COMPARE_ALGORITHMS: CompareCellAlgorithm[] = [
  'bayer', 'blue-noise', 'halftone-dot', 'halftone-line',
  'halftone-diamond', 'crosshatch', 'stipple', 'original',
];

const COMPARE_LABELS: Record<CompareCellAlgorithm, string> = {
  'bayer': 'Bayer',
  'blue-noise': 'Blue Noise',
  'halftone-dot': 'Halftone Dot',
  'halftone-line': 'Halftone Line',
  'halftone-diamond': 'Halftone Diamond',
  'crosshatch': 'Crosshatch',
  'stipple': 'Stipple',
  'original': 'Original',
};

type Mode = 'single' | 'compare' | 'crawl';

const MODES: { id: Mode; label: string }[] = [
  { id: 'single', label: 'Single' },
  { id: 'compare', label: 'Compare 4×2' },
  { id: 'crawl', label: 'Crawl test' },
];

function RotatingTorusKnot() {
  const ref = useRef<Mesh>(null!);
  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 0.3;
    ref.current.rotation.x += dt * 0.1;
  });
  return (
    <mesh ref={ref} position={[0, 0.5, 0]}>
      <torusKnotGeometry args={[1, 0.35, 128, 32]} />
      <meshStandardMaterial color="#88aaff" metalness={0.2} roughness={0.6} />
    </mesh>
  );
}

function FloatingSphere() {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    ref.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 0.8) * 0.3;
  });
  return (
    <mesh ref={ref} position={[-2, 1.5, -1]}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="#ff8888" emissive="#ff4040" emissiveIntensity={0.4} />
    </mesh>
  );
}

function SmallCube() {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    ref.current.position.y = 0.1 + Math.sin(state.clock.elapsedTime * 1.2 + 2) * 0.15;
  });
  return (
    <mesh ref={ref} position={[2, 0.1, -0.5]}>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial color="#66dd88" roughness={0.5} />
    </mesh>
  );
}

function CheckerGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#cccccc" roughness={0.9} />
    </mesh>
  );
}

function CheckChip({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { hovered, hoverProps } = useHover();
  return (
    <label
      {...hoverProps}
      style={{ ...buttonStyle(checked, hovered), display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, whiteSpace: 'nowrap' }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: checked ? colors.bg : colors.accent, margin: 0 }}
      />
      {label}
    </label>
  );
}

export function SceneDemo() {
  const [config, setConfig] = useState<DitherEffectConfig>(PRESET_GAMEBOY_CLASSIC.config);
  const [mode, setMode] = useState<Mode>('compare');
  const [resolveOn, setResolveOn] = useState(false);
  const [pointer, setPointer] = useState<[number, number]>([0.5, 0.5]);
  const effectRef = useRef<DitherEffect | null>(null);
  const isMobile = useIsMobile();

  const modeButtons = (
    <>
      {MODES.map((m) => (
        <Button
          key={m.id}
          active={mode === m.id}
          onClick={() => setMode(m.id)}
          style={isMobile ? { flexShrink: 0 } : undefined}
        >
          {m.label}
        </Button>
      ))}
      <CheckChip checked={resolveOn} onChange={setResolveOn} label="Resolve mask" />
    </>
  );

  let effective = config;
  if (mode === 'compare') {
    effective = { ...config, compare: { cols: 4, rows: 2, algorithms: COMPARE_ALGORITHMS } };
  } else if (mode === 'crawl') {
    // Static vs animated per cell: uAnimated is global, so the override must go
    // through compare.animated (per-cell uCellAnimated), not a global flag.
    effective = { ...config, compare: { cols: 2, rows: 1, algorithms: ['bayer', 'bayer'], noiseModes: [0, 1], animated: [false, true] } };
  }
  if (resolveOn) {
    effective = { ...effective, resolve: { center: pointer, radius: 0.15 } };
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resolveOn) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // uv space: x left→right, y bottom→top (flip the DOM y axis)
    setPointer([
      (e.clientX - rect.left) / rect.width,
      1 - (e.clientY - rect.top) / rect.height,
    ]);
  };

  return (
    <div style={styles.container}>
      {isMobile ? (
        <ControlsDrawer>
          <DitherControls config={config} onChange={setConfig} fill />
        </ControlsDrawer>
      ) : (
        <div style={styles.sidebar}>
          <DitherControls config={config} onChange={setConfig} />
        </div>
      )}
      <div style={styles.main}>
        {!isMobile && <div style={styles.toolbar}>{modeButtons}</div>}
        <div style={styles.canvasArea} onPointerMove={handlePointerMove}>
          <Canvas
            camera={{ position: [3, 2, 5], fov: 50 }}
            style={{ width: '100%', height: '100%' }}
            gl={{ antialias: false }}
          >
            <color attach="background" args={['#b8c0d0']} />

            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 8, 3]} intensity={1.5} />
            <directionalLight position={[-3, 4, -2]} intensity={0.5} color="#aaccff" />
            <pointLight position={[-3, 2, 2]} color="#ff8844" intensity={2} />

            <RotatingTorusKnot />
            <FloatingSphere />
            <SmallCube />
            <CheckerGround />

            <OrbitControls makeDefault autoRotate={mode === 'crawl'} />

            <EffectComposer>
              <DitherPostProcess ref={effectRef} config={effective} />
            </EffectComposer>
            <DitherEffectUpdater effectRef={effectRef} />
          </Canvas>
          {mode === 'compare' && (
            // uv row 0 is the bottom row, so the DOM grid renders labels in
            // reverse row order: top row = cells 4-7, bottom row = cells 0-3.
            <div style={styles.compareOverlay}>
              {[...COMPARE_ALGORITHMS.slice(4), ...COMPARE_ALGORITHMS.slice(0, 4)].map((algo, i) => (
                <div key={i} style={isMobile ? styles.compareLabelMobile : styles.compareLabel}>{COMPARE_LABELS[algo]}</div>
              ))}
            </div>
          )}
        </div>
        {isMobile && (
          // Horizontally scrollable chip row just above the bottom task bar.
          <div style={styles.chipRow}>{modeButtons}</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { display: 'flex', height: '100%', overflow: 'hidden' },
  // Panel chrome (width, background, border) lives in DitherControls itself.
  sidebar: { display: 'contents' },
  main: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  toolbar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '10px 12px',
    background: colors.panel,
    borderBottom: `1px solid ${colors.border}`,
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
  },
  compareOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    pointerEvents: 'none',
  },
  compareLabel: {
    alignSelf: 'start',
    justifySelf: 'start',
    margin: 8,
    padding: '3px 8px',
    background: 'rgba(13, 15, 10, 0.72)',
    border: '1px solid rgba(155, 188, 15, 0.35)',
    color: colors.accentHi,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    borderRadius: 3,
  },
  compareLabelMobile: {
    alignSelf: 'start',
    justifySelf: 'start',
    margin: 4,
    padding: '2px 5px',
    background: 'rgba(13, 15, 10, 0.72)',
    border: '1px solid rgba(155, 188, 15, 0.35)',
    color: colors.accentHi,
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderRadius: 3,
  },
  chipRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '8px 12px',
    background: colors.panel,
    borderTop: `1px solid ${colors.border}`,
    overflowX: 'auto',
    flexShrink: 0,
    WebkitOverflowScrolling: 'touch',
  },
};
