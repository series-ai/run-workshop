import { useEffect, useMemo, useState } from 'react'
import { PolyPartIndex } from './avatar/composePolyAvatar'
import { loadAllCatalogs, type PolyCatalogBundle } from './catalog'
import { AvatarLabTab } from './tabs/AvatarLabTab'
import { ContextStageTab } from './tabs/ContextStageTab'
import { GalleryTab } from './tabs/GalleryTab'
import { OverviewTab } from './tabs/OverviewTab'
import { PerfBenchTab } from './tabs/PerfBenchTab'

export type TabId = 'overview' | 'gallery' | 'lab' | 'stage' | 'perf'

export function App() {
  const [tab, setTab] = useState<TabId>('lab')
  const [labPresetId, setLabPresetId] = useState<string | null>(null)
  const [bundle, setBundle] = useState<PolyCatalogBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAllCatalogs()
      .then(setBundle)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const index = useMemo(() => (bundle ? new PolyPartIndex(bundle.ordered) : null), [bundle])

  const inspectInLab = (presetId: string) => {
    setLabPresetId(presetId)
    setTab('lab')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge">RUN Chisel<span className="hide-compact"> Packs</span></span>
          <h1>Modular Avatar &amp; Context Workshop</h1>
        </div>
        <nav className="tabs" aria-label="Workshop sections">
          <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            <span className="hide-compact">Architecture &amp; </span>Spec
          </button>
          <button className={`tab-btn ${tab === 'gallery' ? 'active' : ''}`} onClick={() => setTab('gallery')}>
            <span className="hide-compact">Asset </span>Gallery
          </button>
          <button className={`tab-btn ${tab === 'lab' ? 'active' : ''}`} onClick={() => setTab('lab')}>
            <span className="hide-compact">Parametric </span>Avatar Lab
          </button>
          <button className={`tab-btn ${tab === 'stage' ? 'active' : ''}`} onClick={() => setTab('stage')}>
            Context Stage<span className="hide-compact"> (Medieval · WW2 · Sim · Cyberpunk · Monsters)</span>
          </button>
          <button className={`tab-btn ${tab === 'perf' ? 'active' : ''}`} onClick={() => setTab('perf')}>
            <span className="hide-compact">S23 Ultra </span>Perf Bench
          </button>
        </nav>
      </header>

      <main className="main-area">
        {error && (
          <div style={{ padding: 24, color: 'var(--bad)' }}>
            Failed to load catalogs: {error}. Run <code>npm run build &amp;&amp; npm run catalog</code> in{' '}
            <code>tools/run-chisel-packs</code>.
          </div>
        )}
        {!error && (!bundle || !index) && (
          <div style={{ padding: 24, color: 'var(--muted)' }}>Loading RUN Chisel Pack catalogs…</div>
        )}
        {bundle && index && (
          <>
            {tab === 'overview' && <OverviewTab catalogs={bundle.ordered} onNavigate={setTab} />}
            {tab === 'gallery' && <GalleryTab catalogs={bundle.ordered} index={index} onInspectInLab={inspectInLab} />}
            {tab === 'lab' && <AvatarLabTab key={labPresetId ?? 'default'} catalogs={bundle.ordered} index={index} initialPresetId={labPresetId} />}
            {tab === 'stage' && <ContextStageTab catalogs={bundle.ordered} index={index} />}
            {tab === 'perf' && <PerfBenchTab catalogs={bundle.ordered} index={index} />}
          </>
        )}
      </main>
    </div>
  )
}
