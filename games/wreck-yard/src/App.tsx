import type { AttractionRequest } from './sim/attractions';
import { AttractionControls } from './ui/AttractionControls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectCapturePort, type HostSystemLike } from './game/capturePort';
import { MatchController, type MatchRequest, type MatchSnapshot } from './game/match';
import { createRoomTransport, joinRoomTransport, quickMatchTransport } from './net/rooms';
import { YardScene } from './render/YardScene';
import type { UiTool } from './render/keyBindings';
import { Hud } from './ui/Hud';
import { isMobileDevice } from './render/DynamicDpr';
import { readRenderQuality, type RenderQuality } from './render/renderQuality';
import { ErrorModal } from './ui/ErrorModal';
import { PlayGate } from './ui/PlayGate';
import { usePlayGate } from './ui/usePlayGate';
import { TouchControls } from './ui/TouchControls';
import { useYardAudio } from './audio/useYardAudio';
import { inputLive } from './game/playGate';
import { neutralTouchInput, usesTouchControls } from './ui/touchInput';

/** What src/main.tsx learned from the RUN SDK, for the capture port. */
export interface CaptureSurface {
  readonly sdkReady: boolean;
  readonly isMock: boolean;
  readonly system: HostSystemLike | null;
}

export default function App({ capture }: { capture: CaptureSurface }) {
  const controller = useMemo(
    () => new MatchController({ createRoomTransport, quickMatchTransport, joinRoomTransport }),
    [],
  );
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(() => controller.snapshot());
  const [tool, setTool] = useState<UiTool>('hand');
  const [touchControls, setTouchControls] = useState(usesTouchControls);
  const touchInput = useRef(neutralTouchInput());
  useEffect(() => { if (touchControls && tool === 'orbit') setTool('hand'); }, [touchControls, tool]);
  useEffect(() => {
    const chooseInput = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setTouchControls(false);
      else if (event.pointerType === 'touch' || event.pointerType === 'pen') setTouchControls(true);
    };
    window.addEventListener('pointerdown', chooseInput, true);
    return () => window.removeEventListener('pointerdown', chooseInput, true);
  }, []);
  const [quality, setQuality] = useState<RenderQuality>(() => readRenderQuality(isMobileDevice()));
  // The tier is automatic until the player picks one or the URL sets it.
  const [qualityIsAutomatic, setQualityIsAutomatic] = useState(() => !new URLSearchParams(window.location.search).has('quality'));
  const chooseQuality = (next: RenderQuality) => {
    setQualityIsAutomatic(false);
    setQuality(next);
  };
  const fallBackToLow = () => {
    setQualityIsAutomatic(false);
    setQuality('low');
  };
  const [lastRequest, setLastRequest] = useState<MatchRequest>({ kind: 'solo' });

  // One port for the app's life: the host SDK, the browser, none, or the test fake.
  const attractionInput = useRef<AttractionRequest>({ command: 0, sequence: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const port = useMemo(
    () => selectCapturePort({ ...capture, win: window, lockTarget: () => canvasRef.current }),
    [capture],
  );
  const modalOpen = snapshot.status === 'error' && Boolean(snapshot.errorDetails);
  const gate = usePlayGate(port, controller, { status: snapshot.status, modalOpen, touchControls });

  const audio = useYardAudio(snapshot.status === 'live' && inputLive(gate.state), capture.sdkReady);

  useEffect(() => {
    (window as unknown as { __WRECK_YARD_CONTROLLER__?: MatchController }).__WRECK_YARD_CONTROLLER__ = controller;
    const unsubscribe = controller.subscribe(() => setSnapshot(controller.snapshot()));
    void controller.start({ kind: 'solo' });
    return () => {
      unsubscribe();
      controller.stop();
      delete (window as unknown as { __WRECK_YARD_CONTROLLER__?: MatchController }).__WRECK_YARD_CONTROLLER__;
    };
  }, [controller]);

  useEffect(() => {
    if (snapshot.status !== 'live') return;
    const timer = window.setInterval(() => setSnapshot(controller.snapshot()), 250);
    return () => window.clearInterval(timer);
  }, [controller, snapshot.status]);

  /** Every match button: capture in this click, then start the match. */
  const start = (request: MatchRequest) => {
    setLastRequest(request);
    void gate.engageForMatch(() => {
      void controller.start(request);
    });
  };

  const playSolo = () => {
    start({ kind: 'solo' });
  };

  const retry = () => {
    start(lastRequest);
  };

  const dismissError = () => {
    controller.dismissError();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#5a564d' }}>
      <YardScene
        controller={controller}
        onAudioFrame={audio.frame}
        tool={tool}
        quality={quality}
        onQualityFallback={qualityIsAutomatic ? fallBackToLow : undefined}
        onToolChange={setTool}
        gate={gate}
        touchInput={touchInput}
        attractionInput={attractionInput}
        onCanvas={(canvas) => { canvasRef.current = canvas; }}
      />
      <Hud
        snapshot={snapshot}
        tool={tool}
        onTool={setTool}
        quality={quality}
        onQuality={chooseQuality}
        onStart={start}
        onStop={() => controller.stop()}
        onRetry={retry}
        gate={gate}
        touchControls={touchControls}
      />
      {touchControls ? <TouchControls input={touchInput} snapshot={snapshot} tool={tool} gate={gate} onTool={setTool} /> : null}
      <AttractionControls snapshot={snapshot} gate={gate} request={attractionInput} />
      <PlayGate
        audio={audio}
        gate={gate}
        inRoom={lastRequest.kind !== 'solo'}
        quality={quality}
        onQuality={chooseQuality}
        onLeave={() => controller.stop()}
        touchControls={touchControls}
      />
      {snapshot.status === 'error' && snapshot.errorDetails ? (
        <ErrorModal
          details={snapshot.errorDetails}
          onPlaySolo={playSolo}
          onRetry={retry}
          onDismiss={dismissError}
        />
      ) : null}
    </div>
  );
}
