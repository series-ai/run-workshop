import { useEffect, useMemo, useRef, useState } from 'react'
import { SpriteCellCanvas } from '../components/SpriteCanvas'
import type { MicroRtsCatalog, RosterUnitEntry } from '../catalog'
import { LEAF_2D } from '../pins'
import { drawDiscreteChainArc, drawDiscreteLine, drawDiscreteRampBeam, useSpriteBatch } from '../spriteCache'

interface ArchetypeDemo {
  readonly key: string
  readonly label: string
  readonly unitId: string
  readonly targetId: string
  readonly desc: string
}

const ARCHETYPES: readonly ArchetypeDemo[] = [
  { key: 'hitscan_burst', label: 'Hitscan Burst', unitId: 'V04', targetId: 'K05', desc: 'Barrel-locked 3-round kinetic burst + compact spark' },
  { key: 'explosive_aoe', label: 'Tank Cannon AOE', unitId: 'V16', targetId: 'K15', desc: 'Heavy shell from V16 muzzleCell8 + crisp splash' },
  { key: 'homing_missile', label: 'Homing Missiles', unitId: 'V17', targetId: 'S15', desc: 'Shoulder-pod curved homing salvo with 1px contrails' },
  { key: 'cone_flame', label: 'Volumetric Flame', unitId: 'V08', targetId: 'K01', desc: 'Expanding turbulent fire droplets cooling white -> amber -> smoke' },
  { key: 'rail_pierce', label: 'Railgun Pierce', unitId: 'V14', targetId: 'K15', desc: 'Instant cyan-white penetrator slug across target' },
  { key: 'ballistic_arc', label: 'Mortar Arc', unitId: 'V15', targetId: 'K14', desc: 'Lobbed parabolic shell with ground blast' },
  { key: 'beam_ramp', label: 'Beam Ramp T1→T3', unitId: 'S15', targetId: 'V16', desc: 'Discrete pixel beam escalating 1px -> 2px -> 3px core' },
  { key: 'chain_arc', label: 'Chain Lightning', unitId: 'S16', targetId: 'V04', desc: 'Jagged discrete-pixel electric arc' },
  { key: 'projectile_dot', label: 'Acid Glob', unitId: 'K07', targetId: 'V04', desc: 'Bio-plasma glob with acid splash burst' },
  { key: 'swarm_launch', label: 'Interceptor Swarm', unitId: 'S24', targetId: 'V19', desc: 'Micro-interceptor darting volley' },
  { key: 'melee', label: 'Synced Melee Cleave', unitId: 'K05', targetId: 'V04', desc: '4-frame baked arm/jaw strike kinematics synced to slash VFX' },
  { key: 'support_utility', label: 'Repair / Heal Pulse', unitId: 'V03', targetId: 'V16', desc: 'Support beam + rising green cross VFX' },
]

