import { useEffect, useMemo, useRef, useState } from 'react'
import { SpriteCellCanvas } from '../components/SpriteCanvas'
import type { BiomeEntry, Dir8, MicroRtsCatalog, RosterUnitEntry } from '../catalog'
import { DIRS_8 } from '../catalog'
import { LEAF_2D, LEAF_UI } from '../pins'
import { drawDiscreteChainArc, drawDiscreteLine, drawDiscreteRampBeam, useSpriteBatch } from '../spriteCache'
import {
  bakeTerrainToCanvas,
  generateWfcBattleMap,
  isWalkableGround,
  MAP_PRESETS,
  TILE_PX,
  WORLD_H,
  WORLD_W,
  type GeneratedBattleMap,
  type MapPresetId,
  type WfcSectorKind,
} from '../terrainGen'

type CmdMode = 'select' | 'move' | 'attack' | 'build'

interface SimUnit {
  uid: number
  def: RosterUnitEntry
  faction: 'vanguard' | 'kraxen' | 'solaris'
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  hullDir: number
  turretDir: number
  turnCd: number
  atkCd: number
  atkTimer: number
  animClock: number
  selected: boolean
  orderX: number | null
  orderY: number | null
  orderType: 'move' | 'attack' | null
  hitFlash: number
  beamTier: 1 | 2 | 3
}

interface SimProjectile {
  kind: 'shell' | 'missile' | 'plasma' | 'acid' | 'beam' | 'chain'
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  coreColor: string
  faction: 'vanguard' | 'kraxen' | 'solaris'
  dmg: number
  tier?: 1 | 2 | 3
}

interface SimFx {
  x: number
  y: number
  sheet: string
  cellW: number
  cellH: number
  frames: number
  age: number
  duration: number
}

interface SimPing {
  x: number
  y: number
  kind: 'move' | 'attack'
  age: number
}

interface PlacedBuilding {
  id: string
  x: number
  y: number
  faction: 'vanguard' | 'kraxen' | 'solaris'
  sheet: string
  cellW: number
  cellH: number
  anchorX: number
  anchorY: number
  stateCol: number
}

const SECTOR_DEBUG_COLORS: Record<WfcSectorKind, string> = {
  GRASS: 'rgba(74, 222, 128, 0.14)',
  ROAD: 'rgba(250, 204, 21, 0.16)',
  PLATEAU: 'rgba(249, 115, 22, 0.24)',
  WATER: 'rgba(56, 189, 248, 0.26)',
  CREEP: 'rgba(217, 70, 239, 0.22)',
  BRIDGE_H: 'rgba(255, 255, 255, 0.34)',
  RAMP_S: 'rgba(253, 224, 71, 0.36)',
  RAMP_W: 'rgba(253, 224, 71, 0.36)',
}

function angleToDir8(dx: number, dy: number): number {
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360 + 90) % 360
  return Math.round(deg / 45) % 8
}

function stepDir8(cur: number, target: number): number {
  if (cur === target) return cur
  const diff = (target - cur + 8) % 8
  return diff <= 4 ? (cur + 1) % 8 : (cur + 7) % 8
}

function unitMuzzlePos(u: SimUnit): [number, number] {
  const dirKey = DIRS_8[u.def.twoLayer ? u.turretDir : u.hullDir] as Dir8
  const cell = u.def.muzzleCell8?.[dirKey]
  const ox = Math.round(u.x - u.def.cellW / 2)
  const oy = Math.round(u.y - u.def.cellH * 0.72)
  if (cell) return [ox + cell[0], oy + cell[1]]
  return [Math.round(u.x), Math.round(u.y - u.def.cellH * 0.35)]
}

function ringTierFor(u: RosterUnitEntry): 'sel-sm' | 'sel-md' | 'sel-lg' {
  const m = Math.max(u.cellW, u.cellH)
  if (m >= 22) return 'sel-lg'
  if (m >= 16) return 'sel-md'
  return 'sel-sm'
}

function findNearestWalkable(map: GeneratedBattleMap, x: number, y: number): [number, number] {
  if (isWalkableGround(map, x, y)) return [x, y]
  for (let rad = 8; rad <= 64; rad += 8) {
    for (let i = 0; i < 8; i++) {
      const nx = Math.max(16, Math.min(WORLD_W - 16, x + Math.cos((i * Math.PI) / 4) * rad))
      const ny = Math.max(18, Math.min(WORLD_H - 16, y + Math.sin((i * Math.PI) / 4) * rad))
      if (isWalkableGround(map, nx, ny)) return [nx, ny]
    }
  }
  return [x, y]
}

