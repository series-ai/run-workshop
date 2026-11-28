import { useEffect, useMemo, useState } from 'react'
import { SpriteCellCanvas } from '../components/SpriteCanvas'
import type { BuildingEntry, MicroRtsCatalog } from '../catalog'
import { LEAF_2D } from '../pins'

const STATES = ['build_1', 'build_2', 'idle', 'active_0', 'active_1', 'damaged', 'rubble'] as const

export function BuildingsTab({ catalog }: { catalog: MicroRtsCatalog }) {
  const [faction, setFaction] = useState<string>('all')
  const [stateIdx, setStateIdx] = useState<number>(2) // idle
  const [animateActive, setAnimateActive] = useState(true)
  const [zoom, setZoom] = useState<1 | 3 | 4>(3)
  const [selectedId, setSelectedId] = useState<string>('vanguard-bastion')
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!animateActive) return
    const iv = window.setInterval(() => setPulse((p) => (p + 1) % 2), 340)
    return () => window.clearInterval(iv)
  }, [animateActive])

  const buildings = useMemo(
    () =>
      catalog.buildings.buildings.filter((b) => {
        if (faction === 'all') return true
        return b.faction === faction
      }),
    [catalog, faction],
  )

  const selected: BuildingEntry = useMemo(
    () => catalog.buildings.buildings.find((b) => b.id === selectedId) ?? catalog.buildings.buildings[0]!,
    [catalog, selectedId],
  )

  const effectiveCol = animateActive && (stateIdx === 3 || stateIdx === 4) ? 3 + pulse : stateIdx

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div className="pill-row">
          {(['all', 'vanguard', 'kraxen', 'solaris', 'neutral'] as const).map((f) => (
            <button key={f} className={`pill ${f} ${faction === f ? 'active' : ''}`} onClick={() => setFaction(f)}>
              {f === 'all' ? `All (${catalog.buildings.buildings.length})` : f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="pill-row">
          {STATES.map((s, idx) => (
            <button key={s} className={`pill ${stateIdx === idx ? 'active' : ''}`} onClick={() => setStateIdx(idx)}>
              {s}
            </button>
          ))}
        </div>

        <div className="pill-row">
          {([1, 3, 4] as const).map((z) => (
            <button key={z} className={`pill ${zoom === z ? 'active' : ''}`} onClick={() => setZoom(z)}>
              {z}×
            </button>
          ))}
          <button className={`pill ${animateActive ? 'active' : ''}`} onClick={() => setAnimateActive((a) => !a)}>
            Active Loop
          </button>
        </div>
      </div>

      {/* Selected Building 7-State Filmstrip */}
      {selected.stateSheet && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {selected.name} <span style={{ color: 'var(--muted)', fontSize: 13 }}>({selected.id})</span>
              </h2>
            </div>
            <div className="pill-row">
              <span className="tag">{selected.faction}</span>
              <span className="tag">{selected.role}</span>
              <span className="tag">
                core {selected.coreWidth}×{selected.coreHeight}px · state cell {selected.stateCellW}×{selected.stateCellH}px
              </span>
              <span className="tag accent">
                anchor ({selected.stateAnchorX ?? selected.anchorX}, {selected.stateAnchorY ?? selected.anchorY})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {STATES.map((st, idx) => (
              <div
                key={st}
                onClick={() => setStateIdx(idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 10,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: idx === stateIdx ? '#172a42' : '#0f1623',
                  border: `1px solid ${idx === stateIdx ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <SpriteCellCanvas
                  leafId={LEAF_2D}
                  path={selected.stateSheet!}
                  cellW={selected.stateCellW ?? selected.width}
                  cellH={selected.stateCellH ?? selected.height}
                  col={idx}
                  scale={3}
                />
                <span className="unit-id">{st}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Building Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 10 }}>
        {buildings.map((b) => {
          const hasStates = Boolean(b.stateSheet)
          return (
            <button
              key={b.id}
              className={`unit-card ${b.id === selected.id ? 'selected' : ''}`}
              style={{ padding: 12 }}
              onClick={() => setSelectedId(b.id)}
            >
              <div className="checker-stage" style={{ width: '100%', height: 112 }}>
                <SpriteCellCanvas
                  leafId={LEAF_2D}
                  path={hasStates ? b.stateSheet! : b.idleSheet}
                  cellW={hasStates ? (b.stateCellW ?? b.width) : b.width}
                  cellH={hasStates ? (b.stateCellH ?? b.height) : b.height}
                  col={hasStates ? effectiveCol : 0}
                  scale={zoom}
                />
              </div>
              <span className="unit-id">
                {b.faction} · {b.role}
              </span>
              <span className="unit-name">{b.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
