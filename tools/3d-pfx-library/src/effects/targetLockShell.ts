import * as THREE from 'three'

export function createPfxTargetLockShellGeometry(): THREE.BufferGeometry {
  const sources: THREE.BufferGeometry[] = []
  const sphere = new THREE.SphereGeometry(0.72, 32, 24).toNonIndexed()
  sources.push(sphere)
  let bracketCount = 0
  for (const zSide of [-1, 1]) {
    for (const xSide of [-1, 1]) {
      for (const ySide of [-1, 1]) {
        const z = zSide * 0.66
        const horizontal = new THREE.BoxGeometry(0.24, 0.052, 0.07).toNonIndexed()
        horizontal.translate(xSide * 0.49, ySide * 0.6, z)
        sources.push(horizontal)
        const vertical = new THREE.BoxGeometry(0.052, 0.24, 0.07).toNonIndexed()
        vertical.translate(xSide * 0.6, ySide * 0.49, z)
        sources.push(vertical)
        bracketCount += 1
      }
    }
  }
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (const source of sources) {
    const position = source.getAttribute('position')
    const normal = source.getAttribute('normal')
    const uv = source.getAttribute('uv')
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index))
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index))
      uvs.push(uv.getX(index), uv.getY(index))
    }
    source.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxTargetLockShellGeometry'] = 'single-draw-closed-sphere-with-3d-acquisition-brackets'
  geometry.userData['pfxTargetLockShellDrawCalls'] = 1
  geometry.userData['pfxTargetLockShellBracketCount'] = bracketCount
  geometry.userData['pfxTargetLockShellClosedGeometry'] = true
  return geometry
}
