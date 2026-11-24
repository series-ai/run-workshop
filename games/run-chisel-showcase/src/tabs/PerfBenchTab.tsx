import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { BUDGETS } from '@chisel/contracts/budgets'
import type { PackCatalog } from '@chisel/contracts/catalog'
import type { PolyPartIndex } from '../avatar/composePolyAvatar'
import { PerfBenchStage, type PerfTelemetry } from '../scenes/PerfBenchStage'
import { STUDIO_GL, StudioLights } from '../scenes/studio'

const COUNTS = [1, 12, 24, 36, 48, 64] as const

export function PerfBenchTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const [avatarCount, setAvatarCount] = useState<number>(24)
  const [mobileMode, setMobileMode] = useState(true)
  const [lodThrottle, setLodThrottle] = useState(true)
  const [telemetry, setTelemetry] = useState<PerfTelemetry>({
    fps: 0,
    frameMs: 0,
    p95FrameMs: 0,
    mixerCpuMs: 0,
    drawCalls: 0,
    triangles: 0,
    avatarCount: 24,
  })

  const budgetOk = telemetry.frameMs > 0 ? telemetry.p95FrameMs <= 8.33 : true

  return (
    <div className="viewport-wrap stage-full">
      <Canvas
        dpr={mobileMode ? [1, BUDGETS.mobilePolicy.maxDpr] : [1, 2]}
        gl={STUDIO_GL}
        camera={{ position: [0, 9.0, 20.0], fov: 42 }}
      >
        <StudioLights reach={2.4} fill={false} />
        <Suspense fallback={null}>
          <PerfBenchStage
            catalogs={catalogs}
            index={index}
            avatarCount={avatarCount}
            mobileMode={mobileMode}
            lodThrottle={lodThrottle}
            onTelemetry={setTelemetry}
          />
        </Suspense>
        <OrbitControls target={[0, 1.0, 0]} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>

      <div className="hud-overlay perf-hud-top">
        <div className="hud-card perf-controls-desktop" style={{ alignItems: 'center' }}>
          <span className="hud-strip-label">Animated Crowd:</span>
          {COUNTS.map((n) => (
            <button
              key={n}
              className={`pill-btn ${avatarCount === n ? 'active' : ''}`}
              onClick={() => setAvatarCount(n)}
            >
              {n}
            </button>
          ))}
          <button
            className={`pill-btn ${mobileMode ? 'active' : ''}`}
            onClick={() => setMobileMode((v) => !v)}
          >
            S23 Ultra Policy: {mobileMode ? 'ON (DPR<=1.5, Blob)' : 'OFF'}
          </button>
          <button
            className={`pill-btn ${lodThrottle ? 'active' : ''}`}
            onClick={() => setLodThrottle((v) => !v)}
          >
            LOD Mixer Throttle: {lodThrottle ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="hud-card perf-metrics-card">
          <div className="metric">
            <span className="metric-label">FPS</span>
            <span className={`metric-val ${telemetry.fps >= 55 ? 'good' : 'warn'}`}>{telemetry.fps}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Frame p95</span>
            <span className={`metric-val ${budgetOk ? 'good' : 'warn'}`}>
              {telemetry.p95FrameMs.toFixed(2)} ms
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Mixer CPU</span>
            <span className="metric-val">{telemetry.mixerCpuMs.toFixed(2)} ms</span>
          </div>
          <div className="metric">
            <span className="metric-label">Draw Calls</span>
            <span className="metric-val good">{telemetry.drawCalls}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Triangles</span>
            <span className="metric-val">{telemetry.triangles.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="hud-overlay hud-dock-bottom perf-controls-compact">
        <div className="hud-card hud-strip" style={{ alignItems: 'center' }}>
          <span className="hud-strip-label">Crowd:</span>
          {COUNTS.map((n) => (
            <button
              key={n}
              className={`pill-btn ${avatarCount === n ? 'active' : ''}`}
              onClick={() => setAvatarCount(n)}
            >
              {n}
            </button>
          ))}
          <span className="hud-sep" />
          <button
            className={`pill-btn ${mobileMode ? 'active' : ''}`}
            onClick={() => setMobileMode((v) => !v)}
          >
            S23: {mobileMode ? 'ON' : 'OFF'}
          </button>
          <button
            className={`pill-btn ${lodThrottle ? 'active' : ''}`}
            onClick={() => setLodThrottle((v) => !v)}
          >
            LOD: {lodThrottle ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}
