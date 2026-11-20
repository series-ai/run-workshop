import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PackCatalog, WorldPropEntry } from '@chisel/contracts/catalog'
import { CONTEXT_PACK_KEYS, type ContextPackKey } from '@chisel/contracts/packs'
import { DIORAMA_SPACING, SCENE_LAYOUTS, SCENE_PAD_RADIUS } from './sceneLayouts'

const CATALOG_DIR = resolve(import.meta.dirname, '../../public/catalog')
const FLOOR_TILE_RE = /(?:floor_tile|sidewalk_tile|road_crosswalk|grate_tile|duckboard)/
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

function worldBox(prop: WorldPropEntry, pos: readonly [number, number, number], rotationY = 0): Box2D {
  const [minX, minY, minZ] = prop.bounds.min
  const [maxX, maxY, maxZ] = prop.bounds.max
  const c = Math.cos(rotationY)
  const s = Math.sin(rotationY)
  // Three.js rotation.y: x' = x*cos(a) + z*sin(a), z' = -x*sin(a) + z*cos(a)
  const localCorners: Array<[number, number]> = [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ]
  const corners: Array<[number, number]> = localCorners.map(([lx, lz]) => [
    pos[0] + lx * c + lz * s,
    pos[2] - lx * s + lz * c,
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

describe('SCENE_LAYOUTS', () => {
  it('leaves generous separation between adjacent diorama pads', () => {
    expect(DIORAMA_SPACING).toBeGreaterThan(SCENE_PAD_RADIUS * 2 + 0.3)
  })

  for (const pack of CONTEXT_PACK_KEYS) {
    describe(pack, () => {
      const catalog = loadCatalog(pack)
      const layout = SCENE_LAYOUTS[pack]
      const propById = new Map(catalog.props.map((p) => [p.id, p]))

      it('includes every single catalog world prop in the diorama', () => {
        const placedIds = new Set(layout.props.map((p) => p.id))
        const missing = catalog.props.map((p) => p.id).filter((id) => !placedIds.has(id))
        expect(missing, `Missing props in ${pack}`).toEqual([])
      })

      it('references valid prop IDs and valid cyclic/rest clips', () => {
        for (const placement of layout.props) {
          const prop = propById.get(placement.id)
          expect(prop, `Unknown prop ${placement.id}`).toBeDefined()
          if (placement.clip !== undefined) {
            expect(prop!.clips ?? [], `${placement.id} does not define clip "${placement.clip}"`).toContain(placement.clip)
            expect(CYCLIC_REST_CLIPS.has(placement.clip), `${placement.id} clip "${placement.clip}" is not cyclic/rest`).toBe(true)
          }
        }
      })

      it('keeps every prop and avatar within the diorama pad footprint and properly grounded on tiles', () => {
        // 10-sided diorama pad has inscribed apothem R * cos(pi/10)
        const maxRadius = layout.padRadius + 0.05
        const tiles = layout.props
          .filter((p) => FLOOR_TILE_RE.test(p.id))
          .map((p) => ({ placement: p, prop: propById.get(p.id)!, box: worldBox(propById.get(p.id)!, p.position, p.rotationY) }))

        for (const placement of layout.props) {
          const prop = propById.get(placement.id)!
          const box = worldBox(prop, placement.position, placement.rotationY)
          for (const [cx, cz] of box.corners) {
            const dist = Math.hypot(cx, cz)
            expect(dist, `${placement.id} corner (${cx.toFixed(2)}, ${cz.toFixed(2)}) exceeds pad radius`).toBeLessThanOrEqual(maxRadius)
          }

          if (!FLOOR_TILE_RE.test(placement.id)) {
            const under = tiles.find(
              (t) =>
                placement.position[0] >= t.box.minX - 0.01 &&
                placement.position[0] <= t.box.maxX + 0.01 &&
                placement.position[2] >= t.box.minZ - 0.01 &&
                placement.position[2] <= t.box.maxZ + 0.01,
            )
            const expectedY = under ? under.prop.bounds.max[1] : 0
            expect(placement.position[1], `${placement.id} Y elevation mismatch`).toBeCloseTo(expectedY, 2)
          }
        }

        for (let i = 0; i < layout.avatars.length; i++) {
          const av = layout.avatars[i]!
          expect(Math.hypot(av.position[0], av.position[2]), `avatar ${i} outside pad`).toBeLessThanOrEqual(layout.padRadius - 0.5)
          const under = tiles.find(
            (t) =>
              av.position[0] >= t.box.minX - 0.01 &&
              av.position[0] <= t.box.maxX + 0.01 &&
              av.position[2] >= t.box.minZ - 0.01 &&
              av.position[2] <= t.box.maxZ + 0.01,
          )
          const expectedY = under ? under.prop.bounds.max[1] : 0
          expect(av.position[1], `avatar ${i} Y elevation mismatch`).toBeCloseTo(expectedY, 2)
        }
      })

      it('has zero prop-to-prop or avatar-to-prop intersections', () => {
        const boxes = layout.props.map((placement, idx) => {
          const prop = propById.get(placement.id)!
          return {
            idx,
            placement,
            prop,
            box: worldBox(prop, placement.position, placement.rotationY),
          }
        })

        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!
            const b = boxes[j]!
            const yOverlap = Math.min(a.box.maxY, b.box.maxY) - Math.max(a.box.minY, b.box.minY)
            if (yOverlap <= 0.01) continue
            const xzOverlap = obbOverlapXZ(a.box.corners, b.box.corners)
            expect(
              xzOverlap,
              `${pack}: ${a.placement.id}#${a.idx} overlaps ${b.placement.id}#${b.idx} by ${xzOverlap.toFixed(3)}m (yOverlap=${yOverlap.toFixed(2)}m)`,
            ).toBeLessThanOrEqual(0.02)
          }
        }

        for (let i = 0; i < layout.avatars.length; i++) {
          const avA = layout.avatars[i]!
          for (let j = i + 1; j < layout.avatars.length; j++) {
            const avB = layout.avatars[j]!
            const dist = Math.hypot(avA.position[0] - avB.position[0], avA.position[2] - avB.position[2])
            expect(dist, `${pack}: avatars ${i} and ${j} too close`).toBeGreaterThanOrEqual(0.65)
          }

          const preset = catalog.presets[i]
          const avatarRadius = preset?.rigId === 'ual1' ? 0.36 : 0.65
          for (const item of boxes) {
            if (FLOOR_TILE_RE.test(item.placement.id)) continue
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
