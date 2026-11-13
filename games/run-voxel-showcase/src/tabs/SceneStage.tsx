/**
 * Scene: world-space models from mixed packs on one ground plane at their
 * NATIVE relative scale (1 unit = 1 voxel in every pack). It shows
 * that the packs interchange: a RUN barrel stands next to a PN chest at the
 * size the two share in a game.
 */
import { OrbitControls } from '@react-three/drei'
import { Suspense, useMemo, useState } from 'react'
import type { PackCatalog } from '@rvx/contracts/catalog'
import { isCollision } from '../catalog'
import { PackFilter, type PackChoice } from '../PackFilter'
import { CameraCommands, FitCamera, modelTransform, PackCanvas, PackModel, useCommandBus, ViewerErrorBoundary, ViewerFrame } from '../pack3d'

const ROOT = 'scene-row'
const COUNT = 6
const GAP = 6

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let s = seed * 9301 + 49297
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function SceneStage({ catalogs }: { catalogs: PackCatalog[] }) {
  const [pack, setPack] = useState<PackChoice>('all')
  const [seed, setSeed] = useState(1)

  const pool = useMemo(
    () =>
      catalogs
        .filter((c) => pack === 'all' || c.pack === pack)
        .flatMap((c) => c.models)
        .filter((m) => m.space === 'world' && !isCollision(m) && Math.max(...m.bounds.size) <= 80),
    [catalogs, pack],
  )
  const picks = useMemo(() => {
    // One per pack first, so a mixed scene always mixes.
    const byPack = new Map<string, typeof pool>()
    for (const m of shuffle(pool, seed)) byPack.set(m.pack, [...(byPack.get(m.pack) ?? []), m])
    const out: typeof pool = []
    while (out.length < COUNT && [...byPack.values()].some((l) => l.length)) for (const list of byPack.values()) if (list.length && out.length < COUNT) out.push(list.shift()!)
    return out
  }, [pool, seed])

  // Narrow screens get two rows so the models stay large; relative scale is unchanged.
  const bus = useCommandBus()
  const [resets, setResets] = useState(0)
  const [rows] = useState(() => (window.matchMedia('(max-width: 700px)').matches ? 2 : 1))
  const placed = useMemo(() => {
    const perRow = Math.ceil(picks.length / rows)
    const out: { entry: (typeof picks)[number]; placement: ReturnType<typeof modelTransform> }[] = []
    let rowZ = 0
    for (let r = 0; r < rows; r += 1) {
      const row = picks.slice(r * perRow, (r + 1) * perRow)
      const widths = row.map((m) => m.bounds.size[0])
      let cursor = -(widths.reduce((a, b) => a + b, 0) + GAP * (row.length - 1)) / 2
      row.forEach((m, i) => {
        const x = cursor + widths[i]! / 2
        cursor += widths[i]! + GAP
        out.push({ entry: m, placement: modelTransform(m.bounds, { anchor: 'base', at: [x, 0, rowZ] }) })
      })
      rowZ -= Math.max(0, ...row.map((m) => m.bounds.size[2])) + GAP
    }
    return out
  }, [picks, rows])

  return (
    <div className="scene-stage">
      <div className="scene-controls">
        <PackFilter catalogs={catalogs} value={pack} onChange={setPack} />
        <button type="button" className="toggle" onClick={() => setSeed((s) => s + 1)}>
          Reshuffle
        </button>
        <span className="scene-count">{picks.map((m) => m.name).join(' · ')}</span>
      </div>
      <ViewerFrame bus={bus} label="Scene of mixed-pack models at native scale" onReset={() => setResets((n) => n + 1)}>
      <ViewerErrorBoundary resetKey={`${pack}:${seed}`}>
        <PackCanvas>
          <group name={ROOT}>
            {placed.map(({ entry, placement }) => (
              <Suspense key={entry.id} fallback={null}>
                <PackModel entry={entry} anchor="native" at={placement.position} />
              </Suspense>
            ))}
          </group>
          <gridHelper args={[400, 100, '#26303f', '#1a2331']} />
          <OrbitControls makeDefault />
          <CameraCommands bus={bus} />
          <FitCamera rootName={ROOT} fitKey={`${picks.map((m) => m.id).join('|')}:${resets}`} targetMode="center" margin={1.1} />
        </PackCanvas>
      </ViewerErrorBoundary>
      </ViewerFrame>
    </div>
  )
}
