import { useEffect, useMemo, useState } from 'react'
import { PolyPartIndex } from './avatar/composePolyAvatar'
import { loadAllCatalogs, type PolyCatalogBundle } from './catalog'
import { AnimationReviewerTab } from './tabs/AnimationReviewerTab'
import { AvatarLabTab } from './tabs/AvatarLabTab'
import { ContextStageTab } from './tabs/ContextStageTab'
import { LevelKitsTab } from './tabs/LevelKitsTab'
import { OverviewTab } from './tabs/OverviewTab'
import { PerfBenchTab } from './tabs/PerfBenchTab'

export type TabId = 'overview' | 'lab' | 'reviewer' | 'stage' | 'levels' | 'perf'

function readInitialTab(): TabId {
  try {
    const param = new URLSearchParams(window.location.search).get('tab')
    if (param === 'overview' || param === 'lab' || param === 'reviewer' || param === 'stage' || param === 'levels' || param === 'perf') {
      return param
    }
  } catch {
    // Ignore non-browser environments.
  }
  return 'lab'
}

export function App() {
  const [tab, setTab] = useState<TabId>(readInitialTab)
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
          <span className="brand-badge">RUN Cubix</span>
          <h1>Orthogonal Voxel Character &amp; Context Workshop</h1>
        </div>
        <nav className="tabs">
          <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            Art Direction &amp; Spec
          </button>
          <button className={`tab-btn ${tab === 'lab' ? 'active' : ''}`} onClick={() => setTab('lab')}>
            Parametric Voxel Lab
          </button>
          <button className={`tab-btn ${tab === 'reviewer' ? 'active' : ''}`} onClick={() => setTab('reviewer')}>
            Animation Reviewer
          </button>
          <button className={`tab-btn ${tab === 'stage' ? 'active' : ''}`} onClick={() => setTab('stage')}>
            Context Stage (Heist · Industrial · Security · Creatures · Fantasy)
          </button>
          <button className={`tab-btn ${tab === 'levels' ? 'active' : ''}`} onClick={() => setTab('levels')}>
            Level Kits
          </button>
          <button className={`tab-btn ${tab === 'perf' ? 'active' : ''}`} onClick={() => setTab('perf')}>
            S23 Ultra Perf Bench
          </button>
        </nav>
      </header>

      <main className="main-area">
        {error && (
          <div style={{ padding: 24, color: 'var(--bad)' }}>
            Failed to load catalogs: {error}. Run <code>npm run build &amp;&amp; npm run catalog</code> in{' '}
            <code>tools/run-voxel-characters</code>.
          </div>
        )}
        {!error && (!bundle || !index) && (
          <div style={{ padding: 24, color: 'var(--muted)' }}>Loading RUN Cubix catalogs…</div>
        )}
        {bundle && index && (
          <>
            {tab === 'overview' && <OverviewTab catalogs={bundle.ordered} onNavigate={setTab} />}
            {tab === 'lab' && <AvatarLabTab catalogs={bundle.ordered} index={index} />}
            {tab === 'reviewer' && <AnimationReviewerTab catalogs={bundle.ordered} index={index} />}
            {tab === 'stage' && <ContextStageTab catalogs={bundle.ordered} index={index} />}
            {tab === 'levels' && <LevelKitsTab bundle={bundle} index={index} />}
            {tab === 'perf' && <PerfBenchTab catalogs={bundle.ordered} index={index} />}
          </>
        )}
      </main>
    </div>
  )
}
