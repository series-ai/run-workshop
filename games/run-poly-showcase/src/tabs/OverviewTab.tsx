import { BUDGETS } from '@poly/contracts/budgets'
import { POLY_PACKS } from '@poly/contracts/packs'
import { RIG_SPECS, UAL1_CLIPS, UAL1_JOINTS } from '@poly/contracts/rig'
import type { PackCatalog } from '@poly/contracts/catalog'

export function OverviewTab({
  catalogs,
  onNavigate,
}: {
  catalogs: PackCatalog[]
  onNavigate: (tab: 'lab' | 'stage' | 'perf') => void
}) {
  const totalParts = catalogs.reduce((s, c) => s + c.parts.length, 0)
  const totalHeld = catalogs.reduce((s, c) => s + c.heldItems.length, 0)
  const totalProps = catalogs.reduce((s, c) => s + c.props.length, 0)
  const totalPresets = catalogs.reduce((s, c) => s + c.presets.length, 0)

  return (
    <div className="overview-page">
      <div className="hero-card">
        <h2>RUN Poly Packs — Configurable Low-Poly Avatar & Context System</h2>
        <p>
          One canonical <strong>{UAL1_JOINTS.length}-joint Quaternius UAL1 CC0 skeleton</strong> with{' '}
          <strong>{UAL1_CLIPS.length} animation clips</strong> plus procedural{' '}
          <strong>23-joint Quadruped</strong> and <strong>28-joint Arachnid</strong> rigs driving faceted characters,
          non-uniform monsters, parametric outfits, held weapons/tools, and world props across{' '}
          <strong>Medieval</strong>, <strong>WW2</strong>, <strong>Sim</strong>, and <strong>Monsters</strong>{' '}
          contexts — engineered for <strong>120 Hz on Samsung Galaxy S23 Ultra</strong> and staged for{' '}
          <code>jam-ready-assets</code> + <code>@series-inc/rundot-game-sdk</code>.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => onNavigate('lab')}>
            Open Parametric Avatar Lab
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('stage')}>
            View 4-Context Stage
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('perf')}>
            Run S23 Ultra Perf Bench
          </button>
        </div>
      </div>

      <div className="card-grid">
        <div className="info-card">
          <h3>PoC Inventory ({totalParts + totalHeld + totalProps} Assets)</h3>
          <ul>
            <li><strong>{totalParts}</strong> modular rigged avatar &amp; creature parts</li>
            <li><strong>{totalHeld}</strong> canonical-grip handheld items (<code>hand_r</code> / <code>hand_l</code>)</li>
            <li><strong>{totalProps}</strong> grounded world props</li>
            <li><strong>{totalPresets}</strong> cross-context character &amp; monster presets</li>
            <li>
              <strong>{UAL1_CLIPS.length}</strong> UAL1 clips + <strong>{RIG_SPECS.quadruped.clips.length}</strong> Quadruped &amp;{' '}
              <strong>{RIG_SPECS.arachnid.clips.length}</strong> Arachnid clips
            </li>
          </ul>
        </div>

        <div className="info-card">
          <h3>Faceted Visual Direction</h3>
          <ul>
            <li><strong>F1–F2</strong>: Faceted heroic silhouettes (8–10 sided limbs, beveled plates)</li>
            <li><strong>S1–S2</strong>: Hard split-normal shading, 1 shared <code>Poly_Atlas_Mat</code></li>
            <li><strong>S3</strong>: 7-region UV palette + AO ramp (Skin, Hair, Eye, Primary, Secondary, Accent, Metal)</li>
            <li><strong>C1–C3</strong>: Controlled value/saturation envelope with crisp accent pops</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>S23 Ultra 120 Hz Law</h3>
          <ul>
            <li>Composed avatar budget: <strong>&le; {BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar} tris</strong></li>
            <li>Draw calls per avatar: <strong>&le; {BUDGETS.mobilePolicy.maxDrawCallsPerAvatar}</strong> (1 shader program)</li>
            <li>Shadow maps: <strong>disabled</strong> (shared radial blob shadow)</li>
            <li>DPR cap: <strong>{BUDGETS.mobilePolicy.maxDpr}</strong> &middot; Distance mixer throttling (30/15 Hz)</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>jam-ready-assets &amp; RUN SDK</h3>
          <ul>
            {Object.values(POLY_PACKS).map((p) => (
              <li key={p.dir}>
                <code>{p.dir}</code> ({p.license === 'CC0-1.0' ? 'CC0-1.0' : 'RUN Supp. v1.0'})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
