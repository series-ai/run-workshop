import React, { useEffect, useState } from 'react';
import { telemetry, type PerformanceSnapshot } from '../render/telemetry.js';

export const PerformanceOverlay: React.FC = () => {
  const [visible, setVisible] = useState(telemetry.isOverlayVisible());
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(() => telemetry.getSnapshot());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F3') {
        e.preventDefault();
        setVisible(telemetry.toggleOverlay());
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const unsub = telemetry.subscribe((snap) => {
      setSnapshot({ ...snap });
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsub();
    };
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(telemetry.toggleOverlay())}
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 900,
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: '#38bdf8',
          fontFamily: 'monospace',
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }}
        title="Toggle Performance Telemetry HUD (or press F3)"
      >
        FPS: {snapshot.fps}
      </button>
    );
  }

  const fpsColor = snapshot.fps >= 58 ? '#4ade80' : snapshot.fps >= 45 ? '#f59e0b' : '#ef4444';
  const hasSpikes = snapshot.spikes33ms > 0 || snapshot.spikes50ms > 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 950,
        background: 'rgba(9, 13, 20, 0.92)',
        border: '1px solid #1f293d',
        borderRadius: '6px',
        padding: '12px 16px',
        color: '#f1f5f9',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: 1.6,
        minWidth: '220px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
        <span style={{ fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em' }}>PERF TELEMETRY [F3]</span>
        <button
          onClick={() => setVisible(telemetry.toggleOverlay())}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', padding: 0 }}
        >
          &times;
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>FRAMERATE:</span>
        <strong style={{ color: fpsColor }}>{snapshot.fps} FPS <span style={{ color: '#94a3b8', fontSize: '10px' }}>(1% {snapshot.fpsOnePercentLow})</span></strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>FRAME TIME:</span>
        <span>{snapshot.frameTimeMs}ms <span style={{ color: '#94a3b8', fontSize: '10px' }}>({snapshot.frameTimeAvgMs} avg)</span></span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>DRAW CALLS:</span>
        <span style={{ color: '#f59e0b' }}>{snapshot.drawCalls}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>TRIANGLES:</span>
        <span>{(snapshot.triangles / 1000).toFixed(1)}k</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>ACTIVE ENTITIES:</span>
        <span>{snapshot.activeProjectiles} Proj | {snapshot.activeParticles} PFX</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8' }}>REACT RENDERS:</span>
        <span style={{ color: snapshot.appRenderCount <= 5 ? '#4ade80' : '#f59e0b' }}>{snapshot.appRenderCount} (Decoupled)</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #1e293b' }}>
        <span style={{ color: '#94a3b8' }}>SPIKES (&gt;33ms):</span>
        <span style={{ color: hasSpikes ? '#ef4444' : '#4ade80', fontWeight: 700 }}>{snapshot.spikes33ms}</span>
      </div>
    </div>
  );
};