export function VfxTab({ catalog }: { catalog: MicroRtsCatalog }) {
  const [selectedArch, setSelectedArch] = useState<string>('explosive_aoe')
  const [tick, setTick] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 160)
    return () => window.clearInterval(iv)
  }, [])

  const unitMap = useMemo(() => {
    const m = new Map<string, RosterUnitEntry>()
    for (const u of catalog.allUnits) m.set(u.id, u)
    return m
  }, [catalog])

  const demo = useMemo(
    () => ARCHETYPES.find((a) => a.key === selectedArch) ?? ARCHETYPES[0]!,
    [selectedArch],
  )
  const attacker = unitMap.get(demo.unitId) ?? catalog.units[0]!
  const target = unitMap.get(demo.targetId) ?? catalog.units[1]!

  const batchRefs = useMemo(() => {
    const paths = new Set<string>([
      attacker.sheet,
      target.sheet,
      'vfx/proj-shell.png',
      'vfx/proj-missile.png',
      'vfx/proj-mortar.png',
      'vfx/proj-acid.png',
      'vfx/proj-interceptor.png',
      'vfx/fx-explosion-sm.png',
      'vfx/fx-explosion-lg.png',
      'vfx/fx-hitscan-spark.png',
      'vfx/fx-acid-splash.png',
      'vfx/fx-psi-burst.png',
      'vfx/fx-heal-plus.png',
      'vfx/slash-claw.png',
    ])
    return [...paths].map((path) => ({ leafId: LEAF_2D, path }))
  }, [attacker, target])

  const imgs = useSpriteBatch(batchRefs)
  const imgsRef = useRef(imgs)
  imgsRef.current = imgs

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const W = 220
    const H = 88

    const render = (now: number) => {
      const c = canvasRef.current
      if (c) {
        const ctx = c.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = false
          const sec = (now - t0) / 1000
          const cycle = sec % 1.4
          const map = imgsRef.current

          // Tactical dark ground grid
          ctx.fillStyle = '#151e2c'
          ctx.fillRect(0, 0, W, H)
          ctx.fillStyle = '#1a2536'
          for (let gx = 0; gx < W; gx += 16) ctx.fillRect(gx, 0, 1, H)
          for (let gy = 0; gy < H; gy += 16) ctx.fillRect(0, gy, W, 1)

          const isMelee = demo.key === 'melee'
          const ax = isMelee ? 92 : 44
          const ay = 46
          const tx = isMelee ? 114 : 168
          const ty = 46

          const aImg = map.get(attacker.sheet)
          const tImg = map.get(target.sheet)

          // Attack animation frame (cols 6..9 during firing window 0.1..0.55s)
          const firing = cycle >= 0.1 && cycle < 0.55
          const aCol = firing ? 6 + Math.min(3, Math.floor(((cycle - 0.1) / 0.45) * 4)) : Math.floor(sec * 3) % 2
          const aOx = Math.round(ax - attacker.cellW / 2)
          const aOy = Math.round(ay - attacker.cellH / 2)

          if (aImg) {
            ctx.drawImage(aImg, aCol * attacker.cellW, 2 * attacker.cellH, attacker.cellW, attacker.cellH, aOx, aOy, attacker.cellW, attacker.cellH)
          }
          if (tImg) {
            const tCol = Math.floor(sec * 2.5) % 2
            ctx.drawImage(
              tImg,
              tCol * target.cellW,
              6 * target.cellH,
              target.cellW,
              target.cellH,
              Math.round(tx - target.cellW / 2),
              Math.round(ty - target.cellH / 2),
              target.cellW,
              target.cellH,
            )
          }

          // Exact barrel origin
          const muz = attacker.muzzleCell8?.E
          const mx = muz ? aOx + muz[0] : ax + 8
          const my = muz ? aOy + muz[1] : ay - 2

          // Render selected archetype VFX
          const prog = Math.max(0, Math.min(1, (cycle - 0.15) / 0.55))
          const hitAge = cycle - 0.7

          if (demo.key === 'beam_ramp' && cycle >= 0.15 && cycle < 1.1) {
            const tier = (cycle < 0.45 ? 1 : cycle < 0.75 ? 2 : 3) as 1 | 2 | 3
            drawDiscreteRampBeam(ctx, mx, my, tx - 4, ty - 2, tier, '#30b8ff', '#ffffff')
          } else if (demo.key === 'chain_arc' && cycle >= 0.15 && cycle < 0.95) {
            drawDiscreteChainArc(ctx, mx, my, tx - 4, ty - 2, Math.floor(sec * 24), '#65d6ff', '#ffffff')
          } else if (demo.key === 'rail_pierce' && cycle >= 0.18 && cycle < 0.48) {
            drawDiscreteLine(ctx, mx, my, tx + 24, ty - 2, '#47d7ff', 2)
            drawDiscreteLine(ctx, mx, my, tx + 24, ty - 2, '#ffffff', 1)
          } else if (demo.key === 'hitscan_burst' && cycle >= 0.15 && cycle < 0.6) {
            const bx = mx + (tx - mx) * ((cycle * 6) % 1)
            drawDiscreteLine(ctx, bx - 10, my, bx, my, '#ffbe55', 1)
            const sp = map.get('vfx/fx-hitscan-spark.png')
            if (sp) {
              const f = Math.floor(sec * 16) % 4
              ctx.drawImage(sp, f * 8, 0, 8, 8, tx - 6, ty - 6, 8, 8)
            }
          } else if (demo.key === 'cone_flame' && cycle >= 0.12 && cycle < 1.05) {
            for (let i = 0; i < 24; i++) {
              const p = ((sec * 2.2 + i / 24) % 1)
              const spread = (Math.sin(i * 19.7 + sec * 6) * 0.5) * (3 + p * 16)
              const px = Math.round(mx + p * (tx - mx - 4))
              const py = Math.round(my + spread)
              ctx.fillStyle = p < 0.22 ? '#fff6cc' : p < 0.5 ? '#ffaa30' : p < 0.78 ? '#e84925' : '#4a3d46'
              const sz = p < 0.4 ? 2 : 3
              ctx.fillRect(px, py, sz, sz)
            }
          } else if (demo.key === 'homing_missile' && cycle >= 0.15 && cycle < 0.85) {
            for (const side of [-1, 1]) {
              const p = Math.min(1, (cycle - 0.15) / 0.6)
              const cx = mx + (tx - mx) * p
              const cy = my + side * Math.sin(p * Math.PI) * 18
              const prevP = Math.max(0, p - 0.08)
              const px0 = mx + (tx - mx) * prevP
              const py0 = my + side * Math.sin(prevP * Math.PI) * 18
              drawDiscreteLine(ctx, px0, py0, cx, cy, '#9aa8bd', 1)
              ctx.fillStyle = '#ff9442'
              ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 2)
            }
          } else if (demo.key === 'ballistic_arc' && cycle >= 0.15 && cycle < 0.72) {
            const px = mx + (tx - mx) * prog
            const py = my - Math.sin(prog * Math.PI) * 28
            ctx.fillStyle = '#ffbf54'
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3)
          } else if (demo.key === 'melee' && cycle >= 0.2 && cycle < 0.55) {
            const sl = map.get('vfx/slash-claw.png')
            if (sl) {
              const f = Math.min(3, Math.floor(((cycle - 0.2) / 0.35) * 4))
              ctx.drawImage(sl, f * 12, 0, 12, 12, tx - 12, ty - 7, 12, 12)
            }
          } else if (demo.key === 'support_utility' && cycle >= 0.15 && cycle < 1.1) {
            drawDiscreteLine(ctx, mx, my, tx - 4, ty - 2, '#57f287', 1)
            const hp = map.get('vfx/fx-heal-plus.png')
            if (hp) {
              const f = Math.floor(sec * 8) % 4
              ctx.drawImage(hp, f * 10, 0, 10, 10, tx - 5, ty - 14 - Math.round((cycle % 0.6) * 8), 10, 10)
            }
          } else if (cycle >= 0.15 && cycle < 0.7) {
            const px = mx + (tx - mx) * prog
            const py = my + (ty - my) * prog + (demo.key === 'swarm_launch' ? Math.sin(prog * 14) * 6 : 0)
            const col = demo.key === 'projectile_dot' ? '#70ff58' : demo.key === 'swarm_launch' ? '#4de2ff' : '#ffad42'
            drawDiscreteLine(ctx, px - 6, py, px, py, col, 2)
          }

          // Impact explosion burst
          if (hitAge >= 0 && hitAge < 0.38 && demo.key !== 'melee' && demo.key !== 'support_utility' && demo.key !== 'beam_ramp') {
            const fxKey =
              demo.key === 'explosive_aoe' || demo.key === 'ballistic_arc'
                ? 'vfx/fx-explosion-lg.png'
                : demo.key === 'projectile_dot'
                  ? 'vfx/fx-acid-splash.png'
                  : 'vfx/fx-explosion-sm.png'
            const fxImg = map.get(fxKey)
            if (fxImg) {
              const frames = fxKey.includes('lg') ? 5 : 4
              const cw = Math.floor(fxImg.width / frames)
              const ch = fxImg.height
              const f = Math.min(frames - 1, Math.floor((hitAge / 0.38) * frames))
              ctx.drawImage(fxImg, f * cw, 0, cw, ch, Math.round(tx - cw / 2), Math.round(ty - ch / 2), cw, ch)
            }
          }
        }
      }
      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [demo, attacker, target])

  const countsByArch = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of catalog.attacks) counts.set(a.archetype, (counts.get(a.archetype) ?? 0) + 1)
    return counts
  }, [catalog])

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>12 Combat Attack Archetypes — Live Barrel-Locked Firing Range</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
              {demo.desc} ({attacker.id} {attacker.name} → {target.id} {target.name})
            </p>
          </div>
          <span className="tag good">{catalog.attacks.length} Units Mapped in unit-attacks.json</span>
        </div>

        <div className="pill-row" style={{ marginBottom: 14 }}>
          {ARCHETYPES.map((a) => (
            <button
              key={a.key}
              className={`pill ${selectedArch === a.key ? 'active' : ''}`}
              onClick={() => setSelectedArch(a.key)}
            >
              {a.label} ({countsByArch.get(a.key) ?? 0})
            </button>
          ))}
        </div>

        <div className="checker-stage" style={{ padding: 14 }}>
          <canvas
            ref={canvasRef}
            width={220}
            height={88}
            style={{ width: 660, height: 264, maxWidth: '100%', imageRendering: 'pixelated', borderRadius: 6 }}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">All 19 Combat VFX Sprite Strips (Animated 4× + 1× Native)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(154px, 1fr))', gap: 10 }}>
          {catalog.vfx.map((v) => {
            const col = tick % Math.max(1, v.frames)
            return (
              <div key={v.id} className="unit-card" style={{ cursor: 'default', padding: 10 }}>
                <div className="checker-stage" style={{ width: '100%', height: 74, gap: 10 }}>
                  <SpriteCellCanvas
                    leafId={LEAF_2D}
                    path={v.sheet}
                    cellW={v.cellW}
                    cellH={v.cellH}
                    col={col}
                    scale={Math.max(2, Math.min(4, Math.floor(56 / Math.max(v.cellW, v.cellH))))}
                  />
                  <SpriteCellCanvas leafId={LEAF_2D} path={v.sheet} cellW={v.cellW} cellH={v.cellH} col={col} scale={1} />
                </div>
                <span className="unit-name">{v.name}</span>
                <span className="unit-id">
                  {v.category} · {v.cellW}×{v.cellH} · {v.frames}f
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
