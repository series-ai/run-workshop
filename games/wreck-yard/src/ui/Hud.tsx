import { useState } from 'react';
import type { MatchRequest, MatchSnapshot } from '../game/match';
import type { UiTool } from '../render/PointerInput';

const panel: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(20, 22, 20, 0.85)',
  color: '#e8ecd8',
  borderRadius: 10,
  padding: '12px 14px',
  font: '13px/1.45 ui-sans-serif, system-ui, sans-serif',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
};

const button = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: active ? '1px solid #38bdf8' : '1px solid #475569',
  background: active ? '#0284c7' : '#1e293b',
  color: active ? '#ffffff' : '#cbd5e1',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  transition: 'all 0.15s ease',
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
  const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);
  const fuelPercent = Math.round(localPlayer?.fuel ?? 100);
  const isGrabbing = Boolean(localPlayer?.grabbing);

  return (
    <>
      {/* Top Left: Status & Arena Stats */}
      <div style={{ ...panel, top: 16, left: 16, minWidth: 250 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#38bdf8', letterSpacing: '0.02em' }}>
          Wreck Yard Arena
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['hand', 'torch', 'orbit'] as const).map((entry) => (
            <button key={entry} type="button" style={button(tool === entry)} onClick={() => onTool(entry)} disabled={!live}>
              {entry === 'hand' ? 'Gravity Gun (1)' : entry === 'torch' ? 'Plasma Torch (2)' : 'Orbit Cam (3)'}
            </button>
          ))}
        </div>
        <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 12 }}>
          <div>Bodies: <strong style={{ color: '#f8fafc' }}>{render?.bodies.length ?? 0}</strong></div>
          <div>Floating: <strong style={{ color: '#38bdf8' }}>{render?.floating ?? 0}</strong></div>
          <div>Torch cuts: <strong style={{ color: '#fb923c' }}>{render?.stats.torchCuts ?? 0}</strong></div>
          <div>Throws/Punts: <strong style={{ color: '#a78bfa' }}>{render?.stats.throws ?? 0}</strong></div>
          <div>Fractures: <strong style={{ color: '#f43f5e' }}>{render?.stats.fractures ?? 0}</strong></div>
          <div>Players: <strong style={{ color: '#34d399' }}>{render?.players?.length ?? 1}/4</strong></div>
        </div>
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #334155', fontSize: 11, color: '#94a3b8' }}>
          Status: {snapshot.status}{snapshot.rollbackCount > 0 ? ` (rollbacks: ${snapshot.rollbackCount})` : ''}
          {snapshot.roomCode ? <span style={{ marginLeft: 8 }}>Room: <strong style={{ color: '#38bdf8' }}>{snapshot.roomCode}</strong></span> : null}
          {snapshot.error ? <div style={{ color: '#ff8a8a', marginTop: 4 }}>Error: {snapshot.error}</div> : null}
        </div>
      </div>

      {/* Top Right: Multiplayer Session Manager */}
      <div style={{ ...panel, top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 210 }}>
        {live ? (
          <button type="button" style={button(false)} onClick={onStop}>Leave Match</button>
        ) : (
          <>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'solo' })}>Play Solo (4-Slot Playground)</button>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'quick' })}>Quick Match (Multiplayer)</button>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'create' })}>Create Room</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                aria-label="Room code"
                value={code}
                onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
                placeholder="Room code"
                style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e8ecd8' }}
              />
              <button type="button" style={button(false)} onClick={() => onStart({ kind: 'join', code })} disabled={code.length === 0}>Join</button>
            </div>
            {snapshot.status === 'error' ? (
              <button type="button" style={button(true)} onClick={onRetry}>Retry</button>
            ) : null}
          </>
        )}
      </div>

      {/* Center: First-Person Reticle / Crosshair */}
      {live && tool !== 'orbit' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {tool === 'hand' ? (
            <div
              style={{
                width: isGrabbing ? 28 : 20,
                height: isGrabbing ? 28 : 20,
                borderRadius: '50%',
                border: isGrabbing ? '2px solid #38bdf8' : '2px solid rgba(56, 189, 248, 0.65)',
                boxShadow: isGrabbing ? '0 0 12px #38bdf8' : 'none',
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#38bdf8' }} />
            </div>
          ) : (
            <div
              style={{
                width: 22,
                height: 22,
                border: '2px solid #f97316',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 8px rgba(249, 115, 22, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 4, height: 4, background: '#fdba74' }} />
            </div>
          )}

          {isGrabbing && (
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: '#38bdf8', textShadow: '0 2px 6px black' }}>
              [RMB] PUNT OBJECT
            </div>
          )}
        </div>
      )}

      {/* Bottom Center: Jetpack Fuel Meter */}
      {live && tool !== 'orbit' && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.08em', textShadow: '0 1px 4px black' }}>
            JETPACK THRUSTER [{fuelPercent}%]
          </div>
          <div
            style={{
              width: 220,
              height: 10,
              background: 'rgba(15, 23, 42, 0.85)',
              borderRadius: 6,
              border: '1px solid #334155',
              overflow: 'hidden',
              padding: 1,
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: `${fuelPercent}%`,
                height: '100%',
                background: fuelPercent > 25 ? 'linear-gradient(90deg, #0284c7, #38bdf8)' : '#f43f5e',
                borderRadius: 4,
                boxShadow: fuelPercent > 25 ? '0 0 8px #38bdf8' : '0 0 8px #f43f5e',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Left: Controls Quick Guide */}
      {live && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(15, 23, 42, 0.75)',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 11,
            color: '#94a3b8',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>[Click Canvas]</span> Lock View &bull;{' '}
          <span style={{ color: '#f8fafc' }}>[WASD]</span> Move &bull;{' '}
          <span style={{ color: '#f8fafc' }}>[Space]</span> Jetpack &bull;{' '}
          <span style={{ color: '#f8fafc' }}>[LMB]</span> {tool === 'hand' ? 'Grab / Levitate' : 'Carve Voxel'} &bull;{' '}
          <span style={{ color: '#f8fafc' }}>[RMB]</span> Punt &bull;{' '}
          <span style={{ color: '#f8fafc' }}>[1 / 2 / 3]</span> Switch Tool
        </div>
      )}
    </>
  );
}
