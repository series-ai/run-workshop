import * as THREE from 'three'

export function createPfxShardBreakIgnitionCoreGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const palette = [
    [0.96, 1, 1],
    [0.56, 0.9, 1],
    [0.18, 0.58, 0.88],
    [0.04, 0.25, 0.52],
  ] as const
  const top = new THREE.Vector3(0.035, 0.34, -0.02)
  const bottom = new THREE.Vector3(-0.045, -0.24, 0.035)
  const ring = Array.from({ length: 6 }, (_, index) => {
    const angle = index / 6 * Math.PI * 2 + 0.18
    const radius = 0.28 * (0.82 + (index % 3) * 0.11)
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      index % 2 === 0 ? 0.045 : -0.025,
      Math.sin(angle) * radius * (0.84 + (index % 2) * 0.12),
    )
  })
  const pushFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...color, ...color, ...color)
  }
  for (let face = 0; face < 6; face += 1) {
    const next = (face + 1) % 6
    pushFace(top, ring[face]!, ring[next]!, palette[face % palette.length]!)
    pushFace(bottom, ring[next]!, ring[face]!, palette[(face + 2) % palette.length]!)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxShardBreakCoreGeometry'] = 'closed-asymmetric-six-cut-ignition-seed'
  geometry.userData['pfxShardBreakCoreDrawCalls'] = 1
  geometry.userData['pfxShardBreakCoreClosedFaces'] = true
  geometry.userData['pfxShardBreakCoreFaceCount'] = 12
  geometry.userData['pfxShardBreakCoreWorldSpaceVolume'] = true
  geometry.userData['pfxShardBreakCoreRadius'] = 0.28
  return geometry
}
