import { meshVoxelPrefab, voxelSceneSchema, type VoxelGeometry } from './levelVoxelGeometry'

export type VoxelWorkerResult =
  | { kind: 'ready'; meshes: Record<string, VoxelGeometry> }
  | { kind: 'error'; message: string }

self.onmessage = async ({ data: url }: MessageEvent<string>) => {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Voxel level request failed (${response.status}).`)
    const scene = voxelSceneSchema.parse(await response.json())
    const meshes = Object.fromEntries(Object.entries(scene.prefabs)
      .map(([key, prefab]) => [key, meshVoxelPrefab(prefab, scene.voxelSize)]))
    const transfers = Object.values(meshes).flatMap(mesh => Object.values(mesh).map(array => array.buffer))
    self.postMessage({ kind: 'ready', meshes } satisfies VoxelWorkerResult, { transfer: transfers })
  } catch (error) {
    self.postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) } satisfies VoxelWorkerResult)
  }
}
