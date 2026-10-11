import type { AttractionRequest } from '../sim/attractions';
import { ShippingCrates } from './ShippingCrates';
import { StorageAttraction } from './StorageAttraction';
import { ReturnsDepartment } from './ReturnsDepartment';
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
import { Explosions } from './Explosions';
import { FuelDrumFx } from './FuelDrumFx';
import { InkComposer } from './style/InkComposer';
import type { YardRender } from './presentation';
import type { PlayGateApi } from '../ui/usePlayGate';
import { DynamicDpr, isMobileDevice } from './DynamicDpr';
import { nextSlowWindowCount, QUALITY_FALLBACK, type RenderQuality } from './renderQuality';
import type { YardAudioControl } from '../audio/useYardAudio';
import type { TouchInput } from '../ui/touchInput';

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

function AudioFrame({ controller, renderRef, onFrame }: { controller: MatchController; renderRef: React.MutableRefObject<YardRender | null>; onFrame: YardAudioControl['frame'] }) {
  useFrame(({ camera }) => {
    const render = renderRef.current;
    if (!render) return;
    const m = camera.matrixWorld.elements;
    onFrame(render, { position: [m[12]!, m[13]!, m[14]!], right: [m[0]!, m[1]!, m[2]!] }, controller.sessionGeneration);
  });
  return null;
}

function SceneRoot({ onAudioFrame, controller, tool, quality, onQualityFallback, onToolChange, bodies, renderRef, onBodiesChange, gate, touchInput, attractionInput }: {
  attractionInput?: React.MutableRefObject<AttractionRequest>;
  onAudioFrame?: YardAudioControl['frame'];
  touchInput?: React.MutableRefObject<TouchInput>;
  quality: RenderQuality;
  /** Set only while the tier is automatic; a player choice is never overridden. */
  onQualityFallback?: () => void;
  controller: MatchController;
  tool: UiTool;
  onToolChange?: (tool: UiTool) => void;
  bodies: readonly YardBody[];
  renderRef: React.MutableRefObject<YardRender | null>;
  onBodiesChange: (bodies: readonly YardBody[]) => void;
  gate: PlayGateApi;
}) {
  const worldOcclusion = useWorldOcclusion();
  return (
    <>
      <PointerInput controller={controller} tool={tool} onToolChange={onToolChange} renderRef={renderRef} onBodiesChange={onBodiesChange} gate={gate} touchInput={touchInput} attractionInput={attractionInput} />
      {onAudioFrame ? <AudioFrame controller={controller} renderRef={renderRef} onFrame={onAudioFrame} /> : null}
      <YardShell renderRef={renderRef} />
      <Contraptions renderRef={renderRef} />
      <StorageAttraction renderRef={renderRef} />
      <ShippingCrates bodies={bodies} renderRef={renderRef} />
      <ReturnsDepartment />
      <ArenaCage renderRef={renderRef} />
      <VoxelBodies bodies={bodies} renderRef={renderRef} worldOcclusion={worldOcclusion} />
      <PlayerAvatars renderRef={renderRef} tool={tool} />
      <group userData={{ portalViewHidden: true }}>
      <FirstPersonTool tool={tool} renderRef={renderRef} />
      <TorchSparks tool={tool} renderRef={renderRef} />
      <ToolFeedbackBeams tool={tool} renderRef={renderRef} />
      <TractorBeam tool={tool} renderRef={renderRef} />
      <TorchJet tool={tool} renderRef={renderRef} />
      </group>
      <FuelDrumFx renderRef={renderRef} />
      <Explosions renderRef={renderRef} />
      <OcclusionUpdater renderRef={renderRef} worldOcclusion={worldOcclusion} />
      <InkComposer enableInk={true} samples={isMobileDevice() ? 0 : 4} quality={quality} renderRef={renderRef} />
      {onQualityFallback && quality === 'high' ? <QualityFallback onFallback={onQualityFallback} /> : null}
    </>
  );
}

export function YardScene({ onAudioFrame, controller, tool, quality, onQualityFallback, onToolChange, gate, onCanvas, touchInput, attractionInput }: {
  attractionInput?: React.MutableRefObject<AttractionRequest>;
  onAudioFrame?: YardAudioControl['frame'];
  touchInput?: React.MutableRefObject<TouchInput>;
  onQualityFallback?: () => void;
  controller: MatchController;
  tool: UiTool;
  quality: RenderQuality;
  onToolChange?: (tool: UiTool) => void;
  gate: PlayGateApi;
  /** The canvas, for the browser capture port's pointer lock. */
  onCanvas: (canvas: HTMLCanvasElement) => void;
}) {
  const renderRef = useRef<YardRender | null>(null);
  const [bodies, setBodies] = useState<readonly YardBody[]>([]);
  const [dpr, setDpr] = useState(() => isMobileDevice() ? 1.0 : 1.25);

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
      dpr={dpr}
      camera={{ position: [CAMERA_BASE[0], CAMERA_BASE[1], CAMERA_BASE[2]], fov: 50 }}
      gl={{
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
        precision: isMobile ? 'mediump' : 'highp',
        preserveDrawingBuffer: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('record'),
        stencil: true,
        depth: true,
      }}
      onCreated={({ gl, scene, camera, advance }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        (window as unknown as { __DEBUG_THREE__: unknown }).__DEBUG_THREE__ = { gl, scene, camera, advance };
        onCanvas(gl.domElement);
      }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <DynamicDpr
        dpr={dpr}
        onDprChange={setDpr}
        minDpr={isMobile ? 0.85 : 1.0}
        maxDpr={isMobile ? 1.25 : 1.5}
      />
      <SceneRoot onAudioFrame={onAudioFrame} controller={controller} tool={tool} quality={quality} onQualityFallback={onQualityFallback} onToolChange={onToolChange} bodies={bodies} renderRef={renderRef} onBodiesChange={setBodies} gate={gate} touchInput={touchInput} attractionInput={attractionInput} />
    </Canvas>
  );
}
