import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MatchController } from '../game/match';
import { CAMERA_BASE } from './viewConstants';
import type { YardBody } from '../sim/state';
import { OcclusionUpdater, useWorldOcclusion } from './OcclusionUpdater';
import { PointerInput, type UiTool } from './PointerInput';
import { PlayerAvatars } from './PlayerAvatars';
import { FirstPersonTool } from './FirstPersonTool';
import { VoxelBodies } from './VoxelBodies';
import { YardShell } from './YardShell';
import type { YardRender } from './presentation';

const SLOT_COLORS = ['#d4efff', '#ffb264', '#b8ffb0', '#f0a0ff'];

function SceneRoot({ controller, tool, onToolChange, bodies, renderRef, outlines, onHover, onBodiesChange }: {
  controller: MatchController;
  tool: UiTool;
  onToolChange?: (tool: UiTool) => void;
  bodies: readonly YardBody[];
  renderRef: React.MutableRefObject<YardRender | null>;
  outlines: ReadonlyMap<string, string>;
  onHover: (id: string | null) => void;
  onBodiesChange: (bodies: readonly YardBody[]) => void;
}) {
  const worldOcclusion = useWorldOcclusion();
  return (
    <>
      <PointerInput controller={controller} tool={tool} onToolChange={onToolChange} renderRef={renderRef} onBodiesChange={onBodiesChange} />
      <YardShell />
      <VoxelBodies bodies={bodies} renderRef={renderRef} outlines={outlines} onHover={onHover} worldOcclusion={worldOcclusion} />
      <PlayerAvatars renderRef={renderRef} />
      <FirstPersonTool tool={tool} renderRef={renderRef} />
      <OcclusionUpdater renderRef={renderRef} worldOcclusion={worldOcclusion} />
    </>
  );
}

export function YardScene({ controller, tool, onToolChange }: {
  controller: MatchController;
  tool: UiTool;
  onToolChange?: (tool: UiTool) => void;
}) {
  const renderRef = useRef<YardRender | null>(null);
  const [bodies, setBodies] = useState<readonly YardBody[]>([]);
  const [localHover, setLocalHover] = useState<string | null>(null);

  useEffect(() => {
    return controller.subscribe(() => {
      if (controller.snapshot().status === 'idle') {
        renderRef.current = null;
        setBodies([]);
      }
    });
  }, [controller]);

  const onHover = useCallback((id: string | null) => setLocalHover(id), []);

  // Outlines come from the projected state (who grabs or torches what) plus
  // the local hover. `bodies` changes on every fracture, which re-renders this
  // component often enough for per-slot outlines to track the action.
  const outlines = new Map<string, string>();
  if (localHover && tool !== 'orbit') outlines.set(localHover, tool === 'torch' ? '#ffb264' : '#d4efff');
  const render = renderRef.current;
  if (render) {
    render.grabbed.forEach((id, slot) => { if (id) outlines.set(id, SLOT_COLORS[slot % SLOT_COLORS.length]!); });
    render.torching.forEach((id) => { if (id) outlines.set(id, '#ffb264'); });
  }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [CAMERA_BASE[0], CAMERA_BASE[1], CAMERA_BASE[2]], fov: 65 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneRoot controller={controller} tool={tool} onToolChange={onToolChange} bodies={bodies} renderRef={renderRef} outlines={outlines} onHover={onHover} onBodiesChange={setBodies} />
    </Canvas>
  );
}
