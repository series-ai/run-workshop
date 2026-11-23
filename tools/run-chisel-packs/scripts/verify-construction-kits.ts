import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DoubleSide, Mesh, MeshBasicMaterial } from 'three'
import { buildManifestSchema } from '../contracts/catalog'
import { CONTEXT_PACK_KEYS, leafFor } from '../contracts/packs'
import { loadGlbHeadless } from '../src/animationAudit'
import { withConstructionKit } from '../src/constructionKitCatalog'
import { measureConstructionRoute } from '../src/constructionRoute'
import { META_DIR, STAGE_DIR } from '../src/paths'

async function main() {
  const manifest = buildManifestSchema.parse(JSON.parse(readFileSync(join(META_DIR, 'manifest.json'), 'utf8')))
  const packFilter = process.argv[2]
  if (packFilter && !CONTEXT_PACK_KEYS.some((pack) => pack === packFilter)) {
    throw new Error(`Unknown kit "${packFilter}". Choose one of ${CONTEXT_PACK_KEYS.join(', ')}.`)
  }
  const selected = packFilter ? CONTEXT_PACK_KEYS.filter((pack) => pack === packFilter) : CONTEXT_PACK_KEYS
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const failures: string[] = []

  for (const pack of selected) {
    const entry = manifest.packs.find((catalog) => catalog.pack === pack)
    const kit = entry && withConstructionKit(entry).constructionKit
    if (!entry || !kit) {
      failures.push(`Missing construction layouts for ${pack}.`)
      continue
    }
    const props = new Map(entry.props.map((prop) => [prop.id, prop]))
    const sources = new Map<string, Promise<Mesh>>()
    for (const layout of kit.layouts) {
      const meshes = await Promise.all(layout.props.map(async (placement) => {
        let source = sources.get(placement.id)
        if (!source) {
          const prop = props.get(placement.id)!
          const path = join(STAGE_DIR, leafFor(pack, prop.leaf).id, prop.relativePath)
          source = loadGlbHeadless(path).then((gltf) => {
            const node = gltf.scene.getObjectByName(prop.nodeName)
            if (!(node instanceof Mesh)) throw new Error(`Missing mesh "${prop.nodeName}" in ${path}`)
            return node
          })
          sources.set(placement.id, source)
        }
        const mesh = new Mesh((await source).geometry, material)
        mesh.position.set(...placement.position)
        mesh.rotation.y = placement.rotationY ?? 0
        return mesh
      }))
      const result = measureConstructionRoute(layout.route, meshes)
      console.log(`${pack}/${layout.id} · ${result.samples} route samples · ${result.problems.length} problems`)
      for (const { kind, point } of result.problems.slice(0, 4)) {
        failures.push(`${pack}/${layout.id}: ${kind} near (${point.map((n) => n.toFixed(2)).join(', ')})`)
      }
    }
  }

  material.dispose()
  if (failures.length) throw new Error(failures.join('\n'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
