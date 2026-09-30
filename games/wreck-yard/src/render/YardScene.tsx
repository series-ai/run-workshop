import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MatchController } from '../game/match';
import { CAMERA_BASE } from './viewConstants';
import type { YardBody } from '../sim/state';
import { OcclusionUpdater, useWorldOcclusion } from './OcclusionUpdater';
import { PointerInput } from './PointerInput';
import type { UiTool } from './keyBindings';
import { PlayerAvatars } from './PlayerAvatars';
import { FirstPersonTool } from './FirstPersonTool';
import { TorchSparks } from './TorchSparks';
import { ToolFeedbackBeams } from './ToolFeedbackBeams';
import { TractorBeam } from './TractorBeam';
import { TorchJet } from './TorchJet';
import { VoxelBodies } from './VoxelBodies';
import { YardShell } from './YardShell';
import { Contraptions } from './Contraptions';
import { ArenaCage } from './ArenaCage';
import { InkComposer } from './style/InkComposer';
import type { YardRender } from './presentation';
import { DynamicDpr, isMobileDevice } from './DynamicDpr';
import { nextSlowWindowCount, QUALITY_FALLBACK, type RenderQuality } from './renderQuality';

/** Drops the automatic high tier to low when frames stay slow. */
function QualityFallback({ onFallback }: { onFallback: () => void }) {
  const frames = useRef(0);
  const sumMs = useRef(0);
  const slowWindows = useRef(0);
  useFrame((_, delta) => {
    frames.current += 1;
    sumMs.current += Math.min(delta * 1000, 100);
    if (frames.current < QUALITY_FALLBACK.windowFrames) return;
    slowWindows.current = nextSlowWindowCount(slowWindows.current, sumMs.current / frames.current);
    frames.current = 0;
    sumMs.current = 0;
    if (slowWindows.current >= QUALITY_FALLBACK.slowWindows) onFallback();
  });
  return null;
}

function SceneRoot({ controller, tool, quality, onQualityFallback, onToolChange, bodies, renderRef, onBodiesChange }: {
  quality: RenderQuality;
  /** Set only while the tier is automatic; a player choice is never overridden. */
  onQualityFallback?: () => void;
  controller: MatchController;
  tool: UiTool;
  onToolChange?: (tool: UiTool) => void;
  bodies: readonly YardBody[];
  renderRef: React.MutableRefObject<YardRender | null>;
  onBodiesChange: (bodies: readonly YardBody[]) => void;
}) {
  const worldOcclusion = useWorldOcclusion();
  return (
    <>
      <PointerInput controller={controller} tool={tool} onToolChange={onToolChange} renderRef={renderRef} onBodiesChange={onBodiesChange} />
      <YardShell renderRef={renderRef} />
      <Contraptions renderRef={renderRef} />
      <ArenaCage renderRef={renderRef} />
      <VoxelBodies bodies={bodies} renderRef={renderRef} worldOcclusion={worldOcclusion} />
      <PlayerAvatars renderRef={renderRef} tool={tool} />
      <FirstPersonTool tool={tool} renderRef={renderRef} />
      <TorchSparks tool={tool} renderRef={renderRef} />
      <ToolFeedbackBeams tool={tool} renderRef={renderRef} />
      <TractorBeam tool={tool} renderRef={renderRef} />
      <TorchJet tool={tool} renderRef={renderRef} />
      <OcclusionUpdater renderRef={renderRef} worldOcclusion={worldOcclusion} />
      <InkComposer enableInk={true} samples={isMobileDevice() ? 0 : 4} quality={quality} />
      {onQualityFallback && quality === 'high' ? <QualityFallback onFallback={onQualityFallback} /> : null}
    </>
  );
}

export function YardScene({ controller, tool, quality, onQualityFallback, onToolChange }: {
  onQualityFallback?: () => void;
  controller: MatchController;
  tool: UiTool;
  quality: RenderQuality;
  onToolChange?: (tool: UiTool) => void;
}) {
  const renderRef = useRef<YardRender | null>(null);
  const [bodies, setBodies] = useState<readonly YardBody[]>([]);

  useEffect(() => {
    return controller.subscribe(() => {
      if (controller.snapshot().status === 'idle') {
        renderRef.current = null;
        setBodies([]);
      }
    });
  }, [controller]);



  const isMobile = isMobileDevice();

  return (
    <Canvas
      shadows={!isMobile}
      dpr={isMobile ? 1.0 : [1.0, 1.5]}
      camera={{ position: [CAMERA_BASE[0], CAMERA_BASE[1], CAMERA_BASE[2]], fov: 50 }}
      gl={{
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
        precision: isMobile ? 'mediump' : 'highp',
        preserveDrawingBuffer: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('record'),
        stencil: false,
        depth: true,
      }}
      onCreated={({ gl, scene, camera, advance }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        (window as unknown as { __DEBUG_THREE__: unknown }).__DEBUG_THREE__ = { gl, scene, camera, advance };
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <DynamicDpr
        targetFrameMs={33.3}
        minDpr={isMobile ? 0.85 : 1.0}
        maxDpr={isMobile ? 1.25 : 1.5}
      />
      <SceneRoot controller={controller} tool={tool} quality={quality} onQualityFallback={onQualityFallback} onToolChange={onToolChange} bodies={bodies} renderRef={renderRef} onBodiesChange={setBodies} />
    </Canvas>
  );
}
