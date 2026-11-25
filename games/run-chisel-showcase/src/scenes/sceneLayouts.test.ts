import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PackCatalog, WorldPropEntry } from '@chisel/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@chisel/contracts/packs'
import { RIG_SPECS } from '@chisel/contracts/rig'
import {
  DIORAMA_SPACING,
  isFloorTileId,
  SCENE_BACKDROPS,
  SCENE_DEPTH,
  SCENE_LAYOUTS,
  SCENE_WIDTH,
  type PropPlacement,
} from './sceneLayouts'

const CATALOG_DIR = resolve(import.meta.dirname, '../../public/catalog')
const CYCLIC_REST_CLIPS = new Set([
  'Idle',
  'Hover',
  'Spin',
  'Sweep',
  'Swing',
  'Loop',
  'Pulse',
  'Active',
  'Open',
  'Closed',
  'Down',
  'Armed',
])

const WATER_OR_LAVA_VESSELS = new Set(['prop_wooden_bridge', 'prop_lava_bridge', 'prop_rowboat', 'prop_lava_vent'])
const CLIFF_BLOCKS = new Set(['prop_cliff_block', 'prop_basalt_cliff_block'])

function loadCatalog(pack: ContextPackKey): PackCatalog {
  return JSON.parse(readFileSync(resolve(CATALOG_DIR, pack, 'catalog.json'), 'utf8')) as PackCatalog
}

interface Box2D {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY: number
  maxY: number
  corners: Array<[number, number]>
}

function worldBox(prop: WorldPropEntry, { position: pos, rotationY = 0, scale = [1, 1, 1] }: PropPlacement): Box2D {
  const [minX, minY, minZ] = prop.bounds.min
  const [maxX, maxY, maxZ] = prop.bounds.max
  const c = Math.cos(rotationY)
  const s = Math.sin(rotationY)
  const localCorners: Array<[number, number]> = [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ]
  const corners: Array<[number, number]> = localCorners.map(([lx, lz]) => [
    pos[0] + lx * scale[0] * c + lz * scale[2] * s,
    pos[2] - lx * scale[0] * s + lz * scale[2] * c,
  ])
  const xs = corners.map(([x]) => x)
  const zs = corners.map(([, z]) => z)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    minY: pos[1] + minY,
    maxY: pos[1] + maxY,
    corners,
  }
}

/** Separating Axis Theorem in XZ between two oriented rectangles (from rotated AABBs). */
function obbOverlapXZ(aCorners: Array<[number, number]>, bCorners: Array<[number, number]>): number {
  const axes = [
    [aCorners[1]![0] - aCorners[0]![0], aCorners[1]![1] - aCorners[0]![1]],
    [aCorners[3]![0] - aCorners[0]![0], aCorners[3]![1] - aCorners[0]![1]],
    [bCorners[1]![0] - bCorners[0]![0], bCorners[1]![1] - bCorners[0]![1]],
    [bCorners[3]![0] - bCorners[0]![0], bCorners[3]![1] - bCorners[0]![1]],
  ]
  let minOverlap = Infinity
  for (const [ax, az] of axes) {
    const len = Math.hypot(ax!, az!)
    if (len < 1e-6) continue
    const nx = ax! / len
    const nz = az! / len
    let aMin = Infinity
    let aMax = -Infinity
    for (const [cx, cz] of aCorners) {
      const p = cx * nx + cz * nz
      aMin = Math.min(aMin, p)
      aMax = Math.max(aMax, p)
    }
    let bMin = Infinity
    let bMax = -Infinity
    for (const [cx, cz] of bCorners) {
      const p = cx * nx + cz * nz
      bMin = Math.min(bMin, p)
      bMax = Math.max(bMax, p)
    }
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin)
    if (overlap <= 0) return 0
    minOverlap = Math.min(minOverlap, overlap)
  }
  return minOverlap
}

