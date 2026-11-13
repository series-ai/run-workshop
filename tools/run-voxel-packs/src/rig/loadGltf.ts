/**
 * Node-side GLTFLoader for rig tests. Textures are stripped first: Node has
 * no image decoder, and the rig checks need geometry, skins and clips only.
 */
import { readFileSync } from 'node:fs'
import { createIo } from '../gltfIo'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export async function loadGltfWithoutTextures(path: string): Promise<GLTF> {
  const io = createIo()
  const doc = await io.readBinary(new Uint8Array(readFileSync(path)))
  for (const texture of doc.getRoot().listTextures()) texture.dispose()
  const bytes = await io.writeBinary(doc)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject))
}
