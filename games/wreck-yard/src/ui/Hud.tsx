import { useState } from 'react';
import type { MatchRequest, MatchSnapshot } from '../game/match';
import type { UiTool } from '../render/PointerInput';

const panel: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(20, 22, 20, 0.88)',
  color: '#e8ecd8',
  borderRadius: 8,
  border: '1px solid #3f4836',
  padding: '12px 14px',
  font: '13px/1.45 ui-sans-serif, system-ui, sans-serif',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
};

const button = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: active ? '1px solid #a3e635' : '1px solid #6d7a62',
  background: active ? '#9bbc0f' : '#2c3320',
  color: active ? '#101408' : '#e8ecd8',
  cursor: 'pointer',
  fontWeight: active ? 700 : 500,
  boxShadow: active ? '0 0 10px rgba(155, 188, 15, 0.35)' : 'none',
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
      {/* Top Left: Status & Yard Telemetry */}
      <div style={{ ...panel, top: 16, left: 16, minWidth: 260 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#9bbc0f', letterSpacing: '0.04em' }}>
          WRECK YARD
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['hand', 'torch', 'orbit'] as const).map((entry) => (
            <button key={entry} type="button" style={button(tool === entry)} onClick={() => onTool(entry)} disabled={!live}>
              {entry === 'hand' ? 'Gravity Gun (1)' : entry === 'torch' ? 'Plasma Torch (2)' : 'Orbit (3)'}
            </button>
          ))}
        </div>
        <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 12, color: '#c5ccb6' }}>
          <div>Bodies: <strong style={{ color: '#ffffff' }}>{render?.bodies.length ?? 0}</strong></div>
          <div>Floating: <strong style={{ color: '#5eead4' }}>{render?.floating ?? 0}</strong></div>
          <div>Torch cuts: <strong style={{ color: '#fb923c' }}>{render?.stats.torchCuts ?? 0}</strong></div>
          <div>Throws/Punts: <strong style={{ color: '#facc15' }}>{render?.stats.throws ?? 0}</strong></div>
          <div>Fractures: <strong style={{ color: '#f87171' }}>{render?.stats.fractures ?? 0}</strong></div>
          <div>Crew: <strong style={{ color: '#a3e635' }}>{render?.players?.length ?? 1}/4</strong></div>
        </div>
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #3f4836', fontSize: 11, color: '#8c967d' }}>
          Status: {snapshot.status}{snapshot.rollbackCount > 0 ? ` (rollbacks: ${snapshot.rollbackCount})` : ''}
          {snapshot.roomCode ? <span style={{ marginLeft: 8 }}>Room: <strong style={{ color: '#9bbc0f' }}>{snapshot.roomCode}</strong></span> : null}
          {snapshot.error ? <div style={{ color: '#f87171', marginTop: 4 }}>Error: {snapshot.error}</div> : null}
        </div>
      </div>

      {/* Top Right: Match & Room Manager */}
      <div style={{ ...panel, top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 210 }}>
        {live ? (
          <button type="button" style={button(false)} onClick={onStop}>Leave Match</button>
        ) : (
          <>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'solo' })}>Play Solo (4-Slot Yard)</button>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'quick' })}>Quick Match</button>
            <button type="button" style={button(false)} onClick={() => onStart({ kind: 'create' })}>Create Room</button>
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

      {/* Center: Tactical Salvage Crosshair */}
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
                width: isGrabbing ? 26 : 18,
                height: isGrabbing ? 26 : 18,
                borderRadius: '50%',
                border: isGrabbing ? '2px solid #f59e0b' : '2px solid rgba(251, 191, 36, 0.75)',
                boxShadow: isGrabbing ? '0 0 12px rgba(245, 158, 11, 0.8)' : 'none',
                transition: 'all 0.12s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fbbf24' }} />
            </div>
          ) : (
            <div
              style={{
                width: 20,
                height: 20,
                border: '2px solid #f97316',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 8px rgba(249, 115, 22, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 4, height: 4, background: '#fdba74' }} />
            </div>
          )}

          {isGrabbing && (
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: '#fbbf24', textShadow: '0 2px 6px black' }}>
              [RMB] PUNT OBJECT
            </div>
          )}
        </div>
      )}

      {/* Bottom Center: Industrial Analog Thruster Fuel Gauge */}
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
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c5ccb6', letterSpacing: '0.08em', textShadow: '0 1px 4px black' }}>
            THRUSTER FUEL [{fuelPercent}%]
          </div>
          <div
            style={{
              width: 220,
              height: 10,
              background: 'rgba(20, 24, 18, 0.9)',
              borderRadius: 6,
              border: '1px solid #4a543f',
              overflow: 'hidden',
              padding: 1,
              boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                width: `${fuelPercent}%`,
                height: '100%',
                background: fuelPercent > 25 ? 'linear-gradient(90deg, #65a30d, #9bbc0f)' : '#ea580c',
                borderRadius: 4,
                boxShadow: fuelPercent > 25 ? '0 0 8px #a3e635' : '0 0 8px #ea580c',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Left: Tactical Yard Controls */}
      {live && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(20, 22, 20, 0.82)',
            border: '1px solid #3f4836',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 11,
            color: '#8c967d',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#9bbc0f', fontWeight: 600 }}>[Click Canvas]</span> Look &bull;{' '}
          <span style={{ color: '#e8ecd8' }}>[WASD]</span> Move &bull;{' '}
          <span style={{ color: '#e8ecd8' }}>[Space]</span> Jetpack &bull;{' '}
          <span style={{ color: '#e8ecd8' }}>[LMB]</span> {tool === 'hand' ? 'Tractor Beam' : 'Carve Voxel'} &bull;{' '}
          <span style={{ color: '#e8ecd8' }}>[RMB]</span> Punt &bull;{' '}
          <span style={{ color: '#e8ecd8' }}>[1 / 2 / 3]</span> Tool
        </div>
      )}
    </>
  );
}