function pointToObbDistanceXZ(px: number, pz: number, corners: Array<[number, number]>): number {
  const [x0, z0] = corners[0]!
  const [x1, z1] = corners[1]!
  const [x3, z3] = corners[3]!
  const ux = x1 - x0
  const uz = z1 - z0
  const vx = x3 - x0
  const vz = z3 - z0
  const uLen = Math.hypot(ux, uz)
  const vLen = Math.hypot(vx, vz)
  const dx = px - (x0 + ux * 0.5 + vx * 0.5)
  const dz = pz - (z0 + uz * 0.5 + vz * 0.5)
  const localU = Math.abs((dx * ux + dz * uz) / uLen) - uLen * 0.5
  const localV = Math.abs((dx * vx + dz * vz) / vLen) - vLen * 0.5
  return Math.hypot(Math.max(0, localU), Math.max(0, localV))
}

interface IndexedBox {
  placement: PropPlacement
  prop: WorldPropEntry
  box: Box2D
}

/** Playable surface height of a tile or elevated structure at (x, z). */
function tileDeckY(entry: IndexedBox): number {
  const id = entry.placement.id
  if (id === 'prop_moat_water_tile') return 0.058
  if (id === 'prop_lava_pool_tile' || id === 'prop_lava_shore_tile' || id === 'prop_swamp_sludge_tile') return 0.055
  if (id === 'prop_road_straight' || id === 'prop_road_corner' || id === 'prop_road_tsplit' || id === 'prop_road_junction' || id === 'prop_road_crosswalk') {
    return entry.placement.position[1] + 0.075
  }
  if (id === 'prop_dirt_path_tile' || id === 'prop_cobble_road_tile' || id.startsWith('prop_dirt_road_') || id === 'prop_crater_ground_tile') {
    return entry.placement.position[1] + 0.125
  }
  if (id === 'prop_basalt_floor_tile') return entry.placement.position[1] + 0.14
  if (id === 'prop_obsidian_dais_tile') return entry.placement.position[1] + 0.24
  if (id === 'prop_sidewalk_tile' || id === 'prop_sidewalk_corner' || id === 'prop_park_grass_tile') {
    return entry.placement.position[1] + 0.158
  }
  if (id === 'prop_grass_tile' || id === 'prop_stone_floor_tile') return entry.placement.position[1] + 0.135
  return entry.box.maxY
}

function supportingSurface(x: number, z: number, surfaces: readonly IndexedBox[]): IndexedBox | undefined {
  return surfaces.find(({ box }) => pointToObbDistanceXZ(x, z, box.corners) <= 0.01)
}

function expectedGroundY(placement: PropPlacement, tiles: readonly IndexedBox[], cliffs: readonly IndexedBox[]): number {
  if (isFloorTileId(placement.id) || CLIFF_BLOCKS.has(placement.id)) return 0
  if (placement.id === 'prop_wooden_bridge' || placement.id === 'prop_lava_bridge') return 0
  const [x, , z] = placement.position
  const cliff = supportingSurface(x, z, cliffs)
  if (cliff) return cliff.box.maxY
  const tile = supportingSurface(x, z, tiles)
  return tile ? tileDeckY(tile) : 0
}