export function SkirmishTab({ catalog }: { catalog: MicroRtsCatalog }) {
  const [biomeTheme, setBiomeTheme] = useState<BiomeEntry['theme']>('temperate')
  const [mapPreset, setMapPreset] = useState<MapPresetId>('wfc-frontier')
  const [mapSeed, setMapSeed] = useState<number>(7)
  const [showWfcGrid, setShowWfcGrid] = useState(false)
  const [zoom, setZoom] = useState<1 | 2 | 3>(2)
  const [paused, setPaused] = useState(false)
  const [cmdMode, setCmdMode] = useState<CmdMode>('select')
  const [selectedCount, setSelectedCount] = useState(0)
  const [stats, setStats] = useState({ fps: 60, units: 0, projectiles: 0, minerals: 450, gas: 180, supply: 24 })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bakedTerrainRef = useRef<HTMLCanvasElement | null>(null)

  const simRef = useRef<{
    units: SimUnit[]
    projectiles: SimProjectile[]
    fx: SimFx[]
    pings: SimPing[]
    buildings: PlacedBuilding[]
    nextUid: number
    clock: number
    drag: { x0: number; y0: number; x1: number; y1: number; active: boolean } | null
    hover: { x: number; y: number } | null
  }>({
    units: [],
    projectiles: [],
    fx: [],
    pings: [],
    buildings: [],
    nextUid: 1,
    clock: 0,
    drag: null,
    hover: null,
  })

  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const cmdModeRef = useRef(cmdMode)
  cmdModeRef.current = cmdMode
  const showWfcGridRef = useRef(showWfcGrid)
  showWfcGridRef.current = showWfcGrid

  const biome = useMemo(
    () => catalog.environment.biomes.find((b) => b.theme === biomeTheme) ?? catalog.environment.biomes[0]!,
    [catalog, biomeTheme],
  )

  const battleMap = useMemo(
    () => generateWfcBattleMap(biomeTheme, mapPreset, mapSeed, catalog.environment.objects),
    [biomeTheme, mapPreset, mapSeed, catalog.environment.objects],
  )
  const mapRef = useRef(battleMap)
  mapRef.current = battleMap

  const squadIds = useMemo(
    () => ['V04', 'V06', 'V12', 'V16', 'V17', 'V19', 'K01', 'K05', 'K14', 'K15', 'K20', 'S04', 'S12', 'S15', 'S16', 'S20'],
    [],
  )
  const unitDefs = useMemo(() => {
    const map = new Map<string, RosterUnitEntry>()
    for (const u of catalog.units) map.set(u.id, u)
    return map
  }, [catalog])

  const assetRefs2d = useMemo(() => {
    const paths = new Set<string>([
      biome.atlas,
      biome.hazardAnim,
      biome.bridgeH,
      biome.bridgeV,
      biome.ramps.S,
      biome.ramps.N,
      biome.ramps.E,
      biome.ramps.W,
      'buildings/building-vanguard-bastion-states.png',
      'buildings/building-vanguard-barracks-states.png',
      'buildings/building-vanguard-turret-states.png',
      'buildings/building-kraxen-colony-states.png',
      'buildings/building-kraxen-spire-states.png',
      'buildings/building-solaris-nexus-states.png',
      'buildings/building-solaris-pylon-states.png',
      'vfx/proj-shell.png',
      'vfx/proj-missile.png',
      'vfx/proj-plasma.png',
      'vfx/proj-acid.png',
      'vfx/fx-explosion-sm.png',
      'vfx/fx-explosion-lg.png',
      'vfx/fx-hitscan-spark.png',
      'vfx/fx-psi-burst.png',
      'vfx/fx-acid-splash.png',
    ])
    for (const p of battleMap.props) paths.add(p.sheet)
    for (const id of squadIds) {
      const def = unitDefs.get(id)
      if (!def) continue
      paths.add(def.sheet)
      if (def.hullSheet) paths.add(def.hullSheet)
      if (def.turretSheet) paths.add(def.turretSheet)
      if (def.shadowSheet) paths.add(def.shadowSheet)
    }
    return [...paths].map((path) => ({ leafId: LEAF_2D, path }))
  }, [biome, battleMap.props, squadIds, unitDefs])

  const assetRefsUi = useMemo(
    () =>
      [
        'selection-rings/sel-sm.png',
        'selection-rings/sel-md.png',
        'selection-rings/sel-lg.png',
        'selection-rings/sel-bldg.png',
        'markers/order-move-ping.png',
        'markers/order-attack-ping.png',
        'markers/build-grid-ok.png',
        'markers/build-grid-bad.png',
        'markers/rally-flag.png',
      ].map((path) => ({ leafId: LEAF_UI, path })),
    [],
  )

  const imgs2d = useSpriteBatch(assetRefs2d)
  const imgsUi = useSpriteBatch(assetRefsUi)
  const imgs2dRef = useRef(imgs2d)
  imgs2dRef.current = imgs2d
  const imgsUiRef = useRef(imgsUi)
  imgsUiRef.current = imgsUi
  const biomeRef = useRef(biome)
  biomeRef.current = biome

  // Bake static Layer-0 Wang-16 + Layer-1 Alpha Cliffs + Ramps/Bridges to offscreen canvas
  useEffect(() => {
    const atlas = imgs2d.get(biome.atlas)
    if (!atlas) {
      bakedTerrainRef.current = null
      return
    }
    bakedTerrainRef.current = bakeTerrainToCanvas(
      battleMap,
      atlas,
      {
        N: imgs2d.get(biome.ramps.N),
        S: imgs2d.get(biome.ramps.S),
        E: imgs2d.get(biome.ramps.E),
        W: imgs2d.get(biome.ramps.W),
      },
      imgs2d.get(biome.bridgeH) ?? null,
      imgs2d.get(biome.bridgeV) ?? null,
    )
  }, [battleMap, biome, imgs2d])

  const spawnWave = (reset = false) => {
    const sim = simRef.current
    const curMap = mapRef.current
    if (reset) {
      sim.units = []
      sim.projectiles = []
      sim.fx = []
      sim.pings = []
      const mkBldg = (
        id: string,
        x: number,
        y: number,
        faction: 'vanguard' | 'kraxen' | 'solaris',
      ): PlacedBuilding | null => {
        const b = catalog.buildings.buildings.find((e) => e.id === id)
        if (!b || !b.stateSheet) return null
        return {
          id,
          x,
          y,
          faction,
          sheet: b.stateSheet,
          cellW: b.stateCellW ?? b.width,
          cellH: b.stateCellH ?? b.height,
          anchorX: b.stateAnchorX ?? b.anchorX,
          anchorY: b.stateAnchorY ?? b.anchorY,
          stateCol: 3,
        }
      }
      const vBase = curMap.bases.find((b) => b.faction === 'vanguard') ?? { x: 56, y: 144 }
      const sBase = curMap.bases.find((b) => b.faction === 'solaris') ?? { x: 420, y: 52 }
      const kBase = curMap.bases.find((b) => b.faction === 'kraxen') ?? { x: 422, y: 204 }
      const [turX, turY] = findNearestWalkable(curMap, vBase.x + 42, vBase.y - 28)

      sim.buildings = [
        mkBldg('vanguard-bastion', vBase.x, vBase.y, 'vanguard'),
        mkBldg('vanguard-turret', turX, turY, 'vanguard'),
        mkBldg('kraxen-colony', kBase.x, kBase.y, 'kraxen'),
        mkBldg('solaris-nexus', sBase.x, sBase.y, 'solaris'),
      ].filter((b): b is PlacedBuilding => b !== null)
    }

    const add = (id: string, rawX: number, rawY: number, selected = false) => {
      const def = unitDefs.get(id)
      if (!def || def.faction === 'neutral') return
      const [x, y] = def.layer === 'air' ? [rawX, rawY] : findNearestWalkable(curMap, rawX, rawY)
      const isHeavy = Math.max(def.cellW, def.cellH) >= 18
      sim.units.push({
        uid: sim.nextUid++,
        def,
        faction: def.faction,
        x,
        y,
        vx: 0,
        vy: 0,
        hp: isHeavy ? 180 : 75,
        maxHp: isHeavy ? 180 : 75,
        hullDir: def.faction === 'vanguard' ? 2 : 6,
        turretDir: def.faction === 'vanguard' ? 2 : 6,
        turnCd: 0,
        atkCd: Math.random() * 0.7,
        atkTimer: 0,
        animClock: Math.random() * 4,
        selected,
        orderX: null,
        orderY: null,
        orderType: null,
        hitFlash: 0,
        beamTier: 1,
      })
    }

    // Vanguard squad (West flank)
    add('V16', 112, 120, reset)
    add('V16', 116, 158, reset)
    add('V17', 132, 138, reset)
    add('V19', 102, 86, reset)
    add('V04', 142, 114, reset)
    add('V04', 148, 130, reset)
    add('V04', 146, 152, reset)
    add('V06', 138, 168, reset)
    add('V12', 124, 102, reset)

    // Kraxen swarm (SE flank)
    add('K15', 348, 174)
    add('K14', 362, 198)
    add('K20', 338, 146)
    add('K05', 324, 164)
    add('K05', 330, 184)
    add('K01', 316, 156)
    add('K01', 320, 176)
    add('K01', 326, 194)

    // Solaris strike wing (NE high ground + valley approach)
    add('S15', 344, 82)
    add('S16', 364, 96)
    add('S20', 328, 56)
    add('S12', 322, 92)
    add('S12', 334, 106)
    add('S04', 312, 78)
    add('S04', 318, 98)

    setSelectedCount(sim.units.filter((u) => u.selected).length)
  }

  useEffect(() => {
    spawnWave(true)
  }, [unitDefs, battleMap])

  // Main 60 FPS simulation & crisp pixel-art render loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let fpsAccum = 0
    let fpsFrames = 0

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      fpsAccum += dt
      fpsFrames++

      const sim = simRef.current
      const curMap = mapRef.current

      if (!pausedRef.current) {
        sim.clock += dt
        for (const u of sim.units) {
          u.animClock += dt
          u.turnCd = Math.max(0, u.turnCd - dt)
          u.atkCd = Math.max(0, u.atkCd - dt)
          u.atkTimer = Math.max(0, u.atkTimer - dt)
          u.hitFlash = Math.max(0, u.hitFlash - dt)

          let nearest: SimUnit | null = null
          let bestDist = Infinity
          for (const other of sim.units) {
            if (other.faction === u.faction || other.hp <= 0) continue
            const d = Math.hypot(other.x - u.x, other.y - u.y)
            if (d < bestDist) {
              bestDist = d
              nearest = other
            }
          }

          const isMelee = u.def.id === 'K01' || u.def.id === 'K05' || u.def.id === 'S04'
          const range = isMelee ? 16 : u.def.twoLayer ? 115 : u.def.layer === 'air' ? 92 : 78
          const speed = u.def.layer === 'air' ? 28 : u.def.twoLayer ? 14 : 20

          let moveTx: number | null = null
          let moveTy: number | null = null
          if (u.orderX !== null && u.orderY !== null) {
            const dOrd = Math.hypot(u.orderX - u.x, u.orderY - u.y)
            if (dOrd < 8) {
              u.orderX = null
              u.orderY = null
              u.orderType = null
            } else if (u.orderType === 'move' || !nearest || bestDist > range) {
              moveTx = u.orderX
              moveTy = u.orderY
            }
          } else if (nearest && bestDist > range * 0.85) {
            moveTx = nearest.x
            moveTy = nearest.y
          }

          if (moveTx !== null && moveTy !== null) {
            const dx = moveTx - u.x
            const dy = moveTy - u.y
            const dist = Math.hypot(dx, dy) || 1
            let sepX = 0
            let sepY = 0
            for (const o of sim.units) {
              if (o === u || o.def.layer !== u.def.layer) continue
              const sdx = u.x - o.x
              const sdy = u.y - o.y
              const sd = Math.hypot(sdx, sdy)
              const minSep = u.def.twoLayer ? 16 : 11
              if (sd > 0.1 && sd < minSep) {
                sepX += (sdx / sd) * (minSep - sd) * 1.4
                sepY += (sdy / sd) * (minSep - sd) * 1.4
              }
            }
            const desVx = (dx / dist) * speed + sepX
            const desVy = (dy / dist) * speed + sepY
            u.vx += (desVx - u.vx) * Math.min(1, dt * 6)
            u.vy += (desVy - u.vy) * Math.min(1, dt * 6)

            const candX = Math.max(14, Math.min(WORLD_W - 14, u.x + u.vx * dt))
            const candY = Math.max(18, Math.min(WORLD_H - 14, u.y + u.vy * dt))
            if (u.def.layer === 'air' || isWalkableGround(curMap, candX, candY)) {
              u.x = candX
              u.y = candY
            } else if (isWalkableGround(curMap, candX, u.y)) {
              u.x = candX
            } else if (isWalkableGround(curMap, u.x, candY)) {
              u.y = candY
            } else {
              // Steer tangentially toward nearest bridge/ramp
              const slideY = u.y + (u.y < WORLD_H / 2 ? 1 : -1) * speed * dt
              if (isWalkableGround(curMap, u.x, slideY)) u.y = slideY
            }

            if (Math.hypot(u.vx, u.vy) > 4 && u.turnCd <= 0) {
              u.hullDir = stepDir8(u.hullDir, angleToDir8(u.vx, u.vy))
              u.turnCd = 0.14
            }
          } else {
            u.vx *= 0.8
            u.vy *= 0.8
          }

          if (nearest && bestDist <= range + 10) {
            const aimDir = angleToDir8(nearest.x - u.x, nearest.y - u.y)
            if (u.def.twoLayer) {
              u.turretDir = stepDir8(u.turretDir, aimDir)
            } else if (moveTx === null && u.turnCd <= 0) {
              u.hullDir = stepDir8(u.hullDir, aimDir)
              u.turnCd = 0.12
            }

            if (u.atkCd <= 0 && bestDist <= range) {
              u.atkTimer = 0.36
              u.atkCd = u.def.twoLayer ? 1.15 : isMelee ? 0.65 : 0.85
              const [mx, my] = unitMuzzlePos(u)
              if (isMelee) {
                nearest.hp -= 12
                nearest.hitFlash = 0.12
              } else if (u.def.id === 'S15') {
                u.beamTier = ((u.beamTier % 3) + 1) as 1 | 2 | 3
                sim.projectiles.push({
                  kind: 'beam',
                  x: mx,
                  y: my,
                  tx: nearest.x,
                  ty: nearest.y - 4,
                  vx: 0,
                  vy: 0,
                  life: 0.24,
                  maxLife: 0.24,
                  color: '#39c5ff',
                  coreColor: '#ffffff',
                  faction: u.faction,
                  dmg: 18,
                  tier: u.beamTier,
                })
                nearest.hp -= 16
                nearest.hitFlash = 0.12
              } else if (u.def.id === 'S16') {
                sim.projectiles.push({
                  kind: 'chain',
                  x: mx,
                  y: my,
                  tx: nearest.x,
                  ty: nearest.y - 4,
                  vx: 0,
                  vy: 0,
                  life: 0.2,
                  maxLife: 0.2,
                  color: '#6ad8ff',
                  coreColor: '#ffffff',
                  faction: u.faction,
                  dmg: 16,
                })
                nearest.hp -= 15
                nearest.hitFlash = 0.12
              } else {
                const dx = nearest.x - mx
                const dy = nearest.y - 4 - my
                const d = Math.hypot(dx, dy) || 1
                const pSpd = u.def.id === 'V19' || u.def.id === 'V17' ? 115 : 150
                const kind: SimProjectile['kind'] =
                  u.def.id === 'V19' || u.def.id === 'V17'
                    ? 'missile'
                    : u.faction === 'kraxen'
                      ? 'acid'
                      : u.faction === 'solaris'
                        ? 'plasma'
                        : 'shell'
                sim.projectiles.push({
                  kind,
                  x: mx,
                  y: my,
                  tx: nearest.x,
                  ty: nearest.y - 4,
                  vx: (dx / d) * pSpd,
                  vy: (dy / d) * pSpd,
                  life: Math.min(1.2, d / pSpd + 0.04),
                  maxLife: Math.min(1.2, d / pSpd + 0.04),
                  color: kind === 'acid' ? '#70ff58' : kind === 'plasma' ? '#4de2ff' : '#ffad42',
                  coreColor: '#fff6cc',
                  faction: u.faction,
                  dmg: u.def.twoLayer ? 22 : 10,
                })
              }
            }
          }
        }

        for (const p of sim.projectiles) {
          p.life -= dt
          if (p.kind !== 'beam' && p.kind !== 'chain') {
            p.x += p.vx * dt
            p.y += p.vy * dt
          }
          if (p.life <= 0 && p.kind !== 'beam' && p.kind !== 'chain') {
            for (const u of sim.units) {
              if (u.faction === p.faction || u.hp <= 0) continue
              if (Math.hypot(u.x - p.x, u.y - p.y) < 16) {
                u.hp -= p.dmg
                u.hitFlash = 0.12
                break
              }
            }
            sim.fx.push({
              x: p.x,
              y: p.y,
              sheet:
                p.kind === 'acid'
                  ? 'vfx/fx-acid-splash.png'
                  : p.kind === 'plasma'
                    ? 'vfx/fx-psi-burst.png'
                    : p.kind === 'missile'
                      ? 'vfx/fx-explosion-sm.png'
                      : 'vfx/fx-hitscan-spark.png',
              cellW: p.kind === 'missile' ? 14 : p.kind === 'shell' ? 8 : 12,
              cellH: p.kind === 'missile' ? 14 : p.kind === 'shell' ? 8 : 12,
              frames: 4,
              age: 0,
              duration: 0.28,
            })
          }
        }
        sim.projectiles = sim.projectiles.filter((p) => p.life > 0)

        const alive: SimUnit[] = []
        for (const u of sim.units) {
          if (u.hp <= 0) {
            sim.fx.push({
              x: u.x,
              y: u.y - 4,
              sheet: u.def.twoLayer ? 'vfx/fx-explosion-lg.png' : 'vfx/fx-explosion-sm.png',
              cellW: u.def.twoLayer ? 20 : 14,
              cellH: u.def.twoLayer ? 20 : 14,
              frames: u.def.twoLayer ? 5 : 4,
              age: 0,
              duration: 0.42,
            })
          } else {
            alive.push(u)
          }
        }
        sim.units = alive

        const vCount = sim.units.filter((u) => u.faction === 'vanguard').length
        const eCount = sim.units.filter((u) => u.faction !== 'vanguard').length
        if (vCount < 3 || eCount < 3) {
          spawnWave(false)
        }

        for (const f of sim.fx) f.age += dt
        sim.fx = sim.fx.filter((f) => f.age < f.duration)
        for (const p of sim.pings) p.age += dt
        sim.pings = sim.pings.filter((p) => p.age < 0.7)
      }

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = false
          const m2 = imgs2dRef.current
          const mui = imgsUiRef.current
          const curBiome = biomeRef.current

          // 1. Pre-baked Dual-Grid Wang-16 + Layer-1 Alpha Cliffs + Ramps + Bridges
          if (bakedTerrainRef.current) {
            ctx.drawImage(bakedTerrainRef.current, 0, 0)
          } else {
            ctx.fillStyle = '#243528'
            ctx.fillRect(0, 0, WORLD_W, WORLD_H)
          }

          // 2. Animated 3-frame hazard water/lava/ice shimmer on interior hazard tiles
          const hazardImg = m2.get(curBiome.hazardAnim)
          if (hazardImg) {
            const animRow = Math.floor(sim.clock * 3.5) % 3
            for (const ht of curMap.hazardTiles) {
              const fRow = (animRow + ((ht.tx + ht.ty) & 1)) % 3
              ctx.drawImage(
                hazardImg,
                ht.variant * TILE_PX,
                fRow * TILE_PX,
                TILE_PX,
                TILE_PX,
                ht.tx * TILE_PX,
                ht.ty * TILE_PX,
                TILE_PX,
                TILE_PX,
              )
            }
          }

          // Optional WFC Macro-Sector Debug Overlay
          if (showWfcGridRef.current) {
            ctx.font = 'bold 6px monospace'
            for (let sy = 0; sy < curMap.sectorH; sy++) {
              for (let sx = 0; sx < curMap.sectorW; sx++) {
                const k = curMap.sectors[sy * curMap.sectorW + sx]!
                ctx.fillStyle = SECTOR_DEBUG_COLORS[k]
                ctx.fillRect(sx * 32, sy * 32, 32, 32)
                ctx.strokeStyle = 'rgba(255,255,255,0.22)'
                ctx.strokeRect(sx * 32 + 0.5, sy * 32 + 0.5, 31, 31)
                ctx.fillStyle = 'rgba(255,255,255,0.72)'
                ctx.fillText(k.slice(0, 5), sx * 32 + 2, sy * 32 + 8)
              }
            }
          }

          // 3. Ground order pings
          for (const p of sim.pings) {
            const pImg = mui.get(p.kind === 'attack' ? 'markers/order-attack-ping.png' : 'markers/order-move-ping.png')
            if (pImg) {
              const frame = Math.min(3, Math.floor((p.age / 0.7) * 4))
              ctx.drawImage(pImg, frame * 10, 0, 10, 6, Math.round(p.x - 5), Math.round(p.y - 3), 10, 6)
            }
          }

          // 4. Live Build Grid Ghost (checks actual WFC walkability per tile!)
          if (cmdModeRef.current === 'build' && sim.hover) {
            const gx = Math.floor(sim.hover.x / TILE_PX) * TILE_PX
            const gy = Math.floor(sim.hover.y / TILE_PX) * TILE_PX
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const tx = gx + dx * TILE_PX
                const ty = gy + dy * TILE_PX
                const ok = isWalkableGround(curMap, tx + 4, ty + 4)
                const tileImg = mui.get(ok ? 'markers/build-grid-ok.png' : 'markers/build-grid-bad.png')
                if (tileImg) ctx.drawImage(tileImg, tx, ty)
              }
            }
          }

          // 5. Y-Sorted Ground Layer: Terrain Props + Buildings + Ground Units
          type DrawItem = { y: number; draw: () => void }
          const groundQueue: DrawItem[] = []

          for (const prop of curMap.props) {
            groundQueue.push({
              y: prop.y,
              draw: () => {
                const img = m2.get(prop.sheet)
                if (!img) return
                // Resource minerals stay full (frame 0); objectives/geysers/vents animate smoothly
                const isAnim = prop.id.includes('geyser') || prop.id.includes('vent') || prop.id.startsWith('neutral-')
                const col = isAnim && prop.frames > 1 ? Math.floor(sim.clock * 3 + prop.phaseOffset) % prop.frames : 0
                ctx.drawImage(
                  img,
                  col * prop.cellW,
                  0,
                  prop.cellW,
                  prop.cellH,
                  Math.round(prop.x - prop.cellW / 2),
                  Math.round(prop.y - prop.cellH + 3),
                  prop.cellW,
                  prop.cellH,
                )
              },
            })
          }

          for (const b of sim.buildings) {
            groundQueue.push({
              y: b.y,
              draw: () => {
                const bImg = m2.get(b.sheet)
                const ringBldg = mui.get('selection-rings/sel-bldg.png')
                if (ringBldg) {
                  const rState = b.faction === 'vanguard' ? 3 : 2
                  ctx.drawImage(ringBldg, rState * 36, 0, 36, 20, Math.round(b.x - 18), Math.round(b.y - 12), 36, 20)
                }
                if (bImg) {
                  const col = b.stateCol === 3 ? 3 + (Math.floor(sim.clock * 3) % 2) : b.stateCol
                  ctx.drawImage(
                    bImg,
                    col * b.cellW,
                    0,
                    b.cellW,
                    b.cellH,
                    Math.round(b.x - b.anchorX),
                    Math.round(b.y - b.anchorY),
                    b.cellW,
                    b.cellH,
                  )
                }
              },
            })
          }

          const drawUnit = (u: SimUnit) => {
            const tier = ringTierFor(u.def)
            const ringImg = mui.get(`selection-rings/${tier}.png`)
            if (ringImg && (u.selected || u.faction !== 'vanguard')) {
              const rw = tier === 'sel-lg' ? 26 : tier === 'sel-md' ? 20 : 14
              const rh = tier === 'sel-lg' ? 15 : tier === 'sel-md' ? 12 : 9
              const stateIdx = u.selected ? 0 : 2
              if (u.selected || (sim.hover && Math.hypot(sim.hover.x - u.x, sim.hover.y - u.y) < 12)) {
                ctx.drawImage(ringImg, stateIdx * rw, 0, rw, rh, Math.round(u.x - rw / 2), Math.round(u.y - rh * 0.55), rw, rh)
              }
            }

            const moving = Math.hypot(u.vx, u.vy) > 4
            const col =
              u.atkTimer > 0
                ? 6 + Math.min(3, Math.floor((1 - u.atkTimer / 0.36) * 4))
                : moving
                  ? 2 + (Math.floor(u.animClock * 9) % 4)
                  : Math.floor(u.animClock * 2.5) % 2
            const dx = Math.round(u.x - u.def.cellW / 2)
            const dy = Math.round(u.y - u.def.cellH * 0.72)

            if (u.def.twoLayer && u.def.hullSheet && u.def.turretSheet) {
              const sh = u.def.shadowSheet ? m2.get(u.def.shadowSheet) : null
              const hull = m2.get(u.def.hullSheet)
              const tur = m2.get(u.def.turretSheet)
              if (sh) ctx.drawImage(sh, 0, u.hullDir * u.def.cellH, u.def.cellW, u.def.cellH, dx, dy, u.def.cellW, u.def.cellH)
              if (hull) {
                const maxHullCols = Math.max(1, Math.floor(hull.width / u.def.cellW))
                const hCol = moving ? Math.floor(u.animClock * 8) % maxHullCols : 0
                ctx.drawImage(hull, hCol * u.def.cellW, u.hullDir * u.def.cellH, u.def.cellW, u.def.cellH, dx, dy, u.def.cellW, u.def.cellH)
              }
              if (tur) {
                const maxTurCols = Math.max(1, Math.floor(tur.width / u.def.cellW))
                const tCol = u.atkTimer > 0 ? Math.min(maxTurCols - 1, Math.floor((1 - u.atkTimer / 0.36) * maxTurCols)) : 0
                ctx.drawImage(tur, tCol * u.def.cellW, u.turretDir * u.def.cellH, u.def.cellW, u.def.cellH, dx, dy, u.def.cellW, u.def.cellH)
              }
            } else {
              const sheet = m2.get(u.def.sheet)
              if (sheet) {
                ctx.drawImage(sheet, col * u.def.cellW, u.hullDir * u.def.cellH, u.def.cellW, u.def.cellH, dx, dy, u.def.cellW, u.def.cellH)
              }
            }

            if (u.selected || u.hp < u.maxHp) {
              const bw = Math.max(8, Math.min(18, u.def.cellW - 2))
              const bx = Math.round(u.x - bw / 2)
              const by = dy - 3
              ctx.fillStyle = '#090d14'
              ctx.fillRect(bx - 1, by - 1, bw + 2, 3)
              const ratio = Math.max(0, u.hp / u.maxHp)
              ctx.fillStyle = u.faction === 'vanguard' ? '#4ade80' : u.faction === 'kraxen' ? '#f472b6' : '#facc15'
              ctx.fillRect(bx, by, Math.max(1, Math.round(bw * ratio)), 1)
            }
          }

          const airUnits: SimUnit[] = []
          for (const u of sim.units) {
            if (u.def.layer === 'air') airUnits.push(u)
            else groundQueue.push({ y: u.y, draw: () => drawUnit(u) })
          }

          groundQueue.sort((a, b) => a.y - b.y)
          for (const item of groundQueue) item.draw()

          airUnits.sort((a, b) => a.y - b.y)
          for (const u of airUnits) drawUnit(u)

          // 6. Projectiles & Discrete Beams
          for (const p of sim.projectiles) {
            if (p.kind === 'beam') {
              drawDiscreteRampBeam(ctx, p.x, p.y, p.tx, p.ty, p.tier ?? 2, p.color, p.coreColor)
            } else if (p.kind === 'chain') {
              drawDiscreteChainArc(ctx, p.x, p.y, p.tx, p.ty, Math.floor(sim.clock * 18), p.color, p.coreColor)
            } else {
              const tailX = p.x - p.vx * 0.03
              const tailY = p.y - p.vy * 0.03
              drawDiscreteLine(ctx, tailX, tailY, p.x, p.y, p.color, p.kind === 'missile' ? 2 : 1)
              ctx.fillStyle = p.coreColor
              ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
            }
          }

          // 7. Combat VFX strips
          for (const f of sim.fx) {
            const fxImg = m2.get(f.sheet)
            if (!fxImg) continue
            const col = Math.min(f.frames - 1, Math.floor((f.age / f.duration) * f.frames))
            ctx.drawImage(fxImg, col * f.cellW, 0, f.cellW, f.cellH, Math.round(f.x - f.cellW / 2), Math.round(f.y - f.cellH / 2), f.cellW, f.cellH)
          }

          // 8. Drag selection box
          if (sim.drag?.active) {
            const x = Math.min(sim.drag.x0, sim.drag.x1)
            const y = Math.min(sim.drag.y0, sim.drag.y1)
            const w = Math.abs(sim.drag.x1 - sim.drag.x0)
            const h = Math.abs(sim.drag.y1 - sim.drag.y0)
            ctx.fillStyle = 'rgba(74, 222, 128, 0.14)'
            ctx.fillRect(x, y, w, h)
            ctx.strokeStyle = '#4ade80'
            ctx.lineWidth = 1
            ctx.strokeRect(x + 0.5, y + 0.5, w, h)
          }
        }
      }

      if (fpsAccum >= 0.4) {
        setStats({
          fps: Math.round(fpsFrames / fpsAccum),
          units: sim.units.length,
          projectiles: sim.projectiles.length,
          minerals: 450 + Math.floor(sim.clock * 4),
          gas: 180 + Math.floor(sim.clock * 2),
          supply: sim.units.filter((u) => u.faction === 'vanguard').length * 2,
        })
        fpsAccum = 0
        fpsFrames = 0
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const canvasCoords = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * WORLD_W,
      y: ((e.clientY - rect.top) / rect.height) * WORLD_H,
    }
  }

  const issueOrder = (x: number, y: number, kind: 'move' | 'attack') => {
    const sim = simRef.current
    const selected = sim.units.filter((u) => u.selected)
    const targets = selected.length > 0 ? selected : sim.units.filter((u) => u.faction === 'vanguard')
    targets.forEach((u, idx) => {
      const ang = (idx / Math.max(1, targets.length)) * Math.PI * 2
      const rad = targets.length > 1 ? 8 + (idx % 3) * 5 : 0
      u.orderX = Math.max(16, Math.min(WORLD_W - 16, x + Math.cos(ang) * rad))
      u.orderY = Math.max(18, Math.min(WORLD_H - 16, y + Math.sin(ang) * rad))
      u.orderType = kind
    })
    sim.pings.push({ x, y, kind, age: 0 })
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = canvasCoords(e)
    const sim = simRef.current
    if (e.button === 2) {
      issueOrder(pt.x, pt.y, 'attack')
      return
    }
    if (cmdMode === 'move' || cmdMode === 'attack') {
      issueOrder(pt.x, pt.y, cmdMode)
      setCmdMode('select')
      return
    }
    if (cmdMode === 'build') {
      const gx = Math.floor(pt.x / TILE_PX) * TILE_PX + 4
      const gy = Math.floor(pt.y / TILE_PX) * TILE_PX + 4
      if (isWalkableGround(mapRef.current, gx, gy)) {
        const b = catalog.buildings.buildings.find((e) => e.id === 'vanguard-turret')
        sim.buildings.push({
          id: `vanguard-turret-${sim.nextUid++}`,
          x: gx,
          y: gy,
          faction: 'vanguard',
          sheet: b?.stateSheet ?? 'buildings/building-vanguard-turret-states.png',
          cellW: b?.stateCellW ?? 22,
          cellH: b?.stateCellH ?? 20,
          anchorX: b?.stateAnchorX ?? 10,
          anchorY: b?.stateAnchorY ?? 17,
          stateCol: 3,
        })
        setCmdMode('select')
      }
      return
    }
    sim.drag = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, active: true }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = canvasCoords(e)
    simRef.current.hover = pt
    if (simRef.current.drag?.active) {
      simRef.current.drag.x1 = pt.x
      simRef.current.drag.y1 = pt.y
    }
  }

  const handlePointerUp = () => {
    const sim = simRef.current
    if (!sim.drag?.active) return
    const { x0, y0, x1, y1 } = sim.drag
    sim.drag = null
    const minX = Math.min(x0, x1)
    const maxX = Math.max(x0, x1)
    const minY = Math.min(y0, y1)
    const maxY = Math.max(y0, y1)
    const isClick = maxX - minX < 4 && maxY - minY < 4
    for (const u of sim.units) {
      if (u.faction !== 'vanguard') {
        u.selected = false
        continue
      }
      if (isClick) {
        u.selected = Math.hypot(u.x - x0, u.y - y0) < 12
      } else {
        u.selected = u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY
      }
    }
    setSelectedCount(sim.units.filter((u) => u.selected).length)
  }

  return (
    <div className="skirmish-wrap">
      <div className="skirmish-toolbar">
        <div className="pill-row">
          <span className="section-title" style={{ margin: '0 4px 0 0' }}>
            Biome
          </span>
          {catalog.environment.biomes.map((b) => (
            <button
              key={b.theme}
              className={`pill ${biomeTheme === b.theme ? 'active' : ''}`}
              onClick={() => setBiomeTheme(b.theme)}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="pill-row">
          <span className="section-title" style={{ margin: '0 4px 0 0' }}>
            WFC Map
          </span>
          {MAP_PRESETS.map((p) => (
            <button key={p.id} className={`pill ${mapPreset === p.id ? 'active' : ''}`} onClick={() => setMapPreset(p.id)}>
              {p.label}
            </button>
          ))}
          <button className="pill" onClick={() => setMapSeed((s) => s + 1)}>
            New Seed (#{mapSeed})
          </button>
          <button className={`pill ${showWfcGrid ? 'active' : ''}`} onClick={() => setShowWfcGrid((v) => !v)}>
            WFC Grid
          </button>
        </div>

        <div className="pill-row">
          {([1, 2, 3] as const).map((z) => (
            <button key={z} className={`pill ${zoom === z ? 'active' : ''}`} onClick={() => setZoom(z)}>
              {z}×
            </button>
          ))}
          <button className="pill" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="pill" onClick={() => spawnWave(false)}>
            + Reinforce
          </button>
          <button className="pill" onClick={() => spawnWave(true)}>
            Reset
          </button>
          <span className="tag good">{stats.fps} FPS</span>
          <span className="tag accent">{stats.units} Units</span>
          <span className="tag gold">{selectedCount} Sel</span>
        </div>
      </div>

      <div className="skirmish-canvas-area">
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: WORLD_W * zoom,
            height: WORLD_H * zoom,
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            border: '1px solid #263650',
            borderRadius: 6,
            cursor: cmdMode === 'build' ? 'cell' : cmdMode === 'attack' ? 'crosshair' : 'default',
          }}
        />
      </div>

      <div className="hud-bar">
        <div className="hud-resources">
          <span className="hud-res-chip">
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-mineral.png" cellW={12} cellH={9} scale={2} />
            {stats.minerals}
          </span>
          <span className="hud-res-chip">
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-gas.png" cellW={12} cellH={9} scale={2} />
            {stats.gas}
          </span>
          <span className="hud-res-chip">
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-supply.png" cellW={12} cellH={9} scale={2} />
            {stats.supply}/60
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            WFC + Dual-Grid Wang-16 Terrain · {battleMap.ramps.length} Ramps · {battleMap.bridges.length} Bridges · {battleMap.props.length} Biome Props
          </span>
        </div>

        <div className="hud-commands">
          <button
            className={`hud-cmd-btn ${cmdMode === 'move' ? 'active' : ''}`}
            onClick={() => setCmdMode((m) => (m === 'move' ? 'select' : 'move'))}
          >
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-move.png" cellW={12} cellH={9} scale={2} />
            Move
          </button>
          <button
            className={`hud-cmd-btn ${cmdMode === 'attack' ? 'active' : ''}`}
            onClick={() => setCmdMode((m) => (m === 'attack' ? 'select' : 'attack'))}
          >
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-attack.png" cellW={12} cellH={9} scale={2} />
            Attack
          </button>
          <button
            className={`hud-cmd-btn ${cmdMode === 'build' ? 'active' : ''}`}
            onClick={() => setCmdMode((m) => (m === 'build' ? 'select' : 'build'))}
          >
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-build.png" cellW={12} cellH={9} scale={2} />
            Build Turret
          </button>
          <button
            className="hud-cmd-btn"
            onClick={() => {
              for (const u of simRef.current.units) {
                if (u.selected) {
                  u.orderX = null
                  u.orderY = null
                  u.orderType = null
                }
              }
            }}
          >
            <SpriteCellCanvas leafId={LEAF_UI} path="icons/icon-stop.png" cellW={12} cellH={9} scale={2} />
            Stop
          </button>
        </div>
      </div>
    </div>
  )
}
