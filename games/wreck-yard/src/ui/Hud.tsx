import { useState } from 'react';
import type { MatchRequest, MatchSnapshot } from '../game/match';
import type { UiTool } from '../render/PointerInput';

const panel: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(20, 22, 20, 0.82)',
  color: '#e8ecd8',
  borderRadius: 10,
  padding: '12px 14px',
  font: '13px/1.45 ui-sans-serif, system-ui, sans-serif',
  backdropFilter: 'blur(6px)',
};

const button = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #6d7a62',
  background: active ? '#9bbc0f' : '#2c3320',
  color: active ? '#101408' : '#e8ecd8',
  cursor: 'pointer',
});

export function Hud({ snapshot, tool, onTool, onStart, onStop, onRetry }: {
  snapshot: MatchSnapshot;
  tool: UiTool;
  onTool: (tool: UiTool) => void;
  onStart: (request: MatchRequest) => void;
  onStop: () => void;
  /** Re-runs the last requested action after a terminal error. */
  onRetry: () => void;
}) {
  const [code, setCode] = useState('');
  const render = snapshot.render;
  const live = snapshot.status === 'live';

  return (
    <>
      <div style={{ ...panel, top: 16, left: 16, minWidth: 240 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Wreck Yard</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['hand', 'torch', 'orbit'] as const).map((entry) => (
            <button key={entry} type="button" style={button(tool === entry)} onClick={() => onTool(entry)} disabled={!live}>
              {entry === 'hand' ? 'Hand' : entry === 'torch' ? 'Torch' : 'Orbit'}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <div>Bodies: {render?.bodies.length ?? 0}</div>
          <div>Torch cuts: {render?.stats.torchCuts ?? 0}</div>
          <div>Throws: {render?.stats.throws ?? 0}</div>
          <div>Fractures: {render?.stats.fractures ?? 0}</div>
          <div>Floating: {render?.floating ?? 0}</div>
          <div>Status: {snapshot.status}{snapshot.rollbackCount > 0 ? ` (rollbacks ${snapshot.rollbackCount})` : ''}</div>
          {snapshot.roomCode ? <div>Room code: <strong>{snapshot.roomCode}</strong></div> : null}
          {snapshot.error ? <div style={{ color: '#ff9c8a' }}>Error: {snapshot.error}</div> : null}
        </div>
      </div>

      <div style={{ ...panel, top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        {live ? (
          <button type="button" style={button(false)} onClick={onStop}>Leave</button>
        ) : (
          <>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'solo' })}>Play solo</button>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'quick' })}>Quick match</button>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'create' })}>Create room</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                aria-label="Room code"
                value={code}
                onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
                placeholder="Room code"
                style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #6d7a62', background: '#14170d', color: '#e8ecd8' }}
              />
              <button type="button" style={button(false)} onClick={() => onStart({ kind: 'join', code })} disabled={code.length === 0}>Join</button>
            </div>
            {snapshot.status === 'error' ? (
              <button type="button" style={button(true)} onClick={onRetry}>Retry</button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