describe('SCENE_LAYOUTS', () => {
  it('separates adjacent plots at their maximum width', () => {
    expect(SCENE_WIDTH).toBe(14.0)
    expect(SCENE_DEPTH).toBe(14.0)
    expect(DIORAMA_SPACING).toBeGreaterThan(SCENE_WIDTH + 0.8)
  })

  it('gives both vehicle scenes an adult-scale traffic lane', () => {
    for (const [pack, id, across] of [
      ['sim', 'prop_road_crosswalk', 2],
      ['ww2', 'prop_dirt_road_straight', 0],
    ] as const) {
      const lane = loadCatalog(pack).props.find((prop) => prop.id === id)!
      const placement = SCENE_LAYOUTS[pack].props.find((prop) => prop.id === id)!
      const scale = placement.scale?.[across] ?? 1
      expect(lane.bounds.size[across] * scale, `${pack} lane width in metres`).toBeGreaterThanOrEqual(3)
    }
  })

  for (const pack of CONTEXT_PACK_KEYS) {
    describe(pack, () => {
      const catalog = loadCatalog(pack)
      const layout = SCENE_LAYOUTS[pack]
      const propById = new Map(catalog.props.map((p) => [p.id, p]))
      const presetById = new Map(catalog.presets.map((p) => [p.id, p]))

      it('reserves space for actors and repeats props that define the place', () => {
        const scenery = layout.props.filter(({ id }) => !isFloorTileId(id))
        const distinct = new Set(scenery.map(({ id }) => id))
        expect(distinct.size).toBeLessThan(scenery.length)
        expect(distinct.size).toBeLessThan(catalog.props.length / 2)
        expect(layout.avatars.length).toBeGreaterThanOrEqual(2)
      })

      it('references valid prop IDs, cyclic/rest clips, and valid avatar presets/clips', () => {
        for (const placement of [...layout.props, ...SCENE_BACKDROPS[pack]]) {
          const prop = propById.get(placement.id)
          expect(prop, `Unknown prop ${placement.id}`).toBeDefined()
          if (placement.clip !== undefined) {
            expect(prop!.clips ?? [], `${placement.id} does not define clip "${placement.clip}"`).toContain(placement.clip)
            expect(CYCLIC_REST_CLIPS.has(placement.clip), `${placement.id} clip "${placement.clip}" is not cyclic/rest`).toBe(true)
          }
        }
        for (let i = 0; i < layout.avatars.length; i++) {
          const av = layout.avatars[i]!
          const preset = av.presetId !== undefined ? presetById.get(av.presetId) : catalog.presets[i]
          expect(preset, `Unknown preset "${av.presetId ?? i}" in ${pack}`).toBeDefined()
          if (av.heldLeft !== undefined) {
            const held = catalog.heldItems.find(({ id }) => id === av.heldLeft)
            expect(held?.hand, `${av.heldLeft} requires a left-hand grip`).toBe('hand_l')
          }
          if (av.clip !== undefined) {
            expect(RIG_SPECS[preset!.rigId].clips, `${preset!.id} rig lacks clip "${av.clip}"`).toContain(av.clip)
          }
        }
      })

      it('keeps props and actors inside the plot and on their support surfaces', () => {
        const halfW = layout.width / 2
        const halfD = layout.depth / 2
        const indexed: IndexedBox[] = layout.props.map((placement) => {
          const prop = propById.get(placement.id)!
          return { placement, prop, box: worldBox(prop, placement) }
        })
        const tiles = indexed.filter((entry) => isFloorTileId(entry.placement.id))
        const cliffs = indexed.filter((entry) => entry.placement.id === 'prop_cliff_block' || entry.placement.id === 'prop_basalt_cliff_block')
        for (const { placement, box } of indexed) {
          for (const [cx, cz] of box.corners) {
            expect(Math.abs(cx), `${placement.id} X=${cx.toFixed(2)} exceeds plot halfWidth`).toBeLessThanOrEqual(halfW + 0.05)
            expect(Math.abs(cz), `${placement.id} Z=${cz.toFixed(2)} exceeds plot halfDepth`).toBeLessThanOrEqual(halfD + 0.05)
          }
          const expectedY = expectedGroundY(placement, tiles, cliffs)
          expect(Math.abs(placement.position[1] - expectedY), `${placement.id} Y=${placement.position[1]} vs expected ${expectedY}`).toBeLessThanOrEqual(0.025)
        }

        for (let i = 0; i < layout.avatars.length; i++) {
          const av = layout.avatars[i]!
          expect(Math.abs(av.position[0]), `avatar ${i} X outside plot`).toBeLessThanOrEqual(halfW - 0.35)
          expect(Math.abs(av.position[2]), `avatar ${i} Z outside plot`).toBeLessThanOrEqual(halfD - 0.35)
          if (av.insideProp) {
            const shell = indexed.find(({ placement }) => placement === av.insideProp)
            expect(shell, `avatar ${i} requires its enclosing prop in the layout`).toBeDefined()
            expect(pointToObbDistanceXZ(av.position[0], av.position[2], shell!.box.corners)).toBe(0)
            expect(av.position[1]).toBeGreaterThanOrEqual(shell!.box.minY)
            expect(av.position[1]).toBeLessThan(shell!.box.maxY)
            continue
          }
          const under = supportingSurface(av.position[0], av.position[2], [...cliffs, ...tiles])
          const expectedY = under ? tileDeckY(under) : 0
          expect(Math.abs(av.position[1] - expectedY), `avatar ${i} Y=${av.position[1]} vs expected ${expectedY}`).toBeLessThanOrEqual(0.025)
        }
      })

      it('has zero prop-to-prop or avatar-to-prop intersections', () => {
        const boxes = layout.props.map((placement, idx) => {
          const prop = propById.get(placement.id)!
          return {
            idx,
            placement,
            prop,
            box: worldBox(prop, placement),
          }
        })

        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!
            const b = boxes[j]!
            const aVessel = WATER_OR_LAVA_VESSELS.has(a.placement.id)
            const bVessel = WATER_OR_LAVA_VESSELS.has(b.placement.id)
            if ((aVessel && isFloorTileId(b.placement.id)) || (bVessel && isFloorTileId(a.placement.id))) {
              continue
            }
            const aCliff = CLIFF_BLOCKS.has(a.placement.id)
            const bCliff = CLIFF_BLOCKS.has(b.placement.id)
            if ((aCliff && isFloorTileId(b.placement.id)) || (bCliff && isFloorTileId(a.placement.id))) {
              continue
            }
            const yOverlap = Math.min(a.box.maxY, b.box.maxY) - Math.max(a.box.minY, b.box.minY)
            if (yOverlap <= 0.01) continue
            // Allow props seated on a tile's flat asphalt/dirt bed to sit slightly lower than raised 2cm road curbs or dirt ruts.
            if ((isFloorTileId(a.placement.id) || isFloorTileId(b.placement.id)) && yOverlap <= 0.025) {
              continue
            }
            const xzOverlap = obbOverlapXZ(a.box.corners, b.box.corners)
            expect(
              xzOverlap,
              `${pack}: ${a.placement.id}#${a.idx} overlaps ${b.placement.id}#${b.idx} by ${xzOverlap.toFixed(3)}m (yOverlap=${yOverlap.toFixed(2)}m)`,
            ).toBeLessThanOrEqual(0.025)
          }
        }

        for (let i = 0; i < layout.avatars.length; i++) {
          const avA = layout.avatars[i]!
          if (avA.position[1] >= 0.5) continue
          for (let j = i + 1; j < layout.avatars.length; j++) {
            const avB = layout.avatars[j]!
            if (avB.position[1] >= 0.5) continue
            const dist = Math.hypot(avA.position[0] - avB.position[0], avA.position[2] - avB.position[2])
            expect(dist, `${pack}: avatars ${i} and ${j} too close`).toBeGreaterThanOrEqual(0.65)
          }

          const preset = avA.presetId !== undefined ? presetById.get(avA.presetId) : catalog.presets[i]
          const avatarRadius = preset?.rigId === 'ual1' ? 0.34 : 0.55
          for (const item of boxes) {
            if (item.placement === avA.insideProp) continue
            if (isFloorTileId(item.placement.id)) continue
            if (item.box.maxY <= avA.position[1] + 0.05) continue
            const dist = pointToObbDistanceXZ(avA.position[0], avA.position[2], item.box.corners)
            expect(
              dist,
              `${pack}: avatar ${i} (${preset?.id ?? 'unknown'}) intersects ${item.placement.id} (dist=${dist.toFixed(3)}m < ${avatarRadius})`,
            ).toBeGreaterThanOrEqual(avatarRadius)
          }
        }
      })
    })
  }
})
