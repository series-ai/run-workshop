import { useEffect, useState } from 'react'
import { SpriteCellCanvas } from '../components/SpriteCanvas'
import type { MicroRtsCatalog } from '../catalog'
import { LEAF_2D, LEAF_UI, PINS } from '../pins'

export function UiSpecTab({ catalog }: { catalog: MicroRtsCatalog }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 240)
    return () => window.clearInterval(iv)
  }, [])

  const cursors = catalog.ui.sprites.filter((s) => s.category === 'cursor')
  const markers = catalog.ui.sprites.filter((s) => s.category === 'marker')
  const icons = catalog.ui.sprites.filter((s) => s.category === 'icon')

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Pack Summary Stats */}
      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-val">{catalog.pack.counts.factionUnits ?? catalog.units.length}</div>
          <div className="stat-lbl">8-Way Faction Units (12 Two-Layer)</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{catalog.buildings.buildings.length}</div>
          <div className="stat-lbl">Grounded Buildings &amp; Props (7 States)</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{catalog.environment.biomes.length}</div>
          <div className="stat-lbl">Planet Biomes (8×8 Wang-16)</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{catalog.environment.objects.length}</div>
          <div className="stat-lbl">Terrain Objects &amp; Resources</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{catalog.environment.neutrals.length}</div>
          <div className="stat-lbl">Neutral 8-Way Units (2 Two-Layer)</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{catalog.vfx.length}</div>
          <div className="stat-lbl">Combat VFX Strips ({catalog.attacks.length} Profiles)</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{catalog.ui.sprites.length + catalog.ui.selectionRings.length * 4}</div>
          <div className="stat-lbl">UI Rings, Cursors, Pings &amp; Icons</div>
        </div>
      </div>

      {/* 4x4 Selection Rings */}
      <div className="card">
        <h3 className="section-title">4×4 Perspective Selection Rings (run-micro-rts/ui)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {catalog.ui.selectionRings.map((ring) => (
            <div key={ring.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span className="unit-id" style={{ width: 92 }}>
                {ring.id} ({ring.cellW}×{ring.cellH})
              </span>
              {ring.states.map((st, idx) => (
                <div key={st} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <SpriteCellCanvas leafId={LEAF_UI} path={ring.sheet} cellW={ring.cellW} cellH={ring.cellH} col={idx} scale={3} />
                  <span className="unit-id">{st}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Cursors, Markers, Icons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div className="card">
          <h3 className="section-title">8 Tactical Cursors (3×)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {cursors.map((c) => (
              <div key={c.id} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <SpriteCellCanvas leafId={LEAF_UI} path={c.sheet} cellW={c.cellW} cellH={c.cellH} col={tick % c.frames} scale={3} />
                <span className="unit-id">{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">5 World Order &amp; Placement Markers (3×)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {markers.map((m) => (
              <div key={m.id} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <SpriteCellCanvas leafId={LEAF_UI} path={m.sheet} cellW={m.cellW} cellH={m.cellH} col={tick % m.frames} scale={3} />
                <span className="unit-id">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">12 HUD Resource &amp; Command Icons (3×)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {icons.map((ic) => (
              <div key={ic.id} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <SpriteCellCanvas leafId={LEAF_UI} path={ic.sheet} cellW={ic.cellW} cellH={ic.cellH} col={0} scale={3} />
                <span className="unit-id">{ic.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pinned RUN SDK Loading Guide */}
      <div className="card">
        <h3 className="section-title">jam-ready-assets Pinned Loading (@series-inc/rundot-game-sdk)</h3>
        <div className="pill-row" style={{ marginBottom: 10 }}>
          <span className="tag accent">
            {LEAF_2D} @ {PINS[LEAF_2D]}
          </span>
          <span className="tag gold">
            {LEAF_UI} @ {PINS[LEAF_UI]}
          </span>
          <span className="tag">LicenseRef-RUN-Repository-Supplemental-1.0</span>
        </div>
        <pre className="code-block">{`import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const base2d = await RundotGameAPI.assetLibrary.getPackBaseUrl('${LEAF_2D}', '${PINS[LEAF_2D]}')
const baseUi = await RundotGameAPI.assetLibrary.getPackBaseUrl('${LEAF_UI}', '${PINS[LEAF_UI]}')

const roster = await fetch(\`\${base2d}/units/roster-manifest.json\`).then((r) => r.json())
// Draw with ctx.imageSmoothingEnabled = false for crisp 1x..4x pixel edges`}</pre>
      </div>
    </div>
  )
}
