import { Panel, ProgressBar, State } from '@/modules/ui/skin/semantic';
import { usePreloadState } from './coordinator';

export function PreloadOverlay() {
  const state = usePreloadState();
  const { presenter } = state;

  if (!presenter.visible || presenter.mode === 'native') {
    return null;
  }

  const progressValue = presenter.total <= 0
    ? 0
    : Math.round((presenter.loaded / presenter.total) * 100);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-6"
      data-testid="preload-overlay"
    >
      <Panel.Modal className="w-full max-w-md">
        <div className="space-y-4">
          <State.Loading
            data-testid="preload-overlay-state"
            description={presenter.currentPath ?? 'Preparing the next experience.'}
            title={presenter.message ?? 'Loading'}
          />
          <ProgressBar
            data-testid="preload-overlay-progress"
            label={presenter.stageId ?? undefined}
            showValue
            value={progressValue}
          />
        </div>
      </Panel.Modal>
    </div>
  );
}
