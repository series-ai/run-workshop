import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { BUDGETS } from '@poly/contracts/budgets'
import type { PackCatalog } from '@poly/contracts/catalog'
import type { PolyPartIndex } from '../avatar/composePolyAvatar'
import { MultiContextStage } from '../scenes/MultiContextStage'

export function ContextStageTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const [activeContext, setActiveContext] = useState<'all' | 'medieval' | 'ww2' | 'sim'>('all')
  const [shadowMode, setShadowMode] = useState<'blob' | 'none'>('blob')

  return (
    <div className="viewport-wrap" style={{ height: 'calc(100vh - 58px)' }}>
      <Canvas dpr={[1, BUDGETS.mobilePolicy.maxDpr]} camera={{ position: [0, 4.2, 10.5], fov: 40 }}>
        <color attach="background" args={['#0b1019']} />
        <hemisphereLight args={['#e2edff', '#28303e', 0.95]} />
        <directionalLight position={[6, 10, 6]} intensity={1.35} />
        <directionalLight position={[-6, 4, -5]} intensity={0.45} color="#7bb4f0" />
        <Suspense fallback={null}>
          <MultiContextStage
            catalogs={catalogs}
            index={index}
            activeContext={activeContext}
            shadowMode={shadowMode}
          />
        </Suspense>
        <OrbitControls target={[0, 1.0, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={22} />
      </Canvas>

      <div className="hud-overlay">
        <div className="hud-card" style={{ alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Context Filter:</span>
          {(['all', 'medieval', 'ww2', 'sim'] as const).map((ctx) => (
            <button
              key={ctx}
              className={`pill-btn ${activeContext === ctx ? 'active' : ''}`}
              onClick={() => setActiveContext(ctx)}
            >
              {ctx === 'all' ? 'All 3 Contexts' : ctx.toUpperCase()}
            </button>
          ))}
          <span style={{ width: 8 }} />
          <button
            className="pill-btn"
            onClick={() => setShadowMode((s) => (s === 'blob' ? 'none' : 'blob'))}
          >
            Shadows: {shadowMode === 'blob' ? 'Blob (Mobile)' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  )
}
