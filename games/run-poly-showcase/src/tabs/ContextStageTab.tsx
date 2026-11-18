import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { BUDGETS } from '@poly/contracts/budgets'
import type { PackCatalog } from '@poly/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@poly/contracts/packs'
import type { PolyPartIndex } from '../avatar/composePolyAvatar'
import { MultiContextStage } from '../scenes/MultiContextStage'
import { STUDIO_GL, StudioLights } from '../scenes/studio'

export function ContextStageTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const [activeContext, setActiveContext] = useState<'all' | ContextPackKey>('all')
  const [shadowMode, setShadowMode] = useState<'blob' | 'none'>('blob')

  return (
    <div className="viewport-wrap stage-full">
      <Canvas dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} camera={{ position: [0, 4.0, 12.6], fov: 40 }}>
        <StudioLights reach={2} />
        <Suspense fallback={null}>
          <MultiContextStage
            catalogs={catalogs}
            index={index}
            activeContext={activeContext}
            shadowMode={shadowMode}
          />
        </Suspense>
        <OrbitControls target={[0, 0.35, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={24} />
      </Canvas>

      <div className="hud-overlay hud-dock-bottom">
        <div className="hud-card hud-strip" style={{ alignItems: 'center' }}>
          <span className="hud-strip-label">Context:</span>
          {(['all', ...CONTEXT_PACK_KEYS] as const).map((ctx) => (
            <button
              key={ctx}
              className={`pill-btn ${activeContext === ctx ? 'active' : ''}`}
              onClick={() => setActiveContext(ctx)}
            >
              {ctx === 'all' ? `All ${CONTEXT_PACK_KEYS.length}` : ctx.toUpperCase()}
            </button>
          ))}
          <span className="hud-sep" />
          <button
            className="pill-btn"
            onClick={() => setShadowMode((s) => (s === 'blob' ? 'none' : 'blob'))}
          >
            Shadows: {shadowMode === 'blob' ? 'Blob' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  )
}
