/**
 * PFX: every effect a pack defines or binds, played on a stage on its own or
 * on a model that binds it.
 */
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { isPfxOneShot, PfxById, pfxLabel, RVX_EFFECT_IDS } from '@rvx-pfx'
import { Suspense, useMemo, useRef, useState } from 'react'
import type { PackCatalog, VoxelModelEntry } from '@rvx/contracts/catalog'
import type { PackKey } from '@rvx/contracts/packs'
import { PackBadge, PackFilter, type PackChoice } from '../PackFilter'
import { ONE_SHOT_REPLAY_SECONDS } from '../pfx/SocketPfx'
import { CameraCommands, FitCamera, getModelPreviewYaw, PackCanvas, PackModel, useCommandBus, ViewerErrorBoundary, ViewerFrame } from '../pack3d'

interface EffectRow {
  id: string
  pack: PackKey
  usedBy: VoxelModelEntry[]
}

const ROOT = 'pfx-subject'

/** An effect on its own: loops run; one-shots replay every few seconds. */
function StagePfx({ effectId }: { effectId: string }) {
  const [play, setPlay] = useState(0)
  useFrame((state) => {
    const cycle = Math.floor(state.clock.elapsedTime / ONE_SHOT_REPLAY_SECONDS)
    if (isPfxOneShot(effectId) && cycle !== play) setPlay(cycle)
  })
  return <PfxById effectId={effectId} playKey={play} />
}

export function PfxStage({ catalogs }: { catalogs: PackCatalog[] }) {
  const [pack, setPack] = useState<PackChoice>('all')
  const rows = useMemo(() => {
    const out = new Map<string, EffectRow>()
    for (const c of catalogs) {
      if (c.pack === 'pirate') continue
      const own = RVX_EFFECT_IDS.filter((id) => id.startsWith(`rvx-${c.pack}-`))
      for (const id of [...own, ...c.pfx.effects]) {
        const key = `${c.pack}:${id}`
        if (!out.has(key)) out.set(key, { id, pack: c.pack, usedBy: [] })
      }
      for (const m of c.models) for (const b of m.pfx) out.get(`${c.pack}:${b.effectId}`)?.usedBy.push(m)
    }
    return [...out.values()].filter((r) => pack === 'all' || r.pack === pack)
  }, [catalogs, pack])
  const [selected, setSelected] = useState<string | null>(null)
  const [onModel, setOnModel] = useState(true)
  const bus = useCommandBus()
  const [resets, setResets] = useState(0)
  const detailRef = useRef<HTMLHeadingElement>(null)
  const select = (key: string) => {
    setSelected(key)
    if (window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        detailRef.current?.focus({ preventScroll: true })
      })
    }
  }
  const active = rows.find((r) => `${r.pack}:${r.id}` === selected) ?? rows[0] ?? null
  const model = onModel ? active?.usedBy[0] : undefined
  // Run the clip that triggers the effect, if its binding is clip-triggered.
  const trigger = model?.pfx.find((b) => b.effectId === active?.id)?.trigger
  const modelClip = trigger?.startsWith('clip:') ? trigger.slice(5) : undefined
  const byPack = new Map(catalogs.map((c) => [c.pack, c]))

  return (
    <div className="gallery with-detail">
      <section className="gallery-list">
        <PackFilter catalogs={catalogs.filter((c) => c.pack !== 'pirate')} value={pack} onChange={setPack} />
        {rows.length === 0 ? (
          <div className="empty">No effects in this pack yet.</div>
        ) : (
          <div className="pfx-list" role="listbox" aria-label="Effects">
            {rows.map((r) => (
              <button
                key={`${r.pack}:${r.id}`}
                type="button"
                role="option"
                aria-selected={active === r}
                data-effect-id={r.id}
                className={active === r ? 'model-card selected' : 'model-card'}
                onClick={() => select(`${r.pack}:${r.id}`)}
              >
                <span className="model-card-name">{pfxLabel(r.id)}</span>
                <span className="model-card-meta">
                  {r.id} · {r.id.startsWith('rvx-') ? 'pack effect' : 'catalog effect'} · used by {r.usedBy.length}
                </span>
                <PackBadge catalog={byPack.get(r.pack)!} />
              </button>
            ))}
          </div>
        )}
      </section>
      <aside className="gallery-detail">
        {active ? (
          <>
            <div className="gallery-detail-header">
              <h2 ref={detailRef} tabIndex={-1}>{pfxLabel(active.id)}</h2>
              {active.usedBy.length > 0 && (
                <button type="button" className={onModel ? 'toggle active' : 'toggle'} aria-pressed={onModel} onClick={() => setOnModel((v) => !v)}>
                  On {active.usedBy[0]!.name}
                </button>
              )}
            </div>
            <div className="model-viewer">
              <ViewerFrame bus={bus} label={`Effect preview: ${pfxLabel(active.id)}`} onReset={() => setResets((n) => n + 1)}>
              <ViewerErrorBoundary resetKey={`${active.id}:${model?.id ?? ''}`}>
                <PackCanvas>
                  <Suspense fallback={null}>
                    {model ? (
                      <PackModel key={model.id} entry={model} name={ROOT} anchor="native" rotationY={getModelPreviewYaw(model.category)} clip={modelClip} pfx pfxOnly={active.id} />
                    ) : (
                      <group name={ROOT}>
                        <mesh visible={false} position={[0, 1, 0]}>
                          <boxGeometry args={[2.5, 2.5, 2.5]} />
                        </mesh>
                        {/* RVX effects are drawn at nominal size 1; show them at 2 units in the 2.5-unit frame. */}
                        <group scale={2}>
                          <StagePfx key={active.id} effectId={active.id} />
                        </group>
                      </group>
                    )}
                  </Suspense>
                  <gridHelper args={[10, 20, '#26303f', '#1a2331']} />
                  <OrbitControls makeDefault />
                  <CameraCommands bus={bus} />
                  <FitCamera rootName={ROOT} fitKey={`${active.id}:${model?.id ?? ''}:${resets}`} targetMode="center" margin={1.6} />
                </PackCanvas>
              </ViewerErrorBoundary>
              </ViewerFrame>
            </div>
            <div className="viewer-readout" data-testid="pfx-readout">
              {active.usedBy.length > 0 ? `Bound on: ${active.usedBy.map((m) => m.name).join(', ')}` : 'Not bound to a model yet'}
            </div>
          </>
        ) : (
          <div className="empty">Nothing selected</div>
        )}
      </aside>
    </div>
  )
}
