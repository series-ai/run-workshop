import type { AttractionRequest } from './sim/attractions';
import { AttractionControls } from './ui/AttractionControls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectCapturePort, type HostSystemLike } from './game/capturePort';
import { MatchController, type RoomRequest, type MatchSnapshot } from './game/match';
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
import { useControllerInput } from './ui/useControllerInput';

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
  const initialRequest = useMemo<RoomRequest>(() => {
    const code = new URLSearchParams(window.location.search).get('room')?.replace(/\s/g, '').toUpperCase();
    return code ? { kind: 'join', code } : { kind: 'create' };
  }, []);
  const [lastRequest, setLastRequest] = useState<RoomRequest>(initialRequest);

  // One capture port for the app.
  const attractionInput = useRef<AttractionRequest>({ command: 0, sequence: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const port = useMemo(
    () => selectCapturePort({ ...capture, win: window, lockTarget: () => canvasRef.current }),
    [capture],
  );
  const gate = usePlayGate(port, controller, { status: snapshot.status, touchControls });
  const gamepad = useControllerInput(capture.sdkReady, gate, snapshot.status);
  useEffect(() => { if (gamepad.active) setTouchControls(false); }, [gamepad.active]);
  useEffect(() => {
    const chooseInput = (event: PointerEvent) => {
      gamepad.input.deactivate();
      if (event.pointerType === 'mouse') setTouchControls(false);
      else if (event.pointerType === 'touch' || event.pointerType === 'pen') setTouchControls(true);
    };
    const keyboard = () => gamepad.input.deactivate();
    window.addEventListener('pointerdown', chooseInput, true);
    window.addEventListener('keydown', keyboard, true);
    return () => { window.removeEventListener('pointerdown', chooseInput, true); window.removeEventListener('keydown', keyboard, true); };
  }, [gamepad.input]);

  const audio = useYardAudio(snapshot.status === 'live' && inputLive(gate.state), capture.sdkReady);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = controller.subscribe(() => setSnapshot(controller.snapshot()));
    // StrictMode cancels its probe before the initial room request starts.
    queueMicrotask(() => { if (!cancelled) void controller.start(initialRequest); });
    return () => {
      cancelled = true;
      unsubscribe();
      controller.stop();
    };
  }, [controller, initialRequest]);

  useEffect(() => {
    if (snapshot.status !== 'live') return;
    const timer = window.setInterval(() => setSnapshot(controller.snapshot()), 250);
    return () => window.clearInterval(timer);
  }, [controller, snapshot.status]);

  /** Every match button: capture in this click, then start the match. */
  const start = (request: RoomRequest) => {
    setLastRequest(request);
    void gate.engageForMatch(() => {
      void controller.start(request);
    });
  };

  const retry = () => {
    start(lastRequest);
  };

  const dismissError = () => {
    controller.dismissError();
  };

  return (
    <div className="yard-app" style={{ position: 'fixed', inset: 0, background: '#5a564d' }}>
      <YardScene
        controller={controller}
        controllerInput={gamepad.input}
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
        onRetry={retry}
        gate={gate}
        touchControls={touchControls}
        controllerActive={gamepad.active}
      />
      {touchControls ? <TouchControls input={touchInput} snapshot={snapshot} tool={tool} gate={gate} onTool={setTool} /> : null}
      <AttractionControls snapshot={snapshot} gate={gate} request={attractionInput} controllerActive={gamepad.active} />
      <PlayGate
        audio={audio}
        gate={gate}
        roomCode={snapshot.roomCode}
        onJoin={(code) => start({ kind: 'join', code })}
        quality={quality}
        onQuality={chooseQuality}
        onLeave={() => controller.stop()}
        touchControls={touchControls}
        controllerActive={gamepad.active}
        controllerConnected={gamepad.connected}
      />
      {snapshot.status === 'error' && snapshot.errorDetails ? (
        <ErrorModal
          details={snapshot.errorDetails}
          onNewRoom={() => start({ kind: 'create' })}
          onRetry={retry}
          onDismiss={dismissError}
        />
      ) : null}
    </div>
  );
}
