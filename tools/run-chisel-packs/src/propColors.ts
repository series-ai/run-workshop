import { join } from 'node:path'
import type { PackCatalog } from '../contracts/catalog'
import { authoredPaletteSchema, COLOR_DIRECTION, propPaletteFor } from '../contracts/colorDirection'
import { leafFor } from '../contracts/packs'
import { PALETTE_REGIONS, type PaletteColors } from '../contracts/palette'
import { parseGlb, readAccessor, type ParsedGlb } from './glbInspect'
import { assertPropScale } from './propScale'

function linearChannel(hex: string): number {
  const srgb = Number.parseInt(hex, 16) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

export function assertPropColors(glb: ParsedGlb, nodeName: string, palette: PaletteColors): void {
  const node = glb.doc.nodes?.find((entry) => entry.name === nodeName)
  const attributes = glb.doc.meshes?.[node?.mesh ?? -1]?.primitives[0]?.attributes
  if (!attributes) throw new Error(`Prop "${nodeName}" needs a mesh primitive`)
  const color = glb.doc.accessors?.[attributes.COLOR_0 ?? -1]
  const position = glb.doc.accessors?.[attributes.POSITION ?? -1]
  if (color?.componentType !== 5121 || color.type !== 'VEC4' || !color.normalized || color.count !== position?.count) {
    throw new Error(`Prop "${nodeName}" needs compact normalized vertex colors for standard glTF viewers`)
  }
  const uv = glb.doc.accessors?.[attributes.TEXCOORD_0 ?? -1]
  if (uv?.componentType !== 5126 || uv.type !== 'VEC2' || uv.count !== color.count) {
    throw new Error(`Prop "${nodeName}" needs one palette UV for each vertex color`)
  }

  const tints = PALETTE_REGIONS.map((role) => [1, 3, 5].map((offset) => linearChannel(palette[role].slice(offset, offset + 2))))
  const { uvMin, uvMax, dark, bright } = COLOR_DIRECTION.shade
  const colors = readAccessor(glb, attributes.COLOR_0!)
  const texcoords = readAccessor(glb, attributes.TEXCOORD_0!)
  for (const [index, [u, v]] of texcoords.entries()) {
    if (u === undefined || v === undefined || !Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u >= 1) {
      throw new Error(`Prop "${nodeName}" has an invalid palette UV at vertex ${index}`)
    }
    const tint = tints[Math.floor(u * PALETTE_REGIONS.length)]!
    const shade = dark + (bright - dark) * Math.min(1, Math.max(0, (v - uvMin) / (uvMax - uvMin)))
    const rgba = colors[index]!
    // Allow one byte for float precision and rounding at export.
    if (rgba[3] !== 255 || tint.some((channel, i) => Math.abs(rgba[i]! - Math.round(Math.min(1, channel * shade) * 255)) > 1)) {
      throw new Error(`Prop "${nodeName}" has stale or invalid palette colors at vertex ${index}. Run npm run build and render its thumbnails again.`)
    }
  }
}

export function assertPackColorAssignments(catalog: PackCatalog): void {
  for (const preset of catalog.presets) {
    const result = authoredPaletteSchema.safeParse(preset.palette)
    if (!result.success) {
      throw new Error(`${catalog.pack}/${preset.id}: ${result.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join(' ')}`)
    }
  }
  if (catalog.pack === 'core') return
  const propIds = new Set(catalog.props.map(({ id }) => id))
  for (const id of Object.keys(COLOR_DIRECTION.packs[catalog.pack].props.overrides)) {
    if (!propIds.has(id)) throw new Error(`${catalog.pack}: palette override names unknown prop "${id}"`)
  }
}

export function assertStagedProps(catalog: PackCatalog, stageDir: string): void {
  assertPackColorAssignments(catalog)
  for (const prop of catalog.props) {
    const path = join(stageDir, leafFor(prop.pack, prop.leaf).id, prop.relativePath)
    const glb = parseGlb(path)
    assertPropColors(glb, prop.nodeName, propPaletteFor(prop.pack, prop.id))
    assertPropScale(glb, prop)
  }
}
