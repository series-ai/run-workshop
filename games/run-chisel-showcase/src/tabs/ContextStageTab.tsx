import { Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState, type CSSProperties } from 'react'
import { BUDGETS } from '@chisel/contracts/budgets'
import type { PackCatalog } from '@chisel/contracts/catalog'
import { CONTEXT_PACK_KEYS } from '@chisel/contracts/packs'
import type { PolyPartIndex } from '../avatar/composePolyAvatar'
import { MultiContextStage } from '../scenes/MultiContextStage'
import { STAGE_LOOK, type StageContext } from '../scenes/stageLook'
import { STUDIO_GL } from '../scenes/studio'

const STAGE_CONTEXTS = [...CONTEXT_PACK_KEYS, 'all'] as const

export function ContextStageTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const [activeContext, setActiveContext] = useState<StageContext>('medieval')
  const [shadowMode, setShadowMode] = useState<'blob' | 'none'>('blob')
  const [reset, setReset] = useState(0)
  const [closeView, setCloseView] = useState(true)
  const [layoutId, setLayoutId] = useState('')
  const [showRoofs, setShowRoofs] = useState(false)
  const look = STAGE_LOOK[activeContext]
  const packCatalog = catalogs.find(({ pack }) => pack === activeContext)
  const packLabel = packCatalog?.label
  const kitLayouts = packCatalog?.constructionKit?.layouts
  const kitLayout = kitLayouts?.find(({ id }) => id === layoutId)
  const showCloseView = closeView && activeContext !== 'all' && !kitLayout
  const style = {
    '--stage-glow': look.glow,
    '--stage-backdrop': look.backdrop,
    '--stage-accent': look.accent,
  } as CSSProperties

  return (
    <section
      className="context-stage"
      aria-labelledby="context-stage-title"
      data-close-view={showCloseView || undefined}
      style={style}
    >
      <header className="context-stage-header">
        <div>
          {packLabel && <p className="context-stage-pack">{packLabel}</p>}
          <h2 id="context-stage-title">{kitLayout?.title ?? look.title}</h2>
          {kitLayouts && (
            <div className="context-stage-layout">
              <label htmlFor="context-stage-layout">Layout</label>
              <select id="context-stage-layout" value={layoutId} onChange={(event) => { setShowRoofs(false); setLayoutId(event.target.value) }}>
                <option value="">Showcase scene</option>
                {kitLayouts.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="context-stage-actions">
          <button className="pill-btn" aria-label="Shadows" aria-pressed={shadowMode === 'blob'} onClick={() => setShadowMode((s) => s === 'blob' ? 'none' : 'blob')}>
            Shadows {shadowMode === 'blob' ? 'on' : 'off'}
          </button>
          {activeContext !== 'all' && !kitLayout && (
            <button className="pill-btn" onClick={() => setCloseView((value) => !value)}>
              {closeView ? 'Full view' : 'Close view'}
            </button>
          )}
          {kitLayout?.props.some(({ hideWithRoof }) => hideWithRoof) && (
            <button className="pill-btn" aria-label="Roofs" aria-pressed={showRoofs} onClick={() => setShowRoofs((value) => !value)}>
              Roofs {showRoofs ? 'on' : 'off'}
            </button>
          )}
          <button className="pill-btn" onClick={() => setReset((n) => n + 1)}>Reset view</button>
        </div>
      </header>

      <div className="context-stage-canvas">
        <Canvas orthographic dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} camera={{ near: 0.1, far: 220, position: [0, 9, 14] }}>
          <Suspense fallback={
            <Html fullscreen style={{ pointerEvents: 'none' }}>
              <div className="context-stage-status">
                <span role="status">Loading scene…</span>
              </div>
            </Html>
          }>
            <MultiContextStage catalogs={catalogs} index={index} activeContext={activeContext} shadowMode={shadowMode} reset={reset} closeView={showCloseView} kitLayout={kitLayout} showRoofs={showRoofs} />
          </Suspense>
        </Canvas>
      </div>

      <div className="context-stage-picker-wrap">
        <div className="context-stage-picker" role="group" aria-label="Scene">
          {STAGE_CONTEXTS.map((ctx) => (
            <button
              key={ctx}
              aria-pressed={activeContext === ctx}
              onClick={() => { setLayoutId(''); setActiveContext(ctx) }}
            >
              {ctx === 'all' ? `All ${CONTEXT_PACK_KEYS.length}` : ctx === 'ww2' ? 'WW2' : ctx}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
