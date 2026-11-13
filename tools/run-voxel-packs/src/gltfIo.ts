/**
 * The one glTF reader/writer for the tool. It registers KHR_mesh_quantization,
 * because finalized world GLBs store integer positions (see build/finalize).
 */
import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'

export function createIo(): NodeIO {
  return new NodeIO().registerExtensions([KHRMeshQuantization])
}
