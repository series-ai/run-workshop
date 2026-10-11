/**
 * Load-time contract for RUN voxel models (Pirate Nation files are upstream
 * and exempt). A violation throws `AssetContractError`, which the viewer's
 * error boundary shows by name instead of rendering a wrong asset.
 */
import { Box3, ClampToEdgeWrapping, NearestFilter, PropertyBinding, type AnimationClip, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import type { VoxelModelEntry } from '@rvx/contracts/catalog'
import { UNITS_PER_VOXEL } from '@rvx/contracts/categories'

export type ContractRule = 'material.sampler' | 'material.pbr' | 'material.palette' | 'clips.missing' | 'clips.targets' | 'sockets.missing' | 'bounds.mismatch'

export class AssetContractError extends Error {
  override name = 'AssetContractError'
  constructor(
    readonly assetId: string,
    readonly rule: ContractRule,
    detail: string,
  ) {
    super(`${assetId} [${rule}] ${detail}`)
  }
}

/** Every track of `clip` must drive a node under `root`; three.js would drop the rest silently. */
export function assertClipTargets(root: Object3D, clip: AnimationClip, assetId: string): void {
  const missing = clip.tracks.map((t) => PropertyBinding.parseTrackName(t.name).nodeName).filter((n) => !PropertyBinding.findNode(root, n))
  if (missing.length > 0) throw new AssetContractError(assetId, 'clips.targets', `clip "${clip.name}" drives missing nodes: ${[...new Set(missing)].join(', ')}`)
}

export function assertModelContract(scene: Object3D, animations: readonly AnimationClip[], entry: VoxelModelEntry): void {
  if (entry.pack === 'pirate') return
  scene.updateMatrixWorld(true)
  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[]
    for (const material of materials) {
      const map = material.map
      if (!map || map.magFilter !== NearestFilter || map.minFilter !== NearestFilter || map.wrapS !== ClampToEdgeWrapping || map.wrapT !== ClampToEdgeWrapping) {
        throw new AssetContractError(entry.id, 'material.sampler', `material "${material.name}" must sample its texture nearest + clamp`)
      }
      // World models paint a per-model atlas; avatar-space models share the 256×1 palette.
      const image = map.image as { width?: number; height?: number } | undefined
      if (entry.space === 'avatar' && (image?.width !== 256 || image?.height !== 1)) {
        throw new AssetContractError(entry.id, 'material.palette', `material "${material.name}" palette is ${image?.width}×${image?.height}, expected 256×1`)
      }
      if (Math.abs(material.metalness) > 1e-6 || Math.abs(material.roughness - 1) > 1e-6) {
        throw new AssetContractError(entry.id, 'material.pbr', `material "${material.name}" must be metallic 0 / roughness 1`)
      }
    }
  })
  const clipNames = new Set(animations.map((clip) => clip.name))
  for (const clip of entry.clips) {
    if (!clipNames.has(clip)) throw new AssetContractError(entry.id, 'clips.missing', `catalog clip "${clip}" is not in the file`)
  }
  for (const socket of entry.sockets) {
    if (!scene.getObjectByName(PropertyBinding.sanitizeNodeName(socket))) {
      throw new AssetContractError(entry.id, 'sockets.missing', `socket "${socket}" is not in the file`)
    }
  }
  const box = new Box3().setFromObject(scene, true) // exact: tilted parts inflate the quick box
  const tolerance = 0.5 * UNITS_PER_VOXEL[entry.space]
  const diff = Math.max(
    ...[box.min.x - entry.bounds.min[0], box.min.y - entry.bounds.min[1], box.min.z - entry.bounds.min[2], box.max.x - entry.bounds.max[0], box.max.y - entry.bounds.max[1], box.max.z - entry.bounds.max[2]].map(Math.abs),
  )
  if (!(diff <= tolerance)) {
    throw new AssetContractError(entry.id, 'bounds.mismatch', `rest bounds differ from the catalog by ${diff.toFixed(4)} (max ${tolerance})`)
  }
}
