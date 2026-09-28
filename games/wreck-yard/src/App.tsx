import { useEffect, useMemo, useState } from 'react';
import { MatchController, type MatchRequest, type MatchSnapshot } from './game/match';
import { createRoomTransport, joinRoomTransport, quickMatchTransport } from './net/rooms';
import { YardScene } from './render/YardScene';
import type { UiTool } from './render/keyBindings';
import { Hud } from './ui/Hud';
import { isMobileDevice } from './render/DynamicDpr';
import { readRenderQuality, type RenderQuality } from './render/renderQuality';
import { ErrorModal } from './ui/ErrorModal';

export default function App() {
  const controller = useMemo(
    () => new MatchController({ createRoomTransport, quickMatchTransport, joinRoomTransport }),
    [],
  );
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(() => controller.snapshot());
  const [tool, setTool] = useState<UiTool>('hand');
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

  const start = (request: MatchRequest) => {
    setLastRequest(request);
    void controller.start(request);
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
      <YardScene controller={controller} tool={tool} quality={quality} onQualityFallback={qualityIsAutomatic ? fallBackToLow : undefined} onToolChange={setTool} />
      <Hud
        snapshot={snapshot}
        tool={tool}
        onTool={setTool}
        quality={quality}
        onQuality={chooseQuality}
        onStart={start}
        onStop={() => controller.stop()}
        onRetry={retry}
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
