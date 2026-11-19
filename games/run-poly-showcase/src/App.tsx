import { useEffect, useMemo, useState } from 'react'
import { PolyPartIndex } from './avatar/composePolyAvatar'
import { loadAllCatalogs, type PolyCatalogBundle } from './catalog'
import { AvatarLabTab } from './tabs/AvatarLabTab'
import { ContextStageTab } from './tabs/ContextStageTab'
import { OverviewTab } from './tabs/OverviewTab'
import { PerfBenchTab } from './tabs/PerfBenchTab'

type TabId = 'overview' | 'lab' | 'stage' | 'perf'

export function App() {
  const [tab, setTab] = useState<TabId>('lab')
  const [bundle, setBundle] = useState<PolyCatalogBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAllCatalogs()
      .then(setBundle)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const index = useMemo(() => (bundle ? new PolyPartIndex(bundle.ordered) : null), [bundle])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge">RUN Poly<span className="hide-compact"> Packs</span></span>
          <h1>Modular Avatar &amp; Context Workshop</h1>
        </div>
        <nav className="tabs" aria-label="Workshop sections">
          <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            <span className="hide-compact">Architecture &amp; </span>Spec
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
            <code>tools/run-poly-packs</code>.
          </div>
        )}
        {!error && (!bundle || !index) && (
          <div style={{ padding: 24, color: 'var(--muted)' }}>Loading RUN Poly Pack catalogs…</div>
        )}
        {bundle && index && (
          <>
            {tab === 'overview' && <OverviewTab catalogs={bundle.ordered} onNavigate={setTab} />}
            {tab === 'lab' && <AvatarLabTab catalogs={bundle.ordered} index={index} />}
            {tab === 'stage' && <ContextStageTab catalogs={bundle.ordered} index={index} />}
            {tab === 'perf' && <PerfBenchTab catalogs={bundle.ordered} index={index} />}
          </>
        )}
      </main>
    </div>
  )
}
