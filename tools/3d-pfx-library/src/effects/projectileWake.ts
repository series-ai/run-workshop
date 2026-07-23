import * as THREE from 'three'

export function createPfxProjectileWakeGeometry(
  radialSegments = 20,
  axialSegments = 28,
): THREE.BufferGeometry {
  const radial = Math.max(8, Math.floor(radialSegments))
  const axial = Math.max(12, Math.floor(axialSegments))
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const strandCount = 1
  const headRadius = 0.62
  const tailRadius = 0.025
  const headX = 1.1
  const length = 2.7

  let tailY = 0
  let tailZ = 0
  for (let ring = 0; ring <= axial; ring += 1) {
    const t = ring / axial
    const x = headX - length * t
    const centerY = Math.sin(t * Math.PI * 2.2) * 0.09 * Math.pow(t, 0.7)
    const centerZ = Math.cos(t * Math.PI * 1.6) * 0.07 * Math.pow(t, 0.8)
    tailY = centerY
    tailZ = centerZ
    const baseRadius = tailRadius + (0.34 - tailRadius) * Math.pow(1 - t, 0.75)
    const headCollar = 0.22 * Math.exp(-t * 22)
    const scallop = 0.9 + Math.sin(t * Math.PI * 6 + 0.8) * 0.1 * Math.pow(Math.sin(Math.PI * t), 0.6)
    const radius = (baseRadius + headCollar) * scallop
    for (let side = 0; side < radial; side += 1) {
      const angle = (side / radial) * Math.PI * 2
      const ny = Math.cos(angle)
      const nz = Math.sin(angle)
      const headLobe = 1 + Math.sin(angle * 3 + 0.4) * 0.1 * Math.exp(-t * 12)
      positions.push(x, centerY + ny * radius * headLobe, centerZ + nz * radius * headLobe)
      normals.push(0, ny, nz)
      uvs.push(1 - t, side / radial)
    }
  }
  for (let ring = 0; ring < axial; ring += 1) {
    for (let side = 0; side < radial; side += 1) {
      const next = (side + 1) % radial
      const a = ring * radial + side
      const b = ring * radial + next
      const c = (ring + 1) * radial + next
      const d = (ring + 1) * radial + side
      indices.push(a, d, b, b, d, c)
    }
  }
  const headCenter = positions.length / 3
  positions.push(headX, 0, 0)
  normals.push(1, 0, 0)
  uvs.push(1, 0.5)
  const tailCenter = positions.length / 3
  positions.push(headX - length, tailY, tailZ)
  normals.push(-1, 0, 0)
  uvs.push(0, 0.5)
  const tailStart = axial * radial
  for (let side = 0; side < radial; side += 1) {
    const next = (side + 1) % radial
    indices.push(headCenter, next, side)
    indices.push(tailCenter, tailStart + side, tailStart + next)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxProjectileWakeGeometry'] = 'closed-tapered-volumetric-plasma-wake'
  geometry.userData['pfxProjectileWakeClosedCaps'] = true
  geometry.userData['pfxProjectileWakeStrandCount'] = strandCount
  geometry.userData['pfxProjectileWakeRadialSegments'] = radial
  geometry.userData['pfxProjectileWakeHeadLobes'] = 3
  geometry.userData['pfxProjectileWakeHeadRadius'] = headRadius
  geometry.userData['pfxProjectileWakeTailRadius'] = tailRadius
  geometry.userData['pfxProjectileWakeDrawCalls'] = 1
  return geometry
}
