import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Fold a tot's many small meshes into one skinned mesh per material, so a tot costs a draw call per material instead of
 * one per leaf. Each original mesh becomes a bone of the merged mesh: it stays in the tree and keeps moving (leaf
 * springs, pot squash, props), it just doesn't draw itself any more. Its `isMesh` is switched off so neither the
 * renderer nor GLTFExporter treats it as a mesh, and code holding a reference to it keeps working.
 *
 * Visibility doesn't carry over (a bone has no visibility): only merge props that hide by scale 0, as the pack's baked
 * tots do. Call it after the plant is grown (`setPlant` rebuilds the plant and would need merging again).
 */
export function mergeMeshes(root: THREE.Object3D, under: THREE.Object3D[] = [root], skip: (o: THREE.Object3D) => boolean = () => false) {
  root.updateMatrixWorld(true)
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const byMat = new Map<THREE.Material, THREE.Mesh[]>()
  const visit = (o: THREE.Object3D) => {
    if (skip(o)) return
    o.children.forEach(visit)
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material) || m.morphTargetInfluences) return
    if (Math.abs(m.matrixWorld.determinant()) < 1e-12) return // collapsed right now: can't bind it
    const list = byMat.get(m.material) ?? []
    list.push(m)
    byMat.set(m.material, list)
  }
  under.forEach(visit)
  const merged: THREE.SkinnedMesh[] = []
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue
    const colour = meshes.some((m) => m.geometry.getAttribute('color'))
    const geos = meshes.map((m, bone) => {
      const src = m.geometry
      const g = new THREE.BufferGeometry()
      const n = src.getAttribute('position').count
      for (const k of ['position', 'normal', 'uv', 'color']) {
        const a = src.getAttribute(k)
        const size = k === 'uv' ? 2 : 3
        const f = new Float32Array(n * size)
        if (a) for (let i = 0; i < n; i++) for (let j = 0; j < size; j++) f[i * size + j] = a.getComponent(i, j)
        else if (k === 'color') f.fill(1)
        if (a || (k === 'color' && colour) || k === 'uv') g.setAttribute(k, new THREE.BufferAttribute(f, size))
      }
      if (!colour) g.deleteAttribute('color')
      if (!src.getAttribute('normal')) g.computeVertexNormals()
      g.setIndex(src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i))
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld))
      if (m.matrixWorld.determinant() < 0) {
        // mirrored: flip the winding back
        const ix = g.index!.array as Uint32Array | Uint16Array
        for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]
      }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 ? 0 : bone)), 4))
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)), 4))
      return g
    })
    const geo = mergeGeometries(geos)
    if (!geo) continue
    const sm = new THREE.SkinnedMesh(geo, mat)
    sm.name = `merged-${mat.name || 'mat'}`
    sm.castShadow = meshes[0].castShadow
    root.add(sm)
    sm.updateMatrixWorld(true)
    sm.bind(new THREE.Skeleton(meshes as unknown as THREE.Bone[]))
    for (const m of meshes) ((m as { isMesh: boolean }).isMesh = false), (m.userData.merged = true)
    merged.push(sm)
  }
  return merged
}

/** Undo mergeMeshes: the originals draw themselves again. */
export function unmergeMeshes(merged: THREE.SkinnedMesh[]) {
  for (const sm of merged) {
    for (const b of sm.skeleton.bones) ((b as unknown as { isMesh: boolean }).isMesh = true), delete b.userData.merged
    sm.removeFromParent()
    sm.geometry.dispose()
    sm.skeleton.dispose()
  }
}
