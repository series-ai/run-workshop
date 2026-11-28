import { useEffect, useMemo, useState } from 'react'
import { SpriteCellCanvas } from '../components/SpriteCanvas'
import { DIRS_8, type FactionId, type MicroRtsCatalog, type RosterUnitEntry } from '../catalog'
import { LEAF_2D } from '../pins'

type AnimClip = 'idle' | 'move' | 'attack' | 'death'

const CLIP_RANGES: Record<AnimClip, readonly [number, number]> = {
  idle: [0, 2],
  move: [2, 4],
  attack: [6, 4],
  death: [10, 2],
}

export function RosterTab({ catalog }: { catalog: MicroRtsCatalog }) {
  const [faction, setFaction] = useState<'all' | FactionId>('all')
  const [layer, setLayer] = useState<'all' | 'ground' | 'air'>('all')
  const [twoLayerOnly, setTwoLayerOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('V16')

  const [clip, setClip] = useState<AnimClip>('move')
  const [hullDir, setHullDir] = useState<number>(3) // SE
  const [turretDir, setTurretDir] = useState<number>(2) // E
  const [autoRotate, setAutoRotate] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [showMuzzle, setShowMuzzle] = useState(true)
  const [tick, setTick] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.allUnits.filter((u) => {
      if (faction !== 'all' && u.faction !== faction) return false
      if (layer !== 'all' && u.layer !== layer) return false
      if (twoLayerOnly && !u.twoLayer) return false
      if (q && !`${u.id} ${u.name} ${u.role} ${u.faction}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalog, faction, layer, twoLayerOnly, query])

  const selected: RosterUnitEntry = useMemo(
    () => catalog.allUnits.find((u) => u.id === selectedId) ?? catalog.allUnits[0]!,
    [catalog, selectedId],
  )

  const attack = catalog.attackByUnitId.get(selected.id)

  useEffect(() => {
    if (!playing && !autoRotate) return
    const iv = window.setInterval(() => {
      if (playing) setTick((t) => t + 1)
    }, 150)
    return () => window.clearInterval(iv)
  }, [playing, autoRotate])

  useEffect(() => {
    if (!autoRotate) return
    const iv = window.setInterval(() => {
      setHullDir((d) => (d + 1) % 8)
      setTurretDir((d) => (d + 7) % 8)
    }, 650)
    return () => window.clearInterval(iv)
  }, [autoRotate])

  const [clipStart, clipLen] = CLIP_RANGES[clip]
  const frameCol = clipStart + (tick % clipLen)
  const activeAimDir = DIRS_8[selected.twoLayer ? turretDir : hullDir]!
  const muzzlePt = showMuzzle ? (selected.muzzleCell8?.[activeAimDir] ?? null) : null

  return (
    <div className="split-view">
      <aside className="sidebar">
        <div>
          <h2 className="section-title">84-Unit 8-Way Roster ({filtered.length})</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ID, name, role (e.g. V16, tank, air)..."
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: '#0b111c',
              color: 'var(--text)',
              fontSize: 12.5,
            }}
          />
        </div>

        <div className="pill-row">
          {(['all', 'vanguard', 'kraxen', 'solaris', 'neutral'] as const).map((f) => (
            <button
              key={f}
              className={`pill ${f} ${faction === f ? 'active' : ''}`}
              onClick={() => setFaction(f)}
            >
              {f === 'all' ? 'All (84)' : f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="pill-row">
          {(['all', 'ground', 'air'] as const).map((l) => (
            <button key={l} className={`pill ${layer === l ? 'active' : ''}`} onClick={() => setLayer(l)}>
              {l[0]!.toUpperCase() + l.slice(1)}
            </button>
          ))}
          <button className={`pill ${twoLayerOnly ? 'active' : ''}`} onClick={() => setTwoLayerOnly((v) => !v)}>
            2-Layer Split (14)
          </button>
        </div>

        <div className="unit-grid">
          {filtered.map((u) => (
            <button
              key={u.id}
              className={`unit-card ${u.id === selected.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(u.id)}
            >
              <div className="unit-thumb">
                <SpriteCellCanvas
                  leafId={LEAF_2D}
                  path={u.sheet}
                  cellW={u.cellW}
                  cellH={u.cellH}
                  col={0}
                  row={3}
                  scale={Math.max(2, Math.min(3, Math.floor(54 / Math.max(u.cellW, u.cellH))))}
                />
              </div>
              <span className="unit-id">
                {u.id} {u.twoLayer ? '· 2L' : ''}
              </span>
              <span className="unit-name">{u.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="stage-pane">
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="pill-row" style={{ marginBottom: 6 }}>
              <span className="tag accent">{selected.id}</span>
              <span className="tag">{selected.faction.toUpperCase()}</span>
              <span className="tag">{selected.role}</span>
              <span className="tag">{selected.layer.toUpperCase()}</span>
              <span className="tag">
                {selected.cellW}×{selected.cellH}px
              </span>
              {selected.twoLayer && <span className="tag gold">2-Layer Independent Turret</span>}
              {attack && (
                <span className="tag good">
                  {attack.archetype} · {attack.colorTheme}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{selected.name}</h2>
          </div>

          <div className="pill-row">
            {(['idle', 'move', 'attack', 'death'] as const).map((c) => (
              <button key={c} className={`pill ${clip === c ? 'active' : ''}`} onClick={() => setClip(c)}>
                {c[0]!.toUpperCase() + c.slice(1)} ({CLIP_RANGES[c][1]}f)
              </button>
            ))}
            <button className={`pill ${playing ? 'active' : ''}`} onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className={`pill ${autoRotate ? 'active' : ''}`} onClick={() => setAutoRotate((r) => !r)}>
              Turntable
            </button>
            <button className={`pill ${showMuzzle ? 'active' : ''}`} onClick={() => setShowMuzzle((m) => !m)}>
              Muzzle Pin
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 280px', gap: 14 }}>
          <div className="checker-stage" style={{ minHeight: 280, padding: 20, flexDirection: 'column', gap: 14 }}>
            <SpriteCellCanvas
              leafId={LEAF_2D}
              path={selected.twoLayer && selected.hullSheet ? selected.hullSheet : selected.sheet}
              shadowPath={selected.twoLayer ? selected.shadowSheet : undefined}
              turretPath={selected.twoLayer ? selected.turretSheet : undefined}
              overlayPath={selected.overlaySheet}
              cellW={selected.cellW}
              cellH={selected.cellH}
              col={selected.twoLayer ? (clip === 'move' ? tick % 4 : 0) : frameCol}
              row={hullDir}
              shadowRow={hullDir}
              turretCol={clip === 'attack' ? tick % 4 : 0}
              turretRow={turretDir}
              overlayCol={tick % 4}
              scale={Math.max(5, Math.min(8, Math.floor(170 / Math.max(selected.cellW, selected.cellH))))}
              muzzlePoint={muzzlePt}
            />

            <div className="pill-row" style={{ gap: 12 }}>
              <div className="card-subtle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="section-title" style={{ margin: 0 }}>
                  1× Native
                </span>
                <SpriteCellCanvas
                  leafId={LEAF_2D}
                  path={selected.twoLayer && selected.hullSheet ? selected.hullSheet : selected.sheet}
                  shadowPath={selected.twoLayer ? selected.shadowSheet : undefined}
                  turretPath={selected.twoLayer ? selected.turretSheet : undefined}
                  cellW={selected.cellW}
                  cellH={selected.cellH}
                  col={selected.twoLayer ? (clip === 'move' ? tick % 4 : 0) : frameCol}
                  row={hullDir}
                  shadowRow={hullDir}
                  turretCol={clip === 'attack' ? tick % 4 : 0}
                  turretRow={turretDir}
                  scale={1}
                />
              </div>
              {muzzlePt && (
                <span className="tag">
                  muzzleCell8[{activeAimDir}] = [{muzzlePt[0]}, {muzzlePt[1]}]
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h3 className="section-title">{selected.twoLayer ? 'Hull Heading' : '8-Way Heading'}</h3>
              <div className="dir-grid">
                {[7, 0, 1, 6, -1, 2, 5, 4, 3].map((d) =>
                  d === -1 ? (
                    <div key="hull-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>
                      {DIRS_8[hullDir]}
                    </div>
                  ) : (
                    <button key={`hull-${d}`} className={`dir-btn ${hullDir === d ? 'active' : ''}`} onClick={() => setHullDir(d)}>
                      {DIRS_8[d]}
                    </button>
                  ),
                )}
              </div>
            </div>

            {selected.twoLayer && (
              <div>
                <h3 className="section-title">Independent Turret Aim</h3>
                <div className="dir-grid">
                  {[7, 0, 1, 6, -1, 2, 5, 4, 3].map((d) =>
                    d === -1 ? (
                      <div key="turret-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--accent-2)' }}>
                        {DIRS_8[turretDir]}
                      </div>
                    ) : (
                      <button key={`turret-${d}`} className={`dir-btn ${turretDir === d ? 'active' : ''}`} onClick={() => setTurretDir(d)}>
                        {DIRS_8[d]}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">All 8 Headings Strip ({clip.toUpperCase()} Frame {tick % clipLen})</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {DIRS_8.map((d, idx) => (
              <div
                key={d}
                onClick={() => setHullDir(idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 8,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: idx === hullDir ? '#172a42' : '#0f1623',
                  border: `1px solid ${idx === hullDir ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <SpriteCellCanvas
                  leafId={LEAF_2D}
                  path={selected.sheet}
                  cellW={selected.cellW}
                  cellH={selected.cellH}
                  col={frameCol}
                  row={idx}
                  scale={3}
                />
                <span className="unit-id">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
