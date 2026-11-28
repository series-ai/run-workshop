import { useEffect, useMemo, useRef, useState } from 'react'
import { SpriteCellCanvas } from '../components/SpriteCanvas'
import type { BiomeEntry, EnvObjectEntry, MicroRtsCatalog } from '../catalog'
import { LEAF_2D } from '../pins'
import { useSpriteBatch, useSpriteImage } from '../spriteCache'
import { bakeTerrainToCanvas, generateWfcBattleMap, TILE_PX, WORLD_H, WORLD_W } from '../terrainGen'

export function EnvironmentTab({ catalog }: { catalog: MicroRtsCatalog }) {
  const [biomeTheme, setBiomeTheme] = useState<BiomeEntry['theme']>('temperate')
  const [cat, setCat] = useState<'all' | EnvObjectEntry['category']>('all')
  const [seed, setSeed] = useState(11)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 360)
    return () => window.clearInterval(iv)
  }, [])

  const biome = useMemo(
    () => catalog.environment.biomes.find((b) => b.theme === biomeTheme) ?? catalog.environment.biomes[0]!,
    [catalog, biomeTheme],
  )

  const previewMap = useMemo(
    () => generateWfcBattleMap(biomeTheme, 'wfc-frontier', seed, catalog.environment.objects),
    [biomeTheme, seed, catalog.environment.objects],
  )

  const dioramaRefs = useMemo(() => {
    const set = new Set<string>([
      biome.atlas,
      biome.hazardAnim,
      biome.bridgeH,
      biome.bridgeV,
      biome.ramps.S,
      biome.ramps.N,
      biome.ramps.E,
      biome.ramps.W,
    ])
    for (const p of previewMap.props) set.add(p.sheet)
    return [...set].map((path) => ({ leafId: LEAF_2D, path }))
  }, [biome, previewMap.props])

  const batch = useSpriteBatch(dioramaRefs)
  const atlasImg = useSpriteImage({ leafId: LEAF_2D, path: biome.atlas })
  const hazardImg = useSpriteImage({ leafId: LEAF_2D, path: biome.hazardAnim })
  const bridgeHImg = useSpriteImage({ leafId: LEAF_2D, path: biome.bridgeH })
  const bridgeVImg = useSpriteImage({ leafId: LEAF_2D, path: biome.bridgeV })
  const rampSImg = useSpriteImage({ leafId: LEAF_2D, path: biome.ramps.S })
  const rampNImg = useSpriteImage({ leafId: LEAF_2D, path: biome.ramps.N })
  const rampEImg = useSpriteImage({ leafId: LEAF_2D, path: biome.ramps.E })
  const rampWImg = useSpriteImage({ leafId: LEAF_2D, path: biome.ramps.W })

  const atlasCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dioramaCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const c = atlasCanvasRef.current
    if (!c || !atlasImg) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(atlasImg, 0, 0, atlasImg.width, atlasImg.height, 0, 0, atlasImg.width * 3, atlasImg.height * 3)
  }, [atlasImg])

  useEffect(() => {
    const c = dioramaCanvasRef.current
    const atlas = batch.get(biome.atlas)
    if (!c || !atlas) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    const baked = bakeTerrainToCanvas(
      previewMap,
      atlas,
      {
        N: batch.get(biome.ramps.N),
        S: batch.get(biome.ramps.S),
        E: batch.get(biome.ramps.E),
        W: batch.get(biome.ramps.W),
      },
      batch.get(biome.bridgeH) ?? null,
      batch.get(biome.bridgeV) ?? null,
    )
    ctx.drawImage(baked, 0, 0)
    const haz = batch.get(biome.hazardAnim)
    if (haz) {
      const f = tick % 3
      for (const ht of previewMap.hazardTiles) {
        ctx.drawImage(haz, ht.variant * TILE_PX, ((f + ((ht.tx + ht.ty) & 1)) % 3) * TILE_PX, TILE_PX, TILE_PX, ht.tx * TILE_PX, ht.ty * TILE_PX, TILE_PX, TILE_PX)
      }
    }
    const sortedProps = [...previewMap.props].sort((a, b) => a.y - b.y)
    for (const p of sortedProps) {
      const img = batch.get(p.sheet)
      if (!img) continue
      const isAnim = p.id.includes('geyser') || p.id.includes('vent') || p.id.startsWith('neutral-')
      const col = isAnim && p.frames > 1 ? (tick + p.phaseOffset) % p.frames : 0
      ctx.drawImage(img, col * p.cellW, 0, p.cellW, p.cellH, Math.round(p.x - p.cellW / 2), Math.round(p.y - p.cellH + 3), p.cellW, p.cellH)
    }
  }, [batch, biome, previewMap, tick])

  const filteredObjects = useMemo(
    () => catalog.environment.objects.filter((o) => cat === 'all' || o.category === cat),
    [catalog, cat],
  )

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>4 Planet Biome 8×8 Wang-16 Tilesets + WFC Auto-Tile Preview</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
            Edge-exact Wang-16 dual-grid transitions, Layer-1 alpha cliffs, 3-frame animated hazards, 4-way ramps, and H/V bridges.
          </p>
        </div>
        <div className="pill-row">
          {catalog.environment.biomes.map((b) => (
            <button
              key={b.theme}
              className={`pill ${biomeTheme === b.theme ? 'active' : ''}`}
              onClick={() => setBiomeTheme(b.theme)}
            >
              {b.label}
            </button>
          ))}
          <button className="pill" onClick={() => setSeed((s) => s + 1)}>
            New WFC Seed (#{seed})
          </button>
        </div>
      </div>

      {/* Live WFC + Wang-16 Auto-Tiled Diorama */}
      <div className="card">
        <h3 className="section-title">
          {biome.label} — Live WFC + Dual-Grid Wang-16 Level ({previewMap.ramps.length} Ramps · {previewMap.bridges.length} Bridges · {previewMap.props.length} Props)
        </h3>
        <div className="checker-stage" style={{ padding: 12, overflowX: 'auto' }}>
          <canvas
            ref={dioramaCanvasRef}
            width={WORLD_W}
            height={WORLD_H}
            style={{ width: WORLD_W * 2, height: WORLD_H * 2, maxWidth: '100%', imageRendering: 'pixelated', borderRadius: 6 }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) minmax(260px, 1fr)', gap: 14 }}>
        <div className="card">
          <h3 className="section-title">{biome.label} — Full 8×8 Wang-16 Atlas (3×)</h3>
          <div className="checker-stage" style={{ padding: 14, overflowX: 'auto' }}>
            <canvas
              ref={atlasCanvasRef}
              width={(atlasImg?.width ?? 128) * 3}
              height={(atlasImg?.height ?? 64) * 3}
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 className="section-title">Animated Hazard, Bridges &amp; 4-Way Ramps (3×)</h3>
          <div className="pill-row" style={{ gap: 14 }}>
            <div className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <SpriteCellCanvas leafId={LEAF_2D} path={biome.hazardAnim} cellW={8} cellH={8} col={0} row={tick % 3} scale={4} />
              <span className="unit-id">Hazard ({hazardImg ? `${hazardImg.width}×${hazardImg.height}` : '3f'})</span>
            </div>
            {bridgeHImg && (
              <div className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <SpriteCellCanvas leafId={LEAF_2D} path={biome.bridgeH} cellW={bridgeHImg.width} cellH={bridgeHImg.height} scale={2} />
                <span className="unit-id">Bridge H</span>
              </div>
            )}
            {bridgeVImg && (
              <div className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <SpriteCellCanvas leafId={LEAF_2D} path={biome.bridgeV} cellW={bridgeVImg.width} cellH={bridgeVImg.height} scale={2} />
                <span className="unit-id">Bridge V</span>
              </div>
            )}
          </div>

          <div className="pill-row" style={{ gap: 10 }}>
            {[
              ['Ramp S', biome.ramps.S, rampSImg],
              ['Ramp N', biome.ramps.N, rampNImg],
              ['Ramp E', biome.ramps.E, rampEImg],
              ['Ramp W', biome.ramps.W, rampWImg],
            ].map(([label, path, img]) =>
              img ? (
                <div key={label as string} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <SpriteCellCanvas
                    leafId={LEAF_2D}
                    path={path as string}
                    cellW={(img as HTMLImageElement).width}
                    cellH={(img as HTMLImageElement).height}
                    scale={2}
                  />
                  <span className="unit-id">{label as string}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {/* 31 Terrain Objects */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            31 Terrain Objects ({filteredObjects.length})
          </h3>
          <div className="pill-row">
            {(['all', 'resource', 'obstacle', 'objective', 'flora', 'wreckage'] as const).map((c) => (
              <button key={c} className={`pill ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
                {c === 'obstacle' ? 'Chokes / Obstacles' : c[0]!.toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))', gap: 10 }}>
          {filteredObjects.map((o) => {
            const frame = o.frames > 1 ? tick % o.frames : 0
            const stateLabel = o.stateLabels?.[frame] ?? (o.frames > 1 ? `f${frame}` : 'static')
            return (
              <div key={o.id} className="unit-card" style={{ cursor: 'default', padding: 10 }}>
                <div className="checker-stage" style={{ width: '100%', height: 76 }}>
                  <SpriteCellCanvas
                    leafId={LEAF_2D}
                    path={o.sheet}
                    cellW={o.cellW}
                    cellH={o.cellH}
                    col={frame}
                    scale={Math.max(2, Math.min(3, Math.floor(64 / Math.max(o.cellW, o.cellH))))}
                  />
                </div>
                <span className="unit-name">{o.name}</span>
                <span className="unit-id">
                  {o.category} · {o.biome} · {stateLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
